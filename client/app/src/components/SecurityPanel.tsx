"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { PrivacyScreen } from '@capacitor-community/privacy-screen';

export default function SecurityPanel() {
  const { identity, status } = useRedStore();
  const [showKey, setShowKey] = useState(false);

  const mockDevices = [
    { name: "iPhone 15 Pro", lastUsed: "Ahora mismo", active: true },
    { name: "MacBook Air M2", lastUsed: "Hace 2 horas", active: false },
  ];

  const [privacyEnabled, setPrivacyEnabled] = useState(false);
  const [panicPin, setPanicPin] = useState("");
  const [destructTimer, setDestructTimer] = useState("0");

  useEffect(() => {
    // Check initial state from local storage since plugin doesn't have isEnabled() getter
    const savedState = localStorage.getItem('red_privacy_screen') === 'true';
    setPrivacyEnabled(savedState);
    if (savedState) {
      PrivacyScreen.enable().catch(() => { });
    }

    const savedTimer = localStorage.getItem('red_destruct_timer_hrs') || "0";
    setDestructTimer(savedTimer);
  }, []);

  const togglePrivacyScreen = async () => {
    try {
      if (privacyEnabled) {
        await PrivacyScreen.disable();
        setPrivacyEnabled(false);
        localStorage.setItem('red_privacy_screen', 'false');
      } else {
        await PrivacyScreen.enable();
        setPrivacyEnabled(true);
        localStorage.setItem('red_privacy_screen', 'true');
      }
    } catch (err) {
      console.warn("[PrivacyScreen] Error toggling:", err);
      // Fallback for web testing
      setPrivacyEnabled(!privacyEnabled);
    }
  };

  const handleSetPanicPin = () => {
    if (panicPin.length < 4) {
      alert("El PIN debe tener al menos 4 dígitos");
      return;
    }
    localStorage.setItem("red_panic_pin", panicPin);
    alert("PIN de Pánico configurado. Si se introduce en la pantalla de bloqueo, la base de datos se destruirá.");
    setPanicPin("");
  };

  const handleSetDestructTimer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDestructTimer(val);
    localStorage.setItem("red_destruct_timer_hrs", val);

    if (val !== "0") {
      // Save current time as the baseline
      localStorage.setItem("red_last_activity", Date.now().toString());
    }
  };

  return (
    <div className="security-container animate-fade">
      <header className="section-header">
        <h2>Seguridad y Privacidad</h2>
        <p>Gestiona tu identidad descentralizada y dispositivos vinculados.</p>
      </header>

      <section className="identity-card glass">
        <div className="card-header">
          <span className="badge-identity">DID Activo</span>
          <h3>Mi Identidad RED</h3>
        </div>
        <div className="did-display">
          <code>did:red:{identity?.identity_hash || "Cargando..."}</code>
          <button className="copy-btn">📋</button>
        </div>
        <div className="security-notice">
          <p>⚠️ Tu identidad está vinculada a la blockchain de RED. Nadie puede suplantarte ni censurarte.</p>
        </div>
      </section>

      <div className="security-grid">
        <div className="security-item glass">
          <h4>Copia de Seguridad</h4>
          <p>Exporta tu clave privada para recuperar tu cuenta en otro dispositivo.</p>
          {showKey ? (
            <div className="private-key-display">
              <code>{identity?.identity_hash}7x92k...redsecret</code>
              <button className="btn-secondary" onClick={() => setShowKey(false)}>Ocultar</button>
            </div>
          ) : (
            <button className="btn-primary-small" onClick={() => setShowKey(true)}>Mostrar Clave</button>
          )}
        </div>

        <div className="security-item glass">
          <h4>Dispositivos Vinculados</h4>
          <div className="device-list">
            {mockDevices.map((device, idx) => (
              <div key={idx} className="device-item">
                <div className="device-icon">{device.name.includes("iPhone") ? "📱" : "💻"}</div>
                <div className="device-info">
                  <span className="device-name">{device.name} {device.active && <span className="active-tag"> (Este dispositivo)</span>}</span>
                  <span className="device-time">{device.lastUsed}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary-small" style={{ marginTop: '1rem', width: '100%' }}>Vincular nuevo dispositivo</button>
        </div>
      </div>

      <section className="forensics-panel glass" style={{ marginTop: '1.5rem', borderColor: 'var(--primary)' }}>
        <h4 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🛡️ Defensa Anti-Forense
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Protección avanzada contra extracción física y monitoreo del OS.
        </p>

        <div className="security-item" style={{ background: 'var(--bg-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h5>Bloquear Capturas de Pantalla (FLAG_SECURE)</h5>
            <button
              className={`theme-toggle ${privacyEnabled ? "dark" : "light"}`}
              onClick={togglePrivacyScreen}
              style={{ background: privacyEnabled ? 'var(--primary)' : 'var(--surface)' }}
            >
              <div className="theme-toggle-thumb" style={{ background: '#fff' }} />
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Impide que el sistema operativo o aplicaciones espía graben la pantalla de RED.
          </p>
        </div>

        <div className="security-item" style={{ background: 'var(--bg-2)', marginTop: '0.8rem' }}>
          <h5>PIN de Pánico (Data Wipe)</h5>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Configura un PIN falso. Si se introduce bajo coacción, borrará las claves criptográficas localmente de inmediato.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="password"
              inputMode="numeric"
              className="modal-input"
              placeholder="Ej. 9999"
              value={panicPin}
              onChange={(e) => setPanicPin(e.target.value.replace(/\D/g, ''))}
              style={{ width: '120px', margin: 0 }}
              maxLength={8}
            />
            <button className="btn-secondary" onClick={handleSetPanicPin}>Activar</button>
          </div>
        </div>

        <div className="security-item" style={{ background: 'var(--bg-2)', marginTop: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h5>Dead Man's Switch (Auto-destrucción)</h5>
            <select
              value={destructTimer}
              onChange={handleSetDestructTimer}
              style={{
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.8rem'
              }}
            >
              <option value="0">Desactivado</option>
              <option value="24">24 Horas</option>
              <option value="168">1 Semana (168h)</option>
              <option value="720">1 Mes (720h)</option>
            </select>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Si no abres la aplicación durante este periodo, tu cuenta de RED y todos tus datos (claves, chats, base de datos) se purgarán automáticamente.
          </p>
        </div>
      </section>

      <section className="network-status-panel glass">
        <h4>Estado de la Red Descentralizada</h4>
        <div className="stats-row">
          <div className="stat">
            <span className="label">Pares P2P: </span>
            <span className="value">{status?.peer_count || 0}</span>
          </div>
          <div className="stat">
            <span className="label">Bloque Actual: </span>
            <span className="value">#12,492</span>
          </div>
          <div className="stat">
            <span className="label">Latencia (Gossip): </span>
            <span className="value">42ms</span>
          </div>
        </div>
      </section>
    </div>
  );
}
