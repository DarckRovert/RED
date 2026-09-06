'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoadingSpinner } from './LoadingSpinner';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    loading?: boolean;
    icon?: string | React.ReactNode;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

const VARIANT_CONFIG = {
    danger:  { color: '#FF3355', bg: 'rgba(232,33,58,0.12)',  border: 'rgba(232,33,58,0.4)',  btnBg: 'linear-gradient(135deg,#E8213A,#c01830)', icon: '⚠️' },
    warning: { color: '#FFB300', bg: 'rgba(255,179,0,0.10)',  border: 'rgba(255,179,0,0.4)',  btnBg: 'linear-gradient(135deg,#FFB300,#e09800)', icon: '⚡' },
    info:    { color: '#00E5FF', bg: 'rgba(0,229,255,0.10)',  border: 'rgba(0,229,255,0.4)',  btnBg: 'linear-gradient(135deg,#00B4D8,#0077b6)', icon: 'ℹ️' },
    success: { color: '#00E676', bg: 'rgba(0,230,118,0.10)',  border: 'rgba(0,230,118,0.4)',  btnBg: 'linear-gradient(135deg,#00C853,#009624)', icon: '✅' },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'danger',
    loading = false,
    icon,
    onConfirm,
    onCancel,
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const cfg = VARIANT_CONFIG[variant];

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent background scrolling while modal is active
    useEffect(() => {
        if (!isOpen) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    // Trap focus inside dialog & close on Escape
    useEffect(() => {
        if (!isOpen) return;

        const dialog = dialogRef.current;
        if (dialog) {
            const focusable = dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length > 0) {
                // Focus confirm button by default
                focusable[focusable.length - 1]?.focus();
            }
        }

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
                return;
            }
            if (e.key === 'Tab' && dialog) {
                const focusable = dialog.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onCancel]);

    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !loading) onCancel();
    }, [onCancel, loading]);

    if (!isOpen || !mounted || typeof document === 'undefined') return null;

    const displayIcon = icon || cfg.icon;

    return createPortal(
        <div
            onClick={handleOverlayClick}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2,2,4,0.82)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99998,
                padding: '20px',
                animation: 'red-fade-in 0.18s ease',
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                style={{
                    background: 'linear-gradient(180deg, rgba(18,18,32,0.98) 0%, rgba(10,10,20,0.99) 100%)',
                    border: `1px solid ${cfg.border}`,
                    borderRadius: '20px',
                    padding: '28px 24px',
                    width: '100%',
                    maxWidth: '380px',
                    boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 40px ${cfg.bg}, inset 0 1px 0 rgba(255,255,255,0.07)`,
                    animation: 'red-slide-up 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Ambient top glow */}
                <div style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: '60%', height: '1px',
                    background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
                    opacity: 0.6,
                }} />

                {/* Icon */}
                <div style={{
                    width: 64, height: 64, borderRadius: '18px',
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.9rem',
                    boxShadow: `0 0 24px ${cfg.bg}`,
                }}>
                    {displayIcon}
                </div>

                {/* Title */}
                <div
                    id="confirm-dialog-title"
                    style={{
                        fontSize: '1.05rem', fontWeight: 900, color: '#FFFFFF',
                        letterSpacing: '0.3px', lineHeight: 1.3,
                    }}
                >
                    {title}
                </div>

                {/* Message */}
                <div style={{
                    fontSize: '0.85rem', color: 'rgba(255,255,255,0.68)',
                    lineHeight: 1.6, maxWidth: '320px',
                }}>
                    {message}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '4px' }}>
                    {/* Cancel */}
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '11px 16px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            color: 'rgba(255,255,255,0.75)',
                            fontSize: '0.88rem', fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            opacity: loading ? 0.5 : 1,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    >
                        {cancelLabel}
                    </button>

                    {/* Confirm */}
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        style={{
                            flex: 1,
                            padding: '11px 16px',
                            borderRadius: '12px',
                            background: cfg.btnBg,
                            border: `1px solid ${cfg.border}`,
                            color: '#FFFFFF',
                            fontSize: '0.88rem', fontWeight: 800,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            transition: 'all 0.15s ease',
                            boxShadow: `0 4px 16px ${cfg.bg}`,
                            opacity: loading ? 0.8 : 1,
                        }}
                        onMouseEnter={e => { if (!loading) e.currentTarget.style.filter = 'brightness(1.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                    >
                        {loading ? <LoadingSpinner size="xs" color="#fff" /> : null}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmDialog;
