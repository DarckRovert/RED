"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { GuardianEngine } from "../lib/guardianEngine";
import { LocalAIEngine } from "../lib/localAiEngine";
import { EmergencyGlossaryEngine, EMERGENCY_GLOSSARY } from "../lib/emergencyGlossary";
import { RED_VERSION, RED_VERSION_NAME, RED_APK_NAME } from "../lib/version";

interface RedShowcaseLandingProps {
  onEnterApp?: () => void;
  onEnterVault?: () => void;
}

type ShowcaseTab = 
  | 'hero' 
  | 'modules' 
  | 'consent' 
  | 'soundmesh' 
  | 'crypto' 
  | 'hivemind' 
  | 'guardian' 
  | 'radar' 
  | 'terminal' 
  | 'architecture' 
  | 'investors' 
  | 'faq';

interface TacticalModule {
  id: string;
  name: string;
  category: string;
  icon: string;
  summary: string;
  badge: string;
  techStack: string;
}

const TACTICAL_MODULES_CATALOG: TacticalModule[] = [
  // 1. Mensajería P2P & Canales (6)
  { id: "channels", name: "Canales Mesh Locales", category: "Mensajería & Canales", icon: "📻", summary: "Subcanales temáticos de escuadrón (#general, #sos, #logistica) sobre broadcast Gossipsub.", badge: "Multi-Topic", techStack: "LibP2P Gossipsub / SQLite" },
  { id: "socialFeed", name: "RED Social Feed P2P", category: "Mensajería & Canales", icon: "🌍", summary: "Muro de publicaciones públicas descentralizadas propagadas mediante mulas de datos DTN.", badge: "DTN Feed", techStack: "Ed25519 Signed Payloads" },
  { id: "broadcast", name: "Difusión Privada", category: "Mensajería & Canales", icon: "📢", summary: "Emisión unidireccional de alertas cifradas a listas cerradas de contactos autorizados.", badge: "Cifrado E2E", techStack: "ChaCha20-Poly1305" },
  { id: "walkie", name: "Walkie-Talkie Mesh HQ (PTT)", category: "Mensajería & Canales", icon: "🎙️", summary: "Push-To-Talk con auto-reproducción instantánea en canales de voz usando LowBitrateVocoder.", badge: "Ultra-Low Latency", techStack: "8kHz IMA-ADPCM / PTT DSP" },
  { id: "canvas", name: "Canvas Táctico P2P", category: "Mensajería & Canales", icon: "🎨", summary: "Pizarra interactiva colaborativa en tiempo real con sincronización de trazos vectoriales sobre la malla.", badge: "Zero-Server", techStack: "CRDT / WebRTC DataChannel" },
  { id: "liveStream", name: "Live Broadcast Stream", category: "Mensajería & Canales", icon: "📺", summary: "Transmisión de vídeo en vivo P2P de baja latencia con señalización descentralizada.", badge: "WebRTC Mesh", techStack: "H.264 / WebRTC Mesh" },

  // 2. Red Malla & Radar Off-Grid (9)
  { id: "shakePair", name: "Shake & Pair (Acelerómetro)", category: "Red Malla & Radar", icon: "📳", summary: "Emparejamiento criptográfico instantáneo agitando ambos dispositivos mediante telemetría de sensores físicos.", badge: "Hardware Sensor", techStack: "Android Sensor API / BLE Scan" },
  { id: "offGridCompass", name: "Radar Topográfico GPS", category: "Red Malla & Radar", icon: "🧭", summary: "Brújula militar off-grid que proyecta rumbo angular y distancia a nodos pares sin conexión satelital.", badge: "Geolocalización", techStack: "Haversine / Magnetometer API" },
  { id: "nodemap", name: "Mapa de Nodos P2P", category: "Red Malla & Radar", icon: "🗺️", summary: "Cartografía táctica de nodos con renderizado vectorial de rutas multi-salto activas.", badge: "Topología Geo", techStack: "Leaflet / GPS Coordinates" },
  { id: "nearby", name: "Radar Hardware BLE/WiFi", category: "Red Malla & Radar", icon: "📡", summary: "Escaneo en tiempo real de potencia RSSI, estado de batería y paquetes recibidos por dispositivo.", badge: "Radio Raw", techStack: "BLE GATT HCI / WiFi Sniffer" },
  { id: "rfSpectrum", name: "Analizador Espectro RF / EW", category: "Red Malla & Radar", icon: "🛡️", summary: "Detección de interferencias electrónicas (EW jamming) y análisis de canales de radio 2.4GHz / 915MHz.", badge: "Anti-Jamming", techStack: "RSSI Variance / Spectral DSP" },
  { id: "proximity", name: "Ondas de Proximidad", category: "Red Malla & Radar", icon: "🌊", summary: "Radar sonar acústico y de radio que detecta la densidad de dispositivos soberanos en el área.", badge: "Proximity Ping", techStack: "BLE Beaconing / SoundMesh" },
  { id: "weather", name: "Clima & Barómetro CAP", category: "Red Malla & Radar", icon: "🌤️", summary: "Alertas meteorológicas de emergencia CAP y barómetro barométrico local para predicción de tormentas.", badge: "Sensor Barométrico", techStack: "CAP XML / Pressure Sensor" },
  { id: "ecoMesh", name: "Batería Eco-Mesh", category: "Red Malla & Radar", icon: "🔋", summary: "Gobernador cinemático de energía (KineticDutyGovernor) que modula la radio según movimiento y batería.", badge: "Ahorro Dinámico", techStack: "Battery API / Gyroscope" },
  { id: "network", name: "Topología de Red", category: "Red Malla & Radar", icon: "🌐", summary: "Grafo interactivo de enrutamiento Kademlia DHT, tabla de pares y métricas de latencia inter-nodo.", badge: "DHT Routing", techStack: "LibP2P Kademlia / Axum SSE" },

  // 3. Identidad, Pagos & Soberanía (9)
  { id: "commercialHub", name: "Hub Comercial & Recompensas", category: "Identidad & Pagos", icon: "⚡", summary: "Economía DePIN de retransmisión: gana tokens $RED por reenviar paquetes ajenos de forma segura.", badge: "Proof-of-Relay", techStack: "Tokenomics / Relay Ledger" },
  { id: "web3Vault", name: "Bóveda Web3 & MetaMask", category: "Identidad & Pagos", icon: "🦊", summary: "Firma EIP-712 sin gas y enlace multi-cadena con billeteras EVM en Polygon / Ethereum.", badge: "EVM Bridge", techStack: "Ethers.js / EIP-712" },
  { id: "idVault", name: "Perfil & Bóveda DID", category: "Identidad & Pagos", icon: "🪪", summary: "Identidad auto-soberana W3C did:red basada en clave pública Ed25519 con tarjeta de presentación QR.", badge: "Self-Sovereign", techStack: "W3C DID / Ed25519" },
  { id: "p2pPay", name: "Pagos & Vouchers P2P", category: "Identidad & Pagos", icon: "💳", summary: "Emisión y canje de vales de pago offline firmados criptográficamente con paridad en moneda fiat.", badge: "Offline Cash", techStack: "Ed25519 Blind Signatures" },
  { id: "crypto", name: "Bóveda Criptográfica PQC", category: "Identidad & Pagos", icon: "🔐", summary: "Criptografía híbrida post-cuántica ML-KEM-768 (FIPS 203) combinada con Double Ratchet X25519.", badge: "Post-Quantum", techStack: "ML-KEM-768 / Noise XK" },
  { id: "explorer", name: "Explorador Blockchain", category: "Identidad & Pagos", icon: "⛓️", summary: "Auditoría de bloques y transacciones de la cadena de bloques liviana interna del ecosistema RED.", badge: "Micro-Chain", techStack: "Merkle Trees / PoS Consensus" },
  { id: "webCompanionLink", name: "Vincular Dispositivo Web (PC)", category: "Identidad & Pagos", icon: "💻", summary: "Puente cifrado P2P que sincroniza la bóveda entre el celular Android y la versión web del navegador.", badge: "Sync Local", techStack: "WebRTC DataChannel / AES-256" },
  { id: "stegoVault", name: "Bóveda Esteganográfica", category: "Identidad & Pagos", icon: "🖼️", summary: "Ocultamiento de claves privadas y mensajes secretos dentro de píxeles de fotografías PNG / JPEG.", badge: "Anti-Forensics", techStack: "LSB Steganography / ChaCha20" },
  { id: "backup", name: "Respaldos & Restauración", category: "Identidad & Pagos", icon: "💾", summary: "Copia de seguridad 1-toque protegida por PIN Maestro con respaldo a Google Drive y semilla BIP-39.", badge: "Zero-Knowledge", techStack: "Argon2id / AES-GCM-256" },

  // 4. Ciberdefensa & Escudo Global (4)
  { id: "globalShield", name: "Escudo Global (DEFCON Matrix)", category: "Ciberdefensa", icon: "🛡️", summary: "Matriz táctica de niveles de amenaza (DEFCON 5 a 1) que endurece las políticas de red y radio.", badge: "DEFCON Matrix", techStack: "Threat Engine / IP Tables" },
  { id: "blackout", name: "Simulador Apagón Blackout", category: "Ciberdefensa", icon: "⚡", summary: "Prueba de estrés que desconecta intencionalmente el acceso a Internet para validar la conmutación ad-hoc.", badge: "Disaster Ready", techStack: "Network Isolator" },
  { id: "dms", name: "Hombre Muerto (Dead Man's Switch)", category: "Ciberdefensa", icon: "💀", summary: "Temporizador de seguridad que emite una baliza SOS o destruye las claves si el usuario no responde.", badge: "Fail-Safe", techStack: "Keystore Purge / AlarmManager" },
  { id: "security", name: "Seguridad Zero-Trust", category: "Ciberdefensa", icon: "🛡️", summary: "FLAG_SECURE anti-capturas, PIN de pánico con borrado de datos y bóveda señuelo (PIN 9999).", badge: "Anti-Coercion", techStack: "Android Keystore / Wipe Engine" },

  // 5. Emergencias, Salud & Rescate (5)
  { id: "vitalScan", name: "Signos Vitales & Triaje START", category: "Emergencias & Salud", icon: "🫀", summary: "Protocolo médico de triaje de catástrofes con clasificación por colores y registro masivo de víctimas.", badge: "Medical START", techStack: "START Algorithm / Offline DB" },
  { id: "survivalBeacon", name: "Baliza Ultrasonido SOS", category: "Emergencias & Salud", icon: "🚨", summary: "Emisión de socorro acústico FSK de alta frecuencia capaz de ser captada por otros teléfonos a oscuras.", badge: "SoundMesh SOS", techStack: "AudioContext 18.5kHz FSK" },
  { id: "amber", name: "Sistema Alerta AMBER", category: "Emergencias & Salud", icon: "🟠", summary: "Difusión comunitaria urgente de personas desaparecidas con fotografía cifrada y radio geocercado.", badge: "Civil Defense", techStack: "Geo-Broadcast Mesh" },
  { id: "dms_emergency", name: "Alerta Hombre Muerto", category: "Emergencias & Salud", icon: "💀", summary: "Monitoreo activo para brigadistas y rescatistas en zonas de derrumbe o radiación.", badge: "First Responders", techStack: "Sensor Inactivity Ping" },
  { id: "emergencyGlossary", name: "Glosario Médico Offline", category: "Emergencias & Salud", icon: "📖", summary: "Enciclopedia de primeros auxilios y protocolos de torniquetes, RCP y fracturas 100% sin conexión.", badge: "Knowledge Base", techStack: "IndexedDB / Vector Glossary" },

  // 6. Inteligencia Artificial Neuronal (2)
  { id: "aiCopilot", name: "Copiloto IA Offline", category: "IA Neuronal", icon: "🤖", summary: "Inferencia local en dispositivo (Rust / WASM) con RAG semántico (<120ms) sin enviar datos a la nube.", badge: "Local LLM / RAG", techStack: "ONNX Runtime / WASM / Embeddings" },
  { id: "guardian", name: "Guardian IA (Firewall S4)", category: "IA Neuronal", icon: "🛡️", summary: "Inspección local previa al cifrado con distancia Hamming 64-bit para interceptar material ilícito/hostil.", badge: "Edge Firewall", techStack: "Hamming 64-bit / Toxic-BERT" },

  // 7. Herramientas, Sistema & Camuflaje (7)
  { id: "settings", name: "Ajustes & Personalización", category: "Sistema & Herramientas", icon: "⚙️", summary: "Control granular de identidades, radios habilitadas, temas visuales y cuotas de almacenamiento.", badge: "Settings Hub", techStack: "LocalStorage / Zustand" },
  { id: "updater", name: "Actualizador de Software (OTA)", category: "Sistema & Herramientas", icon: "🚀", summary: "Distribución de actualizaciones de software de nodo a nodo a través de la malla sin Google Play.", badge: "Mesh OTA", techStack: "Chunked Binary Gossipsub" },
  { id: "health", name: "Diagnóstico Salud Sistema", category: "Sistema & Herramientas", icon: "📊", summary: "Telemetría en tiempo real de consumo de memoria, latencia de hilos Rust, FPS y throughput de red.", badge: "Diagnostics", techStack: "Performance API / Rust NDK" },
  { id: "nodeLogs", name: "Logs del Nodo Rust SSE", category: "Sistema & Herramientas", icon: "📋", summary: "Consola de eventos en streaming directo desde el socket HTTP /api/events del motor nativo.", badge: "SSE Stream", techStack: "EventSource / Axum" },
  { id: "calculator", name: "Calculadora Señuelo", category: "Sistema & Herramientas", icon: "🧮", summary: "Interfaz camuflada completamente funcional de calculadora científica para ocultar la app ante inspección.", badge: "Stealth Mode", techStack: "Math Parser / Decoy Router" },
  { id: "secReport", name: "Reporte Auditoría Seguridad", category: "Sistema & Herramientas", icon: "📑", summary: "Generador de informes técnicos de cumplimiento criptográfico, entropía y aislamiento de memoria.", badge: "Compliance", techStack: "Security Inspector" },
  { id: "zeroTrust", name: "Políticas Zero-Trust", category: "Sistema & Herramientas", icon: "🛡️", summary: "Consent-first en contactos, aislamiento de procesos y rotación obligatoria de claves de sesión.", badge: "Zero-Trust", techStack: "Consent Manager" },
];

export default function RedShowcaseLanding({ onEnterApp, onEnterVault }: RedShowcaseLandingProps) {
  const handleEnter = onEnterVault || onEnterApp || (() => {});
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('hero');
  const [quickAlias, setQuickAlias] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Consent-First P2P Interactive Simulator State
  const [simConsentStep, setSimConsentStep] = useState<'idle' | 'incoming' | 'accepted' | 'rejected' | 'blocked'>('idle');
  const [simPeerHash, setSimPeerHash] = useState('7F3A91BC2E844D0F81E73A6B');
  const [simPeerAlias, setSimPeerAlias] = useState('Operador_Centinela_04');
  const [simLog, setSimLog] = useState<string[]>([
    '> [LISTENER P2P] Escuchando handshakes de descubrimiento en BLE GATT y mDNS...',
    '> [POLÍTICA ZERO-TRUST] Consent-First activo: Ningún nodo puede enviar mensajes sin autorización explícita.'
  ]);

  // SoundMesh & Audio Vocoder Simulator State
  const [soundMode, setSoundMode] = useState<'audible' | 'ultrasound'>('audible');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [soundLog, setSoundLog] = useState<string>('> Módem acústico listo. Selecciona modo de frecuencia para transmitir trama.');

  // Post-Quantum ML-KEM-768 & Double Ratchet Simulator State
  const [ratchetCount, setRatchetCount] = useState(1);
  const [ratchetDh, setRatchetDh] = useState('ML-KEM-768 + X25519 (Hybrid Kyber Key Encapsulation)');
  const [ratchetKdf, setRatchetKdf] = useState('Message_Key_1 = HKDF_Expand(Kyber_Shared_Secret, "HKDF_CHAIN_A91B")');
  const [ratchetCipher, setRatchetCipher] = useState('Payload = ChaCha20_Poly1305_Encrypt(Message_Key_1, Nonce, "AES256_PQC_8F1A29")');
  const [ratchetLog, setRatchetLog] = useState('> [ÉPOCA 1 POST-CUÁNTICA] Llave híbrida generada con ML-KEM-768 (FIPS 203) + X25519.');

  // Radar State
  const [isBlackout, setIsBlackout] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // AI Inference & Medical Glossary State
  const [hiveMindQuery, setHiveMindQuery] = useState('');
  const [hiveMindResp, setHiveMindResp] = useState<string | null>(null);
  const [isSimulatingInference, setIsSimulatingInference] = useState(false);

  // Guardian S4 AI State
  const [guardianInput, setGuardianInput] = useState('');
  const [guardianVerdict, setGuardianVerdict] = useState<{ status: 'idle' | 'allow' | 'block'; title: string; desc: string } | null>(null);

  const githubReleaseUrl = `https://github.com/DarckRovert/RED/releases/tag/v${RED_VERSION}`;
  const apkDownloadUrl = `https://github.com/DarckRovert/RED/releases/download/v${RED_VERSION}/${RED_APK_NAME}`;

  const heroBannerUrl = typeof window !== 'undefined' && window.location.pathname.includes('/RED')
    ? '/RED/assets/red_investor_hero_banner.png'
    : 'assets/red_investor_hero_banner.png';

  const categoriesList = useMemo(() => {
    const cats = Array.from(new Set(TACTICAL_MODULES_CATALOG.map(m => m.category)));
    return ['Todos', ...cats];
  }, []);

  const filteredModules = useMemo(() => {
    return TACTICAL_MODULES_CATALOG.filter(m => {
      const matchesCat = selectedCategory === 'Todos' || m.category === selectedCategory;
      const matchesSearch = !moduleSearch.trim() || 
        m.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
        m.summary.toLowerCase().includes(moduleSearch.toLowerCase()) ||
        m.techStack.toLowerCase().includes(moduleSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, moduleSearch]);

  const handleCreateWebUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAlias.trim() && typeof window !== 'undefined') {
      localStorage.setItem("user_nickname", quickAlias.trim());
      localStorage.setItem("red_displayName", quickAlias.trim());
    }
    handleEnter();
  };

  // SoundMesh Web Audio API synthesized chirp
  const playSoundMeshPulse = () => {
    if (typeof window === 'undefined') return;
    try {
      setIsPlayingAudio(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freqStart = soundMode === 'audible' ? 2200 : 18500;
      const freqEnd = soundMode === 'audible' ? 3400 : 20500;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + 0.28);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.30);

      setSoundLog(`> [TRANSMISIÓN ACÚSTICA] Trama FSK emitida a ${soundMode === 'audible' ? '2.4–3.4 kHz (Audible)' : '18.5–20.5 kHz (Ultrasónico)'} | Payload: 128 bytes comprimidos en 0.28s.`);

      setTimeout(() => {
        setIsPlayingAudio(false);
      }, 350);
    } catch (err: any) {
      setIsPlayingAudio(false);
      setSoundLog(`> Error al sintetizar audio Web: ${err?.message || 'Contexto de audio no disponible'}`);
    }
  };

  // Trigger Consent simulation
  const triggerIncomingConsent = () => {
    const randBuf = new Uint8Array(6);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(randBuf);
    }
    const hex = Array.from(randBuf, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const newHash = `${hex.slice(0, 4)}...${hex.slice(4, 8)}`;
    setSimPeerHash(newHash);
    setSimPeerAlias(`Nodo_Táctico_${hex.slice(0, 3)}`);
    setSimConsentStep('incoming');
    setSimLog(prev => [
      `> [ALERTA ACÚSTICA 🚨] Solicitud de contacto entrante desde ${newHash}`,
      `> [ESTADO] Paquete retenido en cuarentena. Requiere autorización humana para habilitar canal de chat.`
    ]);
  };

  // Post-Quantum Ratchet simulator
  const triggerRatchetSim = () => {
    const nextCount = ratchetCount + 1;
    const randBuf = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(randBuf);
    }
    const hex = Array.from(randBuf, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const randomKyber = 'KYBER768_' + hex.slice(0, 8);
    const randomDh = 'X25519_' + hex.slice(8, 16);
    const randomCipher = 'PQC_CIPHER_' + hex.slice(16, 28);

    setRatchetCount(nextCount);
    setRatchetDh(`Hybrid_Shared_Secret_${nextCount} = Decap(ML-KEM-768: [${randomKyber}]) ⊕ ECDH(X25519: [${randomDh}])`);
    setRatchetKdf(`Message_Key_${nextCount} = HKDF_Extract_And_Expand(Chain_Key_${nextCount}, "${hex.slice(0, 12)}")`);
    setRatchetCipher(`Payload = ChaCha20_Poly1305_Encrypt(Message_Key_${nextCount}, Nonce, "${randomCipher}")`);
    setRatchetLog(`> [MENSAJE ${nextCount} ENCRIPTADO] Clave de sesión post-cuántica renovada con éxito. Inmune a ataques cuánticos retroactivos.`);
  };

  const testGuardian = async (text: string) => {
    if (!text.trim()) return;
    try {
      const evalRes = await GuardianEngine.evaluateTextAsync(text);
      if (!evalRes.allowed) {
        setGuardianVerdict({
          status: 'block',
          title: '⛔ BLOQUEADO — GUARDIAN S4 LOCAL',
          desc: `${evalRes.reason || evalRes.feedback} [Categoría: ${evalRes.category?.toUpperCase() || 'HOSTIL'} | Score: ${evalRes.toxicity_score}% | Latencia: ${evalRes.executionTimeMs}ms]`
        });
      } else {
        setGuardianVerdict({
          status: 'allow',
          title: '✅ PERMITIDO — GUARDIAN LOCAL (OFF-GRID)',
          desc: `Contenido verificado sin anomalías en ${evalRes.executionTimeMs}ms (distancia Hamming 64-bit). Procede al cifrado híbrido E2E.`
        });
      }
    } catch {
      const evalRes = GuardianEngine.evaluateText(text);
      setGuardianVerdict({
        status: evalRes.allowed ? 'allow' : 'block',
        title: evalRes.allowed ? '✅ PERMITIDO — GUARDIAN LOCAL' : '⛔ BLOQUEADO — GUARDIAN S4 LOCAL',
        desc: evalRes.reason || evalRes.feedback
      });
    }
  };

  // Radar Animation Loop
  useEffect(() => {
    if (activeTab !== 'radar') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let sweepAngle = 0;

    const width = canvas.width = canvas.parentElement?.clientWidth || 700;
    const height = canvas.height = 420;

    const nodes = [
      { id: 'did:red:3f7a8291', name: 'Nodo Moto G22 (BLE)', x: width * 0.25, y: height * 0.45, type: 'ble', rssi: '-42 dBm', pkts: '1,420 msgs' },
      { id: 'did:red:9e12084c', name: 'Nodo Lenovo Tab (WiFi Direct)', x: width * 0.5, y: height * 0.65, type: 'wifi', rssi: '-38 dBm', pkts: '3,892 msgs' },
      { id: 'did:red:77c19b02', name: 'Nodo Relay LoRa (915MHz)', x: width * 0.75, y: height * 0.35, type: 'lora', rssi: '-55 dBm', pkts: '8,104 msgs' },
      { id: 'did:red:14ac890f', name: 'Nodo Módem SoundMesh (Acústico)', x: width * 0.40, y: height * 0.25, type: 'sound', rssi: '-30 dBFS', pkts: '512 msgs' }
    ];

    const render = () => {
      ctx.fillStyle = '#05070C';
      ctx.fillRect(0, 0, width, height);

      // Radar circles
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width, height) * 0.45;

      ctx.strokeStyle = isBlackout ? 'rgba(232, 33, 58, 0.2)' : 'rgba(0, 230, 118, 0.15)';
      ctx.lineWidth = 1;

      for (let r = 50; r <= maxR; r += 50) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Radar Crosshairs
      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.stroke();

      // Sweep Beam
      sweepAngle = (sweepAngle + 0.02) % (Math.PI * 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweepAngle);
      const gradient = ctx.createLinearGradient(0, 0, maxR, 0);
      gradient.addColorStop(0, isBlackout ? 'rgba(232, 33, 58, 0.6)' : 'rgba(0, 230, 118, 0.6)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxR, -0.2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Inter-node connection lines
      ctx.strokeStyle = isBlackout ? 'rgba(232, 33, 58, 0.4)' : 'rgba(56, 189, 248, 0.35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      ctx.lineTo(nodes[1].x, nodes[1].y);
      ctx.lineTo(nodes[2].x, nodes[2].y);
      ctx.lineTo(nodes[3].x, nodes[3].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Nodes
      nodes.forEach(node => {
        ctx.fillStyle = node.type === 'ble' ? '#38BDF8' : node.type === 'wifi' ? '#00E676' : node.type === 'sound' ? '#F59E0B' : '#A855F7';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFF';
        ctx.font = '11px monospace';
        ctx.fillText(node.name, node.x + 12, node.y + 4);
      });

      animFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrameId);
  }, [activeTab, isBlackout]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #0D111A 0%, #030407 100%)',
      color: '#E2E8F0',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top Tactical Navigation Bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(16px)',
        background: 'rgba(5, 7, 13, 0.85)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #E8213A 0%, #990014 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 0 15px rgba(232, 33, 58, 0.5)',
          }}>
            🛡️
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#FFF', letterSpacing: '1px' }}>
              RED <span style={{ color: '#E8213A' }}>OS</span>
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace', fontWeight: 700 }}>
              SOVEREIGN MESH • v{RED_VERSION} (BUILD 56000)
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <nav style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { id: 'hero', label: 'Inicio' },
            { id: 'modules', label: '42 Módulos' },
            { id: 'consent', label: 'Consent-First P2P' },
            { id: 'soundmesh', label: 'SoundMesh Acústico' },
            { id: 'crypto', label: 'PQC ML-KEM-768' },
            { id: 'hivemind', label: 'IA Offline & Salud' },
            { id: 'guardian', label: 'Guardian S4' },
            { id: 'radar', label: 'Radar Off-Grid' },
            { id: 'architecture', label: 'Arquitectura 4-Tier' },
            { id: 'investors', label: 'Tesis DePIN' },
            { id: 'faq', label: 'FAQ' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ShowcaseTab)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: activeTab === tab.id ? '1px solid #E8213A' : '1px solid transparent',
                background: activeTab === tab.id ? 'rgba(232, 33, 58, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: activeTab === tab.id ? '#FFF' : '#94A3B8',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Enter Web Vault Button */}
        <button
          onClick={handleEnter}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            background: 'linear-gradient(90deg, #E8213A 0%, #990014 100%)',
            color: '#FFF',
            fontWeight: 800,
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(232, 33, 58, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚡</span> Entrar a la Bóveda Web
        </button>
      </header>

      {/* Main Showcase Body */}
      <main style={{ flex: 1, padding: '36px 20px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
        
        {/* HERO TAB */}
        {activeTab === 'hero' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '20px',
              background: 'rgba(232, 33, 58, 0.12)',
              border: '1px solid rgba(232, 33, 58, 0.3)',
              color: '#FF4D66',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: 'monospace',
              marginBottom: '20px',
            }}>
              <span>🛡️</span> COMUNICACIÓN SOBERANA 100% OFF-GRID • INMUNE A APAGONES Y CENSURA
            </div>

            <h1 style={{
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 900,
              color: '#FFF',
              lineHeight: 1.1,
              maxWidth: '900px',
              marginBottom: '20px',
            }}>
              El Primer Sistema Operativo <br/>
              <span style={{
                background: 'linear-gradient(90deg, #E8213A 0%, #38BDF8 50%, #00E676 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                En Malla P2P, Post-Cuántica & IA Offline
              </span>
            </h1>

            <p style={{
              fontSize: '17px',
              color: '#94A3B8',
              maxWidth: '780px',
              lineHeight: 1.6,
              marginBottom: '36px',
            }}>
              RED funciona directamente entre dispositivos mediante radio Bluetooth LE, WiFi Direct, LoRa 915MHz y pulsos acústicos ultrasónicos SoundMesh. Sin servidores centrales, sin torres celulares y con criptografía híbrida post-cuántica ML-KEM-768.
            </p>

            {/* Quick Web Login Form */}
            <div style={{
              width: '100%',
              maxWidth: '560px',
              padding: '24px',
              borderRadius: '20px',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(232, 33, 58, 0.3)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              marginBottom: '40px',
            }}>
              <form onSubmit={handleCreateWebUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Ingresa tu Alias o Nombre de Operador..."
                  value={quickAlias}
                  onChange={(e) => setQuickAlias(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#FFF',
                    fontSize: '15px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'linear-gradient(90deg, #E8213A 0%, #990014 100%)',
                    color: '#FFF',
                    fontWeight: 800,
                    fontSize: '15px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(232,33,58,0.4)',
                  }}
                >
                  ⚡ Iniciar Bóveda Soberana en el Navegador
                </button>
              </form>
            </div>

            {/* Investor Hero Banner */}
            <div style={{
              width: '100%',
              maxWidth: '920px',
              borderRadius: '24px',
              overflow: 'hidden',
              border: '1px solid rgba(232,33,58,0.25)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
              marginBottom: '40px',
            }}>
              <img 
                src={heroBannerUrl} 
                alt="RED Sovereign Mesh OS Architecture"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            {/* Official APK Download Card */}
            <div style={{
              width: '100%',
              maxWidth: '920px',
              padding: '24px 32px',
              borderRadius: '20px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(0, 230, 118, 0.35)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              textAlign: 'left',
            }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📱</span> Instalador Oficial Android v{RED_VERSION} (Build 56000)
                </div>
                <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px', lineHeight: 1.5 }}>
                  Compilación de producción firmada para arquitectura ARM64 (`arm64-v8a`). Probada con Logcat simultáneo en hardware real (Motorola Moto G22 y Tablet Lenovo) con soporte BLE GATT, mDNS y LibP2P Kademlia.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <a
                  href={apkDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '14px 26px',
                    fontSize: '14px',
                    fontWeight: 800,
                    color: '#FFF',
                    background: 'linear-gradient(90deg, #00E676 0%, #008F45 100%)',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    boxShadow: '0 4px 15px rgba(0,230,118,0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span>📥</span> Descargar APK Directo
                </a>
                <a
                  href={githubReleaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '14px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#94A3B8',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>📦</span> Ver en GitHub Releases ↗
                </a>
              </div>
            </div>
          </div>
        )}

        {/* 42 TACTICAL MODULES EXPLORER */}
        {activeTab === 'modules' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(232,33,58,0.15)', color: '#FF4D66', border: '1px solid rgba(232,33,58,0.3)', fontFamily: 'monospace', fontWeight: 700 }}>CATÁLOGO DE MÓDULOS DE PRODUCCIÓN</span>
              <h2 style={{ fontSize: '36px', fontWeight: 900, color: '#FFF', marginTop: '12px', marginBottom: '10px' }}>42 Módulos Tácticos Activos</h2>
              <p style={{ fontSize: '15px', color: '#94A3B8', maxWidth: '750px', margin: '0 auto', lineHeight: 1.6 }}>
                Cada módulo cuenta con implementación real en el núcleo de la aplicación, integrando motores criptográficos, sensores de hardware y procesamiento en el borde.
              </p>
            </div>

            {/* Category Filter & Search Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {categoriesList.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: selectedCategory === cat ? '1px solid #E8213A' : '1px solid rgba(255,255,255,0.1)',
                      background: selectedCategory === cat ? 'rgba(232,33,58,0.2)' : 'rgba(15,23,42,0.6)',
                      color: selectedCategory === cat ? '#FFF' : '#94A3B8',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Filtrar módulos por nombre, descripción o stack tecnológico (ej. BLE, Rust, PQC, SOS)..."
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '680px',
                  margin: '0 auto',
                  padding: '14px 20px',
                  borderRadius: '14px',
                  background: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFF',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Modules Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
              {filteredModules.map(mod => (
                <div
                  key={mod.id}
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    background: 'rgba(15,23,42,0.7)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '26px' }}>{mod.icon}</span>
                      <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '12px', background: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)', fontFamily: 'monospace', fontWeight: 700 }}>
                        {mod.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#FFF', marginBottom: '6px' }}>{mod.name}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5, marginBottom: '12px' }}>{mod.summary}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                    ⚙️ {mod.techStack}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONSENT-FIRST P2P INTERACTIVE SIMULATOR */}
        {activeTab === 'consent' && (
          <div style={{ maxWidth: '840px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(232,33,58,0.15)', color: '#FF4D66', border: '1px solid rgba(232,33,58,0.3)', fontFamily: 'monospace', fontWeight: 700 }}>POLÍTICA ZERO-TRUST & ANTI-ACOSÓ</span>
              <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#FFF', marginTop: '10px', marginBottom: '8px' }}>Simulador de Autorización Consent-First P2P</h2>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                En RED, ningún nodo desconocido puede forzar conversaciones en tu pantalla. Toda solicitud de contacto entrante requiere confirmación criptográfica explícita.
              </p>
            </div>

            <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(232,33,58,0.35)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontWeight: 800, color: '#FFF', fontSize: '15px' }}>Acción de Prueba:</span>
                <button
                  onClick={triggerIncomingConsent}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: 'linear-gradient(90deg, #E8213A 0%, #990014 100%)',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: '12px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Simular Solicitud de Contacto P2P Entrante
                </button>
              </div>

              {simConsentStep === 'incoming' && (
                <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(232,33,58,0.15)', border: '1px solid #E8213A', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🚨</span>
                    <div>
                      <div style={{ fontWeight: 800, color: '#FFF', fontSize: '15px' }}>Solicitud de Conexión P2P Detectada</div>
                      <div style={{ fontSize: '12px', color: '#FF4D66', fontFamily: 'monospace' }}>Nodo: {simPeerAlias} ({simPeerHash})</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#CBD5E1', marginBottom: '16px' }}>
                    Este nodo solicita iniciar un canal de mensajería cifrado Double Ratchet. Selecciona cómo deseas responder:
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        setSimConsentStep('accepted');
                        setSimLog(prev => [...prev, `> [AUTORIZADO ✅] Nodo ${simPeerAlias} aceptado. Se añade a la lista de contactos autorizados.`]);
                      }}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#00E676', color: '#000', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ✅ Aceptar Contacto
                    </button>
                    <button
                      onClick={() => {
                        setSimConsentStep('rejected');
                        setSimLog(prev => [...prev, `> [RECHAZADO ❌] Solicitud descartada silenciosamente sin alertar al nodo remoto.`]);
                      }}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: '#FFF', fontWeight: 700, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ❌ Rechazar Silencioso
                    </button>
                    <button
                      onClick={() => {
                        setSimConsentStep('blocked');
                        setSimLog(prev => [...prev, `> [BLOQUEADO 🚫] Nodo ${simPeerAlias} añadido a la lista negra permanente. Todo paquete futuro será descartado a nivel de controlador de radio.`]);
                      }}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', background: '#E8213A', color: '#FFF', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '12px' }}
                    >
                      🚫 Bloquear Nodo (Anti-Acoso)
                    </button>
                  </div>
                </div>
              )}

              {/* Console Log */}
              <div style={{ background: '#05070C', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace', fontSize: '12px', color: '#38BDF8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {simLog.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SOUNDMESH ULTRASONIC & VOCODER TAB */}
        {activeTab === 'soundmesh' && (
          <div style={{ maxWidth: '840px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', fontFamily: 'monospace', fontWeight: 700 }}>TRANSPORTE ACÚSTICO & COMPRESIÓN DSP</span>
              <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#FFF', marginTop: '10px', marginBottom: '8px' }}>Módem Ultrasónico SoundMesh & LowBitrateVocoder</h2>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                Transmite paquetes de datos por el aire usando el altavoz y micrófono del dispositivo a frecuencias inaudibles (18.5–20.5 kHz) con compresión DSP IMA-ADPCM de 1.6–3.2 kbps (-97.9% de reducción de peso).
              </p>
            </div>

            <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(245,158,11,0.35)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <button
                  onClick={() => setSoundMode('audible')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: soundMode === 'audible' ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.5)',
                    border: soundMode === 'audible' ? '1px solid #F59E0B' : '1px solid rgba(255,255,255,0.1)',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  🔊 Modo Frecuencia Audible (2.4–3.4 kHz)
                </button>
                <button
                  onClick={() => setSoundMode('ultrasound')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: soundMode === 'ultrasound' ? 'rgba(56,189,248,0.2)' : 'rgba(30,41,59,0.5)',
                    border: soundMode === 'ultrasound' ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.1)',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  🦇 Modo Ultrasónico Inaudible (18.5–20.5 kHz)
                </button>
              </div>

              <button
                onClick={playSoundMeshPulse}
                disabled={isPlayingAudio}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  background: isPlayingAudio ? '#00E676' : 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)',
                  color: isPlayingAudio ? '#000' : '#FFF',
                  fontWeight: 900,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
                  marginBottom: '16px',
                }}
              >
                {isPlayingAudio ? '📡 Transmitiendo Paquete Acústico FSK...' : '▶️ Sintetizar y Emitir Paquete FSK en Vivo'}
              </button>

              <div style={{ background: '#05070C', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace', fontSize: '12px', color: '#F59E0B' }}>
                {soundLog}
              </div>
            </div>
          </div>
        )}

        {/* POST-QUANTUM CRYPTOGRAPHY ML-KEM-768 TAB */}
        {activeTab === 'crypto' && (
          <div style={{ maxWidth: '840px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(168,85,247,0.15)', color: '#A855F7', border: '1px solid rgba(168,85,247,0.3)', fontFamily: 'monospace', fontWeight: 700 }}>SEGURIDAD DE PRÓXIMA GENERACIÓN</span>
              <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#FFF', marginTop: '10px', marginBottom: '8px' }}>Criptografía Híbrida Post-Cuántica (ML-KEM-768)</h2>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                Protección contra ataques "Harvest Now, Decrypt Later". Combina el encapsulamiento de claves basado en retículos ML-KEM-768 (estándar FIPS 203) con Double Ratchet X25519 y ChaCha20-Poly1305.
              </p>
            </div>

            <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(168,85,247,0.35)', marginBottom: '24px' }}>
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace' }}>Encapsulamiento Híbrido PQC:</div>
                <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', color: '#A855F7', fontFamily: 'monospace', fontSize: '12px' }}>
                  {ratchetDh}
                </div>
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace' }}>Derivación de Clave de Mensaje (HKDF):</div>
                <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', color: '#38BDF8', fontFamily: 'monospace', fontSize: '12px' }}>
                  {ratchetKdf}
                </div>
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace' }}>Cifrado de Carga Útil (AEAD):</div>
                <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', color: '#00E676', fontFamily: 'monospace', fontSize: '12px' }}>
                  {ratchetCipher}
                </div>
              </div>

              <button
                onClick={triggerRatchetSim}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(90deg, #A855F7 0%, #7E22CE 100%)',
                  color: '#FFF',
                  fontWeight: 800,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: '16px',
                }}
              >
                🔄 Simular Avance de Época Post-Cuántica (Entropía CSPRNG en Vivo)
              </button>

              <div style={{ background: '#05070C', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace', fontSize: '12px', color: '#CBD5E1' }}>
                {ratchetLog}
              </div>
            </div>
          </div>
        )}

        {/* OFFLINE AI & MEDICAL TRIAGE TAB */}
        {activeTab === 'hivemind' && (
          <div style={{ maxWidth: '840px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(0,230,118,0.15)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)', fontFamily: 'monospace', fontWeight: 700 }}>IA EN EL DISPOSITIVO & RESCATE</span>
              <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#FFF', marginTop: '10px', marginBottom: '8px' }}>Copiloto IA Offline & Triaje Médico START</h2>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                Motor RAG semántico local con embeddings vectoriales en IndexedDB y algoritmos médicos de triaje de catástrofes para responder consultas de rescate en menos de 120ms sin conexión.
              </p>
            </div>

            <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(0,230,118,0.35)', marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="Escribe una consulta de emergencia (ej: primeros auxilios en fracturas, torniquete, protocolo sismos)..."
                value={hiveMindQuery}
                onChange={(e) => setHiveMindQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(30,41,59,0.7)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFF',
                  fontSize: '14px',
                  marginBottom: '14px',
                  outline: 'none',
                }}
              />

              <button
                onClick={async () => {
                  setIsSimulatingInference(true);
                  try {
                    const prompt = hiveMindQuery.trim() || 'primeros auxilios en emergencias';
                    const res = await LocalAIEngine.generateCopilotResponse(prompt);
                    const answer = `🧠 RESPUESTA IA LOCAL (${res.modelInfo})\n\n${res.answer}\n\n[Latencia de ejecución: ${res.executionTimeMs}ms | Categoría: ${res.topicCategory}]`;
                    setHiveMindResp(answer);
                  } catch (e: any) {
                    setHiveMindResp("Error al procesar inferencia local: " + (e?.message || "Motor no disponible"));
                  } finally {
                    setIsSimulatingInference(false);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(90deg, #00E676 0%, #008F45 100%)',
                  color: '#000',
                  fontWeight: 900,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: '16px',
                }}
              >
                {isSimulatingInference ? '⚙️ Procesando Inferencia en el Dispositivo...' : '⚡ Ejecutar Inferencia Semántica Local'}
              </button>

              {hiveMindResp && (
                <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(3,3,6,0.95)', border: '1px solid #00E676', color: '#CBD5E1', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {hiveMindResp}
                </div>
              )}
            </div>
          </div>
        )}

        {/* GUARDIAN S4 FIREWALL TAB */}
        {activeTab === 'guardian' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(232,33,58,0.15)', color: '#FF4D66', border: '1px solid rgba(232,33,58,0.3)', fontFamily: 'monospace', fontWeight: 700 }}>FIREWALL LOCAL EN EL BORDE</span>
              <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#FFF', marginTop: '10px', marginBottom: '8px' }}>Probador Guardian IA S4 (Anti-Abuso)</h2>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                Evalúa la intercepción local de contenido ilícito (CSAM, terrorismo, hostigamiento) en el dispositivo emisor antes de iniciar el cifrado de datos.
              </p>
            </div>

            <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="Escribe un mensaje de prueba para evaluar con Guardian S4..."
                value={guardianInput}
                onChange={(e) => setGuardianInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(30,41,59,0.7)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFF',
                  fontSize: '14px',
                  marginBottom: '14px',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <button
                  onClick={() => {
                    const txt = 'Hola equipo RED, la reunión de coordinación de la red malla será hoy a las 5 PM.';
                    setGuardianInput(txt);
                    testGuardian(txt);
                  }}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(0,217,126,0.15)', color: '#00D97E', border: '1px solid rgba(0,217,126,0.3)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  🟢 Probar Mensaje Seguro
                </button>
                <button
                  onClick={() => {
                    const txt = 'tengo material prohibido para vender por privado';
                    setGuardianInput(txt);
                    testGuardian(txt);
                  }}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(232,33,58,0.15)', color: '#FF4D66', border: '1px solid rgba(232,33,58,0.3)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  🔴 Probar Contenido Sospechoso
                </button>
              </div>

              <button
                onClick={() => testGuardian(guardianInput)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(90deg, #E8213A 0%, #990014 100%)',
                  color: '#FFF',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🔍 Evaluar Mensaje con Guardian S4
              </button>
            </div>

            {guardianVerdict && (
              <div style={{
                padding: '20px',
                borderRadius: '16px',
                background: guardianVerdict.status === 'block' ? 'rgba(232,33,58,0.15)' : 'rgba(0,217,126,0.15)',
                border: guardianVerdict.status === 'block' ? '1px solid #E8213A' : '1px solid #00D97E',
                textAlign: 'center',
              }}>
                <div style={{ fontWeight: 800, color: guardianVerdict.status === 'block' ? '#FF4D66' : '#00D97E', fontSize: '16px', marginBottom: '6px' }}>
                  {guardianVerdict.title}
                </div>
                <div style={{ fontSize: '13px', color: '#CBD5E1' }}>{guardianVerdict.desc}</div>
              </div>
            )}
          </div>
        )}

        {/* RADAR CANVAS TAB */}
        {activeTab === 'radar' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#FFF', textAlign: 'center', marginBottom: '10px' }}>Simulador de Radar & Malla Off-Grid</h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', textAlign: 'center', marginBottom: '20px' }}>
              Comprueba cómo la topología multi-radio mantiene los canales operativos incluso ante la caída total de torres celulares y proveedores de Internet.
            </p>

            <button
              onClick={() => setIsBlackout(!isBlackout)}
              style={{
                padding: '12px 24px',
                borderRadius: '14px',
                background: isBlackout ? 'linear-gradient(90deg, #E8213A 0%, #7F0010 100%)' : 'rgba(0, 230, 118, 0.15)',
                color: isBlackout ? '#FFF' : '#00E676',
                border: isBlackout ? '1px solid #E8213A' : '1px solid #00E676',
                fontWeight: 800,
                cursor: 'pointer',
                marginBottom: '20px',
                boxShadow: isBlackout ? '0 0 20px rgba(232,33,58,0.5)' : 'none',
              }}
            >
              {isBlackout ? '⚡ MODO APAGÓN ACTIVADO (Sin Internet / Solo Radios de Hardware)' : '🌐 Modo Normal (Hacer clic para simular Apagón)'}
            </button>

            <div style={{ width: '100%', maxWidth: '800px', background: '#05070C', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <canvas ref={canvasRef} style={{ width: '100%', height: '420px', display: 'block' }} />
            </div>
          </div>
        )}

        {/* 4-TIER ARCHITECTURE TAB */}
        {activeTab === 'architecture' && (
          <div style={{ maxWidth: '920px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)', fontFamily: 'monospace', fontWeight: 700 }}>INGENIERÍA DEL SISTEMA</span>
              <h2 style={{ fontSize: '36px', fontWeight: 900, color: '#FFF', marginTop: '12px', marginBottom: '10px' }}>Arquitectura Técnica de 4 Capas</h2>
              <p style={{ fontSize: '15px', color: '#94A3B8', maxWidth: '750px', margin: '0 auto', lineHeight: 1.6 }}>
                Desacoplamiento total entre la presentación SPA, el servicio en primer plano de Android, el motor nativo Rust compilado con NDK y las controladoras de radio física.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Layer 1 */}
              <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(56,189,248,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#38BDF8' }}>CAPA 1: PRESENTACIÓN FRONTEND (SPA)</div>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94A3B8' }}>Next.js 16 • React 19 • Zustand</span>
                </div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
                  Interfaz táctica responsiva construida con Turbopack. Administra los 42 módulos, renderiza el árbol de estados en memoria (`useRedStore.ts`) y se comunica con el backend mediante HTTP loopback y SSE en `127.0.0.1:7333`.
                </div>
              </div>

              {/* Layer 2 */}
              <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(0,230,118,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#00E676' }}>CAPA 2: MIDDLEWARE ANDROID NATIVO (JAVA / JNI)</div>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94A3B8' }}>Foreground Service • BLE GATT Server</span>
                </div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
                  `RedNodeService.java` mantiene vivo el proceso con notificación persistente, inmune a las restricciones de batería del sistema operativo. Administra el servidor GATT y transfiere paquetes al motor Rust mediante enlaces JNI C-ABI.
                </div>
              </div>

              {/* Layer 3 */}
              <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(232,33,58,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#FF4D66' }}>CAPA 3: MOTOR NATIVO RUST NDK (AXUM / LIBP2P)</div>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94A3B8' }}>red_core • red_mobile • SQLite Encrypted</span>
                </div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
                  Binario optimizado `libred_mobile.so`. Ejecuta Kademlia DHT, enrutamiento multi-salto Gossipsub, deduplicación de mensajes por 72 horas, cifrado Noise XK / ML-KEM-768 y persistencia segura en base de datos SQLite cifrada.
                </div>
              </div>

              {/* Layer 4 */}
              <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(168,85,247,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#A855F7' }}>CAPA 4: MULTI-RADIO HARDWARE OFF-GRID</div>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94A3B8' }}>BLE 5.3 • WiFi Direct • LoRa 915MHz • SoundMesh</span>
                </div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.6 }}>
                  Transmisión simultánea sobre canales físicos sin depender del stack TCP/IP tradicional. Permite la comunicación en túneles subterráneos, zonas de catástrofe y entornos de censura estatal.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INVESTORS TAB */}
        {activeTab === 'investors' && (
          <div style={{ maxWidth: '920px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)', fontFamily: 'monospace', fontWeight: 700 }}>TESIS DE INVERSIÓN & DEPIN</span>
              <h2 style={{ fontSize: '36px', fontWeight: 900, color: '#FFF', marginTop: '12px', marginBottom: '10px' }}>Oportunidad Estratégica & Mercado</h2>
              <p style={{ fontSize: '15px', color: '#94A3B8', maxWidth: '750px', margin: '0 auto', lineHeight: 1.6 }}>
                RED resuelve el punto único de fallo de las telecomunicaciones globales: la dependencia absoluta de servidores centralizados y operadores vulnerables a caídas y vigilancia masiva.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '36px' }}>
              <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(232,33,58,0.3)' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>💰</div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#FFF', marginBottom: '6px' }}>Costo de Servidores: $0 / Usuario</div>
                <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
                  La infraestructura escala orgánicamente con cada nuevo nodo que se une a la malla, eliminando la factura mensual millonaria de centros de datos en la nube.
                </div>
              </div>

              <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(0,230,118,0.3)' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>⚡</div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#FFF', marginBottom: '6px' }}>Incentivos DePIN (Proof-of-Relay)</div>
                <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
                  Los operadores que retransmiten tráfico para otros nodos reciben micro-recompensas en tokens $RED, incentivando el despliegue de repetidores comunitarios autónomos.
                </div>
              </div>

              <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(56,189,248,0.3)' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>🛡️</div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#FFF', marginBottom: '6px' }}>Seguridad Táctica Anti-Coerción</div>
                <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>
                  Protección de grado militar en el hardware: modo camuflaje de calculadora científica, PIN de pánico con autodestrucción y bóveda señuelo (PIN 9999).
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAQ TAB */}
        {activeTab === 'faq' && (
          <div style={{ maxWidth: '840px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#FFF', textAlign: 'center', marginBottom: '24px' }}>Preguntas Frecuentes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 800, color: '#FFF', marginBottom: '6px' }}>¿Pueden comunicarse la versión Web y los Celulares Android?</div>
                <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.5 }}>
                  Sí. Al iniciar sesión en la versión Web, el navegador genera su propio par de claves criptográficas soberanas (`did:red:`). Puedes agregar contactos escaneando su código QR o ingresando su Hash de 64 caracteres.
                </div>
              </div>

              <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 800, color: '#FFF', marginBottom: '6px' }}>¿Qué ocurre si un usuario activa una VPN en su teléfono?</div>
                <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.5 }}>
                  El canal Bluetooth LE y el módem acústico SoundMesh operan a nivel físico directo en el hardware sin pasar por el túnel VPN, garantizando comunicación local ininterrumpida.
                </div>
              </div>

              <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 800, color: '#FFF', marginBottom: '6px' }}>¿Por qué se utiliza criptografía híbrida Post-Cuántica?</div>
                <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.5 }}>
                  Para neutralizar la amenaza "Harvest Now, Decrypt Later". Los mensajes interceptados hoy no podrán ser descifrados en el futuro cuando las computadoras cuánticas sean capaces de romper algoritmos elípticos tradicionales.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '24px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#64748B',
        fontFamily: 'monospace',
      }}>
        © 2026 PROYECTO RED — Sovereign Mesh OS v{RED_VERSION} (Build 56000). Código Abierto.
      </footer>
    </div>
  );
}
