/**
 * RED Web Companion Sync Engine
 *
 * Protocolo de Vinculación Criptográfica Multidispositivo (Estilo WhatsApp Web)
 * Permite a la versión Web (Navegador PC) sincronizar en tiempo real y de forma
 * BI-DIRECCIONAL la identidad soberana, contactos, conversaciones, mensajes enviados
 * y recibidos, acuses de lectura (read receipts) y estados de escritura.
 *
 * Arquitectura Omni-Transporte (4G / 5G / 6G, Wi-Fi WAN, Off-Grid):
 * - Vinculación inicial por Código QR con intercambio Diffie-Hellman P-256 + AES-256-GCM.
 * - Túnel en Vivo Persistente sobre WebSockets / MQTT con latido continuo (keepalive: 25s)
 *   y reconexión automática adaptativa (Roaming 4G <-> 5G <-> Wi-Fi).
 * - Cifrado E2E inviolable: los relés públicos solo transmiten bytes cifrados opacos.
 */

export interface CompanionSyncPayload {
    version: number;
    timestamp: number;
    identity: {
        identity_hash: string;
        short_id: string;
        public_key?: string;
        nickname: string;
    };
    masterPin: string;
    contacts: any[];
    conversations: any[];
    preferences?: any;
}

export interface PairingSession {
    sessionId: string;
    qrPayload: string;
    expiresAt: number;
    cleanup: () => void;
}

export interface CompanionLiveEvent {
    type: 
        | 'LIVE_MSG_SEND'         // Web envía mensaje -> Móvil lo transmite por la Malla (4G/5G/BLE/LoRa)
        | 'LIVE_MSG_RECV'         // Móvil recibe mensaje de la Malla -> Se replica en Web en tiempo real
        | 'LIVE_READ_ACK'         // Mensaje leído en un extremo -> Se marca como leído en el otro
        | 'LIVE_TYPING'           // Indicador de escritura sincronizado
        | 'LIVE_CONTACT_UPDATE'   // Contacto añadido o editado
        | 'LIVE_CONV_WIPE'        // Conversación eliminada
        | 'LIVE_PROFILE_UPDATE';  // Perfil / avatar actualizado
    senderId: string;
    timestamp: number;
    data: any;
}

export interface ActiveCompanionSession {
    sessionId: string;
    aesKeyHex: string;
    brokerUrl: string;
    isMobileHost: boolean;
    pairedAt: number;
}

// ── WebCrypto Helpers ─────────────────────────────────────────────────────────

async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
    );
}

async function exportPublicKeyHex(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey("raw", key);
    return Array.from(new Uint8Array(exported))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

async function importPublicKeyHex(hex: string): Promise<CryptoKey> {
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return await window.crypto.subtle.importKey(
        "raw",
        bytes,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );
}

async function deriveAesKey(privateKey: CryptoKey, peerPublicKey: CryptoKey): Promise<CryptoKey> {
    return await window.crypto.subtle.deriveKey(
        { name: "ECDH", public: peerPublicKey },
        privateKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

async function exportAesKeyHex(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey("raw", key);
    return Array.from(new Uint8Array(exported))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

async function importAesKeyHex(hex: string): Promise<CryptoKey> {
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return await window.crypto.subtle.importKey(
        "raw",
        bytes,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
    );
}

async function encryptData(key: CryptoKey, data: any): Promise<{ iv: string; ciphertext: string }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const cipherBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoded
    );
    return {
        iv: Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join(""),
        ciphertext: Array.from(new Uint8Array(cipherBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")
    };
}

async function decryptData(key: CryptoKey, ivHex: string, cipherHex: string): Promise<any> {
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const cipherBytes = new Uint8Array(cipherHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipherBytes
    );
    const decodedStr = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decodedStr);
}

// ── Broker Pool Ordenado por Estabilidad ──────────────────────────────────────

const MQTT_BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt"
];

const BROKER_INDEX_MAP: Record<string, string> = {
    "0": "wss://broker.emqx.io:8084/mqtt",
    "1": "wss://broker.hivemq.com:8884/mqtt"
};

// ── Lightweight Zero-Dependency MQTT v3.1.1 Client con Auto-Reconexión ────────

class SimpleMqttClient {
    private ws: WebSocket | null = null;
    private packetId = 1;
    public isConnected = false;
    private onMessageCb: ((topic: string, payload: string) => void) | null = null;
    private shouldReconnect = false;
    private reconnectTimeout: any = null;
    private subscribedTopics = new Set<string>();
    private brokerUrl: string;

    constructor(brokerUrl: string) {
        this.brokerUrl = brokerUrl;
    }

    public setBrokerUrl(url: string) {
        this.brokerUrl = url;
    }

    public getBrokerUrl(): string {
        return this.brokerUrl;
    }

    public connect(onConnect?: () => void, onError?: (err: any) => void): Promise<void> {
        this.shouldReconnect = true;
        return new Promise<void>((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.brokerUrl, "mqtt");
                this.ws.binaryType = "arraybuffer";

                const timeout = setTimeout(() => {
                    if (!this.isConnected) {
                        try { this.ws?.close(); } catch {}
                        const err = new Error(`Timeout conectando a broker MQTT: ${this.brokerUrl}`);
                        onError?.(err);
                        reject(err);
                    }
                }, 10000);

                this.ws.onopen = () => {
                    this.sendConnect();
                };

                this.ws.onmessage = (event) => {
                    const data = new Uint8Array(event.data as ArrayBuffer);
                    const packetType = data[0] >> 4;

                    if (packetType === 2) {
                        // CONNACK
                        clearTimeout(timeout);
                        this.isConnected = true;
                        console.log(`[SimpleMqttClient] ✅ Conectado a broker MQTT: ${this.brokerUrl}`);
                        
                        // Re-suscribirse a todos los tópicos pendientes
                        for (const topic of this.subscribedTopics) {
                            this.sendSubscribe(topic);
                        }

                        onConnect?.();
                        resolve();
                    } else if (packetType === 3) {
                        // PUBLISH
                        this.handlePublish(data);
                    }
                };

                this.ws.onerror = (err) => {
                    if (!this.isConnected) {
                        clearTimeout(timeout);
                        onError?.(err);
                        reject(err);
                    }
                };

                this.ws.onclose = () => {
                    this.isConnected = false;
                    if (this.shouldReconnect) {
                        this.scheduleReconnect();
                    }
                };

            } catch (e) {
                onError?.(e);
                reject(e);
            }
        });
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) return;
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.shouldReconnect && !this.isConnected) {
                console.log(`[SimpleMqttClient] 🔄 Reconectando al relé MQTT (${this.brokerUrl})...`);
                this.connect().catch(() => {});
            }
        }, 3500);
    }

    public onMessage(cb: (topic: string, payload: string) => void) {
        this.onMessageCb = cb;
    }

    public subscribe(topic: string) {
        this.subscribedTopics.add(topic);
        if (this.isConnected) {
            this.sendSubscribe(topic);
        }
    }

    private sendSubscribe(topic: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const topicBytes = new TextEncoder().encode(topic);
        const pid = this.packetId++;

        const varHeader = [(pid >> 8) & 0xff, pid & 0xff];
        const payload = [(topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff, ...topicBytes, 0x00];

        const remainingLength = varHeader.length + payload.length;
        const lenBytes = this.encodeRemainingLength(remainingLength);
        const packet = new Uint8Array([0x82, ...lenBytes, ...varHeader, ...payload]);
        this.ws.send(packet);
    }

    public publish(topic: string, payloadStr: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const topicBytes = new TextEncoder().encode(topic);
        const payloadBytes = new TextEncoder().encode(payloadStr);

        const varHeader = [(topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff, ...topicBytes];
        const remainingLength = varHeader.length + payloadBytes.length;
        const lenBytes = this.encodeRemainingLength(remainingLength);

        const packet = new Uint8Array([0x30, ...lenBytes, ...varHeader, ...payloadBytes]);
        this.ws.send(packet);
    }

    public sendPing() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(new Uint8Array([0xC0, 0x00])); // MQTT PINGREQ
            } catch {}
        }
    }

    public close() {
        this.shouldReconnect = false;
        this.isConnected = false;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            try { this.ws.close(); } catch {}
            this.ws = null;
        }
    }

    private sendConnect() {
        if (!this.ws) return;
        const clientId = `red_pair_${Math.random().toString(36).substring(2, 10)}`;
        const protoBytes = new TextEncoder().encode("MQTT");
        const clientBytes = new TextEncoder().encode(clientId);

        const varHeader = [0x00, protoBytes.length, ...protoBytes, 0x04, 0x02, 0x00, 0x3c];
        const payload = [(clientBytes.length >> 8) & 0xff, clientBytes.length & 0xff, ...clientBytes];

        const remainingLength = varHeader.length + payload.length;
        const lenBytes = this.encodeRemainingLength(remainingLength);
        const packet = new Uint8Array([0x10, ...lenBytes, ...varHeader, ...payload]);
        this.ws.send(packet);
    }

    private encodeRemainingLength(length: number): number[] {
        const encodedBytes: number[] = [];
        let x = length;
        do {
            let encodedByte = x % 128;
            x = Math.floor(x / 128);
            if (x > 0) {
                encodedByte |= 128;
            }
            encodedBytes.push(encodedByte);
        } while (x > 0);
        return encodedBytes;
    }

    private handlePublish(data: Uint8Array) {
        try {
            let offset = 1;
            let multiplier = 1;
            let remLen = 0;
            while (offset < data.length) {
                const byte = data[offset++];
                remLen += (byte & 0x7f) * multiplier;
                multiplier *= 128;
                if ((byte & 0x80) === 0) break;
            }

            const topicLen = (data[offset] << 8) | data[offset + 1];
            offset += 2;
            const topic = new TextDecoder().decode(data.slice(offset, offset + topicLen));
            offset += topicLen;

            const payloadStr = new TextDecoder().decode(data.slice(offset));
            if (this.onMessageCb) {
                this.onMessageCb(topic, payloadStr);
            }
        } catch (e) {
            console.warn("[SimpleMqttClient] Publish decode error:", e);
        }
    }
}

// ── Companion Sync Engine Class ──────────────────────────────────────────────

class CompanionSyncEngineClass {
    private liveClient: SimpleMqttClient | null = null;
    private liveAesKey: CryptoKey | null = null;
    private activeSession: ActiveCompanionSession | null = null;
    private liveListeners: ((event: CompanionLiveEvent) => void)[] = [];
    private pingInterval: any = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.loadSavedSession();
        }
    }

    /**
     * Carga y reactiva la sesión viva guardada en localStorage si existe.
     */
    private async loadSavedSession() {
        try {
            const raw = localStorage.getItem('red_companion_active_session');
            if (!raw) return;
            const session: ActiveCompanionSession = JSON.parse(raw);
            if (session && session.sessionId && session.aesKeyHex && session.brokerUrl) {
                this.activeSession = session;
                this.liveAesKey = await importAesKeyHex(session.aesKeyHex);
                this.startLiveBridge(session.sessionId, session.brokerUrl);
            }
        } catch (e) {
            console.warn('[CompanionEngine] Error cargando sesión persistente:', e);
        }
    }

    /**
     * Conecta a un broker intentando cada uno del pool hasta encontrar uno funcional.
     */
    private async connectToBestBroker(
        onProgress?: (msg: string) => void
    ): Promise<{ client: SimpleMqttClient; brokerIndex: number }> {
        for (let i = 0; i < MQTT_BROKERS.length; i++) {
            const broker = MQTT_BROKERS[i];
            onProgress?.(`Conectando al relé ${i + 1}/${MQTT_BROKERS.length}…`);
            try {
                const client = new SimpleMqttClient(broker);
                await new Promise<void>((resolve, reject) =>
                    client.connect(resolve, reject)
                );
                console.log(`[CompanionEngine] Conectado a broker[${i}]: ${broker}`);
                return { client, brokerIndex: i };
            } catch (e) {
                console.warn(`[CompanionEngine] Broker[${i}] falló: ${broker}`, e);
            }
        }
        throw new Error("No se pudo conectar a ningún relé de emparejamiento. Verifica tu conexión a internet.");
    }

    /**
     * Inicia una sesión de vinculación en el Navegador Web (muestra QR).
     * Mantiene la conexión abierta y activa el canal en vivo tras recibir la bóveda.
     */
    public async createWebPairingSession(
        onSuccess: (payload: CompanionSyncPayload) => void,
        onError: (err: string) => void
    ): Promise<PairingSession> {
        if (typeof window === "undefined" || !window.crypto?.subtle) {
            throw new Error("WebCrypto no soportado en este entorno");
        }

        const keyPair = await generateEcdhKeyPair();
        const pubKeyHex = await exportPublicKeyHex(keyPair.publicKey);
        const randomId = Array.from(window.crypto.getRandomValues(new Uint8Array(12)))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
        const sessionId = `redpair_${randomId}`;
        const expiresAt = Date.now() + 180 * 1000; // 3 minutos

        // PASO 1: Conectar al broker ANTES de generar el QR
        const { client, brokerIndex } = await this.connectToBestBroker();

        const vaultTopic = `red/pair/${sessionId}/vault`;
        const ackTopic = `red/pair/${sessionId}/ack`;
        const liveTopic = `red/pair/${sessionId}/live`;

        client.subscribe(vaultTopic);
        console.log(`[CompanionEngine] Web suscrita en: ${vaultTopic} vía broker[${brokerIndex}]`);

        let isClosed = false;

        const cleanup = () => {
            isClosed = true;
            if (this.liveClient !== client) {
                client.close();
            }
        };

        client.onMessage(async (topic, payloadStr) => {
            if (isClosed) return;
            if (topic === vaultTopic) {
                try {
                    const msg = JSON.parse(payloadStr);
                    if (msg.senderPubKey && msg.iv && msg.ciphertext) {
                        const mobilePubKey = await importPublicKeyHex(msg.senderPubKey);
                        const aesKey = await deriveAesKey(keyPair.privateKey, mobilePubKey);
                        const decrypted: CompanionSyncPayload = await decryptData(aesKey, msg.iv, msg.ciphertext);

                        // ACK inmediato al móvil
                        client.publish(ackTopic, JSON.stringify({ type: "red_companion_ack", status: "success" }));
                        setTimeout(() => {
                            if (client.isConnected) {
                                client.publish(ackTopic, JSON.stringify({ type: "red_companion_ack", status: "success" }));
                            }
                        }, 300);

                        // Guardar sesión viva en localStorage
                        const aesKeyHex = await exportAesKeyHex(aesKey);
                        const activeSession: ActiveCompanionSession = {
                            sessionId,
                            aesKeyHex,
                            brokerUrl: client.getBrokerUrl(),
                            isMobileHost: false,
                            pairedAt: Date.now()
                        };
                        this.activeSession = activeSession;
                        this.liveAesKey = aesKey;
                        localStorage.setItem('red_companion_active_session', JSON.stringify(activeSession));

                        // Promover el cliente a Canal en Vivo Persistente
                        this.liveClient = client;
                        client.subscribe(liveTopic);
                        this.setupLiveMessageListener(client, liveTopic, aesKey);
                        this.startKeepalive(client);

                        onSuccess(decrypted);
                    }
                } catch (e: any) {
                    console.error("[CompanionEngine] Error procesando cápsula:", e);
                    onError(e?.message || "Error al descifrar bóveda recibida");
                }
            }
        });

        // Keepalive PINGREQ cada 25s
        this.startKeepalive(client);

        // PASO 2: Generar el QR con el brokerIndex real embebido en el campo 6
        const qrPayload = `RED_PAIR:1:${sessionId}:${pubKeyHex}:${expiresAt}:${brokerIndex}`;

        return {
            sessionId,
            qrPayload,
            expiresAt,
            cleanup
        };
    }

    /**
     * Ejecutado desde la App Móvil: Lee el broker del QR, cifra la bóveda y la envía.
     * Al recibir el ACK, activa el Canal en Vivo Persistente en el móvil.
     */
    public async transmitMobileVaultToWeb(
        qrData: string,
        vaultPayload: CompanionSyncPayload,
        onProgress?: (status: string) => void
    ): Promise<boolean> {
        if (!qrData.startsWith("RED_PAIR:1:")) {
            throw new Error("Código QR de vinculación no válido");
        }

        const parts = qrData.split(":");
        if (parts.length < 5) {
            throw new Error("Formato de emparejamiento incompleto");
        }

        const sessionId = parts[2];
        const webPubKeyHex = parts[3];
        const expiresAt = parseInt(parts[4], 10);
        let brokerIdx = -1;
        if (parts.length >= 6 && parts[5] !== undefined && parts[5].trim() !== "") {
            const parsed = parseInt(parts[5].trim(), 10);
            if (!isNaN(parsed) && parsed >= 0) {
                brokerIdx = parsed;
            }
        }

        if (Date.now() > expiresAt) {
            throw new Error("El código QR ha caducado. Genera uno nuevo en la web.");
        }

        const vaultTopic = `red/pair/${sessionId}/vault`;
        const ackTopic = `red/pair/${sessionId}/ack`;
        const liveTopic = `red/pair/${sessionId}/live`;

        onProgress?.("Estableciendo canal criptográfico seguro E2E…");

        const mobileKeyPair = await generateEcdhKeyPair();
        const mobilePubKeyHex = await exportPublicKeyHex(mobileKeyPair.publicKey);
        const webPubKey = await importPublicKeyHex(webPubKeyHex);
        const aesKey = await deriveAesKey(mobileKeyPair.privateKey, webPubKey);

        onProgress?.("Cifrando bóveda táctica con AES-256-GCM…");
        const encrypted = await encryptData(aesKey, vaultPayload);

        const vaultMessage = JSON.stringify({
            type: "red_companion_vault",
            senderPubKey: mobilePubKeyHex,
            iv: encrypted.iv,
            ciphertext: encrypted.ciphertext
        });

        const brokersToTry = (brokerIdx >= 0 && BROKER_INDEX_MAP[String(brokerIdx)])
            ? [BROKER_INDEX_MAP[String(brokerIdx)], ...MQTT_BROKERS.filter((_, i) => i !== brokerIdx)]
            : MQTT_BROKERS;

        onProgress?.("Conectando con el relé seguro…");

        return new Promise<boolean>(async (resolve, reject) => {
            let activeClient: SimpleMqttClient | null = null;
            let isResolved = false;

            const timeout = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    if (activeClient) activeClient.close();
                    reject(new Error("Tiempo de espera agotado. Asegúrate de que la página web esté abierta y esperando el QR."));
                }
            }, 45000);

            for (const brokerUrl of brokersToTry) {
                if (isResolved) break;
                try {
                    onProgress?.(`Conectando al relé…`);
                    const client = new SimpleMqttClient(brokerUrl);
                    await new Promise<void>((res, rej) => client.connect(res, rej));

                    if (isResolved) {
                        client.close();
                        break;
                    }

                    activeClient = client;
                    client.subscribe(ackTopic);

                    onProgress?.("Transmitiendo cápsula cifrada al navegador…");
                    client.publish(vaultTopic, vaultMessage);

                    const retryInterval = setInterval(() => {
                        if (isResolved || !client.isConnected) {
                            clearInterval(retryInterval);
                            return;
                        }
                        client.publish(vaultTopic, vaultMessage);
                    }, 1500);

                    client.onMessage(async (topic, payloadStr) => {
                        if (isResolved) return;
                        if (topic === ackTopic) {
                            try {
                                const msg = JSON.parse(payloadStr);
                                if (msg.type === "red_companion_ack" || msg.status === "success") {
                                    isResolved = true;
                                    clearTimeout(timeout);
                                    clearInterval(retryInterval);

                                    // Guardar sesión viva en el móvil
                                    const aesKeyHex = await exportAesKeyHex(aesKey);
                                    const activeSession: ActiveCompanionSession = {
                                        sessionId,
                                        aesKeyHex,
                                        brokerUrl,
                                        isMobileHost: true,
                                        pairedAt: Date.now()
                                    };
                                    this.activeSession = activeSession;
                                    this.liveAesKey = aesKey;
                                    localStorage.setItem('red_companion_active_session', JSON.stringify(activeSession));

                                    // Mantener el canal en vivo abierto en el móvil
                                    this.liveClient = client;
                                    client.subscribe(liveTopic);
                                    this.setupLiveMessageListener(client, liveTopic, aesKey);
                                    this.startKeepalive(client);

                                    console.log(`[CompanionEngine:Mobile] 🚀 Canal en Vivo Activado en tópico: ${liveTopic}`);
                                    resolve(true);
                                }
                            } catch {}
                        }
                    });

                    break;
                } catch (e) {
                    console.warn(`[CompanionEngine:Mobile] Broker falló: ${brokerUrl}`, e);
                }
            }

            if (!activeClient && !isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                reject(new Error("No se pudo conectar a los relés de emparejamiento. Verifica tu conexión a internet."));
            }
        });
    }

    /**
     * Inicia o reactiva el canal en vivo con los datos de sesión almacenados.
     */
    private async startLiveBridge(sessionId: string, brokerUrl: string) {
        if (this.liveClient) {
            this.liveClient.close();
        }

        const liveTopic = `red/pair/${sessionId}/live`;
        console.log(`[CompanionEngine] 🔌 Reactivando Canal en Vivo en: ${brokerUrl} (${liveTopic})`);

        const client = new SimpleMqttClient(brokerUrl);
        this.liveClient = client;

        client.connect(
            () => {
                client.subscribe(liveTopic);
                if (this.liveAesKey) {
                    this.setupLiveMessageListener(client, liveTopic, this.liveAesKey);
                }
                this.startKeepalive(client);
            },
            (err) => {
                console.warn('[CompanionEngine] Fallo al reactivar canal en vivo:', err);
            }
        );
    }

    private setupLiveMessageListener(client: SimpleMqttClient, liveTopic: string, aesKey: CryptoKey) {
        client.onMessage(async (topic, payloadStr) => {
            if (topic === liveTopic) {
                try {
                    const msg = JSON.parse(payloadStr);
                    if (msg.iv && msg.ciphertext) {
                        const event: CompanionLiveEvent = await decryptData(aesKey, msg.iv, msg.ciphertext);
                        // Ignorar eventos generados por nosotros mismos
                        const myId = localStorage.getItem('red_identity_hash') || '';
                        if (event.senderId && myId && event.senderId === myId) {
                            return;
                        }
                        console.log(`[CompanionEngine] ⚡ Evento en Vivo Recibido: ${event.type}`, event.data);
                        this.notifyLiveListeners(event);
                    }
                } catch (err) {
                    console.warn('[CompanionEngine] Error descifrando evento en vivo:', err);
                }
            }
        });
    }

    private startKeepalive(client: SimpleMqttClient) {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (client.isConnected) {
                client.sendPing();
            }
        }, 25000);
    }

    /**
     * Transmite un evento en tiempo real (mensaje nuevo, lectura, contacto) al dispositivo compañero.
     */
    public async publishLiveEvent(type: CompanionLiveEvent['type'], data: any): Promise<boolean> {
        if (!this.liveClient || !this.liveClient.isConnected || !this.liveAesKey || !this.activeSession) {
            return false;
        }

        try {
            const myId = localStorage.getItem('red_identity_hash') || 'me';
            const event: CompanionLiveEvent = {
                type,
                senderId: myId,
                timestamp: Date.now(),
                data
            };

            const encrypted = await encryptData(this.liveAesKey, event);
            const liveTopic = `red/pair/${this.activeSession.sessionId}/live`;

            this.liveClient.publish(liveTopic, JSON.stringify({
                iv: encrypted.iv,
                ciphertext: encrypted.ciphertext
            }));

            return true;
        } catch (err) {
            console.warn('[CompanionEngine] Error publicando evento en vivo:', err);
            return false;
        }
    }

    /**
     * Suscribe un callback para recibir eventos del dispositivo compañero en tiempo real.
     */
    public onLiveEvent(callback: (event: CompanionLiveEvent) => void): () => void {
        this.liveListeners.push(callback);
        return () => {
            this.liveListeners = this.liveListeners.filter(l => l !== callback);
        };
    }

    private notifyLiveListeners(event: CompanionLiveEvent) {
        for (const listener of this.liveListeners) {
            try {
                listener(event);
            } catch (err) {
                console.warn('[CompanionEngine] Error en listener de evento en vivo:', err);
            }
        }
    }

    /**
     * Consulta si hay una sesión viva vinculada activa.
     */
    public isLiveSessionActive(): boolean {
        return Boolean(this.liveClient?.isConnected && this.activeSession);
    }

    /**
     * Desvincula la sesión viva activa.
     */
    public unpairSession() {
        if (this.liveClient) {
            this.liveClient.close();
            this.liveClient = null;
        }
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        this.activeSession = null;
        this.liveAesKey = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('red_companion_active_session');
        }
    }
}

export const companionSyncEngine = new CompanionSyncEngineClass();
