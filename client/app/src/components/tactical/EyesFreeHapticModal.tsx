"use client";

import React, { useState, useEffect } from "react";
import { ringAttractor, RingAttractorTelemetry } from "../../lib/neuro/RingAttractorEngine";
import { fanShapedBody, FanShapedBodyTelemetry } from "../../lib/neuro/FanShapedBodyEngine";
import { tacticalMotorActuator, TacticalMotorActuatorTelemetry } from "../../lib/neuro/TacticalMotorActuatorEngine";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacIcon } from "../ui/TacIcon";
import { toast } from "../Toast";

export interface EyesFreeHapticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EyesFreeHapticModal: React.FC<EyesFreeHapticModalProps> = ({ isOpen, onClose }) => {
  const [compass, setCompass] = useState<RingAttractorTelemetry>(() => ringAttractor.getTelemetry());
  const [fb, setFb] = useState<FanShapedBodyTelemetry>(() => fanShapedBody.getTelemetry());
  const [motor, setMotor] = useState<TacticalMotorActuatorTelemetry>(() => tacticalMotorActuator.getTelemetry());
  const [targetMode, setTargetMode] = useState<'HOME' | 'GOAL'>('HOME');
  const [isBlackoutActive, setIsBlackoutActive] = useState<boolean>(false);

  // Registro de botón Atrás LIFO
  useEffect(() => {
    if (!isOpen) return;
    const unregister = BackHandlerRegistry.register(() => {
      TacticalAudioEngine.playTap();
      if (isBlackoutActive) {
        setIsBlackoutActive(false);
        return true;
      }
      onClose();
      return true;
    });
    return unregister;
  }, [isOpen, isBlackoutActive, onClose]);

  // Suscripciones reactivas
  useEffect(() => {
    if (!isOpen) return;
    const unSubC = ringAttractor.subscribe(setCompass);
    const unSubFb = fanShapedBody.subscribe(setFb);
    const unSubM = tacticalMotorActuator.subscribe(setMotor);
    return () => {
      unSubC();
      unSubFb();
      unSubM();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Pantalla en Negro Absoluto (OLED Blackout / Sigilo Táctico)
  if (isBlackoutActive) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 20000,
          background: '#000000', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none', WebkitUserSelect: 'none'
        }}
        onClick={() => {
          TacticalAudioEngine.playTap();
          setIsBlackoutActive(false);
          toast.info("Pantalla táctica reactivada");
        }}
      >
        <div style={{ opacity: 0.05, fontSize: '0.70rem', color: '#FFFFFF', textAlign: 'center', fontFamily: 'monospace' }}>
          MODO SIGILO TOTAL • TOCA CUALQUIER PARTE PARA SALIR
        </div>
      </div>
    );
  }

  const errorDeg = motor.steeringErrorDeg;
  const isAligned = Math.abs(errorDeg) <= 15;
  const activeDistance = targetMode === 'HOME' ? fb.homeVector.distanceMeters : (fb.goalVector.hasTarget ? fb.goalVector.distanceMeters : 0);
  const activeBearing = targetMode === 'HOME' ? fb.homeVector.bearingDeg : (fb.goalVector.hasTarget ? fb.goalVector.bearingDeg : 0);
  const activeCardinal = targetMode === 'HOME' ? fb.homeVector.cardinal : 'OBJ';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(2, 4, 12, 0.90)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: '520px',
          background: 'linear-gradient(135deg, rgba(14, 20, 42, 0.98) 0%, rgba(6, 10, 24, 0.99) 100%)',
          border: '1.5px solid rgba(0, 229, 255, 0.3)',
          boxShadow: '0 0 35px rgba(0, 229, 255, 0.15), 0 10px 40px rgba(0,0,0,0.9)',
          borderRadius: '16px', padding: '20px',
          color: '#FFFFFF', fontFamily: 'JetBrains Mono, monospace',
          display: 'flex', flexDirection: 'column', gap: '16px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>📳</span>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, letterSpacing: '0.5px' }}>
                GUÍA HÁPTICA OJOS-LIBRES (DNa01/02)
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                Navegación Táctica por Vibración • Disciplina de Luz Total
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '32px', height: '32px', color: '#94A3B8' }}>
            <TacIcon name="x" size={18} />
          </button>
        </div>

        {/* Selector de Destino */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { TacticalAudioEngine.playTap(); setTargetMode('HOME'); }}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              background: targetMode === 'HOME' ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: `1.5px solid ${targetMode === 'HOME' ? '#00E5FF' : 'rgba(255, 255, 255, 0.1)'}`,
              color: targetMode === 'HOME' ? '#00E5FF' : '#94A3B8',
              fontSize: '0.76rem', fontWeight: 900, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'
            }}
          >
            <span>HOME VECTOR (RETORNO)</span>
            <span style={{ fontSize: '0.66rem', color: '#E2E8F0' }}>
              {fb.homeVector.distanceMeters}m rumbo {fb.homeVector.bearingDeg}° ({fb.homeVector.cardinal})
            </span>
          </button>

          <button
            onClick={() => {
              TacticalAudioEngine.playTap();
              if (!fb.goalVector.hasTarget) {
                toast.info("Fija un objetivo en el mapa táctico primero");
              } else {
                setTargetMode('GOAL');
              }
            }}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              background: targetMode === 'GOAL' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: `1.5px solid ${targetMode === 'GOAL' ? '#00E676' : 'rgba(255, 255, 255, 0.1)'}`,
              color: targetMode === 'GOAL' ? '#00E676' : '#94A3B8',
              fontSize: '0.76rem', fontWeight: 900, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'
            }}
          >
            <span>OBJETIVO TÁCTICO (FB)</span>
            <span style={{ fontSize: '0.66rem', color: '#E2E8F0' }}>
              {fb.goalVector.hasTarget ? `${fb.goalVector.distanceMeters}m hacia ${fb.goalVector.bearingDeg}°` : 'Sin objetivo fijado'}
            </span>
          </button>
        </div>

        {/* Visualizador de Timoneo en Tiempo Real */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.5)', borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
        }}>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>
            Desvío de Rumbo ({targetMode}):
          </div>

          <div style={{
            fontSize: '1.8rem', fontWeight: 900,
            color: isAligned ? '#00E676' : errorDeg > 0 ? '#FFB300' : '#00E5FF',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            {isAligned ? (
              <span>✓ RUMBO ALINEADO</span>
            ) : errorDeg > 0 ? (
              <span>+{Math.abs(errorDeg)}° ESTRIBOR →</span>
            ) : (
              <span>← BABOR {Math.abs(errorDeg)}°</span>
            )}
          </div>

          {/* Barra de Error de Timoneo */}
          <div style={{
            width: '100%', height: '10px', background: 'rgba(255,255,255,0.1)',
            borderRadius: '5px', position: 'relative', overflow: 'hidden'
          }}>
            {/* Zona Verde Centro (-15° a +15°) */}
            <div style={{
              position: 'absolute', left: 'calc(50% - 8.33%)', width: '16.66%',
              height: '100%', background: 'rgba(0, 230, 118, 0.35)'
            }} />
            {/* Indicador de Desvío */}
            <div style={{
              position: 'absolute',
              left: `${Math.max(0, Math.min(100, 50 + (errorDeg / 180) * 50))}%`,
              top: 0, bottom: 0, width: '4px',
              background: isAligned ? '#00E676' : '#FF3355',
              boxShadow: `0 0 8px ${isAligned ? '#00E676' : '#FF3355'}`,
              transform: 'translateX(-50%)'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.62rem', color: '#64748B' }}>
            <span>-180° Babor Total</span>
            <span>0° Rumbo Óptimo</span>
            <span>+180° Estribor Total</span>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.70rem' }}>
            <span style={{ color: '#94A3B8' }}>DNa01 (Babor): <b style={{ color: '#00E5FF' }}>{motor.dna01IpsilateralExcitation.toFixed(2)}</b></span>
            <span style={{ color: '#94A3B8' }}>DNa02 (Estribor): <b style={{ color: '#FFB300' }}>{motor.dna02ContralateralExcitation.toFixed(2)}</b></span>
          </div>
        </div>

        {/* Panel de Pruebas y Calibración de Patrones Hápticos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 800 }}>
            TEST Y CALIBRACIÓN DE PATRONES HÁPTICOS:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);
                toast.info("Pulso Alineado: 40ms suave");
              }}
              style={{
                background: 'rgba(0, 230, 118, 0.12)', border: '1px solid #00E676',
                borderRadius: '8px', padding: '8px 4px', color: '#00E676',
                fontSize: '0.68rem', fontWeight: 900, cursor: 'pointer'
              }}
            >
              Alineado (40ms)
            </button>

            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([40, 60, 40]);
                toast.info("Babor: Doble pulso");
              }}
              style={{
                background: 'rgba(0, 229, 255, 0.12)', border: '1px solid #00E5FF',
                borderRadius: '8px', padding: '8px 4px', color: '#00E5FF',
                fontSize: '0.68rem', fontWeight: 900, cursor: 'pointer'
              }}
            >
              Babor (Doble)
            </button>

            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(140);
                toast.info("Estribor: Pulso largo");
              }}
              style={{
                background: 'rgba(255, 179, 0, 0.12)', border: '1px solid #FFB300',
                borderRadius: '8px', padding: '8px 4px', color: '#FFB300',
                fontSize: '0.68rem', fontWeight: 900, cursor: 'pointer'
              }}
            >
              Estribor (Largo)
            </button>

            <button
              onClick={() => {
                TacticalAudioEngine.playTap();
                tacticalMotorActuator.triggerEmergencyBurst();
                toast.error("Alerta Looming / GFS (Ráfaga)");
              }}
              style={{
                background: 'rgba(255, 30, 64, 0.15)', border: '1px solid #FF1E40',
                borderRadius: '8px', padding: '8px 4px', color: '#FF1E40',
                fontSize: '0.68rem', fontWeight: 900, cursor: 'pointer'
              }}
            >
              Alerta Ráfaga
            </button>
          </div>
        </div>

        {/* Botón de Sigilo Total / Pantalla Oscura */}
        <button
          onClick={() => {
            TacticalAudioEngine.playRogerBeep();
            setIsBlackoutActive(true);
          }}
          style={{
            background: 'linear-gradient(135deg, #111827 0%, #000000 100%)',
            border: '1.5px solid #FF3355', color: '#FF3355',
            borderRadius: '10px', padding: '12px',
            fontSize: '0.82rem', fontWeight: 900, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: '0 0 20px rgba(255, 51, 85, 0.2)'
          }}
        >
          <span>🌑 ACTIVAR SIGILO TOTAL (PANTALLA OSCURA OLED)</span>
        </button>
      </div>
    </div>
  );
};
