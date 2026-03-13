/**
 * RED Signaling Client — WebSocket connector for WebRTC signaling.
 * Configure NEXT_PUBLIC_SIGNALING_URL or defaults to localhost:3001.
 */

export const SIGNALING_URL =
    process.env.NEXT_PUBLIC_SIGNALING_URL ||
    (typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `wss://${window.location.hostname}:3001`
        : "ws://localhost:3001");

export type SignalingMessage = {
    type: "register" | "registered" | "offer" | "answer" | "ice-candidate"
    | "call-request" | "call-accepted" | "call-rejected" | "hangup"
    | "peer-joined" | "peer-left" | "error";
    roomId?: string;
    peerId?: string;
    fromPeer?: string;
    peerCount?: number;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    callType?: "voice" | "video";
    callerName?: string;
    message?: string;
};

export class SignalingClient {
    private ws: WebSocket | null = null;
    public peerId: string | null = null;
    private roomId: string;
    private reconnectDelay = 1000;
    private maxReconnect = 5;
    private reconnectCount = 0;
    private dead = false;
    private handlers: Record<string, ((detail: any) => void)[]> = {};

    constructor(roomId: string) {
        this.roomId = roomId;
    }

    connect(localPeerId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.peerId = localPeerId;
                const ws = new WebSocket(SIGNALING_URL);
                this.ws = ws;

                ws.onopen = () => {
                    this.reconnectCount = 0;
                    this.send({ type: "register", peerId: this.peerId!, roomId: this.roomId });
                };

                ws.onmessage = (ev) => {
                    let msg: SignalingMessage;
                    try { msg = JSON.parse(ev.data); } catch { return; }

                    if (msg.type === "registered") {
                        this.peerId = msg.peerId ?? this.peerId;
                        resolve();
                    }
                    this.emit(msg.type, msg);
                };

                ws.onclose = () => {
                    if (this.dead) return;
                    if (this.reconnectCount < this.maxReconnect) {
                        this.reconnectCount++;
                        setTimeout(() => this.connect(this.peerId!).catch(() => { }), this.reconnectDelay * this.reconnectCount);
                    }
                    this.emit("disconnected", {});
                };

                ws.onerror = (err) => {
                    console.error("[Signaling] WS Error", err);
                    reject(new Error("WebSocket connection failed"));
                };
            } catch (err) {
                reject(err);
            }
        });
    }

    send(msg: Partial<SignalingMessage> & { type: string }) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({ ...msg, roomId: this.roomId }));
            } catch (err) {
                console.error("[Signaling] Send failed", err);
            }
        }
    }

    on(type: string, handler: (detail: any) => void) {
        if (!this.handlers[type]) this.handlers[type] = [];
        this.handlers[type].push(handler);
    }

    private emit(type: string, detail: any) {
        (this.handlers[type] || []).forEach(h => {
            try { h(detail); } catch (err) { console.error(`[Signaling] Error in handler for ${type}`, err); }
        });
    }

    close() {
        this.dead = true;
        this.ws?.close();
        this.handlers = {};
    }
}
