---
description: Flujo de incremento atómico y sincronización de versión en los 12 archivos SSOT
globs: ["scripts/bump_version.js", "client/app/src/lib/version.ts", "package.json"]
---

# Workflow: Incremento Atómico de Versión (`/bump-version`)

Este flujo de trabajo implementa el **Nivel 5 de Gobernanza** (Versionado Atómico & Pre-Build Hygiene), asegurando que ninguna versión se modifique de forma dispersa o manual.

## Regla de Oro:
**Queda estrictamente prohibido editar manualmente la versión en archivos aislados.** Toda actualización debe orquestarse a través de `scripts/bump_version.js`.

---

## Procedimiento de Ejecución:

### 1. Ejecutar el Script de Versionado Maestro
```powershell
node scripts/bump_version.js <X.Y.Z>
```
*Ejemplo:* `node scripts/bump_version.js 98.0.0`

### 2. Archivos Sincronizados Automáticamente:
1. `client/app/src/lib/version.ts` (SSOT principal: `RED_VERSION`, `BUILD_NUMBER`)
2. `client/app/package.json` (`version`)
3. `client/app/android/app/build.gradle` (`versionName`, `versionCode`)
4. `core/Cargo.toml` (`version`)
5. `blockchain/Cargo.toml` (`version`)
6. `node/Cargo.toml` (`version`)
7. `red_mobile/Cargo.toml` (`version`)
8. `signaling/package.json` (`version`)
9. `client/app/public/manifest.json` (`version`)
10. `client/app/public/sw.js` (nombre de caché `red-vault-cache-vX`)
11. `sw.js` (raíz, nombre de caché `red-vault-cache-vX`)
12. `manifest.json` (raíz, `version`)

### 3. Validar con Pre-Build Check
Verificar que la paridad sea del 100%:
```powershell
node scripts/pre_build_check.js
```
*Si devuelve `100% de paridad`, proceder al commit y generación de release.*
