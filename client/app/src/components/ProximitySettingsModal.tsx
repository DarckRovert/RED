"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { getDiscoveryConfig, setDiscoveryConfig, ProximityFilterConfig } from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { ErrorBanner } from "./ui/ErrorBanner";

export const ProximitySettingsModal: React.FC = () => {
    const { t } = useTranslation();
    const { goBack } = useRedStore();
    const [config, setConfig] = useState<ProximityFilterConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadConfig = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const cfg = await getDiscoveryConfig();
            setConfig(cfg);
        } catch (e: any) {
            setError(e.message || "Fallo al obtener la configuración de proximidad.");
            setConfig({
                stealth_mode: "all",
                rssi_threshold: -85,
                auto_wave_back: true,
                ignore_unknown: false
            } as unknown as ProximityFilterConfig);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const handleSave = async (updated: ProximityFilterConfig) => {
        setConfig(updated);
        try {
            await setDiscoveryConfig(updated);
            toast.success("Filtros de proximidad actualizados");
        } catch {
            toast.error("Error al guardar configuración");
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
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,229,255,0.4)"
                    }}>🔕</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Filtro Anti-Spam & Sigilo de Proximidad
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            PROXIMITY GUARD · RSSI ATTENUATION FILTER
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title="Cerrar filtro"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "20px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {isLoading ? (
                        <SkeletonCard count={2} />
                    ) : error ? (
                        <ErrorBanner message={error} onRetry={loadConfig} />
                    ) : (
                        <>
                            {/* Modo de Sigilo */}
                            <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 800 }}>MODO DE NOTIFICACIÓN DE PROXIMIDAD</div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {[
                                { id: "all", label: "🔔 Notificar Todos los Dispositivos", desc: "Acepta y notifica cualquier baliza detectada en la malla." },
                                { id: "contacts_only", label: "👥 Solo Contactos Verificados", desc: "Ignora dispositivos que no estén en tu libreta de contactos." },
                                { id: "silent", label: "🥷 Modo Sigilo Total", desc: "Escaneo pasivo sin emitir balizas de respuesta automáticas." }
                            ].map(m => (
                                <div
                                    key={m.id}
                                    onClick={() => config && handleSave({ ...config, stealth_mode: m.id as any })}
                                    className="card-tactical-interactive"
                                    style={{ padding: "12px", borderColor: config?.stealth_mode === m.id ? "var(--accent-cyan)" : "var(--glass-border)" }}
                                >
                                    <div style={{ fontSize: "0.85rem", fontWeight: 800, color: config?.stealth_mode === m.id ? "var(--accent-cyan)" : "#fff" }}>
                                        {m.label}
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        {m.desc}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Umbral RSSI */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.88rem", fontWeight: 800 }}>Umbral de Potencia de Señal (RSSI)</div>
                            <span className="badge-tactical badge-tactical-cyan">{(config?.rssi_threshold ?? -85)} dBm</span>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                            Las señales por debajo de este umbral serán descartadas para evitar ruido de balizas lejanas.
                        </div>
                        <input
                            type="range"
                            min={-95}
                            max={-50}
                            value={config?.rssi_threshold ?? -85}
                            onChange={e => config && handleSave({ ...config, rssi_threshold: parseInt(e.target.value) })}
                            style={{ accentColor: "var(--accent-cyan)" }}
                        />
                    </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};