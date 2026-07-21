import React, { useState } from "react";
import { localTransport } from "../lib/mesh/localTransport";

interface BlackoutSimulatorModalProps {
    onClose: () => void;
}

export const BlackoutSimulatorModal: React.FC<BlackoutSimulatorModalProps> = ({ onClose }) => {
    const [blackoutActive, setBlackoutActive] = useState(false);
    const [simulationLog, setSimulationLog] = useState<string[]>([]);

    const toggleBlackout = () => {
        const next = !blackoutActive;
        setBlackoutActive(next);

        if (next) {
            setSimulationLog(prev => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] ⚠️ APAGÓN SIMULADO INICIADO: Conectividad WAN cortada.`,
                `[${new Date().toLocaleTimeString()}] 📡 Activando fallback de enrutamiento P2P Epidémico (mDNS + BLE Mesh + LoRa).`,
                `[${new Date().toLocaleTimeString()}] 🟢 Pares locales mDNS activos: ${localTransport.allPeers.filter(p => p.transport === 'wifi').length}`,
                `[${new Date().toLocaleTimeString()}] 📡 Pares BLE cercanos: ${localTransport.allPeers.filter(p => p.transport === 'ble').length}`,
                `[${new Date().toLocaleTimeString()}] 🛡️ Todos los mensajes serán entregados via Hop-by-Hop Gossip.`
            ]);
        } else {
            setSimulationLog(prev => [
                ...prev,
                `[${new Date().toLocaleTimeString()}] ✅ MODO APAGÓN DESACTIVADO: Reconectando relé WAN libp2p.`
            ]);
        }
    };

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
                    width: '100%', maxWidth: '540px', padding: '24px', maxHeight: '85vh', overflowY: 'auto',
                    borderRadius: '24px', background: 'linear-gradient(145deg, #0f0f1c, #0a0a14)',
                    border: `1px solid ${blackoutActive ? 'rgba(232,33,58,0.5)' : 'rgba(41,182,246,0.3)'}`,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📡</span>
                        <div>
                            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                                Simulador de Apagón Táctico
                            </h2>
                            <div style={{ fontSize: '0.72rem', color: blackoutActive ? 'var(--danger)' : '#29B6F6', fontFamily: 'JetBrains Mono, monospace' }}>
                                OFFLINE MESH RESILIENCE PROTOCOL
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                <div style={{
                    padding: '16px', borderRadius: '16px',
                    background: blackoutActive ? 'rgba(232,33,58,0.1)' : 'rgba(41,182,246,0.08)',
                    border: `1px solid ${blackoutActive ? 'rgba(232,33,58,0.3)' : 'rgba(41,182,246,0.2)'}`,
                    marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ fontWeight: 800, color: 'white', fontSize: '0.95rem' }}>
                            {blackoutActive ? "⚠️ MODO APAGÓN ACTIVO" : "🌐 MODO NORMAL CONECTADO"}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {blackoutActive ? "Tráfico WAN bloqueado · Operando 100% por Mesh Offline" : "Conexión híbrida WAN + LAN + BLE enrutando normalmente"}
                        </div>
                    </div>
                    <button
                        onClick={toggleBlackout}
                        style={{
                            padding: '10px 16px', borderRadius: '12px',
                            background: blackoutActive ? 'linear-gradient(135deg, #E8213A, #C0152A)' : 'linear-gradient(135deg, #00D97E, #009955)',
                            color: 'white', fontWeight: 800, fontSize: '0.82rem', border: 'none', cursor: 'pointer'
                        }}
                    >
                        {blackoutActive ? "Reconectar WAN" : "Simular Apagón"}
                    </button>
                </div>

                <div 
                    className="scroll-container no-scrollbar"
                    style={{
                        height: '180px', overflowY: 'auto', padding: '12px', borderRadius: '14px',
                        background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.08)',
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.74rem', color: 'var(--text-secondary)',
                        lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '4px'
                    }}
                >
                    {simulationLog.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '60px' }}>
                            Presiona "Simular Apagón" para evaluar el enrutamiento P2P sin internet.
                        </div>
                    ) : (
                        simulationLog.map((log, i) => <div key={i}>{log}</div>)
                    )}
                </div>
            </div>
        </div>
    );
};
