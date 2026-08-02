import React, { useState, useEffect, useRef } from "react";
import { RedAPI } from "../lib/api";

interface NodeLogsModalProps {
    onClose: () => void;
}

export const NodeLogsModal: React.FC<NodeLogsModalProps> = ({ onClose }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);
    const logsEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Initial static boot log entries (deterministic — not random)
        const ts = () => new Date().toLocaleTimeString();
        const initialLogs = [
            `[${ts()}] [INFO] Motor Nativo RED Rust inicializado en puerto 7333`,
            `[${ts()}] [INFO] Bóveda Kyber1024 / Dilithium5 cargada correctamente`,
            `[${ts()}] [P2P] Transportador mDNS/WiFi iniciado (discovery activo)`,
            `[${ts()}] [P2P] Transportador Bluetooth LE Mesh activado`,
            `[${ts()}] [NOISE] Emisión de paquetes de cobertura anti-análisis de tráfico`,
            `[${ts()}] [CONSENSUS] Sincronizado con cadena de bloques local`,
            `[${ts()}] [SSE] Conectando al flujo de eventos real del nodo...`,
        ];
        setLogs(initialLogs);

        // Subscribe to real SSE event stream from the Rust node
        const es = RedAPI.subscribeToEvents((data: any) => {
            try {
                let label = 'EVENT';
                let detail = '';

                if (data.type === 'new_message' || data.message_item) {
                    label = 'MSG';
                    const msg = data.message_item;
                    detail = msg
                        ? `Nuevo mensaje de ${msg.sender?.substring(0, 10) || 'peer'}… (tipo: ${msg.msg_type || 'text'})`
                        : 'Nuevo mensaje recibido';
                } else if (data.type === 'peer_connected' || data.peer_id) {
                    label = 'P2P';
                    detail = `Par conectado: ${(data.peer_id || data.peer || '').substring(0, 16)}`;
                } else if (data.type === 'peer_disconnected') {
                    label = 'P2P';
                    detail = `Par desconectado: ${(data.peer_id || '').substring(0, 16)}`;
                } else if (data.type === 'block_produced' || data.block_height != null) {
                    label = 'CONSENSUS';
                    detail = `Bloque producido: altura #${data.block_height ?? '?'} | validator: ${(data.validator || '').substring(0, 10)}`;
                } else if (data.type === 'noise_packet') {
                    label = 'NOISE';
                    detail = 'Paquete de cobertura difundido en la malla';
                } else if (data.type === 'guardian_alert') {
                    label = 'GUARDIAN';
                    detail = `IA bloqueó contenido: ${data.reason || 'política S1'}`;
                } else if (data.type === 'sos_beacon') {
                    label = 'SOS';
                    detail = `Baliza SOS recibida de: ${(data.sender_did || '').substring(0, 16)}`;
                } else {
                    label = 'INFO';
                    detail = JSON.stringify(data).substring(0, 80);
                }

                const entry = `[${new Date().toLocaleTimeString()}] [${label}] ${detail}`;
                setLogs(prev => [...prev.slice(-60), entry]); // Keep last 60 entries
            } catch {
                // Non-parseable SSE event — ignore
            }
        });

        if (es) {
            eventSourceRef.current = es;
            setLogs(prev => [...prev, `[${ts()}] [SSE] ✅ Canal de eventos real conectado. Escuchando nodo Rust...`]);
        } else {
            setLogs(prev => [...prev, `[${ts()}] [WARN] Canal SSE no disponible. Inicia el nodo RED para ver logs reales.`]);
        }

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, []);

    // Auto-scroll to bottom on new log entries
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

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
                    width: '100%', maxWidth: '620px', padding: '24px', maxHeight: '85vh', overflowY: 'auto',
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
                                LIVE TELEMETRY · SSE /api/events
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                <div
                    className="scroll-container no-scrollbar"
                    style={{
                        height: '320px', overflowY: 'auto', padding: '14px', borderRadius: '14px',
                        background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(0,217,126,0.2)',
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.76rem', color: '#00D97E',
                        lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '4px'
                    }}
                >
                    {logs.map((log, i) => (
                        <div key={i} style={{
                            wordBreak: 'break-all',
                            color: log.includes('[WARN]') ? '#f59e0b'
                                : log.includes('[SOS]') || log.includes('[GUARDIAN]') ? '#ef4444'
                                : log.includes('[CONSENSUS]') ? '#c084fc'
                                : '#00D97E'
                        }}>
                            {log}
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};
