"use client";

import React, { useState, useEffect } from "react";
import SplashScreen from "../components/SplashScreen";
import Onboarding from "../components/Onboarding";
import Toast from "../components/Toast";
import OfflineIndicator from "../components/OfflineIndicator";
import ErrorBoundary from "../components/ErrorBoundary";
import SecurityHUD from "../components/SecurityHUD";
import LocationTracker from "../components/LocationTracker";
import PanicScreen from "../components/PanicScreen";
import { useRedStore } from "../store/useRedStore";
import "./globals.css";
import "./components.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const [deviceWiping, setDeviceWiping] = useState(false);
  const [ready, setReady] = useState(false);

  const { identity, init, hydrateFromStorage } = useRedStore();

  useEffect(() => {
    // 1. Safely hydrate store from localStorage
    hydrateFromStorage();

    // 2. Global error diagnostics for Android debugging
    window.onerror = (msg, url, line, col, error) => {
      try { localStorage.setItem('red_last_crash', `${msg}\n${url}:${line}:${col}\n${error?.stack || ''}`); } catch { }
      console.error('[RED onerror]', msg);
    };
    window.onunhandledrejection = (e) => console.error('[RED rejection]', e.reason);

    // 3. Skip splash on subsequent opens — only show on very first install
    let skipSplash = false;
    try { skipSplash = !!localStorage.getItem('red_has_launched'); } catch { }

    if (skipSplash) {
      setShowSplash(false);
      let hasOnboarded = true;
      try { hasOnboarded = !!localStorage.getItem('red_has_onboarded'); } catch { }
      if (!hasOnboarded) setShowOnboarding(true);
    }

    // Check if PANIC PIN is configured, mandate Lockscreen if so
    let hasPanicPin = false;
    try { hasPanicPin = !!localStorage.getItem("red_panic_pin"); } catch { }
    if (hasPanicPin) setShowLock(true);

    // 4. Dead Man's Switch Check (Auto-destruct)
    let triggeredWipe = false;
    try {
      const timerHrs = parseInt(localStorage.getItem('red_destruct_timer_hrs') || "0");
      const lastActivityStr = localStorage.getItem('red_last_activity');

      if (timerHrs > 0) {
        if (lastActivityStr) {
          const lastActivity = parseInt(lastActivityStr);
          const elapsedMs = Date.now() - lastActivity;
          const limitMs = timerHrs * 60 * 60 * 1000;
          if (elapsedMs > limitMs) {
            // Auto-destruct triggered!
            console.warn("[RED] Dead Man's Switch Triggered. Wiping data.");
            localStorage.clear();
            sessionStorage.clear();
            triggeredWipe = true;
            setDeviceWiping(true);
            setTimeout(() => window.location.reload(), 1500);
          }
        }
        // Update last activity if we survived
        if (!triggeredWipe) {
          localStorage.setItem('red_last_activity', Date.now().toString());
        }
      }
    } catch { }

    if (triggeredWipe) return; // Halt init, we are wiping.

    // 5. Initialize app (store guards double-init)
    init();

    // 5. Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { });
    }

    // 6. Notification permission (Android WebView safe)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch { }
    }

    // 7. Restore theme
    try {
      const t = localStorage.getItem('red_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : '');
    } catch { }

    // 8. Capacitor App lifecycle — re-init data on foreground resume (no splash replay)
    const attachCapacitorListeners = async () => {
      try {
        // Dynamic import so it doesn't crash in browser environment
        const capApp = await import('@capacitor/app').catch(() => null);
        if (!capApp) return;
        capApp.App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
          if (isActive) {
            // Foreground resume
            console.log('[RED] Foreground resume — refreshing');
            try {
              // Dead Man's Switch secondary check on resume
              const timerHrs = parseInt(localStorage.getItem('red_destruct_timer_hrs') || "0");
              const lastActivityObj = localStorage.getItem('red_last_activity');
              if (timerHrs > 0 && lastActivityObj) {
                if ((Date.now() - parseInt(lastActivityObj)) > (timerHrs * 60 * 60 * 1000)) {
                  localStorage.clear();
                  setDeviceWiping(true);
                  setTimeout(() => window.location.reload(), 1500);
                  return;
                } else {
                  localStorage.setItem('red_last_activity', Date.now().toString());
                }
              }
              init();
            } catch { }
          }
        });
      } catch {
        /* Running in browser environment — Capacitor not available */
      }
    };
    attachCapacitorListeners();

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSplashFinish = () => {
    setShowSplash(false);
    try { localStorage.setItem('red_has_launched', '1'); } catch { }
    if (!identity) setShowOnboarding(true);
  };

  const handleOnboardingFinish = (_newIdentity: unknown) => {
    setShowOnboarding(false);
    try { localStorage.setItem('red_has_onboarded', '1'); } catch { }
  };

  const handleWipe = () => {
    setDeviceWiping(true);
    // Simulate system-level destruction delay before forcing a reload to blank slate
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // Prevent SSR hydration mismatch flash — show black screen until client ready
  if (!ready) {
    return (
      <html lang="es">
        <head>
          <title>RED - Mensajería Descentralizada</title>
          <meta name="description" content="La red de mensajería más segura y descentralizada del mundo." />
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
      </head>
      <body>
        <ErrorBoundary>
          <OfflineIndicator />
          <SecurityHUD />
          <LocationTracker />
          <Toast />

          {deviceWiping ? (
            <div className="splash-screen" style={{ background: "black", zIndex: 99999 }}>
              <p className="font-mono text-muted text-sm">WIPING SECURE ENCLAVE...</p>
            </div>
          ) : showLock ? (
            <PanicScreen onVerified={() => setShowLock(false)} onWipe={handleWipe} />
          ) : showSplash ? (
            <SplashScreen onFinish={handleSplashFinish} />
          ) : showOnboarding ? (
            <Onboarding onFinish={handleOnboardingFinish} />
          ) : (
            <div className="animate-fade app-container-hud">
              {children}
            </div>
          )}
        </ErrorBoundary>
      </body>
    </html>
  );
}
