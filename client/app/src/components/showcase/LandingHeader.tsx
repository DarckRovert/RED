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
        { id: "bento", label: "Pilares" },
        { id: "live-mesh-demo", label: "Malla en Vivo" },
        { id: "matrix-comparison", label: "Comparativa" },
        { id: "modules", label: "Módulos (20)" },
        { id: "packet-inspector", label: "Laboratorio" },
        { id: "use-cases", label: "Escenarios" },
        { id: "architecture", label: "Arquitectura" },
        { id: "download", label: "Descarga" },
        { id: "faq", label: "FAQ" },
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
          padding: "10px 24px",
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
            <span style={{ color: "#94A3B8" }}>NODOS:</span> <span style={{ color: "#00F0FF", fontWeight: 700 }}>{telemetryNodes}</span>
          </div>
          <div style={{ color: "#64748B" }}>|</div>
          <div>
            <span style={{ color: "#94A3B8" }}>PQC ÉPOCA:</span> <span style={{ color: "#B026FF", fontWeight: 700 }}>#{cryptoEpoch}</span>
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
          <button
            onClick={handleEnter}
            style={{
              padding: "10px 18px",
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
            <span>⚡</span> Bóveda Web
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              display: "none",
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
            ☰
          </button>
        </div>
      </header>
    );
};
