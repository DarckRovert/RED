import React from "react";

export const RaiStonesInfographic: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  return (
    <div
      style={{
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(0, 230, 118, 0.25)",
        backgroundColor: "#070B12",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        margin: "14px 0",
        ...style,
      }}
    >
      <svg
        viewBox="0 0 720 340"
        width="100%"
        height="auto"
        style={{ display: "block" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="raiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="fiatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2A1215" />
            <stop offset="100%" stopColor="#15080A" />
          </linearGradient>
          <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#062E1E" />
            <stop offset="100%" stopColor="#041B12" />
          </linearGradient>
        </defs>

        {/* Header */}
        <rect x="0" y="0" width="720" height="42" fill="#0C1322" />
        <text x="20" y="26" fill="#00E5FF" fontSize="13" fontWeight="800" letterSpacing="0.5" fontFamily="monospace">
          HISTORIA DEL CONSENSO · EL VALOR NO ES EL OBJETO, ES LA MEMORIA
        </text>

        {/* Card 1: Piedras Rai */}
        <g transform="translate(16, 56)">
          <rect width="216" height="268" rx="10" fill="url(#raiGrad)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <rect x="12" y="12" width="34" height="34" rx="8" fill="rgba(255,255,255,0.06)" />
          <text x="29" y="35" fontSize="18" textAnchor="middle">🗿</text>
          <text x="56" y="26" fill="#F1F5F9" fontSize="13" fontWeight="800" fontFamily="sans-serif">Piedras Rai</text>
          <text x="56" y="40" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">Isla de Yap (500 d.C.)</text>

          {/* Gráfico Disco Rai en el Fondo del Mar */}
          <rect x="12" y="58" width="192" height="74" rx="8" fill="#08101E" />
          <circle cx="108" cy="95" r="28" fill="#475569" stroke="#94A3B8" strokeWidth="2" />
          <circle cx="108" cy="95" r="8" fill="#08101E" stroke="#94A3B8" strokeWidth="1.5" />
          <path d="M70 120 Q108 112 146 120" stroke="#00E5FF" strokeWidth="1.5" fill="none" opacity="0.6" />
          <text x="108" y="128" fill="#00E5FF" fontSize="8" textAnchor="middle" fontFamily="monospace">Piedra en el fondo del mar</text>

          <text x="16" y="152" fill="#CBD5E1" fontSize="11" fontFamily="sans-serif" fontWeight="600">Libro Mayor Social:</text>
          <text x="16" y="170" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">
            <tspan x="16" dy="0">La piedra nunca se mueve.</tspan>
            <tspan x="16" dy="14">Toda la tribu reconoce quién</tspan>
            <tspan x="16" dy="14">es el dueño por consenso oral.</tspan>
          </text>

          <rect x="16" y="222" width="184" height="26" rx="6" fill="rgba(0,229,255,0.1)" stroke="rgba(0,229,255,0.3)" strokeWidth="1" />
          <text x="108" y="239" fill="#00E5FF" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="monospace">
            ✓ 100% CONFIANZA SOCIAL
          </text>
        </g>

        {/* Card 2: Dinero Fiat */}
        <g transform="translate(252, 56)">
          <rect width="216" height="268" rx="10" fill="url(#fiatGrad)" stroke="rgba(255,23,68,0.25)" strokeWidth="1" />
          <rect x="12" y="12" width="34" height="34" rx="8" fill="rgba(255,23,68,0.1)" />
          <text x="29" y="35" fontSize="18" textAnchor="middle">🏦</text>
          <text x="56" y="26" fill="#F1F5F9" fontSize="13" fontWeight="800" fontFamily="sans-serif">Dinero Fiat</text>
          <text x="56" y="40" fill="#FF8A80" fontSize="10" fontFamily="sans-serif">1971 - Actualidad</text>

          {/* Gráfico Impresión de Papel */}
          <rect x="12" y="58" width="192" height="74" rx="8" fill="#18070A" />
          <rect x="58" y="72" width="100" height="46" rx="4" fill="#2E1116" stroke="#FF1744" strokeWidth="1.5" />
          <text x="108" y="99" fill="#FF5252" fontSize="16" fontWeight="900" textAnchor="middle" fontFamily="monospace">$ ∞</text>
          <path d="M72 124 L144 124" stroke="#FF1744" strokeWidth="1" strokeDasharray="3,3" />
          <text x="108" y="128" fill="#FF8A80" fontSize="8" textAnchor="middle" fontFamily="monospace">Impresión sin respaldo</text>

          <text x="16" y="152" fill="#CBD5E1" fontSize="11" fontFamily="sans-serif" fontWeight="600">Decreto Estatal:</text>
          <text x="16" y="170" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">
            <tspan x="16" dy="0">No tiene respaldo en oro</tspan>
            <tspan x="16" dy="14">ni en trabajo físico.</tspan>
            <tspan x="16" dy="14">Se devalúa por inflación.</tspan>
          </text>

          <rect x="16" y="222" width="184" height="26" rx="6" fill="rgba(255,23,68,0.12)" stroke="rgba(255,23,68,0.3)" strokeWidth="1" />
          <text x="108" y="239" fill="#FF5252" fontSize="10" fontWeight="700" textAnchor="middle" fontFamily="monospace">
            ✕ MONOPOLIO CENTRAL
          </text>
        </g>

        {/* Card 3: RED Proof-of-Relay */}
        <g transform="translate(488, 56)">
          <rect width="216" height="268" rx="10" fill="url(#redGrad)" stroke="rgba(0,230,118,0.4)" strokeWidth="1.5" />
          <rect x="12" y="12" width="34" height="34" rx="8" fill="rgba(0,230,118,0.15)" />
          <text x="29" y="35" fontSize="18" textAnchor="middle">📡</text>
          <text x="56" y="26" fill="#F1F5F9" fontSize="13" fontWeight="800" fontFamily="sans-serif">RED Sovereign</text>
          <text x="56" y="40" fill="#00E676" fontSize="10" fontFamily="monospace" fontWeight="700">Proof-of-Relay (PoR)</text>

          {/* Gráfico Malla de Radio Táctica */}
          <rect x="12" y="58" width="192" height="74" rx="8" fill="#05160E" />
          <circle cx="68" cy="95" r="10" fill="#00E676" />
          <circle cx="148" cy="95" r="10" fill="#00E5FF" />
          <line x1="78" y1="95" x2="138" y2="95" stroke="#00E676" strokeWidth="2" strokeDasharray="4,2" />
          <circle cx="108" cy="95" r="5" fill="#FFD600" />
          <text x="108" y="128" fill="#00E676" fontSize="8" textAnchor="middle" fontFamily="monospace">0.05 Créditos / KB retransmitido</text>

          <text x="16" y="152" fill="#E2E8F0" fontSize="11" fontFamily="sans-serif" fontWeight="700">Utilidad de Emergencia:</text>
          <text x="16" y="170" fill="#A7F3D0" fontSize="10" fontFamily="sans-serif">
            <tspan x="16" dy="0">Respaldado por el trabajo real</tspan>
            <tspan x="16" dy="14">de mantener comunicada</tspan>
            <tspan x="16" dy="14">a la comunidad en catástrofes.</tspan>
          </text>

          <rect x="16" y="222" width="184" height="26" rx="6" fill="rgba(0,230,118,0.18)" stroke="rgba(0,230,118,0.5)" strokeWidth="1" />
          <text x="108" y="239" fill="#00E676" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="monospace">
            ✓ VALOR TANGIBLE REAL
          </text>
        </g>
      </svg>
    </div>
  );
};
