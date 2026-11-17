import React from "react";

export const PowVsPorInfographic: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  return (
    <div
      style={{
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(0, 229, 255, 0.25)",
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
          <linearGradient id="powGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2A1405" />
            <stop offset="100%" stopColor="#170A02" />
          </linearGradient>
          <linearGradient id="porGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#04202C" />
            <stop offset="100%" stopColor="#031117" />
          </linearGradient>
        </defs>

        {/* Header */}
        <rect x="0" y="0" width="720" height="42" fill="#0C1322" />
        <text x="20" y="26" fill="#FFD600" fontSize="13" fontWeight="800" letterSpacing="0.5" fontFamily="monospace">
          EFICIENCIA ENERGÉTICA · GASTO INÚTIL VS TELECOMUNICACIÓN DE RESCATE
        </text>

        {/* Panel 1: Proof-of-Work (PoW) */}
        <g transform="translate(16, 56)">
          <rect width="336" height="268" rx="10" fill="url(#powGrad)" stroke="rgba(255,109,0,0.3)" strokeWidth="1" />
          <rect x="14" y="12" width="34" height="34" rx="8" fill="rgba(255,109,0,0.15)" />
          <text x="31" y="35" fontSize="18" textAnchor="middle">🔥</text>
          <text x="58" y="26" fill="#FFF" fontSize="14" fontWeight="800" fontFamily="sans-serif">Proof-of-Work (PoW)</text>
          <text x="58" y="40" fill="#FFAB91" fontSize="10" fontFamily="monospace">Minería Térmica Tradicional</text>

          {/* Gráfico ASIC Farm quemando energía */}
          <rect x="14" y="56" width="308" height="82" rx="8" fill="#140702" />
          <rect x="30" y="68" width="56" height="46" rx="4" fill="#3E1A0C" stroke="#FF6D00" strokeWidth="1.5" />
          <line x1="38" y1="80" x2="78" y2="80" stroke="#FFAB91" strokeWidth="2" />
          <line x1="38" y1="92" x2="78" y2="92" stroke="#FFAB91" strokeWidth="2" />
          <line x1="38" y1="104" x2="78" y2="104" stroke="#FFAB91" strokeWidth="2" />

          {/* Símbolo de calor / disipación */}
          <path d="M100 80 Q110 70 120 80 T140 80" stroke="#FF3D00" strokeWidth="2" fill="none" />
          <path d="M100 95 Q110 85 120 95 T140 95" stroke="#FF3D00" strokeWidth="2" fill="none" />
          <text x="190" y="86" fill="#FFAB91" fontSize="11" fontWeight="700" fontFamily="monospace">~140 TWh/año</text>
          <text x="190" y="102" fill="#E64A19" fontSize="9" fontFamily="sans-serif">Cálculo de ceros SHA-256</text>
          <text x="190" y="116" fill="#FF8A80" fontSize="9" fontFamily="sans-serif">Calor residual sin utilidad</text>

          <text x="16" y="156" fill="#FFE0B2" fontSize="11" fontFamily="sans-serif" fontWeight="700">Mecanismo de Gasto:</text>
          <text x="16" y="174" fill="#BCAAA4" fontSize="10" fontFamily="sans-serif">
            <tspan x="16" dy="0">Miles de chips ASIC compitiendo</tspan>
            <tspan x="16" dy="14">por adivinar números aleatorios.</tspan>
            <tspan x="16" dy="14">En un apagón o guerra, el calor disipado</tspan>
            <tspan x="16" dy="14">no salva vidas ni da de comer a nadie.</tspan>
          </text>

          <rect x="16" y="226" width="304" height="26" rx="6" fill="rgba(255,61,0,0.12)" stroke="rgba(255,61,0,0.3)" strokeWidth="1" />
          <text x="168" y="243" fill="#FF6D00" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="monospace">
            ✕ DESPERDICIO TERMODINÁMICO
          </text>
        </g>

        {/* Panel 2: Proof-of-Relay (PoR) */}
        <g transform="translate(368, 56)">
          <rect width="336" height="268" rx="10" fill="url(#porGrad)" stroke="rgba(0,229,255,0.4)" strokeWidth="1.5" />
          <rect x="14" y="12" width="34" height="34" rx="8" fill="rgba(0,229,255,0.15)" />
          <text x="31" y="35" fontSize="18" textAnchor="middle">📡</text>
          <text x="58" y="26" fill="#FFF" fontSize="14" fontWeight="800" fontFamily="sans-serif">Proof-of-Relay (PoR)</text>
          <text x="58" y="40" fill="#00E5FF" fontSize="10" fontFamily="monospace" fontWeight="700">RED Sovereign Mesh</text>

          {/* Gráfico Repetidor Solar y Cobertura */}
          <rect x="14" y="56" width="308" height="82" rx="8" fill="#02141A" />
          {/* Panel Solar */}
          <polygon points="30,105 50,75 80,75 60,105" fill="#0284C7" stroke="#38BDF8" strokeWidth="1.5" />
          {/* Antena */}
          <line x1="95" y1="120" x2="95" y2="70" stroke="#00E676" strokeWidth="2.5" />
          <circle cx="95" cy="68" r="4" fill="#00E676" />
          {/* Ondas RF */}
          <path d="M102 64 Q112 68 102 72" stroke="#00E5FF" strokeWidth="1.5" fill="none" />
          <path d="M108 58 Q122 68 108 78" stroke="#00E5FF" strokeWidth="1.5" fill="none" opacity="0.7" />
          <path d="M114 52 Q132 68 114 84" stroke="#00E5FF" strokeWidth="1.5" fill="none" opacity="0.4" />

          <text x="140" y="84" fill="#00E676" fontSize="12" fontWeight="800" fontFamily="monospace">~5W Solar Autónomo</text>
          <text x="140" y="100" fill="#38BDF8" fontSize="9" fontFamily="sans-serif">Retransmite paquetes de socorro</text>
          <text x="140" y="114" fill="#80D8FF" fontSize="9" fontFamily="sans-serif">Radio LoRa/BLE sin internet</text>

          <text x="16" y="156" fill="#E0F7FA" fontSize="11" fontFamily="sans-serif" fontWeight="700">Mecanismo de Retransmisión:</text>
          <text x="16" y="174" fill="#B2EBF2" fontSize="10" fontFamily="sans-serif">
            <tspan x="16" dy="0">Cada byte retransmitido es un paquete</tspan>
            <tspan x="16" dy="14">vital: triage médico, coordenadas de rescate</tspan>
            <tspan x="16" dy="14">o avisos de evacuación. Minar es servir</tspan>
            <tspan x="16" dy="14">directamente a la comunidad local.</tspan>
          </text>

          <rect x="16" y="226" width="304" height="26" rx="6" fill="rgba(0,230,118,0.16)" stroke="rgba(0,230,118,0.4)" strokeWidth="1" />
          <text x="168" y="243" fill="#00E676" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="monospace">
            ✓ UTILIDAD CIVIL DIRECTA · 0.05 CR/KB
          </text>
        </g>
      </svg>
    </div>
  );
};
