import { useState, useEffect, useRef } from 'react';
import { RedAPI } from '../api';
import { useRedStore } from '../../store/useRedStore';

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
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
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
            { urls: 'stun:stun.cloudflare.com:3478' },
        ];

        pc = new RTCPeerConnection({
            iceServers: stunServers,
            iceCandidatePoolSize: 10,
        });

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                if (localStreamRef.current) {
                    const sender = pc!.addTrack(track, localStreamRef.current);
                    const transceiver = pc!.getTransceivers().find(t => t.sender === sender);
                    if (transceiver) {
                        transceiver.direction = 'sendrecv';
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

        peerConnectionsRef.current.set(targetPeerHash, pc);
        return pc;
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

    const handleIncomingSignal = async (senderHash: string, signal: any) => {
        try {
            if (signal.type === 'group_call_join') {
                // Incoming new peer joined room -> We initiate an offer to them
                const pc = getOrCreatePeerConnection(senderHash);
                const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                await pc.setLocalDescription(offer);
                sendSignalToPeer(senderHash, {
                    type: 'group_call_offer',
                    groupId,
                    senderHash: myIdentityHash,
                    offer,
                });
            } else if (signal.type === 'group_call_offer') {
                // Incoming offer from peer -> We respond with answer
                const pc = getOrCreatePeerConnection(senderHash);
                await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignalToPeer(senderHash, {
                    type: 'group_call_answer',
                    groupId,
                    senderHash: myIdentityHash,
                    answer,
                });
            } else if (signal.type === 'group_call_answer') {
                const pc = peerConnectionsRef.current.get(senderHash);
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                }
            } else if (signal.type === 'group_call_candidate') {
                const pc = peerConnectionsRef.current.get(senderHash);
                if (pc && signal.candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
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
        remoteStreamsRef.current.delete(peerHash);
        analysersRef.current.delete(peerHash);
        setPeers(prev => {
            const next = { ...prev };
            delete next[peerHash];
            return next;
        });
    };

    // ── 6. Controls ──────────────────────────────────────────────────────────
    const toggleMic = () => {
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
        if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
        }

        broadcastSignal({
            type: 'group_call_leave',
            groupId,
            senderHash: myIdentityHash,
            timestamp: Date.now(),
        });

        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
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
