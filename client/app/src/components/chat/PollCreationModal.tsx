"use client";

import React, { useState } from "react";
import { toast } from "../Toast";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { TacticalAudioEngine } from "../../lib/TacticalAudioEngine";
import { useRedStore } from "../../store/useRedStore";

interface PollCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreatePoll: (pollData: { question: string; options: string[]; allowMultiple?: boolean }) => void;
}

export const PollCreationModal: React.FC<PollCreationModalProps> = ({
    isOpen,
    onClose,
    onCreatePoll,
}) => {
    const { t } = useTranslation();
    const { preferences } = useRedStore();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') === 'familiar';
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState<string[]>(["", ""]);
    const [allowMultiple, setAllowMultiple] = useState(false);

    if (!isOpen) return null;

    const handleAddOption = () => {
        if (options.length >= 8) {
            toast.info("Máximo 8 opciones permitidas");
            return;
        }
        setOptions([...options, ""]);
    };

    const handleRemoveOption = (index: number) => {
        if (options.length <= 2) {
            toast.info("Se requieren al menos 2 opciones");
            return;
        }
        setOptions(options.filter((_, i) => i !== index));
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const handleSubmit = () => {
        const cleanQuestion = question.trim();
        if (!cleanQuestion) {
            toast.error("Ingresa una pregunta para la encuesta");
            return;
        }

        const validOptions = options.map(o => o.trim()).filter(o => o.length > 0);
        if (validOptions.length < 2) {
            toast.error("Ingresa al menos 2 opciones válidas");
            return;
        }

        TacticalAudioEngine.playMessageSent();
        onCreatePoll({
            question: cleanQuestion,
            options: validOptions,
            allowMultiple,
        });

        // Reset & close
        setQuestion("");
        setOptions(["", ""]);
        setAllowMultiple(false);
        onClose();
        toast.success("📊 Encuesta táctica publicada en el canal");
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                background: "rgba(4, 6, 14, 0.88)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                animation: "fadeIn 0.2s ease-out",
            }}
            onClick={onClose}
        >
            <div
                className="animate-enter"
                style={{
                    width: "100%",
                    maxWidth: "420px",
                    padding: "24px",
                    background: isFamiliar ? "#202C33" : "rgba(10, 14, 28, 0.95)",
                    boxShadow: isFamiliar ? "0 24px 64px rgba(0, 0, 0, 0.85)" : "0 24px 64px rgba(0, 0, 0, 0.85), 0 0 20px rgba(0, 229, 255, 0.15)",
                    border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.1)" : "1.5px solid rgba(0, 229, 255, 0.35)",
                    borderRadius: "18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                    maxHeight: "90vh",
                    overflowY: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.5rem" }}>📊</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900, color: "#fff", letterSpacing: "0.2px" }}>
                                {isFamiliar ? "Crear Encuesta" : "Crear Encuesta P2P"}
                            </h2>
                            <div style={{ fontSize: "0.72rem", color: isFamiliar ? "#00A884" : "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                {isFamiliar ? "VOTACIÓN EN EL CHAT" : "VOTACIÓN DESCENTRALIZADA"}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn-icon"
                        style={{ width: 32, height: 32, fontSize: "0.9rem", color: "#8696A0" }}
                    >
                        ✕
                    </button>
                </div>

                {/* Pregunta */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--accent-cyan)", letterSpacing: "0.5px" }}>
                        PREGUNTA / DECISIÓN TÁCTICA
                    </label>
                    <input
                        type="text"
                        placeholder="Ej: ¿Establecemos punto de reunión en Alfa o Bravo?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: "12px",
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid var(--glass-border)",
                            color: "#fff",
                            fontSize: "0.9rem",
                            outline: "none",
                            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)",
                        }}
                    />
                </div>

                {/* Opciones */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--text-secondary)", letterSpacing: "0.5px" }}>
                        OPCIONES DE VOTACIÓN ({options.length}/8)
                    </label>
                    {options.map((opt, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", width: "20px" }}>
                                {idx + 1}.
                            </span>
                            <input
                                type="text"
                                placeholder={`Opción ${idx + 1}`}
                                value={opt}
                                onChange={(e) => handleOptionChange(idx, e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    background: "rgba(255, 255, 255, 0.04)",
                                    border: "1px solid var(--glass-border)",
                                    color: "#fff",
                                    fontSize: "0.85rem",
                                    outline: "none",
                                }}
                            />
                            {options.length > 2 && (
                                <button
                                    onClick={() => handleRemoveOption(idx)}
                                    className="btn-icon"
                                    style={{ width: 28, height: 28, color: "var(--accent-crimson)", fontSize: "0.8rem" }}
                                    title="Eliminar opción"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}

                    {options.length < 8 && (
                        <button
                            onClick={handleAddOption}
                            className="btn-tactical-secondary"
                            style={{
                                padding: "8px 12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                fontSize: "0.78rem",
                                marginTop: "4px",
                            }}
                        >
                            <span>➕</span>
                            <span>Añadir otra opción</span>
                        </button>
                    )}
                </div>

                {/* Switch Selección Múltiple */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid var(--glass-border)",
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>
                            Permitir Selección Múltiple
                        </span>
                        <span style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>
                            Los miembros pueden votar más de una opción
                        </span>
                    </div>
                    <input
                        type="checkbox"
                        checked={allowMultiple}
                        onChange={(e) => setAllowMultiple(e.target.checked)}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--accent-cyan)" }}
                    />
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                    <button
                        onClick={onClose}
                        className="btn-tactical-secondary"
                        style={{ flex: 1, padding: "12px", borderRadius: "12px", fontSize: "0.85rem" }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        style={{
                            flex: 1,
                            padding: "12px",
                            borderRadius: "12px",
                            fontSize: "0.85rem",
                            fontWeight: 800,
                            background: isFamiliar ? "#00A884" : "linear-gradient(135deg, var(--accent-cyan) 0%, #0284C7 100%)",
                            color: isFamiliar ? "#FFFFFF" : "#000",
                            border: "none",
                            cursor: "pointer",
                            boxShadow: isFamiliar ? "0 2px 10px rgba(0, 168, 132, 0.4)" : "0 0 16px rgba(0, 229, 255, 0.4)",
                        }}
                    >
                        📊 Publicar Encuesta
                    </button>
                </div>
            </div>
        </div>
    );
};
