'use client';

import React, { useState } from 'react';
import { RED_VERSION, RED_BUILD_CODE, RED_APK_NAME, RED_APK_SHA256 } from '../../lib/version';
import { useTranslation } from '../../lib/i18n/i18nEngine';

interface LandingFooterAndModalsProps {
    handleCopy: (text: string) => void;
    copiedText: string | null;
    onEnterApp: () => void;
}

export const LandingFooterAndModals: React.FC<LandingFooterAndModalsProps> = ({
    handleCopy,
    copiedText,
    onEnterApp
}) => {
    const { t } = useTranslation();
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const githubReleaseUrl = `https://github.com/DarckRovert/RED/releases/tag/v${RED_VERSION}`;
    const apkDownloadUrl = `https://github.com/DarckRovert/RED/releases/download/v${RED_VERSION}/${RED_APK_NAME}`;

    return (
        <>
        {/* DOWNLOAD & HARDWARE DISTRIBUTION HUB */}
        <section id="download" style={{ padding: "70px 0 60px", position: "relative" }}>
          <div
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
              padding: "40px 32px",
              borderRadius: "28px",
              background: "linear-gradient(135deg, rgba(14, 18, 34, 0.95) 0%, rgba(8, 12, 24, 0.98) 100%)",
              border: "1.5px solid rgba(0, 230, 118, 0.4)",
              boxShadow: "0 25px 80px rgba(0,0,0,0.8), 0 0 40px rgba(0,230,118,0.1)",
            }}
          >
            <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "32px", alignItems: "center"
            }}>
              {/* Left Column: APK Download & Release Info */}
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "5px 14px",
                    borderRadius: "20px",
                    background: "rgba(0, 230, 118, 0.15)",
                    color: "#00E676",
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 800,
                    letterSpacing: "1px"
                  }}
                >
                  RELEASE DE PRODUCCIÓN v{RED_VERSION} (BUILD {RED_BUILD_CODE})
                </span>
                <h2 style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "10px", letterSpacing: "-0.5px" }}>
                  Centro de Distribución Táctico
                </h2>
                <p style={{ fontSize: "15px", color: "#94A3B8", lineHeight: 1.6, marginBottom: "24px" }}>
                  Instalador nativo firmado para Android ARM64 (`arm64-v8a`). Probado y certificado en campo con Motorola Moto G22, Xiaomi Redmi Note 14 y Lenovo Tab M9 con soporte multi-radio simultáneo.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                  <a
                    href={apkDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      padding: "16px 28px",
                      borderRadius: "14px",
                      background: "linear-gradient(135deg, #00FF88 0%, #00F0FF 100%)",
                      color: "#050B14",
                      fontWeight: 900,
                      textDecoration: "none",
                      boxShadow: "0 0 30px rgba(0, 255, 136, 0.4)",
                      fontSize: "15px",
                    }}
                  >
                    <span>📥</span>
                    <span>Descargar APK Oficial (v{RED_VERSION})</span>
                  </a>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <a
                      href={githubReleaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "12px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#CBD5E1",
                        fontWeight: 700,
                        textDecoration: "none",
                        fontSize: "13px",
                      }}
                    >
                      <span>🐙</span>
                      <span>Ver en GitHub</span>
                    </a>

                    <button
                      onClick={onEnterApp}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "12px",
                        borderRadius: "12px",
                        background: "rgba(0, 229, 255, 0.15)",
                        border: "1px solid rgba(0, 229, 255, 0.35)",
                        color: "#00E5FF",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      <span>🚀</span>
                      <span>Abrir Web App</span>
                    </button>
                  </div>
                </div>

                {/* SHA-256 Hash Verification Box */}
                <div style={{ padding: "14px 16px", borderRadius: "14px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#94A3B8" }}>
                    <span style={{ color: "#00E5FF", fontWeight: 700 }}>SHA-256:</span> {RED_APK_SHA256}
                  </div>
                  <button
                    onClick={() => handleCopy(RED_APK_SHA256)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#FFF",
                      fontSize: "11px",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontFamily: "JetBrains Mono, monospace"
                    }}
                  >
                    {copiedText ? "✓ Copiado" : "📋 Copiar Hash"}
                  </button>
                </div>
              </div>

              {/* Right Column: Hardware Compatibility Matrix */}
              <div style={{
                  padding: "24px", borderRadius: "20px",
                  background: "rgba(6, 9, 18, 0.9)", border: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex", flexDirection: "column", gap: "16px"
              }}>
                <div style={{ fontSize: "12px", color: "#00FF88", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                  MATRIZ DE COMPATIBILIDAD & HARDWARE HOMOLOGADO
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "20px" }}>📱</span>
                        <div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF" }}>Smartphones & Tablets Soportados</div>
                            <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: 1.4 }}>
                                Android 7.0+ (Nougat hasta Android 15), arquitectura ARM64 (`arm64-v8a`). Homologado y certificado en hardware real: Motorola Moto G22, Xiaomi Redmi Note 14 (HyperOS) y Lenovo Tab M9.
                            </div>

                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "20px" }}>📡</span>
                        <div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF" }}>Radios Integradas del Celular</div>
                            <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: 1.4 }}>
                                Bluetooth 5.0+ LE (Modo Servidor GATT), Wi-Fi Direct P2P y Módem Acústico SoundMesh (Micrófono / Altavoz).
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "20px" }}>📻</span>
                        <div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF" }}>Módulos LoRa US915 Opcionales</div>
                            <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: 1.4 }}>
                                LilyGO T-Beam ESP32, Heltec WiFi LoRa 32 v3 y RAK Wireless conectados vía Bluetooth Serial o cable USB OTG.
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "20px" }}>🔒</span>
                        <div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF" }}>Arquitectura Zero-Cloud & Privacidad</div>
                            <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: 1.4 }}>
                                Cero permisos de internet requeridos para comunicación de radio. Datos almacenados en bóveda local cifrada SQLite.
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" style={{ padding: "60px 0 80px", position: "relative" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px" }}>
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "5px 14px",
                    borderRadius: "20px",
                    background: "rgba(0, 229, 255, 0.12)",
                    color: "#00E5FF",
                    border: "1px solid rgba(0, 229, 255, 0.3)",
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 800,
                    letterSpacing: "1px"
                  }}
                >
                  PREGUNTAS FRECUENTES • FAQ
                </span>
                <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "12px", letterSpacing: "-0.5px" }}>
                  Respuestas a Dudas Técnicas & Operativas
                </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "18px" }}>
              <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(14, 18, 34, 0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontWeight: 900, color: "#00E5FF", fontSize: "16px", marginBottom: "8px" }}>¿Pueden comunicarse la versión Web y los Celulares Android?</div>
                <div style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
                  Sí. Al iniciar sesión en la versión Web, el navegador genera su propio par de claves criptográficas soberanas (`did:red:`). Puedes agregar contactos escaneando su código QR o ingresando su Hash de 64 caracteres mediante Web Bluetooth o WebRTC.
                </div>
              </div>

              <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(14, 18, 34, 0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontWeight: 900, color: "#00FF88", fontSize: "16px", marginBottom: "8px" }}>¿Qué ocurre si un usuario activa una VPN en su teléfono?</div>
                <div style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
                  El canal Bluetooth LE y el módem acústico SoundMesh operan a nivel físico directo en el hardware sin pasar por el túnel VPN del sistema operativo, garantizando comunicación local ininterrumpida aun bajo configuraciones de red complejas.
                </div>
              </div>

              <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(14, 18, 34, 0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontWeight: 900, color: "#C084FC", fontSize: "16px", marginBottom: "8px" }}>¿Por qué se utiliza criptografía híbrida Post-Cuántica?</div>
                <div style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
                  Para neutralizar la amenaza global "Harvest Now, Decrypt Later". Los mensajes de radio interceptados hoy no podrán ser descifrados en el futuro cuando las computadoras cuánticas sean capaces de romper algoritmos tradicionales como RSA o ECC.
                </div>
              </div>

              <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(14, 18, 34, 0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontWeight: 900, color: "#FFB300", fontSize: "16px", marginBottom: "8px" }}>¿Se requiere licencia MTC para operar en 915 MHz en Perú?</div>
                <div style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
                  No. La banda 902–928 MHz (US915) está clasificada por el MTC (Ministerio de Transportes y Comunicaciones de Perú) como banda ISM de uso libre secundario, permitiendo transmisiones de hasta 1 Watt sin necesidad de canon ni autorización gubernamental.
                </div>
              </div>
            </div>
          </div>
        </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "48px 20px",
          textAlign: "center",
          fontSize: "13px",
          color: "#94A3B8",
          background: "rgba(4, 7, 14, 0.98)",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
          <button
            onClick={onEnterApp}
            style={{
              padding: "12px 24px", borderRadius: "12px",
              background: "linear-gradient(135deg, #00FF88 0%, #00F0FF 100%)",
              color: "#050B14", fontWeight: 900, fontSize: "13px",
              border: "none", cursor: "pointer", boxShadow: "0 0 20px rgba(0,255,136,0.3)"
            }}
          >
            🚀 Iniciar Nodo Web App
          </button>
          
          <iframe
            src="https://github.com/sponsors/DarckRovert/button"
            title="Sponsor DarckRovert"
            height="32"
            width="114"
            style={{
              border: 0,
              borderRadius: "6px",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", justifyContent: "center", fontSize: "12px", color: "#64748B" }}>
          <a href="https://github.com/DarckRovert/RED/blob/main/LICENSE" target="_blank" rel="noreferrer" style={{ color: "#00F0FF", textDecoration: "none" }}>
            📄 Licencia AGPLv3
          </a>
          <span>•</span>
          <a href="https://github.com/DarckRovert/RED/blob/main/DISCLAIMER.md" target="_blank" rel="noreferrer" style={{ color: "#FF3355", textDecoration: "none" }}>
            🛡️ Descargo Legal (DISCLAIMER.md)
          </a>
          <span>•</span>
          <a href="mailto:darckrovert@gmail.com?subject=Consulta%20Corporativa%20RED%20Mesh" style={{ color: "#00FF88", textDecoration: "none", fontWeight: 700 }}>
            💼 Contacto Comercial & Licitaciones (darckrovert@gmail.com)
          </a>
        </div>

        <div style={{ fontSize: "11px", color: "#475569", fontFamily: "JetBrains Mono, monospace" }}>
          © 2026 PROYECTO RED — Sovereign Mesh OS v{RED_VERSION} (Build {RED_BUILD_CODE}). Autor: Rodrigo Alejandro Vega Rojas (alias "DarckRovert"). Lima, Perú.
        </div>
      </footer>
        </>
    );
};
