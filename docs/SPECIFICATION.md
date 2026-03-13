# 📋 Especificación Técnica del Sistema RED (Ω)

## 1. DEFINICIÓN FORMAL DEL SISTEMA

### 1.1 Conjuntos Fundamentales

```
𝕌 = Conjunto de usuarios (infinito numerable)
𝕄 = Conjunto de mensajes posibles
𝕋 = Línea temporal discreta (t ∈ ℕ)
ℕ𝕆𝔻 = Conjunto de nodos de red
```

### 1.2 Parámetros de Seguridad

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| λ | 256 bits | Parámetro de seguridad principal |
| Δt | 15 segundos | Intervalo de mezclado de red |
| L | 3 | Longitud de camino onion |
| T_max | 30 días | Retención máxima de mensajes |
| d | 8 | Grado del grafo regular de red |

## 2. SISTEMA DE IDENTIDAD

### 2.1 Estructura de Identidad Anónima

Para cada usuario `u ∈ 𝕌` en tiempo `t`:

```rust
struct Identity {
    secret_key: [u8; 32],      // SK_u(t) - Clave secreta efímera
    public_key: [u8; 32],      // PK_u(t) = G(SK_u(t))
    identity_hash: [u8; 32],   // ID_u(t) = H(PK_u(t) || r)
    created_at: u64,           // Timestamp de creación
    expires_at: u64,           // Timestamp de expiración
}
```

### 2.2 Propiedades de Identidad

1. **Efímera**: Las identidades rotan cada 24 horas
2. **Unlinkable**: `∀ t1 ≠ t2, ID_u(t1)` es computacionalmente independiente de `ID_u(t2)`
3. **Única**: `∀ u ≠ v, ∀ t: Pr[ID_u(t) = ID_v(t)] ≤ 2^{-256}`

### 2.3 Registro en Blockchain

```
R: 𝕌 × 𝕋 → {0,1}^* ∪ ⊥

R(u,t) = 
  { PK_u(t) si proof_valid(π_u(t))
  { ⊥ en caso contrario
```

Donde `π_u(t)` es prueba zero-knowledge de:
- Conocimiento de `SK_u(t)` correspondiente a `PK_u(t)`
- No duplicación de identidad

## 3. PROTOCOLO DE CIFRADO

### 3.1 Algoritmos Criptográficos

| Función | Algoritmo | Propósito |
|---------|-----------|----------|
| Key Exchange | X25519 | Intercambio de claves Diffie-Hellman |
| Symmetric Encryption | ChaCha20-Poly1305 | Cifrado autenticado |
| Hash | BLAKE3 | Hashing rápido y seguro |
| Signature | Ed25519 | Firmas digitales |
| KDF | HKDF-SHA256 | Derivación de claves |

### 3.2 Protocolo Double Ratchet (Simplificado)

```
Para mensaje m del usuario u al usuario v:

1. Generación de claves efímeras:
   eph_sk, eph_pk ← KeyGen()
   shared_secret ← X25519(eph_sk, PK_v)
   
2. Derivación de claves:
   (chain_key, message_key) ← HKDF(shared_secret, salt)
   
3. Cifrado (Encrypt-then-MAC):
   nonce ← random(12 bytes)
   ciphertext ← ChaCha20-Poly1305(message_key, nonce, m)
   
4. Mensaje final:
   M = (eph_pk, nonce, ciphertext)
```

### 3.3 Propiedad de Deniabilidad

```
∃ simulador S tal que ∀ m, ∀ adversario A:
Pr[A(Encrypt(k, m)) = 1] - Pr[A(S(|m|)) = 1] ≤ ε(λ)
```

Donde `ε(λ)` es negligible en el parámetro de seguridad.

## 4. TOPOLOGÍA DE RED

### 4.1 Estructura P2P

```
G(t) = (V, E(t)) grafo aleatorio dinámico

Donde:
- V = ℕ𝕆𝔻 (conjunto de nodos)
- E(t) se regenera cada Δt con distribución uniforme
- Cada nodo mantiene d = 8 conexiones
```

### 4.2 Onion Routing

```
Para enviar mensaje de u a v:

1. Seleccionar L = 3 nodos intermedios: n1, n2, n3
2. Construir capas de cifrado:
   
   layer3 = Encrypt(K_v, message)
   layer2 = Encrypt(K_n3, (addr_v, layer3))
   layer1 = Encrypt(K_n2, (addr_n3, layer2))
   layer0 = Encrypt(K_n1, (addr_n2, layer1))
   
3. Enviar layer0 a n1
```

### 4.3 Resistencia a Análisis de Tráfico

```
Sea T_u(t) = {τ1, τ2, ...} tiempos de mensajes de u

Para cada usuario:
- Generar mensajes dummy con tasa λ_dummy
- La secuencia {τ_i - τ_{i-1}} es indistinguible de proceso Poisson
```

## 5. BLOCKCHAIN DE IDENTIDADES

### 5.1 Propósito

La blockchain se usa SOLO para:
1. Registro de identidades públicas
2. Revocación de claves comprometidas
3. Directorio descentralizado de usuarios

**NO se usa para**: Almacenar mensajes (sería lento e ineficiente)

### 5.2 Consenso

```
Proof of Stake (PoS) con:
- Tiempo de bloque: 6 segundos
- Finalidad: 2 bloques (~12 segundos)
- Validadores: Mínimo 100 nodos
- Stake mínimo: 1000 RED tokens
```

### 5.3 Estructura de Bloque

```rust
struct Block {
    header: BlockHeader,
    identity_registrations: Vec<IdentityRegistration>,
    identity_revocations: Vec<IdentityRevocation>,
    validator_updates: Vec<ValidatorUpdate>,
}

struct IdentityRegistration {
    public_key: [u8; 32],
    identity_hash: [u8; 32],
    zk_proof: ZKProof,
    timestamp: u64,
}
```

## 6. ALMACENAMIENTO

### 6.1 Estado Local del Usuario

```rust
struct UserState {
    identity: Identity,
    contacts: HashMap<IdentityHash, Contact>,
    conversations: HashMap<ConversationId, Conversation>,
    pending_messages: Vec<EncryptedMessage>,
}

struct Conversation {
    messages: Vec<StoredMessage>,
    ratchet_state: RatchetState,
    last_activity: u64,
}
```

### 6.2 Política de Retención

```
∀ mensaje m con timestamp τ:
  si τ < now() - T_max → borrar(m)
```

## 7. PROPIEDADES DE SEGURIDAD

### 7.1 Teorema de Forward Secrecy

```
Si SK_u(t) es comprometido, ∀ t' < t:
I({m_{t'}}; SK_u(t)) ≤ ε_fs(λ)
```

**Prueba**: Por construcción del Double Ratchet, cada mensaje usa claves derivadas que son borradas después del uso.

### 7.2 Teorema de Resistencia a Censura

```
∀ u,v ∈ 𝕌, ∀ t ∈ 𝕋:
Pr[entrega(m, u, v, t) = éxito] ≥ 1 - δ(t)

donde δ(t) = O(1/|ℕ𝕆𝔻|)
```

**Prueba**: Con onion routing y múltiples caminos, el adversario necesitaría controlar todos los nodos en al menos un camino.

### 7.3 Teorema de Completitud

```
Si u y v están correctos y conectados:
lim_{t→∞} Pr[m entregado en ≤ Δt] = 1
```

## 8. INTERFACES DEL SISTEMA

### 8.1 API Principal

```rust
trait RedProtocol {
    // Identidad
    fn generate_identity() -> Result<Identity, Error>;
    fn rotate_identity(current: &Identity) -> Result<Identity, Error>;
    fn register_identity(identity: &Identity) -> Result<TxHash, Error>;
    
    // Mensajería
    fn send_message(to: &IdentityHash, message: &[u8]) -> Result<MessageId, Error>;
    fn receive_messages() -> Result<Vec<DecryptedMessage>, Error>;
    
    // Contactos
    fn add_contact(identity_hash: &IdentityHash) -> Result<Contact, Error>;
    fn verify_contact(contact: &Contact, proof: &ZKProof) -> Result<bool, Error>;
    
    // Red
    fn connect_to_network(bootstrap_nodes: &[NodeAddr]) -> Result<(), Error>;
    fn get_network_status() -> NetworkStatus;
}
```

## 9. MODELO DE AMENAZAS

### 9.1 Capacidades del Adversario

**PUEDE:**
- Controlar hasta f < 1/3 de los nodos de red
- Observar tiempos de mensajes globales
- Comprometer usuarios individuales adaptativamente
- Realizar ataques Sybil limitados

**NO PUEDE:**
- Romper primitivas criptográficas (modelo ROM)
- Controlar mayoría de nodos honestos
- Acceder a claves privadas sin comprometer dispositivo

### 9.2 Mitigaciones

| Ataque | Mitigación |
|--------|------------|
| MITM | Verificación de claves fuera de banda |
| Sybil | Proof of Stake + reputación |
| Traffic Analysis | Onion routing + dummy traffic |
| Metadata Leakage | Identidades efímeras + padding |
| Key Compromise | Forward secrecy + rotación |

## 10. REQUISITOS DE IMPLEMENTACIÓN

### 10.1 Performance

| Métrica | Objetivo |
|---------|----------|
| Latencia de mensaje | < 2 segundos |
| Throughput por nodo | > 1000 msg/s |
| Tiempo de registro | < 15 segundos |
| Uso de memoria | < 100 MB |
| Almacenamiento | < 1 GB por usuario |

### 10.2 Escalabilidad

- Soportar 10^6 usuarios activos
- 10^4 nodos de red
- 10^9 mensajes por día

---

*Documento vivo - Última actualización: Febrero 2026*
