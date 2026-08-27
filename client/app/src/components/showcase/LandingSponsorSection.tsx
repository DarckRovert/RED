'use client';

import React, { useState } from 'react';

export const LandingSponsorSection: React.FC = () => {
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    const donationChannels = [
        {
            name: "GitHub Sponsors",
            handle: "@DarckRovert",
            desc: "Patrocinio mensual recurrente o único con insignias oficiales en GitHub.",
            icon: "🐙",
            color: "#EA4AAA",
            url: "https://github.com/sponsors/DarckRovert",
            badge: "Oficial & Sin Comisiones"
        },
        {
            name: "Ko-fi",
            handle: "darckrovert",
            desc: "Donaciones directas con tarjeta de débito/crédito sin necesidad de suscripción.",
            icon: "☕",
            color: "#FF5E5B",
            url: "https://ko-fi.com/darckrovert",
            badge: "Pago Directo en 1 Toque"
        },
        {
            name: "PayPal Me",
            handle: "paypal.me/darckrovert",
            desc: "Aportes rápidos y seguros a través de tu cuenta personal de PayPal.",
            icon: "💳",
            color: "#0079C1",
            url: "https://paypal.me/darckrovert",
            badge: "Transferencia Global"
        }
    ];

    const copyToClipboard = (url: string, name: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(url);
            setCopiedUrl(name);
            setTimeout(() => setCopiedUrl(null), 2500);
        }
    };

    return (
        <section id="sponsors" style={{ padding: "80px 0 60px", position: "relative" }}>
            <div
                style={{
                    maxWidth: "1280px",
                    margin: "0 auto",
                    padding: "48px 32px",
                    borderRadius: "28px",
                    background: "linear-gradient(135deg, rgba(20, 10, 30, 0.9) 0%, rgba(10, 15, 28, 0.95) 100%)",
                    border: "1.5px solid rgba(255, 51, 85, 0.35)",
                    boxShadow: "0 25px 80px rgba(0,0,0,0.8), 0 0 50px rgba(255, 51, 85, 0.1)",
                    backdropFilter: "blur(24px)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Background Glow */}
                <div
                    style={{
                        position: "absolute",
                        top: "-40%",
                        right: "-15%",
                        width: "600px",
                        height: "600px",
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(255, 51, 85, 0.15) 0%, transparent 70%)",
                        pointerEvents: "none",
                    }}
                />

                <div style={{ textAlign: "center", marginBottom: "40px", position: "relative", zIndex: 1 }}>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 16px",
                            borderRadius: "20px",
                            background: "rgba(255, 51, 85, 0.15)",
                            border: "1px solid rgba(255, 51, 85, 0.4)",
                            color: "#FF3355",
                            fontSize: "11px",
                            fontWeight: 800,
                            letterSpacing: "1px",
                            marginBottom: "16px",
                            fontFamily: "JetBrains Mono, monospace",
                            textTransform: "uppercase",
                        }}
                    >
                        <span>💖</span> FINANCIAMIENTO COLECTIVO & SOBERANÍA
                    </div>

                    <h2
                        style={{
                            fontSize: "clamp(28px, 4vw, 42px)",
                            fontWeight: 900,
                            color: "#FFF",
                            letterSpacing: "-0.5px",
                            marginBottom: "14px",
                            lineHeight: 1.2,
                        }}
                    >
                        Impulsa la Red Soberana de Comunicaciones
                    </h2>

                    <p
                        style={{
                            fontSize: "clamp(15px, 1.8vw, 17px)",
                            color: "#94A3B8",
                            maxWidth: "820px",
                            margin: "0 auto",
                            lineHeight: 1.6,
                        }}
                    >
                        <strong style={{ color: "#FFF" }}>RED</strong> es 100% código abierto bajo licencia AGPLv3, libre de censura estatal y corporativa. Tu patrocinio directo financia el desarrollo de transceptores LoRa de largo alcance, investigación criptográfica post-cuántica y el despliegue en comunidades vulnerables.
                    </p>
                </div>

                {/* Sponsorship Tiers Grid */}
                <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "18px", marginBottom: "36px", position: "relative", zIndex: 1
                }}>
                    {[
                        {
                            tier: "🥉 NODO COMUNITARIO", price: "$10 USD / mes",
                            desc: "Apoyo continuo a los servidores de desarrollo e investigación de protocolos de radio.",
                            perks: ["✓ Mención de honor en el repositorio GitHub", "✓ Acceso prioritario a builds nightly experimentales", "✓ Rol exclusivo de Patrocinador en la comunidad"],
                            color: "#00E5FF", highlight: false
                        },
                        {
                            tier: "🥈 BRIGADA TÁCTICA", price: "$50 USD / mes",
                            desc: "Financia el desarrollo de firmware LoRa ESP32 y esquemáticos PCB de hardware libre.",
                            perks: ["✓ Soporte directo para flasheo de nodos LilyGO/Heltec", "✓ Acceso anticipado a esquemáticos de hardware libre", "✓ Llave de acceso a la suite de telemetría acústica"],
                            color: "#00FF88", highlight: true
                        },
                        {
                            tier: "🥇 INSTITUCIONAL & MINERÍA", price: "$250+ USD / mes",
                            desc: "Para empresas mineras, brigadas de rescate, municipios e instituciones que despliegan malla.",
                            perks: ["✓ Asesoría técnica en despliegue cerrado off-grid", "✓ Auditoría de protocolos y frecuencias US915 a medida", "✓ Logotipo institucional en la página oficial del proyecto"],
                            color: "#FFB300", highlight: false
                        }
                    ].map((t, idx) => (
                        <div key={idx} style={{
                            padding: "26px", borderRadius: "20px",
                            background: t.highlight ? "linear-gradient(180deg, rgba(0, 230, 118, 0.12) 0%, rgba(14, 18, 34, 0.95) 100%)" : "rgba(14, 18, 34, 0.85)",
                            border: t.highlight ? `1.5px solid ${t.color}` : "1px solid rgba(255,255,255,0.08)",
                            boxShadow: t.highlight ? `0 15px 40px ${t.color}20` : "0 8px 24px rgba(0,0,0,0.5)",
                            display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "16px"
                        }}>
                            <div>
                                <div style={{ fontSize: "11px", color: t.color, fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>{t.tier}</div>
                                <div style={{ fontSize: "22px", fontWeight: 900, color: "#FFF", marginTop: "4px" }}>{t.price}</div>
                                <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.5, marginTop: "8px", marginBottom: "16px" }}>{t.desc}</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {t.perks.map((p, pIdx) => (
                                        <div key={pIdx} style={{ fontSize: "12px", color: "#CBD5E1", display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span>{p}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <a
                                href="https://github.com/sponsors/DarckRovert"
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    display: "block", textAlign: "center", padding: "12px",
                                    borderRadius: "12px", background: t.highlight ? "linear-gradient(135deg, #00FF88 0%, #00E5FF 100%)" : "rgba(255,255,255,0.08)",
                                    color: t.highlight ? "#050B14" : "#FFF", fontWeight: 900, fontSize: "13px",
                                    textDecoration: "none", border: t.highlight ? "none" : "1px solid rgba(255,255,255,0.15)",
                                    transition: "all 0.2s ease"
                                }}
                            >
                                Patrocinar en GitHub Sponsors
                            </a>
                        </div>
                    ))}
                </div>

                {/* Direct Donation Channels (GitHub Sponsors, Ko-fi, PayPal) */}
                <div style={{
                    padding: "24px", borderRadius: "20px",
                    background: "rgba(6, 9, 18, 0.95)", border: "1px solid rgba(255, 255, 255, 0.1)",
                    position: "relative", zIndex: 1
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                        <div>
                            <div style={{ fontSize: "15px", fontWeight: 900, color: "#FFF" }}>Canales Oficiales de Patrocinio & Donación</div>
                            <div style={{ fontSize: "12px", color: "#94A3B8" }}>Elige tu método preferido para respaldar el desarrollo continuo de RED Sovereign Mesh.</div>
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <iframe
                                src="https://github.com/sponsors/DarckRovert/button"
                                title="Sponsor DarckRovert"
                                height="32"
                                width="114"
                                style={{ border: 0, borderRadius: "6px", verticalAlign: "middle" }}
                            />
                            <a
                                href="https://github.com/DarckRovert/RED"
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: "6px",
                                    padding: "6px 14px", borderRadius: "8px",
                                    background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.16)",
                                    color: "#FFF", fontSize: "12px", fontWeight: 700, textDecoration: "none"
                                }}
                            >
                                ⭐ Estrella en GitHub
                            </a>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
                        {donationChannels.map((ch, chIdx) => (
                            <div key={chIdx} style={{
                                padding: "18px", borderRadius: "16px",
                                background: "rgba(0,0,0,0.6)", border: `1px solid ${ch.color}40`,
                                display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px"
                            }}>
                                <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                        <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span>{ch.icon}</span> {ch.name}
                                        </span>
                                        <span style={{ fontSize: "10px", color: ch.color, fontFamily: "JetBrains Mono, monospace", background: `${ch.color}15`, padding: "2px 8px", borderRadius: "6px", border: `1px solid ${ch.color}30` }}>
                                            {ch.badge}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: 1.4, marginBottom: "8px" }}>
                                        {ch.desc}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#CBD5E1", fontFamily: "JetBrains Mono, monospace" }}>
                                        {ch.handle}
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: "8px" }}>
                                    <a
                                        href={ch.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            flex: 1, textAlign: "center", padding: "8px 12px", borderRadius: "8px",
                                            background: `linear-gradient(135deg, ${ch.color} 0%, ${ch.color}CC 100%)`,
                                            color: "#FFF", textDecoration: "none", fontSize: "12px", fontWeight: 800,
                                            boxShadow: `0 4px 12px ${ch.color}30`
                                        }}
                                    >
                                        Ir a {ch.name} ➔
                                    </a>
                                    <button
                                        onClick={() => copyToClipboard(ch.url, ch.name)}
                                        style={{
                                            padding: "8px 12px", borderRadius: "8px",
                                            background: copiedUrl === ch.name ? "#00E676" : "rgba(255,255,255,0.08)",
                                            color: copiedUrl === ch.name ? "#000" : "#FFF",
                                            border: "1px solid rgba(255,255,255,0.15)", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                                            fontFamily: "JetBrains Mono, monospace"
                                        }}
                                        title="Copiar enlace"
                                    >
                                        {copiedUrl === ch.name ? "✓" : "📋"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
