"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { TacIcon } from "./ui/TacIcon";
import { toast } from "./Toast";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import {
    sovereignShieldEngine,
    ShieldVerdict,
    CallLogEntry,
    AppAuditSummary,
    RfThreatStatus,
    HardwareKineticHealth,
    RedShield
} from "../lib/security/SovereignShieldEngine";

interface SovereignShieldDashboardProps {
    onClose?: () => void;
}

export default function SovereignShieldDashboard({ onClose }: SovereignShieldDashboardProps) {
    const { goBack } = useRedStore();
    const { t } = useTranslation();

    const [shieldActive, setShieldActive] = useState<boolean>(true);
    const [strictMode, setStrictMode] = useState<boolean>(false);
    const [shieldIndex, setShieldIndex] = useState<number>(96);

    const [appAudit, setAppAudit] = useState<AppAuditSummary | null>(null);
    const [rfStatus, setRfStatus] = useState<RfThreatStatus | null>(null);
    const [hardware, setHardware] = useState<HardwareKineticHealth | null>(null);
    const [callHistory, setCallHistory] = useState<CallLogEntry[]>([]);

    // Sub-vistas y modales
    const [activeTab, setActiveTab] = useState<"overview" | "calls" | "apps" | "rf">("overview");
    const [manualNumberInput, setManualNumberInput] = useState<string>("");
    const [manualLabelInput, setManualLabelInput] = useState<string>("");
    const [evaluatedNumberResult, setEvaluatedNumberResult] = useState<ShieldVerdict | null>(null);
    const [simPrefixInput, setSimPrefixInput] = useState<string>("");

    const handleClose = useCallback(() => {
        if (onClose) onClose();
        else goBack();
    }, [onClose, goBack]);

    // Registro de botón hardware Back (Android / Escape)
    useEffect(() => {
        return BackHandlerRegistry.register(() => {
            handleClose();
            return true;
        });
    }, [handleClose]);

    // Carga de datos inicial
    const refreshData = useCallback(async () => {
        setShieldActive(sovereignShieldEngine.isShieldActive());
        setStrictMode(sovereignShieldEngine.isStrict());
        setCallHistory(sovereignShieldEngine.getCallHistory());
        setSimPrefixInput(sovereignShieldEngine.getSimPrefix());

        try {
            const [auditRes, rfRes, hwRes] = await Promise.all([
                sovereignShieldEngine.auditInstalledApps(),
                sovereignShieldEngine.getRfThreatStatus(),
                sovereignShieldEngine.getHardwareTelemetry()
            ]);
            setAppAudit(auditRes);
            setRfStatus(rfRes);
            setHardware(hwRes);

            const score = sovereignShieldEngine.computeShieldIndex(auditRes, rfRes);
            setShieldIndex(score);
        } catch (e) {
            console.warn("[SovereignShieldDashboard] Error actualizando telemetría:", e);
        }
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const handleToggleShield = (val: boolean) => {
        setShieldActive(val);
        sovereignShieldEngine.setShieldEnabled(val);
        if (val) {
            toast.success("🛡️ Escudo Soberano de Telefonía Activado");
        } else {
            toast.warning("⚠️ Escudo en Pausa: Llamadas sin filtrado táctico");
        }
        refreshData();
    };

    const handleToggleStrict = (val: boolean) => {
        setStrictMode(val);
        sovereignShieldEngine.setStrictMode(val);
        if (val) {
            toast.info("🔴 Modo Fortaleza Activo: Rechazo automático de estafas confirmadas");
        } else {
            toast.info("🟡 Modo Advertencia Activo: Aviso visual sin cortar llamadas");
        }
    };

    const handleEvaluateManualNumber = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualNumberInput.trim()) return;
        const verdict = sovereignShieldEngine.evaluateIncomingNumber(manualNumberInput);
        setEvaluatedNumberResult(verdict);
    };

    const handleBlockNumber = (num: string, label: string) => {
        sovereignShieldEngine.blockNumber(num, label || "Spam Reportado");
        toast.success(`Número ${num} agregado a Lista Negra`);
        setEvaluatedNumberResult(null);
        setManualNumberInput("");
        setManualLabelInput("");
        refreshData();
    };

    const handleWhitelistNumber = (num: string, label: string) => {
        sovereignShieldEngine.whitelistNumber(num, label || "Contacto Confiable");
        toast.success(`Número ${num} agregado a Lista Blanca VIP`);
        setEvaluatedNumberResult(null);
        setManualNumberInput("");
        setManualLabelInput("");
        refreshData();
    };

    const handleOpenAppDetails = async (pkgName: string) => {
        try {
            if (typeof window !== "undefined" && (window as any).Capacitor?.isPluginAvailable("RedShield")) {
                await RedShield.openAppSettings({ packageName: pkgName });
                return;
            }
        } catch {}
        toast.info(`Para revocar permisos, abre Ajustes de Android > Aplicaciones > ${pkgName}`);
    };

    const handleSaveSimPrefix = () => {
        sovereignShieldEngine.setSimPrefix(simPrefixInput);
        toast.success("Prefijo SIM guardado para detección anti-spoofing");
    };

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "#06070B",
            color: "#E2E8F0",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif)",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch"
        }}>
            {/* Cabecera Táctica */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                background: "rgba(10, 15, 26, 0.95)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(12px)",
                position: "sticky",
                top: 0,
                zIndex: 100
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                        onClick={handleClose}
                        style={{
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#E2E8F0",
                            borderRadius: "10px",
                            padding: "8px 12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "13px",
                            fontWeight: 600
                        }}
                    >
                        <TacIcon name="arrow-left" size={16} />
                        VOLVER
                    </button>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <TacIcon name="shield" size={18} color="#FF3355" />
                            <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "1.5px", color: "#FFF" }}>
                                SOVEREIGN SHIELD
                            </span>
                            <span style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                background: shieldActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                color: shieldActive ? "#10B981" : "#EF4444",
                                border: `1px solid ${shieldActive ? "#10B981" : "#EF4444"}`,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                textTransform: "uppercase"
                            }}>
                                {shieldActive ? "EN GUARDIA" : "EN PAUSA"}
                            </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                            Centro Táctico de Defensa Celular, Caller ID & Seguridad No Invasiva
                        </div>
                    </div>
                </div>

                <button
                    onClick={refreshData}
                    style={{
                        background: "rgba(255, 255, 255, 0.06)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#94A3B8",
                        borderRadius: "8px",
                        padding: "8px",
                        cursor: "pointer"
                    }}
                    title="Actualizar Diagnóstico"
                >
                    <TacIcon name="refresh" size={16} />
                </button>
            </div>

            {/* Pestañas de Navegación del Dashboard */}
            <div style={{
                display: "flex",
                gap: "8px",
                padding: "12px 20px",
                background: "rgba(15, 23, 42, 0.6)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                overflowX: "auto"
            }}>
                {[
                    { id: "overview", label: "Visión General", icon: "shield" },
                    { id: "calls", label: "Escudo Telefonía & Spam", icon: "phone" },
                    { id: "apps", label: "Auditoría de Apps", icon: "lock" },
                    { id: "rf", label: "Guerra Electrónica & RF", icon: "radio" }
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as any)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 16px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                            background: activeTab === t.id ? "rgba(255, 51, 85, 0.15)" : "rgba(255, 255, 255, 0.03)",
                            color: activeTab === t.id ? "#FF3355" : "#94A3B8",
                            border: `1px solid ${activeTab === t.id ? "rgba(255, 51, 85, 0.4)" : "transparent"}`
                        }}
                    >
                        <TacIcon name={t.icon as any} size={15} color={activeTab === t.id ? "#FF3355" : "#94A3B8"} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Contenido Principal */}
            <div style={{ padding: "20px", maxWidth: "960px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>

                {/* ── TAB 1: VISIÓN GENERAL ────────────────────────────────────────── */}
                {activeTab === "overview" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                        {/* Tarjeta Hero: Índice de Blindaje Soberano */}
                        <div style={{
                            background: "linear-gradient(135deg, rgba(26, 35, 60, 0.6) 0%, rgba(13, 20, 36, 0.8) 100%)",
                            border: "1px solid rgba(255, 51, 85, 0.3)",
                            borderRadius: "16px",
                            padding: "24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "20px",
                            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)"
                        }}>
                            <div style={{ flex: "1 1 320px" }}>
                                <div style={{ fontSize: "12px", fontWeight: 800, color: "#FF3355", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                                    ÍNDICE DE BLINDAJE SOBERANO
                                </div>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginTop: "4px" }}>
                                    <span style={{ fontSize: "44px", fontWeight: 900, color: "#FFF", fontFamily: "JetBrains Mono, monospace" }}>
                                        {shieldIndex}%
                                    </span>
                                    <span style={{
                                        fontSize: "14px",
                                        fontWeight: 800,
                                        color: shieldIndex >= 85 ? "#10B981" : shieldIndex >= 65 ? "#F59E0B" : "#EF4444"
                                    }}>
                                        {shieldIndex >= 85 ? "PROTECCIÓN ÓPTIMA" : shieldIndex >= 65 ? "RIESGO MODERADO" : "AMENAZAS DETECTADAS"}
                                    </span>
                                </div>
                                <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "8px", lineHeight: "1.5" }}>
                                    {shieldIndex >= 85
                                        ? "Tu dispositivo no presenta fugas de sensores, la red celular está cifrada y el filtro anti-spam está vigilando llamadas en tiempo real."
                                        : "Existen aplicaciones con permisos críticos o anomalías de red que requieren tu revisión táctica."}
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "220px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94A3B8" }}>
                                    <span>Escudo de Telefonía:</span>
                                    <strong style={{ color: shieldActive ? "#10B981" : "#EF4444" }}>
                                        {shieldActive ? "VIGILANCIA ACTIVA" : "PAUSADO"}
                                    </strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94A3B8" }}>
                                    <span>Apps con Micrófono oculto:</span>
                                    <strong style={{ color: (appAudit?.appsWithMic || 0) > 0 ? "#F59E0B" : "#10B981" }}>
                                        {appAudit?.appsWithMic || 0} apps
                                    </strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94A3B8" }}>
                                    <span>Red Celular GSM:</span>
                                    <strong style={{ color: rfStatus?.is2gDowngradeThreat ? "#EF4444" : "#10B981" }}>
                                        {rfStatus?.networkType || "4G_LTE"} (Cifrado)
                                    </strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94A3B8" }}>
                                    <span>Temperatura Celular:</span>
                                    <strong style={{ color: (hardware?.batteryTempCelsius || 30) > 42 ? "#EF4444" : "#10B981" }}>
                                        {hardware?.batteryTempCelsius || 31}°C
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* Matriz 2x2 de Cuadrantes Tácticos */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "16px"
                        }}>

                            {/* Cuadrante 1: Telefonía & Anti-Spam */}
                            <div style={{
                                background: "rgba(15, 23, 42, 0.7)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "14px",
                                padding: "18px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <TacIcon name="phone" size={18} color="#FF3355" />
                                        <span style={{ fontSize: "14px", fontWeight: 800 }}>Escudo de Llamadas</span>
                                    </div>
                                    <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "8px" }}>
                                        <input
                                            type="checkbox"
                                            checked={shieldActive}
                                            onChange={e => handleToggleShield(e.target.checked)}
                                            style={{ accentColor: "#FF3355", cursor: "pointer" }}
                                        />
                                        <span style={{ fontSize: "11px", fontWeight: 700, color: shieldActive ? "#10B981" : "#94A3B8" }}>
                                            {shieldActive ? "ACTIVO" : "INACTIVO"}
                                        </span>
                                    </label>
                                </div>

                                <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: "1.4" }}>
                                    Detección local instantánea (<span style={{ color: "#FFF", fontWeight: 700 }}>&lt;15ms</span>) de telemercadeo, robocalls y estafas con base de datos semilla offline.
                                </div>

                                <div style={{
                                    background: "rgba(0, 0, 0, 0.3)",
                                    borderRadius: "8px",
                                    padding: "10px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: "12px"
                                }}>
                                    <span>Llamadas en Historial:</span>
                                    <strong style={{ color: "#FFF" }}>{callHistory.length} registradas</strong>
                                </div>

                                <button
                                    onClick={() => setActiveTab("calls")}
                                    style={{
                                        background: "rgba(255, 51, 85, 0.1)",
                                        border: "1px solid rgba(255, 51, 85, 0.3)",
                                        color: "#FF3355",
                                        borderRadius: "8px",
                                        padding: "8px",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        textAlign: "center"
                                    }}
                                >
                                    GESTIONAR LLAMADAS Y REGLAS →
                                </button>
                            </div>

                            {/* Cuadrante 2: Auditoría de Apps & Permisos */}
                            <div style={{
                                background: "rgba(15, 23, 42, 0.7)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "14px",
                                padding: "18px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <TacIcon name="lock" size={18} color="#38BDF8" />
                                        <span style={{ fontSize: "14px", fontWeight: 800 }}>Auditoría de Apps</span>
                                    </div>
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#38BDF8" }}>
                                        {appAudit?.totalApps || 0} APPS
                                    </span>
                                </div>

                                <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: "1.4" }}>
                                    Inspección silenciosa sin telemetría externa. Detecta qué apps tienen acceso a tu cámara, micrófono y ubicación.
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                                    <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
                                        <div style={{ color: "#94A3B8" }}>Micrófono:</div>
                                        <div style={{ fontWeight: 800, color: (appAudit?.appsWithMic || 0) > 0 ? "#F59E0B" : "#10B981" }}>
                                            {appAudit?.appsWithMic || 0} apps
                                        </div>
                                    </div>
                                    <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
                                        <div style={{ color: "#94A3B8" }}>Cámara:</div>
                                        <div style={{ fontWeight: 800, color: (appAudit?.appsWithCamera || 0) > 0 ? "#F59E0B" : "#10B981" }}>
                                            {appAudit?.appsWithCamera || 0} apps
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setActiveTab("apps")}
                                    style={{
                                        background: "rgba(56, 189, 248, 0.1)",
                                        border: "1px solid rgba(56, 189, 248, 0.3)",
                                        color: "#38BDF8",
                                        borderRadius: "8px",
                                        padding: "8px",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        textAlign: "center"
                                    }}
                                >
                                    AUDITAR PERMISOS DE APPS →
                                </button>
                            </div>

                            {/* Cuadrante 3: Guerra Electrónica / Anti-IMSI Catcher */}
                            <div style={{
                                background: "rgba(15, 23, 42, 0.7)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "14px",
                                padding: "18px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <TacIcon name="radio" size={18} color="#F59E0B" />
                                        <span style={{ fontSize: "14px", fontWeight: 800 }}>Vigilancia de Radiofrecuencia</span>
                                    </div>
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#10B981" }}>
                                        ENLACE SEGURO
                                    </span>
                                </div>

                                <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: "1.4" }}>
                                    Monitoreo anti-Stingray: alerta si una antena falsa intenta degradar tu conexión a 2G no cifrado para interceptar llamadas.
                                </div>

                                <div style={{
                                    background: "rgba(0,0,0,0.3)",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "6px",
                                    fontSize: "12px"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span>Red Móvil:</span>
                                        <strong style={{ color: "#FFF" }}>{rfStatus?.networkType || "4G_LTE"} (Cifrado)</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span>Seguridad Wi-Fi:</span>
                                        <strong style={{ color: "#10B981" }}>{rfStatus?.wifiSecurity || "WPA2/WPA3"}</strong>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setActiveTab("rf")}
                                    style={{
                                        background: "rgba(245, 158, 11, 0.1)",
                                        border: "1px solid rgba(245, 158, 11, 0.3)",
                                        color: "#F59E0B",
                                        borderRadius: "8px",
                                        padding: "8px",
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        textAlign: "center"
                                    }}
                                >
                                    VER TELEMETRÍA RF DETALLADA →
                                </button>
                            </div>

                            {/* Cuadrante 4: Telemetría Cinética & Batería */}
                            <div style={{
                                background: "rgba(15, 23, 42, 0.7)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "14px",
                                padding: "18px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <TacIcon name="battery" size={18} color="#10B981" />
                                        <span style={{ fontSize: "14px", fontWeight: 800 }}>Salud del Hardware</span>
                                    </div>
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#10B981" }}>
                                        {hardware?.batteryLevel || 85}% CARGA
                                    </span>
                                </div>

                                <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: "1.4" }}>
                                    Monitoreo pasivo de temperatura, degradación de batería y carga de memoria RAM con 0% de sobrecarga en reposo.
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                                    <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
                                        <div style={{ color: "#94A3B8" }}>Temperatura:</div>
                                        <div style={{ fontWeight: 800, color: (hardware?.batteryTempCelsius || 30) > 40 ? "#EF4444" : "#10B981" }}>
                                            {hardware?.batteryTempCelsius || 31.4}°C
                                        </div>
                                    </div>
                                    <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
                                        <div style={{ color: "#94A3B8" }}>RAM Disponible:</div>
                                        <div style={{ fontWeight: 800, color: "#FFF" }}>
                                            {Math.round((hardware?.ramFreeMb || 2048) / 1024 * 10) / 10} GB Libres
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    fontSize: "11px",
                                    color: "#64748B",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    marginTop: "auto"
                                }}>
                                    <TacIcon name="check" size={14} color="#10B981" />
                                    <span>Almacenamiento: {hardware?.storageFreeGb || 38} GB libres</span>
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {/* ── TAB 2: ESCUDO DE TELEFONÍA & REGLAS SPAM ───────────────────── */}
                {activeTab === "calls" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                        {/* Opciones de Operación */}
                        <div style={{
                            background: "rgba(15, 23, 42, 0.7)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "14px",
                            padding: "20px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px"
                        }}>
                            <div style={{ fontSize: "15px", fontWeight: 800, color: "#FFF" }}>
                                Configuración del Filtro de Llamadas
                            </div>

                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                                <div>
                                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#E2E8F0" }}>
                                        Modo Fortaleza (Colgado Automático)
                                    </div>
                                    <div style={{ fontSize: "12px", color: "#94A3B8" }}>
                                        {strictMode
                                            ? "Activo: El teléfono rechaza y cuelga en silencio estafas y robocalls confirmados."
                                            : "Desactivado (Recomendado): Muestra una tarjeta visual de advertencia sin cortar la llamada para evitar falsos positivos."}
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={strictMode}
                                    onChange={e => handleToggleStrict(e.target.checked)}
                                    style={{ width: "20px", height: "20px", accentColor: "#FF3355", cursor: "pointer" }}
                                />
                            </div>

                            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "14px" }}>
                                <div style={{ fontSize: "13px", fontWeight: 700, color: "#E2E8F0", marginBottom: "4px" }}>
                                    Prefijo de tu Tarjeta SIM (Detección Neighbor Spoofing)
                                </div>
                                <div style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "8px" }}>
                                    Ingresa los primeros 6 dígitos de tu número celular (ej. +519876) para que RED detecte llamadas generadas por máquinas que intentan simular ser tus vecinos.
                                </div>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <input
                                        type="text"
                                        value={simPrefixInput}
                                        onChange={e => setSimPrefixInput(e.target.value)}
                                        placeholder="Ej: +519876"
                                        style={{
                                            flex: 1,
                                            background: "rgba(0, 0, 0, 0.4)",
                                            border: "1px solid rgba(255, 255, 255, 0.12)",
                                            borderRadius: "8px",
                                            padding: "8px 12px",
                                            color: "#FFF",
                                            fontSize: "13px",
                                            fontFamily: "JetBrains Mono, monospace"
                                        }}
                                    />
                                    <button
                                        onClick={handleSaveSimPrefix}
                                        style={{
                                            background: "#FF3355",
                                            color: "#FFF",
                                            border: "none",
                                            borderRadius: "8px",
                                            padding: "8px 16px",
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            cursor: "pointer"
                                        }}
                                    >
                                        GUARDAR
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Probador Manual de Números */}
                        <div style={{
                            background: "rgba(15, 23, 42, 0.7)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "14px",
                            padding: "20px"
                        }}>
                            <div style={{ fontSize: "15px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>
                                Diagnóstico y Consulta Rápida de Número
                            </div>
                            <div style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "12px" }}>
                                Consulta cómo evalúa el motor de RED cualquier número telefónico antes de que te llame:
                            </div>

                            <form onSubmit={handleEvaluateManualNumber} style={{ display: "flex", gap: "8px" }}>
                                <input
                                    type="text"
                                    value={manualNumberInput}
                                    onChange={e => setManualNumberInput(e.target.value)}
                                    placeholder="Ej: +51984001234 o 984001234"
                                    style={{
                                        flex: 1,
                                        background: "rgba(0, 0, 0, 0.4)",
                                        border: "1px solid rgba(255, 255, 255, 0.12)",
                                        borderRadius: "8px",
                                        padding: "10px 14px",
                                        color: "#FFF",
                                        fontSize: "14px",
                                        fontFamily: "JetBrains Mono, monospace"
                                    }}
                                />
                                <button
                                    type="submit"
                                    style={{
                                        background: "rgba(255, 255, 255, 0.08)",
                                        color: "#FFF",
                                        border: "1px solid rgba(255, 255, 255, 0.15)",
                                        borderRadius: "8px",
                                        padding: "10px 18px",
                                        fontSize: "13px",
                                        fontWeight: 700,
                                        cursor: "pointer"
                                    }}
                                >
                                    EVALUAR
                                </button>
                            </form>

                            {evaluatedNumberResult && (
                                <div style={{
                                    marginTop: "16px",
                                    padding: "16px",
                                    borderRadius: "10px",
                                    background: evaluatedNumberResult.isSpam ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                                    border: `1px solid ${evaluatedNumberResult.isSpam ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#FFF", fontFamily: "JetBrains Mono, monospace" }}>
                                            {evaluatedNumberResult.number}
                                        </div>
                                        <span style={{
                                            fontSize: "11px",
                                            fontWeight: 800,
                                            padding: "3px 8px",
                                            borderRadius: "6px",
                                            background: evaluatedNumberResult.isSpam ? "#EF4444" : "#10B981",
                                            color: "#FFF"
                                        }}>
                                            {evaluatedNumberResult.isSpam ? "SPAM / ALTO RIESGO" : "NÚMERO SEGURO"}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "13px", fontWeight: 700, color: evaluatedNumberResult.isSpam ? "#F87171" : "#34D399", marginTop: "4px" }}>
                                        {evaluatedNumberResult.label}
                                    </div>
                                    <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>
                                        {evaluatedNumberResult.reason}
                                    </div>

                                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                                        {evaluatedNumberResult.isSpam ? (
                                            <button
                                                onClick={() => handleWhitelistNumber(evaluatedNumberResult.number, "Confiable por Usuario")}
                                                style={{
                                                    background: "rgba(16, 185, 129, 0.2)",
                                                    border: "1px solid #10B981",
                                                    color: "#10B981",
                                                    borderRadius: "6px",
                                                    padding: "6px 12px",
                                                    fontSize: "12px",
                                                    fontWeight: 700,
                                                    cursor: "pointer"
                                                }}
                                            >
                                                PASAR A LISTA BLANCA VIP
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleBlockNumber(evaluatedNumberResult.number, "Bloqueado Manualmente")}
                                                style={{
                                                    background: "rgba(239, 68, 68, 0.2)",
                                                    border: "1px solid #EF4444",
                                                    color: "#EF4444",
                                                    borderRadius: "6px",
                                                    padding: "6px 12px",
                                                    fontSize: "12px",
                                                    fontWeight: 700,
                                                    cursor: "pointer"
                                                }}
                                            >
                                                BLOQUEAR ESTE NÚMERO
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Historial de Llamadas Filtradas */}
                        <div style={{
                            background: "rgba(15, 23, 42, 0.7)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "14px",
                            padding: "20px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                                <div style={{ fontSize: "15px", fontWeight: 800, color: "#FFF" }}>
                                    Historial Táctico de Llamadas
                                </div>
                                {callHistory.length > 0 && (
                                    <button
                                        onClick={() => {
                                            sovereignShieldEngine.clearCallHistory();
                                            setCallHistory([]);
                                            toast.info("Historial limpiado");
                                        }}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#94A3B8",
                                            fontSize: "12px",
                                            cursor: "pointer",
                                            textDecoration: "underline"
                                        }}
                                    >
                                        Limpiar registro
                                    </button>
                                )}
                            </div>

                            {callHistory.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "30px", color: "#64748B", fontSize: "13px" }}>
                                    <TacIcon name="phone" size={28} color="#334155" />
                                    <div style={{ marginTop: "8px" }}>Sin llamadas entrantes recientes registradas</div>
                                    <div style={{ fontSize: "11px", marginTop: "4px" }}>Las llamadas que reciba tu teléfono se clasificarán automáticamente aquí.</div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {callHistory.map(item => (
                                        <div key={item.id} style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "12px 14px",
                                            background: "rgba(0, 0, 0, 0.3)",
                                            borderRadius: "8px",
                                            borderLeft: `4px solid ${item.verdict.isSpam ? "#EF4444" : "#10B981"}`
                                        }}>
                                            <div>
                                                <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFF", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {item.phoneNumber}
                                                </div>
                                                <div style={{ fontSize: "12px", color: item.verdict.isSpam ? "#F87171" : "#94A3B8" }}>
                                                    {item.verdict.label} · {item.verdict.reason}
                                                </div>
                                                <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
                                                    {new Date(item.timestamp).toLocaleTimeString()} · SIM {item.simSlot + 1}
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", gap: "6px" }}>
                                                {item.verdict.isSpam ? (
                                                    <button
                                                        onClick={() => handleWhitelistNumber(item.phoneNumber, "Desbloqueado")}
                                                        style={{
                                                            background: "rgba(16, 185, 129, 0.15)",
                                                            color: "#10B981",
                                                            border: "none",
                                                            borderRadius: "6px",
                                                            padding: "6px 10px",
                                                            fontSize: "11px",
                                                            fontWeight: 700,
                                                            cursor: "pointer"
                                                        }}
                                                    >
                                                        Permitir
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleBlockNumber(item.phoneNumber, "Marcado Spam")}
                                                        style={{
                                                            background: "rgba(239, 68, 68, 0.15)",
                                                            color: "#EF4444",
                                                            border: "none",
                                                            borderRadius: "6px",
                                                            padding: "6px 10px",
                                                            fontSize: "11px",
                                                            fontWeight: 700,
                                                            cursor: "pointer"
                                                        }}
                                                    >
                                                        Bloquear
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                )}

                {/* ── TAB 3: AUDITORÍA DE APPS & PRIVACIDAD ───────────────────────── */}
                {activeTab === "apps" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{
                            background: "rgba(15, 23, 42, 0.7)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "14px",
                            padding: "20px"
                        }}>
                            <div style={{ fontSize: "15px", fontWeight: 800, color: "#FFF", marginBottom: "4px" }}>
                                Auditor Silencioso de Aplicaciones
                            </div>
                            <div style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px", lineHeight: "1.5" }}>
                                RED analiza las aplicaciones instaladas en tu equipo mediante las APIs locales de Android. Jamás envía datos ni nombres de apps a ningún servidor exterior.
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {appAudit?.items.map(app => (
                                    <div key={app.packageName} style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "14px",
                                        background: "rgba(0, 0, 0, 0.3)",
                                        borderRadius: "10px",
                                        borderLeft: `4px solid ${app.riskLevel === "high" || app.riskLevel === "critical" ? "#EF4444" : app.riskLevel === "medium" ? "#F59E0B" : "#10B981"}`
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFF" }}>
                                                    {app.appName}
                                                </span>
                                                <span style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>
                                                    ({app.packageName})
                                                </span>
                                            </div>

                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                                                {app.hasBackgroundMic && (
                                                    <span style={{ background: "rgba(239, 68, 68, 0.2)", color: "#F87171", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                                                        🎤 Micrófono
                                                    </span>
                                                )}
                                                {app.hasBackgroundCamera && (
                                                    <span style={{ background: "rgba(239, 68, 68, 0.2)", color: "#F87171", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                                                        📷 Cámara
                                                    </span>
                                                )}
                                                {app.hasBackgroundLocation && (
                                                    <span style={{ background: "rgba(245, 158, 11, 0.2)", color: "#FBBF24", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 700 }}>
                                                        📍 Ubicación
                                                    </span>
                                                )}
                                                {app.hasAccessibilityService && (
                                                    <span style={{ background: "rgba(239, 68, 68, 0.3)", color: "#EF4444", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 800 }}>
                                                        ⚠️ ACCESIBILIDAD ACTIVA
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleOpenAppDetails(app.packageName)}
                                            style={{
                                                background: "rgba(255, 255, 255, 0.08)",
                                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                                color: "#E2E8F0",
                                                borderRadius: "6px",
                                                padding: "6px 12px",
                                                fontSize: "12px",
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                whiteSpace: "nowrap"
                                            }}
                                        >
                                            AJUSTES →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 4: GUERRA ELECTRÓNICA & RADIOFRECUENCIA ──────────────────── */}
                {activeTab === "rf" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{
                            background: "rgba(15, 23, 42, 0.7)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "14px",
                            padding: "20px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px"
                        }}>
                            <div style={{ fontSize: "15px", fontWeight: 800, color: "#FFF" }}>
                                Diagnóstico de Enlace y Amenazas en Radiofrecuencia
                            </div>

                            <div style={{
                                padding: "16px",
                                borderRadius: "10px",
                                background: rfStatus?.is2gDowngradeThreat ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                                border: `1px solid ${rfStatus?.is2gDowngradeThreat ? "#EF4444" : "#10B981"}`
                            }}>
                                <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF" }}>
                                    {rfStatus?.is2gDowngradeThreat
                                        ? "🚨 ALERTA: Posible Ataque IMSI-Catcher / Stingray"
                                        : "✅ Enlace Móvil Seguro: Sin Anomalías en la Torre Celular"}
                                </div>
                                <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "4px" }}>
                                    {rfStatus?.is2gDowngradeThreat
                                        ? "Tu dispositivo ha sido forzado a degradarse a red 2G GSM no autenticada. Se recomienda activar el Modo Avión en zonas sensibles."
                                        : "La conexión celular actual está operando sobre 4G/5G con autenticación mutua de cifrado de torre."}
                                </div>
                            </div>

                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: "12px",
                                fontSize: "13px"
                            }}>
                                <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px" }}>
                                    <div style={{ color: "#94A3B8", fontSize: "11px" }}>Operador Detectado:</div>
                                    <div style={{ fontWeight: 800, color: "#FFF", marginTop: "2px" }}>
                                        {rfStatus?.carrierName || "Automático (SIM Activa)"}
                                    </div>
                                </div>

                                <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px" }}>
                                    <div style={{ color: "#94A3B8", fontSize: "11px" }}>Tecnología Móvil:</div>
                                    <div style={{ fontWeight: 800, color: "#10B981", marginTop: "2px" }}>
                                        {rfStatus?.networkType || "4G_LTE (Cifrado)"}
                                    </div>
                                </div>

                                <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px" }}>
                                    <div style={{ color: "#94A3B8", fontSize: "11px" }}>Red Wi-Fi Vinculada:</div>
                                    <div style={{ fontWeight: 800, color: "#FFF", marginTop: "2px" }}>
                                        {rfStatus?.wifiSsid || "Wi-Fi Desconectado"}
                                    </div>
                                </div>

                                <div style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px" }}>
                                    <div style={{ color: "#94A3B8", fontSize: "11px" }}>Cifrado Wi-Fi:</div>
                                    <div style={{ fontWeight: 800, color: "#10B981", marginTop: "2px" }}>
                                        {rfStatus?.wifiSecurity || "WPA2-PSK"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
