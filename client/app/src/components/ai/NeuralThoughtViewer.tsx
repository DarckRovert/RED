import React, { useState } from 'react';

export interface NeuralThoughtStep {
    phase: string;
    title: string;
    description: string;
    status: 'pending' | 'processing' | 'completed' | 'skipped';
    metrics?: Record<string, string | number>;
    details?: string[];
}

export interface NeuralTelemetryData {
    modelName: string;
    executionTimeMs: number;
    tokensPerSecond?: number;
    tokensGenerated?: number;
    memoryUsedMb?: number;
    cosineSimilarity?: number;
    matchedProtocol?: string;
    safetyScore?: number;
    isSafe?: boolean;
    intentCategory?: string;
    denseVectorPreview?: number[];
    cognitiveTrace?: string[];
    steps: NeuralThoughtStep[];
}

interface NeuralThoughtViewerProps {
    telemetry: NeuralTelemetryData | null;
    isGenerating: boolean;
}

export const NeuralThoughtViewer: React.FC<NeuralThoughtViewerProps> = ({ telemetry, isGenerating }) => {
    // Collapsed by default for clean, non-intrusive chat UX
    const [isExpanded, setIsExpanded] = useState(false);

    if (!telemetry && !isGenerating) return null;

    if (isGenerating) {
        return (
            <div style={{
                margin: '6px 0',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: '#38BDF8',
            }}>
                <span style={{ animation: 'pulse 1s infinite', fontSize: '12px' }}>🧠</span>
                <span style={{ fontWeight: 700 }}>Procesando tensores neuronales...</span>
            </div>
        );
    }

    return (
        <div style={{
            margin: '6px 0',
            borderRadius: '8px',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(0, 229, 255, 0.2)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            color: '#E2E8F0',
            fontSize: '11px',
            width: '100%',
            transition: 'all 0.2s ease',
        }}>
            {/* Header / Compact Capsule Bar */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: isExpanded ? 'rgba(15, 23, 42, 0.95)' : 'transparent',
                    borderBottom: isExpanded ? '1px solid rgba(0, 229, 255, 0.15)' : 'none',
                    cursor: 'pointer',
                    userSelect: 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px' }}>🧠</span>
                    <span style={{ fontWeight: 800, color: '#00E5FF', fontSize: '10.5px' }}>
                        Razonamiento IA
                    </span>
                    {telemetry?.modelName && (
                        <span style={{
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'rgba(0, 229, 255, 0.12)',
                            color: '#38BDF8',
                            fontSize: '9.5px',
                            fontWeight: 600,
                        }}>
                            {telemetry.modelName}
                        </span>
                    )}
                    {telemetry?.executionTimeMs !== undefined && (
                        <span style={{ color: '#94A3B8', fontSize: '9.5px' }}>
                            ⏱️ {telemetry.executionTimeMs} ms
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#00E5FF', fontSize: '10px', fontWeight: 700 }}>
                        {isExpanded ? '▲ Ocultar' : '▼ Ver Proceso'}
                    </span>
                </div>
            </div>

            {/* Collapsible Content */}
            {isExpanded && telemetry && (
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Telemetry Summary Badges */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: '6px',
                    }}>
                        <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '4px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ color: '#64748B', fontSize: '8.5px' }}>MEMORIA RAG</div>
                            <div style={{ color: (telemetry.cosineSimilarity || 0) > 0.35 ? '#4ADE80' : '#FACC15', fontWeight: 700, fontSize: '9.5px' }}>
                                {telemetry.cosineSimilarity !== undefined && telemetry.cosineSimilarity > 0 
                                    ? `${(telemetry.cosineSimilarity * 100).toFixed(1)}% Afinidad` 
                                    : 'Inferencia Directa'}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '4px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ color: '#64748B', fontSize: '8.5px' }}>PROTOCOLO</div>
                            <div style={{ color: '#38BDF8', fontWeight: 700, fontSize: '9.5px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {telemetry.matchedProtocol || 'Diálogo General'}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '4px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ color: '#64748B', fontSize: '8.5px' }}>VELOCIDAD</div>
                            <div style={{ color: '#4ADE80', fontWeight: 700, fontSize: '9.5px' }}>
                                {telemetry.tokensPerSecond ? `${telemetry.tokensPerSecond} tok/s` : 'Óptima'}
                            </div>
                        </div>
                    </div>

                    {/* Cognitive Trace Stream */}
                    {telemetry.cognitiveTrace && telemetry.cognitiveTrace.length > 0 && (
                        <div style={{
                            padding: '6px 8px',
                            background: 'rgba(0, 229, 255, 0.03)',
                            border: '1px solid rgba(0, 229, 255, 0.15)',
                            borderRadius: '5px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                        }}>
                            <div style={{ color: '#00E5FF', fontWeight: 800, fontSize: '9.5px', marginBottom: '2px' }}>
                                💭 TRAZA COGNITIVA:
                            </div>
                            {telemetry.cognitiveTrace.map((thought, tIdx) => (
                                <div key={tIdx} style={{
                                    color: '#CBD5E1',
                                    fontSize: '9.5px',
                                    lineHeight: 1.35,
                                    paddingLeft: '4px',
                                    borderLeft: '2px solid rgba(0, 229, 255, 0.3)',
                                }}>
                                    {thought}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
