"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import {
    getWeatherReports,
    postWeatherReport,
    getNativeBarometerReading,
    getNativeThermometerReading,
    getNativeHygrometerReading,
    getNativeCompassReading,
    WeatherReport,
    NativeBarometerResult,
} from "../lib/api";
import {
    analyzeAtmosphere,
    recordBaroSample,
    getBaroHistory,
    BaroAnalysis,
} from "../lib/weatherBarometerEngine";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { ErrorBanner } from "./ui/ErrorBanner";
import { EmptyState } from "./ui/EmptyState";

type TabView = "monitor" | "broadcast" | "feed";

const CAP_EVENTS = [
    { label: "⚡ Tormenta Eléctrica Severa", value: "Tormenta Severa" },
    { label: "🌀 Huracán / Ciclón Tropical", value: "Huracán / Ciclón" },
    { label: "🌊 Inundación Repentina", value: "Inundación Repentina" },
    { label: "🔥 Ola de Calor Extremo", value: "Ola de Calor Extremo" },
    { label: "❄️ Frente Frío Polar / Helada", value: "Frente Frío Polar" },
    { label: "💨 Vientos Huracanados / Vendaval", value: "Vientos Huracanados" },
    { label: "📉 Descenso Barométrico Abrupto", value: "Descenso Barométrico Abrupto" },
    { label: "⚠️ Condición Meteorológica Inestable", value: "Condición Inestable" },
];

const CAP_SEVERITIES = [
    { key: "Extreme", label: "EXTREMA", color: "#FF1744", border: "rgba(255,23,68,0.4)", desc: "Amenaza extraordinaria a la vida o infraestructura" },
    { key: "Severe", label: "SEVERA", color: "#FF9100", border: "rgba(255,145,0,0.4)", desc: "Amenaza significativa, requiere acción protectora inmediata" },
    { key: "Moderate", label: "MODERADA", color: "#FFD600", border: "rgba(255,214,0,0.4)", desc: "Impacto localizado, mantener vigilancia táctica" },
    { key: "Minor", label: "MENOR", color: "#00E5FF", border: "rgba(0,229,255,0.3)", desc: "Informativo o alteración meteorológica leve" },
];

export const WeatherAlertPanel: React.FC = () => {
    const { identity, goBack, activeWeatherReports } = useRedStore();
    const { t } = useTranslation();
    const myNickname = identity?.nickname || "Estación Táctica RED";

    // View state
    const [currentTab, setCurrentTab] = useState<TabView>("monitor");
    const [reports, setReports] = useState<WeatherReport[]>([]);
    const [filterCapOnly, setFilterCapOnly] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Live Atmospheric State (Acquired dynamically via Hardware or GPS, or entered manually)
    const [pressure, setPressure] = useState<string>("");
    const [temperature, setTemperature] = useState<string>("");
    const [humidity, setHumidity] = useState<string>("");
    const [windSpeed, setWindSpeed] = useState<string>("");
    const [windDir, setWindDir] = useState<string>("");
    const [conditionSummary, setConditionSummary] = useState<string>("");
    
    // Hardware & GPS Detection State
    const [detecting, setDetecting] = useState(false);
    const [hwBaro, setHwBaro] = useState(false);
    const [hwTemp, setHwTemp] = useState(false);
    const [hwHum, setHwHum] = useState(false);
    const [hwCompass, setHwCompass] = useState(false);
    const [sensorSource, setSensorSource] = useState<{
        type: "hardware" | "gps_meteo" | "manual";
        label: string;
        details?: string;
    }>({
        type: "manual",
        label: "Esperando Detección",
        details: "Listo para sincronizar sensores de hardware o GPS",
    });

    // CAP Alert Form State
    const [isCapAlert, setIsCapAlert] = useState(false);
    const [capEvent, setCapEvent] = useState(CAP_EVENTS[0].value);
    const [capSeverity, setCapSeverity] = useState<string>("Severe");
    const [capUrgency, setCapUrgency] = useState<string>("Immediate");
    const [capCertainty, setCapCertainty] = useState<string>("Observed");
    const [capHeadline, setCapHeadline] = useState("");
    const [capInstruction, setCapInstruction] = useState("");
    const [capAreaDesc, setCapAreaDesc] = useState("");
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [transmitting, setTransmitting] = useState(false);

    // Atmospheric Analysis (Zambretti, 3h Delta P, Dew Point, Heat Index)
    const atmosphericAnalysis: BaroAnalysis = useMemo(() => {
        const pClean = (pressure || "").replace(",", ".");
        const tClean = (temperature || "").replace(",", ".");
        const hClean = (humidity || "").replace(",", ".");
        const pNum = parseFloat(pClean);
        const tNum = parseFloat(tClean);
        const hNum = parseFloat(hClean);

        if (isNaN(pNum)) {
            return {
                currentHpa: 0,
                deltaP3h: 0,
                trend: "STEADY" as const,
                trendLabel: detecting ? "Escaneando Sensores..." : "Sin Calibrar",
                trendIcon: detecting ? "📡" : "🧭",
                trendDescription: "Sincronice telemetría con el botón superior o ingrese la lectura barométrica de su estación para iniciar el análisis.",
                isStormWarning: false,
                zambrettiCode: "OFF-GRID",
                zambrettiForecast: "A la espera de lectura barométrica para proyectar pronóstico.",
                dewPointC: null,
                heatIndexC: null,
                cloudBaseEstimatedMeters: null,
                suggestedCapSeverity: "None" as const,
            };
        }

        return analyzeAtmosphere(
            pNum,
            !isNaN(tNum) ? tNum : undefined,
            !isNaN(hNum) ? hNum : undefined
        );
    }, [pressure, temperature, humidity, detecting]);

    // Parse WMO weather code
    const parseWmoCode = (code: number): string => {
        switch (code) {
            case 0: return "Cielos Limpios (Despejado)";
            case 1: case 2: case 3: return "Parcialmente Nublado";
            case 45: case 48: return "Niebla Banco Denso";
            case 51: case 53: case 55: return "Llovizna Ligera";
            case 61: case 63: case 65: return "Lluvia Moderada";
            case 71: case 73: case 75: return "Nieve / Helada";
            case 80: case 81: case 82: return "Chubascos Intensos";
            case 95: case 96: case 99: return "Tormenta Eléctrica Severa";
            default: return "Condición Atmosférica Variable";
        }
    };

    // Full Atmospheric Acquisition (Hardware Sensor + GPS Fallback)
    const acquireAtmosphericTelemetry = useCallback(async () => {
        setDetecting(true);
        let hardwareSuccess = false;
        let detectedSensors: string[] = [];

        // Step 1: Check Native Android Sensors
        try {
            const [baro, temp, hum, compass] = await Promise.all([
                getNativeBarometerReading(),
                getNativeThermometerReading(),
                getNativeHygrometerReading(),
                getNativeCompassReading()
            ]);

            if (baro && baro.available && baro.pressure_hpa) {
                setPressure(baro.pressure_hpa.toFixed(2));
                setHwBaro(true);
                hardwareSuccess = true;
                detectedSensors.push("Barómetro");
                recordBaroSample({ timestamp: Date.now(), pressureHpa: baro.pressure_hpa });
            } else { setHwBaro(false); }

            if (temp && temp.available && temp.value !== undefined) {
                setTemperature(temp.value.toFixed(1));
                setHwTemp(true);
                hardwareSuccess = true;
                detectedSensors.push("Termómetro");
            } else { setHwTemp(false); }

            if (hum && hum.available && hum.value !== undefined) {
                setHumidity(hum.value.toFixed(1));
                setHwHum(true);
                hardwareSuccess = true;
                detectedSensors.push("Higrómetro");
            } else { setHwHum(false); }

            if (compass && compass.available && compass.azimuth !== null) {
                setWindDir(Math.round(compass.azimuth).toString());
                setHwCompass(true);
                hardwareSuccess = true;
                detectedSensors.push("Brújula");
            } else { setHwCompass(false); }

            if (hardwareSuccess) {
                setSensorSource({
                    type: "hardware",
                    label: "Sensores Físicos",
                    details: `Detectados: ${detectedSensors.join(", ")}`,
                });
                toast.success(`Telemetría hardware obtenida: ${detectedSensors.join(", ")}`);
            }
        } catch {
            // Silencioso, fallback
        }

        // Step 2: Acquire GPS
        try {
            let lat: number | null = null;
            let lon: number | null = null;

            try {
                const { Geolocation } = await import("@capacitor/geolocation");
                const pos = await Geolocation.getCurrentPosition({ timeout: 6000, enableHighAccuracy: true });
                lat = pos.coords.latitude;
                lon = pos.coords.longitude;
            } catch {
                if (typeof navigator !== "undefined" && "geolocation" in navigator) {
                    await new Promise<void>((resolve) => {
                        navigator.geolocation.getCurrentPosition(
                            (p) => { lat = p.coords.latitude; lon = p.coords.longitude; resolve(); },
                            () => resolve(),
                            { timeout: 5000 }
                        );
                    });
                }
            }

            if (lat !== null && lon !== null) {
                setLatitude(lat);
                setLongitude(lon);
                if (!capAreaDesc) {
                    setCapAreaDesc(`Sector GPS (${lat.toFixed(3)}, ${lon.toFixed(3)})`);
                }

                if (!hardwareSuccess) {
                    setSensorSource({
                        type: "manual",
                        label: "Modo Manual (GPS Fijo)",
                        details: `GPS: ${lat.toFixed(2)}, ${lon.toFixed(2)}. Ingrese datos manuales.`,
                    });
                } else {
                    setSensorSource(prev => ({ ...prev, details: `${prev.details} · GPS OK` }));
                    if (!detectedSensors.length) toast.success("Ubicación GPS sincronizada con éxito");
                }
            } else if (!hardwareSuccess) {
                setSensorSource({
                    type: "manual",
                    label: "Modo Off-Grid Manual",
                    details: "Sin sensores de hardware ni GPS.",
                });
            }
        } catch (err) {
            if (!hardwareSuccess) {
                setSensorSource({
                    type: "manual",
                    label: "Modo Off-Grid Manual",
                    details: "Sin sensores de hardware ni GPS.",
                });
            }
        } finally {
            setDetecting(false);
        }
    }, [capAreaDesc]);

    // Fetch reports from mesh daemon
    const fetchReports = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getWeatherReports();
            setReports(Array.isArray(data) ? data : []);
        } catch (e: any) {
            console.error("Weather fetch error:", e);
            setError(e.message || "Error al cargar el clima");
            setReports([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
        acquireAtmosphericTelemetry();
    }, [acquireAtmosphericTelemetry]);

    // Real-time SSE updates from Rust mesh network
    useEffect(() => {
        if (activeWeatherReports && activeWeatherReports.length > 0) {
            setReports(prev => {
                const combined = [...activeWeatherReports, ...prev];
                const seen = new Set<string>();
                return combined.filter(r => {
                    if (!r || !r.id) return true;
                    if (seen.has(r.id)) return false;
                    seen.add(r.id);
                    return true;
                });
            });
        }
    }, [activeWeatherReports]);

    // Transmit Weather Bulletin or CAP Emergency Alert
    const handleTransmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const pClean = (pressure || "").replace(",", ".");
        const tClean = (temperature || "").replace(",", ".");
        const hClean = (humidity || "").replace(",", ".");
        const wClean = (windSpeed || "").replace(",", ".");
        const wdClean = (windDir || "").replace(",", ".");

        const pNum = parseFloat(pClean);
        const tNum = parseFloat(tClean);
        const hNum = parseFloat(hClean);
        const wNum = parseFloat(wClean);
        const wdNum = parseFloat(wdClean);

        if (isNaN(pNum)) {
            toast.warning("Ingrese una lectura válida de presión barométrica");
            return;
        }

        setTransmitting(true);
        try {
            const headlineText = isCapAlert
                ? (capHeadline.trim() || `ALERTA CAP: ${capEvent}`)
                : conditionSummary;

            const instructionText = isCapAlert
                ? (capInstruction.trim() || "Mantener escucha en canal táctico y aplicar protocolos de seguridad.")
                : atmosphericAnalysis.zambrettiForecast;

            await postWeatherReport({
                sender_name: myNickname,
                pressure_hpa: pNum,
                temperature_c: !isNaN(tNum) ? tNum : undefined,
                humidity_percent: !isNaN(hNum) ? hNum : undefined,
                wind_speed_kmh: !isNaN(wNum) ? wNum : undefined,
                wind_direction_deg: !isNaN(wdNum) ? wdNum : undefined,
                condition_summary: headlineText,
                is_disaster_alert: isCapAlert,
                cap_event: isCapAlert ? capEvent : undefined,
                cap_severity: isCapAlert ? capSeverity : undefined,
                cap_urgency: isCapAlert ? capUrgency : undefined,
                cap_certainty: isCapAlert ? capCertainty : undefined,
                cap_headline: isCapAlert ? headlineText : undefined,
                cap_instruction: instructionText,
                cap_area_desc: capAreaDesc.trim() || undefined,
                cap_expires_at: isCapAlert ? Date.now() + 6 * 60 * 60 * 1000 : undefined,
                latitude: latitude || undefined,
                longitude: longitude || undefined
            } as any);
            // Save to local barometer history
            recordBaroSample({
                timestamp: Date.now(),
                pressureHpa: pNum,
                temperatureC: !isNaN(tNum) ? tNum : undefined,
                humidityPercent: !isNaN(hNum) ? hNum : undefined,
            });

            toast.success(
                isCapAlert
                    ? "🚨 ALERTA CAP V1.2 TRANSMITIDA A LA MALLA"
                    : "📡 Boletín meteorológico propagado en la malla"
            );

            await fetchReports();
            setCurrentTab("feed");
        } catch {
            toast.error("Error al transmitir reporte a la red P2P");
        } finally {
            setTransmitting(false);
        }
    };

    // Filtered reports for feed view
    const visibleReports = useMemo(() => {
        if (!filterCapOnly) return reports;
        return reports.filter((r: any) => r.is_disaster_alert || r.is_alert);
    }, [reports, filterCapOnly]);

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "12px 16px",
                height: "64px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.98) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: "10px",
                        background: atmosphericAnalysis.isStormWarning
                            ? "linear-gradient(135deg, #FF1744 0%, #D50000 100%)"
                            : "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem",
                        boxShadow: atmosphericAnalysis.isStormWarning
                            ? "0 0 16px rgba(255,23,68,0.5)"
                            : "0 0 14px rgba(0,229,255,0.35)",
                    }}>
                        {atmosphericAnalysis.isStormWarning ? "⚡" : "🌦️"}
                    </div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 800, letterSpacing: "0.2px", lineHeight: "1.2" }}>
                            {t('weather_panel.title')}
                        </div>
                        <div style={{ fontSize: "0.64rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t('weather_panel.subtitle')}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        onClick={acquireAtmosphericTelemetry}
                        disabled={detecting}
                        className="btn-tactical-secondary"
                        title="Re-escanear sensores"
                        style={{ padding: "6px 10px", fontSize: "0.74rem", height: "34px" }}
                    >
                        {detecting ? "..." : "📡 Sincronizar"}
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t('common.close')}
                        style={{ width: 34, height: 34, fontSize: "0.9rem" }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas Táctico */}
            <div style={{
                display: "flex",
                background: "rgba(10, 10, 20, 0.95)",
                borderBottom: "1px solid var(--glass-border)",
                padding: "4px 8px",
                gap: "6px",
                flexShrink: 0,
            }}>
                <button
                    onClick={() => setCurrentTab("monitor")}
                    style={{
                        flex: 1,
                        padding: "8px 4px",
                        borderRadius: "8px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: currentTab === "monitor" ? "rgba(0, 229, 255, 0.15)" : "transparent",
                        color: currentTab === "monitor" ? "var(--accent-cyan)" : "var(--text-muted)",
                        boxShadow: currentTab === "monitor" ? "inset 0 0 10px rgba(0,229,255,0.2)" : "none",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                    }}
                >
                    📊 Monitor Baro
                </button>
                <button
                    onClick={() => setCurrentTab("broadcast")}
                    style={{
                        flex: 1,
                        padding: "8px 4px",
                        borderRadius: "8px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: currentTab === "broadcast" ? "rgba(255, 23, 68, 0.15)" : "transparent",
                        color: currentTab === "broadcast" ? "var(--accent-crimson-bright)" : "var(--text-muted)",
                        boxShadow: currentTab === "broadcast" ? "inset 0 0 10px rgba(255,23,68,0.2)" : "none",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                    }}
                >
                    🚨 Emitir Alerta CAP
                </button>
                <button
                    onClick={() => setCurrentTab("feed")}
                    style={{
                        flex: 1,
                        padding: "8px 4px",
                        borderRadius: "8px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: currentTab === "feed" ? "rgba(16, 185, 129, 0.15)" : "transparent",
                        color: currentTab === "feed" ? "var(--accent-emerald)" : "var(--text-muted)",
                        boxShadow: currentTab === "feed" ? "inset 0 0 10px rgba(16,185,129,0.2)" : "none",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                    }}
                >
                    📡 Malla ({reports.length})
                </button>
            </div>

            {/* Contenido con Scroll Táctico */}
            <div className="scroll-container" style={{ flex: 1, padding: "14px 14px 80px 14px", overflowY: "auto" }}>
                <div style={{ maxWidth: "640px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>

                    {/* VISTA 1: MONITOR BAROMÉTRICO Y TELEMETRÍA */}
                    {currentTab === "monitor" && (
                        <>
                            {/* Tarjeta de Estado del Sensor & Diagnóstico */}
                            <div className="card-tactical animate-enter" style={{
                                padding: "12px 14px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "linear-gradient(135deg, rgba(20,25,35,0.7) 0%, rgba(10,12,20,0.9) 100%)",
                                borderLeft: `3px solid ${sensorSource.type === "hardware" ? "#10B981" : sensorSource.type === "gps_meteo" ? "#00E5FF" : "#F59E0B"}`
                            }}>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span style={{ fontSize: "0.70rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                            Fuente de Telemetría:
                                        </span>
                                        <span style={{
                                            fontSize: "0.70rem",
                                            fontWeight: 800,
                                            padding: "1px 6px",
                                            borderRadius: "4px",
                                            background: sensorSource.type === "hardware" ? "rgba(16,185,129,0.2)" : sensorSource.type === "gps_meteo" ? "rgba(0,229,255,0.2)" : "rgba(245,158,11,0.2)",
                                            color: sensorSource.type === "hardware" ? "#10B981" : sensorSource.type === "gps_meteo" ? "#00E5FF" : "#F59E0B"
                                        }}>
                                            {sensorSource.label}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        {sensorSource.details}
                                    </div>
                                </div>
                                <div style={{ fontSize: "1.3rem" }}>
                                    {sensorSource.type === "hardware" ? "📱" : sensorSource.type === "gps_meteo" ? "🛰️" : "🧭"}
                                </div>
                            </div>

                            {/* Tacómetro / Medidor de Presión Principal */}
                            <div className="card-tactical animate-enter" style={{
                                padding: "18px 16px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                textAlign: "center",
                                gap: "10px",
                                background: "radial-gradient(circle at 50% 30%, rgba(0, 229, 255, 0.08) 0%, rgba(10, 14, 24, 0.95) 75%)",
                                borderColor: atmosphericAnalysis.isStormWarning ? "rgba(255,23,68,0.5)" : "var(--glass-border)",
                            }}>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", letterSpacing: "1px", fontWeight: 800 }}>
                                    PRESIÓN BAROMÉTRICA DE SUPERFICIE
                                </div>

                                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                    <input
                                        type="number"
                                        value={pressure}
                                        onChange={(e) => setPressure(e.target.value)}
                                        readOnly={hwBaro}
                                        placeholder={detecting ? "..." : "0000"}
                                        style={{
                                            fontSize: pressure ? "2.8rem" : "1.8rem",
                                            fontWeight: 900,
                                            fontFamily: "JetBrains Mono, monospace",
                                            color: atmosphericAnalysis.isStormWarning ? "#FF1744" : "var(--accent-cyan)",
                                            lineHeight: 1,
                                            background: "transparent",
                                            border: "none",
                                            outline: "none",
                                            width: "140px",
                                            textAlign: "center",
                                            opacity: hwBaro ? 0.8 : 1
                                        }}
                                    />
                                    {pressure && (
                                        <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-muted)" }}>
                                            hPa
                                        </span>
                                    )}
                                </div>

                                {/* Banner de Tendencia Barométrica (ΔP / 3h) */}
                                <div style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "6px 14px",
                                    borderRadius: "20px",
                                    background: atmosphericAnalysis.isStormWarning ? "rgba(255, 23, 68, 0.15)" : "rgba(0, 229, 255, 0.1)",
                                    border: `1px solid ${atmosphericAnalysis.isStormWarning ? "rgba(255,23,68,0.4)" : "rgba(0,229,255,0.3)"}`,
                                }}>
                                    <span style={{ fontSize: "1rem" }}>{atmosphericAnalysis.trendIcon}</span>
                                    <span style={{
                                        fontSize: "0.82rem",
                                        fontWeight: 800,
                                        color: atmosphericAnalysis.isStormWarning ? "#FF5252" : "var(--accent-cyan)"
                                    }}>
                                        Tendencia: {atmosphericAnalysis.trendLabel}
                                    </span>
                                </div>

                                <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", maxWidth: "480px", margin: 0 }}>
                                    {atmosphericAnalysis.trendDescription}
                                </p>
                            </div>

                            {/* Pronóstico Off-Grid Zambretti */}
                            <div className="card-tactical animate-enter" style={{
                                padding: "14px 16px",
                                borderLeft: "4px solid var(--accent-amber)",
                                background: "rgba(245, 158, 11, 0.05)",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                    <span style={{ fontSize: "0.70rem", fontWeight: 800, color: "var(--accent-amber)" }}>
                                        PRONÓSTICO HEURÍSTICO ZAMBRETTI (OFF-GRID)
                                    </span>
                                    <span style={{ fontSize: "0.65rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                                        [{atmosphericAnalysis.zambrettiCode}]
                                    </span>
                                </div>
                                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                    {atmosphericAnalysis.zambrettiForecast}
                                </div>
                            </div>

                            {/* Matriz de Telemetría Complementaria */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                                <div className="card-tactical" style={{ padding: "12px", textAlign: "center" }}>
                                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>TEMPERATURA</div>
                                    <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", fontSize: "1.3rem", fontWeight: 900, color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace" }}>
                                        <input type="number" value={temperature} onChange={e => setTemperature(e.target.value)} readOnly={hwTemp} placeholder="-" style={{ width: "60px", background: "transparent", border: "none", outline: "none", color: "inherit", textAlign: "right", font: "inherit", opacity: hwTemp ? 0.8 : 1 }} />
                                        <span style={{ fontSize: "0.75rem" }}>°C</span>
                                    </div>
                                    {atmosphericAnalysis.heatIndexC && (
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                            Sensación: {atmosphericAnalysis.heatIndexC}°C
                                        </div>
                                    )}
                                </div>

                                <div className="card-tactical" style={{ padding: "12px", textAlign: "center" }}>
                                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>HUMEDAD REL.</div>
                                    <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", fontSize: "1.3rem", fontWeight: 900, color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                        <input type="number" value={humidity} onChange={e => setHumidity(e.target.value)} readOnly={hwHum} placeholder="-" style={{ width: "50px", background: "transparent", border: "none", outline: "none", color: "inherit", textAlign: "right", font: "inherit", opacity: hwHum ? 0.8 : 1 }} />
                                        <span style={{ fontSize: "0.75rem" }}>%</span>
                                    </div>
                                    {atmosphericAnalysis.dewPointC !== null && (
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                            Punto Rocío: {atmosphericAnalysis.dewPointC}°C
                                        </div>
                                    )}
                                </div>

                                <div className="card-tactical" style={{ padding: "12px", textAlign: "center" }}>
                                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>VIENTO ESTIMADO</div>
                                    <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", fontSize: "1.3rem", fontWeight: 900, color: "#60A5FA", fontFamily: "JetBrains Mono, monospace" }}>
                                        <input type="number" value={windSpeed} onChange={e => setWindSpeed(e.target.value)} placeholder="0" style={{ width: "50px", background: "transparent", border: "none", outline: "none", color: "inherit", textAlign: "right", font: "inherit" }} />
                                        <span style={{ fontSize: "0.75rem" }}> km/h</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        Rumbo: <input type="number" value={windDir} onChange={e => setWindDir(e.target.value)} readOnly={hwCompass} placeholder="0" style={{ width: "35px", marginLeft: "4px", background: hwCompass ? "transparent" : "rgba(0,0,0,0.2)", border: hwCompass ? "none" : "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--text-primary)", textAlign: "center", fontSize: "0.65rem", opacity: hwCompass ? 0.8 : 1 }} />°
                                    </div>
                                </div>

                                <div className="card-tactical" style={{ padding: "12px", textAlign: "center" }}>
                                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>BASE DE NUBES (LCL)</div>
                                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#C084FC", fontFamily: "JetBrains Mono, monospace" }}>
                                        {atmosphericAnalysis.cloudBaseEstimatedMeters ? `${atmosphericAnalysis.cloudBaseEstimatedMeters}` : "—"}<span style={{ fontSize: "0.75rem" }}> m</span>
                                    </div>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        Sobre el terreno
                                    </div>
                                </div>
                            </div>

                            {/* Botón Rápido para Emitir */}
                            <button
                                onClick={() => setCurrentTab("broadcast")}
                                className="btn-tactical-primary"
                                style={{
                                    padding: "14px",
                                    fontSize: "0.88rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    marginTop: "4px"
                                }}
                            >
                                📡 Proceder a Difundir en la Malla
                            </button>
                        </>
                    )}

                    {/* VISTA 2: EMISOR DE ALERTA CAP Y BOLETÍN */}
                    {currentTab === "broadcast" && (
                        <form onSubmit={handleTransmit} className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            
                            {/* Conmutador Modo Rutina vs Alerta CAP */}
                            <div style={{
                                display: "flex",
                                borderRadius: "10px",
                                overflow: "hidden",
                                border: "1px solid var(--glass-border)",
                                background: "rgba(10, 14, 24, 0.8)",
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setIsCapAlert(false)}
                                    style={{
                                        flex: 1,
                                        padding: "10px 8px",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: "0.78rem",
                                        fontWeight: 800,
                                        background: !isCapAlert ? "rgba(0, 229, 255, 0.2)" : "transparent",
                                        color: !isCapAlert ? "var(--accent-cyan)" : "var(--text-muted)",
                                    }}
                                >
                                    🌤️ Boletín Meteorológico
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCapAlert(true)}
                                    style={{
                                        flex: 1,
                                        padding: "10px 8px",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: "0.78rem",
                                        fontWeight: 800,
                                        background: isCapAlert ? "linear-gradient(135deg, rgba(255,23,68,0.3) 0%, rgba(213,0,0,0.5) 100%)" : "transparent",
                                        color: isCapAlert ? "#FF1744" : "var(--text-muted)",
                                    }}
                                >
                                    🚨 Alerta de Emergencia CAP v1.2
                                </button>
                            </div>

                            {/* Sección Específica CAP si está activo */}
                            {isCapAlert && (
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "12px",
                                    padding: "14px",
                                    borderRadius: "10px",
                                    background: "rgba(255, 23, 68, 0.06)",
                                    border: "1px solid rgba(255, 23, 68, 0.3)"
                                }}>
                                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#FF1744", textTransform: "uppercase" }}>
                                        Configuración Estándar CAP OASIS v1.2
                                    </div>

                                    {/* Selector de Evento */}
                                    <div>
                                        <label style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                            TIPO DE EVENTO METEOROLÓGICO:
                                        </label>
                                        <select
                                            value={capEvent}
                                            onChange={(e) => setCapEvent(e.target.value)}
                                            style={{
                                                width: "100%",
                                                marginTop: "4px",
                                                padding: "10px",
                                                borderRadius: "8px",
                                                background: "rgba(18, 22, 34, 0.9)",
                                                border: "1px solid var(--glass-border)",
                                                color: "var(--text-primary)",
                                                fontSize: "0.84rem",
                                                fontWeight: 700,
                                            }}
                                        >
                                            {CAP_EVENTS.map((ev, i) => (
                                                <option key={i} value={ev.value}>{ev.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Selector de Severidad con Badges */}
                                    <div>
                                        <label style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                            NIVEL DE SEVERIDAD CAP:
                                        </label>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px", marginTop: "4px" }}>
                                            {CAP_SEVERITIES.map((sev) => (
                                                <button
                                                    key={sev.key}
                                                    type="button"
                                                    onClick={() => setCapSeverity(sev.key)}
                                                    style={{
                                                        padding: "8px 6px",
                                                        borderRadius: "6px",
                                                        border: `1px solid ${capSeverity === sev.key ? sev.color : "var(--glass-border)"}`,
                                                        background: capSeverity === sev.key ? sev.border : "rgba(15, 18, 28, 0.6)",
                                                        color: capSeverity === sev.key ? sev.color : "var(--text-muted)",
                                                        fontSize: "0.72rem",
                                                        fontWeight: 800,
                                                        cursor: "pointer",
                                                        textAlign: "center"
                                                    }}
                                                >
                                                    {sev.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Titular / Headline */}
                                    <div>
                                        <label style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                            TITULAR DE LA ALERTA (HEADLINE):
                                        </label>
                                        <input
                                            value={capHeadline}
                                            onChange={(e) => setCapHeadline(e.target.value)}
                                            placeholder={`ALERTA: ${capEvent} en aproximación`}
                                            style={{ width: "100%", marginTop: "4px", fontSize: "0.85rem" }}
                                        />
                                    </div>

                                    {/* Instrucciones a la Población Civil */}
                                    <div>
                                        <label style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                            INSTRUCCIONES TÁCTICAS Y DE EVACUACIÓN (CIVIL ACTION):
                                        </label>
                                        <textarea
                                            value={capInstruction}
                                            onChange={(e) => setCapInstruction(e.target.value)}
                                            placeholder="Buscar refugio inmediato en estructura segura. Desconectar antenas de radio externas."
                                            rows={2}
                                            style={{
                                                width: "100%",
                                                marginTop: "4px",
                                                fontSize: "0.82rem",
                                                borderRadius: "8px",
                                                background: "rgba(18, 22, 34, 0.9)",
                                                border: "1px solid var(--glass-border)",
                                                color: "var(--text-primary)",
                                                padding: "8px 10px",
                                                fontFamily: "inherit"
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Valores de Telemetría Barométrica para la Emisión */}
                            <div>
                                <label style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    MEDICIONES DE ESTACIÓN:
                                </label>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px", marginTop: "4px" }}>
                                    <div>
                                        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Presión (hPa)</span>
                                        <input
                                            value={pressure}
                                            onChange={(e) => setPressure(e.target.value)}
                                            placeholder="1013.2"
                                            style={{ fontSize: "0.82rem", width: "100%", marginTop: "2px" }}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Temp (°C)</span>
                                        <input
                                            value={temperature}
                                            onChange={(e) => setTemperature(e.target.value)}
                                            placeholder="20.0"
                                            style={{ fontSize: "0.82rem", width: "100%", marginTop: "2px" }}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Humedad (%)</span>
                                        <input
                                            value={humidity}
                                            onChange={(e) => setHumidity(e.target.value)}
                                            placeholder="60"
                                            style={{ fontSize: "0.82rem", width: "100%", marginTop: "2px" }}
                                        />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Viento (km/h)</span>
                                        <input
                                            value={windSpeed}
                                            onChange={(e) => setWindSpeed(e.target.value)}
                                            placeholder="15"
                                            style={{ fontSize: "0.82rem", width: "100%", marginTop: "2px" }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Descripción de Área / Georreferencia */}
                            <div>
                                <label style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    DESCRIPCIÓN DEL ÁREA / SECTOR AFECTADO:
                                </label>
                                <input
                                    value={capAreaDesc}
                                    onChange={(e) => setCapAreaDesc(e.target.value)}
                                    placeholder="Sector Central / Coordenadas Locales"
                                    style={{ width: "100%", marginTop: "4px", fontSize: "0.85rem" }}
                                />
                            </div>

                            {!isCapAlert && (
                                <div>
                                    <label style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                        RESUMEN DE CONDICIÓN CLIMÁTICA:
                                    </label>
                                    <input
                                        value={conditionSummary}
                                        onChange={(e) => setConditionSummary(e.target.value)}
                                        placeholder="Cielos despejados, vientos en calma"
                                        style={{ width: "100%", marginTop: "4px", fontSize: "0.85rem" }}
                                    />
                                </div>
                            )}

                            {/* Botón de Transmisión */}
                            <button
                                type="submit"
                                disabled={transmitting}
                                className="btn-tactical-primary"
                                style={{
                                    padding: "14px",
                                    fontSize: "0.90rem",
                                    fontWeight: 800,
                                    background: isCapAlert
                                        ? "linear-gradient(135deg, #FF1744 0%, #B71C1C 100%)"
                                        : "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                                    boxShadow: isCapAlert
                                        ? "0 4px 20px rgba(255,23,68,0.4)"
                                        : "0 4px 16px rgba(0,229,255,0.3)"
                                }}
                            >
                                {transmitting
                                    ? "Transmitiendo a la Malla..."
                                    : isCapAlert
                                        ? "🚨 TRANSMITIR ALERTA CAP EN TODA LA MALLA"
                                        : "⚡ DIFUNDIR BOLETÍN METEOROLÓGICO"}
                            </button>
                        </form>
                    )}

                    {/* VISTA 3: HISTORIAL Y FEED DE ALERTAS EN LA MALLA */}
                    {currentTab === "feed" && (
                        <div className="card-tactical animate-enter" style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            
                            {/* Header del Feed con Filtro CAP */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase" }}>
                                    Alertas y Boletines Recibidos ({visibleReports.length})
                                </div>

                                <button
                                    onClick={() => setFilterCapOnly(!filterCapOnly)}
                                    style={{
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        fontSize: "0.68rem",
                                        fontWeight: 800,
                                        border: `1px solid ${filterCapOnly ? "#FF1744" : "var(--glass-border)"}`,
                                        background: filterCapOnly ? "rgba(255,23,68,0.2)" : "rgba(255,255,255,0.05)",
                                        color: filterCapOnly ? "#FF1744" : "var(--text-muted)",
                                        cursor: "pointer"
                                    }}
                                >
                                    {filterCapOnly ? "🚨 Solo Emergencias CAP" : "Todos los Reportes"}
                                </button>
                            </div>

                            {isLoading ? (
                                <SkeletonCard count={3} />
                            ) : error ? (
                                <ErrorBanner message={error} onRetry={fetchReports} />
                            ) : visibleReports.length === 0 ? (
                                <EmptyState
                                    icon="📡"
                                    title="Sin Alertas en el Canal"
                                    description="No hay boletines meteorológicos ni alertas CAP registrados en la malla en este momento."
                                />
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {visibleReports.map((r) => {
                                        const isAlert = (r as any).is_disaster_alert || (r as any).is_alert;
                                        const sev = CAP_SEVERITIES.find((s) => s.key === (r as any).cap_severity) || CAP_SEVERITIES[1];
                                        const relTime = new Date(r.timestamp * (r.timestamp < 10000000000 ? 1000 : 1)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                        return (
                                            <div
                                                key={r.id}
                                                className="card-tactical"
                                                style={{
                                                    padding: "12px 14px",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "8px",
                                                    background: isAlert ? "rgba(255, 23, 68, 0.05)" : "rgba(15, 18, 28, 0.7)",
                                                    borderColor: isAlert ? sev.color : "var(--glass-border)",
                                                    borderLeft: isAlert ? `4px solid ${sev.color}` : "1px solid var(--glass-border)"
                                                }}
                                            >
                                                {/* Header de la tarjeta */}
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                        {isAlert && (
                                                            <span style={{
                                                                fontSize: "0.65rem",
                                                                fontWeight: 900,
                                                                padding: "2px 6px",
                                                                borderRadius: "4px",
                                                                background: sev.color,
                                                                color: "#000",
                                                                letterSpacing: "0.5px"
                                                            }}>
                                                                CAP {sev.label}
                                                            </span>
                                                        )}
                                                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: isAlert ? sev.color : "var(--text-primary)" }}>
                                                            {(r as any).cap_headline || r.condition_summary || (r as any).summary || "Boletín Meteorológico"}
                                                        </span>
                                                    </div>

                                                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                        {relTime}
                                                    </span>
                                                </div>

                                                {/* Instrucciones de Emergencia si existen */}
                                                {(r as any).cap_instruction && (
                                                    <div style={{
                                                        padding: "8px 10px",
                                                        borderRadius: "6px",
                                                        background: "rgba(0, 0, 0, 0.35)",
                                                        border: "1px dashed rgba(255,255,255,0.15)",
                                                        fontSize: "0.76rem",
                                                        color: "var(--text-secondary)"
                                                    }}>
                                                        <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>Instrucción: </span>
                                                        {(r as any).cap_instruction}
                                                    </div>
                                                )}

                                                {/* Pills de Telemetría */}
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace" }}>
                                                    <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(0, 229, 255, 0.1)", color: "var(--accent-cyan)" }}>
                                                        Presión: {r.pressure_hpa} hPa
                                                    </span>
                                                    {r.temperature_c !== undefined && (
                                                        <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(245, 158, 11, 0.1)", color: "var(--accent-amber)" }}>
                                                            Temp: {r.temperature_c}°C
                                                        </span>
                                                    )}
                                                    {r.humidity_percent !== undefined && (
                                                        <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.1)", color: "var(--accent-emerald)" }}>
                                                            Humedad: {r.humidity_percent}%
                                                        </span>
                                                    )}
                                                    {(r as any).wind_speed_kmh !== undefined && (
                                                        <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(96, 165, 250, 0.1)", color: "#60A5FA" }}>
                                                            Viento: {(r as any).wind_speed_kmh} km/h
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Footer con Remitente y Área */}
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                                    <span>Emisor: {r.sender_name} ({r.sender_did.slice(0, 16)}...)</span>
                                                    {r.cap_area_desc && <span>📍 {r.cap_area_desc}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
