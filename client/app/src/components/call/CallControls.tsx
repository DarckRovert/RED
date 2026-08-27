import React from "react";
import { useTranslation } from "../../lib/i18n/i18nEngine";

import { VideoTacticalFilter } from "./CallVideoGrid";

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
    tacticalFilter?: VideoTacticalFilter;
    onCycleFilter?: () => void;
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
    tacticalFilter = "normal",
    onCycleFilter,
}) => {
    const { t } = useTranslation();

    return (
            <div style={{
                position: "absolute", bottom: "calc(32px + var(--safe-bottom, 0px))", left: "50%",
                transform: "translateX(-50%)",
                display: "flex", gap: "14px", alignItems: "center",
                background: "linear-gradient(180deg, rgba(14, 18, 36, 0.98) 0%, rgba(6, 8, 16, 0.98) 100%)",
                padding: "16px 28px", borderRadius: "var(--radius-full)",
                backdropFilter: "blur(32px)",
                WebkitBackdropFilter: "blur(32px)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.95), 0 0 24px rgba(0, 229, 255, 0.15)",
                border: "1.5px solid rgba(255,255,255,0.22)", zIndex: 20
            }}>
                {/* 1. Mute Microphone */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <button
                        onClick={toggleMic}
                        style={{
                            width: "52px", height: "52px", borderRadius: "50%",
                            background: micMuted ? "linear-gradient(135deg, #FF1744 0%, #D50000 100%)" : "rgba(255,255,255,0.12)",
                            color: "white", fontSize: "1.35rem",
                            border: `2px solid ${micMuted ? "#FF5252" : "rgba(255,255,255,0.3)"}`,
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: micMuted ? "0 4px 20px rgba(255,23,68,0.6)" : "0 2px 8px rgba(0,0,0,0.4)",
                            transition: "all 0.2s ease"
                        }}
                        title={micMuted ? (t.calls_extended?.mic_on || "Activar Micrófono") : (t.calls_extended?.mic_off || "Silenciar Micrófono")}
                    >
                        {micMuted ? "🔇" : "🎤"}
                    </button>
                    <span style={{ fontSize: "0.64rem", color: micMuted ? "#FF5252" : "#FFFFFF", fontWeight: 800, letterSpacing: "0.3px" }}>
                        {micMuted ? (t.calls?.mute || "MUTE") : "MIC"}
                    </span>
                </div>

                {/* 2. Toggle Camera (Available in both Voice & Video calls to upgrade/turn ON/OFF) */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <button
                        onClick={toggleCam}
                        style={{
                            width: "52px", height: "52px", borderRadius: "50%",
                            background: (camMuted || isAudioOnly) ? "rgba(255,255,255,0.12)" : "linear-gradient(135deg, rgba(0,229,255,0.35) 0%, rgba(2,132,199,0.4) 100%)",
                            color: (camMuted || isAudioOnly) ? "rgba(255,255,255,0.8)" : "var(--accent-cyan)",
                            fontSize: "1.35rem",
                            border: `2px solid ${(camMuted || isAudioOnly) ? "rgba(255,255,255,0.3)" : "var(--accent-cyan)"}`,
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: (!camMuted && !isAudioOnly) ? "0 0 20px rgba(0,229,255,0.5)" : "0 2px 8px rgba(0,0,0,0.4)",
                            transition: "all 0.2s ease"
                        }}
                        title={(camMuted || isAudioOnly) ? (t.calls_extended?.cam_on || "Encender Cámara") : (t.calls_extended?.cam_off || "Apagar Cámara")}
                    >
                        {(camMuted || isAudioOnly) ? "🚫" : "📹"}
                    </button>
                    <span style={{ fontSize: "0.64rem", color: (camMuted || isAudioOnly) ? "#CBD5E1" : "var(--accent-cyan)", fontWeight: 800, letterSpacing: "0.3px" }}>
                        {(camMuted || isAudioOnly) ? "CAM OFF" : "CAM ON"}
                    </span>
                </div>

                {/* 3. Switch Front / Rear Camera (Active when camera is ON) */}
                {(!isAudioOnly && !camMuted) && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        <button
                            onClick={switchCamera}
                            style={{
                                width: "52px", height: "52px", borderRadius: "50%",
                                background: "rgba(255,255,255,0.12)",
                                color: "var(--accent-cyan)", fontSize: "1.35rem",
                                border: "2px solid rgba(0,229,255,0.5)",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: "0 0 14px rgba(0,229,255,0.3)",
                                transition: "all 0.2s ease"
                            }}
                            title={t.calls_extended?.switch_cam || "Cambiar Cámara Frontal / Trasera"}
                        >
                            🔄
                        </button>
                        <span style={{ fontSize: "0.64rem", color: "#E0F7FA", fontWeight: 800, letterSpacing: "0.3px" }}>
                            {t.calls?.camera_switch || "GIRAR"}
                        </span>
                    </div>
                )}

                {/* 4. Speakerphone Toggle */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <button
                        onClick={toggleSpeaker}
                        style={{
                            width: "52px", height: "52px", borderRadius: "50%",
                            background: isSpeakerOn ? "linear-gradient(135deg, rgba(0,230,118,0.35) 0%, rgba(0,180,90,0.4) 100%)" : "rgba(255,255,255,0.12)",
                            color: isSpeakerOn ? "var(--accent-emerald)" : "white",
                            fontSize: "1.35rem",
                            border: `2px solid ${isSpeakerOn ? "var(--accent-emerald)" : "rgba(255,255,255,0.3)"}`,
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: isSpeakerOn ? "0 0 20px rgba(0,230,118,0.5)" : "0 2px 8px rgba(0,0,0,0.4)",
                            transition: "all 0.2s ease"
                        }}
                        title={isSpeakerOn ? (t.calls_extended?.speaker_on || "Altavoz Activado") : (t.calls_extended?.speaker_off || "Auricular")}
                    >
                        {isSpeakerOn ? "🔊" : "🔈"}
                    </button>
                    <span style={{ fontSize: "0.64rem", color: isSpeakerOn ? "var(--accent-emerald)" : "#CBD5E1", fontWeight: 800, letterSpacing: "0.3px" }}>
                        {isSpeakerOn ? "ALTAVOZ" : "AURICULAR"}
                    </span>
                </div>

                {/* 5. Screen Share (Video Mode Only) */}
                {!isAudioOnly && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        <button
                            onClick={toggleScreenShare}
                            style={{
                                width: "52px", height: "52px", borderRadius: "50%",
                                background: isScreenSharing ? "rgba(0,229,255,0.35)" : "rgba(255,255,255,0.12)",
                                color: isScreenSharing ? "var(--accent-cyan)" : "white",
                                fontSize: "1.35rem",
                                border: `2px solid ${isScreenSharing ? "var(--accent-cyan)" : "rgba(255,255,255,0.3)"}`,
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: isScreenSharing ? "0 0 18px rgba(0,229,255,0.5)" : "none",
                                transition: "all 0.2s ease"
                            }}
                            title={isScreenSharing ? (t.calls_extended?.stop_share_screen || "Detener Pantalla") : (t.calls_extended?.share_screen || "Compartir Pantalla")}
                        >
                            💻
                        </button>
                        <span style={{ fontSize: "0.64rem", color: isScreenSharing ? "var(--accent-cyan)" : "#CBD5E1", fontWeight: 800, letterSpacing: "0.3px" }}>
                            {isScreenSharing ? "CAST ON" : "PANTALLA"}
                        </span>
                    </div>
                )}

                {/* 6. Tactical Camera Filter Toggle (NVG, FLIR, CRT) */}
                {!isAudioOnly && !camMuted && onCycleFilter && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        <button
                            onClick={onCycleFilter}
                            style={{
                                width: "52px", height: "52px", borderRadius: "50%",
                                background: tacticalFilter !== "normal" ? "linear-gradient(135deg, rgba(0,230,118,0.35) 0%, rgba(0,180,90,0.4) 100%)" : "rgba(255,255,255,0.12)",
                                color: tacticalFilter !== "normal" ? "var(--accent-emerald)" : "white",
                                fontSize: "1.35rem",
                                border: `2px solid ${tacticalFilter !== "normal" ? "var(--accent-emerald)" : "rgba(255,255,255,0.3)"}`,
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.2s ease",
                                boxShadow: tacticalFilter !== "normal" ? "0 0 20px rgba(0,230,118,0.5)" : "none"
                            }}
                            title={`Filtro Táctico: ${tacticalFilter.toUpperCase()}`}
                        >
                            {tacticalFilter === "night_vision" ? "🥽" : (tacticalFilter === "flir_thermal" ? "🌡️" : (tacticalFilter === "surveillance_crt" ? "📼" : "👁️"))}
                        </button>
                        <span style={{ fontSize: "0.64rem", color: tacticalFilter !== "normal" ? "var(--accent-emerald)" : "#CBD5E1", fontWeight: 800, letterSpacing: "0.3px" }}>
                            {tacticalFilter === "night_vision" ? "NVG" : (tacticalFilter === "flir_thermal" ? "FLIR" : (tacticalFilter === "surveillance_crt" ? "CRT" : "FILTRO"))}
                        </span>
                    </div>
                )}

                {/* 7. HANG UP CALL — Primary Emergency Action */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", marginLeft: "6px" }}>
                    <button
                        onClick={handleUserEndCall}
                        style={{
                            width: "68px", height: "68px", borderRadius: "50%",
                            background: "linear-gradient(135deg, #FF1744 0%, #B71C1C 100%)",
                            color: "white", fontSize: "1.9rem",
                            border: "2px solid #FF8A80",
                            boxShadow: "0 10px 40px rgba(255,23,68,0.85), 0 0 20px rgba(255,23,68,0.5)",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            transform: "rotate(135deg)",
                            transition: "all 0.15s ease"
                        }}
                        title={t.calls_extended?.end_call || "Finalizar Llamada"}
                    >
                        📞
                    </button>
                    <span style={{ fontSize: "0.64rem", color: "#FF5252", fontWeight: 900, letterSpacing: "0.4px" }}>
                        {t.calls?.reject || "COLGAR"}
                    </span>
                </div>
            </div>

    );
};
