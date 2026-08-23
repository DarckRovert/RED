import React from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';

export const LandingBentoAndMatrix: React.FC = () => {
    const { t } = useTranslation();
    return (
        <>
        <section id="bento" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(255, 42, 81, 0.15)",
                color: "#FF2A51",
                border: "1px solid rgba(255, 42, 81, 0.3)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              {t.showcase_landing?.feature_matrix_title || "ARQUITECTURA DE VANGUARDIA • BENTO GRID"}
            </span>
            <h2 style={{ fontSize: "36px", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px" }}>
              {t.showcase_landing?.feature_matrix_subtitle || "Los 6 Pilares de RED Sovereign Mesh OS"}
            </h2>
            <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "780px", margin: "0 auto", lineHeight: 1.6 }}>
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
            {/* Card 1: Zero Servers / Zero Metadata (Large 8 cols) */}
            <div
              style={{
                gridColumn: "span 12",
                padding: "32px",
                borderRadius: "24px",
                background: "radial-gradient(ellipse at top left, rgba(255, 42, 81, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)",
                border: "1px solid rgba(255, 42, 81, 0.35)",
                boxShadow: "0 15px 40px rgba(0,0,0,0.6)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>🚫☁️</div>
                <div style={{ fontSize: "22px", fontWeight: 900, color: "#FFF", marginBottom: "8px" }}>
                  Cero Servidores. Cero Nube. Cero Metadatos.
                </div>
                <div style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6, maxWidth: "700px" }}>
                  A diferencia de WhatsApp o Telegram que almacenan tus agendas de contactos, IPs y grafos de conversación en servidores centrales, en RED los mensajes viajan exclusivamente de memoria RAM a memoria RAM entre los terminales involucrados.
                </div>
              </div>
              <div style={{ marginTop: "24px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ padding: "10px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "12px", fontFamily: "monospace", color: "#00FF88" }}>
                  ✓ Sin Registro de IPs
                </div>
                <div style={{ padding: "10px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "12px", fontFamily: "monospace", color: "#00F0FF" }}>
                  ✓ Sin Número de Teléfono
                </div>
                <div style={{ padding: "10px 16px", borderRadius: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "12px", fontFamily: "monospace", color: "#FFB800" }}>
                  ✓ Sin Base de Datos Central
                </div>
              </div>
            </div>

            {/* Card 2: Multi-Radio Hardware Engine (4 cols) */}
            <div
              style={{
                gridColumn: "span 6",
                padding: "28px",
                borderRadius: "24px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(0, 240, 255, 0.3)",
              }}
            >
              <div style={{ fontSize: "30px", marginBottom: "12px" }}>📡</div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Multi-Radio Hardware Engine</div>
              <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>
                Enrutamiento simultáneo a través de BLE 5.3 GATT, WiFi Direct ad-hoc, transceptores LoRa 915MHz y módem ultrasónico SoundMesh sin necesidad de conexión IP.
              </div>
            </div>

            {/* Card 3: Post-Quantum Cryptography (4 cols) */}
            <div
              style={{
                gridColumn: "span 6",
                padding: "28px",
                borderRadius: "24px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(176, 38, 255, 0.3)",
              }}
            >
              <div style={{ fontSize: "30px", marginBottom: "12px" }}>🔐</div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Criptografía Híbrida Post-Cuántica</div>
              <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>
                Encapsulamiento de claves en retículos euclidianos ML-KEM-768 (estándar FIPS 203) combinado con Signal Double Ratchet para protección retroactiva absoluta.
              </div>
            </div>

            {/* Card 4: Walkie-Talkie Mesh HQ (4 cols) */}
            <div
              style={{
                gridColumn: "span 4",
                padding: "26px",
                borderRadius: "24px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 184, 0, 0.3)",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>🎙️</div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Walkie-Talkie Mesh HQ (PTT)</div>
              <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.5 }}>
                Compresión LowBitrateVocoder (8kHz IMA-ADPCM, 1.6–3.2 kbps) para transmisión de voz fluida en canales de radio Bluetooth LE.
              </div>
            </div>

            {/* Card 5: Anti-Coercion Defense (4 cols) */}
            <div
              style={{
                gridColumn: "span 4",
                padding: "26px",
                borderRadius: "24px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(0, 255, 136, 0.3)",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>🧮</div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Defensa Táctica Anti-Coerción</div>
              <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.5 }}>
                Camuflaje de calculadora funcional, PIN de pánico con autodestrucción inmediata de claves y bóveda señuelo (PIN 9999).
              </div>
            </div>

            {/* Card 6: DePIN Relay Economy (4 cols) */}
            <div
              style={{
                gridColumn: "span 4",
                padding: "26px",
                borderRadius: "24px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 42, 81, 0.3)",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>⚡</div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Economía DePIN Proof-of-Relay</div>
              <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.5 }}>
                Incentivos criptográficos para nodos repetidores en zonas rurales que retransmiten paquetes ajenos, acumulando micro-recompensas $RED.
              </div>
            </div>
          </div>
        </section>

        <section id="matrix-comparison" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(0, 255, 136, 0.15)",
                color: "#00FF88",
                border: "1px solid rgba(0, 255, 136, 0.3)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              BENCHMARK DE LA INDUSTRIA • COMPARATIVA
            </span>
            <h2 style={{ fontSize: "36px", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px" }}>
              RED OS vs La Competencia
            </h2>
            <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "780px", margin: "0 auto", lineHeight: 1.6 }}>
              Auditoría técnica de capacidades soberanas frente a las principales aplicaciones de mensajería del mercado.
            </p>
          </div>

          <div
            style={{
              overflowX: "auto",
              background: "rgba(15, 23, 42, 0.8)",
              borderRadius: "24px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "20px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <th style={{ padding: "16px", color: "#FFF", fontWeight: 800 }}>Criterio de Soberanía</th>
                  <th style={{ padding: "16px", color: "#FF2A51", fontWeight: 900, background: "rgba(255, 42, 81, 0.1)", borderRadius: "12px 12px 0 0" }}>🛡️ RED OS</th>
                  <th style={{ padding: "16px", color: "#94A3B8" }}>Signal</th>
                  <th style={{ padding: "16px", color: "#94A3B8" }}>Session</th>
                  <th style={{ padding: "16px", color: "#94A3B8" }}>Briar</th>
                  <th style={{ padding: "16px", color: "#94A3B8" }}>Telegram</th>
                  <th style={{ padding: "16px", color: "#94A3B8" }}>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    feature: "Opera en Apagón Total (Sin Internet/Celular)",
                    red: "✅ Sí (BLE/WiFi/LoRa/SoundMesh)",
                    signal: "❌ No",
                    session: "❌ No",
                    briar: "⚠️ Solo BLE local",
                    tg: "❌ No",
                    wa: "❌ No"
                  },
                  {
                    feature: "Cero Registro (Sin Teléfono ni Email)",
                    red: "✅ 100% DID W3C",
                    signal: "❌ Pide Teléfono",
                    session: "✅ Sí (Session ID)",
                    briar: "✅ Sí",
                    tg: "❌ Pide Teléfono",
                    wa: "❌ Pide Teléfono"
                  },
                  {
                    feature: "Criptografía Post-Cuántica (PQC FIPS 203)",
                    red: "✅ ML-KEM-768",
                    signal: "⚠️ Parcial PQXDH",
                    session: "❌ No",
                    briar: "❌ No",
                    tg: "❌ No",
                    wa: "❌ No"
                  },
                  {
                    feature: "Canal Ultrasónico de Respaldo (SoundMesh)",
                    red: "✅ 18.5-20.5 kHz",
                    signal: "❌ No",
                    session: "❌ No",
                    briar: "❌ No",
                    tg: "❌ No",
                    wa: "❌ No"
                  },
                  {
                    feature: "IA Neuronal Offline en Dispositivo (<120ms)",
                    red: "✅ ONNX WASM",
                    signal: "❌ No",
                    session: "❌ No",
                    briar: "❌ No",
                    tg: "❌ No",
                    wa: "❌ No (Meta Cloud)"
                  },
                  {
                    feature: "Walkie-Talkie Mesh HQ (PTT)",
                    red: "✅ LowBitrateVocoder",
                    signal: "❌ No",
                    session: "❌ No",
                    briar: "❌ No",
                    tg: "❌ No",
                    wa: "❌ No"
                  },
                  {
                    feature: "Triaje START Médico de Catástrofes",
                    red: "✅ Algoritmo Nativo",
                    signal: "❌ No",
                    session: "❌ No",
                    briar: "❌ No",
                    tg: "❌ No",
                    wa: "❌ No"
                  },
                  {
                    feature: "Protección Anti-Coerción (Bóveda Señuelo)",
                    red: "✅ PIN 9999 / Calculadora",
                    signal: "❌ No",
                    session: "❌ No",
                    briar: "⚠️ Parcial",
                    tg: "❌ No",
                    wa: "❌ No"
                  }
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "14px 16px", color: "#FFF", fontWeight: 600 }}>{row.feature}</td>
                    <td style={{ padding: "14px 16px", color: "#00FF88", fontWeight: 800, background: "rgba(255, 42, 81, 0.05)" }}>{row.red}</td>
                    <td style={{ padding: "14px 16px", color: "#94A3B8" }}>{row.signal}</td>
                    <td style={{ padding: "14px 16px", color: "#94A3B8" }}>{row.session}</td>
                    <td style={{ padding: "14px 16px", color: "#94A3B8" }}>{row.briar}</td>
                    <td style={{ padding: "14px 16px", color: "#94A3B8" }}>{row.tg}</td>
                    <td style={{ padding: "14px 16px", color: "#94A3B8" }}>{row.wa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </>
    );
};
