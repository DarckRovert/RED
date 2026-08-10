# 🏗️ Especificación Arquitectónica de RED v30.0.0

Este documento contiene la especificación arquitectónica detallada de **RED**, incluyendo la estructura del motor Rust nativo, la capa de bindings JNI para Android, los transportes de radio de hardware, el motor de IA Neuronal ONNX WASM local y la arquitectura completa de los 28 módulos de interfaz táctica.

---

## 📋 Tabla de Contenidos

1. [Visión General de Capas](#1-visión-general-de-capas)
2. [Capa Nativa Android & Servicio de Fondo Java](#2-capa-nativa-android--servicio-de-fondo-java)
3. [Motor Criptográfico Nativo en Rust (`red_core` y `red_mobile`)](#3-motor-criptográfico-nativo-en-rust-red_core-y-red_mobile)
4. [Capa de Red Mesh Multi-Radio (GATT, WiFi Direct, LoRa, SoundMesh)](#4-capa-de-red-mesh-multi-radio-gatt-wifi-direct-lora-soundmesh)
5. [Motor de IA Neuronal Off-Grid ONNX WASM (`localAiEngine.ts`)](#5-motor-de-ia-neuronal-off-grid-onnx-wasm-localaienginets)
6. [Desglose Arquitectónico de los 28 Módulos Tácticos](#6-desglose-arquitectónico-de-los-28-módulos-tácticos)
7. [Capa de Almacenamiento & Cifrado en Disco](#7-capa-de-almacenamiento--cifrado-en-disco)
8. [Manejo de Estado SPA & Navegación (Next.js / Zustand)](#8-manejo-de-estado-spa--navegación-nextjs--zustand)
9. [Endpoints de la API Axum REST & SSE](#9-endpoints-de-la-api-axum-rest--sse)

---

## 1. Visión General de Capas

```
+-----------------------------------------------------------------------+
|                    CAPA DE PRESENTACIÓN (FRONTEND)                    |
|      Next.js 16 SPA (Turbopack) + React 19 + Zustand Store + CSS      |
|           28 Módulos de Interfaz Táctica & Visualización UI           |
+-----------------------------------------------------------------------+
                                   │
              HTTP REST / SSE (http://127.0.0.1:7333/api)
                                   ▼
+-----------------------------------------------------------------------+
|                    CAPA NATIVA ANDROID (MIDDLEWARE)                   |
|       RedNodeService.java (Foreground) + RedNodePlugin.java (JNI)      |
|    GATT Server / BleTransport + Direct Native HTTP POST Mesh Inject   |
+-----------------------------------------------------------------------+
                                   │
                          JNI Bindings (Rust C-ABI)
                                   ▼
+-----------------------------------------------------------------------+
|                      MOTOR NATIVO RUST (CORE)                         |
|     red_mobile (Axum REST API + SSE) + red_core (Protocol Engine)    |
|   Noise XK Handshake + Ed25519 Signatures + ChaCha20-Poly1305 E2E     |
+-----------------------------------------------------------------------+
                                   │
              TRANSPORTE MULTI-RADIO AD-HOC OFF-GRID
      +---------------------+---------------+--------------------+
      | BLE GATT (Physical) | WiFi Direct   | LoRa 915MHz / Sound|
      +---------------------+---------------+--------------------+
```

---

## 2. Capa Nativa Android & Servicio de Fondo Java

- **`RedNodeService.java`**: Proceso de servicio en primer plano (*Foreground Service*) que registra un canal de notificaciones persistente para evitar que el ahorrador de memoria de Android mate el nodo.
  - Administra el **GATT Server BLE** escuchando solicitudes de lectura/escritura en las características `RED_BLE_RX_CHAR` (`00002a6e...`) y `RED_BLE_TX_CHAR` (`00002a4d...`).
  - Ejecuta la función `injectNativeMeshPayload` que envía de forma directa e instantánea cualquier paquete de bytes capturado por la antena al servidor Rust Axum local en `http://127.0.0.1:7333/api/mesh/receive`.
- **`RedNodePlugin.java`**: Plugin de Capacitor que expone las funciones JNI de Rust a JavaScript (`start`, `destroy`) y emite el evento `bleMessageReceived` cuando se reciben tramas físicamente por Bluetooth.
- **`RedDisguisePlugin.java`**: Plugin nativo para alternar el componente de inicio (`MainActivity` vs `CalculatorAlias`) mediante `PackageManager.setComponentEnabledSetting`.

---

## 3. Motor Criptográfico Nativo en Rust (`red_core` y `red_mobile`)

El motor Rust está dividido en dos cajas (*crates*):

1. **`red_core`**:
   - **`identity`**: Generación y firma de llaves **Ed25519** para derivar el `IdentityHash` soberano (`did:red:`).
   - **`protocol`**: Implementación del Handshake **Noise XK**, intercambio de claves efímeras **X25519** y cifrado simétrico autenticado **AES-256-GCM** y **ChaCha20-Poly1305**.
   - **`storage`**: Base de datos SQLite cifrada mediante llaves derivadas de la contraseña maestra del usuario.
   - **`network`**: Algoritmo de enrutamiento por Inundación Controlada (*Controlled Flood Routing*) con deduplicación de nonces por 72 horas y TTL de 20 saltos.

2. **`red_mobile`**:
   - Expone las funciones de inicialización NDK JNI (`Java_f_red_app_RedNodePlugin_startNode`).
   - Inicia el servidor HTTP REST y Eventos SSE en **Axum** (`127.0.0.1:7333`).

---

## 4. Capa de Red Mesh Multi-Radio (GATT, WiFi Direct, LoRa, SoundMesh)

- **Bluetooth Low Energy (BLE)**: Operación en modo Periférico y Central simultáneo. Advertising con UUID `00001818-0000-1000-8000-00805f9b34fb`. Inmune al estado de redes IP o VPNs.
- **WiFi Direct**: Descubrimiento P2P mediante DataChannels WebRTC locales sin infraestructura de router.
- **Módems LoRa (915 MHz)**: Transmisión de paquetes por radio puente de serie para alcance de varios kilómetros.
- **SoundMesh Ultrasonido**: Módem acústico en 18-20 kHz BFSK que transmite texto corto modulando el altavoz del dispositivo.

---

## 5. Motor de IA Neuronal Off-Grid ONNX WASM (`localAiEngine.ts`)

- Inferencia neuronal offline en el cliente mediante el modelo `LaMini-Flan-T5` empaquetado en WebAssembly.
- **Guardian IA (`guardianEngine.ts`)**: Motor autónomo de moderación y filtrado sintáctico sobre canales públicos.

---

## 6. Desglose Arquitectónico de los 28 Módulos Tácticos

1. **OffGridCompassModal:** Brújula electromagnética MGRS/UTM y altímetro barométrico.
2. **VitalScanModal:** PPG fotopletismográfico espectral mediante cámara y linterna LED.
3. **SurvivalBeaconModal:** Baliza SOS de socorro GPS y módem acústico ultrasónico SoundMesh.
4. **AICopilotModal:** Inferencia neuronal local offline para consultas y resúmenes tácticos.
5. **ProximityWaveModal & ProximitySettingsModal:** Detección de presencia física por ultrasonido Doppler.
6. **LiveCanvasModal:** Pizarra táctica P2P sincronizada en tiempo real entre nodos.
7. **EcoMeshPanel:** Gestión adaptativa de energía según el nivel de batería.
8. **P2PWalkieTalkieModal:** Transmisión de voz P2P de baja latencia.
9. **AmberAdminPanel & AmberAlertBanner:** Sistema de alertas AMBER comunitarias cifradas.
10. **WeatherAlertPanel:** Boletines barométricos y alertas climáticas entre pares.
11. **PublicChannelsPanel:** Canales temáticos abiertos con moderación autónoma por Guardian IA.
12. **StegoVaultModal:** Esteganografía LSB y Matrix Encoding para ocultar datos en fotografías.
13. **StoriesBar, StoryCreator, StoryViewer:** Historias y publicaciones efímeras de 24 horas.
14. **LiveStreamBroadcaster & LiveStreamViewer:** Transmisión de video local P2P en vivo.
15. **VoiceMessage:** Notas de voz cifradas E2E comprimidas a 12 Kbps.
16. **PollMessage:** Votaciones tácticas P2P con recuento firmado criptográficamente.
17. **BackupRestoreModal:** Respaldos cifrados AES-256-GCM protegidos por PBKDF2.
18. **BlockchainExplorer:** Explorador de bloques y libro mayor inmutable de la red RED.
19. **RfSpectrumModal & RfSpectrumAnalyzerEngine:** Monitoreo de espectro radioeléctrico Sub-GHz/2.4GHz.
20. **NodeMap:** Mapa topográfico de posicionamiento GPS y telemetría RSSI de nodos mesh.
21. **DMSSettings & useRedStore:** Interruptor de hombre muerto con purga automática de claves e historial.
22. **IdentityVaultModal & ShamirSecretSharingEngine:** Datos médicos en Keystore y fragmentación SSS $GF(2^8)$ 3-de-5.
23. **AuthWall & SecurityPanel:** Autenticación de triple nivel (Master, Decoy, Panic PIN).
24. **meshRouter & localTransport:** Enrutador Controlled Flood (TTL 20) y colas Store-and-Forward.
25. **CallScreen & IncomingCallBanner:** Videollamadas P2P cifradas WebRTC con PIP flotante.
26. **GroupsPanel & GroupAdminModal:** Grupos cifrados federados con administración de miembros `SenderKey`.
27. **ChatWindow & MessageBubble:** Chat E2E en tiempo real con estados de entrega, citas y reacciones.
28. **StatusView & Sidebar:** Centro de control táctico, diagnósticos del nodo y navegación general.

---

## 7. Capa de Almacenamiento & Cifrado en Disco

- Los mensajes, contactos, grupos y llaves se persisten en una base de datos SQLite cifrada.
- Cada registro contiene metadatos de timestamp, estado de verificación, nonces de deduplicación e historial de retransmisión.

---

## 8. Manejo de Estado SPA & Navegación (Next.js / Zustand)

- **`useRedStore.ts`**: Store central Zustand que coordina la comunicación entre los componentes React, el servidor Rust Axum y los listeners de Capacitor.
- **Navegación Limpia `goBack`**:
  - `goBack()` restablece la pantalla a `sidebar` y limpia `activeConversationId: null`.
  - Escuchador del evento de hardware de Android (`Capacitor App backButton`) en `page.tsx` para garantizar que la tecla de retroceso vuelva limpiamente del chat a la lista principal.

---

## 9. Endpoints de la API Axum REST & SSE

- `GET /api/identity`: Retorna el `IdentityHash` soberano y la clave pública Ed25519.
- `GET /api/status`: Estado del nodo, altura de cadena, pares conectados y latencia gossip.
- `GET /api/conversations`: Lista de chats activos y contadores no leídos.
- `GET /api/contacts`: Contactos guardados y claves públicas `sender_pk`.
- `POST /api/messages/send`: Cifra y envía un paquete E2EE a través de la red mesh.
- `POST /api/groups`: Crea y federa un nuevo grupo P2P con clave compartida.
- `PUT /api/groups/:id`: Actualiza integrantes del grupo cifrado.
