import React from 'react';
import { RED_VERSION } from '../../lib/version';

interface LandingHeaderProps {
    activeSection: string;
    scrollToSection: (id: string) => void;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    telemetryNodes: number;
    cryptoEpoch: number;
    fps: number;
    onEnterApp: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({
    activeSection,
    scrollToSection,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    telemetryNodes,
    cryptoEpoch,
    fps,
    onEnterApp
}) => {
    const navItems = [
        { id: "hero", label: "Inicio" },
        { id: "how-it-works", label: "¿Cómo Funciona?" },
        { id: "architecture", label: "Arquitectura" },
        { id: "scenarios", label: "Escenarios" },
        { id: "calculator", label: "Calculadora" },
        { id: "bento", label: "Pilares" },
        { id: "matrix-comparison", label: "Benchmark" },
        { id: "live-mesh-demo", label: "Malla en Vivo" },
        { id: "modules", label: "Módulos (49)" },
        { id: "contribute", label: "Contribuir" },
        { id: "download", label: "Descarga" },
        { id: "faq", label: "FAQ & Legal" },
    ];

    const handleEnter = onEnterApp;

    return (
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(20px)",
          background: "rgba(3, 5, 8, 0.92)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "10px clamp(20px, 3.5vw, 48px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div
          onClick={() => scrollToSection("hero")}
          style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #FF2A51 0%, #8A0016 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              boxShadow: "0 0 20px rgba(255, 42, 81, 0.6)",
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 900, color: "#FFF", letterSpacing: "1px" }}>
              RED <span style={{ color: "#FF2A51" }}>OS</span>
            </div>
            <div style={{ fontSize: "10px", color: "#00F0FF", fontFamily: "monospace", fontWeight: 700 }}>
              SOVEREIGN MESH • v{RED_VERSION}
            </div>
          </div>
        </div>

        {/* Live HUD Telemetry Strip */}
        <div
          style={{
            display: "none",
            alignItems: "center",
            gap: "14px",
            background: "rgba(15, 23, 42, 0.7)",
            padding: "6px 14px",
            borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
          className="desktop-telemetry"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF88", boxShadow: "0 0 8px #00FF88" }} />
            <span style={{ color: "#00FF88", fontWeight: 700 }}>MALLA ACTIVA</span>
          </div>
          <div style={{ color: "#64748B" }}>|</div>
          <div>
            <span style={{ color: "#94A3B8" }}>TESTS:</span> <span style={{ color: "#00FF88", fontWeight: 700 }}>248/248 PASS</span>
          </div>
          <div style={{ color: "#64748B" }}>|</div>
          <div>
            <span style={{ color: "#94A3B8" }}>VOCODER:</span> <span style={{ color: "#00E5FF", fontWeight: 700 }}>1.2 kbps</span>
          </div>
          <div style={{ color: "#64748B" }}>|</div>
          <div>
            <span style={{ color: "#94A3B8" }}>PQC FIPS:</span> <span style={{ color: "#B026FF", fontWeight: 700 }}>203/204</span>
          </div>
          <div style={{ color: "#64748B" }}>|</div>
          <div>
            <span style={{ color: "#94A3B8" }}>RENDER:</span> <span style={{ color: "#FFB800", fontWeight: 700 }}>{fps} FPS</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav style={{ display: "flex", gap: "2px", alignItems: "center" }} className="desktop-nav">
          {navItems.slice(0, 10).map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollToSection(tab.id)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: activeSection === tab.id ? "1px solid #FF2A51" : "1px solid transparent",
                background: activeSection === tab.id ? "rgba(255, 42, 81, 0.18)" : "transparent",
                color: activeSection === tab.id ? "#FFF" : "#94A3B8",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right CTA Button & Mobile Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div className="hidden-mobile-sponsor" style={{ display: "flex", alignItems: "center" }}>
            <iframe
              src="https://github.com/sponsors/DarckRovert/button"
              title="Sponsor DarckRovert"
              height="32"
              width="114"
              style={{
                border: 0,
                borderRadius: "6px",
                verticalAlign: "middle",
              }}
            />
          </div>

          <a
            href={`https://github.com/DarckRovert/RED/releases/download/v${RED_VERSION}/red-latest.apk`}
            style={{
              padding: "7px 14px",
              borderRadius: "10px",
              background: "rgba(0, 255, 136, 0.12)",
              border: "1px solid rgba(0, 255, 136, 0.35)",
              color: "#00FF88",
              fontWeight: 800,
              fontSize: "12px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>📥</span> APK
          </a>

          <button
            onClick={handleEnter}
            style={{
              padding: "7px 16px",
              borderRadius: "10px",
              background: "linear-gradient(90deg, #FF2A51 0%, #990014 100%)",
              color: "#FFF",
              fontWeight: 800,
              fontSize: "13px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(255, 42, 81, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🚀</span> Iniciar Web Companion
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#FFF",
              fontSize: "18px",
              cursor: "pointer",
            }}
            className="mobile-hamburger"
          >
            {isMobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "rgba(6, 10, 18, 0.98)",
              backdropFilter: "blur(24px)",
              borderBottom: "1px solid rgba(255, 42, 81, 0.3)",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.9)",
            }}
          >
            {navItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  scrollToSection(tab.id);
                  setIsMobileMenuOpen(false);
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: activeSection === tab.id ? "1px solid #FF2A51" : "1px solid rgba(255,255,255,0.05)",
                  background: activeSection === tab.id ? "rgba(255, 42, 81, 0.2)" : "rgba(255,255,255,0.02)",
                  color: activeSection === tab.id ? "#FFF" : "#94A3B8",
                  fontSize: "13px",
                  fontWeight: 700,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}

            <div style={{ padding: "8px 0 4px", display: "flex", justifyContent: "center" }}>
              <iframe
                src="https://github.com/sponsors/DarckRovert/button"
                title="Sponsor DarckRovert"
                height="32"
                width="114"
                style={{
                  border: 0,
                  borderRadius: "6px",
                }}
              />
            </div>
          </div>
        )}
      </header>
    );
};
