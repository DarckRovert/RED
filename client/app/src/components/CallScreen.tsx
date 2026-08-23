"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { ErrorBanner } from "./ui/ErrorBanner";

import { CallRingtoneEngine } from "../lib/CallRingtoneEngine";
import { SettingsManager } from "../lib/settingsManager";
import { CallVideoGrid } from "./call/CallVideoGrid";
import { CallConnectingOverlay } from "./call/CallConnectingOverlay";
import { CallHeader } from "./call/CallHeader";
import { CallStatsModal } from "./call/CallStatsModal";
import { CallControls } from "./call/CallControls";

export default function CallScreen() {
    const {
        identity,
        activeConversationId,
        conversations,
        contacts,
        goBack,
        incomingCall,
        setIncomingCall,
        activeCallOffer,
        setActiveCallOffer,
        activeCallSignal,
        callSignalQueue,
        activeCallType,
        activeCallPeer,
        activeCallId,
        setActiveCallId,
        clearCallSignals,
        preferences,
        setCallPipMinimized
    } = useRedStore();

    // Ensure any leftover ringtone is immediately stopped
    useEffect(() => {
        CallRingtoneEngine.stop();
    }, []);

    const activeConv = conversations.find(c => c.id === activeConversationId || c.peer === activeConversationId);

    // 1. Resolve full 64-character peer DID hash (case-insensitive)
    const rawPeer = (activeCallPeer || activeConv?.peer || incomingCall?.callerHash || (
        activeConversationId && activeConversationId.length === 64 ? activeConversationId : (
            activeConversationId?.includes("-") ? activeConversationId.split("-")[1] : activeConversationId
        )
    ) || "").toLowerCase().trim();

    const peerContact = contacts.find((c: any) => {
        const contactHash = (c.identity_hash || "").toLowerCase();
        return (
            contactHash === rawPeer ||
            (rawPeer.length >= 8 && contactHash.startsWith(rawPeer.substring(0, 8))) ||
            (contactHash.length >= 8 && rawPeer.startsWith(contactHash.substring(0, 8)))
        );
    });

    const resolvedPeerHash = peerContact?.identity_hash || (rawPeer.length === 64 ? rawPeer : (
        conversations.find(c => {
            const cPeer = (c.peer || "").toLowerCase();
            return cPeer === rawPeer || (rawPeer.length >= 8 && cPeer.startsWith(rawPeer.substring(0, 8)));
        })?.peer || rawPeer
    ));

    // Immutable ref for target peer hash to avoid state tear-down during call transitions
    const targetPeerRef = useRef<string>(resolvedPeerHash);
    if (resolvedPeerHash && (!targetPeerRef.current || targetPeerRef.current.length < resolvedPeerHash.length)) {
        targetPeerRef.current = resolvedPeerHash;
    }

    const currentCallSessionId = activeCallId || incomingCall?.callId || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const callIdRef = useRef<string>(currentCallSessionId);
    if (activeCallId && callIdRef.current !== activeCallId) {
        callIdRef.current = activeCallId;
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
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);

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
    const callStartTimeRef = useRef<number>(Date.now());
    const initializedRef = useRef<boolean>(false);

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

    // Helper to unlock Web Audio & media playback on mobile user interaction
    const unlockAudioPlayback = useCallback(() => {
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume().catch(() => {});
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play().catch(() => {});
        }
        if (remoteVideoRef.current && !isAudioOnly) {
            remoteVideoRef.current.muted = false;
            remoteVideoRef.current.play().catch(() => {});
        }
    }, [isAudioOnly]);

    // ── Setup Web Audio API FFT Spectrum Visualizer for Voice Activity ────────
    const setupAudioVisualizer = useCallback((stream: MediaStream) => {
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;

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

            const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const renderWaveform = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / bufferLength;
                setVadLevel(avg);

                const canvas = waveformCanvasRef.current;
                if (canvas) {
                    const canvasCtx = canvas.getContext("2d");
                    if (canvasCtx) {
                        const width = canvas.width;
                        const height = canvas.height;
                        canvasCtx.clearRect(0, 0, width, height);

                        const barWidth = (width / bufferLength) * 1.8;
                        let x = 0;

                        for (let i = 0; i < bufferLength; i++) {
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

    // ── Robust Stream Re-attachment Synchronizer Hook ────────────────────────
    useEffect(() => {
        if (localStreamRef.current && localVideoRef.current && !isAudioOnly) {
            if (localVideoRef.current.srcObject !== localStreamRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
            }
            localVideoRef.current.muted = true;
            localVideoRef.current.play().catch(() => {});
        }
        if (remoteStreamRef.current) {
            if (remoteVideoRef.current && !isAudioOnly) {
                if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
                    remoteVideoRef.current.srcObject = remoteStreamRef.current;
                }
                remoteVideoRef.current.muted = false;
                remoteVideoRef.current.play().catch(e => {
                    console.warn("[CallScreen] Remote video play deferred until touch:", e);
                });
            }
            if (remoteAudioRef.current) {
                if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
                    remoteAudioRef.current.srcObject = remoteStreamRef.current;
                }
                remoteAudioRef.current.muted = false;
                remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.4;
                remoteAudioRef.current.play().catch(e => {
                    console.warn("[CallScreen] Remote audio play deferred until touch:", e);
                });
            }
        }
    }, [callActive, isAudioOnly, facingMode, camMuted, isSpeakerOn, localStream, hasRemoteVideo]);

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

    // ── WebRTC PeerConnection Initialization (Runs strictly once on mount) ────
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        const targetPeer = targetPeerRef.current;
        if (!identity || !targetPeer) return;
        let isSubscribed = true;

        // Clear any prior signal artifacts
        processedSignalsRef.current.clear();
        clearCallSignals();

        const initCall = async () => {
            const requestedAudioOnly = isAudioOnly;
            setStatus(`Solicitando acceso a ${requestedAudioOnly ? "micrófono" : "cámara y micrófono"}...`);
            try {
                // Adaptive media constraints
                const videoConstraints = SettingsManager.getVideoCallConstraints(preferences?.videoQuality, facingMode);
                const constraints: MediaStreamConstraints = requestedAudioOnly
                    ? {
                        audio: { echoCancellation: true, noiseSuppression: Boolean(preferences?.noiseSuppression ?? true), autoGainControl: true },
                        video: false
                    }
                    : {
                        audio: { echoCancellation: true, noiseSuppression: Boolean(preferences?.noiseSuppression ?? true), autoGainControl: true },
                        video: videoConstraints
                    };

                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (camErr) {
                    console.warn("[CallScreen] Tier 1 getUserMedia failed, attempting standard VGA fallback:", camErr);
                    try {
                        stream = await navigator.mediaDevices.getUserMedia(
                            requestedAudioOnly
                                ? { audio: true, video: false }
                                : { audio: true, video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } } }
                        );
                    } catch (tier2Err) {
                        console.warn("[CallScreen] Tier 2 fallback failed, attempting basic stream:", tier2Err);
                        try {
                            stream = await navigator.mediaDevices.getUserMedia(
                                requestedAudioOnly ? { audio: true, video: false } : { audio: true, video: true }
                            );
                        } catch (audioFallbackErr) {
                            console.warn("[CallScreen] Video completely failed, falling back to audio-only stream:", audioFallbackErr);
                            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                        }
                    }
                }
                if (!isSubscribed) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                localStreamRef.current = stream;
                setLocalStream(stream);

                // Attach to local video element (always muted locally to prevent echo feedback)
                if (!requestedAudioOnly && localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.muted = true;
                    localVideoRef.current.playsInline = true;
                    localVideoRef.current.play().catch(() => {});
                }

                // Connect local audio to visualizer
                setupAudioVisualizer(stream);

                // Setup STUN servers list with user custom STUN fallback
                const stunServers = [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                    { urls: "stun:stun2.l.google.com:19302" },
                    { urls: "stun:stun.cloudflare.com:3478" },
                    { urls: "stun:stun.nextcloud.com:443" }
                ];
                if (preferences?.customStunServer && preferences.customStunServer.startsWith("stun:")) {
                    stunServers.unshift({ urls: preferences.customStunServer.trim() });
                }

                // Create WebRTC Peer Connection
                const pc = new RTCPeerConnection({
                    iceServers: stunServers,
                    iceCandidatePoolSize: 10
                });
                peerRef.current = pc;

                // Explicitly add Transceivers to guarantee bi-directional sendrecv media negotiation
                pc.addTransceiver('audio', { direction: 'sendrecv' });
                if (!requestedAudioOnly) {
                    pc.addTransceiver('video', { direction: 'sendrecv' });
                }

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
                    if (streamToPlay.getVideoTracks().length > 0) {
                        setHasRemoteVideo(true);
                    }

                    // Attach to remote video
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = streamToPlay;
                        remoteVideoRef.current.muted = false;
                        remoteVideoRef.current.playsInline = true;
                        remoteVideoRef.current.play().catch(e => console.warn("[WebRTC Call] Remote video play deferred:", e));
                    }

                    // Attach to remote audio element for robust audio output
                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = streamToPlay;
                        remoteAudioRef.current.muted = false;
                        remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.4;
                        remoteAudioRef.current.play().catch(e => console.warn("[WebRTC Call] Remote audio play deferred:", e));
                    }

                    setCallActive(true);
                    setStatus("CONECTADO (E2E DTLS-SRTP)");
                };

                // Auto-reconnection on network switch or route changes (ICE Restart)
                pc.oniceconnectionstatechange = () => {
                    console.log("[WebRTC Call ICE State]", pc.iceConnectionState);
                    if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
                        setStatus("Reconectando malla (ICE Restart)...");
                        if (typeof pc.restartIce === "function") {
                            pc.restartIce();
                        }
                    } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                        setStatus("CONECTADO (E2E DTLS-SRTP)");
                    }
                };

                // Send ICE candidates via continuous P2P signaling
                pc.onicecandidate = (event) => {
                    if (event.candidate && targetPeer) {
                        RedAPI.sendMessage(targetPeer, JSON.stringify({
                            candidate: event.candidate,
                            callType: requestedAudioOnly ? "audio" : "video",
                            callId: callIdRef.current,
                            timestamp: Date.now()
                        }), { msg_type: "webrtc_signal" }).catch(() => {});
                    }
                };

                // Determine if we have an incoming offer (Callee Mode)
                const pendingOffer = activeCallOffer || incomingCall?.offer;

                // CALLEE MODE: Answering an incoming call offer
                if (pendingOffer) {
                    setStatus("Estableciendo enlace con interlocutor...");
                    await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));

                    // Flush any early received ICE candidates
                    await drainPendingCandidates(pc);

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    // Wait up to 600ms for candidate gathering before sending primary SDP
                    await gatherIceCandidates(pc, 600);

                    const finalAnswer = pc.localDescription || answer;
                    await RedAPI.sendMessage(targetPeer, JSON.stringify({
                        answer: finalAnswer,
                        callType: requestedAudioOnly ? "audio" : "video",
                        callId: callIdRef.current,
                        timestamp: Date.now()
                    }), { msg_type: "webrtc_signal" });
                    setCallActive(true);
                    setActiveCallOffer(null);
                }
                // CALLER MODE: Creating new call offer
                else {
                    setStatus("Llamando (Esperando respuesta E2E)...");
                    const offer = await pc.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: !requestedAudioOnly
                    });
                    await pc.setLocalDescription(offer);

                    // Wait up to 600ms for candidate gathering before sending primary SDP
                    await gatherIceCandidates(pc, 600);

                    const finalOffer = pc.localDescription || offer;
                    await RedAPI.sendMessage(targetPeer, JSON.stringify({
                        offer: finalOffer,
                        callType: requestedAudioOnly ? "audio" : "video",
                        callId: callIdRef.current,
                        timestamp: Date.now()
                    }), { msg_type: "webrtc_signal" });
                }

            } catch (err: any) {
                setStatus("Error: Permiso de hardware denegado o no disponible");
                console.error("[CallScreen] Media Error:", err);
            }
        };

        initCall();

        const heartbeatInterval = setInterval(() => {
            const target = targetPeerRef.current;
            if (target && isSubscribed && peerRef.current) {
                RedAPI.sendMessage(target, JSON.stringify({
                    type: 'call-heartbeat',
                    callId: callIdRef.current,
                    timestamp: Date.now()
                }), { msg_type: "webrtc_signal" }).catch(() => {});
            }
        }, 3000);

        return () => {
            isSubscribed = false;
            clearInterval(heartbeatInterval);
            endCallInternal();
        };
    }, []);

    // ── Process FIFO Signal Queue & Real-Time Incoming Signals ─────────────────
    useEffect(() => {
        const pc = peerRef.current;
        if (!pc) return;

        const handleQueue = async () => {
            const queue = callSignalQueue || [];
            const targetPeer = (targetPeerRef.current || "").toLowerCase();

            for (const item of queue) {
                const sHash = (item.senderHash || "").toLowerCase();

                // Only process signals for our target interlocutor
                if (targetPeer && sHash && sHash !== targetPeer && !targetPeer.startsWith(sHash.substring(0, 8)) && !sHash.startsWith(targetPeer.substring(0, 8))) {
                    continue;
                }

                const { signal } = item;
                if (!signal) continue;

                // Strict session callId validation
                if (signal.callId && callIdRef.current && signal.callId !== callIdRef.current) {
                    continue;
                }

                // Correct millisecond timestamp normalization
                const itemTs = (item.timestamp > 1e11 ? item.timestamp : (item.timestamp || 0) * 1000) || signal.timestamp || 0;
                if (itemTs > 0 && itemTs < callStartTimeRef.current - 3000) {
                    continue;
                }

                const signalId = `${sHash}_${JSON.stringify(signal).substring(0, 40)}_${itemTs}`;
                if (processedSignalsRef.current.has(signalId)) continue;

                try {
                    // Remote Answer
                    if (signal.answer) {
                        if (pc.signalingState === "have-local-offer") {
                            console.log("[WebRTC Call] Applying remote SDP answer");
                            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                            await drainPendingCandidates(pc);
                            setStatus("CONECTADO (E2E DTLS-SRTP)");
                            setCallActive(true);
                            processedSignalsRef.current.add(signalId);
                        } else if (pc.signalingState === "stable") {
                            processedSignalsRef.current.add(signalId);
                        }
                    }
                    // Remote ICE Candidate
                    else if (signal.candidate) {
                        if (pc.remoteDescription && pc.remoteDescription.type) {
                            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((e) => {
                                console.warn("[WebRTC Call] addIceCandidate failed:", e);
                            });
                            processedSignalsRef.current.add(signalId);
                        } else {
                            pendingCandidatesRef.current.push(signal.candidate);
                            processedSignalsRef.current.add(signalId);
                        }
                    }
                    // Remote Hangup
                    else if (signal.hangup) {
                        if (signal.callId && signal.callId !== callIdRef.current) {
                            continue;
                        }
                        if (itemTs > 0 && itemTs < callStartTimeRef.current - 1000) {
                            continue;
                        }
                        setStatus("Llamada Finalizada");
                        processedSignalsRef.current.add(signalId);
                        setTimeout(endCallInternal, 400);
                    }
                    // Remote In-Call Heartbeat Keepalive
                    else if (signal.type === 'call-heartbeat') {
                        processedSignalsRef.current.add(signalId);
                    }
                } catch (e) {
                    console.warn("[WebRTC Call] Queue signal processing warning:", e);
                }
            }
        };

        handleQueue();
    }, [callSignalQueue, activeCallSignal, status]);

    // ── Internal Cleanup Routine ─────────────────────────────────────────────
    const endCallInternal = () => {
        CallRingtoneEngine.stop();
        const targetPeer = targetPeerRef.current;
        if (targetPeer && peerRef.current) {
            RedAPI.sendMessage(targetPeer, JSON.stringify({
                hangup: true,
                callId: callIdRef.current,
                timestamp: Date.now()
            }), { msg_type: "webrtc_signal" }).catch(() => {});
        }
        if (peerRef.current) {
            try { peerRef.current.close(); } catch {}
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => {
                try { t.stop(); } catch {}
            });
            localStreamRef.current = null;
        }
        if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach(t => {
                try { t.stop(); } catch {}
            });
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
        setActiveCallId(null);
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
            remoteAudioRef.current.volume = nextSpeaker ? 1.0 : 0.4;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.volume = nextSpeaker ? 1.0 : 0.4;
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
        <div
            onClick={unlockAudioPlayback}
            onTouchStart={unlockAudioPlayback}
            style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#05070e", overflow: "hidden", userSelect: "none" }}
        >
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
                playsInline
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

            {/* Video Mode Video Grid */}
            <CallVideoGrid
                isAudioOnly={isAudioOnly}
                callActive={callActive}
                facingMode={facingMode}
                camMuted={camMuted}
                remoteVideoRef={remoteVideoRef}
                localVideoRef={localVideoRef}
            />

            {/* Audio-Only Mode Or Connecting Overlay */}
            <CallConnectingOverlay
                isAudioOnly={isAudioOnly}
                callActive={callActive}
                status={status}
                peerDisplayName={peerDisplayName}
                vadLevel={vadLevel}
                waveformCanvasRef={waveformCanvasRef}
            />

            {/* Top Tactical HUD Bar */}
            <CallHeader
                isAudioOnly={isAudioOnly}
                callActive={callActive}
                callDuration={callDuration}
                formatDuration={formatDuration}
                setCallPipMinimized={setCallPipMinimized}
                goBack={goBack}
                showStats={showStats}
                setShowStats={setShowStats}
                statsData={statsData}
            />

            {/* Live Telemetry Modal / Overlay */}
            {showStats && (
                <CallStatsModal
                    statsData={statsData}
                    isAudioOnly={isAudioOnly}
                />
            )}

            {/* Floating Tactical Control Bar */}
            <CallControls
                micMuted={micMuted}
                toggleMic={toggleMic}
                camMuted={camMuted}
                toggleCam={toggleCam}
                switchCamera={switchCamera}
                isAudioOnly={isAudioOnly}
                isSpeakerOn={isSpeakerOn}
                toggleSpeaker={toggleSpeaker}
                isScreenSharing={isScreenSharing}
                toggleScreenShare={toggleScreenShare}
                handleUserEndCall={handleUserEndCall}
            />
        </div>
    );
}
