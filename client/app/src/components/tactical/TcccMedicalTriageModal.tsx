"use client";

import React, { useState, useEffect } from "react";
import {
  InsularTcccInteroceptionEngine,
  InteroceptionTelemetry,
  TcccCasualtyCard,
  TriageCategory
} from "../../lib/neuro/human/InsularTcccInteroceptionEngine";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacIcon } from "../ui/TacIcon";
import { toast } from "../Toast";

export interface TcccMedicalTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TcccMedicalTriageModal: React.FC<TcccMedicalTriageModalProps> = ({ isOpen, onClose }) => {
  const [telemetry, setTelemetry] = useState<InteroceptionTelemetry>(() => 
    InsularTcccInteroceptionEngine.getInstance().getTelemetry()
  );
  const [casualties, setCasualties] = useState<TcccCasualtyCard[]>(() => 
    InsularTcccInteroceptionEngine.getInstance().getCasualties()
  );
  const [activeTab, setActiveTab] = useState<'TRIAGE' | 'BREATHING'>('TRIAGE');
  const [newCallsign, setNewCallsign] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TriageCategory>('RED_IMMEDIATE');

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

  // Suscripción al motor insular TCCC
  useEffect(() => {
    if (!isOpen) return;
    const engine = InsularTcccInteroceptionEngine.getInstance();
    const unsub = engine.subscribe((telem) => {
      setTelemetry(telem);
      setCasualties(engine.getCasualties());
    });
    return unsub;
  }, [isOpen]);

  if (!isOpen) return null;

  const engine = InsularTcccInteroceptionEngine.getInstance();

  const handleCreateCasualty = () => {
    const callsign = newCallsign.trim() || `HERIDO-${casualties.length + 1}`;
    engine.registerCasualty(callsign, selectedCategory);
    setNewCallsign("");
    TacticalAudioEngine.playRogerBeep();
    toast.success(`Ficha TCCC creada para ${callsign}`);
  };

  const handleToggleBreathing = () => {
    if (telemetry.isBoxBreathingActive) {
      engine.stopBoxBreathing();
      TacticalAudioEngine.playTap();
      toast.info("Box Breathing pausado");
    } else {
      engine.startBoxBreathing();
      TacticalAudioEngine.playAlert();
      toast.info("Box Breathing (4-4-4-4) activado: sigue las vibraciones hápticas");
    }
  };

  const handleApplyTourniquet = (casualtyId: string, limb: 'BRAZO_IZQ' | 'BRAZO_DER' | 'PIERNA_IZQ' | 'PIERNA_DER') => {
    engine.applyTourniquet(casualtyId, limb);
    TacticalAudioEngine.playRogerBeep();
    toast.warning(`Torniquete aplicado en ${limb}. Cronómetro iniciado.`);
  };

  const handleBroadcastMist = async (casualtyId: string) => {
    const success = await engine.broadcastMistReport(casualtyId);
    if (success) {
      TacticalAudioEngine.playAlert();
      toast.success("Ficha médica MIST difundida por la malla táctica");
    } else {
      toast.error("Error al difundir ficha MIST");
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10500,
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        color: '#E0E7FF',
        fontFamily: 'monospace',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: '#0B0F19',
          borderBottom: '1px solid #1E293B'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ color: '#EF4444' }}>
            <TacIcon name="hazard" size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.90rem', fontWeight: 'bold', color: '#F8FAFC' }}>
              ÍNSULA ANTERIOR & PROTOCOLO TCCC • RED
            </div>
            <div style={{ fontSize: '0.65rem', color: '#EF4444' }}>
              TRIAGE MARCH, CONTROL DE ISQUEMIA & BOX BREATHING 4-4-4-4
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            TacticalAudioEngine.playTap();
            onClose();
          }}
          style={{
            background: 'transparent',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#94A3B8',
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem'
          }}
        >
          <TacIcon name="x" size={16} />
          CERRAR
        </button>
      </div>

      {/* Selector de pestañas */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1E293B', background: '#070B14' }}>
        <button
          onClick={() => {
            TacticalAudioEngine.playTap();
            setActiveTab('TRIAGE');
          }}
          style={{
            flex: 1,
            padding: '10px',
            background: activeTab === 'TRIAGE' ? '#0F172A' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'TRIAGE' ? '2px solid #EF4444' : 'none',
            color: activeTab === 'TRIAGE' ? '#F8FAFC' : '#64748B',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          TRIAGE MARCH & TORNIQUETES ({casualties.length})
        </button>

        <button
          onClick={() => {
            TacticalAudioEngine.playTap();
            setActiveTab('BREATHING');
          }}
          style={{
            flex: 1,
            padding: '10px',
            background: activeTab === 'BREATHING' ? '#0F172A' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'BREATHING' ? '2px solid #06B6D4' : 'none',
            color: activeTab === 'BREATHING' ? '#F8FAFC' : '#64748B',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          DESACELERACIÓN VAGAL (BOX BREATHING)
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px', margin: '0 auto', width: '100%' }}>
        
        {/* Alerta crítica de torniquete */}
        {telemetry.criticalTourniquetWarning && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.25)',
              border: '2px solid #EF4444',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#FEE2E2',
              animation: 'pulse 1.5s infinite'
            }}
          >
            <TacIcon name="hazard" size={24} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                ¡PELIGRO DE NECROSIS IRREVERSIBLE EN TORNIQUETE!
              </div>
              <div style={{ fontSize: '0.70rem', color: '#FCA5A5' }}>
                Un torniquete ha superado los 90 minutos. Evaluar conversión a vendaje hemostático compresivo o evacuación quirúrgica inmediata.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'TRIAGE' ? (
          <>
            {/* Formulario de registro rápido de baja */}
            <div
              style={{
                background: '#090D16',
                border: '1px solid #1E293B',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ fontSize: '0.70rem', color: '#64748B' }}>REGISTRAR NUEVA BAJA BAJO FUEGO</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Callsign / ID Herido..."
                  value={newCallsign}
                  onChange={(e) => setNewCallsign(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#0F172A',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#F8FAFC',
                    fontSize: '0.80rem',
                    outline: 'none'
                  }}
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as TriageCategory)}
                  style={{
                    background: '#0F172A',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px',
                    color: '#F8FAFC',
                    fontSize: '0.75rem',
                    outline: 'none'
                  }}
                >
                  <option value="RED_IMMEDIATE">🔴 ROJO (Inmediato)</option>
                  <option value="YELLOW_DELAYED">🟡 AMARILLO (Diferido)</option>
                  <option value="GREEN_MINIMAL">🟢 VERDE (Leve)</option>
                  <option value="BLACK_EXPECTANT">⚫ NEGRO (Expectante)</option>
                </select>
                <button
                  onClick={handleCreateCasualty}
                  style={{
                    background: '#7F1D1D',
                    border: '1px solid #EF4444',
                    borderRadius: '6px',
                    color: '#FEE2E2',
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  REGISTRAR
                </button>
              </div>
            </div>

            {/* Listado de tarjetas de bajas MARCH */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {casualties.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontSize: '0.80rem' }}>
                  No hay bajas registradas en el destacamento.
                </div>
              ) : (
                casualties.map((c) => (
                  <div
                    key={`cas-${c.casualtyId}`}
                    style={{
                      background: '#080C14',
                      border: `1px solid ${c.triageCategory === 'RED_IMMEDIATE' ? '#EF4444' : '#1E293B'}`,
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          background: c.triageCategory === 'RED_IMMEDIATE' ? '#7F1D1D' : '#1E293B',
                          color: c.triageCategory === 'RED_IMMEDIATE' ? '#FEE2E2' : '#94A3B8'
                        }}>
                          {c.triageCategory}
                        </span>
                        <span style={{ fontSize: '0.90rem', fontWeight: 'bold', color: '#F8FAFC' }}>
                          {c.callsign}
                        </span>
                      </div>

                      <button
                        onClick={() => handleBroadcastMist(c.casualtyId)}
                        style={{
                          background: '#1E293B',
                          border: '1px solid #475569',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          color: '#38BDF8',
                          fontSize: '0.65rem',
                          cursor: 'pointer'
                        }}
                      >
                        DIFUNDIR MIST (LoRa)
                      </button>
                    </div>

                    {/* Checkboxes protocolo MARCH */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', textAlign: 'center' }}>
                      <button
                        onClick={() => engine.updateMarchStatus(c.casualtyId, 'M', !c.massiveBleedingControlled)}
                        style={{
                          background: c.massiveBleedingControlled ? '#065F46' : '#7F1D1D',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 2px',
                          color: '#FFFFFF',
                          fontSize: '0.65rem',
                          cursor: 'pointer'
                        }}
                      >
                        [M] {c.massiveBleedingControlled ? 'OK' : 'SANGRADO'}
                      </button>

                      <button
                        onClick={() => engine.updateMarchStatus(c.casualtyId, 'A', !c.airwayPatent)}
                        style={{
                          background: c.airwayPatent ? '#065F46' : '#7F1D1D',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 2px',
                          color: '#FFFFFF',
                          fontSize: '0.65rem',
                          cursor: 'pointer'
                        }}
                      >
                        [A] {c.airwayPatent ? 'VÍA OK' : 'OBSTR'}
                      </button>

                      <button
                        onClick={() => engine.updateMarchStatus(c.casualtyId, 'R', !c.respirationStable)}
                        style={{
                          background: c.respirationStable ? '#065F46' : '#7F1D1D',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 2px',
                          color: '#FFFFFF',
                          fontSize: '0.65rem',
                          cursor: 'pointer'
                        }}
                      >
                        [R] {c.respirationStable ? 'RESP OK' : 'NEUMO'}
                      </button>

                      <button
                        onClick={() => engine.updateMarchStatus(c.casualtyId, 'C', !c.pulsePresent)}
                        style={{
                          background: c.pulsePresent ? '#065F46' : '#7F1D1D',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 2px',
                          color: '#FFFFFF',
                          fontSize: '0.65rem',
                          cursor: 'pointer'
                        }}
                      >
                        [C] {c.pulsePresent ? 'PULSO' : 'SHOCK'}
                      </button>

                      <button
                        onClick={() => engine.updateMarchStatus(c.casualtyId, 'H', !c.hypothermiaCovered)}
                        style={{
                          background: c.hypothermiaCovered ? '#065F46' : '#7F1D1D',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 2px',
                          color: '#FFFFFF',
                          fontSize: '0.65rem',
                          cursor: 'pointer'
                        }}
                      >
                        [H] {c.hypothermiaCovered ? 'MANTA' : 'FRÍO'}
                      </button>
                    </div>

                    {/* Sección de Torniquetes */}
                    <div style={{ background: '#0F172A', borderRadius: '6px', padding: '8px' }}>
                      <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginBottom: '6px' }}>
                        APLICACIÓN DE TORNIQUETES (TQ)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                        {(['BRAZO_IZQ', 'BRAZO_DER', 'PIERNA_IZQ', 'PIERNA_DER'] as const).map((limb) => (
                          <button
                            key={limb}
                            onClick={() => handleApplyTourniquet(c.casualtyId, limb)}
                            style={{
                              background: '#1E293B',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              padding: '4px',
                              color: '#E2E8F0',
                              fontSize: '0.60rem',
                              cursor: 'pointer'
                            }}
                          >
                            + TQ {limb.replace('_', ' ')}
                          </button>
                        ))}
                      </div>

                      {/* Lista de torniquetes activos */}
                      {c.tourniquets.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {c.tourniquets.map((tq) => (
                            <div
                              key={tq.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '4px 8px',
                                background: tq.isApproachingNecrosisRisk ? 'rgba(239, 68, 68, 0.20)' : '#1E293B',
                                borderLeft: `3px solid ${tq.isApproachingNecrosisRisk ? '#EF4444' : '#10B981'}`,
                                borderRadius: '2px',
                                fontSize: '0.65rem'
                              }}
                            >
                              <span>{tq.limbLocation}</span>
                              <span style={{ fontWeight: 'bold', color: tq.isApproachingNecrosisRisk ? '#EF4444' : '#10B981' }}>
                                TIEMPO: {tq.elapsedMinutes} MIN {tq.isApproachingNecrosisRisk ? '(¡ALERTA NECROSIS!)' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Pestaña de Box Breathing (4-4-4-4) */
          <div
            style={{
              background: '#090D16',
              border: '1px solid #1E293B',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              textAlign: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#F8FAFC' }}>
                DESACELERACIÓN VAGAL GUIADA POR HÁPTICA
              </div>
              <div style={{ fontSize: '0.70rem', color: '#94A3B8', marginTop: '4px' }}>
                Respiración cuadrada (4-4-4-4) para suprimir visión de túnel, temblor simpático y taquicardia bajo fuego.
              </div>
            </div>

            {/* Círculo de pulsación respiratoria */}
            <div
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                border: '3px solid #06B6D4',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: telemetry.isBoxBreathingActive ? 'rgba(6, 182, 212, 0.10)' : 'transparent',
                transition: 'all 0.5s ease',
                boxShadow: telemetry.isBoxBreathingActive ? '0 0 25px rgba(6, 182, 212, 0.3)' : 'none'
              }}
            >
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#38BDF8' }}>
                {telemetry.boxBreathingPhase}
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#F8FAFC', marginTop: '4px' }}>
                {telemetry.phaseSecondsRemaining}s
              </div>
            </div>

            <button
              onClick={handleToggleBreathing}
              style={{
                background: telemetry.isBoxBreathingActive ? '#7F1D1D' : '#065F46',
                border: `1px solid ${telemetry.isBoxBreathingActive ? '#EF4444' : '#10B981'}`,
                borderRadius: '8px',
                color: '#FFFFFF',
                padding: '12px 24px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <TacIcon name={telemetry.isBoxBreathingActive ? "pause" as any : "zap"} size={18} />
              {telemetry.isBoxBreathingActive ? "DETENER BOX BREATHING" : "INICIAR RITMO VAGAL HÁPTICO"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
