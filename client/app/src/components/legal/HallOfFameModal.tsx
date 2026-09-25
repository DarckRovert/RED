"use client";

import React, { useState, useMemo, useEffect } from "react";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import {
    HALL_OF_FAME_ENTRIES,
    HALL_OF_FAME_CATEGORIES,
    CreditCategory,
    HallOfFameEntry,
} from "../../lib/legal/HallOfFameData";
import { RED_VERSION_NAME } from "../../lib/version";

interface HallOfFameModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HallOfFameModal: React.FC<HallOfFameModalProps> = ({ isOpen, onClose }) => {
    const [selectedCategory, setSelectedCategory] = useState<CreditCategory | "ALL">("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        return BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            onClose();
            return true;
        });
    }, [isOpen, onClose]);

    const filteredEntries = useMemo(() => {
        return HALL_OF_FAME_ENTRIES.filter((entry) => {
            const matchesCategory =
                selectedCategory === "ALL" || entry.category === selectedCategory;
            const query = searchQuery.trim().toLowerCase();
            if (!query) return matchesCategory;

            const matchesSearch =
                entry.name.toLowerCase().includes(query) ||
                (entry.handleOrEntity && entry.handleOrEntity.toLowerCase().includes(query)) ||
                entry.role.toLowerCase().includes(query) ||
                entry.contribution.toLowerCase().includes(query) ||
                (entry.license && entry.license.toLowerCase().includes(query));

            return matchesCategory && matchesSearch;
        });
    }, [selectedCategory, searchQuery]);

    if (!isOpen) return null;

    const getLicenseColor = (licenseType?: string) => {
        switch (licenseType) {
            case "AGPL-3.0":
                return "var(--accent-emerald)";
            case "MIT":
                return "var(--accent-cyan)";
            case "GPL-3.0":
                return "#A78BFA";
            case "BSD":
                return "var(--accent-amber)";
            case "Public Domain":
                return "#38BDF8";
            default:
                return "var(--text-muted)";
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 999999,
                backgroundColor: "rgba(2, 4, 10, 0.95)",
                backdropFilter: "blur(14px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                animation: "fadeIn 0.15s ease-out",
            }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hall-of-fame-title"
        >
            <div
                className="card-tactical animate-enter"
                style={{
                    width: "100%",
                    maxWidth: "880px",
                    maxHeight: "92vh",
                    background: "linear-gradient(180deg, #0a0f24 0%, #03050c 100%)",
                    border: "1px solid rgba(0, 229, 255, 0.45)",
                    borderRadius: "16px",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    boxShadow: "0 28px 70px rgba(0,0,0,0.95), 0 0 35px rgba(0,229,255,0.18)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "18px 24px",
                        borderBottom: "1px solid rgba(0, 229, 255, 0.25)",
                        background: "rgba(0, 0, 0, 0.6)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                            style={{
                                width: "44px",
                                height: "44px",
                                borderRadius: "12px",
                                background: "rgba(0, 229, 255, 0.12)",
                                border: "1px solid var(--accent-cyan)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "1.5rem",
                            }}
                        >
                            🎖️
                        </div>
                        <div>
                            <h1
                                id="hall-of-fame-title"
                                style={{
                                    margin: 0,
                                    fontSize: "1.15rem",
                                    fontWeight: 900,
                                    color: "#FFFFFF",
                                    letterSpacing: "-0.3px",
                                }}
                            >
                                Salón de la Fama & Atribución de Código Abierto
                            </h1>
                            <div
                                style={{
                                    fontSize: "0.72rem",
                                    color: "var(--accent-cyan)",
                                    fontFamily: "JetBrains Mono, monospace",
                                    marginTop: "2px",
                                }}
                            >
                                {RED_VERSION_NAME} · Honores a Creadores, Pioneros y Proyectos Upstream
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            onClose();
                        }}
                        className="btn-ghost"
                        style={{ padding: "6px 10px", fontSize: "0.80rem" }}
                        aria-label="Cerrar Salón de la Fama"
                    >
                        ✕
                    </button>
                </div>

                {/* Sub-header Banner */}
                <div
                    style={{
                        padding: "12px 24px",
                        background: "rgba(0, 230, 118, 0.04)",
                        borderBottom: "1px solid rgba(0, 230, 118, 0.15)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "10px",
                        fontSize: "0.76rem",
                        color: "var(--text-secondary)",
                    }}
                >
                    <div>
                        RED se erige sobre los hombros de gigantes: criptógrafos, radioaficionados, neurocientíficos y proyectos libres.
                    </div>
                    <div
                        style={{
                            display: "flex",
                            gap: "8px",
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: "0.70rem",
                        }}
                    >
                        <span style={{ color: "var(--accent-emerald)" }}>16 Pioneros</span>
                        <span>·</span>
                        <span style={{ color: "var(--accent-cyan)" }}>100% Código Abierto</span>
                        <span>·</span>
                        <span style={{ color: "#A78BFA" }}>Licencia AGPLv3</span>
                    </div>
                </div>

                {/* Category Filters Bar */}
                <div
                    style={{
                        padding: "12px 24px 8px 24px",
                        display: "flex",
                        gap: "8px",
                        overflowX: "auto",
                        borderBottom: "1px solid var(--glass-border)",
                        background: "rgba(255,255,255,0.01)",
                    }}
                >
                    {HALL_OF_FAME_CATEGORIES.map((cat) => {
                        const isSelected = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    TacticalAudioEngine.playTap();
                                    setSelectedCategory(cat.id);
                                }}
                                style={{
                                    padding: "6px 12px",
                                    fontSize: "0.74rem",
                                    fontWeight: isSelected ? 800 : 600,
                                    borderRadius: "8px",
                                    border: isSelected
                                        ? "1px solid var(--accent-cyan)"
                                        : "1px solid rgba(255,255,255,0.08)",
                                    background: isSelected
                                        ? "rgba(0, 229, 255, 0.15)"
                                        : "rgba(255,255,255,0.02)",
                                    color: isSelected ? "#FFFFFF" : "var(--text-muted)",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    transition: "all 0.15s ease",
                                }}
                            >
                                <span>{cat.icon}</span>
                                <span>{cat.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Search Bar */}
                <div style={{ padding: "10px 24px", background: "rgba(0,0,0,0.2)" }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="🔍 Buscar por autor, biblioteca, rol o algoritmo (ej. Kyber, djb, LoRa, OpenWorm)..."
                        style={{
                            width: "100%",
                            padding: "8px 14px",
                            fontSize: "0.78rem",
                            borderRadius: "8px",
                            border: "1px solid var(--glass-border)",
                            background: "rgba(0, 0, 0, 0.4)",
                            color: "#FFFFFF",
                            outline: "none",
                            fontFamily: "inherit",
                        }}
                    />
                </div>

                {/* Cards Container (Scrollable) */}
                <div
                    className="scroll-container"
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: "16px 24px",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                        gap: "14px",
                    }}
                >
                    {filteredEntries.map((entry) => (
                        <div
                            key={entry.id}
                            style={{
                                background: "rgba(255, 255, 255, 0.02)",
                                border: entry.category === "CORE"
                                    ? "1px solid rgba(0, 230, 118, 0.4)"
                                    : "1px solid rgba(255, 255, 255, 0.07)",
                                borderRadius: "12px",
                                padding: "16px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                gap: "10px",
                                transition: "transform 0.15s ease, border-color 0.15s ease",
                            }}
                        >
                            <div>
                                {/* Card Header */}
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        gap: "8px",
                                        marginBottom: "6px",
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: "0.95rem",
                                                fontWeight: 800,
                                                color: entry.category === "CORE" ? "var(--accent-emerald)" : "#FFFFFF",
                                            }}
                                        >
                                            {entry.name}
                                        </div>
                                        {entry.handleOrEntity && (
                                            <div
                                                style={{
                                                    fontSize: "0.72rem",
                                                    color: "var(--accent-cyan)",
                                                    fontFamily: "JetBrains Mono, monospace",
                                                }}
                                            >
                                                {entry.handleOrEntity}
                                            </div>
                                        )}
                                    </div>

                                    {entry.badgeText && (
                                        <span
                                            style={{
                                                fontSize: "0.65rem",
                                                fontWeight: 800,
                                                fontFamily: "JetBrains Mono, monospace",
                                                padding: "2px 8px",
                                                borderRadius: "4px",
                                                background: entry.category === "CORE"
                                                    ? "rgba(0, 230, 118, 0.15)"
                                                    : "rgba(0, 229, 255, 0.12)",
                                                color: entry.category === "CORE"
                                                    ? "var(--accent-emerald)"
                                                    : "var(--accent-cyan)",
                                                border: `1px solid ${entry.category === "CORE" ? "rgba(0,230,118,0.3)" : "rgba(0,229,255,0.3)"}`,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {entry.badgeText}
                                        </span>
                                    )}
                                </div>

                                {/* Role */}
                                <div
                                    style={{
                                        fontSize: "0.74rem",
                                        color: "var(--accent-amber)",
                                        fontWeight: 700,
                                        marginBottom: "8px",
                                    }}
                                >
                                    {entry.role}
                                </div>

                                {/* Contribution Description */}
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: "0.78rem",
                                        lineHeight: 1.55,
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    {entry.contribution}
                                </p>

                                {/* Honor Quote */}
                                {entry.honorQuote && (
                                    <div
                                        style={{
                                            marginTop: "10px",
                                            padding: "8px 10px",
                                            background: "rgba(0, 0, 0, 0.3)",
                                            borderRadius: "6px",
                                            borderLeft: "2px solid var(--accent-cyan)",
                                            fontStyle: "italic",
                                            fontSize: "0.72rem",
                                            color: "var(--text-muted)",
                                            lineHeight: 1.45,
                                        }}
                                    >
                                        {entry.honorQuote}
                                    </div>
                                )}
                            </div>

                            {/* Card Footer */}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    borderTop: "1px solid rgba(255,255,255,0.05)",
                                    paddingTop: "10px",
                                    marginTop: "6px",
                                    fontSize: "0.70rem",
                                }}
                            >
                                <span
                                    style={{
                                        color: getLicenseColor(entry.licenseType),
                                        fontFamily: "JetBrains Mono, monospace",
                                        fontWeight: 700,
                                    }}
                                >
                                    📜 {entry.license || "Open Source"}
                                </span>

                                {entry.url && (
                                    <a
                                        href={entry.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: "var(--accent-cyan)",
                                            textDecoration: "underline",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                        }}
                                    >
                                        <span>Repositorio / Fuente</span>
                                        <span>↗</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredEntries.length === 0 && (
                        <div
                            style={{
                                gridColumn: "1 / -1",
                                textAlign: "center",
                                padding: "40px",
                                color: "var(--text-muted)",
                                fontSize: "0.84rem",
                            }}
                        >
                            No se encontraron pioneros con el filtro «{searchQuery}».
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div
                    style={{
                        padding: "14px 24px",
                        borderTop: "1px solid var(--glass-border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "rgba(0,0,0,0.6)",
                        flexWrap: "wrap",
                        gap: "10px",
                    }}
                >
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        Licencias upstream respetadas conforme a las cláusulas de atribución AGPLv3, MIT, Apache y BSD.
                    </div>

                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            onClose();
                        }}
                        className="btn-tactical-primary"
                        style={{ padding: "8px 20px", fontSize: "0.78rem", fontWeight: 800 }}
                    >
                        Cerrar Salón de la Fama
                    </button>
                </div>
            </div>
        </div>
    );
};
