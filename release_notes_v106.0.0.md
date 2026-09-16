# RED v106.0.0 — "Soberanía Limpia" 🔴

**Fecha de release:** 2026-09-16  
**Build Code:** 106000  
**Plataformas:** Android 9+ · Web SPA (GitHub Pages)

---

## Resumen Ejecutivo

Ciclo de hardening completo en tres capas: sanitización de falsos positivos en los motores de bypass de red, corrección de desincronización de zona DNS entre cliente TypeScript y servidor Rust, y estabilización del daemon Android (`RedNodeService`) para eliminar race conditions en el ciclo de vida del SSE consumer.

---

## Cambios Críticos (Breaking)

### 🔴 `SniSpoofEngine.ts` — Refactorización semántica
- **ANTES:** `transmitSniBypass()` retornaba `{success: true}` al recibir HTTP 204/302 de portales cautivos, generando falsos positivos de entrega.
- **AHORA:** Renombrado a `probeCaptivePortalPermeability()` → retorna `SniProbeResult { isCaptivePermeable, statusCode, redirectUrl }`. El campo `isCaptivePermeable` indica permeabilidad del portal, **no entrega confirmada**. Alias `transmitSniBypass()` conservado para compatibilidad.
- **Impacto:** `meshRouter.ts` y `NetworkPanel.tsx` actualizados para consumir el nuevo tipo.

### 🔴 `DnsTunnelEngine.ts` — Eliminación de ACK falso-positivo
- **ANTES:** Cualquier respuesta HTTP 2xx del proveedor DoH se trataba como ACK exitoso, incluyendo NXDOMAIN (Status=3).
- **AHORA:** Requiere `Status === 0 && Answer.length > 0 && txtRecord.data.trim().length > 0`. NXDOMAIN y respuestas vacías se clasifican correctamente como fallback no exitoso.
- Fallback UDP 53 vía `/api/dns/query` requiere `json.success && json.answer.trim().length > 0`.

### 🔴 `meshRouter.ts` — DNS tunnel ACK prefix corregido
- **ANTES:** `startsWith('ACK:')` nunca matcheaba el formato `"ACK_RECORDS_N"` del handler Rust.
- **AHORA:** `startsWith('ACK')` cubre `ACK_RECORDS_N`, `ACK_OK_EMPTY`, `ACK_PROCESSED`.

### 🔴 `dns_tunnel.rs` — Zona DNS alineada
- **ANTES:** Solo strippeaba sufijo `.RED.MESH` del QNAME. El cliente TypeScript genera `*.dns.redmesh.net`.
- **AHORA:** Stripea ambas zonas (`.DNS.REDMESH.NET` y `.RED.MESH`) y filtra metadatos de sesión `s<id>.p<n>of<n>` antes del decode Base32.

---

## Cambios de Estabilidad Android

### `RedNodeService.java` — Daemon lifecycle hardening
- **`isNodeRunning` flag:** Variable `volatile boolean` introducida como gate centralizado.
  - Se activa a `true` únicamente tras retorno exitoso de `RedNodePlugin.startNode()` (JNI).
  - Se resetea a `false` en `onDestroy()`.
- **SSE Consumer:** Ya no inicia en `onCreate()`. Arranque diferido a post-JNI (elimina race condition de reconexión infinita antes de que Rust abra la DB Sled).
- **Heartbeat governor:** Las comprobaciones de SSE restart y BLE advertiser ahora están guardadas por `isNodeRunning`.
- **`notifyCharacteristicChanged`:** Modernizado para API 33+ (Android 13). Usa la nueva firma `notifyCharacteristicChanged(device, characteristic, confirm, value)` con fallback API <33 + `SecurityException` catch.
- **Log spam eliminado:** Backoff exponencial 2s→30s. Log de retry solo en intentos 1, 2 y múltiplos de 10.

---

## Mejoras NetworkPanel

- Indicador visual diferenciado: **"Permeable"** (portal cautivo accesible) vs **"Operacional"** (ACK autoritativo recibido).
- El badge SNI ahora refleja `isCaptivePermeable` en lugar de `success` (que era siempre falso-positivo).

---

## Notas de Arquitectura

- El servidor Rust `DnsTunnelServer` (UDP 5353) ahora acepta queries de ambas zonas DNS sin requerir recompilación.
- La malla conserva su arquitectura DTN: paquetes no confirmados permanecen en la cola store-and-forward hasta recibir ACK explícito.
- `libmagtsync.so` ausente continúa siendo error no-crítico (plataforma específica, no bloquea P2P).

---

## Dispositivos Validados

| Dispositivo | Serial | Android | Estado |
|---|---|---|---|
| Lenovo TB305XU | `HA2CHKZ2` | 11 | ✅ Operacional |
| Moto G22 | `ZT322B386P` | 12 | ✅ Operacional |
