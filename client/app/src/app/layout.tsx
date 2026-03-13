"use client";

import React, { useState, useEffect } from "react";
import Toast from "../components/Toast";
import OfflineIndicator from "../components/OfflineIndicator";
import ErrorBoundary from "../components/ErrorBoundary";
import { useRedStore } from "../store/useRedStore";
import "./globals.css";
import "./components.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [ready, setReady] = useState(false);
  const { init, hydrateFromStorage } = useRedStore();

  const [errorLog, setErrorLog] = useState<string[]>([]);

  useEffect(() => {
    // Global Error Diagnostics Overlay (Native Debugging)
    const handleError = (msg: string | Event, url?: string, line?: number, col?: number, error?: Error) => {
      const entry = `${msg} ${line ? `at ${line}:${col}` : ""}`;
      console.error("[RED CRASH]", entry, error);
      setErrorLog(prev => [...prev, entry].slice(-10));
    };
    window.onerror = handleError;
    window.onunhandledrejection = (e) => handleError(`Promise Rejection: ${e.reason}`);

    const initApp = async () => {
      try {
        console.log("[RED] Application handshake starting...");
        hydrateFromStorage();

        // Restore theme
        try {
          const t = localStorage.getItem('red_theme') || 'dark';
          document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : '');
        } catch { }

        // Native specifics — MUST start Rust node BEFORE polling init()
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
          const { default: RedNode } = await import('../plugins/RedNode');
          const { SplashScreen } = await import('@capacitor/splash-screen');
          
          let password = "default_mobile_password";
          try {
            const stored = localStorage.getItem('red_identity');
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed.state?.password) password = parsed.state.password;
            }
          } catch { }

          // START RUST NODE FIRST — so it is ready when init() starts polling
          await RedNode.start({ password }).catch(e => {
            handleError("Node Start Error: " + e.message);
          });

          // Give Rust 2s to initialize blockchain + storage + bind port 4555
          // The previous 300ms was too short - blockchain init alone can take 1-3s
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Now poll for connection (20 retries × 500ms = 10 more seconds of chances)
          await init().catch(e => console.warn("[RED] Store init failed, proceeding anyway", e));

          setTimeout(() => {
            SplashScreen.hide().catch(() => {});
            console.log("[RED] Splash screen hidden.");
          }, 400);
        } else {
          // Web: just init normally
          await init().catch(e => console.warn("[RED] Store init failed, proceeding anyway", e));
        }

        setReady(true);
        console.log("[RED] Handshake complete.");
      } catch (err: any) {
        handleError("Critical App Failure: " + (err.message || String(err)));
      }
    };

    initApp();

    // App lifecycle for last activity
    const attachCapacitorListeners = async () => {
      try {
        const capApp = await import('@capacitor/app').catch(() => null);
        if (capApp?.App) {
          capApp.App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
              localStorage.setItem('red_last_activity', Date.now().toString());
              init().catch(() => {});
            }
          });
        }
      } catch { }
    };
    attachCapacitorListeners();
  }, [init, hydrateFromStorage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <html lang="es">
        <head>
          <title>RED - Mensajería Descentralizada</title>
          <meta name="description" content="La red de mensajería más segura y descentralizada del mundo." />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        </head>
        <body style={{ background: '#0a0c0e', minHeight: '100vh' }} />
      </html>
    );
  }

  return (
    <html lang="es">
      <head>
        <title>RED - Mensajería Descentralizada</title>
        <meta name="description" content="La red de mensajería más segura y descentralizada del mundo." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </head>
      <body>
        {errorLog.length > 0 && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, 
            background: '#ff0033', color: 'white', padding: '15px', 
            zIndex: 99999, fontSize: '11px', fontFamily: 'monospace',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)', borderBottom: '2px solid white'
          }}>
            <strong>🚨 RED CRASH REPORTER</strong>
            {errorLog.map((log, i) => <div key={i} style={{ marginTop: '4px' }}>• {log}</div>)}
            <div style={{ marginTop: '8px', fontSize: '9px', opacity: 0.8 }}>Toma una captura de pantalla de esto y envíala a DarckRovert.</div>
          </div>
        )}
        <ErrorBoundary>
          <OfflineIndicator />
          <Toast />
          <div className="animate-fade app-container-hud">
            {children}
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}
