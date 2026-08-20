# 🛜 Conectividad Offline & Malla Global — Especificación Técnica

**Versión**: 38.0.0 | **Fecha**: Agosto 2026

## Resumen

RED implementa comunicación directa entre dispositivos sin necesidad de internet ni señal celular, mediante una arquitectura híbrida multi-transporte tolerante a retrasos (DTN) y enrutamiento por inundación controlada (Controlled Flood):

| Transporte | Frecuencia / Capa | Alcance | Velocidad / Bitrate | Consumo | Uso Táctico |
|---|---|---|---|---|---|
| **Bluetooth LE (GATT)** | 2.4 GHz ISM | ~100m | ~50–200 Kbps | Mínimo | Mensajes E2EE, PoW anti-spam, beacons de presencia |
| **WiFi Direct / WebRTC** | 2.4 / 5 GHz LAN | ~150m | ~10–54 Mbps | Medio | Streaming de video, canvas en vivo, sincronización pesada, interoperabilidad PC Web |
| **Módem LoRa** | 915 / 868 MHz | ~5–15 km | ~0.3–5.5 Kbps | Bajo | Ráfagas de texto táctico, voz comprimida con Vocoder |
| **SoundMesh Ultrasonido** | 18.5–20.5 kHz BFSK | ~10–25m | ~25 bps – 2 Kbps | Mínimo | Comunicación en apagón electromagnético / Jaula de Faraday |
| **DHT Global libp2p** | TCP/QUIC / Auto-Relay | Mundial | Según enlace WAN | Variable | Sincronización global Kademlia cuando hay conexión |
| **Incentivo DePIN PoR** | Micro-créditos $RED | Malla | Automático por salto | Zero | Pago compensatorio por batería y ancho de banda prestado |

---

## Arquitectura de Malla Híbrida

```
+------------------+                    +------------------+
|  Dispositivo A   |                    |  Dispositivo B   |
|   (Off-Grid)     |                    |   (Off-Grid)     |
+--------+---------+                    +--------+---------+
         |                                       |
         |  ◄──── BLE GATT (Mesh Relay) ────────►|  (Alcance < 100m)
         |  ◄──── WiFi Direct DataChannel ──────►|  (Misma red local)
         |  ◄──── Módem LoRa (915 MHz) ─────────►|  (Alcance hasta 15km)
         |  ◄──── SoundMesh (18-20 kHz) ────────►|  (Acoustic Air-Gap)
         |                                       |
         +-------------------+-------------------+
                             |
                   Dispositivo C (Relay Gateway)
                             |
         +-------------------+-------------------+
         | (Al detectar WiFi / 4G / 5G comercial) |
         v                                       v
+------------------+                    +------------------+
| libp2p Kademlia  |                    | DoH / SNI Tunnels|
|  Bootstrap Nodes |                    |   (Anti-Censura) |
+------------------+                    +------------------+
```

---

## 1. Motores de Optimización de Enlace

### 1.1 LowBitrateVocoder (DSP de Voz Táctica)
- Remuestrea audio de micrófono a 8000 Hz 16-bit PCM.
- Cuantización adaptativa IMA ADPCM de 4 bits.
- Reduce 3 segundos de audio crudo (562 KB) a **<800 Bytes por ráfaga**, permitiendo enviar voz por enlaces LoRaWAN y módem acústico ultrasónico.

### 1.2 MeshProofOfWork (Hashcash SHA-256)
- Evita el agotamiento de la batería y la congestión radio requiriendo un puzzle criptográfico SHA-256 en cada paquete.
- Validación de timestamp de 180s para mitigar ataques de repetición.

### 1.3 KineticDutyGovernor (Gobernador Cinemático)
- Adapta dinámicamente el ciclo de escaneo BLE entre 800ms (movimiento intenso) y 12s (dispositivo estacionario), logrando hasta **48 horas de supervivencia continua**.

---

## 2. Configuración de Hardware BLE

```
Service UUID:    00001818-0000-1000-8000-00805f9b34fb
TX Char UUID:    00002a4d-0000-1000-8000-00805f9b34fb  (App → Remoto)
RX Char UUID:    00002a6e-0000-1000-8000-00805f9b34fb  (Remoto → App)
CCCD Descriptor: 00002902-0000-1000-8000-00805f9b34fb
```

---

## 3. Tolerancia a Retrasos (DTN Store-and-Forward)

- Si el destinatario no está en el radio de alcance, el paquete queda en la cola persistente cifrada.
- Cada nodo intermedio actúa como "mula de datos" y entrega el paquete cuando entra en rango del destinatario o de un nodo puente hacia él.
