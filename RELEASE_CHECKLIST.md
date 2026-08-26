# 📋 Lista de Verificación de Release (Release Checklist) — RED v63.0.0

Este documento define el protocolo formal de validación y control de calidad previo a la publicación de cualquier versión de producción de **RED**.

---

## 🕒 1. Pre-Release (24 Horas Antes)

### Calidad de Código & Testing
- [ ] **Tests de Workspace Rust:** Ejecutar `cargo test --workspace` y verificar **100% de tests aprobados**.
- [ ] **Known-Answer Tests (KAT):** Validar vectores criptográficos deterministas en `tests/crypto_tests.rs`.
- [ ] **Tests de Integración E2E:** Validar resiliencia y particiones de malla en `tests/integration_tests.rs`.
- [ ] **TypeScript Strict & Linting:** `cd client/app && npm run lint` $\rightarrow$ **0 errores**.
- [ ] **Pruebas de Protocolos de Cliente:** `npm run test:crypto` $\rightarrow$ **4/4 suites aprobadas** (Shamir, ML-KEM, Stego, SoundMesh).
- [ ] **Modelos ProVerif:** Validar que los modelos matemáticos en `proofs/` pasen la verificación formal sin consultas falsadas.

### Sincronización de Versión & Documentación
- [ ] Versión unificada (`v63.0.0`) en `Cargo.toml`, `core/Cargo.toml`, `blockchain/Cargo.toml`, `node/Cargo.toml`, `red_mobile/Cargo.toml` y `client/app/package.json`.
- [ ] `scripts/validate-version.sh` ejecutado con resultado exitoso.
- [ ] `CHANGELOG.md` actualizado con todas las características, correcciones y notas de seguridad de la versión.
- [ ] `README.md`, `GETTING_STARTED.md`, `ADMIN_MANUAL.md` y `USER_MANUAL.md` actualizados.

### Higiene del Repositorio
- [ ] `scripts/validate-structure.sh` ejecutado: **0 binarios en la raíz** y 0 archivos temporales.
- [ ] `.gitignore` verificado para evitar inclusiones accidentales de archivos de más de 100 MB o logs locales.

---

## 🚀 2. Día de Lanzamiento (Release Day)

### Compilación y Firma de Artefactos
- [ ] **Binario CLI Rust (Desktop):** Compilado en modo release (`cargo build --release --bin red-node`).
- [ ] **Compilación Android APK:** Generado APK firmado con Gradle (`./gradlew assembleRelease`).
- [ ] **Verificación de Sumas de Comprobación:**
  ```bash
  sha256sum release-assets/red-node.exe release-assets/app-release.apk > release-assets/SHA256SUMS.txt
  ```
- [ ] **Validación en Hardware Real:** Instalación limpia y verificación de logcat en terminales de prueba (Moto G22, Tablet Lenovo, Xiaomi).

### Etiquetado y Despliegue Git
- [ ] Crear y empujar el tag anotado y firmado:
  ```bash
  git tag -a v63.0.0 -m "RED Sovereign Tactical Master Edition v63.0.0"
  git push origin v63.0.0
  ```
- [ ] Verificar la ejecución correcta de los 8 workflows en GitHub Actions.
- [ ] Validar que la página web oficial en GitHub Pages ([darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)) se actualice y responda con HTTP 200.

---

## 🛡️ 3. Post-Release & Procedimiento de Rollback

### Monitoreo Inmediato (48 Horas)
- [ ] Supervisar reportes confidenciales en `darckrovert@gmail.com` y [GitHub Security Advisories](https://github.com/DarckRovert/RED/security/advisories/new).
- [ ] Monitorear estabilidad del servidor de señalización P2P y telemetría de enlace LQS.

### Procedimiento de Rollback de Emergencia
Si se detecta una vulnerabilidad crítica o fallo fatal de desincronización en la malla:
1. Crear inmediatamente una rama de hotfix: `git checkout -b hotfix/v64.0.1`.
2. Aplicar el parche mínimo necesario sin refactorizaciones cosméticas.
3. Ejecutar la suite completa de Known-Answer Tests.
4. Incrementar versión de parche a `v64.0.1` y desplegar nueva release prioritaria.
