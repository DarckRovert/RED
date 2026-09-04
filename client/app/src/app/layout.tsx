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

        {/* Open Graph / Social Sharing (WhatsApp, Telegram, Facebook, LinkedIn) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="RED — Sovereign Mesh OS" />
        <meta property="og:title" content="RED — Sovereign Mesh OS v87.0.0" />
        <meta property="og:description" content="Sistema operativo táctico de comunicaciones peer-to-peer y supervivencia 100% off-grid. Malla LoRa (15–25 km), Bluetooth LE, Wi-Fi Direct, voz Vocoder a 1.2 kbps y criptografía post-cuántica NIST FIPS 203." />
        <meta property="og:image" content="https://darckrovert.github.io/RED/assets/red_hero_tactical_mesh.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="RED Sovereign Tactical Mesh Rugged Device" />
        <meta property="og:url" content="https://darckrovert.github.io/RED/" />
        <meta property="og:locale" content="es_ES" />

        {/* Twitter / X Cards */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="RED — Sovereign Mesh OS v87.0.0" />
        <meta name="twitter:description" content="Comunicaciones tácticas descentralizadas sin internet ni servidores centrales. Cifrado post-cuántico, interoperabilidad ATAK CoT y voz LoRa off-grid." />
        <meta name="twitter:image" content="https://darckrovert.github.io/RED/assets/red_hero_tactical_mesh.png" />

        {/* Schema.org SoftwareApplication JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "RED — Sovereign Mesh OS",
              "operatingSystem": "Android 7.0+, Web, Linux",
              "applicationCategory": "CommunicationApplication",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "softwareVersion": "87.0.0",
              "downloadUrl": "https://github.com/DarckRovert/RED/releases/tag/v87.0.0",
              "description": "Sistema operativo táctico de comunicaciones descentralizadas y supervivencia 100% off-grid."
            })
          }}
        />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (typeof window !== 'undefined') {
                    if (!window.Capacitor) {
                      window.Capacitor = {
                        triggerEvent: function() { return false; },
                        isNativePlatform: function() { return false; },
                        isPluginAvailable: function() { return false; },
                        Plugins: {}
                      };
                    } else if (typeof window.Capacitor.triggerEvent !== 'function') {
                      window.Capacitor.triggerEvent = function() { return false; };
                    }
                  }
                } catch(e) {}
              })();
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