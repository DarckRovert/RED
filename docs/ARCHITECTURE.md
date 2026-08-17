# 🏗️ Especificación Arquitectónica de RED v31.0.0

Este documento contiene la especificación arquitectónica detallada de **RED**, incluyendo la estructura del motor Rust nativo, la capa de bindings JNI para Android, los transportes de radio de hardware, los actuadores de hardware nativo (`CameraManager`), el motor de eventos SSE unificado, los 4 motores de infraestructura táctica y la arquitectura completa de los 35 módulos de interfaz.

---

## 📋 Tabla de Contenidos

1. [Visión General de Capas](#1-visión-general-de-capas)
2. [Capa Nativa Android & Actuadores Hardware](#2-capa-nativa-android--actuadores-hardware)
3. [Motores de Infraestructura Táctica (DSP, PoW, Batería, Merkle)](#3-motores-de-infraestructura-táctica)
4. [Motor Criptográfico Nativo & Post-Cuántica (PQC)](#4-motor-criptográfico-nativo--post-cuántica-pqc)
5. [Capa de Red Mesh Multi-Radio & Conectividad Global](#5-capa-de-red-mesh-multi-radio--conectividad-global)
6. [Motor de IA Neuronal Off-Grid ONNX WASM](#6-motor-de-ia-neuronal-off-grid-onnx-wasm)
7. [Desglose Arquitectónico de los 35 Módulos Tácticos](#7-desglose-arquitectónico-de-los-35-módulos-tácticos)
8. [Capa de Almacenamiento & Cifrado en Disco](#8-capa-de-almacenamiento--cifrado-en-disco)
9. [Endpoints de la API Axum REST & SSE](#9-endpoints-de-la-api-axum-rest--sse)

---

## 1. Visión General de Capas

```
+-----------------------------------------------------------------------+
|                    CAPA DE PRESENTACIÓN (FRONTEND)                    |
|      Next.js 16 SPA (Turbopack) + React 19 + Zustand Store + CSS      |
|           35 Módulos de Interfaz Táctica & Visualización UI           |
+-----------------------------------------------------------------------+
                                   │
              HTTP REST / SSE (http://127.0.0.1:7333/api)
                                   ▼
+-----------------------------------------------------------------------+
|                    CAPA NATIVA ANDROID (MIDDLEWARE)                   |
|       RedNodeService.java (Foreground) + RedNodePlugin.java (JNI)     |
|   Camera2 API (Flash LED Morse SOS) + Sensors (Barometer, Compass)    |
|    GATT Server / BleTransport + Direct Native HTTP POST Mesh Inject   |
+-----------------------------------------------------------------------+
                                   │
                          JNI Bindings (Rust C-ABI)
                                   ▼
+-----------------------------------------------------------------------+
|                      MOTOR NATIVO RUST (CORE)                         |
|     red_mobile (Axum REST API + SSE) + red_core (Protocol Engine)    |
|   Noise XK Handshake + Ed25519 Signatures + ChaCha20-Poly1305 E2E     |
|     red-blockchain (Proof-of-Mesh UTXO) + Sled Embedded Storage       |
+-----------------------------------------------------------------------+
                                   │
              TRANSPORTE MULTI-RADIO AD-HOC OFF-GRID & GLOBAL
       +---------------------+---------------+--------------------+
       | BLE GATT (Physical) | WiFi Direct   | LoRa 915MHz / Sound|
       +---------------------+---------------+--------------------+
       | libp2p Kademlia DHT | Circuit Relay | DoH / SNI Tunnels  |
       +---------------------+---------------+--------------------+
```

---

## 2. Capa Nativa Android & Actuadores Hardware

- **`RedNodeService.java`**: Servicio en primer plano (*Foreground Service*) que registra un canal de notificaciones persistente para evitar que el sistema operativo mate el nodo.
  - Administra el **GATT Server BLE** escuchando solicitudes en las características `RED_BLE_RX_CHAR` y `RED_BLE_TX_CHAR`.
  - Inyecta directamente tramas capturadas por radio hacia el servidor Axum en `http://127.0.0.1:7333/api/mesh/receive`.
- **`RedNodePlugin.java`**: Plugin de Capacitor que expone las funciones JNI de Rust a JavaScript (`start`, `destroy`), control de antorcha Flash LED para pulsos Morse militares SOS (`setTorchMode`) y eventos `bleMessageReceived`.

---

## 3. Motores de Infraestructura Táctica

1. **`LowBitrateVocoder.ts` (DSP de Voz Táctica 8kHz IMA-ADPCM)**:
   - Remuestrea a 8000 Hz 16-bit Mono PCM, aplica pre-énfasis vocal y comprime audio a 1.6–3.2 kbps con cuantización ADPCM de 4 bits.
   - **Ratio de compresión de -97.9%**, permitiendo voz táctica sobre enlaces LoRaWAN y módem acústico ultrasónico SoundMesh.
2. **`MeshProofOfWork.ts` (Hashcash PoW SHA-256 Anti-DDoS)**:
   - Resuelve retos criptográficos matemáticos antes de emitir paquetes a la malla, blindando la red contra inundaciones y spam sin requerir servidores centrales.
3. **`KineticDutyGovernor.ts` (Gobernador Cinemático de Batería)**:
   - Analiza la varianza de aceleración RMS del dispositivo y estado de batería para conmutar perfiles de escaneo radio (800ms a 12s), extendiendo la autonomía hasta 48 horas.
4. **`StateIntegrityEngine.ts` (Verificador Merkle & Self-Healing)**:
   - Valida la raíz Merkle SHA-256 del almacenamiento local en el arranque y aísla registros dañados en cuarentena para autorreparar la base de datos tras apagones abruptos.

---

## 4. Motor Criptográfico Nativo & Post-Cuántica (PQC)

- **ML-KEM-768 (FIPS 203) & Doble Híbrido**: Encapsulamiento de claves basado en retículos combinado con **ECDH P-256 / X25519** y derivación HKDF-SHA256.
- **Identidad Soberana**: Derivación determinista mediante curva **Ed25519** (`did:red:`).
- **Cifrado Simétrico**: **AES-256-GCM** y **ChaCha20-Poly1305** para tramas en vuelo.
- **División de Secretos de Shamir**: Esquema $(k, n)$ sobre $GF(2^8)$ con polinomio irreducible $x^8 + x^4 + x^3 + x + 1$.

---

## 5. Capa de Red Mesh Multi-Radio & Conectividad Global

- **Bluetooth Low Energy (BLE)**: Operación en modo Periférico y Central simultáneo. Advertising con UUID `00001818-0000-1000-8000-00805f9b34fb`.
- **WiFi Direct**: Descubrimiento P2P mediante DataChannels WebRTC locales.
- **Módems LoRa (915 MHz)**: Puente de comunicación de largo alcance.
- **SoundMesh Ultrasonido**: Módem acústico en 18–20 kHz BFSK para entornos de denegación total de RF.
- **Conectividad Global (libp2p)**: Kademlia DHT con nodos semilla mundiales (`bootstrap.libp2p.io`), Auto-Relay Circuit v2 para atravesar CGNAT, y túneles encubiertos DNS-over-HTTPS (`DnsTunnelEngine`) y SNI Fronting (`SniSpoofEngine`).

---

## 6. Motor de IA Neuronal Off-Grid ONNX WASM

- Inferencia neuronal local en el dispositivo mediante `LaMini-Flan-T5` empaquetado en WebAssembly/ONNX Runtime.
- **Guardian IA (`guardianEngine.ts`)**: Cortafuegos cognitivo que audita en tiempo real mensajes y contenidos para evitar inyecciones de código y spam en canales públicos.

---

## 7. Desglose Arquitectónico de los 35 Módulos Tácticos

1. **Canales Mesh Locales (`PublicChannelsPanel.tsx`)**: Canales temáticos y de emergencia.
2. **RED Social Feed P2P (`SocialFeedPanel.tsx`)**: Muro de noticias distribuidas por chismes de malla.
3. **Difusión Privada (`BroadcastPanel.tsx`)**: Envío de alertas a múltiples contactos.
4. **Walkie-Talkie Mesh HQ (`P2PWalkieTalkieModal.tsx`)**: PTT táctico con compresión DSP Vocoder.
5. **Canvas Táctico P2P (`LiveCanvasModal.tsx`)**: Pizarra colaborativa vectorizada.
6. **Live Broadcast Stream (`LiveStreamBroadcaster.tsx`, `LiveStreamViewer.tsx`)**: Transmisión de video P2P.
7. **Shake & Pair (`ShakePairModal.tsx`)**: Emparejamiento por acelerómetro.
8. **Radar Topográfico GPS (`OffGridCompassModal.tsx`)**: Brújula táctica con declinación magnética y cálculo Haversine.
9. **Mapa de Nodos P2P (`NodeMap.tsx`)**: Visualización geoespacial en mapa vectorial offline.
10. **Radar Hardware BLE/WiFi (`NearbyDevicesPanel.tsx`)**: Descubrimiento y medición de RSSI.
11. **Analizador Espectro RF / EW (`RfSpectrumModal.tsx`)**: Detección de interferencias y jamming.
12. **Ondas de Proximidad (`ProximityWaveModal.tsx`)**: Detección de presencia táctica.
13. **Clima & Barómetro CAP (`WeatherAlertPanel.tsx`)**: Alertas meteorológicas CAP.
14. **Batería Eco-Mesh (`EcoMeshPanel.tsx`)**: Gobernador cinemático de consumo de energía.
15. **Topología de Red (`NetworkPanel.tsx`)**: Monitoreo de enjambre y túneles encubiertos.
16. **Perfil & Bóveda DID (`IdentityVaultModal.tsx`)**: Gestión de identidad soberana y Shamir.
17. **Pagos & Vouchers P2P (`RedP2PPayModal.tsx`)**: Vales digitales fuera de línea.
18. **Bóveda Criptográfica PQC (`CryptoPanel.tsx`)**: Intercambio de claves post-cuánticas ML-KEM-768.
19. **Explorador Blockchain (`BlockchainExplorer.tsx`)**: Libro contable distribuido.
20. **Bóveda Esteganográfica (`StegoVaultModal.tsx`)**: Ocultamiento en imágenes por inserción LSB.
21. **Respaldos & Restauración (`BackupRestoreModal.tsx`)**: Copias de seguridad cifradas con AES-256-GCM.
22. **Signos Vitales & Triaje START (`VitalScanModal.tsx`)**: Medición fotopletismográfica (PPG) y triaje médico.
23. **Baliza Ultrasonido SOS (`SurvivalBeaconModal.tsx`)**: Emisión acústica en 18-20 kHz y pulsos Morse.
24. **Sistema Alerta AMBER (`AmberAdminPanel.tsx`)**: Difusión de emergencia comunitaria.
25. **Hombre Muerto DMS (`DMSSettings.tsx`)**: Temporizador de seguridad con purga destructiva.
26. **Simulador Apagón Blackout (`BlackoutSimulatorModal.tsx`)**: Pruebas de estrés en aislamiento de red.
27. **Copiloto IA Offline (`AICopilotModal.tsx`)**: Asistente táctico local impulsado por LLM en memoria.
28. **Guardian IA (Firewall) (`GuardianStatusPanel.tsx`)**: Cortafuegos de contenido en canales.
29. **Ajustes & Personalización (`SettingsModal.tsx`)**: Configuración global de la app.
30. **Actualizador OTA (`UpdateModal.tsx`)**: Instalación de actualizaciones de software in-app.
31. **Diagnóstico Salud Sistema (`SystemHealthModal.tsx`)**: Benchmarks de rendimiento criptográfico y almacenamiento.
32. **Logs del Nodo Rust SSE (`NodeLogsModal.tsx`)**: Visor de registros del núcleo en tiempo real.
33. **Calculadora Señuelo (`CalculatorScreen.tsx`)**: Pantalla de camuflaje operativo.
34. **Reporte Auditoría Seguridad (`SecurityReportModal.tsx`)**: Informe Zero-Trust de integridad.
35. **Seguridad Zero-Trust (`SecurityPanel.tsx`)**: Gestión de PINs, bloqueo de capturas y políticas de defensa.

---

## 8. Capa de Almacenamiento & Cifrado en Disco

- Base de datos embebida **Sled / SQLite** cifrada con claves derivadas de la contraseña maestra mediante **PBKDF2**.
- Árbol **Merkle SHA-256** para auditoría y autorreparación automática de integridad en tiempo real.

---

## 9. Endpoints de la API Axum REST & SSE

- `GET /api/status`: Estado del nodo, conteo de pares y altura de cadena.
- `GET /api/events`: Flujo reactivo SSE unificado (<1ms) para mensajes, balizas y alertas.
- `POST /api/messages`: Envío de mensajes cifrados P2P.
- `POST /api/mesh/receive`: Inyección directa de tramas de hardware capturadas por BLE/WiFi Direct/LoRa.
