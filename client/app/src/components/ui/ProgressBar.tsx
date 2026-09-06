'use client';

import React from 'react';

type ProgressVariant = 'tactical' | 'familiar' | 'minimal';

interface ProgressBarProps {
    value: number;           // 0–100
    max?: number;
    label?: string;
    sublabel?: string;       // Secondary text (e.g. "3 de 10 nodos")
    variant?: ProgressVariant;
    color?: 'emerald' | 'crimson' | 'cyan' | 'amber' | 'purple' | string;
    showValue?: boolean;     // Show percentage text
    animated?: boolean;      // Animate the fill bar
    striped?: boolean;       // CSS stripes (for "in progress" states)
    size?: 'xs' | 'sm' | 'md' | 'lg';
    style?: React.CSSProperties;
}

const COLOR_MAP: Record<string, { fill: string; glow: string; label: string }> = {
    emerald: { fill: 'linear-gradient(90deg,#00C853,#00E676)', glow: 'rgba(0,230,118,0.4)', label: '#00E676' },
    crimson: { fill: 'linear-gradient(90deg,#c01830,#FF3355)', glow: 'rgba(232,33,58,0.4)',  label: '#FF3355' },
    cyan:    { fill: 'linear-gradient(90deg,#0077b6,#00E5FF)', glow: 'rgba(0,229,255,0.4)',  label: '#00E5FF' },
    amber:   { fill: 'linear-gradient(90deg,#e09800,#FFB300)', glow: 'rgba(255,179,0,0.4)',  label: '#FFB300' },
    purple:  { fill: 'linear-gradient(90deg,#5E35B1,#B388FF)', glow: 'rgba(179,136,255,0.4)',label: '#B388FF' },
};

const HEIGHT_MAP = { xs: 3, sm: 5, md: 8, lg: 12 };

const getColor = (color: string) => COLOR_MAP[color] || {
    fill: color,
    glow: color.startsWith('#') ? `${color}66` : color,
    label: color,
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
    value,
    max = 100,
    label,
    sublabel,
    variant = 'tactical',
    color = 'cyan',
    showValue = false,
    animated = false,
    striped = false,
    size = 'sm',
    style,
}) => {
    const clampedPct = Math.max(0, Math.min(100, (value / max) * 100));
    const colorStyle = getColor(color);
    const trackH = HEIGHT_MAP[size];
    const isFamiliar = variant === 'familiar';

    const fillStyle: React.CSSProperties = {
        width: `${clampedPct}%`,
        height: '100%',
        background: colorStyle.fill,
        borderRadius: 'inherit',
        transition: animated ? 'width 0.6s cubic-bezier(0.25,0.46,0.45,0.94)' : undefined,
        boxShadow: variant === 'tactical' ? `0 0 8px ${colorStyle.glow}` : undefined,
        position: 'relative',
        overflow: 'hidden',
    };

    if (striped) {
        (fillStyle as any).backgroundImage = `${colorStyle.fill}, repeating-linear-gradient(
            -45deg,
            rgba(255,255,255,0.1) 0px,
            rgba(255,255,255,0.1) 6px,
            transparent 6px,
            transparent 12px
        )`;
        (fillStyle as any).backgroundBlendMode = 'overlay';
        (fillStyle as any).animation = 'red-stripe-move 1s linear infinite';
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
            {(label || showValue) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {label && (
                        <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: isFamiliar ? '#8696A0' : 'var(--text-muted)',
                            fontFamily: variant === 'tactical' ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
                            textTransform: variant === 'tactical' ? 'uppercase' : 'none',
                            letterSpacing: variant === 'tactical' ? '0.5px' : 'normal',
                        }}>
                            {label}
                        </span>
                    )}
                    {showValue && (
                        <span style={{
                            fontSize: '0.70rem',
                            fontWeight: 800,
                            color: colorStyle.label,
                            fontFamily: 'JetBrains Mono, monospace',
                        }}>
                            {Math.round(clampedPct)}%
                        </span>
                    )}
                </div>
            )}

            {/* Track */}
            <div style={{
                width: '100%',
                height: trackH,
                borderRadius: trackH / 2,
                background: isFamiliar ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
                border: variant === 'tactical' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                overflow: 'hidden',
                position: 'relative',
            }}>
                <div style={fillStyle} />
            </div>

            {sublabel && (
                <span style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'JetBrains Mono, monospace',
                }}>
                    {sublabel}
                </span>
            )}
        </div>
    );
};

export default ProgressBar;
