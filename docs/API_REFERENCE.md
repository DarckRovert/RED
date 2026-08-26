# Referencia Oficial de API REST & SSE — RED v63.0.0

El nodo nativo de **RED** expone una API HTTP/SSE de ultra-baja latencia sobre la interfaz de bucle invertido (`127.0.0.1:7333`) mediante Axum y Tokio.

---

## 🔒 Autenticación & CORS

- **Host Local:** `http://127.0.0.1:7333` o `http://localhost:7333`
- **Orígenes Permitidos:** `http://localhost:3000`, `capacitor://localhost`, `http://localhost`
- **Control de Frecuencia:** Limitador token bucket configurable contra ráfagas no autorizadas.

---

## 📬 Mensajería & Conversaciones

### `POST /api/messages/send`
Envía un mensaje directo a un contacto o a través de la malla.

**Cuerpo de la Solicitud (JSON):**
```json
{
  "recipient": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "content": "Coordenadas tácticas aseguradas",
  "msg_type": "text",
  "media_data": null,
  "latitude": -12.04637,
  "longitude": -77.04279,
  "expires_at": 1724640000
}
```

**Respuesta Exitosa (200 OK):**
```json
{
  "status": "success",
  "message_id": "9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a",
  "timestamp": 1724630400
}
```

---

### `GET /api/conversations`
Lista todas las conversaciones activas con sus metadatos y conteo de no leídos.

### `GET /api/conversations/:id/messages`
Recupera los mensajes almacenados para una conversación específica.

### `POST /api/conversations/:id/read`
Marca la conversación como leída y dispara el acuse de lectura `LIVE_READ_ACK`.

### `DELETE /api/conversations/:id/messages/:msg_id`
Elimina un mensaje individual del almacenamiento local y propaga la orden de revocación.

### `PATCH /api/conversations/:id/messages/:msg_id`
Edita el contenido de un mensaje enviado previamente.

---

## 👥 Identidad & Contactos

### `GET /api/identity`
Obtiene los detalles públicos de la identidad local.

**Respuesta (200 OK):**
```json
{
  "identity_hash": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "short_id": "a1b2c3d4",
  "public_key": "3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
  "nickname": "Operador_Alpha"
}
```

### `GET /api/contacts` / `POST /api/contacts`
Lista los contactos registrados o añade un nuevo par (`identity_hash`, `display_name`, `public_key`).

### `POST /api/contacts/:hash/verify`
Marca la identidad de un contacto como criptográficamente verificada tras comprobación de huella digital o QR.

---

## 👥 Grupos Tácticos P2P

### `GET /api/groups` / `POST /api/groups`
Lista o crea salas de grupo tácticas descentralizadas.

### `POST /api/groups/:id/send`
Envía un mensaje de difusión a todos los miembros de un grupo.

### `POST /api/groups/:id/members` / `DELETE /api/groups/:id/members/:hash`
Gestiona la membresía y roles dentro de la sala grupal.

---

## 📡 Red P2P, Pares & Apagón (Blackout Mode)

### `GET /api/peers`
Lista los nodos vecinos conectados directamente mediante TCP, BLE o Wi-Fi Direct.

### `GET /api/status`
Estado general del nodo: estado de ejecución, conteo de pares, hash de identidad, versión y altura de la blockchain.

### `GET /api/blackout/status` / `POST /api/blackout/mode`
Activa el **Protocolo de Apagón**, desconectando de inmediato todos los sockets WAN para operar exclusivamente en modo radio local (mDNS, BLE Mesh, LoRa).

### `POST /api/mesh/receive`
Inyección de tramas binarias recibidas desde antenas externas (BLE / LoRa) hacia el núcleo Rust.

### `GET /api/network/outbound`
Canal SSE para que el frontend JS retransmita paquetes generados por Rust hacia el hardware de radio.

---

## ⛓️ Blockchain Explorer & Staking

### `GET /api/blockchain/blocks`
Obtiene los bloques de la cadena local con sus transacciones y firmas de validadores.

### `GET /api/blockchain/validators`
Lista los validadores activos del consenso Proof-of-Stake (PoS).

### `POST /api/blockchain/stake`
Registra fondos en depósito de garantía (staking) para participar en la validación de bloques.

---

## 🚨 Módulos Tácticos de Emergencia

### `POST /api/sos/broadcast` / `GET /api/sos/active`
Emite o consulta balizas de emergencia SOS con coordenadas GPS y nivel de severidad.

### `POST /api/amber/alert` / `GET /api/amber/alerts`
Crea o consulta alertas de búsqueda de personas vulnerables (Sistema AMBER-RED).

### `POST /api/voice/send` / `GET /api/voice/bursts`
Transmisión de ráfagas de voz ultracomprimidas Walkie-Talkie Push-To-Talk.

### `POST /api/ai/copilot` / `POST /api/ai/summarize` / `POST /api/ai/translate`
Copiloto táctico local, resumidor inteligente de canales y traductor offline multilingüe.

---

## ⚡ Flujo de Eventos en Tiempo Real (Server-Sent Events)

### `GET /api/events`
Canal continuo SSE (`text/event-stream`) con reconexión automática:
```
data: {"id":"9f8a...","sender":"c4d3...","content":"Alerta de proximidad","msg_type":"text","timestamp":1724630410,"is_mine":false}
```
