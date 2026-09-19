"use client";

import React, { useState, useEffect } from "react";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { TacticalLocationEngine } from "../../lib/sensors/TacticalLocationEngine";
import { GeohashSpatialRouting } from "../../lib/mesh/GeohashSpatialRouting";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacIcon } from "../ui/TacIcon";
import { toast } from "../Toast";

export interface PheromoneBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultGeohash?: string;
  defaultCoords?: { xMeters: number; yMeters: number };
  currentLocation?: { lat: number; lon: number; alt?: number };
}

type PheromoneType = 'ALARM' | 'TRAIL' | 'AGGREGATION';

const PRESET_NOTES: Record<PheromoneType, string[]> = {
  ALARM: [
    "⚠️ Actividad Hostil / Francotirador",
    "⚡ Guerra Electrónica / Jamming RF",
    "☣️ Contaminación / Gas Tóxico",
    "🛑 Retén / Bloqueo de Ruta"
  ],
  TRAIL: [
    "🟢 Corredor Seguro Verificado",
    "👣 Rastro de Infiltración Limpio",
    "💧 Punto de Abastecimiento",
    "📡 Repetidor LoRa en Enlace"
  ],
  AGGREGATION: [
    "📍 Punto de Extracción (LZ)",
    "⛺ Puesto de Mando / Base",
    "🛡️ Zona Segura de Refugio",
    "🤝 Encuentro de Escuadra"
  ]
};

export const PheromoneBroadcastModal: React.FC<PheromoneBroadcastModalProps> = ({
  isOpen,
  onClose,
  defaultGeohash,
  defaultCoords,
  currentLocation
}) => {
  const [type, setType] = useState<PheromoneType>('ALARM');
  const [intensity, setIntensity] = useState<number>(0.85);
  const [ttlMinutes, setTtlMinutes] = useState<number>(60);
  const [notes, setNotes] = useState<string>('');
  const [geohash, setGeohash] = useState<string>(() => defaultGeohash || '');
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);

  // Registro de botón Atrás LIFO
  useEffect(() => {
    if (!isOpen) return;
    const unregister = BackHandlerRegistry.register(() => {
      TacticalAudioEngine.playTap();
      onClose();
      return true;
    });
    return unregister;
  }, [isOpen, onClose]);

  // Si no se proporcionó Geohash, derivarlo usando GeohashSpatialRouting
  useEffect(() => {
    if (!geohash) {
      if (currentLocation && typeof currentLocation.lat === 'number' && typeof currentLocation.lon === 'number' && (currentLocation.lat !== 0 || currentLocation.lon !== 0)) {
        setGeohash(GeohashSpatialRouting.encode(currentLocation.lat, currentLocation.lon, 6));
      } else {
        const loc = TacticalLocationEngine.getLastKnownLocation();
        if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number' && (loc.lat !== 0 || loc.lon !== 0)) {
          setGeohash(GeohashSpatialRouting.encode(loc.lat, loc.lon, 6));
        }
      }
    }
  }, [geohash, currentLocation]);

  if (!isOpen) return null;

  const colorByType: Record<PheromoneType, string> = {
    ALARM: '#FF1E40',
    TRAIL: '#00E676',
    AGGREGATION: '#00E5FF'
  };

  const activeColor = colorByType[type];

  const handleBroadcast = async () => {
    if (isBroadcasting) return;
    setIsBroadcasting(true);
    TacticalAudioEngine.playTap();

    try {
      const finalGeohash = geohash.trim() || 'tactical';
      const cleanNotes = notes.trim() || (type === 'ALARM' ? 'Alerta de Peligro Táctico' : type === 'TRAIL' ? 'Ruta Segura' : 'Punto de Concentración');

      await meshRouter.broadcastPheromone(
        type,
        intensity,
        cleanNotes,
        finalGeohash,
        defaultCoords
      );

      if (type === 'ALARM') {
        TacticalAudioEngine.playAlert();
        toast.error(`Feromona ALARMA difundida en ${finalGeohash}`);
      } else {
        TacticalAudioEngine.playRogerBeep();
        toast.success(`Feromona ${type} difundida en la malla`);
      }

      onClose();
    } catch (e: any) {
      toast.error(`Error al emitir feromona: ${e?.message || 'Fallo de radio'}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(2, 4, 12, 0.88)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: '480px',
          background: 'linear-gradient(135deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)',
          border: `1.5px solid ${activeColor}60`,
          boxShadow: `0 0 35px ${activeColor}25, 0 10px 40px rgba(0,0,0,0.9)`,
          borderRadius: '16px', padding: '20px',
          color: '#FFFFFF', fontFamily: 'JetBrains Mono, monospace',
          display: 'flex', flexDirection: 'column', gap: '16px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${activeColor}30`, paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🍄</span>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, letterSpacing: '0.5px' }}>
                DIFUNDIR FEROMONA DE ENJAMBRE
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                Estigmergia Drosophila MaleCNS • Protocolo Wire 0x10
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ width: '32px', height: '32px', color: '#94A3B8' }}
          >
            <TacIcon name="x" size={18} />
          </button>
        </div>

        {/* Selector de Tipo de Feromona */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 800 }}>
            TIPO DE FEROMONA BIOLÓGICA:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {(['ALARM', 'TRAIL', 'AGGREGATION'] as PheromoneType[]).map((t) => {
              const isSelected = type === t;
              const col = colorByType[t];
              return (
                <button
                  key={t}
                  onClick={() => { TacticalAudioEngine.playTap(); setType(t); }}
                  style={{
                    background: isSelected ? `${col}25` : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${isSelected ? col : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '10px', padding: '10px 6px',
                    color: isSelected ? col : '#CBD5E1',
                    fontSize: '0.74rem', fontWeight: 900, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>
                    {t === 'ALARM' ? '🚨' : t === 'TRAIL' ? '🟢' : '🔵'}
                  </span>
                  <span>{t}</span>
                  <span style={{ fontSize: '0.60rem', color: '#94A3B8', fontWeight: 600 }}>
                    {t === 'ALARM' ? 'Hostil' : t === 'TRAIL' ? 'Segura' : 'Encuentro'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Intensidad Bioquímica */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 800 }}>
            <span style={{ color: '#94A3B8' }}>INTENSIDAD BIOLÓGICA:</span>
            <span style={{ color: activeColor }}>{(intensity * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.10"
            max="1.0"
            step="0.05"
            value={intensity}
            onChange={(e) => setIntensity(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: activeColor, cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#64748B' }}>
            <span>Atenuada (10%)</span>
            <span>Nominal (50%)</span>
            <span>Saturación Máxima (100%)</span>
          </div>
        </div>

        {/* Duración / TTL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 800 }}>
            TIEMPO DE EVAPORACIÓN (TTL):
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {[15, 60, 240, 1440].map((mins) => {
              const isSel = ttlMinutes === mins;
              const label = mins === 15 ? '15m' : mins === 60 ? '1 hora' : mins === 240 ? '4 horas' : '24 horas';
              return (
                <button
                  key={mins}
                  onClick={() => { TacticalAudioEngine.playTap(); setTtlMinutes(mins); }}
                  style={{
                    background: isSel ? `${activeColor}20` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isSel ? activeColor : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px', padding: '6px 4px',
                    color: isSel ? activeColor : '#CBD5E1',
                    fontSize: '0.70rem', fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Geohash Cobertura */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 800 }}>
            GEOHASH DE COBERTURA:
          </label>
          <input
            type="text"
            value={geohash}
            onChange={(e) => setGeohash(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8))}
            placeholder="ej. 6vjwb2"
            style={{
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px', padding: '8px 10px', color: '#00E5FF',
              fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace', outline: 'none'
            }}
          />
        </div>

        {/* Presets de Notas Rápidas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 800 }}>
            PLANTILLA O NOTA TÁCTICA:
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PRESET_NOTES[type].map((p, idx) => (
              <button
                key={idx}
                onClick={() => { TacticalAudioEngine.playTap(); setNotes(p); }}
                style={{
                  background: notes === p ? `${activeColor}25` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${notes === p ? activeColor : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '6px', padding: '4px 8px', fontSize: '0.66rem',
                  color: notes === p ? activeColor : '#E2E8F0', cursor: 'pointer'
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escribe una observación táctica personalizada..."
            maxLength={64}
            style={{
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px', padding: '8px 10px', color: '#FFFFFF',
              fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace', outline: 'none', marginTop: '4px'
            }}
          />
        </div>

        {/* Botón de Emisión Táctica */}
        <button
          onClick={handleBroadcast}
          disabled={isBroadcasting}
          style={{
            background: `linear-gradient(135deg, ${activeColor} 0%, ${activeColor}CC 100%)`,
            color: '#000000', border: 'none', borderRadius: '10px',
            padding: '12px', fontSize: '0.85rem', fontWeight: 900,
            cursor: isBroadcasting ? 'wait' : 'pointer',
            boxShadow: `0 0 20px ${activeColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginTop: '4px', transition: 'all 0.15s ease'
          }}
        >
          {isBroadcasting ? (
            <span>DIFUNDIENDO POR MALLA LoRa/BLE...</span>
          ) : (
            <>
              <span>DIFUNDIR FEROMONA AL ENJAMBRE</span>
              <span>→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
