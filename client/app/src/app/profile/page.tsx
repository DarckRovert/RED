"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { useRedStore } from "../../store/useRedStore";
import Logo from "../../components/Logo";
import Link from "next/link";
import QRCode from "qrcode";

export default function Profile() {
  const { identity, displayName } = useRedStore();
  const [qrSvg, setQrSvg] = useState<string>("");

  useEffect(() => {
    const data = `red://add-contact/${identity?.identity_hash || "pending"}?name=${encodeURIComponent(displayName)}`;
    QRCode.toString(data, {
      type: "svg",
      width: 140,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setQrSvg).catch(console.error);
  }, [identity, displayName]);

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
      <section className="profile-content">
        <header className="mobile-settings-header">
          <Link href="/settings" className="back-btn">←</Link>
          <h2>Mi Perfil</h2>
        </header>
        <div className="profile-card animate-fade" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
          <div className="profile-cover"></div>
          <div className="profile-main">
            <div className="avatar-large-container">
              <Logo size={100} />
            </div>
            <div className="profile-details">
              <h1>Mi Perfil RED</h1>
              <p className="did-tag">did:red:{identity?.identity_hash?.substring(0, 16)}...</p>
            </div>
          </div>

          <div className="qr-section">
            <div className="qr-placeholder" style={{ padding: '0.5rem', background: '#fff', borderRadius: '8px' }}>
              {qrSvg ? (
                <div dangerouslySetInnerHTML={{ __html: qrSvg }} style={{ borderRadius: 8, overflow: "hidden", display: "flex" }} />
              ) : (
                <div style={{ width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>⏳</div>
              )}
            </div>
            <div className="qr-info">
              <h4>Escanea para añadirme</h4>
              <p>Cualquier usuario de RED puede escanear este código para iniciar un chat cifrado contigo.</p>
              <button className="btn-primary">Compartir Perfil</button>
            </div>
          </div>

          <div className="profile-actions">
            <button className="btn-secondary">Editar Alias</button>
            <button className="btn-secondary">Gestionar Identidad</button>
          </div>
        </div>
      </section>
    </main>
  );
}
