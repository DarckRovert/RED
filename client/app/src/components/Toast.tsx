"use client";

import React, { useState, useCallback, useEffect, createContext, useContext } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
    return useContext(ToastContext);
}

const ICONS: Record<ToastType, string> = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
};

const COLORS: Record<ToastType, string> = {
    success: "var(--accent-emerald)",
    error: "var(--accent-crimson)",
    warning: "var(--accent-amber)",
    info: "var(--accent-cyan)",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 3500);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div
            onClick={onDismiss}
            className="animate-enter"
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(16, 18, 32, 0.96)",
                backdropFilter: "blur(20px)",
                border: `1px solid ${COLORS[toast.type]}`,
                borderLeft: `4px solid ${COLORS[toast.type]}`,
                borderRadius: "var(--radius-md)",
                padding: "12px 16px",
                cursor: "pointer",
                boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
                maxWidth: "340px",
                width: "100%",
            }}
        >
            <span style={{ fontSize: "1.1rem" }}>{ICONS[toast.type]}</span>
            <span style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 600, flex: 1 }}>
                {toast.message}
            </span>
        </div>
    );
}

let _showToast: ((message: string, type?: ToastType) => void) | null = null;

export const toast = {
    success: (msg: string) => _showToast?.(msg, "success"),
    error: (msg: string) => _showToast?.(msg, "error"),
    warning: (msg: string) => _showToast?.(msg, "warning"),
    info: (msg: string) => _showToast?.(msg, "info"),
};

export function ToastProvider({ children }: { children?: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = "info") => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        _showToast = showToast;
        return () => { _showToast = null; };
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div
                style={{
                    position: "fixed",
                    top: "calc(16px + var(--safe-top, 0px))",
                    right: "16px",
                    zIndex: 999999,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    pointerEvents: "none",
                }}
            >
                {toasts.map(t => (
                    <div key={t.id} style={{ pointerEvents: "auto" }}>
                        <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}