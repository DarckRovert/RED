import React from "react";

export type TacIconName =
    | "chats"
    | "status"
    | "calls"
    | "tools"
    | "settings"
    | "search"
    | "shield"
    | "lock"
    | "qr"
    | "radio"
    | "compass"
    | "wallet"
    | "hazard"
    | "satellite"
    | "beacon"
    | "terminal"
    | "arrow-left"
    | "check"
    | "check-double"
    | "refresh"
    | "user"
    | "users"
    | "globe"
    | "camera"
    | "mic"
    | "phone-missed"
    | "flame"
    | "star"
    | "reply"
    | "forward"
    | "copy"
    | "pin"
    | "trash"
    | "edit"
    | "info"
    | "volume"
    | "volume-x"
    | "robot"
    | "arrow-down"
    | "x"
    | "plus"
    | "zap"
    | "card"
    | "gem"
    | "mic-off"
    | "video-off"
    | "phone-hangup"
    | "box"
    | "map"
    | "maximize"
    | "minimize"
    | "share"
    | "download"
    | "upload"
    | "crosshair"
    | "palette"
    | "database"
    | "image"
    | "clipboard"
    | "chevron-left"
    | "chevron-right"
    | "chevron-up"
    | "chevron-down"
    | "sun"
    | "moon"
    | "play"
    | "pause"
    | "activity"
    | "more-vertical"
    | "eye"
    | "clock";

interface TacIconProps {
    name: TacIconName;
    size?: number | string;
    color?: string;
    strokeWidth?: number;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * RED Tactical Vector Icon Engine (TacIcon)
 * 100% Air-Gapped, Zero-Dependency, Military-Grade SVGs.
 * Calibrated for high-contrast visibility across Familiar and C4ISR modes.
 */
export const TacIcon: React.FC<TacIconProps> = ({
    name,
    size = 20,
    color = "currentColor",
    strokeWidth = 1.8,
    className = "",
    style = {},
}) => {
    const s = typeof size === "number" ? `${size}px` : size;

    const renderPath = () => {
        switch (name) {
            case "chats":
                return (
                    <>
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        <circle cx="8.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
                        <circle cx="12" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
                        <circle cx="15.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
                    </>
                );
            case "status":
                return (
                    <>
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 3a9 9 0 0 1 9 9" strokeDasharray="2 3" />
                        <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" opacity="0.3" />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    </>
                );
            case "calls":
                return (
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                );
            case "phone-missed":
                return (
                    <>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        <line x1="22" y1="2" x2="16" y2="8" />
                        <line x1="16" y1="2" x2="22" y2="8" />
                    </>
                );
            case "tools":
                return (
                    <>
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none" />
                    </>
                );
            case "settings":
                return (
                    <>
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </>
                );
            case "search":
                return (
                    <>
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="11" y1="8" x2="11" y2="14" strokeWidth={1.2} opacity={0.5} />
                        <line x1="8" y1="11" x2="14" y2="11" strokeWidth={1.2} opacity={0.5} />
                    </>
                );
            case "shield":
                return (
                    <>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M12 8v8" strokeWidth={1.4} opacity={0.6} />
                        <path d="M9 11l3-3 3 3" strokeWidth={1.4} opacity={0.6} />
                    </>
                );
            case "lock":
                return (
                    <>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        <circle cx="12" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
                    </>
                );
            case "qr":
                return (
                    <>
                        <rect x="3" y="3" width="6" height="6" rx="1" />
                        <rect x="15" y="3" width="6" height="6" rx="1" />
                        <rect x="3" y="15" width="6" height="6" rx="1" />
                        <path d="M15 15h2v2h-2zM19 15h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z" fill="currentColor" stroke="none" />
                        <rect x="5" y="5" width="2" height="2" fill="currentColor" stroke="none" />
                        <rect x="17" y="5" width="2" height="2" fill="currentColor" stroke="none" />
                        <rect x="5" y="17" width="2" height="2" fill="currentColor" stroke="none" />
                    </>
                );
            case "radio":
                return (
                    <>
                        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
                        <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
                    </>
                );
            case "compass":
                return (
                    <>
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" opacity="0.3" />
                        <line x1="12" y1="2" x2="12" y2="4" />
                        <line x1="12" y1="20" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="4" y2="12" />
                        <line x1="20" y1="12" x2="22" y2="12" />
                    </>
                );
            case "wallet":
                return (
                    <>
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                        <circle cx="17" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
                    </>
                );
            case "hazard":
                return (
                    <>
                        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
                        <path d="M12 2a10 10 0 0 1 8.66 5l-4.33 2.5a5 5 0 0 0-4.33-2.5V2z" fill="currentColor" opacity="0.4" />
                        <path d="M20.66 17a10 10 0 0 1-8.66 5v-5a5 5 0 0 0 4.33-2.5l4.33 2.5z" fill="currentColor" opacity="0.4" />
                        <path d="M3.34 17l4.33-2.5A5 5 0 0 0 12 17v5a10 10 0 0 1-8.66-5z" fill="currentColor" opacity="0.4" />
                    </>
                );
            case "satellite":
                return (
                    <>
                        <path d="M4 10l5 5m-2-7l5 5m3-8l4 4-2 2-4-4 2-2zm-6 6l4 4-2 2-4-4 2-2z" />
                        <path d="M13 13l-4 4" />
                        <circle cx="5" cy="19" r="2" />
                    </>
                );
            case "beacon":
                return (
                    <>
                        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                        <path d="M5.64 5.64a9 9 0 0 1 12.72 0M2.81 2.81a13 13 0 0 1 18.38 0M5.64 18.36a9 9 0 0 0 12.72 0M2.81 21.19a13 13 0 0 0 18.38 0" />
                    </>
                );
            case "terminal":
                return (
                    <>
                        <polyline points="4 17 10 11 4 5" />
                        <line x1="12" y1="19" x2="20" y2="19" />
                    </>
                );
            case "arrow-left":
                return (
                    <polyline points="15 18 9 12 15 6" />
                );
            case "check":
                return (
                    <polyline points="20 6 9 17 4 12" />
                );
            case "check-double":
                return (
                    <>
                        <path d="M18 6L8 16l-4-4" />
                        <path d="M22 10l-8.5 8.5-2-2" />
                    </>
                );
            case "refresh":
                return (
                    <>
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </>
                );
            case "user":
                return (
                    <>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </>
                );
            case "users":
                return (
                    <>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </>
                );
            case "globe":
                return (
                    <>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </>
                );
            case "camera":
                return (
                    <>
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                    </>
                );
            case "mic":
                return (
                    <>
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                    </>
                );
            case "flame":
                return (
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z" />
                );
            case "star":
                return (
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                );
            case "reply":
                return (
                    <>
                        <polyline points="9 14 4 9 9 4" />
                        <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                    </>
                );
            case "forward":
                return (
                    <>
                        <polyline points="15 14 20 9 15 4" />
                        <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                    </>
                );
            case "copy":
                return (
                    <>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </>
                );
            case "pin":
                return (
                    <>
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-2l-2-3V6a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v6l-2 3v2z" />
                    </>
                );
            case "trash":
                return (
                    <>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </>
                );
            case "edit":
                return (
                    <>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </>
                );
            case "info":
                return (
                    <>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth={2} />
                    </>
                );
            case "volume":
                return (
                    <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </>
                );
            case "robot":
                return (
                    <>
                        <rect x="4" y="8" width="16" height="12" rx="2" />
                        <path d="M12 2v6" />
                        <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
                        <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
                        <line x1="9" y1="17" x2="15" y2="17" />
                    </>
                );
            case "arrow-down":
                return (
                    <polyline points="6 9 12 15 18 9" />
                );
            case "volume-x":
                return (
                    <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                    </>
                );
            case "x":
                return (
                    <>
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </>
                );
            case "plus":
                return (
                    <>
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </>
                );
            case "zap":
                return (
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none" />
                );
            case "card":
                return (
                    <>
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                        <line x1="6" y1="15" x2="10" y2="15" />
                    </>
                );
            case "gem":
                return (
                    <>
                        <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
                        <line x1="2" y1="9" x2="22" y2="9" />
                        <polyline points="6 3 12 9 18 3" />
                        <line x1="12" y1="9" x2="12" y2="22" />
                    </>
                );
            case "mic-off":
                return (
                    <>
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                    </>
                );
            case "video-off":
                return (
                    <>
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-4 4.66l-5.66-5.66" />
                    </>
                );
            case "phone-hangup":
                return (
                    <>
                        <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                        <line x1="23" y1="1" x2="1" y2="23" />
                    </>
                );
            case "box":
                return (
                    <>
                        <path d="M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                    </>
                );
            case "map":
                return (
                    <>
                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                        <line x1="8" y1="2" x2="8" y2="18" />
                        <line x1="16" y1="6" x2="16" y2="22" />
                    </>
                );
            case "maximize":
                return (
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                );
            case "minimize":
                return (
                    <path d="M4 14h6v6m10-10h-6V4m0 6 7-7M3 21l7-7" />
                );
            case "share":
                return (
                    <>
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </>
                );
            case "download":
                return (
                    <>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </>
                );
            case "upload":
                return (
                    <>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </>
                );
            case "crosshair":
                return (
                    <>
                        <circle cx="12" cy="12" r="8" />
                        <line x1="12" y1="2" x2="12" y2="6" />
                        <line x1="12" y1="18" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="6" y2="12" />
                        <line x1="18" y1="12" x2="22" y2="12" />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    </>
                );
            case "palette":
                return (
                    <>
                        <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10 1.38 0 2.5-1.12 2.5-2.5 0-.64-.24-1.22-.65-1.66-.4-.44-.65-1.02-.65-1.66 0-1.38 1.12-2.5 2.5-2.5H17c3.31 0 6-2.69 6-6 0-4.97-4.93-9.18-11-7.68z" />
                        <circle cx="7.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
                        <circle cx="10.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
                        <circle cx="14.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
                        <circle cx="17.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
                    </>
                );
            case "database":
                return (
                    <>
                        <ellipse cx="12" cy="5" rx="9" ry="3" />
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                    </>
                );
            case "eye":
                return (
                    <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                    </>
                );
            case "image":
                return (
                    <>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </>
                );
            case "clipboard":
                return (
                    <>
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </>
                );
            case "chevron-left":
                return <polyline points="15 18 9 12 15 6" />;
            case "chevron-right":
                return <polyline points="9 18 15 12 9 6" />;
            case "chevron-up":
                return <polyline points="18 15 12 9 6 15" />;
            case "chevron-down":
                return <polyline points="6 9 12 15 18 9" />;
            case "sun":
                return (
                    <>
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </>
                );
            case "moon":
                return <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />;
            case "play":
                return <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />;
            case "pause":
                return (
                    <>
                        <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                        <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                    </>
                );
            case "activity":
                return <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />;
            case "more-vertical":
                return (
                    <>
                        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
                        <circle cx="12" cy="5" r="1.2" fill="currentColor" />
                        <circle cx="12" cy="19" r="1.2" fill="currentColor" />
                    </>
                );
            case "clock":
                return (
                    <>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </>
                );
            default:
                return <circle cx="12" cy="12" r="9" />;
        }
    };

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width={s}
            height={s}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`tac-icon ${className}`}
            style={{
                display: "inline-block",
                verticalAlign: "middle",
                flexShrink: 0,
                ...style,
            }}
        >
            {renderPath()}
        </svg>
    );
};

export default TacIcon;
