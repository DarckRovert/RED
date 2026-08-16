"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { RedAPI, getProximityNodes } from "../lib/api";
import { meshRouter } from "../lib/mesh/meshRouter";

export const ShakePairModal: React.FC = () => {
    const { navigate, identity, addContact, contacts, fetchData } = useRedStore();
    const [isListening, setIsListening] = useState(false);
    const [accMagnitude, setAccMagnitude] = useState<number>(0);
    const [shakeDetected, setShakeDetected] = useState<boolean>(false);
    const [statusText, setStatusText] = useState<string>("Sacude el teléfono para vincular nodos cercanos");
    const [pairedDevice, setPairedDevice] = useState<{ did: string; name: string; isAlreadyAdded: boolean } | null>(null);

    const SHAKE_THRESHOLD = 15.0; // m/s^2
    const lastShakeTimeRef = useRef<number>(0);

    // Deduplication Helper: check if contact already exists in local contacts list
    const checkExistingContact = useCallback((candidateHash: string) => {
        if (!candidateHash) return { exists: false, contact: null };
        const clean = candidateHash.replace(/^did:red:/, "").split(":")[0].trim().toLowerCase();
        const canonical = meshRouter.getCanonicalId(clean) || clean;
        const shortCandidate = canonical.slice(0, 8);
        const contactsList = contacts || [];

        const found = contactsList.find((c: any) => {
            if (!c) return false;
            const cHash = (c.identity_hash || c.id || c.did || "").replace(/^did:red:/, "").split(":")[0].trim().toLowerCase();
            const cCanonical = meshRouter.getCanonicalId(cHash) || cHash;
            const cShort = cCanonical.slice(0, 8);
            return cCanonical === canonical || cHash === clean || (cCanonical.length >= 8 && canonical.length >= 8 && cShort === shortCandidate);
        });

        return { exists: !!found, contact: found };
    }, [contacts]);

    const processCandidatePeer = useCallback(async (peerHash: string, peerName: string, peerPk: string | null = null) => {
        const cleanHash = peerHash.replace(/^did:red:/, "").split(":")[0].trim();
        const { exists, contact } = checkExistingContact(cleanHash);

        if (exists) {
            const actualName = contact?.display_name || peerName;
            setPairedDevice({
                did: `did:red:${cleanHash}`,
                name: actualName,
                isAlreadyAdded: true
            });
            setStatusText(`ℹ️ Dispositivo cercano previamente vinculado: ${actualName}`);
            toast.info(`ℹ️ ${actualName} ya forma parte de tu lista de contactos.`);
        } else {
            await addContact(cleanHash, peerName, peerPk);
            try { await RedAPI.syncContactProfile(cleanHash); } catch {}
            setPairedDevice({
                did: `did:red:${cleanHash}`,
                name: peerName,
                isAlreadyAdded: false
            });
            setStatusText(`✅ ¡VINCULADO! Conectado con ${peerName}`);
            toast.success(`📳 Sacudida exitosa: Vinculado con ${peerName}`);
        }
        setShakeDetected(false);
        fetchData();
    }, [checkExistingContact, addContact, fetchData]);

    // Live P2P Event listener for real-time incoming shake pairing signals
    useEffect(() => {
        let eventSource: EventSource | null = null;
        try {
            eventSource = RedAPI.subscribeToEvents((event: any) => {
                let data: any = {};
                if (typeof event?.content === "string" && event.content.startsWith("{")) {
                    try {
                        data = JSON.parse(event.content);
                    } catch {}
                }

                const effectiveType = data.msg_type || event?.msg_type;

                if (effectiveType === "shake_pair_request" || effectiveType === "shake_pair_response") {
                    const peerHash = data.sender_hash || event?.sender_hash || event?.from;
                    const peerName = data.nickname || event?.nickname || `Nodo-${peerHash?.slice(0, 6)}`;
                    const peerPk = data.public_key || null;

                    if (peerHash && peerHash !== identity?.identity_hash) {
                        processCandidatePeer(peerHash, peerName, peerPk);
                    }
                }
            });
        } catch {}

        return () => {
            if (eventSource) eventSource.close();
        };
    }, [identity, processCandidatePeer]);

    // Accelerometer Motion Sensor Hardware Listener
    useEffect(() => {
        const handleMotion = (e: DeviceMotionEvent) => {
            const acc = e.accelerationIncludingGravity || e.acceleration;
            if (!acc) return;

            const x = acc.x || 0;
            const y = acc.y || 0;
            const z = acc.z || 0;
            const mag = Math.sqrt(x * x + y * y + z * z);
            setAccMagnitude(Math.round(mag * 10) / 10);

            const now = Date.now();
            if (mag > SHAKE_THRESHOLD && now - lastShakeTimeRef.current > 2000) {
                lastShakeTimeRef.current = now;
                setShakeDetected(true);
                setStatusText("📳 ¡SACUDIDA DETECTADA! Emitiendo pulso de emparejamiento...");

                if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }

                // Broadcast ephemeral handshake signal
                meshRouter.broadcastDiscovery().catch(() => {});
                getProximityNodes().then(nodes => {
                    if (nodes && nodes.length > 0) {
                        const top = nodes[0];
                        const peerId = top.peer_id || top.node_hash || top.identity_hash;
                        if (peerId) {
                            processCandidatePeer(peerId, top.nickname || top.display_name || "Nodo RED");
                        }
                    }
                }).catch(() => {});
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
    }, [processCandidatePeer]);

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
                            Shake-to-Pair (Acelerómetro)
                        </div>
                        <div style={{ fontSize: "0.68rem", color: isListening ? "var(--accent-emerald)" : "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {isListening ? "● SENSOR INERCIAL ACTIVO" : "SENSOR EN ESPERA"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate("sidebar")}
                    className="btn-icon"
                    title="Cerrar shake pair"
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

                        <div style={{
                            width: "160px", height: "160px", borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(14,30,24,0.9) 0%, rgba(8,16,12,0.98) 70%)",
                            border: `2px solid ${shakeDetected ? "var(--accent-emerald)" : "rgba(0,230,118,0.3)"}`,
                            boxShadow: "0 0 35px rgba(0,230,118,0.15)",
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: "4px"
                        }}>
                            <span style={{ fontSize: "2.5rem" }}>📳</span>
                            <span style={{ fontSize: "1.2rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace", color: "var(--accent-emerald)" }}>
                                {accMagnitude} m/s²
                            </span>
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                Fuerza G Vectorial
                            </span>
                        </div>
                    </div>

                    {/* Estado y Guía */}
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            {statusText}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px", lineHeight: 1.4 }}>
                            Junta dos teléfonos con la app RED abierta y sacúdelos simultáneamente para intercambiar identidades de forma segura.
                        </div>
                    </div>

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