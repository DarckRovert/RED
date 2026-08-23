import { mqttRelay, MqttRelayTransport } from './mqttRelayTransport';

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
    private heartbeatTimer: any = null;
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
        { urls: 'stun:stun.nextcloud.com:443' },
    ];

    constructor(myId: string) {
        this.myId = myId;
        mqttRelay.updateIdentity(myId);

        // Attach MQTT Blind Relay message listeners
        mqttRelay.onMessage(({ from, payload }) => {
            this.notifyMessageListeners(from, payload);
        });

        // Attach MQTT WebRTC signaling listeners
        mqttRelay.onSignaling((sigMsg) => {
            this.handleSignalingMessage(sigMsg);
        });

        this.startHeartbeat();
    }

    private startHeartbeat(): void {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            // 1. Send keepalive ping over all open WebRTC DataChannels
            for (const [peerId, channel] of this.dataChannels) {
                if (channel && channel.readyState === 'open') {
                    try {
                        const pingPayload = new TextEncoder().encode(JSON.stringify({
                            type: 'mesh-ping',
                            from: this.myId,
                            timestamp: Date.now()
                        }));
                        const safeBuf = pingPayload.buffer.slice(pingPayload.byteOffset, pingPayload.byteOffset + pingPayload.byteLength) as ArrayBuffer;
                        channel.send(safeBuf);
                    } catch (err) {
                        console.warn(`[WebRtcTransport] Keepalive ping failed for ${peerId.slice(0, 8)}:`, err);
                    }
                }
            }

            // 2. Send heartbeat to signaling WebSocket server
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.sendWs({
                        type: 'heartbeat',
                        peerId: this.myId,
                        timestamp: Date.now()
                    });
                } catch {}
            }
        }, 8000);
    }

    public updateIdentity(newId: string): void {
        if (!newId || newId === this.myId) return;
        this.myId = newId;
        mqttRelay.updateIdentity(newId);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({ type: 'register', id: newId }));
            } catch {}
        }
    }

    /**
     * Resolves an ordered list of candidate signaling/relay endpoints.
     */
    public getSignalingCandidates(): string[] {
        const candidates: string[] = [];

        if (typeof window === 'undefined') {
            return ['ws://localhost:3001', 'ws://127.0.0.1:3001'];
        }

        const isHttps = window.location.protocol === 'https:';
        const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

        // 1. User-customized signaling URL in localStorage
        const custom = localStorage.getItem('red_signaling_url');
        if (custom && custom.trim()) {
            if (!isHttps || custom.startsWith('wss://')) {
                candidates.push(custom.trim());
            }
        }

        // 2. Environment variable
        if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
            const envUrl = process.env.NEXT_PUBLIC_SIGNALING_URL.trim();
            if (!isHttps || envUrl.startsWith('wss://')) {
                candidates.push(envUrl);
            }
        }

        // 3. High-availability public WebRTC signaling and mesh relays (strictly WSS)
        candidates.push('wss://red-signaling.onrender.com');
        candidates.push('wss://signaling.yjs.dev');

        // 4. Dynamic host / LAN candidates (only if not on native device loopback)
        const proto = isHttps ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;

        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.endsWith('.github.io')) {
            candidates.push(`${proto}//${hostname}:3001`);
        }

        // 5. Local loopback candidates (strictly for desktop browser development, never on native Android/iOS)
        if (!isHttps && !isNative) {
            candidates.push('ws://localhost:3001');
            candidates.push('ws://127.0.0.1:3001');
        }

        // Remove duplicates while preserving order
        return Array.from(new Set(candidates));
    }

    public getSignalingUrl(): string {
        const list = this.getSignalingCandidates();
        return list[this.currentCandidateIndex % list.length] || 'wss://red-signaling.onrender.com';
    }

    async connectToLocalSignaling(): Promise<void> {
        if (typeof window === 'undefined') return;

        // Ensure global MQTT Blind Relay connects concurrently
        mqttRelay.connect().catch(e => console.warn('[WebRtcTransport] MQTT connect error:', e));

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
                            // Initiate P2P WebRTC offer if our ID is greater to avoid double glare
                            if (this.myId > peerId && !this.peerConnections.has(peerId)) {
                                this.createOffer(peerId).catch(() => {});
                            }
                        }
                    }
                }
                break;
            }

            case 'peer-joined': {
                if (msg.peerId && msg.peerId !== this.myId) {
                    this.onlinePeers.add(msg.peerId);
                    console.log(`[WebRtcTransport] Remote peer discovered on mesh: ${msg.peerId.slice(0, 8)}`);
                    // Initiate P2P WebRTC offer if our ID is greater to avoid double glare
                    if (this.myId > msg.peerId && !this.peerConnections.has(msg.peerId)) {
                        this.createOffer(msg.peerId).catch(() => {});
                    }
                }
                break;
            }

            case 'offer':
                if (msg.sdp && sender) {
                    await this.handleOffer(sender, msg.sdp);
                }
                break;
            case 'answer':
                if (msg.sdp && sender) {
                    await this.handleAnswer(sender, msg.sdp);
                }
                break;
            case 'ice-candidate':
                if (msg.candidate && sender) {
                    await this.handleIceCandidate(sender, msg.candidate);
                }
                break;
            case 'peer-joined':
                if (sender) {
                    this.onlinePeers.add(sender);
                    if (this.myId && sender && this.myId > sender) {
                        this.createOffer(sender).catch(() => {});
                    }
                }
                break;
            case 'peer-left':
                if (sender) {
                    this.onlinePeers.delete(sender);
                    this.cleanupPeer(sender);
                }
                break;
            case 'room-joined':
                if (Array.isArray(msg.peers)) {
                    for (const p of msg.peers) {
                        if (p && p !== this.myId) {
                            this.onlinePeers.add(p);
                            if (this.myId && this.myId > p) {
                                this.createOffer(p).catch(() => {});
                            }
                        }
                    }
                }
                break;
            case 'mesh-relay': {
                const fromPeer = msg.fromPeer || sender;
                const payloadHex = msg.payloadHex;
                if (fromPeer && payloadHex && typeof payloadHex === 'string') {
                    const match = payloadHex.match(/.{1,2}/g);
                    let payloadBytes: Uint8Array;
                    if (match) {
                        payloadBytes = new Uint8Array(match.map((byte: string) => parseInt(byte, 16)));
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
                const icePayload = {
                    type: 'ice-candidate',
                    targetPeerId: peerId,
                    candidate: event.candidate,
                };
                this.sendWs(icePayload);
                mqttRelay.sendSignaling(peerId, icePayload);
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

            // In-band heartbeat ping-pong inspection
            try {
                if (payload.length > 0 && payload[0] === 123) { // starts with '{'
                    const str = new TextDecoder().decode(payload);
                    if (str.includes('"type":"mesh-ping"')) {
                        const ping = JSON.parse(str);
                        const pongPayload = new TextEncoder().encode(JSON.stringify({
                            type: 'mesh-pong',
                            from: this.myId,
                            echoTs: ping.timestamp,
                            timestamp: Date.now()
                        }));
                        const safePongBuf = pongPayload.buffer.slice(pongPayload.byteOffset, pongPayload.byteOffset + pongPayload.byteLength) as ArrayBuffer;
                        channel.send(safePongBuf);
                        return;
                    }
                    if (str.includes('"type":"mesh-pong"')) {
                        const pong = JSON.parse(str);
                        const rtt = Date.now() - (pong.echoTs || Date.now());
                        // RTT confirmed, keep channel warm
                        return;
                    }
                }
            } catch {}

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

    private isMakingOffer: Map<string, boolean> = new Map();

    private isPolite(peerId: string): boolean {
        return (this.myId || '') < (peerId || '');
    }

    public async createOffer(peerId: string, iceRestart = false): Promise<void> {
        try {
            this.isMakingOffer.set(peerId, true);
            const pc = this.getOrCreatePeerConnection(peerId);
            if (!this.dataChannels.has(peerId) || this.dataChannels.get(peerId)?.readyState === 'closed') {
                const channel = pc.createDataChannel('red-mesh-data', { ordered: true });
                this.setupDataChannel(peerId, channel);
            }

            const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
            if (pc.signalingState !== 'stable') return;
            await pc.setLocalDescription(offer);

            const sigPayload = {
                type: 'offer',
                targetPeerId: peerId,
                sdp: offer,
            };
            this.sendWs(sigPayload);
            mqttRelay.sendSignaling(peerId, sigPayload);
        } catch (err) {
            console.warn(`[WebRtcTransport] Failed to create offer for ${peerId.slice(0, 8)}:`, err);
        } finally {
            this.isMakingOffer.set(peerId, false);
        }
    }

    private async handleOffer(peerId: string, sdp: RTCSessionDescriptionInit) {
        try {
            const pc = this.getOrCreatePeerConnection(peerId);
            const isOfferCollision = Boolean(this.isMakingOffer.get(peerId)) || pc.signalingState !== 'stable';
            
            if (isOfferCollision && !this.isPolite(peerId)) {
                console.log(`[WebRtcTransport] Glare detected with ${peerId.slice(0, 8)} — impolite node stands ground`);
                return;
            }

            if (isOfferCollision && this.isPolite(peerId)) {
                console.log(`[WebRtcTransport] Glare detected with ${peerId.slice(0, 8)} — polite node rolls back`);
                await pc.setLocalDescription({ type: 'rollback' } as any).catch(() => {});
            }

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

            const ansPayload = {
                type: 'answer',
                targetPeerId: peerId,
                sdp: answer,
            };
            this.sendWs(ansPayload);
            mqttRelay.sendSignaling(peerId, ansPayload);
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
     * Uses direct WebRTC DataChannel if open; otherwise falls back to Encrypted Blind MQTT & WebSocket Relays.
     */
    async send(peerId: string, payload: Uint8Array): Promise<boolean> {
        let sent = false;

        // 1. Direct WebRTC DataChannel (P2P High Speed)
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            try {
                const safeBuffer = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength) as ArrayBuffer;
                channel.send(safeBuffer);
                sent = true;
            } catch (err) {
                console.warn(`[WebRtcTransport] DataChannel send failed for ${peerId.slice(0, 8)}, falling back to relay:`, err);
            }
        }

        // Proactively negotiate WebRTC P2P for future messages if not yet connected
        if (!this.peerConnections.has(peerId) || this.peerConnections.get(peerId)?.connectionState === 'disconnected') {
            this.createOffer(peerId).catch(() => {});
        }

        // 2. High-Availability Global MQTT Blind Relay
        const mqttSent = mqttRelay.sendPacket(peerId, payload);
        if (mqttSent) sent = true;

        // 3. Encrypted Blind WebSocket Relay Fallback (Zero-Knowledge)
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                const hex = Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join('');
                this.sendWs({
                    type: 'mesh-relay',
                    targetPeerId: peerId,
                    payloadHex: hex,
                });
                sent = true;
            } catch (err) {
                console.warn(`[WebRtcTransport] Blind relay failed for ${peerId.slice(0, 8)}:`, err);
            }
        }

        return sent;
    }

    onMessage(callback: (msg: { from: string; payload: Uint8Array }) => void) {
        this.messageListeners.push(callback);
    }
}
