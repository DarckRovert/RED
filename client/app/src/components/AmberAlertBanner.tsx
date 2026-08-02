/**
 * AmberAlertBanner.tsx — RED v19.0
 *
 * Banner de alta prioridad para alertas AMBER activas.
 * Se monta sobre toda la UI con z-index máximo.
 * Diseño: naranja ámbar animado con pulso, foto, datos, botones de acción.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { AmberAlert, getAmberAlerts, reportSighting, RedAPI } from '@/lib/api';

interface AmberAlertBannerProps {
  /** Callback cuando el usuario minimiza el banner */
  onMinimize?: () => void;
}

export default function AmberAlertBanner({ onMinimize }: AmberAlertBannerProps) {
  const [alerts, setAlerts] = useState<AmberAlert[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [showSightingForm, setShowSightingForm] = useState(false);
  const [sightingNotes, setSightingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Polling + Push real-time vía SSE
  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getAmberAlerts();
      setAlerts(data);
    } catch {
      // Fail silently — no interrumpir la UX si el nodo no responde
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30_000);
    
    // Suscripción en tiempo real a push SSE
    const es = RedAPI.subscribeToEvents((data) => {
      if (data?.content) {
        try {
          const parsed = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
          if (parsed?.event_type === 'amber_alert' || parsed?.event_type === 'amber_resolved') {
            fetchAlerts();
          }
        } catch {
          // Non-JSON message
        }
      }
    });

    return () => {
      clearInterval(interval);
      es?.close();
    };
  }, [fetchAlerts]);

  if (alerts.length === 0) return null;

  const currentAlert = alerts[currentIndex];
  if (!currentAlert) return null;

  const handleMinimize = () => {
    setMinimized(true);
    onMinimize?.();
  };

  const handleSightingSubmit = async () => {
    setSubmitting(true);
    try {
      await reportSighting(currentAlert.id, {
        notes: sightingNotes || undefined,
      });
      setSubmitted(true);
      setTimeout(() => {
        setShowSightingForm(false);
        setSubmitted(false);
        setSightingNotes('');
      }, 2000);
    } catch (e) {
      console.error('Error al reportar avistamiento:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = () => {
    // Copiar info de la alerta al portapapeles
    const text = `🟠 ALERTA AMBER-RED\n👤 ${currentAlert.name} | ${currentAlert.age} años\n📝 ${currentAlert.description}`;
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="amber-minimized-pill"
        title="Ver Alerta AMBER activa"
        aria-label={`Alerta AMBER activa: ${currentAlert.name}`}
      >
        <span className="amber-pulse-dot" />
        <span>🟠 AMBER ACTIVA ({alerts.length})</span>
      </button>
    );
  }

  return (
    <div className="amber-banner-overlay" role="alert" aria-live="assertive">
      <div className="amber-banner-container">
        {/* Header */}
        <div className="amber-banner-header">
          <div className="amber-header-left">
            <span className="amber-pulse-dot amber-pulse-dot--large" />
            <div>
              <div className="amber-badge">🟠 ALERTA AMBER-RED</div>
              <div className="amber-subtitle">Sistema RED de Personas Desaparecidas</div>
            </div>
          </div>
          <div className="amber-header-actions">
            {alerts.length > 1 && (
              <div className="amber-counter">
                <button
                  onClick={() => setCurrentIndex(i => (i - 1 + alerts.length) % alerts.length)}
                  className="amber-nav-btn"
                  aria-label="Alerta anterior"
                >
                  ‹
                </button>
                <span>{currentIndex + 1} / {alerts.length}</span>
                <button
                  onClick={() => setCurrentIndex(i => (i + 1) % alerts.length)}
                  className="amber-nav-btn"
                  aria-label="Siguiente alerta"
                >
                  ›
                </button>
              </div>
            )}
            <button
              onClick={handleMinimize}
              className="amber-minimize-btn"
              aria-label="Minimizar alerta"
            >
              ─
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="amber-banner-body">
          {/* Foto */}
          <div className="amber-photo-container">
            {currentAlert.photo_b64 && currentAlert.photo_b64 !== '[PHOTO_AVAILABLE]' ? (
              <img
                src={`data:image/jpeg;base64,${currentAlert.photo_b64}`}
                alt={`Foto de ${currentAlert.name}`}
                className="amber-photo"
              />
            ) : (
              <div className="amber-photo-placeholder">
                <span>👤</span>
              </div>
            )}
          </div>

          {/* Datos */}
          <div className="amber-info">
            <div className="amber-name">{currentAlert.name}</div>
            <div className="amber-age">Edad: <strong>{currentAlert.age} años</strong></div>
            <div className="amber-description">{currentAlert.description}</div>
            {currentAlert.last_seen_location && (
              <div className="amber-location">
                📍 Último avistamiento: <strong>{currentAlert.last_seen_location}</strong>
              </div>
            )}
            <div className="amber-issued">
              Emitida: {new Date(currentAlert.issued_at * 1000).toLocaleString('es-MX')}
            </div>
            {currentAlert.sighting_count > 0 && (
              <div className="amber-sightings">
                👁 {currentAlert.sighting_count} avistamiento(s) reportado(s)
              </div>
            )}
          </div>
        </div>

        {/* Formulario de avistamiento */}
        {showSightingForm && (
          <div className="amber-sighting-form">
            {submitted ? (
              <div className="amber-sighting-success">
                ✅ Avistamiento reportado. Las autoridades han sido notificadas.
              </div>
            ) : (
              <>
                <textarea
                  value={sightingNotes}
                  onChange={e => setSightingNotes(e.target.value)}
                  placeholder="Describe dónde y cuándo viste a esta persona (opcional)..."
                  className="amber-sighting-textarea"
                  rows={3}
                  id="amber-sighting-notes"
                />
                <div className="amber-sighting-actions">
                  <button
                    onClick={() => setShowSightingForm(false)}
                    className="amber-btn amber-btn--secondary"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSightingSubmit}
                    className="amber-btn amber-btn--primary"
                    disabled={submitting}
                    id="amber-submit-sighting"
                  >
                    {submitting ? 'Enviando...' : 'Reportar Avistamiento'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Botones de acción */}
        {!showSightingForm && (
          <div className="amber-banner-footer">
            <button
              onClick={() => setShowSightingForm(true)}
              className="amber-btn amber-btn--primary"
              id="amber-report-sighting-btn"
            >
              📍 Reportar Avistamiento
            </button>
            <button
              onClick={handleShare}
              className="amber-btn amber-btn--secondary"
              id="amber-share-btn"
            >
              📢 Compartir Alerta
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .amber-banner-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          padding: 0;
          animation: amber-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes amber-slide-in {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes amber-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }

        @keyframes amber-glow {
          0%, 100% { box-shadow: 0 4px 32px rgba(255, 140, 0, 0.4); }
          50% { box-shadow: 0 4px 48px rgba(255, 140, 0, 0.8); }
        }

        .amber-banner-container {
          background: linear-gradient(135deg, #1a0e00 0%, #2d1800 50%, #1a0e00 100%);
          border-bottom: 2px solid #ff8c00;
          animation: amber-glow 2s ease-in-out infinite;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .amber-banner-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px 8px;
          background: rgba(255, 140, 0, 0.15);
          border-bottom: 1px solid rgba(255, 140, 0, 0.3);
        }

        .amber-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .amber-pulse-dot {
          width: 10px;
          height: 10px;
          background: #ff8c00;
          border-radius: 50%;
          animation: amber-pulse 1.5s ease-in-out infinite;
          flex-shrink: 0;
        }

        .amber-pulse-dot--large {
          width: 14px;
          height: 14px;
        }

        .amber-badge {
          font-size: 14px;
          font-weight: 800;
          color: #ff8c00;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .amber-subtitle {
          font-size: 10px;
          color: rgba(255, 140, 0, 0.7);
          font-weight: 500;
        }

        .amber-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .amber-counter {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #ff8c00;
        }

        .amber-nav-btn {
          background: none;
          border: 1px solid rgba(255, 140, 0, 0.4);
          color: #ff8c00;
          border-radius: 4px;
          padding: 1px 7px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }

        .amber-nav-btn:hover {
          background: rgba(255, 140, 0, 0.2);
        }

        .amber-minimize-btn {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.6);
          border-radius: 4px;
          padding: 2px 8px;
          cursor: pointer;
          font-size: 14px;
        }

        .amber-minimize-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .amber-banner-body {
          display: flex;
          gap: 16px;
          padding: 12px 16px;
          align-items: flex-start;
        }

        .amber-photo-container {
          flex-shrink: 0;
        }

        .amber-photo {
          width: 72px;
          height: 72px;
          border-radius: 8px;
          object-fit: cover;
          border: 2px solid #ff8c00;
        }

        .amber-photo-placeholder {
          width: 72px;
          height: 72px;
          border-radius: 8px;
          border: 2px solid rgba(255, 140, 0, 0.5);
          background: rgba(255, 140, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
        }

        .amber-info {
          flex: 1;
          min-width: 0;
        }

        .amber-name {
          font-size: 18px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 2px;
        }

        .amber-age {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 4px;
        }

        .amber-description {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.4;
          margin-bottom: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .amber-location {
          font-size: 12px;
          color: #ffd080;
          margin-bottom: 2px;
        }

        .amber-issued {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

        .amber-sightings {
          font-size: 12px;
          color: #90ee90;
          margin-top: 2px;
        }

        .amber-sighting-form {
          padding: 10px 16px;
          border-top: 1px solid rgba(255, 140, 0, 0.2);
          background: rgba(0, 0, 0, 0.3);
        }

        .amber-sighting-textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 140, 0, 0.4);
          border-radius: 6px;
          color: #fff;
          padding: 8px;
          font-size: 13px;
          resize: none;
          box-sizing: border-box;
          outline: none;
          font-family: inherit;
        }

        .amber-sighting-textarea:focus {
          border-color: #ff8c00;
        }

        .amber-sighting-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          justify-content: flex-end;
        }

        .amber-sighting-success {
          color: #90ee90;
          font-size: 13px;
          text-align: center;
          padding: 8px;
        }

        .amber-banner-footer {
          display: flex;
          gap: 8px;
          padding: 8px 16px 12px;
          border-top: 1px solid rgba(255, 140, 0, 0.2);
        }

        .amber-btn {
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .amber-btn--primary {
          background: #ff8c00;
          color: #000;
        }

        .amber-btn--primary:hover {
          background: #ffa500;
          transform: translateY(-1px);
        }

        .amber-btn--primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .amber-btn--secondary {
          background: rgba(255, 140, 0, 0.15);
          color: #ff8c00;
          border: 1px solid rgba(255, 140, 0, 0.4);
        }

        .amber-btn--secondary:hover {
          background: rgba(255, 140, 0, 0.25);
        }

        .amber-minimized-pill {
          position: fixed;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          background: #2d1800;
          border: 1px solid #ff8c00;
          border-radius: 20px;
          padding: 6px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ff8c00;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.05em;
          animation: amber-glow 2s ease-in-out infinite;
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}
