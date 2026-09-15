"use client";

import React, { useState, useEffect } from "react";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { RED_VERSION_NAME } from "../../lib/version";

interface LegalComplianceModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: "privacy" | "terms" | "data_safety";
}

export const LegalComplianceModal: React.FC<LegalComplianceModalProps> = ({
    isOpen,
    onClose,
    initialTab = "privacy",
}) => {
    const [activeTab, setActiveTab] = useState<"privacy" | "terms" | "data_safety">(initialTab);

    useEffect(() => {
        if (!isOpen) return;
        return BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            onClose();
            return true;
        });
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                backgroundColor: "rgba(0, 0, 0, 0.85)",
                backdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                animation: "fadeIn 0.15s ease-out",
            }}
            onClick={onClose}
        >
            <div
                className="card-tactical animate-enter"
                style={{
                    width: "100%",
                    maxWidth: "760px",
                    maxHeight: "90vh",
                    background: "linear-gradient(180deg, #0a0e1c 0%, #04060c 100%)",
                    border: "1px solid rgba(0, 230, 118, 0.4)",
                    borderRadius: "16px",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    boxShadow: "0 24px 60px rgba(0,0,0,0.9), 0 0 30px rgba(0,230,118,0.15)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--glass-border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "rgba(0,0,0,0.4)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.4rem" }}>⚖️</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#FFF" }}>
                                Marco Legal, Privacidad & Licencia
                            </h2>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                RED {RED_VERSION_NAME} · Cumplimiento Internacional Zero-Knowledge
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            onClose();
                        }}
                        className="btn-ghost"
                        style={{ padding: "6px 10px", fontSize: "0.80rem" }}
                        aria-label="Cerrar modal legal"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs Selector */}
                <div
                    style={{
                        display: "flex",
                        borderBottom: "1px solid var(--glass-border)",
                        background: "rgba(255,255,255,0.02)",
                    }}
                >
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            setActiveTab("privacy");
                        }}
                        style={{
                            flex: 1,
                            padding: "12px 8px",
                            fontSize: "0.78rem",
                            fontWeight: activeTab === "privacy" ? 800 : 600,
                            color: activeTab === "privacy" ? "var(--accent-emerald)" : "var(--text-muted)",
                            borderBottom: activeTab === "privacy" ? "2px solid var(--accent-emerald)" : "2px solid transparent",
                            background: activeTab === "privacy" ? "rgba(0,230,118,0.06)" : "transparent",
                            borderTop: "none",
                            borderLeft: "none",
                            borderRight: "none",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                        }}
                    >
                        🛡️ Privacidad (Zero-Data)
                    </button>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            setActiveTab("terms");
                        }}
                        style={{
                            flex: 1,
                            padding: "12px 8px",
                            fontSize: "0.78rem",
                            fontWeight: activeTab === "terms" ? 800 : 600,
                            color: activeTab === "terms" ? "var(--accent-cyan)" : "var(--text-muted)",
                            borderBottom: activeTab === "terms" ? "2px solid var(--accent-cyan)" : "2px solid transparent",
                            background: activeTab === "terms" ? "rgba(0,229,255,0.06)" : "transparent",
                            borderTop: "none",
                            borderLeft: "none",
                            borderRight: "none",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                        }}
                    >
                        📜 Términos & EULA
                    </button>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            setActiveTab("data_safety");
                        }}
                        style={{
                            flex: 1,
                            padding: "12px 8px",
                            fontSize: "0.78rem",
                            fontWeight: activeTab === "data_safety" ? 800 : 600,
                            color: activeTab === "data_safety" ? "var(--accent-amber)" : "var(--text-muted)",
                            borderBottom: activeTab === "data_safety" ? "2px solid var(--accent-amber)" : "2px solid transparent",
                            background: activeTab === "data_safety" ? "rgba(255,214,0,0.06)" : "transparent",
                            borderTop: "none",
                            borderLeft: "none",
                            borderRight: "none",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                        }}
                    >
                        🔒 Seguridad de Datos Play
                    </button>
                </div>

                {/* Content Container (Scrollable) */}
                <div
                    className="scroll-container"
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                        fontSize: "0.82rem",
                        lineHeight: 1.6,
                        color: "var(--text-secondary)",
                    }}
                >
                    {activeTab === "privacy" && (
                        <>
                            <div style={{ padding: "12px", background: "rgba(0,230,118,0.05)", borderRadius: "8px", border: "1px solid rgba(0,230,118,0.2)" }}>
                                <strong style={{ color: "var(--accent-emerald)" }}>FILOSOFÍA LOCAL-FIRST & ZERO-KNOWLEDGE:</strong>
                                <p style={{ margin: "6px 0 0 0" }}>
                                    RED no recopila, no transmite ni almacena datos personales en servidores centrales. Toda la información permanece cifrada exclusivamente en su dispositivo.
                                </p>
                            </div>

                            <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>1. Ausencia Total de Rastreadores</h3>
                            <p style={{ margin: 0 }}>
                                La aplicación está 100% libre de SDKs analíticos de terceros (Google Analytics, Firebase, Facebook SDK, AdMob). Ningún identificador publicitario es leído ni compartido con brokers comerciales.
                            </p>

                            <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>2. Desglose de Permisos Sensibles</h3>
                            <ul style={{ margin: "4px 0", paddingLeft: "18px" }}>
                                <li><strong>Cámara:</strong> Solo en memoria volátil para escaneo de códigos QR tácticos y Li-Fi.</li>
                                <li><strong>Micrófono:</strong> Requerido para el Walkie-Talkie P2P y barrera ultrasónica. Sin grabaciones en segundo plano.</li>
                                <li><strong>Ubicación GPS:</strong> Solo lectura local para navegación inercial y brújula. Jamás se comparte por Internet sin orden directa.</li>
                                <li><strong>Bluetooth LE & Wi-Fi:</strong> Enlaces físicos directos de malla ad-hoc sin intermediarios celulares.</li>
                            </ul>

                            <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>3. Protocolo de Coacción Zeroize</h3>
                            <p style={{ margin: 0 }}>
                                Si el operador introduce el PIN de coacción o activa el botón de pánico, el sistema ejecuta la sobrescritura criptográfica inmediata (0x00, 0xFF, CSPRNG) y elimina todas las claves de forma irrecuperable.
                            </p>
                        </>
                    )}

                    {activeTab === "terms" && (
                        <>
                            <div style={{ padding: "12px", background: "rgba(255,23,68,0.08)", borderRadius: "8px", border: "1px solid rgba(255,23,68,0.3)" }}>
                                <strong style={{ color: "var(--accent-crimson)" }}>DESCARGO DE RESPONSABILIDAD DE EMERGENCIA:</strong>
                                <p style={{ margin: "6px 0 0 0" }}>
                                    RED es una herramienta de contingencia y resiliencia para comunicaciones fuera de línea. NO SUSTITUYE a los servicios oficiales de socorro (911/112) cuando se encuentren operativos.
                                </p>
                            </div>

                            <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>1. Licencia de Software</h3>
                            <p style={{ margin: 0 }}>
                                Publicado bajo licencia GNU Affero General Public License v3.0 (AGPL-3.0). El código fuente es abierto, verificable y auditable por cualquier usuario.
                            </p>

                            <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>2. Soberanía de Claves Privadas</h3>
                            <p style={{ margin: 0 }}>
                                El usuario es el único custodio de su semilla mnemónica y fragmentos Shamir (SSS). Si olvida sus credenciales o ejecuta una purga destructiva, el soporte técnico no puede recuperar su información.
                            </p>

                            <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>3. Uso de Frecuencias de Radio</h3>
                            <p style={{ margin: 0 }}>
                                El usuario es responsable de respetar las bandas ISM no licenciadas (868 MHz / 915 MHz) y los límites de potencia de transmisión de su jurisdicción nacional al enlazar módems LoRaWAN.
                            </p>
                        </>
                    )}

                    {activeTab === "data_safety" && (
                        <>
                            <div style={{ padding: "12px", background: "rgba(255,214,0,0.06)", borderRadius: "8px", border: "1px solid rgba(255,214,0,0.25)" }}>
                                <strong style={{ color: "var(--accent-amber)" }}>GOOGLE PLAY DATA SAFETY SECTION (OFICIAL):</strong>
                                <p style={{ margin: "6px 0 0 0" }}>
                                    Declaraciones juradas requeridas para la consola de desarrollador de Google Play Store.
                                </p>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px", marginTop: "4px" }}>
                                <div style={{ padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid var(--glass-border)" }}>
                                    <span style={{ color: "var(--accent-emerald)", fontWeight: 800 }}>¿Recopila datos personales?</span>
                                    <div style={{ color: "var(--text-primary)" }}>NO. Ningún dato se extrae del dispositivo hacia servidores.</div>
                                </div>

                                <div style={{ padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid var(--glass-border)" }}>
                                    <span style={{ color: "var(--accent-emerald)", fontWeight: 800 }}>¿Comparte datos con terceros?</span>
                                    <div style={{ color: "var(--text-primary)" }}>NO. Cero transferencia a intermediarios comerciales o brokers.</div>
                                </div>

                                <div style={{ padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid var(--glass-border)" }}>
                                    <span style={{ color: "var(--accent-emerald)", fontWeight: 800 }}>¿Los datos se transfieren cifrados?</span>
                                    <div style={{ color: "var(--text-primary)" }}>SÍ. Cifrado simétrico AES-256-GCM y post-cuántico NIST ML-KEM-768.</div>
                                </div>

                                <div style={{ padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid var(--glass-border)" }}>
                                    <span style={{ color: "var(--accent-emerald)", fontWeight: 800 }}>¿Se permite solicitar borrado?</span>
                                    <div style={{ color: "var(--text-primary)" }}>SÍ. El usuario puede purgar y zeroizar todos sus datos localmente en un toque.</div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Links & Buttons */}
                <div
                    style={{
                        padding: "14px 20px",
                        borderTop: "1px solid var(--glass-border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "rgba(0,0,0,0.5)",
                    }}
                >
                    <div style={{ display: "flex", gap: "12px", fontSize: "0.72rem" }}>
                        <a
                            href="https://darckrovert.github.io/RED/privacy.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}
                        >
                            🌐 Privacidad Web
                        </a>
                        <a
                            href="https://darckrovert.github.io/RED/terms.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}
                        >
                            🌐 Términos Web
                        </a>
                    </div>

                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            onClose();
                        }}
                        className="btn-tactical-primary"
                        style={{ padding: "8px 18px", fontSize: "0.78rem", fontWeight: 800 }}
                    >
                        Entendido / Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
