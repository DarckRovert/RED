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
node client/app/scripts/bump_version.js <X.Y.Z>
```
*Ejemplo:* `node client/app/scripts/bump_version.js 106.0.0`

### 2. Archivos Sincronizados Automáticamente:
1. `client/app/src/lib/version.ts` (SSOT principal: `RED_VERSION`, `BUILD_NUMBER`, `RED_BUILD_DATE`)
2. `client/app/package.json` (`version`)
3. `client/app/android/app/build.gradle` (`versionName`, `versionCode`)
4. `Cargo.toml` (workspace root: `version`)
5. `core/Cargo.toml` (`version`)
6. `blockchain/Cargo.toml` (`version`)
7. `node/Cargo.toml` (`version`)
8. `red_mobile/Cargo.toml` (`version`)
9. `signaling/package.json` (`version`)
10. `client/app/public/manifest.json` (`version`)
11. `client/app/public/sw.js` (nombre de caché `red-vault-cache-vX`)
12. `sw.js` (raíz, nombre de caché `red-vault-cache-vX`)
13. `manifest.json` (raíz, `version`)

### 3. Crear o Actualizar Notas de Versión:
Crear el archivo canónico en la raíz: `release_notes_v<X.Y.Z>.md`. El guardian de integridad bloqueará cualquier release si este archivo no existe o está incompleto.

### 4. Compilar Binarios y Sincronizar Criptográficamente SHA256SUMS:
Tras compilar los artefactos (ej. `red-v<X.Y.Z>-release.apk` en `release-assets/`):
```powershell
cd client/app
npm run sync:sha256
```
*(Calcula automáticamente los hashes SHA-256 reales de los APKs y sincroniza `SHA256SUMS.txt` y `version.ts` sin edición manual).*

### 5. Auditoría Total de Integridad Pre-Release:
```powershell
cd client/app
npm run audit:integrity -- --strict
```
*(Verifica 17 comprobaciones: SHA256SUMS vs archivos reales, paridad SSOT 100%, inexistencia de versiones hardcodeadas, existencia de release notes y limpieza git).*

### 6. Capas de Protección Activas:
- **Hook Git Local (`.git/hooks/pre-push`):** Intercepta cada `git push` y ejecuta `check_release_integrity.js --strict`, bloqueando cualquier push defectuoso antes de salir de tu máquina.
- **CI de Pruebas (`.github/workflows/test.yml`):** Ejecuta `check_release_integrity.js` en cada pull request y push a `main`/`develop`.
- **CI de Release (`.github/workflows/release.yml`):** Valida paridad absoluta antes de generar cualquier release en GitHub.
