import React from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: string | React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    variant?: 'tactical' | 'familiar' | 'minimal';
    children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon = "🛡️",
    actionLabel,
    onAction,
    variant = 'tactical',
    children
}) => {
    const isFamiliar = variant === 'familiar';

    return (
        <div
            className={`empty-state-tactical animate-fade-scale ${isFamiliar ? 'empty-state-familiar' : ''}`}
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
                margin: "12px 0",
                textAlign: "center",
                borderRadius: isFamiliar ? "16px" : "var(--radius-lg, 16px)",
                background: isFamiliar
                    ? "rgba(32, 44, 51, 0.4)"
                    : "linear-gradient(180deg, rgba(18, 18, 32, 0.7) 0%, rgba(10, 10, 20, 0.9) 100%)",
                border: isFamiliar
                    ? "1px solid rgba(255, 255, 255, 0.06)"
                    : "1px solid rgba(0, 229, 255, 0.15)",
                boxShadow: isFamiliar
                    ? "none"
                    : "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
                backdropFilter: "blur(12px)",
                position: "relative",
                overflow: "hidden"
            }}
        >
            {/* Ambient Background Aura */}
            {!isFamiliar && (
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        top: "10%",
                        width: "120px",
                        height: "120px",
                        background: "radial-gradient(circle, rgba(0, 229, 255, 0.12) 0%, transparent 70%)",
                        filter: "blur(20px)",
                        pointerEvents: "none"
                    }}
                />
            )}

            {/* Icon Container with Glow Ring */}
            <div
                style={{
                    position: "relative",
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                    background: isFamiliar
                        ? "rgba(0, 168, 132, 0.1)"
                        : "radial-gradient(circle at center, rgba(0, 229, 255, 0.15) 0%, rgba(14, 14, 26, 0.6) 100%)",
                    border: isFamiliar
                        ? "1px solid rgba(0, 168, 132, 0.25)"
                        : "1px solid rgba(0, 229, 255, 0.3)",
                    boxShadow: isFamiliar
                        ? "none"
                        : "0 0 20px rgba(0, 229, 255, 0.2)",
                    fontSize: "2rem"
                }}
            >
                <div style={{ transform: "scale(1)", transition: "transform 0.2s ease" }}>
                    {icon}
                </div>
            </div>

            {/* Title */}
            <div
                className="empty-state-title"
                style={{
                    fontSize: "1.05rem",
                    fontWeight: 800,
                    color: isFamiliar ? "#E9EDEF" : "#FFFFFF",
                    marginBottom: "8px",
                    letterSpacing: isFamiliar ? "normal" : "0.5px"
                }}
            >
                {title}
            </div>

            {/* Description */}
            <div
                className="empty-state-desc"
                style={{
                    fontSize: "0.85rem",
                    color: isFamiliar ? "#8696A0" : "var(--text-secondary, rgba(255, 255, 255, 0.65))",
                    maxWidth: "85%",
                    margin: "0 auto 16px auto",
                    lineHeight: 1.55
                }}
            >
                {description}
            </div>

            {/* Optional Action Button */}
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    style={{
                        marginTop: "8px",
                        padding: isFamiliar ? "8px 18px" : "9px 20px",
                        borderRadius: isFamiliar ? "24px" : "8px",
                        background: isFamiliar ? "#00A884" : "var(--accent-cyan, #00E5FF)",
                        color: isFamiliar ? "#FFFFFF" : "#06060c",
                        border: "none",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: isFamiliar
                            ? "0 2px 8px rgba(0, 168, 132, 0.3)"
                            : "0 0 16px rgba(0, 229, 255, 0.35)",
                        transition: "all 0.18s ease"
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.filter = "brightness(1.1)";
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.filter = "none";
                    }}
                >
                    {actionLabel}
                </button>
            )}

            {children}
        </div>
    );
};
