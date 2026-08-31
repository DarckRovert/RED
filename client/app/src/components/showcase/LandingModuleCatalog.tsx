'use client';

import React, { useState, useMemo } from 'react';
import { TacticalModule } from './types';
import { TACTICAL_MODULES_CATALOG } from './catalogData';
import { useTranslation } from '../../lib/i18n/i18nEngine';

interface LandingModuleCatalogProps {
    onEnterApp: () => void;
}

export const LandingModuleCatalog: React.FC<LandingModuleCatalogProps> = ({ onEnterApp }) => {
    const { t } = useTranslation();
    const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
    const [moduleSearch, setModuleSearch] = useState<string>("");
    const [selectedModuleDetail, setSelectedModuleDetail] = useState<TacticalModule | null>(null);

    const categoriesList = useMemo(() => {
        const cats = Array.from(new Set(TACTICAL_MODULES_CATALOG.map((m) => m.category)));
        return ["Todos", ...cats];
    }, []);

    const filteredModules = useMemo(() => {
        return TACTICAL_MODULES_CATALOG.filter((m) => {
            const matchesCat = selectedCategory === "Todos" || m.category === selectedCategory;
            const matchesSearch =
                m.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
                m.summary.toLowerCase().includes(moduleSearch.toLowerCase()) ||
                m.details.toLowerCase().includes(moduleSearch.toLowerCase()) ||
                m.techStack.toLowerCase().includes(moduleSearch.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [selectedCategory, moduleSearch]);

    return (
        <section id="modules" style={{ padding: "70px 0 80px", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "5px 14px",
                borderRadius: "20px",
                background: "rgba(0, 229, 255, 0.12)",
                color: "#00E5FF",
                border: "1px solid rgba(0, 229, 255, 0.3)",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 800,
                letterSpacing: "1px"
              }}
            >
              SUITE OPERATIVA COMPLETA • 49 MÓDULOS ACTIVOS
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "12px", letterSpacing: "-0.5px" }}>
              Catálogo de Módulos Tácticos & Resiliencia
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
              Explora e inspecciona los 49 sistemas autónomos integrados en RED OS: interoperabilidad ATAK CoT, puente LoRa Meshtastic con voz Vocoder, criptografía post-cuántica, cartografía sin conexión y sensores de silicio.
            </p>
          </div>

          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px" }}>
            {/* Category Filter Pills & Search Input */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "JetBrains Mono, monospace",
                      border: selectedCategory === cat ? "1.5px solid #00E5FF" : "1px solid rgba(255,255,255,0.08)",
                      background: selectedCategory === cat ? "rgba(0, 229, 255, 0.2)" : "rgba(14, 18, 34, 0.7)",
                      color: selectedCategory === cat ? "#FFF" : "#94A3B8",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div style={{ width: "100%", maxWidth: "720px", position: "relative" }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar por nombre, stack técnico (Rust, BLE, LoRa, PQC) o palabra clave..."
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    borderRadius: "14px",
                    background: "rgba(14, 18, 34, 0.9)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#FFF",
                    fontSize: "14px",
                    outline: "none",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.5)"
                  }}
                />
                <div style={{ position: "absolute", right: "16px", top: "14px", fontSize: "11px", color: "#00E676", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                  {filteredModules.length} de {TACTICAL_MODULES_CATALOG.length} Módulos
                </div>
              </div>
            </div>

            {/* Modules Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "18px" }}>
              {filteredModules.map((mod) => (
                <div
                  key={mod.id}
                  onClick={() => setSelectedModuleDetail(mod)}
                  style={{
                    padding: "22px",
                    borderRadius: "18px",
                    background: "rgba(14, 18, 34, 0.8)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.6)";
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = "0 12px 30px rgba(0, 229, 255, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "#00E5FF", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                        {mod.category}
                      </span>
                      <span style={{ fontSize: "16px" }}>{mod.icon || "⚙️"}</span>
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 900, color: "#FFF", marginBottom: "6px" }}>
                      {mod.name}
                    </div>
                    <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.5 }}>
                      {mod.summary}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace", marginBottom: "8px" }}>
                      {mod.techStack}
                    </div>
                    <div style={{ fontSize: "12px", color: "#00FF88", fontWeight: 800, display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>Inspeccionar Ficha Técnica</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Module Detail Modal */}
          {selectedModuleDetail && (
            <div
              style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.85)",
                backdropFilter: "blur(12px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 9999, padding: "20px"
              }}
              onClick={() => setSelectedModuleDetail(null)}
            >
              <div
                style={{
                  maxWidth: "600px", width: "100%",
                  background: "linear-gradient(180deg, rgba(18, 24, 44, 0.98) 0%, rgba(8, 12, 24, 0.99) 100%)",
                  borderRadius: "24px", border: "1.5px solid rgba(0, 229, 255, 0.4)",
                  padding: "32px", position: "relative",
                  boxShadow: "0 25px 80px rgba(0,0,0,0.9)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedModuleDetail(null)}
                  style={{
                    position: "absolute", top: "20px", right: "20px",
                    background: "rgba(255,255,255,0.08)", border: "none",
                    color: "#FFF", borderRadius: "50%", width: 32, height: 32,
                    cursor: "pointer", fontSize: "16px"
                  }}
                >
                  ✕
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "28px" }}>{selectedModuleDetail.icon || "⚙️"}</span>
                  <div>
                    <div style={{ fontSize: "20px", fontWeight: 900, color: "#FFF" }}>{selectedModuleDetail.name}</div>
                    <div style={{ fontSize: "11px", color: "#00E5FF", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                      CATEGORÍA: {selectedModuleDetail.category.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "14px", color: "#CBD5E1", lineHeight: 1.6, marginBottom: "20px" }}>
                  {selectedModuleDetail.details}
                </div>

                <div style={{ padding: "14px", borderRadius: "14px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "24px" }}>
                  <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>STACK & PROTOCOLO TÉCNICO:</div>
                  <div style={{ fontSize: "13px", color: "#00FF88", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginTop: "4px" }}>
                    {selectedModuleDetail.techStack}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => {
                      setSelectedModuleDetail(null);
                      onEnterApp();
                    }}
                    style={{
                      flex: 1, padding: "14px", borderRadius: "12px",
                      background: "linear-gradient(135deg, #00FF88 0%, #00F0FF 100%)",
                      color: "#050B14", fontWeight: 900, fontSize: "14px",
                      border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,255,136,0.3)"
                    }}
                  >
                    🚀 Abrir Módulo en Web App
                  </button>
                  <button
                    onClick={() => setSelectedModuleDetail(null)}
                    style={{
                      padding: "14px 20px", borderRadius: "12px",
                      background: "rgba(255,255,255,0.06)", color: "#FFF",
                      border: "1px solid rgba(255,255,255,0.15)", fontWeight: 700,
                      fontSize: "13px", cursor: "pointer"
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
    );
};
