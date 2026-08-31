'use client';

import React from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';
import { RED_VERSION, RED_BUILD_CODE, RED_APK_NAME } from '../../lib/version';

interface LandingHeroProps {
    heroAlias: string;
    heroDidHash: string;
    heroMnemonicSeed: string;
    heroBannerUrl: string;
    handleHeroAliasChange: (val: string) => void;
    handleLaunchWithHeroAlias: () => void;
    handleCopy: (text: string) => void;
    copiedText: string | null;
    scrollToSection: (id: string) => void;
    handleEnter: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
    heroAlias,
    heroDidHash,
    heroMnemonicSeed,
    heroBannerUrl,
    handleHeroAliasChange,
    handleLaunchWithHeroAlias,
    handleCopy,
    copiedText,
    scrollToSection,
    handleEnter
}) => {
    const { t } = useTranslation();
    const isGhPages = typeof window !== "undefined" && window.location.pathname.includes("/RED");
    const basePath = isGhPages ? "/RED" : "";
    const heroImage = `${basePath}/assets/red_hero_tactical_mesh.png`;

    return (
        <section id="hero" style={{ padding: "40px 0 70px", position: "relative" }}>
            {/* Top Category Tag */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div style={{
                    display: "inline-flex", alignItems: "center", gap: "8px",
                    padding: "6px 18px", borderRadius: "20px",
                    background: "rgba(232, 33, 58, 0.12)",
                    border: "1px solid rgba(232, 33, 58, 0.35)",
                    color: "#FF3355", fontSize: "12px", fontWeight: 800,
                    fontFamily: "JetBrains Mono, monospace", letterSpacing: "1px"
                }}>
                    <span>🛡️</span> COMUNICACIÓN SOBERANA 100% OFF-GRID • INMUNE A APAGONES Y CENSURA
                </div>
            </div>

            {/* Split Hero Grid: Copy on Left, Visual & Live DID on Right */}
            <div style={{
                display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "40px",
                alignItems: "center", maxWidth: "1400px", margin: "0 auto"
            }} className="hero-split-grid">
                
                {/* Left Column: Headlines, Pitch & CTAs */}
                <div>
                    <h1 style={{
                        fontSize: "clamp(34px, 4.2vw, 58px)",
                        fontWeight: 900,
                        color: "#FFF",
                        lineHeight: 1.1,
                        letterSpacing: "-1.5px",
                        marginBottom: "20px"
                    }}>
                        El Primer Sistema Operativo de <span style={{
                            background: "linear-gradient(135deg, #00E5FF 0%, #00FF88 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent"
                        }}>Comunicación Táctica</span> sin Internet
                    </h1>

                    <p style={{
                        fontSize: "16px",
                        color: "#94A3B8",
                        lineHeight: 1.7,
                        marginBottom: "28px"
                    }}>
                        RED conecta teléfonos inteligentes y transceptores LoRa directamente entre sí mediante <strong>Bluetooth LE 5.3, Wi-Fi Direct ad-hoc, ondas de radio 915 MHz (15–25 km) y pulsos acústicos ultrasónicos</strong>. Cero servidores en la nube, cero cables de fibra óptica y blindaje criptográfico post-cuántico <strong>NIST FIPS 203 (ML-KEM-768)</strong>.
                    </p>

                    {/* Primary CTAs */}
                    <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "32px" }}>
                        <button
                            onClick={handleEnter}
                            style={{
                                display: "inline-flex", alignItems: "center", gap: "10px",
                                padding: "15px 30px", borderRadius: "14px",
                                background: "linear-gradient(135deg, #FF3355 0%, #C41230 100%)",
                                color: "#FFF", fontWeight: 900, fontSize: "15px",
                                border: "none", cursor: "pointer",
                                boxShadow: "0 0 35px rgba(255, 51, 85, 0.45)",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <span>🚀</span> Abrir Web App en Navegador
                        </button>

                        <a
                            href={`https://github.com/DarckRovert/RED/releases/download/v${RED_VERSION}/${RED_APK_NAME}`}
                            style={{
                                display: "inline-flex", alignItems: "center", gap: "10px",
                                padding: "15px 26px", borderRadius: "14px",
                                background: "linear-gradient(135deg, #00FF88 0%, #00E5FF 100%)",
                                color: "#050B14", fontWeight: 900, fontSize: "15px",
                                textDecoration: "none",
                                boxShadow: "0 0 30px rgba(0, 255, 136, 0.35)",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <span>📥</span> Descargar APK (v{RED_VERSION})
                        </a>
                    </div>

                    {/* Key Technical Badges */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ padding: "6px 12px", borderRadius: "10px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(0, 229, 255, 0.25)", color: "#00E5FF", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            📡 LORA 15-25 KM (US915 MTC)
                        </span>
                        <span style={{ padding: "6px 12px", borderRadius: "10px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(0, 255, 136, 0.25)", color: "#00FF88", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            🛡️ NIST FIPS 203/204 PQC
                        </span>
                        <span style={{ padding: "6px 12px", borderRadius: "10px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255, 179, 0, 0.35)", color: "#FFB300", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            🎯 ATAK CoT (MIL-STD-2525D)
                        </span>
                        <span style={{ padding: "6px 12px", borderRadius: "10px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(0, 229, 255, 0.35)", color: "#00E5FF", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            🎙️ VOZ LORA 1.2 KBPS
                        </span>
                        <span style={{ padding: "6px 12px", borderRadius: "10px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(0, 230, 118, 0.35)", color: "#00E676", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            🧪 248/248 TESTS CERTIFICADOS
                        </span>
                        <span style={{ padding: "6px 12px", borderRadius: "10px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255, 51, 85, 0.25)", color: "#FF3355", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            🚫 CERO NUBE / CERO LOGS
                        </span>
                        <span style={{ padding: "6px 12px", borderRadius: "10px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255, 179, 0, 0.25)", color: "#FFB300", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            🔊 SOUNDMESH ULTRASÓNICO
                        </span>
                    </div>
                </div>

                {/* Right Column: Visual Tactical Render + Interactive DID Card */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Tactical Image Showcase */}
                    <div style={{
                        position: "relative", borderRadius: "24px", overflow: "hidden",
                        border: "1.5px solid rgba(0, 229, 255, 0.4)",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(0,229,255,0.15)",
                        background: "rgba(5, 7, 14, 0.9)"
                    }}>
                        <img
                            src={heroImage}
                            alt="RED Tactical Mesh Rugged Device"
                            style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }}
                            onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                        />
                        <div style={{
                            position: "absolute", bottom: "14px", left: "14px", right: "14px",
                            padding: "10px 16px", borderRadius: "12px",
                            background: "rgba(3, 5, 10, 0.85)", backdropFilter: "blur(12px)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            fontSize: "11px", fontFamily: "JetBrains Mono, monospace"
                        }}>
                            <span style={{ color: "#00E676", fontWeight: 800 }}>● NODO MESH ACTIVO (0-INTERNET)</span>
                            <span style={{ color: "#00E5FF" }}>AES-256 + ML-KEM-768</span>
                        </div>
                    </div>

                    {/* Instant Sovereign Identity Generator Card */}
                    <div style={{
                        padding: "22px", borderRadius: "20px",
                        background: "linear-gradient(135deg, rgba(14, 18, 34, 0.9) 0%, rgba(8, 10, 20, 0.95) 100%)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        boxShadow: "0 15px 40px rgba(0,0,0,0.6)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "18px" }}>🪪</span>
                                <span style={{ fontWeight: 800, color: "#FFF", fontSize: "13px" }}>Generador de Identidad Soberana</span>
                            </div>
                            <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "8px", background: "rgba(0, 230, 118, 0.15)", color: "#00E676", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                                ZERO-KNOWLEDGE
                            </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", marginBottom: "12px" }}>
                            <input
                                type="text"
                                value={heroAlias}
                                onChange={(e) => handleHeroAliasChange(e.target.value)}
                                placeholder="Escribe tu alias táctico..."
                                style={{
                                    padding: "10px 14px", borderRadius: "10px",
                                    background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)",
                                    color: "#FFF", fontSize: "13px", outline: "none"
                                }}
                            />
                            <button
                                onClick={handleLaunchWithHeroAlias}
                                style={{
                                    padding: "10px 18px", borderRadius: "10px",
                                    background: "linear-gradient(90deg, #FF3355 0%, #990014 100%)",
                                    color: "#FFF", fontWeight: 800, fontSize: "13px",
                                    border: "none", cursor: "pointer", whiteSpace: "nowrap"
                                }}
                            >
                                ⚡ Entrar con este DID
                            </button>
                        </div>

                        <div style={{
                            background: "rgba(0,0,0,0.6)", padding: "10px 12px", borderRadius: "10px",
                            border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "6px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>DID PÚBLICO (W3C):</span>
                                <button
                                    onClick={() => handleCopy(heroDidHash)}
                                    style={{ background: "none", border: "none", color: "#00E5FF", fontSize: "10px", cursor: "pointer", fontFamily: "JetBrains Mono, monospace" }}
                                >
                                    {copiedText === heroDidHash ? "✓ ¡Copiado!" : "📋 Copiar DID"}
                                </button>
                            </div>
                            <div style={{ fontSize: "11px", color: "#00E676", fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>
                                {heroDidHash}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
