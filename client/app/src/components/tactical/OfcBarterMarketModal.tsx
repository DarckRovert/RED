"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  OrbitofrontalValuationEngine, 
  SurvivalCommodity, 
  COMMODITY_SPECS, 
  BarterContract, 
  OrbitofrontalTelemetry 
} from "../../lib/neuro/human/OrbitofrontalValuationEngine";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";

interface OfcBarterMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfcBarterMarketModal: React.FC<OfcBarterMarketModalProps> = ({ isOpen, onClose }) => {
  const ofc = useMemo(() => OrbitofrontalValuationEngine.getInstance(), []);
  const [telemetry, setTelemetry] = useState<OrbitofrontalTelemetry>(() => ofc.getTelemetry());
  const [contracts, setContracts] = useState<BarterContract[]>(() => ofc.getContracts());
  const [activeTab, setActiveTab] = useState<'matrix' | 'propose' | 'contracts' | 'inventory'>('matrix');

  // Formulario de propuesta
  const [offeredComm, setOfferedComm] = useState<SurvivalCommodity>('RATION_MRE_KCAL');
  const [offeredQty, setOfferedQty] = useState<number>(2);
  const [requestedComm, setRequestedComm] = useState<SurvivalCommodity>('AMMO_556_9MM_ROUNDS');
  const [requestedQty, setRequestedQty] = useState<number>(30);
  const [peerNodeId, setPeerNodeId] = useState<string>('PEER-BROADCAST');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Registro del botón físico de Atrás en Android (LIFO)
  useEffect(() => {
    if (!isOpen) return;
    const unregister = BackHandlerRegistry.register(() => {
      TacticalAudioEngine.playTap();
      onClose();
      return true;
    });
    return unregister;
  }, [isOpen, onClose]);

  useEffect(() => {
    const unsub = ofc.subscribe((t) => {
      setTelemetry(t);
      setContracts(ofc.getContracts());
    });
    return () => { unsub(); };
  }, [ofc]);

  if (!isOpen) return null;

  const commodities: SurvivalCommodity[] = [
    'WATER_POTABLE_L',
    'RATION_MRE_KCAL',
    'AMMO_556_9MM_ROUNDS',
    'MED_ANTIBIOTIC_DOSE',
    'ENERGY_BATTERY_WH',
    'FUEL_GASOLINE_L',
    'COMMS_FILTER_SPARES',
  ];

  // Cálculo en vivo del ratio de intercambio propuesto vs justo
  const fairRatio = ofc.computeFairExchangeRatio(offeredComm, requestedComm);
  const proposedRatio = offeredQty / Math.max(0.0001, requestedQty);
  const isFairOrFavorable = proposedRatio >= (fairRatio * 0.85);

  const handleProposeTrade = async () => {
    setIsBroadcasting(true);
    try {
      const contract = await ofc.evaluateTradeProposal(
        'SELF',
        peerNodeId,
        offeredComm,
        offeredQty,
        requestedComm,
        requestedQty
      );
      await ofc.broadcastTradeProposal(contract);
      setContracts(ofc.getContracts());
      setActiveTab('contracts');
    } catch (e) {
      console.warn('[OFC Modal] Error al proponer trueque:', e);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleAcceptContract = async (contractId: string) => {
    await ofc.broadcastContractAccept(contractId);
    ofc.settleContract(contractId);
    setContracts(ofc.getContracts());
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(2, 4, 10, 0.92)",
        backdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: "'JetBrains Mono', monospace",
        color: "#F1F5F9",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "840px",
          maxHeight: "92vh",
          background: "linear-gradient(180deg, #090E17 0%, #04070D 100%)",
          border: "1px solid #1E293B",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 25px rgba(20, 184, 166, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            background: "#0F172A",
            borderBottom: "1px solid #1E293B",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.3rem" }}>⚖️</span>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#14B8A6", letterSpacing: "1px" }}>
                MERCADO DE TRUEQUE OFC (ECONOMÍA DE ASIEDO)
              </div>
              <div style={{ fontSize: "0.70rem", color: "#94A3B8" }}>
                Corteza Orbitofrontal • Paridad Subjetiva Sin Dinero Fiduciario • Autarquía: <strong style={{ color: "#38BDF8" }}>{telemetry.autarkyDaysRemaining} días</strong>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              TacticalAudioEngine.playTap();
              onClose();
            }}
            style={{
              background: "#1E293B",
              border: "none",
              color: "#94A3B8",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", borderBottom: "1px solid #1E293B", background: "#050811" }}>
          {[
            { key: 'matrix', label: '📊 PARIDADES DE TRUEQUE' },
            { key: 'propose', label: '🤝 PROPONER INTERCAMBIO' },
            { key: 'contracts', label: `📜 CONTRATOS (${contracts.length})` },
            { key: 'inventory', label: '📦 RESERVA & ALMACÉN' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                TacticalAudioEngine.playTap();
                setActiveTab(tab.key as any);
              }}
              style={{
                flex: 1,
                padding: "10px 4px",
                background: activeTab === tab.key ? "#0B132B" : "transparent",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #14B8A6" : "2px solid transparent",
                color: activeTab === tab.key ? "#14B8A6" : "#64748B",
                fontSize: "0.72rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div style={{ padding: "18px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* TAB 1: PARIDADES DE TRUEQUE */}
          {activeTab === 'matrix' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "0.75rem", color: "#94A3B8", background: "#060A14", padding: "10px", borderRadius: "8px", border: "1px solid #1E293B" }}>
                Valuación marginal calculada por la ley de Gossen neuromórfica en base al consumo del escuadrón (4 operadores) y días de meta de reserva (14 días).
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" }}>
                {commodities.map((comm) => {
                  const spec = COMMODITY_SPECS[comm];
                  const stock = telemetry.localInventory[comm] || 0;
                  const scarcity = telemetry.scarcityMultipliers[comm] || 1.0;
                  const relVal = telemetry.unitValuations[comm] || 1.0;

                  return (
                    <div
                      key={comm}
                      style={{
                        background: "#080E1A",
                        border: "1px solid #1E293B",
                        borderRadius: "8px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#E2E8F0" }}>{spec.name}</span>
                        <span style={{ fontSize: "0.68rem", color: scarcity > 2.0 ? "#EF4444" : "#10B981", fontWeight: 700 }}>
                          {scarcity > 2.0 ? `ESCASEZ ${scarcity.toFixed(1)}x` : `NOMINAL`}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.70rem", color: "#94A3B8" }}>
                        Stock Local: <strong style={{ color: "#FFF" }}>{stock} {spec.unit}</strong>
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#64748B" }}>
                        Equivalencia Subjetiva: <strong style={{ color: "#14B8A6" }}>{relVal.toFixed(2)}x Agua Potable</strong>
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "#475569" }}>
                        Prioridad Biológica Base: {spec.baseWeightPriority}/10
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: PROPONER INTERCAMBIO */}
          {activeTab === 'propose' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {/* Lo que ofreces */}
                <div style={{ background: "#080E1A", border: "1px solid #1E293B", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#38BDF8" }}>⬆️ BIEN OFRECIDO (MI STOCK)</span>
                  <label style={{ fontSize: "0.70rem", color: "#94A3B8" }}>Recurso:</label>
                  <select
                    value={offeredComm}
                    onChange={(e) => setOfferedComm(e.target.value as any)}
                    style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: "6px", color: "#FFF", padding: "8px", fontSize: "0.75rem", fontFamily: "inherit" }}
                  >
                    {commodities.map((c) => (
                      <option key={c} value={c}>{COMMODITY_SPECS[c].name} ({telemetry.localInventory[c] || 0} disponibles)</option>
                    ))}
                  </select>

                  <label style={{ fontSize: "0.70rem", color: "#94A3B8" }}>Cantidad a entregar:</label>
                  <input
                    type="number"
                    min="1"
                    max={telemetry.localInventory[offeredComm] || 999}
                    value={offeredQty}
                    onChange={(e) => setOfferedQty(Math.max(1, Number(e.target.value)))}
                    style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: "6px", color: "#FFF", padding: "8px", fontSize: "0.85rem", fontFamily: "inherit" }}
                  />
                </div>

                {/* Lo que pides */}
                <div style={{ background: "#080E1A", border: "1px solid #1E293B", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#F59E0B" }}>⬇️ BIEN DEMANDADO (DEL PAR)</span>
                  <label style={{ fontSize: "0.70rem", color: "#94A3B8" }}>Recurso:</label>
                  <select
                    value={requestedComm}
                    onChange={(e) => setRequestedComm(e.target.value as any)}
                    style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: "6px", color: "#FFF", padding: "8px", fontSize: "0.75rem", fontFamily: "inherit" }}
                  >
                    {commodities.map((c) => (
                      <option key={c} value={c}>{COMMODITY_SPECS[c].name}</option>
                    ))}
                  </select>

                  <label style={{ fontSize: "0.70rem", color: "#94A3B8" }}>Cantidad solicitada:</label>
                  <input
                    type="number"
                    min="1"
                    value={requestedQty}
                    onChange={(e) => setRequestedQty(Math.max(1, Number(e.target.value)))}
                    style={{ background: "#0F172A", border: "1px solid #334155", borderRadius: "6px", color: "#FFF", padding: "8px", fontSize: "0.85rem", fontFamily: "inherit" }}
                  />
                </div>
              </div>

              {/* Dictamen OFC */}
              <div
                style={{
                  background: isFairOrFavorable ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  border: isFairOrFavorable ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, color: isFairOrFavorable ? "#10B981" : "#EF4444" }}>
                    {isFairOrFavorable ? "✅ TRATO JUSTO / EQUILIBRADO SEGÚN OFC" : "⚠️ TRATO DESFAVORABLE O LEONINO"}
                  </span>
                  <span style={{ fontSize: "0.70rem", color: "#94A3B8" }}>
                    Ratio Propuesto: <strong>{proposedRatio.toFixed(2)}</strong> vs Paridad Justa: <strong>{fairRatio.toFixed(2)}</strong>
                  </span>
                </div>
                <div style={{ fontSize: "0.68rem", color: "#CBD5E1" }}>
                  {isFairOrFavorable 
                    ? "La paridad cumple el criterio de reposición biológica de supervivencia para ambas unidades."
                    : "El intercambio exige ceder más valor del que recibirás considerando tus reservas actuales."}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.70rem", color: "#94A3B8" }}>ID / DID del Destinatario (o DIFUSIÓN ABIERTA):</label>
                <input
                  type="text"
                  value={peerNodeId}
                  onChange={(e) => setPeerNodeId(e.target.value)}
                  style={{ background: "#080E1A", border: "1px solid #334155", borderRadius: "6px", color: "#FFF", padding: "8px", fontSize: "0.75rem", fontFamily: "inherit" }}
                />
              </div>

              <button
                disabled={isBroadcasting}
                onClick={handleProposeTrade}
                style={{
                  padding: "12px",
                  background: isBroadcasting ? "#334155" : "linear-gradient(135deg, #0D9488 0%, #059669 100%)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFF",
                  fontSize: "0.80rem",
                  fontWeight: 800,
                  cursor: isBroadcasting ? "default" : "pointer",
                  letterSpacing: "1px",
                  boxShadow: "0 0 15px rgba(20, 184, 166, 0.3)",
                }}
              >
                {isBroadcasting ? "TRANSMITIENDO POR MALLA RF..." : "FIRMAR Y EMITIR PROPUESTA POR LA MALLA"}
              </button>
            </div>
          )}

          {/* TAB 3: CONTRATOS REGISTRADOS */}
          {activeTab === 'contracts' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {contracts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#64748B", fontSize: "0.78rem" }}>
                  No hay contratos de trueque registrados en este nodo.
                </div>
              ) : (
                contracts.map((contract) => (
                  <div
                    key={contract.contractId}
                    style={{
                      background: "#080E1A",
                      border: "1px solid #1E293B",
                      borderRadius: "8px",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#14B8A6" }}>{contract.contractId}</span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: contract.status === 'SETTLED' ? "#10B98122" : contract.status === 'ACCEPTED' ? "#38BDF822" : "#F59E0B22",
                          color: contract.status === 'SETTLED' ? "#10B981" : contract.status === 'ACCEPTED' ? "#38BDF8" : "#F59E0B",
                        }}
                      >
                        {contract.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.72rem", color: "#CBD5E1" }}>
                      Ofrecido: <strong style={{ color: "#38BDF8" }}>{contract.offeredQuantity} {COMMODITY_SPECS[contract.offeredCommodity]?.name}</strong> → 
                      A cambio de: <strong style={{ color: "#F59E0B" }}>{contract.requestedQuantity} {COMMODITY_SPECS[contract.requestedCommodity]?.name}</strong>
                    </div>

                    <div style={{ fontSize: "0.65rem", color: "#64748B" }}>
                      Par: {contract.peerNodeId} • Fecha: {new Date(contract.timestamp).toLocaleTimeString()}
                    </div>

                    {contract.status !== 'SETTLED' && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                        <button
                          onClick={() => handleAcceptContract(contract.contractId)}
                          style={{
                            flex: 1,
                            padding: "6px",
                            background: "#059669",
                            border: "none",
                            borderRadius: "4px",
                            color: "#FFF",
                            fontSize: "0.70rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          ACEPTAR Y ASENTAR EN ALMACÉN
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: RESERVA & ALMACÉN */}
          {activeTab === 'inventory' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                Ajusta las cantidades físicas contadas en tu almacén o mochila de supervivencia.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {commodities.map((comm) => (
                  <div
                    key={comm}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#080E1A",
                      border: "1px solid #1E293B",
                      borderRadius: "6px",
                      padding: "10px 14px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#E2E8F0" }}>{COMMODITY_SPECS[comm].name}</div>
                      <div style={{ fontSize: "0.68rem", color: "#64748B" }}>Unidad: {COMMODITY_SPECS[comm].unit}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="number"
                        min="0"
                        value={telemetry.localInventory[comm] || 0}
                        onChange={(e) => ofc.updateLocalStock(comm, Number(e.target.value))}
                        style={{
                          width: "80px",
                          background: "#0F172A",
                          border: "1px solid #334155",
                          borderRadius: "4px",
                          color: "#FFF",
                          padding: "6px",
                          fontSize: "0.80rem",
                          fontFamily: "inherit",
                          textAlign: "right",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
