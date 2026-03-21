# 📜 Especificación del Protocolo RED (Protocolo Ω)

**Versión**: 1.0.0  
**Estado**: Draft  
**Fecha**: Febrero 2026

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Notación y Definiciones](#2-notación-y-definiciones)
3. [Capa de Identidad](#3-capa-de-identidad)
4. [Capa de Cifrado](#4-capa-de-cifrado)
5. [Capa de Transporte](#5-capa-de-transporte)
6. [Capa de Red](#6-capa-de-red)
7. [Capa de Consenso](#7-capa-de-consenso)
8. [Formatos de Mensaje](#8-formatos-de-mensaje)
9. [Flujos de Protocolo](#9-flujos-de-protocolo)
10. [Consideraciones de Seguridad](#10-consideraciones-de-seguridad)

---

## 1. Introducción

### 1.1 Propósito

El Protocolo RED (también conocido como Protocolo Ω) define un sistema de comunicación asíncrono, descentralizado y privado. Este documento especifica todos los aspectos técnicos necesarios para implementar un cliente o nodo compatible.

### 1.2 Objetivos de Diseño

| Objetivo | Descripción |
|----------|-------------|
| **Privacidad** | Confidencialidad del contenido y metadatos |
| **Anonimato** | Identidades no vinculables entre sesiones |
| **Descentralización** | Sin puntos únicos de fallo o control |
| **Resistencia a censura** | Funcionamiento bajo condiciones adversas |
| **Usabilidad** | Experiencia similar a apps de mensajería tradicionales |

### 1.3 Alcance

Este documento cubre:
- Protocolos criptográficos
- Formatos de datos
- Protocolos de red
- Mecanismos de consenso

No cubre:
- Implementación de interfaces de usuario
- Detalles específicos de plataforma
- Políticas de moderación de contenido

---

## 2. Notación y Definiciones

### 2.1 Notación Matemática

| Símbolo | Significado |
|---------|-------------|
| `‖` | Concatenación de bytes |
| `⊕` | XOR bit a bit |
| `←$` | Muestreo uniforme aleatorio |
| `H(x)` | Función hash (BLAKE3) |
| `E(k, m)` | Cifrado autenticado de m con clave k |
| `D(k, c)` | Descifrado de c con clave k |
| `DH(sk, pk)` | Diffie-Hellman entre clave secreta y pública |
| `Sign(sk, m)` | Firma de m con clave secreta sk |
| `Verify(pk, m, σ)` | Verificación de firma σ |

### 2.2 Tipos de Datos

```
uint8       - Entero sin signo de 8 bits
uint16      - Entero sin signo de 16 bits (big-endian)
uint32      - Entero sin signo de 32 bits (big-endian)
uint64      - Entero sin signo de 64 bits (big-endian)
bytes[n]    - Array de n bytes
bytes<n>    - Array de hasta n bytes (prefijado con longitud)
```

### 2.3 Constantes del Protocolo

```rust
// Parámetros de seguridad
const SECURITY_PARAMETER: usize = 128;      // bits
const KEY_SIZE: usize = 32;                  // bytes
const NONCE_SIZE: usize = 12;                // bytes
const TAG_SIZE: usize = 16;                  // bytes
const HASH_SIZE: usize = 32;                 // bytes

// Parámetros de red
const ONION_HOPS: usize = 3;                 // número de saltos
const MIX_INTERVAL: u64 = 30;                // segundos
const FIXED_PACKET_SIZE: usize = 4096;       // bytes de relleno estricto
const GRAPH_DEGREE: usize = 8;               // grado del grafo

// Parámetros de almacenamiento
const MAX_RETENTION: u64 = 30 * 24 * 3600;   // 30 días en segundos
const MAX_SKIP: u32 = 1000;                  // mensajes saltados máx

// Parámetros de blockchain
const BLOCK_TIME: u64 = 6;                   // segundos
const MIN_STAKE: u64 = 1000;                 // tokens mínimos
```

---

## 3. Capa de Identidad

### 3.1 Estructura de Identidad

Cada usuario posee una identidad compuesta por:

```
Identity {
    secret_key:    bytes[32]    // Clave secreta X25519
    public_key:    bytes[32]    // Clave pública X25519
    signing_key:   bytes[32]    // Clave secreta Ed25519
    verify_key:    bytes[32]    // Clave pública Ed25519
    identity_hash: bytes[32]    // Hash de identidad
    nonce:         bytes[16]    // Nonce aleatorio
    created_at:    uint64       // Timestamp de creación
}
```

### 3.2 Generación de Identidad

```
function GenerateIdentity():
    // Generar claves de intercambio
    sk ←$ {0,1}^256
    pk = X25519_BasePoint(sk)
    
    // Generar claves de firma
    sign_sk ←$ {0,1}^256
    sign_pk = Ed25519_BasePoint(sign_sk)
    
    // Generar hash de identidad
    nonce ←$ {0,1}^128
    id_hash = H(pk ‖ sign_pk ‖ nonce)
    
    return Identity {
        secret_key: sk,
        public_key: pk,
        signing_key: sign_sk,
        verify_key: sign_pk,
        identity_hash: id_hash,
        nonce: nonce,
        created_at: current_timestamp()
    }
```

### 3.3 Rotación de Identidad

La rotación crea una nueva identidad no vinculable a la anterior:

```
function RotateIdentity(old_identity):
    new_identity = GenerateIdentity()
    
    // Opcional: crear prueba de continuidad (para contactos)
    proof = CreateContinuityProof(old_identity, new_identity)
    
    // Notificar a contactos de confianza
    for contact in trusted_contacts:
        SendRotationNotification(contact, new_identity, proof)
    
    // Borrar identidad antigua de forma segura
    SecureErase(old_identity)
    
    return new_identity
```

### 3.4 Prueba de Continuidad (Opcional)

Permite a contactos verificar que la nueva identidad pertenece al mismo usuario:

```
ContinuityProof {
    old_id_hash:   bytes[32]
    new_id_hash:   bytes[32]
    signature:     bytes[64]    // Firmado con old_signing_key
    timestamp:     uint64
}

function CreateContinuityProof(old_id, new_id):
    message = old_id.identity_hash ‖ new_id.identity_hash ‖ timestamp
    signature = Sign(old_id.signing_key, message)
    
    return ContinuityProof {
        old_id_hash: old_id.identity_hash,
        new_id_hash: new_id.identity_hash,
        signature: signature,
        timestamp: current_timestamp()
    }
```

---

## 4. Capa de Cifrado

### 4.1 Primitivas Criptográficas

| Función | Algoritmo | Referencia |
|---------|-----------|------------|
| Intercambio de claves | X25519 | RFC 7748 |
| Firma digital | Ed25519 | RFC 8032 |
| Cifrado autenticado | ChaCha20-Poly1305 | RFC 8439 |
| Hash | BLAKE3 | BLAKE3 Spec |
| KDF | HKDF-BLAKE3 | RFC 5869 (adaptado) |

### 4.2 Establecimiento de Sesión (X3DH Simplificado)

```
// Alice inicia sesión con Bob

function InitiateSession(alice_identity, bob_public_key):
    // Generar clave efímera
    eph_sk ←$ {0,1}^256
    eph_pk = X25519_BasePoint(eph_sk)
    
    // Triple Diffie-Hellman
    dh1 = DH(alice_identity.secret_key, bob_public_key)
    dh2 = DH(eph_sk, bob_public_key)
    
    // Derivar clave maestra
    master_secret = KDF(dh1 ‖ dh2, "RED_SESSION_v1")
    
    // Inicializar Double Ratchet
    ratchet_state = InitRatchet(master_secret, bob_public_key)
    
    return Session {
        ephemeral_public: eph_pk,
        ratchet: ratchet_state
    }
```

### 4.3 Double Ratchet

#### 4.3.1 Estado del Ratchet

```
RatchetState {
    root_key:           bytes[32]    // Clave raíz
    chain_key_send:     bytes[32]    // Clave de cadena (envío)
    chain_key_recv:     bytes[32]    // Clave de cadena (recepción)
    dh_keypair:         KeyPair      // Par DH actual
    dh_remote:          bytes[32]    // Clave DH remota
    send_count:         uint32       // Contador de envío
    recv_count:         uint32       // Contador de recepción
    prev_chain_count:   uint32       // Longitud cadena anterior
    skipped_keys:       Map          // Claves de mensajes saltados
}
```

#### 4.3.2 Avance del Ratchet DH

```
function DHRatchet(state, remote_public_key):
    state.prev_chain_count = state.send_count
    state.send_count = 0
    state.recv_count = 0
    state.dh_remote = remote_public_key
    
    // Derivar nueva clave de recepción
    dh_output = DH(state.dh_keypair.secret, state.dh_remote)
    (state.root_key, state.chain_key_recv) = KDF_RK(state.root_key, dh_output)
    
    // Generar nuevo par DH
    state.dh_keypair = GenerateKeyPair()
    
    // Derivar nueva clave de envío
    dh_output = DH(state.dh_keypair.secret, state.dh_remote)
    (state.root_key, state.chain_key_send) = KDF_RK(state.root_key, dh_output)
```

#### 4.3.3 Avance del Ratchet de Cadena

```
function ChainRatchet(chain_key):
    message_key = HMAC(chain_key, 0x01)
    new_chain_key = HMAC(chain_key, 0x02)
    return (message_key, new_chain_key)
```

#### 4.3.4 Cifrado de Mensaje

```
function RatchetEncrypt(state, plaintext):
    // Avanzar cadena de envío
    (message_key, state.chain_key_send) = ChainRatchet(state.chain_key_send)
    
    // Crear header
    header = MessageHeader {
        dh_public: state.dh_keypair.public,
        prev_count: state.prev_chain_count,
        msg_count: state.send_count
    }
    state.send_count += 1
    
    // Cifrar
    nonce ←$ {0,1}^96
    ciphertext = E(message_key, plaintext, nonce, header)
    
    // Borrar clave de mensaje
    SecureErase(message_key)
    
    return (header, nonce, ciphertext)
```

#### 4.3.5 Descifrado de Mensaje

```
function RatchetDecrypt(state, header, nonce, ciphertext):
    // Verificar si necesitamos avanzar ratchet DH
    if header.dh_public != state.dh_remote:
        SkipMessages(state, header.prev_count)
        DHRatchet(state, header.dh_public)
    
    // Saltar mensajes si es necesario
    SkipMessages(state, header.msg_count)
    
    // Avanzar cadena de recepción
    (message_key, state.chain_key_recv) = ChainRatchet(state.chain_key_recv)
    state.recv_count += 1
    
    // Descifrar
    plaintext = D(message_key, ciphertext, nonce, header)
    
    // Borrar clave de mensaje
    SecureErase(message_key)
    
    return plaintext
```

---

## 5. Capa de Transporte

### 5.1 Onion Routing

#### 5.1.1 Estructura de Paquete Onion

```
OnionPacket {
    version:        uint8           // Versión del protocolo (0x01)
    ephemeral_key:  bytes[32]       // Clave pública efímera
    routing_info:   bytes[3 * 65]   // Info de enrutamiento cifrada
    payload:        bytes<65536>    // Payload cifrado
    hmac:           bytes[32]       // HMAC del paquete
}

RoutingInfo {
    next_hop:       bytes[32]       // ID del siguiente nodo
    delay:          uint16          // Delay en ms (para mixing)
    padding:        bytes[31]       // Padding aleatorio
}
```

#### 5.1.2 Construcción del Paquete Onion

```
function CreateOnionPacket(path, payload, dest_public_key):
    // path = [node1, node2, node3, destination]
    
    // Generar clave efímera
    eph_sk ←$ {0,1}^256
    eph_pk = X25519_BasePoint(eph_sk)
    
    // Derivar claves compartidas con cada nodo
    shared_keys = []
    blinding_factor = 1
    current_eph = eph_pk
    
    for node in path:
        shared = DH(eph_sk * blinding_factor, node.public_key)
        key = KDF(shared, "RED_ONION_v1")
        shared_keys.append(key)
        blinding_factor = H(current_eph ‖ shared) * blinding_factor
        current_eph = current_eph * H(current_eph ‖ shared)
    
    // Cifrar payload para destino
    encrypted_payload = E(shared_keys[-1], payload)
    
    // Construir routing info de adentro hacia afuera
    routing_info = bytes[0]
    for i in reverse(range(len(path) - 1)):
        info = RoutingInfo {
            next_hop: path[i + 1].id,
            delay: random_delay(),
            padding: random_bytes(31)
        }
        routing_info = E(shared_keys[i], info ‖ routing_info)
    
    // Calcular HMAC
    hmac = HMAC(shared_keys[0], eph_pk ‖ routing_info ‖ encrypted_payload)
    
    return OnionPacket {
        version: 0x01,
        ephemeral_key: eph_pk,
        routing_info: routing_info,
        payload: encrypted_payload,
        hmac: hmac
    }
```

#### 5.1.3 Procesamiento en Nodo Intermedio

```
function ProcessOnionPacket(node_secret_key, packet):
    // Derivar clave compartida
    shared = DH(node_secret_key, packet.ephemeral_key)
    key = KDF(shared, "RED_ONION_v1")
    
    // Verificar HMAC
    expected_hmac = HMAC(key, packet.ephemeral_key ‖ packet.routing_info ‖ packet.payload)
    if packet.hmac != expected_hmac:
        return Error("Invalid HMAC")
    
    // Descifrar routing info
    decrypted_info = D(key, packet.routing_info)
    my_info = decrypted_info[0:65]
    remaining_info = decrypted_info[65:]
    
    // Parsear mi info
    next_hop = my_info.next_hop
    delay = my_info.delay
    
    // Transformar clave efímera (blinding)
    blinding = H(packet.ephemeral_key ‖ shared)
    new_eph = packet.ephemeral_key * blinding
    
    // Construir paquete para siguiente nodo
    new_packet = OnionPacket {
        version: 0x01,
        ephemeral_key: new_eph,
        routing_info: remaining_info ‖ random_padding(65),
        payload: packet.payload,
        hmac: HMAC(next_key, ...)
    }
    
    // Aplicar delay para mixing
    sleep(delay)
    
    return (next_hop, new_packet)
```

### 5.2 Tráfico Dummy

Para resistir análisis de tráfico, cada nodo genera tráfico dummy:

```
function DummyTrafficGenerator(rate_lambda):
    while running:
        // Tiempo hasta próximo mensaje dummy (distribución exponencial)
        delay = -ln(random()) / rate_lambda
        sleep(delay)
        
        // Generar y enviar mensaje dummy
        dummy = CreateDummyPacket()
        SendToRandomPeer(dummy)

function CreateDummyPacket():
    // Crear paquete indistinguible de uno real
    path = SelectRandomPath(ONION_HOPS)
    // El padding forzado empareja matemáticamente a 4096 bytes
    payload = random_bytes(FIXED_PACKET_SIZE) 
    return CreateOnionPacket(path, payload, path[-1])
```

---

## 6. Capa de Red

### 6.1 Protocolo de Descubrimiento de Peers

#### 6.1.1 Mensaje de Anuncio

```
PeerAnnounce {
    version:        uint8
    node_id:        bytes[32]
    public_key:     bytes[32]
    addresses:      Address[]
    capabilities:   uint32
    timestamp:      uint64
    signature:      bytes[64]
}

Address {
    type:           uint8       // 0x01=IPv4, 0x02=IPv6, 0x03=Tor
    address:        bytes<256>
    port:           uint16
}
```

#### 6.1.2 Protocolo Gossip

```
function GossipProtocol():
    while running:
        // Seleccionar peers aleatorios
        peers = SelectRandomPeers(FANOUT)
        
        // Preparar mensajes para propagar
        messages = GetPendingMessages()
        
        for peer in peers:
            for msg in messages:
                if not peer.HasSeen(msg.id):
                    Send(peer, msg)
                    peer.MarkSeen(msg.id)
        
        sleep(GOSSIP_INTERVAL)
```

### 6.2 Topología de Red

La red forma un grafo aleatorio d-regular que se regenera periódicamente:

```
function RegenerateTopology():
    // Cada MIX_INTERVAL segundos
    
    // Obtener lista de nodos activos
    nodes = GetActiveNodes()
    
    // Generar grafo d-regular aleatorio
    edges = GenerateRandomRegularGraph(nodes, GRAPH_DEGREE)
    
    // Actualizar conexiones
    for (node_a, node_b) in edges:
        EstablishConnection(node_a, node_b)
    
    // Cerrar conexiones antiguas no en nuevo grafo
    CloseStaleConnections()
```

---

## 7. Capa de Consenso

### 7.1 Blockchain de Identidades

#### 7.1.1 Estructura de Bloque

```
Block {
    header:         BlockHeader
    transactions:   Transaction[]
    validator_sig:  bytes[64]
}

BlockHeader {
    version:        uint8
    index:          uint64
    timestamp:      uint64
    prev_hash:      bytes[32]
    merkle_root:    bytes[32]
    state_root:     bytes[32]
    validator:      bytes[32]
}
```

#### 7.1.2 Tipos de Transacción

```
Transaction {
    type:           uint8
    payload:        bytes<4096>
    proof:          ZKProof
    fee:            uint64
    nonce:          uint64
    signature:      bytes[64]
}

// Tipos:
// 0x01 - RegisterIdentity
// 0x02 - RotateIdentity
// 0x03 - RevokeIdentity
// 0x04 - Stake
// 0x05 - Unstake
```

### 7.2 Consenso Proof of Stake

```
function SelectValidator(stake_map, random_seed):
    total_stake = sum(stake_map.values())
    r = H(random_seed) mod total_stake
    
    cumulative = 0
    for (validator, stake) in stake_map:
        cumulative += stake
        if r < cumulative:
            return validator
    
    // Fallback (no debería llegar aquí)
    return stake_map.keys()[0]

function ProposeBlock(validator_key, transactions):
    // Verificar que somos el validador seleccionado
    if not IsSelectedValidator(validator_key):
        return Error("Not selected validator")
    
    // Construir bloque
    block = Block {
        header: BlockHeader {
            version: 0x01,
            index: chain.height + 1,
            timestamp: current_timestamp(),
            prev_hash: chain.tip.hash(),
            merkle_root: MerkleRoot(transactions),
            state_root: ComputeStateRoot(),
            validator: validator_key.public
        },
        transactions: transactions,
        validator_sig: Sign(validator_key, block.header)
    }
    
    // Propagar bloque
    BroadcastBlock(block)
    
    return block
```

---

## 8. Formatos de Mensaje

### 8.1 Mensaje de Usuario

```
UserMessage {
    version:        uint8
    type:           uint8           // 0x01=text, 0x02=file, 0x03=media
    sender_id:      bytes[32]       // Hash de identidad del emisor
    recipient_id:   bytes[32]       // Hash de identidad del receptor
    timestamp:      uint64
    content:        bytes<65536>
    metadata:       MessageMetadata
}

MessageMetadata {
    reply_to:       bytes[32]?      // ID del mensaje al que responde
    expires_at:     uint64?         // Timestamp de expiración
    flags:          uint32          // Flags (read_receipt, etc.)
}
```

### 8.2 Mensaje de Grupo

```
GroupMessage {
    version:        uint8
    group_id:       bytes[32]
    sender_id:      bytes[32]
    epoch:          uint32          // Época de la clave de grupo
    ciphertext:     bytes<65536>    // Cifrado con clave de grupo
    signature:      bytes[64]       // Firma del emisor
}
```

### 8.3 Mensaje de Control

```
ControlMessage {
    version:        uint8
    type:           uint8
    payload:        bytes<1024>
}

// Tipos de control:
// 0x01 - Acknowledgment
// 0x02 - KeyUpdate
// 0x03 - PresenceUpdate
// 0x04 - TypingIndicator
// 0x05 - ReadReceipt
```

---

## 9. Flujos de Protocolo

### 9.1 Registro de Identidad

```
sequenceDiagram
    participant U as Usuario
    participant N as Nodo
    participant B as Blockchain

    U->>U: GenerateIdentity()
    U->>U: CreateZKProof(identity)
    U->>N: RegisterIdentityTx(public_key, proof)
    N->>N: VerifyProof(proof)
    N->>B: AddToPendingTx(tx)
    B->>B: IncludeInBlock(tx)
    B->>N: BlockConfirmation
    N->>U: RegistrationConfirmed
```

### 9.2 Envío de Mensaje

```
sequenceDiagram
    participant A as Alice
    participant N1 as Nodo1
    participant N2 as Nodo2
    participant N3 as Nodo3
    participant B as Bob

    A->>A: RatchetEncrypt(message)
    A->>A: CreateOnionPacket(path, encrypted)
    A->>N1: OnionPacket
    N1->>N1: ProcessOnion()
    N1->>N2: OnionPacket'
    N2->>N2: ProcessOnion()
    N2->>N3: OnionPacket''
    N3->>N3: ProcessOnion()
    N3->>B: EncryptedMessage
    B->>B: RatchetDecrypt(message)
```

### 9.3 Establecimiento de Sesión

```
sequenceDiagram
    participant A as Alice
    participant B as Bob

    A->>A: GenerateEphemeralKey()
    A->>A: ComputeSharedSecret(bob_pk)
    A->>A: InitRatchet(shared_secret)
    A->>B: SessionInit(eph_pk, first_message)
    B->>B: ComputeSharedSecret(alice_eph_pk)
    B->>B: InitRatchet(shared_secret)
    B->>A: SessionAck(bob_eph_pk)
    Note over A,B: Sesión establecida con Double Ratchet
```

---

## 10. Consideraciones de Seguridad

### 10.1 Modelo de Amenazas

| Adversario | Capacidades | Mitigación |
|------------|-------------|------------|
| Observador pasivo | Observa tráfico de red | Cifrado E2E, onion routing |
| Nodo malicioso | Controla nodos de red | Múltiples saltos, selección aleatoria |
| Adversario global | Observa todo el tráfico | Tráfico dummy, mixing temporal |
| Compromiso de endpoint | Acceso al dispositivo | Forward secrecy, borrado seguro |

### 10.2 Propiedades de Seguridad

#### 10.2.1 Confidencialidad

Todo mensaje m satisface:
```
I(m; view_A) ≤ ε(λ)
```
donde view_A es la vista del adversario y ε(λ) es negligible.

#### 10.2.2 Forward Secrecy

Si la clave SK(t) es comprometida en tiempo t:
```
∀ t' < t: I(messages_{t'}; SK(t)) ≤ ε(λ)
```

#### 10.2.3 Anonimato

Para cualquier par de usuarios:
```
|Pr[A(comm_{u1→v1}) = 1] - Pr[A(comm_{u2→v2}) = 1]| ≤ ε(λ)
```

### 10.3 Recomendaciones de Implementación

1. **Borrado seguro**: Usar `zeroize` para borrar claves de memoria
2. **Timing attacks**: Usar operaciones de tiempo constante
3. **Side channels**: Evitar branches dependientes de secretos
4. **RNG**: Usar CSPRNG del sistema operativo
5. **Mitigación**:
    - **Proof-of-Work Activo (Hashcash)**: Kademlia Swarm descarta cualquier conexión entrante cuya clave pública Ed25519 no comience con `0x0000` (16 bits nulos). Generar una identidad cuesta computacionalmente, imposibilitando spamear la red.
    - Reputación basada en uptime.
    - Selección ponderada de nodos.
6. **Tamaño de Paquete Constante**: Todos los paquetes de red deben tener un tamaño fijo de 4096 bytes para dificultar el análisis de tráfico.

---

## Apéndices

### A. Vectores de Test

Ver archivo `test_vectors.json` para vectores de prueba de todas las operaciones criptográficas.

### B. Códigos de Error

| Código | Descripción |
|--------|-------------|
| 0x0001 | Invalid signature |
| 0x0002 | Invalid proof |
| 0x0003 | Message too large |
| 0x0004 | Unknown recipient |
| 0x0005 | Session expired |
| 0x0006 | Ratchet desync |
| 0x0007 | Network unreachable |
| 0x0008 | Consensus failure |

### C. Referencias

1. Signal Protocol Specification
2. Tor Protocol Specification
3. RFC 7748 - Elliptic Curves for Security
4. RFC 8032 - Edwards-Curve Digital Signature Algorithm
5. RFC 8439 - ChaCha20 and Poly1305
6. BLAKE3 Specification

---

**Fin del Documento**
