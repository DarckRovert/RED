# ðŸ¤– RULESET AUTÃ“MATA RED v90.0.0 â€” FLUJO INTEGRAL DE GOBERNANZA

## **NIVEL 0: PRE-COMMIT (Git Hooks & Validation)**

### Regla 0.1: ValidaciÃ³n de Estructura de Archivo
**Antes de cualquier commit:**
- âŒ NO permitir archivos binarios en raÃ­z: `*.exe`, `*.apk`, `*.dll`, `*.so` deben ir a `release-assets/` y usar **Git LFS**
- âŒ NO permitir archivos sin extensiÃ³n sin shebang vÃ¡lido
- âœ… Permitir SOLO: `.ts`, `.tsx`, `.rs`, `.java`, `.kt`, `.json`, `.md`, `.toml`, `.yml`, `.yaml`
- âœ… Validar que cada archivo tenga encoding UTF-8
- Comando de control: `git lfs track "*.exe" "*.apk" "*.so"` + `.gitattributes` debe existir

### Regla 0.2: Path Segregation Obligatoria
**Estructura permitida sin excepciones:**
```
RED/
â”œâ”€â”€ core/                    # â† SOLO cÃ³digo Rust (red_core)
â”œâ”€â”€ blockchain/              # â† SOLO cÃ³digo Rust (red_blockchain)
â”œâ”€â”€ node/                    # â† SOLO binario CLI Rust
â”œâ”€â”€ red_mobile/              # â† SOLO cÃ³digo Rust + JNI
â”œâ”€â”€ client/app/              # â† SOLO Next.js + React
â”œâ”€â”€ signaling/               # â† SOLO Node.js Express
â”œâ”€â”€ proofs/                  # â† SOLO archivos ProVerif (.pv)
â”œâ”€â”€ specs/                   # â† SOLO archivos TLA+ (.tla)
â”œâ”€â”€ tests/                   # â† Tests integrados
â”œâ”€â”€ docs/                    # â† DocumentaciÃ³n (.md)
â””â”€â”€ .github/workflows/       # â† CI/CD YAML
```

**Si archivo no pertenece a carpeta categorÃ­a â†’ RECHAZAR commit**

### Regla 0.3: Versionado Sincronizado AtÃ³mico (SSOT)
**Antes de push a main o compilaciÃ³n:**
- **EjecuciÃ³n Obligatoria**: Todo cambio de versiÃ³n DEBE realizarse exclusivamente mediante `node scripts/bump_version.js <X.Y.Z>`.
- Verificar que `client/app/src/lib/version.ts`, `package.json`, `build.gradle`, `sw.js`, `public/sw.js` y los 6 `Cargo.toml` (`raÃ­z`, `core`, `red_mobile`, `node`, `blockchain`, `client`) estÃ¡n en 100% de paridad.
- âŒ RECHAZAR y ABORTAR si existe cualquier discrepancia en los 12 archivos SSOT.

### Regla 0.4: ValidaciÃ³n de Dependencias
**Por cada cambio en `package.json`, `Cargo.toml`, o `Cargo.lock`:**
- Ejecutar `npm audit` (permitir SOLO vulns de nivel bajo si no hay fix disponible)
- Ejecutar `cargo audit` en cada crate del workspace
- Generar SBOM (Software Bill of Materials) con `cargo sbom` si disponible
- âŒ RECHAZAR si hay vulnerabilidades crÃ­ticas o altas sin mitigaciÃ³n documentada

### Regla 0.5: Pre-Flight Build Hygiene
- Antes de ejecutar cualquier compilaciÃ³n (`next build`, `cap sync`, `gradlew`), es MANDATORIO ejecutar `node scripts/pre_build_check.js` para purgar `.next/`, `out/`, `build/` y prevenir artefactos obsoletos o binarios huÃ©rfanos en `public/`.


---

## **NIVEL 1: VALIDACIÃ“N SINTÃCTICA (Pre-Build Checks)**

### Regla 1.1: TypeScript/JavaScript Compliance
**Para todos los `.ts`, `.tsx`, `.js` en `client/app/` y `signaling/`:**
- âœ… `eslint --fix` con config Next.js strict
- âœ… `prettier --write` (Vanilla + React standards)
- âœ… Compilar con `tsc --noEmit --strict`
- âœ… Resolver TODOS los `any` types â†’ reemplazar con tipos explÃ­citos
- âœ… NO permitir `console.log()` en cÃ³digo que va a producciÃ³n (solo console.error/warn)
- Validar imports: NO ciclos de dependencias

### Regla 1.2: Rust Compliance (Workspace-wide)
**Para TODOS los `.rs` en core/, blockchain/, node/, red_mobile/:**
- âœ… `cargo fmt --check` (formato Rust standard)
- âœ… `cargo clippy --all-targets --all-features -- -D warnings` (NO warnings)
- âœ… Compilar con `cargo check --all-features` antes de full build
- âœ… `cargo audit` para dependencias de seguridad
- âœ… Validar que no hay `unsafe` blocks a menos que sea en mÃ³dulos especÃ­ficos documentados (ej: crypto)
- âœ… Si hay `unsafe`, debe tener comentario de 3 lÃ­neas explicando PORQUÃ‰ es necesario

### Regla 1.3: ValidaciÃ³n de Manifests
**Para `Cargo.toml` en workspace:**
- âœ… Validar sintaxis TOML (no espacios tabs)
- âœ… Todos los `workspace.members` deben existir como directorios
- âœ… Todas las dependencias en `[workspace.dependencies]` deben usarse en algÃºn crate hijo
- âœ… No permitir versiones flotantes (`*` o `>= X.Y`) excepto en dev-dependencies
- âœ… Verificar que `[patch.crates-io]` tiene justificaciÃ³n en comentario

**Para `package.json` en client/app/ y signaling/:**
- âœ… Validar sintaxis JSON
- âœ… `scripts` section debe tener: `build`, `dev`, `lint`
- âœ… `engines.node` debe especificar `>=18.0.0` mÃ­nimo
- âœ… Todos los `dependencies` versiones deben ser â‰¥ "X.Y.Z" nunca `*`

### Regla 1.3.1: Coherencia de Crate Names y Grafo de Dependencias en Cargo
**Para TODOS los crates del workspace (`core`, `blockchain`, `node`, `red_mobile`):**
- âŒ **PROHIBIDO** modificar o alternar el `name` del package en cualquier crate hijo sin sincronizar simultÃ¡neamente todos los dependientes en el workspace.
- âœ… **Paridad Estricta de Nombres:** El crate `blockchain` debe conservar indefectiblemente `name = "red-blockchain"`. En Rust, los identificadores en cÃ³digo (`use red_blockchain::...`) mapean automÃ¡ticamente los guiones a guiones bajos (`-` -> `_`), por lo que el `name` del manifiesto DEBE mantenerse como `red-blockchain` para coincidir con `red-blockchain = { path = "../blockchain" }` en `core`, `node` y `red_mobile`.
- âœ… **ValidaciÃ³n de ResoluciÃ³n:** Antes de cualquier commit o release, es MANDATORIO ejecutar `cargo check --workspace` para validar que Cargo resuelva el grafo completo de dependencias sin discrepancias entre nombres de paquete y llaves de dependencia.
- âœ… **SincronizaciÃ³n de Lockfile:** Cada actualizaciÃ³n de versiÃ³n en `Cargo.toml` debe verificar que `Cargo.lock` sincronice los miembros locales a la misma versiÃ³n SSOT.

### Regla 1.4: Markdown Documentation Validation
**Para TODOS los `.md` en raÃ­z y docs/:**
- âœ… Validar sintaxis Markdown (no broken links)
- âœ… Verificar que todos los `[links]` apunten a archivos o URLs vÃ¡lidas
- âœ… Validar que bloques de cÃ³digo tienen language specifier (```rust, ```typescript, etc)
- âœ… Verificar que CHANGELOG.md tiene entrada para versiÃ³n actual
- âœ… README.md debe mencionar: descripciÃ³n, arquitectura, cÃ³mo compilar, licencia

### Regla 1.5: Single Source of Truth (SSOT) de Protocolo & Cero DuplicaciÃ³n
**Para TODOS los modelos y contratos de datos en core/, node/, red_mobile/:**
- âœ… **CentralizaciÃ³n Obligatoria**: Todo struct, enum, DTO o mensaje de red P2P (AMBER, SOS, Clima, Canales, Social, Guardian, Audio, EfÃ­meros, Proximidad, BaterÃ­a, Sanitizador, Chunker, IA Copilot) DEBE residir en `core/src/protocol/tactical.rs`.
- âŒ **ProhibiciÃ³n de DuplicaciÃ³n**: Queda estrictamente prohibido redefinir structs duplicados en `node/src/` o `red_mobile/src/`. Ambos crates deben re-exportar e importar directamente desde `red_core::protocol::tactical`.
- âœ… **Aislamiento de Plataforma**: `node` mantiene su persistencia en disco (`sled::Db`) y CLI, mientras que `red_mobile` mantiene su almacenamiento liviano en RAM (`RwLock<HashMap>`) y su puente JNI C-ABI intacto.

---

## **NIVEL 2: BUILD PIPELINE (CompilaciÃ³n Ordenada)**

### Regla 2.1: Build Secuencia DeterminÃ­stica
**Orden de compilaciÃ³n inmutable:**

1. **Rust Workspace Base**
   ```bash
   cd core && cargo build --release
   cargo test --all
   cd ../blockchain && cargo build --release
   cargo test --all
   cd ../node && cargo build --release
   cd ../red_mobile && cargo build --release
   ```
   - âŒ DETENER si alguno falla
   - âœ… Generar artifacts en `target/release/`

2. **JavaScript/TypeScript (Parallel OK)**
   ```bash
   cd client/app && npm ci && npm run build
   cd ../../signaling && npm ci && npm run build
   ```
   - âŒ DETENER si package-lock.json no existe
   - âœ… Generar artifacts en `.next/`, `dist/`

3. **Android APK (Capacitor Bridge)**
   ```bash
   cd client/app
   npx cap sync android
   cd android && ./gradlew assembleRelease
   ```
   - Depende de: Rust mobile compilation completa
   - Generar: `app/build/outputs/apk/release/app-release.apk`

4. **Desktop Binary (Node CLI)**
   - Depende de: Rust core y node completos
   - Generar: `target/release/red-node`

### Regla 2.2: Output Artifact Validation
**DespuÃ©s de CADA compilaciÃ³n:**
- âœ… Verificar que binarios/librerÃ­as existen y tienen tamaÃ±o > 0
- âœ… Para Rust: `file target/release/red-node` debe mostrar "ELF 64-bit" o "PE executable"
- âœ… Para JavaScript: `dist/` debe contener `*.js` y `*.d.ts`
- âœ… Para APK: Verificar que existe y es firmado (si es release)
- âœ… Generar checksums SHA256: `sha256sum artifact > SHA256SUMS.txt`

### Regla 2.3: Test Execution Mandatory
**Por cada compilaciÃ³n exitosa:**
- âœ… `cargo test --workspace` (Rust tests)
- âœ… `npm run test` en client/app/ si existe jest.config.js
- âœ… `npm run test` en signaling/ si existe
- âœ… Verificar coverage > 70% para cÃ³digo crÃ­tico (cryptography, auth, mesh)
- âŒ RECHAZAR build si algÃºn test falla
- âœ… Generar coverage report: `coverage/lcov.info`

---

## **NIVEL 3: SEGURIDAD & CRIPTOGRAFÃA (Critical Layer)**

### Regla 3.1: Post-Quantum Crypto Validation
**Para TODOS los archivos que usen crypto (core/src/crypto.rs, etc):**
- âœ… Verificar que `ml-kem-768` se usa SIEMPRE en par con X25519
- âœ… Validar que `AES-256-GCM` nunca reutiliza nonces (contador monotÃ³nico)
- âœ… Validar que random secrets usan `ChaCha20Rng` o OSRng, NUNCA arrays hardcodeados
- âœ… Verifying que claves maestras se derivan con `HKDF-SHA256` nunca `SHA256` simple
- âœ… Para `Argon2id`: parÃ¡metros deben ser: `m_cost >= 65536, t_cost >= 3, parallelism >= 4`

### Regla 3.2: Storage Encryption Validation
**Para acceso a Sled DB:**
- âœ… TODAS las writes a Sled deben pasar por `CryptoEngine::encrypt()`
- âœ… TODAS las reads de Sled deben pasar por `CryptoEngine::decrypt()`
- âœ… NingÃºn dato en plain text puede ser persistido
- âœ… Claves de cifrado deben rotarse con `rotate_key()` cada 90 dÃ­as (detectar en tests)
- âœ… Verificar que `master_pin` NUNCA se almacena, solo derivaciÃ³n

### Regla 3.3: Biometric Authentication Flow
**Para Android BiometricPrompt y WebAuthn (client/app/auth/bioauth.ts):**
- âœ… Flujo: BiometricPrompt â†’ Success â†’ Retrieve PIN from KeyStore â†’ Derive Key â†’ Open Vault
- âœ… NUNCA almacenar PIN directamente en LocalStorage
- âœ… Android: Usar `USE_BIOMETRIC + USE_FINGERPRINT` flags
- âœ… Web: Usar `navigator.credentials.get()` solo (NUNCA `create()` durante auth)
- âœ… Decoy PIN path: PIN errÃ³neo â†’ abre `decoy_vault` (no falla, engaÃ±a)
- âœ… Panic PIN path: PIN especial â†’ destruye todas las claves (ATOMIC operation)

### Regla 3.4: Formal Proof Validation
**Para cambios en proofs/ (ProVerif files):**
- âœ… Ejecutar `proverif proofs/security_model.pv` despuÃ©s de cualquier cambio crypto
- âœ… Verificar que output contiene: `Query ... is true.` (no `false.`)
- âœ… Si ProVerif encuentra ataque: âŒ RECHAZAR commit hasta que se arregle
- âœ… Generar `attack.txt` si vulnerabilidad encontrada
- âœ… Documentar cambio en `ARCHITECTURE.md` secciÃ³n 2

---

## **NIVEL 4: INTEGRATION & NETWORK (Multi-Layer Communication)**

### Regla 4.1: IPC Bridge Validation
**Para Capacitor + JNI Bridge (client/app â†’ red_mobile):**
- âœ… TODOS los `bridge.invoke()` calls en TypeScript deben tener handler correspondiente en RedNodePlugin.java
- âœ… ParÃ¡metros JSON deben validarse contra TypeScript interfaces
- âœ… NUNCA pasar datos sensibles (passwords, keys) por bridge sin encriptaciÃ³n
- âœ… Timeout mÃ¡ximo: 5 segundos por IPC call (configurado en RedNodeService)
- âœ… Error handling: TODOS los calls deben tener `.catch()` explÃ­cito

### Regla 4.2: Axum Server Validation
**Para servidor local (core/src/server.rs):**
- âœ… BIND OBLIGATORIO: `127.0.0.1:7333` NUNCA `0.0.0.0`
- âœ… TODOS los endpoints deben validar header `X-API-Key` (middleware auth)
- âœ… Rutas disponibles (verifcar que existe cada ruta):
  - `POST /api/messages` (enviar mensaje)
  - `GET /api/events` (SSE stream)
  - `GET /api/contacts` (listar contactos)
  - `POST /api/vault` (unlock request)
- âœ… Response timeout: 30 segundos mÃ¡ximo
- âœ… Request body size limit: 10 MB mÃ¡ximo
- âœ… CORS: DISABLED (loopback-only, no cors needed)

### Regla 4.3: Mesh Networking Validation
**Para enrutamiento P2P (core/src/mesh.rs):**
- âœ… Protocolo Gossipsub: TODOS los mensajes deben tener:
  - Topic (ej: `/red/chat`, `/red/social`)
  - Message ID Ãºnico (hash del contenido + timestamp)
  - TTL (Time-to-Live): 64 hops mÃ¡ximo
- âœ… Multi-transport routing (seleccionar mejor segÃºn disponibilidad):
  - BLE (< 10m): Usar si ambos nodos tienen BLE
  - WiFi Direct (< 100m): Fallback si BLE no disponible
  - LoRa (< 15km): Fallback si WiFi no disponible
  - SoundMesh (radio-blocked): Fallback si todas las anteriores fallan
  - Internet (WAN): Usar solo si todos los anteriores fallan
- âœ… ACK protocol: TODOS los paquetes deben recibir DELIVERY_ACK dentro de 10 segundos
- âœ… Store-and-Forward: Mensajes fallidos se guardan localmente 48 horas max

### Regla 4.4: WebRTC Signaling Validation
**Para servidor de seÃ±alizaciÃ³n (signaling/server.js):**
- âœ… NUNCA inspeccionar, registrar o cachear contenido de SDP/ICE
- âœ… Validar que JSON que llega es SDP o ICE vÃ¡lido (estructura correcta)
- âœ… Timeout de sesiÃ³n: 30 minutos inactividad â†’ desconectar
- âœ… Rate limiting: 10 signaling messages por segundo por cliente
- âœ… Error responses deben ser genÃ©ricos (no revelar causas especÃ­ficas)

---

## **NIVEL 5: DATA INTEGRITY & FORENSICS**

### Regla 5.1: Merkle Tree Validation
**Para state integrity (core/src/merkle.rs):**
- âœ… TODOS los cambios a storage deben actualizar raÃ­z Merkle
- âœ… Cada node debe verificar `merkle_verify()` antes de aplicar cambio remoto
- âœ… Si verificaciÃ³n falla â†’ RECHAZAR paquete + LOG incident
- âœ… Generar `merkle_proof` para auditorÃ­a

### Regla 5.2: Message Integrity
**Para TODOS los mensajes en trÃ¡nsito (core/src/crypto.rs):**
- âœ… Estructura obligatoria:
  ```json
  {
    "id": "sha256(content + timestamp)",
    "content": "AES-256-GCM(plaintext, aad=metadata)",
    "aad": {"sender":"did:red:...", "recipient":"did:red:...", "timestamp": 123456},
    "delivery_ack": "signature(id, nonce)"
  }
  ```
- âœ… Validar `id` matches hash de payload
- âœ… Validar `delivery_ack` signature con sender public key
- âœ… Rechazar si timestamp > 1 hora en el pasado

### Regla 5.3: Audit Logging
**Para TODOS los eventos sensibles:**
- âœ… Login attempts (success + failure)
- âœ… Vault unlock/lock
- âœ… Message send/receive
- âœ… Contact add/remove
- âœ… Key rotation
- âœ… Formato: JSON con timestamp, user_id (anÃ³nimo), action, result
- âœ… Almacenar en archivo immutable (Sled con flag `no_overwrite`)
- âœ… Rotar logs cada 7 dÃ­as, mÃ¡ximo 12 meses de historia

---

## **NIVEL 6: CI/CD PIPELINE (Automated Governance)**

### Regla 6.1: GitHub Actions Workflow Structure
**ARCHIVO: `.github/workflows/main.yml`**

```yaml
name: RED CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # Job 1: Lint & Format
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Rust Lint
        run: cargo fmt --check && cargo clippy --all -- -D warnings
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: JS Lint
        run: npm run lint

  # Job 2: Security Audit
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Rust Audit
        run: cargo audit
      - name: npm Audit
        run: npm audit --production

  # Job 3: Build
  build:
    runs-on: ubuntu-latest
    needs: [lint, security]
    steps:
      - uses: actions/checkout@v4
      - name: Build Rust
        run: |
          cd core && cargo build --release
          cd ../blockchain && cargo build --release
          cd ../node && cargo build --release
      - name: Build JS
        run: |
          cd client/app && npm ci && npm run build
          cd ../../signaling && npm ci && npm run build

  # Job 4: Tests
  test:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - name: Rust Tests
        run: cargo test --workspace
      - name: Upload Coverage
        run: |
          cargo tarpaulin --workspace --out Xml
          bash <(curl -s https://codecov.io/bash)

  # Job 5: Security Scanning (SAST)
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sonarqube Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  # Job 6: Release (main branch only)
  release:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    needs: [test, sast]
    steps:
      - uses: actions/checkout@v4
      - name: Semantic Release
        uses: cycjimmy/semantic-release-action@v4
      - name: Upload Assets
        run: |
          cp target/release/red-node release-assets/
          sha256sum release-assets/* > SHA256SUMS.txt
          git add SHA256SUMS.txt
          git commit -m "chore: update checksums"
          git push
```

### Regla 6.2: Pull Request Validation
**Obligatorio ANTES de merge a main:**
- âœ… TODOS los checks en verde (lint, security, build, test)
- âœ… Code review aprobado por 2+ contributors
- âœ… Cambios en `core/` o `blockchain/` requieren crypto expert approval
- âœ… Commit message debe seguir formato `type(scope): description`
  - type: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`
  - scope: `crypto`, `auth`, `mesh`, `ui`, etc.
  - Ejemplo: `feat(crypto): add key rotation for AES`
- âœ… Branch naming: `feature/description`, `fix/description`, `docs/description`

### Regla 6.3: Release Management
**Triggers a versionado + deployment:**
- âœ… VersiÃ³n automÃ¡tica = `X.Y.Z` (semÃ¡ntica)
- âœ… CHANGELOG.md actualizado automÃ¡ticamente
- âœ… Git tags: `v90.0.0` apuntando a commit
- âœ… Release artifacts generados:
  - `red-node` (Linux/Windows/macOS)
  - `app-release.apk` (Android)
  - `SHA256SUMS.txt` (checksums)
  - SBOM (Software Bill of Materials)
- âœ… Generar release notes automÃ¡ticas del CHANGELOG

---

## **NIVEL 7: DEPLOYMENT & RUNTIME VALIDATION**

### Regla 7.1: Container Building (Docker)
**Para cada release:**
```dockerfile
# Dockerfile.node
FROM rust:latest AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/red-node /usr/local/bin/
CMD ["red-node"]
```

- âœ… Scan imÃ¡genes con Trivy: `trivy image darckrovert/red-node:latest`
- âœ… NO hardcode secrets en imagen
- âœ… Usar multi-stage builds para minimizar size

### Regla 7.2: Android APK Validation
**Antes de publicar en Play Store:**
- âœ… Verificar firma: `jarsigner -verify -verbose app-release.apk`
- âœ… Scan con MobSF (Mobile Security Framework)
- âœ… Test en Android 12+ emulator: instalaciÃ³n, flujo auth, envÃ­o mensaje
- âœ… Verificar permisos solicitados (BiometricPrompt, BLE, GPS, etc.)

### Regla 7.3: Runtime Security Checks
**En startup de aplicaciÃ³n:**
- âœ… Verificar integridad de binary (checksum)
- âœ… Verificar que Sled DB puede abrirse (no corrupted)
- âœ… Verificar que certificados TLS son vÃ¡lidos (si aplica)
- âœ… Verificar que proceso se ejecuta con permisos correctos (NO root si no necesario)
- âœ… Inicializar logging (no revelar paths ni IPs internas)

### Regla 7.4: SoberanÃ­a de Despliegue Web y Resiliencia ante Fallos de CI (Local-First Deployment)
**Independencia de Servicios Centralizados de CI/CD:**
- ðŸ›¡ï¸ **Principio de Auto-Suficiencia**: Ante bloqueos administrativos en GitHub (Billing issues/holds), lÃ­mites de cuota de minutos de Actions o caÃ­das de infraestructura cloud, el portal web y Web Companion (`https://darckrovert.github.io/RED/`) DEBE poder compilarse y publicarse directamente de forma local y determinista sin intervenciÃ³n de runners remotos.
- ðŸš€ **Flujo de Despliegue Local Oficial**:
  1. Compilar bundle estÃ¡tico optimizado: `npm run build:gh` (en `client/app/` con `NEXT_PUBLIC_BASE_PATH='/RED'`).
  2. Generar artefactos estÃ¡ticos requeridos: Copiar `out/index.html` a `out/404.html` (para soportar SPA client-side routing en GitHub Pages) e inyectar `out/.nojekyll` (para evitar omisiÃ³n de carpetas `_next/`).
  3. Publicar directamente en la rama `gh-pages`: `npx -y gh-pages -d out -b gh-pages` o ejecutando `scripts/deploy_gh_pages.ps1` / `scripts/deploy_web.bat` / `npm run deploy:gh`.
- âŒ **ProhibiciÃ³n**: Queda prohibido dejar una release web desactualizada o bloqueada por depender exclusivamente de workflows remotos cuando el entorno local dispone de las herramientas de compilaciÃ³n y publicaciÃ³n directa.

---

## **NIVEL 8: DOCUMENTATION & COMPLIANCE**

### Regla 8.1: Documentation Requirements
**ARCHIVOS OBLIGATORIOS:**
- âœ… `README.md` (actualizado en cada version)
- âœ… `ARCHITECTURE.md` (sincronizado con cÃ³digo)
- âœ… `CHANGELOG.md` (entrada por cada commit a main)
- âœ… `USER_MANUAL.md` (actualizado con nuevos features)
- âœ… `ADMIN_MANUAL.md` (instrucciones deployment)
- âœ… `CONTRIBUTING.md` (cÃ³mo contribuir, style guide)
- âœ… `SECURITY.md` (cÃ³mo reportar vulnerabilidades, no pÃºblico)
- âœ… `LICENSE` (AGPL-3.0)
- âœ… `CODE_OF_CONDUCT.md`

### Regla 8.2: API Documentation
**Para TODOS los endpoints Axum:**
- âœ… Generar OpenAPI/Swagger spec
- âœ… Documentar: mÃ©todo, path, params, request body, response, errors
- âœ… Ejemplo para `POST /api/messages`:
  ```yaml
  /api/messages:
    post:
      summary: Send encrypted message
      parameters:
        - name: X-API-Key
          in: header
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                recipient:
                  type: string
                  description: "did:red:..."
                content:
                  type: string
                  description: "AES-256-GCM encrypted"
      responses:
        '200':
          description: Message sent
```

### Regla 8.3: Compliance Checklist
**Para release a producciÃ³n:**
- âœ… GDPR: No almacenar datos personales sin consentimiento
- âœ… License compliance: Todos los deps tienen compatible licenses
- âœ… Accessibility: WCAG 2.1 AA para UI web
- âœ… Security: Zero critical/high vulns en dependencies
- âœ… Performance: API response time < 500ms (p95)
- âœ… Availability: Uptime >= 99.5% (si es servicio)

---

## **NIVEL 9: MONITORING & OBSERVABILITY**

### Regla 9.1: Logging Strategy
**Niveles y uso:**
- `ERROR`: Fallos que impiden operaciÃ³n (auth failed, DB error, crypto error)
- `WARN`: Condiciones anÃ³malas pero manejables (slow network, missing device)
- `INFO`: Eventos importantes (user login, message sent, connection established)
- `DEBUG`: Detalles de ejecuciÃ³n (sent X bytes, received ACK from Y)
- `TRACE`: Datos muy verbosos (cada operaciÃ³n criptogrÃ¡fica)

**Formato obligatorio:**
```json
{
  "timestamp": "2024-01-15T14:30:45Z",
  "level": "ERROR",
  "module": "crypto",
  "message": "AES decryption failed",
  "context": {
    "message_id": "sha256...",
    "reason": "AuthTag verification failed"
  }
}
```

### Regla 9.2: Metrics Collection
**Prometheus metrics (usando prometheus-client):**
- `red_messages_sent_total` (counter)
- `red_messages_received_total` (counter)
- `red_message_latency_ms` (histogram)
- `red_crypto_operations_total` (counter)
- `red_storage_bytes` (gauge)
- `red_mesh_peers_connected` (gauge)
- `red_battery_level_percent` (gauge)

### Regla 9.3: Alerting Rules
**Basado en mÃ©tricas, disparar alertas si:**
- Error rate > 1% en Ãºltima hora
- Latencia p99 > 5 segundos
- Storage > 80% capacity
- Menos de 2 peers conectados en malla
- BaterÃ­a < 10%
- ProVerif prueba FALLA

---

## **NIVEL 10: VERSIONING & RELEASE CYCLE**

### Regla 10.1: Semantic Versioning
**Format: `MAJOR.MINOR.PATCH`**
- **MAJOR**: Breaking changes (Cargo version bump, new crate required)
- **MINOR**: New features (new module, new encryption algo)
- **PATCH**: Bug fixes, security patches

**Regla**: TODOS los Cargo.toml deben sincronizar versiÃ³n. Si alguno diverge â†’ CI falla.

### Regla 10.2: Release Branch Strategy
```
main (stable)
  â†‘
  â”œâ”€ release/v90.0.0 (release candidate)
  â”‚   â†‘
  â”‚   â””â”€ develop (integration branch)
  â”‚       â†‘
  â”‚       â””â”€ feature/*, fix/*, docs/* (developer branches)
```

- **main**: Solo tags y hotfixes, CI/CD corre completo
- **develop**: Integration branch, CI/CD sin deploy
- **feature/**: Del developer, merge â†’ develop after review

### Regla 10.3: Release Checklist
**Antes de crear tag `vX.Y.Z` en main:**
- âœ… VersiÃ³n actualizada en Cargo.toml (workspace + crates)
- âœ… VersiÃ³n actualizada en package.json
- âœ… CHANGELOG.md tiene secciÃ³n `## [X.Y.Z] - YYYY-MM-DD`
- âœ… README.md menciona versiÃ³n actual
- âœ… ARCHITECTURE.md sincronizado con cambios
- âœ… TODO CI/CD jobs verdes
- âœ… Security scan: zero critical vulns
- âœ… Code coverage >= 70%
- âœ… ProVerif proofs passed
- âœ… Release notes generadas
- âœ… Binarios compilados y checksummed
- âœ… Git tag creado: `git tag -s v90.0.0 -m "Release 90.0.0"`
- âœ… Tag pusheado: `git push origin v90.0.0`

---

## **NIVEL 11: INCIDENT RESPONSE & ROLLBACK**

### Regla 11.1: Critical Bug Procedure
**Si bug crÃ­tico en main:**
1. Crear branch `hotfix/issue-name` desde main
2. Hacer fix mÃ­nimal (NO refactors)
3. Bump PATCH version (63.0.X â†’ 63.0.X+1)
4. Update CHANGELOG.md con entrada `Security` o `Hotfix`
5. PR review por 2+ core maintainers
6. Merge a main y develop
7. Tag and release

### Regla 11.2: Rollback Procedure
**Si release X tiene problema:**
1. Revert tag: `git push -d origin vX.Y.Z`
2. Revert commits: `git revert -n HEAD~N..HEAD` (N = nÃºmero de commits)
3. Crear release `X.Y.Z-rollback`
**Para release a producción:**
- ✅ GDPR: No almacenar datos personales sin consentimiento
- ✅ License compliance: Todos los deps tienen compatible licenses
- ✅ Accessibility: WCAG 2.1 AA para UI web
- ✅ Security: Zero critical/high vulns en dependencies
- ✅ Performance: API response time < 500ms (p95)
- ✅ Availability: Uptime >= 99.5% (si es servicio)

---

## **NIVEL 9: SOBERANÍA ABSOLUTA & CERO TELEMETRÍA PUBLICITARIA**

- ❌ **Prohibición de SDKs de Publicidad y Rastreo**: Ninguna versión contendrá Google AdMob, Firebase Analytics, trackers ni telemetría externa.
- ❌ **Prohibición de IDs de Redes Publicitarias**: `AndroidManifest.xml` y `capacitor.config.ts` no contendrán metadatos ni IDs publicitarios.
- ✅ **Monetización Soberana Exclusiva**: Financiación y canje mediante minería Proof-of-Relay y vales criptográficos $RED locales.

---

## **NIVEL 10: SEGURIDAD ZERO-TRUST EN APIS & PROTECCIÓN DE BÓVEDAS**

- ❌ **Cero Claves en Texto Claro**: Queda prohibido almacenar PIN maestro, de pánico o señuelo en `localStorage` o `sessionStorage`.
- ❌ **Prohibición de Bypasses Inseguros**: Prohibido eludir autenticación local basándose en cabeceras manipulables (`X-Forwarded-For`).
- ❌ **Prohibición de CORS Permisivo**: Servidores Axum locales deben restringir CORS a orígenes locales autorizados (`capacitor://localhost`, `127.0.0.1:7333`, etc.).
- ✅ **Unificación de Cabeceras**: Cliente y servidores deben utilizar uniformemente `X-API-Key` validada en tiempo constante.
- ❌ **Prohibición de Puertas Traseras**: Cero PINs hardcodeados en código fuente (`password === '9999'`).

---

## **NIVEL 11: INTEGRIDAD DE EMPAQUETADO & COMPILACIÓN ANDROID**

- ❌ **Prohibición de Firma Debug en Release**: Bloque `release` en Gradle no debe referenciar `signingConfigs.debug`.
- ✅ **Protección JNI en R8**: Reglas ProGuard deben proteger explícitamente `-keep class f.red.app.** { *; }`.
- ❌ **Prohibición de Cleartext Global**: `usesCleartextTraffic="true"` debe reemplazarse por permisos acotados en `network_security_config.xml`.

---

## **NIVEL 12: COMPATIBILIDAD MULTIPLATAFORMA DE RADIOS**

- ✅ **BLE Dual Addressing**: Todo motor BLE debe procesar indistintamente direcciones MAC de Android y UUIDs CoreBluetooth de iOS.

---

## **NIVEL 13: VERIFICACIÓN EMPÍRICA DE PRUEBAS**

- ❌ **Prohibición de Tests Cosméticos**: Suites de pruebas deben ejecutar código en runtime y no limitarse a `fs.readFileSync` de strings.

---

## **RESUMIDO: PIPELINE AUTOMATIZADO (PSEUDOCÓDIGO)**

```
ON COMMIT TO FEATURE BRANCH:
  ✅ Pre-commit hooks:
    - Validar estructura archivos
    - Validar path segregation
    - Ejecutar fmt + lint
    - Validar Markdown links
  
  ✅ Push a remote:
    - Trigger GitHub Actions
    - Run linting jobs (Rust + JS)
    - Run security audits
    - Run build (Rust + JS + Android)
    - Run tests with coverage
    - Run SAST (SonarQube)
    - Comment results en PR

ON PULL REQUEST:
  ✅ Require:
    - ✅ All CI checks pass
    - ✅ 2+ code reviews
    - ✅ No merge conflicts
    - ✅ Commit message format valid
    - ✅ Coverage improved or maintained

ON MERGE TO DEVELOP:
  ✅ Auto update CHANGELOG draft
  ✅ Run full test suite (redundant pero safe)

ON MERGE TO MAIN:
  ✅ Trigger semantic-release
  ✅ Auto bump version
  ✅ Generate release notes
  ✅ Create git tag
  ✅ Build release artifacts
  ✅ Upload to release-assets/
  ✅ Generate SBOM
  ✅ Scan with Trivy
  ✅ Deploy to staging (if applicable)
  ✅ Run smoke tests
  ✅ Create GitHub Release
  ✅ Post to changelog

ON RELEASE TAG:

## **NIVEL 11: INTEGRIDAD DE EMPAQUETADO & COMPILACIÃ“N ANDROID**

- âŒ **ProhibiciÃ³n de Firma Debug en Release**: Bloque `release` en Gradle no debe referenciar `signingConfigs.debug`.
- âœ… **ProtecciÃ³n JNI en R8**: Reglas ProGuard deben proteger explÃ­citamente `-keep class f.red.app.** { *; }`.
- âŒ **ProhibiciÃ³n de Cleartext Global**: `usesCleartextTraffic="true"` debe reemplazarse por permisos acotados en `network_security_config.xml`.

---

## **NIVEL 12: COMPATIBILIDAD MULTIPLATAFORMA DE RADIOS**

- âœ… **BLE Dual Addressing**: Todo motor BLE debe procesar indistintamente direcciones MAC de Android y UUIDs CoreBluetooth de iOS.

---

## **NIVEL 13: VERIFICACIÃ“N EMPÃRICA DE PRUEBAS**

- âŒ **ProhibiciÃ³n de Tests CosmÃ©ticos**: Suites de pruebas deben ejecutar cÃ³digo en runtime y no limitarse a `fs.readFileSync` de strings.

---

## **VALIDACIÃ“N FINAL: CHECKLIST POR SPRINT**

- âœ… Todas las branchs se deletean despuÃ©s de merge
- âœ… No hay cÃ³digo muerto o comentarios TODOs sin issue
- âœ… VersiÃ³n sincronizada en TODOS los places
- âœ… No hay `console.log` en producciÃ³n
- âœ… No hay `println!` en producciÃ³n Rust
- âœ… No hay secretos en .env (use GitHub Secrets)
- âœ… Dependencies actualizadas (al menos review semanal)
- âœ… Security advisories resueltas dentro de 48h (critical)
- âœ… ProVerif proofs ejecutadas y passing
- âœ… DocumentaciÃ³n refleja cÃ³digo
- âœ… Cero telemetrÃ­a externa o AdMob en el binario
- âœ… Cero PINs en texto claro en almacenamiento web

---

**ImplementaciÃ³n**: Este ruleset debe ejecutarse automÃ¡ticamente por **Husky** (pre-commit hooks) + **GitHub Actions** (CI/CD). Cero manual intervention = **100% deterministic governance**.

