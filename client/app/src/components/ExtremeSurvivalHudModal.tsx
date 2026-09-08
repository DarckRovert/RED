/**
 * ExtremeSurvivalHudModal.tsx — RED Sovereign Mesh OS
 *
 * HUD Táctico de Supervivencia Extrema (Modo de Pánico & Alto Estrés).
 * Diseñado ergonómicamente para visibilidad en luz solar directa o visión nublada.
 * 3 Acciones Maestras de Respuesta Inmediata 100% Funcionales:
 * 1. [🚨 SOS MÉDICO & BALIZA] — Emisión simultánea a Rust Sled DB + Malla Soberana P2P + Alerta acústica.
 * 2. [🎙️ PTT CANAL DIRECTO] — Captura de audio en tiempo real, codificación táctica y transmisión de ráfaga de voz en la malla (#general).
 * 3. [🧭 RUTA DE EVACUACIÓN] — Navegación real hacia waypoints tácticos guardados (red_offgrid_waypoints), balizas remotas o punto de reunión fijado.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { ecoMeshDutyCycleEngine, EcoMeshState } from "../lib/mesh/EcoMeshDutyCycleEngine";
import { lamportMeshClockEngine } from "../lib/mesh/LamportMeshClockEngine";
import { TacticalSpeechEngine } from "../lib/ai/TacticalSpeechEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { RedAPI, sendVoiceBurst } from "../lib/api";
import { LowBitrateVocoder } from "../lib/LowBitrateVocoder";
import { AudioContextManager } from "../lib/audio/AudioContextManager";
import { meshRouter } from "../lib/mesh/meshRouter";
import { tacticalCompass } from "../lib/sensors/TacticalCompassEngine";
import { toast } from "./Toast";

interface TacticalWaypoint {
    id: string;
    name: string;
    lat: number;
    lon: number;
    alt?: number;
    type?: string;
}

export const ExtremeSurvivalHudModal: React.FC = () => {
    const {
        goBack,
        status,
        contacts,
        identity,
        activeSosBeacons,
        addVoiceBurst
    } = useRedStore();

    // Telemetría de Resiliencia
    const [ecoState, setEcoState] = useState<EcoMeshState>(ecoMeshDutyCycleEngine.getState());
    const [isSosActive, setIsSosActive] = useState(false);
    const [rustBeaconId, setRustBeaconId] = useState<string | null>(null);
    const [heading, setHeading] = useState<number>(0);
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
    
    // Estroboscopio de Emergencia
    const [strobeActive, setStrobeActive] = useState(false);
    const [strobePhase, setStrobePhase] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Sistema de Evacuación y Waypoints Reales
    const [waypoints, setWaypoints] = useState<TacticalWaypoint[]>([]);
    const [selectedWpIdx, setSelectedWpIdx] = useState<number>(0);
    const [customRallyPoint, setCustomRallyPoint] = useState<{ lat: number; lng: number; name: string } | null>(null);

    // PTT Transmisión de Voz Real en Malla
    const [isPttPressed, setIsPttPressed] = useState(false);
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const recordingStartTsRef = useRef<number>(0);

    // ── 1. Carga e Hidratación de Waypoints Reales y Baliza SOS previa ──────────
    const loadRealWaypoints = useCallback(() => {
        try {
            if (typeof window !== "undefined") {
                const raw = localStorage.getItem("red_offgrid_waypoints");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const valid = parsed.filter((w: any) => typeof w.lat === "number" && typeof w.lon === "number");
                        setWaypoints(valid);
                        return;
                    }
                }
            }
        } catch {}
        setWaypoints([]);
    }, []);

    useEffect(() => {
        loadRealWaypoints();

        // Detectar si el operador ya tiene una baliza SOS activa en la malla o en Rust Sled
        import("../lib/emergency/MeshSosBeaconEngine").then(({ MeshSosBeaconEngine }) => {
            const active = MeshSosBeaconEngine.getInstance().getMyActiveBeacon();
            if (active) {
                setIsSosActive(true);
                setRustBeaconId(active.id);
            }
        }).catch(() => {});

        RedAPI.getEmergencyBeacons().then((list) => {
            if (Array.isArray(list)) {
                const mine = list.find((b: any) => b.is_mine && b.active);
                if (mine) {
                    setIsSosActive(true);
                    setRustBeaconId(mine.beacon_id);
                }
            }
        }).catch(() => {});
    }, [loadRealWaypoints]);

    // Subscripción a motor energético
    useEffect(() => {
        const unsub = ecoMeshDutyCycleEngine.subscribe(setEcoState);
        return () => unsub();
    }, []);

    // ── 2. Estroboscopio Activo a 10 Hz ───────────────────────────────────────────
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        if (strobeActive) {
            timer = setInterval(() => {
                setStrobePhase(prev => !prev);
            }, 100);
        } else {
            setStrobePhase(false);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [strobeActive]);

    // ── 3. Monitoreo GNSS Continuo y Sensor de Orientación Magnética ──────────────
    useEffect(() => {
        let isMounted = true;
        let unsubGps: (() => void) | null = null;
        import("../lib/sensors/TacticalLocationEngine").then(({ TacticalLocationEngine }) => {
            if (!isMounted) return;
            unsubGps = TacticalLocationEngine.watchLocation((loc) => {
                if (TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) {
                    setGpsCoords({ lat: loc.lat!, lng: loc.lon! });
                }
            });
        });

        // Telemetría unificada de orientación táctica (Giroscopio 3D + Magnetómetro + Filtro Circular + Fallback COG)
        const unsubCompass = tacticalCompass.subscribe((telemetry) => {
            setHeading(telemetry.headingDeg);
        });

        return () => {
            isMounted = false;
            stopAcousticBeacon();
            if (unsubGps) (unsubGps as any)();
            unsubCompass();
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
                mediaStreamRef.current = null;
            }
        };
    }, []);

    // ── 4. Interceptor LIFO de Navegación Atrás (BackHandlerRegistry) ─────────────
    useEffect(() => {
        const unreg = BackHandlerRegistry.register(() => {
            if (isRecordingAudio) {
                // Abortar PTT si el usuario retrocede durante la grabación
                setIsRecordingAudio(false);
                setIsPttPressed(false);
                if (mediaRecorderRef.current) {
                    try { mediaRecorderRef.current.stop(); } catch {}
                    mediaRecorderRef.current = null;
                }
                if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach(t => t.stop());
                    mediaStreamRef.current = null;
                }
                TacticalAudioEngine.playWarning();
                toast.info("Grabación PTT cancelada");
                return true;
            }
            if (strobeActive) {
                setStrobeActive(false);
                TacticalAudioEngine.playTap();
                return true;
            }
            if (isSosActive) {
                toggleSos();
                TacticalAudioEngine.playWarning();
                return true;
            }
            TacticalAudioEngine.playTap();
            goBack();
            return true;
        });
        return unreg;
    }, [isRecordingAudio, strobeActive, isSosActive, goBack]);

    // Fallback resiliente para copia de coordenadas al portapapeles
    const copyCoordinates = (lat?: number, lng?: number) => {
        if (lat === undefined || lng === undefined) return;
        const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                TacticalAudioEngine.playMessageSent();
                toast.success(`Coordenadas copiadas: ${text}`);
            }).catch(() => fallbackCopyCoords(text));
        } else {
            fallbackCopyCoords(text);
        }
    };

    const fallbackCopyCoords = (text: string) => {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand("copy");
            document.body.removeChild(textArea);
            if (successful) {
                TacticalAudioEngine.playMessageSent();
                toast.success(`Coordenadas copiadas: ${text}`);
            } else {
                toast.error("No se pudo copiar al portapapeles");
            }
        } catch {
            toast.error("Error al copiar coordenadas");
        }
    };

    // ── 5. Activación SOS con Registro Dual: Rust Sled DB + Malla Soberana ─────────
    const toggleSos = async () => {
        const next = !isSosActive;
        setIsSosActive(next);

        if (next) {
            ecoMeshDutyCycleEngine.triggerEmergencyOverride(120000);
            
            // 1. Registro persistente en backend Rust Sled
            try {
                const res = await RedAPI.broadcastEmergencyBeacon({
                    distress_type: "SOS_GENERAL",
                    latitude: gpsCoords?.lat,
                    longitude: gpsCoords?.lng,
                    battery_pct: ecoState.batteryLevel,
                    custom_note: "🚨 [HUD SUPERVIVENCIA] Operador requiere extracción o auxilio inmediato."
                });
                if (res?.beacon_id) {
                    setRustBeaconId(res.beacon_id);
                }
            } catch (err) {
                console.warn("[ExtremeSurvivalHud] Fallo al registrar baliza en Rust Sled:", err);
            }

            // 2. Activación en el motor de malla cliente
            try {
                const { MeshSosBeaconEngine } = await import("../lib/emergency/MeshSosBeaconEngine");
                await MeshSosBeaconEngine.getInstance().activateSosBeacon(
                    {
                        distressType: "GENERAL_DISTRESS",
                        triageColor: "RED",
                        note: "🚨 [EMERGENCIA EXTREMA HUD] Operador requiere auxilio inmediato.",
                        coords: gpsCoords ? { lat: gpsCoords.lat, lon: gpsCoords.lng } : undefined,
                        batteryLevel: ecoState.batteryLevel
                    },
                    identity?.identity_hash || "did:red:local",
                    identity?.alias || identity?.nickname || "Operador"
                );
            } catch {}

            TacticalSpeechEngine.speak("Alerta SOS activada. Transmitiendo baliza de rescate en la malla.", { lang: "es-ES", rate: 1.1 });
            TacticalAudioEngine.playEmergencyAlarm();
            startAcousticBeacon();
        } else {
            // Desactivar en Rust Sled si tenemos el ID
            if (rustBeaconId) {
                try {
                    await RedAPI.cancelEmergencyBeacon(rustBeaconId);
                } catch {}
                setRustBeaconId(null);
            }

            // Desactivar en la malla soberana
            try {
                const { MeshSosBeaconEngine } = await import("../lib/emergency/MeshSosBeaconEngine");
                await MeshSosBeaconEngine.getInstance().deactivateSosBeacon();
            } catch {}

            stopAcousticBeacon();
            TacticalAudioEngine.playRogerBeep();
            TacticalSpeechEngine.speak("Alerta SOS desactivada.", { lang: "es-ES" });
        }
    };

    // Generador de tono acústico de emergencia
    const startAcousticBeacon = () => {
        try {
            stopAcousticBeacon();
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.35);

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.45);
            audioContextRef.current = ctx;

            setTimeout(() => {
                try {
                    if (ctx.state !== "closed") ctx.close();
                } catch {}
            }, 500);
        } catch {}
    };

    const stopAcousticBeacon = () => {
        if (audioContextRef.current) {
            try {
                if (audioContextRef.current.state !== "closed") {
                    audioContextRef.current.close();
                }
            } catch {}
            audioContextRef.current = null;
        }
    };

    // ── 6. Push-To-Talk Real: Grabación de Audio y Transmisión de Ráfagas en Malla ──
    const handlePttStart = async () => {
        setIsPttPressed(true);
        TacticalAudioEngine.playTap();
        ecoMeshDutyCycleEngine.triggerEmergencyOverride(30000);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(60);
        }

        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { VoiceRecorder } = await import("capacitor-voice-recorder");
                const perm = await VoiceRecorder.hasAudioRecordingPermission();
                if (!perm.value) {
                    await VoiceRecorder.requestAudioRecordingPermission();
                }
                const started = await VoiceRecorder.startRecording();
                if (started.value) {
                    setIsRecordingAudio(true);
                    recordingStartTsRef.current = Date.now();
                    return;
                }
            }
        } catch {}

        // Fallback Web MediaRecorder
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaStreamRef.current = stream;
                recordedChunksRef.current = [];
                const recorder = new MediaRecorder(stream);
                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
                };
                recorder.start(100);
                mediaRecorderRef.current = recorder;
                setIsRecordingAudio(true);
                recordingStartTsRef.current = Date.now();
            }
        } catch (err) {
            console.warn("[ExtremeSurvivalHud] Error al iniciar micrófono:", err);
            toast.error("No se pudo acceder al micrófono para PTT");
        }
    };

    const handlePttEnd = async () => {
        setIsPttPressed(false);
        TacticalAudioEngine.playRogerBeep();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(40);
        }

        if (!isRecordingAudio) return;
        setIsRecordingAudio(false);

        const durationSec = Math.max(1, Math.round((Date.now() - recordingStartTsRef.current) / 1000));
        let base64Audio = "";

        // 1. Detener grabación nativa Capacitor
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { VoiceRecorder } = await import("capacitor-voice-recorder");
                const result = await VoiceRecorder.stopRecording();
                if (result.value && result.value.recordDataBase64) {
                    base64Audio = result.value.recordDataBase64;
                }
            }
        } catch {}

        // 2. Detener grabación Web MediaRecorder si aplica
        if (!base64Audio && mediaRecorderRef.current) {
            try {
                const rec = mediaRecorderRef.current;
                await new Promise<void>((resolve) => {
                    rec.onstop = () => resolve();
                    try { rec.stop(); } catch { resolve(); }
                });

                if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach(t => t.stop());
                    mediaStreamRef.current = null;
                }
                mediaRecorderRef.current = null;

                const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
                if (blob.size > 0) {
                    const arrayBuffer = await blob.arrayBuffer();
                    try {
                        const audioCtx = AudioContextManager.getSharedContext();
                        if (audioCtx) {
                            const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
                            const vocoderResult = LowBitrateVocoder.compressAudioBuffer(decodedBuffer);
                            base64Audio = vocoderResult.base64;
                        }
                    } catch {
                        // Fallback binario directo
                        const bytes = new Uint8Array(arrayBuffer);
                        let binary = '';
                        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                        base64Audio = btoa(binary);
                    }
                }
            } catch (err) {
                console.warn("[ExtremeSurvivalHud] Error procesando audio Web:", err);
            }
        }

        // 3. Transmisión real de ráfaga de voz en la malla
        if (base64Audio) {
            try {
                const myName = identity?.alias || identity?.nickname || "Operador RED";
                const res = await sendVoiceBurst({
                    audio_opus_b64: base64Audio,
                    duration_seconds: durationSec,
                    sender_name: myName
                });
                if (res && res.burst) {
                    addVoiceBurst(res.burst);
                }

                // Radiodifusión directa en Malla Táctica Off-Grid P2P
                try {
                    const meshPayload = new TextEncoder().encode(JSON.stringify({
                        type: "P2P_VOICE_BURST",
                        channel: "#general",
                        sender: myName,
                        duration: durationSec,
                        audio_b64: base64Audio,
                        timestamp: Date.now()
                    }));
                    await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", meshPayload).catch(() => {});
                } catch (meshErr) {
                    console.warn("[ExtremeSurvivalHud] Error al difundir ráfaga por malla:", meshErr);
                }

                toast.success(`🎙️ Ráfaga de voz transmitida (${durationSec}s) a #general`);
            } catch (err: any) {
                toast.error(`Error al transmitir audio: ${err.message || "Fallo P2P"}`);
            }
        }
    };

    // ── 7. Cálculo de Evacuación Real hacia Waypoints / Balizas / Rally Point ──────
    const getActiveEvacTarget = (): { lat: number; lng: number; name: string } | null => {
        if (customRallyPoint) return customRallyPoint;
        if (waypoints.length > 0) {
            const safeIdx = selectedWpIdx % waypoints.length;
            const wp = waypoints[safeIdx];
            return { lat: wp.lat, lng: wp.lon, name: wp.name };
        }
        // Fallback a la primera baliza SOS activa de la malla si existe
        const peerSosList = Object.values(activeSosBeacons || {});
        if (peerSosList.length > 0 && peerSosList[0].coords?.lat && peerSosList[0].coords?.lon) {
            return {
                lat: peerSosList[0].coords.lat,
                lng: peerSosList[0].coords.lon,
                name: `Baliza SOS: ${peerSosList[0].senderAlias || "Víctima"}`
            };
        }
        return null;
    };

    const activeTarget = getActiveEvacTarget();

    // Haversine exacto en kilómetros / metros
    const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371000; // metros
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    };

    const calculateBearing = () => {
        if (!gpsCoords || !activeTarget) return 0;
        const dLat = (activeTarget.lat - gpsCoords.lat) * (Math.PI / 180);
        const dLng = (activeTarget.lng - gpsCoords.lng) * (Math.PI / 180);
        const y = Math.sin(dLng) * Math.cos(activeTarget.lat * (Math.PI / 180));
        const x = Math.cos(gpsCoords.lat * (Math.PI / 180)) * Math.sin(activeTarget.lat * (Math.PI / 180)) -
                  Math.sin(gpsCoords.lat * (Math.PI / 180)) * Math.cos(activeTarget.lat * (Math.PI / 180)) * Math.cos(dLng);
        const brng = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        return Math.round(brng);
    };

    const targetBearing = calculateBearing();
    const arrowAngle = (targetBearing - heading + 360) % 360;
    const distanceMeters = (gpsCoords && activeTarget)
        ? calculateDistanceMeters(gpsCoords.lat, gpsCoords.lng, activeTarget.lat, activeTarget.lng)
        : null;

    const peerCount = status?.peer_count ?? contacts.length;

    // Fijar posición actual como Punto de Reunión Inmediato si no hay waypoints
    const handleSetCurrentAsRallyPoint = () => {
        if (!gpsCoords) {
            toast.warning("Esperando posición GPS para fijar punto de reunión");
            return;
        }
        const newWp: TacticalWaypoint = {
            id: `rally-${Date.now()}`,
            name: "PUNTO DE REUNIÓN ALFA",
            lat: gpsCoords.lat,
            lon: gpsCoords.lng,
            type: "RALLY_POINT"
        };
        const updated = [...waypoints, newWp];
        setWaypoints(updated);
        setSelectedWpIdx(updated.length - 1);
        try {
            localStorage.setItem("red_offgrid_waypoints", JSON.stringify(updated));
        } catch {}
        TacticalAudioEngine.playMessageSent();
        toast.success("🚩 Coordenadas actuales fijadas como PUNTO DE REUNIÓN");
    };

    const handleCycleWaypoint = () => {
        if (waypoints.length <= 1) return;
        TacticalAudioEngine.playTap();
        setSelectedWpIdx((prev) => (prev + 1) % waypoints.length);
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: strobeActive ? (strobePhase ? "#FFFFFF" : "#000000") : "#05060A",
            color: strobeActive && strobePhase ? "#000000" : "#FFFFFF",
            fontFamily: "'Inter', sans-serif",
            display: "flex", flexDirection: "column",
            userSelect: "none", overflow: "hidden"
        }}>
            {/* Header Táctico de Telemetría */}
            <div style={{
                padding: "12px 16px", background: "rgba(18, 2, 4, 0.95)",
                borderBottom: "2px solid #FF1E40",
                display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "1.3rem" }}>⚡</span>
                    <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#FF1E40", letterSpacing: "1px" }}>
                            HUD DE SUPERVIVENCIA EXTREMA
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#8892B0", fontFamily: "JetBrains Mono, monospace" }}>
                            {identity?.alias || identity?.nickname || "OPERADOR"} · LAMPORT #{lamportMeshClockEngine.getLogicalCounter()}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            setStrobeActive(!strobeActive);
                        }}
                        style={{
                            padding: "6px 10px", borderRadius: "8px",
                            background: strobeActive ? "#FFCC00" : "rgba(255, 255, 255, 0.1)",
                            border: "1px solid #FFCC00", color: strobeActive ? "#000000" : "#FFCC00",
                            fontWeight: 800, fontSize: "0.72rem", cursor: "pointer"
                        }}
                    >
                        {strobeActive ? "⚡ ESTROBO ON (10Hz)" : "💡 ESTROBO"}
                    </button>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            goBack();
                        }}
                        style={{
                            padding: "6px 12px", borderRadius: "8px",
                            background: "rgba(255, 30, 64, 0.2)",
                            border: "1px solid #FF1E40", color: "#FF1E40",
                            fontWeight: 800, fontSize: "0.75rem", cursor: "pointer"
                        }}
                    >
                        ✕ SALIR
                    </button>
                </div>
            </div>

            {/* Barra de Estado Vital de Resiliencia */}
            <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                padding: "8px 12px", background: "rgba(0, 0, 0, 0.7)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "center",
                fontSize: "0.75rem", fontFamily: "JetBrains Mono, monospace"
            }}>
                <div style={{ borderRight: "1px solid rgba(255, 255, 255, 0.1)" }}>
                    <span style={{ color: "#8892B0" }}>BATERÍA: </span>
                    <span style={{ fontWeight: 800, color: ecoState.batteryLevel < 20 ? "#FF1E40" : "#00FF88" }}>
                        {ecoState.batteryLevel}% (~{ecoState.estimatedBatteryLifeHours}h)
                    </span>
                </div>
                <div style={{ borderRight: "1px solid rgba(255, 255, 255, 0.1)" }}>
                    <span style={{ color: "#8892B0" }}>MALLA: </span>
                    <span style={{ fontWeight: 800, color: peerCount > 0 ? "#00E5FF" : "#FFAA00" }}>
                        {peerCount} NODOS
                    </span>
                </div>
                <div>
                    <span style={{ color: "#8892B0" }}>MODO: </span>
                    <span style={{ fontWeight: 800, color: "#FFCC00" }}>
                        {ecoState.mode.toUpperCase()}
                    </span>
                </div>
            </div>

            {/* CUERPO PRINCIPAL: 3 TARJETAS GIGANTES DE ALTO CONTRASTE */}
            <div style={{
                flex: 1, padding: "12px", display: "flex",
                flexDirection: "column", gap: "12px", justifyContent: "space-between"
            }}>
                {/* BOTÓN 1: SOS MÉDICO & BALIZA */}
                <button
                    onClick={toggleSos}
                    style={{
                        flex: 1, width: "100%", borderRadius: "18px",
                        background: isSosActive ? "linear-gradient(135deg, #FF1E40 0%, #B3001E 100%)" : "rgba(30, 8, 12, 0.95)",
                        border: isSosActive ? "3px solid #FFFFFF" : "2px solid #FF1E40",
                        color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "0 24px", cursor: "pointer", transition: "all 0.15s ease",
                        boxShadow: isSosActive ? "0 0 35px rgba(255, 30, 64, 0.8)" : "none"
                    }}
                >
                    <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: "1.4rem", fontWeight: 900, letterSpacing: "1.5px" }}>
                            {isSosActive ? "🚨 BALIZA SOS EN MALLA + SLED" : "🚨 SOS MÉDICO / RESCATE"}
                        </div>
                        <div style={{ fontSize: "0.82rem", color: isSosActive ? "#FFF" : "#FF6680", marginTop: "4px" }}>
                            {isSosActive
                                ? `Transmitiendo GNSS + Sirena Acústica ${rustBeaconId ? `(${rustBeaconId})` : ""}`
                                : "Toca para activar baliza de auxilio de máxima prioridad"}
                        </div>
                    </div>
                    <span style={{ fontSize: "2.6rem" }}>{isSosActive ? "📡" : "🆘"}</span>
                </button>

                {/* BOTÓN 2: PTT CANAL DIRECTO DE VOZ (100% OPERATIVO) */}
                <div
                    onMouseDown={handlePttStart}
                    onMouseUp={handlePttEnd}
                    onTouchStart={handlePttStart}
                    onTouchEnd={handlePttEnd}
                    style={{
                        flex: 1, width: "100%", borderRadius: "18px",
                        background: isPttPressed ? "linear-gradient(135deg, #00FF88 0%, #009944 100%)" : "rgba(5, 25, 18, 0.95)",
                        border: isPttPressed ? "3px solid #FFFFFF" : "2px solid #00FF88",
                        color: isPttPressed ? "#000000" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "0 24px", cursor: "pointer", transition: "all 0.1s ease",
                        boxShadow: isPttPressed ? "0 0 35px rgba(0, 255, 136, 0.8)" : "none"
                    }}
                >
                    <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: "1.4rem", fontWeight: 900, letterSpacing: "1.5px" }}>
                            {isPttPressed ? "🔴 TRANSMITIENDO VOZ EN MALLA..." : "🎙️ PUSH-TO-TALK DIRECTO"}
                        </div>
                        <div style={{ fontSize: "0.82rem", color: isPttPressed ? "#003311" : "#55FFAA", marginTop: "4px" }}>
                            {isPttPressed
                                ? "Habla ahora · Se codificará y transmitirá a #general"
                                : "Mantén presionado para hablar en tiempo real con la escuadra"}
                        </div>
                    </div>
                    <span style={{ fontSize: "2.6rem" }}>{isPttPressed ? "🔊" : "🎙️"}</span>
                </div>

                {/* BOTÓN 3: RUTA DE EVACUACIÓN / BRÚJULA HACIA OBJETIVO REAL */}
                <div
                    style={{
                        flex: 1, width: "100%", borderRadius: "18px",
                        background: "rgba(8, 16, 32, 0.95)",
                        border: "2px solid #00E5FF",
                        color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "0 24px"
                    }}
                >
                    <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#00E5FF", letterSpacing: "1px" }}>
                                🧭 RUTA DE EVACUACIÓN
                            </div>
                            {waypoints.length > 1 && (
                                <button
                                    onClick={handleCycleWaypoint}
                                    style={{
                                        background: "rgba(0, 229, 255, 0.15)",
                                        border: "1px solid #00E5FF",
                                        borderRadius: "6px",
                                        color: "#00E5FF",
                                        fontSize: "0.68rem",
                                        padding: "2px 8px",
                                        cursor: "pointer",
                                        fontWeight: 800
                                    }}
                                    title="Cambiar al siguiente waypoint"
                                >
                                    CAMBIAR ({selectedWpIdx + 1}/{waypoints.length})
                                </button>
                            )}
                        </div>

                        {/* Nombre del Objetivo y Distancia Métrica */}
                        <div style={{ fontSize: "0.85rem", color: "#FFF", fontWeight: 800, marginTop: "4px" }}>
                            {activeTarget ? (
                                <span>🚩 {activeTarget.name} {distanceMeters !== null ? `· ${distanceMeters > 1000 ? `${(distanceMeters / 1000).toFixed(2)} km` : `${distanceMeters} m`}` : ""}</span>
                            ) : (
                                <span style={{ color: "#FFAA00" }}>⚠️ Sin waypoints configurados</span>
                            )}
                        </div>

                        <div style={{ fontSize: "0.78rem", color: "#88CCEE", marginTop: "2px", fontFamily: "JetBrains Mono, monospace" }}>
                            Azimut: {targetBearing}° · Rumbo Actual: {heading}°
                        </div>

                        <div style={{ fontSize: "0.72rem", color: "#8892B0", marginTop: "4px", display: "flex", gap: "8px", alignItems: "center" }}>
                            {gpsCoords ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        copyCoordinates(gpsCoords.lat, gpsCoords.lng);
                                    }}
                                    style={{
                                        background: "rgba(0, 229, 255, 0.1)",
                                        border: "1px solid rgba(0, 229, 255, 0.3)",
                                        borderRadius: "6px",
                                        padding: "2px 6px",
                                        color: "#00E5FF",
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        fontFamily: "JetBrains Mono, monospace",
                                        fontSize: "0.70rem"
                                    }}
                                    title="Clic para copiar coordenadas GPS"
                                >
                                    <span>Lat: {gpsCoords.lat.toFixed(4)}, Lng: {gpsCoords.lng.toFixed(4)}</span>
                                    <span style={{ fontSize: "0.62rem" }}>📋</span>
                                </button>
                            ) : "Adquiriendo GPS..."}

                            {!activeTarget && gpsCoords && (
                                <button
                                    onClick={handleSetCurrentAsRallyPoint}
                                    style={{
                                        background: "rgba(0, 230, 118, 0.2)",
                                        border: "1px solid #00E676",
                                        borderRadius: "6px",
                                        padding: "2px 8px",
                                        color: "#00E676",
                                        cursor: "pointer",
                                        fontWeight: 800,
                                        fontSize: "0.70rem"
                                    }}
                                >
                                    + Fijar Punto Base
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Flecha Direccional 3D Orientada por Azimut y Giroscopio */}
                    <div style={{
                        width: 70, height: 70, borderRadius: "50%",
                        background: "rgba(0, 229, 255, 0.15)",
                        border: "2px solid #00E5FF",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transform: `rotate(${arrowAngle}deg)`,
                        transition: "transform 0.2s ease-out",
                        flexShrink: 0
                    }}>
                        <span style={{ fontSize: "2.2rem", color: "#00E5FF" }}>⬆️</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExtremeSurvivalHudModal;
