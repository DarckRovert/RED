import React from 'react';

interface SkeletonCardProps {
    count?: number;
    variant?: 'card' | 'conversation' | 'contact';
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ count = 1, variant = 'card' }) => {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "8px 0" }}>
            {Array.from({ length: count }).map((_, i) => {
                if (variant === 'conversation' || variant === 'contact') {
                    return (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "14px",
                                padding: "12px 16px",
                                borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                                opacity: Math.max(0.35, 1 - i * 0.15)
                            }}
                        >
                            {/* Avatar shimmer */}
                            <div
                                className="skeleton-shimmer"
                                style={{
                                    width: "48px",
                                    height: "48px",
                                    borderRadius: "50%",
                                    flexShrink: 0
                                }}
                            />

                            {/* Content lines */}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div
                                        className="skeleton-shimmer"
                                        style={{ width: "45%", height: "14px", borderRadius: "4px" }}
                                    />
                                    {variant === 'conversation' && (
                                        <div
                                            className="skeleton-shimmer"
                                            style={{ width: "36px", height: "10px", borderRadius: "3px" }}
                                        />
                                    )}
                                </div>
                                <div
                                    className="skeleton-shimmer"
                                    style={{ width: variant === 'conversation' ? "75%" : "55%", height: "11px", borderRadius: "3px" }}
                                />
                            </div>
                        </div>
                    );
                }

                // Standard card variant
                return (
                    <div
                        key={i}
                        className="card-tactical"
                        style={{
                            padding: "16px",
                            borderColor: "var(--glass-border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            opacity: Math.max(0.35, 1 - i * 0.15)
                        }}
                    >
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                            <div
                                className="skeleton-shimmer"
                                style={{ width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0 }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                                <div
                                    className="skeleton-shimmer"
                                    style={{ width: "55%", height: "14px", borderRadius: "4px" }}
                                />
                                <div
                                    className="skeleton-shimmer"
                                    style={{ width: "35%", height: "10px", borderRadius: "4px" }}
                                />
                            </div>
                        </div>
                        <div
                            className="skeleton-shimmer"
                            style={{ width: "100%", height: "52px", borderRadius: "6px" }}
                        />
                    </div>
                );
            })}
        </div>
    );
};
