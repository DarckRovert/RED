---
description: Pipeline de verificación higiénica pre-build, compilación estática SPA y despliegue web soberano
globs: ["client/app/**", "scripts/**"]
---

# Workflow: Despliegue y Liberación Soberana (`/deploy-and-release`)

Este flujo de trabajo garantiza la ejecución rigurosa de las directrices del **Nivel 5** (Versionado Atómico & Pre-Build Hygiene) y **Nivel 7** (Soberanía y Despliegue Web Determinista) de la gobernanza de RED.

## Principios Operativos:
- Cero tolerancia a artefactos huérfanos o cachés corruptas en `.next` o `out`.
- 100% paridad de versión en los 12 archivos SSOT antes de generar binarios.
- Despliegue local soberano a GitHub Pages sin dependencia de cuotas en la nube.

---

## Pasos de Ejecución:

### 1. Higiene Pre-Build y Validación SSOT
Ejecuta la purga de cachés y valida que todos los archivos maestros compartan la misma versión canónica:
```powershell
node scripts/pre_build_check.js
```
*Si este paso falla, se debe corregir la discrepancia con `node scripts/bump_version.js <VERSION>` antes de continuar.*

### 2. Verificación Estática TypeScript
```powershell
cd client/app
npx tsc --noEmit
```

### 3. Compilación Estática Turbopack
Generación de los artefactos web para despliegue:
```powershell
cd client/app
npm run build
```
*Valida que las 4 rutas estáticas (`/`, `/_not-found`, etc.) se generen limpiamente en `< 10s`.*

### 4. Despliegue Soberano a GitHub Pages
Copia `index.html` a `404.html` para soporte de enrutamiento SPA sin servidor, crea `.nojekyll` y publica en la rama `gh-pages`:
```powershell
cd client/app
npm run deploy:gh
```

### 5. Compilación de APK Android (Opcional para Release Móvil)
Para empaquetar la versión móvil en limpio:
```powershell
npx cap sync android
cd android
./gradlew assembleRelease
```
*Verificar que el APK resultante se firme adecuadamente y se ubique en `release-assets/` sin dejar binarios en la raíz del proyecto.*
