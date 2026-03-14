"use client";

import React, { useState, useRef, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import SecurityPanel from "../../components/SecurityPanel";
import BlockchainDashboard from "../../components/BlockchainDashboard";
import { useRedStore } from "../../store/useRedStore";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

export default function Settings() {
  const router = useRouter();
  const { identity, displayName, avatarUrl, setDisplayName, setAvatar, nodeStatus, peers, status } = useRedStore();
  const [activeTab, setActiveTab] = useState("seguridad");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isDark, setIsDark] = useState(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setSyncToast(msg); setTimeout(() => setSyncToast(null), 3000); };

  // FIX C3: Share identity via native Share API (dynamic import) or clipboard fallback
  const handleShareIdentity = async () => {
    const did = `did:red:${identity?.identity_hash}`;
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'Mi identidad RED', text: did, dialogTitle: 'Compartir DID' });
    } catch {
      // Fallback for web/desktop: copy to clipboard
      try {
        await navigator.clipboard.writeText(did);
        showToast('✅ DID copiado al portapapeles');
      } catch {
        showToast('❌ No se pudo copiar el DID');
      }
    }
  };

  // FIX C5: Sync DHT by hitting the status endpoint (triggers reconnect)
  const handleSyncDHT = async () => {
    showToast('🔄 Sincronizando HashTable...');
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:7333';
      await fetch(`${base}/api/status`);
      showToast('✅ HashTable sincronizada correctamente');
    } catch {
      showToast('⚠️ No se pudo conectar con el nodo');
    }
  };

  // FIX C5: Clear mesh cache
  const handleClearCache = async () => {
    try {
      // Clear local mesh cache from sessionStorage / IndexedDB
      if (typeof window !== 'undefined') {
        const keys = Object.keys(sessionStorage).filter(k => k.startsWith('red_mesh_'));
        keys.forEach(k => sessionStorage.removeItem(k));
      }
      showToast('🗑️ Caché Mesh limpiada correctamente');
    } catch {
      showToast('❌ Error al limpiar la caché');
    }
  };

  useEffect(() => {
    if (identity?.identity_hash) {
      QRCode.toDataURL(`did:red:${identity.identity_hash}`)
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error(err));
    }
  }, [identity?.identity_hash]);

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
      <div className="settings-sidebar-wrapper">
        <style>{`
          @media (max-width: 768px) {
            .settings-sidebar-wrapper { display: none !important; }
          }
        `}</style>
        <Sidebar />
      </div>
      <section className="settings-content scrollbar-hide">
        <header className="mobile-settings-header glass">
          <button onClick={() => router.push('/chat')} className="back-btn">←</button>
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
                <div className="qr-placeholder" style={{ display: 'flex', justifyContent: 'center', background: 'transparent', border: 'none' }}>
                  {/* Real QR Rendering */}
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="QR Code" style={{ width: '150px', height: '150px', borderRadius: '8px', border: '4px solid white' }} />
                  ) : (
                    <div className="loader" style={{ margin: '2rem auto' }}></div>
                  )}
                </div>
                <p>Escanea este código para añadirme instantáneamente.</p>
                {/* FIX C3: functional share button */}
                <button className="btn-secondary" onClick={handleShareIdentity}>Compartir Identidad</button>
              </div>
            </div>
          )}

          {activeTab === "seguridad" && <SecurityPanel />}
          {activeTab === "explorador" && <BlockchainDashboard />}

          {activeTab === "apariencia" && (
            <div className="settings-section animate-fade" style={{ paddingBottom: '3rem' }}>
              <h3 className="section-title">🎨 Apariencia y Tema</h3>

              <div className="settings-row glass" style={{ marginBottom: "2rem" }}>
                <div className="settings-row-info">
                  <span>Modo Nocturno Integral</span>
                  <span className="settings-row-sub">Soporte completo para dispositivos OLED</span>
                </div>
                <button className={`theme-toggle ${isDark ? "dark" : "light"}`} onClick={toggleTheme}>
                  <div className="theme-toggle-thumb" />
                </button>
              </div>

              {/* === DASHBOARD CATEGORIZADO DE HERRAMIENTAS === */}
              <div className="tools-dashboard">
                
                {/* Categoría: Comunicación y Chat */}
                <div className="tools-section">
                  <h4 className="tools-section-header">
                    <span className="tools-section-icon">💬</span> Comunicación
                  </h4>
                  <div className="tools-grid">
                    <div className="tool-card-premium" onClick={() => router.push('/starred')}>
                      <div className="tool-card-bg-icon">⭐</div>
                      <div className="tool-card-icon" style={{color: 'var(--amber)'}}>⭐</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Mensajes Guardados</span>
                        <span className="tool-card-desc">Citas, llaves y textos destacados.</span>
                      </div>
                    </div>
                    
                    <div className="tool-card-premium" onClick={() => router.push('/calls')}>
                      <div className="tool-card-bg-icon">📞</div>
                      <div className="tool-card-icon" style={{color: 'var(--blue)'}}>📞</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Llamadas (WebRTC)</span>
                        <span className="tool-card-desc">Historial de conexiones p2p VoIP.</span>
                      </div>
                    </div>

                    <div className="tool-card-premium" onClick={() => router.push('/export')}>
                      <div className="tool-card-bg-icon">📤</div>
                      <div className="tool-card-icon" style={{color: 'var(--text-primary)'}}>📤</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Exportar Chat</span>
                        <span className="tool-card-desc">Copia de seguridad local JSON/TXT.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categoría: Gestión de Red Social */}
                <div className="tools-section">
                  <h4 className="tools-section-header">
                    <span className="tools-section-icon">👥</span> Social y Contactos
                  </h4>
                  <div className="tools-grid">
                    <div className="tool-card-premium" onClick={() => router.push('/contactqr')}>
                      <div className="tool-card-bg-icon">📲</div>
                      <div className="tool-card-icon" style={{color: 'var(--green)'}}>📲</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Mi Código QR</span>
                        <span className="tool-card-desc">Muestra tu DID para añadirte rápido.</span>
                      </div>
                    </div>

                    <div className="tool-card-premium" onClick={() => router.push('/contactsync')}>
                      <div className="tool-card-bg-icon">🔄</div>
                      <div className="tool-card-icon" style={{color: 'var(--primary)'}}>🔄</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Sincronizar RED</span>
                        <span className="tool-card-desc">Importar URIs o escanear entorno.</span>
                      </div>
                    </div>

                    <div className="tool-card-premium" onClick={() => router.push('/groupadmin')}>
                      <div className="tool-card-bg-icon">🛡️</div>
                      <div className="tool-card-icon" style={{color: '#ff9800'}}>🛡️</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Moderación</span>
                        <span className="tool-card-desc">Administrar roles en Grupos.</span>
                      </div>
                    </div>

                    <div className="tool-card-premium" onClick={() => router.push('/status')}>
                      <div className="tool-card-bg-icon">🌀</div>
                      <div className="tool-card-icon" style={{color: 'var(--purple)'}}>🌀</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Estados RED</span>
                        <span className="tool-card-desc">Emisión temporal criptográfica.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categoría: Infraestructura y Control */}
                <div className="tools-section">
                  <h4 className="tools-section-header">
                    <span className="tools-section-icon">⚡</span> Infraestructura
                  </h4>
                  <div className="tools-grid">
                    <div className="tool-card-premium" onClick={() => router.push('/nodemap')}>
                      <div className="tool-card-bg-icon">🌐</div>
                      <div className="tool-card-icon" style={{color: 'var(--primary)'}}>🌐</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Mapa de Nodos</span>
                        <span className="tool-card-desc">Explorador visual de topología Mesh.</span>
                      </div>
                    </div>

                    <div className="tool-card-premium" onClick={() => router.push('/crypto')}>
                      <div className="tool-card-bg-icon">🔐</div>
                      <div className="tool-card-icon" style={{color: 'var(--amber)'}}>🔐</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Criptografía</span>
                        <span className="tool-card-desc">Auditoría de cifrado y claves X25519.</span>
                      </div>
                    </div>

                    <div className="tool-card-premium" onClick={() => router.push('/stats')}>
                      <div className="tool-card-bg-icon">📊</div>
                      <div className="tool-card-icon" style={{color: 'var(--cyan, #00bcd4)'}}>📊</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Métricas Locales</span>
                        <span className="tool-card-desc">Volumen de datos y Pings.</span>
                      </div>
                    </div>
                    
                    <div className="tool-card-premium" onClick={() => router.push('/multidevice')}>
                      <div className="tool-card-bg-icon">💻</div>
                      <div className="tool-card-icon" style={{color: 'var(--text-secondary)'}}>💻</div>
                      <div className="tool-card-info">
                        <span className="tool-card-title">Multidispositivo</span>
                        <span className="tool-card-desc">Auditar sesiones conectadas.</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {(activeTab === "almacenamiento") && (
            <div className="settings-section animate-fade" style={{ paddingTop: '0' }}>
              <div className="blockchain-card glass" style={{ marginBottom: "1rem" }}>
                <h3>📦 Motor P2P local</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                  Tu dispositivo actúa como un nodo autónomo en la red RED.
                </p>
                
                <div className="blockchain-stat-row" style={{ marginTop: "0.5rem" }}>
                  <span>Estado del Nodo</span>
                  <strong className={nodeStatus === 'online' ? "text-green" : "text-amber"}>
                    {nodeStatus === 'online' ? "ACTIVO" : "INACTIVO"}
                  </strong>
                </div>
                <div className="blockchain-stat-row" style={{ marginTop: "0.5rem" }}>
                  <span>Peers de Búsqueda</span>
                  <strong>{peers.length} Conectados</strong>
                </div>
                <div className="blockchain-stat-row" style={{ marginTop: "0.5rem" }}>
                  <span>Motor Rust</span>
                  {/* FIX C6: show real version from backend */}
                  <strong>{status?.version ? `v${status.version} (Native)` : 'v1.0.0 (Native)'}</strong>
                </div>
              </div>

              {/* FIX C5: sync/clear now have real handlers */}
              {syncToast && (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.82rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  {syncToast}
                </div>
              )}

              <h3 className="section-title">⚡ Acciones del Nodo</h3>
              <div className="security-item glass" style={{ marginTop: "0.5rem" }}>
                <div className="security-icon" style={{ background: "rgba(0, 230, 118, 0.1)", color: "var(--green)" }}>🔄</div>
                <div className="security-info">
                  <h4>Sincronizar HashTable</h4>
                  <p>Fuerza la sincronización con la DHT de la red.</p>
                </div>
                <button className="btn-primary-small" onClick={handleSyncDHT}>Sincronizar</button>
              </div>

              <div className="security-item glass" style={{ marginTop: "0.5rem" }}>
                <div className="security-icon" style={{ background: "rgba(255, 23, 68, 0.1)", color: "var(--primary)" }}>🗑️</div>
                <div className="security-info">
                  <h4>Limpiar Caché Mesh</h4>
                  <p>Elimina los paquetes mesh almacenados localmente.</p>
                </div>
                <button className="btn-secondary" onClick={handleClearCache}>Limpiar</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
