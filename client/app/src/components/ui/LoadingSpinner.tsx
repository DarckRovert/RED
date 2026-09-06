'use client';

import React from 'react';

interface LoadingSpinnerProps {
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'tactical' | 'familiar' | 'pulse';
    label?: string;
    color?: string;
    fullscreen?: boolean;
}

const SIZE_MAP = {
    xs: 16,
    sm: 24,
    md: 36,
    lg: 56,
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    variant = 'tactical',
    label,
    color,
    fullscreen = false,
}) => {
    const px = SIZE_MAP[size];
    const strokeW = size === 'xs' ? 2 : size === 'sm' ? 2.5 : 3;
    const r = (px - strokeW * 2) / 2;
    const circ = 2 * Math.PI * r;

    const primaryColor = color || (variant === 'familiar' ? '#00A884' : 'var(--accent-cyan, #00E5FF)');
    const trackColor = variant === 'familiar' ? 'rgba(255,255,255,0.08)' : 'rgba(0,229,255,0.1)';

    const spinnerEl = (
        <div style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: label ? '10px' : undefined,
        }}>
            {variant === 'pulse' ? (
                /* Pulse dots variant */
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            style={{
                                width: px / 3,
                                height: px / 3,
                                borderRadius: '50%',
                                background: primaryColor,
                                animation: `red-pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                                boxShadow: `0 0 ${px / 4}px ${primaryColor}`,
                            }}
                        />
                    ))}
                </div>
            ) : (
                /* SVG ring spinner */
                <svg
                    width={px}
                    height={px}
                    viewBox={`0 0 ${px} ${px}`}
                    style={{ animation: 'red-spin 0.85s linear infinite', display: 'block' }}
                    aria-label={label || 'Cargando…'}
                    role="img"
                >
                    {/* Track */}
                    <circle
                        cx={px / 2}
                        cy={px / 2}
                        r={r}
                        fill="none"
                        stroke={trackColor}
                        strokeWidth={strokeW}
                    />
                    {/* Active arc */}
                    <circle
                        cx={px / 2}
                        cy={px / 2}
                        r={r}
                        fill="none"
                        stroke={primaryColor}
                        strokeWidth={strokeW}
                        strokeLinecap="round"
                        strokeDasharray={`${circ * 0.72} ${circ * 0.28}`}
                        style={{
                            filter: variant === 'tactical'
                                ? `drop-shadow(0 0 ${strokeW * 2}px ${primaryColor})`
                                : undefined,
                        }}
                    />
                </svg>
            )}

            {label && (
                <span style={{
                    fontSize: size === 'lg' ? '0.82rem' : '0.72rem',
                    color: 'var(--text-muted)',
                    fontFamily: variant === 'tactical' ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
                    fontWeight: 600,
                    letterSpacing: variant === 'tactical' ? '0.8px' : 'normal',
                    textTransform: variant === 'tactical' ? 'uppercase' : 'none',
                }}>
                    {label}
                </span>
            )}
        </div>
    );

    if (fullscreen) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(2, 2, 4, 0.88)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                animation: 'red-fade-in 0.2s ease',
            }}>
                {spinnerEl}
            </div>
        );
    }

    return spinnerEl;
};

export default LoadingSpinner;
