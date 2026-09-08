"use client";

import React, { useState, useEffect } from "react";
import { tacticalTccc, TourniquetRecord, LimbLocation } from "../lib/tactical/TacticalTcccEngine";
import { tacticalBallistics, BallisticSolution, TacticalBallisticsEngine } from "../lib/tactical/TacticalBallisticsEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { TacticalLocationEngine } from "../lib/sensors/TacticalLocationEngine";
import { sitrepEngine } from "../lib/tactical/SitrepEngine";
import { meshRouter } from "../lib/mesh/meshRouter";

function calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

export function TcccBallisticsModal() {
    const { navigate, goBack, identity } = useRedStore();
    const { t } = useTranslation();
    const [tourniquets, setTourniquets] = useState<TourniquetRecord[]>(() => tacticalTccc.getActiveTourniquets());
    const [activeTab, setActiveTab] = useState<"tccc" | "ballistics">("tccc");

    // TCCC Inputs
    const [selectedLimb, setSelectedLimb] = useState<LimbLocation>("RIGHT_ARM");

    // Ballistics Inputs
    const [caliber, setCaliber] = useState<string>("5.56_NATO");
    const [distance, setDistance] = useState<number>(300);
    const [windMps, setWindMps] = useState<number>(4);
    const [inclineDeg, setInclineDeg] = useState<number>(0);
    const [isMeasuringIncline, setIsMeasuringIncline] = useState<boolean>(false);
    const [solution, setSolution] = useState<BallisticSolution>(() => 
        tacticalBallistics.calculateSolution("5.56_NATO", 300, 4, 0)
    );

    // Ficha Médica Sincronizada desde IdentityVaultModal
    const [medicalVault, setMedicalVault] = useState<{
        bloodType: string;
        allergies: string;
        emergencyContact: string;
    } | null>(() => {
        if (typeof window !== "undefined") {
            try {
                const raw = localStorage.getItem("red_identity_vault_v1");
                return raw ? JSON.parse(raw) : null;
            } catch { return null; }
        }
        return null;
    });

    useEffect(() => {
        const handleVaultUpdate = (e: any) => {
            if (e.detail !== undefined) {
                setMedicalVault(e.detail);
            } else {
                try {
                    const raw = localStorage.getItem("red_identity_vault_v1");
                    setMedicalVault(raw ? JSON.parse(raw) : null);
                } catch {
                    setMedicalVault(null);
                }
            }
        };
        const handleStorage = (e: StorageEvent) => {
            if (e.key === "red_identity_vault_v1") {
                try {
                    setMedicalVault(e.newValue ? JSON.parse(e.newValue) : null);
                } catch {
                    setMedicalVault(null);
                }
            }
        };
        window.addEventListener("red:medical_vault_updated", handleVaultUpdate);
        window.addEventListener("storage", handleStorage);
        return () => {
            window.removeEventListener("red:medical_vault_updated", handleVaultUpdate);
            window.removeEventListener("storage", handleStorage);
        };
    }, []);

    useEffect(() => {
        const unsub = tacticalTccc.subscribe(setTourniquets);
        return unsub;
    }, []);

    useEffect(() => {
        setSolution(tacticalBallistics.calculateSolution(caliber, distance, windMps, inclineDeg));
    }, [caliber, distance, windMps, inclineDeg]);

    // ── Inclinómetro de Hardware con Giroscopio/Acelerómetro ─────────────────
    useEffect(() => {
        if (!isMeasuringIncline) return;
        const handleOrientation = (e: DeviceOrientationEvent) => {
            if (typeof e.beta === "number" && isFinite(e.beta)) {
                // Pitch: inclinación vertical (-45° a +45°)
                const rawPitch = Math.round(Math.max(-45, Math.min(45, e.beta)));
                setInclineDeg(rawPitch);
            }
        };
        window.addEventListener("deviceorientation", handleOrientation);
        return () => window.removeEventListener("deviceorientation", handleOrientation);
    }, [isMeasuringIncline]);

    // ── LIFO Back Navigation Handler: Sensor Inclinación -> Balística -> TCCC -> Salir ──
    useEffect(() => {
        const unreg = BackHandlerRegistry.register(() => {
            if (isMeasuringIncline) {
                setIsMeasuringIncline(false);
                TacticalAudioEngine.playTap();
                return true;
            }
            if (activeTab !== "tccc") {
                setActiveTab("tccc");
                TacticalAudioEngine.playTap();
                return true;
            }
            TacticalAudioEngine.playTap();
            goBack();
            return true;
        });
        return unreg;
    }, [isMeasuringIncline, activeTab, goBack]);

    const handleApplyTourniquet = () => {
        tacticalTccc.applyTourniquet(selectedLimb);
        TacticalAudioEngine.playEmergencyAlarm();
        toast.error(`🩸 Torniquete CAT aplicado en ${selectedLimb}. Cronómetro iniciado.`);
    };

    const handleRemoveTourniquet = (id: string) => {
        tacticalTccc.removeTourniquet(id);
        TacticalAudioEngine.playRogerBeep();
        toast.info("Torniquete retirado");
    };

    const handleImportTargetDistance = () => {
        try {
            const rawTarget = localStorage.getItem("red_tactical_target_point") || localStorage.getItem("red_active_target");
            if (!rawTarget) {
                toast.warning("No hay un blanco táctico activo fijado en el sistema");
                return;
            }
            const parsed = JSON.parse(rawTarget);
            const targetLat = typeof parsed.lat === "number" ? parsed.lat : undefined;
            const targetLon = typeof parsed.lon === "number" ? parsed.lon : (typeof parsed.lng === "number" ? parsed.lng : undefined);
            if (targetLat === undefined || targetLon === undefined) {
                toast.warning("El blanco táctico no posee coordenadas geográficas");
                return;
            }

            const myLoc = TacticalLocationEngine.getLastKnownLocation();
            if (!myLoc || !TacticalLocationEngine.isValidCoordinates(myLoc.lat, myLoc.lon)) {
                toast.warning("Se requiere posición GPS propia para calcular la distancia al blanco");
                return;
            }

            const dist = calculateHaversineDistanceMeters(myLoc.lat!, myLoc.lon!, targetLat, targetLon);
            const clampedDist = Math.min(1500, Math.max(50, dist));
            setDistance(clampedDist);
            TacticalAudioEngine.playRogerBeep();
            toast.success(`🎯 Distancia de [${parsed.name || "Blanco"}]: ${dist}m (Fijada en ${clampedDist}m)`);
        } catch (e: any) {
            toast.error("Fallo al importar distancia: " + e.message);
        }
    };

    const handleBroadcastMedevac = async () => {
        const name = identity?.nickname || "Operador RED";
        const loc = TacticalLocationEngine.getLastKnownLocation();
        const lat = (loc && TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) ? loc.lat! : 0;
        const lon = (loc && TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) ? loc.lon! : 0;

        try {
            const bloodInfo = medicalVault?.bloodType ? ` · Sangre: ${medicalVault.bloodType}` : "";
            const allergyInfo = medicalVault?.allergies ? ` · Alergias: ${medicalVault.allergies}` : "";
            sitrepEngine.createSitrep({
                unitCallsign: name,
                operatorName: name,
                location: { lat, lon },
                threatStatus: "RED_CONTACT",
                friendlyTroopsCount: 1,
                casualties: {
                    t1ImmediateRed: tourniquets.length > 0 ? tourniquets.length : 1,
                    t2DelayedYellow: 0,
                    t3MinimalGreen: 0,
                    t4ExpectantBlack: 0
                },
                suppliesAmmoPct: 100,
                suppliesMedicalPct: Math.max(10, 100 - (tourniquets.length * 25)),
                suppliesBatteryPct: 100,
                remarks: `🚨 9-LINE MEDEVAC URGENTE: ${tourniquets.length} Torniquetes aplicados (${tourniquets.map(t => t.limb).join(', ') || 'Hemorragia Exanguinante'})${bloodInfo}${allergyInfo}`
            });

            const alertPayload = new TextEncoder().encode(JSON.stringify({
                type: "TACTICAL_MEDEVAC_9LINE",
                sender: name,
                tourniquetsCount: tourniquets.length,
                bloodType: medicalVault?.bloodType || "DESCONOCIDO",
                allergies: medicalVault?.allergies || "NINGUNA",
                emergencyContact: medicalVault?.emergencyContact || "",
                location: { lat, lon },
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", alertPayload);
            TacticalAudioEngine.playEmergencyAlarm();
            toast.success("📡 ¡Alerta 9-Line MEDEVAC difundida a la malla y registrada en SITREP!");
        } catch (e: any) {
            toast.error("Error al difundir alerta MEDEVAC: " + e.message);
        }
    };

    const handleExportCasualtyCard = () => {
        const name = identity?.nickname || "Operador RED";
        const roster = identity?.identity_hash ? `OP-${identity.identity_hash.slice(0, 6).toUpperCase()}` : `OP-${Date.now().toString(36).toUpperCase()}`;
        const cardText = tacticalTccc.generateDdForm1380({
            id: `CARD-${Date.now()}`,
            casualtyName: name,
            rosterNumber: roster,
            evacPriority: "URGENT",
            massiveBleedingControlled: true,
            tourniquets,
            airwayStatus: "INTACT",
            respirationStatus: "VENTED_CHEST_SEAL",
            circulationPulsePresent: true,
            txaAdministered: true,
            hypothermiaCoverApplied: true,
            painMedication: "Fentanilo transmucoso 800mcg",
            antibioticsGiven: true,
            splintApplied: false,
            createdTimestamp: Date.now(),
            bloodType: medicalVault?.bloodType,
            allergies: medicalVault?.allergies,
            emergencyContact: medicalVault?.emergencyContact,
        });

        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(cardText).then(() => {
                TacticalAudioEngine.playMessageSent();
                toast.success("📋 Tarjeta de Baja DD Form 1380 copiada al portapapeles");
            }).catch(() => fallbackCopyCard(cardText));
        } else {
            fallbackCopyCard(cardText);
        }
    };

    const fallbackCopyCard = (text: string) => {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(textArea);
            if (ok) {
                TacticalAudioEngine.playMessageSent();
                toast.success("📋 Tarjeta de Baja DD Form 1380 copiada al portapapeles");
            } else {
                toast.error("No se pudo copiar al portapapeles");
            }
        } catch {
            toast.error("Fallo al copiar tarjeta de baja");
        }
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF",
            fontFamily: "JetBrains Mono, monospace"
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
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            goBack();
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
                        background: "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(200, 30, 60, 0.15) 100%)",
                        border: "1px solid rgba(255, 51, 85, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(255, 51, 85, 0.3)"
                    }}>🩸</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            TCCC TRIAGE & BALÍSTICA
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#FF3355", fontWeight: 800 }}>
                            PROTOCOLOS MARCH-PAWS · CÁLCULO MRAD
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button
                        onClick={handleBroadcastMedevac}
                        style={{
                            padding: "6px 12px", borderRadius: "10px",
                            background: "linear-gradient(135deg, rgba(255, 51, 85, 0.3) 0%, rgba(200, 30, 60, 0.2) 100%)",
                            border: "1.5px solid #FF3355",
                            color: "#FF3355", fontSize: "0.74rem", fontWeight: 900, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "4px"
                        }}
                        title="Difundir Alerta Urgente 9-Line MEDEVAC por la Malla"
                    >
                        <span>📡</span> 9-LINE MEDEVAC
                    </button>
                    <button
                        onClick={handleExportCasualtyCard}
                        style={{
                            padding: "6px 12px", borderRadius: "10px",
                            background: "rgba(255, 51, 85, 0.15)", border: "1px solid rgba(255, 51, 85, 0.4)",
                            color: "#FF3355", fontSize: "0.74rem", fontWeight: 900, cursor: "pointer"
                        }}
                    >
                        📋 FORM 1380
                    </button>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            goBack();
                        }}
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#FFFFFF", cursor: "pointer", fontSize: "0.9rem", fontWeight: 800,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex", background: "rgba(8, 10, 20, 0.95)",
                padding: "8px 16px", gap: "6px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveTab("tccc");
                    }}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "tccc" ? "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(180, 20, 40, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "tccc" ? "1.5px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "tccc" ? "#FF3355" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🩸</span> TCCC MARCH ({tourniquets.length} TQ)
                </button>
                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveTab("ballistics");
                    }}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "ballistics" ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(10, 35, 60, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "ballistics" ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "ballistics" ? "#00E5FF" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🎯</span> BALÍSTICA MIL-DOT / MRAD
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* TAB 1: TCCC MARCH-PAWS */}
                    {activeTab === "tccc" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 51, 85, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            {/* Ficha Médica Soberana Sincronizada */}
                            <div style={{
                                background: "rgba(255, 51, 85, 0.06)", border: "1px solid rgba(255, 51, 85, 0.3)",
                                borderRadius: "14px", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center"
                            }}>
                                <div>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "#FF3355", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span>🫀</span> FICHA MÉDICA SOBERANA SINCRONIZADA
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "#DDD", marginTop: "3px" }}>
                                        Sangre: <strong style={{ color: "#FFF" }}>{medicalVault?.bloodType || "N/A"}</strong> · 
                                        Alergias: <strong style={{ color: "#FFF" }}>{medicalVault?.allergies || "NINGUNA"}</strong> · 
                                        Contacto: <strong style={{ color: "#AAA" }}>{medicalVault?.emergencyContact || "NO REGISTRADO"}</strong>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        TacticalAudioEngine.playTap();
                                        navigate("identityVault");
                                    }}
                                    style={{
                                        padding: "6px 12px", borderRadius: "8px", background: "rgba(255, 51, 85, 0.15)",
                                        border: "1px solid rgba(255, 51, 85, 0.4)", color: "#FF3355", fontSize: "0.7rem", fontWeight: 800, cursor: "pointer",
                                        whiteSpace: "nowrap"
                                    }}
                                >
                                    ✏️ EDITAR FICHA
                                </button>
                            </div>

                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FF3355" }}>
                                    GESTIÓN DE TORNIQUETES CAT & ALERTA DE ISQUEMIA
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Monitoreo de tiempo crítico para evitar daño irreversible en extremidades (&gt; 120 minutos).
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "8px" }}>
                                <select
                                    value={selectedLimb}
                                    onChange={(e: any) => setSelectedLimb(e.target.value)}
                                    style={{
                                        flex: 1, padding: "10px 14px", background: "rgba(0, 0, 0, 0.5)",
                                        border: "1px solid rgba(255, 51, 85, 0.4)", borderRadius: "10px",
                                        color: "#FFFFFF", fontSize: "0.82rem", outline: "none"
                                    }}
                                >
                                    <option value="RIGHT_ARM">Brazo Derecho</option>
                                    <option value="LEFT_ARM">Brazo Izquierdo</option>
                                    <option value="RIGHT_LEG">Pierna Derecha</option>
                                    <option value="LEFT_LEG">Pierna Izquierda</option>
                                </select>
                                <button
                                    onClick={handleApplyTourniquet}
                                    style={{
                                        padding: "10px 16px", background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                                        color: "#FFFFFF", fontWeight: 900, fontSize: "0.82rem", border: "none", borderRadius: "10px", cursor: "pointer"
                                    }}
                                >
                                    🩸 APLICAR TQ
                                </button>
                            </div>

                            {/* Tourniquet List */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {tourniquets.length === 0 ? (
                                    <div style={{ padding: "20px", textAlign: "center", background: "rgba(0,0,0,0.4)", borderRadius: "14px", color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                                        No hay torniquetes activos registrados.
                                    </div>
                                ) : (
                                    tourniquets.map(tq => (
                                        <div
                                            key={tq.id}
                                            style={{
                                                padding: "12px 14px", borderRadius: "12px",
                                                background: tq.isIschemicAlert ? "rgba(255, 51, 85, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                                border: `1px solid ${tq.isIschemicAlert ? '#FF3355' : 'rgba(255, 255, 255, 0.08)'}`,
                                                display: "flex", justifyContent: "space-between", alignItems: "center"
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: "0.85rem", fontWeight: 900, color: tq.isIschemicAlert ? "#FF3355" : "#FFFFFF" }}>
                                                    {tq.limb} · Tiempo: {tq.elapsedMinutes} min {tq.isIschemicAlert && "⚠️ ALERTA ISQUEMIA"}
                                                </div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    Aplicado: {new Date(tq.appliedTimestamp).toLocaleTimeString()}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveTourniquet(tq.id)}
                                                style={{
                                                    padding: "6px 12px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.08)",
                                                    border: "1px solid rgba(255, 255, 255, 0.2)", color: "#FFFFFF", fontSize: "0.72rem", cursor: "pointer"
                                                }}
                                            >
                                                RETIRAR
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: BALLISTICS CALCULATOR */}
                    {activeTab === "ballistics" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E5FF" }}>
                                    CALCULADOR BALÍSTICO MRAD / MIL-DOT
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Solución de tiro precisa calculada en tiempo real según distancia, viento e inclinación.
                                </div>
                            </div>

                            {/* Solution Display */}
                            <div style={{
                                background: "rgba(0, 229, 255, 0.08)", border: "1.5px solid rgba(0, 229, 255, 0.3)",
                                borderRadius: "16px", padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                                gap: "8px", textAlign: "center"
                            }}>
                                <div>
                                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>ELEVACIÓN</div>
                                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#00E5FF", marginTop: "2px" }}>
                                        {solution.elevationMrad > 0 ? `+${solution.elevationMrad.toFixed(1)}` : solution.elevationMrad.toFixed(1)} MRAD
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>DERIVA VIENTO</div>
                                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#FFB300", marginTop: "2px" }}>
                                        {solution.windageMrad.toFixed(1)} MRAD
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>TIEMPO VUELO</div>
                                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#00E676", marginTop: "2px" }}>
                                        {solution.timeOfFlightSec.toFixed(2)}s
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div>
                                    <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>CALIBRE / MUNICIÓN</label>
                                    <select
                                        value={caliber}
                                        onChange={e => setCaliber(e.target.value)}
                                        style={{
                                            width: "100%", padding: "8px 12px", background: "rgba(0,0,0,0.5)",
                                            border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "8px",
                                            color: "#FFFFFF", fontSize: "0.78rem"
                                        }}
                                    >
                                        <option value="5.56_NATO">5.56x45mm NATO (M855)</option>
                                        <option value="7.62_NATO">7.62x51mm NATO (.308 Win)</option>
                                        <option value="300_WIN_MAG">.300 Winchester Magnum</option>
                                        <option value="338_LAPUA">.338 Lapua Magnum</option>
                                        <option value="50_BMG">.50 BMG (12.7x99mm)</option>
                                    </select>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>DISTANCIA ({distance} m)</label>
                                            <button
                                                onClick={handleImportTargetDistance}
                                                style={{
                                                    background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.4)",
                                                    color: "#00E5FF", borderRadius: "6px", fontSize: "0.62rem", padding: "2px 6px",
                                                    cursor: "pointer", fontWeight: 800
                                                }}
                                                title="Importar distancia de blanco fijado en brújula o mapa"
                                            >
                                                🎯 BLANCO
                                            </button>
                                        </div>
                                        <input
                                            type="range" min="50" max="1500" step="25" value={distance}
                                            onChange={e => setDistance(Number(e.target.value))}
                                            style={{ width: "100%", marginTop: "4px" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>VIENTO CRUZADO ({windMps} m/s)</label>
                                        <input
                                            type="range" min="0" max="25" value={windMps}
                                            onChange={e => setWindMps(Number(e.target.value))}
                                            style={{ width: "100%", marginTop: "4px" }}
                                        />
                                    </div>
                                </div>

                                {/* Inclinación / Pitch de Tiro */}
                                <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "10px 12px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                        <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                                            ÁNGULO DE TIRO / INCLINACIÓN ({inclineDeg > 0 ? `+${inclineDeg}` : inclineDeg}°)
                                        </label>
                                        <button
                                            onClick={() => {
                                                TacticalAudioEngine.playTap();
                                                setIsMeasuringIncline(!isMeasuringIncline);
                                            }}
                                            style={{
                                                padding: "3px 8px", borderRadius: "6px",
                                                background: isMeasuringIncline ? "#00E5FF" : "rgba(0, 229, 255, 0.15)",
                                                color: isMeasuringIncline ? "#000" : "#00E5FF",
                                                border: "1px solid #00E5FF",
                                                fontSize: "0.64rem", fontWeight: 800, cursor: "pointer"
                                            }}
                                        >
                                            {isMeasuringIncline ? "📐 LEYENDO SENSOR..." : "📐 MEDIR CON GIROSCOPIO"}
                                        </button>
                                    </div>
                                    <input
                                        type="range" min="-45" max="45" step="1" value={inclineDeg}
                                        onChange={e => setInclineDeg(Number(e.target.value))}
                                        style={{ width: "100%" }}
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                        <span>-45° (Declive)</span>
                                        <span>0° (Horizontal)</span>
                                        <span>+45° (Elevación)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
