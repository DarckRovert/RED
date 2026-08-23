import React, { useState } from 'react';

interface LandingUseCasesAndArchitectureProps {
    handleCopy: (text: string) => void;
    copiedText: string | null;
}

export const LandingUseCasesAndArchitecture: React.FC<LandingUseCasesAndArchitectureProps> = ({
    handleCopy,
    copiedText
}) => {
    const [activeUseCase, setActiveUseCase] = useState<"disasters" | "rescue" | "communities" | "privacy">("disasters");
    const [activeDevTab, setActiveDevTab] = useState<"rust" | "pqc" | "vocoder" | "sse">("rust");

    return (
        <>
        <section id="use-cases" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(255, 184, 0, 0.15)",
                color: "#FFB800",
                border: "1px solid rgba(255, 184, 0, 0.3)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              APLICACIÓN EN EL MUNDO REAL • CASOS DE USO
            </span>
            <h2 style={{ fontSize: "36px", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px" }}>
              Diseñado para Situaciones Extremas
            </h2>
            <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "780px", margin: "0 auto", lineHeight: 1.6 }}>
              RED no es solo una app de mensajería; es una infraestructura de defensa civil y supervivencia autónoma.
            </p>
          </div>

          <div style={{ maxWidth: "920px", margin: "0 auto" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", marginBottom: "24px" }}>
              {[
                { id: "disasters", label: "🌪️ Desastres Naturales & Sismos" },
                { id: "rescue", label: "🚒 Rescate & Primeros Auxilios" },
                { id: "communities", label: "🏡 Zonas Rurales Aisladas" },
                { id: "privacy", label: "🕶️ Periodismo & Privacidad" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveUseCase(item.id as any)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "12px",
                    background: activeUseCase === item.id ? "rgba(255, 184, 0, 0.2)" : "rgba(15,23,42,0.6)",
                    border: activeUseCase === item.id ? "1px solid #FFB800" : "1px solid rgba(255,255,255,0.08)",
                    color: activeUseCase === item.id ? "#FFF" : "#94A3B8",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "30px", borderRadius: "24px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
              {activeUseCase === "disasters" && (
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#FFB800", marginBottom: "8px" }}>
                    Terremotos, Huracanes y Caída de Redes Celulares
                  </div>
                  <div style={{ fontSize: "14px", color: "#CBD5E1", lineHeight: 1.7, marginBottom: "16px" }}>
                    Durante catástrofes naturales, las torres de telefonía colapsan por sobrecarga o corte de suministro eléctrico. RED permite a los vecinos y comunidades formar una red de auxilio instantánea usando sus propios celulares mediante Bluetooth LE y WiFi Direct, coordinando rescates y compartiendo suministros sin depender del estado ni de empresas privadas.
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "11px", fontFamily: "monospace", color: "#00FF88" }}>
                    <span>✓ Baliza SOS Acústica</span> • <span>✓ Mapa de Nodos Offline</span> • <span>✓ Mensajería Asíncrona DTN</span>
                  </div>
                </div>
              )}

              {activeUseCase === "rescue" && (
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#00FF88", marginBottom: "8px" }}>
                    Bomberos, Paramédicos y Brigadas de Emergencia
                  </div>
                  <div style={{ fontSize: "14px", color: "#CBD5E1", lineHeight: 1.7, marginBottom: "16px" }}>
                    Los equipos de respuesta médica cuentan con el protocolo de Triaje START integrado para clasificar heridos en masa y sincronizar las estadísticas con el puesto de mando. El Walkie-Talkie Push-To-Talk con auto-reproducción permite comunicaciones de voz manos libres en túneles o estructuras colapsadas.
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "11px", fontFamily: "monospace", color: "#00F0FF" }}>
                    <span>✓ Walkie-Talkie Vocoder 1.6kbps</span> • <span>✓ Triaje START</span> • <span>✓ Glosario Médico Offline</span>
                  </div>
                </div>
              )}

              {activeUseCase === "communities" && (
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#00F0FF", marginBottom: "8px" }}>
                    Poblaciones Rurales y Pueblos sin Cobertura
                  </div>
                  <div style={{ fontSize: "14px", color: "#CBD5E1", lineHeight: 1.7, marginBottom: "16px" }}>
                    Comunidades agrícolas o montañosas pueden desplegar repetidores solares LoRa 915MHz de bajo costo ($25 USD) e interconectar todo el pueblo con RED. Los usuarios pueden comerciar con Vales de Pago Offline firmados y comunicarse sin facturas mensuales.
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "11px", fontFamily: "monospace", color: "#FFB800" }}>
                    <span>✓ Repetidores LoRa 915MHz</span> • <span>✓ Pagos Offline P2P</span> • <span>✓ Costo Servidor $0</span>
                  </div>
                </div>
              )}

              {activeUseCase === "privacy" && (
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#B026FF", marginBottom: "8px" }}>
                    Periodismo de Investigación y Activismo de DDHH
                  </div>
                  <div style={{ fontSize: "14px", color: "#CBD5E1", lineHeight: 1.7, marginBottom: "16px" }}>
                    En entornos con vigilancia estatal o censura de Internet, RED oculta la presencia mediante rotación periódica de identidades efímeras, esteganografía de imágenes, protección de calculadora señuelo y PIN de pánico con autodestrucción inmediata.
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "11px", fontFamily: "monospace", color: "#FF2A51" }}>
                    <span>✓ Bóveda Señuelo PIN 9999</span> • <span>✓ Esteganografía LSB</span> • <span>✓ Cifrado ML-KEM-768</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 13. 4-TIER ARCHITECTURE & DEVELOPER TERMINAL */}
        <section id="architecture" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(0, 240, 255, 0.15)",
                color: "#00F0FF",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              INGENIERÍA DEL SISTEMA • FLUIDEZ NDK
            </span>
            <h2 style={{ fontSize: "36px", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px" }}>
              Arquitectura Técnica de 4 Capas
            </h2>
            <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "780px", margin: "0 auto", lineHeight: 1.6 }}>
              Desacoplamiento total entre la presentación SPA, el servicio en primer plano de Android, el motor nativo Rust compilado con NDK y las controladoras de radio física.
            </p>
          </div>

          <div style={{ maxWidth: "920px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px", marginBottom: "40px" }}>
            <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(0, 240, 255, 0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "#00F0FF" }}>CAPA 1: PRESENTACIÓN FRONTEND (SPA)</div>
                <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#94A3B8" }}>Next.js 16 • React 19 • Zustand</span>
              </div>
              <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>
                Interfaz táctica responsiva construida con Turbopack. Administra los 42 módulos, renderiza el árbol de estados en memoria (`useRedStore.ts`) y se comunica con el backend mediante HTTP loopback y SSE en `127.0.0.1:7333`.
              </div>
            </div>

            <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(0, 255, 136, 0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "#00FF88" }}>CAPA 2: MIDDLEWARE ANDROID NATIVO (JAVA / JNI)</div>
                <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#94A3B8" }}>Foreground Service • BLE GATT Server</span>
              </div>
              <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>
                `RedNodeService.java` mantiene vivo el proceso con notificación persistente, inmune a las restricciones de batería del sistema operativo. Administra el servidor GATT y transfiere paquetes al motor Rust mediante enlaces JNI C-ABI.
              </div>
            </div>

            <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255, 42, 81, 0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "#FF2A51" }}>CAPA 3: MOTOR NATIVO RUST NDK (AXUM / LIBP2P)</div>
                <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#94A3B8" }}>red_core • red_mobile • SQLite Encrypted</span>
              </div>
              <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>
                Binario optimizado `libred_mobile.so`. Ejecuta Kademlia DHT, enrutamiento multi-salto Gossipsub, deduplicación de mensajes por 72 horas, cifrado Noise XK / ML-KEM-768 y persistencia segura en base de datos SQLite cifrada.
              </div>
            </div>

            <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(176, 38, 255, 0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "#B026FF" }}>CAPA 4: MULTI-RADIO HARDWARE OFF-GRID</div>
                <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#94A3B8" }}>BLE 5.3 • WiFi Direct • LoRa 915MHz • SoundMesh</span>
              </div>
              <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>
                Transmisión simultánea sobre canales físicos sin depender del stack TCP/IP tradicional. Permite la comunicación en túneles subterráneos, zonas de catástrofe y entornos de censura estatal.
              </div>
            </div>
          </div>

          {/* Developer Protocol & Code Viewer */}
          <div id="dev-terminal" style={{ maxWidth: "920px", margin: "0 auto", padding: "26px", borderRadius: "24px", background: "rgba(3,5,8,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#FFF" }}>💻 Protocolos de Código Abierto (Código Real)</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {[
                  { id: "rust", label: "Rust LibP2P" },
                  { id: "pqc", label: "ML-KEM-768" },
                  { id: "vocoder", label: "Vocoder DSP" },
                  { id: "sse", label: "API Events SSE" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveDevTab(t.id as any)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      background: activeDevTab === t.id ? "rgba(255, 42, 81, 0.25)" : "rgba(255,255,255,0.05)",
                      border: activeDevTab === t.id ? "1px solid #FF2A51" : "1px solid transparent",
                      color: activeDevTab === t.id ? "#FFF" : "#94A3B8",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: "#05070D", padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: "12px", color: "#CBD5E1", overflowX: "auto" }}>
              {activeDevTab === "rust" && (
                <pre style={{ margin: 0 }}>{`// red_core/src/mesh/kademlia.rs
pub async fn start_kademlia_loop(swarm: &mut Swarm<RedMeshBehaviour>) -> Result<()> {
    swarm.behaviour_mut().kademlia.set_mode(Some(Mode::Server));
    swarm.behaviour_mut().gossipsub.subscribe(&Topic::new("red-sos-broadcast"))?;
    info!("Kademlia DHT Server & Gossipsub loop active on native thread.");
    Ok(())
}`}</pre>
              )}
              {activeDevTab === "pqc" && (
                <pre style={{ margin: 0 }}>{`// ML-KEM-768 FIPS 203 Key Encapsulation Mechanism
let (ek, dk) = ml_kem_768::generate_keypair(&mut csprng);
let (ciphertext, shared_secret_pqc) = ml_kem_768::encapsulate(&ek, &mut csprng)?;
let hybrid_key = hkdf_sha256(&shared_secret_pqc, &shared_secret_x25519);
// Double Ratchet key rotation initialized with hybrid post-quantum entropy.`}</pre>
              )}
              {activeDevTab === "vocoder" && (
                <pre style={{ margin: 0 }}>{`// LowBitrateVocoder DSP (8kHz IMA-ADPCM)
pub fn compress_audio_packet(pcm_samples: &[i16]) -> Vec<u8> {
    let mut adpcm_bytes = Vec::with_capacity(pcm_samples.len() / 2);
    // Compresión a 1.6 - 3.2 kbps con reducción de -97.9% de ancho de banda.
    adpcm_encoder::encode_nibbles(pcm_samples, &mut adpcm_bytes);
    adpcm_bytes
}`}</pre>
              )}
              {activeDevTab === "sse" && (
                <pre style={{ margin: 0 }}>{`// Local Axum SSE Loopback Interface
GET http://127.0.0.1:7333/api/events
event: mesh_message
data: {"id":"msg-9921","sender":"did:red:7F3A...","content":"SOS COORD -12.04, -77.03","ttl":7,"auth_mac":"0x9A4F..."}`}</pre>
              )}
            </div>
          </div>
        </section>
        </>
    );
};
