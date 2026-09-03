"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { ErrorBanner } from "./ui/ErrorBanner";

import { CallRingtoneEngine } from "../lib/CallRingtoneEngine";
import { callHistory } from "../lib/audio/CallHistoryEngine";
import { SettingsManager, type VideoCallQuality } from "../lib/settingsManager";

import { CallVideoGrid, VideoTacticalFilter } from "./call/CallVideoGrid";
import { CallConnectingOverlay } from "./call/CallConnectingOverlay";
import { CallHeader } from "./call/CallHeader";
import { CallStatsModal } from "./call/CallStatsModal";
import { CallControls } from "./call/CallControls";
import { SafetyNumberModal } from "./chat/SafetyNumberModal";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export default function CallScreen() {
    const { t } = useTranslation();
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

    const currentCallSessionId = activeCallId || incomingCall?.callId || (() => {
        const rand = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')
            : Date.now().toString(36);
        return `call_${Date.now()}_${rand}`;
    })();
    const callIdRef = useRef<string>(currentCallSessionId);
    if (activeCallId && callIdRef.current !== activeCallId) {
        callIdRef.current = activeCallId;
    }

    const peerDisplayName = incomingCall?.callerName || peerContact?.display_name || (targetPeerRef.current ? `${targetPeerRef.current.substring(0, 10)}...` : "Operador RED");

    // Dynamic call mode: can upgrade from audio to video in flight
    const [isAudioOnlyState, setIsAudioOnlyState] = useState<boolean>((incomingCall?.callType || activeCallType) === "audio");
    const isAudioOnly = isAudioOnlyState;

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

    const [status, setStatus] = useState<string>("Iniciando capa P2P WebRTC...");
    const [callActive, setCallActive] = useState<boolean>(false);
    const [micMuted, setMicMuted] = useState<boolean>(false);
    const [camMuted, setCamMuted] = useState<boolean>(isAudioOnly);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [isMirror, setIsMirror] = useState<boolean>(true);
    const [tacticalFilter, setTacticalFilter] = useState<VideoTacticalFilter>("normal");
    const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
    const [videoQuality, setVideoQuality] = useState<VideoCallQuality>((preferences?.videoQuality as any) || "sd480p");
    const [noiseSuppression, setNoiseSuppression] = useState<boolean>(Boolean(preferences?.noiseSuppression ?? true));
    const [showStats, setShowStats] = useState<boolean>(false);
    const [isSafetyModalOpen, setIsSafetyModalOpen] = useState<boolean>(false);
    const [callDuration, setCallDuration] = useState<number>(0);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);
    const [hasRemoteAudio, setHasRemoteAudio] = useState<boolean>(false);

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
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const [isDataChannelReady, setIsDataChannelReady] = useState<boolean>(false);
    const [isVocoderActive, setIsVocoderActive] = useState<boolean>(false);
    const localStreamRef = useRef<MediaStream | null>(null);
    // Persistent MediaStream reference (holds native WebRTC MediaStream to prevent decoder detachment)
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const processedSignalsRef = useRef<Set<string>>(new Set());
    const callStartTimeRef = useRef<number>(Date.now());
    const initializedRef = useRef<boolean>(false);

    // ── SDP Bitrate Throttling — Tactical Voice (16 kbps Opus Mono con in-band FEC) ──
    const applyTacticalSdpConstraints = (sdp: string): string => {
        return sdp
            .replace(
                /a=fmtp:111 ([^\r\n]*)/g,
                'a=fmtp:111 minptime=20;useinbandfec=1;maxaveragebitrate=16000;stereo=0;sprop-stereo=0'
            )
            .replace(
                /m=audio (\d+) ([^\r\n]*)/g,
                (match: string) => `${match}\r\nb=AS:20`
            );
    };

    // ── Configuración de Canal de Datos RTCDataChannel Out-of-Band ─────────────
    const setupDataChannel = (channel: RTCDataChannel) => {
        dataChannelRef.current = channel;
        channel.binaryType = "arraybuffer";

        channel.onopen = () => {
            console.log("[WebRTC Call] DataChannel táctico abierto (red-tactical-comms)");
            setIsDataChannelReady(true);
            try {
                channel.send(JSON.stringify({
                    type: "tactical-handshake",
                    sender: identity?.nickname || "Operador",
                    timestamp: Date.now()
                }));
            } catch {}
        };

        channel.onclose = () => {
            console.log("[WebRTC Call] DataChannel táctico cerrado");
            setIsDataChannelReady(false);
            dataChannelRef.current = null;
        };

        channel.onerror = (e) => {
            console.warn("[WebRTC Call] DataChannel táctico error:", e);
        };

        channel.onmessage = async (event) => {
            if (typeof event.data === "string") {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === "vocoder-toggle") {
                        setIsVocoderActive(!!msg.enabled);
                    }
                } catch {}
            } else if (event.data instanceof ArrayBuffer) {
                try {
                    const bytes = new Uint8Array(event.data);
                    if (bytes.length > 0 && (bytes[0] === 0x56 || bytes[0] === 0x58)) {
                        const { LowBitrateVocoder } = await import("../lib/audio/LowBitrateVocoder");
                        const { AudioContextManager } = await import("../lib/audio/AudioContextManager");
                        const ctx = AudioContextManager.getSharedContext();
                        if (ctx) {
                            const buffer = LowBitrateVocoder.createAudioBufferFromEncoded(ctx, bytes);
                            const source = ctx.createBufferSource();
                            source.buffer = buffer;
                            source.connect(ctx.destination);
                            source.start();
                        }
                    }
                } catch (e) {
                    console.warn("[WebRTC Call] Error decodificando frame vocoder:", e);
                }
            }
        };
    };

    // Web Audio API Visualizer Refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const [vadLevel, setVadLevel] = useState<number>(0);

    // Call Duration Timer (Clock synchronization based on absolute session start timestamp)
    useEffect(() => {
        let timer: any = null;
        if (callActive) {
            const updateDuration = () => {
                const elapsed = Math.max(0, Math.floor((Date.now() - callStartTimeRef.current) / 1000));
                setCallDuration(elapsed);
            };
            updateDuration();
            timer = setInterval(updateDuration, 1000);
        } else {
            setCallDuration(0);
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
            remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.35;
            remoteAudioRef.current.play().catch(() => {});
        }
        if (remoteVideoRef.current && !isAudioOnly) {
            remoteVideoRef.current.muted = true;
            remoteVideoRef.current.play().catch(() => {});
        }
    }, [isAudioOnly, isSpeakerOn]);

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
            localVideoRef.current.playsInline = true;
            localVideoRef.current.play().catch(() => {});
        }

        const currentRemoteStream = remoteStreamRef.current;
        if (currentRemoteStream) {
            if (remoteVideoRef.current && !isAudioOnly) {
                if (remoteVideoRef.current.srcObject !== currentRemoteStream) {
                    remoteVideoRef.current.srcObject = currentRemoteStream;
                }
                remoteVideoRef.current.muted = true;
                remoteVideoRef.current.playsInline = true;
                remoteVideoRef.current.play().catch(e => {
                    console.warn("[CallScreen] Remote video play deferred until touch:", e);
                });
            }
            if (remoteAudioRef.current) {
                if (remoteAudioRef.current.srcObject !== currentRemoteStream) {
                    remoteAudioRef.current.srcObject = currentRemoteStream;
                }
                remoteAudioRef.current.muted = false;
                remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.35;
                remoteAudioRef.current.play().catch(e => {
                    console.warn("[CallScreen] Remote audio play deferred until touch:", e);
                });
            }
        }
    }, [callActive, isAudioOnly, facingMode, camMuted, isSpeakerOn, localStream, hasRemoteVideo, hasRemoteAudio]);

    // ── Telemetry Monitor & Self-Healing QoS Watchdog ─────────────────────────
    useEffect(() => {
        let statsInterval: any = null;
        let prevAudioBytes = 0;
        let prevVideoBytes = 0;
        let prevTimestamp = Date.now();
        let stalledVideoTicks = 0;

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

                    // ── QoS Watchdog: Detect video pipeline stall & trigger auto-recovery ──
                    if (!isAudioOnly && callActive && currentVideoBytes > 0 && currentVideoBytes === prevVideoBytes) {
                        stalledVideoTicks++;
                        if (stalledVideoTicks >= 3) {
                            console.warn("[WebRTC QoS Watchdog] Video stall detected. Triggering self-healing recovery...");
                            stalledVideoTicks = 0;
                            // 1. Force IDR Keyframe on local video sender
                            const videoSender = pc.getSenders().find(s => s.track && s.track.kind === "video");
                            if (videoSender) {
                                try {
                                    const params = videoSender.getParameters();
                                    videoSender.setParameters(params).catch(() => {});
                                } catch {}
                            }
                            // 2. Restart ICE if connection state degraded
                            if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
                                if (typeof pc.restartIce === "function") pc.restartIce();
                            }
                        }
                    } else {
                        stalledVideoTicks = 0;
                    }

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
                const videoConstraints = SettingsManager.getVideoCallConstraints(videoQuality, facingMode);
                const constraints: MediaStreamConstraints = requestedAudioOnly
                    ? {
                        audio: { echoCancellation: true, noiseSuppression: noiseSuppression, autoGainControl: true },
                        video: false
                    }
                    : {
                        audio: { echoCancellation: true, noiseSuppression: noiseSuppression, autoGainControl: true },
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
                    { urls: "stun:stun.services.mozilla.com:443" },
                    { urls: "stun:stun.nextcloud.com:443" },
                    { urls: "stun:stun.sipgate.net:3478" }
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

                // Explicitly add local tracks to WebRTC session and ensure sendrecv media direction
                stream.getTracks().forEach(track => {
                    const sender = pc.addTrack(track, stream);
                    const transceiver = pc.getTransceivers().find(t => t.sender === sender);
                    if (transceiver) {
                        transceiver.direction = "sendrecv";
                    }
                });

                // Guarantee audio and video transceiver directions
                pc.getTransceivers().forEach(t => {
                    t.direction = "sendrecv";
                });

                // ICE Connection State Handler
                pc.oniceconnectionstatechange = () => {
                    console.log("[WebRTC Call] ICE State:", pc.iceConnectionState);
                    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                        setStatus("CONECTADO (E2E DTLS-SRTP)");
                        setCallActive(true);
                    } else if (pc.iceConnectionState === "failed") {
                        setStatus("Reconectando canal P2P (ICE Restart)...");
                        if (typeof pc.restartIce === "function") pc.restartIce();
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

                // Remote Track Event Handler — Direct Stream Binding & Non-destructive Aggregation
                pc.ontrack = (event) => {
                    console.log("[WebRTC Call] Remote track received:", event.track.kind, event.track.id);
                    const incomingStream = (event.streams && event.streams[0]) ? event.streams[0] : null;
                    if (incomingStream) {
                        remoteStreamRef.current = incomingStream;
                    } else if (!remoteStreamRef.current) {
                        remoteStreamRef.current = new MediaStream();
                    }

                    const streamToUse = remoteStreamRef.current;
                    if (!incomingStream && streamToUse) {
                        const existing = streamToUse.getTracks().find(t => t.id === event.track.id || t.kind === event.track.kind);
                        if (existing && existing.id !== event.track.id) {
                            streamToUse.removeTrack(existing);
                        }
                        if (!streamToUse.getTracks().some(t => t.id === event.track.id)) {
                            streamToUse.addTrack(event.track);
                        }
                    }

                    if (streamToUse) {
                        if (event.track.kind === "video") {
                            setHasRemoteVideo(true);
                            if (remoteVideoRef.current) {
                                if (remoteVideoRef.current.srcObject !== streamToUse) {
                                    remoteVideoRef.current.srcObject = streamToUse;
                                }
                                remoteVideoRef.current.muted = true;
                                remoteVideoRef.current.playsInline = true;
                                remoteVideoRef.current.play().catch(e => console.warn("[WebRTC Call] Remote video play deferred:", e));
                            }
                            event.track.onunmute = () => {
                                console.log("[WebRTC Call] Remote video track unmuted:", event.track.id);
                                if (remoteVideoRef.current) {
                                    if (remoteVideoRef.current.srcObject !== streamToUse) {
                                        remoteVideoRef.current.srcObject = streamToUse;
                                    }
                                    remoteVideoRef.current.play().catch(() => {});
                                }
                            };
                        } else if (event.track.kind === "audio") {
                            setHasRemoteAudio(true);
                            if (remoteAudioRef.current) {
                                if (remoteAudioRef.current.srcObject !== streamToUse) {
                                    remoteAudioRef.current.srcObject = streamToUse;
                                }
                                remoteAudioRef.current.muted = false;
                                remoteAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.35;
                                remoteAudioRef.current.play().catch(e => console.warn("[WebRTC Call] Remote audio play deferred:", e));
                            }
                            event.track.onunmute = () => {
                                console.log("[WebRTC Call] Remote audio track unmuted:", event.track.id);
                                if (remoteAudioRef.current) {
                                    if (remoteAudioRef.current.srcObject !== streamToUse) {
                                        remoteAudioRef.current.srcObject = streamToUse;
                                    }
                                    remoteAudioRef.current.play().catch(() => {});
                                }
                            };
                        }
                    }

                    setCallActive(true);
                    setStatus("CONECTADO (E2E DTLS-SRTP)");
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

                // Receiver listens for incoming DataChannel
                pc.ondatachannel = (event) => {
                    setupDataChannel(event.channel);
                };

                // Determine if we have an incoming offer (Callee Mode)
                const pendingOffer = activeCallOffer || incomingCall?.offer;
                const incomingStartedAt = (incomingCall as any)?.startedAt || (pendingOffer as any)?.startedAt;
                if (incomingStartedAt) {
                    callStartTimeRef.current = incomingStartedAt;
                }

                // CALLEE MODE: Answering an incoming call offer
                if (pendingOffer) {
                    setStatus("Estableciendo enlace con interlocutor...");
                    await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));

                    // Flush any early received ICE candidates
                    await drainPendingCandidates(pc);

                    const rawAnswer = await pc.createAnswer();
                    const tacticalAnswerSdp = applyTacticalSdpConstraints(rawAnswer.sdp || "");
                    const answer = new RTCSessionDescription({ type: rawAnswer.type, sdp: tacticalAnswerSdp });
                    await pc.setLocalDescription(answer);

                    // Wait up to 600ms for candidate gathering before sending primary SDP
                    await gatherIceCandidates(pc, 600);

                    const finalAnswer = pc.localDescription || answer;
                    await RedAPI.sendMessage(targetPeer, JSON.stringify({
                        answer: finalAnswer,
                        callType: requestedAudioOnly ? "audio" : "video",
                        callId: callIdRef.current,
                        startedAt: callStartTimeRef.current,
                        timestamp: Date.now()
                    }), { msg_type: "webrtc_signal" });
                    setCallActive(true);
                    setActiveCallOffer(null);
                }
                // CALLER MODE: Creating new call offer
                else {
                    setStatus("Llamando (Esperando respuesta E2E)...");
                    const sessionStartTime = Date.now();
                    callStartTimeRef.current = sessionStartTime;

                    // Caller initiates out-of-band RTCDataChannel
                    try {
                        const dc = pc.createDataChannel("red-tactical-comms", {
                            ordered: true,
                            maxRetransmits: 3
                        });
                        setupDataChannel(dc);
                    } catch (dcErr) {
                        console.warn("[WebRTC Call] DataChannel create error:", dcErr);
                    }

                    const rawOffer = await pc.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: !requestedAudioOnly
                    });
                    const tacticalOfferSdp = applyTacticalSdpConstraints(rawOffer.sdp || "");
                    const offer = new RTCSessionDescription({ type: rawOffer.type, sdp: tacticalOfferSdp });
                    await pc.setLocalDescription(offer);

                    // Wait up to 600ms for candidate gathering before sending primary SDP
                    await gatherIceCandidates(pc, 600);

                    const finalOffer = pc.localDescription || offer;
                    await RedAPI.sendMessage(targetPeer, JSON.stringify({
                        offer: finalOffer,
                        callType: requestedAudioOnly ? "audio" : "video",
                        callId: callIdRef.current,
                        startedAt: sessionStartTime,
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
                    type: "call-heartbeat",
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

                // Correct millisecond timestamp normalization with robust 60s signaling setup tolerance
                const itemTs = (item.timestamp > 1e11 ? item.timestamp : (item.timestamp || 0) * 1000) || signal.timestamp || 0;
                if (itemTs > 0 && itemTs < callStartTimeRef.current - 60000) {
                    continue;
                }

                const signalId = `${sHash}_${JSON.stringify(signal).substring(0, 40)}_${itemTs}`;
                if (processedSignalsRef.current.has(signalId)) continue;

                try {
                    // Remote Answer
                    if (signal.answer) {
                        if (signal.startedAt) {
                            callStartTimeRef.current = signal.startedAt;
                        }
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
                    else if (signal.type === "call-heartbeat") {
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
        if (targetPeer) {
            try {
                callHistory.addRecord({
                    peerHash: targetPeer,
                    peerName: peerDisplayName,
                    direction: incomingCall ? "INCOMING" : "OUTGOING",
                    callType: isAudioOnly ? "audio" : "video",
                    timestamp: Date.now() - (callDuration * 1000),
                    durationSeconds: callDuration,
                });
            } catch (e) {
                console.warn("[CallScreen] Failed to save call record:", e);
            }
        }
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
        if (dataChannelRef.current) {
            try { dataChannelRef.current.close(); } catch {}
            dataChannelRef.current = null;
            setIsDataChannelReady(false);
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
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            try { audioCtxRef.current.close(); } catch {}
            audioCtxRef.current = null;
        }
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        setIncomingCall(null);
        setActiveCallOffer(null);
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

    // ── Controls: Toggle Camera (Supports in-flight upgrade from audio to video) ──
    const toggleCam = async () => {
        const stream = localStreamRef.current;
        if (!stream) return;

        let videoTrack = stream.getVideoTracks()[0];

        // If camera is currently OFF or in audio-only mode: turn camera ON
        if (camMuted || isAudioOnly || !videoTrack) {
            try {
                if (!videoTrack) {
                    const constraints = SettingsManager.getVideoCallConstraints(videoQuality, facingMode);
                    const videoStream = await navigator.mediaDevices.getUserMedia({ video: constraints }).catch(() => {
                        return navigator.mediaDevices.getUserMedia({ video: true });
                    });
                    const newTrack = videoStream.getVideoTracks()[0];
                    if (!newTrack) return;
                    stream.addTrack(newTrack);
                    videoTrack = newTrack;

                    // Add/Replace track in WebRTC session
                    if (peerRef.current) {
                        const sender = peerRef.current.getSenders().find(s => s.track && s.track.kind === "video");
                        if (sender) {
                            await sender.replaceTrack(newTrack);
                        } else {
                            peerRef.current.addTrack(newTrack, stream);
                        }
                    }
                } else {
                    videoTrack.enabled = true;
                }

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.play().catch(() => {});
                }

                setCamMuted(false);
                setIsAudioOnlyState(false);
            } catch (e) {
                console.warn("[CallScreen] Failed to turn on camera:", e);
            }
        } else {
            // Camera is currently ON: turn camera OFF (mute video track)
            videoTrack.enabled = false;
            setCamMuted(true);
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

    // ── Controls: Video Quality Changer in Flight ─────────────────────────────
    const handleVideoQualityChange = async (quality: VideoCallQuality) => {
        setVideoQuality(quality);
        if (!localStreamRef.current || isAudioOnly || camMuted) return;
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
            try {
                const constraints = SettingsManager.getVideoCallConstraints(quality, facingMode);
                await videoTrack.applyConstraints(typeof constraints === "object" ? constraints : {});
            } catch (e) {
                console.warn("[CallScreen] applyConstraints video quality error:", e);
            }
        }
    };

    // ── Controls: Toggle Noise Suppression Filter ────────────────────────────
    const handleToggleNoiseSuppression = async () => {
        const nextVal = !noiseSuppression;
        setNoiseSuppression(nextVal);
        if (!localStreamRef.current) return;
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
            try {
                await audioTrack.applyConstraints({
                    echoCancellation: true,
                    noiseSuppression: nextVal,
                    autoGainControl: true
                });
            } catch (e) {
                console.warn("[CallScreen] applyConstraints audio error:", e);
            }
        }
    };

    // ── Controls: Toggle Tactical Low-Bitrate Vocoder Mode ──────────────────
    const toggleVocoderMode = () => {
        const nextState = !isVocoderActive;
        setIsVocoderActive(nextState);
        if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
            try {
                dataChannelRef.current.send(JSON.stringify({
                    type: "vocoder-toggle",
                    enabled: nextState
                }));
            } catch {}
        }
        toast.info(nextState ? "📻 Modo Vocoder 16 kbps FEC activado" : "🎙️ Audio estándar reactivado");
    };

    // ── Controls: Toggle Mirror Mode ────────────────────────────────────────
    const toggleMirror = () => {
        setIsMirror(m => !m);
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
                toast.warning("La compartición de pantalla no está disponible en este dispositivo");
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
            remoteAudioRef.current.volume = nextSpeaker ? 1.0 : 0.35;
        }
        if (typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype && (remoteAudioRef.current as any)?.setSinkId) {
            try {
                (remoteAudioRef.current as any).setSinkId(nextSpeaker ? "speaker" : "default").catch(() => {});
            } catch (err) {
                console.warn("[CallScreen] setSinkId:", err);
            }
        }
    };

    // ── Controls: Cycle Tactical Camera Filters ────────────────────────────
    const cycleTacticalFilter = () => {
        const filters: VideoTacticalFilter[] = ["normal", "night_vision", "flir_thermal", "surveillance_crt"];
        setTacticalFilter(curr => {
            const nextIdx = (filters.indexOf(curr) + 1) % filters.length;
            const next = filters[nextIdx];
            const labels: Record<VideoTacticalFilter, string> = {
                normal: "Normal (Natural)",
                night_vision: "Visión Nocturna Fósforo Verde (NVG)",
                flir_thermal: "Filtro Térmico FLIR Simulado",
                surveillance_crt: "Monitoreo CCTV / CRT Táctico"
            };
            toast.info(`👁️ Filtro de Video: ${labels[next]}`);
            return next;
        });
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
                hasRemoteVideo={hasRemoteVideo}
                facingMode={facingMode}
                camMuted={camMuted}
                isMirror={isMirror}
                tacticalFilter={tacticalFilter}
                remoteVideoRef={remoteVideoRef}
                localVideoRef={localVideoRef}
            />

            {/* Audio-Only Mode Or Connecting Overlay */}
            <CallConnectingOverlay
                isAudioOnly={isAudioOnly}
                callActive={callActive}
                hasRemoteVideo={hasRemoteVideo}
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
                isSpeakerOn={isSpeakerOn}
                toggleSpeaker={toggleSpeaker}
                videoQuality={videoQuality}
                setVideoQuality={handleVideoQualityChange}
                noiseSuppression={noiseSuppression}
                toggleNoiseSuppression={handleToggleNoiseSuppression}
                isMirror={isMirror}
                toggleMirror={toggleMirror}
                onOpenSafetyModal={() => setIsSafetyModalOpen(true)}
                isDataChannelReady={isDataChannelReady}
                isVocoderActive={isVocoderActive}
                toggleVocoderMode={toggleVocoderMode}
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
                tacticalFilter={tacticalFilter}
                onCycleFilter={cycleTacticalFilter}
            />

            {/* In-Call Safety Number Verification Modal */}
            {isSafetyModalOpen && (
                <SafetyNumberModal
                    peerHash={targetPeerRef.current || resolvedPeerHash || ""}
                    peerName={peerDisplayName}
                    peerPublicKey={peerContact?.public_key || null}
                    onClose={() => setIsSafetyModalOpen(false)}
                />
            )}
        </div>
    );
}
