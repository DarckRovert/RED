import React from "react";

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
}

export const CallStatsModal: React.FC<CallStatsModalProps> = ({
    statsData,
    isAudioOnly,
}) => {
    return (
                <div style={{
                    position: "absolute", top: "calc(70px + var(--safe-top, 0px))", left: "16px",
                    background: "rgba(10,14,28,0.95)", border: "1px solid var(--accent-cyan)",
                    borderRadius: "16px", padding: "14px 18px", zIndex: 25,
                    backdropFilter: "blur(24px)", boxShadow: "0 12px 48px rgba(0,0,0,0.8)",
                    fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", color: "white",
                    display: "flex", flexDirection: "column", gap: "6px", width: "240px"
                }}>
                    <div style={{ color: "var(--accent-cyan)", fontWeight: 900, borderBottom: "1px solid rgba(0,229,255,0.2)", paddingBottom: "4px" }}>
                        TELEMETRÍA WEBRTC
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>Latencia (RTT):</span>
                        <span style={{ color: "var(--accent-emerald)", fontWeight: 800 }}>{statsData.rttMs} ms</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>Pérdida Paquetes:</span>
                        <span style={{ color: statsData.packetLossPct > 2 ? "var(--accent-crimson)" : "var(--accent-emerald)", fontWeight: 800 }}>
                            {statsData.packetLossPct}%
                        </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>Bitrate Audio:</span>
                        <span>{statsData.audioBitrateKbps} kbps</span>
                    </div>
                    {!isAudioOnly && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "rgba(255,255,255,0.6)" }}>Bitrate Video:</span>
                            <span>{statsData.videoBitrateKbps} kbps</span>
                        </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "rgba(255,255,255,0.6)" }}>Códec Audio:</span>
                        <span style={{ color: "var(--accent-amber)" }}>{statsData.audioCodec}</span>
                    </div>
                    {!isAudioOnly && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ color: "rgba(255,255,255,0.6)" }}>Códec Video:</span>
                            <span style={{ color: "var(--accent-cyan)" }}>{statsData.videoCodec}</span>
                        </div>
                    )}
                </div>

    );
};
