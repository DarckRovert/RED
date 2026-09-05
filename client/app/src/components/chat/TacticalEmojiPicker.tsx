"use client";

import React, { useState } from "react";
import { TacticalAudioEngine } from "../../lib/TacticalAudioEngine";
import { useRedStore } from "../../store/useRedStore";

interface TacticalEmojiPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectEmoji: (emoji: string) => void;
}

const EMOJI_CATEGORIES = [
    {
        id: "tactical",
        name: "Tácticos & Malla",
        icon: "🛡️",
        emojis: [
            "🛡️", "🎯", "⚔️", "📡", "📍", "🚨", "⚡", "💣", "📻", "🛰️",
            "🧭", "🪖", "🚁", "🔒", "🔑", "🪪", "🔥", "⚠️", "🌲", "🌊",
            "🏕️", "🔦", "🔋", "📶", "🏥", "🩹", "🩸", "🪙", "🎨", "📦"
        ]
    },
    {
        id: "expressions",
        name: "Reacciones & Gestos",
        icon: "😊",
        emojis: [
            "👍", "👎", "🫡", "🤝", "👏", "💪", "🔥", "❤️", "💯", "✅",
            "❌", "👀", "🤫", "😎", "🤔", "🙏", "🎉", "🚀", "⭐", "💥",
            "😂", "😮", "😢", "😡", "🥳", "🙌", "🤙", "👌", "✌️", "🕊️"
        ]
    },
    {
        id: "status",
        name: "Símbolos & Estado",
        icon: "🟢",
        emojis: [
            "🟢", "🟡", "🔴", "🔵", "🟣", "⚪", "⬛", "🛑", "⚠️", "⛔",
            "☀️", "🌧️", "⚡", "❄️", "🌪️", "🌙", "⏳", "⏱️", "📈", "📉",
            "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "🔄", "➡️", "⬅️", "⬆️", "⬇️"
        ]
    }
];

export const TacticalEmojiPicker: React.FC<TacticalEmojiPickerProps> = ({
    isOpen,
    onClose,
    onSelectEmoji,
}) => {
    const { preferences } = useRedStore();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') === 'familiar';
    const [activeTab, setActiveTab] = useState(isFamiliar ? "expressions" : "tactical");
    const [searchQuery, setSearchQuery] = useState("");

    if (!isOpen) return null;

    const currentCat = EMOJI_CATEGORIES.find(c => c.id === activeTab) || EMOJI_CATEGORIES[0];
    const filteredEmojis = searchQuery.trim()
        ? EMOJI_CATEGORIES.flatMap(c => c.emojis)
        : currentCat.emojis;

    const handleEmojiClick = (emoji: string) => {
        try {
            TacticalAudioEngine.playTap();
        } catch {}
        onSelectEmoji(emoji);
    };

    return (
        <>
            {/* Backdrop click-away */}
            <div
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 150,
                }}
            />

            {/* Floating Popover */}
            <div
                style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: "12px",
                    zIndex: 160,
                    width: "320px",
                    maxWidth: "calc(100vw - 24px)",
                    background: isFamiliar ? "#233138" : "rgba(12, 16, 30, 0.98)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.12)" : "1.5px solid rgba(0, 229, 255, 0.35)",
                    borderRadius: "18px",
                    padding: "12px",
                    boxShadow: isFamiliar ? "0 16px 48px rgba(0, 0, 0, 0.65)" : "0 12px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 229, 255, 0.15)",
                    animation: "fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                }}
            >
                {/* Header with Search & Close */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid var(--glass-border)",
                            borderRadius: "10px",
                            padding: "6px 10px",
                        }}
                    >
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar símbolos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                flex: 1,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "#fff",
                                fontSize: "0.82rem",
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="btn-icon"
                        style={{ width: 28, height: 28, fontSize: "0.8rem" }}
                    >
                        ✕
                    </button>
                </div>

                {/* Category Pills */}
                {!searchQuery && (
                    <div style={{ display: "flex", gap: "4px", background: "rgba(255, 255, 255, 0.03)", padding: "3px", borderRadius: "10px" }}>
                        {EMOJI_CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveTab(cat.id)}
                                style={{
                                    flex: 1,
                                    padding: "6px 8px",
                                    borderRadius: "8px",
                                    border: "none",
                                    background: activeTab === cat.id ? (isFamiliar ? "rgba(0, 168, 132, 0.25)" : "rgba(0, 229, 255, 0.2)") : "transparent",
                                    color: activeTab === cat.id ? (isFamiliar ? "#00A884" : "var(--accent-cyan)") : "var(--text-muted)",
                                    fontSize: "0.74rem",
                                    fontWeight: activeTab === cat.id ? 800 : 600,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "4px",
                                    transition: "all 0.15s ease",
                                    touchAction: "manipulation",
                                    pointerEvents: "auto"
                                }}
                            >
                                <span>{cat.icon}</span>
                                <span style={{ fontSize: "0.68rem" }}>{cat.name.split(" ")[0]}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Grid of Emojis */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(6, 1fr)",
                        gap: "6px",
                        maxHeight: "180px",
                        overflowY: "auto",
                        padding: "4px 2px",
                    }}
                >
                    {filteredEmojis.map((emoji, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleEmojiClick(emoji)}
                            style={{
                                width: "100%",
                                aspectRatio: "1/1",
                                background: "rgba(255, 255, 255, 0.04)",
                                border: "1px solid rgba(255, 255, 255, 0.05)",
                                borderRadius: "10px",
                                fontSize: "1.35rem",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                transition: "transform 0.1s ease, background 0.15s ease",
                                touchAction: "manipulation",
                                pointerEvents: "auto"
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "scale(1.2)";
                                e.currentTarget.style.background = isFamiliar ? "rgba(0, 168, 132, 0.2)" : "rgba(0, 229, 255, 0.15)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "scale(1.0)";
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                            }}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
};
