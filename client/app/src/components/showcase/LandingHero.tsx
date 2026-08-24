import React from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';

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
    return (
        <section id="hero" style={{ padding: "40px 0 60px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              borderRadius: "20px",
              background: "rgba(255, 42, 81, 0.12)",
              border: "1px solid rgba(255, 42, 81, 0.3)",
              color: "#FF2A51",
              fontSize: "12px",
              fontWeight: 800,
              fontFamily: "monospace",
              marginBottom: "20px",
            }}
          >
            <span>🛡️</span> {t.showcase_landing?.hero_tag || "COMUNICACIÓN SOBERANA 100% OFF-GRID • INMUNE A APAGONES Y CENSURA"}
          </div>

          <h1
            style={{
              fontSize: "clamp(34px, 5vw, 64px)",
              fontWeight: 900,
              color: "#FFF",
              lineHeight: 1.1,
              maxWidth: "1180px",
              marginBottom: "20px",
              letterSpacing: "-1px",
            }}
          >
            {t.showcase_landing?.hero_title || "El Primer Sistema Operativo de Comunicación de Emergencia"}
          </h1>

          <p
            style={{
              fontSize: "17px",
              color: "#94A3B8",
              maxWidth: "960px",
              lineHeight: 1.6,
              marginBottom: "36px",
            }}
          >
            RED opera directamente entre dispositivos usando radio Bluetooth LE, WiFi Direct, LoRa 915MHz y pulsos acústicos ultrasónicos SoundMesh. Sin servidores centrales, sin torres celulares y blindado con el estándar post-cuántico ML-KEM-768.
          </p>

          {/* Interactive Live DID Generator Card */}
          <div
            style={{
              width: "100%",
              maxWidth: "920px",
              padding: "26px",
              borderRadius: "24px",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(0, 240, 255, 0.4)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
              textAlign: "left",
              marginBottom: "40px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "22px" }}>🪪</span>
                <div>
                  <div style={{ fontWeight: 800, color: "#FFF", fontSize: "15px" }}>Generador de Identidad Soberana en Tiempo Real</div>
                  <div style={{ fontSize: "11px", color: "#00F0FF", fontFamily: "monospace" }}>ZERO-KNOWLEDGE • DERIVACIÓN ED25519 EN NAVEGADOR</div>
                </div>
              </div>
              <span style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "10px", background: "rgba(0, 255, 136, 0.15)", color: "#00FF88", fontFamily: "monospace", fontWeight: 700 }}>
                ✓ SIN TELÉFONO NI CORREO
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "14px" }}>
              <input
                type="text"
                value={heroAlias}
                onChange={(e) => handleHeroAliasChange(e.target.value)}
                placeholder="Escribe tu Alias Táctico..."
                style={{
                  padding: "14px 18px",
                  borderRadius: "12px",
                  background: "rgba(30, 41, 59, 0.8)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#FFF",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <button
                onClick={handleLaunchWithHeroAlias}
                style={{
                  padding: "14px 24px",
                  borderRadius: "12px",
                  background: "linear-gradient(90deg, #FF2A51 0%, #990014 100%)",
                  color: "#FFF",
                  fontWeight: 800,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(255, 42, 81, 0.4)",
                  whiteSpace: "nowrap",
                }}
              >
                ⚡ Entrar con este DID
              </button>
            </div>

            {/* Generated DID & Seed Preview Box */}
            <div style={{ background: "rgba(0,0,0,0.6)", padding: "14px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "#64748B", fontFamily: "monospace" }}>IDENTIFICADOR PÚBLICO (DID W3C):</span>
                <button
                  onClick={() => handleCopy(heroDidHash)}
                  style={{ background: "none", border: "none", color: "#00F0FF", fontSize: "11px", cursor: "pointer", fontFamily: "monospace" }}
                >
                  {copiedText === heroDidHash ? "✓ ¡Copiado!" : "📋 Copiar DID"}
                </button>
              </div>
              <div style={{ fontSize: "12px", color: "#00FF88", fontFamily: "monospace", wordBreak: "break-all" }}>
                {heroDidHash}
              </div>
              <div style={{ fontSize: "10px", color: "#94A3B8", marginTop: "4px" }}>
                Semilla Mnemónica: <span style={{ color: "#CBD5E1", fontFamily: "monospace" }}>{heroMnemonicSeed}</span>
              </div>
            </div>
          </div>

          {/* Hero Banner */}
          <div
            style={{
              width: "100%",
              maxWidth: "1180px",
              borderRadius: "24px",
              overflow: "hidden",
              border: "1px solid rgba(255, 42, 81, 0.3)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
              marginBottom: "20px",
              background: "linear-gradient(135deg, rgba(232, 33, 58, 0.15) 0%, rgba(10, 15, 30, 0.9) 100%)",
              minHeight: "180px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img 
              src={heroBannerUrl} 
              alt="RED Sovereign Mesh OS Banner" 
              style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }} 
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          </div>
        </section>
    );
};
