import React from 'react';

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
    steps: NeuralThoughtStep[];
}

interface NeuralThoughtViewerProps {
    telemetry: NeuralTelemetryData | null;
    isGenerating: boolean;
}

export const NeuralThoughtViewer: React.FC<NeuralThoughtViewerProps> = ({ telemetry, isGenerating }) => {
    const [isExpanded, setIsExpanded] = React.useState(true);

    if (!telemetry && !isGenerating) return null;

    return (
        <div style={{
            margin: '12px 0',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(10, 15, 30, 0.98))',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 16px rgba(56, 189, 248, 0.05)',
            overflow: 'hidden',
            fontFamily: 'monospace',
            color: '#E2E8F0',
            fontSize: '12px'
        }}>
            {/* Header / Toggle Bar */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'rgba(30, 41, 59, 0.7)',
                    borderBottom: isExpanded ? '1px solid rgba(56, 189, 248, 0.2)' : 'none',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🧠</span>
                    <span style={{ fontWeight: 'bold', color: '#38BDF8', letterSpacing: '0.5px' }}>
                        PENSAMIENTO INTERNO NEURONAL (CHAIN-OF-THOUGHT)
                    </span>
                    {isGenerating && (
                        <span style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(234, 179, 8, 0.2)',
                            color: '#FACC15',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            animation: 'pulse 1.5s infinite'
                        }}>
                            ⚡ PROCESANDO TENSORES...
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {telemetry?.executionTimeMs !== undefined && (
                        <span style={{ color: '#94A3B8', fontSize: '11px' }}>
                            ⏱️ {telemetry.executionTimeMs} ms
                        </span>
                    )}
                    <span style={{ color: '#38BDF8', fontSize: '12px' }}>
                        {isExpanded ? '▲ Ocultar' : '▼ Inspeccionar'}
                    </span>
                </div>
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <div style={{ padding: '12px 14px' }}>
                    {/* Top Telemetry Pills */}
                    {telemetry && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: '8px',
                            marginBottom: '12px'
                        }}>
                            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ color: '#64748B', fontSize: '10px' }}>MODELO LOCAL</div>
                                <div style={{ color: '#38BDF8', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                    {telemetry.modelName || 'multilingual-e5-small'}
                                </div>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ color: '#64748B', fontSize: '10px' }}>SIMILITUD COSENO</div>
                                <div style={{ color: (telemetry.cosineSimilarity || 0) > 0.4 ? '#4ADE80' : '#FACC15', fontWeight: 'bold' }}>
                                    {telemetry.cosineSimilarity !== undefined ? `${(telemetry.cosineSimilarity * 100).toFixed(1)}%` : 'Directo'}
                                </div>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ color: '#64748B', fontSize: '10px' }}>GUARDIAN SAFETY</div>
                                <div style={{ color: telemetry.isSafe !== false ? '#4ADE80' : '#EF4444', fontWeight: 'bold' }}>
                                    {telemetry.safetyScore !== undefined ? `${((1 - telemetry.safetyScore) * 100).toFixed(1)}% Seguro` : '100% Aprobado'}
                                </div>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ color: '#64748B', fontSize: '10px' }}>INTENCIÓN TÁCTICA</div>
                                <div style={{ color: '#C084FC', fontWeight: 'bold', textTransform: 'capitalize' }}>
                                    {telemetry.intentCategory || 'Conversación'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step-by-Step Chain of Thought */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {telemetry?.steps && telemetry.steps.length > 0 ? (
                            telemetry.steps.map((step, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    gap: '10px',
                                    alignItems: 'flex-start',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    background: 'rgba(30, 41, 59, 0.4)',
                                    borderLeft: `3px solid ${
                                        step.status === 'completed' ? '#4ADE80' :
                                        step.status === 'processing' ? '#FACC15' :
                                        step.status === 'skipped' ? '#64748B' : '#38BDF8'
                                    }`
                                }}>
                                    <span style={{ fontSize: '14px', lineHeight: '1' }}>
                                        {step.status === 'completed' ? '✅' :
                                         step.status === 'processing' ? '⚙️' :
                                         step.status === 'skipped' ? '⏭️' : '🔹'}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', color: '#F1F5F9' }}>
                                                {step.title}
                                            </span>
                                            <span style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase' }}>
                                                {step.phase}
                                            </span>
                                        </div>
                                        <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '2px' }}>
                                            {step.description}
                                        </div>

                                        {/* Step Metrics */}
                                        {step.metrics && Object.keys(step.metrics).length > 0 && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                                                {Object.entries(step.metrics).map(([k, v]) => (
                                                    <span key={k} style={{
                                                        fontSize: '10px',
                                                        padding: '1px 5px',
                                                        borderRadius: '3px',
                                                        background: 'rgba(56, 189, 248, 0.1)',
                                                        color: '#38BDF8',
                                                        border: '1px solid rgba(56, 189, 248, 0.2)'
                                                    }}>
                                                        {k}: <strong>{v}</strong>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Step Detail Lines */}
                                        {step.details && step.details.length > 0 && (
                                            <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '1px dashed rgba(255,255,255,0.1)' }}>
                                                {step.details.map((detail, dIdx) => (
                                                    <div key={dIdx} style={{ color: '#CBD5E1', fontSize: '10px' }}>
                                                        • {detail}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : isGenerating ? (
                            <div style={{ textAlign: 'center', padding: '16px', color: '#94A3B8' }}>
                                <div>⚙️ Inicializando grafos de inferencia WebAssembly...</div>
                                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                                    Calculando vectores densos de 384 dimensiones sin conexión a internet
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Vector Embedding Visualizer (384-D sample) */}
                    {telemetry?.denseVectorPreview && telemetry.denseVectorPreview.length > 0 && (
                        <div style={{ marginTop: '10px', padding: '6px 8px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                            <div style={{ color: '#64748B', fontSize: '10px', marginBottom: '3px' }}>
                                📐 TENSOR DE EMBEDDING (384-D MUESTRA NORMALIZADA):
                            </div>
                            <div style={{ color: '#A7F3D0', fontSize: '9px', wordBreak: 'break-all' }}>
                                [{telemetry.denseVectorPreview.slice(0, 12).map(n => n.toFixed(4)).join(', ')} ... +372 floats]
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
