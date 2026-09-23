# 📋 Lista de Verificación de Release (Release Checklist) — RED v121.0.0

Este documento define el protocolo formal de validación y control de calidad previo a la publicación de cualquier versión de producción de **RED**.

---

## 🕒 1. Pre-Release (24 Horas Antes)

### Calidad de Código & Testing
- [x] **Tests de Workspace Rust:** `cargo test --workspace --all-features` → **116/116 pasados** (12+71+6+6+17+4 por suite).
- [x] **Known-Answer Tests (KAT):** Vectores criptográficos deterministas en `tests/crypto_known_answer_tests.rs` → **6/6 PASS**.
- [x] **Tests Criptográficos Avanzados:** `tests/crypto_tests.rs` → **6/6 PASS** (DH, ChaCha20, Double Ratchet, BLAKE3, Ed25519, ZK Merkle).
- [x] **Tests de Integración E2E:** `tests/integration_tests.rs` → **17/17 PASS** (cripto, protocolo, identidad, storage, blockchain).
- [x] **Tests de Enrutamiento Mesh Rust:** `tests/mesh_integration_test.rs` → **4/4 PASS** (TTL drop, 3-hop relay, partición, intercambio directo).
- [x] **Suite Cripto Post-Cuántica Wire (NIST FIPS 203 ML-KEM-768):** `node client/app/scripts/test-pqc-mesh-transport-resilience.js` → **8/8 PASS** (Contenedor PQC1, KDF híbrida, flag 0x20, rechazo bit-tampering).
- [x] **Suite de Bóveda Shamir Secret Sharing:** `node client/app/scripts/test-shamir-resilience.js` → **8/8 PASS** (GF(2^8) 3-de-5, redundancia 4/5, parser multiformato).
- [x] **Suite Clock Skew PLL & TDMA Guard Time:** `node client/app/scripts/test-tdma-clock-skew-pll.js` → **PASS** (15/25/35ms guard drift tracking).
- [x] **Build de Producción Next.js 16 (Turbopack):** `npm run build` → **EXIT 0** (0 errores TypeScript).
- [x] **Verificación de Compilación Rust Release:** `cargo check --workspace` → **EXIT 0**, 0 errores, 0 warnings.
- [x] **Sincronización de i18n (12 Locales):** Cobertura exhaustiva de claves en 12 idiomas con paridad 1:1 absoluta y 0 deuda de traducción.
- [x] **Auditoría AST de TypeScript:** Escaneo de archivos confirmando 0 claves literales `t()` faltantes y 0 deuda técnica (0 mocks, 0 stubs).

### Sincronización de Versión & Documentación
- [x] Versión **`v121.0.0`** unificada en los 25 archivos maestros (`version.ts`, `build.gradle`, Cargo workspaces, service workers y documentación).
- [x] `ARCHITECTURE.md` → Sincronizado a v121.0.0 con 7 capas, Vivarium Biocibernético 3D, Hábitat In-Silico, MaleCNS Connectome, Kuramoto Sync y Duress Zeroize.
- [x] `GOVERNANCE.md` → Sincronizado a v121.0.0 con Reglas de pre-flight build hygiene y SSOT atómico.
- [x] `CHANGELOG.md` → Entrada de v121.0.0 registrando el Hábitat Digital Biocibernético In-Silico & Ecosistema Multi-Cerebro.
- [x] `SHA256SUMS.txt` → Hash `F8DEDB04537565255050E740C894BAB891631E8B159C512E526553E0D327556C` para `red-v121.0.0-release.apk` y `red-latest.apk`.

### Higiene del Repositorio
- [x] **0 errores** de tipos TypeScript en la compilación de producción (`tsc --noEmit`).
- [x] `.gitignore` verificado para evitar inclusiones accidentales de binarios intermedios o cachés (`.next/`, `out/` ignorados).

---

## 🚀 2. Día de Lanzamiento (Release Day)

### Compilación y Firma de Artefactos
- [x] **APK Android v121.0.0:** `release-assets/red-v121.0.0-release.apk` (69.1 MB) — SHA-256: `F8DEDB04537565255050E740C894BAB891631E8B159C512E526553E0D327556C`.
- [x] **Verificación de Sumas de Comprobación:** Checksums SHA-256 publicados en `SHA256SUMS.txt` y `release-assets/RED-v121.0.0.apk.sha256`.
- [x] **Validación en Hardware Real:** Desinstalación higiénica e instalación limpia en Motorola Moto G22 (`ZT322B386P`) y Lenovo Tab M9 (`HA2CHKZ2`). Ejecución en primer plano con 0 crashes en Logcat, telemetría de sensores en vivo (GPS, PDR, brújula magnética, radar BLE), nodo Rust libp2p inicializado y Vivarium 3D Three.js a 60 FPS.

### Etiquetado y Despliegue Git
- [x] Tag y Release oficial publicados en GitHub:
  ```bash
  gh release create v121.0.0 "release-assets/red-latest.apk" "release-assets/red-v121.0.0-release.apk" "release-assets/SHA256SUMS.txt" --title "RED v121.0.0 — Hábitat Digital Biocibernético In-Silico & Ecosistema Multi-Cerebro" --notes-file "release_notes_v121.0.0.md"
  ```
- [x] Validar que GitHub Pages ([darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)) responda HTTP 200.
- [x] Publicar assets y notas de release en GitHub Releases v121.0.0 ([Releases v121.0.0](https://github.com/DarckRovert/RED/releases/tag/v121.0.0)).

---

## 🛡️ 3. Post-Release & Procedimiento de Rollback

### Monitoreo Inmediato (48 Horas)
- [x] Canales de seguridad activos en `darckrovert@gmail.com` y [GitHub Security Advisories](https://github.com/DarckRovert/RED/security/advisories/new).
- [x] Monitoreo de estabilidad del servidor de señalización P2P y telemetría de enlace LQS.

### Procedimiento de Rollback de Emergencia
Si se detecta una vulnerabilidad crítica o fallo fatal de desincronización en la malla:
1. Crear rama de hotfix: `git checkout -b hotfix/v121.0.1`.
2. Aplicar el parche mínimo sin refactorizaciones cosméticas.
3. Ejecutar la suite completa `npm run test:all` + `cargo test --workspace --all-features`.
4. Incrementar versión a `v121.0.1` y desplegar nueva release prioritaria.
