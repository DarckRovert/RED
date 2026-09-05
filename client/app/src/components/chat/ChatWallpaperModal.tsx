"use client";

import React from "react";
import { useRedStore } from "../../store/useRedStore";
import { toast } from "../Toast";

interface ChatWallpaperModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const WALLPAPERS = [
    {
        id: "doodle_dark",
        name: "Doodle Oscuro WhatsApp",
        desc: "Fondo oficial oscuro con doodles sutiles de mensajería.",
        previewBg: "#0B141A",
        badge: "Oficial"
    },
    {
        id: "doodle_green",
        name: "Doodle Verde Clásico",
        desc: "El tono verde WhatsApp característico con patrones vectoriales.",
        previewBg: "#0A201C",
        badge: "Familiar"
    },
    {
        id: "void_black",
        name: "Negro Vacío OLED",
        desc: "Fondo negro puro para ahorro máximo de batería en pantallas AMOLED.",
        previewBg: "#000000",
        badge: "Ahorro"
    },
    {
        id: "emerald_minimal",
        name: "Esmeralda Cibersegura",
        desc: "Degradado táctico con sutiles acentos esmeralda.",
        previewBg: "#061A14",
        badge: "Táctico"
    },
    {
        id: "slate_tactical",
        name: "Pizarra Táctica C4ISR",
        desc: "Estilo operativo de centro de mando con tinte azul noche.",
        previewBg: "#0A0E1A",
        badge: "Militar"
    }
];

export const ChatWallpaperModal: React.FC<ChatWallpaperModalProps> = ({
    isOpen,
    onClose,
}) => {
    const { preferences, updatePreferences } = useRedStore();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') === 'familiar';
    const currentWp = preferences?.chatWallpaper || "doodle_dark";

    if (!isOpen) return null;

    const handleSelect = (id: string, name: string) => {
        updatePreferences({ chatWallpaper: id as any });
        toast.success(`🎨 Fondo "${name}" aplicado`);
        onClose();
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                backgroundColor: "rgba(0, 0, 0, 0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                animation: "fadeIn 0.15s ease-out"
            }}
            onClick={onClose}
        >
            <div
                className="animate-enter modal-card-scrollable"
                style={{
                    width: "100%",
                    maxWidth: "460px",
                    maxHeight: "calc(100dvh - 48px)",
                    background: isFamiliar ? "#202C33" : "rgba(12, 16, 30, 0.98)",
                    border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.1)" : "1.5px solid rgba(0, 229, 255, 0.35)",
                    borderRadius: "18px",
                    boxShadow: "0 24px 64px rgba(0, 0, 0, 0.85)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    borderBottom: isFamiliar ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid var(--glass-border)",
                    background: isFamiliar ? "#202C33" : "rgba(255, 255, 255, 0.02)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.3rem" }}>🎨</span>
                        <div>
                            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF" }}>
                                Fondo del Chat
                            </div>
                            <div style={{ fontSize: "0.72rem", color: isFamiliar ? "#00A884" : "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                PERSONALIZAR PAPEL TAPIZ
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#8696A0",
                            fontSize: "1.1rem",
                            cursor: "pointer",
                            padding: "4px 8px"
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Grid of Wallpapers */}
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", maxHeight: "420px", overflowY: "auto" }}>
                    {WALLPAPERS.map(wp => {
                        const isSelected = currentWp === wp.id;
                        return (
                            <div
                                key={wp.id}
                                onClick={() => handleSelect(wp.id, wp.name)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "14px",
                                    padding: "12px 14px",
                                    borderRadius: "12px",
                                    background: isSelected
                                        ? (isFamiliar ? "rgba(0, 168, 132, 0.15)" : "rgba(0, 229, 255, 0.12)")
                                        : (isFamiliar ? "#182229" : "rgba(255, 255, 255, 0.03)"),
                                    border: isSelected
                                        ? (isFamiliar ? "1.5px solid #00A884" : "1.5px solid var(--accent-cyan)")
                                        : "1px solid rgba(255, 255, 255, 0.06)",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease"
                                }}
                            >
                                <div style={{
                                    width: 46,
                                    height: 46,
                                    borderRadius: "10px",
                                    background: wp.previewBg,
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "1.2rem",
                                    flexShrink: 0,
                                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)"
                                }}>
                                    {isSelected ? "✓" : "🖼️"}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#FFFFFF" }}>
                                            {wp.name}
                                        </span>
                                        <span style={{
                                            fontSize: "0.62rem",
                                            padding: "2px 6px",
                                            borderRadius: "4px",
                                            background: "rgba(255, 255, 255, 0.08)",
                                            color: "#8696A0",
                                            fontWeight: 600
                                        }}>
                                            {wp.badge}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "#8696A0", marginTop: "2px", lineHeight: 1.3 }}>
                                        {wp.desc}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
