---
description: Flujo de incremento atómico y sincronización de versión en los 29 archivos SSOT y ecosistema de 3 destinos
globs: ["scripts/bump_version.js", "client/app/src/lib/version.ts", "package.json", "GOVERNANCE.md"]
---

# Workflow: Incremento Atómico de Versión (`/bump-version`)

Este flujo de trabajo implementa el **Nivel 5** (Versionado Atómico & Pre-Build Hygiene) y **Nivel 16** (Blindaje Legal, Atribución Open Source & Ecosistema Web de 3 Destinos) de la gobernanza de RED, asegurando que ninguna versión se modifique de forma dispersa o manual.

## Regla de Oro:
**Queda estrictamente prohibido editar manualmente la versión en archivos aislados.** Toda actualización debe orquestarse a través del script maestro `scripts/bump_version.js`.

---

## Procedimiento de Ejecución:

### 1. Ejecutar el Script de Versionado Maestro
```powershell
# Desde la raíz del repositorio:
node scripts/bump_version.js <X.Y.Z>
```
*Ejemplo:* `node scripts/bump_version.js 124.0.0`

---

### 2. Matriz de Archivos Sincronizados Automáticamente (29 Componentes):

#### A. Núcleo SSOT, Manifiestos y Workspace:
1. `client/app/src/lib/version.ts` (SSOT principal: `RED_VERSION`, `BUILD_NUMBER`, `RED_BUILD_DATE`)
2. `client/app/package.json` (`version`)
3. `client/app/package-lock.json` (`version`)
4. `client/app/android/app/build.gradle` (`versionName`, `versionCode`)
5. `Cargo.toml` (workspace root: `version`)
6. `core/Cargo.toml` (`version`)
7. `red_mobile/Cargo.toml` (`version`)
8. `node/Cargo.toml` (`version`)
9. `blockchain/Cargo.toml` (`version`)
10. `client/Cargo.toml` (`version`)
11. `signaling/package.json` (`version`)
12. `Cargo.lock` (sincronización atómica de crates locales del workspace)

#### B. PWA, Service Workers y Manifiestos Web:
13. `sw.js` (raíz: nombre de caché `red-vault-cache-vX`)
14. `client/app/public/sw.js` (nombre de caché `red-vault-cache-vX`)
15. `manifest.json` (raíz: `version`)
16. `client/app/public/manifest.json` (`version`)

#### C. Gobernanza, Manuales y Documentación Operativa:
17. `README.md` (encabezado, badges de descarga APK y tags de release)
18. `GOVERNANCE.md` (título del ruleset autómata)
19. `.agents/rules/governance.md` (estándares del agente)
20. `USER_MANUAL.md` (manual operativo del usuario)
21. `ARCHITECTURE.md` (especificación de arquitectura)
22. `ADMIN_MANUAL.md` (manual de operaciones del nodo)
23. `.env.example` (`NEXT_PUBLIC_APP_VERSION`)
24. `scripts/sync_release_apk.js` (script de sincronización de APK)
25. `.agents/skills/mesh-tactical-orchestration/SKILL.md` (habilidad de orquestación táctica)

#### D. Componentes Nativos y Suites de Pruebas:
26. `client/app/android/app/src/main/java/f/red/app/RedProxyServer.java` (header HTTP `X-RED-ZeroRating-Tunnel`)
27. `client/app/scripts/test-cyber-tunnel-real-egress.js` (suite de pruebas del túnel celular)

#### E. Blindaje Legal, Atribución Open Source y Salón de la Fama:
28. `client/app/src/lib/legal/LegalAgreementManager.ts` (`CURRENT_LEGAL_VERSION`)
29. `DISCLAIMER.md` (`Versión Canónica: vX.Y.Z`)
30. `CREDITS.md` (`Versión Canónica: vX.Y.Z`)
31. `terms.html` (raíz: `TERMS & EULA vX.Y.Z`)
32. `privacy.html` (raíz: `PRIVACY POLICY vX.Y.Z`)
33. `credits.html` (raíz: `HALL OF FAME vX.Y.Z`)

#### F. Ecosistema de 3 Destinos Web (Sincronización Satélite Bit-a-Bit):
El script replica de manera idéntica e inmediata los archivos legales de la raíz hacia:
- **Destino 2 (Next.js SPA):** `client/app/public/terms.html`, `client/app/public/privacy.html`, `client/app/public/credits.html`
- **Destino 3 (Rust CLI/Node Web Server):** `node/src/web/terms.html`, `node/src/web/privacy.html`, `node/src/web/credits.html` (embebidos en binario con `include_str!()`)

---

### 3. Crear o Actualizar Notas de Versión:
Crear el archivo canónico en la raíz: `release_notes_v<X.Y.Z>.md`. El guardián de integridad bloqueará cualquier release si este archivo no existe o está incompleto (< 200 bytes).

---

### 4. Compilar APK Android y Sincronizar SHA256SUMS:

> [!IMPORTANT]
> El pipeline de APK requiere **3 pasos en orden estricto**. Omitir `npm run build`
> hace que el bundle JS de la versión anterior quede bakeado en el APK nuevo.
> Los dispositivos verán la versión vieja aunque el APK se instale.

```powershell
cd client/app

# PASO 1 — Compilar bundle Next.js (bake version.ts → JS)
npm run build

# PASO 2 — Sincronizar bundle a assets Android WebView
npx cap sync android

# PASO 3 — Compilar APK
npm run build:apk

# Copiar a las 3 ubicaciones requeridas por el integrity check
$src = "android/app/build/outputs/apk/release/app-release.apk"
$ver = (node -e "const fs=require('fs');const m=fs.readFileSync('src/lib/version.ts','utf8').match(/RED_VERSION\s*=\s*['\"]([^'\"]+)['\"]/);console.log(m[1])")
Copy-Item $src "../../release-assets/red-v${ver}-release.apk" -Force
Copy-Item $src "../../release-assets/red-latest.apk" -Force
Copy-Item $src "../../red-latest.apk" -Force

# Recalcular y sincronizar SHA-256 en todos los SSOT
npm run sync:sha256
```
*(Actualiza `SHA256SUMS.txt`, `release-assets/SHA256SUMS.txt`, `version.ts RED_APK_SHA256` y `release-assets/RED-vX.Y.Z.apk.sha256` sin edición manual).*

---

### 5. Auditoría Total de Integridad Pre-Release:
```powershell
# Desde la raíz del proyecto
node client/app/scripts/check_release_integrity.js --strict
```
*(Verifica 39 comprobaciones: SHA256SUMS vs APKs reales, paridad SSOT 100%, inexistencia de versiones hardcodeadas, existencia de release notes, limpieza git, y paridad bit-a-bit del ecosistema web de 3 destinos. Debe arrojar `✅ 39 pasados | ❌ 0 errores`.)*

---

### 6. Capas de Protección Activas:
- **Pre-Build Hygiene (`scripts/pre_build_check.js`):** Purgado automático de `.next`, `out`, validación estricta de paridad en 16 archivos SSOT y paridad en los 3 destinos web.
- **Hook Git Local (`.git/hooks/pre-push`):** Intercepta cada `git push` y ejecuta `check_release_integrity.js --strict`, bloqueando cualquier push defectuoso antes de salir de tu máquina.
- **CI de Pruebas (`.github/workflows/test.yml`):** Ejecuta `check_release_integrity.js` en cada pull request y push a `main`/`develop`.
- **CI de Release (`.github/workflows/release.yml`):** Valida paridad absoluta antes de generar cualquier release en GitHub.
