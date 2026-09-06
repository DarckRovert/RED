'use client';

import React from 'react';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'purple' | 'amber';
type BadgeSize = 'xs' | 'sm' | 'md';

interface BadgeProps {
    children?: React.ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
    dot?: boolean;         // Show animated status dot before text
    pulse?: boolean;       // Glow pulse animation
    count?: number;        // Show numeric count (notification badge mode)
    maxCount?: number;     // Cap count display (default 99)
    style?: React.CSSProperties;
    onClick?: () => void;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; border: string; color: string; glow: string; dotColor: string }> = {
    success:  { bg: 'rgba(0,230,118,0.12)',   border: 'rgba(0,230,118,0.35)',   color: '#00E676', glow: 'rgba(0,230,118,0.3)',   dotColor: '#00E676' },
    danger:   { bg: 'rgba(232,33,58,0.12)',   border: 'rgba(232,33,58,0.35)',   color: '#FF3355', glow: 'rgba(232,33,58,0.3)',   dotColor: '#FF3355' },
    warning:  { bg: 'rgba(255,179,0,0.12)',   border: 'rgba(255,179,0,0.35)',   color: '#FFB300', glow: 'rgba(255,179,0,0.3)',   dotColor: '#FFB300' },
    info:     { bg: 'rgba(0,229,255,0.12)',   border: 'rgba(0,229,255,0.35)',   color: '#00E5FF', glow: 'rgba(0,229,255,0.3)',   dotColor: '#00E5FF' },
    neutral:  { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.7)', glow: 'transparent', dotColor: '#aaa' },
    purple:   { bg: 'rgba(179,136,255,0.12)', border: 'rgba(179,136,255,0.35)', color: '#B388FF', glow: 'rgba(179,136,255,0.3)', dotColor: '#B388FF' },
    amber:    { bg: 'rgba(255,179,0,0.1)',    border: 'rgba(255,179,0,0.3)',    color: '#FFB300', glow: 'rgba(255,179,0,0.25)',  dotColor: '#FFB300' },
};

const SIZE_STYLES: Record<BadgeSize, { fontSize: string; padding: string; borderRadius: string; dotSize: number }> = {
    xs: { fontSize: '0.60rem', padding: '1px 6px',  borderRadius: '4px', dotSize: 5 },
    sm: { fontSize: '0.68rem', padding: '2px 8px',  borderRadius: '6px', dotSize: 6 },
    md: { fontSize: '0.75rem', padding: '3px 10px', borderRadius: '8px', dotSize: 7 },
};

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'info',
    size = 'sm',
    dot = false,
    pulse = false,
    count,
    maxCount = 99,
    style,
    onClick,
}) => {
    const v = VARIANT_STYLES[variant];
    const s = SIZE_STYLES[size];

    // Numeric count mode (notification badge)
    if (count !== undefined) {
        const displayCount = count > maxCount ? `${maxCount}+` : String(count);
        if (count === 0) return null;
        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: size === 'xs' ? 16 : size === 'sm' ? 18 : 22,
                height: size === 'xs' ? 16 : size === 'sm' ? 18 : 22,
                borderRadius: '999px',
                background: v.bg.replace('0.12', '0.9').replace('0.06', '0.7'),
                border: `1px solid ${v.border}`,
                color: '#fff',
                fontSize: size === 'xs' ? '0.58rem' : '0.65rem',
                fontWeight: 800,
                lineHeight: 1,
                padding: '0 4px',
                boxShadow: pulse ? `0 0 10px ${v.glow}` : undefined,
                animation: pulse ? 'red-glow-pulse 2s ease-in-out infinite' : undefined,
                cursor: onClick ? 'pointer' : 'default',
                flexShrink: 0,
                ...style,
            }} onClick={onClick}>
                {displayCount}
            </span>
        );
    }

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: dot ? '5px' : undefined,
            background: v.bg,
            border: `1px solid ${v.border}`,
            color: v.color,
            fontSize: s.fontSize,
            fontWeight: 700,
            padding: s.padding,
            borderRadius: s.borderRadius,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.4px',
            boxShadow: pulse ? `0 0 12px ${v.glow}` : undefined,
            animation: pulse ? 'red-glow-pulse 2s ease-in-out infinite' : undefined,
            cursor: onClick ? 'pointer' : 'default',
            transition: onClick ? 'all 0.15s ease' : undefined,
            whiteSpace: 'nowrap',
            ...style,
        }} onClick={onClick}>
            {dot && (
                <span style={{
                    width: s.dotSize,
                    height: s.dotSize,
                    borderRadius: '50%',
                    background: v.dotColor,
                    flexShrink: 0,
                    animation: pulse ? `red-glow-pulse 1.5s ease-in-out infinite` : undefined,
                    boxShadow: pulse ? `0 0 6px ${v.dotColor}` : undefined,
                }} />
            )}
            {children}
        </span>
    );
};

export default Badge;
