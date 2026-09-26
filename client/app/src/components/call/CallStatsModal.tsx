import React, { useEffect } from "react";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";

interface CallStatsModalProps {
    statsData: {
        rttMs: number;
        packetLossPct: number;
        audioBitrateKbps: number;
        videoBitrateKbps: number;
        audioCodec: string;
        videoCodec: string;
    };
    isAudioOnly: boolean;
    onClose?: () => void;
}

export const CallStatsModal: React.FC<CallStatsModalProps> = ({
    statsData,
    isAudioOnly,
    onClose,
}) => {
    const { t } = useTranslation();

    useEffect(() => {
        if (!onClose) return;
        const unregister = BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            onClose();
            return true;
        });
        return unregister;
    }, [onClose]);

    const handleDismiss = () => {
        TacticalAudioEngine.playTap();
        onClose?.();
    };

    return (
        <>
            {/* Backdrop táctil para cerrar tocando fuera y evitar taps accidentales en video */}
            <div
                onClick={handleDismiss}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 24,
                    background: "transparent",
                }}
            />

            {/* Tarjeta de Telemetría WebRTC con scroll y botón de cierre táctico */}
            <div
                className="scroll-container"
                style={{
                    position: "absolute",
                    top: "calc(64px + var(--safe-top, 0px))",
                    left: "16px",
                    background: "rgba(10,14,28,0.96)",
                    border: "1px solid var(--accent-cyan)",
                    borderRadius: "16px",
                    padding: "12px 16px",
                    zIndex: 25,
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    boxShadow: "0 12px 48px rgba(0,0,0,0.85), 0 0 16px rgba(0,229,255,0.2)",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "0.72rem",
                    color: "white",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    width: "min(260px, calc(100vw - 32px))",
                    maxHeight: "calc(100vh - 160px)",
                    overflowY: "auto",
                }}
            >
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid rgba(0,229,255,0.25)",
                    paddingBottom: "6px",
                    marginBottom: "2px"
                }}>
                    <span style={{ color: "var(--accent-cyan)", fontWeight: 900, letterSpacing: "0.5px" }}>
                        📊 {t.calls_extended?.stats_title || "TELEMETRÍA WEBRTC"}
                    </span>
                    {onClose && (
                        <button
                            onClick={handleDismiss}
                            style={{
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.2)",
                                color: "#FFF",
                                width: 22,
                                height: 22,
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                fontSize: "0.68rem",
                                fontWeight: 800
                            }}
                            title="Cerrar telemetría"
                            aria-label="Cerrar telemetría"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>{t.calls_extended?.stats_rtt || "Latencia (RTT)"}:</span>
                    <span style={{ color: "var(--accent-emerald)", fontWeight: 800 }}>{statsData.rttMs} ms</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>{t.calls_extended?.stats_packets_lost || "Pérdida Paquetes"}:</span>
                    <span style={{ color: statsData.packetLossPct > 2 ? "var(--accent-crimson)" : "var(--accent-emerald)", fontWeight: 800 }}>
                        {statsData.packetLossPct}%
                    </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>{t.calls_extended?.stats_bitrate || "Bitrate"} Audio:</span>
                    <span>{statsData.audioBitrateKbps} kbps</span>
                </div>
                {!isAudioOnly && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>{t.calls_extended?.stats_bitrate || "Bitrate"} Video:</span>
                        <span>{statsData.videoBitrateKbps} kbps</span>
                    </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>{t.calls_extended?.stats_codec || "Códec"} Audio:</span>
                    <span style={{ color: "var(--accent-amber)" }}>{statsData.audioCodec}</span>
                </div>
                {!isAudioOnly && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>{t.calls_extended?.stats_codec || "Códec"} Video:</span>
                        <span style={{ color: "var(--accent-cyan)" }}>{statsData.videoCodec}</span>
                    </div>
                )}
            </div>
        </>
    );
};
