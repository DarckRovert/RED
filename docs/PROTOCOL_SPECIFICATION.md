# 📜 Especificación del Protocolo Ω (RED v31.0.0 Sovereign Master)

**Versión**: 31.0.0 | **Estado**: Estándar de Producción Aprobado | **Fecha**: Agosto 2026

---

## 📋 Tabla de Contenidos

1. [Introducción & Primitivas Criptográficas](#1-introducción--primitivas-criptográficas)
2. [Capa de Identidad & DID (`did:red:`)](#2-capa-de-identidad--did-didred)
3. [Handshake Híbrido Post-Cuántico (ML-KEM-768 + Noise XK)](#3-handshake-híbrido-post-cuántico-ml-kem-768--noise-xk)
4. [Cabecera de Prueba de Trabajo Anti-DDoS (Hashcash PoW)](#4-cabecera-de-prueba-de-trabajo-anti-ddos-hashcash-pow)
5. [Estructura del Paquete Binario (Envelope Táctico)](#5-estructura-del-paquete-binario-envelope-táctico)
6. [Trama de Voz Comprimida (LowBitrateVocoder)](#6-trama-de-voz-comprimida-lowbitratevocoder)
7. [Enrutamiento Malla DTN & Deduplicación](#7-enrutamiento-malla-dtn--deduplicación)

---

## 1. Introducción & Primitivas Criptográficas

El **Protocolo Ω** especifica el estándar de intercambio de información segura de RED. Se basa en primitivas de vanguardia resistentes a computación clásica y cuántica:

- **Firma de Identidad & Autenticación**: Ed25519 (256-bit security).
- **Encapsulamiento Post-Cuántico**: ML-KEM-768 (FIPS 203, M-LWE en retículos).
- **Intercambio Efímero de Claves**: X25519 / NIST P-256 (Dual Hybrid ECDH).
- **Cifrado Simétrico Autenticado**: AES-256-GCM / ChaCha20-Poly1305 (AEAD).
- **Función Hash**: SHA-256 / BLAKE3.

---

## 2. Capa de Identidad & DID (`did:red:`)

Cada entidad en la red RED posee un Identificador Descentralizado Soberano (`DID`):

```
did:red:<identity_hash>:<public_key_hex>
```

- **`identity_hash`**: Hash criptográfico de 64 caracteres de la clave pública estática Ed25519 del nodo.
- **`public_key_hex`**: Representación en formato hexadecimal de 64 caracteres de la clave pública X25519.

---

## 3. Handshake Híbrido Post-Cuántico (ML-KEM-768 + Noise XK)

Para iniciar una sesión cifrada E2EE inmune a computadoras cuánticas:

1. **Encapsulamiento ML-KEM-768**:  
   El emisor genera un par efímero y encapsula un secreto cuántico $K_{PQC}$ de 256 bits contra la clave pública del receptor.
2. **Intercambio Efímero Elíptico**:  
   Se ejecuta en paralelo un intercambio Diffie-Hellman $K_{ECDH}$ (X25519).
3. **Derivación de Clave Maestra**:  
   $$K_{Session} = \text{HKDF-SHA256}(K_{PQC} \,\|\, K_{ECDH}, \text{salt}=\text{SHA-256}(PK_{PQC} \,\|\, PK_{ECDH}))$$
4. **Cifrado de Payload**:  
   Cada paquete se cifra con **AES-256-GCM** o **ChaCha20-Poly1305** usando la clave de sesión y un contador de nonce autoincremental de 64 bits.

---

## 4. Cabecera de Prueba de Trabajo Anti-DDoS (Hashcash PoW)

Todo paquete transmitido por radio malla incluye una cabecera de prueba de trabajo:

```
+---------------------------------------------------------------+
|  nonce (8 bytes)  | difficulty (1 byte) | timestamp (8 bytes) |
|  hash (32 bytes) = SHA-256(payload || sender || time || diff || nonce)
+---------------------------------------------------------------+
```

---

## 5. Estructura del Paquete Binario (Envelope Táctico)

```
+-------------------+-------------------+-------------------+-------------------+
|  Version (1 byte) |   TTL (1 byte)    |  Nonce (12 bytes) |  Recipient Hash   |
+-------------------+-------------------+-------------------+-------------------+
|                   Sender Identity Hash (32 bytes)                             |
+-------------------------------------------------------------------------------+
|                   PoW Challenge Header (49 bytes)                             |
+-------------------------------------------------------------------------------+
|                   Encrypted Payload (Variable: AES-256-GCM)                   |
+-------------------------------------------------------------------------------+
|                   Authentication Tag MAC (16 bytes)                           |
+-------------------------------------------------------------------------------+
```

---

## 6. Trama de Voz Comprimida (LowBitrateVocoder)

Para transmisión por LoRa (915 MHz) o ultrasonido SoundMesh (18.5–20.5 kHz):

```
+---------------------------------------------------------------+
| Magic (0x56) | Version (0x01) | Sample Count (4B Big-Endian)  |
| Initial Predicted Sample (2B) | Step Table Index (1B)         |
| Packed 4-Bit ADPCM Nibbles (ceil(Samples / 2) bytes)          |
+---------------------------------------------------------------+
```

---

## 7. Enrutamiento Malla DTN & Deduplicación

- **Inundación Controlada (Controlled Flood)**: Cada nodo retransmite el paquete a sus vecinos si no es el destinatario final y el TTL > 0.
- **Ventana de Deduplicación**: Tabla de nonces en memoria durante 72 horas para prevenir bucles de enrutamiento.
- **Store-and-Forward**: Almacenamiento diferido de paquetes en cola cifrada cuando el destinatario está temporalmente fuera de rango radio.
