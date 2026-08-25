# 🔴 RED - Manual del Administrador (Node Ops v63.0.0)

Este manual está dirigido a operadores de nodos, desarrolladores e integradores que deseen desplegar, mantener o extender la infraestructura de RED v63.0.0, con soporte para interconexión P2P Web $\leftrightarrow$ Mobile, suite de Respaldo Soberano en 1 Toque, llaves biométricas universales, enrutamiento autónomo multicapa LQS, validación Proof-of-Stake / Staking, actuadores de hardware nativos y arquitectura de eventos en tiempo real SSE unificada sin polling.

---

## 📋 Tabla de Contenidos

1. [Despliegue del Servidor de Señalización (`signaling/server.js`)](#1-despliegue-del-servidor-de-señalización-signalingserverjs)
2. [Conectividad y Hardware P2P (BLE, WiFi Direct, LoRa, SoundMesh)](#2-conectividad-y-hardware-p2p-ble-wifi-direct-lora-soundmesh)
3. [Seguridad Zero-Trust, Socket Axum & Base de Datos Sled](#3-seguridad-zero-trust-socket-axum--base-de-datos-sled)
4. [Operación de Nodos Validadores & Staking PoS](#4-operación-de-nodos-validadores--staking-pos)
5. [API REST Axum & Eventos SSE en Tiempo Real](#5-api-rest-axum--eventos-sse-en-tiempo-real)
6. [Configuración de Guardian IA & Alertas AMBER](#6-configuración-de-guardian-ia--alertas-amber)
7. [Guía de Compilación NDK & Diagnósticos ADB](#7-guía-de-compilación-ndk--diagnósticos-adb)

---

## 🛠️ 1. Despliegue del Servidor de Señalización (`signaling/server.js`)

El servidor de señalización actúa como coordinador ciego (*Zero-Knowledge*) para la negociación WebRTC (offers/answers e ICE Candidates) entre clientes Web SPA en PC y la App Móvil:

```bash
cd signaling
npm install
PORT=3001 node server.js
```

### Características del Servidor de Señalización v63.0.0:
- **Capacidad de Sala Ampliada:** Soporta hasta **50 pares P2P simultáneos** por sala (`roomId = sort([DID1, DID2]).join("-")`).
- **Zero-Knowledge Metadata:** No almacena ni inspecciona mensajes; solo enruta paquetes de negociación de red y relé ciego (`mesh-relay`).
- **Health Check HTTP:** Monitoreo en vivo vía `GET /health` (`status`, `uptime`, `peers`, `rooms`).
- **Nginx Reverse Proxy con SSL:**
  ```nginx
  server {
      listen 443 ssl;
      server_name signal.red.app;
      ssl_certificate /etc/letsencrypt/live/signal.red.app/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/signal.red.app/privkey.pem;

      location / {
          proxy_pass http://localhost:3001;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_set_header Host $host;
      }
  }
  ```

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

## 🔒 3. Seguridad Zero-Trust, Socket Axum & Base de Datos Sled

### Aislamiento de Red
Tanto en Android (`red_mobile`) como en Desktop (`red_node`), el servidor Axum se enlaza **estrictamente a Loopback `127.0.0.1:7333`**:
```rust
// red_mobile/src/lib.rs & node/src/main.rs
let addr = SocketAddr::from(([127, 0, 0, 1], 7333));
let listener = tokio::net::TcpListener::bind(addr).await?;
```
Esto garantiza que ningún dispositivo en la red LAN o WiFi compartida pueda consultar la API del nodo ni enviar peticiones no autorizadas.

### Base de Datos Cifrada Sled
- **Cifrado Simétrico:** Todos los árboles de datos (`identity`, `contacts`, `conversations`, `messages`, `vault`) se cifran con **AES-256-GCM**.
- **Validación al Arranque (`try_get_identity`):** Si la base de datos ya contiene una identidad previa y la clave simétrica derivada del PIN no puede desencriptarla, el nodo aborta inmediatamente con un error fatal (`FATAL: Storage decryption failed — Incorrect PIN / Master Password`), impidiendo la creación de identidades efímeras fraudulentas.

---

## 📊 4. Operación de Nodos Validadores & Staking PoS

RED incorpora una cadena de bloques ligera para consenso y registro de reputación:
- **Validación de Bloques:** Los validadores seleccionan líderes mediante Proof-of-Stake determinista.
- **Stake Mínimo:** Requiere un stake mínimo de `100.0 RED` para participar en la propuesta de bloques.
- **Mempool:** Transacciones de registro de identidad y transferencias de valor verificadas con firmas Ed25519.

---

## 📡 5. API REST Axum & Eventos SSE en Tiempo Real

El nodo expone los siguientes endpoints esenciales en `http://127.0.0.1:7333`:

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/status` | Estado de inicialización, peers conectados y altura de cadena |
| `GET` | `/api/identity` | Hash de identidad soberana y clave pública |
| `GET` | `/api/events` | Flujo Server-Sent Events (mensajes entrantes, telemetría) |
| `POST` | `/api/messages/send` | Envío de mensajes cifrados a través de la malla |
| `POST` | `/api/mesh/receive` | Inyección de paquetes crudos recibidos por antenas físicas |
| `GET` | `/api/contacts` | Directorio de contactos verificados |
| `POST` | `/api/beacon/sos` | Emisión prioritaria de baliza de socorro |

---

## 🧠 6. Configuración de Guardian IA & Alertas AMBER

- **Filtro de Seguridad:** El motor `guardianEngine.ts` evalúa los mensajes entrantes contra vectores de inyección y ataques de manipulación semántica mediante cálculo de distancia de Hamming de 64 bits.
- **Alertas Prioritarias:** Las alertas AMBER y balizas de triaje START se procesan en un canal de eventos prioritario con retransmisión obligatoria (TTL = 7 saltos).

---

## 🛠️ 7. Guía de Compilación NDK & Diagnósticos ADB

### Compilación con Cargo NDK & Gradle
```bash
# Compilar bibliotecas nativas ARM64 para Android
cd red_mobile
cargo ndk -t arm64-v8a -o ../client/app/android/app/src/main/jniLibs build --release

# Compilar APK de Release
cd ../client/app/android
./gradlew assembleRelease
```

### Comandos de Diagnóstico ADB
```bash
# Inspeccionar logs del nodo Rust y Capacitor en tiempo real
adb logcat -s RedNodePlugin:V Capacitor:V chromium:V

# Verificar el estado del servicio en primer plano
adb shell dumpsys activity services f.red.app

# Probar reinicio limpio del proceso
adb shell am force-stop f.red.app
adb shell am start -n f.red.app/.MainActivity
```
