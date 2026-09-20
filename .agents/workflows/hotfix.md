---
description: Procedimiento de hotfix urgente para parches críticos sin pasar por el ciclo completo de bump-version
globs: ["**/*.ts", "**/*.rs", "**/*.tsx"]
---

# Workflow: Hotfix Urgente (`/hotfix`)

Procedimiento para aplicar parches críticos de seguridad o bugs bloqueantes
sin pasar por el ciclo completo de release. Aplica los **Niveles 0, 5 y 11**
de la Gobernanza.

> [!CAUTION]
> Un hotfix SIEMPRE genera un nuevo número de versión (patch: Z+1).
> Queda **prohibido** aplicar un hotfix sin bump de versión — viola el SSOT.

---

## ¿Cuándo usar este workflow?

| Tipo de incidencia | Usar /hotfix | Usar /bump-version |
|---|---|---|
| Crash en producción (AndroidRuntime FATAL) | ✅ | ❌ |
| Vulnerabilidad de seguridad crítica (CVSS ≥ 9) | ✅ | ❌ |
| Bug bloqueante que impide el uso básico | ✅ | ❌ |
| Feature nueva o mejora | ❌ | ✅ |
| Refactorización o deuda técnica | ❌ | ✅ |

---

## Procedimiento:

### 1. Rama de Hotfix (opcional pero recomendado)
```powershell
git checkout -b hotfix/v<X.Y.Z+1>-<descripcion-breve>
```

### 2. Identificar Causa Raíz
**Obligatorio antes de escribir código:**
- Reproducir el fallo en hardware real (logcat, adb, etc.)
- Identificar el archivo y línea exacta del fallo
- Confirmar que el fix es quirúrgico y no introduce regresiones

### 3. Bump de Versión (patch)
```powershell
# Incrementar SOLO el patch number (X.Y.Z → X.Y.Z+1)
node scripts/bump_version.js <X.Y.Z+1> "<Descripción hotfix>"
```

### 4. Aplicar Fix
- Editar SOLO los archivos necesarios
- Añadir comentario `// FIX: <descripción>` en la línea corregida

### 5. Validación Rápida
```powershell
# TypeScript
cd client/app && npx tsc --noEmit

# Rust (si se modificó código Rust)
cargo check --workspace
```

### 6. Pipeline APK (si el hotfix afecta la app Android)
```powershell
cd client/app
npm run build          # Bake versión en JS
npx cap sync android   # Sincronizar a WebView
npm run build:apk      # Compilar APK

# Copiar a 3 ubicaciones
$src = "android/app/build/outputs/apk/release/app-release.apk"
Copy-Item $src "../../release-assets/red-v<X.Y.Z+1>-release.apk" -Force
Copy-Item $src "../../release-assets/red-latest.apk" -Force
Copy-Item $src "../../red-latest.apk" -Force

npm run sync:sha256
```

### 7. Integrity Check Final
```powershell
node client/app/scripts/check_release_integrity.js
```
*Debe pasar 27/27. Si falla, NO continuar.*

### 8. Commit y Push
```powershell
git add -A
git commit -m "fix(<área>): <descripción concisa del hotfix>

Causa raíz: <qué fallaba y por qué>
Fix: <qué se cambió y cómo lo resuelve>
Verificado en: <hardware / logcat / cargo check>"

git push origin main   # El pre-push hook verifica integridad automáticamente
```

### 9. GitHub Release
```powershell
gh release create v<X.Y.Z+1> \
  --title "v<X.Y.Z+1> - Hotfix: <descripción>" \
  --notes-file "release_notes_v<X.Y.Z+1>.md" \
  "red-latest.apk#red-latest.apk" \
  "release-assets/red-v<X.Y.Z+1>-release.apk#red-v<X.Y.Z+1>-release.apk" \
  "SHA256SUMS.txt#SHA256SUMS.txt"
```

### 10. Instalar en Dispositivos de Verificación
```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices   # Confirmar dispositivos conectados

# Por cada dispositivo
& $adb -s <SERIAL> uninstall f.red.app
& $adb -s <SERIAL> install -r "red-latest.apk"

# Verificar que la versión correcta aparece en la app
```

---

## Post-Hotfix

- [ ] Merge de la rama `hotfix/` a `main` (si se usó rama separada)
- [ ] Actualizar `CHANGELOG.md` con sección `### Hotfix`
- [ ] Notificar al equipo (Discord / canal táctica)
- [ ] Programar revisión post-mortem si el bug fue introducido en la sesión anterior
