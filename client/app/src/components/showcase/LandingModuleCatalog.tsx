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

    const handleEnter = onEnterApp;

    return (
        <section id="modules" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(0, 229, 255, 0.15)",
                color: "#00E5FF",
                border: "1px solid rgba(0, 229, 255, 0.3)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              {t.showcase_landing?.catalog_title || "CATÁLOGO DE MÓDULOS TÁCTICOS"}
            </span>
            <h2 style={{ fontSize: "36px", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px" }}>
              Centro de Operaciones Tácticas
            </h2>
            <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "780px", margin: "0 auto", lineHeight: 1.6 }}>
              Haz clic en cualquier módulo para abrir su ficha técnica con especificaciones de latencia, protocolo de cifrado y arquitectura de transporte.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: selectedCategory === cat ? "1px solid #FF2A51" : "1px solid rgba(255,255,255,0.1)",
                    background: selectedCategory === cat ? "rgba(255, 42, 81, 0.2)" : "rgba(15,23,42,0.6)",
                    color: selectedCategory === cat ? "#FFF" : "#94A3B8",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Buscar por módulo, stack (BLE, Rust, PQC, SOS) o algoritmo de cifrado..."
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              style={{
                width: "100%",
                maxWidth: "700px",
                margin: "0 auto",
                padding: "14px 20px",
                borderRadius: "14px",
                background: "rgba(15,23,42,0.85)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#FFF",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "18px" }}>
            {filteredModules.map((mod) => (
              <div
                key={mod.id}
                onClick={() => setSelectedModuleDetail(mod)}
                style={{
                  padding: "20px",
                  borderRadius: "16px",
                  background: "rgba(15,23,42,0.75)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 42, 81, 0.5)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.transform = "translateY(0px)";
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <span style={{ fontSize: "28px" }}>{mod.icon}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        background: "rgba(0,240,255,0.15)",
                        color: "#00F0FF",
                        border: "1px solid rgba(0,240,255,0.3)",
                        fontFamily: "monospace",
                        fontWeight: 700,
                      }}
                    >
                      {mod.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>{mod.name}</div>
                  <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: 1.5, marginBottom: "12px" }}>{mod.summary}</div>
                </div>
                <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "monospace", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}>
                  <span>⚙️ {mod.techStack}</span>
                  <span style={{ color: "#00FF88" }}>{mod.latency}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Module Drawer Modal */}
          {selectedModuleDetail && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 200,
                background: "rgba(0,0,0,0.85)",
                backdropFilter: "blur(16px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
              }}
              onClick={() => setSelectedModuleDetail(null)}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "560px",
                  background: "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(3,5,8,0.99) 100%)",
                  border: "1px solid rgba(255, 42, 81, 0.4)",
                  borderRadius: "24px",
                  padding: "30px",
                  boxShadow: "0 25px 60px rgba(0,0,0,0.9)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "36px" }}>{selectedModuleDetail.icon}</span>
                    <div>
                      <div style={{ fontSize: "20px", fontWeight: 900, color: "#FFF" }}>{selectedModuleDetail.name}</div>
                      <div style={{ fontSize: "11px", color: "#00F0FF", fontFamily: "monospace" }}>{selectedModuleDetail.category}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedModuleDetail(null)}
                    style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "18px", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6, marginBottom: "20px" }}>
                  {selectedModuleDetail.details}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
                  <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "monospace" }}>LATENCIA ESTIMADA</div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#00FF88", marginTop: "4px" }}>{selectedModuleDetail.latency}</div>
                  </div>
                  <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "monospace" }}>CAPA DE CIFRADO</div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#B026FF", marginTop: "4px" }}>{selectedModuleDetail.encryption}</div>
                  </div>
                </div>

                <button
                  onClick={handleEnter}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "linear-gradient(90deg, #FF2A51 0%, #990014 100%)",
                    color: "#FFF",
                    fontWeight: 800,
                    fontSize: "14px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ⚡ Abrir Módulo en la Bóveda Web
                </button>
              </div>
            </div>
          )}
        </section>
    );
};
