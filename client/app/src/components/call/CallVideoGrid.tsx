import React from "react";

interface CallVideoGridProps {
    isAudioOnly: boolean;
    callActive: boolean;
    facingMode: "user" | "environment";
    camMuted: boolean;
    remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
    localVideoRef: React.RefObject<HTMLVideoElement | null>;
}

export const CallVideoGrid: React.FC<CallVideoGridProps> = ({
    isAudioOnly,
    callActive,
    facingMode,
    camMuted,
    remoteVideoRef,
    localVideoRef,
}) => {
    if (isAudioOnly) return null;

    return (
        <>
                    {/* Remote Video (Full Screen - UNMUTED so remote voice/audio can be heard) */}
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        style={{
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            objectFit: "cover",
                            opacity: callActive ? 1 : 0,
                            transition: "opacity 0.6s ease-in-out",
                            zIndex: 1,
                            backgroundColor: "#05070e"
                        }}
                    />

                    {/* Local Video (Floating Tactical PIP - MUTED to prevent local acoustic feedback) */}
                    <video
                        ref={localVideoRef}
                        autoPlay playsInline muted
                        style={{
                            position: "absolute",
                            top: "calc(64px + var(--safe-top, 0px))",
                            right: "16px",
                            width: "115px",
                            height: "160px",
                            borderRadius: "18px",
                            objectFit: "cover",
                            border: "2px solid var(--accent-cyan)",
                            boxShadow: "0 12px 36px rgba(0,0,0,0.85), 0 0 16px rgba(0,229,255,0.3)",
                            zIndex: 10,
                            transform: facingMode === "user" ? "scaleX(-1)" : "none",
                            backgroundColor: "#0a0e1a",
                            display: camMuted ? "none" : "block"
                        }}
                    />
                </>
    );
};
