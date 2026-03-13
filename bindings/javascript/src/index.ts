/**
 * RED Messaging - JavaScript/TypeScript Bindings
 * 
 * This module provides TypeScript interfaces for the RED secure messaging system.
 * The actual cryptographic operations are performed by the Rust core via WASM.
 */

// Note: These are placeholder bindings.
// The actual implementation requires compiling Rust to WASM with wasm-bindgen.

/**
 * Represents a 32-byte key or hash
 */
export type Bytes32 = Uint8Array;

/**
 * User identity in the RED network
 */
export interface Identity {
    /** Secret key (32 bytes) - never share! */
    secretKey: Bytes32;
    /** Public key (32 bytes) */
    publicKey: Bytes32;
    /** Identity hash (32 bytes) - shareable identifier */
    identityHash: Bytes32;
}

/**
 * Encrypted message structure
 */
export interface EncryptedMessage {
    /** Ciphertext */
    ciphertext: Uint8Array;
    /** Nonce used for encryption */
    nonce: Uint8Array;
    /** Ephemeral public key */
    ephemeralPk: Bytes32;
}

/**
 * Double Ratchet session state
 */
export interface SessionState {
    /** Root key */
    rootKey: Bytes32;
    /** Sending chain key */
    sendingChainKey: Bytes32;
    /** Receiving chain key */
    receivingChainKey: Bytes32;
    /** Message number */
    messageNumber: number;
}

/**
 * Network peer information
 */
export interface Peer {
    /** Peer's identity hash */
    identityHash: Bytes32;
    /** Peer's public key */
    publicKey: Bytes32;
    /** Last seen timestamp */
    lastSeen: number;
}

/**
 * Generate a new random identity
 */
export async function generateIdentity(): Promise<Identity> {
    // In real implementation, this calls WASM:
    // return await red_wasm.generate_identity();
    
    // Placeholder:
    const secretKey = new Uint8Array(32);
    const publicKey = new Uint8Array(32);
    const identityHash = new Uint8Array(32);
    
    if (typeof crypto !== 'undefined') {
        crypto.getRandomValues(secretKey);
    }
    
    return { secretKey, publicKey, identityHash };
}

/**
 * Rotate identity (create new unlinkable identity)
 */
export async function rotateIdentity(current: Identity): Promise<Identity> {
    // In real implementation:
    // return await red_wasm.rotate_identity(current);
    return generateIdentity();
}

/**
 * Encrypt a message for a recipient
 */
export async function encryptMessage(
    plaintext: Uint8Array,
    senderSecretKey: Bytes32,
    recipientPublicKey: Bytes32
): Promise<EncryptedMessage> {
    // In real implementation:
    // return await red_wasm.encrypt_message(plaintext, senderSecretKey, recipientPublicKey);
    
    return {
        ciphertext: new Uint8Array(plaintext.length + 16),
        nonce: new Uint8Array(12),
        ephemeralPk: new Uint8Array(32)
    };
}

/**
 * Decrypt a received message
 */
export async function decryptMessage(
    encrypted: EncryptedMessage,
    recipientSecretKey: Bytes32
): Promise<Uint8Array> {
    // In real implementation:
    // return await red_wasm.decrypt_message(encrypted, recipientSecretKey);
    
    return new Uint8Array(0);
}

/**
 * Create a new Double Ratchet session
 */
export async function createSession(
    localIdentity: Identity,
    remotePublicKey: Bytes32
): Promise<SessionState> {
    // In real implementation:
    // return await red_wasm.create_session(localIdentity, remotePublicKey);
    
    return {
        rootKey: new Uint8Array(32),
        sendingChainKey: new Uint8Array(32),
        receivingChainKey: new Uint8Array(32),
        messageNumber: 0
    };
}

/**
 * Send a message using Double Ratchet
 */
export async function ratchetSend(
    session: SessionState,
    plaintext: Uint8Array
): Promise<{ ciphertext: Uint8Array; newState: SessionState }> {
    // In real implementation:
    // return await red_wasm.ratchet_send(session, plaintext);
    
    return {
        ciphertext: new Uint8Array(plaintext.length + 16),
        newState: { ...session, messageNumber: session.messageNumber + 1 }
    };
}

/**
 * Receive a message using Double Ratchet
 */
export async function ratchetReceive(
    session: SessionState,
    ciphertext: Uint8Array
): Promise<{ plaintext: Uint8Array; newState: SessionState }> {
    // In real implementation:
    // return await red_wasm.ratchet_receive(session, ciphertext);
    
    return {
        plaintext: new Uint8Array(0),
        newState: session
    };
}

/**
 * Hash data using BLAKE3
 */
export async function hash(data: Uint8Array): Promise<Bytes32> {
    // In real implementation:
    // return await red_wasm.blake3_hash(data);
    
    // Fallback to Web Crypto API (SHA-256, not BLAKE3)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(hashBuffer);
    }
    
    return new Uint8Array(32);
}

/**
 * Network client for connecting to RED P2P network
 */
export class NetworkClient {
    private identity: Identity;
    private connected: boolean = false;
    private peers: Map<string, Peer> = new Map();
    
    constructor(identity: Identity) {
        this.identity = identity;
    }
    
    /**
     * Connect to the RED network
     */
    async connect(bootstrapNodes?: string[]): Promise<boolean> {
        // In real implementation:
        // return await red_wasm.network_connect(this.identity, bootstrapNodes);
        this.connected = true;
        return true;
    }
    
    /**
     * Disconnect from the network
     */
    async disconnect(): Promise<void> {
        this.connected = false;
    }
    
    /**
     * Send a message to a recipient
     */
    async sendMessage(recipientHash: Bytes32, message: Uint8Array): Promise<boolean> {
        if (!this.connected) {
            throw new Error('Not connected to network');
        }
        // In real implementation:
        // return await red_wasm.network_send(recipientHash, message);
        return true;
    }
    
    /**
     * Receive pending messages
     */
    async receiveMessages(): Promise<EncryptedMessage[]> {
        if (!this.connected) {
            throw new Error('Not connected to network');
        }
        // In real implementation:
        // return await red_wasm.network_receive();
        return [];
    }
    
    /**
     * Get connected peers
     */
    getPeers(): Peer[] {
        return Array.from(this.peers.values());
    }
    
    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.connected;
    }
}

// Export version
export const VERSION = '0.1.0';
