"use client";

import React from "react";

export type VideoTacticalFilter = "normal" | "night_vision" | "flir_thermal" | "surveillance_crt";

interface CallVideoGridProps {
    isAudioOnly: boolean;
    callActive: boolean;
    hasRemoteVideo: boolean;
    facingMode: "user" | "environment";
    camMuted: boolean;
    isMirror?: boolean;
    tacticalFilter?: VideoTacticalFilter;
    remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
    localVideoRef: React.RefObject<HTMLVideoElement | null>;
}

export const CallVideoGrid: React.FC<CallVideoGridProps> = ({
    isAudioOnly,
    callActive,
    hasRemoteVideo,
    facingMode,
    camMuted,
    isMirror = true,
    tacticalFilter = "normal",
    remoteVideoRef,
    localVideoRef,
}) => {
    if (isAudioOnly) return null;

    const showRemote = hasRemoteVideo || callActive;

    const getFilterCss = (filter: VideoTacticalFilter) => {
        switch (filter) {
            case "night_vision":
                return "brightness(1.25) contrast(1.4) saturate(0) sepia(100%) hue-rotate(85deg)";
            case "flir_thermal":
                return "invert(1) hue-rotate(180deg) saturate(2.8) contrast(1.6)";
            case "surveillance_crt":
                return "grayscale(0.85) contrast(1.35) brightness(0.92)";
            default:
                return "none";
        }
    };

    const filterStyle = getFilterCss(tacticalFilter);

    return (
        <>
            {/* Remote Video */}
            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                disablePictureInPicture
                disableRemotePlayback
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: showRemote ? 1 : 0,
                    transition: "opacity 0.3s ease-in-out, filter 0.3s ease",
                    zIndex: 2,
                    backgroundColor: "#05070e",
                    filter: filterStyle,
                    pointerEvents: "none",
                }}
            />

            {/* Tactical Screen Overlays for Night Vision / FLIR */}
            {tacticalFilter === "night_vision" && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 3,
                        background: "radial-gradient(circle, rgba(0,255,100,0.08) 0%, rgba(0,40,10,0.5) 100%)",
                        boxShadow: "inset 0 0 100px rgba(0, 0, 0, 0.8)",
                        pointerEvents: "none",
                    }}
                />
            )}

            {tacticalFilter === "surveillance_crt" && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 3,
                        backgroundImage: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
                        backgroundSize: "100% 4px, 6px 100%",
                        pointerEvents: "none",
                    }}
                />
            )}

            {/* Local Video (Floating Tactical PIP) */}
            <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                disablePictureInPicture
                disableRemotePlayback
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
                    transform: (isMirror && facingMode === "user") ? "scaleX(-1)" : "none",
                    backgroundColor: "#0a0e1a",
                    display: camMuted ? "none" : "block",
                    filter: filterStyle,
                    pointerEvents: "none",
                }}
            />
        </>
    );
};
