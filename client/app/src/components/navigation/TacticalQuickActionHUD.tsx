"use client";

/**
 * TacticalQuickActionHUD.tsx — RED v104.0.0
 * 
 * HUD Flotante de Respuesta Táctica Inmediata (1-Tap Fast Access).
 * Erradica el cuello de botella de 4 interacciones (Drawer -> Scroll -> Hub -> Tool)
 * permitiendo acceso instantáneo en situaciones críticas (rescate, combate, sismo, noche).
 * 
 * Perfiles operacionales adaptativos:
 *   - Táctico/C4ISR: SOS, Brújula, Mapa, LoRa, Walkie-Talkie
 *   - Médico/USAR:   SOS, VitalScan, TCCC, Sónar Sísmico, Brújula
 *   - Recon/Stealth: Foxhunt, Radar, Visión Táctica, Escudo Mesh, Brújula
 */

import React, { useState, useEffect, useMemo } from "react";
import { useRedStore, ScreenView } from "../../store/useRedStore";
import { TacIcon, TacIconName } from "../ui/TacIcon";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";

interface QuickActionItem {
    id: string;
    screen: ScreenView;
    label: string;
    icon: TacIconName;
    accentColor: string;
    badge?: string;
}

interface TacticalQuickActionHUDProps {
    isTablet?: boolean;
}

export const TacticalQuickActionHUD: React.FC<TacticalQuickActionHUDProps> = ({ isTablet = false }) => {
    const { currentScreen, navigate, preferences, activeConversationId } = useRedStore();

    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [selectedProfile, setSelectedProfile] = useState<"tactical" | "medical" | "recon">(() => {
        if (preferences?.operationalMode === "stealth") return "recon";
        return "tactical";
    });

    // Detectar si el teclado o un input de texto está enfocado para no obstruir
    const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);

    useEffect(() => {
        const handleFocusIn = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
                setIsKeyboardOpen(true);
            }
        };
        const handleFocusOut = () => {
            setIsKeyboardOpen(false);
        };

        window.addEventListener("focusin", handleFocusIn);
        window.addEventListener("focusout", handleFocusOut);
        return () => {
            window.removeEventListener("focusin", handleFocusIn);
            window.removeEventListener("focusout", handleFocusOut);
        };
    }, []);

    // Definición de perfiles de acción rápida (declarada incondicionalmente al inicio)
    const actions: QuickActionItem[] = useMemo(() => {
        switch (selectedProfile) {
            case "medical":
                return [
                    { id: "sos", screen: "survivalBeacon", label: "SOS", icon: "beacon", accentColor: "var(--accent-crimson, #FF3355)" },
                    { id: "vitals", screen: "vitalScan", label: "VITAL", icon: "activity", accentColor: "var(--accent-cyan, #00E5FF)" },
                    { id: "tccc", screen: "tcccBallistics", label: "TCCC", icon: "crosshair", accentColor: "var(--accent-emerald, #00E676)" },
                    { id: "sonar", screen: "sonarSeismic", label: "SÓNAR", icon: "radio", accentColor: "var(--accent-amber, #FFB300)" },
                    { id: "compass", screen: "compass", label: "BRÚJULA", icon: "compass", accentColor: "var(--accent-purple, #B388FF)" },
                ];
            case "recon":
                return [
                    { id: "foxhunt", screen: "tacticalFoxhunt", label: "FOXHUNT", icon: "crosshair", accentColor: "var(--accent-amber, #FFB300)" },
                    { id: "radar", screen: "radar", label: "RADAR", icon: "radio", accentColor: "var(--accent-cyan, #00E5FF)" },
                    { id: "vision", screen: "tacticalVisionScan", label: "VISIÓN", icon: "eye", accentColor: "var(--accent-purple, #B388FF)" },
                    { id: "shield", screen: "globalShield", label: "ESCUDO", icon: "shield", accentColor: "var(--accent-emerald, #00E676)" },
                    { id: "compass", screen: "compass", label: "BRÚJULA", icon: "compass", accentColor: "#33EEFF" },
                ];
            case "tactical":
            default:
                return [
                    { id: "sos", screen: "survivalBeacon", label: "SOS", icon: "beacon", accentColor: "var(--accent-crimson, #FF3355)", badge: "DEFCON 1" },
                    { id: "compass", screen: "compass", label: "BRÚJULA", icon: "compass", accentColor: "var(--accent-emerald, #00E676)" },
                    { id: "map", screen: "nodemap", label: "MAPA", icon: "map", accentColor: "var(--accent-cyan, #00E5FF)" },
                    { id: "lora", screen: "loraTransceiver", label: "LORA", icon: "radio", accentColor: "var(--accent-purple, #B388FF)" },
                    { id: "walkie", screen: "walkie", label: "WALKIE", icon: "mic", accentColor: "var(--accent-amber, #FFB300)" },
                ];
        }
    }, [selectedProfile]);

    // Si el teclado está abierto en mobile, ocultamos temporalmente el HUD
    if (isKeyboardOpen && !isTablet) {
        return null;
    }

    // No mostrar HUD durante llamadas activas en pantalla completa
    if (currentScreen === "call") {
        return null;
    }

    const handleActionClick = (screen: ScreenView) => {
        TacticalAudioEngine.playRogerBeep();
        navigate(screen);
        setIsExpanded(false);
    };

    const handleToggleExpand = () => {
        TacticalAudioEngine.playTap();
        setIsExpanded(prev => !prev);
    };

    const cycleProfile = (e: React.MouseEvent) => {
        e.stopPropagation();
        TacticalAudioEngine.playTap();
        setSelectedProfile(prev => {
            if (prev === "tactical") return "medical";
            if (prev === "medical") return "recon";
            return "tactical";
        });
    };

    // Ajuste de posición vertical en mobile según si estamos en pantalla principal (con barra inferior) o interna
    const bottomPosition = isTablet 
        ? "24px" 
        : (currentScreen === "sidebar" && !activeConversationId
            ? "calc(74px + env(safe-area-inset-bottom, 0px))" 
            : "calc(16px + env(safe-area-inset-bottom, 0px))");

    return (
        <aside
            aria-label="Tactical Quick Action HUD"
            className="tactical-quick-hud"
            style={{
                position: "fixed",
                bottom: bottomPosition,
                right: "16px",
                zIndex: 85,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "8px",
                pointerEvents: "none", // Contenedor pasante, solo los elementos interactivos capturan clicks
                transition: "bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
        >
            {/* ── EXPANDED ACTION STRIP ─────────────────────────────────────────── */}
            {isExpanded && (
                <div
                    style={{
                        pointerEvents: "auto",
                        background: "rgba(4, 6, 14, 0.94)",
                        border: "1px solid rgba(0, 229, 255, 0.35)",
                        borderRadius: "16px",
                        padding: "10px 12px",
                        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 229, 255, 0.15)",
                        backdropFilter: "var(--glass-blur, blur(24px))",
                        WebkitBackdropFilter: "var(--glass-blur, blur(24px))",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        animation: "popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                        maxWidth: "calc(100vw - 32px)",
                    }}
                >
                    {/* Header del HUD con selector de perfil táctico */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                            paddingBottom: "6px",
                            gap: "12px",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span
                                style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    background: selectedProfile === "medical" 
                                        ? "var(--accent-cyan)" 
                                        : (selectedProfile === "recon" ? "var(--accent-amber)" : "var(--accent-crimson)"),
                                    boxShadow: "0 0 8px currentColor",
                                    animation: "pulse 1.5s infinite",
                                }}
                            />
                            <span
                                style={{
                                    fontSize: "0.65rem",
                                    fontWeight: 900,
                                    letterSpacing: "1px",
                                    fontFamily: "JetBrains Mono, monospace",
                                    color: "var(--text-secondary)",
                                }}
                            >
                                HUD TÁCTICO: {selectedProfile.toUpperCase()}
                            </span>
                        </div>

                        {/* Botón de ciclo de perfil */}
                        <button
                            type="button"
                            onClick={cycleProfile}
                            title="Cambiar perfil operacional del HUD"
                            style={{
                                background: "rgba(255, 255, 255, 0.06)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                borderRadius: "6px",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                fontSize: "0.60rem",
                                fontWeight: 800,
                                padding: "2px 6px",
                                fontFamily: "JetBrains Mono, monospace",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                            }}
                        >
                            <TacIcon name="refresh" size={10} color="currentColor" /> MODO
                        </button>
                    </div>

                    {/* Botones de acción 1-Tap */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(5, 1fr)",
                            gap: "8px",
                        }}
                    >
                        {actions.map((act) => {
                            const isCurrent = currentScreen === act.screen;
                            return (
                                <button
                                    key={act.id}
                                    type="button"
                                    onClick={() => handleActionClick(act.screen)}
                                    title={act.label}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "56px",
                                        height: "56px",
                                        borderRadius: "12px",
                                        background: isCurrent 
                                            ? `rgba(${act.id === 'sos' ? '255,51,85,0.25' : '0,229,255,0.22'})`
                                            : "rgba(255, 255, 255, 0.04)",
                                        border: isCurrent 
                                            ? `1px solid ${act.accentColor}`
                                            : "1px solid rgba(255, 255, 255, 0.08)",
                                        color: act.accentColor,
                                        cursor: "pointer",
                                        gap: "4px",
                                        transition: "all 0.15s ease",
                                        position: "relative",
                                    }}
                                >
                                    <TacIcon name={act.icon} size={20} color={act.accentColor} />
                                    <span
                                        style={{
                                            fontSize: "0.58rem",
                                            fontWeight: 800,
                                            letterSpacing: "0.5px",
                                            fontFamily: "JetBrains Mono, monospace",
                                            color: "var(--text-primary)",
                                        }}
                                    >
                                        {act.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── COLLAPSED / TRIGGER FAB ───────────────────────────────────────── */}
            <button
                type="button"
                onClick={handleToggleExpand}
                aria-expanded={isExpanded}
                title={isExpanded ? "Ocultar acceso táctico" : "Acceso Táctico Rápido 1-Tap"}
                style={{
                    pointerEvents: "auto",
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    background: isExpanded 
                        ? "var(--accent-crimson, #FF3355)" 
                        : "linear-gradient(135deg, rgba(14, 18, 36, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                    border: isExpanded 
                        ? "1px solid #FF3355" 
                        : "1px solid rgba(0, 229, 255, 0.4)",
                    color: isExpanded ? "#FFF" : "var(--accent-cyan, #00E5FF)",
                    boxShadow: isExpanded 
                        ? "0 0 24px rgba(255, 51, 85, 0.55)" 
                        : "0 6px 20px rgba(0, 0, 0, 0.7), 0 0 14px rgba(0, 229, 255, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    position: "relative",
                }}
            >
                {/* Micro indicador de radar activo si está colapsado */}
                {!isExpanded && (
                    <span
                        style={{
                            position: "absolute",
                            top: "-2px",
                            right: "-2px",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: "var(--accent-crimson, #FF3355)",
                            boxShadow: "0 0 8px #FF3355",
                            animation: "pulse 2s infinite",
                        }}
                    />
                )}

                {isExpanded ? (
                    <TacIcon name="x" size={20} color="#FFF" />
                ) : (
                    <TacIcon name="crosshair" size={22} color="currentColor" />
                )}
            </button>
        </aside>
    );
};
