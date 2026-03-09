"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";

const PRESET_LABELS = [
    { id: "work", emoji: "💼", name: "Trabajo", color: "#2196f3" },
    { id: "family", emoji: "👨‍👩‍👧", name: "Familia", color: "#4caf50" },
    { id: "friends", emoji: "🎉", name: "Amigos", color: "#ff9800" },
    { id: "important", emoji: "⭐", name: "Importante", color: "#ff5722" },
    { id: "node", emoji: "🔴", name: "Nodo RED", color: "#ff1744" },
    { id: "archive", emoji: "📦", name: "Archivado", color: "#9e9e9e" },
];

interface ChatLabelPickerProps {
    convId: string;
    currentLabels: string[];
    onChange: (labels: string[]) => void;
    onClose: () => void;
}

export function ChatLabelPicker({ convId, currentLabels, onChange, onClose }: ChatLabelPickerProps) {
    const [selected, setSelected] = useState<string[]>(currentLabels);

    const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

    return (
        <div className="label-picker-overlay animate-fade">
            <div className="label-picker glass">
                <h3>🏷️ Etiquetas</h3>
                <div className="label-grid">
                    {PRESET_LABELS.map(l => (
                        <button
                            key={l.id}
                            className={`label-chip ${selected.includes(l.id) ? "selected" : ""}`}
                            style={{ "--label-color": l.color } as React.CSSProperties}
                            onClick={() => toggle(l.id)}
                        >
                            {l.emoji} {l.name}
                            {selected.includes(l.id) && <span className="label-check">✓</span>}
                        </button>
                    ))}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                    <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn-primary" onClick={() => { onChange(selected); onClose(); }}>Aplicar</button>
                </div>
            </div>
        </div>
    );
}

export { PRESET_LABELS };

interface LabelBadgeProps { labelId: string; }
export function LabelBadge({ labelId }: LabelBadgeProps) {
    const label = PRESET_LABELS.find(l => l.id === labelId);
    if (!label) return null;
    return <span className="label-badge" style={{ background: label.color + "22", borderColor: label.color, color: label.color }}>{label.emoji}</span>;
}
