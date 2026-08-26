"use client";

import React, { useEffect } from "react";
import "./globals.css";
import AmberAlertBanner from "@/components/AmberAlertBanner";
import { SOSEmergencyBanner } from "@/components/SOSEmergencyBanner";
import { I18nProvider } from "@/lib/i18n/i18nEngine";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    const applyNativeOverrides = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform() || window.location.protocol === "capacitor:") {
          document.body.classList.add("native-app");
          
          try {
            const { SplashScreen } = await import("@capacitor/splash-screen");
            await SplashScreen.hide();
          } catch {}
        } else {
          // Registrar Service Worker para PWA en entorno Web
          if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
            const swPath = `${basePath}/sw.js`;
            navigator.serviceWorker.register(swPath)
              .then((reg) => console.log("[RED PWA] Service Worker registrado con éxito:", reg.scope))
              .catch((err) => console.warn("[RED PWA] Error al registrar Service Worker:", err));
          }
        }
      } catch {
        if (window.location.hostname === "localhost" && !window.location.port) {
          document.body.classList.add("native-app");
        }
      }
    };
    
    applyNativeOverrides();
  }, [basePath]);

  return (
    <html lang="es" className="dark">
      <head>
        <title>RED — Sovereign Mesh OS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#06070B" />
        <meta name="description" content="Sistema operativo táctico de comunicaciones descentralizadas y supervivencia off-grid." />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RED" />
        <link rel="manifest" href={`${basePath}/manifest.json`} />
        <link rel="icon" href={`${basePath}/red_icon.png`} />
        <link rel="apple-touch-icon" href={`${basePath}/red_icon.png`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && !window.Capacitor) {
                window.Capacitor = {
                  triggerEvent: function() {},
                  isNativePlatform: function() { return false; },
                  isPluginAvailable: function() { return false; },
                  Plugins: {}
                };
              }
            `,
          }}
        />
      </head>
      <body>
        <I18nProvider>
          <AmberAlertBanner />
          <SOSEmergencyBanner />
          <div className="app-container">
            {children}
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}