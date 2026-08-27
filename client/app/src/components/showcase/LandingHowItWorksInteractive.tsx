'use client';

import React, { useState } from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';

interface StepDetail {
    stepNumber: string;
    badge: string;
    title: string;
    shortDesc: string;
    technicalDetails: string[];
    visualIcon: string;
    accentColor: string;
}

export const LandingHowItWorksInteractive: React.FC = () => {
    const { t } = useTranslation();
    const [activeStep, setActiveStep] = useState<number>(0);

    const steps: StepDetail[] = [
        {
            stepNumber: "01",
            badge: "IDENTIDAD SOBERANA & CRIPTOGRAFÍA",
            title: "Generación de Llaves en Tu Teléfono (Cero Nube)",
            shortDesc: "Tu dispositivo crea una identidad criptográfica descentralizada (DID) y pares de llaves post-cuánticas sin enviar tu correo, número de teléfono ni datos a ningún servidor central.",
            technicalDetails: [
                "NIST FIPS 203: Intercambio de claves post-cuánticas ML-KEM-768 (Kyber)",
                "NIST FIPS 204: Firmas digitales cuánticas ML-DSA-65 (Dilithium)",
                "Semilla Mnemónica de 12 palabras derivada según estándar BIP-39",
                "Almacenamiento en Bóveda Criptográfica local (IndexedDB + WebCrypto)"
            ],
            visualIcon: "🔐",
            accentColor: "#00E5FF"
        },
        {
            stepNumber: "02",
            badge: "DESCUBRIMIENTO INVISIBLE DE VECINOS",
            title: "Balizas de Radiofrecuencia sin Internet ni Saldo",
            shortDesc: "Los teléfonos y transceptores LoRa cercanos emiten pulsos mudos de presencia en frecuencias libres. Se detectan mutuamente en milisegundos sin consumir megas ni requerir antenas celulares.",
            technicalDetails: [
                "Bluetooth Low Energy (BLE 5.0) en modo periférico y central continuo",
                "Wi-Fi Direct P2P para transmisión de paquetes de alto ancho de banda",
                "Radio LoRa 915 MHz (US915 - PNAF Perú) para enlaces de 15 a 25 km",
                "SoundMesh: Módem acústico por ultrasonidos (18–20 kHz) entre parlante y micrófono"
            ],
            visualIcon: "📡",
            accentColor: "#00E676"
        },
        {
            stepNumber: "03",
            badge: "ENRUTAMIENTO MULTI-HOP SOBERANO",
            title: "El Mensaje Salta de Teléfono en Teléfono Cifrado",
            shortDesc: "Si el destinatario está a kilómetros de distancia, tu mensaje salta de forma invisible y anónima a través de celulares intermediarios hasta encontrar al destinatario. Los nodos puente NO pueden leer tu mensaje.",
            technicalDetails: [
                "Protocolo Gossip P2P con algoritmo anti-bucles por Hash SHA-256",
                "Double Ratchet Protocol: Cifrado con cambio de llave por cada mensaje",
                "Enrutamiento DTN (Delay-Tolerant Networking) con almacenamiento en tránsito",
                "Proof-of-Relay: Créditos locales para recompensar a nodos retransmisores"
            ],
            visualIcon: "⚡",
            accentColor: "#FFB300"
        },
        {
            stepNumber: "04",
            badge: "DESCRIPCIÓN Y BÓVEDA EN DESTINO",
            title: "Entrega Segura y Autodestrucción Verificada",
            shortDesc: "Al llegar al nodo destino, el mensaje es descifrado únicamente con la llave privada del receptor. Se registran acuses de recibo en el libro mayor local sin dejar rastro en telecomunicadoras.",
            technicalDetails: [
                "Cifrado simétrico autenticado AES-256-GCM con autenticación Poly1305",
                "DMS (Dead Man's Switch): Bóvedas de autodestrucción y pánico táctico",
                "Libro mayor soberano: Verificación de no-repudio por árbol de Merkle",
                "Modo Camuflaje: Ocultamiento instantáneo bajo una calculadora funcional"
            ],
            visualIcon: "🛡️",
            accentColor: "#E8213A"
        }
    ];

    const current = steps[activeStep];

    return (
        <section id="how-it-works" style={{ padding: "80px 0 60px", position: "relative" }}>
            <div style={{ textAlign: "center", marginBottom: "44px" }}>
                <span style={{
                    fontSize: "11px", padding: "5px 14px", borderRadius: "20px",
                    background: "rgba(0, 229, 255, 0.12)", color: "#00E5FF",
                    border: "1px solid rgba(0, 229, 255, 0.3)",
                    fontFamily: "JetBrains Mono, monospace", fontWeight: 800, letterSpacing: "1px"
                }}>
                    ARQUITECTURA INTERNA EXPLICADA • CERO NUBE
                </span>
                <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "12px", letterSpacing: "-0.5px" }}>
                    ¿Cómo Funciona RED sin Internet ni Torres Celulares?
                </h2>
                <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "820px", margin: "0 auto", lineHeight: 1.6 }}>
                    A diferencia de WhatsApp o Telegram que dependen de servidores centrales y cables de fibra óptica, RED convierte cada celular y radio en una torre repetidora inteligente que forma una malla impenetrable.
                </p>
            </div>

            {/* Stepper Tabs Bar */}
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 16px" }}>
                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px", marginBottom: "28px"
                }}>
                    {steps.map((s, idx) => {
                        const isActive = idx === activeStep;
                        return (
                            <button
                                key={s.stepNumber}
                                onClick={() => setActiveStep(idx)}
                                style={{
                                    background: isActive ? `linear-gradient(135deg, rgba(20,24,40,0.95) 0%, rgba(10,14,26,0.98) 100%)` : "rgba(12, 16, 28, 0.6)",
                                    border: isActive ? `1.5px solid ${s.accentColor}` : "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: "16px", padding: "16px 14px",
                                    display: "flex", alignItems: "center", gap: "12px",
                                    cursor: "pointer", textAlign: "left",
                                    boxShadow: isActive ? `0 8px 30px ${s.accentColor}25` : "none",
                                    transition: "all 0.25s ease"
                                }}
                            >
                                <div style={{
                                    width: 38, height: 38, borderRadius: "12px",
                                    background: isActive ? `${s.accentColor}22` : "rgba(255,255,255,0.05)",
                                    border: `1px solid ${isActive ? s.accentColor : "rgba(255,255,255,0.1)"}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "18px", flexShrink: 0
                                }}>
                                    {s.visualIcon}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: "10px", color: isActive ? s.accentColor : "#64748B", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                                        PASO {s.stepNumber}
                                    </div>
                                    <div style={{ fontSize: "13px", fontWeight: 800, color: isActive ? "#FFF" : "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {s.title.split("(")[0]}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Active Step Deep-Dive Card */}
                <div style={{
                    background: "linear-gradient(180deg, rgba(14, 18, 34, 0.95) 0%, rgba(8, 10, 20, 0.98) 100%)",
                    border: `1.5px solid ${current.accentColor}55`,
                    borderRadius: "24px", padding: "36px 32px",
                    backdropFilter: "blur(20px)",
                    boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${current.accentColor}15`,
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px",
                    alignItems: "center"
                }} className="how-it-works-grid">
                    
                    {/* Left Column: Description & Value */}
                    <div>
                        <div style={{
                            display: "inline-block", fontSize: "11px", padding: "4px 12px",
                            borderRadius: "12px", background: `${current.accentColor}22`,
                            color: current.accentColor, fontWeight: 800,
                            fontFamily: "JetBrains Mono, monospace", marginBottom: "14px",
                            border: `1px solid ${current.accentColor}44`
                        }}>
                            {current.badge}
                        </div>
                        <h3 style={{ fontSize: "24px", fontWeight: 900, color: "#FFF", lineHeight: 1.25, marginBottom: "14px" }}>
                            {current.title}
                        </h3>
                        <p style={{ fontSize: "15px", color: "#CBD5E1", lineHeight: 1.7, marginBottom: "20px" }}>
                            {current.shortDesc}
                        </p>

                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>
                                Protocolo Verificado:
                            </span>
                            <span style={{
                                fontSize: "11px", fontWeight: 800, color: "#00E676",
                                background: "rgba(0,230,118,0.1)", padding: "2px 8px", borderRadius: "6px",
                                border: "1px solid rgba(0,230,118,0.3)"
                            }}>
                                ● 100% Cero Fuga de Metadatos
                            </span>
                        </div>
                    </div>

                    {/* Right Column: Technical Spec Box & Interactive Simulation */}
                    <div style={{
                        background: "rgba(0, 0, 0, 0.45)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "18px", padding: "24px",
                        display: "flex", flexDirection: "column", gap: "14px"
                    }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#FFF", letterSpacing: "0.5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>ESPECIFICACIÓN TÉCNICA DE RED</span>
                            <span style={{ color: current.accentColor, fontFamily: "JetBrains Mono, monospace" }}>Fase {current.stepNumber}/04</span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {current.technicalDetails.map((detail, dIdx) => (
                                <div key={dIdx} style={{
                                    display: "flex", alignItems: "flex-start", gap: "10px",
                                    fontSize: "13px", color: "#94A3B8", lineHeight: 1.5
                                }}>
                                    <span style={{ color: current.accentColor, fontWeight: 900 }}>⚡</span>
                                    <span>{detail}</span>
                                </div>
                            ))}
                        </div>

                        {/* Interactive Simulation Footnote */}
                        <div style={{
                            marginTop: "8px", padding: "12px", borderRadius: "12px",
                            background: `${current.accentColor}11`, border: `1px solid ${current.accentColor}33`,
                            display: "flex", alignItems: "center", gap: "10px"
                        }}>
                            <span style={{ fontSize: "20px" }}>{current.visualIcon}</span>
                            <div style={{ fontSize: "11px", color: "#E2E8F0", lineHeight: 1.4 }}>
                                <strong>Resultado Operativo:</strong> Comunicación instantánea sin intermediarios, inmune al corte de cables submarinos y sin pago de mensualidades.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
