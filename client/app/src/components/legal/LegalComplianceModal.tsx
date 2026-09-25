"use client";

import React, { useState, useEffect } from "react";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { RED_VERSION_NAME, RED_VERSION } from "../../lib/version";
import { legalAgreementManager, LegalAcceptanceRecord, LEGAL_CONTRACT_SHA256 } from "../../lib/legal/LegalAgreementManager";
import { HALL_OF_FAME_ENTRIES } from "../../lib/legal/HallOfFameData";
import { HallOfFameModal } from "./HallOfFameModal";

interface LegalComplianceModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: "privacy" | "terms" | "disclaimers" | "data_safety" | "certificate" | "hall_of_fame";
}

export const LegalComplianceModal: React.FC<LegalComplianceModalProps> = ({
    isOpen,
    onClose,
    initialTab = "privacy",
}) => {
    const [activeTab, setActiveTab] = useState<"privacy" | "terms" | "disclaimers" | "data_safety" | "certificate" | "hall_of_fame">(initialTab);
    const [signatureRecord, setSignatureRecord] = useState<LegalAcceptanceRecord | null>(null);
    const [isHallOfFameFullOpen, setIsHallOfFameFullOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (initialTab) {
            setActiveTab(initialTab);
        }
        setSignatureRecord(legalAgreementManager.getAcceptanceDetails());
        return BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            onClose();
            return true;
        });
    }, [isOpen, initialTab, onClose]);

    if (!isOpen) return null;

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 99999,
                    backgroundColor: "rgba(0, 0, 0, 0.88)",
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
                        maxWidth: "840px",
                        maxHeight: "92vh",
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
                            overflowX: "auto",
                        }}
                    >
                        <button
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                setActiveTab("privacy");
                            }}
                            style={{
                                flex: 1,
                                padding: "12px 6px",
                                fontSize: "0.75rem",
                                fontWeight: activeTab === "privacy" ? 800 : 600,
                                color: activeTab === "privacy" ? "var(--accent-emerald)" : "var(--text-muted)",
                                borderBottom: activeTab === "privacy" ? "2px solid var(--accent-emerald)" : "2px solid transparent",
                                background: activeTab === "privacy" ? "rgba(0,230,118,0.06)" : "transparent",
                                borderTop: "none",
                                borderLeft: "none",
                                borderRight: "none",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            🛡️ Privacidad
                        </button>
                        <button
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                setActiveTab("terms");
                            }}
                            style={{
                                flex: 1,
                                padding: "12px 6px",
                                fontSize: "0.75rem",
                                fontWeight: activeTab === "terms" ? 800 : 600,
                                color: activeTab === "terms" ? "var(--accent-cyan)" : "var(--text-muted)",
                                borderBottom: activeTab === "terms" ? "2px solid var(--accent-cyan)" : "2px solid transparent",
                                background: activeTab === "terms" ? "rgba(0,229,255,0.06)" : "transparent",
                                borderTop: "none",
                                borderLeft: "none",
                                borderRight: "none",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            📜 Términos & EULA
                        </button>
                        <button
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                setActiveTab("disclaimers");
                            }}
                            style={{
                                flex: 1,
                                padding: "12px 6px",
                                fontSize: "0.75rem",
                                fontWeight: activeTab === "disclaimers" ? 800 : 600,
                                color: activeTab === "disclaimers" ? "var(--accent-crimson)" : "var(--text-muted)",
                                borderBottom: activeTab === "disclaimers" ? "2px solid var(--accent-crimson)" : "2px solid transparent",
                                background: activeTab === "disclaimers" ? "rgba(255,23,68,0.06)" : "transparent",
                                borderTop: "none",
                                borderLeft: "none",
                                borderRight: "none",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            ⚠️ Descargos
                        </button>
                        <button
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                setActiveTab("data_safety");
                            }}
                            style={{
                                flex: 1,
                                padding: "12px 6px",
                                fontSize: "0.75rem",
                                fontWeight: activeTab === "data_safety" ? 800 : 600,
                                color: activeTab === "data_safety" ? "var(--accent-amber)" : "var(--text-muted)",
                                borderBottom: activeTab === "data_safety" ? "2px solid var(--accent-amber)" : "2px solid transparent",
                                background: activeTab === "data_safety" ? "rgba(255,214,0,0.06)" : "transparent",
                                borderTop: "none",
                                borderLeft: "none",
                                borderRight: "none",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            🔒 Datos Play
                        </button>
                        <button
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                setActiveTab("certificate");
                            }}
                            style={{
                                flex: 1,
                                padding: "12px 6px",
                                fontSize: "0.75rem",
                                fontWeight: activeTab === "certificate" ? 800 : 600,
                                color: activeTab === "certificate" ? "#A78BFA" : "var(--text-muted)",
                                borderBottom: activeTab === "certificate" ? "2px solid #A78BFA" : "2px solid transparent",
                                background: activeTab === "certificate" ? "rgba(167,139,250,0.06)" : "transparent",
                                borderTop: "none",
                                borderLeft: "none",
                                borderRight: "none",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            🔏 Firma Digital
                        </button>
                        <button
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                setActiveTab("hall_of_fame");
                            }}
                            style={{
                                flex: 1,
                                padding: "12px 6px",
                                fontSize: "0.75rem",
                                fontWeight: activeTab === "hall_of_fame" ? 800 : 600,
                                color: activeTab === "hall_of_fame" ? "#F59E0B" : "var(--text-muted)",
                                borderBottom: activeTab === "hall_of_fame" ? "2px solid #F59E0B" : "2px solid transparent",
                                background: activeTab === "hall_of_fame" ? "rgba(245,158,11,0.08)" : "transparent",
                                borderTop: "none",
                                borderLeft: "none",
                                borderRight: "none",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            🎖️ Salón de la Fama
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
                                    <li><strong>Cámara:</strong> Solo en memoria volátil para escaneo de códigos QR tácticos, Li-Fi y transceptor óptico.</li>
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
                                <div style={{ padding: "12px", background: "rgba(0,229,255,0.06)", borderRadius: "8px", border: "1px solid rgba(0,229,255,0.25)" }}>
                                    <strong style={{ color: "var(--accent-cyan)" }}>LICENCIA LIBRE AGPL-3.0 Y PROVISIÓN AS-IS:</strong>
                                    <p style={{ margin: "6px 0 0 0" }}>
                                        RED es software de código abierto publicado bajo la licencia GNU Affero General Public License v3.0.
                                        Se distribuye SIN GARANTÍA DE NINGÚN TIPO.
                                    </p>
                                </div>

                                <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>1. Exclusión de Garantías Comerciales</h3>
                                <p style={{ margin: 0 }}>
                                    El software se entrega "TAL CUAL" ("AS IS"). Ni los desarrolladores ni los mantenedores responden por lucro cesante, pérdidas materiales o daños a la salud derivados de su utilización.
                                </p>

                                <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>2. Custodia Exclusiva de Identidades</h3>
                                <p style={{ margin: 0 }}>
                                    Su identidad criptográfica depende de sus claves privadas (Ed25519 / ML-KEM-768). RED no cuenta con servidores centrales para recuperación de cuentas ni contraseñas.
                                </p>

                                <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>3. Uso Legítimo del Software</h3>
                                <p style={{ margin: 0 }}>
                                    Queda prohibido el uso del software para interferencias intencionadas en canales de socorro público o ataques de saturación deliberada contra repetidores comunitarios.
                                </p>
                            </>
                        )}

                        {activeTab === "disclaimers" && (
                            <>
                                <div style={{ padding: "12px", background: "rgba(255,23,68,0.08)", borderRadius: "8px", border: "1px solid rgba(255,23,68,0.3)" }}>
                                    <strong style={{ color: "var(--accent-crimson)" }}>DESCARGO OPERATIVO Y REGULATORIO TÁCTICO:</strong>
                                    <p style={{ margin: "6px 0 0 0" }}>
                                        Descargos explícitos para radiofrecuencia, emergencias civiles, soporte médico y detección CBRN.
                                    </p>
                                </div>

                                <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>1. No-Sustitución de Emergencias Estatales</h3>
                                <p style={{ margin: 0 }}>
                                    RED NO es un servicio público de telecomunicaciones ni reemplaza al 911 / 112 / SAMU 106 / INDECI 115. Ante emergencias vitales, use primordialmente los canales estatales competentes.
                                </p>

                                <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>2. Responsabilidad de Espectro LoRa/RF</h3>
                                <p style={{ margin: 0 }}>
                                    El operador es el único responsable de configurar y respetar las frecuencias ISM autorizadas (433/868/915 MHz), límites de potencia (dBm) y ciclos de trabajo conforme a la normativa local (MTC, FCC, CE RED).
                                </p>

                                <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>3. Triage TCCC y Heurísticas Clínicas</h3>
                                <p style={{ margin: 0 }}>
                                    Los algoritmos MARCH/PAWS y temporizadores de torniquete son guías heurísticas educativas para contingencia extrema; NO son dispositivos médicos certificados por FDA ni DIGEMID.
                                </p>

                                <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>4. Sensor CBRN / Radiación Óptica CMOS</h3>
                                <p style={{ margin: 0 }}>
                                    El conteo de ruido fotónico en la cámara NO constituye un dosímetro radiológico calibrado. No debe emplearse para certificar zonas seguras en accidentes radiológicos.
                                </p>

                                <h3 style={{ margin: "8px 0 4px 0", color: "#FFF", fontSize: "0.90rem" }}>5. Doctrina de Mero Conducto (Mere Conduit)</h3>
                                <p style={{ margin: 0 }}>
                                    Los nodos que reenvían paquetes en tránsito de terceros lo hacen de manera automatizada y a ciegas (E2EE), gozando de inmunidad bajo la doctrina de mero conducto (DMCA §512, CDA §230, Directiva UE).
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

                        {activeTab === "certificate" && (
                            <>
                                <div style={{ padding: "12px", background: "rgba(167,139,250,0.08)", borderRadius: "8px", border: "1px solid rgba(167,139,250,0.3)" }}>
                                    <strong style={{ color: "#A78BFA" }}>REGISTRO DE CONSENTIMIENTO EXPRESO (CLICKWRAP):</strong>
                                    <p style={{ margin: "6px 0 0 0" }}>
                                        Estado de la firma digital vinculante del usuario en este nodo local.
                                    </p>
                                </div>

                                {signatureRecord ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px" }}>
                                        <div style={{ padding: "10px", background: "rgba(0,230,118,0.06)", borderRadius: "8px", border: "1px solid rgba(0,230,118,0.25)" }}>
                                            <div style={{ color: "var(--accent-emerald)", fontWeight: 800, fontSize: "0.85rem" }}>
                                                ✓ CONTRATO FIRMADO DIGITALMENTE
                                            </div>
                                            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                                Versión del Contrato: <strong>v{signatureRecord.version}</strong>
                                            </div>
                                            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                                                Fecha y Hora (UTC): <strong>{signatureRecord.acceptedAt}</strong>
                                            </div>
                                        </div>

                                        <div style={{ padding: "10px", background: "rgba(0,0,0,0.4)", borderRadius: "8px", border: "1px solid var(--glass-border)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.70rem" }}>
                                            <div style={{ color: "var(--accent-cyan)", fontWeight: 700, marginBottom: "4px" }}>
                                                HASH CANÓNICO SHA-256 DEL CONTRATO:
                                            </div>
                                            <div style={{ wordBreak: "break-all", color: "#FFF" }}>
                                                {signatureRecord.contractSha256 || LEGAL_CONTRACT_SHA256}
                                            </div>
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                            <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.72rem" }}>
                                                📜 EULA AGPL-3.0: <strong>ACEPTADO</strong>
                                            </div>
                                            <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.72rem" }}>
                                                ⚠️ Descargo 911 / SAMU: <strong>ACEPTADO</strong>
                                            </div>
                                            <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.72rem" }}>
                                                📻 Espectro LoRa/RF: <strong>ACEPTADO</strong>
                                            </div>
                                            <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)", fontSize: "0.72rem" }}>
                                                🛡️ DTN Mere Conduit: <strong>ACEPTADO</strong>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: "10px" }}>
                                            <button
                                                onClick={() => {
                                                    TacticalAudioEngine.playTap();
                                                    legalAgreementManager.revokeAcceptance();
                                                    setSignatureRecord(null);
                                                }}
                                                className="btn-ghost"
                                                style={{ color: "var(--accent-crimson)", fontSize: "0.74rem", padding: "6px 12px" }}
                                            >
                                                Revocar Aceptación (Requerirá re-firma en el siguiente inicio)
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ padding: "16px", background: "rgba(255,23,68,0.08)", borderRadius: "8px", border: "1px solid rgba(255,23,68,0.25)" }}>
                                        <div style={{ color: "var(--accent-crimson)", fontWeight: 800 }}>
                                            ⚠️ PENDIENTE DE FIRMA DIGITAL
                                        </div>
                                        <p style={{ margin: "6px 0 0 0", fontSize: "0.78rem" }}>
                                            No se ha registrado una firma digital para la versión actual v{RED_VERSION}.
                                            El sistema solicitará su suscripción formal al iniciar la interfaz táctica.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === "hall_of_fame" && (
                            <>
                                <div style={{ padding: "12px", background: "rgba(245,158,11,0.08)", borderRadius: "8px", border: "1px solid rgba(245,158,11,0.3)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                                        <div>
                                            <strong style={{ color: "#F59E0B" }}>SALÓN DE LA FAMA & ATRIBUCIÓN OPEN SOURCE:</strong>
                                            <p style={{ margin: "4px 0 0 0", fontSize: "0.76rem" }}>
                                                Honores al creador y a los pioneros independientes de la criptografía, radiofrecuencia, neurocomputación y software libre.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                TacticalAudioEngine.playTap();
                                                setIsHallOfFameFullOpen(true);
                                            }}
                                            className="btn-tactical-primary"
                                            style={{ padding: "6px 12px", fontSize: "0.72rem", whiteSpace: "nowrap" }}
                                        >
                                            Explorar Salón Completo ↗
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                                    {HALL_OF_FAME_ENTRIES.map((entry) => (
                                        <div
                                            key={entry.id}
                                            style={{
                                                padding: "10px 14px",
                                                background: "rgba(255,255,255,0.02)",
                                                borderRadius: "8px",
                                                border: entry.category === "CORE" ? "1px solid rgba(0,230,118,0.3)" : "1px solid rgba(255,255,255,0.06)",
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <span style={{ fontWeight: 800, color: entry.category === "CORE" ? "var(--accent-emerald)" : "#FFF", fontSize: "0.85rem" }}>
                                                    {entry.name} {entry.handleOrEntity && <span style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", fontWeight: 400 }}>({entry.handleOrEntity})</span>}
                                                </span>
                                                <span style={{ fontSize: "0.68rem", color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {entry.license || "Open Source"}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: "0.74rem", color: "var(--accent-amber)", fontWeight: 600, marginTop: "2px" }}>
                                                {entry.role}
                                            </div>
                                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "3px" }}>
                                                {entry.contribution}
                                            </div>
                                        </div>
                                    ))}
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
                            flexWrap: "wrap",
                            gap: "8px",
                        }}
                    >
                        <div style={{ display: "flex", gap: "12px", fontSize: "0.72rem", flexWrap: "wrap" }}>
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
                            <a
                                href="https://darckrovert.github.io/RED/credits.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--accent-amber)", textDecoration: "underline", fontWeight: 700 }}
                            >
                                🎖️ Salón de la Fama Web
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

            {/* Modal de Salón de la Fama Pantalla Completa */}
            <HallOfFameModal
                isOpen={isHallOfFameFullOpen}
                onClose={() => setIsHallOfFameFullOpen(false)}
            />
        </>
    );
};
