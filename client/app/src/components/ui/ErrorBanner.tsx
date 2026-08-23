import React from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';

export const ErrorBanner = ({ message, onRetry }: { message: string; onRetry?: () => void }) => {
    const { t } = useTranslation();
    return (
        <div className="card-tactical animate-enter" style={{ padding: "16px", borderColor: "var(--accent-red)", background: "rgba(232, 33, 58, 0.05)", display: "flex", flexDirection: "column", gap: "12px", margin: "16px 0" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ fontSize: "1.5rem", color: "var(--accent-red)" }}>⚠️</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                        {t.common?.error || "Fallo de Subsistema"}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{message}</div>
                </div>
            </div>
            {onRetry && (
                <button className="btn-tactical" onClick={onRetry} style={{ alignSelf: "flex-end", padding: "6px 16px", fontSize: "0.8rem", border: "1px solid var(--accent-red)", color: "var(--accent-red)" }}>
                    {t.common?.confirm || "REINTENTAR"}
                </button>
            )}
        </div>
    );
};
