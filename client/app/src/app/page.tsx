"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isNative, setIsNative] = useState<boolean | null>(null);

  const router = useRouter();

  useEffect(() => {
    // Detect if running inside the Android APK via Capacitor
    const native = typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.();
    setIsNative(native);

    // On native Android, go straight to the main chat screen using the router
    if (native) {
      console.log("[RED] Native platform detected, navigating to /chat...");
      router.replace('/chat');
    }
  }, [router]);

  // Loading state (first render, before useEffect runs)
  if (isNative === null) {
    return (
      <main className="landing-container">
        <div className="bg-gradient" />
        <div className="grid-overlay" />
      </main>
    );
  }

  /* ── NATIVE ANDROID — App Home Screen ── */
  if (isNative) {
    return (
      <main className="landing-container">
        <div className="bg-gradient" />
        <div className="grid-overlay" />

        <div className="hero-content animate-fade" style={{ textAlign: 'center' }}>
          <div className="logo-container">
            <h1 className="logo-text">RED</h1>
            <div className="logo-glow" />
          </div>

          <p className="hero-description" style={{ marginBottom: '8px' }}>
            Mensajería privada y descentralizada.
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '40px' }}>
            🇵🇪 DarckRovert · Lima, Perú
          </p>

          <div className="actions" style={{ flexDirection: 'column', gap: '14px' }}>
            <Link href="/offline" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1.05rem' }}>
              <span>🔴</span> Iniciar RED
            </Link>
            <Link href="/broadcast" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <span>📢</span> Difusión
            </Link>
          </div>

          <div className="status-grid" style={{ marginTop: '48px' }}>
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
                <span className="status-val">🇵🇪</span>
                <span className="status-label">Lima Origin</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ── WEB BROWSER — Download Landing ── */
  return (
    <main className="landing-container">
      <div className="bg-gradient" />
      <div className="grid-overlay" />

      <div className="hero-content animate-fade">
        <div className="logo-container">
          <h1 className="logo-text">RED</h1>
          <div className="logo-glow" />
        </div>

        <p className="hero-description">
          Mensajería privada, descentralizada e imparable.
          <br />
          <span>Tu privacidad es un derecho, no un privilegio.</span>
        </p>

        <div className="actions">
          <a
            href="https://red-descentralizada.netlify.app"
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>🌐</span> Más información
          </a>
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
