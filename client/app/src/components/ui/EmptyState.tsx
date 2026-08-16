import React from 'react';

export const EmptyState = ({ title, description, icon = "🛡️" }: { title: string; description: string; icon?: string }) => {
    return (
        <div className="empty-state-tactical" style={{ padding: "32px 16px", margin: "16px 0", textAlign: "center" }}>
            <div className="empty-state-icon" style={{ fontSize: "2rem", marginBottom: "12px", opacity: 0.7 }}>{icon}</div>
            <div className="empty-state-title" style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>{title}</div>
            <div className="empty-state-desc" style={{ fontSize: "0.9rem", color: "var(--text-secondary)", maxWidth: "80%", margin: "0 auto", lineHeight: 1.5 }}>
                {description}
            </div>
        </div>
    );
};
