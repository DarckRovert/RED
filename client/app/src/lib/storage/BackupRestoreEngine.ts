/**
 * RED 2.0 — Sovereign Cryptographic Backup & Vault Recovery Engine
 * Encrypts and decrypts local database, identity keys, messages, and contacts
 * using Web Crypto API (AES-256-GCM + PBKDF2-SHA256 with 100,000 iterations).
 */

export interface ContactBackup {
    id?: string;
    identityHash?: string;
    alias?: string;
    nickname?: string;
    avatar?: string;
    bio?: string;
    publicKey?: string;
    lastSeen?: number;
    [key: string]: unknown;
}

export interface ConversationBackup {
    id: string;
    recipientId?: string;
    title?: string;
    lastMessage?: unknown;
    unreadCount?: number;
    pinned?: boolean;
    [key: string]: unknown;
}

export interface IdentityBackup {
    identityHash: string;
    publicKey?: string;
    nickname?: string;
    mnemonic?: string;
    [key: string]: unknown;
}

export interface BackupData {
    version: string;
    timestamp: number;
    identity: IdentityBackup | null;
    contacts: ContactBackup[];
    conversations: ConversationBackup[];
    messages: Record<string, unknown[]>;
    preferences: Record<string, unknown>;
    pinnedChatIds: string[];
    archivedChatIds: string[];
}

export class BackupRestoreEngine {
    private static MAGIC_HEADER = "REDBACKUP_V1";

    /**
     * Exporta toda la bóveda local cifrada con la contraseña del usuario.
     */
    public static async exportEncryptedBackup(passphrase: string): Promise<Blob> {
        if (typeof window === "undefined") throw new Error("Window not available");
        if (!passphrase || typeof passphrase !== "string" || passphrase.trim().length === 0) {
            throw new Error("La contraseña para exportar la copia de seguridad es obligatoria.");
        }

        // 1. Recolectar datos de la bóveda local
        const backupData: BackupData = {
            version: "36.0.0",
            timestamp: Date.now(),
            identity: this.getJSON("red_identity"),
            contacts: this.getJSON("red_web_contacts") || this.getJSON("red_contacts") || [],
            conversations: this.getJSON("red_web_conversations") || this.getJSON("red_conversations") || [],
            messages: {},
            preferences: this.getJSON("red_user_preferences_v1") || {},
            pinnedChatIds: this.getJSON("red_pinned_chats") || [],
            archivedChatIds: this.getJSON("red_archived_chats") || [],
        };

        // Recolectar mensajes por conversación
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith("red_web_messages_") || key === "red_messages")) {
                backupData.messages[key] = this.getJSON(key) || [];
            }
        }

        const rawJson = JSON.stringify(backupData);
        const encoder = new TextEncoder();
        const rawBytes = encoder.encode(rawJson);

        // 2. Derivar clave AES-256-GCM mediante PBKDF2
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            encoder.encode(passphrase),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        const aesKey = await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations: 100000,
                hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt"]
        );

        // 3. Cifrar los datos con AES-256-GCM
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            aesKey,
            rawBytes
        );

        // 4. Empaquetar: [MAGIC (12B)] + [SALT (16B)] + [IV (12B)] + [CIPHERTEXT]
        const magicBytes = encoder.encode(this.MAGIC_HEADER);
        const totalLength = magicBytes.length + salt.length + iv.length + encrypted.byteLength;
        const resultBuffer = new Uint8Array(totalLength);

        let offset = 0;
        resultBuffer.set(magicBytes, offset);
        offset += magicBytes.length;
        resultBuffer.set(salt, offset);
        offset += salt.length;
        resultBuffer.set(iv, offset);
        offset += iv.length;
        resultBuffer.set(new Uint8Array(encrypted), offset);

        return new Blob([resultBuffer], { type: "application/octet-stream" });
    }

    /**
     * Descifra e importa la copia de seguridad a la base de datos local.
     */
    public static async importEncryptedBackup(fileData: ArrayBuffer, passphrase: string): Promise<BackupData> {
        if (typeof window === "undefined") throw new Error("Window not available");
        if (!passphrase || typeof passphrase !== "string" || passphrase.trim().length === 0) {
            throw new Error("La contraseña para descifrar la copia de seguridad es obligatoria.");
        }
        if (!fileData || !(fileData instanceof ArrayBuffer || ArrayBuffer.isView(fileData))) {
            throw new Error("Buffer de datos de respaldo inválido o nulo.");
        }

        const bytes = new Uint8Array(fileData as any);
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const magicBytes = encoder.encode(this.MAGIC_HEADER);

        // Validar cabecera
        if (bytes.length < magicBytes.length + 16 + 12) {
            throw new Error("Archivo de respaldo inválido o corrupto");
        }

        const headerStr = decoder.decode(bytes.slice(0, magicBytes.length));
        if (headerStr !== this.MAGIC_HEADER) {
            throw new Error("Formato de archivo no reconocido como copia de seguridad RED");
        }

        let offset = magicBytes.length;
        const salt = bytes.slice(offset, offset + 16);
        offset += 16;
        const iv = bytes.slice(offset, offset + 12);
        offset += 12;
        const ciphertext = bytes.slice(offset);

        // Derivar clave
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            encoder.encode(passphrase),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        const aesKey = await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations: 100000,
                hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
        );

        // Descifrar
        try {
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                aesKey,
                ciphertext
            );
            const decryptedJson = decoder.decode(decrypted);
            const parsed: BackupData = JSON.parse(decryptedJson);

            // Restaurar en almacenamiento local
            if (parsed.contacts) localStorage.setItem("red_web_contacts", JSON.stringify(parsed.contacts));
            if (parsed.conversations) localStorage.setItem("red_web_conversations", JSON.stringify(parsed.conversations));
            if (parsed.preferences) localStorage.setItem("red_user_preferences_v1", JSON.stringify(parsed.preferences));
            if (parsed.pinnedChatIds) localStorage.setItem("red_pinned_chats", JSON.stringify(parsed.pinnedChatIds));
            if (parsed.archivedChatIds) localStorage.setItem("red_archived_chats", JSON.stringify(parsed.archivedChatIds));

            if (parsed.messages) {
                for (const key of Object.keys(parsed.messages)) {
                    localStorage.setItem(key, JSON.stringify(parsed.messages[key]));
                }
            }

            return parsed;
        } catch {
            throw new Error("Contraseña incorrecta o archivo de copia dañado.");
        }
    }

    private static getJSON<T = unknown>(key: string): T | null {
        try {
            const raw = localStorage.getItem(key);
            return raw ? (JSON.parse(raw) as T) : null;
        } catch {
            return null;
        }
    }
}
