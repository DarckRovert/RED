import { registerPlugin } from '@capacitor/core';

export interface RedNodePlugin {
    /**
     * Starts the internal Rust-based RED Node on the Android device.
     * This function sets up the internal HTTP/WebSocket Axum server
     * bound exclusively to localhost (127.0.0.1:4555) securely.
     */
    start(options: { password?: string }): Promise<void>;
}

const RedNode = registerPlugin<RedNodePlugin>('RedNode');

export default RedNode;
