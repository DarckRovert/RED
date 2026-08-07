# 📜 Especificación del Protocolo Ω (RED v30.0.0 Sovereign Master)

**Versión**: 30.0.0 | **Estado**: Estándar de Producción Aprobado | **Fecha**: Agosto 2026

---

## 📋 Tabla de Contenidos

1. [Introducción & Primitivas Criptográficas](#1-introducción--primitivas-criptográficas)
2. [Capa de Identidad & DID (`did:red:`)](#2-capa-de-identidad--did-didred)
3. [Handshake Noise XK & Cifrado de Sesión](#3-handshake-noise-xk--cifrado-de-sesión)
4. [Estructura del Mensaje Binario (Onion Envelope)](#4-estructura-del-mensaje-binario-onion-envelope)
5. [Enrutamiento Malla DTN & Deduplicación](#5-enrutamiento-malla-dtn--deduplicación)
6. [Flujo de Intercambio Recíproco de Contactos](#6-flujo-de-intercambio-recíproco-de-contactos)

---

## 1. Introducción & Primitivas Criptográficas

El **Protocolo Ω** especifica el estándar de intercambio de información segura de RED. Se basa en primitivas criptográficas de curva elíptica de alta velocidad:

- **Firma de Identidad & Autenticación**: Ed25519 (256-bit security).
- **Intercambio Efímero de Claves**: X25519 (ECDH).
- **Cifrado Simétrico Autenticado**: ChaCha20-Poly1305 (AEAD).
- **Función Hash**: BLAKE3 / SHA-256.

---

## 2. Capa de Identidad & DID (`did:red:`)

Cada entidad en la red RED posee un Identificador Descentralizado Soberano (`DID`):

```
did:red:<identity_hash>:<public_key_hex>
```

- **`identity_hash`**: Hash BLAKE3 de 64 caracteres de la clave pública estática Ed25519 del nodo.
- **`public_key_hex`**: Representación en formato hexadecimal de 64 caracteres de la clave pública X25519.

---

## 3. Handshake Noise XK & Cifrado de Sesión

Para iniciar la sesión de mensajes entre el Nodo A (Emisor) y el Nodo B (Receptor):

1. **Mensaje 1 (Handshake Initiation)**:  
   `A -> B`: `e`, `es`, `s`, `ss`  
   El Nodo A genera un par de claves efímeras X25519 `e` y realiza un DH con la clave estática `s` del Nodo B.
2. **Derivación de Clave Simétrica (Symmetric Key Exchange)**:  
   Se deriva una clave de sesión simétrica mediante HKDF.
3. **Cifrado de Payload**:  
   Cada paquete de texto, imagen o audio se cifra con **ChaCha20-Poly1305** usando la clave de sesión y un contador de nonce autoincremental de 64 bits.

---

## 4. Estructura del Mensaje Binario (Onion Envelope)

```
+-------------------+-------------------+-------------------+-------------------+
|  Version (1 byte) |   TTL (1 byte)    |  Nonce (12 bytes) |  Recipient Hash   |
+-------------------+-------------------+-------------------+-------------------+
|  Sender Hash      | Msg Type (1 byte) | Encrypted Payload (ChaCha20-Poly1305)  |
+-------------------+-------------------+-------------------+-------------------+
```

---

## 5. Enrutamiento Malla DTN & Deduplicación

- **TTL (Time To Live)**: Cada relé intermedio decrementa el byte de TTL en 1. Si `TTL == 0`, el paquete se descarta.
- **Deduplicación de Nonces**: Los nodos mantienen un mapa `seen_nonces` indexado por `(nonce, timestamp)` guardado por 72 horas para prevenir loops en mallas circulares.

---

## 6. Flujo de Intercambio Recíproco de Contactos

```
Nodo A (Moto G22)                                    Nodo B (Tablet Lenovo)
      │                                                         │
      │  1. Escanea QR (did:red:hashA:pkA)                      │
      │────────────────────────────────────────────────────────►│
      │  2. Envia contact_request {sender_hash, sender_pk}      │
      │─────────────────── BLE / Mesh ─────────────────────────►│
      │                                                         │ (Guarda HashA + PkA)
      │  3. Responde contact_response {sender_hash, sender_pk}  │
      │◄────────────────── BLE / Mesh ──────────────────────────│
(Guarda HashB + PkB)                                             │
      │                                                         │
      │  4. Canal Cifrado E2E Bidireccional Listo               │
      │◄=======================================================►│
```
