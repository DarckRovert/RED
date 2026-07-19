export class WifiDirectTransport {
    private myId: string;
    public onlinePeers: Set<string> = new Set(); // Empty

    constructor(myId: string) {
        this.myId = myId;
    }

    async connectToLocalSignaling() {
        if (typeof window === 'undefined') return;
        console.log('[WiFi-Direct] Native Rust mDNS discovery is now handling WiFi Transport. JS WebRTC disabled.');
        return Promise.resolve();
    }

    async send(peerId: string, payload: Uint8Array): Promise<boolean> {
        return false;
    }

    onMessage(callback: (msg: {from: string, payload: Uint8Array}) => void) {
        // No-op
    }
}
