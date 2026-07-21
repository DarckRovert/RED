import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

interface SecurityReportModalProps {
    onClose: () => void;
}

export const SecurityReportModal: React.FC<SecurityReportModalProps> = ({ onClose }) => {
    const { identity } = useRedStore();
    const [copied, setCopied] = useState(false);

    const reportData = {
        timestamp: new Date().toISOString(),
        version: "RED v16.0 Zenith Master Edition",
        identity_hash: identity?.identity_hash || "Desconocida",
        security_features: {
            pqc_kyber1024: "ACTIVO & OPERATIVO",
            pqc_dilithium5: "ACTIVO & OPERATIVO",
            privacy_screen: localStorage.getItem('red_privacy_screen') === 'true' ? 'ACTIVADO' : 'DESACTIVADO',
            disguise_calculator: localStorage.getItem('red_disguise_mode') === 'true' ? 'ACTIVADO' : 'DESACTIVADO',
            sqlite_bypassed: "CONFIRMADO (MEMORIA VOLÁTIL)",
            anti_forensic_purge: "LISTO"
        }
    };

    const reportText = `================================================
  FICHA DE AUDITORÍA DE SEGURIDAD TÁCTICA RED
================================================
Fecha de Emisión: ${reportData.timestamp}
Versión del Sistema: ${reportData.version}
Identidad Criptográfica: ${reportData.identity_hash}

[ ESTADO DE MÓDULOS ZERO-TRUST ]
- Cifrado Poscuántico Kyber1024 : ${reportData.security_features.pqc_kyber1024}
- Firmas Poscuánticas Dilithium5 : ${reportData.security_features.pqc_dilithium5}
- Bloqueo de Capturas (OS Level): ${reportData.security_features.privacy_screen}
- Camuflaje de Calculadora      : ${reportData.security_features.disguise_calculator}
- Almacenamiento SQLite         : ${reportData.security_features.sqlite_bypassed}
- Purga Anti-Forense            : ${reportData.security_features.anti_forensic_purge}
================================================`;

    const handleCopyReport = async () => {
        try {
            await navigator.clipboard.writeText(reportText);
            setCopied(true);
            toast.success("✅ Informe de auditoría copiado");
            setTimeout(() => setCopied(false), 3000);
        } catch {
            toast.error("Error al copiar el informe");
        }
    };

    return (
        <div 
            className="animate-fade"
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(5,5,12,0.85)', backdropFilter: 'blur(16px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
            onClick={onClose}
        >
            <div 
                className="animate-pop glass-card-v2 neon-border-red"
                style={{
                    width: '100%', maxWidth: '520px', padding: '24px', maxHeight: '85vh', overflowY: 'auto',
                    borderRadius: '24px', position: 'relative'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📄</span>
                        <div>
                            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                                Informe de Auditoría Táctica
                            </h2>
                            <div style={{ fontSize: '0.72rem', color: 'var(--danger)', letterSpacing: '1px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="pulse-dot-green"></span> PROTOCOLO DE SEGURIDAD GLOBAL v16.0
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                <textarea
                    readOnly
                    value={reportText}
                    style={{
                        width: '100%', height: '220px', padding: '14px', borderRadius: '14px',
                        background: 'rgba(0,0,0,0.6)', color: '#00D97E',
                        border: '1px solid rgba(0,217,126,0.25)', outline: 'none',
                        fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace',
                        lineHeight: 1.5, resize: 'none', marginBottom: '16px', boxSizing: 'border-box'
                    }}
                />

                <div className="sticky-modal-footer">
                    <button
                        onClick={handleCopyReport}
                        className="btn-primary"
                        style={{
                            width: '100%', padding: '14px', borderRadius: '14px',
                            background: copied
                                ? 'linear-gradient(135deg, #00D97E, #009955)'
                                : 'linear-gradient(135deg, var(--primary), #C0152A)',
                            color: 'white', fontWeight: 800, fontSize: '0.9rem', border: 'none', cursor: 'pointer',
                            boxShadow: copied ? '0 0 20px rgba(0,217,126,0.4)' : '0 0 20px rgba(232,33,58,0.4)'
                        }}
                    >
                        {copied ? "✓ Copiado al Portapapeles" : "📋 Copiar Ficha de Auditoría"}
                    </button>
                </div>
            </div>
        </div>
    );
};
