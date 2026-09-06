'use client';

import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
    content: string | React.ReactNode;
    placement?: TooltipPlacement;
    delay?: number;      // ms before showing (default 400)
    children: React.ReactElement;
    maxWidth?: number;
    disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    placement = 'top',
    delay = 400,
    children,
    maxWidth = 220,
    disabled = false,
}) => {
    const [visible, setVisible] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number; arrowOffset?: number }>({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const id = useId();

    useEffect(() => {
        setMounted(true);
    }, []);

    const computePosition = useCallback(() => {
        const trigger = triggerRef.current;
        const tip = tooltipRef.current;
        if (!trigger || !tip) return;

        const tr = trigger.getBoundingClientRect();
        const tp = tip.getBoundingClientRect();
        const gap = 8;

        let top = 0;
        let left = 0;
        let arrowOffset: number | undefined;

        switch (placement) {
            case 'top': {
                top = tr.top - tp.height - gap;
                const rawLeft = tr.left + tr.width / 2 - tp.width / 2;
                left = Math.max(8, Math.min(rawLeft, window.innerWidth - tp.width - 8));
                const triggerCenterX = tr.left + tr.width / 2;
                arrowOffset = Math.max(12, Math.min(triggerCenterX - left, tp.width - 12));
                break;
            }
            case 'bottom': {
                top = tr.bottom + gap;
                const rawLeft = tr.left + tr.width / 2 - tp.width / 2;
                left = Math.max(8, Math.min(rawLeft, window.innerWidth - tp.width - 8));
                const triggerCenterX = tr.left + tr.width / 2;
                arrowOffset = Math.max(12, Math.min(triggerCenterX - left, tp.width - 12));
                break;
            }
            case 'left': {
                const rawTop = tr.top + tr.height / 2 - tp.height / 2;
                top = Math.max(8, Math.min(rawTop, window.innerHeight - tp.height - 8));
                left = tr.left - tp.width - gap;
                const triggerCenterY = tr.top + tr.height / 2;
                arrowOffset = Math.max(12, Math.min(triggerCenterY - top, tp.height - 12));
                break;
            }
            case 'right': {
                const rawTop = tr.top + tr.height / 2 - tp.height / 2;
                top = Math.max(8, Math.min(rawTop, window.innerHeight - tp.height - 8));
                left = tr.right + gap;
                const triggerCenterY = tr.top + tr.height / 2;
                arrowOffset = Math.max(12, Math.min(triggerCenterY - top, tp.height - 12));
                break;
            }
        }

        // Final boundary clamping
        left = Math.max(8, Math.min(left, window.innerWidth - tp.width - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - tp.height - 8));

        setCoords({ top, left, arrowOffset });
    }, [placement]);

    const show = useCallback(() => {
        if (disabled) return;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setVisible(true);
            requestAnimationFrame(computePosition);
        }, delay);
    }, [disabled, delay, computePosition]);

    const hide = useCallback(() => {
        clearTimeout(timerRef.current);
        setVisible(false);
    }, []);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    // Re-compute on visible
    useEffect(() => {
        if (visible) {
            requestAnimationFrame(computePosition);
        }
    }, [visible, computePosition]);

    // Track scroll / resize events to maintain anchor alignment
    useEffect(() => {
        if (!visible) return;
        const handleEvent = () => {
            computePosition();
        };
        window.addEventListener('scroll', handleEvent, { capture: true, passive: true });
        window.addEventListener('resize', handleEvent, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleEvent, { capture: true });
            window.removeEventListener('resize', handleEvent);
        };
    }, [visible, computePosition]);

    const ARROW_SIZE = 6;
    const arrowStyles: Record<TooltipPlacement, React.CSSProperties> = {
        top: {
            bottom: -ARROW_SIZE,
            left: coords.arrowOffset !== undefined ? coords.arrowOffset : '50%',
            transform: 'translateX(-50%)',
            borderTop: `${ARROW_SIZE}px solid rgba(0,229,255,0.7)`,
            borderLeft: `${ARROW_SIZE}px solid transparent`,
            borderRight: `${ARROW_SIZE}px solid transparent`,
        },
        bottom: {
            top: -ARROW_SIZE,
            left: coords.arrowOffset !== undefined ? coords.arrowOffset : '50%',
            transform: 'translateX(-50%)',
            borderBottom: `${ARROW_SIZE}px solid rgba(0,229,255,0.7)`,
            borderLeft: `${ARROW_SIZE}px solid transparent`,
            borderRight: `${ARROW_SIZE}px solid transparent`,
        },
        left: {
            right: -ARROW_SIZE,
            top: coords.arrowOffset !== undefined ? coords.arrowOffset : '50%',
            transform: 'translateY(-50%)',
            borderLeft: `${ARROW_SIZE}px solid rgba(0,229,255,0.7)`,
            borderTop: `${ARROW_SIZE}px solid transparent`,
            borderBottom: `${ARROW_SIZE}px solid transparent`,
        },
        right: {
            left: -ARROW_SIZE,
            top: coords.arrowOffset !== undefined ? coords.arrowOffset : '50%',
            transform: 'translateY(-50%)',
            borderRight: `${ARROW_SIZE}px solid rgba(0,229,255,0.7)`,
            borderTop: `${ARROW_SIZE}px solid transparent`,
            borderBottom: `${ARROW_SIZE}px solid transparent`,
        },
    };

    const childProps = children.props as any;
    const child = React.cloneElement(children, {
        ref: (el: HTMLElement | null) => {
            triggerRef.current = el;
            const originalRef = (children as any).ref;
            if (typeof originalRef === 'function') {
                originalRef(el);
            } else if (originalRef && typeof originalRef === 'object' && 'current' in originalRef) {
                (originalRef as React.MutableRefObject<HTMLElement | null>).current = el;
            }
        },
        onMouseEnter: (e: React.MouseEvent) => { show(); childProps?.onMouseEnter?.(e); },
        onMouseLeave: (e: React.MouseEvent) => { hide(); childProps?.onMouseLeave?.(e); },
        onFocus:      (e: React.FocusEvent) => { show(); childProps?.onFocus?.(e); },
        onBlur:       (e: React.FocusEvent) => { hide(); childProps?.onBlur?.(e); },
        'aria-describedby': visible ? id : undefined,
    } as any);

    return (
        <>
            {child}
            {visible && mounted && typeof document !== 'undefined' && createPortal(
                <div
                    id={id}
                    ref={tooltipRef}
                    role="tooltip"
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        zIndex: 99999,
                        maxWidth,
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: 'rgba(8,8,20,0.96)',
                        border: '1px solid rgba(0,229,255,0.35)',
                        color: 'rgba(255,255,255,0.92)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        fontFamily: 'Inter, sans-serif',
                        lineHeight: 1.5,
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 12px rgba(0,229,255,0.15)',
                        pointerEvents: 'none',
                        animation: 'red-fade-in 0.14s ease',
                        whiteSpace: typeof content === 'string' ? 'nowrap' : 'normal',
                    }}
                >
                    {content}
                    {/* Arrow */}
                    <div style={{
                        position: 'absolute',
                        width: 0, height: 0,
                        ...arrowStyles[placement],
                    }} />
                </div>,
                document.body
            )}
        </>
    );
};

export default Tooltip;
