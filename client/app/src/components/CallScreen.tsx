"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRedStore } from "../store/useRedStore";

// Read from env for production deployments, fallback to localhost for dev.
// Set NEXT_PUBLIC_SIGNALING_URL=ws://YOUR_SERVER_IP:3001 in .env.local
const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL ?? "ws://127.0.0.1:3001";

export default function CallScreen() {
    const { identity, activeConversationId, conversations, goBack } = useRedStore();
    const activeConv = conversations.find(c => c.id === activeConversationId);
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    
    const [status, setStatus] = useState("Conectando al STUN/TURN...");
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
                
                // 2. Connect Signaling
                const ws = new WebSocket(SIGNALING_URL);
                wsRef.current = ws;

                ws.onopen = () => {
                    ws.send(JSON.stringify({ type: "register", peerId: myPeerId, roomId }));
                    setStatus("Esperando conexión E2E...");
                };

                ws.onmessage = async (event) => {
                    const msg = JSON.parse(event.data);
                    switch (msg.type) {
                        case "peer-joined":
                            // Start Call Request
                            ws.send(JSON.stringify({ type: "call-request", roomId, callType: "video", callerName: myPeerId }));
                            initiateCall(ws, roomId);
                            break;
                        case "call-request":
                            setStatus(`${msg.callerName} llamando...`);
                            acceptCall(ws, roomId);
                            break;
                        case "offer":
                            await handleOffer(msg.sdp, ws, roomId);
                            break;
                        case "answer":
                            await handleAnswer(msg.sdp);
                            break;
                        case "ice-candidate":
                            await handleCandidate(msg.candidate);
                            break;
                        case "peer-left":
                        case "hangup":
                            endCall();
                            break;
                    }
                };
            })
            .catch(err => {
                setStatus("Error: Sin permisos de hardware de Video/Audio");
                console.error(err);
            });

        return () => {
            endCall();
        };
    }, []);

    const createPeerConnection = (ws: WebSocket, roomId: string) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });

        localStreamRef.current?.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                ws.send(JSON.stringify({ type: "ice-candidate", roomId, candidate: event.candidate }));
            }
        };

        pc.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setCallActive(true);
                setStatus("");
            }
        };

        peerRef.current = pc;
        return pc;
    };

    const initiateCall = async (ws: WebSocket, roomId: string) => {
        const pc = createPeerConnection(ws, roomId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "offer", roomId, sdp: offer }));
    };

    const acceptCall = async (ws: WebSocket, roomId: string) => {
        // Signaling node already knows. Just wait for offer.
    };

    const handleOffer = async (sdp: RTCSessionDescriptionInit, ws: WebSocket, roomId: string) => {
        const pc = createPeerConnection(ws, roomId);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", roomId, sdp: answer }));
        setStatus("Conexión Cifrada Establecida.");
    };

    const handleAnswer = async (sdp: RTCSessionDescriptionInit) => {
        if (peerRef.current) {
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
            setStatus("Conexión Cifrada Establecida.");
        }
    };

    const handleCandidate = async (candidate: RTCIceCandidateInit) => {
        if (peerRef.current) {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
    };

    const endCall = () => {
        if (wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: "hangup", roomId: activeConversationId }));
            wsRef.current.close();
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

            {/* Status Overlay */}
            {!callActive && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', zIndex: 5 }}>
                    <div className="pulsing-dot" style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                        <span style={{ fontSize: '3rem' }}>{activeConv?.peer?.substring(0,1).toUpperCase() || 'P'}</span>
                    </div>
                    <h2 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '8px' }}>{activeConv?.peer}</h2>
                    <p style={{ color: 'var(--text-muted)' }}>{status}</p>
                </div>
            )}

            {/* Top Bar with RED Secure Logo */}
             <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <span style={{ color: '#2ecc71', fontSize: '0.8rem' }}>🔒 E2E WebRTC</span>
            </div>

            {/* Floating Control Bar */}
            <div style={{ 
                position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', 
                display: 'flex', gap: '24px', background: 'rgba(22, 32, 41, 0.8)', 
                padding: '16px 32px', borderRadius: '32px', backdropFilter: 'blur(16px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 20
            }}>
                <button 
                    onClick={toggleMic}
                    style={{ width: '56px', height: '56px', borderRadius: '28px', background: micMuted ? 'var(--solid-border)' : 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1.5rem', border: 'none', transition: '0.2s' }}
                >
                    {micMuted ? '🔇' : '🎙️'}
                </button>
                <button 
                    onClick={endCall}
                    style={{ width: '64px', height: '64px', borderRadius: '32px', background: 'var(--danger)', color: 'white', fontSize: '2rem', border: 'none', boxShadow: '0 4px 16px rgba(231, 76, 60, 0.5)' }}
                >
                    📞
                </button>
                <button 
                    onClick={toggleCam}
                    style={{ width: '56px', height: '56px', borderRadius: '28px', background: camMuted ? 'var(--solid-border)' : 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1.5rem', border: 'none', transition: '0.2s' }}
                >
                    {camMuted ? '🚫' : '📹'}
                </button>
            </div>
        </div>
    );
}
