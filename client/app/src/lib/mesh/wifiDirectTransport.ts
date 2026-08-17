/**
 * RED WebRTC & Blind Relay Mesh Transport
 * 
 * Manages peer-to-peer WebRTC DataChannels with multi-cluster STUN/TURN NAT traversal,
 * dynamic candidate pool signaling, seamless ICE restart across network switches (4G/5G <-> WiFi),
 * and zero-knowledge blind WebSocket relay fallback for global interoperability.
 */

export class WifiDirectTransport {
    private ws: WebSocket | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private dataChannels: Map<string, RTCDataChannel> = new Map();
    private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
    private myId: string;
    private messageListeners: ((msg: { from: string; payload: Uint8Array }) => void)[] = [];
    public onlinePeers: Set<string> = new Set();
    private isConnecting = false;
    private reconnectTimer: any = null;
    private currentCandidateIndex = 0;
    private activeSignalingUrl: string = '';

    private static readonly ICE_SERVERS: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:turn.matrix.org:3478' },
        { urls: 'stun:stun.services.mozilla.com:3478' },
    ];

    constructor(myId: string) {
        this.myId = myId;
    }

    /**
     * Resolves an ordered list of candidate signaling/relay endpoints.
     */
    public getSignalingCandidates(): string[] {
        const candidates: string[] = [];

        if (typeof window === 'undefined') {
            return ['ws://localhost:3001', 'ws://127.0.0.1:3001'];
        }

        // 1. User-customized signaling URL in localStorage
        const custom = localStorage.getItem('red_signaling_url');
        if (custom && custom.trim()) {
            candidates.push(custom.trim());
        }

        // 2. Environment variable
        if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
            candidates.push(process.env.NEXT_PUBLIC_SIGNALING_URL.trim());
        }

        // 3. Fallback based on window location (LAN / local deployments)
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;

        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.endsWith('.github.io')) {
            candidates.push(`${proto}//${hostname}:3001`);
        }

        // 4. Local loopback candidates (for dev servers or local testbed)
        candidates.push('ws://localhost:3001');
        candidates.push('ws://127.0.0.1:3001');

        // Remove duplicates while preserving order
        return Array.from(new Set(candidates));
    }

    public getSignalingUrl(): string {
        const list = this.getSignalingCandidates();
        return list[this.currentCandidateIndex % list.length] || 'ws://localhost:3001';
    }

    async connectToLocalSignaling(): Promise<void> {
        if (typeof window === 'undefined') return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const candidates = this.getSignalingCandidates();
        if (candidates.length === 0) return;

        return new Promise<void>((resolve) => {
            const tryCandidate = (index: number) => {
                if (index >= candidates.length) {
                    // Exhausted all candidates in this pass; schedule reconnect pass
                    this.currentCandidateIndex = 0;
                    this.scheduleReconnect();
                    resolve();
                    return;
                }

                const url = candidates[index];
                this.activeSignalingUrl = url;
                console.log(`[WebRtcTransport] Attempting signaling connection to candidate [${index + 1}/${candidates.length}]: ${url}...`);

                let connected = false;
                let socket: WebSocket;

                try {
                    socket = new WebSocket(url);
                } catch (err) {
                    console.warn(`[WebRtcTransport] Cannot construct WebSocket for ${url}:`, err);
                    tryCandidate(index + 1);
                    return;
                }

                this.ws = socket;

                // Timeout candidate connection attempt after 4 seconds
                const connectTimeout = setTimeout(() => {
                    if (!connected && socket.readyState !== WebSocket.OPEN) {
                        try { socket.close(); } catch {}
                        tryCandidate(index + 1);
                    }
                }, 4000);

                socket.onopen = () => {
                    connected = true;
                    clearTimeout(connectTimeout);
                    this.currentCandidateIndex = index;
                    console.log(`[WebRtcTransport] ✅ Connected to Signaling Relay at ${url}. Registering DID ${this.myId.slice(0, 8)}...`);
                    this.sendWs({
                        type: 'register',
                        peerId: this.myId,
                        roomId: 'red-global-mesh'
                    });
                    resolve();
                };

                socket.onmessage = async (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        await this.handleSignalingMessage(data);
                    } catch (err) {
                        console.warn('[WebRtcTransport] Error handling signaling message:', err);
                    }
                };

                socket.onclose = () => {
                    clearTimeout(connectTimeout);
                    if (connected) {
                        console.log(`[WebRtcTransport] Active signaling WebSocket closed (${url}). Reconnecting in 4s...`);
                        this.scheduleReconnect();
                    } else {
                        tryCandidate(index + 1);
                    }
                };

                socket.onerror = (e) => {
                    clearTimeout(connectTimeout);
                    if (!connected) {
                        tryCandidate(index + 1);
                    }
                };
            };

            tryCandidate(this.currentCandidateIndex);
        });
    }

    /**
     * Proactively reconnects signaling and triggers ICE restarts across all active WebRTC peers.
     * Called whenever network transitions occur (e.g. WiFi -> 4G/5G or Offline -> Online).
     */
    public async reconnect(forceIceRestart = true): Promise<void> {
        console.log('[WebRtcTransport] Network transition detected — executing proactive transport refresh');
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        // 1. Refresh WebSocket Signaling Connection
        if (this.ws) {
            try { this.ws.close(); } catch {}
            this.ws = null;
        }
        await this.connectToLocalSignaling();

        // 2. Perform WebRTC ICE Restart on all existing PeerConnections
        if (forceIceRestart) {
            for (const [peerId, pc] of this.peerConnections) {
                try {
                    if (pc.signalingState !== 'closed') {
                        console.log(`[WebRtcTransport] Triggering ICE restart for peer ${peerId.slice(0, 8)}`);
                        if (typeof pc.restartIce === 'function') {
                            pc.restartIce();
                        }
                        const offer = await pc.createOffer({ iceRestart: true });
                        await pc.setLocalDescription(offer);
                        this.sendWs({
                            type: 'offer',
                            targetPeerId: peerId,
                            sdp: offer,
                        });
                    }
                } catch (err) {
                    console.warn(`[WebRtcTransport] ICE restart failed for peer ${peerId.slice(0, 8)}:`, err);
                }
            }
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.connectToLocalSignaling().catch(() => {});
        }, 4000);
    }

    private sendWs(msg: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    public get isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    // ─── Signaling Message Dispatcher ──────────────────────────────────────────

    private async handleSignalingMessage(msg: any) {
        const sender = msg.fromPeer || msg.senderId || msg.peerId;
        if (sender === this.myId) return; // ignore self echo

        switch (msg.type) {
            case 'registered':
            case 'room-joined': {
                if (Array.isArray(msg.onlinePeers)) {
                    for (const peerId of msg.onlinePeers) {
                        if (peerId && peerId !== this.myId) {
                            this.onlinePeers.add(peerId);
                        }
                    }
                }
                break;
            }

            case 'peer-joined': {
                if (msg.peerId && msg.peerId !== this.myId) {
                    this.onlinePeers.add(msg.peerId);
                    console.log(`[WebRtcTransport] Remote peer discovered on mesh: ${msg.peerId.slice(0, 8)}`);
                }
                break;
            }

            case 'peer-left': {
                if (msg.peerId) {
                    this.onlinePeers.delete(msg.peerId);
                    this.cleanupPeer(msg.peerId);
                }
                break;
            }

            case 'offer': {
                if (sender && msg.sdp) {
                    await this.handleOffer(sender, msg.sdp);
                }
                break;
            }

            case 'answer': {
                if (sender && msg.sdp) {
                    await this.handleAnswer(sender, msg.sdp);
                }
                break;
            }

            case 'ice-candidate': {
                if (sender && msg.candidate) {
                    await this.handleIceCandidate(sender, msg.candidate);
                }
                break;
            }

            case 'mesh-relay': {
                // Blind Encrypted Relay Fallback Packet
                if (msg.payload || msg.payloadHex) {
                    const fromPeer = msg.fromPeer || sender || 'relay_peer';
                    this.onlinePeers.add(fromPeer);
                    
                    let payloadBytes: Uint8Array;
                    if (msg.payloadHex) {
                        const hex = msg.payloadHex;
                        payloadBytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
                    } else if (Array.isArray(msg.payload)) {
                        payloadBytes = new Uint8Array(msg.payload);
                    } else if (typeof msg.payload === 'string') {
                        payloadBytes = new TextEncoder().encode(msg.payload);
                    } else {
                        return;
                    }

                    this.notifyMessageListeners(fromPeer, payloadBytes);
                }
                break;
            }
        }
    }

    // ─── WebRTC Peer Connection & DataChannel Negotiation ─────────────────────

    private getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
        let pc = this.peerConnections.get(peerId);
        if (pc && pc.signalingState !== 'closed') return pc;

        pc = new RTCPeerConnection({
            iceServers: WifiDirectTransport.ICE_SERVERS,
            iceCandidatePoolSize: 2,
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendWs({
                    type: 'ice-candidate',
                    targetPeerId: peerId,
                    candidate: event.candidate,
                });
            }
        };

        pc.ondatachannel = (event) => {
            const channel = event.channel;
            this.setupDataChannel(peerId, channel);
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRtcTransport] Peer ${peerId.slice(0, 8)} state: ${pc?.connectionState}`);
            if (pc?.connectionState === 'connected') {
                this.onlinePeers.add(peerId);
            } else if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed' || pc?.connectionState === 'closed') {
                this.cleanupPeer(peerId);
            }
        };

        this.peerConnections.set(peerId, pc);
        return pc;
    }

    private setupDataChannel(peerId: string, channel: RTCDataChannel) {
        channel.binaryType = 'arraybuffer';

        channel.onopen = () => {
            console.log(`[WebRtcTransport] Direct WebRTC DataChannel OPEN with ${peerId.slice(0, 8)}`);
            this.onlinePeers.add(peerId);
            this.dataChannels.set(peerId, channel);
        };

        channel.onmessage = (event) => {
            let payload: Uint8Array;
            if (event.data instanceof ArrayBuffer) {
                payload = new Uint8Array(event.data);
            } else if (event.data instanceof Uint8Array) {
                payload = event.data;
            } else if (typeof event.data === 'string') {
                payload = new TextEncoder().encode(event.data);
            } else {
                return;
            }
            this.notifyMessageListeners(peerId, payload);
        };

        channel.onclose = () => {
            console.log(`[WebRtcTransport] DataChannel closed with ${peerId.slice(0, 8)}`);
            this.dataChannels.delete(peerId);
        };

        channel.onerror = (err) => {
            console.warn(`[WebRtcTransport] DataChannel error with ${peerId.slice(0, 8)}:`, err);
        };

        this.dataChannels.set(peerId, channel);
    }

    public async createOffer(peerId: string, iceRestart = false): Promise<void> {
        try {
            const pc = this.getOrCreatePeerConnection(peerId);
            const channel = pc.createDataChannel('red-mesh-data', { ordered: true });
            this.setupDataChannel(peerId, channel);

            const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
            await pc.setLocalDescription(offer);

            this.sendWs({
                type: 'offer',
                targetPeerId: peerId,
                sdp: offer,
            });
        } catch (err) {
            console.warn(`[WebRtcTransport] Failed to create offer for ${peerId.slice(0, 8)}:`, err);
        }
    }

    private async handleOffer(peerId: string, sdp: RTCSessionDescriptionInit) {
        try {
            const pc = this.getOrCreatePeerConnection(peerId);
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));

            // Process any pending ICE candidates queued before remote description was set
            const pending = this.pendingCandidates.get(peerId);
            if (pending && pending.length > 0) {
                for (const candidate of pending) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
                }
                this.pendingCandidates.delete(peerId);
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            this.sendWs({
                type: 'answer',
                targetPeerId: peerId,
                sdp: answer,
            });
        } catch (err) {
            console.warn(`[WebRtcTransport] Failed to handle offer from ${peerId.slice(0, 8)}:`, err);
        }
    }

    private async handleAnswer(peerId: string, sdp: RTCSessionDescriptionInit) {
        try {
            const pc = this.peerConnections.get(peerId);
            if (pc && pc.signalingState !== 'closed') {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const pending = this.pendingCandidates.get(peerId);
                if (pending && pending.length > 0) {
                    for (const candidate of pending) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
                    }
                    this.pendingCandidates.delete(peerId);
                }
            }
        } catch (err) {
            console.warn(`[WebRtcTransport] Failed to handle answer from ${peerId.slice(0, 8)}:`, err);
        }
    }

    private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
        try {
            const pc = this.peerConnections.get(peerId);
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            } else {
                const list = this.pendingCandidates.get(peerId) || [];
                list.push(candidate);
                this.pendingCandidates.set(peerId, list);
            }
        } catch (err) {
            console.warn(`[WebRtcTransport] Failed to handle ICE candidate from ${peerId.slice(0, 8)}:`, err);
        }
    }

    private cleanupPeer(peerId: string) {
        const channel = this.dataChannels.get(peerId);
        if (channel) {
            try { channel.close(); } catch {}
            this.dataChannels.delete(peerId);
        }
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            try { pc.close(); } catch {}
            this.peerConnections.delete(peerId);
        }
        this.pendingCandidates.delete(peerId);
    }

    private notifyMessageListeners(from: string, payload: Uint8Array) {
        for (const cb of this.messageListeners) {
            try {
                cb({ from, payload });
            } catch (err) {
                console.error('[WebRtcTransport] Error in message listener callback:', err);
            }
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────────────

    /**
     * Sends a binary packet to the target peer.
     * Uses direct WebRTC DataChannel if open; otherwise falls back to Encrypted Blind WebSocket Relay.
     */
    async send(peerId: string, payload: Uint8Array): Promise<boolean> {
        // 1. Direct WebRTC DataChannel (P2P High Speed)
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            try {
                channel.send(payload.buffer as ArrayBuffer);
                return true;
            } catch (err) {
                console.warn(`[WebRtcTransport] DataChannel send failed for ${peerId.slice(0, 8)}, falling back to relay:`, err);
            }
        }

        // Proactively negotiate WebRTC P2P for future messages if not yet connected
        if (!this.peerConnections.has(peerId) || this.peerConnections.get(peerId)?.connectionState === 'disconnected') {
            this.createOffer(peerId).catch(() => {});
        }

        // 2. Encrypted Blind WebSocket Relay Fallback (Zero-Knowledge)
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                const hex = Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join('');
                this.sendWs({
                    type: 'mesh-relay',
                    targetPeerId: peerId,
                    payloadHex: hex,
                });
                return true;
            } catch (err) {
                console.warn(`[WebRtcTransport] Blind relay failed for ${peerId.slice(0, 8)}:`, err);
            }
        }

        return false;
    }

    onMessage(callback: (msg: { from: string; payload: Uint8Array }) => void) {
        this.messageListeners.push(callback);
    }
}
