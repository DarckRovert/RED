import React, { useEffect, useRef } from 'react';
import { useSquadCallMesh } from '../../lib/mesh/useSquadCallMesh';
import { useRedStore } from '../../store/useRedStore';

interface SquadVoiceRoomProps {
    groupId: string;
    groupName: string;
    memberHashes: string[];
    callType: 'audio' | 'video';
    onClose: () => void;
}

export const SquadVoiceRoom: React.FC<SquadVoiceRoomProps> = ({
    groupId,
    groupName,
    memberHashes,
    callType,
    onClose,
}) => {
    const { identity, contacts } = useRedStore();
    const myIdentityHash = identity?.identity_hash || 'local_user';
    const myNickname = identity?.nickname || 'Tú';

    const {
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
    } = useSquadCallMesh({
        groupId,
        groupName,
        memberHashes,
        callType,
        myIdentityHash,
    });

    const localVideoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.muted = true;
            localVideoRef.current.play().catch(() => {});
        }
    }, [localStream, isCamOff]);

    const getDisplayName = (hash: string) => {
        if (hash === myIdentityHash) return `${myNickname} (Tú)`;
        const contact = contacts?.find(c => c.identity_hash === hash || c.identity_hash.startsWith(hash.slice(0, 8)));
        if (contact?.display_name) return contact.display_name;
        return `Operador ${hash.substring(0, 6)}`;
    };

    const handleDisconnect = () => {
        leaveRoom();
        onClose();
    };

    const peerList = Object.values(peers);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'linear-gradient(135deg, #070913 0%, #030408 100%)',
            display: 'flex', flexDirection: 'column', color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif', userSelect: 'none'
        }}>
            {/* ── Header ────────────────────────────────────────────────── */}
            <header style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(10, 14, 26, 0.8)', backdropFilter: 'blur(20px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '12px',
                        background: 'linear-gradient(135deg, #00E5FF, #00E676)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem', fontWeight: 900, color: '#000'
                    }}>
                        🎙️
                    </div>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{groupName}</span>
                            <span className="badge-tactical badge-tactical-cyan" style={{ fontSize: '0.65rem' }}>
                                SQUAD MESH E2E
                            </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontFamily: 'JetBrains Mono, monospace' }}>
                            ● {statusText}
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleDisconnect}
                    style={{
                        background: 'rgba(255, 82, 82, 0.2)', border: '1px solid rgba(255, 82, 82, 0.5)',
                        color: '#FF5252', padding: '8px 16px', borderRadius: '10px',
                        fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                >
                    🚪 Salir de la Sala
                </button>
            </header>

            {/* ── Participant Grid ───────────────────────────────────────── */}
            <main style={{
                flex: 1, padding: '20px', overflowY: 'auto',
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px', alignContent: 'center'
            }}>
                {/* Local Participant Card */}
                <div style={{
                    position: 'relative', borderRadius: '16px', overflow: 'hidden',
                    background: 'rgba(18, 24, 40, 0.7)', border: '2px solid rgba(0, 229, 255, 0.4)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }}>
                    {!isCamOff && localStream && localStream.getVideoTracks().length > 0 ? (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                                width: 72, height: 72, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #00E5FF 0%, #7C4DFF 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem', fontWeight: 900,
                                boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)'
                            }}>
                                {myNickname[0]?.toUpperCase() || '🔴'}
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{myNickname} (Tú)</span>
                        </div>
                    )}

                    {/* Status badges */}
                    <div style={{
                        position: 'absolute', bottom: 10, left: 10, right: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                        padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700
                    }}>
                        <span>{myNickname} {isScreenSharing ? '🖥️' : ''}</span>
                        <span>{isMicMuted ? '🔴 Mic Off' : '🟢 Mic On'}</span>
                    </div>
                </div>

                {/* Remote Participants */}
                {peerList.map(peer => (
                    <RemotePeerCard key={peer.peerHash} peer={peer} displayName={getDisplayName(peer.peerHash)} isDeafened={isDeafened} />
                ))}
            </main>

            {/* ── Control Bar ────────────────────────────────────────────── */}
            <footer style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
                background: 'rgba(10, 14, 26, 0.9)', borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)'
            }}>
                <button
                    onClick={toggleMic}
                    style={{
                        width: 52, height: 52, borderRadius: '50%', border: 'none',
                        background: isMicMuted ? 'rgba(255, 82, 82, 0.25)' : 'rgba(0, 230, 118, 0.25)',
                        color: isMicMuted ? '#FF5252' : '#00E676',
                        fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease'
                    }}
                    title={isMicMuted ? 'Activar Micrófono' : 'Silenciar Micrófono'}
                >
                    {isMicMuted ? '🎙️❌' : '🎙️'}
                </button>

                <button
                    onClick={toggleCam}
                    style={{
                        width: 52, height: 52, borderRadius: '50%', border: 'none',
                        background: isCamOff ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 229, 255, 0.25)',
                        color: isCamOff ? '#aaa' : '#00E5FF',
                        fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease'
                    }}
                    title={isCamOff ? 'Encender Cámara' : 'Apagar Cámara'}
                >
                    {isCamOff ? '📹❌' : '📹'}
                </button>

                <button
                    onClick={toggleDeafen}
                    style={{
                        width: 52, height: 52, borderRadius: '50%', border: 'none',
                        background: isDeafened ? 'rgba(255, 82, 82, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                        color: isDeafened ? '#FF5252' : '#fff',
                        fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease'
                    }}
                    title={isDeafened ? 'Reactivar Audio Entrante' : 'Ensordecer (Deafen)'}
                >
                    {isDeafened ? '🎧❌' : '🎧'}
                </button>

                <button
                    onClick={toggleScreenShare}
                    style={{
                        width: 52, height: 52, borderRadius: '50%', border: 'none',
                        background: isScreenSharing ? 'rgba(255, 171, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                        color: isScreenSharing ? '#FFAB00' : '#fff',
                        fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease'
                    }}
                    title={isScreenSharing ? 'Detener Pantalla Compartida' : 'Compartir Pantalla'}
                >
                    🖥️
                </button>

                <button
                    onClick={handleDisconnect}
                    style={{
                        width: 56, height: 56, borderRadius: '50%', border: 'none',
                        background: '#FF3B30', color: '#fff',
                        fontSize: '1.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(255, 59, 48, 0.4)'
                    }}
                    title="Colgar y salir"
                >
                    📞
                </button>
            </footer>
        </div>
    );
};

interface RemotePeerCardProps {
    peer: any;
    displayName: string;
    isDeafened: boolean;
}

const RemotePeerCard: React.FC<RemotePeerCardProps> = ({ peer, displayName, isDeafened }) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
            videoRef.current.play().catch(() => {});
        }
        if (audioRef.current && peer.stream) {
            audioRef.current.srcObject = peer.stream;
            audioRef.current.volume = isDeafened ? 0 : 1.0;
            audioRef.current.play().catch(() => {});
        }
    }, [peer.stream, isDeafened]);

    return (
        <div style={{
            position: 'relative', borderRadius: '16px', overflow: 'hidden',
            background: 'rgba(18, 24, 40, 0.7)',
            border: peer.isSpeaking ? '2px solid #00E676' : '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: peer.isSpeaking ? '0 0 16px rgba(0, 230, 118, 0.4)' : '0 8px 32px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '180px', transition: 'border 0.2s ease, box-shadow 0.2s ease'
        }}>
            {peer.hasVideo && peer.stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #FF4081 0%, #7C4DFF 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '2rem', fontWeight: 900,
                        border: peer.isSpeaking ? '3px solid #00E676' : 'none'
                    }}>
                        {displayName[0]?.toUpperCase() || '🔴'}
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{displayName}</span>
                </div>
            )}

            <audio ref={audioRef} autoPlay playsInline />

            <div style={{
                position: 'absolute', bottom: 10, left: 10, right: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700
            }}>
                <span>{displayName}</span>
                <span>{peer.isSpeaking ? '🗣️ Hablando' : '🤫 En silencio'}</span>
            </div>
        </div>
    );
};
