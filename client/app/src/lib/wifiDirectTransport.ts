/**
 * RED — WiFi Direct / LAN Transport
 * Uses WebRTC DataChannels for direct P2P communication on local networks.
 * Discovery is handled via a lightweight local signaling broadcast
 * (works on LAN via the RED node backend or a local UDP broadcast fallback).
 *
 * Architecture:
 *  - Signaling: local broadcast or RED node on same LAN
 *  - Transport: RTCPeerConnection DataChannel (no STUN/TURN for LAN)
 *  - Fallback: WebSocket to local RED node if WebRTC ICE fails
 */

export interface WifiPeer {
    id: string;
    name: string;
    address?: string;
    channel?: RTCDataChannel;
    connection?: RTCPeerConnection;
    connected: boolean;
    lastSeen: number;
    transport: 'webrtc' | 'websocket';
}

type MessageCallback = (fromId: string, data: Uint8Array) => void;

/** Signaling message exchanged over LAN to negotiate WebRTC connections */
interface SignalingMessage {
    type: 'announce' | 'offer' | 'answer' | 'ice-candidate' | 'bye';
    from: string;
    to?: string;
    payload?: unknown;
}

// For LAN-only mode we skip external STUN entirely
const WEBRTC_CONFIG: RTCConfiguration = {
    iceServers: [], // no external STUN — LAN only
    iceTransportPolicy: 'all',
};

const DATA_CHANNEL_OPTIONS: RTCDataChannelInit = {
    ordered: true,
    maxRetransmits: 3,
};

export class WifiDirectTransport {
    private localId: string;
    private peers = new Map<string, WifiPeer>();
    private listeners: MessageCallback[] = [];
    private signalingSocket: WebSocket | null = null;
    private _running = false;

    /** URL of the local RED node signaling WS (same LAN) */
    private signalingUrl: string;

    constructor(localId: string, signalingUrl = 'ws://localhost:9001/local-signal') {
        this.localId = localId;
        this.signalingUrl = signalingUrl;
    }

    get running(): boolean { return this._running; }
    get connectedPeers(): WifiPeer[] {
        return Array.from(this.peers.values()).filter(p => p.connected);
    }

    /**
     * Start discovering peers on the LAN.
     * Opens a WebSocket to the local RED node for LAN signaling.
     */
    async start(): Promise<void> {
        if (this._running) return;
        this._running = true;

        await this._connectSignaling();
        this._announce();
        console.log('[WiFi] LAN transport started. Local ID:', this.localId);
    }

    stop(): void {
        this._running = false;
        if (this.signalingSocket) {
            this.signalingSocket.close();
            this.signalingSocket = null;
        }
        this.peers.forEach((_, id) => this.disconnect(id));
        this.peers.clear();
        console.log('[WiFi] LAN transport stopped.');
    }

    /**
     * Initiate a WebRTC connection to a discovered peer.
     */
    async connect(peerId: string): Promise<WifiPeer | null> {
        if (this.peers.get(peerId)?.connected) return this.peers.get(peerId)!;

        const pc = new RTCPeerConnection(WEBRTC_CONFIG);
        const channel = pc.createDataChannel('red', DATA_CHANNEL_OPTIONS);

        const peer: WifiPeer = {
            id: peerId,
            name: `peer:${peerId.slice(0, 8)}`,
            connection: pc,
            channel,
            connected: false,
            lastSeen: Date.now(),
            transport: 'webrtc',
        };
        this.peers.set(peerId, peer);

        this._setupDataChannel(channel, peerId);
        this._setupICE(pc, peerId);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this._signal({ type: 'offer', from: this.localId, to: peerId, payload: offer });

        // Wait for connection with timeout
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 10_000);
            const checkOpen = () => {
                if (channel.readyState === 'open') {
                    clearTimeout(timeout);
                    resolve(peer);
                }
            };
            channel.addEventListener('open', checkOpen);
        });
    }

    /**
     * Send an encrypted payload to a connected WiFi peer.
     */
    async send(peerId: string, payload: Uint8Array): Promise<boolean> {
        const peer = this.peers.get(peerId);
        if (!peer?.connected) return false;

        try {
            if (peer.channel?.readyState === 'open') {
                // Cast to ArrayBuffer to satisfy RTCDataChannel.send() overload
                peer.channel.send(payload.buffer as ArrayBuffer);
                peer.lastSeen = Date.now();
                return true;
            }
            // Fallback: try WebSocket relay via local node
            if (peer.transport === 'websocket' && this.signalingSocket?.readyState === WebSocket.OPEN) {
                const msg = JSON.stringify({ type: 'relay', to: peerId, data: Array.from(payload) });
                this.signalingSocket.send(msg);
                return true;
            }
            return false;
        } catch (err) {
            console.error('[WiFi] Send error:', err);
            peer.connected = false;
            return false;
        }
    }

    disconnect(peerId: string): void {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.channel?.close();
            peer.connection?.close();
            peer.connected = false;
        }
        this.peers.delete(peerId);
        this._signal({ type: 'bye', from: this.localId, to: peerId });
    }

    onMessage(cb: MessageCallback): () => void {
        this.listeners.push(cb);
        return () => { this.listeners = this.listeners.filter(l => l !== cb); };
    }

    // ── Private ──────────────────────────────────────────────

    private async _connectSignaling(): Promise<void> {
        return new Promise((resolve) => {
            try {
                const ws = new WebSocket(this.signalingUrl);
                ws.binaryType = 'arraybuffer';

                ws.addEventListener('open', () => {
                    console.log('[WiFi] Signaling connected');
                    this.signalingSocket = ws;
                    resolve();
                });

                ws.addEventListener('message', (evt) => {
                    try {
                        const msg: SignalingMessage = JSON.parse(
                            typeof evt.data === 'string' ? evt.data : new TextDecoder().decode(evt.data)
                        );
                        this._handleSignaling(msg);
                    } catch { /* ignore bad frames */ }
                });

                ws.addEventListener('close', () => {
                    console.log('[WiFi] Signaling disconnected');
                    this.signalingSocket = null;
                    // Auto-reconnect after 5s
                    if (this._running) setTimeout(() => this._connectSignaling(), 5000);
                });

                ws.addEventListener('error', () => {
                    console.warn('[WiFi] Signaling unavailable — LAN mode limited');
                    resolve(); // continue without signaling
                });
            } catch {
                resolve();
            }
        });
    }

    private _announce(): void {
        this._signal({ type: 'announce', from: this.localId });
    }

    private _signal(msg: SignalingMessage): void {
        if (this.signalingSocket?.readyState === WebSocket.OPEN) {
            this.signalingSocket.send(JSON.stringify(msg));
        }
    }

    private async _handleSignaling(msg: SignalingMessage): Promise<void> {
        if (msg.from === this.localId) return;

        switch (msg.type) {
            case 'announce': {
                // A new peer appeared on LAN
                if (!this.peers.has(msg.from)) {
                    this.peers.set(msg.from, {
                        id: msg.from,
                        name: `RED-${msg.from.slice(0, 8)}`,
                        connected: false,
                        lastSeen: Date.now(),
                        transport: 'webrtc',
                    });
                    console.log(`[WiFi] Discovered peer: ${msg.from}`);
                }
                break;
            }

            case 'offer': {
                if (msg.to !== this.localId) break;
                const pc = new RTCPeerConnection(WEBRTC_CONFIG);
                const peer: WifiPeer = {
                    id: msg.from,
                    name: `RED-${msg.from.slice(0, 8)}`,
                    connection: pc,
                    connected: false,
                    lastSeen: Date.now(),
                    transport: 'webrtc',
                };
                this.peers.set(msg.from, peer);

                pc.addEventListener('datachannel', (evt) => {
                    peer.channel = evt.channel;
                    this._setupDataChannel(evt.channel, msg.from);
                });
                this._setupICE(pc, msg.from);

                await pc.setRemoteDescription(msg.payload as RTCSessionDescriptionInit);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                this._signal({ type: 'answer', from: this.localId, to: msg.from, payload: answer });
                break;
            }

            case 'answer': {
                if (msg.to !== this.localId) break;
                const peer = this.peers.get(msg.from);
                if (peer?.connection) {
                    await peer.connection.setRemoteDescription(msg.payload as RTCSessionDescriptionInit);
                }
                break;
            }

            case 'ice-candidate': {
                if (msg.to !== this.localId) break;
                const peer = this.peers.get(msg.from);
                if (peer?.connection && msg.payload) {
                    await peer.connection.addIceCandidate(new RTCIceCandidate(msg.payload as RTCIceCandidateInit));
                }
                break;
            }

            case 'bye': {
                const peer = this.peers.get(msg.from);
                if (peer) { peer.connected = false; }
                break;
            }
        }
    }

    private _setupDataChannel(channel: RTCDataChannel, peerId: string): void {
        channel.binaryType = 'arraybuffer';

        channel.addEventListener('open', () => {
            const peer = this.peers.get(peerId);
            if (peer) { peer.connected = true; peer.lastSeen = Date.now(); }
            console.log(`[WiFi] DataChannel open with ${peerId}`);
        });

        channel.addEventListener('message', (evt) => {
            const data = evt.data instanceof ArrayBuffer
                ? new Uint8Array(evt.data)
                : new TextEncoder().encode(evt.data);
            const peer = this.peers.get(peerId);
            if (peer) peer.lastSeen = Date.now();
            this.listeners.forEach(cb => cb(peerId, data));
        });

        channel.addEventListener('close', () => {
            const peer = this.peers.get(peerId);
            if (peer) peer.connected = false;
            console.log(`[WiFi] DataChannel closed with ${peerId}`);
        });

        channel.addEventListener('error', (err) => {
            console.error(`[WiFi] DataChannel error with ${peerId}:`, err);
        });
    }

    private _setupICE(pc: RTCPeerConnection, peerId: string): void {
        pc.addEventListener('icecandidate', (evt) => {
            if (evt.candidate) {
                this._signal({ type: 'ice-candidate', from: this.localId, to: peerId, payload: evt.candidate });
            }
        });
    }
}
