# 🏗️ Arquitectura de RED (v5.0)

## Visión General

RED es un ecosistema de mensajería soberana que opera bajo un modelo de **Malla Híbrida**:
- **Capa Local:** Comunicación directa vía Bluetooth BLE (Advertiser) y WiFi Direct.
- **Capa Global:** Ruteo P2P mediante libp2p y DHT Kademlia.
- **Capa de Identidad:** DID (Decentralized Identifiers) inmutables en blockchain.
- **Interfaz Sólida:** UI de alto rendimiento basada en Next.js y Zustand con estética premium.

## Componentes del Ecosistema

```
┌─────────────────────────────────────────────────────────────┐
│                      CAPA DE APLICACIÓN                      │
│  "Solid UI" (Next.js) · Modo OLED · Animaciones Framer       │
└────────┬──────────────────────┬──────────────────────┬───────┘
         │                      │                      │
┌────────┴──────────────┐┌──────┴───────────────┐┌─────┴───────┐
│     CAPA NATIVA      ││     CAPA RUST        ││CAPA DE RED  │
│Capacitor 8 (Android) ││Core P2P (Axum Node)  ││P2P Mesh     │
│BLE Advertiser (Java) ││Double Ratchet        ││Local Radar  │
│Storage / Foreground  ││Onion / Mixnets       ││LoRaWAN Radio│
└────────┬──────────────┘└──────┬───────────────┘└─────┬───────┘
         │                      │                      │
┌────────┴──────────────────────┴──────────────────────┴───────┐
│                      CAPA DE SEGURIDAD                       │
│      DID Efímero · X25519 DH · Ed25519 · Anti-Forense       │
└─────────────────────────────────────────────────────────────┘
```

## Flujo de Mensajes y Sincronización

### 1. Mensajería Mesh (Propagación)
1. **Composición:** El cliente Next.js compone el mensaje y lo envía al nodo Rust local via `/api/v1/message/send`.
2. **Cifrado:** El nodo Rust aplica el Double Ratchet y envuelve la carga en capas de Onion Routing.
3. **Transporte:** Dependiendo de la disponibilidad, el mensaje se emite vía:
   - **Internet:** libp2p pubsub.
   - **Local:** Inyección en la cola de Mesh Nearby (WiFi/BLE).
4. **Almacenamiento:** Los nodos vecinos guardan el mensaje (*Store-and-Forward*) hasta encontrar al destinatario.

### 2. Sincronización de Estado (Zustand <-> Rust)
El frontend utiliza un Store centralizado en **Zustand** (`useRedStore.ts`) que orquestra:
- **SSE (Server-Sent Events):** Escucha continua del flujo de eventos de Rust (`/api/v1/events`).
- **Handshake:** Verificación de salud del nodo nativo al arranque.
- **Re-hidratación:** Estado persistente en localStorage/IndexedDB sincronizado con la base de datos distribuida.

## Módulos del Core (Rust + Java)

### android/ (Capa Nativa)
- `RedNodeService.java`: El pilar de la persistencia. Mantiene el nodo Rust vivo como servicio Foreground (clase `dataSync`).
- `BleAdvertiser`: Implementación del rol GATT Peripheral para descubrimiento pasivo.

### core/ (Protocolo Rust)
- `crypto/`: Double Ratchet, X25519 y ChaCha20.
- `network/`: Implementación de libp2p, GossipSub, DHT, **Mesh Mixnets** y **LoRaWAN bridge**.
- `node/`: Servidor Axum que expone la API REST, incluyendo distribuidor descentralizado de instaladores P2P (`/api/mesh/apk`).

### client/ (Frontend)
- `Solid UI`: Sistema de diseño con variables CSS dinámicas.
- `Radar Logic`: Cálculo de distancias y RSSI para el panel Nearby.

## Seguridad de Capas

| Capa | Implementación |
|------|----------------|
| **Carga Útil** | ChaCha20-Poly1305 (AEAD) |
| **Identidad** | Ed25519 Signatures con **Hashcash PoW (Protección Kademlia Sybil)** |
| **PFS** | Diffie-Hellman Ratchet (X25519) |
| **Anonimato** | 3-hop Onion Routing + **Buffer Constante de 4096 bytes** |
| **Ofuscación** | Mixnets Temporales + **Ruido Blanco Constante** (Continuous Pending) |
| **Persistence** | Foreground Service Android + Bóvedas Señuelo Inyectadas Mágicamente |

---
**RED Architecture Docs** — Diseñando la resistencia mediante descentralización total.
