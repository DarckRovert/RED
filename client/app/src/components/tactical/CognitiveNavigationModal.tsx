"use client";

import React, { useState, useEffect, useRef } from "react";
import { EntorhinalGridCellEngine, EntorhinalTelemetry, CognitiveWaypoint } from "../../lib/neuro/human/EntorhinalGridCellEngine";
import { ringAttractor, RingAttractorTelemetry } from "../../lib/neuro/RingAttractorEngine";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacIcon } from "../ui/TacIcon";
import { toast } from "../Toast";

export interface CognitiveNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CognitiveNavigationModal: React.FC<CognitiveNavigationModalProps> = ({ isOpen, onClose }) => {
  const [telemetry, setTelemetry] = useState<EntorhinalTelemetry>(() => 
    EntorhinalGridCellEngine.getInstance().getTelemetry()
  );
  const [compass, setCompass] = useState<RingAttractorTelemetry>(() => 
    ringAttractor.getTelemetry()
  );
  const [breadcrumbs, setBreadcrumbs] = useState<CognitiveWaypoint[]>(() => 
    EntorhinalGridCellEngine.getInstance().getBreadcrumbs()
  );
  const [waypointLabelInput, setWaypointLabelInput] = useState("");
  const [isReverseNavigationActive, setIsReverseNavigationActive] = useState(false);

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

  // Suscripción al motor entorrinal y brújula
  useEffect(() => {
    if (!isOpen) return;
    const engine = EntorhinalGridCellEngine.getInstance();
    const unsubEngine = engine.subscribe((telem) => {
      setTelemetry(telem);
      setBreadcrumbs(engine.getBreadcrumbs());
    });
    const unsubCompass = ringAttractor.subscribe(setCompass);

    return () => {
      unsubEngine();
      unsubCompass();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const engine = EntorhinalGridCellEngine.getInstance();

  const handleDropWaypoint = () => {
    const label = waypointLabelInput.trim() || `HITO-${breadcrumbs.length + 1}`;
    engine.dropBreadcrumb(label);
    setWaypointLabelInput("");
    TacticalAudioEngine.playRogerBeep();
    toast.success(`Hito cognitivo fijado: ${label}`);
  };

  const handleResetOrigin = () => {
    engine.resetOrigin();
    TacticalAudioEngine.playAlert();
    toast.info("Origen de navegación restablecido a [0, 0, 0]m");
  };

  const handleToggleReverse = () => {
    const newState = !isReverseNavigationActive;
    setIsReverseNavigationActive(newState);
    if (newState) {
      TacticalAudioEngine.playEmergencyAlarm();
      toast.warning("Iniciando Retorno Guiado a Ciegas (Backtrack)");
    } else {
      TacticalAudioEngine.playTap();
      toast.info("Navegación de retorno cancelada");
    }
  };

  const { xMeters, yMeters, zMeters } = telemetry.currentCoordsLocal;
  const directDistanceToOrigin = Math.sqrt(xMeters * xMeters + yMeters * yMeters);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10500,
        background: 'rgba(0, 0, 0, 0.94)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        color: '#E0E7FF',
        fontFamily: 'monospace',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Barra de cabecera táctica */}
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
          <div style={{ color: '#06B6D4' }}>
            <TacIcon name="crosshair" size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.90rem', fontWeight: 'bold', color: '#F8FAFC', letterSpacing: '0.05em' }}>
              CORTEZA ENTORRINAL • RED
            </div>
            <div style={{ fontSize: '0.65rem', color: '#06B6D4' }}>
              ODOMETRÍA COGNITIVA HEXAGONAL 2D/3D (CERO GNSS)
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
        
        {/* Banner de alerta de proximidad de obstáculos */}
        {telemetry.borderProximityWarning && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.20)',
              border: '1px solid #EF4444',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#FCA5A5'
            }}
          >
            <TacIcon name="hazard" size={20} />
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
              ¡ALERTA CÉLULAS DE BORDE! PROXIMIDAD INMEDIATA A OBSTÁCULO / PARED SUBTERRÁNEA
            </div>
          </div>
        )}

        {/* Panel de coordenadas y odometría inercial */}
        <div
          style={{
            background: '#090D16',
            border: '1px solid #1E293B',
            borderRadius: '8px',
            padding: '14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            textAlign: 'center'
          }}
        >
          <div>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>OFFSET X (ESTE)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: xMeters >= 0 ? '#10B981' : '#F59E0B' }}>
              {xMeters >= 0 ? `+${xMeters.toFixed(1)}` : xMeters.toFixed(1)}m
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>OFFSET Y (NORTE)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: yMeters >= 0 ? '#10B981' : '#F59E0B' }}>
              {yMeters >= 0 ? `+${yMeters.toFixed(1)}` : yMeters.toFixed(1)}m
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#64748B' }}>ALTITUD REL. Z</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#38BDF8' }}>
              {zMeters >= 0 ? `+${zMeters.toFixed(1)}` : zMeters.toFixed(1)}m
            </div>
          </div>
        </div>

        {/* Brújula y Distancia al Origen */}
        <div
          style={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TacIcon name="compass" size={18} />
            <span style={{ fontSize: '0.80rem', color: '#94A3B8' }}>RUMBO E-PG:</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#F8FAFC' }}>
              {Math.round(compass.headingDeg)}° {compass.cardinal}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.80rem', color: '#94A3B8' }}>DISTANCIA AL ORIGEN: </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#F59E0B' }}>
              {directDistanceToOrigin.toFixed(1)}m
            </span>
          </div>
        </div>

        {/* Visualizador de Interferencia de Rejilla Hexagonal (Grid Cell Field) */}
        <div
          style={{
            background: '#05070B',
            border: '1px solid #1E293B',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: '0.70rem', color: '#64748B' }}>
            <span>CAMPO DE DISPARO HEXAGONAL (4 ESCALAS: λ=0.5m, 2m, 8m, 32m)</span>
            <span style={{ color: '#06B6D4' }}>ACTIVIDAD: {Math.round(telemetry.compositeGridActivity * 100)}%</span>
          </div>

          {/* SVG Interactivo de Rejilla Hexagonal */}
          <svg
            viewBox="-100 -100 200 200"
            style={{
              width: '100%',
              maxHeight: '220px',
              background: '#020408',
              borderRadius: '6px',
              border: '1px solid #0F172A'
            }}
          >
            {/* Ejes cartesianos locales */}
            <line x1="-100" y1="0" x2="100" y2="0" stroke="#1E293B" strokeWidth="0.8" />
            <line x1="0" y1="-100" x2="0" y2="100" stroke="#1E293B" strokeWidth="0.8" />

            {/* Círculos concéntricos de referencia */}
            <circle cx="0" cy="0" r="30" fill="none" stroke="#0F172A" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx="0" cy="0" r="60" fill="none" stroke="#0F172A" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx="0" cy="0" r="90" fill="none" stroke="#0F172A" strokeWidth="1" strokeDasharray="3,3" />

            {/* Red Hexagonal periódica */}
            {[-60, -30, 0, 30, 60].map((gx) => 
              [-60, -30, 0, 30, 60].map((gy) => {
                const hexDist = Math.sqrt(gx * gx + gy * gy);
                if (hexDist > 95) return null;
                const phaseIntensity = (Math.cos(gx * 0.15) + Math.cos(gy * 0.15 * Math.sqrt(3))) * 0.5;
                const cellOpacity = Math.max(0.1, 0.15 + phaseIntensity * 0.25 * telemetry.compositeGridActivity);
                return (
                  <circle
                    key={`hex-${gx}-${gy}`}
                    cx={gx}
                    cy={gy}
                    r="3.5"
                    fill="#06B6D4"
                    fillOpacity={cellOpacity}
                  />
                );
              })
            )}

            {/* Trazado de migas de pan (Breadcrumbs) */}
            {breadcrumbs.length > 1 && (
              <polyline
                fill="none"
                stroke="#10B981"
                strokeWidth="1.5"
                strokeDasharray="4,2"
                points={breadcrumbs
                  .map((b) => {
                    const sx = Math.max(-95, Math.min(95, b.xMeters * 2));
                    const sy = Math.max(-95, Math.min(95, -b.yMeters * 2));
                    return `${sx},${sy}`;
                  })
                  .join(" ")}
              />
            )}

            {/* Marcadores de Waypoints */}
            {breadcrumbs.map((b, idx) => {
              const sx = Math.max(-95, Math.min(95, b.xMeters * 2));
              const sy = Math.max(-95, Math.min(95, -b.yMeters * 2));
              return (
                <g key={`wp-${b.id}`}>
                  <circle cx={sx} cy={sy} r="3" fill="#F59E0B" />
                  <text x={sx + 4} y={sy + 3} fill="#FCD34D" fontSize="6" fontFamily="monospace">
                    {idx + 1}
                  </text>
                </g>
              );
            })}

            {/* Posición actual del operador */}
            {(() => {
              const curSx = Math.max(-95, Math.min(95, xMeters * 2));
              const curSy = Math.max(-95, Math.min(95, -yMeters * 2));
              return (
                <g>
                  <circle cx={curSx} cy={curSy} r="6" fill="none" stroke="#38BDF8" strokeWidth="1.5">
                    <animate attributeName="r" values="4;8;4" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={curSx} cy={curSy} r="2.5" fill="#38BDF8" />
                </g>
              );
            })()}
          </svg>

          {/* Módulos de frecuencia de disparo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', width: '100%' }}>
            {telemetry.modules.map((m) => (
              <div
                key={`mod-${m.moduleIndex}`}
                style={{
                  background: '#0B0F19',
                  border: '1px solid #1E293B',
                  borderRadius: '4px',
                  padding: '6px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.60rem', color: '#64748B' }}>λ = {m.scaleWavelengthMeters}m</div>
                <div style={{ fontSize: '0.80rem', fontWeight: 'bold', color: '#06B6D4' }}>
                  {Math.round(m.firingIntensity * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones de Campo: Fijar Waypoint y Retorno Guiado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Nombre del hito (ej: BIFURCACIÓN ESTE)..."
              value={waypointLabelInput}
              onChange={(e) => setWaypointLabelInput(e.target.value)}
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
            <button
              onClick={handleDropWaypoint}
              style={{
                background: '#065F46',
                border: '1px solid #10B981',
                borderRadius: '6px',
                color: '#ECFDF5',
                padding: '8px 14px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <TacIcon name="plus" size={16} />
              FIJAR HITO
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={handleToggleReverse}
              style={{
                background: isReverseNavigationActive ? '#7F1D1D' : '#1E293B',
                border: `1px solid ${isReverseNavigationActive ? '#EF4444' : '#475569'}`,
                borderRadius: '6px',
                color: isReverseNavigationActive ? '#FEE2E2' : '#E2E8F0',
                padding: '10px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <TacIcon name="refresh" size={16} />
              {isReverseNavigationActive ? "CANCELAR RETORNO" : "RETORNO A CIEGAS"}
            </button>

            <button
              onClick={handleResetOrigin}
              style={{
                background: '#1E293B',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#E2E8F0',
                padding: '10px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <TacIcon name="crosshair" size={16} />
              RESET ORIGEN (0,0)
            </button>
          </div>
        </div>

        {/* Lista de Hitos Cognitivos Grabados */}
        <div
          style={{
            background: '#090D16',
            border: '1px solid #1E293B',
            borderRadius: '8px',
            padding: '12px'
          }}
        >
          <div style={{ fontSize: '0.70rem', color: '#64748B', marginBottom: '8px' }}>
            REGISTRO DE HITOS COGNITIVOS EN CUEVA/TÚNEL ({breadcrumbs.length})
          </div>

          {breadcrumbs.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: '#475569', textAlign: 'center', padding: '10px' }}>
              No hay hitos fijados aún. Avanza y pulsa "FIJAR HITO".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
              {breadcrumbs.map((b, i) => (
                <div
                  key={`list-wp-${b.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: '#0F172A',
                    borderRadius: '4px',
                    fontSize: '0.75rem'
                  }}
                >
                  <span style={{ color: '#38BDF8', fontWeight: 'bold' }}>#{i + 1} {b.label}</span>
                  <span style={{ color: '#94A3B8' }}>
                    [{b.xMeters.toFixed(1)}, {b.yMeters.toFixed(1)}, {b.zMeters.toFixed(1)}]m
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
