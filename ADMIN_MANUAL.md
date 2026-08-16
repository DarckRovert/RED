# 🔴 RED - Manual del Administrador (Node Ops v31.0.0)

Este manual está dirigido a operadores de nodos, desarrolladores e integradores que deseen desplegar, mantener o extender la infraestructura de RED v31.0.0, con soporte para interconexión P2P Web ↔ Mobile, actuadores de hardware nativos (Flash LED Morse SOS, sensores barométricos) y arquitectura de eventos en tiempo real SSE unificada sin polling.

---

## 📋 Tabla de Contenidos

1. [Despliegue del Servidor de Señalización (`signaling/server.js`)](#1-despliegue-del-servidor-de-señalización-signalingserverjs)
2. [Conectividad y Hardware P2P (BLE, WiFi Direct, LoRa, SoundMesh)](#2-conectividad-y-hardware-p2p-ble-wifi-direct-lora-soundmesh)
3. [API REST Axum & Eventos SSE en Tiempo Real](#3-api-rest-axum--eventos-sse-en-tiempo-real)
4. [Configuración de Guardian IA & Alertas AMBER](#4-configuración-de-guardian-ia--alertas-amber)
5. [Hardening, Seguridad OPSEC & Bóvedas de Memoria](#5-hardening-seguridad-opsec--bóvedas-de-memoria)
6. [Resolución de Problemas & Diagnósticos NDK/JNI](#6-resolución-de-problemas--diagnósticos-ndkjni)

---

## 🛠️ 1. Despliegue del Servidor de Señalización (`signaling/server.js`)

El servidor de señalización actúa como coordinador ciego (zero-knowledge) para la negociación WebRTC (offers/answers e ICE Candidates) entre clientes Web SPA y la App Móvil:

```bash
cd signaling
npm install
PORT=3001 node server.js
```

### Características del Servidor de Señalización v30.0.0:
- **Capacidad de Sala Ampliada:** Soporta hasta **50 pares P2P simultáneos** por sala (`roomId = sort([DID1, DID2]).join("-")`).
- **Zero-Knowledge Metadata:** No almacena ni inspecciona mensajes; solo enruta paquetes de negociación de red.
- **Health Check HTTP:** Monitoreo en vivo vía `GET /health` (`status`, `uptime`, `peers`, `rooms`).

---

## 🌐 2. Conectividad y Hardware P2P

### BLE Advertiser & Central Mode
El dispositivo actúa como un Periférico y Central GATT simultáneo:
- **UUID de Servicio:** `00001818-0000-1000-8000-00805f9b34fb`.
- **Características:** `RED_BLE_RX_CHAR` (`00002a6e...`) y `RED_BLE_TX_CHAR` (`00002a4d...`).
- **Inmunidad a VPNs:** Opera a nivel de hardware HCI sin atravesar la pila TCP/IP de Android.

### WiFi Direct, LoRa & SoundMesh Ultrasonido
- **WiFi Direct:** Canal de alta velocidad para ruteo local y llamadas WebRTC.
- **LoRa Bridge:** Enlace de radio serie a 915 MHz / 868 MHz en paquetes ruteados por el binario Rust.
- **SoundMesh:** Módem acústico en 18–20 kHz BFSK para transmisión por altavoz cuando la radio RF esté deshabilitada.

---

## 📊 3. API REST Axum & Eventos SSE

El nodo Rust expone una API REST (puerto 7333) y eventos SSE en `127.0.0.1:7333/api`:
- **Handshake Crítico:** Tras el inicio exitoso del nodo Rust, el frontend realiza un handshake explícito para mutar el estado a `online` en Zustand.
- **Eventos SSE:** `/api/v1/events` transmite eventos de mensajes entrantes y latencia gossip cada 3 segundos.
- **Enrutamiento Mesh:** `POST /api/mesh/receive` procesa la inyección directa de bytes capturados por las antenas nativas.

---

## 🛡️ 4. Configuración de Guardian IA & Alertas AMBER

### 4.1 Variables de Entorno del Nodo Rust (`red-node`)

| Variable | Descripción | Valor por Defecto |
|---|---|---|
| `GUARDIAN_MODE` | Modo del motor de moderación: `strict` (bloqueo total), `warn` (solo alerta), `off` (desactivado). | `strict` |
| `AMBER_AUTHORITY_NODE_IDS` | Lista separada por comas de identity hashes autorizados para emitir alertas AMBER. | (Vacío) |
| `AMBER_DEV_MODE` | `1` o `true` habilita que el nodo local se auto-registre como autoridad para testing. | `1` |

---

## 🔒 5. Hardening, Seguridad OPSEC & Bóvedas de Memoria

- **Cifrado de Almacenamiento:** Base de datos SQLite / Sled cifrada individualmente en reposo (AES-256-GCM / ChaCha20-Poly1305) mediante derivación PBKDF2 (100,000 iteraciones).
- **Protección Hardware:** Claves privadas de identidad Ed25519 alojadas en `AndroidKeyStore`.
- **Destrucción de Pánico:** Ejecución de `RedNodePlugin.destroy` mediante PIN de pánico o por inactividad del Hombre Muerto DMS (`evaluateLocalDMS`).

---

## 🚑 6. Resolución de Problemas & Diagnósticos NDK/JNI

**El nodo se cierra inmediatamente en Android:**
- Verifica los permisos de `POST_NOTIFICATIONS`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` y `FOREGROUND_SERVICE` en el dispositivo. Android 14 requiere aprobación explícita del usuario.

**Fallo de Handshake (Node Offline):**
- Revisa el Logcat de Android. Si el nodo Rust falla al bindear el puerto 7333, asegúrate de que no haya otra instancia de la app corriendo en segundo plano.

---

**RED Admin Docs v30.0.0** — Soberanía tecnológica mediante hardware real y criptografía robusta.
