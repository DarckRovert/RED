import React from 'react';

export const SkeletonCard = ({ count = 1 }: { count?: number }) => {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "16px 0" }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="card-tactical" style={{ padding: "16px", borderColor: "var(--glass-border)", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <div className="skeleton-pulse" style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--glass-border)" }}></div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                            <div className="skeleton-pulse" style={{ width: "60%", height: "14px", borderRadius: "4px", background: "var(--glass-border)" }}></div>
                            <div className="skeleton-pulse" style={{ width: "40%", height: "10px", borderRadius: "4px", background: "var(--glass-border)", opacity: 0.6 }}></div>
                        </div>
                    </div>
                    <div className="skeleton-pulse" style={{ width: "100%", height: "60px", borderRadius: "6px", background: "var(--glass-border)", opacity: 0.4, marginTop: "4px" }}></div>
                </div>
            ))}
            <style>{`
                @keyframes skeleton-pulse-anim {
                    0% { opacity: 0.3; }
                    50% { opacity: 0.6; }
                    100% { opacity: 0.3; }
                }
                .skeleton-pulse {
                    animation: skeleton-pulse-anim 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};
