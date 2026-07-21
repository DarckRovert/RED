"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

interface DMSConfig {
    enabled: boolean;
    trigger_hours: number;
    wipe_messages: boolean;
    wipe_identity: boolean;
    dead_message?: string;
}

/**
 * DMSSettings — Dead Man's Switch configuration panel.
 * Backed by /api/settings/dms endpoint registered in the Rust node.
 */
export default function DMSSettings() {
    const { goBack } = useRedStore();
    const [config, setConfig] = useState<DMSConfig>({
        enabled: false,
        trigger_hours: 72,
        wipe_messages: true,
        wipe_identity: false,
        dead_message: ""
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Load existing config from Rust node (real GET now supported)
    useEffect(() => {
        RedAPI.req('/settings/dms')
            .then((data: any) => {
                if (data && typeof data.enabled !== 'undefined') {
                    setConfig({
                        enabled: !!data.enabled,
                        trigger_hours: data.trigger_hours ?? 72,
                        wipe_messages: data.wipe_messages ?? true,
                        wipe_identity: !!data.wipe_identity,
                        dead_message: data.dead_message ?? '',
                    });
                }
            })
            .catch(() => {/* Node not ready yet — defaults are fine */});
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await RedAPI.req('/settings/dms', {
                method: 'POST',
                body: JSON.stringify(config)
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error("DMS save failed", e);
        } finally {
            setSaving(false);
        }
    };

    const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
        <button
            onClick={() => onChange(!value)}
            style={{
                width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: value ? 'var(--primary)' : 'var(--bg-lifted)',
                boxShadow: value ? '0 0 12px var(--primary-glow)' : 'none',
                transition: 'all 0.3s var(--ease-spring)', position: 'relative', flexShrink: 0
            }}
        >
            <div style={{
                width: 20, height: 20, borderRadius: 10, background: 'white',
                position: 'absolute', top: 4, left: value ? 28 : 4,
                transition: 'left 0.3s var(--ease-spring)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }} />
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)' }} className="scroll-container">

            <header className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--solid-border)', borderRadius: '0 0 24px 24px', flexShrink: 0 }}>
                <button onClick={goBack} style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', fontSize: '1.4rem', cursor: 'pointer', padding: '8px' }}>←</button>
                <div>
                    <h1 style={{ fontSize: '1.4rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '1px' }}>DEAD MAN'S SWITCH</h1>
                    <p style={{ color: 'var(--danger)', margin: 0, fontSize: '0.75rem', letterSpacing: '2px', fontWeight: 700 }}>PROTOCOLO DE EMERGENCIA</p>
                </div>
            </header>

            <div style={{ padding: '24px 20px calc(80px + var(--safe-bottom, 0px)) 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Enable DMS */}
                <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>Activar Protocolo</h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Autodestruir datos si no hay actividad</p>
                    </div>
                    <Toggle value={config.enabled} onChange={v => setConfig({ ...config, enabled: v })} />
                </div>

                {/* Trigger Hours */}
                <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', opacity: config.enabled ? 1 : 0.5, transition: 'opacity 0.3s', pointerEvents: config.enabled ? 'auto' : 'none' }}>
                    <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem' }}>VENTANA DE INACTIVIDAD</h3>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {[24, 48, 72, 168].map(h => (
                            <button
                                key={h}
                                onClick={() => setConfig({ ...config, trigger_hours: h })}
                                style={{
                                    padding: '10px 20px', borderRadius: '12px', cursor: 'pointer',
                                    border: `1px solid ${config.trigger_hours === h ? 'var(--primary)' : 'var(--solid-border)'}`,
                                    background: config.trigger_hours === h ? 'var(--primary-subtle)' : 'var(--bg-deep)',
                                    color: config.trigger_hours === h ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s'
                                }}
                            >
                                {h < 168 ? `${h}h` : '7 días'}
                            </button>
                        ))}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '12px', margin: '12px 0 0' }}>
                        Activación: si no se registra actividad en <strong style={{ color: 'var(--text-primary)' }}>{config.trigger_hours} horas</strong>
                    </p>
                </div>

                {/* Wipe Options */}
                <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', opacity: config.enabled ? 1 : 0.5, transition: 'opacity 0.3s', pointerEvents: config.enabled ? 'auto' : 'none', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', letterSpacing: '1px' }}>ALCANCE DE PURGA</h3>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--solid-border)' }}>
                        <div>
                            <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Borrar mensajes</p>
                            <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Eliminar todo el historial de chats</p>
                        </div>
                        <Toggle value={config.wipe_messages} onChange={v => setConfig({ ...config, wipe_messages: v })} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ margin: 0, color: 'var(--danger)', fontWeight: 700 }}>⚠ Borrar identidad</p>
                            <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Destruir clave privada Ed25519 — IRREVERSIBLE</p>
                        </div>
                        <Toggle value={config.wipe_identity} onChange={v => setConfig({ ...config, wipe_identity: v })} />
                    </div>
                </div>

                {/* Dead Message */}
                <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', opacity: config.enabled ? 1 : 0.5, transition: 'opacity 0.3s', pointerEvents: config.enabled ? 'auto' : 'none' }}>
                    <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', letterSpacing: '1px' }}>MENSAJE PÓSTUMO</h3>
                    <textarea
                        value={config.dead_message || ''}
                        onChange={e => setConfig({ ...config, dead_message: e.target.value })}
                        placeholder="Mensaje enviado a tus contactos antes de la purga (opcional)..."
                        maxLength={500}
                        style={{
                            width: '100%', boxSizing: 'border-box', minHeight: '100px',
                            background: 'var(--bg-deep)', border: '1px solid var(--solid-border)',
                            borderRadius: '12px', color: 'var(--text-primary)', padding: '14px 16px',
                            fontSize: '0.95rem', outline: 'none', resize: 'vertical',
                            fontFamily: 'Inter, sans-serif', lineHeight: 1.5
                        }}
                    />
                    <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'right' }}>{(config.dead_message || '').length}/500</p>
                </div>

                {/* Save */}
                <button
                    className="btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ borderRadius: '16px', fontSize: '1rem', letterSpacing: '1px' }}
                >
                    {saving ? 'GUARDANDO...' : saved ? '✓ PROTOCOLO GUARDADO' : 'GUARDAR CONFIGURACIÓN'}
                </button>

                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.6, marginTop: 0 }}>
                    🔒 La configuración se almacena cifrada en el nodo Rust local.<br/>
                    Nunca se transmite a servidores externos.
                </p>
            </div>
        </div>
    );
}
