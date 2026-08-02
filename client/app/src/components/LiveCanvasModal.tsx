'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';

export const LiveCanvasModal: React.FC = () => {
    const { navigate } = useRedStore();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#e8213a');

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#04060A';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.beginPath();
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        let clientX = 0;
        let clientY = 0;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#04060A';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: '#04060A',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* TOP BAR */}
            <div style={{
                height: '60px',
                padding: '0 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(15,23,42,0.9)'
            }}>
                <button
                    onClick={() => navigate('sidebar')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#e8213a',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        fontWeight: 700
                    }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    🎨 PIZARRA TÁCTICA DE DIBUJO P2P
                </div>
                <button
                    onClick={clearCanvas}
                    style={{
                        background: 'rgba(239,68,68,0.2)',
                        border: '1px solid #ef4444',
                        color: '#fca5a5',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                    }}
                >
                    Limpiar
                </button>
            </div>

            {/* COLOR SELECTOR */}
            <div style={{ padding: '10px', display: 'flex', justifyContent: 'center', gap: '12px', background: 'rgba(0,0,0,0.4)' }}>
                {['#e8213a', '#38bdf8', '#4ade80', '#f59e0b', '#c084fc', '#ffffff'].map((c) => (
                    <div
                        key={c}
                        onClick={() => setColor(c)}
                        style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: c,
                            border: color === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer'
                        }}
                    />
                ))}
            </div>

            {/* CANVAS WORKSPACE */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
                <canvas
                    ref={canvasRef}
                    width={360}
                    height={480}
                    onMouseDown={startDrawing}
                    onMouseUp={stopDrawing}
                    onMouseMove={draw}
                    onTouchStart={startDrawing}
                    onTouchEnd={stopDrawing}
                    onTouchMove={draw}
                    style={{
                        background: '#04060A',
                        border: '2px solid rgba(255,255,255,0.15)',
                        borderRadius: '16px',
                        cursor: 'crosshair',
                        touchAction: 'none'
                    }}
                />
            </div>
        </div>
    );
};
