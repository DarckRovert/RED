"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

/**
 * OnboardingProfile — shown ONCE after first successful login.
 * Lets the user set their display name and optional avatar.
 * Sets `profile_created` flag in Keystore so it only appears once.
 */
export default function OnboardingProfile({ onDone }: { onDone: () => void }) {
    const { identity } = useRedStore();
    const [displayName, setDisplayName] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim()) return;

        setSaving(true);
        try {
            // Send profile to Rust node
            await fetch("http://127.0.0.1:7333/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ display_name: displayName.trim() })
            });
        } catch (e) {
            // Profile endpoint might not exist yet — just proceed
            console.warn("Profile save failed (non-critical):", e);
        }

        // Mark profile as created in Keystore
        try {
            await SecureStoragePlugin.set({ key: "profile_created", value: "true" });
        } catch {}

        setSaving(false);
        onDone();
    };

    const handleSkip = async () => {
        try {
            await SecureStoragePlugin.set({ key: "profile_created", value: "true" });
        } catch {}
        onDone();
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100dvh', width: '100%',
            background: 'var(--bg-deep)', padding: '32px', boxSizing: 'border-box'
        }}>
            {/* Avatar placeholder */}
            <div style={{
                width: '100px', height: '100px', borderRadius: '50%',
                background: 'var(--bg-lifted)', border: '3px solid var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '3rem', marginBottom: '24px',
                boxShadow: '0 0 32px rgba(255,60,60,0.3)'
            }}>
                {displayName ? displayName[0].toUpperCase() : '?'}
            </div>

            <h1 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 800, margin: '0 0 8px 0' }}>
                Bienvenido a RED
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px', textAlign: 'center' }}>
                Tu identidad criptográfica fue creada.
            </p>
            {identity && (
                <p style={{
                    color: 'var(--text-secondary)', fontSize: '0.75rem',
                    fontFamily: 'monospace', background: 'var(--bg-lifted)',
                    padding: '6px 12px', borderRadius: '8px', marginBottom: '32px'
                }}>
                    ID: {identity.short_id}
                </p>
            )}

            <form onSubmit={handleSave} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                        NOMBRE DE PANTALLA
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
                            background: 'var(--bg-lifted)',
                            border: '2px solid var(--solid-border)',
                            color: 'var(--text-primary)', borderRadius: '12px',
                            fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={!displayName.trim() || saving}
                    style={{
                        padding: '16px', background: 'var(--primary)', color: 'white',
                        border: 'none', borderRadius: '12px', fontSize: '1rem',
                        fontWeight: 700, cursor: 'pointer',
                        opacity: !displayName.trim() || saving ? 0.5 : 1
                    }}
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
