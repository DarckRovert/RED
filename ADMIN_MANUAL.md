# ðŸ”´ RED - Manual del Administrador (Node Ops v90.0.0)

Este manual estÃ¡ dirigido a operadores de nodos, desarrolladores e integradores que deseen desplegar, mantener o extender la infraestructura de RED v91.0.0, con soporte para interconexiÃ³n P2P Web $\leftrightarrow$ Mobile, suite de Respaldo Soberano en 1 Toque, llaves biomÃ©tricas universales, enrutamiento autÃ³nomo multicapa LQS, validaciÃ³n Proof-of-Stake / Staking, actuadores de hardware nativos, autenticaciÃ³n Zero-Trust en loopback sin bypass, y arquitectura de eventos en tiempo real SSE unificada sin polling.

---

## ðŸ“‹ Tabla de Contenidos

1. [Despliegue del Servidor de SeÃ±alizaciÃ³n (`signaling/server.js`)](#1-despliegue-del-servidor-de-seÃ±alizaciÃ³n-signalingserverjs)
2. [Conectividad y Hardware P2P (BLE, WiFi Direct, LoRa, SoundMesh)](#2-conectividad-y-hardware-p2p-ble-wifi-direct-lora-soundmesh)
3. [Seguridad Zero-Trust, Socket Axum & Base de Datos Sled](#3-seguridad-zero-trust-socket-axum--base-de-datos-sled)
4. [OperaciÃ³n de Nodos Validadores & Staking PoS](#4-operaciÃ³n-de-nodos-validadores--staking-pos)
5. [API REST Axum & Eventos SSE en Tiempo Real](#5-api-rest-axum--eventos-sse-en-tiempo-real)
6. [ConfiguraciÃ³n de Guardian IA & Alertas AMBER](#6-configuraciÃ³n-de-guardian-ia--alertas-amber)
7. [GuÃ­a de CompilaciÃ³n NDK & DiagnÃ³sticos ADB](#7-guÃ­a-de-compilaciÃ³n-ndk--diagnÃ³sticos-adb)

---

## ðŸ› ï¸ 1. Despliegue del Servidor de SeÃ±alizaciÃ³n (`signaling/server.js`)

El servidor de seÃ±alizaciÃ³n actÃºa como coordinador ciego (*Zero-Knowledge*) para la negociaciÃ³n WebRTC (offers/answers e ICE Candidates) entre clientes Web SPA en PC y la App MÃ³vil:

```bash
cd signaling
npm install
PORT=3001 node server.js
```

### CaracterÃ­sticas del Servidor de SeÃ±alizaciÃ³n v91.0.0:
- **Capacidad de Sala Ampliada:** Soporta hasta **50 pares P2P simultÃ¡neos** por sala (`roomId = sort([DID1, DID2]).join("-")`).
- **Zero-Knowledge Metadata:** No almacena ni inspecciona mensajes; solo enruta paquetes de negociaciÃ³n de red y relÃ© ciego (`mesh-relay`).
- **Health Check HTTP:** Monitoreo en vivo vÃ­a `GET /health` (`status`, `uptime`, `peers`, `rooms`).
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

## ðŸŒ 2. Conectividad y Hardware P2P

### BLE Advertiser & Central Mode (Dual Addressing Android & iOS)
El dispositivo actÃºa como un PerifÃ©rico y Central GATT simultÃ¡neo:
- **UUID de Servicio:** `00001818-0000-1000-8000-00805f9b34fb`.
- **CaracterÃ­sticas:** `RED_BLE_RX_CHAR` (`00002a6e...`) y `RED_BLE_TX_CHAR` (`00002a4d...`).
- **Direccionamiento Dual:** Soporta tanto direcciones MAC de hardware estÃ¡ndar en Android/Linux (`AA:BB:CC:DD:EE:FF`) como identificadores UUID de CoreBluetooth en iOS (`E621E1F8-C36C-495A-93FC-0C247A3E6E5F`), garantizando interoperabilidad multiplataforma total.
- **Inmunidad a VPNs:** Opera a nivel de hardware HCI sin atravesar la pila TCP/IP de Android ni interferir con tÃºneles VPN activos.

### WiFi Direct, LoRa & SoundMesh Ultrasonido
- **WiFi Direct:** Canal de alta velocidad para ruteo local y llamadas WebRTC.
- **LoRa Bridge:** Enlace de radio serie a 915 MHz / 868 MHz en paquetes ruteados por el binario Rust.
- **SoundMesh:** MÃ³dem acÃºstico en 18â€“20 kHz BFSK para transmisiÃ³n por altavoz cuando la radio RF estÃ© deshabilitada.

---

## ðŸ”’ 3. Seguridad Zero-Trust, Socket Axum & Base de Datos Sled

### Aislamiento de Red & AutenticaciÃ³n de Bucle Local
Tanto en Android (`red_mobile`) como en Desktop (`red_node`), el servidor Axum se enlaza **estrictamente a Loopback `127.0.0.1:7333`**:
```rust
// red_mobile/src/lib.rs & node/src/main.rs
let addr = SocketAddr::from(([127, 0, 0, 1], 7333));
let listener = tokio::net::TcpListener::bind(addr).await?;
```
- **Zero-Trust Autenticado:** Todo endpoint local (`/api/*`) exige autenticaciÃ³n obligatoria mediante token criptogrÃ¡fico efÃ­mero de sesiÃ³n (`session.token` de 64 caracteres hex) o clave derivada. Se aceptan cabeceras `X-API-Key`, `X-Red-Session-Token` o `Authorization: Bearer <token>`.
- **MitigaciÃ³n Anti-Timing:** La validaciÃ³n de credenciales se ejecuta en tiempo constante estricto mediante `subtle::ConstantTimeEq`, evitando fugas de canal lateral.
- **CORS Restrictivo:** Prohibido `CorsLayer::permissive()`. El servidor solo admite orÃ­genes locales explÃ­citos (`http://localhost:*`, `http://127.0.0.1:*`, `capacitor://localhost`, `https://darckrovert.github.io`).
- **ErradicaciÃ³n de Bypass Loopback:** No se asume confianza por cabeceras `x-forwarded-for` forjadas en peticiones web locales.

### Base de Datos Cifrada Sled
- **Cifrado SimÃ©trico:** Todos los Ã¡rboles de datos (`identity`, `contacts`, `conversations`, `messages`, `vault`) se cifran con **AES-256-GCM**.
- **ValidaciÃ³n al Arranque (`try_get_identity`):** Si la base de datos ya contiene una identidad previa y la clave simÃ©trica derivada del PIN no puede desencriptarla, el nodo aborta inmediatamente con un error fatal (`FATAL: Storage decryption failed â€” Incorrect PIN / Master Password`), impidiendo la creaciÃ³n de identidades efÃ­meras fraudulentas.
- **Cero Texto Plano:** Los PINs de desbloqueo, pÃ¡nico y seÃ±uelo nunca se almacenan en texto plano en `localStorage`. En entornos nativos residen en hardware TEE (Android Keystore), y en web se verifican mediante hashes criptogrÃ¡ficos derivados con salts por instancia.

---

## ðŸ“Š 4. OperaciÃ³n de Nodos Validadores & Staking PoS

RED incorpora una cadena de bloques ligera para consenso y registro de reputaciÃ³n:
- **ValidaciÃ³n de Bloques:** Los validadores seleccionan lÃ­deres mediante Proof-of-Stake determinista.
- **Stake MÃ­nimo:** Requiere un stake mÃ­nimo de `100.0 RED` para participar en la propuesta de bloques.
- **Mempool:** Transacciones de registro de identidad y transferencias de valor verificadas con firmas Ed25519.

---

## ðŸ“¡ 5. API REST Axum & Eventos SSE en Tiempo Real

El nodo expone los siguientes endpoints esenciales en `http://127.0.0.1:7333`:

| MÃ©todo | Endpoint | DescripciÃ³n |
|---|---|---|
| `GET` | `/api/status` | Estado de inicializaciÃ³n, peers conectados y altura de cadena |
| `GET` | `/api/identity` | Hash de identidad soberana y clave pÃºblica |
| `GET` | `/api/events` | Flujo Server-Sent Events (mensajes entrantes, telemetrÃ­a) |
| `POST` | `/api/messages/send` | EnvÃ­o de mensajes cifrados a travÃ©s de la malla |
| `POST` | `/api/mesh/receive` | InyecciÃ³n de paquetes crudos recibidos por antenas fÃ­sicas |
| `GET` | `/api/contacts` | Directorio de contactos verificados |
| `POST` | `/api/beacon/sos` | EmisiÃ³n prioritaria de baliza de socorro |

---

## ðŸ§  6. ConfiguraciÃ³n de Guardian IA & Alertas AMBER

- **Filtro de Seguridad:** El motor `guardianEngine.ts` evalÃºa los mensajes entrantes contra vectores de inyecciÃ³n y ataques de manipulaciÃ³n semÃ¡ntica mediante cÃ¡lculo de distancia de Hamming de 64 bits.
- **Alertas Prioritarias:** Las alertas AMBER y balizas de triaje START se procesan en un canal de eventos prioritario con retransmisiÃ³n obligatoria (TTL = 7 saltos).

---

## ðŸ› ï¸ 7. GuÃ­a de CompilaciÃ³n NDK & DiagnÃ³sticos ADB

### CompilaciÃ³n con Cargo NDK & Gradle
```bash
# Compilar bibliotecas nativas ARM64 para Android
cd red_mobile
cargo ndk -t arm64-v8a -o ../client/app/android/app/src/main/jniLibs build --release

# Compilar APK de Release
cd ../client/app/android
./gradlew assembleRelease
```

### Comandos de DiagnÃ³stico ADB
```bash
# Inspeccionar logs del nodo Rust y Capacitor en tiempo real
adb logcat -s RedNodePlugin:V Capacitor:V chromium:V

# Verificar el estado del servicio en primer plano
adb shell dumpsys activity services f.red.app

# Probar reinicio limpio del proceso
adb shell am force-stop f.red.app
adb shell am start -n f.red.app/.MainActivity
```
