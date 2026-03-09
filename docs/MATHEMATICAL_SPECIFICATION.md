# Especificación Matemática del Sistema Ω (RED)

## 1. Definiciones Fundamentales

### 1.1 Conjuntos Base

- **𝕌** (Usuarios): Conjunto infinito numerable de usuarios
- **𝕄** (Mensajes): Conjunto de mensajes posibles, 𝕄 ⊆ {0,1}*
- **𝕋** (Tiempo): Línea temporal discreta, t ∈ ℕ
- **ℕ𝕆𝔻** (Nodos): Conjunto de nodos de red

### 1.2 Parámetros de Seguridad

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| λ | 128 | Parámetro de seguridad principal |
| Δt | 30s | Intervalo de mezclado de red |
| L | 3 | Longitud de camino onion |
| T_max | 30 días | Retención máxima de mensajes |
| d | 8 | Grado del grafo regular |
| f | < 1/3 | Fracción máxima de nodos maliciosos |

---

## 2. Sistema de Identidad Anónima

### 2.1 Generación de Identidad

Para cada usuario u ∈ 𝕌 en tiempo t:

```
SK_u(t) ←_R {0,1}^256          # Clave secreta efímera
PK_u(t) = G(SK_u(t))            # Clave pública (X25519)
ID_u(t) = H(PK_u(t) || r)       # Hash de identidad, r aleatorio
```

Donde:
- G: {0,1}^256 → {0,1}^256 es la función de derivación X25519
- H: {0,1}* → {0,1}^256 es BLAKE3
- r ←_R {0,1}^128 es un nonce aleatorio

### 2.2 Propiedad de Unlinkability

**Teorema (Independencia Temporal):**
∀ t₁ ≠ t₂, ID_u(t₁) es computacionalmente independiente de ID_u(t₂)

**Prueba:**
Dado que r₁ y r₂ son independientes y uniformemente aleatorios:
```
Pr[A(ID_u(t₁), ID_u(t₂)) = 1] - Pr[A(R₁, R₂) = 1] ≤ ε(λ)
```
Donde R₁, R₂ son uniformemente aleatorios y ε(λ) es negligible.

---

## 3. Protocolo de Cifrado

### 3.1 Intercambio de Claves (X3DH Simplificado)

Para establecer sesión entre Alice (a) y Bob (b):

```
# Alice genera claves efímeras
sk_eph_a ←_R {0,1}^256
pk_eph_a = G(sk_eph_a)

# Secreto compartido (Triple DH)
DH1 = DH(sk_a, pk_b)           # Identidad-Identidad
DH2 = DH(sk_eph_a, pk_b)       # Efímera-Identidad  
DH3 = DH(sk_eph_a, pk_eph_b)   # Efímera-Efímera

# Clave maestra
master_secret = KDF(DH1 || DH2 || DH3)
```

### 3.2 Double Ratchet

**Estado del Ratchet:**
```
State = {
    RK: [u8; 32],      # Root Key
    CK_s: [u8; 32],    # Sending Chain Key
    CK_r: [u8; 32],    # Receiving Chain Key
    DH_s: KeyPair,     # DH Ratchet (sending)
    DH_r: PublicKey,   # DH Ratchet (receiving)
    N_s: u32,          # Message number (sending)
    N_r: u32,          # Message number (receiving)
    PN: u32,           # Previous chain length
}
```

**Avance del Ratchet DH:**
```
function dh_ratchet(state, pk_remote):
    state.PN = state.N_s
    state.N_s = 0
    state.N_r = 0
    state.DH_r = pk_remote
    (state.RK, state.CK_r) = KDF_RK(state.RK, DH(state.DH_s.sk, state.DH_r))
    state.DH_s = generate_keypair()
    (state.RK, state.CK_s) = KDF_RK(state.RK, DH(state.DH_s.sk, state.DH_r))
```

**Avance del Ratchet de Cadena:**
```
function chain_ratchet(CK):
    MK = HMAC(CK, 0x01)    # Message Key
    CK' = HMAC(CK, 0x02)   # Next Chain Key
    return (MK, CK')
```

### 3.3 Cifrado de Mensaje

```
function encrypt(state, plaintext):
    (MK, state.CK_s) = chain_ratchet(state.CK_s)
    header = (state.DH_s.pk, state.PN, state.N_s)
    state.N_s += 1
    ciphertext = AEAD_Encrypt(MK, plaintext, header)
    return (header, ciphertext)
```

### 3.4 Propiedad de Deniabilidad

**Definición:** El protocolo tiene deniabilidad perfecta si:

∃ simulador S tal que ∀ m, ∀ adversario A:
```
|Pr[A(E(k_eph, m)) = 1] - Pr[A(S(|m|)) = 1]| ≤ ε(λ)
```

**Construcción del Simulador:**
```
S(n):
    r ←_R {0,1}^(n + 16)    # Tamaño del ciphertext
    return r
```

La indistinguibilidad se deriva de la seguridad IND-CPA de ChaCha20-Poly1305.

---

## 4. Topología de Red

### 4.1 Grafo Dinámico

Sea G(t) = (V, E(t)) donde:
- V = ℕ𝕆𝔻 (conjunto de nodos)
- E(t) se regenera cada Δt

**Distribución de E(t):**
E(t) es uniforme sobre el conjunto de grafos d-regulares con |V| vértices.

### 4.2 Enrutamiento Onion

Para mensaje m de u a v:

```
# Selección de camino
path = random_path(G(t), L)    # L = 3 nodos intermedios
path = [n₁, n₂, n₃, v]

# Construcción de capas
k₃ = DH(sk_u, pk_v)
k₂ = DH(sk_u, pk_n₃)
k₁ = DH(sk_u, pk_n₂)
k₀ = DH(sk_u, pk_n₁)

layer₃ = Enc(k₃, m || padding)
layer₂ = Enc(k₂, layer₃ || addr(v))
layer₁ = Enc(k₁, layer₂ || addr(n₃))
layer₀ = Enc(k₀, layer₁ || addr(n₂))

onion = (pk_eph, layer₀)
```

### 4.3 Resistencia a Análisis de Tráfico

**Mensajes Dummy:**
Cada usuario envía mensajes según proceso de Poisson con tasa λ_dummy.

Sea T_u(t) = {τ₁, τ₂, ...} los tiempos de mensajes de u.

**Invariante:**
```
∀ u, la secuencia {τ_i - τ_{i-1}} es indistinguible de Exp(λ_dummy)
```

---

## 5. Propiedades de Seguridad

### 5.1 Confidencialidad del Contenido

**Definición:**
```
∀ u,v ∈ 𝕌, ∀ m ∈ 𝕄, ∀ t ∈ 𝕋:
I(m; view_A(t)) ≤ ε_c(λ)
```

Donde I(·;·) es información mutua y view_A(t) es la vista del adversario.

### 5.2 Anonimato (Unlinkability)

**Definición:**
```
∀ u₁,u₂ ∈ 𝕌, ∀ v₁,v₂ ∈ 𝕌:
|Pr[A(ID_{u₁→v₁}(t)) = 1] - Pr[A(ID_{u₂→v₂}(t)) = 1]| ≤ ε_a(λ)
```

### 5.3 Forward Secrecy

**Teorema:**
Si SK_u(t) es comprometido, entonces ∀ t' < t:
```
I({m_{t'}}; SK_u(t)) ≤ ε_fs(λ)
```

**Prueba (Sketch):**
1. Las claves de mensaje MK se derivan de la cadena de ratchet
2. Cada MK se borra después de uso
3. El ratchet DH avanza con cada intercambio
4. Conocer SK_u(t) no permite derivar claves anteriores debido a la one-wayness de KDF

### 5.4 Resistencia a Censura

**Teorema:**
```
∀ u,v ∈ 𝕌, ∀ t ∈ 𝕋:
Pr[entrega(m, u, v, t) = éxito] ≥ 1 - δ(t)
```

Donde δ(t) = O(1/|ℕ𝕆𝔻|)

**Prueba:**
Con f < 1/3 nodos maliciosos y caminos de longitud L:
```
Pr[camino comprometido] ≤ f^L = (1/3)^3 ≈ 0.037
```

### 5.5 Completitud

**Teorema:**
Si u y v están correctos y conectados:
```
lim_{t→∞} Pr[m entregado en ≤ Δt] = 1
```

---

## 6. Invariantes del Sistema

### Inv1: Unicidad de Identidad
```
∀ u ≠ v, ∀ t: Pr[ID_u(t) = ID_v(t)] ≤ 2^{-λ}
```

### Inv2: Consistencia Eventual
```
∀ u,v honestos: lim_{t→∞} state_u(t)[v] = state_v(t)[u]
```

### Inv3: Eficiencia Sublineal
```
∀ u: storage_u(t) = O(log t + n_contacts)
```

---

## 7. Modelo de Amenazas

### 7.1 Capacidades del Adversario

El adversario A puede:
- Controlar subconjunto A ⊂ ℕ𝕆𝔻 con |A|/|ℕ𝕆𝔻| ≤ f
- Observar tiempos de mensajes globales
- Comprometer usuarios individuales adaptativamente

### 7.2 Limitaciones del Adversario

A NO puede:
- Romper primitivas criptográficas (modelo ROM)
- Controlar mayoría de nodos honestos
- Predecir salidas de CSPRNG

### 7.3 Juegos de Seguridad

**Juego IND-CPA para mensajes:**
```
1. Challenger genera (sk, pk)
2. Adversario elige m₀, m₁ con |m₀| = |m₁|
3. Challenger elige b ←_R {0,1}, envía c = Enc(pk, m_b)
4. Adversario produce b'
5. Adversario gana si b' = b

Ventaja: Adv_A = |Pr[b' = b] - 1/2| ≤ ε(λ)
```

---

## 8. Blockchain de Identidades

### 8.1 Estructura de Bloque

```
Block = {
    index: u64,
    timestamp: u64,
    prev_hash: [u8; 32],
    merkle_root: [u8; 32],
    transactions: Vec<IdentityTx>,
    validator: PublicKey,
    signature: Signature,
}
```

### 8.2 Transacción de Identidad

```
IdentityTx = {
    tx_type: {Register, Rotate, Revoke},
    public_key: [u8; 32],
    proof: ZKProof,
    timestamp: u64,
}
```

### 8.3 Prueba Zero-Knowledge

Para registro de identidad:
```
π_u(t) prueba que:
∃ w: H(w) = root ∧ MerklePath(w, PK_u(t)) = 1 ∧ ∀ t' < t: PK_u(t') ≠ PK_u(t)
```

### 8.4 Consenso (Proof of Stake)

```
function select_validator(stake_map, random_seed):
    total_stake = sum(stake_map.values())
    r = H(random_seed) mod total_stake
    cumulative = 0
    for (validator, stake) in stake_map:
        cumulative += stake
        if r < cumulative:
            return validator
```

---

## 9. Análisis de Complejidad

### 9.1 Complejidad Temporal

| Operación | Complejidad |
|-----------|-------------|
| Generar identidad | O(1) |
| Cifrar mensaje | O(|m|) |
| Descifrar mensaje | O(|m|) |
| Ratchet DH | O(1) |
| Enrutamiento onion | O(L) |
| Búsqueda de ruta | O(log |V|) |

### 9.2 Complejidad Espacial

| Componente | Espacio |
|------------|--------|
| Identidad | O(1) = 96 bytes |
| Estado de sesión | O(1) = ~200 bytes |
| Mensaje cifrado | O(|m|) + 48 bytes overhead |
| Almacenamiento local | O(log t + n_contacts) |

### 9.3 Complejidad de Red

| Métrica | Valor |
|---------|-------|
| Mensajes por envío | L + 1 = 4 |
| Latencia esperada | O(L · RTT) |
| Ancho de banda overhead | ~3x (por capas onion) |

---

## 10. Referencias

1. Cohn-Gordon et al. "A Formal Security Analysis of the Signal Messaging Protocol" (2017)
2. Perrin & Marlinspike. "The Double Ratchet Algorithm" (2016)
3. Danezis & Goldberg. "Sphinx: A Compact and Provably Secure Mix Format" (2009)
4. Bernstein. "Curve25519: new Diffie-Hellman speed records" (2006)
5. Aumasson et al. "BLAKE3: one function, fast everywhere" (2020)
