"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

/**
 * OnboardingProfile — Shown once after master PIN is created.
 * Sets the operator nickname and initializes tactical Keystore state.
 */
export default function OnboardingProfile({ onDone, onComplete }: { onDone?: () => void; onComplete?: () => void }) {
    const handleFinish = onComplete || onDone || (() => {});
    const { identity, fetchData } = useRedStore();
    const [displayName, setDisplayName] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = displayName.trim();
        if (!cleanName) {
            toast.warning("Ingresa tu alias táctico");
            return;
        }

        setSaving(true);
        try {
            await useRedStore.getState().setProfile(cleanName);
        } catch (e) {
            console.warn("Profile save failed:", e);
        }

        try {
            await fetchData();
        } catch {}

        try {
            if (typeof window !== "undefined") localStorage.setItem("profile_created", "true");
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
                await SecureStoragePlugin.set({ key: "profile_created", value: "true" }).catch(() => null);
            }
        } catch {}

        setSaving(false);
        toast.success(`Bienvenido a bordo, ${cleanName}`);
        handleFinish();
    };

    const handleSkip = async () => {
        try {
            if (typeof window !== "undefined") localStorage.setItem("profile_created", "true");
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
                await SecureStoragePlugin.set({ key: "profile_created", value: "true" }).catch(() => null);
            }
        } catch {}
        handleFinish();
    };

    const shortId = identity?.short_id || "NODE_01";

    return (
        <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: "100dvh", width: "100%", background: "var(--bg-void)", color: "var(--text-primary)",
            padding: "24px 20px", boxSizing: "border-box"
        }}>
            <div style={{ maxWidth: "380px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>

                {/* Avatar Táctico */}
                <div style={{
                    width: "80px", height: "80px", borderRadius: "50%",
                    background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "2.2rem", fontWeight: 900, color: "white",
                    boxShadow: "0 0 40px rgba(232,33,58,0.4)"
                }}>
                    {displayName ? displayName[0].toUpperCase() : "🔴"}
                </div>

                {/* Título & Identidad PoW */}
                <div style={{ textAlign: "center" }}>
                    <h1 style={{ fontSize: "1.4rem", fontWeight: 900, letterSpacing: "0.5px", margin: 0 }}>
                        BIENVENIDO A RED
                    </h1>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        IDENTIDAD CRIPTOGRÁFICA ED25519 GENERADA
                    </div>

                    <div style={{
                        marginTop: "12px", display: "inline-block",
                        fontFamily: "JetBrains Mono, monospace", fontSize: "0.74rem",
                        color: "var(--accent-emerald)", background: "rgba(0,230,118,0.1)",
                        padding: "6px 14px", borderRadius: "var(--radius-full)",
                        border: "1px solid rgba(0,230,118,0.3)"
                    }}>
                        NODO: {shortId}
                    </div>
                </div>

                {/* Formulario de Alias */}
                <form onSubmit={handleSave} className="card-tactical animate-enter" style={{ width: "100%", padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                            ALIAS TÁCTICO / NOMBRE DE GUERRA:
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder="Ej. Sombra, Halcón, Alfa-1"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={saving || !displayName.trim()}
                        className="btn-tactical-primary"
                        style={{ width: "100%", padding: "14px", fontSize: "0.95rem" }}
                    >
                        {saving ? "Registrando en Keystore..." : "⚡ ENTRAR A LA RED SOBERANA"}
                    </button>

                    <button
                        type="button"
                        onClick={handleSkip}
                        className="btn-ghost"
                        style={{ width: "100%", padding: "8px", fontSize: "0.76rem", color: "var(--text-muted)" }}
                    >
                        Omitir por ahora
                    </button>
                </form>
            </div>
        </div>
    );
}