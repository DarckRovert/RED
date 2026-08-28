/**
 * RedSDKTypes.ts — RED Sovereign Mesh Mini-App Runtime & SDK Specification
 * 
 * Defines the cryptographic types, IPC postMessage protocol, permission scopes,
 * manifest schema, and multi-rail payment request structures for embedded Mini-Apps.
 */

export type RedPermissionScope = 
    | 'identity'        // Read public DID, nickname, verify & sign data
    | 'mesh_pubsub'     // Broadcast and subscribe to real-time mesh topics
    | 'mesh_direct'     // Send targeted P2P messages to a specific peer DID
    | 'payments'        // Initiate multi-rail checkout requests (PayPal, Web3 USDT, Lightning, Vouchers)
    | 'storage'         // Access isolated, encrypted persistent storage (Key-Value)
    | 'ai'              // Query local quantized offline neural AI models
    | 'sensors'         // Read GPS coordinates, barometer, and device orientation
    | 'clipboard';      // Read/write text to system clipboard

export interface RedAppManifest {
    id: string;                         // Unique App ID (e.g., 'org.redmesh.bazaar')
    name: string;                       // Display name
    version: string;                    // Semantic version (e.g., '1.0.0')
    description: string;                // Short description
    author: {
        name: string;
        did: string;                    // Author's sovereign DID
        website?: string;
    };
    icon: string;                       // Emoji or Base64 data URL
    category: 'market' | 'utility' | 'emergency' | 'games' | 'media' | 'social';
    permissions: RedPermissionScope[];  // Required permissions
    entryPoint: string;                 // Relative path (usually 'index.html')
    bundleHash?: string;                // BLAKE3 / SHA-256 integrity hash
    signature?: string;                 // Ed25519 author signature
    createdAt: number;                  // Timestamp
    updatedAt: number;                  // Timestamp
}

export interface RedAppBundle {
    manifest: RedAppManifest;
    files: Record<string, string>;      // path -> content (text or Base64 data URL)
}

export type PaymentRail = 'paypal' | 'stripe' | 'web3_usdt' | 'lightning' | 'offgrid_voucher';

export interface PaymentIntentRequest {
    title: string;
    description: string;
    amount: number;
    currency: 'USD' | 'EUR' | 'BRL' | 'MXN' | 'SAT' | 'CREDITS';
    merchant: {
        name: string;
        did: string;
        paypalUsername?: string;        // e.g. 'juanperez' -> paypal.me/juanperez/10USD
        stripeAccountId?: string;       // Stripe Connect / Payment Link
        evmAddress?: string;            // 0x... EVM address for USDT/USDC (Polygon/Base)
        lightningAddress?: string;      // e.g. user@getalby.com or LNURL
        pixKey?: string;                // Pix Key for Brazil
    };
    supportedRails?: PaymentRail[];
}

export interface PaymentReceipt {
    success: boolean;
    rail: PaymentRail;
    transactionId: string;
    amount: number;
    currency: string;
    timestamp: number;
    merchantDid: string;
    buyerDid: string;
    signature?: string;
    details?: Record<string, any>;
}

/**
 * IPC Wire Protocol over window.postMessage
 */
export type RedIPCMessageType = 
    | 'RED_SDK_INIT'
    | 'RED_SDK_INIT_ACK'
    | 'RED_SDK_REQUEST'
    | 'RED_SDK_RESPONSE'
    | 'RED_SDK_EVENT';

export interface RedIPCRequest<T = any> {
    channel: 'RED_SDK';
    type: 'RED_SDK_REQUEST';
    requestId: string;
    appId: string;
    method: string;                     // e.g., 'identity.getProfile', 'payments.requestPayment'
    params?: T;
}

export interface RedIPCResponse<T = any> {
    channel: 'RED_SDK';
    type: 'RED_SDK_RESPONSE';
    requestId: string;
    appId: string;
    success: boolean;
    data?: T;
    error?: string;
}

export interface RedIPCEvent<T = any> {
    channel: 'RED_SDK';
    type: 'RED_SDK_EVENT';
    appId: string;
    eventName: string;                  // e.g., 'mesh.message', 'theme.change'
    payload: T;
}
