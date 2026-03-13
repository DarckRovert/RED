"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";

const WALLPAPERS = [
    { id: "default", label: "Por defecto", value: "none" },
    { id: "matrix", label: "Matrix", value: "linear-gradient(160deg, #001a00 0%, #004d00 100%)" },
    { id: "nebula", label: "Nebulosa RED", value: "radial-gradient(ellipse at 30% 50%, rgba(255,23,68,0.15) 0%, transparent 70%), radial-gradient(ellipse at 70% 20%, rgba(100,0,200,0.1) 0%, transparent 60%), var(--background)" },
    { id: "ocean", label: "Océano profundo", value: "linear-gradient(160deg, #001a2e 0%, #003a6b 100%)" },
    { id: "midnight", label: "Medianoche", value: "linear-gradient(160deg, #0a0010 0%, #1a0035 100%)" },
    { id: "carbon", label: "Carbono", value: "repeating-linear-gradient(45deg, #111 0px, #111 2px, #0a0a0a 2px, #0a0a0a 8px)" },
];

export default function WallpaperPicker({ convId, onClose }: { convId: string; onClose: () => void }) {
    const [selected, setSelected] = useState("default");

    const apply = () => {
        if (typeof window !== "undefined") {
            localStorage.setItem(`red_wallpaper_${convId}`, WALLPAPERS.find(w => w.id === selected)?.value || "none");
            // Dispatch event so ChatWindow picks it up
            window.dispatchEvent(new CustomEvent("wallpaper-change", { detail: { convId, value: WALLPAPERS.find(w => w.id === selected)?.value } }));
        }
        onClose();
    };

    return (
        <div className="wallpaper-picker-overlay animate-fade">
            <div className="wallpaper-picker glass">
                <h3>🖼️ Fondo de pantalla</h3>
                <div className="wallpaper-grid">
                    {WALLPAPERS.map(w => (
                        <button
                            key={w.id}
                            className={`wallpaper-swatch ${selected === w.id ? "selected" : ""}`}
                            style={{ background: w.value === "none" ? "var(--surface)" : w.value }}
                            onClick={() => setSelected(w.id)}
                        >
                            <span className="wallpaper-label">{w.label}</span>
                        </button>
                    ))}
                </div>
                <div className="wallpaper-actions">
                    <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn-primary" onClick={apply}>Aplicar</button>
                </div>
            </div>
        </div>
    );
}

export { WALLPAPERS };
