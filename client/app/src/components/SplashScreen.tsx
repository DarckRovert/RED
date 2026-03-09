"use client";

import React, { useEffect, useState } from "react";
import Logo from "./Logo";

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onFinish, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div className="splash-screen">
      <div className="bg-glitch"></div>

      <div className="content animate-fade">
        <Logo size={120} />
        <div className="branding">
          <h1>RED</h1>
          <p>DESCENTRALIZADO . SEGURO . TUYO</p>
        </div>

        <div className="loading-container">
          <div className="loading-bar" style={{ width: `${progress}%` }}></div>
          <span className="loading-text">Sincronizando con la red P2P... {progress}%</span>
        </div>
      </div>

    </div>
  );
}
