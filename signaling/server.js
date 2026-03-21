/**
 * RED Signaling Server — v1.0
 * 
 * WebSocket-based WebRTC signaling server.
 * Routes offer/answer/ICE candidates between peers without seeing
 * any message content (metadata-minimal design).
 *
 * Message protocol:
 *   { type: "register",       peerId, roomId }
 *   { type: "offer",          roomId, sdp }
 *   { type: "answer",         roomId, sdp }
 *   { type: "ice-candidate",  roomId, candidate }
 *   { type: "call-request",   roomId, callType: "voice"|"video", callerName }
 *   { type: "call-accepted",  roomId }
 *   { type: "call-rejected",  roomId }
 *   { type: "hangup",         roomId }
 *   { type: "error",          message }
 */

const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");
const http = require("http");

const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_, res) => res.json({
    status: "ok",
    uptime: process.uptime(),
    rooms: rooms.size,
    peers: peers.size,
    version: "1.0.0"
}));

// In-memory state
// rooms: roomId  → Set<peerId>
// peers: peerId  → { ws, roomId, registeredAt }
const rooms = new Map();
const peers = new Map();

const wss = new WebSocket.Server({ server });

// ── Helpers ──────────────────────────────────────────────────────────────────
function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function getOrCreateRoom(roomId) {
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    return rooms.get(roomId);
}

function broadcastToRoom(roomId, senderId, data) {
    const room = rooms.get(roomId);
    if (!room) return;
    for (const peerId of room) {
        if (peerId === senderId) continue;
        const peer = peers.get(peerId);
        if (peer) send(peer.ws, data);
    }
}

function removePeer(peerId) {
    const peer = peers.get(peerId);
    if (!peer) return;
    const room = rooms.get(peer.roomId);
    if (room) {
        room.delete(peerId);
        if (room.size === 0) rooms.delete(peer.roomId);
        else broadcastToRoom(peer.roomId, peerId, { type: "peer-left", peerId });
    }
    peers.delete(peerId);
    console.log(`[RED Signaling] Peer disconnected: ${peerId} (room: ${peer.roomId})`);
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
wss.on("connection", (ws, req) => {
    // SEC-FIX M-3: Mandatory Token Authentication
    // Prevents unauthorized clients from connecting to the signaling rooms.
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const token = url.searchParams.get("token");

    if (!token || token !== (process.env.SIGNALING_TOKEN || "RED_SIGNAL_2026")) {
        console.error(`[RED Signaling] Unauthorized connection attempt from ${req.socket.remoteAddress} — missing or invalid token`);
        ws.send(JSON.stringify({ type: "error", message: "Unauthorized: Invalid signaling token" }));
        ws.close();
        return;
    }

    const ip = req.socket.remoteAddress;
    let peerId = null;

    console.log(`[RED Signaling] Authorized client connected from ${ip}`);

    ws.on("message", (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        const { type, roomId } = msg;

        switch (type) {
            // ── Register peer in a room ───────────────────────────────────
            case "register": {
                peerId = msg.peerId || crypto.randomUUID?.() || `peer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                const room = getOrCreateRoom(msg.roomId);

                if (room.size >= 2) {
                    send(ws, { type: "error", message: "Room is full (max 2 peers)" });
                    return;
                }

                peers.set(peerId, { ws, roomId: msg.roomId, registeredAt: Date.now() });
                room.add(peerId);

                send(ws, { type: "registered", peerId, roomId: msg.roomId, peerCount: room.size });
                broadcastToRoom(msg.roomId, peerId, { type: "peer-joined", peerId });

                console.log(`[RED Signaling] Peer registered: ${peerId} → room: ${msg.roomId} (${room.size}/2)`);
                break;
            }

            // ── Call signaling (offer, answer, ICE) ───────────────────────
            case "offer":
            case "answer":
            case "ice-candidate":
            case "call-request":
            case "call-accepted":
            case "call-rejected":
            case "hangup": {
                if (!peerId || !peers.has(peerId)) {
                    send(ws, { type: "error", message: "Not registered" });
                    return;
                }
                // Forward to all OTHER peers in the same room
                broadcastToRoom(peers.get(peerId).roomId, peerId, { ...msg, fromPeer: peerId });
                break;
            }

            default:
                send(ws, { type: "error", message: `Unknown message type: ${type}` });
        }
    });

    ws.on("close", () => {
        if (peerId) removePeer(peerId);
    });

    ws.on("error", (err) => {
        console.error(`[RED Signaling] WS error (${peerId || "unregistered"}):`, err.message);
        if (peerId) removePeer(peerId);
    });

    // Ping / pong to detect dead connections
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
});

// Heartbeat — evict dead connections every 30s
setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) { ws.terminate(); return; }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`\n🔴 RED Signaling Server v1.0 running`);
    console.log(`   WebSocket: ws://localhost:${PORT}`);
    console.log(`   Health:    http://localhost:${PORT}/health\n`);
});

module.exports = { app, server };
