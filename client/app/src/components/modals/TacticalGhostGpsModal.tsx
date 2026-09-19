"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../../store/useRedStore";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import {
    tacticalGhostGps,
    GhostMode,
    GHOST_PRESET_LOCATIONS,
    GhostPresetLocation
} from "../../lib/sensors/TacticalGhostGpsEngine";
import { TacticalLocationEngine, TacticalLocation } from "../../lib/sensors/TacticalLocationEngine";
import { TacIcon } from "../ui/TacIcon";

export function TacticalGhostGpsModal() {
    const { navigate, goBack } = useRedStore();
    const { t } = useTranslation();

    // Estado del motor señuelo
    const [config, setConfig] = useState(() => tacticalGhostGps.getConfig());
    const [currentGhostLoc, setCurrentGhostLoc] = useState<TacticalLocation | null>(() => tacticalGhostGps.getCurrentGhostLocation());
    const [realHardwareLoc, setRealHardwareLoc] = useState<TacticalLocation | null>(() => TacticalLocationEngine.getTrueHardwareLocation());
    const [customLat, setCustomLat] = useState<string>(() => String(config.staticCoords.lat));
    const [customLon, setCustomLon] = useState<string>(() => String(config.staticCoords.lon));
    const [customAlt, setCustomAlt] = useState<string>(() => String(config.staticCoords.alt));
    const [showAndroidMockGuide, setShowAndroidMockGuide] = useState<boolean>(false);

    // Salida con tecla ESC o botón atrás de Android
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            goBack();
            return true;
        });
        return () => unregister();
    }, [goBack]);

    // Suscripción a cambios de ubicación en tiempo real
    useEffect(() => {
        const unsubGhost = tacticalGhostGps.addListener((loc) => {
            setCurrentGhostLoc(loc);
        });
        const unsubWatch = TacticalLocationEngine.watchLocation(() => {
            setRealHardwareLoc(TacticalLocationEngine.getTrueHardwareLocation());
        });
        return () => {
            unsubGhost();
            unsubWatch();
        };
    }, []);

    // Actualizar configuración local cuando cambia el motor
    const refreshConfig = useCallback(() => {
        const cfg = tacticalGhostGps.getConfig();
        setConfig(cfg);
        setCustomLat(String(cfg.staticCoords.lat));
        setCustomLon(String(cfg.staticCoords.lon));
        setCustomAlt(String(cfg.staticCoords.alt));
    }, []);

    // Cambiar modo de operación
    const handleSetMode = (mode: GhostMode) => {
        tacticalGhostGps.activateMode(mode);
        refreshConfig();
        if (mode === "OFF") {
            toast.info("🟢 GPS Real de Hardware restaurado. Señuelo desactivado.");
        } else {
            toast.success(`👻 Modo Señuelo activado: [${mode}]`);
        }
    };

    // Aplicar preset predefinido
    const handleApplyPreset = (preset: GhostPresetLocation) => {
        tacticalGhostGps.loadPreset(preset.id);
        if (config.mode === "OFF") {
            tacticalGhostGps.activateMode("STATIC_DECOY");
        }
        refreshConfig();
        toast.success(`📍 Ubicación Señuelo fijada en: ${preset.name}`);
    };

    // Aplicar coordenadas manuales
    const handleApplyCustomCoords = () => {
        const lat = parseFloat(customLat);
        const lon = parseFloat(customLon);
        const alt = parseFloat(customAlt) || 30;

        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            toast.error("⚠️ Coordenadas geográficas inválidas. Latitud [-90..90], Longitud [-180..180]");
            return;
        }

        tacticalGhostGps.setStaticLocation(lat, lon, alt);
        if (config.mode === "OFF") {
            tacticalGhostGps.activateMode("STATIC_DECOY");
        }
        refreshConfig();
        toast.success(`🎯 Coordenadas señuelo actualizadas: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    };

    // Cambiar radio de jitter
    const handleJitterChange = (radiusMeters: number) => {
        tacticalGhostGps.activateMode(config.mode, { jitterRadiusMeters: radiusMeters });
        refreshConfig();
    };

    // Cambiar velocidad de patrulla cinemática
    const handleSpeedChange = (speedKmh: number) => {
        tacticalGhostGps.activateMode(config.mode, { kinematicSpeedKmh: speedKmh });
        refreshConfig();
    };

    const isGhostActive = config.mode !== "OFF";

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(7, 12, 16, 0.95)",
            backdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
            color: "#e2e8f0",
            fontFamily: "monospace",
            overflowY: "auto",
        }}>
            {/* Header Táctico */}
            <div style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
                backgroundColor: "rgba(15, 23, 42, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: isGhostActive ? "0 0 20px rgba(239, 68, 68, 0.2)" : "none",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        backgroundColor: isGhostActive ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)",
                        border: `1px solid ${isGhostActive ? "#ef4444" : "#22c55e"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                    }}>
                        {isGhostActive ? "👻" : "📡"}
                    </div>
                    <div>
                        <div style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "1px", color: isGhostActive ? "#f87171" : "#4ade80" }}>
                            GHOST GPS // SEÑUELO ANTI-RASTREO
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            {isGhostActive
                                ? `ESTADO: SEÑUELO ACTIVO EN MALLA [${config.mode}]`
                                : "ESTADO: POSICIONAMIENTO REAL GNSS (SIN ALTERACIONES)"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => goBack()}
                    style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        color: "#94a3b8",
                        borderRadius: "8px",
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontWeight: "bold",
                    }}
                >
                    ✕ CERRAR
                </button>
            </div>

            {/* Banner de Advertencia de Estado Táctico */}
            {isGhostActive && (
                <div style={{
                    padding: "12px 20px",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    borderBottom: "1px solid rgba(239, 68, 68, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "18px", animation: "pulse 1.5s infinite" }}>⚠️</span>
                        <span style={{ fontSize: "13px", color: "#fca5a5" }}>
                            Toda la malla RED (Chat, Radar, Balizas SOS y Telemetría) está transmitiendo coordenadas señuelo.
                        </span>
                    </div>
                    <button
                        onClick={() => handleSetMode("OFF")}
                        style={{
                            backgroundColor: "#ef4444",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 14px",
                            fontWeight: "bold",
                            fontSize: "12px",
                            cursor: "pointer",
                            boxShadow: "0 0 12px rgba(239, 68, 68, 0.4)",
                        }}
                    >
                        RESTAURAR GPS REAL (DESACTIVAR)
                    </button>
                </div>
            )}

            {/* Contenido Principal */}
            <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>

                {/* Dashboard de Telemetría Comparativa */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "16px",
                }}>
                    {/* Tarjeta Coordenadas Transmitidas (Señuelo / Activa) */}
                    <div style={{
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        border: `1px solid ${isGhostActive ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)"}`,
                        borderRadius: "12px",
                        padding: "16px",
                    }}>
                        <div style={{ fontSize: "12px", color: isGhostActive ? "#f87171" : "#4ade80", fontWeight: "bold", marginBottom: "8px" }}>
                            📡 POSICIÓN TRANSMITIDA A LA MALLA:
                        </div>
                        <div style={{ fontSize: "20px", fontWeight: "bold", color: "#f8fafc", fontFamily: "monospace" }}>
                            {currentGhostLoc?.lat?.toFixed(5) ?? "---"}, {currentGhostLoc?.lon?.toFixed(5) ?? "---"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                            <div>Altitud: <span style={{ color: "#e2e8f0" }}>{currentGhostLoc?.alt ?? 0} m</span></div>
                            <div>Rumbo (COG): <span style={{ color: "#e2e8f0" }}>{currentGhostLoc?.heading ?? 0}°</span></div>
                            <div>Velocidad: <span style={{ color: "#e2e8f0" }}>{currentGhostLoc?.speed ?? 0} m/s</span></div>
                            <div>Precisión: <span style={{ color: "#e2e8f0" }}>±{currentGhostLoc?.accuracy ?? 5} m</span></div>
                        </div>
                    </div>

                    {/* Tarjeta Hardware Real GNSS */}
                    <div style={{
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(148, 163, 184, 0.2)",
                        borderRadius: "12px",
                        padding: "16px",
                    }}>
                        <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "bold", marginBottom: "8px" }}>
                            🔒 HARDWARE GNSS REAL (SATÉLITE FÍSICO):
                        </div>
                        <div style={{ fontSize: "18px", fontWeight: "bold", color: "#cbd5e1", fontFamily: "monospace" }}>
                            {realHardwareLoc?.lat?.toFixed(5) ?? "Esperando fix..."}, {realHardwareLoc?.lon?.toFixed(5) ?? "---"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                            {isGhostActive
                                ? "Estado: Aislado localmente por la pantalla de camuflaje."
                                : "Estado: Activo como fuente primaria de navegación."}
                        </div>
                    </div>
                </div>

                {/* Selector de Modo */}
                <div style={{
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "20px",
                }}>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: "#38bdf8", marginBottom: "14px" }}>
                        MODO DE CAMUFLAJE GEOESPACIAL:
                    </div>
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "10px",
                    }}>
                        <button
                            onClick={() => handleSetMode("OFF")}
                            style={{
                                padding: "12px",
                                borderRadius: "8px",
                                border: config.mode === "OFF" ? "2px solid #22c55e" : "1px solid rgba(255, 255, 255, 0.1)",
                                backgroundColor: config.mode === "OFF" ? "rgba(34, 197, 94, 0.15)" : "rgba(0, 0, 0, 0.3)",
                                color: config.mode === "OFF" ? "#4ade80" : "#94a3b8",
                                cursor: "pointer",
                                textAlign: "left",
                            }}
                        >
                            <div style={{ fontWeight: "bold", fontSize: "13px" }}>🟢 DESACTIVADO</div>
                            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "4px" }}>Satélites GNSS reales</div>
                        </button>

                        <button
                            onClick={() => handleSetMode("STATIC_DECOY")}
                            style={{
                                padding: "12px",
                                borderRadius: "8px",
                                border: config.mode === "STATIC_DECOY" ? "2px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                                backgroundColor: config.mode === "STATIC_DECOY" ? "rgba(56, 189, 248, 0.15)" : "rgba(0, 0, 0, 0.3)",
                                color: config.mode === "STATIC_DECOY" ? "#38bdf8" : "#94a3b8",
                                cursor: "pointer",
                                textAlign: "left",
                            }}
                        >
                            <div style={{ fontWeight: "bold", fontSize: "13px" }}>📍 SEÑUELO FIJO</div>
                            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "4px" }}>Punto geográfico falso</div>
                        </button>

                        <button
                            onClick={() => handleSetMode("JITTER_DISPERSION")}
                            style={{
                                padding: "12px",
                                borderRadius: "8px",
                                border: config.mode === "JITTER_DISPERSION" ? "2px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.1)",
                                backgroundColor: config.mode === "JITTER_DISPERSION" ? "rgba(245, 158, 11, 0.15)" : "rgba(0, 0, 0, 0.3)",
                                color: config.mode === "JITTER_DISPERSION" ? "#fbbf24" : "#94a3b8",
                                cursor: "pointer",
                                textAlign: "left",
                            }}
                        >
                            <div style={{ fontWeight: "bold", fontSize: "13px" }}>🎲 DISPERSIÓN JITTER</div>
                            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "4px" }}>Ruido anti-triangulación</div>
                        </button>

                        <button
                            onClick={() => handleSetMode("KINEMATIC_ROUTE")}
                            style={{
                                padding: "12px",
                                borderRadius: "8px",
                                border: config.mode === "KINEMATIC_ROUTE" ? "2px solid #a855f7" : "1px solid rgba(255, 255, 255, 0.1)",
                                backgroundColor: config.mode === "KINEMATIC_ROUTE" ? "rgba(168, 85, 247, 0.15)" : "rgba(0, 0, 0, 0.3)",
                                color: config.mode === "KINEMATIC_ROUTE" ? "#c084fc" : "#94a3b8",
                                cursor: "pointer",
                                textAlign: "left",
                            }}
                        >
                            <div style={{ fontWeight: "bold", fontSize: "13px" }}>🏃 PATRULLA RUTA</div>
                            <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "4px" }}>Movimiento cinemático</div>
                        </button>
                    </div>
                </div>

                {/* Controles de Configuración según Modo */}
                {config.mode === "STATIC_DECOY" && (
                    <div style={{
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(56, 189, 248, 0.2)",
                        borderRadius: "12px",
                        padding: "20px",
                    }}>
                        <div style={{ fontSize: "14px", fontWeight: "bold", color: "#38bdf8", marginBottom: "12px" }}>
                            PRESETS TÁCTICOS INTERNACIONALES:
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "16px" }}>
                            {GHOST_PRESET_LOCATIONS.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => handleApplyPreset(preset)}
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: "8px",
                                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                                        border: "1px solid rgba(255, 255, 255, 0.1)",
                                        color: "#e2e8f0",
                                        textAlign: "left",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{ fontWeight: "bold", fontSize: "12px", color: "#38bdf8" }}>{preset.name}</div>
                                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>{preset.description}</div>
                                </button>
                            ))}
                        </div>

                        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#94a3b8", marginBottom: "8px" }}>
                            O INGRESA COORDENADAS PERSONALIZADAS:
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "10px", alignItems: "center" }}>
                            <input
                                type="text"
                                placeholder="Latitud (-90..90)"
                                value={customLat}
                                onChange={e => setCustomLat(e.target.value)}
                                style={{
                                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                    color: "#f8fafc",
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Longitud (-180..180)"
                                value={customLon}
                                onChange={e => setCustomLon(e.target.value)}
                                style={{
                                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                    color: "#f8fafc",
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Altitud (m)"
                                value={customAlt}
                                onChange={e => setCustomAlt(e.target.value)}
                                style={{
                                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                    color: "#f8fafc",
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                }}
                            />
                            <button
                                onClick={handleApplyCustomCoords}
                                style={{
                                    backgroundColor: "#0284c7",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "6px",
                                    padding: "8px 16px",
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                }}
                            >
                                FIJAR
                            </button>
                        </div>
                    </div>
                )}

                {config.mode === "JITTER_DISPERSION" && (
                    <div style={{
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: "12px",
                        padding: "20px",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#fbbf24" }}>
                                RADIO DE DISPERSIÓN ALEATORIA (ANTI-TRIANGULACIÓN):
                            </span>
                            <span style={{ fontSize: "16px", fontWeight: "bold", color: "#fef08a" }}>
                                {config.jitterRadiusMeters} metros
                            </span>
                        </div>
                        <input
                            type="range"
                            min="100"
                            max="5000"
                            step="100"
                            value={config.jitterRadiusMeters}
                            onChange={e => handleJitterChange(parseInt(e.target.value))}
                            style={{ width: "100%", accentColor: "#f59e0b" }}
                        />
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "8px" }}>
                            Añade una perturbación pseudoaleatoria radial en cada ciclo de telemetría. Esto neutraliza la radiogonometría hostil y algoritmos de rastreo de señal sin alejarte completamente de la zona regional.
                        </div>
                    </div>
                )}

                {config.mode === "KINEMATIC_ROUTE" && (
                    <div style={{
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(168, 85, 247, 0.3)",
                        borderRadius: "12px",
                        padding: "20px",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#c084fc" }}>
                                VELOCIDAD DE PATRULLA SIMULADA:
                            </span>
                            <span style={{ fontSize: "16px", fontWeight: "bold", color: "#f3e8ff" }}>
                                {config.kinematicSpeedKmh} km/h
                            </span>
                        </div>
                        <input
                            type="range"
                            min="3"
                            max="120"
                            step="1"
                            value={config.kinematicSpeedKmh}
                            onChange={e => handleSpeedChange(parseInt(e.target.value))}
                            style={{ width: "100%", accentColor: "#a855f7" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                            <span>Caminata (4 km/h)</span>
                            <span>Trote táctico (12 km/h)</span>
                            <span>Vehículo urbano (40 km/h)</span>
                            <span>Autopista (90 km/h)</span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "12px" }}>
                            El motor calcula en tiempo real el rumbo magnético (COG) y la interpolación cinética entre puntos de ruta, haciendo que el vector de avance parezca indistinguible del movimiento humano real.
                        </div>
                    </div>
                )}

                {/* Sección Android Mock Location Guide */}
                <div style={{
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "16px 20px",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#f1f5f9" }}>
                                🛡️ ENGAÑAR A APPS EXTERNAS (TIKTOK, GOOGLE MAPS, SPYWARE):
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                Configuración de "Ubicaciones Simuladas" en Android para alterar el GPS a nivel de todo el teléfono.
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAndroidMockGuide(!showAndroidMockGuide)}
                            style={{
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                color: "#38bdf8",
                                borderRadius: "6px",
                                padding: "6px 12px",
                                fontSize: "12px",
                                cursor: "pointer",
                            }}
                        >
                            {showAndroidMockGuide ? "OCULTAR GUÍA" : "VER GUÍA PASO A PASO"}
                        </button>
                    </div>

                    {showAndroidMockGuide && (
                        <div style={{
                            marginTop: "14px",
                            paddingTop: "14px",
                            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                            fontSize: "12px",
                            lineHeight: "1.6",
                            color: "#cbd5e1",
                        }}>
                            <ol style={{ paddingLeft: "20px", margin: 0 }}>
                                <li>Abre los <strong>Ajustes del Teléfono</strong> y ve a <em>Acerca del teléfono</em>.</li>
                                <li>Toca <strong>7 veces consecutivas</strong> sobre <em>Número de compilación</em> para activar las Opciones de Desarrollador.</li>
                                <li>Regresa a Ajustes ➔ <strong>Sistema</strong> (u Opciones Adicionales) ➔ <strong>Opciones para desarrolladores</strong>.</li>
                                <li>Busca la opción <strong>"Elegir aplicación para simular ubicación"</strong> (Mock location app).</li>
                                <li>Selecciona <strong>RED</strong> en la lista.</li>
                            </ol>
                            <div style={{ marginTop: "10px", color: "#4ade80", fontWeight: "bold" }}>
                                ✅ ¡Listo! Una vez seleccionada RED, cualquier coordenada generada aquí se inyectará al GPS del sistema, engañando a TikTok, WhatsApp, navegadores y herramientas de geolocalización.
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
