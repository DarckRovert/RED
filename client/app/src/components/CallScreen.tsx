"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { SignalingClient } from "../lib/signalingClient";
import type { SignalingMessage } from "../lib/signalingClient";
import { useRedStore } from "../store/useRedStore";

interface CallScreenProps {
    peer: string;
    peerId?: string;       // remote peer's DID/id (for room derivation)
    localPeerId?: string;  // your own DID (for room derivation)
    roomId?: string;       // override: explicit room id
    mode: "voice" | "video";
    incoming?: boolean;
    onAnswer?: () => void;
    onHangup: () => void;
}

// ICE servers: STUN (free) + TURN (for NAT traversal in CGNAT networks common in Latam)
// For production: register at https://metered.ca for free 50GB/month TURN
const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL ||
    (typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `wss://${window.location.hostname}:3001`
        : "ws://localhost:3001");

const ICE_SERVERS: RTCIceServer[] = [
    // Public STUN servers (~80% of connections work with just STUN)
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    // TURN relay servers (needed for remaining ~20% behind strict NAT/CGNAT)
    // Free tier from Metered.ca — replace with your own for production
    ...(process.env.NEXT_PUBLIC_TURN_URL ? [{
        urls: process.env.NEXT_PUBLIC_TURN_URL,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || "",
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
    }] : []),
    // Open Relay fallback (no auth required, limited bandwidth)
    {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
    },
    {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
    },
];

type CallState = "ringing" | "connecting" | "active" | "failed" | "ended";

/**
 * CallScreen — Full WebRTC implementation with real WebSocket signaling.
 *
 * Call flow (caller):
 *   1. Connect to signaling server & register in room
 *   2. Get local media stream
 *   3. Create RTCPeerConnection, add local tracks
 *   4. Create SDP offer, set as local description
 *   5. Send offer via signaling → peer receives it
 *   6. Receive answer SDP from peer → set as remote description
 *   7. Exchange ICE candidates bidirectionally via signaling
 *   8. oniceconnectionstate === "connected" → active call
 *
 * Call flow (callee / incoming):
 *   1. Screen opens in "ringing" state
 *   2. On Answer: connect signaling, get media, receive offer → create answer → send back
 *   3. ICE exchange happens automatically via onicecandidate events
 */
export default function CallScreen({ peer, peerId, localPeerId, roomId, mode, incoming = false, onAnswer, onHangup }: CallScreenProps) {
    const [callState, setCallState] = useState<CallState>(incoming ? "ringing" : "connecting");
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [cameraOn, setCameraOn] = useState(mode === "video");
    const [isSpeaker, setIsSpeaker] = useState(false);
    const [iceState, setIceState] = useState<string>("new");
    const [signalingConnected, setSignalingConnected] = useState(false);
    const { addCallRecord } = useRedStore();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const sigRef = useRef<SignalingClient | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const iceBufRef = useRef<RTCIceCandidateInit[]>([]); // buffer ICE until remote desc set

    // ── Derive room id from peer ids (deterministic, same for both sides) ────
    const effectiveRoomId = roomId ?? [localPeerId ?? "me", peerId ?? peer].sort().join("-");

    // ── Timer ────────────────────────────────────────────────────────────────
    const startTimer = useCallback(() => {
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }, []);

    // ── Get local media ──────────────────────────────────────────────────────
    const getLocalMedia = useCallback(async (): Promise<MediaStream | null> => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
            console.warn("[WebRTC] MediaDevices API not available");
            return null;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
                video: mode === "video"
                    ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
                    : false,
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            return stream;
        } catch (err) {
            console.warn("[WebRTC] getUserMedia failed:", err);
            // Fallback: audio only
            try {
                const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
                localStreamRef.current = audio;
                return audio;
            } catch { return null; }
        }
    }, [mode]);

    // ── Build RTCPeerConnection ──────────────────────────────────────────────
    const createPeerConnection = useCallback((sig: SignalingClient) => {
        const RTCPeer = (window as any).RTCPeerConnection || (window as any).webkitRTCPeerConnection;
        if (!RTCPeer) {
            console.error("[WebRTC] RTCPeerConnection not supported in this browser");
            setCallState("failed");
            return null;
        }

        const pc = new RTCPeer({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });
        pcRef.current = pc;

        // Local ICE candidate → send via signaling
        pc.onicecandidate = ({ candidate }: RTCPeerConnectionIceEvent) => {
            if (candidate) sig.send({ type: "ice-candidate", candidate: candidate.toJSON() });
        };

        // ICE connection state → update UI
        pc.oniceconnectionstatechange = () => {
            setIceState(pc.iceConnectionState);
            if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                setCallState("active");
                startTimer();
            }
            if (pc.iceConnectionState === "failed") setCallState("failed");
            if (pc.iceConnectionState === "closed") setCallState("ended");
        };

        // Remote stream → display in video element
        pc.ontrack = ({ streams }: RTCTrackEvent) => {
            if (remoteVideoRef.current && streams[0]) {
                remoteVideoRef.current.srcObject = streams[0];
            }
        };

        return pc;
    }, [startTimer]);

    // ── Apply buffered ICE candidates ────────────────────────────────────────
    const flushIceBuffer = useCallback(async (pc: RTCPeerConnection) => {
        for (const c of iceBufRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { }
        }
        iceBufRef.current = [];
    }, []);

    // ── Caller flow: connect → offer → wait for answer ───────────────────────
    const startCall = useCallback(async () => {
        const myPeerId = localPeerId ?? `caller_${Date.now()}`;
        const sig = new SignalingClient(effectiveRoomId);
        sigRef.current = sig;

        try {
            await sig.connect(myPeerId);
            setSignalingConnected(true);
        } catch {
            setCallState("failed");
            return;
        }

        const stream = await getLocalMedia();
        const pc = createPeerConnection(sig);
        if (!pc) { setCallState("failed"); return; }

        stream?.getTracks().forEach(t => pc.addTrack(t, stream));

        // Notify callee
        sig.send({ type: "call-request", callType: mode, callerName: localPeerId ?? "Unknown" });

        // Create and send offer
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: mode === "video" });
        await pc.setLocalDescription(offer);
        sig.send({ type: "offer", sdp: offer });

        // Receive answer
        sig.on("answer", async (msg: SignalingMessage) => {
            if (!msg.sdp || pc.signalingState === "stable") return;
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            await flushIceBuffer(pc);
        });

        // Receive remote ICE candidates
        sig.on("ice-candidate", async (msg: SignalingMessage) => {
            if (!msg.candidate) return;
            if (pc.remoteDescription) {
                try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch { }
            } else {
                iceBufRef.current.push(msg.candidate);
            }
        });

        sig.on("hangup", () => handleHangup());
        sig.on("call-rejected", () => { setCallState("ended"); });
    }, [effectiveRoomId, localPeerId, mode, getLocalMedia, createPeerConnection, flushIceBuffer]);

    // ── Callee flow: receive offer → send answer ─────────────────────────────
    const answerCall = useCallback(async () => {
        setCallState("connecting");
        const myPeerId = localPeerId ?? `callee_${Date.now()}`;
        const sig = new SignalingClient(effectiveRoomId);
        sigRef.current = sig;

        try {
            await sig.connect(myPeerId);
            setSignalingConnected(true);
        } catch {
            setCallState("failed");
            return;
        }

        const stream = await getLocalMedia();
        const pc = createPeerConnection(sig);
        stream?.getTracks().forEach(t => pc.addTrack(t, stream));

        sig.send({ type: "call-accepted" });

        // Receive offer
        sig.on("offer", async (msg: SignalingMessage) => {
            if (!msg.sdp) return;
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            await flushIceBuffer(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sig.send({ type: "answer", sdp: answer });
        });

        // Receive remote ICE candidates
        sig.on("ice-candidate", async (msg: SignalingMessage) => {
            if (!msg.candidate) return;
            if (pc.remoteDescription) {
                try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch { }
            } else {
                iceBufRef.current.push(msg.candidate);
            }
        });

        sig.on("hangup", () => handleHangup());
        onAnswer?.();
    }, [effectiveRoomId, localPeerId, getLocalMedia, createPeerConnection, flushIceBuffer, onAnswer]);

    // ── Hangup ───────────────────────────────────────────────────────────────
    const handleHangup = useCallback(() => {
        timerRef.current && clearInterval(timerRef.current);
        const dur = duration;
        
        // Registrar en historial si es que llegó a conectarse o conectando (missed si < 0)
        // Solo guardar quien colgó / terminó.
        addCallRecord({
            id: `call_${Date.now()}`,
            peer,
            direction: incoming ? "incoming" : "outgoing",
            type: mode,
            // si la llamada está conectada -> answered, si estamns llamando y duracion es 0 -> missed
            status: dur > 0 ? "answered" : (incoming ? "missed" : "declined"),
            duration: dur,
            timestamp: Math.floor(Date.now() / 1000)
        });

        localStreamRef.current?.getTracks().forEach(t => t.stop());
        pcRef.current?.close();
        sigRef.current?.send({ type: "hangup" });
        sigRef.current?.close();
        onHangup();
    }, [onHangup, duration, incoming, mode, peer, addCallRecord]);

    // ── Track controls ───────────────────────────────────────────────────────
    const handleMute = () => {
        const m = !isMuted; setIsMuted(m);
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !m; });
    };
    const handleCamera = () => {
        const on = !cameraOn; setCameraOn(on);
        localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = on; });
    };

    // ── Lifecycle ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!incoming) startCall();
        return () => {
            timerRef.current && clearInterval(timerRef.current);
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            pcRef.current?.close();
            sigRef.current?.close();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    const iceColor = { connected: "#4caf50", completed: "#4caf50", failed: "#ef5350", disconnected: "#ef5350" }[iceState] ?? "#999";

    return (
        <div className="call-screen animate-fade">
            {/* Video layer */}
            {mode === "video" && callState === "active" && (
                <>
                    <video ref={remoteVideoRef} className="call-video-remote" autoPlay playsInline />
                    <video ref={localVideoRef} className="call-video-local" autoPlay playsInline muted />
                </>
            )}

            {/* Call info */}
            <div className="call-info">
                <div className="call-avatar">{peer[0]?.toUpperCase()}</div>
                <h2 className="call-peer">{peer}</h2>
                <p className="call-status">
                    {callState === "ringing" && <span className="ringing-anim">🔔 Llamada entrante...</span>}
                    {callState === "connecting" && <span>⏳ {signalingConnected ? "Negociando ICE..." : "Conectando al servidor..."}</span>}
                    {callState === "active" && <span>{fmt(duration)} · 🔒 E2E WebRTC</span>}
                    {callState === "failed" && <span style={{ color: "#ef5350" }}>❌ Conexión fallida</span>}
                    {callState === "ended" && <span style={{ color: "#999" }}>Llamada terminada</span>}
                </p>

                {/* ICE / Signaling status badge */}
                <p style={{ fontSize: "0.65rem", marginTop: 4, opacity: 0.7 }}>
                    <span style={{ color: signalingConnected ? "#4caf50" : "#ff9800" }}>
                        {signalingConnected ? "● Señalización activa" : "◌ Conectando señalización..."}
                    </span>
                    {callState === "active" && (
                        <span style={{ color: iceColor, marginLeft: 8 }}>ICE: {iceState}</span>
                    )}
                </p>

                {mode === "video" && callState === "active" && !cameraOn && (
                    <p className="call-cam-off">📷 Cámara desactivada</p>
                )}
            </div>

            {/* Controls */}
            <div className="call-controls">
                {callState === "ringing" ? (
                    <>
                        <button className="call-btn reject" onClick={handleHangup}>📵</button>
                        <button className="call-btn answer" onClick={answerCall}>📞</button>
                    </>
                ) : (
                    <>
                        <button className={`call-btn ${isMuted ? "active" : ""}`} onClick={handleMute}>
                            {isMuted ? "🔇" : "🎤"}
                        </button>
                        {mode === "video" && (
                            <button className={`call-btn ${!cameraOn ? "active" : ""}`} onClick={handleCamera}>
                                {cameraOn ? "📷" : "🚫"}
                            </button>
                        )}
                        <button className={`call-btn ${isSpeaker ? "active" : ""}`} onClick={() => setIsSpeaker(s => !s)}>
                            {isSpeaker ? "🔊" : "🔈"}
                        </button>
                        <button className="call-btn hangup" onClick={handleHangup}>📵</button>
                    </>
                )}
            </div>
        </div>
    );
}
