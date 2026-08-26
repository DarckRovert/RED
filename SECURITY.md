# Política de Seguridad - RED v63.0.0

## Reporte Responsable de Vulnerabilidades

### NO reportar públicamente
Todas las vulnerabilidades de seguridad DEBEN ser reportadas confidencialmente para proteger a los operadores en zonas de riesgo.

### Opción 1: GitHub Security Advisory (Recomendado)
1. Ve a: https://github.com/DarckRovert/RED/security/advisories
2. Click "Report a vulnerability"
3. Describe el issue detalladamente con pasos de reproducción (PoC)

### Opción 2: Email Privado
- Email: `security@red-mesh.org`
- Clave PGP: Disponible en el directorio de seguridad oficial

### Tiempo de Respuesta y SLAs

| Severidad | Tiempo de Respuesta Inicial | Tiempo de Patch / Mitigación |
|-----------|-----------------------------|------------------------------|
| **Crítica** | < 24 horas | 48-72 horas |
| **Alta** | < 48 horas | 1-2 semanas |
| **Media** | < 1 semana | 2-4 semanas |
| **Baja** | < 2 semanas | 1-2 meses |

### Proceso de Divulgación Coordinada (Coordinated Disclosure)
1. Reporte confidencial recibido y confirmado en < 24h.
2. Análisis de causa raíz, modelado de amenazas y desarrollo del parche en rama aislada.
3. Validación matemática mediante Known-Answer Tests (KAT) y ProVerif 2.0x.
4. Notificación coordinada a los operadores de nodos validadores y despliegue del hotfix.
5. Publicación de la nota de seguridad oficial y crédito explícito al investigador.

---

## Prácticas de Seguridad en RED

### Criptografía Post-Cuántica & Híbrida
- ✅ **ML-KEM-768** (NIST FIPS 203) encapsulando secretos compartidos contra computación cuántica futura.
- ✅ **X25519** ECDH (RFC 7748) para conmutatividad y secreto efímero.
- ✅ **ChaCha20-Poly1305 AEAD** (RFC 8439) con integridad y autenticación de datos asociados (AAD).
- ✅ **Double Ratchet** con secreto perfecto hacia adelante (PFS) y auto-recuperación de clave (PCS).
- ✅ **Argon2id** (OWASP 2021) para derivación robusta de claves desde PINs de coacción y PIN maestro.
- ✅ Verificación formal de seguridad mediante **ProVerif 2.0x**.

### Almacenamiento & Memoria
- ✅ Bóveda Sled con cifrado AES-256-GCM y aborto fatal inmediato ante alteración de memoria.
- ✅ Sanitización de memoria volátil (`zeroize`) en estructuras de claves privadas.
- ✅ Bóveda señuelo (*Decoy Vault*) y borrado de pánico (*Panic Wipe*) en < 500ms.

### Comunicaciones & Red Malla
- ✅ Enrutamiento cebolla (Onion Routing) de 3 saltos para ofuscación de metadatos de transporte.
- ✅ Cero texto plano en tránsito sobre BLE, WiFi Direct, LoRa 915/868 MHz y módem acústico SoundMesh.
- ✅ Aislamiento estricto de loopback en servidor local Axum (`127.0.0.1:7333`) con autenticación `X-API-Key`.

---

## Política de Fin de Soporte (End-of-Life Policy)

| Versión | Lanzamiento | Fin de Soporte (EOL) | Estado |
|---------|------------|---------------------|--------|
| **v63.0.0** | 2026-08 | 2027-08 | 🟢 **Soporte Activo / Producción** |
| **v62.0.0** | 2026-06 | 2026-12 | 🟡 Parches de Seguridad Críticos |
| **v61.0.0** y anteriores | - | - | 🔴 Fin de Soporte (EOL) |

*Solo las dos versiones mayores más recientes reciben parches de seguridad y backports.*
