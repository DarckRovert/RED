"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRedStore } from "../../store/useRedStore";

/* ── 8 gradient backgrounds for text stories ────────────────────────── */
export const STORY_THEMES = [
    { label: 'Rojo', from: '#E8213A', to: '#8B0000' },
    { label: 'Atardecer', from: '#FF6B35', to: '#E8213A' },
    { label: 'Océano', from: '#0288D1', to: '#005B7F' },
    { label: 'Bosque', from: '#00897B', to: '#00695C' },
    { label: 'Púrpura', from: '#7E57C2', to: '#4527A0' },
    { label: 'Noche', from: '#1a1a2e', to: '#0f0f1a' },
    { label: 'Aurora', from: '#EC407A', to: '#7B1FA2' },
    { label: 'Dorado', from: '#FFA726', to: '#E65100' },
];

interface StoryCreatorProps {
    onClose: () => void;
}

export default function StoryCreator({ onClose }: StoryCreatorProps) {
    const { contacts, publishStatus } = useRedStore();

    const [mode, setMode] = useState<'text' | 'photo'>('text');
    const [text, setText] = useState('');
    const [theme, setTheme] = useState(0);
    const [photoData, setPhotoData] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [sentCount, setSentCount] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const selectedTheme = STORY_THEMES[theme];

    /* ── Capture photo ──────────────────────────────────────────────── */
    const handlePickPhoto = useCallback(async () => {
        try {
            const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
            const photo = await Camera.getPhoto({
                quality: 70,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Prompt,
                width: 720,
                height: 1280,
                correctOrientation: true,
            });
            if (photo.base64String) {
                setPhotoData(photo.base64String);
                setMode('photo');
            }
        } catch {
            // Fallback: file input for web
            fileInputRef.current?.click();
        }
    }, []);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            // Strip the data URL prefix to get raw base64
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            setPhotoData(base64);
            setMode('photo');
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, []);

    /* ── Publish ────────────────────────────────────────────────────── */
    const handlePublish = useCallback(async () => {
        if (mode === 'text' && !text.trim()) return;
        if (mode === 'photo' && !photoData) return;
        if (isSending) return;

        setIsSending(true);
        try {
            await publishStatus(
                mode === 'text' ? text.trim() : (text.trim() || '📷 Estado con foto'),
                mode === 'photo' ? photoData : null,
                mode === 'text' ? theme : undefined,
            );
            setSentCount(contacts.length);
            setTimeout(() => { setSentCount(null); onClose(); }, 1500);
        } catch (e) {
            console.error('[RED StoryCreator] publish failed', e);
            setIsSending(false);
        }
    }, [mode, text, photoData, theme, isSending, contacts.length, publishStatus, onClose]);

    /* ── Success feedback ───────────────────────────────────────────── */
    if (sentCount !== null) {
        return (
            <div style={{
                position: 'absolute', inset: 0, zIndex: 200,
                background: 'var(--bg-deep)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 16,
            }}>
                <div style={{ fontSize: '3rem' }}>✅</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    Estado enviado a {sentCount} contacto{sentCount !== 1 ? 's' : ''}
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 200,
            background: 'var(--bg-deep)', color: 'white',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Hidden file input for web fallback */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileInput}
            />

            {/* Header */}
            <div style={{
                padding: '16px 16px 12px',
                display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                <button onClick={onClose} style={{
                    background: 'transparent', color: 'var(--text-secondary)',
                    border: 'none', fontSize: '1.4rem', cursor: 'pointer', padding: 6,
                }}>✕</button>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', flex: 1 }}>Nuevo Estado</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {contacts.length} contacto{contacts.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
                {(['text', 'photo'] as const).map(m => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        style={{
                            padding: '7px 18px', borderRadius: 20, fontSize: '0.82rem',
                            fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: mode === m ? 'var(--primary)' : 'var(--bg-lifted)',
                            color: mode === m ? 'white' : 'var(--text-muted)',
                            transition: 'all 0.2s',
                        }}
                    >
                        {m === 'text' ? '✏️ Texto' : '📷 Foto'}
                    </button>
                ))}
            </div>

            {/* Preview / Canvas */}
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px 16px',
                background: mode === 'text'
                    ? `linear-gradient(145deg, ${selectedTheme.from}, ${selectedTheme.to})`
                    : undefined,
                position: 'relative', overflow: 'hidden',
            }}>
                {mode === 'text' ? (
                    <textarea
                        autoFocus
                        value={text}
                        onChange={e => setText(e.target.value)}
                        maxLength={220}
                        placeholder="Escribe algo…"
                        style={{
                            width: '100%', background: 'transparent', border: 'none',
                            color: 'white', fontSize: '1.9rem', fontWeight: 700,
                            textAlign: 'center', outline: 'none', resize: 'none',
                            lineHeight: 1.4, fontFamily: 'Inter, sans-serif',
                            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                            minHeight: 140,
                        }}
                    />
                ) : photoData ? (
                    <div style={{ position: 'relative', width: '100%', height: '100%', maxHeight: 480 }}>
                        <img
                            src={`data:image/jpeg;base64,${photoData}`}
                            alt="preview"
                            style={{
                                width: '100%', height: '100%',
                                objectFit: 'contain', borderRadius: 16,
                            }}
                        />
                        <button
                            onClick={() => setPhotoData(null)}
                            style={{
                                position: 'absolute', top: 8, right: 8,
                                background: 'rgba(0,0,0,0.7)', color: 'white',
                                border: 'none', borderRadius: '50%', width: 32, height: 32,
                                fontSize: '1rem', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >✕</button>
                    </div>
                ) : (
                    <button
                        onClick={handlePickPhoto}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            gap: 12, background: 'var(--bg-lifted)',
                            border: '2px dashed var(--solid-border)', borderRadius: 24,
                            padding: '36px 40px', cursor: 'pointer', color: 'var(--text-muted)',
                        }}
                    >
                        <span style={{ fontSize: '2.8rem' }}>📷</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Toca para elegir foto</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-disabled)' }}>Cámara o galería</span>
                    </button>
                )}
            </div>

            {/* Theme selector (text mode only) */}
            {mode === 'text' && (
                <div style={{
                    padding: '10px 16px', display: 'flex', gap: 8, overflowX: 'auto',
                    scrollbarWidth: 'none',
                }}>
                    {STORY_THEMES.map((t, i) => (
                        <button
                            key={i}
                            onClick={() => setTheme(i)}
                            style={{
                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                                border: theme === i ? '3px solid white' : '2px solid transparent',
                                cursor: 'pointer', transition: 'border 0.15s',
                                boxShadow: theme === i ? `0 0 12px ${t.from}80` : 'none',
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Char counter (text mode) */}
            {mode === 'text' && (
                <div style={{ padding: '0 16px 6px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-disabled)' }}>
                    {text.length}/220
                </div>
            )}

            {/* Publish button */}
            <div style={{ padding: '12px 24px 32px', display: 'flex', justifyContent: 'center' }}>
                <button
                    onClick={handlePublish}
                    disabled={
                        isSending ||
                        (mode === 'text' && !text.trim()) ||
                        (mode === 'photo' && !photoData)
                    }
                    style={{
                        width: 68, height: 68, borderRadius: '50%',
                        background: 'var(--primary)', color: 'white',
                        fontSize: '1.6rem', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        border: 'none',
                        boxShadow: '0 8px 32px var(--primary-glow)',
                        cursor: 'pointer',
                        opacity: (isSending || (mode === 'text' && !text.trim()) || (mode === 'photo' && !photoData)) ? 0.4 : 1,
                        transition: 'all 0.25s',
                    }}
                >
                    {isSending ? '⏳' : '➤'}
                </button>
            </div>
        </div>
    );
}
