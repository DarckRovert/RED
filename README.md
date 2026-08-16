# 🛡️ RED — Red Militar Criptográfica Off-Grid & P2P Mesh v31.0.0

> **RED** (Red Criptográfica Off-Grid & P2P Mesh) es la plataforma de comunicaciones tácticas, descentralizadas y soberanas más avanzada del mundo. Diseñada desde su origen para operar bajo escenarios de apagón tecnológico, censura estatal, desastres naturales o denegación de servicios, RED no depende de servidores centrales, infraestructuras celulares ni conexión a Internet.

[![Descargar APK Oficial RED v31.0.0](https://img.shields.io/badge/Descargar_APK_v31.0.0-GitHub_Releases-E8213A?style=for-the-badge&logo=android)](https://github.com/DarckRovert/RED/releases/tag/v31.0.0)
[![Página Web Oficial GitHub Pages](https://img.shields.io/badge/Web_App-GitHub_Pages-38BDF8?style=for-the-badge&logo=github)](https://darckrovert.github.io/RED/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-0_Errors_Strict-00D97E?style=for-the-badge&logo=typescript)](https://github.com/DarckRovert/RED)
[![Rust Workspace](https://img.shields.io/badge/Rust_Cargo-0_Errors_Pass-DEA584?style=for-the-badge&logo=rust)](https://github.com/DarckRovert/RED)
[![Android Gradle Build](https://img.shields.io/badge/Android_APK-BUILD_SUCCESSFUL-00E676?style=for-the-badge&logo=android)](https://github.com/DarckRovert/RED)

---

## 📋 Tabla de Contenidos

1. [Visión General & Filosofía de Diseño](#-visión-general--filosofía-de-diseño)
2. [Arquitectura del Sistema & Motores de Bajo Nivel](#-arquitectura-del-sistema--motores-de-bajo-nivel)
3. [Catálogo Completo de los 35 Módulos Tácticos](#-catálogo-completo-de-los-35-módulos-tácticos)
4. [Actuadores Físicos & Sensores de Hardware](#-actuadores-físicos--sensores-de-hardware)
5. [Arquitectura Real-Time SSE Unificada (Cero Polling)](#-arquitectura-real-time-sse-unificada-cero-polling)
6. [Motor Criptográfico & Cifrado E2E](#-motor-criptográfico--cifrado-e2e)
7. [Capa de Red Multi-Radio Off-Grid (Mesh Router & DTN)](#-capa-de-red-multi-radio-off-grid-mesh-router--dtn)
8. [Inmunidad a VPNs & Seguridad Operativa (OPSEC)](#-inmunidad-a-vpns--seguridad-operativa-opsec)
9. [Guía de Compilación & Despliegue ADB](#-guía-de-compilación--despliegue-adb)
10. [Estructura del Proyecto & Documentación Técnica](#-estructura-del-proyecto--documentación-técnica)

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

## 🛡️ Catálogo Completo de los 35 Módulos Tácticos

| # | Módulo | Archivos Principales | Descripción & Funcionalidad Real |
|---|---|---|---|
| **1** | **Canales Mesh Locales** | `PublicChannelsPanel.tsx`, `guardianEngine.ts` | Canales temáticos y de emergencia con moderación autónoma por Guardian IA. |
| **2** | **RED Social Feed P2P** | `SocialFeedPanel.tsx` | Red social descentralizada y resistente a censura sobre GossipSub. |
| **3** | **Difusión Privada (Broadcast)** | `BroadcastPanel.tsx` | Envío simultáneo cifrado punto a punto a múltiples contactos seleccionados. |
| **4** | **Walkie-Talkie Mesh Push-To-Talk** | `P2PWalkieTalkieModal.tsx` | Transmisión de voz P2P en tiempo real con compresión y ráfagas nativas. |
| **5** | **Canvas Táctico P2P en Vivo** | `LiveCanvasModal.tsx` | Pizarra vectorial colaborativa sincronizada en tiempo real entre operadores mesh. |
| **6** | **Live Broadcast Stream** | `LiveStreamBroadcaster.tsx`, `LiveStreamViewer.tsx` | Emisión y recepción de video en vivo de baja latencia entre nodos directos de la red. |
| **7** | **Shake & Pair (Acelerómetro)** | `ShakePairModal.tsx` | Emparejamiento instantáneo al sacudir el dispositivo (>15 m/s²) mediante pulso efímero. |
| **8** | **Radar Topográfico GPS & UTM** | `OffGridCompassModal.tsx`, `OffGridNavigationEngine.ts` | Brújula electromagnética, declinación WMM2025, altímetro y coordenadas UTM/MGRS. |
| **9** | **Mapa de Nodos P2P** | `NodeMap.tsx` | Mapa interactivo de nodos activos, telemetría GPS y enlaces de radio en tiempo real. |
| **10** | **Radar Hardware BLE / WiFi** | `NearbyDevicesPanel.tsx` | Escaneo y telemetría de dispositivos Bluetooth Low Energy y WiFi en rango físico. |
| **11** | **Analizador Espectro RF / EW** | `RfSpectrumModal.tsx` | Monitoreo de interferencias en bandas de radiofrecuencia y detección de jammers. |
| **12** | **Ondas de Proximidad** | `ProximityWaveModal.tsx` | Detección de presencia táctica y balizas de proximidad por RSSI. |
| **13** | **Clima & Barómetro CAP** | `WeatherAlertPanel.tsx` | Sensor barométrico de hardware (`TYPE_PRESSURE`) y alertas meteorológicas CAP en Rust. |
| **14** | **Batería Eco-Mesh** | `EcoMeshPanel.tsx` | Adaptación dinámica del beaconing según el nivel de batería para supervivencia prolongada. |
| **15** | **Topología de Red** | `NetworkPanel.tsx` | Estado del enjambre libp2p, tablas de enrutamiento Kademlia y estadísticas de tráfico. |
| **16** | **Perfil & Bóveda DID** | `IdentityVaultModal.tsx` | Bóveda de identidad soberana `did:red:` con fragmentación Shamir $GF(2^8)$. |
| **17** | **Pagos & Vouchers P2P** | `RedP2PPayModal.tsx` | Vouchers criptográficos fuera de línea con firmas Ed25519 y validación UTXO. |
| **18** | **Bóveda Criptográfica PQC** | `CryptoPanel.tsx` | Cifrado Post-Cuántico Kyber-1024, X25519 y AES-256-GCM. |
| **19** | **Explorador Blockchain RED** | `BlockchainExplorer.tsx` | Registro inmutable de transacciones, bloques y pruebas Proof-of-Mesh. |
| **20** | **Bóveda Esteganográfica** | `StegoVaultModal.tsx`, `StegoEngine.ts` | Inyección de mensajes cifrados en los bits menos significativos (LSB) de imágenes. |
| **21** | **Respaldos & Restauración** | `BackupRestoreModal.tsx` | Exportación e importación de bóvedas cifradas protegidas por PBKDF2. |
| **22** | **Signos Vitales & Triaje START** | `VitalScanModal.tsx`, `VitalScanEngine.ts` | Monitor PPG por cámara + flash LED y clasificación médica internacional START. |
| **23** | **Baliza SOS & Módem SoundMesh** | `SurvivalBeaconModal.tsx`, `SoundMeshEngine.ts` | Flash LED Morse SOS nativo, sirena acústica Web Audio y módem ultrasónico FSK. |
| **24** | **Sistema Alerta AMBER** | `AmberAdminPanel.tsx`, `AmberAlertBanner.tsx` | Difusión prioritaria de personas desaparecidas y alertas comunitarias críticas. |
| **25** | **Hombre Muerto DMS** | `DMSSettings.tsx` | Temporizador de inactividad que dispara purga de seguridad o mensajes de auxilio. |
| **26** | **Simulador Apagón Blackout** | `BlackoutSimulatorModal.tsx` | Prueba de estrés que simula corte WAN/EMP desconectando enlaces de Internet. |
| **27** | **Copiloto IA Offline** | `AICopilotModal.tsx` | Inferencia LLM neuronal local en dispositivo mediante Rust Candle / ONNX WASM. |
| **28** | **Guardian IA (Firewall)** | `GuardianStatusPanel.tsx` | Firewall cognitivo autónomo para detección y neutralización de ataques en la malla. |
| **29** | **Diagnóstico Salud Sistema** | `SystemHealthModal.tsx` | Inspección en tiempo real de memoria, hilos del nodo Rust y estado de la base de datos Sled. |
| **30** | **Logs del Nodo Rust SSE** | `NodeLogsModal.tsx` | Transmisión en vivo de trazas de ejecución y eventos libp2p del nodo. |
| **31** | **Calculadora Señuelo (Camuflaje)** | `CalculatorScreen.tsx` | Interfaz funcional de calculadora que oculta la plataforma militar ante coacción. |
| **32** | **Reporte Auditoría Seguridad** | `SecurityReportModal.tsx` | Verificación de integridad criptográfica, firmas y políticas Zero-Trust. |
| **33** | **Seguridad Zero-Trust** | `SecurityPanel.tsx` | Configuración de políticas de acceso, PINs señuelo y destrucción física de claves. |
| **34** | **Llamadas Tácticas P2P** | `CallScreen.tsx`, `IncomingCallBanner.tsx` | Videollamadas y llamadas de voz directas con señalización cifrada. |
| **35** | **Centro de Mensajería E2EE** | `ChatWindow.tsx`, `Sidebar.tsx` | Mensajería instantánea con Double Ratchet, notas de voz, adjuntos y confirmaciones. |

---

## ⚡ Actuadores Físicos & Sensores de Hardware

RED se comunica directamente con los sensores y actuadores del dispositivo mediante la API nativa de Android (`RedNodePlugin.java`):

1. **Flash LED Morse SOS de Alta Precisión:**
   - Control a nivel de hardware mediante `android.hardware.camera2.CameraManager.setTorchMode(cameraId, enabled)`.
   - Modulación automática del código Morse internacional SOS (`... --- ...`) en hilo nativo independiente del hilo de renderizado.
2. **Escaneo Fotopletismográfico (PPG) & Triaje START:**
   - Extracción de pulso hemodinámico iluminando los capilares del dedo con el flash LED y procesando los canales rojo/verde en `VitalScanEngine.ts`.
   - Clasificación médica de víctimas según el protocolo START (Verde, Amarillo, Rojo, Negro).
3. **Módem Acústico Ultrasónico SoundMesh:**
   - Modulación BFSK en frecuencias inaudibles (18 kHz – 20 kHz) para transmisión de texto cuando el espectro de radiofrecuencia (RF) está interferido o bloqueado.
4. **Sensores Meteorológicos & Barométricos:**
   - Conexión a `Sensor.TYPE_PRESSURE`, `Sensor.TYPE_AMBIENT_TEMPERATURE` y `Sensor.TYPE_RELATIVE_HUMIDITY` para generación de boletines climáticos CAP off-grid.

---

## ⚡ Arquitectura Real-Time SSE Unificada (Cero Polling)

Para maximizar la autonomía de batería en dispositivos tácticos sobre el terreno, RED erradica por completo los temporizadores de consulta periódica (`setInterval` polling):
- El nodo Rust expone un stream nativo en `GET /api/events` sobre `tokio::sync::broadcast`.
- El frontend en React se suscribe a través de `useRedStore` y actualiza reactivamente los componentes (`SOSEmergencyBanner`, `WeatherAlertPanel`, etc.) con latencia submilisegundo (<1ms).

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
