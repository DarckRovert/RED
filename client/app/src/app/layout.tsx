"use client";

import React, { useEffect } from "react";
import "./globals.css";
import AmberAlertBanner from "@/components/AmberAlertBanner";
import { SOSEmergencyBanner } from "@/components/SOSEmergencyBanner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        }
      } catch {
        if (window.location.hostname === "localhost" && !window.location.port) {
          document.body.classList.add("native-app");
        }
      }
    };
    
    applyNativeOverrides();
  }, []);

  return (
    <html lang="es" className="dark">
      <head>
        <title>RED — Sovereign Mesh OS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.Capacitor = window.Capacitor || {
                triggerEvent: function() {},
                isNativePlatform: function() { return typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || window.location.hostname === 'localhost'); },
                Plugins: {}
              };
            `,
          }}
        />
      </head>
      <body>
        <AmberAlertBanner />
        <SOSEmergencyBanner />
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}