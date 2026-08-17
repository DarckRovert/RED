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
// peers: peerId  → { ws, rooms: Set<roomId>, registeredAt }
const rooms = new Map();
const peers = new Map();

const wss = new WebSocket.Server({ server });

// ── Helpers ──────────────────────────────────────────────────────────────────
function send(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
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
    for (const rId of peer.rooms) {
        const room = rooms.get(rId);
        if (room) {
            room.delete(peerId);
            if (room.size === 0) rooms.delete(rId);
            else broadcastToRoom(rId, peerId, { type: "peer-left", peerId, roomId: rId });
        }
    }
    peers.delete(peerId);
    console.log(`[RED Signaling] Peer disconnected: ${peerId}`);
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
wss.on("connection", (ws, req) => {
    // SEC-FIX M-3: Mandatory Token Authentication (Enforced only if configured)
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const token = url.searchParams.get("token");
    const requiredToken = process.env.SIGNALING_TOKEN;

    if (requiredToken) {
        if (!token || token !== requiredToken) {
            console.error(`[RED Signaling] Unauthorized connection attempt from ${req.socket.remoteAddress} — missing or invalid token`);
            ws.send(JSON.stringify({ type: "error", message: "Unauthorized: Invalid signaling token" }));
            ws.close();
            return;
        }
    } else {
        console.log(`[RED Signaling] Connection from ${req.socket.remoteAddress} accepted without token`);
    }

    const ip = req.socket.remoteAddress;
    let peerId = null;

    console.log(`[RED Signaling] Authorized client connected from ${ip}`);

    ws.on("message", (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        const { type, roomId, targetPeerId } = msg;

        switch (type) {
            // ── Register peer (optionally in a room) ─────────────────────
            case "register": {
                peerId = msg.peerId || crypto.randomUUID?.() || `peer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                const initialRoomId = msg.roomId || "red-global-mesh";
                
                let peerEntry = peers.get(peerId);
                if (!peerEntry) {
                    peerEntry = { ws, rooms: new Set(), registeredAt: Date.now() };
                    peers.set(peerId, peerEntry);
                } else {
                    peerEntry.ws = ws;
                }

                const room = getOrCreateRoom(initialRoomId);
                if (room.size >= 500) {
                    send(ws, { type: "error", message: "Room is full (max 500 peers)" });
                    return;
                }

                room.add(peerId);
                peerEntry.rooms.add(initialRoomId);

                send(ws, { 
                    type: "registered", 
                    peerId, 
                    roomId: initialRoomId, 
                    peerCount: room.size,
                    onlinePeers: Array.from(room).filter(id => id !== peerId)
                });
                broadcastToRoom(initialRoomId, peerId, { type: "peer-joined", peerId, roomId: initialRoomId });

                console.log(`[RED Signaling] Peer registered: ${peerId} → room: ${initialRoomId} (peers: ${room.size})`);
                break;
            }

            // ── Join additional room (e.g. direct conversation pair room) ─
            case "join-room": {
                if (!peerId || !peers.has(peerId)) {
                    send(ws, { type: "error", message: "Not registered" });
                    return;
                }
                const targetRoom = msg.roomId;
                if (!targetRoom) return;

                const room = getOrCreateRoom(targetRoom);
                room.add(peerId);
                peers.get(peerId).rooms.add(targetRoom);

                send(ws, { 
                    type: "room-joined", 
                    roomId: targetRoom, 
                    peerCount: room.size,
                    onlinePeers: Array.from(room).filter(id => id !== peerId)
                });
                broadcastToRoom(targetRoom, peerId, { type: "peer-joined", peerId, roomId: targetRoom });
                break;
            }

            // ── Leave a specific room ─────────────────────────────────────
            case "leave-room": {
                if (peerId && peers.has(peerId) && msg.roomId) {
                    const room = rooms.get(msg.roomId);
                    if (room) {
                        room.delete(peerId);
                        if (room.size === 0) rooms.delete(msg.roomId);
                        else broadcastToRoom(msg.roomId, peerId, { type: "peer-left", peerId, roomId: msg.roomId });
                    }
                    peers.get(peerId).rooms.delete(msg.roomId);
                }
                break;
            }

            // ── WebRTC Signaling (offer, answer, ICE) ────────────────────
            case "offer":
            case "answer":
            case "ice-candidate":
            case "call-request":
            case "call-accepted":
            case "call-rejected":
            case "hangup":
            case "signal": {
                if (!peerId || !peers.has(peerId)) {
                    send(ws, { type: "error", message: "Not registered" });
                    return;
                }

                // If explicit targetPeerId is specified, route directly to that peer
                if (targetPeerId) {
                    const target = peers.get(targetPeerId);
                    if (target && target.ws.readyState === WebSocket.OPEN) {
                        send(target.ws, { ...msg, fromPeer: peerId, senderId: peerId });
                    } else {
                        send(ws, { type: "peer-offline", targetPeerId, originalType: type });
                    }
                    return;
                }

                // Fallback: broadcast to room if roomId is provided
                const targetRoomId = roomId || Array.from(peers.get(peerId).rooms)[0];
                if (targetRoomId) {
                    broadcastToRoom(targetRoomId, peerId, { ...msg, fromPeer: peerId, senderId: peerId });
                }
                break;
            }

            // ── Blind Encrypted Mesh Relay (Zero-Knowledge Packet Forward) ─
            case "mesh-relay": {
                if (!peerId || !peers.has(peerId)) {
                    send(ws, { type: "error", message: "Not registered" });
                    return;
                }
                const targetRecipient = targetPeerId || msg.recipient;
                if (!targetRecipient) {
                    send(ws, { type: "error", message: "Missing recipient for mesh-relay" });
                    return;
                }

                // Find target peer (exact DID match or prefix match)
                let target = peers.get(targetRecipient);
                if (!target && targetRecipient.length >= 8) {
                    for (const [pId, pData] of peers.entries()) {
                        if (pId.startsWith(targetRecipient) || targetRecipient.startsWith(pId)) {
                            target = pData;
                            break;
                        }
                    }
                }

                if (target && target.ws.readyState === WebSocket.OPEN) {
                    send(target.ws, {
                        type: "mesh-relay",
                        fromPeer: peerId,
                        recipient: targetRecipient,
                        payload: msg.payload,
                        payloadHex: msg.payloadHex
                    });
                    send(ws, { type: "mesh-relay-ack", recipient: targetRecipient, status: "delivered" });
                } else {
                    send(ws, { type: "peer-offline", targetPeerId: targetRecipient, status: "queued_locally" });
                }
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
