# Política de Seguridad - RED v87.0.0

## Reporte Responsable de Vulnerabilidades

### NO reportar públicamente
Todas las vulnerabilidades de seguridad DEBEN ser reportadas confidencialmente para proteger a los operadores en zonas de riesgo.

### Opción 1: GitHub Security Advisory (Recomendado)
1. Ve a: [https://github.com/DarckRovert/RED/security/advisories/new](https://github.com/DarckRovert/RED/security/advisories/new)
2. Click "Report a vulnerability"
3. Describe el issue detalladamente con pasos de reproducción (PoC)

### Opción 2: Email Privado & Confidencial
- Email: `darckrovert@gmail.com`
- Asunto sugerido: `[SECURITY RED-v87] Vulnerability Report`

### Tiempo de Respuesta y SLAs

| Severidad | Tiempo de Respuesta Inicial | Tiempo de Patch / Mitigación |
|-----------|-----------------------------|------------------------------|
| **Crítica** (CVSS >= 9.0) | < 2 horas | < 24 horas |
| **Alta** (CVSS 7.0 - 8.9) | < 6 horas | < 48 horas |
| **Media** (CVSS 4.0 - 6.9) | < 24 horas | < 7 días |
| **Baja** (CVSS < 4.0) | < 48 horas | Siguiente ciclo de release |

### Proceso de Divulgación Coordinada
1. Recepción y confirmación de recepción en el plazo acordado.
2. Triage y reproducción en entorno sandbox de laboratorio (sin nodos reales expuestos).
3. Desarrollo y verificación matemática/formal del fix (ProVerif + suites de resiliencia).
4. Notificación coordinada a los operadores de nodos validadores y despliegue del hotfix.
5. Publicación de la nota de seguridad oficial y crédito explícito al investigador.

---

## Prácticas de Seguridad en RED v87.0.0

### Criptografía Post-Cuántica & Híbrida
- ✅ **ML-KEM-768** (NIST FIPS 203) encapsulando secretos compartidos contra computación cuántica futura.
- ✅ **X25519** ECDH (RFC 7748) para conmutatividad y secreto efímero.
- ✅ **ChaCha20-Poly1305 AEAD** (RFC 8439) con integridad y autenticación de datos asociados (AAD).
- ✅ **Double Ratchet** con secreto perfecto hacia adelante (PFS) y auto-recuperación de clave (PCS).
- ✅ **Argon2id** (OWASP 2021) para derivación robusta de claves desde PINs de coacción y PIN maestro.
- ✅ Verificación formal de seguridad mediante **ProVerif 2.0x**.

### Almacenamiento, Memoria & Zero-Plaintext
- ✅ Bóveda Sled con cifrado AES-256-GCM y aborto fatal inmediato ante alteración de memoria.
- ✅ Sanitización de memoria volátil (`zeroize`) en estructuras de claves privadas.
- ✅ **Zero Plaintext en Disco:** Prohibido almacenar PINs en texto plano en `localStorage`. En Android residen exclusivamente en hardware TEE (Android Keystore / iOS Keychain), y en web se validan mediante hashes criptográficos salteados con memoria volátil `sessionStorage`.
- ✅ Bóveda señuelo (*Decoy Vault*) configurable y borrado de pánico (*Panic Wipe*) en < 500ms. Erradicación total de PINs estáticos por defecto (CERO fallback 9999, CERO fallback 123456).

### Comunicaciones, API Local & Red Malla
- ✅ Enrutamiento cebolla (Onion Routing) de 3 saltos para ofuscación de metadatos de transporte.
- ✅ Cero texto plano en tránsito sobre BLE, WiFi Direct, LoRa 915/868 MHz y módem acústico SoundMesh.
- ✅ **Zero-Trust en Loopback:** Servidor local Axum (`127.0.0.1:7333`) con autenticación obligatoria por sesión (`X-API-Key`, `X-Red-Session-Token`, `Authorization: Bearer`).
- ✅ **Mitigación Anti-Timing:** Comparación de credenciales en tiempo constante con `subtle::ConstantTimeEq`.
- ✅ **CORS Blindado:** Orígenes locales explícitos (`localhost`, `127.0.0.1`, `capacitor://localhost`, `https://darckrovert.github.io`). Cero `CorsLayer::permissive()` y erradicación de bypass por `x-forwarded-for`.
- ✅ **Cero Telemetría Comercial:** Purga absoluta de SDKs publicitarios externos (Google AdMob eliminado; economía 100% soberana P2P Proof-of-Relay).
- ✅ **Soporte Dual BLE:** Interoperabilidad transparente entre direcciones MAC de Android y UUIDs de iOS CoreBluetooth.

---

## Política de Fin de Soporte (End-of-Life Policy)

| Versión | Lanzamiento | Fin de Soporte (EOL) | Estado |
|---------|------------|---------------------|--------|
| **v87.0.0** | 2026-09 | 2027-09 | 🟢 **Soporte Activo / Producción** |
| **v86.0.0** | 2026-09 | 2027-03 | 🟡 Parches de Seguridad Críticos |
| **v85.0.0** y anteriores | - | - | 🔴 Fin de Soporte (EOL) |

*Solo las dos versiones mayores más recientes reciben parches de seguridad y backports.*
