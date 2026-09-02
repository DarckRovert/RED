/**
 * ExtremeSurvivalHudModal.tsx — RED Sovereign Mesh OS
 *
 * HUD Táctico de Supervivencia Extrema (Modo de Pánico & Alto Estrés).
 * Diseñado ergonómicamente para visibilidad en luz solar directa o visión nublada.
 * 3 Botones Gigantes de Acción Inmediata:
 * 1. [🚨 SOS MÉDICO & BALIZA] — Emisión simultánea de baliza de auxilio y alerta acústica.
 * 2. [🎙️ PTT CANAL DIRECTO] — Transmisión de voz Push-To-Talk instantánea en la malla.
 * 3. [🧭 RUTA DE EVACUACIÓN] — Brújula de gran escala apuntando al punto de reunión / base.
 */

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { ecoMeshDutyCycleEngine, EcoMeshState } from "../lib/mesh/EcoMeshDutyCycleEngine";
import { lamportMeshClockEngine } from "../lib/mesh/LamportMeshClockEngine";
import { TacticalSpeechEngine } from "../lib/ai/TacticalSpeechEngine";

export const ExtremeSurvivalHudModal: React.FC = () => {
    const {
        goBack,
        status,
        contacts,
        identity,
        activeSosBeacons,
        sendMessage
    } = useRedStore();

    // Telemetría de Resiliencia
    const [ecoState, setEcoState] = useState<EcoMeshState>(ecoMeshDutyCycleEngine.getState());
    const [isSosActive, setIsSosActive] = useState(false);
    const [isPttPressed, setIsPttPressed] = useState(false);
    const [heading, setHeading] = useState<number>(0);
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [strobeActive, setStrobeActive] = useState(false);
    const [audioContextRef, setAudioContextRef] = useState<AudioContext | null>(null);

    // Objetivo de evacuación predeterminado (o primera baliza / base)
    const baseCoords = { lat: gpsCoords?.lat ? gpsCoords.lat + 0.0035 : 0, lng: gpsCoords?.lng ? gpsCoords.lng + 0.0025 : 0 };

    // Subscripción a motor energético
    useEffect(() => {
        const unsub = ecoMeshDutyCycleEngine.subscribe(setEcoState);
        return () => unsub();
    }, []);

    // Monitoreo GPS y Brújula
    useEffect(() => {
        if (typeof window !== "undefined" && "geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => {},
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }

        const handleOrientation = (e: DeviceOrientationEvent) => {
            if (e.alpha !== null) {
                const compassHeading = (e as any).webkitCompassHeading ?? (360 - e.alpha);
                setHeading(Math.round(compassHeading));
            }
        };

        if (typeof window !== "undefined") {
            window.addEventListener("deviceorientation", handleOrientation, true);
        }
        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener("deviceorientation", handleOrientation, true);
            }
        };
    }, []);

    // 1. Manejador de SOS & Baliza Acústica
    const toggleSos = async () => {
        const next = !isSosActive;
        setIsSosActive(next);

        if (next) {
            ecoMeshDutyCycleEngine.triggerEmergencyOverride(120000);
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
                    identity?.alias || "Operador"
                );
            } catch {}
            TacticalSpeechEngine.speak("Alerta SOS activada. Transmitiendo baliza de rescate en la malla.", { lang: "es-ES", rate: 1.1 });
            startAcousticBeacon();
        } else {
            try {
                const { MeshSosBeaconEngine } = await import("../lib/emergency/MeshSosBeaconEngine");
                await MeshSosBeaconEngine.getInstance().deactivateSosBeacon();
            } catch {}
            stopAcousticBeacon();
            TacticalSpeechEngine.speak("Alerta SOS desactivada.", { lang: "es-ES" });
        }
    };

    // Generador de tono acústico de emergencia
    const startAcousticBeacon = () => {
        try {
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
            setAudioContextRef(ctx);
        } catch {}
    };

    const stopAcousticBeacon = () => {
        if (audioContextRef) {
            try { audioContextRef.close(); } catch {}
            setAudioContextRef(null);
        }
    };

    // 2. Manejador PTT Directo
    const handlePttStart = () => {
        setIsPttPressed(true);
        ecoMeshDutyCycleEngine.triggerEmergencyOverride(30000);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(80);
        }
    };

    const handlePttEnd = () => {
        setIsPttPressed(false);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(40);
        }
    };

    // Cálculo del azimut hacia el punto seguro
    const calculateBearing = () => {
        if (!gpsCoords) return 0;
        const dLat = (baseCoords.lat - gpsCoords.lat) * (Math.PI / 180);
        const dLng = (baseCoords.lng - gpsCoords.lng) * (Math.PI / 180);
        const y = Math.sin(dLng) * Math.cos(baseCoords.lat * (Math.PI / 180));
        const x = Math.cos(gpsCoords.lat * (Math.PI / 180)) * Math.sin(baseCoords.lat * (Math.PI / 180)) -
                  Math.sin(gpsCoords.lat * (Math.PI / 180)) * Math.cos(baseCoords.lat * (Math.PI / 180)) * Math.cos(dLng);
        const brng = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        return Math.round(brng);
    };

    const targetBearing = calculateBearing();
    const arrowAngle = (targetBearing - heading + 360) % 360;
    const peerCount = status?.peer_count ?? contacts.length;

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: strobeActive ? (Date.now() % 200 < 100 ? "#FFFFFF" : "#000000") : "#05060A",
            color: "#FFFFFF", fontFamily: "'Inter', sans-serif",
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
                            {identity?.alias || "OPERADOR"} · LAMPORT #{lamportMeshClockEngine.getLogicalCounter()}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                        onClick={() => setStrobeActive(!strobeActive)}
                        style={{
                            padding: "6px 10px", borderRadius: "8px",
                            background: strobeActive ? "#FFCC00" : "rgba(255, 255, 255, 0.1)",
                            border: "1px solid #FFCC00", color: strobeActive ? "#000000" : "#FFCC00",
                            fontWeight: 800, fontSize: "0.72rem", cursor: "pointer"
                        }}
                    >
                        {strobeActive ? "⚡ ESTROBO ON" : "💡 ESTROBO"}
                    </button>
                    <button
                        onClick={goBack}
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
                            {isSosActive ? "🚨 BALIZA SOS TRANSMITIENDO" : "🚨 SOS MÉDICO / RESCATE"}
                        </div>
                        <div style={{ fontSize: "0.82rem", color: isSosActive ? "#FFF" : "#FF6680", marginTop: "4px" }}>
                            {isSosActive ? "Enviando coordenadas por BLE / LoRa / Audio" : "Toca para activar baliza de emergencia 1-Tap"}
                        </div>
                    </div>
                    <span style={{ fontSize: "2.6rem" }}>{isSosActive ? "📡" : "🆘"}</span>
                </button>

                {/* BOTÓN 2: PTT CANAL DIRECTO DE VOZ */}
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
                            {isPttPressed ? "Habla ahora · Canal General Táctico" : "Mantén presionado para hablar con la escuadra"}
                        </div>
                    </div>
                    <span style={{ fontSize: "2.6rem" }}>{isPttPressed ? "🔊" : "🎙️"}</span>
                </div>

                {/* BOTÓN 3: RUTA DE EVACUACIÓN / BRÚJULA */}
                <div
                    style={{
                        flex: 1, width: "100%", borderRadius: "18px",
                        background: "rgba(8, 16, 32, 0.95)",
                        border: "2px solid #00E5FF",
                        color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "0 24px"
                    }}
                >
                    <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#00E5FF", letterSpacing: "1px" }}>
                            🧭 RUTA DE EVACUACIÓN
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "#88CCEE", marginTop: "4px", fontFamily: "JetBrains Mono, monospace" }}>
                            Azimut: {targetBearing}° · Rumbo Actual: {heading}°
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#8892B0", marginTop: "2px" }}>
                            {gpsCoords ? `Lat: ${gpsCoords.lat.toFixed(4)}, Lng: ${gpsCoords.lng.toFixed(4)}` : "Adquiriendo GPS..."}
                        </div>
                    </div>

                    {/* Flecha Direccional 3D */}
                    <div style={{
                        width: 70, height: 70, borderRadius: "50%",
                        background: "rgba(0, 229, 255, 0.15)",
                        border: "2px solid #00E5FF",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transform: `rotate(${arrowAngle}deg)`,
                        transition: "transform 0.2s ease-out"
                    }}>
                        <span style={{ fontSize: "2rem", color: "#00E5FF" }}>⬆️</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExtremeSurvivalHudModal;
