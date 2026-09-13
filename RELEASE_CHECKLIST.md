# 📋 Lista de Verificación de Release (Release Checklist) — RED v103.0.0

Este documento define el protocolo formal de validación y control de calidad previo a la publicación de cualquier versión de producción de **RED**.

---

## 🕒 1. Pre-Release (24 Horas Antes)

### Calidad de Código & Testing
- [x] **Tests de Workspace Rust:** `cargo test --workspace --all-features` → **116/116 pasados** (12+71+6+6+17+4 por suite).
- [x] **Known-Answer Tests (KAT):** Vectores criptográficos deterministas en `tests/crypto_known_answer_tests.rs` → **6/6 PASS**.
- [x] **Tests Criptográficos Avanzados:** `tests/crypto_tests.rs` → **6/6 PASS** (DH, ChaCha20, Double Ratchet, BLAKE3, Ed25519, ZK Merkle).
- [x] **Tests de Integración E2E:** `tests/integration_tests.rs` → **17/17 PASS** (cripto, protocolo, identidad, storage, blockchain).
- [x] **Tests de Enrutamiento Mesh Rust:** `tests/mesh_integration_test.rs` → **4/4 PASS** (TTL drop, 3-hop relay, partición, intercambio directo).
- [x] **Suite Frontend Fases 1-6 (JS/TS):** `npm run test:all` → **60/60 PASS** (sensores, audio DSP, bóveda cripto, DePIN, blindaje, caos mesh 100 nodos).
- [x] **Suite de Caos Mesh Fase 6:** `npm run test:chaos` → **5/5 PASS** (Flood 100 nodos, Split-Brain recovery, Erasure K=3/M=2, Gossip Suppression, Ratchet OoO).
- [x] **Build de Producción Next.js 16 (Turbopack):** `npm run build` → **EXIT 0** (0 errores TypeScript).
- [x] **Verificación de Compilación Rust Release:** `cargo check --workspace` → **EXIT 0**, 0 errores, 0 warnings.
- [x] **Sincronización de i18n (12 Locales):** Cobertura exhaustiva de **1,433 claves** por archivo en 12 idiomas con paridad 1:1 absoluta y 0 deuda de traducción.
- [x] **Auditoría AST de TypeScript:** Escaneo de 386 archivos con `ts.createSourceFile` confirmando 0 claves literales `t()` faltantes.

### Sincronización de Versión & Documentación
- [x] Versión **`v103.0.0`** unificada en 22 archivos maestros (`version.ts`, `build.gradle`, Cargo workspaces, service workers y documentación).
- [x] `ARCHITECTURE.md` → Sincronizado a v103.0.0 con SSOT de protocolo documentado.
- [x] `GOVERNANCE.md` → Sincronizado a v103.0.0 con Regla 1.5 (Nivel 2 SSOT & Cero Duplicación Backend).
- [x] `CHANGELOG.md` → Entrada de v103.0.0 registrando Sovereign Mesh OS — Tactical Command & Complete Localization Parity.
- [x] `SHA256SUMS.txt` → Hash `5423430280BB56E762DB6C1C8EDBB910423703DA731190EA722292539654066D` para `red-v103.0.0-release.apk` y `red-latest.apk`.

### Higiene del Repositorio
- [x] **0 errores** de tipos TypeScript en la compilación de producción.
- [x] `.gitignore` verificado para evitar inclusiones accidentales de binarios intermedios o cachés.

---

## 🚀 2. Día de Lanzamiento (Release Day)

### Compilación y Firma de Artefactos
- [x] **APK Android v103.0.0:** `release-assets/red-v103.0.0-release.apk` (63.45 MB) — SHA-256: `5423430280BB56E762DB6C1C8EDBB910423703DA731190EA722292539654066D`.
- [x] **Verificación de Sumas de Comprobación:** Checksums SHA-256 publicados en `SHA256SUMS.txt` y `release-assets/RED-v103.0.0.apk.sha256`.
- [x] **Validación en Hardware Real:** Desinstalación higiénica e instalación limpia en Motorola Moto G22 (`ZT322B386P`) y Lenovo Tablet TB305XU (`HA2CHKZ2`). Ejecución en primer plano con 0 crashes en Logcat y nodo Rust libp2p inicializado.

### Etiquetado y Despliegue Git
- [x] Crear y empujar el tag anotado y firmado:
  ```bash
  git tag -a v103.0.0 -m "RED Sovereign Mesh OS v103.0.0 (Sovereign Mesh OS — Tactical Command & Complete Localization Parity)"
  git push origin v103.0.0
  ```
- [x] Validar que GitHub Pages ([darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)) responda HTTP 200.
- [x] Publicar assets y notas de release en GitHub Releases v103.0.0 ([Releases v103.0.0](https://github.com/DarckRovert/RED/releases/tag/v103.0.0)).

---

## 🛡️ 3. Post-Release & Procedimiento de Rollback

### Monitoreo Inmediato (48 Horas)
- [ ] Canales de seguridad activos en `darckrovert@gmail.com` y [GitHub Security Advisories](https://github.com/DarckRovert/RED/security/advisories/new).
- [ ] Monitoreo de estabilidad del servidor de señalización P2P y telemetría de enlace LQS.

### Procedimiento de Rollback de Emergencia
Si se detecta una vulnerabilidad crítica o fallo fatal de desincronización en la malla:
1. Crear rama de hotfix: `git checkout -b hotfix/v101.0.1`.
2. Aplicar el parche mínimo sin refactorizaciones cosméticas.
3. Ejecutar la suite completa `npm run test:all` + `cargo test --workspace --all-features`.
4. Incrementar versión a `v101.0.1` y desplegar nueva release prioritaria.
