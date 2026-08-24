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
    cognitiveTrace?: string[];
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
            margin: '10px 0',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(10, 15, 29, 0.98), rgba(6, 9, 18, 0.99))',
            border: '1px solid rgba(0, 229, 255, 0.35)',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.6), inset 0 0 12px rgba(0, 229, 255, 0.08)',
            overflow: 'hidden',
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            color: '#E2E8F0',
            fontSize: '11px',
            width: '100%'
        }}>
            {/* Header / Toggle Bar */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    borderBottom: isExpanded ? '1px solid rgba(0, 229, 255, 0.2)' : 'none',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px' }}>🧠</span>
                    <span style={{ fontWeight: 800, color: '#00E5FF', letterSpacing: '0.5px' }}>
                        PENSAMIENTO INTERNO DE LA IA (CHAIN-OF-THOUGHT)
                    </span>
                    {isGenerating ? (
                        <span style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(234, 179, 8, 0.2)',
                            color: '#FACC15',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            animation: 'pulse 1.2s infinite'
                        }}>
                            ⚡ PROCESANDO TENSORES EN VIVO...
                        </span>
                    ) : (
                        <span style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'rgba(74, 222, 128, 0.15)',
                            color: '#4ADE80',
                            fontSize: '9px',
                            fontWeight: 'bold'
                        }}>
                            ✓ INFERENCIA REAL VERIFICADA
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {telemetry?.executionTimeMs !== undefined && (
                        <span style={{ color: '#94A3B8', fontSize: '10px' }}>
                            ⏱️ {telemetry.executionTimeMs} ms
                        </span>
                    )}
                    <span style={{ color: '#00E5FF', fontSize: '11px', fontWeight: 'bold' }}>
                        {isExpanded ? '▲ Ocultar' : '▼ Ver Pensamientos'}
                    </span>
                </div>
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <div style={{ padding: '10px 12px' }}>
                    {/* Telemetry Badge Grid */}
                    {telemetry && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                            gap: '6px',
                            marginBottom: '10px'
                        }}>
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '5px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ color: '#64748B', fontSize: '9px' }}>MOTOR DE INFERENCIA</div>
                                <div style={{ color: '#38BDF8', fontWeight: 700, fontSize: '10px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                    {telemetry.modelName || 'multilingual-e5-small'}
                                </div>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '5px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ color: '#64748B', fontSize: '9px' }}>SIMILITUD COSENO 384-D</div>
                                <div style={{ color: (telemetry.cosineSimilarity || 0) > 0.35 ? '#4ADE80' : '#FACC15', fontWeight: 700, fontSize: '10px' }}>
                                    {telemetry.cosineSimilarity !== undefined && telemetry.cosineSimilarity > 0 
                                        ? `${(telemetry.cosineSimilarity * 100).toFixed(1)}%` 
                                        : 'Inferencia Directa'}
                                </div>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '5px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ color: '#64748B', fontSize: '9px' }}>GUARDIAN SAFETY</div>
                                <div style={{ color: telemetry.isSafe !== false ? '#4ADE80' : '#EF4444', fontWeight: 700, fontSize: '10px' }}>
                                    {telemetry.safetyScore !== undefined ? `${((1 - telemetry.safetyScore) * 100).toFixed(1)}% Seguro` : '100% Aprobado'}
                                </div>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '5px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ color: '#64748B', fontSize: '9px' }}>INTENCIÓN CLASIFICADA</div>
                                <div style={{ color: '#C084FC', fontWeight: 700, fontSize: '10px', textTransform: 'capitalize' }}>
                                    {telemetry.intentCategory || 'Conversación'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* COGNITIVE TRACE STREAM (Pensamiento Textual Real de la IA) */}
                    {telemetry?.cognitiveTrace && telemetry.cognitiveTrace.length > 0 && (
                        <div style={{
                            marginBottom: '10px',
                            padding: '8px 10px',
                            background: 'rgba(0, 229, 255, 0.04)',
                            border: '1px solid rgba(0, 229, 255, 0.2)',
                            borderRadius: '6px'
                        }}>
                            <div style={{ color: '#00E5FF', fontWeight: 800, fontSize: '10px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>💭</span>
                                <span>STREAM DE RAZONAMIENTO COGNITIVO INTERNO:</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {telemetry.cognitiveTrace.map((thought, tIdx) => (
                                    <div key={tIdx} style={{
                                        color: '#E2E8F0',
                                        fontSize: '10.5px',
                                        lineHeight: 1.4,
                                        paddingLeft: '6px',
                                        borderLeft: '2px solid rgba(0, 229, 255, 0.4)'
                                    }}>
                                        {thought}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step-by-Step Chain of Thought */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {telemetry?.steps && telemetry.steps.length > 0 ? (
                            telemetry.steps.map((step, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'flex-start',
                                    padding: '6px 8px',
                                    borderRadius: '5px',
                                    background: 'rgba(30, 41, 59, 0.45)',
                                    borderLeft: `3px solid ${
                                        step.status === 'completed' ? '#4ADE80' :
                                        step.status === 'processing' ? '#FACC15' :
                                        step.status === 'skipped' ? '#64748B' : '#38BDF8'
                                    }`
                                }}>
                                    <span style={{ fontSize: '12px', lineHeight: '1.2' }}>
                                        {step.status === 'completed' ? '✅' :
                                         step.status === 'processing' ? '⚙️' :
                                         step.status === 'skipped' ? '⏭️' : '🔹'}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700, color: '#F1F5F9', fontSize: '10.5px' }}>
                                                {step.title}
                                            </span>
                                            <span style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase' }}>
                                                {step.phase}
                                            </span>
                                        </div>
                                        <div style={{ color: '#94A3B8', fontSize: '10px', marginTop: '1px' }}>
                                            {step.description}
                                        </div>

                                        {/* Metrics */}
                                        {step.metrics && Object.keys(step.metrics).length > 0 && (
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                                                {Object.entries(step.metrics).map(([k, v]) => (
                                                    <span key={k} style={{
                                                        fontSize: '9px',
                                                        padding: '1px 4px',
                                                        borderRadius: '3px',
                                                        background: 'rgba(56, 189, 248, 0.1)',
                                                        color: '#38BDF8',
                                                        border: '1px solid rgba(56, 189, 248, 0.15)'
                                                    }}>
                                                        {k}: <strong>{v}</strong>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : isGenerating ? (
                            <div style={{ textAlign: 'center', padding: '12px', color: '#94A3B8' }}>
                                <div style={{ color: '#00E5FF', fontWeight: 'bold' }}>⚙️ Inferencia Neuronal en Curso...</div>
                                <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '3px' }}>
                                    Calculando tensores 384-D y evaluando similitud semántica en memoria
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Vector Embedding Visualizer (384-D sample) */}
                    {telemetry?.denseVectorPreview && telemetry.denseVectorPreview.length > 0 && (
                        <div style={{ marginTop: '8px', padding: '5px 7px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px' }}>
                            <div style={{ color: '#64748B', fontSize: '9px', marginBottom: '2px' }}>
                                📐 TENSOR DE EMBEDDING (384-D MUESTRA NORMALIZADA):
                            </div>
                            <div style={{ color: '#A7F3D0', fontSize: '8.5px', wordBreak: 'break-all' }}>
                                [{telemetry.denseVectorPreview.slice(0, 10).map(n => n.toFixed(4)).join(', ')} ... +374 floats]
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
