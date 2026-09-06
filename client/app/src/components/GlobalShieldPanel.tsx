"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { 
    globalShield, 
    DefconLevel, 
    DEFCON_PROFILES, 
    GlobalShieldTelemetry, 
    ShieldAuditLogEntry, 
    QuarantinedPeer 
} from "../lib/network/GlobalShieldEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export default function GlobalShieldPanel() {
    const { goBack } = useRedStore();
    const { t } = useTranslation();
    const [telemetry, setTelemetry] = useState<GlobalShieldTelemetry>(() => globalShield.getTelemetry());
    const [auditLog, setAuditLog] = useState<ShieldAuditLogEntry[]>(() => globalShield.getAuditLog());
    const [quarantined, setQuarantined] = useState<QuarantinedPeer[]>(() => globalShield.getQuarantinedPeers());

    const [isTestingTraffic, setIsTestingTraffic] = useState(false);
    const [activeVectorTest, setActiveVectorTest] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{
        mechanism: string;
        latencyMs: number;
        success: boolean;
        reason?: string;
    } | null>(null);

    useEffect(() => {
        const unsubscribeTelemetry = globalShield.subscribe((t) => {
            setTelemetry(t);
            setQuarantined(globalShield.getQuarantinedPeers());
        });
        const unsubscribeAudit = globalShield.subscribeAuditLog((log) => {
            setAuditLog(log);
        });

        // 3s interval to refresh quarantine countdowns
        const qInterval = setInterval(() => {
            setQuarantined(globalShield.getQuarantinedPeers());
        }, 3000);

        return () => {
            unsubscribeTelemetry();
            unsubscribeAudit();
            clearInterval(qInterval);
        };
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

    // 1. Probar Ofuscación de Tráfico (SNI / DoH / Direct Mesh)
    const handleTestObfuscation = async () => {
        setIsTestingTraffic(true);
        setActiveVectorTest("OBFUSCATION");
        setTestResult(null);
        TacticalAudioEngine.playTap();

        try {
            const entropy = new Uint8Array(32);
            if (typeof window !== "undefined" && window.crypto) {
                window.crypto.getRandomValues(entropy);
            }
            const entropyHex = Array.from(entropy).map(b => b.toString(16).padStart(2, "0")).join("");
            const realNoisePayload = `RED_NOISE_PQC_V2:${telemetry.currentDefcon}:${Date.now()}:${entropyHex}`;

            const res = await globalShield.routeSecurePacket(realNoisePayload);
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
            setActiveVectorTest(null);
        }
    };

    // 2. Inyectar Vector de Inundación Sybil (Rate-Limit Burst)
    const handleInjectSybil = async () => {
        setIsTestingTraffic(true);
        setActiveVectorTest("SYBIL");
        TacticalAudioEngine.playWarning();
        toast.info("⚡ Inyectando ráfaga de 15 paquetes hostiles...");

        try {
            const res = await globalShield.injectSybilFloodVector(15);
            if (res.quarantined) {
                toast.error(`🛡️ Ataque Sybil mitigado: ${res.deflected} paquetes bloqueados. Nodo hostil puesto en cuarentena.`);
            } else {
                toast.warning(`🛡️ ${res.deflected} paquetes interceptados por el gobernador de tasa.`);
            }
        } catch (e: any) {
            toast.error(`Fallo al inyectar vector: ${e?.message || e}`);
        } finally {
            setIsTestingTraffic(false);
            setActiveVectorTest(null);
        }
    };

    // 3. Inyectar Vector de Ataque Replay (Nonce Duplicado)
    const handleInjectReplay = async () => {
        setIsTestingTraffic(true);
        setActiveVectorTest("REPLAY");
        TacticalAudioEngine.playTap();

        try {
            const res = await globalShield.injectReplayAttackVector();
            if (res.intercepted) {
                toast.success(`🛡️ Ataque Replay neutralizado: Nonce duplicado ${res.nonce.slice(0, 10)}… interceptado.`);
            } else {
                toast.warning("Vector Replay emitido sin rechazo.");
            }
        } catch (e: any) {
            toast.error(`Fallo en vector Replay: ${e?.message || e}`);
        } finally {
            setIsTestingTraffic(false);
            setActiveVectorTest(null);
        }
    };

    // 4. Inyectar Vector de Evasión PoW (Dificultad 0)
    const handleInjectPoWBypass = async () => {
        setIsTestingTraffic(true);
        setActiveVectorTest("POW");
        TacticalAudioEngine.playTap();

        try {
            const res = await globalShield.injectPoWBypassVector();
            if (res.blocked) {
                toast.success(`🛡️ PoW Bypass rechazado matemáticamente: Exige ${res.expectedDifficulty} bits.`);
            } else {
                toast.warning("Vector PoW procesado.");
            }
        } catch (e: any) {
            toast.error(`Fallo en vector PoW: ${e?.message || e}`);
        } finally {
            setIsTestingTraffic(false);
            setActiveVectorTest(null);
        }
    };

    const handleUnquarantine = (peerId: string) => {
        TacticalAudioEngine.playTap();
        globalShield.unquarantinePeer(peerId);
        toast.info(`Par ${peerId.slice(0, 12)}… indultado de la lista negra.`);
    };

    const handleClearAuditLog = () => {
        TacticalAudioEngine.playTap();
        globalShield.clearAuditLog();
        toast.info("Registro de auditoría reiniciado.");
    };

    const activeProfile = telemetry.activeProfile;
    const isUnderAttack = telemetry.perimeterStatus === "UNDER_ATTACK";
    const isElevatedRisk = telemetry.perimeterStatus === "ELEVATED_RISK";

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
                            {t.shield_module?.title || "Escudo Global & Firewall Perimetral"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: activeProfile.color, fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            DEFCON {telemetry.currentDefcon} · {activeProfile.codename} · SPI FIREWALL ACTIVO
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
                <div style={{ maxWidth: "720px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Perimeter Health Status Banner */}
                    <div className="card-tactical animate-enter" style={{
                        padding: "14px 18px",
                        background: isUnderAttack
                            ? "linear-gradient(135deg, rgba(255, 23, 68, 0.25) 0%, rgba(10, 10, 20, 0.8) 100%)"
                            : isElevatedRisk
                            ? "linear-gradient(135deg, rgba(255, 145, 0, 0.2) 0%, rgba(10, 10, 20, 0.8) 100%)"
                            : "linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(10, 10, 20, 0.8) 100%)",
                        borderColor: isUnderAttack ? "var(--accent-crimson)" : isElevatedRisk ? "var(--accent-amber)" : "var(--accent-emerald)",
                        display: "flex", alignItems: "center", justifyContent: "space-between"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "1.8rem" }}>
                                {isUnderAttack ? "🚨" : isElevatedRisk ? "⚠️" : "🛡️"}
                            </span>
                            <div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    {isUnderAttack ? "BAJO ATAQUE ACTIVO" : isElevatedRisk ? "ALERTA PERIMETRAL" : "PERÍMETRO BLINDADO"}
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
                                    Firewall Stateful Packet Inspection (SPI) · Cero-Trust Gateway
                                </div>
                            </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                            <div style={{
                                fontSize: "1.4rem", fontWeight: 900,
                                fontFamily: "JetBrains Mono, monospace",
                                color: isUnderAttack ? "var(--accent-crimson)" : isElevatedRisk ? "var(--accent-amber)" : "var(--accent-emerald)"
                            }}>
                                {telemetry.perimeterHealthScore}%
                            </div>
                            <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                Salud Perimetral
                            </div>
                        </div>
                    </div>

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
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Replay & Tráfico Malicioso</span>
                                <span>🛑</span>
                            </div>
                            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--accent-crimson)", fontFamily: "JetBrains Mono, monospace" }}>
                                {telemetry.replayAttacksDeflected + telemetry.malformedPacketsBlocked} <span style={{ fontSize: "0.72rem" }}>DROPPED</span>
                            </div>
                        </div>

                        <div className="card-tactical" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Saltos Onion & Ofuscación</span>
                                <span>🧅</span>
                            </div>
                            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--accent-purple)", fontFamily: "JetBrains Mono, monospace" }}>
                                {telemetry.onionHopsActive} <span style={{ fontSize: "0.72rem" }}>HOPS ({telemetry.obfuscatedPacketsCount} PKT)</span>
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

                    {/* Interactive Attack Vector & Diagnostic Suite */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                                🧪 SUITE DE AUDITORÍA & VECTORES DE ATAQUE
                            </div>
                            <span className="badge-tactical badge-tactical-cyan" style={{ fontSize: "0.6rem" }}>
                                SIMULACIÓN REAL EN VIVO
                            </span>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                            Inyecta vectores de ataque contra el firewall SPI del nodo para certificar la detección y el registro de amenazas en tiempo real:
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                            <button
                                onClick={handleTestObfuscation}
                                disabled={isTestingTraffic}
                                className="btn-tactical-secondary"
                                style={{ padding: "10px 8px", fontSize: "0.74rem", textAlign: "left", display: "flex", flexDirection: "column", gap: "2px" }}
                            >
                                <span style={{ fontWeight: 800, color: "var(--accent-cyan)" }}>⚡ Ofuscación de Tráfico</span>
                                <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Prueba túnel SNI / DoH UDP 53</span>
                            </button>

                            <button
                                onClick={handleInjectSybil}
                                disabled={isTestingTraffic}
                                className="btn-tactical-secondary"
                                style={{ padding: "10px 8px", fontSize: "0.74rem", textAlign: "left", display: "flex", flexDirection: "column", gap: "2px" }}
                            >
                                <span style={{ fontWeight: 800, color: "var(--accent-amber)" }}>🛡️ Inundación Sybil</span>
                                <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Ráfaga 15 pkts y cuarentena</span>
                            </button>

                            <button
                                onClick={handleInjectReplay}
                                disabled={isTestingTraffic}
                                className="btn-tactical-secondary"
                                style={{ padding: "10px 8px", fontSize: "0.74rem", textAlign: "left", display: "flex", flexDirection: "column", gap: "2px" }}
                            >
                                <span style={{ fontWeight: 800, color: "var(--accent-purple)" }}>🔁 Replay Attack</span>
                                <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Inyecta Nonce duplicado</span>
                            </button>

                            <button
                                onClick={handleInjectPoWBypass}
                                disabled={isTestingTraffic}
                                className="btn-tactical-secondary"
                                style={{ padding: "10px 8px", fontSize: "0.74rem", textAlign: "left", display: "flex", flexDirection: "column", gap: "2px" }}
                            >
                                <span style={{ fontWeight: 800, color: "var(--accent-crimson)" }}>🧮 PoW Bypass</span>
                                <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Valida rechazo de Dificultad 0</span>
                            </button>
                        </div>

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

                    {/* Quarantined Hostile Peers */}
                    {quarantined.length > 0 && (
                        <div className="card-tactical animate-enter" style={{ padding: "16px", borderColor: "var(--accent-crimson)", background: "rgba(255, 23, 68, 0.05)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--accent-crimson)" }}>
                                    🚫 NODOS HOSTILES EN CUARENTENA ({quarantined.length})
                                </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {quarantined.map((q) => {
                                    const secondsLeft = Math.max(0, Math.round((q.expiresAt - Date.now()) / 1000));
                                    return (
                                        <div key={q.peerId} style={{
                                            padding: "8px 10px", borderRadius: "6px", background: "rgba(0,0,0,0.4)",
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace"
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 800, color: "var(--accent-crimson)" }}>{q.peerId}</div>
                                                <div style={{ color: "var(--text-muted)", fontSize: "0.64rem" }}>{q.reason} · Reincidencia: x{q.violationsCount}</div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ color: "var(--accent-amber)", fontSize: "0.68rem" }}>{secondsLeft}s</span>
                                                <button
                                                    onClick={() => handleUnquarantine(q.peerId)}
                                                    className="btn-tactical-secondary"
                                                    style={{ padding: "2px 8px", fontSize: "0.62rem" }}
                                                >
                                                    Indultar
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Live Threat Audit Log Console */}
                    <div className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                                📋 REGISTRO DE AUDITORÍA DEL FIREWALL (SPI LOG)
                            </div>
                            {auditLog.length > 0 && (
                                <button
                                    onClick={handleClearAuditLog}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "2px 8px", fontSize: "0.62rem" }}
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>

                        <div style={{
                            maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px",
                            padding: "8px", background: "rgba(0,0,0,0.5)", borderRadius: "8px", border: "1px solid var(--glass-border)",
                            fontFamily: "JetBrains Mono, monospace", fontSize: "0.68rem"
                        }}>
                            {auditLog.length === 0 ? (
                                <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
                                    Perímetro en calma. Sin incidentes recientes.
                                </div>
                            ) : (
                                auditLog.map((entry) => {
                                    const timeStr = new Date(entry.timestamp).toLocaleTimeString();
                                    const color = entry.verdict === "BLOCKED" 
                                        ? "var(--accent-crimson)" 
                                        : entry.verdict === "DEFLECTED" 
                                        ? "var(--accent-amber)" 
                                        : entry.verdict === "OBFUSCATED" 
                                        ? "var(--accent-cyan)" 
                                        : "var(--accent-emerald)";

                                    return (
                                        <div key={entry.id} style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "4px" }}>
                                            <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>[{timeStr}]</span>
                                            <span style={{ color, fontWeight: 800, flexShrink: 0 }}>[{entry.verdict}]</span>
                                            <span style={{ color: "var(--text-primary)", wordBreak: "break-all" }}>
                                                <strong>{entry.rule}</strong>: {entry.reason} ({entry.peerId.slice(0, 14)})
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
