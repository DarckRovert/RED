'use client';

import React from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';

export const LandingBentoAndMatrix: React.FC = () => {
    const { t } = useTranslation();
    const isGhPages = typeof window !== "undefined" && window.location.pathname.includes("/RED");
    const basePath = isGhPages ? "/RED" : "";
    const hardwareImage = `${basePath}/assets/red_hardware_ecosystem.png`;

    return (
        <>
        <section id="bento" style={{ padding: "70px 0", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "5px 14px",
                borderRadius: "20px",
                background: "rgba(232, 33, 58, 0.12)",
                color: "#FF3355",
                border: "1px solid rgba(232, 33, 58, 0.35)",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 800,
                letterSpacing: "1px"
              }}
            >
              ARQUITECTURA DE VANGUARDIA • PILARES SOBERANOS
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "12px", letterSpacing: "-0.5px" }}>
              Los 6 Pilares de RED Sovereign Mesh OS
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
              Diseñado desde los primeros principios para garantizar que la comunicación humana sea invulnerable a censura, fallos de infraestructura y computación cuántica.
            </p>
          </div>

          <div
            className="showcase-bento-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: "20px",
            }}
          >
            {/* Card 1: Zero Servers / Zero Metadata (12 cols full width) */}
            <div
              style={{
                gridColumn: "span 12",
                padding: "36px",
                borderRadius: "24px",
                background: "radial-gradient(ellipse at top left, rgba(232, 33, 58, 0.18) 0%, rgba(14, 18, 34, 0.9) 100%)",
                border: "1.5px solid rgba(232, 33, 58, 0.4)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "24px"
              }}
            >
              <div>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🚫☁️</div>
                <h3 style={{ fontSize: "24px", fontWeight: 900, color: "#FFF", marginBottom: "10px" }}>
                  Cero Servidores. Cero Nube. Cero Metadatos Centralizados.
                </h3>
                <p style={{ fontSize: "15px", color: "#CBD5E1", lineHeight: 1.7, maxWidth: "850px" }}>
                  A diferencia de WhatsApp o Telegram que almacenan agendas de contactos, direcciones IP y grafos de conversación en servidores centrales (vulnerables a órdenes judiciales y ciberataques), en RED los mensajes viajan exclusivamente de memoria RAM a memoria RAM entre los terminales involucrados.
                </p>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ padding: "10px 18px", borderRadius: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,230,118,0.3)", fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: "#00E676", fontWeight: 700 }}>
                  ✓ Sin Registro de Direcciones IP
                </div>
                <div style={{ padding: "10px 18px", borderRadius: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,229,255,0.3)", fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: "#00E5FF", fontWeight: 700 }}>
                  ✓ Sin Número de Teléfono ni Correo
                </div>
                <div style={{ padding: "10px 18px", borderRadius: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,179,0,0.3)", fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: "#FFB300", fontWeight: 700 }}>
                  ✓ Sin Servidores Centrales
                </div>
              </div>
            </div>

            {/* Card 2: Multi-Radio Hardware Engine with Image (8 cols) */}
            <div
              style={{
                gridColumn: "span 8",
                padding: "32px",
                borderRadius: "24px",
                background: "linear-gradient(135deg, rgba(14, 18, 34, 0.95) 0%, rgba(8, 10, 20, 0.98) 100%)",
                border: "1.5px solid rgba(0, 229, 255, 0.35)",
                boxShadow: "0 15px 40px rgba(0,0,0,0.6)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "24px",
                alignItems: "center"
              }}
              className="bento-split-card"
            >
              <div>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}>📡</div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>
                  Ecosistema de Hardware Multi-Radio
                </h3>
                <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6, marginBottom: "14px" }}>
                  Enrutamiento híbrido simultáneo a través de BLE 5.3 GATT, WiFi Direct ad-hoc, transceptores LoRa 915 MHz (Heltec / LilyGO T-Beam) y módem ultrasónico SoundMesh.
                </p>
                <div style={{ fontSize: "11px", color: "#00E5FF", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                  ● Compatible con LilyGO, Heltec, RAK y USB OTG
                </div>
              </div>
              <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(0,229,255,0.3)" }}>
                <img
                  src={hardwareImage}
                  alt="RED Tactical Hardware Pelican Case"
                  style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            </div>

            {/* Card 3: Post-Quantum Cryptography (4 cols) */}
            <div
              style={{
                gridColumn: "span 4",
                padding: "32px",
                borderRadius: "24px",
                background: "linear-gradient(135deg, rgba(14, 18, 34, 0.95) 0%, rgba(8, 10, 20, 0.98) 100%)",
                border: "1.5px solid rgba(168, 85, 247, 0.4)",
                boxShadow: "0 15px 40px rgba(0,0,0,0.6)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}>🔐</div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>
                  Criptografía Post-Cuántica
                </h3>
                <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
                  Encapsulamiento de claves en retículos algebraicos <strong>NIST FIPS 203 (ML-KEM-768)</strong> combinado con Signal Double Ratchet para inmunidad absoluta retroactiva.
                </p>
              </div>
              <div style={{ marginTop: "16px", padding: "8px 12px", borderRadius: "10px", background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", fontSize: "11px", color: "#C084FC", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                ✓ Inmune a "Harvest Now, Decrypt Later"
              </div>
            </div>

            {/* Card 4: Walkie-Talkie Mesh HQ (4 cols) */}
            <div
              style={{
                gridColumn: "span 4",
                padding: "28px",
                borderRadius: "24px",
                background: "rgba(14, 18, 34, 0.85)",
                border: "1px solid rgba(255, 179, 0, 0.35)",
              }}
            >
              <div style={{ fontSize: "30px", marginBottom: "10px" }}>🎙️</div>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Walkie-Talkie Mesh HQ (PTT)</h3>
              <p style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>
                Compresión LowBitrateVocoder (8kHz IMA-ADPCM, 1.6–3.2 kbps) con auto-reproducción instantánea en canales de voz sobre Bluetooth LE y LoRa.
              </p>
            </div>

            {/* Card 5: Anti-Coercion Defense (4 cols) */}
            <div
              style={{
                gridColumn: "span 4",
                padding: "28px",
                borderRadius: "24px",
                background: "rgba(14, 18, 34, 0.85)",
                border: "1px solid rgba(0, 230, 118, 0.35)",
              }}
            >
              <div style={{ fontSize: "30px", marginBottom: "10px" }}>🧮</div>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Defensa Táctica Anti-Coerción</h3>
              <p style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>
                Camuflaje bajo calculadora funcional, PIN de pánico con autodestrucción inmediata de claves y bóveda señuelo configurable para inspecciones forzadas.
              </p>
            </div>

            {/* Card 6: DePIN Relay Economy (4 cols) */}
            <div
              style={{
                gridColumn: "span 4",
                padding: "28px",
                borderRadius: "24px",
                background: "rgba(14, 18, 34, 0.85)",
                border: "1px solid rgba(0, 229, 255, 0.35)",
              }}
            >
              <div style={{ fontSize: "30px", marginBottom: "10px" }}>⚡</div>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Economía DePIN & Proof-of-Relay</h3>
              <p style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>
                Recompensas criptográficas para operadores de nodos repetidores que retransmiten paquetes en zonas rurales y de emergencia sin costo por usuario.
              </p>
            </div>
          </div>
        </section>

        {/* Matrix Comparison Table */}
        <section id="matrix-comparison" style={{ padding: "40px 0 70px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <span style={{ fontSize: "11px", padding: "5px 14px", borderRadius: "20px", background: "rgba(0, 229, 255, 0.12)", color: "#00E5FF", border: "1px solid rgba(0, 229, 255, 0.35)", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
              BENCHMARK DE LA INDUSTRIA
            </span>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 38px)", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px" }}>
              Comparativa Técnica: RED vs La Competencia
            </h2>
            <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "750px", margin: "0 auto" }}>
              Cómo RED unifica el alcance de Meshtastic, la táctica de ATAK y el anonimato de Briar en una sola app sin hardware obligatorio.
            </p>
          </div>

          <div style={{ maxWidth: "1280px", margin: "0 auto", overflowX: "auto", padding: "0 16px" }}>
            <table style={{
              width: "100%", borderCollapse: "separate", borderSpacing: 0,
              background: "rgba(14, 18, 34, 0.9)", borderRadius: "20px",
              border: "1.5px solid rgba(255,255,255,0.1)", overflow: "hidden",
              fontSize: "12.5px"
            }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.6)", textAlign: "left" }}>
                  <th style={{ padding: "16px 18px", color: "#94A3B8", fontWeight: 800 }}>CAPACIDAD TÁCTICA</th>
                  <th style={{ padding: "16px 18px", color: "#00E676", fontWeight: 900, background: "rgba(0,230,118,0.12)" }}>RED SOVEREIGN OS</th>
                  <th style={{ padding: "16px 18px", color: "#FFB300", fontWeight: 800 }}>MESHTASTIC</th>
                  <th style={{ padding: "16px 18px", color: "#00E5FF", fontWeight: 800 }}>ATAK / CivTAK</th>
                  <th style={{ padding: "16px 18px", color: "#C084FC", fontWeight: 800 }}>BRIAR</th>
                  <th style={{ padding: "16px 18px", color: "#94A3B8", fontWeight: 700 }}>SIGNAL / WA</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feat: "Operación 100% Off-Grid sin Internet", red: "✓ Nativo Multi-Riel", mesh: "✓ Solo LoRa", atak: "⚠ Requiere servidor TAK o LAN", briar: "✓ BLE / Wi-Fi local", signal: "✗ 0% (Inútil sin red)" },
                  { feat: "Hardware Adicional Obligatorio", red: "✓ $0 (Usa cualquier móvil)", mesh: "✗ Obligatorio ESP32 ($40-$80)", atak: "⚠ Móvil militar / Radio", briar: "✓ Solo móvil", signal: "✓ Solo móvil" },
                  { feat: "Voz en Red de Malla (Vocoder)", red: "✓ 1.2 kbps (-97.9% comp.)", mesh: "✗ Solo texto plano", atak: "⚠ VoIP pesado", briar: "✗ No disponible", signal: "⚠ Requiere 4G/5G" },
                  { feat: "Interoperabilidad Cursor-on-Target (CoT)", red: "✓ XML CoT & MIL-STD-2525", mesh: "✗ No disponible", atak: "✓ Nativo Militar", briar: "✗ No disponible", signal: "✗ No disponible" },
                  { feat: "Cifrado Post-Cuántica (PQC)", red: "✓ NIST FIPS 203/204", mesh: "✗ Solo AES-256 clásica", mesh2: "✗ Clásica", atak: "✗ Clásica", briar: "✗ Curvas elípticas", signal: "⚠ Híbrido PQXDH" },
                  { feat: "Transporte Acústico (Air-Gap)", red: "✓ SoundMesh 18.5-20.5 kHz", mesh: "✗ No disponible", atak: "✗ No disponible", briar: "✗ No disponible", signal: "✗ No disponible" },
                  { feat: "Sensores Físicos (CBRN / rPPG / 4DOF)", red: "✓ CMOS + START + Balística", mesh: "✗ Solo I2C externo", atak: "⚠ Plugins pesados", briar: "✗ No disponible", signal: "✗ No disponible" },
                  { feat: "IA Local en el Borde (RAG INT8)", red: "✓ On-device (<5ms)", mesh: "✗ No disponible", atak: "✗ No disponible", briar: "✗ No disponible", signal: "✗ Requiere nube" },
                  { feat: "Modo Señuelo Anti-Coerción", red: "✓ Calculadora .CalculatorAlias", mesh: "✗ No disponible", atak: "✗ No disponible", briar: "✗ No disponible", signal: "✗ No disponible" }
                ].map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: rIdx % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                    <td style={{ padding: "13px 18px", color: "#FFF", fontWeight: 700 }}>{row.feat}</td>
                    <td style={{ padding: "13px 18px", color: "#00E676", fontWeight: 900, background: "rgba(0,230,118,0.06)" }}>{row.red}</td>
                    <td style={{ padding: "13px 18px", color: row.mesh.startsWith("✓") ? "#00E676" : row.mesh.startsWith("⚠") ? "#FFB300" : "#FF6B81" }}>{row.mesh}</td>
                    <td style={{ padding: "13px 18px", color: row.atak.startsWith("✓") ? "#00E676" : row.atak.startsWith("⚠") ? "#FFB300" : "#FF6B81" }}>{row.atak}</td>
                    <td style={{ padding: "13px 18px", color: row.briar.startsWith("✓") ? "#00E676" : row.briar.startsWith("⚠") ? "#FFB300" : "#FF6B81" }}>{row.briar}</td>
                    <td style={{ padding: "13px 18px", color: row.signal.startsWith("✓") ? "#00E676" : row.signal.startsWith("⚠") ? "#FFB300" : "#FF6B81" }}>{row.signal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </>
    );
};
