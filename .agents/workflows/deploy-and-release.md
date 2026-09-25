---
description: Pipeline de verificación higiénica pre-build, compilación estática SPA, validación legal y despliegue web soberano
globs: ["client/app/**", "scripts/**", "node/**"]
---

# Workflow: Despliegue y Liberación Soberana (`/deploy-and-release`)

Este flujo de trabajo garantiza la ejecución rigurosa de las directrices del **Nivel 5** (Versionado Atómico & Pre-Build Hygiene), **Nivel 7** (Soberanía y Despliegue Web Determinista) y **Nivel 16** (Blindaje Legal, Atribución Open Source & Ecosistema Web de 3 Destinos) de la gobernanza de RED.

## Principios Operativos:
- Cero tolerancia a artefactos huérfanos o cachés corruptas en `.next`, `out`, `_next`.
- 100% paridad de versión en los 29 archivos SSOT antes de generar binarios.
- 100% paridad bit-a-bit del ecosistema web de 3 destinos (`root/`, `client/app/public/`, `node/src/web/`).
- Despliegue local soberano a GitHub Pages sin dependencia de cuotas en la nube.

---

## Pasos de Ejecución:

### 1. Higiene Pre-Build y Validación SSOT Completa
Ejecuta la purga de cachés y valida que todos los archivos maestros compartan la misma versión canónica y que los 3 destinos web estén idénticos:
```powershell
node scripts/pre_build_check.js
```
*Si este paso falla, se debe corregir la discrepancia con `node scripts/bump_version.js <VERSION>` antes de continuar.*

---

### 2. Verificación Estática TypeScript
Comprobar tipado estricto sin emitir JavaScript:
```powershell
cd client/app
npx tsc --noEmit
```

---

### 3. Verificación de Compilación Backend Rust (red-node)
Asegurar que los archivos embebidos con `include_str!()` (`terms.html`, `privacy.html`, `credits.html`) compilen sin errores:
```powershell
cargo check -p red_node
```

---

### 4. Compilación Estática Turbopack
Generación de los artefactos web para despliegue:
```powershell
cd client/app
npm run build
```
*Valida que las rutas estáticas (`/`, `/_not-found`, etc.) se generen limpiamente en `< 10s`.*

---

### 5. Despliegue Soberano a GitHub Pages
Copia `index.html` a `404.html` para soporte de enrutamiento SPA sin servidor, crea `.nojekyll` y publica en la rama `gh-pages`:
```powershell
cd client/app
npm run deploy:gh
```

---

### 6. Compilación de APK Android (Release Móvil)

> [!IMPORTANT]
> El pipeline de APK tiene 3 pasos obligatorios y en orden estricto.
> Omitir `next build` bake el bundle JS de la versión ANTERIOR dentro del APK,
> haciendo que los dispositivos muestren la versión vieja aunque el APK instale correctamente.

```powershell
# PASO A — Compilar bundle JS con la versión actual bakeada
cd client/app
npm run build:mobile   # Next.js static export limpio sin basePath — bake version.ts en JS

# PASO B — Sincronizar bundle JS a assets Android (WebView)
npx cap sync android   # Copia out/... → android/app/src/main/assets/public/

# PASO C — Compilar APK
npm run build:apk      # Equivale a: gradlew assembleRelease (desde android/)
```

**Copiar y registrar APKs:**
```powershell
# Copiar a las 3 ubicaciones requeridas por el integrity check
$apk = "android/app/build/outputs/apk/release/app-release.apk"
$ver = (node -e "const fs=require('fs');const m=fs.readFileSync('src/lib/version.ts','utf8').match(/RED_VERSION\s*=\s*['\"]([^'\"]+)['\"]/);console.log(m[1])")
Copy-Item $apk "../../release-assets/red-v${ver}-release.apk" -Force
Copy-Item $apk "../../release-assets/red-latest.apk" -Force
Copy-Item $apk "../../red-latest.apk" -Force

# Recalcular SHA-256 en todos los SSOT
npm run sync:sha256
```
*Verificar que el APK resultante se firme con `signingConfigs.release` (nunca `.debug`) y se ubique en `release-assets/`.*

---

### 7. Auditoría Final de Integridad
```powershell
node client/app/scripts/check_release_integrity.js --strict
```
*Debe arrojar `✅ 39 pasados | ❌ 0 errores | ⚠️ 0 advertencias`.*
