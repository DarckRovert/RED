"use client";

import React, { useState, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import SecurityPanel from "../../components/SecurityPanel";
import BlockchainDashboard from "../../components/BlockchainDashboard";
import { useRedStore } from "../../store/useRedStore";
import Link from "next/link";

export default function Settings() {
  const { identity, displayName, avatarUrl, setDisplayName, setAvatar } = useRedStore();
  const [activeTab, setActiveTab] = useState("seguridad");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute('data-theme', next ? '' : 'light');
    localStorage.setItem('red_theme', next ? 'dark' : 'light');
  };

  const tabs = [
    { id: "perfil", label: "Perfil", icon: "👤" },
    { id: "seguridad", label: "Seguridad", icon: "🔐" },
    { id: "apariencia", label: "Apariencia", icon: "🎨" },
    { id: "explorador", label: "Red", icon: "🌐" },
    { id: "almacenamiento", label: "P2P", icon: "📦" },
  ];

  return (
    <main className="main-layout bg-dark">
      <Sidebar />
      <section className="settings-content scrollbar-hide">
        <header className="mobile-settings-header glass">
          <Link href="/chat" className="back-btn">←</Link>
          <h2>Configuración</h2>
        </header>
        <nav className="settings-tabs glass">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="tab-render-area">
          {activeTab === "perfil" && (
            <div className="perfil-tab-content animate-fade">
              <div className="perfil-header-card glass">
                {/* Avatar Upload */}
                <input
                  type="file" accept="image/*"
                  style={{ display: "none" }}
                  ref={avatarInputRef}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => setAvatar(reader.result as string);
                    reader.readAsDataURL(f);
                  }}
                />
                <label className="avatar-upload-label" onClick={() => avatarInputRef.current?.click()}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" className="avatar-preview" />
                    : <div className="avatar-large">{displayName[0]?.toUpperCase() || "R"}</div>
                  }
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>Toca para cambiar</p>
                </label>

                {/* Display Name */}
                {editingName ? (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}>
                    <input
                      className="displayname-input"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      placeholder="Tu nombre visible..."
                      autoFocus
                    />
                    <button className="btn-primary-small" onClick={() => { setDisplayName(nameInput); setEditingName(false); }}>✓</button>
                    <button className="btn-secondary" onClick={() => setEditingName(false)}>✕</button>
                  </div>
                ) : (
                  <h2 onClick={() => setEditingName(true)} style={{ cursor: "pointer" }} title="Toca para editar">
                    {displayName} ✏️
                  </h2>
                )}
                <code>did:red:{identity?.identity_hash || "Generando..."}</code>
              </div>

              <div className="qr-section glass">
                <h3>Tu Código QR RED</h3>
                <div className="qr-placeholder">
                  {/* Visual QR Simulation */}
                  <div className="qr-grid">
                    {[...Array(25)].map((_, i) => <div key={i} className={`qr-pixel ${Math.random() > 0.5 ? 'black' : ''}`}></div>)}
                  </div>
                </div>
                <p>Escanea este código para añadirme instantáneamente.</p>
                <button className="btn-secondary">Compartir Identidad</button>
              </div>
            </div>
          )}

          {activeTab === "seguridad" && <SecurityPanel />}
          {activeTab === "explorador" && <BlockchainDashboard />}

          {activeTab === "apariencia" && (
            <div className="settings-section animate-fade">
              <h3 className="section-title">🎨 Apariencia</h3>

              <div className="settings-row glass">
                <div className="settings-row-info">
                  <span>Tema</span>
                  <span className="settings-row-sub">{isDark ? "🌙 Oscuro" : "☀️ Claro"}</span>
                </div>
                <button className={`theme-toggle ${isDark ? "dark" : "light"}`} onClick={toggleTheme}>
                  <div className="theme-toggle-thumb" />
                </button>
              </div>

              <h3 className="section-title" style={{ marginTop: "1.5rem" }}>🔗 Herramientas</h3>

              <Link href="/multidevice" className="settings-link-row glass">
                <span>📱 Dispositivos vinculados</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/export" className="settings-link-row glass">
                <span>📤 Exportar chat</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/status" className="settings-link-row glass">
                <span>🌀 Estados y historias</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/starred" className="settings-link-row glass">
                <span>⭐ Mensajes guardados</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/calls" className="settings-link-row glass">
                <span>📞 Historial de llamadas</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/contactqr" className="settings-link-row glass">
                <span>📲 Códigos QR</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/contactsync" className="settings-link-row glass">
                <span>🔄 Sincronizar contactos</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/groupadmin" className="settings-link-row glass">
                <span>👥 Admin del grupo</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/contactprofile" className="settings-link-row glass">
                <span>👤 Perfil de contacto</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/crypto" className="settings-link-row glass">
                <span>🔐 Panel de criptografía</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/stats" className="settings-link-row glass">
                <span>📊 Estadísticas de uso</span>
                <span className="arrow">›</span>
              </Link>
              <Link href="/nodemap" className="settings-link-row glass">
                <span>🌐 Mapa de nodos RED</span>
                <span className="arrow">›</span>
              </Link>
            </div>
          )}

          {(activeTab === "almacenamiento") && (
            <div className="placeholder-tab animate-fade">
              <h3>{tabs.find(t => t.id === activeTab)?.label}</h3>
              <p>Funcionalidad en desarrollo para optimización de RED.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
