/**
 * RED Web Companion Sync Engine
 * 
 * Protocolo de Vinculación Criptográfica Multidispositivo (Estilo WhatsApp Web)
 * Permite a la versión Web (Navegador PC) sincronizar en tiempo real
 * la identidad soberana, contactos y conversaciones desde la app móvil Android.
 * 
 * Utiliza brokers globales MQTT de alta disponibilidad sobre WebSockets
 * (EMQX, HiveMQ, Mosquitto) con cifrado E2E ECDH P-256 + AES-256-GCM.
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
        false,
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

// ── Lightweight Zero-Dependency MQTT v3.1.1 Client ───────────────────────────

const MQTT_BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
    "wss://test.mosquitto.org:8081"
];

class SimpleMqttClient {
    private ws: WebSocket | null = null;
    private packetId = 1;
    public isConnected = false;
    private onMessageCb: ((topic: string, payload: string) => void) | null = null;

    constructor(private brokerUrl: string) {}

    public connect(onOpen: () => void, onError: (err: any) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            let settled = false;
            try {
                this.ws = new WebSocket(this.brokerUrl, ["mqttv3.1", "mqtt"]);
                this.ws.binaryType = "arraybuffer";
            } catch (e) {
                reject(e);
                return;
            }

            const timeout = setTimeout(() => {
                if (!settled && !this.isConnected) {
                    settled = true;
                    this.close();
                    reject(new Error(`Timeout conectando a broker ${this.brokerUrl}`));
                }
            }, 6000);

            this.ws.onopen = () => {
                this.sendConnect();
            };

            this.ws.onmessage = (event: MessageEvent) => {
                const data = new Uint8Array(event.data as ArrayBuffer);
                if (data.length === 0) return;

                const packetType = data[0] >> 4;
                if (packetType === 2) {
                    // CONNACK
                    clearTimeout(timeout);
                    this.isConnected = true;
                    if (!settled) {
                        settled = true;
                        onOpen();
                        resolve();
                    }
                } else if (packetType === 3) {
                    // PUBLISH
                    this.handlePublish(data);
                }
            };

            this.ws.onerror = (err) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timeout);
                    onError(err);
                    reject(err);
                }
            };

            this.ws.onclose = () => {
                this.isConnected = false;
            };
        });
    }

    public onMessage(cb: (topic: string, payload: string) => void) {
        this.onMessageCb = cb;
    }

    public subscribe(topic: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const topicBytes = new TextEncoder().encode(topic);
        const pid = this.packetId++;

        const varHeader = [ (pid >> 8) & 0xff, pid & 0xff ];
        const payload = [ (topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff, ...topicBytes, 0x00 ];

        const remainingLength = varHeader.length + payload.length;
        const packet = new Uint8Array([ 0x82, remainingLength, ...varHeader, ...payload ]);
        this.ws.send(packet);
    }

    public publish(topic: string, payloadStr: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const topicBytes = new TextEncoder().encode(topic);
        const payloadBytes = new TextEncoder().encode(payloadStr);

        const varHeader = [ (topicBytes.length >> 8) & 0xff, topicBytes.length & 0xff, ...topicBytes ];
        const remainingLength = varHeader.length + payloadBytes.length;

        // Encode remaining length (supports up to 16KB easily)
        const lenBytes: number[] = [];
        let l = remainingLength;
        do {
            let digit = l % 128;
            l = Math.floor(l / 128);
            if (l > 0) digit = digit | 0x80;
            lenBytes.push(digit);
        } while (l > 0);

        const packet = new Uint8Array([ 0x30, ...lenBytes, ...varHeader, ...payloadBytes ]);
        this.ws.send(packet);
    }

    public close() {
        this.isConnected = false;
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

        const varHeader = [ 0x00, protoBytes.length, ...protoBytes, 0x04, 0x02, 0x00, 0x3c ];
        const payload = [ (clientBytes.length >> 8) & 0xff, clientBytes.length & 0xff, ...clientBytes ];

        const remainingLength = varHeader.length + payload.length;
        const packet = new Uint8Array([ 0x10, remainingLength, ...varHeader, ...payload ]);
        this.ws.send(packet);
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

    /**
     * Inicia una sesión de vinculación en el Navegador Web (muestra QR).
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
        const expiresAt = Date.now() + 120 * 1000; // 2 minutos de validez

        const qrPayload = `RED_PAIR:1:${sessionId}:${pubKeyHex}:${expiresAt}`;
        const vaultTopic = `red/pair/${sessionId}/vault`;
        const ackTopic = `red/pair/${sessionId}/ack`;

        let activeClient: SimpleMqttClient | null = null;
        let isClosed = false;

        const cleanup = () => {
            isClosed = true;
            if (activeClient) {
                activeClient.close();
                activeClient = null;
            }
        };

        // Conectar al pool de brokers MQTT de alta disponibilidad
        (async () => {
            for (const broker of MQTT_BROKERS) {
                if (isClosed) break;
                try {
                    const client = new SimpleMqttClient(broker);
                    await client.connect(
                        () => {
                            if (isClosed) {
                                client.close();
                                return;
                            }
                            activeClient = client;
                            client.subscribe(vaultTopic);
                            console.log(`[CompanionEngine] Web suscrita en topic: ${vaultTopic} vía ${broker}`);
                        },
                        () => {}
                    );

                    client.onMessage(async (topic, payloadStr) => {
                        if (isClosed) return;
                        if (topic === vaultTopic) {
                            try {
                                const msg = JSON.parse(payloadStr);
                                if (msg.senderPubKey && msg.iv && msg.ciphertext) {
                                    // 1. Derivar clave simétrica con la clave pública del móvil
                                    const mobilePubKey = await importPublicKeyHex(msg.senderPubKey);
                                    const aesKey = await deriveAesKey(keyPair.privateKey, mobilePubKey);

                                    // 2. Descifrar bóveda
                                    const decrypted: CompanionSyncPayload = await decryptData(aesKey, msg.iv, msg.ciphertext);

                                    // 3. Confirmar recepción al móvil vía ACK topic
                                    client.publish(ackTopic, JSON.stringify({ type: "red_companion_ack", status: "success" }));

                                    cleanup();
                                    onSuccess(decrypted);
                                }
                            } catch (e: any) {
                                console.error("[CompanionEngine] Error procesando cápsula:", e);
                                onError(e?.message || "Error al descifrar bóveda recibida");
                            }
                        }
                    });

                    if (client.isConnected) {
                        break; // Conectado exitosamente al primer broker funcional
                    }
                } catch {
                    // Probar siguiente broker
                }
            }
        })();

        return {
            sessionId,
            qrPayload,
            expiresAt,
            cleanup
        };
    }

    /**
     * Ejecutado desde la App Móvil: Escanea el QR, cifra la bóveda y la envía a la Web.
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

        const [, , sessionId, webPubKeyHex, expiresAtStr] = parts;
        const expiresAt = parseInt(expiresAtStr, 10);
        if (Date.now() > expiresAt) {
            throw new Error("El código QR ha caducado. Genera uno nuevo en la web.");
        }

        const vaultTopic = `red/pair/${sessionId}/vault`;
        const ackTopic = `red/pair/${sessionId}/ack`;

        onProgress?.("Estableciendo canal criptográfico seguro E2E…");

        // 1. Generar par de claves efímero móvil
        const mobileKeyPair = await generateEcdhKeyPair();
        const mobilePubKeyHex = await exportPublicKeyHex(mobileKeyPair.publicKey);

        // 2. Derivar clave AES con la clave pública de la web
        const webPubKey = await importPublicKeyHex(webPubKeyHex);
        const aesKey = await deriveAesKey(mobileKeyPair.privateKey, webPubKey);

        // 3. Cifrar la carga útil de la bóveda
        onProgress?.("Cifrando bóveda táctica con AES-256-GCM…");
        const encrypted = await encryptData(aesKey, vaultPayload);

        const vaultMessage = JSON.stringify({
            type: "red_companion_vault",
            senderPubKey: mobilePubKeyHex,
            iv: encrypted.iv,
            ciphertext: encrypted.ciphertext
        });

        // 4. Conectar al broker y transmitir con confirmación
        return new Promise<boolean>(async (resolve, reject) => {
            let activeClient: SimpleMqttClient | null = null;
            let isResolved = false;

            const timeout = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    if (activeClient) activeClient.close();
                    reject(new Error("Tiempo de espera agotado al sincronizar con la Web"));
                }
            }, 25000);

            for (const broker of MQTT_BROKERS) {
                if (isResolved) break;
                try {
                    onProgress?.("Conectando con relé seguro…");
                    const client = new SimpleMqttClient(broker);
                    await client.connect(
                        () => {
                            if (isResolved) {
                                client.close();
                                return;
                            }
                            activeClient = client;
                            // Suscribirse a la confirmación
                            client.subscribe(ackTopic);

                            // Transmitir bóveda cifrada
                            onProgress?.("Transmitiendo cápsula cifrada al navegador…");
                            client.publish(vaultTopic, vaultMessage);

                            // Enviar un segundo paquete por redundancia tras 500ms
                            setTimeout(() => {
                                if (!isResolved && client.isConnected) {
                                    client.publish(vaultTopic, vaultMessage);
                                }
                            }, 500);
                        },
                        () => {}
                    );

                    client.onMessage((topic, payloadStr) => {
                        if (isResolved) return;
                        if (topic === ackTopic) {
                            try {
                                const msg = JSON.parse(payloadStr);
                                if (msg.type === "red_companion_ack" || msg.status === "success") {
                                    isResolved = true;
                                    clearTimeout(timeout);
                                    client.close();
                                    resolve(true);
                                }
                            } catch {}
                        }
                    });

                    if (client.isConnected) {
                        break; // Conexión y transmisión iniciadas
                    }
                } catch {
                    // Probar siguiente broker
                }
            }

            if (!activeClient && !isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                reject(new Error("No se pudo conectar a los relés de emparejamiento"));
            }
        });
    }
}

export const companionSyncEngine = new CompanionSyncEngineClass();
