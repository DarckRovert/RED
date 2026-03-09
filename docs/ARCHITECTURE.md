# 🏗️ Arquitectura de RED

## Visión General

RED es un sistema de mensajería descentralizado que combina:
- **Cifrado end-to-end** con el protocolo Double Ratchet
- **Identidades anónimas** con rotación automática
- **Red P2P** con onion routing para protección de metadatos
- **Blockchain ligera** solo para registro de identidades

## Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTES                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │   Mobile    │  │   Desktop   │  │     Web     │  │   CLI   │ │
│  │ (Flutter)   │  │  (Tauri)    │  │  (WASM)     │  │ (Rust)  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────┬────┘ │
└─────────────┼─────────────┼─────────────┼─────────────┼─────────┘
              │             │             │             │
              └─────────────┼─────────────┼─────────────┘
                            │             │
                    ┌───────┴─────────────┴───────┐
                    │       RED CORE (Rust)         │
                    │                               │
                    │  ┌─────────┐ ┌───────────┐  │
                    │  │ Crypto  │ │ Identity  │  │
                    │  └─────────┘ └───────────┘  │
                    │  ┌─────────┐ ┌───────────┐  │
                    │  │Protocol│ │  Storage  │  │
                    │  └─────────┘ └───────────┘  │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────┴───────────────┐
                    │         RED NODE              │
                    │                               │
                    │  ┌─────────┐ ┌───────────┐  │
                    │  │ Network │ │ Blockchain│  │
                    │  │ (libp2p)│ │ (PoS)     │  │
                    │  └─────────┘ └───────────┘  │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
        ┌─────┴─────┐     ┌─────┴─────┐     ┌─────┴─────┐
        │   Node 1   │     │   Node 2   │     │   Node N   │
        └────────────┘     └────────────┘     └────────────┘
              P2P NETWORK (Gossip + DHT + Onion Routing)
```

## Flujo de Mensajes

### 1. Envío de Mensaje

```
Alice                           Red P2P                          Bob
  │                               │                               │
  │ 1. Crear mensaje              │                               │
  │ 2. Cifrar (Double Ratchet)    │                               │
  │ 3. Envolver en onion          │                               │
  │───────────────────────────────▶│                               │
  │                               │ 4. Routing onion              │
  │                               │    (3 saltos)                 │
  │                               │───────────────────────────────▶│
  │                               │                5. Descifrar  │
  │                               │                6. Verificar  │
  │                               │                7. Almacenar  │
```

### 2. Registro de Identidad

```
Usuario                      Blockchain                     Red
  │                               │                          │
  │ 1. Generar claves             │                          │
  │ 2. Crear ZK proof             │                          │
  │ 3. Crear transacción          │                          │
  │───────────────────────────────▶│                          │
  │                               │ 4. Validar TX            │
  │                               │ 5. Incluir en bloque     │
  │                               │──────────────────────────▶│
  │                               │           6. Propagar   │
  │◀───────────────────────────────│                          │
  │ 7. Confirmación               │                          │
```

## Módulos del Core

### crypto/
- `keys.rs` - Generación y manejo de claves (X25519, Ed25519)
- `encryption.rs` - Cifrado simétrico (ChaCha20-Poly1305)
- `hashing.rs` - Funciones hash (BLAKE3) y KDF (HKDF)
- `ratchet.rs` - Implementación del Double Ratchet

### identity/
- `identity.rs` - Estructura de identidad y rotación
- `registry.rs` - Registro local de identidades

### network/
- `config.rs` - Configuración de red
- `peer.rs` - Gestión de peers
- `routing.rs` - Onion routing
- `transport.rs` - Capa de transporte

### protocol/
- `message.rs` - Tipos de mensajes
- `conversation.rs` - Gestión de conversaciones

### storage/
- `mod.rs` - Almacenamiento local cifrado

## Blockchain

La blockchain de RED es **minimalista** y solo almacena:
- Registros de identidad (public key + identity hash)
- Revocaciones de identidad
- Estado de validadores (staking)

**NO almacena mensajes** - estos viajan directamente P2P.

### Consenso: Proof of Stake
- Tiempo de bloque: 6 segundos
- Finalidad: ~12 segundos
- Stake mínimo: 1000 RED tokens

## Seguridad

| Capa | Protección |
|------|------------|
| Contenido | ChaCha20-Poly1305 + Double Ratchet |
| Identidad | Claves efímeras + rotación 24h |
| Metadatos | Onion routing (3 saltos) |
| Tráfico | Dummy messages + padding |
| Red | Grafo aleatorio dinámico |

## Próximos Pasos

1. **Fase 1**: Completar core + tests
2. **Fase 2**: Implementar red P2P con libp2p
3. **Fase 3**: Integrar blockchain
4. **Fase 4**: Desarrollar clientes (CLI, móvil, web)
5. **Fase 5**: Auditoría de seguridad
6. **Fase 6**: Lanzamiento beta
