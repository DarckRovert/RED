import { useState, useEffect, useRef } from 'react';
import { RedAPI } from '../api';
import { useRedStore } from '../../store/useRedStore';
import { AudioContextManager } from '../audio/AudioContextManager';

export interface SquadPeerState {
    peerHash: string;
    displayName?: string;
    stream: MediaStream | null;
    isMuted: boolean;
    hasVideo: boolean;
    isSpeaking: boolean;
    connectionState: string;
}

export interface UseSquadCallMeshOptions {
    groupId: string;
    groupName: string;
    memberHashes: string[];
    callType: 'audio' | 'video';
    myIdentityHash: string;
}

export function useSquadCallMesh({
    groupId,
    groupName,
    memberHashes,
    callType,
    myIdentityHash,
}: UseSquadCallMeshOptions) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Record<string, SquadPeerState>>({});
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCamOff, setIsCamOff] = useState(callType === 'audio');
    const [isDeafened, setIsDeafened] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [statusText, setStatusText] = useState('Inicializando Malla de Escuadrón...');

    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
    const vadIntervalRef = useRef<any>(null);
    const squadDataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

    const { callSignalQueue } = useRedStore();
    const processedSignalsRef = useRef<Set<string>>(new Set());

    // ── 1. Setup Local Media Stream ───────────────────────────────────────────
    useEffect(() => {
        let isSubscribed = true;

        async function initLocalStream() {
            try {
                const constraints: MediaStreamConstraints = {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: callType === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } : false,
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (!isSubscribed) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                localStreamRef.current = stream;
                setLocalStream(stream);
                setStatusText('CONECTADO A SALA DE ESCUADRÓN (Full-Mesh E2E)');

                // Broadcast join signal to all group members
                broadcastSignal({
                    type: 'group_call_join',
                    groupId,
                    senderHash: myIdentityHash,
                    callType,
                    timestamp: Date.now(),
                });

                // Start Voice Activity Detection (VAD)
                setupVAD();
            } catch (err: any) {
                console.error('[SquadVoiceMesh] Media Error:', err);
                setStatusText('Error: Permiso de hardware denegado o no disponible');
            }
        }

        initLocalStream();

        return () => {
            isSubscribed = false;
            cleanupAll();
        };
    }, [groupId, callType]);

    // ── 2. VAD (Voice Activity Detection) ────────────────────────────────────
    const setupVAD = () => {
        if (typeof window === 'undefined') return;
        try {
            const ctx = AudioContextManager.acquireDedicatedContext('squad_call_vad');
            if (!ctx) return;
            audioContextRef.current = ctx;

            if (localStreamRef.current) {
                const audioTracks = localStreamRef.current.getAudioTracks();
                if (audioTracks.length > 0) {
                    const source = ctx.createMediaStreamSource(localStreamRef.current);
                    const analyser = ctx.createAnalyser();
                    analyser.fftSize = 256;
                    source.connect(analyser);
                    analysersRef.current.set(myIdentityHash, analyser);
                }
            }

            vadIntervalRef.current = setInterval(() => {
                const dataArray = new Uint8Array(128);
                analysersRef.current.forEach((analyser, hash) => {
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length;
                    const speaking = average > 25; // threshold

                    // Broadcast VAD to squad peers via RTCDataChannel for <5ms out-of-band delivery
                    if (hash === myIdentityHash) {
                        squadDataChannelsRef.current.forEach((dc) => {
                            if (dc.readyState === 'open') {
                                try {
                                    dc.send(JSON.stringify({ type: 'vad-speaking', isSpeaking: speaking }));
                                } catch {}
                            }
                        });
                    }

                    setPeers(prev => {
                        if (hash === myIdentityHash) return prev;
                        if (!prev[hash]) return prev;
                        if (prev[hash].isSpeaking === speaking) return prev;
                        return {
                            ...prev,
                            [hash]: { ...prev[hash], isSpeaking: speaking }
                        };
                    });
                });
            }, 120);
        } catch (e) {
            console.warn('[SquadVoiceMesh] VAD Setup Error:', e);
        }
    };

    // ── 3. Broadcast Signal Helper ───────────────────────────────────────────
    const broadcastSignal = (payload: any) => {
        const payloadStr = JSON.stringify(payload);
        const targetList = memberHashes.filter(h => h !== myIdentityHash);
        targetList.forEach(peerHash => {
            RedAPI.sendMessage(peerHash, payloadStr, { msg_type: 'webrtc_signal' }).catch(() => {});
        });
    };

    const sendSignalToPeer = (peerHash: string, payload: any) => {
        RedAPI.sendMessage(peerHash, JSON.stringify(payload), { msg_type: 'webrtc_signal' }).catch(() => {});
    };

    // ── 4. WebRTC Connection Creator ─────────────────────────────────────────
    const getOrCreatePeerConnection = (targetPeerHash: string): RTCPeerConnection => {
        let pc = peerConnectionsRef.current.get(targetPeerHash);
        if (pc) return pc;

        const stunServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.services.mozilla.com:443' },
            { urls: 'stun:stun.nextcloud.com:443' },
            { urls: 'stun:stun.sipgate.net:3478' }
        ];

        pc = new RTCPeerConnection({
            iceServers: stunServers,
            iceCandidatePoolSize: 10,
        });

        // Add local tracks with deduplication (replaceTrack on existing senders)
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                if (localStreamRef.current) {
                    const senders = pc!.getSenders();
                    const existingSender = senders.find(s => s.track && s.track.kind === track.kind);
                    if (existingSender) {
                        existingSender.replaceTrack(track).catch(() => {});
                    } else {
                        const sender = pc!.addTrack(track, localStreamRef.current);
                        const transceiver = pc!.getTransceivers().find(t => t.sender === sender);
                        if (transceiver) {
                            transceiver.direction = 'sendrecv';
                        }
                    }
                }
            });
        }

        // Handle remote tracks
        pc.ontrack = (event) => {
            console.log('[SquadVoiceMesh] Remote track from:', targetPeerHash, event.track.kind);
            let stream = remoteStreamsRef.current.get(targetPeerHash);
            if (!stream) {
                stream = new MediaStream();
                remoteStreamsRef.current.set(targetPeerHash, stream);
            }
            stream.addTrack(event.track);

            // Add audio track to VAD if audio
            if (event.track.kind === 'audio' && audioContextRef.current) {
                try {
                    const source = audioContextRef.current.createMediaStreamSource(stream);
                    const analyser = audioContextRef.current.createAnalyser();
                    analyser.fftSize = 256;
                    source.connect(analyser);
                    analysersRef.current.set(targetPeerHash, analyser);
                } catch {}
            }

            setPeers(prev => ({
                ...prev,
                [targetPeerHash]: {
                    peerHash: targetPeerHash,
                    stream,
                    isMuted: false,
                    hasVideo: stream.getVideoTracks().length > 0,
                    isSpeaking: false,
                    connectionState: pc?.connectionState || 'connected',
                }
            }));
        };

        // ICE candidate handler
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignalToPeer(targetPeerHash, {
                    type: 'group_call_candidate',
                    groupId,
                    senderHash: myIdentityHash,
                    candidate: event.candidate,
                });
            }
        };

        pc.onconnectionstatechange = () => {
            const state = pc?.connectionState || 'disconnected';
            setPeers(prev => {
                if (!prev[targetPeerHash]) return prev;
                return {
                    ...prev,
                    [targetPeerHash]: { ...prev[targetPeerHash], connectionState: state }
                };
            });
        };

        pc.oniceconnectionstatechange = () => {
            const iceState = pc?.iceConnectionState;
            if (iceState === 'failed' || iceState === 'disconnected') {
                console.warn(`[SquadVoiceMesh] ICE ${iceState} para ${targetPeerHash.slice(0, 8)} — ejecutando ICE restart`);
                try {
                    pc.restartIce();
                } catch {}
            }
        };

        // Out-of-Band Tactical RTCDataChannel (<5ms latency)
        try {
            const dc = pc.createDataChannel('red-squad-data', {
                ordered: true,
                maxRetransmits: 3
            });
            setupSquadDataChannel(targetPeerHash, dc);
        } catch {}

        pc.ondatachannel = (event) => {
            setupSquadDataChannel(targetPeerHash, event.channel);
        };

        peerConnectionsRef.current.set(targetPeerHash, pc);
        return pc;
    };

    const setupSquadDataChannel = (peerHash: string, channel: RTCDataChannel) => {
        squadDataChannelsRef.current.set(peerHash, channel);
        channel.binaryType = 'arraybuffer';

        channel.onopen = () => {
            console.log(`[SquadVoiceMesh] DataChannel abierto con ${peerHash.slice(0, 8)}`);
        };

        channel.onclose = () => {
            squadDataChannelsRef.current.delete(peerHash);
        };

        channel.onmessage = (event) => {
            if (typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'vad-speaking') {
                        setPeers(prev => {
                            if (!prev[peerHash]) return prev;
                            if (prev[peerHash].isSpeaking === msg.isSpeaking) return prev;
                            return {
                                ...prev,
                                [peerHash]: { ...prev[peerHash], isSpeaking: msg.isSpeaking }
                            };
                        });
                    }
                } catch {}
            }
        };
    };

    // ── 4. SDP Bitrate Throttling — Tactical Voice (16 kbps Opus Mono) ────────
    /**
     * Applies tactical audio SDP constraints to limit Opus to 16 kbps mono voice mode.
     * Injected into every Offer and Answer before setLocalDescription().
     * Reduces per-peer audio bandwidth by ~65% (from 32-64 kbps to 16 kbps),
     * preventing audio dropouts in squad calls over Wi-Fi Direct ad-hoc networks.
     *
     * Reference SDP lines injected:
     *   a=fmtp:111 minptime=20;useinbandfec=1;maxaveragebitrate=16000;stereo=0;sprop-stereo=0
     *   b=AS:20  (session-level 20 kbps aggregate cap)
     */
    const applyTacticalSdpConstraints = (sdp: string): string => {
        return sdp
            // Constrain Opus (payload type 111) to mono voice at 16 kbps with FEC
            .replace(
                /a=fmtp:111 ([^\r\n]*)/g,
                'a=fmtp:111 minptime=20;useinbandfec=1;maxaveragebitrate=16000;stereo=0;sprop-stereo=0'
            )
            // Add session-level bandwidth cap (20 kbps) for the audio m-line
            .replace(
                /m=audio (\d+) ([^\r\n]*)/g,
                (match: string) => `${match}\r\nb=AS:20`
            );
    };

    // ── 5. Process Incoming Signaling FIFO Queue ─────────────────────────────
    useEffect(() => {
        if (!callSignalQueue || callSignalQueue.length === 0) return;

        callSignalQueue.forEach(item => {
            const sigId = `${item.senderHash}_${item.timestamp}`;
            if (processedSignalsRef.current.has(sigId)) return;
            processedSignalsRef.current.add(sigId);

            let parsed: any = null;
            try {
                parsed = typeof item.signal === 'string' ? JSON.parse(item.signal) : item.signal;
            } catch {
                return;
            }

            if (!parsed || parsed.groupId !== groupId) return;
            const senderHash = item.senderHash || parsed.senderHash;
            if (!senderHash || senderHash === myIdentityHash) return;

            handleIncomingSignal(senderHash, parsed);
        });
    }, [callSignalQueue, groupId, myIdentityHash]);

    // ── Helper to drain pending ICE candidates once remoteDescription is set ───
    const drainPendingCandidates = async (peerHash: string, pc: RTCPeerConnection) => {
        const pending = pendingCandidatesRef.current.get(peerHash);
        if (!pending || pending.length === 0) return;
        const candidates = [...pending];
        pendingCandidatesRef.current.set(peerHash, []);
        for (const cand of candidates) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
                console.warn('[SquadVoiceMesh] Error aplicando candidato ICE en cola:', err);
            }
        }
    };

    const handleIncomingSignal = async (senderHash: string, signal: any) => {
        try {
            if (signal.type === 'group_call_join') {
                // Incoming peer joined room -> Initiate an offer to negotiate full-mesh E2E connection
                const pc = getOrCreatePeerConnection(senderHash);
                const rawOffer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                // Apply tactical voice SDP constraints before sending
                const tacticalOffer = new RTCSessionDescription({
                    type: rawOffer.type,
                    sdp: applyTacticalSdpConstraints(rawOffer.sdp || ''),
                });
                await pc.setLocalDescription(tacticalOffer);
                sendSignalToPeer(senderHash, {
                    type: 'group_call_offer',
                    groupId,
                    senderHash: myIdentityHash,
                    offer: tacticalOffer,
                });
            } else if (signal.type === 'group_call_offer') {
                const pc = getOrCreatePeerConnection(senderHash);

                // Perfect Negotiation (RFC 8829): Glare resolution with polite rollback
                const isPolite = myIdentityHash.localeCompare(senderHash) < 0;
                const offerCollision = pc.signalingState !== 'stable';

                if (offerCollision) {
                    if (!isPolite) {
                        // Impolite peer rejects/discards the incoming colliding offer; our own offer takes precedence
                        console.log(`[SquadVoiceMesh] Glare detectado con ${senderHash.slice(0, 8)}: peer impolite mantiene oferta local`);
                        return;
                    }
                    // Polite peer yields: roll back local offer to accept remote offer
                    console.log(`[SquadVoiceMesh] Glare detectado con ${senderHash.slice(0, 8)}: peer polite ejecuta rollback`);
                    try {
                        await pc.setLocalDescription({ type: 'rollback' });
                    } catch (rbErr) {
                        console.warn('[SquadVoiceMesh] Rollback error:', rbErr);
                    }
                }

                await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
                await drainPendingCandidates(senderHash, pc);

                const rawAnswer = await pc.createAnswer();
                // Apply tactical voice SDP constraints before sending
                const tacticalAnswer = new RTCSessionDescription({
                    type: rawAnswer.type,
                    sdp: applyTacticalSdpConstraints(rawAnswer.sdp || ''),
                });
                await pc.setLocalDescription(tacticalAnswer);
                sendSignalToPeer(senderHash, {
                    type: 'group_call_answer',
                    groupId,
                    senderHash: myIdentityHash,
                    answer: tacticalAnswer,
                });
            } else if (signal.type === 'group_call_answer') {
                const pc = peerConnectionsRef.current.get(senderHash);
                if (pc && pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                    await drainPendingCandidates(senderHash, pc);
                }
            } else if (signal.type === 'group_call_candidate') {
                if (!signal.candidate) return;
                const pc = peerConnectionsRef.current.get(senderHash);
                if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
                    // Remote description not ready yet: buffer candidate
                    if (!pendingCandidatesRef.current.has(senderHash)) {
                        pendingCandidatesRef.current.set(senderHash, []);
                    }
                    pendingCandidatesRef.current.get(senderHash)!.push(signal.candidate);
                } else {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((e) => {
                        console.warn('[SquadVoiceMesh] addIceCandidate error:', e);
                    });
                }
            } else if (signal.type === 'group_call_leave') {
                closePeer(senderHash);
            }
        } catch (err) {
            console.warn('[SquadVoiceMesh] Signal handling error:', err);
        }
    };

    const closePeer = (peerHash: string) => {
        const pc = peerConnectionsRef.current.get(peerHash);
        if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(peerHash);
        }
        const dc = squadDataChannelsRef.current.get(peerHash);
        if (dc) {
            try { dc.close(); } catch {}
            squadDataChannelsRef.current.delete(peerHash);
        }
        pendingCandidatesRef.current.delete(peerHash);
        const stream = remoteStreamsRef.current.get(peerHash);
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
        }
        remoteStreamsRef.current.delete(peerHash);
        analysersRef.current.delete(peerHash);
        setPeers(prev => {
            const next = { ...prev };
            delete next[peerHash];
            return next;
        });
    };

    // ── 6. Controls ──────────────────────────────────────────────────────────
    const resumeAudio = async () => {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            try {
                await audioContextRef.current.resume();
            } catch (e) {
                console.warn('[SquadVoiceMesh] Error reanudando AudioContext:', e);
            }
        }
    };

    const toggleMic = () => {
        resumeAudio();
        if (!localStreamRef.current) return;
        const nextState = !isMicMuted;
        localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = !nextState;
        });
        setIsMicMuted(nextState);
    };

    const toggleCam = () => {
        if (!localStreamRef.current) return;
        const nextState = !isCamOff;
        localStreamRef.current.getVideoTracks().forEach(track => {
            track.enabled = !nextState;
        });
        setIsCamOff(nextState);
    };

    const toggleDeafen = () => {
        resumeAudio();
        const nextState = !isDeafened;
        setIsDeafened(nextState);
    };

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            // Revert back to camera
            try {
                const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newVideoTrack = camStream.getVideoTracks()[0];
                replaceVideoTrack(newVideoTrack);
                setIsScreenSharing(false);
            } catch (e) {
                console.warn('[SquadVoiceMesh] Revert video error:', e);
            }
        } else {
            try {
                const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];
                screenTrack.onended = () => {
                    setIsScreenSharing(false);
                };
                replaceVideoTrack(screenTrack);
                setIsScreenSharing(true);
            } catch (e) {
                console.warn('[SquadVoiceMesh] Screen share error:', e);
            }
        }
    };

    const replaceVideoTrack = (newTrack: MediaStreamTrack) => {
        if (!localStreamRef.current) return;
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
        }
        localStreamRef.current.addTrack(newTrack);

        peerConnectionsRef.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                sender.replaceTrack(newTrack);
            } else {
                pc.addTrack(newTrack, localStreamRef.current!);
            }
        });
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    };

    const cleanupAll = () => {
        if (vadIntervalRef.current) {
            clearInterval(vadIntervalRef.current);
            vadIntervalRef.current = null;
        }
        if (audioContextRef.current) {
            AudioContextManager.releaseDedicatedContext('squad_call_vad').catch(() => {});
            audioContextRef.current = null;
        }

        broadcastSignal({
            type: 'group_call_leave',
            groupId,
            senderHash: myIdentityHash,
            timestamp: Date.now(),
        });

        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
        squadDataChannelsRef.current.forEach(dc => { try { dc.close(); } catch {} });
        squadDataChannelsRef.current.clear();
        pendingCandidatesRef.current.clear();
        remoteStreamsRef.current.forEach(stream => {
            stream.getTracks().forEach(t => t.stop());
        });
        remoteStreamsRef.current.clear();
        analysersRef.current.clear();

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
    };

    const leaveRoom = () => {
        cleanupAll();
    };

    return {
        localStream,
        peers,
        isMicMuted,
        isCamOff,
        isDeafened,
        isScreenSharing,
        statusText,
        toggleMic,
        toggleCam,
        toggleDeafen,
        toggleScreenShare,
        leaveRoom,
    };
}
