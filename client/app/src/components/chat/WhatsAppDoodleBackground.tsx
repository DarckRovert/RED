"use client";

import React, { memo } from "react";

interface WhatsAppDoodleBackgroundProps {
    opacity?: number;
    className?: string;
    variant?: "dark" | "green" | "tactical";
}

/**
 * WhatsAppDoodleBackground — Authentic Vector Doodle Wallpaper
 * 
 * Renders a lightweight, crisp SVG doodle background pattern inspired by WhatsApp's
 * iconic wallpaper. Zero external image dependencies, instant rendering, 100% vector.
 */
export const WhatsAppDoodleBackground: React.FC<WhatsAppDoodleBackgroundProps> = memo(({
    opacity = 0.05,
    className = "",
    variant = "dark"
}) => {
    // Background color based on variant
    const bgColor = variant === "green" 
        ? "#0B1D19" 
        : (variant === "tactical" ? "#04060C" : "#0B141A");

    return (
        <div
            className={`whatsapp-doodle-bg ${className}`}
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                backgroundColor: bgColor,
                overflow: "hidden",
                pointerEvents: "none",
                zIndex: 0,
                userSelect: "none",
            }}
            aria-hidden="true"
        >
            <svg
                width="100%"
                height="100%"
                xmlns="http://www.w3.org/2000/svg"
                style={{ opacity }}
            >
                <defs>
                    <pattern
                        id="wa-doodle-pattern"
                        width="360"
                        height="360"
                        patternUnits="userSpaceOnUse"
                    >
                        <g fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            {/* 1. Speech Bubble */}
                            <path d="M 30,40 C 30,28 50,28 65,28 C 80,28 95,35 95,48 C 95,60 80,68 65,68 C 55,68 45,72 38,78 C 40,70 30,62 30,48 Z" />
                            <circle cx="50" cy="48" r="2.5" fill="#FFFFFF" />
                            <circle cx="62" cy="48" r="2.5" fill="#FFFFFF" />
                            <circle cx="74" cy="48" r="2.5" fill="#FFFFFF" />

                            {/* 2. Paper Plane */}
                            <path d="M 130,35 L 175,55 L 145,62 L 138,82 L 144,66 L 165,48" />

                            {/* 3. Coffee Cup */}
                            <path d="M 220,38 L 255,38 C 255,56 245,65 237,65 C 230,65 220,56 220,38 Z" />
                            <path d="M 255,42 C 262,42 265,48 262,54 C 259,58 253,58 253,58" />
                            <path d="M 228,28 Q 232,32 228,35" />
                            <path d="M 238,26 Q 242,30 238,35" />
                            <path d="M 215,69 L 260,69" />

                            {/* 4. Padlock (End-to-End Encryption) */}
                            <rect x="300" y="44" width="26" height="20" rx="4" />
                            <path d="M 306,44 L 306,35 C 306,28 320,28 320,35 L 320,44" />
                            <circle cx="313" cy="53" r="2.5" fill="#FFFFFF" />
                            <path d="M 313,55.5 L 313,60" />

                            {/* 5. Clock / Time */}
                            <circle cx="55" cy="140" r="16" />
                            <path d="M 55,129 L 55,140 L 63,144" />

                            {/* 6. Headphones */}
                            <path d="M 125,145 C 125,125 155,125 155,145" />
                            <rect x="120" y="142" width="8" height="15" rx="3" fill="none" />
                            <rect x="152" y="142" width="8" height="15" rx="3" fill="none" />

                            {/* 7. Star */}
                            <polygon points="230,120 234,130 245,131 236,138 239,149 230,143 221,149 224,138 215,131 226,130" />

                            {/* 8. Phone Receiver */}
                            <path d="M 295,130 C 295,138 312,155 320,155 C 324,155 326,150 324,146 L 319,140 C 317,138 314,138 312,140 L 310,142 C 305,138 302,135 298,130 L 300,128 C 302,126 302,123 300,121 L 294,116 C 290,114 285,116 285,120 C 285,125 290,130 295,130 Z" />

                            {/* 9. Camera */}
                            <rect x="40" y="215" width="28" height="20" rx="4" />
                            <path d="M 48,215 L 51,210 L 57,210 L 60,215" />
                            <circle cx="54" cy="225" r="5.5" />

                            {/* 10. Music Note */}
                            <path d="M 135,230 L 135,212 L 150,208 L 150,226" />
                            <ellipse cx="130" cy="232" rx="5" ry="3.5" transform="rotate(-20 130 232)" fill="#FFFFFF" />
                            <ellipse cx="145" cy="228" rx="5" ry="3.5" transform="rotate(-20 145 228)" fill="#FFFFFF" />
                            <path d="M 135,218 L 150,214" />

                            {/* 11. Heart */}
                            <path d="M 230,225 C 230,220 220,210 212,218 C 204,226 215,236 230,246 C 245,236 256,226 248,218 C 240,210 230,220 230,225 Z" />

                            {/* 12. Checkmarks Double */}
                            <path d="M 295,225 L 302,232 L 315,218" />
                            <path d="M 302,225 L 309,232 L 322,218" />

                            {/* 13. Planet / Mesh Node */}
                            <circle cx="50" cy="305" r="13" />
                            <ellipse cx="50" cy="305" rx="20" ry="5" transform="rotate(-25 50 305)" />

                            {/* 14. Document with folded corner */}
                            <path d="M 125,290 L 145,290 L 155,300 L 155,325 L 125,325 Z" />
                            <path d="M 145,290 L 145,300 L 155,300" />
                            <line x1="131" y1="305" x2="149" y2="305" />
                            <line x1="131" y1="312" x2="149" y2="312" />
                            <line x1="131" y1="319" x2="142" y2="319" />

                            {/* 15. Search Glass */}
                            <circle cx="230" cy="305" r="10" />
                            <line x1="237" y1="312" x2="248" y2="323" strokeWidth="2.2" />

                            {/* 16. Location Pin */}
                            <path d="M 310,295 C 304,295 300,299 300,305 C 300,314 310,325 310,325 C 310,325 320,314 320,305 C 320,299 316,295 310,295 Z" />
                            <circle cx="310" cy="304" r="3" fill="#FFFFFF" />
                        </g>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#wa-doodle-pattern)" />
            </svg>
        </div>
    );
});

WhatsAppDoodleBackground.displayName = "WhatsAppDoodleBackground";
export default WhatsAppDoodleBackground;
