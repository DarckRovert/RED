"use client";

import React from "react";
import Sidebar from "../../components/Sidebar";
import { useRedStore } from "../../store/useRedStore";
import Logo from "../../components/Logo";
import Link from "next/link";

export default function Profile() {
  const { identity } = useRedStore();

  return (
    <main className="main-layout bg-dark">
      <Sidebar />
      <section className="profile-content">
        <header className="mobile-settings-header glass rounded-header">
          <Link href="/chat" className="back-btn">←</Link>
          <h2>Mi Perfil</h2>
        </header>
        <div className="profile-card glass animate-fade">
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
            <div className="qr-placeholder glass">
              <div className="qr-simulated">
                {/* Simulated QR Code for Identity Sharing */}
                <div className="qr-block"></div>
                <div className="qr-block"></div>
                <div className="qr-block"></div>
                <div className="qr-block"></div>
              </div>
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
