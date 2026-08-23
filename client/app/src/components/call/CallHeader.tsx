import React from "react";
import { useTranslation } from "../../lib/i18n/i18nEngine";

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
}) => {
    const { t } = useTranslation();

    return (
            <div style={{
                position: "absolute", top: "calc(16px + var(--safe-top, 0px))", left: "16px", right: "16px",
                zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
                <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    background: "rgba(8,12,24,0.88)", padding: "8px 16px",
                    borderRadius: "var(--radius-full)", backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 24px rgba(0,0,0,0.6)"
                }}>
                    <span style={{ color: "var(--accent-emerald)", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.5px" }}>
                        🔒 {isAudioOnly ? (t.calls_extended?.audio_only || "VOZ E2E") : (t.calls_extended?.video_call || "HD VIDEO E2E")}
                    </span>
                    {callActive && (
                        <span style={{ color: "white", fontSize: "0.82rem", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            · {formatDuration(callDuration)}
                        </span>
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* PIP Floating Minimize Button */}
                    <button
                        onClick={() => {
                            setCallPipMinimized(true);
                            goBack();
                        }}
                        style={{
                            background: "rgba(8,12,24,0.88)",
                            color: "var(--accent-cyan)",
                            border: "1px solid rgba(0,229,255,0.3)",
                            borderRadius: "var(--radius-full)",
                            padding: "8px 14px",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            fontFamily: "JetBrains Mono, monospace",
                            cursor: "pointer",
                            backdropFilter: "blur(20px)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
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
                            padding: "8px 14px",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            fontFamily: "JetBrains Mono, monospace",
                            cursor: "pointer",
                            backdropFilter: "blur(20px)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                        }}
                        title={t.calls_extended?.stats_title || "Telemetría WebRTC"}
                    >
                        📊 {statsData.rttMs}ms
                    </button>
                </div>
            </div>

    );
};
