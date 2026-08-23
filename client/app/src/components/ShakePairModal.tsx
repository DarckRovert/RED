"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { RedAPI } from "../lib/api";
import { meshRouter } from "../lib/mesh/meshRouter";
import { useTranslation } from "../lib/i18n/i18nEngine";

export const ShakePairModal: React.FC = () => {
    const { navigate, identity, addContact, contacts, fetchData } = useRedStore();
    const { t } = useTranslation();
    const [isListening, setIsListening] = useState(false);
    const [accMagnitude, setAccMagnitude] = useState<number>(0);
    const [shakeDetected, setShakeDetected] = useState<boolean>(false);
    const [statusText, setStatusText] = useState<string>("Sacude el teléfono para vincular nodos cercanos");
    const [pairedDevice, setPairedDevice] = useState<{ did: string; name: string; isAlreadyAdded: boolean } | null>(null);

    const SHAKE_THRESHOLD = 7.5; // m/s^2 above 1G
    const lastShakeTimeRef = useRef<number>(0);

    // Deduplication Helper: check if contact already exists in local contacts list
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
            toast.success(`📳 Sacudida exitosa: Vinculado con ${peerName}`);
        }
        setShakeDetected(false);
        fetchData();
    }, [checkExistingContact, addContact, fetchData]);

    // 1. Direct P2P Mesh Shake-to-Pair packet listener
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

    // 2. Accelerometer Motion Sensor Hardware Listener
    useEffect(() => {
        const handleMotion = (e: DeviceMotionEvent) => {
            const linearAcc = e.acceleration;
            const gravAcc = e.accelerationIncludingGravity;
            const acc = linearAcc?.x != null ? linearAcc : gravAcc;
            if (!acc) return;

            const x = acc.x || 0;
            const y = acc.y || 0;
            const z = acc.z || 0;
            const rawMag = Math.sqrt(x * x + y * y + z * z);
            
            // Effective delta acceleration
            const effectiveMag = linearAcc?.x != null ? rawMag : Math.abs(rawMag - 9.8);
            setAccMagnitude(Math.round(effectiveMag * 10) / 10);

            const now = Date.now();
            if (effectiveMag > SHAKE_THRESHOLD && now - lastShakeTimeRef.current > 1800) {
                lastShakeTimeRef.current = now;
                setShakeDetected(true);
                setStatusText("📳 ¡SACUDIDA DETECTADA! Emitiendo pulso de malla P2P...");

                if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }

                // Broadcast real P2P Shake pulse over BLE, WiFi Direct, and WebRTC
                const myNick = identity?.nickname || "Operador RED";
                const myPk = identity?.public_key || null;
                meshRouter.broadcastShakePair(myNick, myPk).catch(() => {});

                // Near-field scan check: if peer has strong signal (RSSI > -75), link immediately
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

    const handleManualEmit = () => {
        setShakeDetected(true);
        setStatusText("📳 Emitiendo pulso manual de emparejamiento...");
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

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E676 0%, #00897B 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,230,118,0.35)"
                    }}>📳</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.modules?.shake_pair || "Shake-to-Pair (Acelerómetro)"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: isListening ? "var(--accent-emerald)" : "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {isListening ? "● SENSOR INERCIAL ACTIVO" : "SENSOR EN ESPERA"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate("sidebar")}
                    className="btn-icon"
                    title={t.common?.close || "Cerrar"}
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, padding: "24px 20px 80px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px" }}>
                <div style={{ maxWidth: "480px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>

                    {/* Sensor Visual Feedback Ring */}
                    <div style={{ position: "relative", width: "200px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {shakeDetected && (
                            <div style={{
                                position: "absolute", inset: -16, borderRadius: "50%",
                                border: "2px solid var(--accent-emerald)",
                                animation: "pulseGlowEmerald 1s infinite"
                            }} />
                        )}

                        <div 
                            onClick={handleManualEmit}
                            className="card-tactical-interactive"
                            style={{
                                width: "160px", height: "160px", borderRadius: "50%",
                                background: "radial-gradient(circle, rgba(14,30,24,0.9) 0%, rgba(8,16,12,0.98) 70%)",
                                border: `2px solid ${shakeDetected ? "var(--accent-emerald)" : "rgba(0,230,118,0.3)"}`,
                                boxShadow: "0 0 35px rgba(0,230,118,0.15)",
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center", gap: "4px",
                                cursor: "pointer"
                            }}
                        >
                            <span style={{ fontSize: "2.5rem" }}>📳</span>
                            <span style={{ fontSize: "1.2rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace", color: "var(--accent-emerald)" }}>
                                {accMagnitude} m/s²
                            </span>
                            <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                Toca o Sacude
                            </span>
                        </div>
                    </div>

                    {/* Estado y Guía */}
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            {statusText}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
                            Junta dos teléfonos con la app RED abierta y sacúdelos simultáneamente para intercambiar identidades de forma segura mediante la malla P2P.
                        </div>
                    </div>

                    {/* Botón de Pulso Manual */}
                    <button
                        onClick={handleManualEmit}
                        className="btn-tactical-primary"
                        style={{ padding: "10px 20px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "8px" }}
                    >
                        📡 Emitir Pulso de Emparejamiento
                    </button>

                    {/* Tarjeta de Dispositivo Vinculado */}
                    {pairedDevice && (
                        <div className="card-tactical animate-pop" style={{ width: "100%", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "4px solid var(--accent-emerald)" }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--text-primary)" }}>
                                    {pairedDevice.name}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                    {pairedDevice.did.substring(0, 24)}…
                                </div>
                            </div>
                            <span className="badge-tactical badge-tactical-emerald">
                                {pairedDevice.isAlreadyAdded ? "EXISTENTE" : "NUEVO CONTACTO"}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};