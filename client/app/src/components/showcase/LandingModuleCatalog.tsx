'use client';

import React, { useState, useMemo } from 'react';
import { TacticalModule } from './types';
import { TACTICAL_MODULES_CATALOG } from './catalogData';
import { useTranslation } from '../../lib/i18n/i18nEngine';
import { ScreenView } from '../../store/types';

export const CATALOG_TO_SCREEN_MAP: Record<string, ScreenView> = {
    nodemap: 'nodemap',
    offGridCompass: 'offGridCompass',
    tacticalCompass: 'compass',
    celestialPdr: 'celestialPdr',
    cursorOnTarget: 'c4isrEmpDrill',
    ballistics4Dof: 'tcccBallistics',
    tacticalFoxhunt: 'tacticalFoxhunt',
    sonarSeismic: 'sonarSeismic',
    canvas: 'canvas',
    liveStream: 'liveStream',
    weather: 'weather',
    tacticalCadViewer: 'canvas',
    channels: 'channels',
    walkie: 'walkie',
    broadcast: 'broadcast',
    socialFeed: 'socialFeed',
    pqcCrypto: 'crypto',
    loraMeshtasticBridge: 'loraTransceiver',
    loraTransceiver: 'loraTransceiver',
    soundMeshAcoustic: 'acousticWarfare',
    network: 'network',
    nearby: 'nearby',
    loraTdmaScheduler: 'loraTransceiver',
    geohashSpatialRouting: 'nodemap',
    esp32SolarRepeater: 'ecoMesh',
    leoSatelliteGateway: 'cbrnSatellite',
    globalShield: 'globalShield',
    rfSpectrum: 'rfSpectrum',
    acousticWarfare: 'acousticWarfare',
    blackout: 'blackout',
    dms: 'dms',
    security: 'security',
    calculator: 'calculator',
    stegoVault: 'stegoVault',
    zeroTrust: 'security',
    vitalScan: 'vitalScan',
    opticalRppgTriage: 'vitalScan',
    cbrnRadiationCmos: 'cbrnSatellite',
    cbrnSatellite: 'cbrnSatellite',
    tcccBallistics: 'tcccBallistics',
    survivalBeacon: 'survivalBeacon',
    amber: 'amber',
    dms_emergency: 'dms',
    emergencyGlossary: 'survivalBeacon',
    commercialHub: 'commercialHub',
    depinPaymentRails: 'p2pPay',
    p2pPay: 'p2pPay',
    web3Vault: 'web3Vault',
    idVault: 'idVault',
    explorer: 'explorer',
    appStore: 'appStore',
    backup: 'backup',
    webCompanionLink: 'webCompanionLink',
    aiCopilot: 'aiCopilot',
    guardian: 'guardian',
    ecoMesh: 'ecoMesh',
    swarmHealthHUD: 'swarmHealthHUD',
    hyperBrowser: 'hyperBrowser',
    shakePair: 'shakePair',
    updater: 'updater',
    health: 'health',
    nodeLogs: 'nodeLogs'
};

interface LandingModuleCatalogProps {
    onEnterApp: (targetScreen?: ScreenView) => void;
}

export const LandingModuleCatalog: React.FC<LandingModuleCatalogProps> = ({ onEnterApp }) => {
    const { t } = useTranslation();
    const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
    const [moduleSearch, setModuleSearch] = useState<string>("");
    const [selectedModuleDetail, setSelectedModuleDetail] = useState<TacticalModule | null>(null);

    const categoriesWithCount = useMemo(() => {
        const counts: Record<string, number> = {};
        TACTICAL_MODULES_CATALOG.forEach((m) => {
            counts[m.category] = (counts[m.category] || 0) + 1;
        });
        const list = Object.entries(counts).map(([name, count]) => ({ name, count }));
        return [{ name: "Todos", count: TACTICAL_MODULES_CATALOG.length }, ...list];
    }, []);

    const quickFilters = ["PQC", "LoRa", "ATAK", "rPPG", "Rust", "Sensores", "DePIN", "Off-Grid"];

    const filteredModules = useMemo(() => {
        return TACTICAL_MODULES_CATALOG.filter((m) => {
            const matchesCat = selectedCategory === "Todos" || m.category === selectedCategory;
            const searchLower = moduleSearch.toLowerCase();
            const matchesSearch =
                !moduleSearch ||
                m.name.toLowerCase().includes(searchLower) ||
                m.summary.toLowerCase().includes(searchLower) ||
                m.details.toLowerCase().includes(searchLower) ||
                m.techStack.toLowerCase().includes(searchLower) ||
                m.category.toLowerCase().includes(searchLower) ||
                m.badge.toLowerCase().includes(searchLower) ||
                m.encryption.toLowerCase().includes(searchLower);
            return matchesCat && matchesSearch;
        });
    }, [selectedCategory, moduleSearch]);

    return (
        <section id="modules" style={{ padding: "70px 0 80px", position: "relative" }}>
          {/* Secondary Anchor for #modules57 / #modules62 */}
          <div id="modules57" style={{ position: "absolute", top: 0, left: 0, height: 1, width: 1, pointerEvents: "none" }} />
          <div id="modules62" style={{ position: "absolute", top: 0, left: 0, height: 1, width: 1, pointerEvents: "none" }} />

          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "6px 16px",
                borderRadius: "20px",
                background: "rgba(0, 229, 255, 0.12)",
                color: "#00E5FF",
                border: "1px solid rgba(0, 229, 255, 0.35)",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 800,
                letterSpacing: "1.2px"
              }}
            >
              SUITE OPERATIVA COMPLETA • 62 MÓDULOS ACTIVOS EN 6 PILARES
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4.2vw, 42px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "12px", letterSpacing: "-0.6px" }}>
              Catálogo de Módulos Tácticos & Resiliencia
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "860px", margin: "0 auto", lineHeight: 1.65 }}>
              Explora los 62 subsistemas integrados de RED OS: interoperabilidad ATAK CoT v2.0, planificador LoRa TDMA anti-colisiones, enrutamiento geoespacial Geohash DTN, repetidores solares autónomos ESP32-S3, pasarela satelital LEO, criptografía híbrida Post-Cuántica ML-KEM-768 y visor CAD vectorial 4K.
            </p>
          </div>

          <div style={{ maxWidth: "1360px", margin: "0 auto", padding: "0 16px" }}>
            {/* Category Filter Pills & Search Input */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                {categoriesWithCount.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "JetBrains Mono, monospace",
                      border: selectedCategory === cat.name ? "1.5px solid #00E5FF" : "1px solid rgba(255,255,255,0.08)",
                      background: selectedCategory === cat.name ? "rgba(0, 229, 255, 0.2)" : "rgba(14, 18, 34, 0.7)",
                      color: selectedCategory === cat.name ? "#FFF" : "#94A3B8",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span>{cat.name}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "1px 6px",
                        borderRadius: "10px",
                        background: selectedCategory === cat.name ? "#00E5FF" : "rgba(255,255,255,0.1)",
                        color: selectedCategory === cat.name ? "#040814" : "#CBD5E1",
                        fontWeight: 900
                      }}
                    >
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Quick Search and Filter Tags */}
              <div style={{ width: "100%", maxWidth: "780px", position: "relative" }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar por nombre, protocolo (Rust, LoRa, PQC, BLE, rPPG) o tecnología..."
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

              {/* Quick Filter Tag Buttons */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{ fontSize: "11px", color: "#64748B", fontFamily: "JetBrains Mono, monospace", alignSelf: "center" }}>
                  Filtros Rápidos:
                </span>
                {quickFilters.map((qf) => (
                  <button
                    key={qf}
                    onClick={() => setModuleSearch(moduleSearch === qf ? "" : qf)}
                    style={{
                      fontSize: "11px",
                      padding: "3px 10px",
                      borderRadius: "8px",
                      background: moduleSearch === qf ? "rgba(0, 230, 118, 0.25)" : "rgba(255, 255, 255, 0.05)",
                      border: moduleSearch === qf ? "1px solid #00E676" : "1px solid rgba(255, 255, 255, 0.1)",
                      color: moduleSearch === qf ? "#00E676" : "#94A3B8",
                      fontFamily: "JetBrains Mono, monospace",
                      cursor: "pointer"
                    }}
                  >
                    #{qf}
                  </button>
                ))}
                {moduleSearch && (
                  <button
                    onClick={() => setModuleSearch("")}
                    style={{
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "8px",
                      background: "rgba(255, 42, 81, 0.15)",
                      border: "1px solid rgba(255, 42, 81, 0.3)",
                      color: "#FF2A51",
                      cursor: "pointer",
                      fontFamily: "JetBrains Mono, monospace"
                    }}
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Modules Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "18px" }}>
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
                        {mod.category.split('&')[0]}
                      </span>
                      <span style={{ fontSize: "18px" }}>{mod.icon || "⚙️"}</span>
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 900, color: "#FFF", marginBottom: "6px" }}>
                      {mod.name}
                    </div>
                    <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.5 }}>
                      {mod.summary}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "10.5px", fontFamily: "JetBrains Mono, monospace" }}>
                      <span style={{ color: "#64748B" }}>Lat: <span style={{ color: "#00FF88" }}>{mod.latency}</span></span>
                      <span style={{ color: "#64748B" }}>Cifrado: <span style={{ color: "#C084FC" }}>{mod.encryption.split(' ')[0]}</span></span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace", marginBottom: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                  maxWidth: "640px", width: "100%",
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

                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "32px" }}>{selectedModuleDetail.icon || "⚙️"}</span>
                  <div>
                    <div style={{ fontSize: "21px", fontWeight: 900, color: "#FFF" }}>{selectedModuleDetail.name}</div>
                    <div style={{ fontSize: "11px", color: "#00E5FF", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                      CATEGORÍA: {selectedModuleDetail.category.toUpperCase()} • {selectedModuleDetail.badge}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "14.5px", color: "#CBD5E1", lineHeight: 1.65, marginBottom: "20px" }}>
                  {selectedModuleDetail.details}
                </div>

                {/* Metrics Box */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    marginBottom: "16px"
                  }}
                >
                  <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>LATENCIA OPERATIVA:</div>
                    <div style={{ fontSize: "13px", color: "#00E676", fontWeight: 800, fontFamily: "JetBrains Mono, monospace", marginTop: "2px" }}>
                      {selectedModuleDetail.latency}
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>BLINDAJE CRIPTOGRÁFICO:</div>
                    <div style={{ fontSize: "13px", color: "#C084FC", fontWeight: 800, fontFamily: "JetBrains Mono, monospace", marginTop: "2px" }}>
                      {selectedModuleDetail.encryption}
                    </div>
                  </div>
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
                      const target = CATALOG_TO_SCREEN_MAP[selectedModuleDetail.id] || 'sidebar';
                      setSelectedModuleDetail(null);
                      onEnterApp(target);
                    }}
                    style={{
                      flex: 1, padding: "14px", borderRadius: "12px",
                      background: "linear-gradient(135deg, #00FF88 0%, #00F0FF 100%)",
                      color: "#050B14", fontWeight: 900, fontSize: "14px",
                      border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,255,136,0.3)"
                    }}
                  >
                    🚀 Abrir Módulo en RED OS
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
