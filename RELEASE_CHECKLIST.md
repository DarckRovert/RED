# 📋 Lista de Verificación de Release (Release Checklist) — RED v64.0.0

Este documento define el protocolo formal de validación y control de calidad previo a la publicación de cualquier versión de producción de **RED**.

---

## 🕒 1. Pre-Release (24 Horas Antes)

### Calidad de Código & Testing
- [x] **Tests de Workspace Rust:** Ejecutar `cargo test --workspace` y verificar **100% de tests aprobados** (116/116 pasados).
- [x] **Known-Answer Tests (KAT):** Validar vectores criptográficos deterministas en `tests/crypto_tests.rs`.
- [x] **Tests de Integración E2E:** Validar resiliencia y particiones de malla en `tests/integration_tests.rs`.
- [x] **TypeScript Strict & Linting:** `cd client/app && npm run lint` $\rightarrow$ **0 errores**.
- [x] **Pruebas de Protocolos de Cliente:** `npm run test:crypto` $\rightarrow$ **4/4 suites aprobadas** (Shamir, ML-KEM, Stego, SoundMesh).
- [x] **Modelos ProVerif:** Validar que los modelos matemáticos en `proofs/` pasen la verificación formal sin consultas falsadas.

### Sincronización de Versión & Documentación
- [x] Versión unificada (`v64.0.0`) en `Cargo.toml`, `core/Cargo.toml`, `blockchain/Cargo.toml`, `node/Cargo.toml`, `red_mobile/Cargo.toml` y `client/app/package.json`.
- [x] `scripts/verify-sync.js` ejecutado con resultado exitoso (6/6 manifiestos en 64.0.0).
- [x] `CHANGELOG.md` actualizado con todas las características, correcciones y notas de seguridad de la versión.
- [x] `README.md`, `GETTING_STARTED.md`, `ADMIN_MANUAL.md` y `USER_MANUAL.md` actualizados.

### Higiene del Repositorio
- [x] **0 binarios en la raíz** y 0 archivos temporales residuales.
- [x] `.gitignore` verificado para evitar inclusiones accidentales de archivos de más de 100 MB o logs locales.

---

## 🚀 2. Día de Lanzamiento (Release Day)

### Compilación y Firma de Artefactos
- [x] **Binario CLI Rust (Desktop):** Compilado en modo release (`cargo build --release --bin red-node`).
- [x] **Compilación Android APK:** Generado APK firmado con Gradle (`./gradlew assembleRelease`).
- [x] **Verificación de Sumas de Comprobación:** Checksums SHA-256 oficiales calculados y publicados en `SHA256SUMS.txt`.
- [x] **Validación en Hardware Real:** Instalación limpia y verificación de ejecución en terminales físicas (Moto G22 y Xiaomi Redmi Note 14 5G).

### Etiquetado y Despliegue Git
- [x] Crear y empujar el tag anotado y firmado:
  ```bash
  git tag -a v64.0.0 -m "RED Sovereign Tactical Master Edition v64.0.0"
  git push origin v64.0.0
  ```
- [x] Validar que la página web oficial en GitHub Pages ([darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)) se actualice y responda con HTTP 200.
- [x] Publicar assets y notas de release en GitHub Releases v64.0.0.

---

## 🛡️ 3. Post-Release & Procedimiento de Rollback

### Monitoreo Inmediato (48 Horas)
- [x] Canales confidenciales activos en `darckrovert@gmail.com` y [GitHub Security Advisories](https://github.com/DarckRovert/RED/security/advisories/new).
- [x] Monitoreo de estabilidad del servidor de señalización P2P y telemetría de enlace LQS.

### Procedimiento de Rollback de Emergencia
Si se detecta una vulnerabilidad crítica o fallo fatal de desincronización en la malla:
1. Crear inmediatamente una rama de hotfix: `git checkout -b hotfix/v64.0.1`.
2. Aplicar el parche mínimo necesario sin refactorizaciones cosméticas.
3. Ejecutar la suite completa de Known-Answer Tests.
4. Incrementar versión de parche a `v64.0.1` y desplegar nueva release prioritaria.
