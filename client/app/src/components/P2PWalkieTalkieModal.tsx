'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRedStore } from '../store/useRedStore';
import { sendVoiceBurst, getVoiceBursts, VoiceBurst } from '../lib/api';

export const P2PWalkieTalkieModal: React.FC = () => {
    const { navigate } = useRedStore();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [bursts, setBursts] = useState<VoiceBurst[]>([]);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

    // Helper to dynamically obtain VoiceRecorder plugin when running natively
    const getVoiceRecorder = async () => {
        try {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const { VoiceRecorder } = await import('capacitor-voice-recorder');
                return VoiceRecorder;
            }
        } catch {}
        return null;
    };

    // Request microphone permission on mount
    useEffect(() => {
        const requestPerm = async () => {
            try {
                const VR = await getVoiceRecorder();
                if (VR) {
                    const perm = await VR.requestAudioRecordingPermission();
                    setPermissionGranted(perm.value);
                } else {
                    // Web fallback: check getUserMedia
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop());
                    setPermissionGranted(true);
                }
            } catch {
                setPermissionGranted(false);
                setStatusMsg('⚠️ Permiso de micrófono denegado. Actívalo en Configuración > Aplicaciones > RED.');
            }
        };
        requestPerm();
    }, []);

    const loadBursts = useCallback(async () => {
        try {
            const list = await getVoiceBursts();
            setBursts(Array.isArray(list) ? list : []);
        } catch (e) {
            console.error('Voice bursts fetch error:', e);
            setBursts([]);
        }
    }, []);

    useEffect(() => {
        loadBursts();
        const interval = setInterval(loadBursts, 3000);
        return () => clearInterval(interval);
    }, [loadBursts]);

    // Recording timer
    useEffect(() => {
        let timer: any;
        if (isRecording) {
            timer = setInterval(() => setRecordingTime((t) => t + 1), 1000);
        } else {
            setRecordingTime(0);
        }
        return () => clearInterval(timer);
    }, [isRecording]);

    const handlePressDown = async () => {
        if (!permissionGranted) {
            setStatusMsg('⚠️ Permiso de micrófono requerido.');
            return;
        }
        try {
            const VR = await getVoiceRecorder();
            if (VR) {
                await VR.startRecording();
            }
            setIsRecording(true);
            setStatusMsg(null);
        } catch (e: any) {
            setStatusMsg(`Error al iniciar grabación: ${e.message}`);
        }
    };

    const handlePressRelease = async () => {
        if (!isRecording) return;
        setIsRecording(false);
        const duration = Math.max(1, recordingTime);

        try {
            let audioB64 = '';
            const VR = await getVoiceRecorder();

            if (VR) {
                // Real Capacitor recording
                const result = await VR.stopRecording();
                audioB64 = result.value?.recordDataBase64 || '';
            } else {
                // Web fallback: not supported — show clear message
                setStatusMsg('ℹ️ La grabación de audio real requiere la app nativa instalada en Android.');
                return;
            }

            if (!audioB64) {
                setStatusMsg('❌ No se pudo obtener el audio grabado.');
                return;
            }

            await sendVoiceBurst({
                sender_name: 'Operador RED',
                duration_seconds: duration,
                audio_opus_b64: audioB64
            });
            await loadBursts();
            setStatusMsg(`✅ Ráfaga de ${duration}s transmitida a la red P2P.`);
        } catch (e: any) {
            setStatusMsg(`Error de transmisión: ${e.message}`);
        }
    };

    const handlePlayBurst = (burst: VoiceBurst) => {
        try {
            if (!burst.audio_opus_b64) {
                setStatusMsg('❌ Esta ráfaga no contiene datos de audio.');
                return;
            }
            // Determine MIME type: capacitor-voice-recorder returns AAC/MP4 on Android
            const mimeType = 'audio/aac';
            const audioSrc = `data:${mimeType};base64,${burst.audio_opus_b64}`;

            // Reuse or create HTMLAudioElement per burst
            let audio = audioRefs.current.get(burst.id);
            if (!audio) {
                audio = new Audio(audioSrc);
                audioRefs.current.set(burst.id, audio);
            }
            audio.currentTime = 0;
            audio.play().catch(() => {
                setStatusMsg('⚠️ No se pudo reproducir: formato no compatible con este navegador.');
            });
            setStatusMsg(`▶ Reproduciendo ráfaga de ${burst.sender_name} (${burst.duration_seconds}s)...`);
        } catch (e: any) {
            setStatusMsg(`Error de reproducción: ${e.message}`);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: '#04060A',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* TOP BAR */}
            <div style={{
                height: '60px',
                padding: '0 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(15,23,42,0.9)'
            }}>
                <button
                    onClick={() => navigate('sidebar')}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    🎙️ WALKIE-TALKIE P2P PUSH-TO-TALK
                </div>
                <div style={{ fontSize: '0.72rem', color: permissionGranted ? '#4ade80' : '#f59e0b', fontWeight: 800, fontFamily: 'monospace' }}>
                    {permissionGranted ? 'MIC ACTIVO ✓' : 'SIN PERMISO'}
                </div>
            </div>

            {/* STATUS MESSAGE */}
            {statusMsg && (
                <div style={{ padding: '10px 20px', background: 'rgba(56,189,248,0.08)', borderBottom: '1px solid rgba(56,189,248,0.15)', fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center' }}>
                    {statusMsg}
                </div>
            )}

            {/* MAIN PTT INTERFACE */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

                {/* PTT BIG BUTTON */}
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <button
                        onMouseDown={handlePressDown}
                        onMouseUp={handlePressRelease}
                        onTouchStart={handlePressDown}
                        onTouchEnd={handlePressRelease}
                        disabled={!permissionGranted}
                        style={{
                            width: '200px',
                            height: '200px',
                            borderRadius: '50%',
                            background: isRecording
                                ? 'radial-gradient(circle, #ef4444 0%, #991b1b 100%)'
                                : permissionGranted
                                ? 'radial-gradient(circle, #0284c7 0%, #0369a1 100%)'
                                : 'radial-gradient(circle, #374151 0%, #1f2937 100%)',
                            border: isRecording ? '4px solid #fca5a5' : '4px solid #7dd3fc',
                            boxShadow: isRecording ? '0 0 50px rgba(239,68,68,0.6)' : '0 0 30px rgba(56,189,248,0.3)',
                            color: '#fff',
                            fontSize: '3.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: permissionGranted ? 'pointer' : 'not-allowed',
                            userSelect: 'none',
                            transition: 'all 0.2s ease',
                            opacity: permissionGranted ? 1 : 0.5
                        }}
                    >
                        <span>🎙️</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 900, marginTop: '8px', letterSpacing: '1px' }}>
                            {isRecording ? `GRABANDO (${recordingTime}s)` : 'MANTÉN PARA HABLAR'}
                        </span>
                    </button>
                </div>

                {/* RECENT VOICE BURSTS LIST */}
                <div style={{ width: '100%', maxWidth: '500px', background: 'rgba(15,23,42,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', letterSpacing: '0.5px' }}>
                        RÁFAGAS DE VOZ RECIENTES ({bursts.length})
                    </div>

                    {bursts.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', padding: '20px' }}>
                            No hay ráfagas de voz captadas en la red.
                        </div>
                    ) : (
                        bursts.map((b) => (
                            <div key={b.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 14px',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                fontSize: '0.85rem'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: '#fff' }}>{b.sender_name}</div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                                        {b.duration_seconds}s · {new Date(b.timestamp * 1000).toLocaleTimeString()}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handlePlayBurst(b)}
                                    style={{
                                        background: 'rgba(56,189,248,0.15)',
                                        border: '1px solid #38bdf8',
                                        color: '#38bdf8',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    ▶ Reproducir
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
