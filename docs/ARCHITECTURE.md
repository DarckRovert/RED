# 🏗️ Especificación Arquitectónica de RED v30.0.0

Este documento contiene la especificación arquitectónica detallada de **RED**, incluyendo la estructura del motor Rust nativo, la capa de bindings JNI para Android, los transportes de radio de hardware, el motor de IA Neuronal ONNX WASM local y el sistema de gestión de estado en el cliente JavaScript.

---

## 📋 Tabla de Contenidos

1. [Visión General de Capas](#1-visión-general-de-capas)
2. [Capa Nativa Android & Servicio de Fondo Java](#2-capa-nativa-android--servicio-de-fondo-java)
3. [Motor Criptográfico Nativo en Rust (`red_core` y `red_mobile`)](#3-motor-criptográfico-nativo-en-rust-red_core-y-red_mobile)
4. [Capa de Red Mesh Multi-Radio (GATT, WiFi Direct, LoRa)](#4-capa-de-red-mesh-multi-radio-gatt-wifi-direct-lora)
5. [Motor de IA Neuronal Off-Grid ONNX WASM (`localAiEngine.ts`)](#5-motor-de-ia-neuronal-off-grid-onnx-wasm-localaienginets)
6. [Capa de Almacenamiento & Cifrado en Disco](#6-capa-de-almacenamiento--cifrado-en-disco)
7. [Manejo de Estado SPA & Navegación (Next.js / Zustand)](#7-manejo-de-estado-spa--navegación-nextjs--zustand)
8. [Endpoints de la API Axum REST & SSE](#8-endpoints-de-la-api-axum-rest--sse)

---

## 1. Visión General de Capas

```
+-----------------------------------------------------------------------+
|                    CAPA DE PRESENTACIÓN (FRONTEND)                    |
|      Next.js 16 SPA (Turbopack) + React 19 + Zustand Store + CSS      |
+-----------------------------------------------------------------------+
                                   │
              HTTP REST / SSE (http://127.0.0.1:7333)
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
     ┌─────────────────────┬───────────────┬────────────────────┐
     │ BLE GATT (Physical) │ WiFi Direct   │ LoRa Radio Serial  │
     └─────────────────────┴───────────────┴────────────────────┘
```

---

## 2. Capa Nativa Android & Servicio de Fondo Java

- **`RedNodeService.java`**: Proceso de servicio en primer plano (*Foreground Service*) que registra un canal de notificaciones persistente para evitar que el ahorrador de memoria de Android mate el nodo.
  - Administra el **GATT Server BLE** escuchando solicitudes de lectura/escritura en las características `RED_BLE_RX_CHAR` (`00002a6e...`) y `RED_BLE_TX_CHAR` (`00002a4d...`).
  - Ejecuta la función `injectNativeMeshPayload` que envía de forma directa e instantánea cualquier paquete de bytes capturado por la antena al servidor Rust Axum local en `http://127.0.0.1:7333/api/mesh/receive`.
- **`RedNodePlugin.java`**: Plugin de Capacitor que expone las funciones JNI de Rust a JavaScript y emite el evento `bleMessageReceived` cuando se reciben tramas físicamente por Bluetooth.

---

## 3. Motor Criptográfico Nativo en Rust (`red_core` y `red_mobile`)

El motor Rust está dividido en dos cajas (*crates*):

1. **`red_core`**:
   - **`identity`**: Generación y firma de llaves **Ed25519** para derivar el `IdentityHash` soberano (`did:red:`).
   - **`protocol`**: Implementación del Handshake **Noise XK**, intercambio de claves efímeras **X25519** y cifrado simétrico autenticado **ChaCha20-Poly1305**.
   - **`storage`**: Base de datos SQLite cifrada mediante llaves derivadas de la contraseña maestra del usuario.
   - **`network`**: Algoritmo de enrutamiento por Inundación Controlada (*Controlled Flood Routing*) con deduplicación de nonces por 72 horas y TTL de 20 saltos.

2. **`red_mobile`**:
   - Expone las funciones de inicialización NDK JNI (`Java_f_red_app_RedNodePlugin_startNode`).
   - Inicia el servidor HTTP REST y Eventos SSE en **Axum** (`127.0.0.1:7333`).

---

## 4. Capa de Red Mesh Multi-Radio (GATT, WiFi Direct, LoRa)

- **Bluetooth Low Energy (BLE)**: Operación en modo Periférico y Central simultáneo. Advertising con UUID `00001818-0000-1000-8000-00805f9b34fb`. Inmune al estado de redes IP o VPNs.
- **WiFi Direct**: Descubrimiento P2P mediante DataChannels WebRTC locales sin infraestructura de router.
- **Módems LoRa**: Transmisión de paquetes por radio puente de serie a 915 MHz / 868 MHz para alcance de varios kilómetros.

---

## 5. Capa de Almacenamiento & Cifrado en Disco

- Los mensajes, contactos, grupos y llaves se persisten en una base de datos SQLite cifrada.
- Cada registro contiene metadatos de timestamp, estado de verificación, nonces de deduplicación e historial de retransmisión.

---

## 6. Manejo de Estado SPA & Navegación (Next.js / Zustand)

- **`useRedStore.ts`**: Store central Zustand que coordina la comunicación entre los componentes React, el servidor Rust Axum y los listeners de Capacitor.
- **Navegación Limpia `goBack`**:
  - `goBack()` restablece la pantalla a `sidebar` y limpia `activeConversationId: null`.
  - Escuchador del evento de hardware de Android (`Capacitor App backButton`) en `page.tsx` para garantizar que la tecla de retroceso vuelva limpiamente del chat a la lista principal.

---

## 7. Endpoints de la API Axum REST & SSE

- `POST /api/node/start`: Inicialización del nodo Rust con la contraseña.
- `GET /api/node/identity`: Retorna el `identity_hash`, `short_id` y `public_key` del nodo local.
- `GET /api/contacts` / `POST /api/contacts`: Consulta y registro de contactos.
- `POST /api/messages/send`: Envío de mensajes cifrados.
- `POST /api/mesh/receive`: Inyección de tramas binarias de radio en Rust.
- `GET /network/outbound` (SSE): Emisión de paquetes `OnionPacket` salientes para transmisión por radio.
- `GET /events` (SSE): Emisión de eventos entrantes (`new_message`, `contact_request`, `status_update`).
