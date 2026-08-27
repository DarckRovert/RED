'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';

export const LandingResilienceCalculator: React.FC = () => {
    const { t } = useTranslation();
    const [operatorsCount, setOperatorsCount] = useState<number>(35);
    const [environment, setEnvironment] = useState<"mining" | "disasters" | "rural" | "security">("mining");
    const [rangeKm, setRangeKm] = useState<number>(15);

    const calculation = useMemo(() => {
        // Traditional Telecom Cost: Satellite phones or dedicated industrial LTE (~$80/mo per user + $12,000 infra)
        const traditionalMonthlyPerUser = environment === "mining" ? 95 : environment === "disasters" ? 75 : 60;
        const traditionalAnnualCost = (operatorsCount * traditionalMonthlyPerUser * 12) + 15000;

        // RED Mesh Cost: Zero monthly fees, just one-time rugged nodes / license (~$90 per rugged node once)
        const redOneTimeCost = operatorsCount * 120 + (Math.ceil(rangeKm / 8) * 250);
        const redAnnualCost = redOneTimeCost * 0.15; // 15% maintenance

        const annualSavings = Math.max(0, traditionalAnnualCost - (redOneTimeCost + redAnnualCost));
        const savingsPercent = Math.min(92, Math.round((annualSavings / traditionalAnnualCost) * 100));

        return {
            traditionalAnnualCost,
            redOneTimeCost,
            annualSavings,
            savingsPercent
        };
    }, [operatorsCount, environment, rangeKm]);

    return (
        <section id="calculator" style={{ padding: "70px 0 80px", position: "relative" }}>
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
                <span style={{
                    fontSize: "11px", padding: "5px 14px", borderRadius: "20px",
                    background: "rgba(0, 230, 118, 0.12)", color: "#00E676",
                    border: "1px solid rgba(0, 230, 118, 0.3)",
                    fontFamily: "JetBrains Mono, monospace", fontWeight: 800, letterSpacing: "1px"
                }}>
                    RETORNO DE INVERSIÓN • EVALUADOR TÁCTICO B2B & B2G
                </span>
                <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "12px", letterSpacing: "-0.5px" }}>
                    Calculadora de Resiliencia y Ahorro de Costos
                </h2>
                <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
                    Calcula cuánto ahorra tu operación minera, cuerpo de bomberos o municipio al reemplazar costosas líneas celulares y satelitales por una malla soberana sin mensualidades.
                </p>
            </div>

            <div style={{ maxWidth: "1050px", margin: "0 auto", padding: "0 16px" }}>
                <div style={{
                    background: "linear-gradient(180deg, rgba(14, 18, 34, 0.95) 0%, rgba(8, 10, 20, 0.98) 100%)",
                    border: "1.5px solid rgba(0, 230, 118, 0.3)",
                    borderRadius: "24px", padding: "36px",
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,230,118,0.1)",
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "36px",
                    alignItems: "center"
                }} className="calculator-grid">
                    
                    {/* Controls Column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                        <div>
                            <label style={{ fontSize: "13px", fontWeight: 800, color: "#FFF", display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <span>👥 Número de Operadores / Brigadistas en Campo:</span>
                                <span style={{ color: "#00E676", fontFamily: "JetBrains Mono, monospace", fontSize: "16px" }}>{operatorsCount} personas</span>
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="300"
                                step="5"
                                value={operatorsCount}
                                onChange={(e) => setOperatorsCount(parseInt(e.target.value))}
                                style={{ width: "100%", accentColor: "#00E676", cursor: "pointer" }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: "13px", fontWeight: 800, color: "#FFF", display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <span>📡 Radio de Cobertura Requerido:</span>
                                <span style={{ color: "#00E5FF", fontFamily: "JetBrains Mono, monospace", fontSize: "16px" }}>{rangeKm} km</span>
                            </label>
                            <input
                                type="range"
                                min="2"
                                max="50"
                                step="1"
                                value={rangeKm}
                                onChange={(e) => setRangeKm(parseInt(e.target.value))}
                                style={{ width: "100%", accentColor: "#00E5FF", cursor: "pointer" }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: "13px", fontWeight: 800, color: "#FFF", marginBottom: "10px", display: "block" }}>
                                🏔️ Entorno Operativo:
                            </label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                {[
                                    { id: "mining", label: "⛏️ Minería / Socavón" },
                                    { id: "disasters", label: "🚨 Emergencias / INDECI" },
                                    { id: "rural", label: "🏡 Selva / Rural" },
                                    { id: "security", label: "🛡️ Seguridad Táctica" },
                                ].map(env => (
                                    <button
                                        key={env.id}
                                        onClick={() => setEnvironment(env.id as any)}
                                        style={{
                                            padding: "10px 12px", borderRadius: "10px",
                                            background: environment === env.id ? "rgba(0, 230, 118, 0.2)" : "rgba(255,255,255,0.04)",
                                            border: environment === env.id ? "1.5px solid #00E676" : "1px solid rgba(255,255,255,0.08)",
                                            color: environment === env.id ? "#FFF" : "#94A3B8",
                                            fontSize: "12px", fontWeight: 700, cursor: "pointer",
                                            textAlign: "left"
                                        }}
                                    >
                                        {env.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Results Column */}
                    <div style={{
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid rgba(0, 230, 118, 0.25)",
                        borderRadius: "20px", padding: "28px",
                        display: "flex", flexDirection: "column", gap: "16px",
                        boxShadow: "inset 0 0 30px rgba(0,230,118,0.05)"
                    }}>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "#94A3B8", letterSpacing: "1px", textTransform: "uppercase" }}>
                            ESTIMACIÓN DE AHORRO & RESILIENCIA
                        </div>

                        <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "baseline",
                            borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px"
                        }}>
                            <span style={{ fontSize: "13px", color: "#94A3B8" }}>Ahorro Anual Estimado:</span>
                            <span style={{ fontSize: "28px", fontWeight: 900, color: "#00E676", fontFamily: "JetBrains Mono, monospace" }}>
                                ~${calculation.annualSavings.toLocaleString()} USD
                            </span>
                        </div>

                        <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            fontSize: "13px"
                        }}>
                            <span style={{ color: "#94A3B8" }}>Porcentaje de Ahorro en TCO:</span>
                            <span style={{
                                fontWeight: 900, color: "#000", background: "#00E676",
                                padding: "3px 10px", borderRadius: "12px", fontSize: "13px",
                                fontFamily: "JetBrains Mono, monospace"
                            }}>
                                {calculation.savingsPercent}% MENOS
                            </span>
                        </div>

                        <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            fontSize: "13px"
                        }}>
                            <span style={{ color: "#94A3B8" }}>Costo Mensual Recurrente:</span>
                            <span style={{ fontWeight: 900, color: "#00E5FF", fontFamily: "JetBrains Mono, monospace" }}>
                                $0.00 / mes (CERO MENSUALIDADES)
                            </span>
                        </div>

                        <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            fontSize: "13px"
                        }}>
                            <span style={{ color: "#94A3B8" }}>Vulnerabilidad ante Apagones:</span>
                            <span style={{ fontWeight: 900, color: "#00E676", fontFamily: "JetBrains Mono, monospace" }}>
                                0% (100% OPERATIVO OFFLINE)
                            </span>
                        </div>

                        <a
                            href="mailto:darckrovert@gmail.com?subject=Solicitud%20de%20Propuesta%20Tecnica%20RED%20Mesh"
                            style={{
                                display: "block", textAlign: "center", padding: "12px 18px",
                                borderRadius: "12px", background: "linear-gradient(135deg, #00E676 0%, #00B0FF 100%)",
                                color: "#050B14", fontWeight: 900, fontSize: "14px",
                                textDecoration: "none", marginTop: "8px",
                                boxShadow: "0 4px 20px rgba(0,230,118,0.3)"
                            }}
                        >
                            📋 Solicitar Propuesta Técnica Institucional (darckrovert@gmail.com)
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
};
