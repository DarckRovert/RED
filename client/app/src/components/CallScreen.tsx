"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

export default function CallScreen() {
    const { identity, activeConversationId, conversations, goBack, incomingCall, setIncomingCall, activeCallSignal } = useRedStore();
    const activeConv = conversations.find(c => c.id === activeConversationId);
    
    // Peer identity hash for signaling
    const peerHash = activeConv ? activeConv.peer : (activeConversationId?.includes('-') ? activeConversationId.split('-')[1] : activeConversationId);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    
    const [status, setStatus] = useState("Iniciando capa P2P WebRTC...");
    const [callActive, setCallActive] = useState(false);
    const [micMuted, setMicMuted] = useState(false);
    const [camMuted, setCamMuted] = useState(false);
    
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    // 1. Initialize WebRTC Call
    useEffect(() => {
        if (!identity || !peerHash) return;
        let isSubscribed = true;

        const initCall = async () => {
            setStatus("Solicitando cámara y micrófono...");
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (!isSubscribed) return;
                
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                
                // STUN servers for local LAN + WAN Traversal
                const pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                });
                peerRef.current = pc;

                // Add local tracks to WebRTC session
                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                // Handle incoming remote media stream
                pc.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setCallActive(true);
                        setStatus("CONECTADO (E2E ENCRIPTADO)");
                    }
                };

                // Send ICE candidates via P2P signaling
                pc.onicecandidate = (event) => {
                    if (event.candidate && peerHash) {
                        RedAPI.sendMessage(peerHash, JSON.stringify({
                            candidate: event.candidate
                        }), { msg_type: "webrtc_signal" }).catch(() => {});
                    }
                };

                // CALLEE MODE: If answering an incoming call offer
                if (incomingCall && incomingCall.offer) {
                    setStatus("Conectando con interlocutor...");
                    await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
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

            } catch (err) {
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

    // 2. React to Incoming Signals from Store Subscription
    useEffect(() => {
        if (!activeCallSignal || !peerRef.current) return;
        const { senderHash, signal } = activeCallSignal;

        const handleSignal = async () => {
            const pc = peerRef.current;
            if (!pc) return;

            try {
                if (signal.answer && pc.signalingState !== "stable") {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                    setStatus("Conexión E2E Establecida");
                } else if (signal.candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
                } else if (signal.hangup) {
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
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
            
            {/* Remote Video (Full Screen) */}
            <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: callActive ? 1 : 0, transition: 'opacity 0.5s' }} 
            />
            
            {/* Local Video (Floating PIP) */}
            <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted
                style={{ 
                    position: 'absolute', top: 'calc(40px + var(--safe-top, 0px))', right: '20px', width: '120px', height: '160px', 
                    borderRadius: '16px', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.25)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 10,
                    transform: 'scaleX(-1)'
                }} 
            />

            {/* Status Overlay — shown while ringing / connecting */}
            {!callActive && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#080810', zIndex: 5 }}>
                    <div style={{ width: '110px', height: '110px', borderRadius: '55px', background: 'rgba(232,33,58,0.15)', border: '2px solid #E8213A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px', boxShadow: '0 0 48px rgba(232,33,58,0.4)', animation: 'pulse 1.5s infinite' }}>
                        <span style={{ fontSize: '3rem', fontWeight: 800, color: 'white' }}>{peerHash?.substring(0,1).toUpperCase() || 'P'}</span>
                    </div>
                    <h2 style={{ color: 'white', fontSize: '1.4rem', marginBottom: '12px', fontWeight: 800 }}>{activeConv?.peer || `Nodo ${peerHash?.substring(0, 10)}`}</h2>
                    <p style={{ color: '#94a3b8', letterSpacing: '1px', fontSize: '0.82rem', fontWeight: 700 }}>{status.toUpperCase()}</p>
                </div>
            )}

            {/* Top Bar — E2E Badge */}
            <div style={{ position: 'absolute', top: 'calc(16px + var(--safe-top, 0px))', left: '16px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.7)', padding: '8px 16px', borderRadius: '20px', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <span style={{ color: '#00D97E', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '1px' }}>🔒 E2E WEBRTC CIFRADO</span>
            </div>

            {/* Floating Control Bar */}
            <div style={{ 
                position: 'absolute', bottom: 'calc(40px + var(--safe-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', 
                display: 'flex', gap: '20px', alignItems: 'center',
                background: 'rgba(10,15,28,0.9)', 
                padding: '16px 36px', borderRadius: '40px', backdropFilter: 'blur(24px)',
                boxShadow: '0 12px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.12)', zIndex: 20
            }}>
                <button 
                    onClick={toggleMic}
                    style={{ width: '56px', height: '56px', borderRadius: '28px', background: micMuted ? 'rgba(232,33,58,0.3)' : 'rgba(255,255,255,0.12)', color: 'white', fontSize: '1.4rem', border: `1px solid ${micMuted ? '#E8213A' : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    {micMuted ? '🔇' : '🎤'}
                </button>
                <button 
                    onClick={handleUserEndCall}
                    style={{ width: '68px', height: '68px', borderRadius: '34px', background: '#E8213A', color: 'white', fontSize: '1.8rem', border: 'none', boxShadow: '0 8px 24px rgba(232,33,58,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    📞
                </button>
                <button 
                    onClick={toggleCam}
                    style={{ width: '56px', height: '56px', borderRadius: '28px', background: camMuted ? 'rgba(232,33,58,0.3)' : 'rgba(255,255,255,0.12)', color: 'white', fontSize: '1.4rem', border: `1px solid ${camMuted ? '#E8213A' : 'rgba(255,255,255,0.2)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    {camMuted ? '🚫' : '📹'}
                </button>
            </div>
        </div>
    );
}
