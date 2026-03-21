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
    success: "#27ae60",
    error: "#e74c3c",
    warning: "#f39c12",
    info: "#3498db",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 3500);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div
            onClick={onDismiss}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "#1a2535",
                border: `1px solid ${COLORS[toast.type]}`,
                borderLeft: `4px solid ${COLORS[toast.type]}`,
                borderRadius: "12px",
                padding: "14px 16px",
                cursor: "pointer",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                animation: "slideInDown 0.3s ease",
                maxWidth: "320px",
                width: "100%",
            }}
        >
            <span style={{ fontSize: "1.2rem" }}>{ICONS[toast.type]}</span>
            <span style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 500, flex: 1 }}>
                {toast.message}
            </span>
        </div>
    );
}

let _showToast: ((message: string, type?: ToastType) => void) | null = null;

/** Global helper — call from anywhere: toast.success("Contacto añadido") */
export const toast = {
    success: (msg: string) => _showToast?.(msg, "success"),
    error: (msg: string) => _showToast?.(msg, "error"),
    warning: (msg: string) => _showToast?.(msg, "warning"),
    info: (msg: string) => _showToast?.(msg, "info"),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = "info") => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Register global helper
    useEffect(() => {
        _showToast = showToast;
        return () => { _showToast = null; };
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div style={{
                position: "fixed",
                top: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                alignItems: "center",
                pointerEvents: "none",
            }}>
                {toasts.map(t => (
                    <div key={t.id} style={{ pointerEvents: "all" }}>
                        <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
