import React from "react";
import { useTranslation } from "../../lib/i18n/i18nEngine";

interface CallConnectingOverlayProps {
    isAudioOnly: boolean;
    callActive: boolean;
    hasRemoteVideo?: boolean;
    status: string;
    peerDisplayName: string;
    vadLevel: number;
    waveformCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
    <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(255, 60, 95, 0.15)", border: "1px solid #FF3C5F", color: "#FF3C5F", textAlign: "center" }}>
        {message}
    </div>
);

export const CallConnectingOverlay: React.FC<CallConnectingOverlayProps> = ({
    isAudioOnly,
    callActive,
    hasRemoteVideo,
    status,
    peerDisplayName,
    vadLevel,
    waveformCanvasRef,
}) => {
    const { t } = useTranslation();
    if (!isAudioOnly && (hasRemoteVideo || callActive)) return null;

    const displayStatus = callActive
        ? (t.calls?.connected || "LLAMADA CIFRADA E2E")
        : (status.includes("P2P WebRTC")
            ? (t.calls_extended?.connecting || "Iniciando capa P2P WebRTC...")
            : (status.includes("señalización") || status.includes("signaling")
                ? (t.calls_extended?.signaling || "Estableciendo enlace de señalización...")
                : status));

    return (
                <div style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    background: "radial-gradient(circle at center, #0f1426 0%, #05070e 100%)",
                    zIndex: 5, padding: "24px"
                }}>
                    {status.startsWith("Error") ? (
                        <div style={{ width: "100%", maxWidth: "420px" }}>
                            <ErrorBanner message={status} />
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "380px" }}>
                            {/* Animated Sonar Avatar */}
                            <div style={{ position: "relative", width: "130px", height: "130px", marginBottom: "28px" }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        position: "absolute", inset: 0, borderRadius: "50%",
                                        border: isAudioOnly ? "2px solid rgba(0,230,118,0.35)" : "2px solid rgba(0,229,255,0.35)",
                                        animation: `sonar-ring 2.4s ease-out ${i * 0.6}s infinite`
                                    }} />
                                ))}
                                <div style={{
                                    position: "absolute", inset: "8px", borderRadius: "50%",
                                    background: isAudioOnly
                                        ? "linear-gradient(135deg, rgba(0,230,118,0.25) 0%, rgba(0,180,90,0.4) 100%)"
                                        : "linear-gradient(135deg, rgba(0,229,255,0.25) 0%, rgba(0,150,200,0.4) 100%)",
                                    border: isAudioOnly ? "2px solid var(--accent-emerald)" : "2px solid var(--accent-cyan)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    boxShadow: isAudioOnly ? "0 0 32px rgba(0,230,118,0.4)" : "0 0 32px rgba(0,229,255,0.4)",
                                    transform: `scale(${1 + (vadLevel / 350)})`,
                                    transition: "transform 0.08s ease-out"
                                }}>
                                    <span style={{ fontSize: "2.6rem", fontWeight: 900, color: "white" }}>
                                        {peerDisplayName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <h2 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 900, marginBottom: "8px", textAlign: "center", letterSpacing: "0.5px" }}>
                                {peerDisplayName}
                            </h2>

                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 12px",
                                borderRadius: "var(--radius-full)",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                marginBottom: "20px"
                            }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: callActive ? "var(--accent-emerald)" : "var(--accent-amber)", boxShadow: callActive ? "0 0 8px #00E676" : "0 0 8px #FFA726" }} />
                                <span style={{
                                    color: callActive ? "var(--accent-emerald)" : "var(--accent-amber)",
                                    fontSize: "0.75rem",
                                    fontFamily: "JetBrains Mono, monospace",
                                    fontWeight: 700,
                                    letterSpacing: "1.5px"
                                }}>
                                    {displayStatus.toUpperCase()}
                                </span>
                            </div>

                            {/* Tactical Live Audio FFT Waveform */}
                            {isAudioOnly && callActive && (
                                <div style={{ width: "100%", marginTop: "10px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <canvas
                                        ref={waveformCanvasRef}
                                        width={280}
                                        height={55}
                                        style={{ width: "100%", height: "55px", borderRadius: "12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: "6px", fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", fontFamily: "JetBrains Mono, monospace" }}>
                                        <span>MODULACIÓN VOCAL: {vadLevel}%</span>
                                        <span>OPUS 48kHz STEREO</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

    );
};
