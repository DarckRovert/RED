# 🛜 Conectividad Offline — Especificación Técnica

**Versión**: 1.0.0 | **Fecha**: Marzo 2026

## Resumen

RED implementa comunicación directa entre dispositivos sin necesidad de internet ni señal celular, mediante tres mecanismos de transporte local:

| Transporte | Alcance | Velocidad | Consumo | Uso |
|---|---|---|---|---|
| **Bluetooth BLE** | ~100m | ~50–200 Kbps | Bajo | Mensajes, descubrimiento |
| **WiFi Direct (LAN)** | LAN/Hotspot | ~10–100 Mbps | Medio | Archivos, vídeo |
| **Mesh Store-and-Forward** | Ilimitado (saltos) | Variable | Bajo | Mensajes cuando no hay ruta directa |

---

## Arquitectura

```
Dispositivo A                           Dispositivo B
   │                                         │
   │  ◄──── BLE (GATT) ────────────────────► │  ← directo < 100m
   │  ◄──── WiFi DataChannel ──────────────► │  ← mismo LAN/hotspot
   │                                         │
   │         Dispositivo C (relay)           │
   │  ◄──── BLE ────► C ◄──── BLE ─────────► │  ← mesh 2 saltos
```

### Prioridad de Transporte (automática)

```
1. WiFi Direct   → Máxima velocidad, si hay LAN común
2. Bluetooth BLE → Si están cerca sin LAN compartida
3. Mesh Relay    → Store-and-forward si no hay ruta directa
```

---

## 1. Bluetooth Low Energy (BLE)

### Servicio GATT personalizado

```
Service UUID:    00001818-0000-1000-8000-00805f9b34fb
TX Char UUID:    00002a4d-0000-1000-8000-00805f9b34fb  (App → Remoto)
RX Char UUID:    00002a6e-0000-1000-8000-00805f9b34fb  (Remoto → App)
```

### Protocolo de fragmentación

Los mensajes se fragmentan en chunks de 512 bytes (MTU):

```
Frame:  [4 bytes: total_length] [payload_bytes...]
Chunks: [chunk_1: 512B] [chunk_2: 512B] ... [chunk_n: remainder]
```

El receptor reensambla los chunks usando el `total_length` del header.

### Cifrado

Los payloads BLE son **pre-cifrados** por la capa RED E2E (X25519 + AES-256-GCM) antes de enviarse al transporte BLE. El transporte BLE no conoce el contenido.

### Implementación

Archivo: [`client/app/src/lib/bluetoothTransport.ts`](../client/app/src/lib/bluetoothTransport.ts)

Clases principales:
- `BluetoothTransport` — clase singleton exportada como `bluetoothTransport`
- `scan()` — inicia escaneo BLE (requiere gesto de usuario)
- `connect(device)` — abre servidor GATT y suscribe a notificaciones
- `send(deviceId, payload)` — envía payload fragmentado
- `onMessage(cb)` — registra callback para mensajes entrantes

---

## 2. WiFi Direct (WebRTC DataChannel)

### Señalización local

La negociación WebRTC se realiza a través del nodo RED local:

```
ws://localhost:9001/local-signal

Mensajes de señalización:
  announce    → "hay un nuevo peer en la LAN"
  offer       → SDP offer de WebRTC
  answer      → SDP answer de WebRTC
  ice-candidate → candidatos ICE
  bye         → peer desconectado
```

### Conexión P2P (sin STUN externo)

Para LAN local se omiten los servidores STUN externos:

```typescript
RTCConfiguration = {
  iceServers: [],           // Sin STUN/TURN
  iceTransportPolicy: 'all' // Usa candidatos host/LAN
}
```

### DataChannel

```typescript
RTCDataChannelInit = {
  ordered: true,
  maxRetransmits: 3
}
binaryType = 'arraybuffer'
```

### Implementación

Archivo: [`client/app/src/lib/wifiDirectTransport.ts`](../client/app/src/lib/wifiDirectTransport.ts)

---

## 3. Protocolo Mesh Store-and-Forward

### Estructura de mensaje mesh

```typescript
MeshMessage {
  id: string       // UUID único (deduplicación)
  to: string       // Peer destino
  from: string     // Peer origen
  payload: number[] // Payload cifrado como array JSON
  createdAt: number // Timestamp ms
  expiresAt: number // TTL = createdAt + 30min
  hops: number     // Saltos recorridos
}
```

### Parámetros

| Parámetro | Valor | Razón |
|---|---|---|
| `DEFAULT_TTL_MS` | 30 minutos | Evita mensajes obsoletos |
| `MAX_HOPS` | 5 | Previene bucles de routing |
| `MAX_STORED_MSGS` | 500 | Límite de memoria |

### Flujo de un mensaje mesh

```
Alice                Node B               Node C               Bob
  │                     │                    │                   │
  │──enqueue(to=Bob)───►│                    │                   │
  │                     │──receive()─────────►│                   │
  │                     │  (hops+1, store)    │──receive()───────►│
  │                     │                    │  (to==Bob, deliver)
  │                     │                    │                   │
```

### Gossip Sync

Cuando un nuevo peer se conecta, el protocolo mesh ofrece un batch de mensajes almacenados para relay:

```typescript
meshProtocol.getGossipBatch(excludeFrom, maxCount=10)
// → Array<MeshMessage> no originados por este peer, no expirados
```

### Persistencia

Los mensajes mesh se persisten en `localStorage` con la clave `red_mesh_store`, sobreviven recargas pero respetan el TTL al cargar.

### Implementación

Archivo: [`client/app/src/lib/meshProtocol.ts`](../client/app/src/lib/meshProtocol.ts)

---

## 4. Capa Unificada (LocalTransport)

Archivo: [`client/app/src/lib/localTransport.ts`](../client/app/src/lib/localTransport.ts)

```typescript
// Obtener el singleton (se inicializa con el DID local)
const transport = getLocalTransport(myDID);

// Iniciar WiFi LAN
await transport.startWifi();

// Escanear BLE (requiere gesto de usuario)
const peer = await transport.scanBluetooth();

// Enviar (selecciona automáticamente WiFi > BLE > Mesh)
const usedTransport = await transport.send(peerId, encryptedPayload);
// → 'wifi' | 'bluetooth' | 'mesh'

// Recibir
transport.onMessage(({ from, payload, transport }) => {
  // payload ya descifrado por la capa crypto de RED
});
```

---

## 5. UI

| Componente | Ruta | Función |
|---|---|---|
| `NearbyDevicesPanel` | `src/components/` | Panel con radar, lista de peers, controles BLE/WiFi |
| `OfflinePage` | `src/app/offline/page.tsx` | Página `/offline` completa |

### Acceso al modo offline

Navegar a `/offline` en la app (o tocar el botón de antena en el sidebar cuando no hay conexión).

---

## 6. Limitaciones y Roadmap

### Limitaciones actuales

- **Web Bluetooth**: Solo funciona en Chrome/Edge en HTTPS o localhost. Firefox y Safari no soportan la API.
- **WiFi Direct nativo**: En Capacitor (Android/iOS), usar el plugin `@capacitor-community/bluetooth-le` o `capacitor-wifi-direct` para acceso nativo completo.
- **Alcance BLE**: ~100m en espacio abierto, menos con obstáculos.

### Roadmap

- [ ] Plugin nativo Capacitor para BLE (mayor alcance y control)
- [ ] WiFi Direct nativo Android (Wi-Fi P2P API)
- [ ] Nearby Connections API (Android) para discovery automático
- [ ] LoRa radio como transporte de ultra largo alcance
- [ ] Compresión de payloads para BLE (mensajes grandes)
