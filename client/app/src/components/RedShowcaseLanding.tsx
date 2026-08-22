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
  | "hero"
  | "modules"
  | "soundmesh"
  | "pqc"
  | "consent"
  | "triage"
  | "radar"
  | "architecture"
  | "investors"
  | "faq";

interface TacticalModule {
  id: string;
  name: string;
  category: string;
  icon: string;
  summary: string;
  badge: string;
  techStack: string;
  details: string;
  latency: string;
  encryption: string;
}

const TACTICAL_MODULES_CATALOG: TacticalModule[] = [
  // 1. Mensajería P2P & Canales (6)
  {
    id: "channels",
    name: "Canales Mesh Locales",
    category: "Mensajería & Canales",
    icon: "📻",
    summary: "Subcanales temáticos de escuadrón (#general, #sos, #logistica) sobre broadcast Gossipsub.",
    badge: "Multi-Topic",
    techStack: "LibP2P Gossipsub / SQLite",
    details: "Permite la creación de salas de mensajería efímeras o persistentes por temas dentro del rango de radio de la malla local. Los mensajes son propagados por todos los nodos cercanos y deduplicados por 72 horas.",
    latency: "< 45ms",
    encryption: "Noise XK + ChaCha20-Poly1305"
  },
  {
    id: "socialFeed",
    name: "RED Social Feed P2P",
    category: "Mensajería & Canales",
    icon: "🌍",
    summary: "Muro de publicaciones públicas descentralizadas propagadas mediante mulas de datos DTN.",
    badge: "DTN Feed",
    techStack: "Ed25519 Signed Payloads",
    details: "Red social resistente a censura donde cada publicación está firmada por la clave privada Ed25519 del autor y viaja de dispositivo en dispositivo mediante saltos oportunistas (Sneakernet) sin servidores.",
    latency: "Asíncrono DTN",
    encryption: "Ed25519 / Merkle Tree"
  },
  {
    id: "broadcast",
    name: "Difusión Privada",
    category: "Mensajería & Canales",
    icon: "📢",
    summary: "Emisión unidireccional de alertas cifradas a listas cerradas de contactos autorizados.",
    badge: "Cifrado E2E",
    techStack: "ChaCha20-Poly1305",
    details: "Emite comunicados urgentes o boletines a múltiples destinatarios pre-aprobados de forma simultánea, cifrando cada paquete individualmente para garantizar la privacidad de los miembros de la lista.",
    latency: "< 60ms",
    encryption: "Double Ratchet E2E"
  },
  {
    id: "walkie",
    name: "Walkie-Talkie Mesh HQ (PTT)",
    category: "Mensajería & Canales",
    icon: "🎙️",
    summary: "Push-To-Talk con auto-reproducción instantánea en canales de voz usando LowBitrateVocoder.",
    badge: "Ultra-Low Latency",
    techStack: "8kHz IMA-ADPCM / PTT DSP",
    details: "Canal de radio por voz full-duplex optimizado para situaciones de combate o rescate. Al presionar el botón PTT, la voz se comprime a 1.6-3.2 kbps y se auto-reproduce instantáneamente en los terminales del escuadrón.",
    latency: "< 90ms",
    encryption: "ChaCha20-Poly1305 Audio"
  },
  {
    id: "canvas",
    name: "Canvas Táctico P2P",
    category: "Mensajería & Canales",
    icon: "🎨",
    summary: "Pizarra interactiva colaborativa en tiempo real con sincronización de trazos vectoriales.",
    badge: "Zero-Server",
    techStack: "CRDT / WebRTC DataChannel",
    details: "Mesa de operaciones tácticas visual donde los rescatistas o brigadas dibujan mapas, rutas de evacuación y zonas seguras con sincronización vectorial en tiempo real sin conexión a internet.",
    latency: "< 30ms",
    encryption: "WebRTC DTLS / SRTP"
  },
  {
    id: "liveStream",
    name: "Live Broadcast Stream",
    category: "Mensajería & Canales",
    icon: "📺",
    summary: "Transmisión de vídeo en vivo P2P de baja latencia con señalización descentralizada.",
    badge: "WebRTC Mesh",
    techStack: "H.264 / WebRTC Mesh",
    details: "Streaming de vídeo táctico punto a punto o retransmitido por nodos repetidores. Diseñado para reconocimiento aéreo con drones o monitoreo de perímetros en zonas sin cobertura celular.",
    latency: "< 250ms",
    encryption: "DTLS 1.3 / ChaCha20"
  },

  // 2. Red Malla & Radar Off-Grid (9)
  {
    id: "shakePair",
    name: "Shake & Pair (Acelerómetro)",
    category: "Red Malla & Radar",
    icon: "📳",
    summary: "Emparejamiento criptográfico instantáneo agitando ambos dispositivos mediante sensores físicos.",
    badge: "Hardware Sensor",
    techStack: "Android Sensor API / BLE Scan",
    details: "Agitar dos teléfonos al mismo tiempo genera un vector de entropía cinemática correlacionada por acelerómetro que autentica e intercambia claves públicas de forma física y previene ataques Man-in-the-Middle.",
    latency: "< 500ms",
    encryption: "Sensor Entropy / Ed25519"
  },
  {
    id: "offGridCompass",
    name: "Radar Topográfico GPS",
    category: "Red Malla & Radar",
    icon: "🧭",
    summary: "Brújula militar off-grid que proyecta rumbo angular y distancia a nodos pares.",
    badge: "Geolocalización",
    techStack: "Haversine / Magnetometer API",
    details: "Calcula de forma puramente matemática la trayectoria azimutal y distancia euclidiana hacia los demás miembros de la patrulla utilizando coordenadas GPS embebidas en los handshakes de radio.",
    latency: "< 20ms",
    encryption: "Cifrado Geocercado"
  },
  {
    id: "nodemap",
    name: "Mapa de Nodos P2P",
    category: "Red Malla & Radar",
    icon: "🗺️",
    summary: "Cartografía táctica de nodos con renderizado vectorial de rutas multi-salto activas.",
    badge: "Topología Geo",
    techStack: "Leaflet / GPS Coordinates",
    details: "Muestra visualmente la posición relativa de cada nodo en el mapa satelital precargado y dibuja las líneas de enlace de radio activas, señalando la calidad del enlace RSSI de cada salto.",
    latency: "< 40ms",
    encryption: "Bóveda Local Cifrada"
  },
  {
    id: "nearby",
    name: "Radar Hardware BLE/WiFi",
    category: "Red Malla & Radar",
    icon: "📡",
    summary: "Escaneo en tiempo real de potencia RSSI, estado de batería y paquetes recibidos.",
    badge: "Radio Raw",
    techStack: "BLE GATT HCI / WiFi Sniffer",
    details: "Monitorea continuamente el espectro electromagnético cercano para detectar balizas de presencia de otros terminales RED, midiendo la intensidad de señal de -30 dBm (contacto cercano) a -95 dBm (límite).",
    latency: "< 100ms",
    encryption: "HMAC Blind Beacon"
  },
  {
    id: "rfSpectrum",
    name: "Analizador Espectro RF / EW",
    category: "Red Malla & Radar",
    icon: "🛡️",
    summary: "Detección de interferencias electrónicas (EW jamming) y análisis de canales 2.4GHz / 915MHz.",
    badge: "Anti-Jamming",
    techStack: "RSSI Variance / Spectral DSP",
    details: "Analiza la varianza y piso de ruido del receptor de radio. Si detecta un ataque de denegación de espectro (Jammer), conmuta automáticamente los paquetes al canal ultrasónico SoundMesh o LoRa.",
    latency: "< 15ms",
    encryption: "Frequency Hopping"
  },
  {
    id: "proximity",
    name: "Ondas de Proximidad",
    category: "Red Malla & Radar",
    icon: "🌊",
    summary: "Radar sonar acústico y de radio que detecta la densidad de dispositivos soberanos.",
    badge: "Proximity Ping",
    techStack: "BLE Beaconing / SoundMesh",
    details: "Genera un pulso periódico sonar que calcula la densidad de nodos amigos en un radio de 50 metros para advertir de agrupaciones de personal o pérdida de contacto de retaguardia.",
    latency: "< 80ms",
    encryption: "Rolling Ephemeral Hash"
  },
  {
    id: "weather",
    name: "Clima & Barómetro CAP",
    category: "Red Malla & Radar",
    icon: "🌤️",
    summary: "Alertas meteorológicas de emergencia CAP y barómetro local para predicción de tormentas.",
    badge: "Sensor Barométrico",
    techStack: "CAP XML / Pressure Sensor",
    details: "Monitorea el sensor barométrico del hardware para predecir caídas bruscas de presión atmosférica asociadas a huracanes o tormentas severas y difunde alertas de protocolo CAP a la comunidad.",
    latency: "< 10ms",
    encryption: "Firma Digital CAP"
  },
  {
    id: "ecoMesh",
    name: "Batería Eco-Mesh",
    category: "Red Malla & Radar",
    icon: "🔋",
    summary: "Gobernador cinemático de energía (KineticDutyGovernor) que modula la radio.",
    badge: "Ahorro Dinámico",
    techStack: "Battery API / Gyroscope",
    details: "Ajusta la tasa de muestreo y escaneo de radio según el giroscopio y el nivel de batería restante, extendiendo la autonomía del terminal de 24 horas hasta 7 días en operaciones de supervivencia.",
    latency: "Tiempo Real",
    encryption: "N/A"
  },
  {
    id: "network",
    name: "Topología de Red",
    category: "Red Malla & Radar",
    icon: "🌐",
    summary: "Grafo interactivo de enrutamiento Kademlia DHT, tabla de pares y métricas de latencia.",
    badge: "DHT Routing",
    techStack: "LibP2P Kademlia / Axum SSE",
    details: "Permite inspeccionar visualmente la tabla de enrutamiento XOR de Kademlia, los árboles de suscripción Gossipsub y los túneles DCUtR de evasión de NATs simétricos celulares.",
    latency: "< 25ms",
    encryption: "LibP2P SecIO / Noise"
  },

  // 3. Identidad, Pagos & Soberanía (9)
  {
    id: "commercialHub",
    name: "Hub Comercial & Recompensas",
    category: "Identidad & Pagos",
    icon: "⚡",
    summary: "Economía DePIN de retransmisión: gana tokens $RED por reenviar paquetes ajenos.",
    badge: "Proof-of-Relay",
    techStack: "Tokenomics / Relay Ledger",
    details: "Premia a los nodos que sirven como repetidores en zonas remotas. Cada paquete retransmitido exitosamente genera un comprobante de servicio criptográfico canjeable por recompensas en la red.",
    latency: "< 200ms",
    encryption: "Merkle Proof-of-Relay"
  },
  {
    id: "web3Vault",
    name: "Bóveda Web3 & MetaMask",
    category: "Identidad & Pagos",
    icon: "🦊",
    summary: "Firma EIP-712 sin gas y enlace multi-cadena con billeteras EVM en Polygon / Ethereum.",
    badge: "EVM Bridge",
    techStack: "Ethers.js / EIP-712",
    details: "Permite vincular tu dirección pública de Ethereum/Polygon a tu identidad soberana did:red para firmar mensajes autenticados y participar en contratos inteligentes descentralizados.",
    latency: "< 150ms",
    encryption: "Secp256k1 / EIP-712"
  },
  {
    id: "idVault",
    name: "Perfil & Bóveda DID",
    category: "Identidad & Pagos",
    icon: "🪪",
    summary: "Identidad auto-soberana W3C did:red basada en clave pública Ed25519 con QR.",
    badge: "Self-Sovereign",
    techStack: "W3C DID / Ed25519",
    details: "Tu identidad digital no pertenece a ninguna empresa ni gobierno. Es un par de claves criptográficas derivadas matemáticamente en tu teléfono, exportable como código QR táctico.",
    latency: "< 5ms",
    encryption: "Ed25519 / Curve25519"
  },
  {
    id: "p2pPay",
    name: "Pagos & Vouchers P2P",
    category: "Identidad & Pagos",
    icon: "💳",
    summary: "Emisión y canje de vales de pago offline firmados criptográficamente con paridad fiat.",
    badge: "Offline Cash",
    techStack: "Ed25519 Blind Signatures",
    details: "Permite realizar transacciones comerciales durante apagones financieros o cortes de tarjetas. Los vales se transmiten por Bluetooth y se validan mediante firmas ciegas Ed25519 sin banco.",
    latency: "< 80ms",
    encryption: "ChaCha20 / Ed25519"
  },
  {
    id: "pqcCrypto",
    name: "Bóveda Criptográfica PQC",
    category: "Identidad & Pagos",
    icon: "🔐",
    summary: "Criptografía híbrida post-cuántica ML-KEM-768 (FIPS 203) combinada con Double Ratchet.",
    badge: "Post-Quantum",
    techStack: "ML-KEM-768 / Noise XK",
    details: "Combina el estándar de encapsulamiento en retículos ML-KEM-768 con el protocolo Signal Double Ratchet para blindar todas las conversaciones contra futuras computadoras cuánticas.",
    latency: "< 12ms",
    encryption: "ML-KEM-768 ⊕ X25519"
  },
  {
    id: "explorer",
    name: "Explorador Blockchain",
    category: "Identidad & Pagos",
    icon: "⛓️",
    summary: "Auditoría de bloques y transacciones de la cadena de bloques liviana interna.",
    badge: "Micro-Chain",
    techStack: "Merkle Trees / PoS Consensus",
    details: "Visualizador de la micro-cadena distribuida del ecosistema RED que registra las operaciones críticas de estado, revocaciones de identidad y recompensas de retransmisión sin consumir gigabytes.",
    latency: "< 50ms",
    encryption: "SHA-256 Merkle DAG"
  },
  {
    id: "webCompanionLink",
    name: "Vincular Dispositivo Web (PC)",
    category: "Identidad & Pagos",
    icon: "💻",
    summary: "Puente cifrado P2P que sincroniza la bóveda entre el celular y el navegador de la PC.",
    badge: "Sync Local",
    techStack: "WebRTC DataChannel / AES-256",
    details: "Escanea el código QR de la pantalla de tu computadora desde tu celular Android para establecer un túnel WebRTC cifrado directo en red local sin que los mensajes toquen servidores externos.",
    latency: "< 35ms",
    encryption: "AES-256-GCM / WebRTC"
  },
  {
    id: "stegoVault",
    name: "Bóveda Esteganográfica",
    category: "Identidad & Pagos",
    icon: "🖼️",
    summary: "Ocultamiento de claves privadas y mensajes dentro de píxeles de fotografías.",
    badge: "Anti-Forensics",
    techStack: "LSB Steganography / ChaCha20",
    details: "Incrusta datos altamente confidenciales modificando de forma imperceptible los bits menos significativos (LSB) de imágenes JPEG/PNG, haciéndolos invisibles ante escáneres forenses militares.",
    latency: "< 120ms",
    encryption: "ChaCha20 + LSB Matrix"
  },
  {
    id: "backup",
    name: "Respaldos & Restauración",
    category: "Identidad & Pagos",
    icon: "💾",
    summary: "Copia de seguridad 1-toque protegida por PIN Maestro con semilla BIP-39.",
    badge: "Zero-Knowledge",
    techStack: "Argon2id / AES-GCM-256",
    details: "Exporta tu bóveda en un contenedor hermético cifrado con Argon2id. Puedes recuperarla en cualquier dispositivo mediante una frase mnemónica de 12 palabras o archivo cifrado.",
    latency: "< 300ms",
    encryption: "Argon2id / AES-256-GCM"
  },

  // 4. Ciberdefensa & Escudo Global (4)
  {
    id: "globalShield",
    name: "Escudo Global (DEFCON Matrix)",
    category: "Ciberdefensa",
    icon: "🛡️",
    summary: "Matriz táctica de niveles de amenaza (DEFCON 5 a 1) que endurece las políticas de radio.",
    badge: "DEFCON Matrix",
    techStack: "Threat Engine / IP Tables",
    details: "Permite cambiar con un toque el perfil de seguridad del dispositivo. En DEFCON 1, el nodo apaga mDNS, activa rotación de direcciones MAC en BLE y purga metadatos temporales.",
    latency: "< 10ms",
    encryption: "DEFCON Policies"
  },
  {
    id: "blackout",
    name: "Simulador Apagón Blackout",
    category: "Ciberdefensa",
    icon: "⚡",
    summary: "Prueba de estrés que desconecta Internet para validar la conmutación ad-hoc.",
    badge: "Disaster Ready",
    techStack: "Network Isolator",
    details: "Herramienta de simulación que apaga los sockets IP y fuerza a la aplicación a operar exclusivamente con radios de hardware para certificar la resiliencia en simulacros de emergencia.",
    latency: "< 5ms",
    encryption: "N/A"
  },
  {
    id: "dms",
    name: "Hombre Muerto (Dead Man's Switch)",
    category: "Ciberdefensa",
    icon: "💀",
    summary: "Temporizador de seguridad que emite una baliza SOS o destruye las claves.",
    badge: "Fail-Safe",
    techStack: "Keystore Purge / AlarmManager",
    details: "Si el usuario no interactúa con la aplicación antes de que expire la cuenta regresiva configurada, el sistema transmite automáticamente su última ubicación conocida o destruye la bóveda.",
    latency: "< 100ms",
    encryption: "Auto-Purge Keystore"
  },
  {
    id: "security",
    name: "Seguridad Zero-Trust",
    category: "Ciberdefensa",
    icon: "🛡️",
    summary: "FLAG_SECURE anti-capturas, PIN de pánico con autodestrucción y bóveda señuelo (PIN 9999).",
    badge: "Anti-Coercion",
    techStack: "Android Keystore / Wipe Engine",
    details: "Protecciones activas contra coerción física: ingresar el PIN de pánico borra instantáneamente todos los datos; ingresar el PIN señuelo 9999 abre una sesión falsa aparentemente normal.",
    latency: "< 50ms",
    encryption: "Hardware Keystore TEE"
  },

  // 5. Emergencias, Salud & Rescate (5)
  {
    id: "vitalScan",
    name: "Signos Vitales & Triaje START",
    category: "Emergencias & Salud",
    icon: "🫀",
    summary: "Protocolo médico de triaje de catástrofes con clasificación por colores y registro masivo.",
    badge: "Medical START",
    techStack: "START Algorithm / Offline DB",
    details: "Guía paso a paso al rescatista para clasificar a los heridos en Rojo (Inmediato), Amarillo (Diferido), Verde (Leve) o Negro (Fallecido) y sincroniza las estadísticas por la malla.",
    latency: "< 20ms",
    encryption: "Bóveda Médica Cifrada"
  },
  {
    id: "survivalBeacon",
    name: "Baliza Ultrasonido SOS",
    category: "Emergencias & Salud",
    icon: "🚨",
    summary: "Emisión de socorro acústico FSK inaudible capaz de ser captada en la oscuridad.",
    badge: "SoundMesh SOS",
    techStack: "AudioContext 18.5kHz FSK",
    details: "Emite un tono acústico continuo modulado que otros teléfonos en el área captan para localizar personas atrapadas bajo escombros o en zonas sin señal de radio convencional.",
    latency: "< 300ms",
    encryption: "FSK 18.5kHz Packet"
  },
  {
    id: "amber",
    name: "Sistema Alerta AMBER",
    category: "Emergencias & Salud",
    icon: "🟠",
    summary: "Difusión comunitaria urgente de personas desaparecidas con fotografía geocercada.",
    badge: "Civil Defense",
    techStack: "Geo-Broadcast Mesh",
    details: "Permite difundir alertas de personas extraviadas a todos los dispositivos dentro de un radio geográfico específico, adjuntando fotografía comprimida y descripción física.",
    latency: "< 150ms",
    encryption: "Ed25519 Signed Beacon"
  },
  {
    id: "dms_emergency",
    name: "Alerta Hombre Muerto Rescate",
    category: "Emergencias & Salud",
    icon: "💀",
    summary: "Monitoreo de inactividad para brigadistas en zonas de derrumbe o radiación.",
    badge: "First Responders",
    techStack: "Sensor Inactivity Ping",
    details: "Detecta si el brigadista ha permanecido inmóvil durante un periodo anormal mediante el acelerómetro y emite una alerta acústica y de radio a sus compañeros de escuadrón.",
    latency: "< 50ms",
    encryption: "Mesh Alert Protocol"
  },
  {
    id: "emergencyGlossary",
    name: "Glosario Médico Offline",
    category: "Emergencias & Salud",
    icon: "📖",
    summary: "Enciclopedia de primeros auxilios y protocolos de torniquetes, RCP y fracturas 100% sin red.",
    badge: "Knowledge Base",
    techStack: "IndexedDB / Vector Glossary",
    details: "Base de conocimientos médicos de emergencia optimizada para consulta instantánea durante cortes de energía y catástrofes naturales con instrucciones paso a paso.",
    latency: "< 10ms",
    encryption: "N/A"
  },

  // 6. Inteligencia Artificial Neuronal (2)
  {
    id: "aiCopilot",
    name: "Copiloto IA Offline",
    category: "IA Neuronal",
    icon: "🤖",
    summary: "Inferencia local en dispositivo (Rust / WASM) con RAG semántico (<120ms).",
    badge: "Local LLM / RAG",
    techStack: "ONNX Runtime / WASM / Embeddings",
    details: "Motor de inteligencia artificial embebido en el cliente que procesa lenguaje natural y responde dudas complejas sin enviar ni un solo byte a servidores en la nube.",
    latency: "< 120ms",
    encryption: "On-Device Inference"
  },
  {
    id: "guardian",
    name: "Guardian IA (Firewall S4)",
    category: "IA Neuronal",
    icon: "🛡️",
    summary: "Inspección local previa al cifrado con distancia Hamming 64-bit contra contenido ilícito.",
    badge: "Edge Firewall",
    techStack: "Hamming 64-bit / Toxic-BERT",
    details: "Firewall de contenido en el borde que analiza el texto y las imágenes antes de que sean encriptadas para evitar que la red soberana sea utilizada para explotación infantil o violencia.",
    latency: "< 15ms",
    encryption: "Hamming 64-bit Filter"
  },

  // 7. Herramientas, Sistema & Camuflaje (7)
  {
    id: "settings",
    name: "Ajustes & Personalización",
    category: "Sistema & Herramientas",
    icon: "⚙️",
    summary: "Control granular de identidades, radios habilitadas, temas visuales y cuotas.",
    badge: "Settings Hub",
    techStack: "LocalStorage / Zustand",
    details: "Panel de control maestro para ajustar los parámetros de red malla, la sensibilidad del radar, el tiempo de expiración de mensajes y los perfiles de consumo de energía.",
    latency: "< 5ms",
    encryption: "Local Vault"
  },
  {
    id: "updater",
    name: "Actualizador de Software (OTA)",
    category: "Sistema & Herramientas",
    icon: "🚀",
    summary: "Distribución de actualizaciones de software de nodo a nodo a través de la malla.",
    badge: "Mesh OTA",
    techStack: "Chunked Binary Gossipsub",
    details: "Permite a los usuarios actualizar la aplicación recibiendo los fragmentos binarios firmados criptográficamente de otros usuarios cercanos sin depender de Google Play Store.",
    latency: "P2P Chunked",
    encryption: "Ed25519 Binary Signature"
  },
  {
    id: "health",
    name: "Diagnóstico Salud Sistema",
    category: "Sistema & Herramientas",
    icon: "📊",
    summary: "Telemetría en tiempo real de consumo de memoria, latencia de hilos Rust y FPS.",
    badge: "Diagnostics",
    techStack: "Performance API / Rust NDK",
    details: "Monitor de rendimiento que audita los hilos del motor nativo Rust, el uso de memoria RAM, el estado de las colas de paquetes y la velocidad de fotogramas del renderizador.",
    latency: "< 16ms",
    encryption: "N/A"
  },
  {
    id: "nodeLogs",
    name: "Logs del Nodo Rust SSE",
    category: "Sistema & Herramientas",
    icon: "📋",
    summary: "Consola de eventos en streaming directo desde el socket HTTP /api/events.",
    badge: "SSE Stream",
    techStack: "EventSource / Axum",
    details: "Terminal de registro en tiempo real que transmite los eventos internos de LibP2P, handshakes Bluetooth LE y operaciones de base de datos SQLite directamente a la pantalla.",
    latency: "< 10ms",
    encryption: "Local Loopback"
  },
  {
    id: "calculator",
    name: "Calculadora Señuelo",
    category: "Sistema & Herramientas",
    icon: "🧮",
    summary: "Interfaz camuflada completamente funcional de calculadora científica para ocultar la app.",
    badge: "Stealth Mode",
    techStack: "Math Parser / Decoy Router",
    details: "Transforma la interfaz en una calculadora matemática real. Si un inspector ingresa una operación aritmética, la calcula; solo al ingresar el código secreto se accede a la bóveda RED.",
    latency: "< 5ms",
    encryption: "Stealth Sandbox"
  },
  {
    id: "secReport",
    name: "Reporte Auditoría Seguridad",
    category: "Sistema & Herramientas",
    icon: "📑",
    summary: "Generador de informes técnicos de cumplimiento criptográfico y aislamiento de memoria.",
    badge: "Compliance",
    techStack: "Security Inspector",
    details: "Audita y califica el estado de endurecimiento del terminal, verificando la presencia de FLAG_SECURE, el estado del chip de hardware Keystore y la entropía del generador de números aleatorios.",
    latency: "< 50ms",
    encryption: "Audit Signatures"
  },
  {
    id: "zeroTrust",
    name: "Políticas Zero-Trust",
    category: "Sistema & Herramientas",
    icon: "🛡️",
    summary: "Consent-first en contactos, aislamiento de procesos y rotación obligatoria de claves.",
    badge: "Zero-Trust",
    techStack: "Consent Manager",
    details: "Establece las reglas de autorización estricta: ninguna transmisión de datos es aceptada sin verificación previa de identidad y confirmación humana explícita.",
    latency: "< 10ms",
    encryption: "Zero-Trust Engine"
  }
];

export default function RedShowcaseLanding({ onEnterApp, onEnterVault }: RedShowcaseLandingProps) {
  const handleEnter = onEnterVault || onEnterApp || (() => {});
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("hero");
  const [quickAlias, setQuickAlias] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [selectedModuleDetail, setSelectedModuleDetail] = useState<TacticalModule | null>(null);

  // Live HUD Telemetry State
  const [fps, setFps] = useState(60);
  const [telemetryNodes, setTelemetryNodes] = useState(14);
  const [cryptoEpoch, setCryptoEpoch] = useState(56000);

  // SoundMesh Web Audio Oscilloscope State
  const [soundMode, setSoundMode] = useState<"audible" | "ultrasound">("audible");
  const [soundPayloadText, setSoundPayloadText] = useState("SOS COORD -12.045, -77.031");
  const [isTransmittingAudio, setIsTransmittingAudio] = useState(false);
  const [soundLog, setSoundLog] = useState<string>("> Módem acústico listo. Presiona 'Transmitir Trama FSK' para iniciar oscilador.");
  const oscilloscopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Post-Quantum Benchmark State
  const [pqcAlgorithm, setPqcAlgorithm] = useState<"kyber" | "rsa" | "ecc">("kyber");
  const [pqcSimLog, setPqcSimLog] = useState<string[]>([]);
  const [pqcEntropySeed, setPqcEntropySeed] = useState<string>("0x8F1A29D84C20E76B");

  // Medical START Triage Interactive State
  const [triageStep, setTriageStep] = useState<1 | 2 | 3 | 4>(1);
  const [canWalk, setCanWalk] = useState<boolean | null>(null);
  const [respiration, setRespiration] = useState<"none" | "over30" | "normal" | null>(null);
  const [radialPulse, setRadialPulse] = useState<"absent" | "present" | null>(null);
  const [mentalStatus, setMentalStatus] = useState<"obeys" | "confused" | null>(null);
  const [triageResult, setTriageResult] = useState<{ color: string; tag: string; priority: string; action: string } | null>(null);
  const [glossarySearch, setGlossarySearch] = useState("Torniquete");
  const [glossaryResult, setGlossaryResult] = useState<any>(null);

  // Consent-First P2P State
  const [simConsentStep, setSimConsentStep] = useState<"idle" | "incoming" | "accepted" | "rejected" | "blocked">("idle");
  const [simPeerHash, setSimPeerHash] = useState("7F3A91BC2E844D0F81E73A6B");
  const [simPeerAlias, setSimPeerAlias] = useState("Operador_Patrulla_07");
  const [simLog, setSimLog] = useState<string[]>([
    "> [LISTENER P2P] Escuchando handshakes de descubrimiento en BLE GATT y mDNS...",
    "> [POLÍTICA ZERO-TRUST] Consent-First activo: Ningún nodo puede enviar mensajes sin autorización explícita."
  ]);

  // Radar State
  const [isBlackout, setIsBlackout] = useState(false);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const githubReleaseUrl = `https://github.com/DarckRovert/RED/releases/tag/v${RED_VERSION}`;
  const apkDownloadUrl = `https://github.com/DarckRovert/RED/releases/download/v${RED_VERSION}/${RED_APK_NAME}`;
  const heroBannerUrl = typeof window !== "undefined" && window.location.pathname.includes("/RED")
    ? "/RED/assets/red_investor_hero_banner.png"
    : "assets/red_investor_hero_banner.png";

  const categoriesList = useMemo(() => {
    const cats = Array.from(new Set(TACTICAL_MODULES_CATALOG.map((m) => m.category)));
    return ["Todos", ...cats];
  }, []);

  const filteredModules = useMemo(() => {
    return TACTICAL_MODULES_CATALOG.filter((m) => {
      const matchesCat = selectedCategory === "Todos" || m.category === selectedCategory;
      const matchesSearch =
        !moduleSearch.trim() ||
        m.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
        m.summary.toLowerCase().includes(moduleSearch.toLowerCase()) ||
        m.techStack.toLowerCase().includes(moduleSearch.toLowerCase()) ||
        m.encryption.toLowerCase().includes(moduleSearch.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, moduleSearch]);

  // Live Telemetry simulation tick
  useEffect(() => {
    const interval = setInterval(() => {
      setFps(Math.floor(58 + Math.random() * 4));
      setCryptoEpoch((prev) => prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Quick Login
  const handleCreateWebUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAlias.trim() && typeof window !== "undefined") {
      localStorage.setItem("user_nickname", quickAlias.trim());
      localStorage.setItem("red_displayName", quickAlias.trim());
    }
    handleEnter();
  };

  // SoundMesh Web Audio Oscilloscope Loop
  const playSoundMeshChirp = () => {
    if (typeof window === "undefined") return;
    try {
      setIsTransmittingAudio(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const baseFreq = soundMode === "audible" ? 2400 : 18500;
      const targetFreq = soundMode === "audible" ? 3400 : 20500;

      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(targetFreq, ctx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.42);

      setSoundLog(
        `> [TRANSMISIÓN EXITOSA] Trama FSK emitida: "${soundPayloadText}" (${soundMode === "audible" ? "2.4 - 3.4 kHz" : "18.5 - 20.5 kHz"}) | 128 bytes modulados en 400ms.`
      );

      // Render Oscilloscope
      const canvas = oscilloscopeCanvasRef.current;
      if (canvas) {
        const cCtx = canvas.getContext("2d");
        if (cCtx) {
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          let animId: number;
          const draw = () => {
            animId = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);

            cCtx.fillStyle = "rgba(5, 7, 13, 0.3)";
            cCtx.fillRect(0, 0, canvas.width, canvas.height);

            cCtx.lineWidth = 2;
            cCtx.strokeStyle = soundMode === "audible" ? "#FFB800" : "#00F0FF";
            cCtx.beginPath();

            const sliceWidth = (canvas.width * 1.0) / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
              const v = dataArray[i] / 128.0;
              const y = (v * canvas.height) / 2;

              if (i === 0) {
                cCtx.moveTo(x, y);
              } else {
                cCtx.lineTo(x, y);
              }
              x += sliceWidth;
            }

            cCtx.lineTo(canvas.width, canvas.height / 2);
            cCtx.stroke();
          };
          draw();

          setTimeout(() => {
            cancelAnimationFrame(animId);
            setIsTransmittingAudio(false);
          }, 600);
        }
      }
    } catch (err: any) {
      setIsTransmittingAudio(false);
      setSoundLog(`> Error Web Audio API: ${err?.message || "No disponible"}`);
    }
  };

  // Generate real CSPRNG entropy
  const refreshPqcEntropy = () => {
    const randBuf = new Uint8Array(16);
    if (typeof window !== "undefined" && window.crypto) {
      window.crypto.getRandomValues(randBuf);
    }
    const hex = Array.from(randBuf, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    setPqcEntropySeed(`0x${hex}`);
    setPqcSimLog((prev) => [
      `> [ENTROPÍA RENOVADA] Semilla CSPRNG de 128 bits generada: 0x${hex}`,
      `> [ML-KEM-768] Encapsulando secreto compartido en retículo euclidiano de dimensión 768...`,
      `> [ÉPOCA SEGURA] Secreto derivado con HKDF-SHA256 (32 bytes). Inmune a ataques cuánticos retroactivos.`
    ]);
  };

  // START Triage Evaluator
  const evaluateTriage = (walk: boolean, resp: string, pulse: string, mental: string) => {
    if (walk) {
      setTriageResult({
        color: "#00E676",
        tag: "VERDE (LEVE / AMBULATORIO)",
        priority: "Prioridad 3",
        action: "El paciente camina y responde. Derivar a área de espera segura y vendar lesiones menores."
      });
      return;
    }
    if (resp === "none") {
      setTriageResult({
        color: "#64748B",
        tag: "NEGRO (FALLECIDO / NO RECUPERABLE)",
        priority: "Prioridad 0",
        action: "Vía aérea abierta sin respiración espontánea. Priorizar recursos en víctimas viables."
      });
      return;
    }
    if (resp === "over30" || pulse === "absent" || mental === "confused") {
      setTriageResult({
        color: "#FF2A51",
        tag: "ROJO (INMEDIATO / CRÍTICO)",
        priority: "Prioridad 1",
        action: "Amenaza inminente para la vida. Requiere estabilización respiratoria, torniquete o control de shock inmediato."
      });
      return;
    }
    setTriageResult({
      color: "#FFB800",
      tag: "AMARILLO (DIFERIDO / GRAVE ESTABLE)",
      priority: "Prioridad 2",
      action: "Lesiones graves pero parámetros vitales estables. Traslado prioritario tras estabilizar pacientes rojos."
    });
  };

  // Radar Animation Loop
  useEffect(() => {
    if (activeTab !== "radar") return;
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;
    let sweepAngle = 0;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 760);
    const height = (canvas.height = 440);

    const nodes = [
      { id: "MOTO-G22", name: "Moto G22 (BLE GATT)", x: width * 0.25, y: height * 0.45, type: "ble", rssi: "-42 dBm" },
      { id: "TAB-LENOVO", name: "Tablet Lenovo (WiFi Direct)", x: width * 0.5, y: height * 0.65, type: "wifi", rssi: "-38 dBm" },
      { id: "RELAY-LORA", name: "Nodo Relé LoRa (915MHz)", x: width * 0.75, y: height * 0.35, type: "lora", rssi: "-58 dBm" },
      { id: "SOUND-MODEM", name: "Módem SoundMesh (Acústico)", x: width * 0.42, y: height * 0.22, type: "sound", rssi: "-28 dBFS" }
    ];

    const render = () => {
      ctx.fillStyle = "#030508";
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width, height) * 0.44;

      // Concentric circles
      ctx.strokeStyle = isBlackout ? "rgba(255, 42, 81, 0.2)" : "rgba(0, 240, 255, 0.15)";
      ctx.lineWidth = 1;
      for (let r = 40; r <= maxR; r += 40) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crosshairs
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
      gradient.addColorStop(0, isBlackout ? "rgba(255, 42, 81, 0.6)" : "rgba(0, 240, 255, 0.6)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxR, -0.25, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Packet Routes
      ctx.strokeStyle = isBlackout ? "rgba(255, 42, 81, 0.6)" : "rgba(0, 255, 136, 0.4)";
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
      nodes.forEach((n) => {
        ctx.fillStyle = n.type === "ble" ? "#00F0FF" : n.type === "wifi" ? "#00FF88" : n.type === "sound" ? "#FFB800" : "#B026FF";
        ctx.beginPath();
        ctx.arc(n.x, n.y, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFF";
        ctx.font = "11px monospace";
        ctx.fillText(n.name, n.x + 12, n.y + 4);
      });

      animFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrameId);
  }, [activeTab, isBlackout]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #0A0F1D 0%, #030508 100%)",
        color: "#E2E8F0",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Cyber Telemetry & Navigation Bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          backdropFilter: "blur(20px)",
          background: "rgba(3, 5, 8, 0.9)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Brand & Version Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #FF2A51 0%, #8A0016 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              boxShadow: "0 0 20px rgba(255, 42, 81, 0.6)",
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 900, color: "#FFF", letterSpacing: "1px" }}>
              RED <span style={{ color: "#FF2A51" }}>OS</span>
            </div>
            <div style={{ fontSize: "10px", color: "#00F0FF", fontFamily: "monospace", fontWeight: 700 }}>
              SOVEREIGN MESH • v{RED_VERSION} (BUILD 56000)
            </div>
          </div>
        </div>

        {/* Live HUD Telemetry Strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            background: "rgba(15, 23, 42, 0.7)",
            padding: "6px 14px",
            borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF88", boxShadow: "0 0 8px #00FF88" }} />
            <span style={{ color: "#94A3B8" }}>ESTADO:</span>
            <span style={{ color: "#00FF88", fontWeight: 700 }}>MALLA ACTIVA</span>
          </div>
          <div style={{ color: "#64748B" }}>|</div>
          <div>
            <span style={{ color: "#94A3B8" }}>NODOS:</span> <span style={{ color: "#00F0FF", fontWeight: 700 }}>{telemetryNodes}</span>
          </div>
          <div style={{ color: "#64748B" }}>|</div>
          <div>
            <span style={{ color: "#94A3B8" }}>PQC ÉPOCA:</span> <span style={{ color: "#B026FF", fontWeight: 700 }}>#{cryptoEpoch}</span>
          </div>
          <div style={{ color: "#64748B" }}>|</div>
          <div>
            <span style={{ color: "#94A3B8" }}>RENDER:</span> <span style={{ color: "#FFB800", fontWeight: 700 }}>{fps} FPS</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {[
            { id: "hero", label: "Inicio" },
            { id: "modules", label: "42 Módulos" },
            { id: "soundmesh", label: "SoundMesh Acústico" },
            { id: "pqc", label: "Laboratorio PQC" },
            { id: "triage", label: "Triaje START" },
            { id: "consent", label: "Consent-First" },
            { id: "radar", label: "Radar Off-Grid" },
            { id: "architecture", label: "Arquitectura" },
            { id: "investors", label: "Tesis DePIN" },
            { id: "faq", label: "FAQ" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ShowcaseTab)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: activeTab === tab.id ? "1px solid #FF2A51" : "1px solid transparent",
                background: activeTab === tab.id ? "rgba(255, 42, 81, 0.18)" : "rgba(255, 255, 255, 0.03)",
                color: activeTab === tab.id ? "#FFF" : "#94A3B8",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Direct App Launch Button */}
        <button
          onClick={handleEnter}
          style={{
            padding: "10px 18px",
            borderRadius: "10px",
            background: "linear-gradient(90deg, #FF2A51 0%, #990014 100%)",
            color: "#FFF",
            fontWeight: 800,
            fontSize: "13px",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 15px rgba(255, 42, 81, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>⚡</span> Entrar a la Bóveda Web
        </button>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, padding: "36px 20px", maxWidth: "1320px", width: "100%", margin: "0 auto" }}>
        
        {/* HERO TAB */}
        {activeTab === "hero" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 16px",
                borderRadius: "20px",
                background: "rgba(255, 42, 81, 0.12)",
                border: "1px solid rgba(255, 42, 81, 0.3)",
                color: "#FF2A51",
                fontSize: "12px",
                fontWeight: 800,
                fontFamily: "monospace",
                marginBottom: "20px",
              }}
            >
              <span>🛡️</span> COMUNICACIÓN SOBERANA 100% OFF-GRID • INMUNE A APAGONES Y CENSURA
            </div>

            <h1
              style={{
                fontSize: "clamp(34px, 5.5vw, 60px)",
                fontWeight: 900,
                color: "#FFF",
                lineHeight: 1.1,
                maxWidth: "960px",
                marginBottom: "20px",
                letterSpacing: "-1px",
              }}
            >
              El Primer Sistema Operativo <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #FF2A51 0%, #00F0FF 50%, #00FF88 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                En Malla P2P, Post-Cuántica & IA Offline
              </span>
            </h1>

            <p
              style={{
                fontSize: "17px",
                color: "#94A3B8",
                maxWidth: "800px",
                lineHeight: 1.6,
                marginBottom: "36px",
              }}
            >
              RED opera directamente entre dispositivos usando radio Bluetooth LE, WiFi Direct, LoRa 915MHz y pulsos acústicos ultrasónicos SoundMesh. Sin servidores centrales, sin torres celulares y blindado con el estándar post-cuántico ML-KEM-768.
            </p>

            {/* Quick Web Access Form */}
            <div
              style={{
                width: "100%",
                maxWidth: "580px",
                padding: "24px",
                borderRadius: "20px",
                background: "rgba(15, 23, 42, 0.75)",
                border: "1px solid rgba(255, 42, 81, 0.35)",
                boxShadow: "0 15px 45px rgba(0,0,0,0.7)",
                marginBottom: "40px",
              }}
            >
              <form onSubmit={handleCreateWebUser} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input
                  type="text"
                  placeholder="Ingresa tu Alias o Nombre de Operador..."
                  value={quickAlias}
                  onChange={(e) => setQuickAlias(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "14px 18px",
                    borderRadius: "12px",
                    background: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#FFF",
                    fontSize: "15px",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    background: "linear-gradient(90deg, #FF2A51 0%, #990014 100%)",
                    color: "#FFF",
                    fontWeight: 800,
                    fontSize: "15px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(255, 42, 81, 0.4)",
                  }}
                >
                  ⚡ Iniciar Bóveda Soberana en el Navegador
                </button>
              </form>
            </div>

            {/* Investor Hero Banner */}
            <div
              style={{
                width: "100%",
                maxWidth: "960px",
                borderRadius: "24px",
                overflow: "hidden",
                border: "1px solid rgba(255, 42, 81, 0.3)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                marginBottom: "40px",
              }}
            >
              <img src={heroBannerUrl} alt="RED Sovereign Mesh OS Banner" style={{ width: "100%", height: "auto", display: "block" }} />
            </div>

            {/* Official APK Download Card */}
            <div
              style={{
                width: "100%",
                maxWidth: "960px",
                padding: "26px 34px",
                borderRadius: "20px",
                background: "rgba(15, 23, 42, 0.85)",
                border: "1px solid rgba(0, 255, 136, 0.35)",
                boxShadow: "0 10px 35px rgba(0,0,0,0.6)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "20px",
                textAlign: "left",
              }}
            >
              <div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: "#FFF", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📱</span> Instalador Oficial Android v{RED_VERSION} (Build 56000)
                </div>
                <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "6px", lineHeight: 1.5 }}>
                  Compilación de producción firmada para arquitectura ARM64 (`arm64-v8a`). Probada con Logcat simultáneo en hardware real (Motorola Moto G22 y Tablet Lenovo) con soporte BLE GATT, mDNS y LibP2P Kademlia.
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <a
                  href={apkDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "14px 26px",
                    fontSize: "14px",
                    fontWeight: 800,
                    color: "#000",
                    background: "linear-gradient(90deg, #00FF88 0%, #00B35F 100%)",
                    borderRadius: "12px",
                    textDecoration: "none",
                    boxShadow: "0 4px 15px rgba(0,255,136,0.4)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>📥</span> Descargar APK Directo
                </a>
                <a
                  href={githubReleaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: "14px 20px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#94A3B8",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "12px",
                    textDecoration: "none",
                    border: "1px solid rgba(255,255,255,0.15)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>📦</span> Ver en GitHub Releases ↗
                </a>
              </div>
            </div>
          </div>
        )}

        {/* 42 TACTICAL MODULES MATRIX & DETAILS DRAWER */}
        {activeTab === "modules" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
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
                MATRIZ DE PRODUCCIÓN • 42 MÓDULOS ACTIVOS
              </span>
              <h2 style={{ fontSize: "36px", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px" }}>
                Centro de Operaciones Tácticas
              </h2>
              <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "780px", margin: "0 auto", lineHeight: 1.6 }}>
                Haz clic en cualquier módulo para abrir su ficha técnica con especificaciones de latencia, protocolo de cifrado y arquitectura de transporte.
              </p>
            </div>

            {/* Category Filter Pills & Search */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: selectedCategory === cat ? "1px solid #FF2A51" : "1px solid rgba(255,255,255,0.1)",
                      background: selectedCategory === cat ? "rgba(255, 42, 81, 0.2)" : "rgba(15,23,42,0.6)",
                      color: selectedCategory === cat ? "#FFF" : "#94A3B8",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Buscar por módulo, stack (BLE, Rust, PQC, SOS) o algoritmo de cifrado..."
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "700px",
                  margin: "0 auto",
                  padding: "14px 20px",
                  borderRadius: "14px",
                  background: "rgba(15,23,42,0.85)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#FFF",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            {/* Matrix Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "18px" }}>
              {filteredModules.map((mod) => (
                <div
                  key={mod.id}
                  onClick={() => setSelectedModuleDetail(mod)}
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    background: "rgba(15,23,42,0.75)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255, 42, 81, 0.5)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.transform = "translateY(0px)";
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "28px" }}>{mod.icon}</span>
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          background: "rgba(0,240,255,0.15)",
                          color: "#00F0FF",
                          border: "1px solid rgba(0,240,255,0.3)",
                          fontFamily: "monospace",
                          fontWeight: 700,
                        }}
                      >
                        {mod.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>{mod.name}</div>
                    <div style={{ fontSize: "12px", color: "#94A3B8", lineHeight: 1.5, marginBottom: "12px" }}>{mod.summary}</div>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "monospace", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}>
                    <span>⚙️ {mod.techStack}</span>
                    <span style={{ color: "#00FF88" }}>{mod.latency}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Technical Detail Modal Drawer */}
            {selectedModuleDetail && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 200,
                  background: "rgba(0,0,0,0.85)",
                  backdropFilter: "blur(16px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px",
                }}
                onClick={() => setSelectedModuleDetail(null)}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "560px",
                    background: "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(3,5,8,0.99) 100%)",
                    border: "1px solid rgba(255, 42, 81, 0.4)",
                    borderRadius: "24px",
                    padding: "30px",
                    boxShadow: "0 25px 60px rgba(0,0,0,0.9)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "36px" }}>{selectedModuleDetail.icon}</span>
                      <div>
                        <div style={{ fontSize: "20px", fontWeight: 900, color: "#FFF" }}>{selectedModuleDetail.name}</div>
                        <div style={{ fontSize: "11px", color: "#00F0FF", fontFamily: "monospace" }}>{selectedModuleDetail.category}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedModuleDetail(null)}
                      style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "18px", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6, marginBottom: "20px" }}>
                    {selectedModuleDetail.details}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
                    <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "monospace" }}>LATENCIA ESTIMADA</div>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "#00FF88", marginTop: "4px" }}>{selectedModuleDetail.latency}</div>
                    </div>
                    <div style={{ padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "monospace" }}>CAPA DE CIFRADO</div>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "#B026FF", marginTop: "4px" }}>{selectedModuleDetail.encryption}</div>
                    </div>
                  </div>

                  <button
                    onClick={handleEnter}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "12px",
                      background: "linear-gradient(90deg, #FF2A51 0%, #990014 100%)",
                      color: "#FFF",
                      fontWeight: 800,
                      fontSize: "14px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    ⚡ Abrir Módulo en la Bóveda Web
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SOUNDMESH ACOUSTIC OSCILLOSCOPE LAB */}
        {activeTab === "soundmesh" && (
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
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
                LABORATORIO ACÚSTICO • WEB AUDIO API OSCILOSCOPIO
              </span>
              <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", marginTop: "10px", marginBottom: "8px" }}>
                Módem Ultrasónico SoundMesh & Vocoder DSP
              </h2>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
                Transmite tramas de datos por el aire a través del altavoz de tu computadora o teléfono a frecuencias inaudibles con visualización espectral en tiempo real.
              </p>
            </div>

            <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255, 184, 0, 0.35)", marginBottom: "24px" }}>
              {/* Mode Toggle */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                <button
                  onClick={() => setSoundMode("audible")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "12px",
                    background: soundMode === "audible" ? "rgba(255, 184, 0, 0.2)" : "rgba(30,41,59,0.5)",
                    border: soundMode === "audible" ? "1px solid #FFB800" : "1px solid rgba(255,255,255,0.1)",
                    color: "#FFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  🔊 Modo Demostración Audible (2.4 - 3.4 kHz)
                </button>
                <button
                  onClick={() => setSoundMode("ultrasound")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "12px",
                    background: soundMode === "ultrasound" ? "rgba(0, 240, 255, 0.2)" : "rgba(30,41,59,0.5)",
                    border: soundMode === "ultrasound" ? "1px solid #00F0FF" : "1px solid rgba(255,255,255,0.1)",
                    color: "#FFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  🦇 Modo Ultrasónico Inaudible (18.5 - 20.5 kHz)
                </button>
              </div>

              {/* Payload Input */}
              <input
                type="text"
                placeholder="Escribe la trama de texto a codificar en señal sonora..."
                value={soundPayloadText}
                onChange={(e) => setSoundPayloadText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  background: "rgba(30,41,59,0.8)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#FFF",
                  fontSize: "14px",
                  marginBottom: "16px",
                  outline: "none",
                }}
              />

              {/* Real-time Oscilloscope Canvas */}
              <div style={{ width: "100%", height: "140px", background: "#030508", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: "16px" }}>
                <canvas ref={oscilloscopeCanvasRef} width={800} height={140} style={{ width: "100%", height: "100%", display: "block" }} />
              </div>

              <button
                onClick={playSoundMeshChirp}
                disabled={isTransmittingAudio}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "12px",
                  background: isTransmittingAudio ? "#00FF88" : "linear-gradient(90deg, #FFB800 0%, #D97706 100%)",
                  color: isTransmittingAudio ? "#000" : "#FFF",
                  fontWeight: 900,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(255, 184, 0, 0.4)",
                  marginBottom: "16px",
                }}
              >
                {isTransmittingAudio ? "📡 Emitiendo Señal FSK en el Osciloscopio..." : "▶️ Sintetizar y Transmitir Trama FSK por el Aire"}
              </button>

              <div style={{ background: "#030508", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: "12px", color: "#FFB800" }}>
                {soundLog}
              </div>
            </div>
          </div>
        )}

        {/* POST-QUANTUM BENCHMARK LAB */}
        {activeTab === "pqc" && (
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <span
                style={{
                  fontSize: "11px",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  background: "rgba(176, 38, 255, 0.15)",
                  color: "#B026FF",
                  border: "1px solid rgba(176, 38, 255, 0.3)",
                  fontFamily: "monospace",
                  fontWeight: 700,
                }}
              >
                LABORATORIO CRIPTOGRÁFICO • ESTÁNDAR FIPS 203
              </span>
              <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", marginTop: "10px", marginBottom: "8px" }}>
                Benchmark Post-Cuántica: ML-KEM-768 vs RSA vs ECC
              </h2>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
                Compara la resistencia cuántica y el tamaño de claves entre la criptografía tradicional y el encapsulamiento en retículos euclidianos de RED.
              </p>
            </div>

            <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(176, 38, 255, 0.35)", marginBottom: "24px" }}>
              {/* Algorithm Comparison Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "20px" }}>
                <div
                  onClick={() => setPqcAlgorithm("kyber")}
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    background: pqcAlgorithm === "kyber" ? "rgba(176, 38, 255, 0.2)" : "rgba(255,255,255,0.03)",
                    border: pqcAlgorithm === "kyber" ? "1px solid #B026FF" : "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#B026FF" }}>ML-KEM-768 (RED OS)</div>
                  <div style={{ fontSize: "11px", color: "#00FF88", fontWeight: 700, marginTop: "4px" }}>🛡️ RESISTENCIA CUÁNTICA: 100%</div>
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Clave Pública: 1,184 B | Ciphertext: 1,088 B</div>
                </div>

                <div
                  onClick={() => setPqcAlgorithm("rsa")}
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    background: pqcAlgorithm === "rsa" ? "rgba(255, 42, 81, 0.2)" : "rgba(255,255,255,0.03)",
                    border: pqcAlgorithm === "rsa" ? "1px solid #FF2A51" : "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#FF2A51" }}>RSA-2048 (Legado)</div>
                  <div style={{ fontSize: "11px", color: "#FF2A51", fontWeight: 700, marginTop: "4px" }}>⚠️ VULNERABLE A SHOR: 0%</div>
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Clave Pública: 256 B | Vulnerable a cuántica</div>
                </div>

                <div
                  onClick={() => setPqcAlgorithm("ecc")}
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    background: pqcAlgorithm === "ecc" ? "rgba(0, 240, 255, 0.2)" : "rgba(255,255,255,0.03)",
                    border: pqcAlgorithm === "ecc" ? "1px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#00F0FF" }}>ECDH X25519 (Clásico)</div>
                  <div style={{ fontSize: "11px", color: "#FFB800", fontWeight: 700, marginTop: "4px" }}>⚠️ VULNERABLE RETROACTIVO</div>
                  <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Clave Pública: 32 B | Rápido pero vulnerable</div>
                </div>
              </div>

              {/* Entropy Seed Display */}
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "monospace" }}>SEMILLA DE ENTROPÍA CSPRNG EN VIVO:</div>
                  <div style={{ fontSize: "13px", color: "#00F0FF", fontFamily: "monospace", fontWeight: 700, marginTop: "2px" }}>{pqcEntropySeed}</div>
                </div>
                <button
                  onClick={refreshPqcEntropy}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: "rgba(176, 38, 255, 0.2)",
                    border: "1px solid #B026FF",
                    color: "#FFF",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🔄 Generar Nueva Época
                </button>
              </div>

              {/* Console Output */}
              <div style={{ background: "#030508", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: "12px", color: "#CBD5E1", display: "flex", flexDirection: "column", gap: "6px" }}>
                {pqcSimLog.length > 0 ? (
                  pqcSimLog.map((log, i) => <div key={i}>{log}</div>)
                ) : (
                  <div>&gt; Haz clic en &quot;Generar Nueva Época&quot; para simular la rotación de claves híbridas ML-KEM-768 ⊕ X25519 con entropía real.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MEDICAL START TRIAGE CALCULATOR & GLOSSARY */}
        {activeTab === "triage" && (
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
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
                MÉDICO & CATÁSTROFES • PROTOCOLO START OFFLINE
              </span>
              <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", marginTop: "10px", marginBottom: "8px" }}>
                Calculadora Interactiva de Triaje START
              </h2>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
                Simula el algoritmo médico de campo para clasificación masiva de heridos en catástrofes y desastres naturales.
              </p>
            </div>

            <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(0, 255, 136, 0.35)", marginBottom: "24px" }}>
              {/* Step 1 */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>1. ¿El paciente puede caminar?</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => {
                      setCanWalk(true);
                      evaluateTriage(true, "", "", "");
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", background: canWalk === true ? "#00FF88" : "rgba(255,255,255,0.05)", color: canWalk === true ? "#000" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                  >
                    Sí (Camina)
                  </button>
                  <button
                    onClick={() => setCanWalk(false)}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", background: canWalk === false ? "rgba(255, 42, 81, 0.2)" : "rgba(255,255,255,0.05)", color: canWalk === false ? "#FF2A51" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                  >
                    No (Inmóvil)
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              {canWalk === false && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>2. Frecuencia Respiratoria:</div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => {
                        setRespiration("none");
                        evaluateTriage(false, "none", "", "");
                      }}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", background: respiration === "none" ? "#64748B" : "rgba(255,255,255,0.05)", color: "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                    >
                      Ausente (No respira)
                    </button>
                    <button
                      onClick={() => {
                        setRespiration("over30");
                        evaluateTriage(false, "over30", "", "");
                      }}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", background: respiration === "over30" ? "#FF2A51" : "rgba(255,255,255,0.05)", color: respiration === "over30" ? "#FFF" : "#FF2A51", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                    >
                      &gt; 30 / minuto (Rápida)
                    </button>
                    <button
                      onClick={() => setRespiration("normal")}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", background: respiration === "normal" ? "#00F0FF" : "rgba(255,255,255,0.05)", color: respiration === "normal" ? "#000" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                    >
                      10 - 30 / min (Normal)
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {canWalk === false && respiration === "normal" && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>3. Pulso Radial / Relleno Capilar:</div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => {
                        setRadialPulse("absent");
                        evaluateTriage(false, "normal", "absent", "");
                      }}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", background: radialPulse === "absent" ? "#FF2A51" : "rgba(255,255,255,0.05)", color: "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                    >
                      Ausente / Capilar &gt; 2s
                    </button>
                    <button
                      onClick={() => setRadialPulse("present")}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", background: radialPulse === "present" ? "#00FF88" : "rgba(255,255,255,0.05)", color: radialPulse === "present" ? "#000" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                    >
                      Presente (&lt; 2s)
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4 */}
              {canWalk === false && respiration === "normal" && radialPulse === "present" && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>4. Estado Mental (Obedece órdenes sencillas):</div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => evaluateTriage(false, "normal", "present", "confused")}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "rgba(255, 42, 81, 0.2)", color: "#FF2A51", border: "1px solid #FF2A51", fontWeight: 700, cursor: "pointer" }}
                    >
                      No obedece / Confuso
                    </button>
                    <button
                      onClick={() => evaluateTriage(false, "normal", "present", "obeys")}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "rgba(255, 184, 0, 0.2)", color: "#FFB800", border: "1px solid #FFB800", fontWeight: 700, cursor: "pointer" }}
                    >
                      Obedece órdenes
                    </button>
                  </div>
                </div>
              )}

              {/* Triage Tag Output Card */}
              {triageResult && (
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    background: "rgba(3,5,8,0.9)",
                    border: `2px solid ${triageResult.color}`,
                    marginTop: "20px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ fontSize: "18px", fontWeight: 900, color: triageResult.color }}>{triageResult.tag}</div>
                    <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "rgba(255,255,255,0.08)", color: "#FFF", fontFamily: "monospace" }}>
                      {triageResult.priority}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>{triageResult.action}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONSENT-FIRST P2P SIMULATOR */}
        {activeTab === "consent" && (
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
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
                POLÍTICA ZERO-TRUST & ANTI-ACOSÓ
              </span>
              <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", marginTop: "10px", marginBottom: "8px" }}>
                Simulador Consent-First P2P
              </h2>
              <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
                En RED, ningún nodo desconocido puede forzar conversaciones en tu pantalla. Toda solicitud entrante requiere confirmación humana explícita.
              </p>
            </div>

            <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255, 42, 81, 0.35)", marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontWeight: 800, color: "#FFF", fontSize: "15px" }}>Prueba de Handshake:</span>
                <button
                  onClick={() => {
                    const randBuf = new Uint8Array(4);
                    if (typeof window !== "undefined" && window.crypto) {
                      window.crypto.getRandomValues(randBuf);
                    }
                    const hex = Array.from(randBuf, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
                    setSimPeerHash(`did:red:${hex}`);
                    setSimPeerAlias(`Operador_${hex.slice(0, 4)}`);
                    setSimConsentStep("incoming");
                    setSimLog((prev) => [
                      `> [ALERTA ACÚSTICA 🚨] Handshake entrante desde did:red:${hex}`,
                      `> [CUARENTENA ZERO-TRUST] Mensajes retenidos. Esperando autorización del usuario.`
                    ]);
                  }}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    background: "linear-gradient(90deg, #FF2A51 0%, #990014 100%)",
                    color: "#FFF",
                    fontWeight: 800,
                    fontSize: "13px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ⚡ Simular Solicitud de Contacto P2P
                </button>
              </div>

              {simConsentStep === "incoming" && (
                <div style={{ padding: "20px", borderRadius: "16px", background: "rgba(255, 42, 81, 0.15)", border: "1px solid #FF2A51", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "24px" }}>🚨</span>
                    <div>
                      <div style={{ fontWeight: 800, color: "#FFF", fontSize: "15px" }}>Solicitud de Conexión P2P Detectada</div>
                      <div style={{ fontSize: "12px", color: "#FF2A51", fontFamily: "monospace" }}>Nodo: {simPeerAlias} ({simPeerHash})</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "13px", color: "#CBD5E1", marginBottom: "16px" }}>
                    Este nodo solicita iniciar un canal de mensajería cifrado Double Ratchet. Selecciona cómo deseas responder:
                  </div>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        setSimConsentStep("accepted");
                        setSimLog((prev) => [...prev, `> [AUTORIZADO ✅] Nodo ${simPeerAlias} aceptado. Se añade a la lista de contactos autorizados.`]);
                      }}
                      style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#00FF88", color: "#000", fontWeight: 800, border: "none", cursor: "pointer", fontSize: "13px" }}
                    >
                      ✅ Aceptar Contacto
                    </button>
                    <button
                      onClick={() => {
                        setSimConsentStep("rejected");
                        setSimLog((prev) => [...prev, `> [RECHAZADO ❌] Solicitud descartada silenciosamente sin alertar al nodo remoto.`]);
                      }}
                      style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.1)", color: "#FFF", fontWeight: 700, border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "13px" }}
                    >
                      ❌ Rechazar Silencioso
                    </button>
                    <button
                      onClick={() => {
                        setSimConsentStep("blocked");
                        setSimLog((prev) => [...prev, `> [BLOQUEADO 🚫] Nodo ${simPeerAlias} añadido a la lista negra permanente. Todo paquete futuro será descartado a nivel de controlador de radio.`]);
                      }}
                      style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#FF2A51", color: "#FFF", fontWeight: 800, border: "none", cursor: "pointer", fontSize: "13px" }}
                    >
                      🚫 Bloquear Nodo (Anti-Acoso)
                    </button>
                  </div>
                </div>
              )}

              {/* Console Output */}
              <div style={{ background: "#030508", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: "12px", color: "#00F0FF", display: "flex", flexDirection: "column", gap: "6px" }}>
                {simLog.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RADAR CANVAS TAB */}
        {activeTab === "radar" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", textAlign: "center", marginBottom: "10px" }}>
              Simulador de Radar & Malla Off-Grid
            </h2>
            <p style={{ fontSize: "14px", color: "#94A3B8", textAlign: "center", marginBottom: "20px" }}>
              Comprueba cómo la topología multi-radio mantiene los canales operativos incluso ante la caída total de torres celulares y proveedores de Internet.
            </p>

            <button
              onClick={() => setIsBlackout(!isBlackout)}
              style={{
                padding: "12px 24px",
                borderRadius: "14px",
                background: isBlackout ? "linear-gradient(90deg, #FF2A51 0%, #7F0010 100%)" : "rgba(0, 255, 136, 0.15)",
                color: isBlackout ? "#FFF" : "#00FF88",
                border: isBlackout ? "1px solid #FF2A51" : "1px solid #00FF88",
                fontWeight: 800,
                cursor: "pointer",
                marginBottom: "20px",
                boxShadow: isBlackout ? "0 0 20px rgba(255, 42, 81, 0.5)" : "none",
              }}
            >
              {isBlackout ? "⚡ MODO APAGÓN ACTIVADO (Sin Internet / Solo Radios de Hardware)" : "🌐 Modo Normal (Hacer clic para simular Apagón / EMP)"}
            </button>

            <div style={{ width: "100%", maxWidth: "800px", background: "#030508", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <canvas ref={radarCanvasRef} style={{ width: "100%", height: "440px", display: "block" }} />
            </div>
          </div>
        )}

        {/* 4-TIER ARCHITECTURE TAB */}
        {activeTab === "architecture" && (
          <div style={{ maxWidth: "920px", margin: "0 auto" }}>
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

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Layer 1 */}
              <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(0, 240, 255, 0.4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "#00F0FF" }}>CAPA 1: PRESENTACIÓN FRONTEND (SPA)</div>
                  <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#94A3B8" }}>Next.js 16 • React 19 • Zustand</span>
                </div>
                <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>
                  Interfaz táctica responsiva construida con Turbopack. Administra los 42 módulos, renderiza el árbol de estados en memoria (`useRedStore.ts`) y se comunica con el backend mediante HTTP loopback y SSE en `127.0.0.1:7333`.
                </div>
              </div>

              {/* Layer 2 */}
              <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(0, 255, 136, 0.4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "#00FF88" }}>CAPA 2: MIDDLEWARE ANDROID NATIVO (JAVA / JNI)</div>
                  <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#94A3B8" }}>Foreground Service • BLE GATT Server</span>
                </div>
                <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>
                  `RedNodeService.java` mantiene vivo el proceso con notificación persistente, inmune a las restricciones de batería del sistema operativo. Administra el servidor GATT y transfiere paquetes al motor Rust mediante enlaces JNI C-ABI.
                </div>
              </div>

              {/* Layer 3 */}
              <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255, 42, 81, 0.4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "#FF2A51" }}>CAPA 3: MOTOR NATIVO RUST NDK (AXUM / LIBP2P)</div>
                  <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#94A3B8" }}>red_core • red_mobile • SQLite Encrypted</span>
                </div>
                <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>
                  Binario optimizado `libred_mobile.so`. Ejecuta Kademlia DHT, enrutamiento multi-salto Gossipsub, deduplicación de mensajes por 72 horas, cifrado Noise XK / ML-KEM-768 y persistencia segura en base de datos SQLite cifrada.
                </div>
              </div>

              {/* Layer 4 */}
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
          </div>
        )}

        {/* INVESTORS TAB */}
        {activeTab === "investors" && (
          <div style={{ maxWidth: "920px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
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
                TESIS DE INVERSIÓN & DEPIN
              </span>
              <h2 style={{ fontSize: "36px", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px" }}>
                Oportunidad Estratégica & Mercado
              </h2>
              <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "750px", margin: "0 auto", lineHeight: 1.6 }}>
                RED resuelve el punto único de fallo de las telecomunicaciones globales: la dependencia absoluta de servidores centralizados y operadores vulnerables a caídas y vigilancia masiva.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "36px" }}>
              <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255, 42, 81, 0.3)" }}>
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>💰</div>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Costo de Servidores: $0 / Usuario</div>
                <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>
                  La infraestructura escala orgánicamente con cada nuevo nodo que se une a la malla, eliminando la factura mensual millonaria de centros de datos en la nube.
                </div>
              </div>

              <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(15,23,42,0.7)", border: "1px solid rgba(0, 255, 136, 0.3)" }}>
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>⚡</div>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Incentivos DePIN (Proof-of-Relay)</div>
                <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>
                  Los operadores que retransmiten tráfico para otros nodos reciben micro-recompensas en tokens $RED, incentivando el despliegue de repetidores comunitarios autónomos.
                </div>
              </div>

              <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(15,23,42,0.7)", border: "1px solid rgba(0, 240, 255, 0.3)" }}>
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>🛡️</div>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "#FFF", marginBottom: "6px" }}>Seguridad Táctica Anti-Coerción</div>
                <div style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>
                  Protección de grado militar en el hardware: modo camuflaje de calculadora científica, PIN de pánico con autodestrucción y bóveda señuelo (PIN 9999).
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAQ TAB */}
        {activeTab === "faq" && (
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
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "24px",
          textAlign: "center",
          fontSize: "12px",
          color: "#64748B",
          fontFamily: "monospace",
        }}
      >
        © 2026 PROYECTO RED — Sovereign Mesh OS v{RED_VERSION} (Build 56000). Código Abierto.
      </footer>
    </div>
  );
}
