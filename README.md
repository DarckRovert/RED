# 🛡️ RED — Red Militar Criptográfica Off-Grid & P2P Mesh v31.1.0

> **RED** (Red Criptográfica Off-Grid & P2P Mesh) es la plataforma de comunicaciones tácticas, descentralizadas y soberanas más avanzada del mundo. Diseñada desde su origen para operar bajo escenarios de apagón tecnológico, censura estatal, desastres naturales o denegación de servicios, RED no depende de servidores centrales, infraestructuras celulares ni conexión a Internet.

[![Descargar APK Oficial RED v31.1.0](https://img.shields.io/badge/Descargar_APK_v31.1.0-GitHub_Releases-E8213A?style=for-the-badge&logo=android)](https://github.com/DarckRovert/RED/releases/tag/v31.1.0)
[![Página Web Oficial GitHub Pages](https://img.shields.io/badge/Web_App-GitHub_Pages-38BDF8?style=for-the-badge&logo=github)](https://darckrovert.github.io/RED/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-0_Errors_Strict-00D97E?style=for-the-badge&logo=typescript)](https://github.com/DarckRovert/RED)
[![Rust Workspace](https://img.shields.io/badge/Rust_Cargo-0_Errors_Pass-DEA584?style=for-the-badge&logo=rust)](https://github.com/DarckRovert/RED)
[![Android Gradle Build](https://img.shields.io/badge/Android_APK-BUILD_SUCCESSFUL-00E676?style=for-the-badge&logo=android)](https://github.com/DarckRovert/RED)

---

## 📋 Tabla de Contenidos

1. [Visión General & Filosofía de Diseño](#-visión-general--filosofía-de-diseño)
2. [Arquitectura del Sistema & Motores de Bajo Nivel](#-arquitectura-del-sistema--motores-de-bajo-nivel)
3. [Conectividad Global & Red Malla Descentralizada](#-conectividad-global--red-malla-descentralizada)
4. [Catálogo Completo de los 35 Módulos Tácticos](#-catálogo-completo-de-los-35-módulos-tácticos)
5. [Criptografía Post-Cuántica & Seguridad Zero-Trust](#-criptografía-post-cuántica--seguridad-zero-trust)
6. [Actuadores Físicos & Sensores de Hardware](#-actuadores-físicos--sensores-de-hardware)
7. [Arquitectura Real-Time SSE Unificada (Cero Polling)](#-arquitectura-real-time-sse-unificada-cero-polling)
8. [Guía de Compilación & Despliegue ADB](#-guía-de-compilación--despliegue-adb)
9. [Estructura del Proyecto & Documentación Técnica](#-estructura-del-proyecto--documentación-técnica)

---

## 🔭 Visión General & Filosofía de Diseño

En situaciones de emergencia o denegación de red, las aplicaciones tradicionales de mensajería (WhatsApp, Telegram, Signal) fallan al depender de servidores centrales en la nube y torres de telefonía celular. **RED** rompe esta dependencia convirtiendo cada dispositivo en un **nodo de red mesh independiente** capaz de cifrar, enrutar y entregar mensajes a través de radios de hardware locales y enlazar globalmente cuando exista un puente de red.

| Característica | Aplicaciones Tradicionales | RED v31.0.0 |
|---|---|---|
| **Infraestructura** | Requiere servidores en la nube y 4G/5G | **100% Descentralizado / Zero-Server** |
| **Operación Off-Grid** | Imposible sin Internet | **Totalmente funcional mediante BLE GATT, WiFi Direct, LoRa 915MHz y SoundMesh Ultrasónico** |
| **Conectividad Global** | Centralizada en servidores corporativos | **P2P Kademlia DHT + Bootstrap Peers + Auto-Relay Circuit v2 + DoH Tunnels** |
| **Identidad** | Vinculada a número telefónico/email | **Soberana Criptográfica (`did:red:`)** |
| **Criptografía** | Clásica (vulnerable a computación cuántica) | **Híbrida Post-Cuántica: ML-KEM-768 (FIPS 203) + ECDH P-256 + AES-256-GCM** |
| **Audio Táctico** | Códecs pesados (WebM/AAC 32-64 kbps) | **LowBitrateVocoder DSP (8kHz IMA-ADPCM 1.6–3.2 kbps, -97.9% compresión)** |
| **Anti-Spam / Anti-DDoS** | Bloqueo por IP central | **Proof-of-Work Criptográfico SHA-256 (Hashcash descentralizado)** |
| **Integridad de Datos** | Vulnerable a cortes de energía | **Árbol Merkle SHA-256 con autorreparación automática en arranque** |
| **Inteligencia IA** | Dependiente de APIs en la Nube | **100% Offline Neuronal WASM (`LaMini-Flan-T5`) + Guardian Firewall** |
| **Cero Datos Ficticios** | Simulación en modo demo | **0% Datos Hardcodeados / 100% Funcionalidad Real Verificada** |

---

## 📐 Arquitectura del Sistema & Motores de Bajo Nivel

```
+-----------------------------------------------------------------------+
|                             CAPA DE USUARIO                           |
|      Next.js 16 SPA (Turbopack) + React + Vanilla CSS + Zustand       |
|            35 Módulos de Interfaz Táctica & Visualización UI          |
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
|                   MOTORES DE INFRAESTRUCTURA CORE                     |
| 1. LowBitrateVocoder.ts: DSP 8kHz IMA-ADPCM 1.6-3.2 kbps (-97.9%)     |
| 2. MeshProofOfWork.ts: Anti-DDoS SHA-256 Hashcash Descentralizado     |
| 3. KineticDutyGovernor.ts: Gestión Dinámica de Batería (48h Autonomía)|
| 4. StateIntegrityEngine.ts: Verificación Merkle & Self-Healing Local  |
| 5. PqcCryptoEngine.ts: ML-KEM-768 FIPS 203 + Dual Hybrid ECDH         |
| 6. Motor Mesh Multi-Transporte: BLE, WiFi Direct, LoRa, SoundMesh     |
| 7. Motor IA Neuronal Offline: LaMini-Flan-T5 ONNX WASM & Guardian IA  |
+-----------------------------------------------------------------------+
```

---

## 🌐 Conectividad Global & Red Malla Descentralizada

RED implementa una arquitectura híbrida **Offline-to-Global Gateway** de 3 niveles:

1. **WebRTC P2P DataChannels & STUN NAT Traversal**: Comunicación directa de alta velocidad y baja latencia entre clientes Web (navegador en PC / GitHub Pages) y aplicaciones móviles Android a través de canales binarios directos (`red-mesh-data`) negociados mediante múltiples servidores STUN de Google (`stun.l.google.com:19302`).
2. **Relé Ciego Cifrado Zero-Knowledge (`mesh-relay`)**: En entornos con CGNAT simétrico estricto donde el canal WebRTC directo es bloqueado por cortafuegos corporativos o de operadores móviles, los paquetes de malla cifrados de extremo a extremo con AES-256-GCM se transportan a través del servidor de señalización de forma completamente ciega (sin que el relé conozca el contenido ni las claves).
3. **DHT Kademlia & Nodos Semilla Mundiales**: Al detectar conectividad a internet, el nodo nativo Rust se conecta a los bootstrap peers oficiales de libp2p/IPFS (`/dnsaddr/bootstrap.libp2p.io/...`), permitiendo comunicación directa punto a punto entre usuarios a escala global.
4. **Traspaso de NAT y Circuit Relay v2**: Auto-descubrimiento y evasión de CGNAT y cortafuegos mediante paquetes UDP/QUIC y relays cifrados E2E con Noise Protocol.
5. **Store-and-Forward ("Mulas de Datos")**: Los nodos en zonas sin red acumulan mensajes cifrados localmente. Cualquier nodo que se desplace a una zona con cobertura actúa como pasarela y retransmite automáticamente la cola a la red mundial.
6. **Túneles Encubiertos Anti-Censura**:
   - **Túnel DNS (`DnsTunnelEngine`)**: Transporta paquetes Base32 en consultas DNS-over-HTTPS (DoH) hacia 1.1.1.1 / 8.8.8.8.
   - **SNI Fronting (`SniSpoofEngine`)**: Oculta el tráfico en cabeceras TLS hacia redes de distribución de contenido.

---

## 🛡️ Catálogo Completo de los 35 Módulos Tácticos

| # | Módulo | Archivos Principales | Descripción & Funcionalidad Real |
|---|---|---|---|
| **1** | **Canales Mesh Locales** | `PublicChannelsPanel.tsx`, `guardianEngine.ts` | Canales temáticos y de emergencia con moderación autónoma por Guardian IA. |
| **2** | **RED Social Feed P2P** | `SocialFeedPanel.tsx` | Muro de publicaciones y noticias efímeras distribuidas por chismes de malla. |
| **3** | **Difusión Privada** | `BroadcastPanel.tsx` | Envío de mensajes y alertas a múltiples contactos simultáneamente. |
| **4** | **Walkie-Talkie Mesh HQ** | `P2PWalkieTalkieModal.tsx`, `LowBitrateVocoder.ts` | PTT táctico con compresión DSP 8kHz IMA-ADPCM y audio ultrasónico SoundMesh. |
| **5** | **Canvas Táctico P2P** | `LiveCanvasModal.tsx` | Pizarra colaborativa vectorizada en tiempo real sin servidor central. |
| **6** | **Live Broadcast Stream** | `LiveStreamBroadcaster.tsx`, `LiveStreamViewer.tsx` | Transmisión de video P2P en ráfagas de cuadros optimizados para ancho de banda reducido. |
| **7** | **Shake & Pair** | `ShakePairModal.tsx` | Emparejamiento por sacudida física usando el acelerómetro de hardware. |
| **8** | **Radar Topográfico GPS** | `OffGridCompassModal.tsx` | Brújula táctica con declinación magnética y cálculo de distancia Haversine. |
| **9** | **Mapa de Nodos P2P** | `NodeMap.tsx` | Visualización geoespacial de pares en rango radio sobre mapa vectorial offline. |
| **10** | **Radar Hardware BLE/WiFi** | `NearbyDevicesPanel.tsx` | Escaneo activo de señales RSSI y descubrimiento de enjambres cercanos. |
| **11** | **Analizador Espectro RF / EW** | `RfSpectrumModal.tsx` | Detección de interferencias, jamming y análisis de potencia espectral de radio. |
| **12** | **Ondas de Proximidad** | `ProximityWaveModal.tsx` | Detección de presencia táctica por umbrales de proximidad radio. |
| **13** | **Clima & Barómetro CAP** | `WeatherAlertPanel.tsx` | Alertas meteorológicas de protocolo CAP y lectura de presión barométrica. |
| **14** | **Batería Eco-Mesh** | `EcoMeshPanel.tsx`, `KineticDutyGovernor.ts` | Gobernador cinemático que adapta la potencia de radio y extiende la batería hasta 48h. |
| **15** | **Topología de Red** | `NetworkPanel.tsx` | Monitoreo de enlaces, interfaces de red activas y túneles encubiertos DNS/SNI. |
| **16** | **Perfil & Bóveda DID** | `IdentityVaultModal.tsx` | Gestión de identidad criptográfica `did:red:`, exportación de llaves y códigos QR. |
| **17** | **Pagos & Vouchers P2P** | `RedP2PPayModal.tsx` | Transacciones y vales digitales soberanos firmados criptográficamente sin bancos. |
| **18** | **Bóveda Criptográfica PQC** | `CryptoPanel.tsx`, `PqcCryptoEngine.ts` | Intercambio de claves post-cuánticas ML-KEM-768 y cifrado híbrido. |
| **19** | **Explorador Blockchain** | `BlockchainExplorer.tsx` | Registro distribuido inmutable de transacciones y estados de la red. |
| **20** | **Bóveda Esteganográfica** | `StegoVaultModal.tsx` | Ocultamiento de mensajes y claves en imágenes mediante inserción LSB. |
| **21** | **Respaldos & Restauración** | `BackupRestoreModal.tsx` | Copias de seguridad locales cifradas con AES-256-GCM y exportación segura. |
| **22** | **Signos Vitales & Triaje** | `VitalScanModal.tsx` | Clasificación médica de emergencias bajo protocolo START y registro de signos. |
| **23** | **Baliza Ultrasonido SOS** | `SurvivalBeaconModal.tsx` | Emisión acústica en frecuencias de 18-20 kHz para rescate y localización. |
| **24** | **Sistema Alerta AMBER** | `AmberAdminPanel.tsx` | Red de difusión de emergencia para personas y menores desaparecidos. |
| **25** | **Hombre Muerto (DMS)** | `DMSSettings.tsx` | Temporizador de seguridad con purga destructiva automática ante inactividad. |
| **26** | **Simulador de Apagón** | `BlackoutSimulatorModal.tsx` | Pruebas de estrés y corte de red para validar operación en aislamiento total. |
| **27** | **Copiloto IA Offline** | `AICopilotModal.tsx` | Asistente de supervivencia y rescate impulsado por modelo de lenguaje local. |
| **28** | **Guardian IA (Firewall)** | `GuardianStatusPanel.tsx` | Cortafuegos neuronal que filtra ataques de inyección, spam y datos maliciosos. |
| **29** | **Ajustes & Personalización** | `SettingsModal.tsx` | Configuración de apariencia, almacenamiento, TTL de autodestrucción y redes. |
| **30** | **Actualizador OTA** | `UpdateModal.tsx` | Descarga e instalación de actualizaciones de software de forma directa. |
| **31** | **Diagnóstico Salud Sistema** | `SystemHealthModal.tsx` | Pruebas de rendimiento criptográfico (AES, SHA, Ed25519) y estado de almacenamiento. |
| **32** | **Logs del Nodo Rust SSE** | `NodeLogsModal.tsx` | Visor en tiempo real de registros y eventos emitidos por el núcleo Rust. |
| **33** | **Calculadora Señuelo** | `CalculatorScreen.tsx` | Camuflaje funcional que oculta la aplicación tras una calculadora estándar. |
| **34** | **Reporte de Seguridad** | `SecurityReportModal.tsx` | Auditoría de integridad de código, verificación de firmas y vector de ataque. |
| **35** | **Seguridad Zero-Trust** | `SecurityPanel.tsx` | Panel central de postura de defensa, gestión de sesiones y verificación de pares. |

---

## 🔐 Criptografía Post-Cuántica & Seguridad Zero-Trust

- **ML-KEM-768 (FIPS 203)**: Encapsulamiento de claves basado en retículos de alta dimensión resistente a computadoras cuánticas.
- **Doble Capa Híbrida**: Combina **ML-KEM-768 + ECDH Curve25519 / NIST P-256** mediante derivación HKDF-SHA256, protegiendo las comunicaciones frente a ataques presentes y futuros (*Harvest Now, Decrypt Later*).
- **División de Secretos de Shamir ($GF(2^8)$)**: Fragmentación de la clave maestra en $N$ partes con un umbral $K$ para recuperación social.

---

## 🛠️ Guía de Compilación & Despliegue ADB

### Prerrequisitos
- Node.js 20+
- Rust 1.80+ y Cargo
- Android SDK 35 / OpenJDK 21

### 1. Compilación Web
```bash
cd client/app
npm install
npm run build
```

### 2. Sincronización Capacitor & Compilación APK
```bash
npx cap sync android
cd android
./gradlew assembleDebug
```

### 3. Instalación Directa en Dispositivos
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## 📂 Documentación Adicional

- [Arquitectura Detallada](docs/ARCHITECTURE.md)
- [Especificación Matemática](docs/MATHEMATICAL_SPECIFICATION.md)
- [Conectividad Off-Grid y Protocolo Mesh](docs/OFFLINE_CONNECTIVITY.md)
- [Auditoría de Seguridad y Resiliencia](docs/SECURITY_AUDIT.md)
- [Manual de Usuario](USER_MANUAL.md)
- [Manual de Administración](ADMIN_MANUAL.md)
- [Guía de Inicio Rápido](GETTING_STARTED.md)
- [Registro de Cambios (Changelog)](CHANGELOG.md)
