# RED — Sovereign Mesh OS v105.0.0
> **Build Code:** 105000 | **Release Channel:** stable-p2p | **Protocol Version:** RED/105.0-NOISE-PQC | **Date:** 2026-09-14

Plataforma táctica de comunicaciones descentralizadas y soberanas fuera de red (Off-Grid) con criptografía post-cuántica (NIST FIPS 203 ML-KEM-768 / Kyber-768), canales E2E Double Ratchet, división polinómica de secretos de Shamir (SSS 3-de-5), ficha médica de rescate con firma táctica Ed25519, enrutamiento en malla P2P multi-radio (BLE + WiFi Direct + WebRTC + LoRa + SoundMesh), y 100% de cobertura en 12 idiomas.

---

## Novedades Principales de la Versión v105.0.0

### 1. Armadura Criptográfica Post-Cuántica Wire-Format (NIST FIPS 203 ML-KEM-768)
- **Contenedor Binario PQC1 (`0x50514331`):** Empaquetado canónico wire-format de 1138 bytes de cabecera que integra 1088 bytes de texto cifrado ML-KEM-768 con 32 bytes de clave efímera Curve25519 y vector de inicialización AES-256-GCM de 12 bytes.
- **KDF Híbrida SHA-256:** Derivación criptográfica unificada a partir del secreto compartido post-cuántico (`ss_kem`) y clásico (`ss_x25519`), garantizando protección dual tanto contra ataques clásicos como contra adversarios cuánticos "Harvest Now, Decrypt Later".
- **Wire Flag `FLAG_PQC_ENCRYPTED = 0x20`:** Señalización en cabecera de trama de malla para negociación y desencapsulación determinista entre pares en la red ad-hoc.
- **Constante Canónica `PQC_TYPE_KEY_ANNOUNCE`:** Estandarización del tipo de paquete JSON para anuncios de claves públicas PQC en la malla, eliminando literales mágicos en `meshRouter.ts` y en la interfaz de usuario.

### 2. Bóveda Soberana de Secretos Shamir (SSS 3-de-5 en GF(2^8))
- **División Criptográfica:** Fragmentación matemática de semillas mnemónicas BIP-39 o secretos en 5 partes independientes; cualquier combinación de 3 fragmentos reconstruye el secreto bit-a-bit con exactitud.
- **Parser Multiformato Tolerante a Fallos:** Capacidad de reconstrucción a partir de objetos JSON, líneas de texto táctico `RED_SSS:index:hex`, o secuencias separadas por espacios.
- **Interfaz Integrada en Bóveda:** Pestaña dedicada en `IdentityVaultModal` con copiado rápido de fragmentos individuales o colectivos.

### 3. Ficha Médica Cifrada de Rescate & Triaje START
- **Credencial QR Firmada Táctica:** Generación de código QR firmado con SHA-256 / Ed25519 que almacena grupo sanguíneo, alergias críticas y contacto de emergencia.
- **Acceso Inmediato sin Conexión:** Diseñado para rescatistas y personal médico en escenarios de triaje START o inconsciencia del operador, sin requerir conexión a internet ni emisión de radiofrecuencia.

### 4. Paridad de Internacionalización al 100.0% en 12 Idiomas
- **65 Nuevas Claves Canónicas SSOT:** Agregadas al archivo maestro `es.ts` y propagadas con traducción nativa a los 11 idiomas restantes (`en`, `fr`, `de`, `it`, `pt`, `ru`, `ja`, `zh`, `ar`, `ko`, `qu`).
- **Cero Cadenas Hardcodeadas:** Migración total de textos estáticos, placeholders, tabs y notificaciones toast de `IdentityVaultModal.tsx` a llamadas `t()`.
- **Auditoría Estricta Superada:** 1521 de 1521 claves canónicas sincronizadas al 100.0% en todos los idiomas del sistema.

### 5. Motor de Integridad de Estado Blindado (`StateIntegrityEngine`)
- **Protección de Claves Hexadecimales:** Corrección del analizador de integridad para evitar que claves públicas en formato string plano (`red_pqc_kyber_public_key`, `red_pqc_x25519_public_key`) sean clasificadas erróneamente como datos corruptos por `JSON.parse`.
- **Soporte de Bóveda Médica:** Inclusión de `red_identity_vault_v1` en el conjunto de claves críticas supervisadas por el árbol Merkle de estado local.

### 6. Despliegue en Limpio y Validación en Hardware Real (Moto G22)
- Desinstalación y reinstalación en limpio del paquete `f.red.app` en dispositivo físico Moto G22 (`ZT322B386P`).
- Monitorización activa de Logcat: 0 excepciones fatales, 0 caídas en tiempo de ejecución, inicialización correcta de bibliotecas nativas C++ / Rust (`libred_mobile.so`), y renderizado fluido a 90 FPS.

---

## Binarios Oficiales para Descarga Directa

| Archivo | Descripción | Plataforma | Suma SHA-256 |
| :--- | :--- | :--- | :--- |
| **red-latest.apk** | Instalador Universal Oficial v105.0.0 (PQC Armor + SSS + Medical Vault) | Android 7.0+ (ARM64 / ARMv7) | `D99E2344DC58211E954A8923ED93FEFAA54DBBEBC30BEAFC1E8E377856EA054A` |
| **red-v105.0.0-release.apk** | Binario canónico versionado para archivo y verificación de integridad | Android 7.0+ (ARM64 / ARMv7) | `D99E2344DC58211E954A8923ED93FEFAA54DBBEBC30BEAFC1E8E377856EA054A` |

> **Web Companion Oficial:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
