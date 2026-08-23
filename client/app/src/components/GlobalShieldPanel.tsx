"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { globalShield, DefconLevel, DEFCON_PROFILES, GlobalShieldTelemetry } from "../lib/GlobalShieldEngine";
import { TacticalAudioEngine } from "../lib/TacticalAudioEngine";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export default function GlobalShieldPanel() {
    const { goBack, navigate } = useRedStore();
    const { t } = useTranslation();
    const [telemetry, setTelemetry] = useState<GlobalShieldTelemetry>(globalShield.getTelemetry());
    const [isTestingTraffic, setIsTestingTraffic] = useState(false);
    const [testResult, setTestResult] = useState<{
        mechanism: string;
        latencyMs: number;
        success: boolean;
        reason?: string;
    } | null>(null);

    useEffect(() => {
        const unsubscribe = globalShield.subscribe((t) => setTelemetry(t));
        return () => unsubscribe();
    }, []);

    const handleSelectDefcon = (level: DefconLevel) => {
        TacticalAudioEngine.playTap();
        globalShield.setDefcon(level);
        const profile = DEFCON_PROFILES[level];
        if (level === 1) {
            toast.error(`🛑 DEFCON 1 ACTIVADO: ${profile.label}`);
            TacticalAudioEngine.playEmergencyAlarm();
        } else if (level <= 2) {
            toast.warning(`⚠️ ${profile.label}`);
            TacticalAudioEngine.playWarning();
        } else {
            toast.info(`🛡️ ${profile.label}`);
        }
    };

    const handleTestObfuscation = async () => {
        setIsTestingTraffic(true);
        setTestResult(null);
        TacticalAudioEngine.playTap();

        try {
            const fakePayload = "RED_NOISE_VECTOR_" + Math.random().toString(36).substring(2, 15);
            const res = await globalShield.routeSecurePacket(fakePayload);
            setTestResult(res);
            if (res.success) {
                toast.success(`✅ Enrutamiento seguro exitoso vía ${res.mechanism} (${res.latencyMs}ms)`);
            } else {
                toast.warning(`⚠️ Enrutamiento vía ${res.mechanism}: ${res.reason || "Reintentando"}`);
            }
        } catch (e: any) {
            toast.error(`Fallo de prueba: ${e?.message || "Error de red"}`);
        } finally {
            setIsTestingTraffic(false);
        }
    };

    const activeProfile = telemetry.activeProfile;

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Tactical Header */}
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
                        background: `linear-gradient(135deg, ${activeProfile.color} 0%, rgba(0,0,0,0.8) 100%)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.3rem", boxShadow: `0 4px 16px ${activeProfile.color}50`
                    }}>
                        🛡️
                    </div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.shield_module?.title || "Escudo Global & Ciberdefensa Mesh"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: activeProfile.color, fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            DEFCON {telemetry.currentDefcon} · {activeProfile.codename} · {t.shield_module?.subtitle || "ZERO-TRUST"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title={t.common?.close || "Cerrar panel"}
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Scrollable Container */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* DEFCON Level Selector */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                Nivel de Alerta Perimetral (DEFCON Matrix)
                            </span>
                            <span className="badge-tactical" style={{ borderColor: activeProfile.color, color: activeProfile.color }}>
                                ACTIVO: DEFCON {telemetry.currentDefcon}
                            </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                            {([4, 3, 2, 1] as DefconLevel[]).map((lvl) => {
                                const p = DEFCON_PROFILES[lvl];
                                const isSelected = telemetry.currentDefcon === lvl;
                                return (
                                    <button
                                        key={lvl}
                                        onClick={() => handleSelectDefcon(lvl)}
                                        className={isSelected ? "btn-tactical-primary" : "btn-tactical-secondary"}
                                        style={{
                                            padding: "12px 6px",
                                            display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                                            borderColor: isSelected ? p.color : "var(--glass-border)",
                                            background: isSelected ? `linear-gradient(135deg, ${p.color}25 0%, rgba(10,10,20,0.9) 100%)` : undefined,
                                            boxShadow: isSelected ? `0 0 16px ${p.color}40` : "none"
                                        }}
                                    >
                                        <span style={{ fontSize: "1.1rem", fontWeight: 900, color: p.color, fontFamily: "JetBrains Mono, monospace" }}>
                                            D-{lvl}
                                        </span>
                                        <span style={{ fontSize: "0.64rem", fontWeight: 800, textAlign: "center", whiteSpace: "nowrap" }}>
                                            {lvl === 4 ? "ESTÁNDAR" : lvl === 3 ? "ELEVADO" : lvl === 2 ? "HOSTIL" : "APAGÓN"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{
                            padding: "12px", borderRadius: "10px",
                            background: "rgba(0,0,0,0.4)", border: `1px solid ${activeProfile.color}35`,
                            fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: 1.45
                        }}>
                            <strong style={{ color: activeProfile.color }}>{activeProfile.label}:</strong> {activeProfile.description}
                        </div>
                    </div>

                    {/* 4 Telemetry HUD Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                        <div className="card-tactical" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Ataques Sybil Bloqueados</span>
                                <span>🛡️</span>
                            </div>
                            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                {telemetry.sybilAttacksDeflected} <span style={{ fontSize: "0.72rem" }}>PKTS</span>
                            </div>
                        </div>

                        <div className="card-tactical" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Paquetes Ofuscados</span>
                                <span>🥷</span>
                            </div>
                            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                {telemetry.obfuscatedPacketsCount} <span style={{ fontSize: "0.72rem" }}>ROUTED</span>
                            </div>
                        </div>

                        <div className="card-tactical" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Saltos Onion Activos</span>
                                <span>🧅</span>
                            </div>
                            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--accent-purple)", fontFamily: "JetBrains Mono, monospace" }}>
                                {telemetry.onionHopsActive} <span style={{ fontSize: "0.72rem" }}>HOPS</span>
                            </div>
                        </div>

                        <div className="card-tactical" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Autonomía Batería Mesh</span>
                                <span>🔋</span>
                            </div>
                            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace" }}>
                                {telemetry.estimatedMeshBatteryHours} <span style={{ fontSize: "0.72rem" }}>HORAS</span>
                            </div>
                        </div>
                    </div>

                    {/* Defense Matrix Features Checklist */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                            ⚡ MATRIZ DE CONTRAMEDIDAS ACTIVAS
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px" }}>
                                <div>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>Proof-of-Work Anti-Spam / Anti-DDoS</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Dificultad de cómputo SHA-256 por paquete</div>
                                </div>
                                <span className="badge-tactical badge-tactical-cyan">
                                    {activeProfile.powDifficulty} BITS TARGET
                                </span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px" }}>
                                <div>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>Blindaje Post-Cuántico NIST ML-KEM-768</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Kyber-768 Lattice KEM + ECDH P-256</div>
                                </div>
                                <span className="badge-tactical badge-tactical-purple">
                                    {activeProfile.pqcStrictRatcheting ? "FORZADO ESTRICTO" : "DISPONIBLE"}
                                </span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px" }}>
                                <div>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>Ofuscación SNI & Domain Fronting</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Camuflaje de paquetes en portales Zero-Rating</div>
                                </div>
                                <span className={`badge-tactical ${activeProfile.sniObfuscationForced ? "badge-tactical-emerald" : "badge-tactical-amber"}`}>
                                    {activeProfile.sniObfuscationForced ? "ACTIVO 100%" : "STANDBY"}
                                </span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px" }}>
                                <div>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>Tunelado DNS UDP 53 / DoH Fallback</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Transmisión fuera de red sin saldo de datos</div>
                                </div>
                                <span className={`badge-tactical ${activeProfile.dnsTunnelFallbackForced ? "badge-tactical-crimson" : "badge-tactical-cyan"}`}>
                                    {activeProfile.dnsTunnelFallbackForced ? "FORZADO APAGÓN" : "AUTO"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Obfuscation Test */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                            🧪 AUDITORÍA & PRUEBA DE ENRUTAMIENTO EN VIVO
                        </div>

                        <button
                            onClick={handleTestObfuscation}
                            disabled={isTestingTraffic}
                            className="btn-tactical-primary"
                            style={{
                                width: "100%", padding: "12px",
                                background: `linear-gradient(135deg, ${activeProfile.color} 0%, rgba(0,229,255,0.8) 100%)`,
                                color: "#000", fontWeight: 900
                            }}
                        >
                            {isTestingTraffic ? "Disparando Vector de Prueba..." : "⚡ DISPARAR PRUEBA DE OFUSCACIÓN DE TRÁFICO"}
                        </button>

                        {testResult && (
                            <div className="card-tactical animate-pop" style={{ padding: "12px", background: "rgba(0,229,255,0.06)", borderColor: "var(--accent-cyan)" }}>
                                <div style={{ fontSize: "0.74rem", fontWeight: 800, color: "var(--accent-cyan)", marginBottom: "4px" }}>
                                    RESULTADO DE TELEMETRÍA EN TIEMPO REAL:
                                </div>
                                <div style={{ fontSize: "0.82rem", fontFamily: "JetBrains Mono, monospace" }}>
                                    Mecanismo: <strong>{testResult.mechanism}</strong> · Latencia: <strong>{testResult.latencyMs}ms</strong> · Estado: <strong>{testResult.success ? "EXITOSO" : "INTERCEPTADO / REINTENTANDO"}</strong>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
