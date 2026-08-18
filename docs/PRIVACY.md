# Política de Privacidad — RED

**Fecha de entrada en vigor:** 21 de Marzo, 2026

En **RED (Red Encriptada Descentralizada)**, la privacidad no es una característica opcional; es el fundamento de nuestro protocolo. Esta política describe cómo manejamos la información (o la falta de ella).

## 1. Minimalismo de Datos por Diseño
RED está diseñado para funcionar sin recolectar ninguna información personal protegida (PII).
- **Sin Números de Teléfono:** No requerimos validación por SMS.
- **Sin Correos Electrónicos:** No hay cuentas vinculadas a identidades del mundo real.
- **Identidades DID:** Tu identidad es un identificador descentralizado generado localmente en tu dispositivo.

## 2. Cifrado de Extremo a Extremo (E2E) & Post-Cuántica (PQC)
Todos los mensajes, archivos y metadatos de comunicación están cifrados mediante:
- **ML-KEM-768 (FIPS 203):** Encapsulación de claves basada en retículos post-cuánticos.
- **X25519 / NIST P-256:** Para el intercambio híbrido de claves efímeras (Dual Hybrid ECDH).
- **AES-256-GCM / ChaCha20-Poly1305:** Para el cifrado autenticado de datos en tránsito y reposo.
- **Perfect Forward Secrecy:** Cada mensaje utiliza claves de sesión rotadas por Double Ratchet / Noise Protocol.

## 3. Almacenamiento Local y Bóvedas
Tus datos residen exclusivamente en tu dispositivo. RED utiliza el **Android Keystore** y el **iOS Secure Enclave** para proteger tus llaves maestras con seguridad respaldada por hardware.
- **Bóveda Señuelo:** Permite proteger tus datos reales bajo coacción.
- **Dead Man's Switch:** Purga automática local tras inactividad.

## 4. Red Mesh y Descentralización
RED no utiliza servidores centrales. Las comunicaciones viajan a través de una red peer-to-peer (P2P). Esto significa que no hay un punto central donde el tráfico pueda ser interceptado o analizado.

### 4.1 Garantías de Privacidad en Guardian IA (v19.0)
La moderación de contenido para prevención de delitos graves y protección infantil opera bajo estrictos principios de privacidad soberana:
* **Evaluación Nivel 0 Off-Grid**: El análisis primario se realiza localmente en tu propio dispositivo en <1ms mediante heurísticas en Rust y hashes perceptuales. Ningún dato sale a la red.
* **Evaluación Pre-Cifrado E2E**: Ocurre en el nodo emisor antes de empaquetar y cifrar el mensaje. Si un mensaje es bloqueado, se destruye localmente en el origen sin ser transmitido jamás por la red P2P ni exponer al receptor.
* **Cero Telemetría**: Las estadísticas recopiladas en `get_stats()` son contadores anónimos en memoria local (mensajes procesados/bloqueados) y jamás se transmiten a servidores externos ni a otros peers.

## 5. Cambios en esta Política
Esta política puede actualizarse para reflejar mejoras en la seguridad del protocolo. Dado que no tenemos tu contacto, te recomendamos revisar el repositorio oficial periódicamente.

---
*Tu privacidad es absoluta. Tu libertad es soberana.*
