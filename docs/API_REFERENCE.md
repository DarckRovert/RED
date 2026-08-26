# Referencia de API REST & SSE — RED v63.0.0

El núcleo nativo de **RED** expone un servidor HTTP local de ultra-baja latencia sobre la interfaz de bucle invertido (`127.0.0.1:7333`) mediante Axum y Tokio.

---

## 🔒 Autenticación & Seguridad

Todas las solicitudes hacia la API deben incluir el encabezado de autenticación con el token de sesión de la bóveda local:

```http
X-API-Key: <session-token-argon2id>
```

---

## 📬 Endpoints de Mensajería & Conversaciones

### `POST /api/messages`
Envía un mensaje cifrado a un contacto o a la red de malla.

**Cuerpo de la Solicitud (JSON):**
```json
{
  "recipient": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "content": "Coordenadas tácticas aseguradas",
  "options": {
    "ttl": 10,
    "priority": "HIGH",
    "delivery_ack": true
  }
}
```

**Respuesta Exitosa (200 OK):**
```json
{
  "status": "success",
  "message_id": "9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a",
  "timestamp": 1724630400,
  "pow_difficulty": 2
}
```

---

### `GET /api/messages`
Recupera el historial de mensajes de una conversación local.

**Parámetros Query:**
- `peer`: Hash de identidad del par (32 bytes hex).
- `limit`: Cantidad máxima de mensajes (por defecto 50, máx 500).
- `offset`: Desplazamiento para paginación.

---

## 👥 Gestión de Identidad & Contactos

### `GET /api/identity`
Obtiene los detalles públicos de la identidad local.

**Respuesta (200 OK):**
```json
{
  "identity_hash": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "display_name": "Operador_Alpha",
  "public_key_ecc": "3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29",
  "public_key_pq_len": 1184,
  "created_at": 1724600000,
  "is_decoy_active": false
}
```

---

### `POST /api/contacts`
Registra un nuevo contacto tras el escaneo de código QR o intercambio BLE.

---

## 📡 Topología de Red Malla & Pares

### `GET /api/mesh/peers`
Lista todos los nodos vecinos actualmente enlazados por cualquier transporte físico.

**Respuesta (200 OK):**
```json
{
  "total_peers": 4,
  "peers": [
    {
      "peer_hash": "c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5",
      "transport": "BLE_GATT",
      "rssi": -68,
      "lqs_quality": 92,
      "last_seen_secs": 2
    },
    {
      "peer_hash": "e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
      "transport": "WIFI_DIRECT",
      "rssi": -45,
      "lqs_quality": 99,
      "last_seen_secs": 0
    }
  ]
}
```

---

## ⚡ Flujo de Eventos en Tiempo Real (Server-Sent Events)

### `GET /api/events`
Canal unidireccional SSE (`text/event-stream`) para recepción instantánea de mensajes y cambios de topología:

```
event: message_received
data: {"id":"9f8a...","from":"c4d3...","content":"Alerta de proximidad","timestamp":1724630410}

event: peer_connected
data: {"peer_hash":"e1f2...","transport":"WIFI_DIRECT","lqs":99}

event: delivery_ack
data: {"message_id":"9f8a...","status":"DELIVERED","confirmed_at":1724630412}
```

---

## 🩺 Diagnóstico & Estado de Bóveda

### `GET /api/health`
Verificación de integridad de la base de datos y memoria.

**Respuesta (200 OK):**
```json
{
  "status": "HEALTHY",
  "version": "63.0.0",
  "uptime_secs": 84200,
  "sled_db_bytes": 4404019,
  "unacked_dtn_queue": 0
}
```
