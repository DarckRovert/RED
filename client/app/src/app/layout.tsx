"use client";

import React, { useEffect } from "react";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // 1. NATIVE MOBILE CSS INJECTION
    // This safely adds the .native-app class only after initial React mount,
    // guaranteeing no hydration mismatch between SSR and Client.
    const applyNativeOverrides = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform() || window.location.protocol === 'capacitor:') {
          document.body.classList.add('native-app');
          console.log("[RED 2.0] Mobile UI Context Activated");
          
          // Clear splash immediately to show the app UI instantly
          try {
            const { SplashScreen } = await import('@capacitor/splash-screen');
            await SplashScreen.hide();
          } catch (e) {
            console.warn("Splash plugin error", e);
          }
        }
      } catch (e) {
        // Fallback for local web testing
        if (window.location.hostname === 'localhost' && !window.location.port) {
            document.body.classList.add('native-app');
        }
      }
    };
    
    applyNativeOverrides();
  }, []);

  return (
    <html lang="es" className="dark">
      <head>
        <title>RED</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </head>
      <body>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}
