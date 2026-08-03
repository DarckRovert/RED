"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";

/**
 * OnboardingProfile — shown ONCE after first successful login.
 * Lets the user set their display name and optional avatar.
 * Sets `profile_created` flag in Keystore so it only appears once.
 */
export default function OnboardingProfile({ onDone }: { onDone: () => void }) {
    const { identity, fetchData } = useRedStore();
    const [displayName, setDisplayName] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = displayName.trim();
        if (!cleanName) return;

        setSaving(true);
        try {
            await useRedStore.getState().setProfile(cleanName);
        } catch (e) {
            console.warn("Profile save failed:", e);
        }

        // Reload store data to update nickname header immediately
        try {
            await fetchData();
        } catch {}

        // Mark profile as created in Keystore & localStorage
        try {
            if (typeof window !== 'undefined') localStorage.setItem("profile_created", "true");
            const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
            await SecureStoragePlugin.set({ key: "profile_created", value: "true" });
        } catch {}

        setSaving(false);
        onDone();
    };

    const handleSkip = async () => {
        try {
            if (typeof window !== 'undefined') localStorage.setItem("profile_created", "true");
            const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
            await SecureStoragePlugin.set({ key: "profile_created", value: "true" });
        } catch {}
        onDone();
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100dvh', width: '100%',
            background: 'var(--bg-deep)', padding: '32px', boxSizing: 'border-box',
            backgroundImage: 'radial-gradient(circle at 50% -10%, var(--primary-subtle) 0%, transparent 60%)'
        }}>
            {/* Avatar */}
            <div className="pulsing-dot" style={{
                width: '100px', height: '100px', borderRadius: '50%',
                background: 'var(--primary)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '3rem', marginBottom: '28px',
                boxShadow: '0 0 48px var(--primary-glow)'
            }}>
                {displayName ? displayName[0].toUpperCase() : '🔴'}
            </div>

            <h1 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '2px' }}>
                BIENVENIDO A RED
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px', textAlign: 'center', letterSpacing: '1px' }}>
                IDENTIDAD CRIPTOGRÁFICA GENERADA
            </p>
            {identity && (
                <div style={{
                    color: 'var(--primary)', fontSize: '0.75rem',
                    fontFamily: 'monospace', background: 'var(--bg-lifted)',
                    padding: '8px 16px', borderRadius: '12px', marginBottom: '36px',
                    border: '1px solid var(--solid-border-active)', letterSpacing: '2px'
                }}>
                    ID: {identity.short_id}
                </div>
            )}

            <form onSubmit={handleSave} className="glass-panel" style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px', borderRadius: '24px' }}>
                <div>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '10px', letterSpacing: '2px' }}>
                        ALIAS TÁCTICO
                    </label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="¿Cómo te llamas?"
                        maxLength={32}
                        autoFocus
                        style={{
                            width: '100%', padding: '14px 16px',
                            background: 'var(--bg-deep)',
                            border: '1px solid var(--solid-border)',
                            color: 'var(--text-primary)', borderRadius: '12px',
                            fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={!displayName.trim() || saving}
                >
                    {saving ? "GUARDANDO..." : "ENTRAR A RED →"}
                </button>

                <button
                    type="button"
                    onClick={handleSkip}
                    style={{
                        padding: '12px', background: 'transparent', color: 'var(--text-muted)',
                        border: 'none', fontSize: '0.85rem', cursor: 'pointer'
                    }}
                >
                    Saltar por ahora
                </button>
            </form>
        </div>
    );
}
