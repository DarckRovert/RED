import React from "react";

interface CallControlsProps {
    micMuted: boolean;
    toggleMic: () => void;
    camMuted: boolean;
    toggleCam: () => void;
    switchCamera: () => void;
    isAudioOnly: boolean;
    isSpeakerOn: boolean;
    toggleSpeaker: () => void;
    isScreenSharing: boolean;
    toggleScreenShare: () => void;
    handleUserEndCall: () => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
    micMuted,
    toggleMic,
    camMuted,
    toggleCam,
    switchCamera,
    isAudioOnly,
    isSpeakerOn,
    toggleSpeaker,
    isScreenSharing,
    toggleScreenShare,
    handleUserEndCall,
}) => {
    return (
            <div style={{
                position: "absolute", bottom: "calc(32px + var(--safe-bottom, 0px))", left: "50%",
                transform: "translateX(-50%)",
                display: "flex", gap: "14px", alignItems: "center",
                background: "rgba(8,12,24,0.94)",
                padding: "14px 24px", borderRadius: "var(--radius-full)",
                backdropFilter: "blur(28px)",
                boxShadow: "0 16px 56px rgba(0,0,0,0.9)",
                border: "1px solid rgba(255,255,255,0.15)", zIndex: 20
            }}>
                {/* 1. Mute Microphone */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                    <button
                        onClick={toggleMic}
                        style={{
                            width: "50px", height: "50px", borderRadius: "50%",
                            background: micMuted ? "rgba(255,51,85,0.85)" : "rgba(255,255,255,0.08)",
                            color: "white", fontSize: "1.3rem",
                            border: `2px solid ${micMuted ? "var(--accent-crimson)" : "rgba(255,255,255,0.18)"}`,
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: micMuted ? "0 4px 16px rgba(255,51,85,0.4)" : "none",
                            transition: "all 0.2s"
                        }}
                        title={micMuted ? "Activar Micrófono" : "Silenciar Micrófono"}
                    >
                        {micMuted ? "🔇" : "🎤"}
                    </button>
                    <span style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                        {micMuted ? "Mute" : "Mic"}
                    </span>
                </div>

                {/* 2. Toggle Camera (Video Mode Only) */}
                {!isAudioOnly && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                        <button
                            onClick={toggleCam}
                            style={{
                                width: "50px", height: "50px", borderRadius: "50%",
                                background: camMuted ? "rgba(255,51,85,0.85)" : "rgba(255,255,255,0.08)",
                                color: "white", fontSize: "1.3rem",
                                border: `2px solid ${camMuted ? "var(--accent-crimson)" : "rgba(255,255,255,0.18)"}`,
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: camMuted ? "0 4px 16px rgba(255,51,85,0.4)" : "none",
                                transition: "all 0.2s"
                            }}
                            title={camMuted ? "Activar Cámara" : "Apagar Cámara"}
                        >
                            {camMuted ? "🚫" : "📹"}
                        </button>
                        <span style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                            {camMuted ? "Off" : "Cam"}
                        </span>
                    </div>
                )}

                {/* 3. Switch Front / Rear Camera (Video Mode Only) */}
                {!isAudioOnly && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                        <button
                            onClick={switchCamera}
                            style={{
                                width: "50px", height: "50px", borderRadius: "50%",
                                background: "rgba(255,255,255,0.08)",
                                color: "var(--accent-cyan)", fontSize: "1.3rem",
                                border: "2px solid rgba(0,229,255,0.3)",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.2s"
                            }}
                            title="Cambiar Cámara Frontal / Trasera"
                        >
                            🔄
                        </button>
                        <span style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>Girar</span>
                    </div>
                )}

                {/* 4. Speakerphone Toggle */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                    <button
                        onClick={toggleSpeaker}
                        style={{
                            width: "50px", height: "50px", borderRadius: "50%",
                            background: isSpeakerOn ? "rgba(0,230,118,0.15)" : "rgba(255,255,255,0.08)",
                            color: isSpeakerOn ? "var(--accent-emerald)" : "white",
                            fontSize: "1.3rem",
                            border: `2px solid ${isSpeakerOn ? "var(--accent-emerald)" : "rgba(255,255,255,0.18)"}`,
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s"
                        }}
                        title={isSpeakerOn ? "Altavoz Activado" : "Auricular / Volumen Normal"}
                    >
                        {isSpeakerOn ? "🔊" : "🔈"}
                    </button>
                    <span style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                        {isSpeakerOn ? "Altavoz" : "Auricular"}
                    </span>
                </div>

                {/* 5. Screen Share (Video Mode Only) */}
                {!isAudioOnly && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                        <button
                            onClick={toggleScreenShare}
                            style={{
                                width: "50px", height: "50px", borderRadius: "50%",
                                background: isScreenSharing ? "rgba(0,229,255,0.25)" : "rgba(255,255,255,0.08)",
                                color: isScreenSharing ? "var(--accent-cyan)" : "white",
                                fontSize: "1.3rem",
                                border: `2px solid ${isScreenSharing ? "var(--accent-cyan)" : "rgba(255,255,255,0.18)"}`,
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.2s"
                            }}
                            title={isScreenSharing ? "Detener Pantalla" : "Compartir Pantalla"}
                        >
                            💻
                        </button>
                        <span style={{ fontSize: "0.60rem", color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                            {isScreenSharing ? "Compartiendo" : "Pantalla"}
                        </span>
                    </div>
                )}

                {/* 6. HANG UP CALL — Primary Action */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", marginLeft: "4px" }}>
                    <button
                        onClick={handleUserEndCall}
                        style={{
                            width: "66px", height: "66px", borderRadius: "50%",
                            background: "linear-gradient(135deg, #FF3355 0%, #C0152A 100%)",
                            color: "white", fontSize: "1.8rem",
                            border: "none",
                            boxShadow: "0 8px 32px rgba(232,33,58,0.7)",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            transform: "rotate(135deg)",
                            transition: "all 0.15s active"
                        }}
                        title="Finalizar Llamada"
                    >
                        📞
                    </button>
                    <span style={{ fontSize: "0.60rem", color: "var(--accent-crimson)", fontWeight: 800 }}>Colgar</span>
                </div>
            </div>

    );
};
