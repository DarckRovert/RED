/**
 * GuardianStatusPanel.tsx — RED v19.0
 *
 * Panel de transparencia del sistema Guardian IA.
 * Muestra el estado del motor de moderación, estadísticas anónimas
 * y permite reportar contenido manualmente.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getGuardianStatus, reportContent, GuardianStatus } from '@/lib/api';

interface GuardianStatusPanelProps {
  onClose: () => void;
}

export default function GuardianStatusPanel({ onClose }: GuardianStatusPanelProps) {
  const [status, setStatus] = useState<GuardianStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getGuardianStatus();
      setStatus(data);
    } catch {
      setError('No se pudo conectar con el Guardian. ¿El nodo está activo?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      await reportContent({
        reason: reportReason,
        description: reportDesc || undefined,
      });
      setReportSuccess(true);
      setTimeout(() => {
        setShowReportForm(false);
        setReportSuccess(false);
        setReportReason('');
        setReportDesc('');
      }, 3000);
    } catch {
      setError('Error al enviar el reporte');
    } finally {
      setReportSubmitting(false);
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'strict': return '#ff6b6b';
      case 'warn': return '#ffd080';
      case 'off': return '#666';
      default: return '#999';
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'strict': return 'Estricto — Bloqueo total';
      case 'warn': return 'Advertencia — Solo alerta';
      case 'off': return 'Apagado';
      default: return mode;
    }
  };

  return (
    <div className="guardian-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="guardian-panel">
        {/* Header */}
        <div className="guardian-header">
          <div>
            <div className="guardian-title">🛡️ RED Guardian IA</div>
            <div className="guardian-subtitle">Sistema de Moderación de Contenido</div>
          </div>
          <button className="guardian-close" onClick={onClose} id="guardian-close-btn">×</button>
        </div>

        {/* Content */}
        <div className="guardian-content">
          {loading ? (
            <div className="guardian-loading">Conectando con Guardian...</div>
          ) : error ? (
            <div className="guardian-error">{error}</div>
          ) : status ? (
            <>
              {/* Estado principal */}
              <div className="guardian-status-card">
                <div className="guardian-status-indicator">
                  <div className={`guardian-dot ${status.active ? 'guardian-dot--active' : 'guardian-dot--off'}`} />
                  <div>
                    <div className="guardian-status-label">
                      {status.active ? 'Guardian Activo' : 'Guardian Inactivo'}
                    </div>
                    <div className="guardian-status-model">{status.model}</div>
                  </div>
                </div>
                <div
                  className="guardian-mode-badge"
                  style={{ borderColor: getModeColor(status.mode), color: getModeColor(status.mode) }}
                >
                  {getModeLabel(status.mode)}
                </div>
              </div>

              {/* Advertencia sin API key */}
              {!status.has_api_key && (
                <div className="guardian-warning">
                  ⚠️ Sin clave GROQ_API_KEY — Solo pHash de imágenes activo.
                  El análisis de texto requiere configurar la API key.
                </div>
              )}

              {/* Estadísticas */}
              <div className="guardian-stats-grid">
                <div className="guardian-stat">
                  <div className="guardian-stat-value">{status.stats.messages_analyzed.toLocaleString()}</div>
                  <div className="guardian-stat-label">Mensajes analizados</div>
                </div>
                <div className="guardian-stat guardian-stat--blocked">
                  <div className="guardian-stat-value">{status.stats.messages_blocked.toLocaleString()}</div>
                  <div className="guardian-stat-label">Mensajes bloqueados</div>
                </div>
                <div className="guardian-stat">
                  <div className="guardian-stat-value">{status.stats.images_analyzed.toLocaleString()}</div>
                  <div className="guardian-stat-label">Imágenes verificadas</div>
                </div>
                <div className="guardian-stat guardian-stat--blocked">
                  <div className="guardian-stat-value">{status.stats.images_blocked.toLocaleString()}</div>
                  <div className="guardian-stat-label">Imágenes bloqueadas</div>
                </div>
                <div className="guardian-stat">
                  <div className="guardian-stat-value">{status.stats.cache_hits.toLocaleString()}</div>
                  <div className="guardian-stat-label">Cache hits</div>
                </div>
                <div className="guardian-stat">
                  <div className="guardian-stat-value">{status.stats.api_calls_made.toLocaleString()}</div>
                  <div className="guardian-stat-label">Llamadas API</div>
                </div>
              </div>

              {/* Explicación de privacidad */}
              <div className="guardian-privacy-note">
                <div className="guardian-privacy-title">🔒 Cómo protegemos tu privacidad</div>
                <ul className="guardian-privacy-list">
                  <li>El análisis ocurre en tu dispositivo (nodo emisor), antes del cifrado</li>
                  <li>No se envía contenido cifrado a servicios externos</li>
                  <li>Las estadísticas son solo contadores anónimos — nunca contenido real</li>
                  <li>Las imágenes se verifican por hash local, sin salir de la red RED</li>
                  <li>El receptor nunca sabe si hubo análisis — E2E garantizado</li>
                </ul>
              </div>

              {/* Autoridades AMBER */}
              {status.authorities && status.authorities.length > 0 && (
                <div className="guardian-authorities">
                  <div className="guardian-authorities-title">🟠 Autoridades AMBER Registradas</div>
                  <div className="guardian-authorities-count">
                    {status.authorities.length} nodo(s) autorizado(s) para emitir alertas
                  </div>
                </div>
              )}

              {/* Reportar contenido */}
              {!showReportForm ? (
                <button
                  className="guardian-report-btn"
                  onClick={() => setShowReportForm(true)}
                  id="guardian-open-report-btn"
                >
                  🚩 Reportar Contenido Inapropiado
                </button>
              ) : (
                <div className="guardian-report-form">
                  <div className="guardian-report-title">Reportar contenido</div>
                  {reportSuccess ? (
                    <div className="guardian-report-success">
                      ✅ Reporte enviado. El equipo de RED lo revisará.
                    </div>
                  ) : (
                    <>
                      <select
                        className="guardian-select"
                        value={reportReason}
                        onChange={e => setReportReason(e.target.value)}
                        id="guardian-report-reason"
                      >
                        <option value="">Selecciona la razón del reporte...</option>
                        <option value="csam">Contenido de abuso infantil (CSAM)</option>
                        <option value="violence">Violencia explícita</option>
                        <option value="hate_speech">Discurso de odio</option>
                        <option value="trafficking">Tráfico humano</option>
                        <option value="drugs">Tráfico de drogas</option>
                        <option value="spam">Spam o desinformación</option>
                        <option value="other">Otro</option>
                      </select>
                      <textarea
                        className="guardian-textarea"
                        placeholder="Descripción adicional (opcional)..."
                        value={reportDesc}
                        onChange={e => setReportDesc(e.target.value)}
                        rows={3}
                        id="guardian-report-desc"
                      />
                      <div className="guardian-report-actions">
                        <button
                          className="guardian-btn guardian-btn--secondary"
                          onClick={() => setShowReportForm(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          className="guardian-btn guardian-btn--primary"
                          onClick={handleReport}
                          disabled={!reportReason || reportSubmitting}
                          id="guardian-submit-report-btn"
                        >
                          {reportSubmitting ? 'Enviando...' : 'Enviar Reporte'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .guardian-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .guardian-panel {
          background: #0d1117;
          border: 1px solid rgba(99, 179, 237, 0.4);
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(99, 179, 237, 0.1);
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .guardian-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: rgba(99, 179, 237, 0.07);
          border-bottom: 1px solid rgba(99, 179, 237, 0.2);
        }

        .guardian-title {
          font-size: 16px;
          font-weight: 800;
          color: #63b3ed;
        }

        .guardian-subtitle {
          font-size: 11px;
          color: rgba(99, 179, 237, 0.5);
          margin-top: 2px;
        }

        .guardian-close {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.5);
          border-radius: 6px;
          padding: 4px 10px;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }

        .guardian-content {
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .guardian-loading, .guardian-error {
          text-align: center;
          padding: 30px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
        }

        .guardian-error { color: #fca5a5; }

        .guardian-status-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 14px 16px;
        }

        .guardian-status-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .guardian-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .guardian-dot--active {
          background: #22c55e;
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
          animation: pulse-green 2s ease-in-out infinite;
        }

        @keyframes pulse-green {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .guardian-dot--off {
          background: #666;
        }

        .guardian-status-label {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
        }

        .guardian-status-model {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
          font-family: 'JetBrains Mono', monospace;
          margin-top: 2px;
        }

        .guardian-mode-badge {
          border: 1px solid;
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .guardian-warning {
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
          color: #fbbf24;
          line-height: 1.5;
        }

        .guardian-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .guardian-stat {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 10px;
          padding: 12px;
          text-align: center;
        }

        .guardian-stat--blocked {
          border-color: rgba(239, 68, 68, 0.2);
          background: rgba(239, 68, 68, 0.04);
        }

        .guardian-stat-value {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          font-variant-numeric: tabular-nums;
        }

        .guardian-stat--blocked .guardian-stat-value { color: #fc8181; }

        .guardian-stat-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.35);
          margin-top: 3px;
          line-height: 1.3;
        }

        .guardian-privacy-note {
          background: rgba(99, 179, 237, 0.06);
          border: 1px solid rgba(99, 179, 237, 0.2);
          border-radius: 10px;
          padding: 12px 14px;
        }

        .guardian-privacy-title {
          font-size: 12px;
          font-weight: 700;
          color: #63b3ed;
          margin-bottom: 8px;
        }

        .guardian-privacy-list {
          margin: 0;
          padding-left: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .guardian-privacy-list li {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.4;
        }

        .guardian-authorities {
          background: rgba(255, 140, 0, 0.06);
          border: 1px solid rgba(255, 140, 0, 0.2);
          border-radius: 10px;
          padding: 12px;
        }

        .guardian-authorities-title {
          font-size: 12px;
          font-weight: 700;
          color: #ff8c00;
          margin-bottom: 4px;
        }

        .guardian-authorities-count {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .guardian-report-btn {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fc8181;
          border-radius: 10px;
          padding: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
          font-family: inherit;
        }

        .guardian-report-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .guardian-report-form {
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          padding: 14px;
          background: rgba(239, 68, 68, 0.04);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .guardian-report-title {
          font-size: 13px;
          font-weight: 700;
          color: #fc8181;
        }

        .guardian-report-success {
          color: #86efac;
          font-size: 13px;
          text-align: center;
          padding: 8px;
        }

        .guardian-select, .guardian-textarea {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #fff;
          padding: 8px 10px;
          font-size: 13px;
          font-family: inherit;
          width: 100%;
          box-sizing: border-box;
          outline: none;
        }

        .guardian-select option { background: #1a1a2e; }

        .guardian-textarea { resize: none; }

        .guardian-report-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .guardian-btn {
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
          border: 1px solid transparent;
        }

        .guardian-btn--primary {
          background: #ef4444;
          color: #fff;
        }

        .guardian-btn--primary:hover:not(:disabled) {
          background: #dc2626;
        }

        .guardian-btn--primary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .guardian-btn--secondary {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.6);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .guardian-btn--secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
