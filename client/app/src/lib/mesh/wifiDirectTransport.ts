export class WifiDirectTransport {
    private ws: WebSocket | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private dataChannels: Map<string, RTCDataChannel> = new Map();
    private myId: string;
    private messageListeners: ((msg: {from: string, payload: Uint8Array}) => void)[] = [];
    public onlinePeers: Set<string> = new Set();

    constructor(myId: string) {
        this.myId = myId;
    }

    async connectToLocalSignaling() {
        if (typeof window === 'undefined') return;
        return new Promise<void>((resolve, reject) => {
            try {
                // Connect to the Rust Axum WebSocket endpoint for local subset signaling
                const wsUrl = 'ws://127.0.0.1:4555/local-signal';
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    this.broadcast({ type: 'announce', id: this.myId });
                    resolve();
                };

                this.ws.onmessage = async (event) => {
                    const msg = JSON.parse(event.data);
                    if (msg.id === this.myId) return; // Ignore own echoes

                    switch(msg.type) {
                        case 'announce':
                            this.onlinePeers.add(msg.id);
                            // Initiate WebRTC connection directly on LAN
                            await this.createOffer(msg.id);
                            break;
                        case 'offer':
                            await this.handleOffer(msg.id, msg.sdp);
                            break;
                        case 'answer':
                            await this.handleAnswer(msg.id, msg.sdp);
                            break;
                        case 'ice-candidate':
                            await this.handleIceCandidate(msg.id, msg.candidate);
                            break;
                    }
                };

                this.ws.onerror = (e) => reject(e);
            } catch (e) {
                reject(e);
            }
        });
    }

    private setupPeerConnection(peerId: string): RTCPeerConnection {
        // No STUN/TURN needed for true LAN usage
        const pc = new RTCPeerConnection({ iceServers: [] });
        
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.broadcast({ type: 'ice-candidate', id: this.myId, target: peerId, candidate: event.candidate });
            }
        };

        pc.ondatachannel = (event) => {
            const channel = event.channel;
            this.setupDataChannel(peerId, channel);
        };

        this.peerConnections.set(peerId, pc);
        return pc;
    }

    private setupDataChannel(peerId: string, channel: RTCDataChannel) {
        channel.binaryType = 'arraybuffer';
        channel.onopen = () => console.log(`[WiFi-Direct] DataChannel open with ${peerId}`);
        channel.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                const payload = new Uint8Array(event.data);
                this.messageListeners.forEach(cb => cb({ from: peerId, payload }));
            }
        };
        channel.onclose = () => {
             this.dataChannels.delete(peerId);
             this.onlinePeers.delete(peerId);
        };
        this.dataChannels.set(peerId, channel);
    }

    private async createOffer(peerId: string) {
        let pc = this.peerConnections.get(peerId);
        if (!pc) pc = this.setupPeerConnection(peerId);

        const channel = pc.createDataChannel('red-mesh-data', { ordered: true });
        this.setupDataChannel(peerId, channel);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.broadcast({ type: 'offer', id: this.myId, target: peerId, sdp: offer });
    }

    private async handleOffer(peerId: string, offer: any) {
        let pc = this.peerConnections.get(peerId);
        if (!pc) pc = this.setupPeerConnection(peerId);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.broadcast({ type: 'answer', id: this.myId, target: peerId, sdp: answer });
    }

    private async handleAnswer(peerId: string, answer: any) {
        const pc = this.peerConnections.get(peerId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }

    private async handleIceCandidate(peerId: string, candidate: any) {
        const pc = this.peerConnections.get(peerId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }

    private broadcast(msg: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    async send(peerId: string, payload: Uint8Array): Promise<boolean> {
        const channel = this.dataChannels.get(peerId);
        if (channel && channel.readyState === 'open') {
            channel.send(payload.buffer as ArrayBuffer);
            return true;
        }
        return false;
    }

    onMessage(callback: (msg: {from: string, payload: Uint8Array}) => void) {
        this.messageListeners.push(callback);
    }
}
