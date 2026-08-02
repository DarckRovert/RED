/**
 * AmberAdminPanel.tsx — RED v19.0
 *
 * Panel de administración del sistema AMBER-RED.
 * Solo accesible por nodos con autoridad AMBER.
 * Permite crear alertas, marcar como resueltas y ver estadísticas.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AmberAlert,
  AmberAlertCreate,
  getAmberAlerts,
  createAmberAlert,
  resolveAmberAlert,
} from '@/lib/api';

interface AmberAdminPanelProps {
  onClose: () => void;
  localNodeId: string;
}

type PanelView = 'list' | 'create';

export default function AmberAdminPanel({ onClose, localNodeId }: AmberAdminPanelProps) {
  const [view, setView] = useState<PanelView>('list');
  const [alerts, setAlerts] = useState<AmberAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulario de nueva alerta
  const [form, setForm] = useState<Partial<AmberAlertCreate>>({
    authority_node_id: localNodeId,
    authority_signature: localNodeId, // En producción: firma real Ed25519
    ttl_secs: 72 * 3600,
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAmberAlerts();
      setAlerts(data);
    } catch (e: any) {
      setError('No se pudo cargar las alertas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limitar a 512KB
    if (file.size > 512 * 1024) {
      setError('La foto debe ser menor a 512KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      // Remover el prefijo data:image/...;base64,
      const cleanB64 = b64.split(',')[1];
      setForm(f => ({ ...f, photo_b64: cleanB64 }));
      setPhotoPreview(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    setError(null);
    if (!form.name?.trim()) { setError('El nombre es requerido'); return; }
    if (!form.age || form.age < 0) { setError('La edad es requerida'); return; }
    if (!form.description?.trim()) { setError('La descripción es requerida'); return; }

    setSubmitting(true);
    try {
      await createAmberAlert({
        name: form.name!,
        age: form.age!,
        description: form.description!,
        photo_b64: form.photo_b64,
        last_seen_lat: form.last_seen_lat,
        last_seen_lon: form.last_seen_lon,
        last_seen_location: form.last_seen_location,
        ttl_secs: form.ttl_secs,
        authority_signature: localNodeId,
        authority_node_id: localNodeId,
      });
      setSuccessMsg('✅ Alerta AMBER emitida y difundida en la red RED');
      setView('list');
      setForm({
        authority_node_id: localNodeId,
        authority_signature: localNodeId,
        ttl_secs: 72 * 3600,
      });
      setPhotoPreview(null);
      fetchAlerts();
    } catch (e: any) {
      setError(e.message || 'Error al crear la alerta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (alertId: string) => {
    if (!confirm('¿Confirmar que esta persona fue encontrada?')) return;
    try {
      await resolveAmberAlert(alertId, {
        authority_node_id: localNodeId,
        authority_signature: localNodeId,
        resolution_notes: 'Persona encontrada — alerta cerrada por autoridad RED.',
      });
      setSuccessMsg('✅ Alerta marcada como resuelta');
      fetchAlerts();
    } catch (e: any) {
      setError(e.message || 'Error al resolver la alerta');
    }
  };

  const formatTTL = (secs: number): string => {
    const h = Math.floor(secs / 3600);
    return h < 24 ? `${h} horas` : `${Math.floor(h / 24)} días`;
  };

  return (
    <div className="amber-admin-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="amber-admin-panel">
        {/* Header */}
        <div className="amber-admin-header">
          <div>
            <div className="amber-admin-title">🟠 Sistema AMBER-RED</div>
            <div className="amber-admin-subtitle">Panel de Administración de Alertas</div>
          </div>
          <button className="amber-admin-close" onClick={onClose} id="amber-admin-close-btn">×</button>
        </div>

        {/* Tabs */}
        <div className="amber-admin-tabs">
          <button
            className={`amber-tab ${view === 'list' ? 'amber-tab--active' : ''}`}
            onClick={() => setView('list')}
            id="amber-tab-list"
          >
            📋 Alertas Activas ({alerts.length})
          </button>
          <button
            className={`amber-tab ${view === 'create' ? 'amber-tab--active' : ''}`}
            onClick={() => setView('create')}
            id="amber-tab-create"
          >
            + Nueva Alerta
          </button>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="amber-admin-error">
            ⚠️ {error}
            <button onClick={() => setError(null)} className="amber-dismiss">×</button>
          </div>
        )}
        {successMsg && (
          <div className="amber-admin-success">
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="amber-dismiss">×</button>
          </div>
        )}

        {/* Vista: Lista */}
        {view === 'list' && (
          <div className="amber-admin-content">
            {loading ? (
              <div className="amber-admin-loading">Cargando alertas...</div>
            ) : alerts.length === 0 ? (
              <div className="amber-admin-empty">
                <div>🟢</div>
                <div>No hay alertas activas.</div>
                <button
                  className="amber-admin-btn amber-admin-btn--primary"
                  onClick={() => setView('create')}
                  id="amber-empty-create-btn"
                >
                  Crear primera alerta
                </button>
              </div>
            ) : (
              <div className="amber-alert-list">
                {alerts.map(alert => (
                  <div key={alert.id} className="amber-alert-card">
                    <div className="amber-alert-card-header">
                      {alert.photo_b64 && alert.photo_b64 !== '[PHOTO_AVAILABLE]' ? (
                        <img
                          src={`data:image/jpeg;base64,${alert.photo_b64}`}
                          alt={alert.name}
                          className="amber-alert-thumb"
                        />
                      ) : (
                        <div className="amber-alert-thumb-placeholder">👤</div>
                      )}
                      <div className="amber-alert-card-info">
                        <div className="amber-alert-card-name">{alert.name}</div>
                        <div className="amber-alert-card-age">{alert.age} años</div>
                        <div className="amber-alert-card-desc">{alert.description}</div>
                        {alert.last_seen_location && (
                          <div className="amber-alert-card-loc">📍 {alert.last_seen_location}</div>
                        )}
                      </div>
                    </div>
                    <div className="amber-alert-card-footer">
                      <div className="amber-alert-card-stats">
                        <span>👁 {alert.sighting_count} avistamientos</span>
                        <span>⏳ Expira: {new Date(alert.expires_at * 1000).toLocaleDateString('es-MX')}</span>
                      </div>
                      <button
                        className="amber-admin-btn amber-admin-btn--resolve"
                        onClick={() => handleResolve(alert.id)}
                        id={`amber-resolve-btn-${alert.id}`}
                      >
                        ✅ Persona Encontrada
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vista: Crear */}
        {view === 'create' && (
          <div className="amber-admin-content amber-create-form">
            <div className="amber-form-row">
              <label className="amber-label" htmlFor="amber-name">Nombre completo *</label>
              <input
                id="amber-name"
                className="amber-input"
                placeholder="Nombre de la persona desaparecida"
                value={form.name || ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="amber-form-row">
              <label className="amber-label" htmlFor="amber-age">Edad *</label>
              <input
                id="amber-age"
                className="amber-input"
                type="number"
                min="0"
                max="120"
                placeholder="Años"
                value={form.age || ''}
                onChange={e => setForm(f => ({ ...f, age: parseInt(e.target.value) || undefined }))}
              />
            </div>

            <div className="amber-form-row">
              <label className="amber-label" htmlFor="amber-desc">Descripción física y circunstancias *</label>
              <textarea
                id="amber-desc"
                className="amber-input amber-textarea"
                rows={3}
                placeholder="Descripción física, ropa que vestía, circunstancias de la desaparición..."
                value={form.description || ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="amber-form-row">
              <label className="amber-label" htmlFor="amber-location">Último lugar visto</label>
              <input
                id="amber-location"
                className="amber-input"
                placeholder="Dirección o descripción del lugar"
                value={form.last_seen_location || ''}
                onChange={e => setForm(f => ({ ...f, last_seen_location: e.target.value }))}
              />
            </div>

            <div className="amber-form-row amber-form-row--half">
              <div>
                <label className="amber-label" htmlFor="amber-lat">Latitud</label>
                <input
                  id="amber-lat"
                  className="amber-input"
                  type="number"
                  step="0.000001"
                  placeholder="Ej: 19.4326"
                  value={form.last_seen_lat || ''}
                  onChange={e => setForm(f => ({ ...f, last_seen_lat: parseFloat(e.target.value) || undefined }))}
                />
              </div>
              <div>
                <label className="amber-label" htmlFor="amber-lon">Longitud</label>
                <input
                  id="amber-lon"
                  className="amber-input"
                  type="number"
                  step="0.000001"
                  placeholder="Ej: -99.1332"
                  value={form.last_seen_lon || ''}
                  onChange={e => setForm(f => ({ ...f, last_seen_lon: parseFloat(e.target.value) || undefined }))}
                />
              </div>
            </div>

            <div className="amber-form-row">
              <label className="amber-label" htmlFor="amber-photo">Foto (máx. 512KB)</label>
              <input
                id="amber-photo"
                type="file"
                accept="image/*"
                className="amber-file-input"
                onChange={handlePhotoChange}
              />
              {photoPreview && (
                <img src={photoPreview} alt="Preview" className="amber-photo-preview" />
              )}
            </div>

            <div className="amber-form-row">
              <label className="amber-label" htmlFor="amber-ttl">Duración de la alerta</label>
              <select
                id="amber-ttl"
                className="amber-input amber-select"
                value={form.ttl_secs || 72 * 3600}
                onChange={e => setForm(f => ({ ...f, ttl_secs: parseInt(e.target.value) }))}
              >
                <option value={24 * 3600}>24 horas</option>
                <option value={48 * 3600}>48 horas</option>
                <option value={72 * 3600}>72 horas (recomendado)</option>
                <option value={7 * 24 * 3600}>7 días</option>
                <option value={30 * 24 * 3600}>30 días</option>
              </select>
            </div>

            <div className="amber-form-actions">
              <button
                className="amber-admin-btn"
                onClick={() => setView('list')}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                className="amber-admin-btn amber-admin-btn--primary"
                onClick={handleCreate}
                disabled={submitting}
                id="amber-create-submit-btn"
              >
                {submitting ? '📡 Difundiendo en la red...' : '🟠 Emitir Alerta AMBER'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .amber-admin-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .amber-admin-panel {
          background: #111;
          border: 1px solid #ff8c00;
          border-radius: 16px;
          width: 100%;
          max-width: 560px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(255, 140, 0, 0.2);
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .amber-admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: rgba(255, 140, 0, 0.1);
          border-bottom: 1px solid rgba(255, 140, 0, 0.3);
        }

        .amber-admin-title {
          font-size: 16px;
          font-weight: 800;
          color: #ff8c00;
          letter-spacing: 0.04em;
        }

        .amber-admin-subtitle {
          font-size: 11px;
          color: rgba(255, 140, 0, 0.6);
          margin-top: 2px;
        }

        .amber-admin-close {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.6);
          border-radius: 6px;
          padding: 4px 10px;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }

        .amber-admin-tabs {
          display: flex;
          border-bottom: 1px solid rgba(255, 140, 0, 0.2);
        }

        .amber-tab {
          flex: 1;
          padding: 10px;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
          font-family: inherit;
        }

        .amber-tab--active {
          color: #ff8c00;
          border-bottom: 2px solid #ff8c00;
          background: rgba(255, 140, 0, 0.05);
        }

        .amber-admin-error {
          background: rgba(220, 38, 38, 0.15);
          border: 1px solid rgba(220, 38, 38, 0.4);
          color: #fca5a5;
          padding: 8px 12px;
          margin: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .amber-admin-success {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.4);
          color: #86efac;
          padding: 8px 12px;
          margin: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .amber-dismiss {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 16px;
        }

        .amber-admin-content {
          overflow-y: auto;
          flex: 1;
          padding: 16px;
        }

        .amber-admin-loading, .amber-admin-empty {
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          padding: 40px 20px;
          font-size: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }

        .amber-admin-empty > div:first-child { font-size: 40px; }

        .amber-alert-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .amber-alert-card {
          background: rgba(255, 140, 0, 0.06);
          border: 1px solid rgba(255, 140, 0, 0.25);
          border-radius: 12px;
          overflow: hidden;
        }

        .amber-alert-card-header {
          display: flex;
          gap: 12px;
          padding: 12px;
        }

        .amber-alert-thumb {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid rgba(255, 140, 0, 0.4);
        }

        .amber-alert-thumb-placeholder {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          background: rgba(255, 140, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          flex-shrink: 0;
        }

        .amber-alert-card-name {
          font-weight: 700;
          font-size: 15px;
          color: #fff;
        }

        .amber-alert-card-age {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          margin-top: 2px;
        }

        .amber-alert-card-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          margin-top: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .amber-alert-card-loc {
          font-size: 11px;
          color: #ffd080;
          margin-top: 2px;
        }

        .amber-alert-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.3);
          border-top: 1px solid rgba(255, 140, 0, 0.15);
        }

        .amber-alert-card-stats {
          display: flex;
          gap: 12px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

        .amber-admin-btn {
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.7);
          border-radius: 8px;
          padding: 7px 14px;
          font-size: 12px;
          cursor: pointer;
          font-family: inherit;
          font-weight: 600;
          transition: all 0.2s;
        }

        .amber-admin-btn--primary {
          background: #ff8c00;
          border-color: #ff8c00;
          color: #000;
        }

        .amber-admin-btn--primary:hover:not(:disabled) {
          background: #ffa500;
        }

        .amber-admin-btn--resolve {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.4);
          color: #86efac;
        }

        .amber-admin-btn--resolve:hover {
          background: rgba(34, 197, 94, 0.25);
        }

        .amber-admin-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Formulario de creación */
        .amber-create-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .amber-form-row {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .amber-form-row--half {
          flex-direction: row;
          gap: 10px;
        }

        .amber-form-row--half > div {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .amber-label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .amber-input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 140, 0, 0.3);
          border-radius: 8px;
          padding: 9px 12px;
          color: #fff;
          font-size: 14px;
          outline: none;
          font-family: inherit;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        .amber-input:focus {
          border-color: #ff8c00;
        }

        .amber-textarea {
          resize: vertical;
          min-height: 70px;
        }

        .amber-select {
          appearance: none;
          cursor: pointer;
        }

        .amber-file-input {
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          font-family: inherit;
        }

        .amber-photo-preview {
          width: 80px;
          height: 80px;
          border-radius: 8px;
          object-fit: cover;
          border: 2px solid #ff8c00;
          margin-top: 8px;
        }

        .amber-form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </div>
  );
}
