# 🛡️ RED — Red Militar Criptográfica Off-Grid & P2P Mesh v24.0.0

> **RED** (Red Criptográfica Off-Grid & P2P Mesh) es la plataforma de comunicaciones tácticas, descentralizadas y soberanas más avanzada del mundo. Diseñada desde su origen para operar bajo escenarios de apagón tecnológico, censura estatal, desastres naturales o denegación de servicios, RED no depende de servidores centrales, infraestructuras celulares ni conexión a Internet.

---

## 📋 Tabla de Contenidos

1. [Visión General & Filosofía de Diseño](#-visión-general--filosofía-de-diseño)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Motor Criptográfico & Cifrado E2E](#-motor-criptográfico--cifrado-e2e)
4. [Capa de Red Multi-Radio Off-Grid (DTN)](#-capa-de-red-multi-radio-off-grid-dtn)
5. [Inmunidad a VPNs & Seguridad Operativa (OPSEC)](#-inmunidad-a-vpns--seguridad-operativa-opsec)
6. [Características Clave & Módulos Integrados](#-características-clave--módulos-integrados)
7. [Guía de Compilación & Despliegue ADB](#-guía-de-compilación--despliegue-adb)
8. [Estructura del Proyecto](#-estructura-del-proyecto)
9. [Índice de Documentación Técnica](#-índice-de-documentación-técnica)

---

## 🔭 Visión General & Filosofía de Diseño

En situaciones de emergencia o denegación de red, las aplicaciones tradicionales de mensajería (WhatsApp, Telegram, Signal) fallan al depender de servidores centrales en la nube y torres de telefonía celular. **RED** rompe esta dependencia convirtiendo cada teléfono inteligente en un **nodo de red mesh independiente** capaz de cifrar, enrutar y entregar mensajes a través de radios de hardware locales.

| Característica | Aplicaciones Tradicionales | RED v24.0.0 |
|---|---|---|
| **Infraestructura** | Requiere servidores en la nube y 4G/5G | **100% Descentralizado / Zero-Server** |
| **Operación Off-Grid** | Imposible sin Internet | **Totalmente funcional mediante BLE, WiFi Direct y LoRa** |
| **Identidad** | Vinculada a número telefónico/email | **Soberana Criptográfica (`did:red:`)** |
| **Resiliencia** | Fallo total en apagones | **Tolerante a Retrasos (DTN Store-and-Forward)** |
| **Resistencia a Censura** | Susceptible a bloqueos de IP/DNS | **Inmune / Enrutamiento Malla de Inundación Controlada** |

---

## 📐 Arquitectura del Sistema

El proyecto está construido bajo una arquitectura híbrida de alto rendimiento:

- **Frontend & UI (Next.js 16 + React + Tailwind CSS + Capacitor)**: Interfaz de usuario táctica optimizada para dispositivos móviles, empaquetada en WebViews nativas con aceleración por hardware.
- **Puente Nativo Android (Java / JNI / Foreground Service)**: `RedNodeService.java` gestiona un proceso de fondo inmune al ahorrador de batería del SO, administrando el servidor GATT de Bluetooth LE y comunicándose directamente con el binario Rust mediante llamadas JNI (`RedNodePlugin.java`).
- **Motor Criptográfico Nativo (Rust - `red_core` & `red_mobile`)**: Binario nativo compilado en Rust mediante el NDK que ejecuta un servidor Axum REST/SSE local en `127.0.0.1:7333` y gestiona la base de datos cifrada SQLite.

```
+-----------------------------------------------------------------------+
|                             CAPA DE USUARIO                           |
|      Next.js 16 SPA (Turbopack) + React + Tailwind CSS + Capacitor     |
+-----------------------------------------------------------------------+
                                   |
              HTTP REST / SSE (http://127.0.0.1:7333)
                                   v
+-----------------------------------------------------------------------+
|                         CAPA NATIVA ANDROID                           |
|       RedNodeService.java (Foreground) + RedNodePlugin.java (JNI)      |
|    GATT Server / BleTransport + Direct Native HTTP POST Mesh Inject   |
+-----------------------------------------------------------------------+
                                   |
                          JNI / Rust Bindings
                                   v
+-----------------------------------------------------------------------+
|                           MOTOR RUST NATIVO                           |
|     red_mobile (Axum REST API + SSE) + red_core (Protocol Engine)    |
|   Noise XK Handshake + Ed25519 Signatures + ChaCha20-Poly1305 E2E     |
+-----------------------------------------------------------------------+
                                   |
                  TRANSPORTE MULTI-RADIO AD-HOC (OFF-GRID)
     +---------------------+---------------+--------------------+
     | BLE GATT (Physical) | WiFi Direct   | LoRa Radio Serial  |
     +---------------------+---------------+--------------------+
```

---

## 🔐 Motor Criptográfico & Cifrado E2E

1. **Identidad Soberana (`did:red:<identity_hash>:<public_key>`)**:
   - Al iniciar la app por primera vez, el dispositivo genera un par de claves de curva elíptica **Ed25519** protegidas en la Keystore del sistema operativo.
2. **Protocolo Noise XK & Forward Secrecy**:
   - La comunicación uno a uno utiliza un Handshake criptográfico **Noise XK** con claves efímeras de curva **X25519** y claves estáticas pre-compartidas o intercambiadas por QR.
   - Cada payload (texto, imagen, nota de voz, archivo o ubicación GPS) se cifra utilizando el algoritmo simétrico autenticado **ChaCha20-Poly1305**.
3. **Intercambio Recíproco de Claves Públicas (Auto Key-Exchange)**:
   - Al escanear el código QR de un usuario o enviar una solicitud `contact_request`, se transmite de manera segura la clave pública del emisor (`sender_pk`). El receptor almacena la clave y responde con `contact_response`, habilitando el cifrado E2E sin intervención manual adicional.

---

## 📻 Capa de Red Multi-Radio Off-Grid (DTN)

- **Enrutamiento por Inundación Controlada (Controlled Flood)**: Cada paquete posee un TTL (Time To Live) de hasta 20 saltos. El sistema mantiene un registro de deduplicación de nonces de 72 horas para prevenir bucles de retransmisión en redes densas.
- **Red Tolerante a Retrasos (DTN Store-and-Forward)**: Si un destinatario está fuera de alcance, el mensaje se guarda en la cola fuera de línea (`pendingQueue`). Cuando te cruzas con otros teléfonos RED en la calle o zonas de emergencia, los paquetes saltan de teléfono en teléfono (*Sneakernet Relay*) cifrados hasta llegar a su destino.
- **Sincronización en Segundo Plano**: Cuando entra un mensaje y la ventana del chat no está enfocada, el manejador de fondo emite una notificación nativa y refresca la lista de conversaciones (`fetchData`), actualizando la insignia de mensajes no leídos (`unread_count`).

---

## 🛡️ Inmunidad a VPNs & Seguridad Operativa (OPSEC)

- **Inmunidad a VPNs**: El transporte Bluetooth LE (BLE) opera a nivel de controlador HCI del hardware de radio y no pasa por el stack TCP/IP ni por los túneles del `VpnService` de Android. Aunque el usuario active una VPN con *Kill Switch*, la comunicación P2P por radio continúa funcionando al 100%.
- **Modo Señuelo (Decoy Password `9999`)**: Si un operador es obligado a desbloquear el equipo, ingresar la clave falsa `9999` abre una instancia señuelo totalmente limpia sin acceso a los mensajes reales.
- **Interruptor del Hombre Muerto (Dead Man's Switch / DMS)**: Destrucción automática de mensajes e identidades si el teléfono permanece inactivo durante un período de tiempo configurable.
- **Prueba de Trabajo (PoW)**: Ejecución de un algoritmo de Proof of Work local antes de autorizar nodos para mitigar ataques Sybil.

---

## 🌟 Características Clave & Módulos Integrados

- **Mensajería Directa E2E & Grupos Cifrados**: Chat individual y soporte para grupos tácticos con distribución de llaves.
- **Notas de Voz de Alta Eficiencia**: Grabación de audio comprimido a 12 Kbps (OGG/Opus) optimizada para transmisión en radios de baja velocidad (LoRa/BLE).
- **Baliza de Emergencia SOS**: Transmisión instantánea de coordenadas GPS reales y alerta de socorro a todos los nodos P2P en el área.
- **Radar de Nodos Cercanos**: Escaneo visual en tiempo real de pares detectados por Bluetooth y subred local.
- **Transmisión de Video en Vivo Off-Grid**: Emisión y recepción de video local de baja latencia entre nodos.
- **Pizarra Colaborativa Táctica (Live Canvas)**: Dibujo táctico sincronizado en tiempo real por la red mesh.

---

## 🚀 Guía de Compilación & Despliegue ADB

### Requisitos Previos
- **Node.js** 18+ & npm
- **Android Studio** con JDK OpenJDK JBR (`C:\Program Files\Android\Android Studio\jbr`)
- **Android SDK Platform Tools** (`adb.exe`)

### 1. Compilación del Frontend & Sincronización Capacitor
```bash
cd client/app
npm run build
npx cap sync android
```

### 2. Compilación del APK Debug mediante Gradle
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location "client\app\android"
.\gradlew.bat assembleDebug
```

### 3. Instalación Directa a Dispositivos Físicos mediante ADB
```powershell
$Adb = "C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$Apk = "app\build\outputs\apk\debug\app-debug.apk"

# Instalación en Motorola Moto G22
& $Adb -s ZT322B386P install -r $Apk

# Instalación en Lenovo Tablet
& $Adb -s HA2CHKZ2 install -r $Apk
```

### Artefacto Oficial de Distribución:
- **Ruta del APK**: `d:\PROYECTO RED\assets\red-v24.0.0-latest.apk`

---

## 📁 Estructura del Proyecto

```
D:\PROYECTO RED
├── assets/                               # Artefactos y APKs oficiales de distribución
│   └── red-v24.0.0-latest.apk           # Binario APK oficial compilado y probado
├── client/                               # Aplicación cliente frontend/móvil
│   └── app/                              # Proyecto Next.js 16 (Turbopack) + Capacitor
│       ├── android/                      # Proyecto nativo de Android Gradle
│       │   └── app/src/main/java/f/red/app/
│       │       ├── MainActivity.java     # Actividad principal Capacitor
│       │       ├── RedNodePlugin.java    # Interface JNI de comunicación Rust ↔ JS
│       │       ├── RedNodeService.java   # Foreground Service & GATT BLE Server nativo
│       │       └── RedDisguisePlugin.java # Modulo de camuflaje de icono
│       └── src/
│           ├── app/                      # Rutas Next.js App Router (page.tsx, layout.tsx)
│           ├── components/               # Módulos y pantallas de interfaz táctica
│           │   ├── ChatWindow.tsx        # Ventana principal de chat E2E
│           │   ├── Sidebar.tsx           # Lista de conversaciones y contactos
│           │   ├── RadarWindow.tsx       # Escáner P2P y lector de QR did:red:
│           │   ├── StatusHeader.tsx      # Barra de estado de red (P2P, BLE, WiFi, Standalone)
│           │   ├── IdentityVaultModal.tsx # Bóveda de identidades soberanas
│           │   ├── SOSEmergencyBanner.tsx # Baliza de socorro y alertas GPS
│           │   ├── AICopilotModal.tsx    # Asistente IA local Off-Grid
│           │   ├── AmberAdminPanel.tsx   # Panel de alertas de emergencia AMBER
│           │   ├── BlockchainExplorer.tsx # Explorador de bloques y verificaciones PoS/PoW
│           │   ├── LiveCanvasModal.tsx   # Pizarra táctica sincronizada por mesh
│           │   ├── LiveStreamBroadcaster.tsx # Emisor de video en vivo off-grid
│           │   ├── LiveStreamViewer.tsx  # Visor de video en vivo off-grid
│           │   ├── NetworkPanel.tsx      # Panel de topología de red y relays
│           │   ├── P2PWalkieTalkieModal.tsx # Walkie-talkie de voz P2P
│           │   ├── P2PCompassModal.tsx   # Brújula táctica de dirección P2P
│           │   └── ...                   # Módulos de seguridad, grupos, DMS, llamadas
│           ├── lib/
│           │   ├── api.ts                # Cliente REST/SSE de la API Axum en 127.0.0.1:7333
│           │   └── mesh/
│           │       ├── meshRouter.ts     # Enrutador central P2P Controlled Flood
│           │       ├── bluetoothTransport.ts # Transporte BLE y listener Capacitor Native
│           │       ├── wifiDirectTransport.ts # Transporte WiFi Direct WebRTC
│           │       └── localTransport.ts # Coordinador de transportes locales
│           └── store/
│               └── useRedStore.ts        # Store central Zustand & Router SPA
├── core/                                 # Motor criptográfico y de red en Rust puro
│   └── src/
│       ├── crypto/                       # Algoritmos ChaCha20-Poly1305, Ed25519, X25519
│       ├── identity/                     # Generación y firma de llaves DID
│       ├── network/                      # Enrutamiento P2P Mesh, LoRa y deduplicación
│       ├── protocol/                     # Protocolo Ω, Noise XK Handshake y Message Envelopes
│       └── storage/                      # Base de datos SQLite cifrada local
├── red_mobile/                           # Bindings JNI y Servidor REST/SSE Axum para móviles
│   └── src/
│       ├── api.rs                        # Endpoints HTTP REST (contactos, mensajes, mesh)
│       └── lib.rs                        # Inicialización JNI y Bootstrap peers P2P mundiales
├── docs/                                 # Especificaciones de arquitectura y protocolos
│   ├── ARCHITECTURE.md                   # Especificación arquitectónica del sistema
│   ├── PROTOCOL_SPECIFICATION.md        # Especificación técnica del Protocolo Ω
│   ├── OFFLINE_CONNECTIVITY.md           # Especificación de radios BLE/WiFi/LoRa
│   ├── MATHEMATICAL_SPECIFICATION.md     # Modelo matemático de la red
│   ├── MOBILE_TESTING.md                 # Banco de pruebas ADB en hardware real
│   └── API.md                            # Documentación de la API de Rust
├── USER_MANUAL.md                        # Manual operativo para el usuario final
├── README.md                             # Documento principal de presentación
└── Cargo.toml                            # Workspace Manifest de Rust
```

---

## 📄 Índice de Documentación Técnica

- 📖 [Manual del Usuario](file:///d:/PROYECTO%20RED/USER_MANUAL.md) — Guía práctica paso a paso.
- 🏗️ [Arquitectura del Sistema](file:///d:/PROYECTO%20RED/docs/ARCHITECTURE.md) — Diagrama de componentes y flujos nativos.
- 📜 [Especificación de Protocolos](file:///d:/PROYECTO%20RED/docs/PROTOCOL_SPECIFICATION.md) — Detalles del protocolo criptográfico Ω.
- 🛜 [Conectividad Offline](file:///d:/PROYECTO%20RED/docs/OFFLINE_CONNECTIVITY.md) — Especificación de BLE, WiFi Direct y LoRa.
- 📐 [Especificación Matemática](file:///d:/PROYECTO%20RED/docs/MATHEMATICAL_SPECIFICATION.md) — Modelo matemático de la red.
- 📱 [Pruebas Móviles en Hardware Real](file:///d:/PROYECTO%20RED/docs/MOBILE_TESTING.md) — Banco de pruebas ADB.
