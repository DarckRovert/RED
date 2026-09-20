---
description: Compilación, instalación y diagnóstico del servidor Rust red-node (red-node.exe) para despliegue local y distribución
globs: ["node/src/**", "core/src/**", "Cargo.toml", "Cargo.lock"]
---

# Workflow: Compilación y Despliegue Rust Backend (`/rust-backend-deploy`)

Gestiona el ciclo de vida del servidor `red-node` (Axum + libp2p + Sled).
Aplica los **Niveles 1, 2 y 4** de la Gobernanza (Rust Compliance, SSOT, Resiliencia).

---

## Requisitos Previos

- Rust toolchain: `rustup show` → debe tener `stable-aarch64/x86_64-pc-windows-msvc`
- NDK Android para JNI: `ANDROID_NDK_HOME` en PATH (solo para `red_mobile`)
- ADB disponible: `$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe`

---

## Pasos de Compilación:

### 1. Validación Pre-Build (Obligatoria)
```powershell
# Verificar paridad de versión en todos los Cargo.toml
node scripts/pre_build_check.js

# Comprobar compilación sin errores (rápido, sin linker)
cargo check --workspace
```
*Si `cargo check` falla → corregir antes de continuar.*

### 2. Linting y Formato Rust
```powershell
cargo fmt --check          # Verificar formato (no modifica)
cargo clippy --all-targets --all-features -- -D warnings
```
*`-D warnings` convierte warnings en errores — debe pasar en cero advertencias.*

### 3. Build Release del Servidor
```powershell
# Compilar red-node en modo release (optimizado)
cargo build --release --package red-node

# El binario queda en:
# target/release/red-node.exe  (Windows)
# target/release/red-node      (Linux/macOS)
```

### 4. Copiar a Raíz y Actualizar SHA-256
```powershell
Copy-Item "target/release/red-node.exe" "red-node.exe" -Force

# Recalcular hash del ejecutable
cd client/app
npm run sync:sha256   # Actualiza SHA256SUMS.txt con el hash de red-node.exe
```

### 5. Compilar JNI (red_mobile → libred_mobile.so)
Solo necesario cuando se modifica `red_mobile/src/`:
```powershell
# Requiere cross-compilation toolchain ARM64
cargo build --release --package red_mobile \
  --target aarch64-linux-android

# Copiar .so al proyecto Android
Copy-Item "target/aarch64-linux-android/release/libred_mobile.so" \
  "client/app/android/app/src/main/jniLibs/arm64-v8a/" -Force
```

### 6. Verificar Servidor Activo
```powershell
# Iniciar servidor (modo dev)
.\red-node.exe --port 7333

# En otra terminal, verificar health endpoint
Invoke-WebRequest "http://127.0.0.1:7333/api/system/health" | Select-Object -ExpandProperty Content
```
*Respuesta esperada: `{"status":"ok","uptime_secs":N,"peers":N,"storage_bytes":N}`*

---

## Diagnóstico de Fallos JNI en Android

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

# Ver logs de carga de libred_mobile.so
& $adb logcat -d | Select-String "libred_mobile|SLF4J|7333|JNI" | Select-Object -Last 30

# Síntomas normales (no son errores):
#   SLF4J(W): No SLF4J providers were found   ← logger stub de libp2p, benigno
# Síntomas de error real:
#   AndroidRuntime: FATAL EXCEPTION            ← crash JNI
#   dlopen failed: library not found           ← .so no copiado a jniLibs/
```

---

## Checklist Pre-Release de red-node.exe

- [ ] `cargo fmt --check` pasa
- [ ] `cargo clippy -- -D warnings` pasa  
- [ ] `cargo check --workspace` pasa
- [ ] SHA-256 de `red-node.exe` en `SHA256SUMS.txt` actualizado
- [ ] `node client/app/scripts/check_release_integrity.js` → 27/27 ✅
