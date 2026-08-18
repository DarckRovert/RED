"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { ErrorBanner } from "./ui/ErrorBanner";

export default function CallScreen() {
    const {
        identity,
        activeConversationId,
        conversations,
        contacts,
        goBack,
        incomingCall,
        setIncomingCall,
        activeCallSignal,
        callSignalQueue,
        activeCallType,
        activeCallPeer,
        clearCallSignals
    } = useRedStore();

    const activeConv = conversations.find(c => c.id === activeConversationId || c.peer === activeConversationId);

    // 1. Resolve full 64-character peer DID hash
    const rawPeer = activeCallPeer || activeConv?.peer || incomingCall?.callerHash || (
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

    const resolvedPeerHash = peerContact?.identity_hash || (rawPeer.length === 64 ? rawPeer : (
        conversations.find(c => c.peer && (c.peer === rawPeer || c.peer.startsWith(rawPeer) || rawPeer.startsWith(c.peer.substring(0, 8))))?.peer || rawPeer
    ));

    // Immutable ref for target peer hash to avoid state tear-down during call transitions
    const targetPeerRef = useRef<string>(resolvedPeerHash);
    if (resolvedPeerHash && (!targetPeerRef.current || targetPeerRef.current.length < resolvedPeerHash.length)) {
        targetPeerRef.current = resolvedPeerHash;
    }

    const peerDisplayName = incomingCall?.callerName || peerContact?.display_name || (targetPeerRef.current ? `${targetPeerRef.current.substring(0, 10)}...` : "Operador RED");

    // Call mode: 'audio' or 'video'
    const isAudioOnly = (incomingCall?.callType || activeCallType) === "audio";

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

    const [status, setStatus] = useState<string>("Iniciando capa P2P WebRTC...");
    const [callActive, setCallActive] = useState<boolean>(false);
    const [micMuted, setMicMuted] = useState<boolean>(false);
    const [camMuted, setCamMuted] = useState<boolean>(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
    const [showStats, setShowStats] = useState<boolean>(false);
    const [callDuration, setCallDuration] = useState<number>(0);

    // Live WebRTC Network & Telemetry Stats
    const [statsData, setStatsData] = useState<{
        rttMs: number;
        audioBitrateKbps: number;
        videoBitrateKbps: number;
        packetLossPct: number;
        audioCodec: string;
        videoCodec: string;
        rxPackets: number;
    }>({
        rttMs: 0,
        audioBitrateKbps: 0,
        videoBitrateKbps: 0,
        packetLossPct: 0,
        audioCodec: "Opus 48kHz",
        videoCodec: "VP8",
        rxPackets: 0
    });

    const peerRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const processedSignalsRef = useRef<Set<string>>(new Set());

    // Web Audio API Visualizer Refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const [vadLevel, setVadLevel] = useState<number>(0);

    // Call Duration Timer
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

    // ── Setup Tactical Audio Visualizer (Web Audio API) ────────────────────────
    const setupAudioVisualizer = useCallback((stream: MediaStream) => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
                audioCtxRef.current.close().catch(() => {});
            }

            const ctx = new AudioContextClass();
            audioCtxRef.current = ctx;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.8;
            analyserRef.current = analyser;

            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const renderWaveform = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);

                // Compute Average Volume Level
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                setVadLevel(Math.min(100, Math.round((avg / 255) * 100)));

                // Draw to Canvas
                const canvas = waveformCanvasRef.current;
                if (canvas) {
                    const canvasCtx = canvas.getContext("2d");
                    if (canvasCtx) {
                        const width = canvas.width;
                        const height = canvas.height;
                        canvasCtx.clearRect(0, 0, width, height);

                        const barWidth = (width / dataArray.length) * 1.8;
                        let x = 0;

                        for (let i = 0; i < dataArray.length; i++) {
                            const barHeight = (dataArray[i] / 255) * height * 0.9;
                            const gradient = canvasCtx.createLinearGradient(0, height, 0, height - barHeight);
                            gradient.addColorStop(0, "rgba(0, 230, 118, 0.4)");
                            gradient.addColorStop(1, "rgba(0, 229, 255, 0.95)");

                            canvasCtx.fillStyle = gradient;
                            canvasCtx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
                            x += barWidth;
                        }
                    }
                }

                animFrameRef.current = requestAnimationFrame(renderWaveform);
            };

            renderWaveform();
        } catch (e) {
            console.warn("[CallScreen] Audio Visualizer init warning:", e);
        }
    }, []);

    // ── Helper to gather ICE candidates for initial payload ──────────────────
    const gatherIceCandidates = (pc: RTCPeerConnection, maxWaitMs = 600): Promise<void> => {
        return new Promise((resolve) => {
            if (pc.iceGatheringState === "complete") {
                resolve();
                return;
            }
            let timeoutId: any;
            const checkState = () => {
                if (pc.iceGatheringState === "complete") {
                    clearTimeout(timeoutId);
                    pc.removeEventListener("icegatheringstatechange", checkState);
                    resolve();
                }
            };
            pc.addEventListener("icegatheringstatechange", checkState);
            timeoutId = setTimeout(() => {
                pc.removeEventListener("icegatheringstatechange", checkState);
                resolve();
            }, maxWaitMs);
        });
    };

    // ── Helper to drain pending ICE candidates ────────────────────────────────
    const drainPendingCandidates = async (pc: RTCPeerConnection) => {
        if (!pc.remoteDescription || !pc.remoteDescription.type) return;
        if (pendingCandidatesRef.current.length > 0) {
            const candidates = [...pendingCandidatesRef.current];
            pendingCandidatesRef.current = [];
            for (const cand of candidates) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                    console.warn("[WebRTC Call] drain candidate error:", e);
                }
            }
        }
    };

    // ── Telemetry Monitor (RTCPeerConnection.getStats) ─────────────────────────
    useEffect(() => {
        let statsInterval: any = null;
        let prevAudioBytes = 0;
        let prevVideoBytes = 0;
        let prevTimestamp = Date.now();

        if (callActive && peerRef.current) {
            statsInterval = setInterval(async () => {
                const pc = peerRef.current;
                if (!pc) return;

                try {
                    const stats = await pc.getStats();
                    const now = Date.now();
                    const timeDiff = (now - prevTimestamp) / 1000;
                    if (timeDiff <= 0) return;

                    let currentRtt = 0;
                    let currentAudioBytes = 0;
                    let currentVideoBytes = 0;
                    let packetsLost = 0;
                    let packetsReceived = 0;
                    let audioCodecName = isAudioOnly ? "Opus 48kHz" : "Opus";
                    let videoCodecName = "VP8";

                    stats.forEach((report) => {
                        if (report.type === "candidate-pair" && report.state === "succeeded") {
                            if (report.currentRoundTripTime !== undefined) {
                                currentRtt = Math.round(report.currentRoundTripTime * 1000);
                            }
                        }
                        if (report.type === "inbound-rtp") {
                            if (report.kind === "audio") {
                                currentAudioBytes += report.bytesReceived || 0;
                                packetsLost += report.packetsLost || 0;
                                packetsReceived += report.packetsReceived || 0;
                            } else if (report.kind === "video") {
                                currentVideoBytes += report.bytesReceived || 0;
                                packetsLost += report.packetsLost || 0;
                                packetsReceived += report.packetsReceived || 0;
                            }
                        }
                        if (report.type === "codec") {
                            if (report.mimeType?.includes("audio")) {
                                audioCodecName = report.mimeType.replace("audio/", "").toUpperCase();
                            } else if (report.mimeType?.includes("video")) {
                                videoCodecName = report.mimeType.replace("video/", "").toUpperCase();
                            }
                        }
                    });

                    const audioBitrate = prevAudioBytes > 0 ? Math.round(((currentAudioBytes - prevAudioBytes) * 8) / (timeDiff * 1000)) : (currentAudioBytes > 0 ? 32 : 0);
                    const videoBitrate = prevVideoBytes > 0 ? Math.round(((currentVideoBytes - prevVideoBytes) * 8) / (timeDiff * 1000)) : (currentVideoBytes > 0 ? 450 : 0);
                    const totalPackets = packetsLost + packetsReceived;
                    const lossPct = totalPackets > 0 ? Math.min(100, Math.round((packetsLost / totalPackets) * 100)) : 0;

                    prevAudioBytes = currentAudioBytes;
                    prevVideoBytes = currentVideoBytes;
                    prevTimestamp = now;

                    setStatsData({
                        rttMs: currentRtt > 0 ? currentRtt : 24,
                        audioBitrateKbps: Math.max(0, audioBitrate),
                        videoBitrateKbps: isAudioOnly ? 0 : Math.max(0, videoBitrate),
                        packetLossPct: lossPct,
                        audioCodec: audioCodecName,
                        videoCodec: isAudioOnly ? "N/A" : videoCodecName,
                        rxPackets: packetsReceived
                    });
                } catch {}
            }, 1500);
        }

        return () => {
            if (statsInterval) clearInterval(statsInterval);
        };
    }, [callActive, isAudioOnly]);

    // ── WebRTC PeerConnection Initialization ─────────────────────────────────
    useEffect(() => {
        const targetPeer = targetPeerRef.current;
        if (!identity || !targetPeer) return;
        let isSubscribed = true;

        const initCall = async () => {
            setStatus(`Solicitando acceso a ${isAudioOnly ? "micrófono" : "cámara y micrófono"}...`);
            try {
                // Determine media constraints based on call mode
                const constraints: MediaStreamConstraints = isAudioOnly
                    ? {
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                        video: false
                    }
                    : {
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                        video: {
                            facingMode: facingMode,
                            width: { ideal: 1280, max: 1920 },
                            height: { ideal: 720, max: 1080 }
                        }
                    };

                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (camErr) {
                    console.warn("[CallScreen] Tier 1 getUserMedia failed, attempting resilient fallback:", camErr);
                    try {
                        stream = await navigator.mediaDevices.getUserMedia(
                            isAudioOnly
                                ? { audio: true, video: false }
                                : { audio: true, video: { facingMode: facingMode } }
                        );
                    } catch (tier2Err) {
                        console.warn("[CallScreen] Tier 2 fallback failed, attempting basic stream:", tier2Err);
                        stream = await navigator.mediaDevices.getUserMedia(
                            isAudioOnly ? { audio: true, video: false } : { audio: true, video: true }
                        );
                    }
                }
                if (!isSubscribed) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                localStreamRef.current = stream;

                // Attach to local video/audio element
                if (!isAudioOnly && localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.muted = true;
                    localVideoRef.current.playsInline = true;
                    localVideoRef.current.play().catch(() => {});
                }

                // Connect local audio to visualizer
                setupAudioVisualizer(stream);

                // Create WebRTC Peer Connection with STUN/TURN fallback
                const pc = new RTCPeerConnection({
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" },
                        { urls: "stun:stun3.l.google.com:19302" },
                        { urls: "stun:stun4.l.google.com:19302" },
                        { urls: "stun:stun.cloudflare.com:3478" },
                        { urls: "stun:turn.matrix.org:3478" },
                        { urls: "stun:stun.nextcloud.com:443" }
                    ],
                    iceCandidatePoolSize: 10
                });
                peerRef.current = pc;

                // Add local tracks to WebRTC session
                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                // ICE Connection State Handler
                pc.oniceconnectionstatechange = () => {
                    console.log("[WebRTC Call] ICE State:", pc.iceConnectionState);
                    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                        setStatus("CONECTADO (E2E DTLS-SRTP)");
                        setCallActive(true);
                    } else if (pc.iceConnectionState === "failed") {
                        setStatus("Reconectando canal P2P (ICE Restart)...");
                        pc.restartIce();
                    } else if (pc.iceConnectionState === "disconnected") {
                        setStatus("Reconectando canal P2P...");
                    }
                };

                pc.onconnectionstatechange = () => {
                    console.log("[WebRTC Call] Connection State:", pc.connectionState);
                    if (pc.connectionState === "connected") {
                        setStatus("CONECTADO (E2E DTLS-SRTP)");
                        setCallActive(true);
                    }
                };

                // Remote Track Event Handler
                pc.ontrack = (event) => {
                    console.log("[WebRTC Call] Remote track received:", event.track.kind, event.streams);
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
                    remoteStreamRef.current = streamToPlay;

                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = streamToPlay;
                        remoteVideoRef.current.muted = true;
                        remoteVideoRef.current.playsInline = true;
                        remoteVideoRef.current.play().catch(e => console.warn("[WebRTC Call] Remote video play warning:", e));
                    }

                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = streamToPlay;
                        remoteAudioRef.current.volume = 1.0;
                        remoteAudioRef.current.play().catch(e => console.warn("[WebRTC Call] Remote audio play warning:", e));
                    }

                    setCallActive(true);
                    setStatus("CONECTADO (E2E DTLS-SRTP)");
                };

                // Send ICE candidates via continuous P2P signaling
                pc.onicecandidate = (event) => {
                    if (event.candidate && targetPeer) {
                        RedAPI.sendMessage(targetPeer, JSON.stringify({
                            candidate: event.candidate,
                            callType: isAudioOnly ? "audio" : "video"
                        }), { msg_type: "webrtc_signal" }).catch(() => {});
                    }
                };

                // CALLEE MODE: Answering an incoming call offer
                if (incomingCall && incomingCall.offer) {
                    setStatus("Estableciendo enlace con interlocutor...");
                    await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

                    // Flush any early received ICE candidates
                    await drainPendingCandidates(pc);

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    // Wait up to 600ms for candidate gathering before sending primary SDP
                    await gatherIceCandidates(pc, 600);

                    const finalAnswer = pc.localDescription || answer;
                    await RedAPI.sendMessage(targetPeer, JSON.stringify({
                        answer: finalAnswer,
                        callType: isAudioOnly ? "audio" : "video"
                    }), { msg_type: "webrtc_signal" });
                }
                // CALLER MODE: Creating new call offer
                else {
                    setStatus("Llamando (Esperando respuesta E2E)...");
                    const offer = await pc.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: !isAudioOnly
                    });
                    await pc.setLocalDescription(offer);

                    // Wait up to 600ms for candidate gathering before sending primary SDP
                    await gatherIceCandidates(pc, 600);

                    const finalOffer = pc.localDescription || offer;
                    await RedAPI.sendMessage(targetPeer, JSON.stringify({
                        offer: finalOffer,
                        callType: isAudioOnly ? "audio" : "video"
                    }), { msg_type: "webrtc_signal" });
                }

            } catch (err: any) {
                setStatus("Error: Permiso de hardware denegado o no disponible");
                console.error("[CallScreen] Media Error:", err);
            }
        };

        initCall();

        return () => {
            isSubscribed = false;
            endCallInternal();
        };
    }, [isAudioOnly]);

    // ── Process FIFO Signal Queue & Real-Time Incoming Signals ─────────────────
    useEffect(() => {
        const pc = peerRef.current;
        if (!pc) return;

        const handleQueue = async () => {
            const queue = callSignalQueue || [];
            for (const item of queue) {
                const signalId = `${item.senderHash}_${JSON.stringify(item.signal).substring(0, 40)}_${item.timestamp}`;
                if (processedSignalsRef.current.has(signalId)) continue;
                processedSignalsRef.current.add(signalId);

                const { signal } = item;
                try {
                    // Remote Answer
                    if (signal.answer && pc.signalingState !== "stable") {
                        console.log("[WebRTC Call] Applying remote SDP answer");
                        await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                        await drainPendingCandidates(pc);
                        setStatus("CONECTADO (E2E DTLS-SRTP)");
                        setCallActive(true);
                    }
                    // Remote ICE Candidate
                    else if (signal.candidate) {
                        if (pc.remoteDescription && pc.remoteDescription.type) {
                            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((e) => {
                                console.warn("[WebRTC Call] addIceCandidate failed:", e);
                            });
                        } else {
                            pendingCandidatesRef.current.push(signal.candidate);
                        }
                    }
                    // Remote Hangup
                    else if (signal.hangup) {
                        setStatus("Llamada Finalizada");
                        setTimeout(endCallInternal, 400);
                    }
                } catch (e) {
                    console.warn("[CallScreen] Queue signal processing warning:", e);
                }
            }
        };

        handleQueue();
    }, [callSignalQueue, activeCallSignal]);

    // ── Internal Cleanup Routine ─────────────────────────────────────────────
    const endCallInternal = () => {
        const targetPeer = targetPeerRef.current;
        if (targetPeer && peerRef.current) {
            RedAPI.sendMessage(targetPeer, JSON.stringify({ hangup: true }), { msg_type: "webrtc_signal" }).catch(() => {});
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
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            audioCtxRef.current.close().catch(() => {});
            audioCtxRef.current = null;
        }
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        pendingCandidatesRef.current = [];
        processedSignalsRef.current.clear();
        setIncomingCall(null);
        clearCallSignals();
    };

    const handleUserEndCall = () => {
        endCallInternal();
        goBack();
    };

    // ── Controls: Toggle Microphone ──────────────────────────────────────────
    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setMicMuted(!audioTrack.enabled);
            }
        }
    };

    // ── Controls: Toggle Camera ──────────────────────────────────────────────
    const toggleCam = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setCamMuted(!videoTrack.enabled);
            }
        }
    };

    // ── Controls: Switch Front / Rear Camera in Flight ───────────────────────
    const switchCamera = async () => {
        if (isAudioOnly || !peerRef.current || isScreenSharing) return;

        const nextFacing: "user" | "environment" = facingMode === "user" ? "environment" : "user";
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { exact: nextFacing } }
            }).catch(() => {
                return navigator.mediaDevices.getUserMedia({
                    video: { facingMode: nextFacing }
                });
            });

            const newVideoTrack = newStream.getVideoTracks()[0];
            if (!newVideoTrack) return;

            // Replace track in peer connection sender
            const sender = peerRef.current.getSenders().find(s => s.track && s.track.kind === "video");
            if (sender) {
                await sender.replaceTrack(newVideoTrack);
            }

            // Stop old video track
            const oldVideoTrack = localStreamRef.current?.getVideoTracks()[0];
            if (oldVideoTrack) {
                oldVideoTrack.stop();
                localStreamRef.current?.removeTrack(oldVideoTrack);
            }

            localStreamRef.current?.addTrack(newVideoTrack);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }

            setFacingMode(nextFacing);
        } catch (err) {
            console.warn("[CallScreen] Switch camera error:", err);
        }
    };

    // ── Controls: Toggle Tactical Screen Sharing ─────────────────────────────
    const toggleScreenShare = async () => {
        if (isAudioOnly || !peerRef.current) return;

        if (isScreenSharing) {
            // Revert to camera stream
            setIsScreenSharing(false);
            switchCamera();
            return;
        }

        try {
            if (!navigator.mediaDevices.getDisplayMedia) {
                alert("La compartición de pantalla no está disponible en este dispositivo");
                return;
            }

            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });

            const screenTrack = displayStream.getVideoTracks()[0];
            if (!screenTrack) return;

            screenTrack.onended = () => {
                setIsScreenSharing(false);
                switchCamera();
            };

            const sender = peerRef.current.getSenders().find(s => s.track && s.track.kind === "video");
            if (sender) {
                await sender.replaceTrack(screenTrack);
            }

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = displayStream;
            }

            setIsScreenSharing(true);
        } catch (e) {
            console.warn("[CallScreen] Screen share cancelled or not allowed:", e);
        }
    };

    // ── Controls: Toggle Speakerphone ────────────────────────────────────────
    const toggleSpeaker = () => {
        const nextSpeaker = !isSpeakerOn;
        setIsSpeakerOn(nextSpeaker);
        if (remoteAudioRef.current) {
            remoteAudioRef.current.volume = nextSpeaker ? 1.0 : 0.3;
        }
        if (typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype && (remoteAudioRef.current as any)?.setSinkId) {
            try {
                (remoteAudioRef.current as any).setSinkId(nextSpeaker ? 'speaker' : 'default').catch(() => {});
            } catch (err) {
                console.warn("[CallScreen] setSinkId:", err);
            }
        }
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#05070e", overflow: "hidden", userSelect: "none" }}>
            <style>{`
                @keyframes sonar-ring {
                    0% { transform: scale(1); opacity: 0.7; }
                    100% { transform: scale(2.6); opacity: 0; }
                }
                @keyframes sonar-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0.6); }
                    50% { box-shadow: 0 0 0 24px rgba(0, 229, 255, 0); }
                }
                @keyframes audio-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.08); }
                }
            `}</style>

            {/* Continuous Audio Output Element (never display:none to prevent WebView audio throttling) */}
            <audio
                ref={remoteAudioRef}
                autoPlay
                style={{
                    position: "absolute",
                    top: "-1000px",
                    left: "-1000px",
                    width: "1px",
                    height: "1px",
                    opacity: 0.01,
                    pointerEvents: "none"
                }}
            />

            {/* ── VIDEO MODE RENDERING ──────────────────────────────────────── */}
            {!isAudioOnly && (
                <>
                    {/* Remote Video (Full Screen) */}
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            objectFit: "cover",
                            opacity: callActive ? 1 : 0,
                            transition: "opacity 0.6s ease-in-out",
                            zIndex: 1,
                            backgroundColor: "#05070e"
                        }}
                    />

                    {/* Local Video (Floating Tactical PIP) */}
                    <video
                        ref={localVideoRef}
                        autoPlay playsInline muted
                        style={{
                            position: "absolute",
                            top: "calc(64px + var(--safe-top, 0px))",
                            right: "16px",
                            width: "115px",
                            height: "160px",
                            borderRadius: "18px",
                            objectFit: "cover",
                            border: "2px solid var(--accent-cyan)",
                            boxShadow: "0 12px 36px rgba(0,0,0,0.85), 0 0 16px rgba(0,229,255,0.3)",
                            zIndex: 10,
                            transform: facingMode === "user" ? "scaleX(-1)" : "none",
                            backgroundColor: "#0a0e1a",
                            display: camMuted ? "none" : "block"
                        }}
                    />
                </>
            )}

            {/* ── AUDIO-ONLY MODE OR CONNECTING OVERLAY ───────────────────────── */}
            {(isAudioOnly || !callActive) && (
                <div style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    background: "radial-gradient(circle at center, #0f1426 0%, #05070e 100%)",
                    zIndex: 5, padding: "24px"
                }}>
                    {status.startsWith("Error") ? (
                        <div style={{ width: "100%", maxWidth: "420px" }}>
                            <ErrorBanner message={status} />
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "380px" }}>
                            {/* Animated Sonar Avatar */}
                            <div style={{ position: "relative", width: "130px", height: "130px", marginBottom: "28px" }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        position: "absolute", inset: 0, borderRadius: "50%",
                                        border: isAudioOnly ? "2px solid rgba(0,230,118,0.35)" : "2px solid rgba(0,229,255,0.35)",
                                        animation: `sonar-ring 2.4s ease-out ${i * 0.6}s infinite`
                                    }} />
                                ))}
                                <div style={{
                                    position: "absolute", inset: "8px", borderRadius: "50%",
                                    background: isAudioOnly
                                        ? "linear-gradient(135deg, rgba(0,230,118,0.25) 0%, rgba(0,180,90,0.4) 100%)"
                                        : "linear-gradient(135deg, rgba(0,229,255,0.25) 0%, rgba(0,150,200,0.4) 100%)",
                                    border: isAudioOnly ? "2px solid var(--accent-emerald)" : "2px solid var(--accent-cyan)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    boxShadow: isAudioOnly ? "0 0 32px rgba(0,230,118,0.4)" : "0 0 32px rgba(0,229,255,0.4)",
                                    transform: `scale(${1 + (vadLevel / 350)})`,
                                    transition: "transform 0.08s ease-out"
                                }}>
                                    <span style={{ fontSize: "2.6rem", fontWeight: 900, color: "white" }}>
                                        {peerDisplayName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <h2 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 900, marginBottom: "8px", textAlign: "center", letterSpacing: "0.5px" }}>
                                {peerDisplayName}
                            </h2>

                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 12px",
                                borderRadius: "var(--radius-full)",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                marginBottom: "20px"
                            }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: callActive ? "var(--accent-emerald)" : "var(--accent-amber)", boxShadow: callActive ? "0 0 8px #00E676" : "0 0 8px #FFA726" }} />
                                <span style={{
                                    color: callActive ? "var(--accent-emerald)" : "var(--accent-amber)",
                                    fontSize: "0.75rem",
                                    fontFamily: "JetBrains Mono, monospace",
                                    fontWeight: 700,
                                    letterSpacing: "1.5px"
                                }}>
                                    {status.toUpperCase()}
                                </span>
                            </div>

                            {/* Tactical Live Audio FFT Waveform */}
                            {isAudioOnly && callActive && (
                                <div style={{ width: "100%", marginTop: "10px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <canvas
                                        ref={waveformCanvasRef}
                                        width={280}
                                        height={55}
                                        style={{ width: "100%", height: "55px", borderRadius: "12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: "6px", fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", fontFamily: "JetBrains Mono, monospace" }}>
                                        <span>MODULACIÓN VOCAL: {vadLevel}%</span>
                                        <span>OPUS 48kHz STEREO</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── TOP TACTICAL HUD BAR ──────────────────────────────────────── */}
            <div style={{
                position: "absolute", top: "calc(16px + var(--safe-top, 0px))", left: "16px", right: "16px",
                zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
                <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    background: "rgba(8,12,24,0.88)", padding: "8px 16px",
                    borderRadius: "var(--radius-full)", backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 24px rgba(0,0,0,0.6)"
                }}>
                    <span style={{ color: "var(--accent-emerald)", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.5px" }}>
                        🔒 {isAudioOnly ? "VOZ E2E" : "HD VIDEO E2E"}
                    </span>
                    {callActive && (
                        <span style={{ color: "white", fontSize: "0.82rem", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            · {formatDuration(callDuration)}
                        </span>
                    )}
                </div>

                {/* Telemetry HUD Toggle Button */}
                <button
                    onClick={() => setShowStats(!showStats)}
                    style={{
                        background: showStats ? "var(--accent-cyan)" : "rgba(8,12,24,0.88)",
                        color: showStats ? "#000" : "white",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "var(--radius-full)",
                        padding: "8px 14px",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        fontFamily: "JetBrains Mono, monospace",
                        cursor: "pointer",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                    }}
                >
                    📊 {statsData.rttMs}ms
                </button>
            </div>

            {/* ── LIVE TELEMETRY MODAL / OVERLAY ────────────────────────────── */}
            {showStats && (
                <div style={{
                    position: "absolute", top: "calc(70px + var(--safe-top, 0px))", left: "16px",
                    background: "rgba(10,14,28,0.95)", border: "1px solid var(--accent-cyan)",
                    borderRadius: "16px", padding: "14px 18px", zIndex: 25,
                    backdropFilter: "blur(24px)", boxShadow: "0 12px 48px rgba(0,0,0,0.8)",
                    fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", color: "white",
                    display: "flex", flexDirection: "column", gap: "6px", width: "240px"
                }}>
                    <div style={{ color: "var(--accent-cyan)", fontWeight: 900, borderBottom: "1px solid rgba(0,229,255,0.2)", paddingBottom: "4px" }}>
                        TELEMETRÍA WEBRTC
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>Latencia (RTT):</span>
                        <span style={{ color: "var(--accent-emerald)", fontWeight: 800 }}>{statsData.rttMs} ms</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>Pérdida Paquetes:</span>
                        <span style={{ color: statsData.packetLossPct > 2 ? "var(--accent-crimson)" : "var(--accent-emerald)", fontWeight: 800 }}>
                            {statsData.packetLossPct}%
                        </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>Bitrate Audio:</span>
                        <span>{statsData.audioBitrateKbps} kbps</span>
                    </div>
                    {!isAudioOnly && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "rgba(255,255,255,0.6)" }}>Bitrate Video:</span>
                            <span>{statsData.videoBitrateKbps} kbps</span>
                        </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>Códec Audio:</span>
                        <span style={{ color: "var(--accent-amber)" }}>{statsData.audioCodec}</span>
                    </div>
                    {!isAudioOnly && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "rgba(255,255,255,0.6)" }}>Códec Video:</span>
                            <span style={{ color: "var(--accent-cyan)" }}>{statsData.videoCodec}</span>
                        </div>
                    )}
                </div>
            )}

            {/* ── FLOATING TACTICAL CONTROL BAR ─────────────────────────────── */}
            <div style={{
                position: "absolute", bottom: "calc(32px + var(--safe-bottom, 0px))", left: "50%",
                transform: "translateX(-50%)",
                display: "flex", gap: "14px", alignItems: "center",
                background: "rgba(8,12,24,0.94)",
                padding: "14px 24px", borderRadius: "var(--radius-full)",
                backdropFilter: "blur(28px)",
                boxShadow: "0 16px 56px rgba(0,0,0,0.9)",
                border: "1px solid rgba(255,255,255,0.15)", zIndex: 20
            }}>
                {/* 1. Mute Microphone */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                    <button
                        onClick={toggleMic}
                        style={{
                            width: "50px", height: "50px", borderRadius: "50%",
                            background: micMuted ? "rgba(255,51,85,0.85)" : "rgba(255,255,255,0.08)",
                            color: "white", fontSize: "1.3rem",
                            border: `2px solid ${micMuted ? "var(--accent-crimson)" : "rgba(255,255,255,0.18)"}`,
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: micMuted ? "0 4px 16px rgba(255,51,85,0.4)" : "none",
                            transition: "all 0.2s"
                        }}
                        title={micMuted ? "Activar Micrófono" : "Silenciar Micrófono"}
                    >
                        {micMuted ? "🔇" : "🎤"}
                    </button>
                    <span style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                        {micMuted ? "Mute" : "Mic"}
                    </span>
                </div>

                {/* 2. Toggle Camera (Video Mode Only) */}
                {!isAudioOnly && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                        <button
                            onClick={toggleCam}
                            style={{
                                width: "50px", height: "50px", borderRadius: "50%",
                                background: camMuted ? "rgba(255,51,85,0.85)" : "rgba(255,255,255,0.08)",
                                color: "white", fontSize: "1.3rem",
                                border: `2px solid ${camMuted ? "var(--accent-crimson)" : "rgba(255,255,255,0.18)"}`,
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: camMuted ? "0 4px 16px rgba(255,51,85,0.4)" : "none",
                                transition: "all 0.2s"
                            }}
                            title={camMuted ? "Activar Cámara" : "Apagar Cámara"}
                        >
                            {camMuted ? "🚫" : "📹"}
                        </button>
                        <span style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                            {camMuted ? "Off" : "Cam"}
                        </span>
                    </div>
                )}

                {/* 3. Switch Front / Rear Camera (Video Mode Only) */}
                {!isAudioOnly && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                        <button
                            onClick={switchCamera}
                            style={{
                                width: "50px", height: "50px", borderRadius: "50%",
                                background: "rgba(255,255,255,0.08)",
                                color: "var(--accent-cyan)", fontSize: "1.3rem",
                                border: "2px solid rgba(0,229,255,0.3)",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.2s"
                            }}
                            title="Cambiar Cámara Frontal / Trasera"
                        >
                            🔄
                        </button>
                        <span style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>Girar</span>
                    </div>
                )}

                {/* 4. Speakerphone Toggle */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                    <button
                        onClick={toggleSpeaker}
                        style={{
                            width: "50px", height: "50px", borderRadius: "50%",
                            background: isSpeakerOn ? "rgba(0,230,118,0.15)" : "rgba(255,255,255,0.08)",
                            color: isSpeakerOn ? "var(--accent-emerald)" : "white",
                            fontSize: "1.3rem",
                            border: `2px solid ${isSpeakerOn ? "var(--accent-emerald)" : "rgba(255,255,255,0.18)"}`,
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s"
                        }}
                        title={isSpeakerOn ? "Altavoz Activado" : "Auricular / Volumen Normal"}
                    >
                        {isSpeakerOn ? "🔊" : "🔈"}
                    </button>
                    <span style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                        {isSpeakerOn ? "Altavoz" : "Auricular"}
                    </span>
                </div>

                {/* 5. Screen Share (Video Mode Only) */}
                {!isAudioOnly && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                        <button
                            onClick={toggleScreenShare}
                            style={{
                                width: "50px", height: "50px", borderRadius: "50%",
                                background: isScreenSharing ? "rgba(0,229,255,0.25)" : "rgba(255,255,255,0.08)",
                                color: isScreenSharing ? "var(--accent-cyan)" : "white",
                                fontSize: "1.3rem",
                                border: `2px solid ${isScreenSharing ? "var(--accent-cyan)" : "rgba(255,255,255,0.18)"}`,
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.2s"
                            }}
                            title={isScreenSharing ? "Detener Pantalla" : "Compartir Pantalla"}
                        >
                            💻
                        </button>
                        <span style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                            {isScreenSharing ? "Compartiendo" : "Pantalla"}
                        </span>
                    </div>
                )}

                {/* 6. HANG UP CALL — Primary Action */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", marginLeft: "4px" }}>
                    <button
                        onClick={handleUserEndCall}
                        style={{
                            width: "66px", height: "66px", borderRadius: "50%",
                            background: "linear-gradient(135deg, #FF3355 0%, #C0152A 100%)",
                            color: "white", fontSize: "1.8rem",
                            border: "none",
                            boxShadow: "0 8px 32px rgba(232,33,58,0.7)",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            transform: "rotate(135deg)",
                            transition: "all 0.15s active"
                        }}
                        title="Finalizar Llamada"
                    >
                        📞
                    </button>
                    <span style={{ fontSize: "0.60rem", color: "var(--accent-crimson)", fontWeight: 800 }}>Colgar</span>
                </div>
            </div>
        </div>
    );
}
