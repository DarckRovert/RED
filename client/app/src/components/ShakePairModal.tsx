"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { RedAPI } from "../lib/api";
import { meshRouter } from "../lib/mesh/meshRouter";
import { KineticDutyGovernor } from "../lib/sensors/KineticDutyGovernor";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";

export const ShakePairModal: React.FC = () => {
    const { navigate, goBack, identity, addContact, contacts, fetchData } = useRedStore();
    const { t } = useTranslation();
    const [isListening, setIsListening] = useState(false);
    const [accMagnitude, setAccMagnitude] = useState<number>(0);
    const [accAxes, setAccAxes] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
    const [shakeDetected, setShakeDetected] = useState<boolean>(false);
    const [statusText, setStatusText] = useState<string>("Sacude el teléfono para vincular nodos cercanos");
    const [pairedDevice, setPairedDevice] = useState<{ did: string; name: string; isAlreadyAdded: boolean } | null>(null);

    const SHAKE_THRESHOLD = 7.5; // m/s^2 delta de aceleración sobre gravedad
    const lastShakeTimeRef = useRef<number>(0);

    // Intercepción LIFO de hardware Android y tecla Escape
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (pairedDevice) {
                TacticalAudioEngine.playTap();
                setPairedDevice(null);
                return true;
            }
            TacticalAudioEngine.playTap();
            goBack();
            return true;
        });
        return () => unregister();
    }, [pairedDevice, goBack]);

    // Deduplicación de contactos para evitar registros redundantes
    const checkExistingContact = useCallback((candidateHash: string, candidateName?: string) => {
        if (!candidateHash) return { exists: false, contact: null };
        let clean = candidateHash.trim();
        if (clean.startsWith("did:red:")) clean = clean.replace(/^did:red:/i, "");
        if (clean.includes(":") && !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(clean)) {
            const parts = clean.split(":");
            if (parts[0].length >= 16) clean = parts[0].trim();
        }
        clean = clean.toLowerCase();
        const canonical = meshRouter.getCanonicalId(clean) || clean;
        const shortCandidate = canonical.slice(0, 8);
        const contactsList = contacts || [];

        const isGeneric = (n?: string) => !n || n.startsWith('Operador ') || n.startsWith('Nodo ') || n.startsWith('Par Escaneado') || n === 'Nuevo Par' || n === 'Par Malla';

        const found = contactsList.find((c: any) => {
            if (!c) return false;
            let cHash = (c.identity_hash || c.id || c.did || "").trim();
            if (cHash.startsWith("did:red:")) cHash = cHash.replace(/^did:red:/i, "");
            if (cHash.includes(":") && !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(cHash)) {
                const parts = cHash.split(":");
                if (parts[0].length >= 16) cHash = parts[0].trim();
            }
            cHash = cHash.toLowerCase();
            const cCanonical = meshRouter.getCanonicalId(cHash) || cHash;
            const cShort = cCanonical.slice(0, 8);
            if (cCanonical === canonical || cHash === clean || (cCanonical.length >= 8 && canonical.length >= 8 && cShort === shortCandidate)) {
                return true;
            }
            if (candidateName && !isGeneric(candidateName) && !isGeneric(c.display_name)) {
                const cName = c.display_name.trim().toLowerCase();
                const candName = candidateName.trim().toLowerCase();
                if (cName === candName || cName === `red-${candName}` || `red-${cName}` === candName) return true;
            }
            return false;
        });

        return { exists: !!found, contact: found };
    }, [contacts]);

    const processCandidatePeer = useCallback(async (peerHash: string, peerName: string, peerPk: string | null = null) => {
        let cleanHash = peerHash.trim();
        if (cleanHash.startsWith("did:red:")) cleanHash = cleanHash.replace(/^did:red:/i, "");
        if (cleanHash.includes(":") && !/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i.test(cleanHash)) {
            const parts = cleanHash.split(":");
            if (parts[0].length >= 16) cleanHash = parts[0].trim();
        }
        const { exists, contact } = checkExistingContact(cleanHash, peerName);

        if (exists) {
            const actualName = contact?.display_name || peerName;
            setPairedDevice({
                did: `did:red:${cleanHash}`,
                name: actualName,
                isAlreadyAdded: true
            });
            setStatusText(`ℹ️ Nodo cercano previamente vinculado: ${actualName}`);
            TacticalAudioEngine.playTap();
            toast.info(`ℹ️ ${actualName} ya forma parte de tu lista de contactos.`);
        } else {
            const resolvedHash = await addContact(cleanHash, peerName, peerPk);
            try { await RedAPI.syncContactProfile(resolvedHash || cleanHash); } catch {}
            setPairedDevice({
                did: `did:red:${resolvedHash || cleanHash}`,
                name: peerName,
                isAlreadyAdded: false
            });
            setStatusText(`✅ ¡VINCULADO! Conectado con ${peerName}`);
            TacticalAudioEngine.playRogerBeep();
            toast.success(`📳 Sacudida exitosa: Vinculado con ${peerName}`);
        }
        setShakeDetected(false);
        fetchData();
    }, [checkExistingContact, addContact, fetchData]);

    // 1. Receptor P2P Mesh de Pulso de Emparejamiento
    useEffect(() => {
        const unsub = meshRouter.onShakePair((peer) => {
            if (!peer || !peer.identity_hash || peer.identity_hash === identity?.identity_hash) return;
            console.log(`[ShakePairModal] Received P2P Shake Pulse from ${peer.display_name} (${peer.identity_hash.slice(0, 8)})`);
            
            if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([150, 80, 150]);
            }
            
            processCandidatePeer(peer.identity_hash, peer.display_name || `Nodo ${peer.identity_hash.slice(0, 8)}`, peer.public_key || null);
        });

        return () => {
            unsub();
        };
    }, [identity, processCandidatePeer]);

    // 2. Listener del Sensor Acelerómetro de Hardware (MEMS)
    useEffect(() => {
        const handleMotion = (e: DeviceMotionEvent) => {
            const linearAcc = e.acceleration;
            const gravAcc = e.accelerationIncludingGravity;
            const acc = linearAcc?.x != null ? linearAcc : gravAcc;
            if (!acc) return;

            const x = acc.x || 0;
            const y = acc.y || 0;
            const z = acc.z || 0;
            setAccAxes({
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10,
                z: Math.round(z * 10) / 10
            });

            const rawMag = Math.sqrt(x * x + y * y + z * z);
            // Delta efectivo respecto a 1G terrestre (9.806 m/s^2)
            const effectiveMag = linearAcc?.x != null ? rawMag : Math.abs(rawMag - 9.806);
            const clampedMag = Math.round(effectiveMag * 10) / 10;
            setAccMagnitude(clampedMag);

            const now = Date.now();
            if (effectiveMag > SHAKE_THRESHOLD && now - lastShakeTimeRef.current > 1800) {
                lastShakeTimeRef.current = now;
                setShakeDetected(true);
                setStatusText("📳 ¡SACUDIDA DETECTADA! Emitiendo pulso de malla P2P...");
                TacticalAudioEngine.playTap();

                // Activar SHAKE_BOOST en el gobernador cinético (acelera BLE a 800ms y eleva potencia a 20 dBm)
                try {
                    KineticDutyGovernor.getInstance().triggerShakeBoost();
                } catch {}

                if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }

                // Difusión real de pulso de emparejamiento sobre BLE, Wi-Fi Direct y WebRTC
                const myNick = identity?.nickname || "Operador RED";
                const myPk = identity?.public_key || null;
                meshRouter.broadcastShakePair(myNick, myPk).catch(() => {});

                // Verificación de proximidad inmediata con nodos de señal fuerte (RSSI >= -75 dBm)
                const allPeers = meshRouter.getAllPeers();
                const nearbyPeer = allPeers.find(p => p.rssi != null && p.rssi >= -75 && p.id !== identity?.identity_hash);
                if (nearbyPeer) {
                    const canonicalId = meshRouter.getCanonicalId(nearbyPeer.id) || nearbyPeer.id;
                    if (canonicalId && canonicalId !== identity?.identity_hash) {
                        processCandidatePeer(canonicalId, nearbyPeer.name || `Nodo ${canonicalId.slice(0, 8)}`, nearbyPeer.publicKey || null);
                    }
                }
            }
        };

        if (typeof window !== "undefined" && "DeviceMotionEvent" in window) {
            window.addEventListener("devicemotion", handleMotion, true);
            setIsListening(true);
        }

        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener("devicemotion", handleMotion, true);
            }
        };
    }, [identity, processCandidatePeer]);

    // Solicitud explícita de permisos de acelerometría para iOS 13+ / Safari WebKit
    const requestSensorPermission = async () => {
        if (typeof window !== "undefined" && typeof (DeviceMotionEvent as any)?.requestPermission === "function") {
            try {
                const response = await (DeviceMotionEvent as any).requestPermission();
                if (response === "granted") {
                    setIsListening(true);
                    toast.success("Sensor inercial activado");
                } else {
                    toast.warning("Permiso de acelerómetro denegado");
                }
            } catch (err) {
                console.warn("[ShakePair] Error solicitando permiso inercial:", err);
            }
        }
    };

    const handleManualEmit = async () => {
        await requestSensorPermission();
        setShakeDetected(true);
        setStatusText("📳 Emitiendo pulso manual de emparejamiento...");

        // Activar SHAKE_BOOST en el gobernador cinético
        try {
            KineticDutyGovernor.getInstance().triggerShakeBoost();
        } catch {}

        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
        const myNick = identity?.nickname || "Operador RED";
        const myPk = identity?.public_key || null;
        meshRouter.broadcastShakePair(myNick, myPk).catch(() => {});

        const allPeers = meshRouter.getAllPeers();
        const validPeer = allPeers.find(p => p.id !== identity?.identity_hash);
        if (validPeer) {
            const canonicalId = meshRouter.getCanonicalId(validPeer.id) || validPeer.id;
            if (canonicalId && canonicalId !== identity?.identity_hash) {
                processCandidatePeer(canonicalId, validPeer.name || `Nodo ${canonicalId.slice(0, 8)}`, validPeer.publicKey || null);
            }
        }
    };

    const handleOpenChat = () => {
        if (!pairedDevice) return;
        TacticalAudioEngine.playTap();
        const clean = pairedDevice.did.replace(/^did:red:/i, "");
        navigate("chat", clean);
    };

    // Progreso porcentual hacia el umbral de disparo (7.5 m/s²)
    const thresholdPct = Math.min(100, Math.round((accMagnitude / SHAKE_THRESHOLD) * 100));

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico C4ISR */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1.5px solid rgba(0, 230, 118, 0.35)",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={() => {
                            if (!BackHandlerRegistry.executeTop()) {
                                TacticalAudioEngine.playTap();
                                goBack();
                            }
                        }}
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
                        background: "linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(0, 150, 255, 0.15) 100%)",
                        border: "1.5px solid rgba(0, 230, 118, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(0, 230, 118, 0.25)"
                    }}>📳</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            SHAKE & PAIR INERCIAL
                        </div>
                        <div style={{ fontSize: "0.68rem", color: isListening ? "var(--accent-emerald, #00E676)" : "#FFB300", fontWeight: 800 }}>
                            {isListening ? "● ACELERÓMETRO ACTIVO" : "○ SENSOR EN ESPERA"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{
                        fontSize: "0.62rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                        background: shakeDetected ? "rgba(0, 230, 118, 0.25)" : "rgba(255, 255, 255, 0.05)",
                        color: shakeDetected ? "#00E676" : "var(--text-secondary)",
                        border: `1px solid ${shakeDetected ? '#00E676' : 'rgba(255,255,255,0.1)'}`
                    }}>
                        {shakeDetected ? "⚡ PULSO MALLA ACTIVO" : "MODO ESCUCHA"}
                    </span>
                </div>
            </header>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, padding: "20px 16px 80px 16px", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
                <div style={{ maxWidth: "480px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" }}>

                    {/* Disco Sensor Inercial Visual */}
                    <div style={{ position: "relative", width: "220px", height: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {/* Anillo de pulso fosforescente */}
                        <div style={{
                            position: "absolute", inset: -10, borderRadius: "50%",
                            border: `2px ${shakeDetected ? 'solid #00E676' : 'dashed rgba(0, 230, 118, 0.25)'}`,
                            animation: shakeDetected ? "pulse 1s infinite" : "none",
                            boxShadow: shakeDetected ? "0 0 25px rgba(0, 230, 118, 0.4)" : "none"
                        }} />

                        <div 
                            onClick={handleManualEmit}
                            style={{
                                width: "180px", height: "180px", borderRadius: "50%",
                                background: "radial-gradient(circle, rgba(14, 30, 24, 0.95) 0%, rgba(6, 14, 10, 0.98) 75%)",
                                border: `2.5px solid ${shakeDetected ? "#00E676" : "rgba(0, 230, 118, 0.4)"}`,
                                boxShadow: "0 0 35px rgba(0, 230, 118, 0.2), inset 0 0 20px rgba(0, 230, 118, 0.1)",
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center", gap: "4px",
                                cursor: "pointer", transition: "transform 0.15s ease"
                            }}
                        >
                            <span style={{ fontSize: "2.8rem" }}>📳</span>
                            <span style={{ fontSize: "1.4rem", fontWeight: 900, color: "#00E676" }}>
                                {accMagnitude} <span style={{ fontSize: "0.75rem" }}>m/s²</span>
                            </span>
                            <span style={{ fontSize: "0.62rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 800 }}>
                                TOCA O SACUDE
                            </span>
                        </div>
                    </div>

                    {/* Barra de Progreso hacia Umbral de Disparo (7.5 m/s²) */}
                    <div style={{
                        width: "100%", background: "rgba(14, 18, 38, 0.9)",
                        border: "1px solid rgba(0, 230, 118, 0.2)", borderRadius: "14px",
                        padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 900 }}>
                            <span style={{ color: "var(--text-secondary)" }}>UMBRAL DE DISPARO INERCIAL:</span>
                            <span style={{ color: thresholdPct >= 100 ? "#00E676" : "#00E5FF" }}>
                                {accMagnitude} / {SHAKE_THRESHOLD} m/s² ({thresholdPct}%)
                            </span>
                        </div>
                        <div style={{ width: "100%", height: "8px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "4px", overflow: "hidden" }}>
                            <div style={{
                                width: `${thresholdPct}%`, height: "100%",
                                background: thresholdPct >= 100 ? "linear-gradient(90deg, #00E676, #00E5FF)" : "linear-gradient(90deg, #00B0FF, #00E676)",
                                transition: "width 0.1s ease"
                            }} />
                        </div>
                        {/* Vectores Triaxiales */}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-secondary)", paddingTop: "4px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                            <span>X: <strong style={{ color: "#FFFFFF" }}>{accAxes.x}</strong></span>
                            <span>Y: <strong style={{ color: "#FFFFFF" }}>{accAxes.y}</strong></span>
                            <span>Z: <strong style={{ color: "#FFFFFF" }}>{accAxes.z}</strong> m/s²</span>
                            <span>PERFIL: <strong style={{ color: "#00E676" }}>SHAKE_BOOST</strong></span>
                        </div>
                    </div>

                    {/* Estado y Guía Táctica */}
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFFFFF" }}>
                            {statusText}
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.4 }}>
                            Junta dos dispositivos RED y sacúdelos simultáneamente. El enlace físico cruzará paquetes criptográficos P2P sin tocar internet.
                        </div>
                    </div>

                    {/* Botón de Pulso Manual Táctico */}
                    <button
                        onClick={handleManualEmit}
                        style={{
                            width: "100%", padding: "12px", borderRadius: "12px",
                            background: "linear-gradient(135deg, #00E676 0%, #00897B 100%)",
                            border: "none", color: "#000000", fontWeight: 900, fontSize: "0.82rem",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                            boxShadow: "0 0 20px rgba(0, 230, 118, 0.3)"
                        }}
                    >
                        <span>📡</span> EMITIR PULSO MANUAL DE VINCULACIÓN
                    </button>

                    {/* Tarjeta de Dispositivo Vinculado */}
                    {pairedDevice && (
                        <div style={{
                            width: "100%", padding: "16px", borderRadius: "16px",
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid #00E676", boxShadow: "0 0 25px rgba(0, 230, 118, 0.25)",
                            display: "flex", flexDirection: "column", gap: "10px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#FFFFFF" }}>
                                        {pairedDevice.name}
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {pairedDevice.did.substring(0, 24)}…
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: "0.65rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                                    background: "rgba(0, 230, 118, 0.2)", color: "#00E676", border: "1px solid #00E676"
                                }}>
                                    {pairedDevice.isAlreadyAdded ? "EXISTENTE" : "NUEVO CONTACTO"}
                                </span>
                            </div>

                            <button
                                onClick={handleOpenChat}
                                style={{
                                    width: "100%", padding: "10px", borderRadius: "10px",
                                    background: "linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(0, 180, 80, 0.15) 100%)",
                                    border: "1px solid #00E676", color: "#00E676",
                                    fontWeight: 900, fontSize: "0.78rem", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                                }}
                            >
                                <span>💬</span> ABRIR CHAT CIFRADO
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};