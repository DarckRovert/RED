# Política de Seguridad - RED v63.0.0

## Reporte de Vulnerabilidades

RED toma seguridad muy en serio. Si descubres una vulnerabilidad de seguridad, **POR FAVOR NO la reportes públicamente**. En su lugar:

### Opción 1: GitHub Security Advisory (Recomendado)
1. Ve a: https://github.com/DarckRovert/RED/security/advisories
2. Click "Report a vulnerability"
3. Describe la vulnerabilidad detalladamente
4. GitHub te notificará cuando sea procesada

### Opción 2: Email Privado
Envía a: `security@red-crypto.org` (si existe contacto público)

Incluye:
- Descripción clara del issue
- Versión afectada
- Pasos para reproducir
- Posible impacto
- Sugerencias de fix (opcional)

## Tiempo de Respuesta

| Severidad | Tiempo de Respuesta | Tiempo de Patch |
|-----------|-------------------|-----------------|
| **Crítica** | 24 horas | 48-72 horas |
| **Alta** | 48 horas | 1-2 semanas |
| **Media** | 1 semana | 2-4 semanas |
| **Baja** | 2 semanas | 1-2 meses |

## Proceso de Disclosure

1. **Privado**: Tu reporte y nuestro fix
2. **Coordinado**: Acordamos fecha de disclosure públic
3. **Notificación**: Alertamos a usuarios
4. **Publicación**: Release con patch
5. **Crédito**: Te mencionamos (si lo deseas)

## Prácticas de Seguridad en RED

### Criptografía
- ✅ Post-Cuántica (ML-KEM-768 + X25519)
- ✅ Algoritmos auditados (NIST FIPS 203, RFC 8439)
- ✅ Formal verification con ProVerif

### Autenticación
- ✅ Biométrica (huella, rostro, iris, Passkeys WebAuthn)
- ✅ Zero-Trust architecture
- ✅ PIN con validación stricta (aborto si incorrecto)

### Storage
- ✅ Cifrado AES-256-GCM
- ✅ Base de datos Sled con permiso immutable
- ✅ Rotación de claves cada 90 días

### Comunicación
- ✅ Malla P2P descentralizada
- ✅ Multi-transport (BLE, WiFi, LoRa, Acoustic)
- ✅ Forward secrecy (Double Ratchet)

### Auditoría
- ✅ Logging inmutable de eventos sensibles
- ✅ Detección de anomalías (Guardian AI)
- ✅ Merkle tree para integridad de estado

## Dependencias Seguras

Auditamos TODAS las dependencias:
```bash
cargo audit --deny warnings
npm audit --production
```

Se verifica:
- ✅ Sin vulnerabilidades críticas/altas
- ✅ Mantenidas activamente
- ✅ Licencias compatibles

## Testing de Seguridad

Ejecutamos en cada commit:
- ✅ SAST (SonarQube)
- ✅ Dependency scanning (Trivy)
- ✅ Formal proofs (ProVerif)
- ✅ Fuzzing (random input)
- ✅ Code review (2+ humans)

## EOL (End of Life)

Versions soportadas:

| Versión | Lanzamiento | EOL | Status |
|---------|------------|-----|--------|
| 63.0.0 | 2024 | 2025-Q4 | ✅ Actual |
| 62.0.0 | 2023 | 2024-Q4 | ⚠️ Bug fixes solo |
| 61.0.0 | 2023 | 2024-Q2 | ❌ EOL |

Solo las 2 últimas versiones reciben patches.

## Reconocimientos

Gracias a los investigadores de seguridad que han reportado vulnerabilidades responsablemente.

---

**Última actualización**: 2024-01-15  
**Versión de política**: 1.0.0
