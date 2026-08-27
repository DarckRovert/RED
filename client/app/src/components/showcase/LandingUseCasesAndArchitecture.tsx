'use client';

import React, { useState } from 'react';

interface LandingUseCasesAndArchitectureProps {
    handleCopy: (text: string) => void;
    copiedText: string | null;
}

export const LandingUseCasesAndArchitecture: React.FC<LandingUseCasesAndArchitectureProps> = ({
    handleCopy,
    copiedText
}) => {
    const [activeDevTab, setActiveDevTab] = useState<"rust" | "pqc" | "vocoder" | "android">("rust");

    const codeSnippets = {
        rust: `// red_core/src/network/router.rs
// Protocolo Gossip P2P Descentralizado con Deduplicación por Hash SHA-256
pub struct MeshRouter {
    local_peer_id: PeerId,
    routing_table: Arc<RwLock<HashMap<NodeHash, RouteEntry>>>,
    seen_messages: LruCache<MessageHash, Timestamp>,
}

impl MeshRouter {
    pub async fn forward_packet(&mut self, packet: EncryptedPacket) -> Result<RoutingAction> {
        let hash = packet.compute_sha256_hash();
        if self.seen_messages.contains(&hash) {
            return Ok(RoutingAction::DropDuplicate); // Previene bucles infinitos
        }
        self.seen_messages.put(hash, Instant::now());
        
        // Retransmisión oportunista por BLE 5.3 + LoRa 915 MHz
        self.broadcast_to_adjacent_relays(packet).await?;
        Ok(RoutingAction::Propagated { hops: packet.ttl - 1 })
    }
}`,
        pqc: `// red_core/src/crypto/pqc_kem.rs
// NIST FIPS 203: Encapsulamiento de Claves Post-Cuánticas ML-KEM-768 (Kyber)
use pqcrypto_kyber::kyber768::*;

pub struct PostQuantumSessionKey {
    pub shared_secret: [u8; 32],
    pub ciphertext: Vec<u8>,
}

pub fn encapsulate_kyber_key(public_key: &PublicKey) -> PostQuantumSessionKey {
    let (shared_secret, ciphertext) = encapsulate(public_key);
    PostQuantumSessionKey {
        shared_secret: *shared_secret.as_bytes(),
        ciphertext: ciphertext.as_bytes().to_vec(),
    }
}`,
        vocoder: `// client/app/src/lib/audio/LowBitrateVocoder.ts
// Compresión de Voz Táctica IMA-ADPCM 8kHz (1.6 - 3.2 kbps) para Canales BLE/LoRa
export class LowBitrateVocoder {
    static encodeAudioFrame(pcmSamples: Float32Array): Uint8Array {
        const adpcmBuffer = new Uint8Array(pcmSamples.length / 2);
        let stepIndex = 0;
        let predictedSample = 0;
        
        for (let i = 0; i < pcmSamples.length; i += 2) {
            const nibble1 = this.quantizeSample(pcmSamples[i], predictedSample, stepIndex);
            const nibble2 = this.quantizeSample(pcmSamples[i + 1], predictedSample, stepIndex);
            adpcmBuffer[i / 2] = (nibble1 << 4) | (nibble2 & 0x0F);
        }
        return adpcmBuffer;
    }
}`,
        android: `// client/app/android/app/src/main/java/f/red/app/RedNodeService.java
// Servicio Android en Primer Plano (Foreground Service) para Operación Mesh 24/7
public class RedNodeService extends Service {
    private static native void nativeStartRustDaemon(String dataDir, int port);
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = createTacticalNotification("RED Mesh Operacional");
        startForeground(7333, notification);
        
        // Inicia el demonio nativo Rust compilado con NDK
        new Thread(() -> nativeStartRustDaemon(getFilesDir().getAbsolutePath(), 7333)).start();
        return START_STICKY; // Reinicio automático si el sistema lo cierra
    }
}`
    };

    return (
        <section id="architecture" style={{ padding: "70px 0 80px", position: "relative" }}>
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
              INGENIERÍA DEL SISTEMA • FLUIDEZ NATIVA
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "12px", letterSpacing: "-0.5px" }}>
              Arquitectura Técnica de 4 Capas
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
              Desacoplamiento total entre la presentación SPA, el servicio en primer plano de Android, el motor nativo Rust compilado con NDK y las controladoras de radio física.
            </p>
          </div>

          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px" }}>
            
            {/* Interactive 4-Layer Stack Diagram */}
            <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "14px", marginBottom: "32px"
            }}>
                {[
                    { layer: "CAPA 4", title: "Presentación & SPA", tech: "Next.js 16 • React 19 • WebCrypto", desc: "Interfaz táctica reactiva, animaciones Canvas de radar y gestión de estado con Zustand.", color: "#00E5FF", icon: "💻" },
                    { layer: "CAPA 3", title: "Puente Nativo & JNI", tech: "Capacitor • Foreground Service", desc: "Servicio en background 24/7 en Android que mantiene la radio despierta con pantalla apagada.", color: "#00FF88", icon: "📱" },
                    { layer: "CAPA 2", title: "Núcleo Rust & PQC", tech: "Rust Core • ML-KEM-768 • Noise XK", desc: "Enrutador Gossipsub, criptografía post-cuántica y base de datos local SQLite.", color: "#FF3355", icon: "⚡" },
                    { layer: "CAPA 1", title: "Controladores de Radio", tech: "LoRa 915MHz • BLE 5.3 • SoundMesh", desc: "Transmisión física directa sobre ondas electromagnéticas y pulsos acústicos sin IP.", color: "#FFB300", icon: "📡" }
                ].map((l, lIdx) => (
                    <div key={lIdx} style={{
                        padding: "22px", borderRadius: "18px",
                        background: "rgba(14, 18, 34, 0.9)", border: `1.5px solid ${l.color}44`,
                        boxShadow: `0 8px 24px ${l.color}15`, display: "flex", flexDirection: "column", gap: "8px"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "10px", color: l.color, fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>{l.layer}</span>
                            <span style={{ fontSize: "18px" }}>{l.icon}</span>
                        </div>
                        <div style={{ fontSize: "15px", fontWeight: 900, color: "#FFF" }}>{l.title}</div>
                        <div style={{ fontSize: "11px", color: l.color, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>{l.tech}</div>
                        <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: 1.5, marginTop: "4px" }}>{l.desc}</div>
                    </div>
                ))}
            </div>

            {/* Live Developer Code Inspector Terminal */}
            <div style={{
                background: "rgba(5, 8, 16, 0.98)",
                border: "1.5px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "24px", overflow: "hidden",
                boxShadow: "0 25px 60px rgba(0,0,0,0.8)"
            }}>
                {/* Terminal Header */}
                <div style={{
                    padding: "14px 20px", background: "rgba(12, 16, 28, 0.9)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    flexWrap: "wrap", gap: "12px"
                }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F56" }} />
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E" }} />
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#27C93F" }} />
                        <span style={{ marginLeft: "8px", fontSize: "12px", color: "#94A3B8", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            RED Sovereign Mesh Kernel (Source Code Inspector)
                        </span>
                    </div>

                    {/* Language / Module Selector Tabs */}
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {[
                            { id: "rust", label: "🦀 Rust Mesh Router" },
                            { id: "pqc", label: "🔐 ML-KEM-768 PQC" },
                            { id: "vocoder", label: "🎙️ ADPCM Vocoder" },
                            { id: "android", label: "🤖 Android Daemon" }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveDevTab(tab.id as any)}
                                style={{
                                    padding: "6px 12px", borderRadius: "8px",
                                    background: activeDevTab === tab.id ? "rgba(0, 229, 255, 0.2)" : "rgba(255,255,255,0.04)",
                                    border: activeDevTab === tab.id ? "1px solid #00E5FF" : "1px solid rgba(255,255,255,0.08)",
                                    color: activeDevTab === tab.id ? "#00E5FF" : "#94A3B8",
                                    fontSize: "11px", fontWeight: 700, cursor: "pointer",
                                    fontFamily: "JetBrains Mono, monospace"
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Code Body */}
                <div style={{ position: "relative" }}>
                    <button
                        onClick={() => handleCopy(codeSnippets[activeDevTab])}
                        style={{
                            position: "absolute", top: "12px", right: "16px",
                            padding: "6px 12px", borderRadius: "8px",
                            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                            color: "#FFF", fontSize: "11px", cursor: "pointer", fontFamily: "JetBrains Mono, monospace",
                            zIndex: 2
                        }}
                    >
                        {copiedText === codeSnippets[activeDevTab] ? "✓ Copiado" : "📋 Copiar Código"}
                    </button>

                    <pre style={{
                        margin: 0, padding: "24px 20px",
                        fontSize: "13px", color: "#E2E8F0", lineHeight: 1.6,
                        fontFamily: "JetBrains Mono, monospace", overflowX: "auto",
                        maxHeight: "360px"
                    }}>
                        <code>{codeSnippets[activeDevTab]}</code>
                    </pre>
                </div>
            </div>
          </div>
        </section>
    );
};
