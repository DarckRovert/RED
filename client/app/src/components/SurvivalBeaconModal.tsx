"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { registerPlugin, Capacitor } from "@capacitor/core";
import { useRedStore } from "../store/useRedStore";
import { SoundMeshEngine, SoundMeshPacket } from "../lib/SoundMeshEngine";
import { meshSosBeacon } from "../lib/emergency/MeshSosBeaconEngine";
import { RedAPI, EmergencyBeaconRecord } from "../lib/api";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { opticalMorseLiFi, MorseTransmissionState } from "../lib/sensors/OpticalMorseLiFiEngine";

type BeaconTab = "sos" | "actuators" | "soundmesh" | "feed";

export function SurvivalBeaconModal() {
    const { navigate, identity } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<BeaconTab>("sos");

    // Hardware SOS States
    const [flashActive, setFlashActive] = useState(false);
    const [soundSirenActive, setSoundSirenActive] = useState(false);
    const [screenFlashActive, setScreenFlashActive] = useState(false);
    const [screenColor, setScreenColor] = useState<"#E8213A" | "#00E676">("#E8213A");

    // Mesh SOS Beacon States
    const [meshSosActive, setMeshSosActive] = useState(false);
    const [myBeaconId, setMyBeaconId] = useState<string | null>(null);
    const [distressType, setDistressType] = useState<string>("SOS_GENERAL");
    const [customSosNote, setCustomSosNote] = useState<string>("");
    const [nearbyBeacons, setNearbyBeacons] = useState<EmergencyBeaconRecord[]>([]);
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    // Telemetry from Device Hardware
    const [coords, setCoords] = useState<{ lat?: number; lon?: number; alt?: number }>({});
    const [batteryLevel, setBatteryLevel] = useState<number>(() => {
        if (typeof window !== "undefined" && typeof (window as any).__red_last_battery === "number") {
            return (window as any).__red_last_battery;
        }
        return 100;
    });

    // SoundMesh Ultrasonic Modem states
    const localHash = (identity?.identity_hash || "LOCAL_NODE").substring(0, 8).toUpperCase();
    const [soundMeshMsg, setSoundMeshMsg] = useState(`${localHash}:RED_SOS_ACTIVE`);
    const [isTransmitting, setIsTransmitting] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [receivedPackets, setReceivedPackets] = useState<SoundMeshPacket[]>([]);

    // Morse Li-Fi Transceiver States
    const [customMorseMsg, setCustomMorseMsg] = useState<string>("SOS");
    const [isMorseLiFiTransmitting, setIsMorseLiFiTransmitting] = useState<boolean>(false);
    const [morseState, setMorseState] = useState<MorseTransmissionState>({
        isTransmitting: false, currentWord: '', currentChar: '', progressPercent: 0, wpm: 12
    });

    useEffect(() => {
        const unsub = opticalMorseLiFi.subscribe(setMorseState);
        return unsub;
    }, []);

    const handleTransmitMorse = async () => {
        if (!customMorseMsg.trim()) {
            toast.error("Ingresa un mensaje para transmitir");
            return;
        }
        setIsMorseLiFiTransmitting(true);
        toast.info("Iniciando transmisión óptica Li-Fi...");
        try {
            await opticalMorseLiFi.transmitMessage(customMorseMsg, 12, { useTorch: true, useAudio: true });
            toast.success("Transmisión Li-Fi finalizada");
        } catch {
            toast.error("Error en transmisión Li-Fi");
        } finally {
            setIsMorseLiFiTransmitting(false);
        }
    };

    const audioCtxRef = useRef<AudioContext | null>(null);
    const sirenOscRef = useRef<OscillatorNode | null>(null);
    const flashIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const beaconStreamRef = useRef<MediaStream | null>(null);

    // ── 0. Carga de Balizas SOS Activas desde Rust Sled DB ─────────────────────────
    const loadBeacons = useCallback(async () => {
        try {
            const list = await RedAPI.getEmergencyBeacons();
            if (Array.isArray(list)) {
                setNearbyBeacons(list);
                const mine = list.find(b => b.is_mine && b.active);
                if (mine) {
                    setMeshSosActive(true);
                    setMyBeaconId(mine.beacon_id);
                }
            }
        } catch {}
    }, []);

    // ── 1. Inicialización y Lectura de Sensores GPS / Batería ───────────────────────
    useEffect(() => {
        loadBeacons();
        const beaconPoll = setInterval(loadBeacons, 4000);

        // GPS Telemetry
        if (typeof navigator !== "undefined" && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setCoords({
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        alt: pos.coords.altitude !== null ? Math.round(pos.coords.altitude) : undefined
                    });
                },
                () => {},
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }

        // Battery Telemetry from Native Capacitor & Web APIs
        const fetchBattery = async () => {
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const cap = window as any;
                    if (cap?.Plugins?.Device?.getBatteryInfo) {
                        const info = await cap.Plugins.Device.getBatteryInfo();
                        if (typeof info?.batteryLevel === "number") {
                            setBatteryLevel(Math.round(info.batteryLevel * 100));
                            return;
                        }
                    }
                }
            } catch {}

            if (typeof navigator !== "undefined" && (navigator as any).getBattery) {
                try {
                    const battery = await (navigator as any).getBattery();
                    setBatteryLevel(Math.round(battery.level * 100));
                    battery.addEventListener?.("levelchange", () => {
                        setBatteryLevel(Math.round(battery.level * 100));
                    });
                } catch {}
            }
        };
        fetchBattery();

        return () => {
            clearInterval(beaconPoll);
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
            try {
                const RedNode = registerPlugin<any>("RedNode");
                RedNode.toggleMorseSosTorch({ active: false }).catch(() => {});
            } catch {}
            SoundMeshEngine.stopListening();
        };
    }, [loadBeacons]);

    // ── 2. Hardware Actuators: Flash LED Morse SOS ─────────────────────────────────
    const toggleFlash = async () => {
        if (flashActive) {
            try {
                const RedNode = registerPlugin<any>("RedNode");
                await RedNode.toggleMorseSosTorch({ active: false });
            } catch {}
            if (flashIntervalRef.current) {
                clearInterval(flashIntervalRef.current);
                flashIntervalRef.current = null;
            }
            if (beaconStreamRef.current) {
                beaconStreamRef.current.getTracks().forEach(t => t.stop());
                beaconStreamRef.current = null;
            }
            setFlashActive(false);
            toast.info("Flash LED SOS detenido");
        } else {
            if (Capacitor.isNativePlatform()) {
                try {
                    const RedNode = registerPlugin<any>("RedNode");
                    const res = await RedNode.toggleMorseSosTorch({ active: true });
                    if (res?.active || res?.success) {
                        setFlashActive(true);
                        toast.success("🚨 Flash LED SOS transmitiendo");
                        return;
                    }
                } catch (err: any) {
                    console.warn("[SurvivalBeacon] Fallo control nativo torch:", err);
                }
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }
                });
                beaconStreamRef.current = stream;
                const track = stream.getVideoTracks()[0];
                const imageCapture = new (window as any).ImageCapture(track);
                const capabilities = await imageCapture.getPhotoCapabilities();

                if (capabilities.torch) {
                    let on = false;
                    flashIntervalRef.current = setInterval(async () => {
                        on = !on;
                        try {
                            await track.applyConstraints({
                                advanced: [{ torch: on } as any]
                            });
                        } catch {}
                    }, 400);
                    setFlashActive(true);
                    toast.success("Flash LED transmitiendo pulsos SOS estroboscópicos");
                } else {
                    toast.error("Tu dispositivo no soporta control de antorcha (Torch)");
                    stream.getTracks().forEach(t => t.stop());
                }
            } catch {
                toast.error("No se pudo acceder a la cámara o flash del dispositivo");
            }
        }
    };

    // ── 3. Hardware Actuators: Sirena Acústica Web Audio ────────────────────────────
    const toggleSiren = () => {
        if (soundSirenActive) {
            if (sirenOscRef.current) {
                try { sirenOscRef.current.stop(); } catch {}
                sirenOscRef.current = null;
            }
            setSoundSirenActive(false);
            toast.info("Sirena acústica detenida");
        } else {
            try {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                const ctx = new AudioCtx();
                audioCtxRef.current = ctx;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(800, ctx.currentTime);

                // Bifrecuencia de penetración acústica (800Hz <-> 1200Hz)
                const now = ctx.currentTime;
                for (let i = 0; i < 120; i++) {
                    osc.frequency.linearRampToValueAtTime(1200, now + i * 0.8 + 0.4);
                    osc.frequency.linearRampToValueAtTime(800, now + (i + 1) * 0.8);
                }

                gain.gain.setValueAtTime(0.35, ctx.currentTime);
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start();
                sirenOscRef.current = osc;
                setSoundSirenActive(true);
                toast.warning("🚨 Sirena sonora de emergencia activada a máxima potencia");
            } catch {
                toast.error("Error al inicializar oscilador Web Audio");
            }
        }
    };

    // ── 4. Estroboscopio de Pantalla ───────────────────────────────────────────────
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        if (screenFlashActive) {
            timer = setInterval(() => {
                setScreenColor(prev => prev === "#E8213A" ? "#00E676" : "#E8213A");
            }, 300);
        }
        return () => { if (timer) clearInterval(timer); };
    }, [screenFlashActive]);

    // ── 5. Mesh SOS Gossip Broadcast ───────────────────────────────────────────────
    const handleToggleMeshSos = async () => {
        if (meshSosActive) {
            // Desactivar baliza SOS
            if (myBeaconId) {
                try {
                    await RedAPI.cancelEmergencyBeacon(myBeaconId);
                } catch {}
            }
            await meshSosBeacon.deactivateSosBeacon(myBeaconId || undefined);
            setMeshSosActive(false);
            setMyBeaconId(null);
            await loadBeacons();
            toast.info("Baliza SOS cancelada en la red malla");
        } else {
            // Activar baliza SOS
            setIsBroadcasting(true);
            try {
                let medInfo = "";
                try {
                    const rawMed = typeof window !== "undefined" ? localStorage.getItem("red_signed_medical_credential") : null;
                    if (rawMed) {
                        const med = JSON.parse(rawMed);
                        if (med.bloodType && med.bloodType !== "ND") {
                            medInfo = ` [Sangre: ${med.bloodType} | Alergias: ${med.allergies || "Ninguna"}]`;
                        }
                    }
                } catch {}

                const note = (customSosNote.trim() || `Alerta SOS: ${distressType}`) + medInfo;
                
                // 1. Registro nativo en Rust Sled si está disponible
                let beaconId = `SOS-${(identity?.identity_hash || 'LOCAL').substring(0, 8)}`;
                try {
                    const res = await RedAPI.broadcastEmergencyBeacon({
                        distress_type: distressType,
                        latitude: coords.lat,
                        longitude: coords.lon,
                        altitude: coords.alt,
                        battery_pct: batteryLevel,
                        custom_note: note
                    });
                    if (res && res.beacon_id) beaconId = res.beacon_id;
                } catch {}

                // 2. Activación en el motor soberano MeshSosBeaconEngine
                const beaconPkt = await meshSosBeacon.activateSosBeacon({
                    coords,
                    distressType: (distressType === 'TCCC_MEDICAL' ? 'TCCC_MEDICAL' : 'GENERAL_DISTRESS'),
                    triageColor: 'RED',
                    note,
                    batteryLevel,
                }, identity?.identity_hash || 'LOCAL_OP', identity?.nickname || 'Operador en Peligro');

                setMeshSosActive(true);
                setMyBeaconId(beaconId || beaconPkt.id);
                await loadBeacons();
                toast.error(`🚨 BALIZA SOS ACTIVADA: ${beaconId || beaconPkt.id}`);
            } catch {
                toast.error("Fallo al emitir baliza por red mesh");
            } finally {
                setIsBroadcasting(false);
            }
        }
    };

    // ── 6. SoundMesh Ultrasonic Modem ─────────────────────────────────────────────
    const handleTransmitSoundMesh = async () => {
        if (!soundMeshMsg.trim() || isTransmitting) return;
        setIsTransmitting(true);
        toast.info("🔊 Transmitiendo paquete por ultrasonido FSK...");
        try {
            await SoundMeshEngine.transmit(soundMeshMsg.trim());
            toast.success("Paquete acústico propagado");
        } catch {
            toast.error("Error en modulación acústica");
        } finally {
            setIsTransmitting(false);
        }
    };

    const handleToggleListenSoundMesh = async () => {
        if (isListening) {
            SoundMeshEngine.stopListening();
            setIsListening(false);
            toast.info("Receptor acústico apagado");
        } else {
            const ok = await SoundMeshEngine.startListening((packet) => {
                setReceivedPackets(prev => [packet, ...prev]);
                toast.success(`Paquete ultrasonido recibido: "${packet.rawText}"`);
            });
            if (ok) {
                setIsListening(true);
                toast.info("Escuchando canal de ultrasonido aéreo (18-20 kHz)...");
            } else {
                toast.error("No se pudo acceder al micrófono para escucha acústica");
            }
        }
    };

    return (
        <div className="modal-screen-container" style={{
            background: screenFlashActive ? screenColor : "var(--bg-void)",
            transition: screenFlashActive ? "background 0.15s ease" : "none"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                borderBottom: "1.5px solid rgba(255, 51, 85, 0.35)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={() => navigate("sidebar")}
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#FFFFFF", cursor: "pointer", fontSize: "1.1rem", fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                    >
                        ‹
                    </button>
                    <div style={{
                        width: 38, height: 38, borderRadius: "12px",
                        background: meshSosActive ? "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" : "linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem",
                        boxShadow: meshSosActive ? "0 0 20px rgba(232,33,58,0.6)" : "0 4px 16px rgba(255,179,0,0.3)"
                    }}>🚨</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            {t.sos_module?.title || "BALIZA SOS & RESCATE"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: meshSosActive ? "#FF3355" : "#FFB300", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            {meshSosActive ? `● ${t.sos_module?.active_banner || "TRANSMISIÓN SOS ACTIVA EN MALLA"}` : "MODO GUARDIA · STANDBY"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate("sidebar")}
                    style={{
                        width: 34, height: 34, borderRadius: "9px",
                        background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#FFFFFF", cursor: "pointer", fontSize: "0.9rem", fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                >
                    ✕
                </button>
            </header>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("sos")}
                    className={activeTab === "sos" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🚨 {t.sos_module?.tab_sos || "Baliza SOS Mesh"}
                </button>
                <button
                    onClick={() => setActiveTab("actuators")}
                    className={activeTab === "actuators" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🔦 {t.sos_module?.tab_actuators || "Actuadores Hardware"}
                </button>
                <button
                    onClick={() => setActiveTab("soundmesh")}
                    className={activeTab === "soundmesh" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🔊 {t.sos_module?.tab_soundmesh || "Módem SoundMesh"}
                </button>
                <button
                    onClick={() => setActiveTab("feed")}
                    className={activeTab === "feed" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    📡 {t.sos_module?.tab_feed || "Balizas en Malla"} ({nearbyBeacons.length})
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: BALIZA SOS MESH ───────────────────────────────── */}
                    {activeTab === "sos" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: meshSosActive ? "var(--accent-crimson-bright)" : "var(--text-primary)" }}>
                                        Transmisor de Emergencia de Alta Prioridad
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Propagación omnidireccional en Gossipsub Mesh + Almacenamiento local Sled DB
                                    </div>
                                </div>
                                <span className={`badge-tactical ${meshSosActive ? "badge-tactical-crimson" : "badge-tactical-emerald"}`}>
                                    {meshSosActive ? "EMITIENDO" : "LISTO"}
                                </span>
                            </div>

                            {/* Telemetría Actual en Vivo */}
                            <div className="hud-grid">
                                <div className="hud-metric">
                                    <div className="hud-metric-label">Latitud / Longitud</div>
                                    <div className="hud-metric-val" style={{ fontSize: "0.9rem", color: "var(--accent-cyan)" }}>
                                        {coords.lat && coords.lon ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` : "Buscando GPS..."}
                                    </div>
                                </div>
                                <div className="hud-metric">
                                    <div className="hud-metric-label">Altitud GPS</div>
                                    <div className="hud-metric-val" style={{ fontSize: "0.9rem", color: "var(--accent-emerald)" }}>
                                        {coords.alt !== undefined ? `${coords.alt} msnm` : "N/D"}
                                    </div>
                                </div>
                                <div className="hud-metric">
                                    <div className="hud-metric-label">Nivel de Batería</div>
                                    <div className="hud-metric-val" style={{ fontSize: "0.9rem", color: "var(--accent-amber)" }}>
                                        {batteryLevel !== undefined ? `${batteryLevel}%` : "N/D"}
                                    </div>
                                </div>
                            </div>

                            {/* Selector de Tipo de Socorro */}
                            {!meshSosActive && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                        TIPO DE EMERGENCIA / PROTOCOLO SAR:
                                    </label>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                        {[
                                            { id: "SOS_GENERAL", label: "⚠️ Auxilio General", desc: "Emergencia no clasificada" },
                                            { id: "SOS_MEDICO", label: "🫀 Rescate Médico", desc: "Heridos de gravedad o trauma" },
                                            { id: "SOS_ATRAPADO", label: "🏚️ Víctima Atrapada", desc: "Colapso estructural o cueva" },
                                            { id: "SOS_HOSTIL", label: "🛡️ Amenaza Hostil", desc: "Zona de combate o asalto" }
                                        ].map((t) => (
                                            <div
                                                key={t.id}
                                                onClick={() => setDistressType(t.id)}
                                                className="card-tactical-interactive"
                                                style={{
                                                    padding: "10px 12px",
                                                    borderColor: distressType === t.id ? "var(--accent-crimson)" : "var(--glass-border)",
                                                    background: distressType === t.id ? "rgba(232,33,58,0.15)" : "var(--bg-card)"
                                                }}
                                            >
                                                <div style={{ fontWeight: 800, fontSize: "0.85rem", color: distressType === t.id ? "var(--accent-crimson-bright)" : "var(--text-primary)" }}>
                                                    {t.label}
                                                </div>
                                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                                    {t.desc}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <input
                                        value={customSosNote}
                                        onChange={e => setCustomSosNote(e.target.value)}
                                        placeholder="Nota táctica adicional (ej. 2 adultos, falta agua, piso 3)"
                                        style={{ marginTop: "6px" }}
                                    />
                                </div>
                            )}

                            {/* Botón Maestro de Activación SOS */}
                            <button
                                onClick={handleToggleMeshSos}
                                disabled={isBroadcasting}
                                className="btn-tactical-primary"
                                style={{
                                    width: "100%", padding: "16px",
                                    background: meshSosActive
                                        ? "linear-gradient(135deg, #333 0%, #111 100%)"
                                        : "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                                    boxShadow: meshSosActive ? "none" : "0 0 30px rgba(232,33,58,0.5)",
                                    fontSize: "1.05rem", fontWeight: 900,
                                    border: meshSosActive ? "1px solid rgba(255,255,255,0.2)" : "none"
                                }}
                            >
                                {isBroadcasting
                                    ? "Procesando señal..."
                                    : meshSosActive
                                        ? "🛑 CANCELAR TRANSMISIÓN SOS ACTIVA"
                                        : "🚨 TRANSMITIR BALIZA SOS A LA RED MALLA"}
                            </button>
                        </div>
                    )}

                    {/* ─── TAB 2: ACTUADORES DE HARDWARE ───────────────────────── */}
                    {activeTab === "actuators" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-amber)" }}>
                                    🔦 Actuadores de Señalización de Emergencia
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Mecanismos ópticos y acústicos de alta intensidad para rescate físico nocturno
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {/* Flash LED Morse SOS */}
                                <div
                                    onClick={toggleFlash}
                                    className="card-tactical-interactive"
                                    style={{
                                        padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                                        borderColor: flashActive ? "var(--accent-amber)" : "var(--glass-border)",
                                        background: flashActive ? "rgba(255,179,0,0.15)" : "var(--bg-card)"
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <span style={{ fontSize: "1.8rem" }}>⚡</span>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>Flash LED Cámara (Morse SOS)</div>
                                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                                Pulsos estroboscópicos ópticos de alta frecuencia (··· ——— ···)
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`badge-tactical ${flashActive ? "badge-tactical-amber" : "badge-tactical"}`}>
                                        {flashActive ? "ACTIVO" : "APAGADO"}
                                    </span>
                                </div>

                                {/* Sirena Acústica Web Audio */}
                                <div
                                    onClick={toggleSiren}
                                    className="card-tactical-interactive"
                                    style={{
                                        padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                                        borderColor: soundSirenActive ? "var(--accent-crimson-bright)" : "var(--glass-border)",
                                        background: soundSirenActive ? "rgba(232,33,58,0.15)" : "var(--bg-card)"
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <span style={{ fontSize: "1.8rem" }}>📢</span>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>Sirena Acústica 90dB (Bifrecuencia)</div>
                                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                                Tono de penetración sonora oscilante (800Hz - 1200Hz)
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`badge-tactical ${soundSirenActive ? "badge-tactical-crimson" : "badge-tactical"}`}>
                                        {soundSirenActive ? "SONANDO" : "APAGADO"}
                                    </span>
                                </div>

                                {/* Pantalla Flash Estroboscópica */}
                                <div
                                    onClick={() => setScreenFlashActive(!screenFlashActive)}
                                    className="card-tactical-interactive"
                                    style={{
                                        padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                                        borderColor: screenFlashActive ? "var(--accent-emerald)" : "var(--glass-border)",
                                        background: screenFlashActive ? "rgba(0,230,118,0.15)" : "var(--bg-card)"
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <span style={{ fontSize: "1.8rem" }}>🚨</span>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>Estroboscopio de Pantalla OLED</div>
                                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                                Destellos alternantes de pantalla completa a máximo brillo
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`badge-tactical ${screenFlashActive ? "badge-tactical-emerald" : "badge-tactical"}`}>
                                        {screenFlashActive ? "ESTROBO ON" : "APAGADO"}
                                    </span>
                                </div>

                                {/* Transmisor Óptico Li-Fi / Código Morse de Texto Arbitrario */}
                                <div style={{
                                    marginTop: '8px', padding: '16px', borderRadius: '14px',
                                    background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)',
                                    display: 'flex', flexDirection: 'column', gap: '10px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#00E5FF' }}>
                                            💡 Transmisor Óptico Li-Fi / Morse Air-Gapped
                                        </div>
                                        <span style={{ fontSize: '0.68rem', color: '#AAA' }}>Zero-RF EW</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#AAA' }}>
                                        Codifica cualquier mensaje de texto a pulsos ópticos temporizados por Flash LED y pantalla completa.
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            value={customMorseMsg}
                                            onChange={(e) => setCustomMorseMsg(e.target.value)}
                                            placeholder="Escribe mensaje (ej: SOS EXTRACCION NORTE)..."
                                            style={{
                                                flex: 1, padding: '8px 12px', borderRadius: '8px',
                                                background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)',
                                                color: '#FFF', fontSize: '0.8rem', fontFamily: 'monospace'
                                            }}
                                        />
                                        <button
                                            onClick={handleTransmitMorse}
                                            disabled={isMorseLiFiTransmitting}
                                            style={{
                                                padding: '8px 14px', borderRadius: '8px',
                                                background: isMorseLiFiTransmitting ? '#555' : 'linear-gradient(135deg, #00E5FF, #00B0FF)',
                                                color: '#000', fontWeight: 800, fontSize: '0.76rem', border: 'none', cursor: 'pointer'
                                            }}
                                        >
                                            {isMorseLiFiTransmitting ? "📡 ENVIANDO..." : "⚡ ENVIAR LI-FI"}
                                        </button>
                                    </div>
                                    {isMorseLiFiTransmitting && (
                                        <div style={{ fontSize: '0.7rem', color: '#00E5FF', fontFamily: 'monospace' }}>
                                            Transmitiendo: {morseState.currentChar} ({morseState.progressPercent}%)
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 3: MÓDEM SOUNDMESH ULTRASONIDO ──────────────────── */}
                    {activeTab === "soundmesh" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                        🔊 Módem Acústico Aéreo (SoundMesh)
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Comunicaciones de datos por ultrasonido (18-20 kHz) sin WiFi ni Bluetooth
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-cyan">FSK MODULATION</span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    PAQUETE DE DATOS A TRANSMITIR (AUDIO FSK):
                                </label>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <input
                                        value={soundMeshMsg}
                                        onChange={e => setSoundMeshMsg(e.target.value)}
                                        placeholder="Carga útil (Payload)"
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        onClick={handleTransmitSoundMesh}
                                        disabled={isTransmitting}
                                        className="btn-tactical-primary"
                                        style={{ padding: "10px 18px", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                                    >
                                        {isTransmitting ? "🔊 Emitiendo..." : "🔊 Emitir"}
                                    </button>
                                </div>

                                <button
                                    onClick={handleToggleListenSoundMesh}
                                    className="btn-tactical-secondary"
                                    style={{ width: "100%", padding: "12px", marginTop: "4px" }}
                                >
                                    {isListening ? "🛑 Detener Escucha Acústica" : "🎙️ Iniciar Escucha de Ultrasonido"}
                                </button>

                                {/* Feed de Paquetes Recibidos */}
                                {receivedPackets.length > 0 && (
                                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                        <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                            Paquetes Acústicos Capturados ({receivedPackets.length}):
                                        </div>
                                        {receivedPackets.map((pkt, i) => (
                                            <div
                                                key={i}
                                                className="card-tactical"
                                                style={{ padding: "10px 12px", borderLeft: "3px solid var(--accent-cyan)", fontSize: "0.80rem" }}
                                            >
                                                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{pkt.rawText}</div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                                    {new Date(pkt.timestamp).toLocaleTimeString()} · FSK Carrier Decoded
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 4: BALIZAS EN MALLA ──────────────────────────────── */}
                    {activeTab === "feed" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                        📡 Radar de Balizas de Emergencia en la Malla
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Alertas de rescate recibidas de nodos vecinos en tiempo real
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-emerald">LIVE MESH</span>
                            </div>

                            {nearbyBeacons.length === 0 ? (
                                <div className="empty-state-tactical">
                                    <div className="empty-state-icon">📡</div>
                                    <div className="empty-state-title">Malla Libre de Alertas SOS</div>
                                    <div className="empty-state-desc">
                                        No se registran transmisiones de socorro activas en el rango de cobertura P2P.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {nearbyBeacons.map((b) => (
                                        <div
                                            key={b.beacon_id}
                                            className="card-tactical"
                                            style={{
                                                padding: "14px",
                                                borderLeft: b.is_mine ? "4px solid var(--accent-cyan)" : "4px solid var(--accent-crimson-bright)"
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <strong style={{ color: b.is_mine ? "var(--accent-cyan)" : "var(--accent-crimson-bright)", fontSize: "0.90rem" }}>
                                                    {b.is_mine ? "🚨 TU BALIZA SOS ACTIVA" : `🚨 ${b.distress_type}`}
                                                </strong>
                                                <span className="badge-tactical badge-tactical-crimson">ACTIVA</span>
                                            </div>

                                            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "6px" }}>
                                                {b.custom_note || "Sin nota adicional"}
                                            </div>

                                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "6px", display: "flex", gap: "12px", fontFamily: "JetBrains Mono, monospace" }}>
                                                <span>Emisor: {b.sender_hash?.substring(0, 8)}…</span>
                                                {b.latitude && b.longitude && (
                                                    <span style={{ color: "var(--accent-cyan)" }}>
                                                        📍 GPS: {b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}
                                                    </span>
                                                )}
                                                {b.battery_pct !== undefined && <span>🔋 {b.battery_pct}%</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}