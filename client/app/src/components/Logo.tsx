"use client";

import React from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
}

export default function Logo({ size = 48, showText = false }: LogoProps) {
  return (
    <div className="logo-wrapper">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="logo-svg"
      >
        <defs>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF1744" />
            <stop offset="100%" stopColor="#D50000" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background Hexagon */}
        <path
          d="M50 5 L90 27.5 L90 72.5 L50 95 L10 72.5 L10 27.5 Z"
          fill="rgba(255, 23, 68, 0.05)"
          stroke="url(#redGradient)"
          strokeWidth="1.5"
          className="logo-pulse"
        />

        {/* Futuristic R */}
        <path
          d="M35 30 V70 H42 V55 H50 L60 70 H70 L58 52 C65 50 68 45 68 38 C68 30 62 25 52 25 H35 V30 Z M42 32 H52 C58 32 61 34 61 38 C61 42 58 45 52 45 H42 V32 Z"
          fill="url(#redGradient)"
          filter="url(#glow)"
        />

        {/* Decorative elements */}
        <circle cx="50" cy="5" r="2" fill="#FF1744" />
        <circle cx="90" cy="27.5" r="2" fill="#FF1744" />
        <circle cx="10" cy="27.5" r="2" fill="#FF1744" />
      </svg>

      {showText && <span className="logo-text">RED</span>}

      {showText && <span className="logo-text">RED</span>}
    </div>
  );
}
