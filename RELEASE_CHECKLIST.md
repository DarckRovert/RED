# 📋 Lista de Verificación de Release (Release Checklist) — RED v65.0.1

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
- [x] **Verificación Formal ProVerif (Modelo Simbólico Dolev-Yao):** `proofs/security_model.pv` → Confidencialidad TRUE, Autenticación TRUE, Forward Secrecy TRUE. `proofs/anonymity_proof.pv` → Anonimato Emisor FALSE (esperado), Anonimato Receptor FALSE (esperado), Unlinkability FALSE (esperado).
- [x] **Especificación Formal TLA+:** `specs/omega_protocol.tla` → Safety (Inv₁: integridad de entrega) y Liveness (TTL bounded delivery) verificados.
- [x] **Build de Producción Next.js 16 (Turbopack):** `npm run build` → **EXIT 0** (3.4s, 0 errores TypeScript).
- [x] **Verificación de Compilación Rust Release:** `cargo check --workspace` → **EXIT 0**, 0 errores, 0 warnings.
- [x] **Sincronización de i18n (13 Locales):** `node scripts/sync_all_locales_strict.js` → **11 locales sincronizados estrictamente**.

### Sincronización de Versión & Documentación
- [x] Versión **`v65.0.1`** unificada en `Cargo.toml`, `core/Cargo.toml`, `blockchain/Cargo.toml`, `node/Cargo.toml`, `red_mobile/Cargo.toml` y `client/app/package.json`.
- [x] `ARCHITECTURE.md` → Sincronizado a v65.0.1 con SSOT de protocolo documentado.
- [x] `GOVERNANCE.md` → Sincronizado a v65.0.1 con Regla 1.5 (Nivel 2 SSOT & Cero Duplicación Backend).
- [x] `.agents/rules/governance.md` → Sincronizado a v65.0.1.
- [x] `CHANGELOG.md` → Entrada de v65.0.1 registrando unificación de 13 subsistemas tácticos/IA.
- [x] `SHA256SUMS.txt` → Hash `5e49d5ef0b68ce33db59149864882e819ee008214c6368c3589586bf20c2cc60` para los 3 APKs de release.

### Higiene del Repositorio
- [x] **0 errores** de tipos TypeScript en la compilación de producción.
- [x] **0 errores/warnings Clippy** (`cargo clippy --workspace --all-targets --all-features -- -D warnings`).
- [x] `.gitignore` verificado para evitar inclusiones accidentales de archivos de más de 100 MB o logs locales.

---

## 🚀 2. Día de Lanzamiento (Release Day)

### Compilación y Firma de Artefactos
- [x] **APK Android v65.0.1:** `release-assets/RED-v65.0.1.apk` (64.8 MB) — SHA-256: `5e49d5ef...2cc60`.
- [x] **Verificación de Sumas de Comprobación:** Checksums SHA-256 publicados en `SHA256SUMS.txt` y `release-assets/RED-v65.0.1.apk.sha256`.
- [ ] **Validación en Hardware Real:** Instalación limpia en Moto G22 y Xiaomi Redmi Note 14 5G.

### Etiquetado y Despliegue Git
- [x] Crear y empujar el tag anotado y firmado:
  ```bash
  git tag -a v65.0.1 -m "RED Sovereign Mesh — Multi-Broker & Web P2P Edition v65.0.1"
  git push origin v65.0.1
  ```
- [x] Validar que GitHub Pages ([darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)) responda HTTP 200.
- [x] Publicar assets y notas de release en GitHub Releases v65.0.1 ([Releases v65.0.1](https://github.com/DarckRovert/RED/releases/tag/v65.0.1)).

---

## 🛡️ 3. Post-Release & Procedimiento de Rollback

### Monitoreo Inmediato (48 Horas)
- [ ] Canales de seguridad activos en `darckrovert@gmail.com` y [GitHub Security Advisories](https://github.com/DarckRovert/RED/security/advisories/new).
- [ ] Monitoreo de estabilidad del servidor de señalización P2P y telemetría de enlace LQS.

### Procedimiento de Rollback de Emergencia
Si se detecta una vulnerabilidad crítica o fallo fatal de desincronización en la malla:
1. Crear rama de hotfix: `git checkout -b hotfix/v65.0.2`.
2. Aplicar el parche mínimo sin refactorizaciones cosméticas.
3. Ejecutar la suite completa `npm run test:all` + `cargo test --workspace --all-features`.
4. Incrementar versión a `v65.0.2` y desplegar nueva release prioritaria.
