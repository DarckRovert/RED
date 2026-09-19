"use client";

import React, { useState, useEffect } from "react";
import {
  TheoryOfMindEpistemicEngine,
  TheoryOfMindTelemetry,
  EpistemicAssessment
} from "../../lib/neuro/human/TheoryOfMindEpistemicEngine";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacIcon } from "../ui/TacIcon";
import { toast } from "../Toast";

export interface EpistemicRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EpistemicRadarModal: React.FC<EpistemicRadarModalProps> = ({ isOpen, onClose }) => {
  const [telemetry, setTelemetry] = useState<TheoryOfMindTelemetry>(() => 
    TheoryOfMindEpistemicEngine.getInstance().getTelemetry()
  );
  const [assessments, setAssessments] = useState<EpistemicAssessment[]>(() => 
    TheoryOfMindEpistemicEngine.getInstance().getAllAssessments()
  );

  // Registro de botón Atrás en Android (LIFO)
  useEffect(() => {
    if (!isOpen) return;
    const unregister = BackHandlerRegistry.register(() => {
      TacticalAudioEngine.playTap();
      onClose();
      return true;
    });
    return unregister;
  }, [isOpen, onClose]);

  // Suscripción reactiva al motor ToM
  useEffect(() => {
    if (!isOpen) return;
    const engine = TheoryOfMindEpistemicEngine.getInstance();
    const unsub = engine.subscribe((telem) => {
      setTelemetry(telem);
      setAssessments(engine.getAllAssessments());
    });
    return unsub;
  }, [isOpen]);

  if (!isOpen) return null;

  const engine = TheoryOfMindEpistemicEngine.getInstance();

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
          <div style={{ color: '#F59E0B' }}>
            <TacIcon name="shield" size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.90rem', fontWeight: 'bold', color: '#F8FAFC' }}>
              TEORÍA DE LA MENTE • RADAR EPISTÉMICO
            </div>
            <div style={{ fontSize: '0.65rem', color: '#F59E0B' }}>
              DETECCIÓN DE DECEPCIÓN RF, EMBOSCADAS & NODOS HONEY-POT
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

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px', margin: '0 auto', width: '100%' }}>
        
        {/* Banner de alerta de emboscada / decepción activa */}
        {telemetry.activeAmbushAlertsCount > 0 && (
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
              animation: 'pulse 1.2s infinite'
            }}
          >
            <TacIcon name="hazard" size={26} />
            <div>
              <div style={{ fontSize: '0.90rem', fontWeight: 'bold' }}>
                ¡ALERTA CRÍTICA DE EMBOSCADA DETECTADA ({telemetry.activeAmbushAlertsCount} NODOS SOSPECHOSOS)!
              </div>
              <div style={{ fontSize: '0.70rem', color: '#FCA5A5', marginTop: '2px' }}>
                {telemetry.lastAlertDetails || 'Discrepancia física extrema entre distancia anunciada y potencia RSSI real.'}
              </div>
            </div>
          </div>
        )}

        {/* Métricas de confianza global de la malla */}
        <div
          style={{
            background: '#090D16',
            border: '1px solid #1E293B',
            borderRadius: '8px',
            padding: '14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            textAlign: 'center'
          }}
        >
          <div>
            <div style={{ fontSize: '0.60rem', color: '#64748B' }}>NODOS AUDITADOS</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#F8FAFC' }}>
              {telemetry.totalPeersAudited}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.60rem', color: '#64748B' }}>ALIADOS VERIF.</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#10B981' }}>
              {telemetry.verifiedAlliesCount}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.60rem', color: '#64748B' }}>ANOMALÍAS</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: telemetry.suspiciousNodesCount > 0 ? '#F59E0B' : '#94A3B8' }}>
              {telemetry.suspiciousNodesCount}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.60rem', color: '#64748B' }}>CONFIANZA RED</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: telemetry.meanNetworkTrustScore >= 0.7 ? '#10B981' : '#EF4444' }}>
              {Math.round(telemetry.meanNetworkTrustScore * 100)}%
            </div>
          </div>
        </div>

        {/* Explicación de la Física Log-Distance Path Loss */}
        <div
          style={{
            background: '#0B0F19',
            border: '1px solid #1E293B',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '0.70rem',
            color: '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <TacIcon name="radio" size={16} />
          <div>
            <span style={{ color: '#F8FAFC', fontWeight: 'bold' }}>Física de Validación:</span> Si un nodo afirma estar a 800m pero su RSSI medido es -62 dBm, o viceversa, la teoría de la mente clasifica el paquete como trampa/spoofing y bloquea el señuelo.
          </div>
        </div>

        {/* Lista de Pares Auditados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.70rem', color: '#64748B' }}>
            REGISTRO EPISTÉMICO DE PARES ({assessments.length})
          </div>

          {assessments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontSize: '0.80rem' }}>
              No se han recibido paquetes RF de pares para auditar en esta sesión.
            </div>
          ) : (
            assessments.map((a) => {
              const isHostile = a.status === 'DECEPTION_AMBUSH_ALERT';
              const isSuspicious = a.status === 'SUSPICIOUS_ANOMALY';
              const borderColor = isHostile ? '#EF4444' : isSuspicious ? '#F59E0B' : '#1E293B';

              return (
                <div
                  key={`peer-${a.peerId}`}
                  style={{
                    background: '#090D16',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        background: isHostile ? '#7F1D1D' : isSuspicious ? '#78350F' : '#065F46',
                        color: isHostile ? '#FEE2E2' : isSuspicious ? '#FEF3C7' : '#ECFDF5'
                      }}>
                        {a.status}
                      </span>
                      <span style={{ fontWeight: 'bold', color: '#F8FAFC', fontSize: '0.85rem' }}>
                        {a.peerId}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.80rem', fontWeight: 'bold', color: a.trustScore >= 0.7 ? '#10B981' : '#EF4444' }}>
                      CONFIANZA: {Math.round(a.trustScore * 100)}%
                    </div>
                  </div>

                  {/* Datos RF y Cinemáticos */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '0.65rem', color: '#94A3B8' }}>
                    <div>
                      DISTANCIA: <span style={{ color: '#F8FAFC', fontWeight: 'bold' }}>{Math.round(a.lastObservedDistanceMeters)}m</span>
                    </div>
                    <div>
                      RSSI MEDIDO: <span style={{ color: '#F8FAFC', fontWeight: 'bold' }}>{a.actualRssiMeasured} dBm</span>
                    </div>
                    <div>
                      RSSI TEÓRICO: <span style={{ color: '#94A3B8' }}>{Math.round(a.expectedRssiEstimate)} dBm</span>
                    </div>
                  </div>

                  {/* Velocidad */}
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8' }}>
                    VELOCIDAD CINEMÁTICA: <span style={{ color: a.kinematicSpeedMps > 30 ? '#EF4444' : '#38BDF8', fontWeight: 'bold' }}>
                      {(a.kinematicSpeedMps * 3.6).toFixed(1)} km/h ({a.kinematicSpeedMps.toFixed(1)} m/s)
                    </span>
                  </div>

                  {/* Motivos de anomalía si existen */}
                  {a.anomalyReasons.length > 0 && (
                    <div style={{ background: '#1E1B2E', padding: '6px 8px', borderRadius: '4px', fontSize: '0.65rem', color: '#FCA5A5' }}>
                      ⚠️ {a.anomalyReasons.join(' • ')}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
