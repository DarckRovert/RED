"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { SoundMeshEngine, SoundMeshPacket } from "../lib/SoundMeshEngine";

export function SurvivalBeaconModal() {
    const { navigate, identity } = useRedStore();

    const [flashActive, setFlashActive] = useState(false);
    const [soundSirenActive, setSoundSirenActive] = useState(false);
    const [screenFlashActive, setScreenFlashActive] = useState(false);
    const [screenColor, setScreenColor] = useState<"#E8213A" | "#00E676">("#E8213A");

    // SoundMesh Ultrasonic Modem states
    const localHash = (identity?.identity_hash || "LOCAL_NODE").substring(0, 8).toUpperCase();
    const [soundMeshMsg, setSoundMeshMsg] = useState(`${localHash}:RED_SOS_ACTIVE`);
    const [isTransmitting, setIsTransmitting] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [receivedPackets, setReceivedPackets] = useState<SoundMeshPacket[]>([]);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const sirenOscRef = useRef<OscillatorNode | null>(null);
    const flashIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const beaconStreamRef = useRef<MediaStream | null>(null);

    // Complete Unmount Cleanup Hook
    useEffect(() => {
        return () => {
            if (sirenOscRef.current) {
                try { sirenOscRef.current.stop(); } catch {}
                sirenOscRef.current = null;
            }
            if (flashIntervalRef.current) {
                clearInterval(flashIntervalRef.current);
                flashIntervalRef.current = null;
            }
            if (beaconStreamRef.current) {
                beaconStreamRef.current.getTracks().forEach(t => t.stop());
                beaconStreamRef.current = null;
            }
            SoundMeshEngine.stopListening();
        };
    }, []);

    // Flash LED Morse SOS Beacon with persistent stream reference
    useEffect(() => {
        if (flashActive) {
            let step = 0;

            // Request rear camera stream once for flash control
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !beaconStreamRef.current) {
                navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
                    beaconStreamRef.current = stream;
                }).catch(() => {});
            }

            flashIntervalRef.current = setInterval(() => {
                step++;
                const isTorchOn = step % 2 === 1;

                if (beaconStreamRef.current) {
                    const track = beaconStreamRef.current.getVideoTracks()[0];
                    if (track) {
                        track.applyConstraints({
                            advanced: [{ torch: isTorchOn } as unknown as MediaTrackConstraintSet]
                        }).catch(() => {});
                    }
                }
            }, 250);
        } else {
            if (flashIntervalRef.current) {
                clearInterval(flashIntervalRef.current);
                flashIntervalRef.current = null;
            }
            if (beaconStreamRef.current) {
                beaconStreamRef.current.getTracks().forEach(t => t.stop());
                beaconStreamRef.current = null;
            }
        }

        return () => {
            if (flashIntervalRef.current) {
                clearInterval(flashIntervalRef.current);
                flashIntervalRef.current = null;
            }
        };
    }, [flashActive]);

    // Acoustic Siren (3.2 kHz Max Penetration Frequency)
    const toggleSiren = () => {
        if (soundSirenActive) {
            if (sirenOscRef.current) {
                try { sirenOscRef.current.stop(); } catch {}
                sirenOscRef.current = null;
            }
            setSoundSirenActive(false);
        } else {
            try {
                const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                const ctx = new AudioCtxClass();
                audioCtxRef.current = ctx;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(3200, ctx.currentTime);
                gain.gain.setValueAtTime(0.4, ctx.currentTime);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                sirenOscRef.current = osc;

                setSoundSirenActive(true);
            } catch (e) {
                console.error('Siren Audio Error:', e);
            }
        }
    };

    // Screen Flash Toggle
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        if (screenFlashActive) {
            timer = setInterval(() => {
                setScreenColor(prev => prev === "#E8213A" ? "#00E676" : "#E8213A");
            }, 300);
        }
        return () => { if (timer) clearInterval(timer); };
    }, [screenFlashActive]);

    // SoundMesh Ultrasonic Modem Handlers
    const handleTransmitSoundMesh = async () => {
        if (!soundMeshMsg.trim()) return;
        setIsTransmitting(true);
        const ok = await SoundMeshEngine.transmitPayload(soundMeshMsg);
        setIsTransmitting(false);
        if (ok) {
            alert("Trama acústica por ultrasonido emitida a 19.5 kHz");
        }
    };

    const handleToggleListenSoundMesh = async () => {
        if (isListening) {
            SoundMeshEngine.stopListening();
            setIsListening(false);
        } else {
            const ok = await SoundMeshEngine.startListening((pkt) => {
                setReceivedPackets(prev => [pkt, ...prev]);
            });
            if (ok) setIsListening(true);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: screenFlashActive ? screenColor : 'rgba(4,6,10,0.96)', color: '#fff',
            display: 'flex', flexDirection: 'column', padding: '20px',
            overflowY: 'auto', backdropFilter: 'blur(12px)', transition: 'background 0.2s ease'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #FF9800, #E65100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🚨</div>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Baliza de Supervivencia & Ultrasonido</div>
                        <div style={{ fontSize: '0.72rem', color: '#FF9800' }}>SOS Óptico, Acústico 3.2kHz & Audio-Modem SoundMesh</div>
                    </div>
                </div>
                <button onClick={() => {
                    if (sirenOscRef.current) {
                        try { sirenOscRef.current.stop(); } catch {}
                        sirenOscRef.current = null;
                    }
                    if (beaconStreamRef.current) {
                        beaconStreamRef.current.getTracks().forEach(t => t.stop());
                        beaconStreamRef.current = null;
                    }
                    SoundMeshEngine.stopListening();
                    navigate('sidebar');
                }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>✕ Cerrar</button>
            </div>

            {/* Emergency Beacons Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Optical & Acoustic SOS Control */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FF9800' }}>💡 Balizas de Señalización SOS</div>

                    <button
                        onClick={() => setFlashActive(!flashActive)}
                        style={{
                            padding: '14px', borderRadius: '10px',
                            background: flashActive ? '#E8213A' : 'rgba(255,255,255,0.06)',
                            color: '#fff', border: `1px solid ${flashActive ? '#E8213A' : 'rgba(255,255,255,0.1)'}`,
                            fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        📸 Flash LED Morse SOS: <strong>{flashActive ? "ACTIVADO (DESTELLANDO)" : "APAGADO"}</strong>
                    </button>

                    <button
                        onClick={toggleSiren}
                        style={{
                            padding: '14px', borderRadius: '10px',
                            background: soundSirenActive ? '#E8213A' : 'rgba(255,255,255,0.06)',
                            color: '#fff', border: `1px solid ${soundSirenActive ? '#E8213A' : 'rgba(255,255,255,0.1)'}`,
                            fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        📢 Sirena Acústica 3.2 kHz: <strong>{soundSirenActive ? "SONANDO (ALTA POTENCIA)" : "APAGADO"}</strong>
                    </button>

                    <button
                        onClick={() => setScreenFlashActive(!screenFlashActive)}
                        style={{
                            padding: '14px', borderRadius: '10px',
                            background: screenFlashActive ? '#00E676' : 'rgba(255,255,255,0.06)',
                            color: screenFlashActive ? '#000' : '#fff',
                            border: `1px solid ${screenFlashActive ? '#00E676' : 'rgba(255,255,255,0.1)'}`,
                            fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        📱 Destello Pantalla OLED: <strong>{screenFlashActive ? "ACTIVADO" : "APAGADO"}</strong>
                    </button>
                </div>

                {/* SoundMesh Ultrasonic Modem Box */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38BDF8' }}>🦇 Módem Acústico SoundMesh (Ultrasonido)</div>
                    <div style={{ fontSize: '0.75rem', color: '#AAA' }}>Transmite mensajes Mesh usando tonos de audio inaudibles (18.5kHz-20.5kHz):</div>

                    <input
                        value={soundMeshMsg}
                        onChange={e => setSoundMeshMsg(e.target.value)}
                        placeholder="Mensaje o ID de auxilio..."
                        style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.85rem' }}
                    />

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleTransmitSoundMesh}
                            disabled={isTransmitting}
                            style={{
                                flex: 1, padding: '10px', background: '#38BDF8', color: '#000',
                                border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer'
                            }}
                        >
                            {isTransmitting ? "EMITIENDO TONO..." : "📡 EMITIR ULTRASONIDO"}
                        </button>

                        <button
                            onClick={handleToggleListenSoundMesh}
                            style={{
                                padding: '10px 14px', background: isListening ? '#E8213A' : 'rgba(255,255,255,0.1)',
                                color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer'
                            }}
                        >
                            {isListening ? "🛑 DETENER MIC" : "🎙️ ESCUCHAR MIC"}
                        </button>
                    </div>

                    {/* Received ultrasonic packets */}
                    <div style={{ marginTop: '8px', fontSize: '0.8rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#AAA', marginBottom: '4px' }}>Tramas Ultrasónicas Capturadas:</div>
                        <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {receivedPackets.length === 0 ? (
                                <div style={{ fontSize: '0.72rem', color: '#666', fontStyle: 'italic' }}>Esperando señal de ultrasonido en 19.5 kHz...</div>
                            ) : (
                                receivedPackets.map((pkt, idx) => (
                                    <div key={idx} style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', padding: '6px 10px', borderRadius: '6px', color: '#00E676', fontSize: '0.75rem' }}>
                                        <strong>{pkt.senderId}:</strong> {pkt.payloadHex} ({pkt.rssiDb} dB)
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
