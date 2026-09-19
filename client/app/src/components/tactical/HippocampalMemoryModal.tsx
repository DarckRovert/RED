"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  HippocampalEpisodicEngine, 
  EpisodicEngram, 
  HippocampalTelemetry, 
  ReconstructedPacket 
} from "../../lib/neuro/human/HippocampalEpisodicEngine";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";

interface HippocampalMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HippocampalMemoryModal: React.FC<HippocampalMemoryModalProps> = ({ isOpen, onClose }) => {
  const hippocampal = useMemo(() => HippocampalEpisodicEngine.getInstance(), []);
  const [telemetry, setTelemetry] = useState<HippocampalTelemetry>(() => hippocampal.getTelemetry());
  const [engrams, setEngrams] = useState<EpisodicEngram[]>(() => hippocampal.getStoredEngrams());
  const [activeTab, setActiveTab] = useState<'engrams' | 'patternCompletion'>('engrams');

  // Simulador de Pattern Completion
  const [corruptInput, setCorruptInput] = useState<string>('{"type":"TCCC_MIST_REPORT","casualtyId":"CAS-');
  const [testResult, setTestResult] = useState<ReconstructedPacket | null>(null);

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
    const unsub = hippocampal.subscribe((t) => {
      setTelemetry(t);
      setEngrams(hippocampal.getStoredEngrams());
    });
    return () => { unsub(); };
  }, [hippocampal]);

  if (!isOpen) return null;

  const handleRunPatternCompletion = () => {
    TacticalAudioEngine.playTap();
    const res = hippocampal.attemptPatternCompletion({
      rawFragment: corruptInput,
      corruptedFields: ["payload"],
    });
    setTestResult(res);
    if (res.isSuccessfullyReconstructed) {
      TacticalAudioEngine.playMessageReceived();
    } else {
      TacticalAudioEngine.playWarning();
    }
  };

  const handleSeedSampleEngram = () => {
    TacticalAudioEngine.playTap();
    hippocampal.memorizePacket({
      id: `ENGRAM-TCCC-${Date.now().toString().slice(-4)}`,
      senderPeerId: "TACTICAL-MEDIC-01",
      channel: "TACTICAL_EMERGENCY",
      payloadType: "TCCC_MIST_REPORT",
      geohashPrefix: "6gyf4",
      summary: "Casualty CAS-994: Blast fragmentation, CAT Tourniquet applied on left thigh",
    });
    setEngrams(hippocampal.getStoredEngrams());
    TacticalAudioEngine.playRogerBeep();
  };

  const handleClearAllEngrams = () => {
    TacticalAudioEngine.playTap();
    hippocampal.clearAllEngrams();
    setEngrams([]);
    setTestResult(null);
    TacticalAudioEngine.playWarning();
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
          boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 25px rgba(59, 130, 246, 0.15)",
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
            <span style={{ fontSize: "1.3rem" }}>🧬</span>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#3B82F6", letterSpacing: "1px" }}>
                HIPOCAMPO CA3/DG (MEMORIA AUTOASOCIATIVA)
              </div>
              <div style={{ fontSize: "0.70rem", color: "#94A3B8" }}>
                Reconstrucción de Tramas por Pattern Completion • Engramas: <strong style={{ color: "#FFF" }}>{telemetry.totalStoredEngrams}</strong> • Éxitos: <strong style={{ color: "#10B981" }}>{telemetry.patternCompletionsCount}</strong>
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
            { key: 'engrams', label: `🧠 ENGRAMAS EN MEMORIA (${engrams.length})` },
            { key: 'patternCompletion', label: '⚡ PATTERN COMPLETION (SIMULADOR)' },
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
                borderBottom: activeTab === tab.key ? "2px solid #3B82F6" : "2px solid transparent",
                color: activeTab === tab.key ? "#3B82F6" : "#64748B",
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
          
          {/* TAB 1: ENGRAMAS */}
          {activeTab === 'engrams' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "0.72rem", color: "#94A3B8", background: "#060A14", padding: "10px", borderRadius: "8px", border: "1px solid #1E293B" }}>
                Cada engrama es un vector disperso de 1024 bits generado por el Giro Dentado (DG). Almacena el recuerdo episódico de paquetes transmitidos por la malla para rescate ante jamming RF.
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                  Engramas Activos: <strong style={{ color: "#FFF" }}>{engrams.length}</strong>
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleSeedSampleEngram}
                    style={{
                      padding: "6px 12px",
                      background: "#1E293B",
                      border: "1px solid #3B82F6",
                      borderRadius: "6px",
                      color: "#60A5FA",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    🌱 SEMBRAR ENGRAMA DE PRUEBA
                  </button>
                  {engrams.length > 0 && (
                    <button
                      onClick={handleClearAllEngrams}
                      style={{
                        padding: "6px 12px",
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        borderRadius: "6px",
                        color: "#F87171",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🗑️ LIMPIAR MEMORIA CA3
                    </button>
                  )}
                </div>
              </div>

              {engrams.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 20px", color: "#64748B", fontSize: "0.78rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", background: "#060A14", borderRadius: "8px", border: "1px dashed #1E293B" }}>
                  <div>Aún no hay engramas almacenados en la memoria episódica.</div>
                  <button
                    onClick={handleSeedSampleEngram}
                    style={{
                      padding: "8px 16px",
                      background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                      border: "none",
                      borderRadius: "6px",
                      color: "#FFF",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    🌱 SEMBRAR ENGRAMA TCCC PARA PRUEBAS
                  </button>
                </div>
              ) : (
                engrams.map((engram) => (
                  <div
                    key={engram.id}
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
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#3B82F6" }}>{engram.id}</span>
                      <span style={{ fontSize: "0.68rem", color: "#94A3B8" }}>
                        Canal: <strong style={{ color: "#38BDF8" }}>{engram.channel}</strong> • Accesos: {engram.accessCount}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.70rem", color: "#CBD5E1" }}>
                      Emisor: {engram.senderPeerId.slice(0, 16)}... • Tipo: {engram.payloadType}
                    </div>

                    <div style={{ fontSize: "0.68rem", color: "#64748B", fontFamily: "monospace" }}>
                      Resumen: {engram.summary}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: PATTERN COMPLETION */}
          {activeTab === 'patternCompletion' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                Introduce un fragmento dañado, mutilado o truncado de un paquete. La red recurrente de Hopfield (CA3) computará la similitud de solapamiento de bits y reconstruirá la trama completa.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.72rem", color: "#CBD5E1", fontWeight: 700 }}>Fragmento Mutilado (Input):</label>
                <textarea
                  rows={4}
                  value={corruptInput}
                  onChange={(e) => setCorruptInput(e.target.value)}
                  style={{
                    background: "#080E1A",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    color: "#FFF",
                    padding: "10px",
                    fontSize: "0.75rem",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              <button
                onClick={handleRunPatternCompletion}
                style={{
                  padding: "10px",
                  background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                  border: "none",
                  borderRadius: "6px",
                  color: "#FFF",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  letterSpacing: "0.8px",
                }}
              >
                EJECUTAR RECONSTRUCCIÓN RECURRENTE CA3
              </button>

              {testResult && (
                <div
                  style={{
                    background: testResult.isSuccessfullyReconstructed ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    border: testResult.isSuccessfullyReconstructed ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "8px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: testResult.isSuccessfullyReconstructed ? "#10B981" : "#EF4444" }}>
                      {testResult.isSuccessfullyReconstructed ? "✅ PAQUETE RECONSTRUIDO CON ÉXITO" : "❌ CONFIANZA INSUFICIENTE (< 70%)"}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "#FFF" }}>
                      Confianza: <strong style={{ color: testResult.isSuccessfullyReconstructed ? "#10B981" : "#EF4444" }}>{Math.round(testResult.reconstructionConfidence * 100)}%</strong>
                    </span>
                  </div>

                  <div style={{ fontSize: "0.70rem", color: "#94A3B8" }}>
                    Engrama Asociado: {testResult.associatedEngramId} • Pasos de Iteración: {testResult.iterationSteps}
                  </div>

                  {testResult.restoredPacket && (
                    <div style={{ background: "#050811", padding: "10px", borderRadius: "6px", fontSize: "0.70rem", color: "#E2E8F0" }}>
                      <div>Emisor: {testResult.restoredPacket.senderPeerId}</div>
                      <div>Canal: {testResult.restoredPacket.channel}</div>
                      <div style={{ marginTop: "4px", color: "#38BDF8" }}>Cuerpo Decodificado: {testResult.restoredPacket.decodedSummary}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
