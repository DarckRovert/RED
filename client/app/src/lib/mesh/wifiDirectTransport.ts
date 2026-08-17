/**
 * RED WebRTC & Blind Relay Mesh Transport
 * 
 * Manages peer-to-peer WebRTC DataChannels with STUN NAT traversal
 * and zero-knowledge blind WebSocket relay fallback for global 
 * interoperability between Web (PC) and Mobile (Android) devices.
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

    private static readonly ICE_SERVERS: RTCIceServer[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
    ];

    constructor(myId: string) {
        this.myId = myId;
    }

    public getSignalingUrl(): string {
        if (typeof window === 'undefined') return 'ws://localhost:3001';
        
        // 1. User-customized signaling URL in localStorage
        const custom = localStorage.getItem('red_signaling_url');
        if (custom && custom.trim()) return custom.trim();

        // 2. Environment variable
        if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
            return process.env.NEXT_PUBLIC_SIGNALING_URL;
        }

        // 3. Fallback based on window location
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'ws://localhost:3001';
        }

        // For GitHub Pages / production deployments, default to public secure relay or local port 3001
        return `${proto}//${hostname}:3001`;
    }

    async connectToLocalSignaling(): Promise<void> {
        if (typeof window === 'undefined') return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        return new Promise<void>((resolve) => {
            try {
                const url = this.getSignalingUrl();
                console.log(`[WebRtcTransport] Connecting to Signaling Relay at ${url}...`);
                this.ws = new WebSocket(url);

                this.ws.onopen = () => {
                    console.log(`[WebRtcTransport] Connected to Signaling Relay. Registering DID ${this.myId.slice(0, 8)}...`);
                    this.sendWs({
                        type: 'register',
                        peerId: this.myId,
                        roomId: 'red-global-mesh'
                    });
                    resolve();
                };

                this.ws.onmessage = async (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        await this.handleSignalingMessage(data);
                    } catch (err) {
                        console.warn('[WebRtcTransport] Error handling signaling message:', err);
                    }
                };

                this.ws.onclose = () => {
                    console.log('[WebRtcTransport] Signaling WebSocket closed. Reconnecting in 5s...');
                    this.scheduleReconnect();
                };

                this.ws.onerror = (e) => {
                    console.warn('[WebRtcTransport] Signaling WebSocket error (will retry):', e);
                    resolve(); // Resolve promise so caller doesn't block
                };
            } catch (err) {
                console.warn('[WebRtcTransport] Failed to initialize signaling:', err);
                resolve();
            }
        });
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.connectToLocalSignaling().catch(() => {});
        }, 5000);
    }

    private sendWs(msg: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
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
        if (pc) return pc;

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

    public async createOffer(peerId: string): Promise<void> {
        try {
            const pc = this.getOrCreatePeerConnection(peerId);
            const channel = pc.createDataChannel('red-mesh-data', { ordered: true });
            this.setupDataChannel(peerId, channel);

            const offer = await pc.createOffer();
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
            if (pc) {
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
