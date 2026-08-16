"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { ErrorBanner } from "./ui/ErrorBanner";

export default function CallScreen() {
    const { identity, activeConversationId, conversations, contacts, goBack, incomingCall, setIncomingCall, activeCallSignal } = useRedStore();
    const activeConv = conversations.find(c => c.id === activeConversationId || c.peer === activeConversationId);
    
    // 1. Resolve full 64-character peer DID hash
    const rawPeer = activeConv?.peer || incomingCall?.callerHash || (
        activeConversationId && activeConversationId.length === 64 ? activeConversationId : (
            activeConversationId?.includes("-") ? activeConversationId.split("-")[1] : activeConversationId
        )
    ) || "";

    const peerContact = contacts.find((c: any) => 
        c.identity_hash === rawPeer ||
        (rawPeer.length >= 8 && c.identity_hash?.startsWith(rawPeer)) ||
        (rawPeer.length >= 8 && rawPeer.startsWith(c.identity_hash?.substring(0, 8))) ||
        (rawPeer.length >= 8 && c.identity_hash?.includes(rawPeer))
    );

    const peerHash = peerContact?.identity_hash || (rawPeer.length === 64 ? rawPeer : (
        conversations.find(c => c.peer && (c.peer === rawPeer || c.peer.startsWith(rawPeer) || rawPeer.startsWith(c.peer.substring(0, 8))))?.peer || rawPeer
    ));

    const peerDisplayName = incomingCall?.callerName || peerContact?.display_name || (peerHash ? `${peerHash.substring(0, 10)}...` : "Desconocido");

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    
    const [status, setStatus] = useState("Iniciando capa P2P WebRTC...");
    const [callActive, setCallActive] = useState(false);
    const [micMuted, setMicMuted] = useState(false);
    const [camMuted, setCamMuted] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

    // Call Duration Counter
    useEffect(() => {
        let timer: any = null;
        if (callActive) {
            timer = setInterval(() => {
                setCallDuration(d => d + 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [callActive]);

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, "0");
        const s = (seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    // 1. Initialize WebRTC Call Session
    useEffect(() => {
        if (!identity || !peerHash) return;
        let isSubscribed = true;

        const initCall = async () => {
            setStatus("Solicitando permisos de cámara y micrófono...");
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                });
                if (!isSubscribed) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.muted = true;
                    localVideoRef.current.playsInline = true;
                    localVideoRef.current.play().catch(() => {});
                }
                
                // STUN servers for local LAN + WAN Traversal
                const pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" }
                    ],
                    iceCandidatePoolSize: 10
                });
                peerRef.current = pc;

                // Add local tracks to WebRTC session
                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                // Handle connection state transitions
                pc.oniceconnectionstatechange = () => {
                    console.log('[WebRTC] ICE State:', pc.iceConnectionState);
                    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                        setStatus("CONECTADO (E2E DTLS-SRTP)");
                        setCallActive(true);
                    } else if (pc.iceConnectionState === 'failed') {
                        setStatus("Error de conexión (ICE Failed)");
                    } else if (pc.iceConnectionState === 'disconnected') {
                        setStatus("Reconectando canal P2P...");
                    }
                };

                pc.onconnectionstatechange = () => {
                    console.log('[WebRTC] Connection State:', pc.connectionState);
                    if (pc.connectionState === 'connected') {
                        setStatus("CONECTADO (E2E DTLS-SRTP)");
                        setCallActive(true);
                    }
                };

                // Handle incoming remote media stream
                pc.ontrack = (event) => {
                    console.log('[WebRTC] Remote track received:', event.track.kind, event.streams);
                    let streamToPlay: MediaStream;
                    if (event.streams && event.streams[0]) {
                        streamToPlay = event.streams[0];
                    } else {
                        if (!remoteStreamRef.current) {
                            remoteStreamRef.current = new MediaStream();
                        }
                        remoteStreamRef.current.addTrack(event.track);
                        streamToPlay = remoteStreamRef.current;
                    }
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = streamToPlay;
                        remoteVideoRef.current.playsInline = true;
                        remoteVideoRef.current.play().catch(e => console.warn('[WebRTC] Remote play error:', e));
                    }
                    setCallActive(true);
                    setStatus("CONECTADO (E2E DTLS-SRTP)");
                };

                // Send ICE candidates via P2P signaling
                pc.onicecandidate = (event) => {
                    if (event.candidate && peerHash) {
                        RedAPI.sendMessage(peerHash, JSON.stringify({
                            candidate: event.candidate
                        }), { msg_type: "webrtc_signal" }).catch(() => {});
                    }
                };

                // CALLEE MODE: Answering an incoming call offer
                if (incomingCall && incomingCall.offer) {
                    setStatus("Conectando con interlocutor...");
                    await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
                    
                    // Flush any early received ICE candidates
                    if (pendingCandidatesRef.current.length > 0) {
                        console.log(`[WebRTC] Callee applying ${pendingCandidatesRef.current.length} queued ICE candidates`);
                        for (const cand of pendingCandidatesRef.current) {
                            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                        }
                        pendingCandidatesRef.current = [];
                    }

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    await RedAPI.sendMessage(peerHash, JSON.stringify({ answer }), { msg_type: "webrtc_signal" });
                    setIncomingCall(null);
                } 
                // CALLER MODE: Creating new call offer
                else {
                    setStatus("Llamando (Esperando respuesta E2E)...");
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    await RedAPI.sendMessage(peerHash, JSON.stringify({ offer }), { msg_type: "webrtc_signal" });
                }

            } catch (err: any) {
                setStatus("Error: Permiso de cámara/micrófono denegado");
                console.error("[CallScreen] Media Error:", err);
            }
        };

        initCall();

        return () => {
            isSubscribed = false;
            endCallInternal();
        };
    }, [peerHash]);

    // 2. React to Incoming Signals from Store Subscription (Answer, ICE candidates, Hangup)
    useEffect(() => {
        if (!activeCallSignal || !peerRef.current) return;
        const { signal } = activeCallSignal;

        const handleSignal = async () => {
            const pc = peerRef.current;
            if (!pc) return;

            try {
                // Remote Answer received
                if (signal.answer && pc.signalingState !== "stable") {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                    setStatus("Conexión E2E Establecida");
                    setCallActive(true);

                    // Flush any pending candidates queued before remoteDescription was set
                    if (pendingCandidatesRef.current.length > 0) {
                        console.log(`[WebRTC] Caller applying ${pendingCandidatesRef.current.length} queued ICE candidates`);
                        for (const cand of pendingCandidatesRef.current) {
                            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                        }
                        pendingCandidatesRef.current = [];
                    }
                } 
                // Remote ICE Candidate received
                else if (signal.candidate) {
                    if (pc.remoteDescription && pc.remoteDescription.type) {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((e) => {
                            console.warn('[WebRTC] addIceCandidate failed:', e);
                        });
                    } else {
                        console.log('[WebRTC] Queueing early ICE candidate');
                        pendingCandidatesRef.current.push(signal.candidate);
                    }
                } 
                // Remote Hangup signal received
                else if (signal.hangup) {
                    setStatus("Llamada Finalizada");
                    setTimeout(endCallInternal, 500);
                }
            } catch (err) {
                console.warn("[CallScreen] Signal Process Error:", err);
            }
        };

        handleSignal();
    }, [activeCallSignal]);

    const endCallInternal = () => {
        if (peerHash && peerRef.current) {
            RedAPI.sendMessage(peerHash, JSON.stringify({ hangup: true }), { msg_type: "webrtc_signal" }).catch(() => {});
        }
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach(t => t.stop());
            remoteStreamRef.current = null;
        }
        pendingCandidatesRef.current = [];
    };

    const handleUserEndCall = () => {
        endCallInternal();
        goBack();
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setMicMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleCam = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setCamMuted(!videoTrack.enabled);
            }
        }
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "var(--bg-void)", overflow: "hidden" }}>
            <style>{`
                @keyframes sonar-ring {
                    0% { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(2.4); opacity: 0; }
                }
                @keyframes sonar-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(232,33,58,0.5); }
                    50% { box-shadow: 0 0 0 20px rgba(232,33,58,0); }
                }
            `}</style>

            {/* Remote Video (Full Screen) */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    opacity: callActive ? 1 : 0,
                    transition: "opacity 0.5s", zIndex: 1,
                    backgroundColor: "#05050c"
                }}
            />

            {/* Local Video (Floating PIP) */}
            <video
                ref={localVideoRef}
                autoPlay playsInline muted
                style={{
                    position: "absolute", top: "calc(40px + var(--safe-top, 0px))", right: "16px",
                    width: "110px", height: "150px",
                    borderRadius: "16px", objectFit: "cover",
                    border: "2px solid rgba(0,229,255,0.4)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.8)", zIndex: 10,
                    transform: "scaleX(-1)"
                }}
            />

            {/* Calling / Connecting Overlay */}
            {!callActive && (
                <div style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    background: "linear-gradient(180deg, #06060f 0%, #0d0d1a 100%)", zIndex: 5,
                    padding: "20px"
                }}>
                    {status.startsWith("Error") ? (
                        <div style={{ width: "100%", maxWidth: "400px" }}>
                            <ErrorBanner message={status} />
                        </div>
                    ) : (
                        <>
                            {/* Sonar Animation */}
                            <div style={{ position: "relative", width: "120px", height: "120px", marginBottom: "32px" }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        position: "absolute", inset: 0, borderRadius: "50%",
                                        border: "2px solid rgba(232,33,58,0.4)",
                                        animation: `sonar-ring 2s ease-out ${i * 0.5}s infinite`
                                    }} />
                                ))}
                                <div style={{
                                    position: "absolute", inset: "10px", borderRadius: "50%",
                                    background: "linear-gradient(135deg, rgba(232,33,58,0.2) 0%, rgba(200,10,40,0.3) 100%)",
                                    border: "2px solid var(--accent-crimson)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    animation: "sonar-pulse 2s ease-in-out infinite"
                                }}>
                                    <span style={{ fontSize: "2.4rem", fontWeight: 900, color: "white" }}>
                                        {peerDisplayName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <h2 style={{ color: "#fff", fontSize: "1.4rem", fontWeight: 900, marginBottom: "10px", letterSpacing: "0.3px", textAlign: "center" }}>
                                {peerDisplayName}
                            </h2>
                            <p style={{
                                color: "var(--accent-cyan)", fontSize: "0.80rem",
                                fontFamily: "JetBrains Mono, monospace", fontWeight: 700,
                                letterSpacing: "2px", animation: "pulse 1.5s ease-in-out infinite",
                                textAlign: "center"
                            }}>
                                {status.toUpperCase()}
                            </p>
                        </>
                    )}
                </div>
            )}

            {/* Top Bar — E2E Badge & Duration */}
            <div style={{
                position: "absolute", top: "calc(16px + var(--safe-top, 0px))", left: "16px",
                zIndex: 20, display: "flex", alignItems: "center", gap: "8px",
                background: "rgba(10,10,20,0.85)", padding: "8px 16px",
                borderRadius: "var(--radius-full)", backdropFilter: "blur(16px)",
                border: "1px solid var(--glass-border)"
            }}>
                <span style={{ color: "var(--accent-emerald)", fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.5px" }}>🔒 E2E DTLS-SRTP</span>
                {callActive && (
                    <span style={{ color: "var(--accent-emerald)", fontSize: "0.80rem", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                        · {formatDuration(callDuration)}
                    </span>
                )}
            </div>

            {/* Floating Control Bar */}
            <div style={{
                position: "absolute", bottom: "calc(36px + var(--safe-bottom, 0px))", left: "50%",
                transform: "translateX(-50%)",
                display: "flex", gap: "20px", alignItems: "center",
                background: "rgba(10,14,24,0.92)",
                padding: "16px 32px", borderRadius: "var(--radius-full)",
                backdropFilter: "blur(24px)",
                boxShadow: "0 12px 48px rgba(0,0,0,0.85)",
                border: "1px solid var(--glass-border)", zIndex: 20
            }}>
                {/* Mute button */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <button
                        onClick={toggleMic}
                        style={{
                            width: "56px", height: "56px", borderRadius: "50%",
                            background: micMuted ? "rgba(255,51,85,0.85)" : "rgba(255,255,255,0.1)",
                            color: "white", fontSize: "1.4rem",
                            border: `2px solid ${micMuted ? "var(--accent-crimson)" : "rgba(255,255,255,0.2)"}`,
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s",
                            boxShadow: micMuted ? "0 4px 16px rgba(255,51,85,0.4)" : "none"
                        }}
                    >
                        {micMuted ? "🔇" : "🎤"}
                    </button>
                    <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                        {micMuted ? "Muteado" : "Mic"}
                    </span>
                </div>

                {/* Hang up — center, large */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <button
                        onClick={handleUserEndCall}
                        style={{
                            width: "72px", height: "72px", borderRadius: "50%",
                            background: "linear-gradient(135deg, #FF3355 0%, #C0152A 100%)",
                            color: "white", fontSize: "1.8rem",
                            border: "none",
                            boxShadow: "0 8px 28px rgba(232,33,58,0.6)",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            transform: "rotate(135deg)"
                        }}
                    >
                        📞
                    </button>
                    <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Colgar</span>
                </div>

                {/* Camera button */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <button
                        onClick={toggleCam}
                        style={{
                            width: "56px", height: "56px", borderRadius: "50%",
                            background: camMuted ? "rgba(255,51,85,0.85)" : "rgba(255,255,255,0.1)",
                            color: "white", fontSize: "1.4rem",
                            border: `2px solid ${camMuted ? "var(--accent-crimson)" : "rgba(255,255,255,0.2)"}`,
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s",
                            boxShadow: camMuted ? "0 4px 16px rgba(255,51,85,0.4)" : "none"
                        }}
                    >
                        {camMuted ? "🚫" : "📹"}
                    </button>
                    <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                        {camMuted ? "Sin cámara" : "Cámara"}
                    </span>
                </div>
            </div>
        </div>
    );
}
