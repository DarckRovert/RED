---
description: Diagnóstico, depuración y validación del OTA Update Engine in-app de RED (updateManager.ts, SHA-256, asset selection, cache TTL)
globs: ["client/app/src/lib/updateManager.ts", "client/app/src/lib/version.ts", "release-assets/**"]
---

# Workflow: OTA Update Engine (`/ota-update`)

Diagnostica y valida el flujo de actualización autónoma in-app de RED.
Aplica el **Nivel 15** de la Gobernanza (Distribución Soberana In-App).

---

## Árbol de Fallos Conocidos

| Síntoma | Causa Raíz | Archivo |
|---|---|---|
| Dispositivos muestran versión vieja tras instalar | APK compilado sin `next build` (bundle JS anterior bakeado) | `deploy-and-release` workflow |
| OTA descarga pero la versión no cambia | `build:apk` no ejecuta `next build` + `cap sync` | `package.json` scripts |
| Integrity check falla con hash incorrecto | `release-assets/red-latest.apk` stale (no actualizado) | Deploy pipeline |
| OTA instala APK corrupto silenciosamente | Sin verificación SHA-256 post-descarga | `updateManager.ts` |

---

## Pasos de Diagnóstico:

### 1. Verificar Versión Bakeada en Assets Android
```powershell
# Debe mostrar la versión actual (ej. 115.0.0), NO la versión anterior
Get-ChildItem "client/app/android/app/src/main/assets/public" -Recurse -Filter "*.js" |
  ForEach-Object { Get-Content $_.FullName -Raw } |
  Select-String "(11[0-9]|[0-9]{3})\.0\.0" | Select-Object -First 3
```
*Si muestra una versión inferior a la actual → el APK fue compilado sin `next build`.*

### 2. Verificar Consistencia SHA-256
```powershell
# Los 4 valores deben ser idénticos
$h1 = (Get-FileHash "red-latest.apk" -Algorithm SHA256).Hash
$h2 = (Get-FileHash "release-assets/red-latest.apk" -Algorithm SHA256).Hash
$h3 = (Get-FileHash "release-assets/red-v$(node -p "require('./client/app/src/lib/version.ts'.match(/RED_VERSION = \"([^\"]+)\"/)[1])")-release.apk" -Algorithm SHA256).Hash
Write-Host "root/red-latest.apk:            $h1"
Write-Host "release-assets/red-latest.apk:  $h2"
Write-Host "release-assets/red-vX.Y.Z.apk:  $h3"
Write-Host "Consistentes: $($h1 -eq $h2 -and $h2 -eq $h3)"
```

### 3. Auditoría Total de Integridad
```powershell
node client/app/scripts/check_release_integrity.js
```
*Debe arrojar `✅ 27 pasados | ❌ 0 errores`.*

### 4. Verificar Asset Selection en GitHub Release
```powershell
gh release view v<VERSION> --json assets |
  ConvertFrom-Json | Select-Object -ExpandProperty assets |
  Where-Object { $_.name -like "*.apk" } |
  ForEach-Object { "$($_.name): $($_.digest)" }
```
*El `red-latest.apk` debe tener el mismo digest que los archivos locales.*

---

## Pipeline Correcto de Release OTA:

```powershell
# 1. Bump versión atómica
node scripts/bump_version.js <X.Y.Z> "<TÍTULO>"

# 2. Compilar bundle (bake versión en JS)
cd client/app
npm run build

# 3. Sincronizar a Android WebView
npx cap sync android

# 4. Compilar APK
npm run build:apk

# 5. Copiar a 3 ubicaciones
$src = "android/app/build/outputs/apk/release/app-release.apk"
Copy-Item $src "../../release-assets/red-v<VERSION>-release.apk" -Force
Copy-Item $src "../../release-assets/red-latest.apk" -Force
Copy-Item $src "../../red-latest.apk" -Force

# 6. Sincronizar SHA-256
npm run sync:sha256

# 7. Verificar integridad
node scripts/check_release_integrity.js

# 8. Git commit + push (el pre-push hook re-verifica automáticamente)
git add -A && git commit -m "..." && git push origin main

# 9. Actualizar GitHub Release
gh release upload v<VERSION> \
  "red-latest.apk#red-latest.apk" \
  "release-assets/red-v<VERSION>-release.apk#red-v<VERSION>-release.apk" \
  "SHA256SUMS.txt#SHA256SUMS.txt" --clobber
```
