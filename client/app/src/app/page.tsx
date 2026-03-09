"use client";

import React from "react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-container">
      <div className="bg-gradient"></div>
      <div className="grid-overlay"></div>

      <div className="hero-content animate-fade">
        <div className="logo-container">
          <h1 className="logo-text">RED</h1>
          <div className="logo-glow"></div>
        </div>

        <p className="hero-description">
          Mensajería privada, descentralizada e imparable.
          <br />
          <span>Tu privacidad es un derecho, no un privilegio.</span>
        </p>

        <div className="actions">
          <Link href="/chat" className="btn-primary">
            Empezar ahora
          </Link>
          <button className="btn-secondary">
            Saber más
          </button>
        </div>

        <div className="status-grid">
          <div className="status-item glass">
            <div className="status-info">
              <span className="status-val">E2E</span>
              <span className="status-label">Cifrado</span>
            </div>
          </div>
          <div className="status-item glass">
            <div className="status-info">
              <span className="status-val">P2P</span>
              <span className="status-label">Protocolo</span>
            </div>
          </div>
          <div className="status-item glass">
            <div className="status-info">
              <span className="status-val">DID</span>
              <span className="status-label">Identidad</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
