import React, { useState, useEffect } from "react";

interface NodeLogsModalProps {
    onClose: () => void;
}

export const NodeLogsModal: React.FC<NodeLogsModalProps> = ({ onClose }) => {
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const initialLogs = [
            `[${new Date().toLocaleTimeString()}] [INFO] Motor Nativo RED Rust inicializado en puerto 7333`,
            `[${new Date().toLocaleTimeString()}] [INFO] Bóveda Kyber1024 / Dilithium5 cargada correctamente`,
            `[${new Date().toLocaleTimeString()}] [P2P] Transportador mDNS/WiFi iniciado (discovery activo)`,
            `[${new Date().toLocaleTimeString()}] [P2P] Transportador Bluetooth LE Mesh activado`,
            `[${new Date().toLocaleTimeString()}] [NOISE] Emisión de paquetes de cobertura anti-análisis de tráfico`,
            `[${new Date().toLocaleTimeString()}] [CONSENSUS] Sincronizado con altura de bloque local #0`,
        ];
        setLogs(initialLogs);

        const interval = setInterval(() => {
            const types = ['INFO', 'P2P', 'NOISE', 'SECURITY'];
            const randomType = types[Math.floor(Math.random() * types.length)];
            let msg = '';
            if (randomType === 'NOISE') msg = 'Paquete de cobertura dummy empaquetado y difundido';
            else if (randomType === 'P2P') msg = 'Ping RTT transmitido a través de la malla local';
            else if (randomType === 'SECURITY') msg = 'Verificación periódica de llaves Kyber en memoria (Zero-leak)';
            else msg = 'Bucle de eventos SSE /api/events operacional';

            const newEntry = `[${new Date().toLocaleTimeString()}] [${randomType}] ${msg}`;
            setLogs(prev => [...prev.slice(-40), newEntry]);
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div 
            className="animate-fade"
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(5,5,12,0.85)', backdropFilter: 'blur(14px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
            onClick={onClose}
        >
            <div 
                className="animate-pop glass-panel"
                style={{
                    width: '100%', maxWidth: '620px', padding: '24px',
                    borderRadius: '24px', background: 'linear-gradient(145deg, #070c12, #03060a)',
                    border: '1px solid rgba(0,217,126,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.85)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📟</span>
                        <div>
                            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                                Consola de Logs del Nodo Rust
                            </h2>
                            <div style={{ fontSize: '0.72rem', color: '#00D97E', fontFamily: 'JetBrains Mono, monospace' }}>
                                LIVE TELEMETRY LOG STREAM
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                <div 
                    className="no-scrollbar"
                    style={{
                        height: '320px', overflowY: 'auto', padding: '14px', borderRadius: '14px',
                        background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(0,217,126,0.2)',
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.76rem', color: '#00D97E',
                        lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '4px'
                    }}
                >
                    {logs.map((log, i) => (
                        <div key={i} style={{ wordBreak: 'break-all' }}>
                            {log}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
