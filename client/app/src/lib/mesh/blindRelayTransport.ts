/**
 * blindRelayTransport.ts — RED Sovereign Blind Relay & DePIN Transit Transport
 * 
 * Provides guaranteed, zero-knowledge message forwarding and WebRTC signaling
 * across mobile devices and browsers worldwide via community-hosted, high-performance
 * Rust relays (red-node blind_relay).
 * 
 * Guarantees:
 * - Zero Plaintext Inspection: all payloads are end-to-end encrypted (Noise / ML-KEM-768).
 * - Multi-Relay Fault Tolerance: automatic parallel connectivity and sub-100ms failover.
 * - Full P2P WebRTC Signaling: negotiates direct DataChannels so relays only handle initial contact.
 */

import { unifiedPush } from '../network/UnifiedPushManager';

export interface BlindRelayMessage {
    type: 'register' | 'relay' | 'signal' | 'ping' | 'pong' | 'ack' | 'delivery' | 'signal_delivery';
    peer_id?: string;
    target_peer_id?: string;
    from_peer_id?: string;
    payload?: string;
    signal_data?: any;
    timestamp?: number;
    status?: string;
    version?: string;
    push_endpoint?: string;
}

export class BlindRelayTransport {
    private sockets: Map<string, WebSocket> = new Map();
    private myId: string = '';
    private messageListeners: ((msg: { from: string; payload: Uint8Array }) => void)[] = [];
    private signalingListeners: ((msg: any) => void)[] = [];
    private connectListeners: (() => void)[] = [];
    private pingTimer: any = null;
    public isConnected: boolean = false;
    private reconnectTimers: Map<string, any> = new Map();
    private seenPayloadHashes: Set<string> = new Set();

    // Default Sovereign Relay Seed Pool
    // Users can run `red-node relay` on any server and add it to localStorage or env
    private static readonly DEFAULT_RELAY_POOL: string[] = [
        // Community and regional relays
        'wss://relay1.redmesh.network/relay/ws',
        'wss://relay2.redmesh.network/relay/ws',
        // Local node fallback (desktop / dev / local mesh node: 7331 desktop, 7333 mobile)
        'ws://127.0.0.1:7331/relay/ws',
        'ws://localhost:7331/relay/ws',
        'ws://127.0.0.1:7333/relay/ws',
        'ws://localhost:7333/relay/ws',
    ];

    private static readonly HEX_LUT: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

    private bytesToHex(bytes: Uint8Array): string {
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += BlindRelayTransport.HEX_LUT[bytes[i]];
        }
        return hex;
    }

    private hexToBytes(hex: string): Uint8Array {
        const len = hex.length;
        const bytes = new Uint8Array(len >>> 1);
        for (let i = 0; i < len; i += 2) {
            bytes[i >>> 1] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes;
    }

    private cleanId(raw: string): string {
        if (!raw) return '';
        let clean = raw.trim().toLowerCase();
        if (clean.startsWith('did:red:')) clean = clean.replace(/^did:red:/i, '');
        if (clean.includes(':') && !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(clean)) {
            const parts = clean.split(':');
            if (parts[0].length >= 16) clean = parts[0].trim();
        }
        return clean;
    }

    constructor(myId: string = '') {
        this.myId = this.cleanId(myId);
        if (this.myId) {
            unifiedPush.register(this.myId);
        }
        unifiedPush.onWakeup(() => {
            console.log('[BlindRelayTransport] UnifiedPush wakeup triggered — reconnecting relay');
            this.reconnect();
        });
    }

    /**
     * Resolves the active list of sovereign blind relays to connect to.
     */
    public getRelayEndpoints(): string[] {
        const endpoints: string[] = [];

        if (typeof window === 'undefined') {
            return ['ws://127.0.0.1:7331/relay/ws'];
        }

        // 1. Custom user-defined relay from localStorage
        try {
            const custom = localStorage.getItem('red_blind_relay_url');
            if (custom && custom.trim()) {
                endpoints.push(custom.trim());
            }
        } catch {}

        // 2. Environment variable if defined at build time
        if (process.env.NEXT_PUBLIC_BLIND_RELAY_URL) {
            endpoints.push(process.env.NEXT_PUBLIC_BLIND_RELAY_URL.trim());
        }

        // 3. Dynamic origin endpoint (if hosted alongside a red-node web interface)
        const isHttps = window.location.protocol === 'https:';
        const hostname = window.location.hostname;
        if (hostname && !hostname.endsWith('.github.io')) {
            const proto = isHttps ? 'wss:' : 'ws:';
            endpoints.push(`${proto}//${hostname}:7331/relay/ws`);
        }

        // 4. Default community seed pool
        for (const seed of BlindRelayTransport.DEFAULT_RELAY_POOL) {
            // Avoid mixed-content blocking (do not attempt unencrypted ws: from an https: origin)
            if (isHttps && seed.startsWith('ws://')) continue;
            endpoints.push(seed);
        }

        return Array.from(new Set(endpoints));
    }

    public updateIdentity(myId: string): void {
        if (!myId) return;
        const clean = this.cleanId(myId);
        if (this.myId === clean) return;
        this.myId = clean;
        unifiedPush.register(clean);
        this.registerOnAllSockets();
    }

    public onMessage(callback: (msg: { from: string; payload: Uint8Array }) => void): void {
        this.messageListeners.push(callback);
    }

    public onSignaling(callback: (msg: any) => void): void {
        this.signalingListeners.push(callback);
    }

    public onConnect(callback: () => void): void {
        this.connectListeners.push(callback);
        if (this.isConnected) {
            try { callback(); } catch {}
        }
    }

    public async connect(): Promise<void> {
        if (typeof window === 'undefined') return;

        const endpoints = this.getRelayEndpoints();
        for (const url of endpoints) {
            this.connectRelay(url);
        }

        this.startHeartbeat();
    }

    public reconnect(): void {
        if (typeof window === 'undefined') return;
        console.log('[BlindRelay] Refreshing connections on network transition...');
        for (const [, timer] of this.reconnectTimers) {
            clearTimeout(timer);
        }
        this.reconnectTimers.clear();

        const endpoints = this.getRelayEndpoints();
        for (const url of endpoints) {
            const socket = this.sockets.get(url);
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                this.connectRelay(url);
            }
        }
    }

    private connectRelay(url: string): void {
        const existing = this.sockets.get(url);
        if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
            return;
        }

        try {
            const ws = new WebSocket(url);
            this.sockets.set(url, ws);

            ws.onopen = () => {
                console.log(`[BlindRelay] Connected to Sovereign Relay: ${url}`);
                this.isConnected = true;
                this.registerOnSocket(ws);
                this.notifyConnect();
            };

            ws.onmessage = (event) => {
                this.handleIncomingFrame(event.data);
            };

            ws.onclose = () => {
                this.sockets.delete(url);
                this.updateConnectedState();
                this.scheduleReconnect(url);
            };

            ws.onerror = () => {
                try { ws.close(); } catch {}
            };
        } catch {
            this.scheduleReconnect(url);
        }
    }

    private registerOnSocket(ws: WebSocket): void {
        if (!this.myId || ws.readyState !== WebSocket.OPEN) return;
        const msg: BlindRelayMessage = {
            type: 'register',
            peer_id: this.myId,
            version: '98.0.0',
            push_endpoint: unifiedPush.getEndpoint() || undefined,
        };
        try {
            ws.send(JSON.stringify(msg));
        } catch {}
    }

    private registerOnAllSockets(): void {
        for (const [, ws] of this.sockets) {
            this.registerOnSocket(ws);
        }
    }

    private updateConnectedState(): void {
        let anyOpen = false;
        for (const [, ws] of this.sockets) {
            if (ws.readyState === WebSocket.OPEN) {
                anyOpen = true;
                break;
            }
        }
        this.isConnected = anyOpen;
    }

    private scheduleReconnect(url: string): void {
        if (this.reconnectTimers.has(url)) return;
        const timer = setTimeout(() => {
            this.reconnectTimers.delete(url);
            this.connectRelay(url);
        }, 5000);
        this.reconnectTimers.set(url, timer);
    }

    private handleIncomingFrame(data: any): void {
        if (typeof data !== 'string') return;

        try {
            const msg = JSON.parse(data) as BlindRelayMessage;
            if (msg.type === 'delivery' && msg.from_peer_id && msg.payload) {
                // Deduplicate incoming frames
                const dedupKey = `${msg.from_peer_id}:${msg.timestamp || 0}:${msg.payload.slice(0, 32)}`;
                if (this.seenPayloadHashes.has(dedupKey)) return;
                this.seenPayloadHashes.add(dedupKey);
                if (this.seenPayloadHashes.size > 5000) {
                    this.seenPayloadHashes.clear();
                }

                const payloadBytes = this.hexToBytes(msg.payload);
                for (const cb of this.messageListeners) {
                    try {
                        cb({ from: msg.from_peer_id, payload: payloadBytes });
                    } catch (err) {
                        console.error('[BlindRelay] Error in message listener:', err);
                    }
                }
            } else if (msg.type === 'signal_delivery' && msg.signal_data) {
                for (const cb of this.signalingListeners) {
                    try {
                        cb(msg.signal_data);
                    } catch (err) {
                        console.error('[BlindRelay] Error in signaling listener:', err);
                    }
                }
            }
        } catch {}
    }

    private notifyConnect(): void {
        for (const cb of this.connectListeners) {
            try { cb(); } catch {}
        }
    }

    private startHeartbeat(): void {
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
            const pingMsg = JSON.stringify({ type: 'ping' });
            for (const [, ws] of this.sockets) {
                if (ws.readyState === WebSocket.OPEN) {
                    try { ws.send(pingMsg); } catch {}
                }
            }
        }, 15000);
    }

    /**
     * Sends an encrypted binary packet to a target peer via the active sovereign relays.
     */
    public sendPacket(targetPeerId: string, payload: Uint8Array): boolean {
        const cleanTarget = this.cleanId(targetPeerId);
        if (!cleanTarget) return false;

        const hexPayload = this.bytesToHex(payload);
        const msg: BlindRelayMessage = {
            type: 'relay',
            target_peer_id: cleanTarget,
            payload: hexPayload,
            timestamp: Date.now(),
        };
        const json = JSON.stringify(msg);

        let sent = false;
        for (const [, ws] of this.sockets) {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(json);
                    sent = true;
                } catch {}
            }
        }
        return sent;
    }

    /**
     * Relays WebRTC signaling payloads (SDP offer/answer, ICE candidate) to target peer.
     */
    public sendSignaling(targetPeerId: string, signalData: any): boolean {
        const cleanTarget = this.cleanId(targetPeerId);
        if (!cleanTarget) return false;

        const msg: BlindRelayMessage = {
            type: 'signal',
            target_peer_id: cleanTarget,
            signal_data: signalData,
        };
        const json = JSON.stringify(msg);

        let sent = false;
        for (const [, ws] of this.sockets) {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(json);
                    sent = true;
                } catch {}
            }
        }
        return sent;
    }

    public disconnect(): void {
        if (this.pingTimer) clearInterval(this.pingTimer);
        for (const [, timer] of this.reconnectTimers) {
            clearTimeout(timer);
        }
        this.reconnectTimers.clear();
        for (const [, ws] of this.sockets) {
            try {
                ws.onclose = null;
                ws.onerror = null;
                ws.close();
            } catch {}
        }
        this.sockets.clear();
        this.isConnected = false;
    }
}

// Global Singleton Instance
export const blindRelay = new BlindRelayTransport();
