# 🛡️ RED — Red Militar Criptográfica Off-Grid & P2P Mesh v30.0.0

> **RED** (Red Criptográfica Off-Grid & P2P Mesh) es la plataforma de comunicaciones tácticas, descentralizadas y soberanas más avanzada del mundo. Diseñada desde su origen para operar bajo escenarios de apagón tecnológico, censura estatal, desastres naturales o denegación de servicios, RED no depende de servidores centrales, infraestructuras celulares ni conexión a Internet.

[![Descargar APK Oficial RED v30.0.0](https://img.shields.io/badge/Descargar_APK_v30.0.0-GitHub_Releases-E8213A?style=for-the-badge&logo=android)](https://github.com/DarckRovert/RED/releases/tag/v30.0.0)
[![Página Web Oficial GitHub Pages](https://img.shields.io/badge/Web_App-GitHub_Pages-38BDF8?style=for-the-badge&logo=github)](https://darckrovert.github.io/RED/)
[![TypeScript Compiler](https://img.shields.io/badge/TypeScript-0_Errors-00D97E?style=for-the-badge&logo=typescript)](https://github.com/DarckRovert/RED)
[![Android Gradle Build](https://img.shields.io/badge/Android_APK-BUILD_SUCCESSFUL-00E676?style=for-the-badge&logo=android)](https://github.com/DarckRovert/RED)

---

## 📋 Tabla de Contenidos

1. [Visión General & Filosofía de Diseño](#-visión-general--filosofía-de-diseño)
2. [Arquitectura del Sistema & Motores de Bajo Nivel](#-arquitectura-del-sistema--motores-de-bajo-nivel)
3. [Catálogo Completo de los 28 Módulos Tácticos](#-catálogo-completo-de-los-28-módulos-tácticos)
4. [Motor Criptográfico & Cifrado E2E](#-motor-criptográfico--cifrado-e2e)
5. [Capa de Red Multi-Radio Off-Grid (Mesh Router & DTN)](#-capa-de-red-multi-radio-off-grid-mesh-router--dtn)
6. [Inmunidad a VPNs & Seguridad Operativa (OPSEC)](#-inmunidad-a-vpns--seguridad-operativa-opsec)
7. [Motor de IA Neuronal Local ONNX WASM](#-motor-de-ia-neuronal-local-onnx-wasm)
8. [Guía de Compilación & Despliegue ADB](#-guía-de-compilación--despliegue-adb)
9. [Estructura del Proyecto](#-estructura-del-proyecto)
10. [Índice de Documentación Técnica](#-índice-de-documentación-técnica)

---

## 🔭 Visión General & Filosofía de Diseño

En situaciones de emergencia o denegación de red, las aplicaciones tradicionales de mensajería (WhatsApp, Telegram, Signal) fallan al depender de servidores centrales en la nube y torres de telefonía celular. **RED** rompe esta dependencia convirtiendo cada teléfono inteligente en un **nodo de red mesh independiente** capaz de cifrar, enrutar y entregar mensajes a través de radios de hardware locales.

| Característica | Aplicaciones Tradicionales | RED v30.0.0 |
|---|---|---|
| **Infraestructura** | Requiere servidores en la nube y 4G/5G | **100% Descentralizado / Zero-Server** |
| **Operación Off-Grid** | Imposible sin Internet | **Totalmente funcional mediante BLE, WiFi Direct, LoRa y SoundMesh** |
| **Identidad** | Vinculada a número telefónico/email | **Soberana Criptográfica (`did:red:`)** |
| **Inteligencia IA** | Dependiente de APIs en la Nube | **100% Offline Neuronal WASM (`LaMini-Flan-T5`)** |
| **Resiliencia** | Fallo total en apagones | **Tolerante a Retrasos (DTN Store-and-Forward 24h)** |
| **Resistencia a Censura** | Susceptible a bloqueos de IP/DNS | **Inmune / Enrutamiento Malla de Inundación Controlada (TTL 20)** |
| **Cero Datos Ficticios** | Simulación en modo demo | **0% Datos Hardcodeados / 100% Funcionalidad Real Verificada** |

---

## 📐 Arquitectura del Sistema & Motores de Bajo Nivel

El proyecto está construido bajo una arquitectura de 3 capas de alto rendimiento:

```
+-----------------------------------------------------------------------+
|                             CAPA DE USUARIO                           |
|      Next.js 16 SPA (Turbopack) + React + Vanilla CSS + Zustand       |
|            28 Módulos de Interfaz Táctica & Visualización UI          |
+-----------------------------------------------------------------------+
                                   |
              HTTP REST / SSE (http://127.0.0.1:7333/api)
                                   v
+-----------------------------------------------------------------------+
|                         CAPA NATIVA ANDROID                           |
|   RedNodeService.java (Foreground) + RedNodePlugin.java (JNI Core)    |
|   RedDisguisePlugin.java (Launcher Alias) + Hardware Keystore Plugin |
+-----------------------------------------------------------------------+
                                   |
                          JNI / Rust Bindings
                                   v
+-----------------------------------------------------------------------+
|                   3 MOTORES DE INFRAESTRUCTURA CORE                   |
| 1. Motor Criptográfico: Ed25519, X25519, AES-256-GCM, SSS GF(2^8)    |
| 2. Motor Mesh Multi-Transporte: BLE, WiFi Direct, LoRa 915MHz, Sound |
| 3. Motor IA Neuronal Offline: LaMini-Flan-T5 ONNX WASM & Guardian IA |
+-----------------------------------------------------------------------+
```

### Los 3 Motores de Infraestructura de Bajo Nivel:

1. **🔐 Motor Criptográfico Nativo (Subsistema Core):**
   - Generación y firma de identidades soberanas mediante curva elíptica **Ed25519**.
   - Intercambio de claves efímeras Diffie-Hellman **X25519** y cifrado simétrico autenticado **AES-256-GCM** / **ChaCha20-Poly1305**.
   - Salting de contraseñas mediante **PBKDF2** (100,000 iteraciones) y almacenamiento en Hardware Keystore cifrado (`capacitor-secure-storage-plugin`).
   - División de secretos de Shamir sobre el Cuerpo de Galois **$GF(2^8)$** con polinomio irreducible $x^8 + x^4 + x^3 + x + 1$ e interpolación de Lagrange (`ShamirSecretSharingEngine.ts`).
   - Bóveda de Esteganografía LSB y Matrix Encoding (`StegoEngine.ts`).

2. **📡 Motor de Red Mesh Multi-Transporte (Subsistema P2P):**
   - Algoritmo de enrutamiento por **Inundación Controlada (Controlled Flood)** con decrecimiento de TTL (máximo 20 saltos) y caché de deduplicación de nonces durante 72 horas (`meshRouter.ts`).
   - **Bluetooth Low Energy (BLE):** Servidor/Cliente GATT con escaneo y reconexión activa cada 15s (`bluetoothTransport.ts`).
   - **Wi-Fi Direct / IP Local:** Enlace peer-to-peer de alta velocidad vía WebRTC DataChannel (`wifiDirectTransport.ts`).
   - **Módem LoRa (915 MHz):** Transporte serie ruteado mediante el binario nativo de Rust (`RedAPI.injectMeshPayload`).
   - **SoundMesh Ultrasonido:** Módem acústico de reserva en frecuencia ultrasónica 18–20 kHz BFSK para entornos de apagón RF total (`soundmesh.ts`).
   - **Cola Store-and-Forward:** Almacenamiento en memoria diferido de 24h para entrega tolerante a retrasos (DTN).

3. **🧠 Motor IA Neuronal Local (Subsistema Inferencia WASM/ONNX):**
   - Ejecución local del modelo de lenguaje `LaMini-Flan-T5` dentro del navegador/WebView sin consumir datos ni requerir servidores externos (`localAiEngine.ts`).
   - **Guardian IA:** Motor de moderación autónoma en canales públicos basado en heurística y reglas sintácticas (`guardianEngine.ts`).

---

## 🛡️ Catálogo Completo de los 28 Módulos Tácticos

| # | Módulo | Archivos Principales | Descripción & Funcionalidad Real |
|---|---|---|---|
| **1** | **Radar Topográfico Off-Grid** | `OffGridCompassModal.tsx`, `OffGridCompassEngine.ts` | Brújula electromagnética con declinación magnética WMM2025, altímetro barométrico y coordenadas MGRS/UTM reales. |
| **2** | **Escáner Signos Vitales PPG** | `VitalScanModal.tsx`, `VitalSignsScanEngine.ts` | Triaje fotopletismográfico (PPG) mediante análisis del pulso espectral de la cámara y linterna LED. |
| **3** | **Baliza SOS & Módem SoundMesh** | `SurvivalBeaconModal.tsx`, `soundmesh.ts` | Emisión de baliza de emergencia P2P y módem acústico ultrasónico por ondas de audio BFSK de 18–20 kHz. |
| **4** | **Copiloto IA Neuronal Offline** | `AICopilotModal.tsx`, `localAiEngine.ts` | Inferencia neuronal offline en dispositivo para consultas tácticas, traducción y resúmenes sin conexión. |
| **5** | **Proximidad Zero-Touch & Radar Wave** | `ProximityWaveModal.tsx`, `ProximitySettingsModal.tsx` | Detección de presencia física por ultrasonido Doppler y radar Wave sin emparejamiento previo. |
| **6** | **Pizarra Táctica P2P en Vivo** | `LiveCanvasModal.tsx` | Dibujo colaborativo de mapas y estrategias sincronizado en tiempo real entre nodos mesh. |
| **7** | **Resiliencia de Batería Eco-Mesh** | `EcoMeshPanel.tsx` | Gestión dinámica del consumo energético adaptando los intervalos de beaconing según el nivel de batería. |
| **8** | **Walkie-Talkie Mesh Push-To-Talk** | `P2PWalkieTalkieModal.tsx` | Transmisión de voz P2P en tiempo real con compresión de baja latencia para redes off-grid. |
| **9** | **Alertas Tácticas AMBER Off-Grid** | `AmberAdminPanel.tsx`, `AmberAlertBanner.tsx` | Difusión prioritaria de emergencias comunitarias y personas desaparecidas cifrada en red malla. |
| **10** | **Boletines Climáticos Off-Grid** | `WeatherAlertPanel.tsx` | Reportes meteorológicos barométricos y alertas de tempestad compartidas entre nodos. |
| **11** | **Canales Públicos & Guardian IA** | `PublicChannelsPanel.tsx`, `guardianEngine.ts` | Canales temáticos abiertos con filtrado de spam y moderación autónoma por el motor Guardian IA. |
| **12** | **Bóveda Criptográfica StegoVault** | `StegoVaultModal.tsx`, `StegoEngine.ts` | Esteganografía LSB y Matrix Encoding para ocultar mensajes cifrados dentro de fotografías. |
| **13** | **Historias Tácticas Off-Grid** | `StoriesBar.tsx`, `StoryCreator.tsx`, `StoryViewer.tsx` | Publicaciones efímeras de foto y texto con expiración automática a las 24 horas. |
| **14** | **Transmisión Video P2P en Vivo** | `LiveStreamBroadcaster.tsx`, `LiveStreamViewer.tsx` | Emisión y recepción de video en vivo de baja latencia entre nodos directos de la red. |
| **15** | **Notas de Voz Cifradas** | `VoiceMessage.tsx` | Grabación y reproducción cross-platform de audio cifrado E2E a 12 Kbps. |
| **16** | **Encuestas & Votaciones P2P** | `PollMessage.tsx` | Creación de votaciones tácticas con consenso y recuento de votos firmado criptográficamente. |
| **17** | **Respaldo Cifrado AES-256-GCM** | `BackupRestoreModal.tsx` | Exportación e importación de bóvedas de mensajes y claves protegidas por contraseña PBKDF2. |
| **18** | **Explorador Blockchain RED** | `BlockchainExplorer.tsx` | Registro distribuido e inmutable de transacciones, bloques y validadores de la red RED. |
| **19** | **Espectro RF & Monitoreo SDR** | `RfSpectrumModal.tsx`, `RfSpectrumAnalyzerEngine.ts` | Análisis de interferencias en bandas de radiofrecuencia (Sub-GHz, 2.4GHz) y detección de jammers. |
| **20** | **Mapa de Nodos & Telemetría P2P** | `NodeMap.tsx` | Visualización en mapa topográfico de la posición GPS y fuerza de señal (RSSI) de los pares mesh. |
| **21** | **Hombre Muerto DMS & Purga** | `DMSSettings.tsx`, `useRedStore.ts` | Motor `evaluateLocalDMS` con purga automática de claves e historial ante inactividad del operador. |
| **22** | **Identidad DID & Esquema SSS** | `IdentityVaultModal.tsx`, `ShamirSecretSharingEngine.ts` | Bóveda de auxilio en Keystore y fragmentación $GF(2^8)$ 3-de-5 con reconstrucción de Lagrange. |
| **23** | **Protocolo Incógnito / Señuelo** | `AuthWall.tsx`, `SecurityPanel.tsx` | Autenticación multi-PIN: PIN Maestro (bóveda real), PIN Señuelo (`decoy_pin`) y PIN de Pánico (purga nativa). |
| **24** | **Infraestructura Mesh Multi-Radio** | `meshRouter.ts`, `localTransport.ts`, `bluetoothTransport.ts` | Enrutador mesh Controlled Flood con deduplicación de 72h y failover BLE / WiFi Direct / LoRa / SoundMesh. |
| **25** | **Llamadas Tácticas WebRTC E2E** | `CallScreen.tsx`, `IncomingCallBanner.tsx` | Videollamadas y llamadas de voz P2P con señalización SDP/ICE cifrada e interfaz PIP flotante. |
| **26** | **Contactos & Grupos Cifrados** | `GroupsPanel.tsx`, `GroupAdminModal.tsx` | Administración de contactos soberanos y creación de grupos federados P2P con llaves `SenderKey`. |
| **27** | **Mensajería E2EE en Tiempo Real** | `ChatWindow.tsx`, `MessageBubble.tsx` | Chat principal E2E con estados de entrega, citas, reacciones, fijado, edición y búsqueda global. |
| **28** | **Centro de Control Táctico** | `StatusView.tsx`, `Sidebar.tsx`, `SecurityPanel.tsx` | Panel central de navegación, historias de 24h, diagnóstico del nodo y control Zero-Trust. |

---

## 🔐 Motor Criptográfico & Cifrado E2E

1. **Identidad Soberana (`did:red:<identity_hash>:<public_key>`)**:
   - Al iniciar la app por primera vez, el dispositivo genera un par de claves de curva elíptica **Ed25519** protegidas en la Keystore del sistema operativo.
2. **Protocolo Noise XK & Forward Secrecy**:
   - La comunicación uno a uno utiliza un Handshake criptográfico **Noise XK** con claves efímeras de curva **X25519** y claves estáticas pre-compartidas o intercambiadas por QR.
   - Cada payload (texto, imagen, nota de voz, archivo o ubicación GPS) se cifra utilizando el algoritmo simétrico autenticado **AES-256-GCM** o **ChaCha20-Poly1305**.
3. **Intercambio Recíproco de Claves Públicas (Auto Key-Exchange)**:
   - Al escanear el código QR de un usuario o enviar una solicitud `contact_request`, se transmite de manera segura la clave pública del emisor (`sender_pk`). El receptor almacena la clave y responde con `contact_response`, habilitando el cifrado E2E sin intervención manual adicional.

---

## 📻 Capa de Red Multi-Radio Off-Grid (Mesh Router & DTN)

- **Enrutamiento por Inundación Controlada (Controlled Flood)**: Cada paquete posee un TTL (Time To Live) de hasta 20 saltos. El sistema mantiene un registro de deduplicación de nonces de 72 horas para prevenir bucles de retransmisión en redes densas.
- **Red Tolerante a Retrasos (DTN Store-and-Forward)**: Si un destinatario está fuera de alcance, el mensaje se guarda en la cola fuera de línea (`pendingQueue`). Cuando te cruzas con otros teléfonos RED en la calle o zonas de emergencia, los paquetes saltan de teléfono en teléfono (*Sneakernet Relay*) cifrados hasta llegar a su destino.
- **Sincronización en Segundo Plano**: Cuando entra un mensaje y la ventana del chat no está enfocada, el manejador de fondo emite una notificación nativa y refresca la lista de conversaciones (`fetchData`), actualizando la insignia de mensajes no leídos (`unread_count`).

---

## 🛡️ Inmunidad a VPNs & Seguridad Operativa (OPSEC)

- **Inmunidad a VPNs**: El transporte Bluetooth LE (BLE) opera a nivel de controlador HCI del hardware de radio y no pasa por el stack TCP/IP ni por los túneles del `VpnService` de Android. Aunque el usuario active una VPN con *Kill Switch*, la comunicación P2P por radio continúa funcionando al 100%.
- **Modo Señuelo (`decoy_pin`)**: Iniciar sesión con el PIN señuelo despliega un entorno alternativo verosímil sin acceso a los chats o llaves de la bóveda principal.
- **Interruptor de Pánico (Panic PIN)**: Iniciar sesión con el PIN de pánico detiene el servicio en segundo plano y ejecuta la destrucción física inmediata de las bases de datos y claves nativas (`RedNodePlugin.destroy`).
- **Hombre Muerto DMS**: El motor `evaluateLocalDMS` monitorea la inactividad del operador y emite un mensaje de socorro o realiza el borrado de claves si se supera la ventana de tiempo configurada.

---

## 🚀 Guía de Compilación & Despliegue ADB

### Requisitos Previos
- **Node.js** 18+ & npm
- **Android Studio** con JDK OpenJDK JBR (`C:\Program Files\Android\Android Studio\jbr`)
- **Android SDK Platform Tools** (`adb.exe`)

### 1. Verificación de Código & Compilación Frontend
```bash
cd client/app
node node_modules/typescript/bin/tsc --noEmit
npm run build
npx cap sync android
```

### 2. Compilación del APK Debug mediante Gradle
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location "client\app\android"
.\gradlew assembleDebug --no-daemon
```

### 3. Instalación Directa a Dispositivos Físicos mediante ADB
```powershell
$Adb = "C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$Apk = "app\build\outputs\apk\debug\app-debug.apk"

# Instalación en dispositivo objetivo
& $Adb install -r $Apk
```

---

## 📁 Estructura del Proyecto

```
D:\PROYECTO RED
├── assets/                               # Artefactos y APKs oficiales de distribución
│   └── red-v30.0.0-latest.apk           # Binario APK oficial compilado y probado
├── client/                               # Aplicación cliente frontend/móvil
│   └── app/                              # Proyecto Next.js 16 (Turbopack) + Capacitor
│       ├── android/                      # Proyecto nativo de Android Gradle
│       │   └── app/src/main/java/f/red/app/
│       │       ├── MainActivity.java     # Actividad principal Capacitor
│       │       ├── RedNodePlugin.java    # Interface JNI de comunicación Rust ↔ JS
│       │       ├── RedNodeService.java   # Foreground Service & GATT BLE Server nativo
│       │       └── RedDisguisePlugin.java # Modulo de camuflaje de icono nativo
│       └── src/
│           ├── app/                      # Rutas Next.js App Router (page.tsx, layout.tsx)
│           ├── components/               # Módulos y pantallas de interfaz táctica
│           │   ├── ChatWindow.tsx        # Módulo 27: Chat E2E principal
│           │   ├── Sidebar.tsx           # Módulo 28: Menú de navegación y lista de conversaciones
│           │   ├── StatusView.tsx        # Módulo 28: Historias 24h y diagnósticos
│           │   ├── CallScreen.tsx        # Módulo 25: Videollamadas y voz WebRTC P2P
│           │   ├── GroupsPanel.tsx       # Módulo 26: Grupos federados P2P
│           │   ├── GroupAdminModal.tsx   # Módulo 26: Administración de miembros
│           │   ├── IdentityVaultModal.tsx # Módulo 22: Bóveda DID y Shamir SSS
│           │   ├── DMSSettings.tsx       # Módulo 21: Hombre Muerto DMS
│           │   ├── NodeMap.tsx           # Módulo 20: Mapa de nodos y telemetría
│           │   ├── RfSpectrumModal.tsx    # Módulo 19: Analizador de espectro RF
│           │   ├── BlockchainExplorer.tsx# Módulo 18: Explorador de cadena de bloques
│           │   ├── BackupRestoreModal.tsx# Módulo 17: Respaldos AES-256-GCM
│           │   ├── StegoVaultModal.tsx   # Módulo 12: Bóveda esteganográfica
│           │   ├── VitalScanModal.tsx    # Módulo 2: Escáner de signos vitales PPG
│           │   ├── SurvivalBeaconModal.tsx# Módulo 3: Baliza SOS y ultrasonido SoundMesh
│           │   ├── OffGridCompassModal.tsx# Módulo 1: Radar topográfico y brújula
│           │   ├── AICopilotModal.tsx    # Módulo 4: Copiloto IA neuronal offline
│           │   └── ...                   # Resto de módulos tácticos
│           ├── lib/
│           │   ├── api.ts                # Cliente REST/SSE de la API Axum en 127.0.0.1:7333
│           │   ├── ShamirSecretSharingEngine.ts # Motor SSS GF(2^8) & Lagrange
│           │   ├── soundmesh.ts          # Módem acústico ultrasónico BFSK
│           │   └── mesh/
│           │       ├── meshRouter.ts     # Motor de enrutamiento Controlled Flood (TTL 20)
│           │       ├── bluetoothTransport.ts # Transporte BLE GATT nativo
│           │       ├── wifiDirectTransport.ts # Transporte WiFi Direct WebRTC
│           │       └── localTransport.ts # Coordinador de transportes locales
│           └── store/
│               └── useRedStore.ts        # Store central Zustand, router SPA & motor DMS
├── core/                                 # Motor criptográfico y de red en Rust puro
├── red_mobile/                           # Bindings JNI y Servidor REST/SSE Axum para móviles
├── docs/                                 # Especificaciones de arquitectura y protocolos
│   ├── ARCHITECTURE.md                   # Especificación arquitectónica del sistema
│   ├── PROTOCOL_SPECIFICATION.md        # Especificación técnica del Protocolo Ω
│   ├── OFFLINE_CONNECTIVITY.md           # Especificación de radios BLE/WiFi/LoRa/SoundMesh
│   ├── MATHEMATICAL_SPECIFICATION.md     # Modelo matemático de la red
│   ├── SECURITY_AUDIT.md                 # Informe de auditoría de seguridad 0% datos ficticios
│   └── API.md                            # Documentación de la API de Rust
├── USER_MANUAL.md                        # Manual operativo detallado para el usuario
├── ADMIN_MANUAL.md                       # Manual de administración y seguridad táctica
└── README.md                             # Presentación ejecutiva y técnica del proyecto
```

---

## 📄 Índice de Documentación Técnica

- 📖 [Manual del Usuario](./USER_MANUAL.md) — Guía operativa detallada de los 28 módulos.
- ⚙️ [Manual de Administración](./ADMIN_MANUAL.md) — Seguridad OPSEC, PIN de pánico y gestión de claves.
- 🏗️ [Arquitectura del Sistema](./docs/ARCHITECTURE.md) — Diagrama de componentes, motores e integración nativa.
- 🛡️ [Informe de Auditoría de Seguridad](./docs/SECURITY_AUDIT.md) — Verificación empírica de 0% datos ficticios.
- 📜 [Especificación de Protocolos](./docs/PROTOCOL_SPECIFICATION.md) — Detalles del protocolo criptográfico y sobres Mesh.
- 🛜 [Conectividad Offline](./docs/OFFLINE_CONNECTIVITY.md) — Especificación de BLE, WiFi Direct, LoRa y SoundMesh.
- 📐 [Especificación Matemática](./docs/MATHEMATICAL_SPECIFICATION.md) — Modelo de cuerpos de Galois $GF(2^8)$ y dispersión en malla.
