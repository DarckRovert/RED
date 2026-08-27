import React, { useState } from "react";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import type { VideoCallQuality } from "../../lib/settingsManager";

interface CallHeaderProps {
    isAudioOnly: boolean;
    callActive: boolean;
    callDuration: number;
    formatDuration: (sec: number) => string;
    setCallPipMinimized: (v: boolean) => void;
    goBack: () => void;
    showStats: boolean;
    setShowStats: React.Dispatch<React.SetStateAction<boolean>>;
    statsData: { rttMs: number };
    isSpeakerOn?: boolean;
    toggleSpeaker?: () => void;
    videoQuality?: VideoCallQuality;
    setVideoQuality?: (q: VideoCallQuality) => void;
    noiseSuppression?: boolean;
    toggleNoiseSuppression?: () => void;
    isMirror?: boolean;
    toggleMirror?: () => void;
    onOpenSafetyModal?: () => void;
}

export const CallHeader: React.FC<CallHeaderProps> = ({
    isAudioOnly,
    callActive,
    callDuration,
    formatDuration,
    setCallPipMinimized,
    goBack,
    showStats,
    setShowStats,
    statsData,
    isSpeakerOn = true,
    toggleSpeaker,
    videoQuality = "sd",
    setVideoQuality,
    noiseSuppression = true,
    toggleNoiseSuppression,
    isMirror = true,
    toggleMirror,
    onOpenSafetyModal,
}) => {
    const { t } = useTranslation();
    const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);

    return (
        <>
            <div style={{
                position: "absolute", top: "calc(16px + var(--safe-top, 0px))", left: "16px", right: "16px",
                zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
                <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    background: "linear-gradient(180deg, rgba(14, 18, 36, 0.96) 0%, rgba(6, 8, 16, 0.98) 100%)", 
                    padding: "8px 18px",
                    borderRadius: "var(--radius-full)", backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: "1.5px solid rgba(255,255,255,0.2)", boxShadow: "0 10px 30px rgba(0,0,0,0.8)"
                }}>
                    <span style={{ color: "var(--accent-emerald)", fontSize: "0.78rem", fontWeight: 900, letterSpacing: "0.5px", textShadow: "0 0 8px rgba(0,230,118,0.4)" }}>
                        🔒 {isAudioOnly ? (t.calls_extended?.audio_only || "VOZ E2E") : (t.calls_extended?.video_call || "HD VIDEO E2E")}
                    </span>
                    {callActive && (
                        <span style={{ color: "#FFFFFF", fontSize: "0.86rem", fontFamily: "JetBrains Mono, monospace", fontWeight: 900 }}>
                            · {formatDuration(callDuration)}
                        </span>
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* Tactical Options Menu Button */}
                    <button
                        onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
                        style={{
                            background: isOptionsMenuOpen ? "var(--accent-cyan)" : "linear-gradient(180deg, rgba(14, 18, 36, 0.96) 0%, rgba(6, 8, 16, 0.98) 100%)",
                            color: isOptionsMenuOpen ? "#000" : "#E0F7FA",
                            border: "1.5px solid rgba(0,229,255,0.5)",
                            borderRadius: "var(--radius-full)",
                            padding: "8px 14px",
                            fontSize: "0.76rem",
                            fontWeight: 900,
                            fontFamily: "JetBrains Mono, monospace",
                            cursor: "pointer",
                            backdropFilter: "blur(24px)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.7), 0 0 12px rgba(0,229,255,0.2)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                        }}
                        title="Opciones de Llamada"
                    >
                        ⚙️ Opciones
                    </button>

                    {/* PIP Floating Minimize Button */}
                    <button
                        onClick={() => {
                            setCallPipMinimized(true);
                            goBack();
                        }}
                        style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 36, 0.96) 0%, rgba(6, 8, 16, 0.98) 100%)",
                            color: "#E0F7FA",
                            border: "1.5px solid rgba(0,229,255,0.5)",
                            borderRadius: "var(--radius-full)",
                            padding: "8px 14px",
                            fontSize: "0.76rem",
                            fontWeight: 900,
                            fontFamily: "JetBrains Mono, monospace",
                            cursor: "pointer",
                            backdropFilter: "blur(20px)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                        }}
                        title={t.calls_extended?.pip_return || "PIP"}
                    >
                        🗗 PIP
                    </button>

                    {/* Telemetry HUD Toggle Button */}
                    <button
                        onClick={() => setShowStats(!showStats)}
                        style={{
                            background: showStats ? "var(--accent-cyan)" : "rgba(8,12,24,0.88)",
                            color: showStats ? "#000" : "white",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "var(--radius-full)",
                            padding: "8px 12px",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            fontFamily: "JetBrains Mono, monospace",
                            cursor: "pointer",
                            backdropFilter: "blur(20px)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                        }}
                        title={t.calls_extended?.stats_title || "Telemetría WebRTC"}
                    >
                        📊 {statsData.rttMs}ms
                    </button>
                </div>
            </div>

            {/* Tactical In-Call Options Dropdown Modal */}
            {isOptionsMenuOpen && (
                <div
                    style={{
                        position: "absolute",
                        top: "calc(68px + var(--safe-top, 0px))",
                        right: "16px",
                        width: "280px",
                        background: "rgba(10,14,28,0.96)",
                        border: "1px solid var(--accent-cyan)",
                        borderRadius: "16px",
                        padding: "16px",
                        zIndex: 35,
                        backdropFilter: "blur(24px)",
                        boxShadow: "0 16px 48px rgba(0,0,0,0.9)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        animation: "animate-enter 0.2s ease"
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 900, color: "var(--accent-cyan)", letterSpacing: "0.5px" }}>
                            ⚙️ AJUSTES EN LLAMADA
                        </span>
                        <button
                            onClick={() => setIsOptionsMenuOpen(false)}
                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.9rem" }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* 1. Salida de Audio */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)", fontWeight: 700 }}>
                            🔊 Salida de Audio:
                        </span>
                        <button
                            onClick={toggleSpeaker}
                            className="btn-tactical-secondary"
                            style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                        >
                            {isSpeakerOn ? "📢 Altavoz" : "🔈 Auricular"}
                        </button>
                    </div>

                    {/* 2. Calidad de Video */}
                    {!isAudioOnly && setVideoQuality && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)", fontWeight: 700 }}>
                                📹 Calidad de Video:
                            </span>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                                {(["eco360p", "sd480p", "hd720p"] as const).map(q => (
                                    <button
                                        key={q}
                                        onClick={() => setVideoQuality(q)}
                                        style={{
                                            padding: "6px 4px",
                                            fontSize: "0.70rem",
                                            fontWeight: 800,
                                            borderRadius: "6px",
                                            border: videoQuality === q ? "1px solid var(--accent-cyan)" : "1px solid rgba(255,255,255,0.1)",
                                            background: videoQuality === q ? "rgba(0,229,255,0.2)" : "rgba(255,255,255,0.04)",
                                            color: videoQuality === q ? "var(--accent-cyan)" : "var(--text-muted)",
                                            cursor: "pointer"
                                        }}
                                    >
                                        {q === "eco360p" ? "Eco 360p" : q === "sd480p" ? "SD 480p" : "HD 720p"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. Filtro Acústico / Reducción de Ruido */}
                    {toggleNoiseSuppression && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)", fontWeight: 700 }}>
                                🎙️ Filtro DSP Antirruido:
                            </span>
                            <button
                                onClick={toggleNoiseSuppression}
                                className="btn-tactical-secondary"
                                style={{
                                    padding: "4px 10px",
                                    fontSize: "0.72rem",
                                    color: noiseSuppression ? "var(--accent-emerald)" : "var(--text-muted)",
                                    borderColor: noiseSuppression ? "var(--accent-emerald)" : "rgba(255,255,255,0.15)"
                                }}
                            >
                                {noiseSuppression ? "Activo (ON)" : "Inactivo (OFF)"}
                            </button>
                        </div>
                    )}

                    {/* 4. Modo Espejo de Cámara */}
                    {!isAudioOnly && toggleMirror && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.76rem", color: "var(--text-secondary)", fontWeight: 700 }}>
                                🪞 Espejo Cámara Frontal:
                            </span>
                            <button
                                onClick={toggleMirror}
                                className="btn-tactical-secondary"
                                style={{
                                    padding: "4px 10px",
                                    fontSize: "0.72rem",
                                    color: isMirror ? "var(--accent-cyan)" : "var(--text-muted)"
                                }}
                            >
                                {isMirror ? "Espejo (ON)" : "Normal (OFF)"}
                            </button>
                        </div>
                    )}

                    {/* 5. Safety Number / Verificación Criptográfica */}
                    {onOpenSafetyModal && (
                        <button
                            onClick={() => {
                                setIsOptionsMenuOpen(false);
                                onOpenSafetyModal();
                            }}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "8px", fontSize: "0.75rem", marginTop: "4px" }}
                        >
                            🛡️ Validar Safety Number E2E
                        </button>
                    )}
                </div>
            )}
        </>
    );
};

