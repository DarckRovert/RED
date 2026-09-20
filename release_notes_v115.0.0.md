# Release Notes — RED v115.0.0
## "Bug-Fix Arquitectónico: DMS Key, SSE Loopback, SHA-256, Dedup & Rutas API"
**Fecha:** 2026-09-20

## Correcciones Críticas (Backend Rust)

### [A1] Fix crítico de Dead Man's Switch
La tarea DMS leía clave `last_activity_timestamp` pero handlers escribían `dms_last_active` — discrepancia causaba potencial auto-wipe en reinicio. Unificado.

### [A2] Nueva ruta POST /api/contacts/:hash/unverify
Ruta invocada por client.ts:1465 pero inexistente en router (HTTP 404 silencioso). Handler con semántica idempotente (read-before-toggle).

### [A2b] Nueva ruta GET /api/system/health
Reemplaza fallback hardcodeado con métricas reales: uptime, peers, contacts, storage_bytes.

### [A2c] Nueva ruta GET /api/logs?count=N
Ring buffer en memoria (OnceLock<Mutex<VecDeque>>, cap. 500).

### [A3] Strings mDNS corregidos
4x "mDNS / LAN UDP (7331)" → "mDNS / LAN (Multicast)".

### [A4] latency_ms honesto en /api/peers
Some(45) hardcodeado → None.

### [B7-Rust] SSE loopback en grupos
handle_send_group_message era el único handler sin msg_tx.send. Añadido loopback sintético.

## Correcciones Críticas (Frontend TypeScript)

### [B1] syncContactProfile implementado
Era stub permanente. Ahora llama GET /api/contacts y sincroniza localStorage.

### [B4] SHA-256 fallback correcto
djb2 32-bit (colisionable) → FIPS 180-4 puro en JS.

### [B5+B6] Timestamps y ventana de dedup
Math.floor() antes de comparar. Ventana unificada a 15s.

### [B8] Aliases faltantes en OVERLAY_SCREENS
tacticalGhostGps, ghostGps, sovereignShield, shield, cyberTunnel, zeroRating añadidos.

## Archivos Modificados
- node/src/main.rs
- node/src/api.rs
- client/app/src/api/core.ts
- client/app/src/api/client.ts
- client/app/src/store/types.ts

## Correcciones OTA Engine (Post-Release)

### [C1] Asset selection canónica en updateManager
El OTA tomaba el primer `.apk` del release sin verificar nombre. Ahora busca
`red-latest.apk` por nombre exacto antes de caer en búsquedas genéricas.

### [C2] Verificación SHA-256 post-descarga
Sin verificación, un APK corrupto o de versión incorrecta se instalaba
silenciosamente. Implementado `computeFileSha256` en `RedNodePlugin.java` 
(MessageDigest SHA-256, streaming 64 KB, O(1) memoria) e invocado desde
`updateManager.ts` antes de `installApk`.

### [C3] Invalidación de caché post-instalación
`UpdateManager.cachedUpdateInfo` no se limpiaba tras instalar. El próximo
`checkForUpdates` devolvía datos stale. Ahora se invalida en cada install exitoso.
TTL reducido de 60s a 30s.

### [C4] Pipeline de APK documentado en gobernanza
`build:apk` ejecuta solo `gradlew` — sin `next build` + `cap sync` previos
el bundle JS de la versión anterior queda bakeado. Documentado como Nivel 5
obligatorio en `.agents/rules/governance.md` y workflows.

## Correcciones de Gobernanza y Seguridad

### [S1] Contraseña de keystore eliminada del código fuente
`build.gradle` tenía `storePassword "red_sovereign_release_2026"` hardcodeado.
Migrado a `gradle.properties` local (excluido del repo via `.gitignore`).

### [S2] `computeFileSha256` implementado en plugin nativo Java
El método era invocado desde TypeScript pero no existía en `RedNodePlugin.java`.
La verificación de integridad OTA era inoperante en hardware.

### [G1] Workflows nuevos creados
- `.agents/workflows/ota-update.md` — diagnóstico OTA completo
- `.agents/workflows/rust-backend-deploy.md` — SOP Rust backend
- `.agents/workflows/hotfix.md` — procedimiento hotfix urgente

### [G2] Git LFS configurado para binarios
`.gitattributes` actualizado con tracking LFS para `*.apk`, `*.aab`, `*.exe`, `*.so`.

