import React from "react";

export const Web3BridgeHackInfographic: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  return (
    <div
      style={{
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(255, 23, 68, 0.3)",
        backgroundColor: "#070B12",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        margin: "14px 0",
        ...style,
      }}
    >
      <svg
        viewBox="0 0 720 350"
        width="100%"
        height="auto"
        style={{ display: "block" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#25090C" />
            <stop offset="100%" stopColor="#120406" />
          </linearGradient>
          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#052417" />
            <stop offset="100%" stopColor="#03120C" />
          </linearGradient>
        </defs>

        {/* Header */}
        <rect x="0" y="0" width="720" height="42" fill="#0C1322" />
        <text x="20" y="26" fill="#FF5252" fontSize="13" fontWeight="800" letterSpacing="0.5" fontFamily="monospace">
          INMUNIDAD ARQUITECTÓNICA · HACKS DE PUENTES WEB3 ($570M) VS BÓVEDA P2P RED
        </text>

        {/* Panel Superior: El Colapso de los Puentes Web3 */}
        <g transform="translate(16, 54)">
          <rect width="688" height="126" rx="8" fill="url(#hackGrad)" stroke="rgba(255,23,68,0.25)" strokeWidth="1" />
          
          <rect x="14" y="10" width="24" height="24" rx="6" fill="rgba(255,23,68,0.15)" />
          <text x="26" y="27" fontSize="13" textAnchor="middle">💥</text>
          <text x="46" y="23" fill="#FF8A80" fontSize="12" fontWeight="800" fontFamily="sans-serif">
            Puentes Cross-Chain Web3 (Caso BNB Token Hub - $570M USD Robados en 2022)
          </text>

          {/* Diagrama de Flujo del Ataque */}
          <g transform="translate(14, 40)">
            {/* Nodo 1: Cadena A */}
            <rect x="0" y="0" width="130" height="54" rx="6" fill="#1C0608" stroke="#FF5252" strokeWidth="1" />
            <text x="65" y="22" fill="#FFF" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">Cadena Cosmos</text>
            <text x="65" y="38" fill="#FF8A80" fontSize="9" textAnchor="middle" fontFamily="monospace">Hash de Bloque</text>

            {/* Flecha a Puente */}
            <line x1="135" y1="27" x2="175" y2="27" stroke="#FF5252" strokeWidth="2" strokeDasharray="3,2" />
            <polygon points="175,27 167,23 167,31" fill="#FF5252" />

            {/* Nodo 2: Smart Contract Puente (Vulnerabilidad) */}
            <rect x="180" y="0" width="180" height="54" rx="6" fill="#3D0B11" stroke="#FF1744" strokeWidth="1.5" />
            <text x="270" y="20" fill="#FFD600" fontSize="11" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">⚠️ Smart Contract Puente</text>
            <text x="270" y="36" fill="#FF5252" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="monospace">Falla en Verificación IAVL</text>

            {/* Flecha de Ataque */}
            <line x1="365" y1="27" x2="405" y2="27" stroke="#FF1744" strokeWidth="2" />
            <polygon points="405,27 397,23 397,31" fill="#FF1744" />

            {/* Nodo 3: Falsificación & Drenaje */}
            <rect x="410" y="0" width="245" height="54" rx="6" fill="#200508" stroke="#FF1744" strokeWidth="1" />
            <text x="532" y="20" fill="#FF1744" fontSize="11" fontWeight="800" textAnchor="middle" fontFamily="monospace">2M BNB ACUÑADOS DE LA NADA</text>
            <text x="532" y="36" fill="#FFA4A2" fontSize="9" textAnchor="middle" fontFamily="sans-serif">Hacker drena fondos y Binance pausa la red</text>
          </g>

          <text x="20" y="114" fill="#FF8A80" fontSize="10" fontFamily="sans-serif">
            • Causa Raíz: Dependencia de contratos intermedios centralizados con miles de líneas de código expuestas a internet.
          </text>
        </g>

        {/* Panel Inferior: La Bóveda Táctica P2P de RED */}
        <g transform="translate(16, 192)">
          <rect width="688" height="142" rx="8" fill="url(#shieldGrad)" stroke="rgba(0,230,118,0.35)" strokeWidth="1.5" />
          
          <rect x="14" y="10" width="24" height="24" rx="6" fill="rgba(0,230,118,0.15)" />
          <text x="26" y="27" fontSize="13" textAnchor="middle">🛡️</text>
          <text x="46" y="23" fill="#00E676" fontSize="12" fontWeight="800" fontFamily="sans-serif">
            Arquitectura P2P de RED: Cero Puentes, Cero Oráculos, 100% Offline
          </text>

          {/* Diagrama de Flujo Táctico */}
          <g transform="translate(14, 40)">
            {/* Nodo 1: Bóveda Local */}
            <rect x="0" y="0" width="145" height="56" rx="6" fill="#041B11" stroke="#00E676" strokeWidth="1" />
            <text x="72" y="22" fill="#FFF" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">Bóveda del Operador</text>
            <text x="72" y="38" fill="#00E676" fontSize="9" textAnchor="middle" fontFamily="monospace">Firma Ed25519 en Chip</text>

            {/* Flecha Criptográfica */}
            <line x1="150" y1="28" x2="195" y2="28" stroke="#00E676" strokeWidth="2" />
            <polygon points="195,28 187,24 187,32" fill="#00E676" />

            {/* Nodo 2: Transporte QR / Radio */}
            <rect x="200" y="0" width="170" height="56" rx="6" fill="#042217" stroke="#00E5FF" strokeWidth="1.5" />
            <text x="285" y="20" fill="#00E5FF" fontSize="11" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">Canal Óptico / LoRa</text>
            <text x="285" y="36" fill="#7DD3FC" fontSize="9" textAnchor="middle" fontFamily="monospace">Vale QR + Nullifier Único</text>

            {/* Flecha a Receptor */}
            <line x1="375" y1="28" x2="420" y2="28" stroke="#00E676" strokeWidth="2" />
            <polygon points="420,28 412,24 412,32" fill="#00E676" />

            {/* Nodo 3: Validación Matemática */}
            <rect x="425" y="0" width="230" height="56" rx="6" fill="#03160D" stroke="#00E676" strokeWidth="1" />
            <text x="540" y="20" fill="#00E676" fontSize="11" fontWeight="800" textAnchor="middle" fontFamily="monospace">VALIDACIÓN MATEMÁTICA PURA</text>
            <text x="540" y="36" fill="#A7F3D0" fontSize="9" textAnchor="middle" fontFamily="sans-serif">Comerciante valida en modo avión (0ms lag)</text>
          </g>

          <text x="20" y="118" fill="#A7F3D0" fontSize="10" fontFamily="sans-serif">
            • Inmunidad Absoluta: No existe ningún servidor central, contrato inteligente ni puente que hackear. Solo matemáticas puras entre dos dispositivos.
          </text>
          <text x="20" y="132" fill="#00E676" fontSize="10" fontWeight="700" fontFamily="monospace">
            ✓ INMUNE A HACKS EXTERNOS · OPERA SIN INTERNET NI PUENTES WEB3
          </text>
        </g>
      </svg>
    </div>
  );
};
