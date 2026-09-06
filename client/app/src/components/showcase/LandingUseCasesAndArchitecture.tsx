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
    const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(2); // Default to Rust Core
    const [isSchematicModalOpen, setIsSchematicModalOpen] = useState<boolean>(false);
    const [activeTrack, setActiveTrack] = useState<"rust" | "android" | "frontend" | "radio">("rust");

    const isGhPages = typeof window !== "undefined" && window.location.pathname.includes("/RED");
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (isGhPages ? "/RED" : "");
    const schematicUrl = `${basePath}/assets/red_architecture_schematic.jpg`;

    const architectureLayers = [
        {
            layer: "CAPA 4",
            title: "Presentación & SPA Táctica",
            tech: "Next.js 16 • React 19 • Zustand SSOT • Canvas Shaders",
            desc: "Interfaz reactiva offline-first. Renderiza el Radar Táctico de radiofrecuencia a 60 FPS, gestiona el estado global de mensajería con Zustand y ejecuta audio vocoder en el hilo principal del cliente sin tocar la nube.",
            color: "#00E5FF",
            icon: "💻",
            files: "client/app/src/components/ • client/app/src/store/ • RedShowcaseLanding.tsx"
        },
        {
            layer: "CAPA 3",
            title: "Puente Nativo & JNI Android",
            tech: "Capacitor 8 • RedNodeService JNI • Foreground Daemon",
            desc: "Servicio Android continuo en primer plano con android:largeHeap y wakelock táctico. Mantiene la radio BLE activa con pantalla apagada y expone llamadas JNI directas a libred_mobile.so.",
            color: "#00FF88",
            icon: "📱",
            files: "RedNodeService.java • AndroidManifest.xml • MainActivity.java"
        },
        {
            layer: "CAPA 2",
            title: "Núcleo Nativo Rust & PQC",
            tech: "Rust Core • Axum :7333 SSE • Sled DB • ML-KEM-768 • BLAKE3",
            desc: "Motor autónomo de alto rendimiento compilado con Android NDK aarch64. Aloja el servidor HTTP/SSE local en 127.0.0.1:7333, la base de datos transaccional ACID embebida Sled y el enrutador Gossip con deduplicación BLAKE3.",
            color: "#FF3355",
            icon: "⚡",
            files: "red_mobile/src/api.rs • red_core/src/router.rs • sled::Db • pqcrypto_kyber"
        },
        {
            layer: "CAPA 1",
            title: "Controladores Físicos de Radio (PHY)",
            tech: "LoRa SX1262 (915 MHz) • BLE 5.3 GATT • SoundMesh Acústico",
            desc: "Múltiples medios de transporte sin cables ni proveedores. Transmisión física directa por modulación Chirp Spread Spectrum a 915 MHz (15–25 km), balizas Bluetooth LE ad-hoc y módem acústico ultrasónico por ultrasonidos.",
            color: "#FFB300",
            icon: "📡",
            files: "red_hardware/lora_sx1262.rs • ble_central.rs • soundmesh_modem.ts"
        }
    ];

    const codeSnippets = {
        rust: `// red_core/src/network/router.rs
// Protocolo Gossip P2P Descentralizado con Deduplicación por Hash BLAKE3 y Sled DB
pub struct MeshRouter {
    local_peer_id: PeerId,
    routing_table: Arc<RwLock<HashMap<NodeHash, RouteEntry>>>,
    seen_messages: LruCache<blake3::Hash, Instant>,
    storage: sled::Db,
}

impl MeshRouter {
    pub async fn forward_packet(&mut self, packet: EncryptedPacket) -> Result<RoutingAction> {
        let hash = blake3::hash(&packet.payload);
        if self.seen_messages.contains(&hash) {
            return Ok(RoutingAction::DropDuplicate); // Previene tormentas de difusión
        }
        self.seen_messages.put(hash, Instant::now());
        
        // Persistencia atómica local en Sled KV embebido (sin servidores)
        self.storage.insert(hash.as_bytes(), packet.payload.as_slice())?;
        
        // Retransmisión multicanal oportunista por BLE 5.3 + LoRa 915 MHz
        self.broadcast_to_adjacent_relays(packet).await?;
        Ok(RoutingAction::Propagated { hops_remaining: packet.ttl.saturating_sub(1) })
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
// Servicio Android en Primer Plano (Foreground Service) con Socket Local 127.0.0.1:7333
public class RedNodeService extends Service {
    private static native void nativeStartRustDaemon(String dataDir, int port);
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = createTacticalNotification("RED Sovereign Mesh Operacional");
        startForeground(7333, notification);
        
        // Arranca el demonio Rust compilado con NDK en aarch64
        new Thread(() -> {
            File internalDir = getFilesDir();
            nativeStartRustDaemon(internalDir.getAbsolutePath(), 7333);
        }).start();
        return START_STICKY; // Reinicio instantáneo si el SO intenta descartarlo
    }
}`
    };

    const contributionTracks = [
        {
            id: "rust",
            title: "🦀 Rust Core & Mesh Engine",
            tag: "Sistemas & Redes",
            color: "#FF3355",
            focus: "Enrutamiento Gossipsub, base de datos embebida Sled, cifrado post-cuántico Kyber (ML-KEM) y multiplexación de sockets IPC.",
            goodFor: "Desarrolladores Rust, ingenieros de sistemas embebidos y criptógrafos.",
            tasks: [
                "Optimización de consumo de memoria y compactación de logs en Sled DB",
                "Heurísticas de cálculo de ruta adaptativa según métricas RSSI y SNR",
                "Integración de firmas digitales post-cuánticas ML-DSA (Dilithium)",
                "Reducción de consumo térmico en bucles de polling y SSE streams"
            ]
        },
        {
            id: "android",
            title: "🤖 Android NDK & Hardware RF",
            tag: "Mobile & Drivers",
            color: "#00FF88",
            focus: "JNI bindings con libred_mobile.so, Foreground Services 24/7, soporte USB OTG para radios LoRa SX1262 y BLE Coded PHY.",
            goodFor: "Desarrolladores Android NDK, ingenieros de firmware y radioaficionados.",
            tasks: [
                "Implementación de GATT Server Bluetooth LE 5.3 de ultra bajo consumo",
                "Soporte plug-and-play USB Serial para placas LilyGO T-Beam y Heltec V3",
                "Manejo robusto de Doze Mode y optimización de permisos tácticos",
                "Soporte para modo pantalla táctica AMOLED True Black continua"
            ]
        },
        {
            id: "frontend",
            title: "⚡ React 19 & Táctico SPA",
            tag: "UI/UX & Web Audio",
            color: "#00E5FF",
            focus: "Next.js 16 con Turbopack, gestión de estado unificado Zustand, códecs de audio IMA-ADPCM y shaders Canvas de radar.",
            goodFor: "Frontend engineers, diseñadores de interfaces tácticas y desarrolladores Web Audio.",
            tasks: [
                "Visualizador de topología de nodos en vivo con grafos WebGL de alta densidad",
                "Pipeline de cancelación de ruido acústico para el módem SoundMesh",
                "Mapas tácticos vectoriales offline con baldosas pre-cargadas MBTiles",
                "Mejora del modo camuflaje y bóvedas esteganográficas en memoria"
            ]
        },
        {
            id: "radio",
            title: "📡 RF, Antenas & SoundMesh",
            tag: "Hardware & Telecom",
            color: "#FFB300",
            focus: "Estudios de propagación electromagnética en 915 MHz (US915), diseño de antenas dipolo y módems acústicos ultrasónicos.",
            goodFor: "Ingenieros en telecomunicaciones, makers de hardware y radioaficionados.",
            tasks: [
                "Pruebas de campo de enlace LoRa a línea de vista (15–25 km en valles/montañas)",
                "Ajuste de filtros pasa-banda acústicos en 18–20 kHz para micrófonos móviles",
                "Diseño de carcasas impresas en 3D para nodos repetidores solares autónomos",
                "Protocolos de sincronización horaria estricta sin GPS para sincronía TDMA"
            ]
        }
    ];

    return (
        <section id="architecture" style={{ padding: "70px 0 80px", position: "relative" }}>
          {/* Header */}
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
              INGENIERÍA DEL SISTEMA • ESQUEMA REAL VERIFICADO
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "12px", letterSpacing: "-0.5px" }}>
              Arquitectura Interna y Conexión de Capas
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "840px", margin: "0 auto", lineHeight: 1.6 }}>
              Desacoplamiento total y comunicación por sockets locales: cómo interactúan la interfaz SPA táctica, el demonio en primer plano Android, el núcleo nativo compilado en Rust y las controladoras de radio física.
            </p>
          </div>

          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px" }}>
            
            {/* SCHEMATIC BLUEPRINT HERO CONTAINER */}
            <div style={{
                background: "linear-gradient(180deg, rgba(10, 15, 30, 0.95) 0%, rgba(5, 8, 16, 0.98) 100%)",
                border: "1.5px solid rgba(0, 229, 255, 0.35)",
                borderRadius: "24px",
                padding: "24px",
                marginBottom: "40px",
                boxShadow: "0 20px 60px rgba(0, 229, 255, 0.1), inset 0 1px 0 rgba(255,255,255,0.1)",
                position: "relative",
                overflow: "hidden"
            }}>
                {/* Tech HUD Corner Accents */}
                <div style={{ position: "absolute", top: "12px", left: "16px", fontSize: "10px", color: "#00E5FF", fontFamily: "JetBrains Mono, monospace", fontWeight: 800, letterSpacing: "1px" }}>
                    SYSTEM SCHEMATIC // ARCH_REF_V93_0_0
                </div>
                <div style={{ position: "absolute", top: "12px", right: "16px", fontSize: "10px", color: "#00FF88", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                    STATUS: VERIFIED GROUND TRUTH
                </div>

                <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", alignItems: "center" }}>
                    
                    {/* Visual Blueprint Image Preview with Click to Zoom */}
                    <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(0, 229, 255, 0.3)", background: "#050812" }}>
                        <img
                            src={schematicUrl}
                            alt="Esquema de Arquitectura RED OS: 4 Capas Conectadas"
                            style={{ width: "100%", height: "auto", display: "block", cursor: "pointer", transition: "transform 0.3s ease" }}
                            onClick={() => setIsSchematicModalOpen(true)}
                            title="Haz clic para ampliar el plano técnico de alta resolución"
                        />
                        <div style={{
                            position: "absolute", bottom: 0, left: 0, right: 0,
                            padding: "10px 14px", background: "linear-gradient(180deg, transparent 0%, rgba(5,8,16,0.95) 100%)",
                            display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}>
                            <span style={{ fontSize: "11px", color: "#E2E8F0", fontFamily: "JetBrains Mono, monospace" }}>
                                🔍 Plano Técnico de Interconexión
                            </span>
                            <button
                                onClick={() => setIsSchematicModalOpen(true)}
                                style={{
                                    background: "rgba(0, 229, 255, 0.2)",
                                    border: "1px solid #00E5FF",
                                    color: "#00E5FF",
                                    borderRadius: "6px",
                                    padding: "4px 10px",
                                    fontSize: "10px",
                                    fontFamily: "JetBrains Mono, monospace",
                                    fontWeight: 700,
                                    cursor: "pointer"
                                }}
                            >
                                AMPLIAR PLANO ↗
                            </button>
                        </div>
                    </div>

                    {/* Interactive Connected Layer Selector */}
                    <div>
                        <div style={{ fontSize: "12px", color: "#94A3B8", fontFamily: "JetBrains Mono, monospace", marginBottom: "12px", fontWeight: 700 }}>
                            SELECCIONA UNA CAPA PARA AUDITAR SUS COMPONENTES EN EL CÓDIGO:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {architectureLayers.map((layer, idx) => {
                                const isSelected = selectedLayerIndex === idx;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedLayerIndex(idx)}
                                        style={{
                                            padding: "14px 16px",
                                            borderRadius: "14px",
                                            background: isSelected ? "rgba(0, 229, 255, 0.08)" : "rgba(255,255,255,0.03)",
                                            border: `1.5px solid ${isSelected ? layer.color : "rgba(255,255,255,0.07)"}`,
                                            cursor: "pointer",
                                            transition: "all 0.2s ease"
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "10px", color: layer.color, fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                                                    {layer.layer}
                                                </span>
                                                <span style={{ fontSize: "14px", fontWeight: 800, color: "#FFF" }}>
                                                    {layer.title}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: "16px" }}>{layer.icon}</span>
                                        </div>
                                        <div style={{ fontSize: "11px", color: layer.color, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, marginBottom: "4px" }}>
                                            {layer.tech}
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: 1.4 }}>
                                            {layer.desc}
                                        </div>
                                        {isSelected && (
                                            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed rgba(255,255,255,0.1)", fontSize: "11px", color: "#38BDF8", fontFamily: "JetBrains Mono, monospace" }}>
                                                📂 Archivos Clave: <span style={{ color: "#FFF" }}>{layer.files}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* END-TO-END DATA FLOW TIMELINE (Ciclo de Vida de un Paquete Táctico) */}
            <div style={{
                background: "rgba(12, 16, 28, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "20px",
                padding: "24px",
                marginBottom: "40px"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                        <div style={{ fontSize: "10px", color: "#00FF88", fontFamily: "JetBrains Mono, monospace", fontWeight: 800, letterSpacing: "1px" }}>
                            RUNTIME DATA PIPELINE // CERO NUBE
                        </div>
                        <h3 style={{ fontSize: "20px", fontWeight: 900, color: "#FFF", margin: "4px 0 0" }}>
                            Ciclo de Vida de un Paquete en RED
                        </h3>
                    </div>
                    <span style={{ fontSize: "12px", color: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }}>
                        Latencia Local: &lt; 5ms en bucle cerrado
                    </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                    {[
                        { step: "01", name: "Generación SPA", desc: "Zustand empaqueta el payload (texto, vocoder o telemetría GPS).", color: "#00E5FF" },
                        { step: "02", name: "Cifrado PQC", desc: "Rust aplica Double Ratchet + ML-KEM-768 (Kyber post-cuántico).", color: "#A855F7" },
                        { step: "03", name: "Persistencia Sled", desc: "Transacción ACID local en disco para enrutamiento tolerante a retrasos.", color: "#FF3355" },
                        { step: "04", name: "Loopback IPC", desc: "Socket HTTP/SSE en 127.0.0.1:7333 notifica al servicio Android.", color: "#00FF88" },
                        { step: "05", name: "Emisión PHY", desc: "Multiplexor selecciona BLE 5.3, LoRa 915 MHz o SoundMesh según rango.", color: "#FFB300" },
                        { step: "06", name: "Salto Mesh", desc: "Nodos vecinos retransmiten con deduplicación BLAKE3 y decremento de TTL.", color: "#38BDF8" }
                    ].map((st, i) => (
                        <div key={i} style={{
                            padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.03)",
                            border: `1px solid ${st.color}33`, display: "flex", flexDirection: "column", gap: "6px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "10px", color: st.color, fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>PASO {st.step}</span>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: st.color }} />
                            </div>
                            <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF" }}>{st.name}</div>
                            <div style={{ fontSize: "11px", color: "#94A3B8", lineHeight: 1.4 }}>{st.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Live Developer Code Inspector Terminal */}
            <div style={{
                background: "rgba(5, 8, 16, 0.98)",
                border: "1.5px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "24px", overflow: "hidden",
                boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
                marginBottom: "40px"
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
                            { id: "rust", label: "🦀 Rust Router & Sled" },
                            { id: "pqc", label: "🔐 ML-KEM-768 PQC" },
                            { id: "vocoder", label: "🎙️ ADPCM Vocoder" },
                            { id: "android", label: "🤖 Android Daemon JNI" }
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

            {/* OPEN SOURCE CONTRIBUTION HUB (Llamado y Rutas para Contribuidores) */}
            <div id="contribute" style={{
                background: "linear-gradient(180deg, rgba(14, 20, 36, 0.9) 0%, rgba(8, 12, 22, 0.95) 100%)",
                border: "1.5px solid rgba(0, 255, 136, 0.3)",
                borderRadius: "24px",
                padding: "32px 24px",
                boxShadow: "0 20px 50px rgba(0, 255, 136, 0.08)"
            }}>
                <div style={{ textAlign: "center", marginBottom: "28px" }}>
                    <span style={{
                        fontSize: "11px", padding: "5px 14px", borderRadius: "20px",
                        background: "rgba(0, 255, 136, 0.12)", color: "#00FF88",
                        border: "1px solid rgba(0, 255, 136, 0.3)",
                        fontFamily: "JetBrains Mono, monospace", fontWeight: 800, letterSpacing: "1px"
                    }}>
                        OPEN SOURCE • INGENIERÍA SOBERANA COLECTIVA
                    </span>
                    <h3 style={{ fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "8px" }}>
                        Conviértete en Contribuidor de RED
                    </h3>
                    <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "780px", margin: "0 auto", lineHeight: 1.6 }}>
                        RED es un proyecto de código abierto diseñado para garantizar el derecho inalienable a la comunicación humana ante apagones y catástrofes. Buscamos desarrolladores, criptógrafos y radioaficionados que deseen construir software que salva vidas.
                    </p>
                </div>

                {/* Track Selector Buttons */}
                <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
                    {contributionTracks.map(track => {
                        const isSelected = activeTrack === track.id;
                        return (
                            <button
                                key={track.id}
                                onClick={() => setActiveTrack(track.id as any)}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "10px",
                                    background: isSelected ? `${track.color}22` : "rgba(255,255,255,0.04)",
                                    border: `1.5px solid ${isSelected ? track.color : "rgba(255,255,255,0.08)"}`,
                                    color: isSelected ? track.color : "#94A3B8",
                                    fontSize: "12px",
                                    fontWeight: 800,
                                    fontFamily: "JetBrains Mono, monospace",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease"
                                }}
                            >
                                {track.title}
                            </button>
                        );
                    })}
                </div>

                {/* Active Track Details Box */}
                {(() => {
                    const track = contributionTracks.find(t => t.id === activeTrack) || contributionTracks[0];
                    return (
                        <div style={{
                            background: "rgba(5, 8, 16, 0.8)",
                            border: `1px solid ${track.color}44`,
                            borderRadius: "18px",
                            padding: "24px",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "24px",
                            alignItems: "center"
                        }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                                    <span style={{ fontSize: "10px", color: track.color, background: `${track.color}22`, padding: "3px 8px", borderRadius: "6px", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                                        {track.tag}
                                    </span>
                                    <h4 style={{ fontSize: "18px", fontWeight: 800, color: "#FFF", margin: 0 }}>
                                        {track.title}
                                    </h4>
                                </div>
                                <p style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6, marginBottom: "12px" }}>
                                    {track.focus}
                                </p>
                                <div style={{ fontSize: "12px", color: "#94A3B8" }}>
                                    <strong style={{ color: "#FFF" }}>Perfil Recomendado:</strong> {track.goodFor}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: "11px", color: track.color, fontFamily: "JetBrains Mono, monospace", fontWeight: 800, marginBottom: "10px" }}>
                                    DESAFÍOS ABIERTOS PARA RESOLVER:
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {track.tasks.map((task, tIdx) => (
                                        <div key={tIdx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", color: "#E2E8F0" }}>
                                            <span style={{ color: track.color, fontWeight: 900 }}>•</span>
                                            <span>{task}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Quickstart 3-Step Guide & Action CTAs */}
                <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px", alignItems: "center" }}>
                    <div>
                        <div style={{ fontSize: "11px", color: "#00E5FF", fontFamily: "JetBrains Mono, monospace", fontWeight: 800, marginBottom: "6px" }}>
                            CONFIGURACIÓN LOCAL EN 3 COMANDOS:
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.6)", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "#E2E8F0", lineHeight: 1.7 }}>
                            <div>$ git clone https://github.com/DarckRovert/RED.git</div>
                            <div>$ cd RED/red_mobile && cargo check</div>
                            <div>$ cd ../client/app && npm run dev</div>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <a
                            href="https://github.com/DarckRovert/RED"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                padding: "12px 20px", borderRadius: "12px",
                                background: "linear-gradient(135deg, #00FF88 0%, #00B0FF 100%)",
                                color: "#000", fontWeight: 900, fontSize: "13px",
                                textDecoration: "none", textAlign: "center",
                                display: "flex", justifyContent: "center", alignItems: "center", gap: "8px",
                                boxShadow: "0 8px 20px rgba(0, 255, 136, 0.3)"
                            }}
                        >
                            <span>⭐ Ver Repositorio en GitHub</span>
                        </a>

                        <a
                            href="https://github.com/DarckRovert/RED/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                padding: "10px 20px", borderRadius: "12px",
                                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                                color: "#FFF", fontWeight: 700, fontSize: "12px",
                                textDecoration: "none", textAlign: "center",
                                display: "flex", justifyContent: "center", alignItems: "center", gap: "8px"
                            }}
                        >
                            <span>🛠️ Explorar Good First Issues</span>
                        </a>
                    </div>
                </div>
            </div>

          </div>

          {/* LIGHTBOX MODAL PARA EL PLANO TÉCNICO COMPLETO */}
          {isSchematicModalOpen && (
              <div
                  onClick={() => setIsSchematicModalOpen(false)}
                  style={{
                      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                      background: "rgba(0, 0, 0, 0.92)",
                      backdropFilter: "blur(10px)",
                      zIndex: 9999,
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      padding: "20px"
                  }}
              >
                  <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                          maxWidth: "1100px", width: "100%", maxHeight: "90vh",
                          background: "#070B18", borderRadius: "20px",
                          border: "2px solid #00E5FF", overflow: "hidden",
                          display: "flex", flexDirection: "column",
                          boxShadow: "0 25px 80px rgba(0, 229, 255, 0.4)"
                      }}
                  >
                      <div style={{
                          padding: "16px 20px", background: "rgba(10, 15, 30, 0.95)",
                          borderBottom: "1px solid rgba(0, 229, 255, 0.3)",
                          display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ fontSize: "16px" }}>📐</span>
                              <span style={{ color: "#FFF", fontWeight: 800, fontSize: "14px", fontFamily: "JetBrains Mono, monospace" }}>
                                  RED OS v93.0.0 // SISTEMA INTEGRAL DE CAPAS Y FLUJO DE DATOS
                              </span>
                          </div>
                          <button
                              onClick={() => setIsSchematicModalOpen(false)}
                              style={{
                                  background: "rgba(255, 51, 85, 0.2)",
                                  border: "1px solid #FF3355",
                                  color: "#FF3355",
                                  borderRadius: "8px",
                                  padding: "6px 14px",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  fontFamily: "JetBrains Mono, monospace"
                              }}
                          >
                              CERRAR [ESC]
                          </button>
                      </div>
                      <div style={{ overflow: "auto", padding: "16px", display: "flex", justifyContent: "center" }}>
                          <img
                              src={schematicUrl}
                              alt="Plano Completo de Arquitectura RED OS"
                              style={{ maxWidth: "100%", height: "auto", borderRadius: "12px", display: "block" }}
                          />
                      </div>
                  </div>
              </div>
          )}
        </section>
    );
};
