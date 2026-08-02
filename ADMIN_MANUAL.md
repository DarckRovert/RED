# 🔴 RED - Manual del Administrador (Node Ops v18.3.0)

Este manual está dirigido a operadores de nodos, desarrolladores e integradores que deseen desplegar, mantener o extender la infraestructura de RED, ahora con soporte para interconexión P2P Web ↔ Mobile y clusters de señalización ampliados (hasta 50 pares P2P por sala).

---

## 🛠️ 1. Despliegue del Servidor de Señalización (`signaling/server.js`)

El servidor de señalización actúa como coordinador ciego (zero-knowledge) para la negociación WebRTC (offers/answers e ICE Candidates) entre clientes Web SPA y la App Móvil:

```bash
cd signaling
npm install
PORT=3001 node server.js
```

### Características del Servidor de Señalización v18.3:
- **Capacidad de Sala Ampliada:** Soporta hasta **50 pares P2P simultáneos** por sala (`roomId = sort([DID1, DID2]).join("-")`).
- **Zero-Knowledge Metadata:** No almacena ni inspecciona mensajes; solo enruta paquetes de negociación de red.
- **Health Check HTTP:** Monitoreo en vivo vía `GET /health` (`status`, `uptime`, `peers`, `rooms`).

---

## 🌐 2. Conectividad y Hardware P2P

### BLE Advertiser (Nuevo en v5.0)
El dispositivo ahora actúa como un Periférico GATT (Advertiser).
- **UUID de Servicio:** `00001818-0000-1000-8000-00805f9b34fb`.
- **Funcionamiento:** Emite una señal constante que permite a otros nodos descubrir la identidad del dispositivo sin necesidad de escaneos manuales intrusivos.

### WiFi Direct & Mesh
- **WiFi Direct:** Proporciona un canal de alta velocidad para ruteo local.
- **Mesh Storage:** El nodo implementa una política de *Store-and-Forward* para mensajes volátiles en la red táctica local.
- **WebRTC Offline (Sin STUN):** Todo el signaling ocurre mediante sockets locales. Como operador, no necesitas desplegar servidores STUN/TURN (ej: Coturn). Todo el tráfico P2P WebRTC se establece en LAN.

---

## 📊 3. API y Sincronización de Estado

El nodo expone una API REST (puerto 7333) y eventos SSE.
- **Handshake Crítico:** Tras el inicio exitoso del node Rust, el frontend debe realizar un handshake explícito para mutar el estado a `online` en el store de Zustand.
- **Eventos SSE:** `/api/v1/events` es el canal principal para recibir mensajes entrantes e indicadores de latencia de la red mesh.
- **LoRaWAN Bridge (`POST /api/settings/lora`):** Recibe la configuración en caliente `{"port": "COM3", "baud": 115200}` para que el nodo Rust inicie la interfaz serial hacia el transceptor físico.
- **Read Receipts (`POST /api/conversations/{id}/read`):** Actualiza el horizonte de lectura de la base de datos Sled para una conversación sin necesidad de leer todo su historial de mensajes.
- **Bloqueo y Verificación:** Expone endpoints Axum `/api/contacts/:hash/block` y `/verify` para actualizar la base de datos de contactos local y forzar filtros en caliente a nivel de transporte.

---

## 🛡️ 5. Configuración de Guardian IA y Autoridades AMBER (v19.0 Node Ops)

### 5.1 Variables de Entorno del Nodo Rust (`red-node`)

| Variable | Descripción | Valor por Defecto |
|---|---|---|
| `GROQ_API_KEY` | Clave API de Groq para análisis remoto LlamaGuard 4. Si falta, opera en modo degradado (solo pHash local). | (Vacío) |
| `GUARDIAN_MODE` | Modo del motor de moderación: `strict` (bloqueo total), `warn` (solo alerta), `off` (desactivado). | `strict` |
| `AMBER_AUTHORITY_NODE_IDS` | Lista separada por comas de identity hashes autorizados para emitir/resolver alertas AMBER. | (Vacío) |
| `AMBER_DEV_MODE` | `1` o `true` habilita que el nodo local se auto-registre como autoridad para testing/demos. | `1` |

### 5.2 Comandos de Administración de Alertas AMBER

```bash
# Probar emisión de alerta AMBER desde el nodo autoridad
curl -X POST http://localhost:7333/api/amber/alert \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Persona Prueba",
    "age": 10,
    "description": "Prueba de emisión de alerta AMBER P2P",
    "ttl_secs": 259200,
    "authority_signature": "LOCAL_DEV_SIGNATURE",
    "authority_node_id": "TU_IDENTITY_HASH"
  }'

# Consultar estado del Guardian IA
curl http://localhost:7333/api/guardian/status
```

---

## 🔒 6. Hardening y Seguridad

### Cifrado de Almacenamiento
La base de datos **Sled** utiliza árboles transaccionales (`conversations`, `contacts`, `profile`, `pending_deliveries`, `config`, `identity`, `groups`, `devices`) cifrados individualmente en reposo ( ChaCha20-Poly1305) mediante derivación HKDF a partir del PIN/Contraseña maestro del usuario (`RED_PASSWORD`). No se almacenan claves privadas en texto claro.

### Firewall
- **Port 7331 (UDP/TCP):** Tráfico P2P (libp2p).
- **Port 7333 (Local):** Acceso a la API REST (no exponer al exterior).

---

## 🚑 5. Resolución de Problemas

**El nodo se cierra inmediatamente en Android:**
- Verifica los permisos de `POST_NOTIFICATIONS` y `FOREGROUND_SERVICE` en el dispositivo. Android 14 requiere aprobación explícita del usuario.

**Fallo de Handshake (Node Offline):**
- Revisa el Logcat de Android. Si el nodo Rust falla al bindear el puerto 7333, asegúrate de que no haya otra instancia de la app corriendo en segundo plano.

---

**RED Admin Docs** — Soberanía tecnológica mediante hardware real y criptografía robusta.
