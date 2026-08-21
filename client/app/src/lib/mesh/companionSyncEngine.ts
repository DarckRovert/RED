/**
 * RED Web Companion Sync Engine
 * 
 * Protocolo de Vinculación Criptográfica Multidispositivo (Estilo WhatsApp Web)
 * Permite a la versión Web (Navegador PC) sincronizar en tiempo real
 * la identidad soberana, contactos y conversaciones desde la app móvil Android.
 * 
 * Flujo:
 * 1. Web genera par de claves efímero ECDH P-256 y Session ID.
 * 2. Web muestra código QR: `RED_PAIR:1:<sessionId>:<pubKeyHex>:<timestamp>`
 * 3. Móvil escanea QR, calcula secreto compartido ECDH, cifra la bóveda con AES-256-GCM.
 * 4. Móvil envía la cápsula cifrada por WebRTC DataChannel / Relay WebSocket.
 * 5. Web descifra, importa identidad, contactos y chats, desbloqueando la interfaz.
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

// ── Signaling Endpoints ───────────────────────────────────────────────────────
const SIGNALING_ENDPOINTS = [
    "wss://red-signaling.onrender.com",
    "wss://signaling.yjs.dev"
];

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
        const randomId = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
        const sessionId = `pair_${randomId}`;
        const expiresAt = Date.now() + 120 * 1000; // 2 minutos de validez

        const qrPayload = `RED_PAIR:1:${sessionId}:${pubKeyHex}:${expiresAt}`;

        let ws: WebSocket | null = null;
        let isClosed = false;

        const cleanup = () => {
            isClosed = true;
            if (ws) {
                try { ws.close(); } catch {}
                ws = null;
            }
        };

        // Conectar a señalizador para recibir la cápsula cifrada del móvil
        for (const ep of SIGNALING_ENDPOINTS) {
            if (isClosed) break;
            try {
                ws = new WebSocket(ep);
                break;
            } catch {}
        }

        if (ws) {
            ws.onopen = () => {
                if (isClosed) return;
                ws?.send(JSON.stringify({
                    type: "subscribe",
                    topics: [sessionId]
                }));
            };

            ws.onmessage = async (event) => {
                if (isClosed) return;
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === "red_companion_vault" && msg.senderPubKey && msg.iv && msg.ciphertext) {
                        // 1. Derivar clave simétrica con la clave pública del móvil
                        const mobilePubKey = await importPublicKeyHex(msg.senderPubKey);
                        const aesKey = await deriveAesKey(keyPair.privateKey, mobilePubKey);

                        // 2. Descifrar bóveda
                        const decrypted: CompanionSyncPayload = await decryptData(aesKey, msg.iv, msg.ciphertext);

                        // 3. Confirmar recepción al móvil
                        ws?.send(JSON.stringify({
                            type: "publish",
                            topic: sessionId,
                            data: { type: "red_companion_ack", status: "success" }
                        }));

                        cleanup();
                        onSuccess(decrypted);
                    }
                } catch (e: any) {
                    console.error("[CompanionEngine] Error procesando cápsula:", e);
                    onError(e?.message || "Error al descifrar bóveda recibida");
                }
            };

            ws.onerror = () => {
                if (!isClosed) console.warn("[CompanionEngine] Error en enlace de señalización");
            };
        }

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

        // 4. Transmitir cápsula vía WebSocket
        return new Promise<boolean>((resolve, reject) => {
            let ws: WebSocket | null = null;
            let timeout: any = null;

            for (const ep of SIGNALING_ENDPOINTS) {
                try {
                    ws = new WebSocket(ep);
                    break;
                } catch {}
            }

            if (!ws) {
                reject(new Error("No se pudo conectar con el relé de emparejamiento"));
                return;
            }

            timeout = setTimeout(() => {
                if (ws) ws.close();
                reject(new Error("Tiempo de espera agotado al sincronizar con la Web"));
            }, 25000);

            ws.onopen = () => {
                onProgress?.("Transmitiendo cápsula cifrada al navegador…");
                ws?.send(JSON.stringify({
                    type: "subscribe",
                    topics: [sessionId]
                }));

                ws?.send(JSON.stringify({
                    type: "publish",
                    topic: sessionId,
                    data: {
                        type: "red_companion_vault",
                        senderPubKey: mobilePubKeyHex,
                        iv: encrypted.iv,
                        ciphertext: encrypted.ciphertext
                    }
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === "red_companion_ack" || msg.data?.type === "red_companion_ack") {
                        clearTimeout(timeout);
                        ws?.close();
                        resolve(true);
                    }
                } catch {}
            };

            ws.onerror = (e) => {
                clearTimeout(timeout);
                reject(new Error("Error de conexión durante el emparejamiento"));
            };
        });
    }
}

export const companionSyncEngine = new CompanionSyncEngineClass();
