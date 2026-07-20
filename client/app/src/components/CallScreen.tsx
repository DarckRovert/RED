"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

export default function CallScreen() {
    const { identity, activeConversationId, conversations, goBack } = useRedStore();
    const activeConv = conversations.find(c => c.id === activeConversationId);
    
    // Peer hash is required to send signaling messages
    const peerHash = activeConv ? activeConv.peer : (activeConversationId?.includes('-') ? activeConversationId.split('-')[1] : null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    
    const [status, setStatus] = useState("Iniciando capa P2P WebRTC...");
    const [callActive, setCallActive] = useState(false);
    const [micMuted, setMicMuted] = useState(false);
    const [camMuted, setCamMuted] = useState(false);
    
    const wsRef = useRef<WebSocket | null>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    // To construct deterministic room IDs between two peers without sorting algorithm:
    // We just use activeConversationId because the node normalizes it.

    useEffect(() => {
        if (!identity || !activeConversationId) return;
        
        const roomId = activeConversationId;
        const myPeerId = identity.short_id;
        
        setStatus("Iniciando capa P2P WebRTC...");

        // 1. Get Local Media
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                
                // 2. Setup Decentralized Signaling via SSE
                const url = window.location.hostname === 'localhost' || window.location.protocol === 'capacitor:' 
                    ? 'http://127.0.0.1:7333/api/events' 
                    : '/api/events';
                
                const sseSource = new EventSource(url, { withCredentials: false });

                // Start PeerConnection — STUN Dynamic Fallback para traversal en 4G/5G + LAN Direct
                const pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                });
                peerRef.current = pc;

                // Add local tracks
                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                // Handle remote track
                pc.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setCallActive(true);
                        setStatus("Conectado (E2E Encriptado)");
                    }
                };

                // Handle ICE candidates by sending them as P2P messages
                pc.onicecandidate = (event) => {
                    if (event.candidate && peerHash) {
                        RedAPI.sendMessage(peerHash, JSON.stringify({
                            candidate: event.candidate
                        }), { msg_type: "webrtc_signal" });
                    }
                };

                // Listen for signals over SSE EventStream
                sseSource.addEventListener("message", async (e: any) => {
                    try {
                        const data = JSON.parse(e.data);
                        // Is it from our peer?
                        if (data.from !== peerHash?.substring(0, 8) && data.from !== peerHash) return;
                        // Is it a WebRTC signal?
                        const msgItem = data.message_item;
                        if (!msgItem || msgItem.msg_type !== "webrtc_signal") return;

                        const signal = JSON.parse(msgItem.content);

                        if (signal.offer && peerHash) {
                            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            RedAPI.sendMessage(peerHash, JSON.stringify({ answer }), { msg_type: "webrtc_signal" });
                            setStatus("Conectando...");
                        } else if (signal.answer && peerHash) {
                            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                            setStatus("Conectando...");
                        } else if (signal.candidate) {
                            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                        }
                    } catch (err) {
                        // Ignore non-signal JSON
                    }
                });

                // Auto-Initiate Call (We are the 'caller' if we mount this first)
                setTimeout(async () => {
                    if (!peerHash) { setStatus("Error: peer desconocido"); return; }
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        RedAPI.sendMessage(peerHash, JSON.stringify({ offer }), { msg_type: "webrtc_signal" });
                        setStatus("Llamando (Esperando E2E)...");
                    } catch (e) {
                         setStatus("Error al crear oferta");
                    }
                }, 1000);

            })
            .catch(err => {
                setStatus("Acceso a micrófono/cámara denegado");
                console.error(err);
            });

        return () => {
            endCall();
        };
    }, [identity, activeConversationId, peerHash]);

    const endCall = () => {
        // Send hangup signal to peer before closing — so they know we hung up
        if (peerHash && peerRef.current) {
            RedAPI.sendMessage(peerHash, JSON.stringify({ hangup: true }), { msg_type: "webrtc_signal" }).catch(() => {});
        }
        if (peerRef.current) peerRef.current.close();
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
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
        <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
            
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
                    position: 'absolute', top: '40px', right: '20px', width: '120px', height: '160px', 
                    borderRadius: '12px', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 10,
                    transform: 'scaleX(-1)' // Mirror local cam
                }} 
            />

            {/* Status Overlay — shown while ringing / connecting */}
            {!callActive && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', zIndex: 5 }}>
                    <div className="pulsing-dot" style={{ width: '110px', height: '110px', borderRadius: '55px', background: 'var(--primary-subtle)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px', boxShadow: '0 0 48px var(--primary-glow)' }}>
                        <span style={{ fontSize: '3rem', fontWeight: 800, color: 'white' }}>{activeConv?.peer?.substring(0,1).toUpperCase() || 'P'}</span>
                    </div>
                    <h2 style={{ color: 'white', fontSize: '1.6rem', marginBottom: '12px', fontWeight: 800, letterSpacing: '0.5px' }}>{activeConv?.peer || 'Par Desconocido'}</h2>
                    <p style={{ color: 'var(--text-muted)', letterSpacing: '2px', fontSize: '0.85rem' }}>{status.toUpperCase()}</p>
                </div>
            )}

            {/* Top Bar — E2E Badge */}
            <div style={{ position: 'absolute', top: 'calc(16px + var(--safe-top, 0px))', left: '16px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px', backdropFilter: 'blur(16px)', border: '1px solid var(--solid-border)' }}>
                <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px' }}>🔒 E2E WebRTC</span>
            </div>

            {/* Floating Control Bar */}
            <div style={{ 
                position: 'absolute', bottom: 'calc(40px + var(--safe-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', 
                display: 'flex', gap: '20px', alignItems: 'center',
                background: 'rgba(10,10,14,0.85)', 
                padding: '20px 40px', borderRadius: '40px', backdropFilter: 'blur(24px)',
                boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px var(--solid-border)', zIndex: 20
            }}>
                <button 
                    onClick={toggleMic}
                    style={{ width: '60px', height: '60px', borderRadius: '30px', background: micMuted ? 'rgba(255,0,51,0.2)' : 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1.5rem', border: `1px solid ${micMuted ? 'var(--primary)' : 'var(--solid-border)'}`, transition: 'all 0.3s var(--ease-spring)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    {micMuted ? '🔇' : '🎤'}
                </button>
                <button 
                    onClick={endCall}
                    style={{ width: '72px', height: '72px', borderRadius: '36px', background: 'var(--danger)', color: 'white', fontSize: '2rem', border: 'none', boxShadow: '0 8px 24px var(--primary-glow)', cursor: 'pointer', transition: 'transform 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    📞
                </button>
                <button 
                    onClick={toggleCam}
                    style={{ width: '60px', height: '60px', borderRadius: '30px', background: camMuted ? 'rgba(255,0,51,0.2)' : 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1.5rem', border: `1px solid ${camMuted ? 'var(--primary)' : 'var(--solid-border)'}`, transition: 'all 0.3s var(--ease-spring)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    {camMuted ? '🚫' : '📹'}
                </button>
            </div>
        </div>
    );
}
