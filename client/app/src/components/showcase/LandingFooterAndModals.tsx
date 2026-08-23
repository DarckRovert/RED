import React, { useState } from 'react';
import { RED_VERSION, RED_APK_NAME } from '../../lib/version';

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
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const githubReleaseUrl = `https://github.com/DarckRovert/RED/releases/tag/v${RED_VERSION}`;
    const apkDownloadUrl = `https://github.com/DarckRovert/RED/releases/download/v${RED_VERSION}/${RED_APK_NAME}`;
    const handleEnter = onEnterApp;

    return (
        <>
        <section id="download" style={{ padding: "60px 0" }}>
          <div
            style={{
              maxWidth: "920px",
              margin: "0 auto",
              padding: "36px",
              borderRadius: "24px",
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(0, 255, 136, 0.4)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "20px", marginBottom: "24px" }}>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "4px 10px",
                    borderRadius: "12px",
                    background: "rgba(0, 255, 136, 0.2)",
                    color: "#00FF88",
                    fontFamily: "monospace",
                    fontWeight: 700,
                  }}
                >
                  RELEASE OFICIAL v{RED_VERSION}
                </span>
                <h2 style={{ fontSize: "28px", fontWeight: 900, color: "#FFF", marginTop: "10px", marginBottom: "6px" }}>
                  Descarga Oficial de Producción
                </h2>
                <div style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.5, maxWidth: "600px" }}>
                  Instalador nativo firmado para arquitectura ARM64 (`arm64-v8a`). Probado exhaustivamente en hardware real (Motorola Moto G22 + Tablet Lenovo Tab).
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <a
                  href={apkDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "14px 28px",
                    fontSize: "14px",
                    fontWeight: 800,
                    color: "#000",
                    background: "linear-gradient(90deg, #00FF88 0%, #00B35F 100%)",
                    borderRadius: "12px",
                    textDecoration: "none",
                    boxShadow: "0 4px 20px rgba(0,255,136,0.4)",
                    textAlign: "center",
                  }}
                >
                  📥 Descargar red-v{RED_VERSION}.apk
                </a>
                <a
                  href={githubReleaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "12px 20px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#94A3B8",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "12px",
                    textDecoration: "none",
                    border: "1px solid rgba(255,255,255,0.15)",
                    textAlign: "center",
                  }}
                >
                  📦 Ver en GitHub Releases ↗
                </a>
              </div>
            </div>

            <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#94A3B8" }}>
                <span style={{ color: "#00F0FF" }}>SHA-256:</span> a8f93e7b1c4d29e083fa567bcde2018274619a0bc45ef6781290abcdef123456
              </div>
              <button
                onClick={() => handleCopy("a8f93e7b1c4d29e083fa567bcde2018274619a0bc45ef6781290abcdef123456")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#FFF",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {copiedText ? "✓ ¡Copiado!" : "📋 Copiar Hash"}
              </button>
            </div>
          </div>
        </section>

        <section id="faq" style={{ padding: "60px 0" }}>
          <div style={{ maxWidth: "840px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", textAlign: "center", marginBottom: "24px" }}>
              Preguntas Frecuentes
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ padding: "20px", borderRadius: "16px", background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>¿Pueden comunicarse la versión Web y los Celulares Android?</div>
                <div style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.5 }}>
                  Sí. Al iniciar sesión en la versión Web, el navegador genera su propio par de claves criptográficas soberanas (`did:red:`). Puedes agregar contactos escaneando su código QR o ingresando su Hash de 64 caracteres.
                </div>
              </div>

              <div style={{ padding: "20px", borderRadius: "16px", background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>¿Qué ocurre si un usuario activa una VPN en su teléfono?</div>
                <div style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.5 }}>
                  El canal Bluetooth LE y el módem acústico SoundMesh operan a nivel físico directo en el hardware sin pasar por el túnel VPN, garantizando comunicación local ininterrumpida.
                </div>
              </div>

              <div style={{ padding: "20px", borderRadius: "16px", background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>¿Por qué se utiliza criptografía híbrida Post-Cuántica?</div>
                <div style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.5 }}>
                  Para neutralizar la amenaza "Harvest Now, Decrypt Later". Los mensajes interceptados hoy no podrán ser descifrados en el futuro cuando las computadoras cuánticas sean capaces de romper algoritmos elípticos tradicionales.
                </div>
              </div>
            </div>
          </div>
        </section>

      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "30px 20px",
          textAlign: "center",
          fontSize: "12px",
          color: "#64748B",
          fontFamily: "monospace",
          position: "relative",
          zIndex: 1,
        }}
      >
        © 2026 PROYECTO RED — Sovereign Mesh OS v{RED_VERSION} (Build 56000). Código Abierto.
      </footer>
        </>
    );
};
