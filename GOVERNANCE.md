# 🤖 RULESET AUTÓMATA RED v70.0.0 — FLUJO INTEGRAL DE GOBERNANZA

## **NIVEL 0: PRE-COMMIT (Git Hooks & Validation)**

### Regla 0.1: Validación de Estructura de Archivo
**Antes de cualquier commit:**
- ❌ NO permitir archivos binarios en raíz: `*.exe`, `*.apk`, `*.dll`, `*.so` deben ir a `release-assets/` y usar **Git LFS**
- ❌ NO permitir archivos sin extensión sin shebang válido
- ✅ Permitir SOLO: `.ts`, `.tsx`, `.rs`, `.java`, `.kt`, `.json`, `.md`, `.toml`, `.yml`, `.yaml`
- ✅ Validar que cada archivo tenga encoding UTF-8
- Comando de control: `git lfs track "*.exe" "*.apk" "*.so"` + `.gitattributes` debe existir

### Regla 0.2: Path Segregation Obligatoria
**Estructura permitida sin excepciones:**
```
RED/
├── core/                    # ← SOLO código Rust (red_core)
├── blockchain/              # ← SOLO código Rust (red_blockchain)
├── node/                    # ← SOLO binario CLI Rust
├── red_mobile/              # ← SOLO código Rust + JNI
├── client/app/              # ← SOLO Next.js + React
├── signaling/               # ← SOLO Node.js Express
├── proofs/                  # ← SOLO archivos ProVerif (.pv)
├── specs/                   # ← SOLO archivos TLA+ (.tla)
├── tests/                   # ← Tests integrados
├── docs/                    # ← Documentación (.md)
└── .github/workflows/       # ← CI/CD YAML
```

**Si archivo no pertenece a carpeta categoría → RECHAZAR commit**

### Regla 0.3: Versionado Sincronizado Atómico (SSOT)
**Antes de push a main o compilación:**
- **Ejecución Obligatoria**: Todo cambio de versión DEBE realizarse exclusivamente mediante `node scripts/bump_version.js <X.Y.Z>`.
- Verificar que `client/app/src/lib/version.ts`, `package.json`, `build.gradle`, `sw.js`, `public/sw.js` y los 6 `Cargo.toml` (`raíz`, `core`, `red_mobile`, `node`, `blockchain`, `client`) están en 100% de paridad.
- ❌ RECHAZAR y ABORTAR si existe cualquier discrepancia en los 12 archivos SSOT.

### Regla 0.4: Validación de Dependencias
**Por cada cambio en `package.json`, `Cargo.toml`, o `Cargo.lock`:**
- Ejecutar `npm audit` (permitir SOLO vulns de nivel bajo si no hay fix disponible)
- Ejecutar `cargo audit` en cada crate del workspace
- Generar SBOM (Software Bill of Materials) con `cargo sbom` si disponible
- ❌ RECHAZAR si hay vulnerabilidades críticas o altas sin mitigación documentada

### Regla 0.5: Pre-Flight Build Hygiene
- Antes de ejecutar cualquier compilación (`next build`, `cap sync`, `gradlew`), es MANDATORIO ejecutar `node scripts/pre_build_check.js` para purgar `.next/`, `out/`, `build/` y prevenir artefactos obsoletos o binarios huérfanos en `public/`.


---

## **NIVEL 1: VALIDACIÓN SINTÁCTICA (Pre-Build Checks)**

### Regla 1.1: TypeScript/JavaScript Compliance
**Para todos los `.ts`, `.tsx`, `.js` en `client/app/` y `signaling/`:**
- ✅ `eslint --fix` con config Next.js strict
- ✅ `prettier --write` (Vanilla + React standards)
- ✅ Compilar con `tsc --noEmit --strict`
- ✅ Resolver TODOS los `any` types → reemplazar con tipos explícitos
- ✅ NO permitir `console.log()` en código que va a producción (solo console.error/warn)
- Validar imports: NO ciclos de dependencias

### Regla 1.2: Rust Compliance (Workspace-wide)
**Para TODOS los `.rs` en core/, blockchain/, node/, red_mobile/:**
- ✅ `cargo fmt --check` (formato Rust standard)
- ✅ `cargo clippy --all-targets --all-features -- -D warnings` (NO warnings)
- ✅ Compilar con `cargo check --all-features` antes de full build
- ✅ `cargo audit` para dependencias de seguridad
- ✅ Validar que no hay `unsafe` blocks a menos que sea en módulos específicos documentados (ej: crypto)
- ✅ Si hay `unsafe`, debe tener comentario de 3 líneas explicando PORQUÉ es necesario

### Regla 1.3: Validación de Manifests
**Para `Cargo.toml` en workspace:**
- ✅ Validar sintaxis TOML (no espacios tabs)
- ✅ Todos los `workspace.members` deben existir como directorios
- ✅ Todas las dependencias en `[workspace.dependencies]` deben usarse en algún crate hijo
- ✅ No permitir versiones flotantes (`*` o `>= X.Y`) excepto en dev-dependencies
- ✅ Verificar que `[patch.crates-io]` tiene justificación en comentario

**Para `package.json` en client/app/ y signaling/:**
- ✅ Validar sintaxis JSON
- ✅ `scripts` section debe tener: `build`, `dev`, `lint`
- ✅ `engines.node` debe especificar `>=18.0.0` mínimo
- ✅ Todos los `dependencies` versiones deben ser ≥ "X.Y.Z" nunca `*`

### Regla 1.4: Markdown Documentation Validation
**Para TODOS los `.md` en raíz y docs/:**
- ✅ Validar sintaxis Markdown (no broken links)
- ✅ Verificar que todos los `[links]` apunten a archivos o URLs válidas
- ✅ Validar que bloques de código tienen language specifier (```rust, ```typescript, etc)
- ✅ Verificar que CHANGELOG.md tiene entrada para versión actual
- ✅ README.md debe mencionar: descripción, arquitectura, cómo compilar, licencia

### Regla 1.5: Single Source of Truth (SSOT) de Protocolo & Cero Duplicación
**Para TODOS los modelos y contratos de datos en core/, node/, red_mobile/:**
- ✅ **Centralización Obligatoria**: Todo struct, enum, DTO o mensaje de red P2P (AMBER, SOS, Clima, Canales, Social, Guardian, Audio, Efímeros, Proximidad, Batería, Sanitizador, Chunker, IA Copilot) DEBE residir en `core/src/protocol/tactical.rs`.
- ❌ **Prohibición de Duplicación**: Queda estrictamente prohibido redefinir structs duplicados en `node/src/` o `red_mobile/src/`. Ambos crates deben re-exportar e importar directamente desde `red_core::protocol::tactical`.
- ✅ **Aislamiento de Plataforma**: `node` mantiene su persistencia en disco (`sled::Db`) y CLI, mientras que `red_mobile` mantiene su almacenamiento liviano en RAM (`RwLock<HashMap>`) y su puente JNI C-ABI intacto.

---

## **NIVEL 2: BUILD PIPELINE (Compilación Ordenada)**

### Regla 2.1: Build Secuencia Determinística
**Orden de compilación inmutable:**

1. **Rust Workspace Base**
   ```bash
   cd core && cargo build --release
   cargo test --all
   cd ../blockchain && cargo build --release
   cargo test --all
   cd ../node && cargo build --release
   cd ../red_mobile && cargo build --release
   ```
   - ❌ DETENER si alguno falla
   - ✅ Generar artifacts en `target/release/`

2. **JavaScript/TypeScript (Parallel OK)**
   ```bash
   cd client/app && npm ci && npm run build
   cd ../../signaling && npm ci && npm run build
   ```
   - ❌ DETENER si package-lock.json no existe
   - ✅ Generar artifacts en `.next/`, `dist/`

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
**Después de CADA compilación:**
- ✅ Verificar que binarios/librerías existen y tienen tamaño > 0
- ✅ Para Rust: `file target/release/red-node` debe mostrar "ELF 64-bit" o "PE executable"
- ✅ Para JavaScript: `dist/` debe contener `*.js` y `*.d.ts`
- ✅ Para APK: Verificar que existe y es firmado (si es release)
- ✅ Generar checksums SHA256: `sha256sum artifact > SHA256SUMS.txt`

### Regla 2.3: Test Execution Mandatory
**Por cada compilación exitosa:**
- ✅ `cargo test --workspace` (Rust tests)
- ✅ `npm run test` en client/app/ si existe jest.config.js
- ✅ `npm run test` en signaling/ si existe
- ✅ Verificar coverage > 70% para código crítico (cryptography, auth, mesh)
- ❌ RECHAZAR build si algún test falla
- ✅ Generar coverage report: `coverage/lcov.info`

---

## **NIVEL 3: SEGURIDAD & CRIPTOGRAFÍA (Critical Layer)**

### Regla 3.1: Post-Quantum Crypto Validation
**Para TODOS los archivos que usen crypto (core/src/crypto.rs, etc):**
- ✅ Verificar que `ml-kem-768` se usa SIEMPRE en par con X25519
- ✅ Validar que `AES-256-GCM` nunca reutiliza nonces (contador monotónico)
- ✅ Validar que random secrets usan `ChaCha20Rng` o OSRng, NUNCA arrays hardcodeados
- ✅ Verifying que claves maestras se derivan con `HKDF-SHA256` nunca `SHA256` simple
- ✅ Para `Argon2id`: parámetros deben ser: `m_cost >= 65536, t_cost >= 3, parallelism >= 4`

### Regla 3.2: Storage Encryption Validation
**Para acceso a Sled DB:**
- ✅ TODAS las writes a Sled deben pasar por `CryptoEngine::encrypt()`
- ✅ TODAS las reads de Sled deben pasar por `CryptoEngine::decrypt()`
- ✅ Ningún dato en plain text puede ser persistido
- ✅ Claves de cifrado deben rotarse con `rotate_key()` cada 90 días (detectar en tests)
- ✅ Verificar que `master_pin` NUNCA se almacena, solo derivación

### Regla 3.3: Biometric Authentication Flow
**Para Android BiometricPrompt y WebAuthn (client/app/auth/bioauth.ts):**
- ✅ Flujo: BiometricPrompt → Success → Retrieve PIN from KeyStore → Derive Key → Open Vault
- ✅ NUNCA almacenar PIN directamente en LocalStorage
- ✅ Android: Usar `USE_BIOMETRIC + USE_FINGERPRINT` flags
- ✅ Web: Usar `navigator.credentials.get()` solo (NUNCA `create()` durante auth)
- ✅ Decoy PIN path: PIN erróneo → abre `decoy_vault` (no falla, engaña)
- ✅ Panic PIN path: PIN especial → destruye todas las claves (ATOMIC operation)

### Regla 3.4: Formal Proof Validation
**Para cambios en proofs/ (ProVerif files):**
- ✅ Ejecutar `proverif proofs/security_model.pv` después de cualquier cambio crypto
- ✅ Verificar que output contiene: `Query ... is true.` (no `false.`)
- ✅ Si ProVerif encuentra ataque: ❌ RECHAZAR commit hasta que se arregle
- ✅ Generar `attack.txt` si vulnerabilidad encontrada
- ✅ Documentar cambio en `ARCHITECTURE.md` sección 2

---

## **NIVEL 4: INTEGRATION & NETWORK (Multi-Layer Communication)**

### Regla 4.1: IPC Bridge Validation
**Para Capacitor + JNI Bridge (client/app → red_mobile):**
- ✅ TODOS los `bridge.invoke()` calls en TypeScript deben tener handler correspondiente en RedNodePlugin.java
- ✅ Parámetros JSON deben validarse contra TypeScript interfaces
- ✅ NUNCA pasar datos sensibles (passwords, keys) por bridge sin encriptación
- ✅ Timeout máximo: 5 segundos por IPC call (configurado en RedNodeService)
- ✅ Error handling: TODOS los calls deben tener `.catch()` explícito

### Regla 4.2: Axum Server Validation
**Para servidor local (core/src/server.rs):**
- ✅ BIND OBLIGATORIO: `127.0.0.1:7333` NUNCA `0.0.0.0`
- ✅ TODOS los endpoints deben validar header `X-API-Key` (middleware auth)
- ✅ Rutas disponibles (verifcar que existe cada ruta):
  - `POST /api/messages` (enviar mensaje)
  - `GET /api/events` (SSE stream)
  - `GET /api/contacts` (listar contactos)
  - `POST /api/vault` (unlock request)
- ✅ Response timeout: 30 segundos máximo
- ✅ Request body size limit: 10 MB máximo
- ✅ CORS: DISABLED (loopback-only, no cors needed)

### Regla 4.3: Mesh Networking Validation
**Para enrutamiento P2P (core/src/mesh.rs):**
- ✅ Protocolo Gossipsub: TODOS los mensajes deben tener:
  - Topic (ej: `/red/chat`, `/red/social`)
  - Message ID único (hash del contenido + timestamp)
  - TTL (Time-to-Live): 64 hops máximo
- ✅ Multi-transport routing (seleccionar mejor según disponibilidad):
  - BLE (< 10m): Usar si ambos nodos tienen BLE
  - WiFi Direct (< 100m): Fallback si BLE no disponible
  - LoRa (< 15km): Fallback si WiFi no disponible
  - SoundMesh (radio-blocked): Fallback si todas las anteriores fallan
  - Internet (WAN): Usar solo si todos los anteriores fallan
- ✅ ACK protocol: TODOS los paquetes deben recibir DELIVERY_ACK dentro de 10 segundos
- ✅ Store-and-Forward: Mensajes fallidos se guardan localmente 48 horas max

### Regla 4.4: WebRTC Signaling Validation
**Para servidor de señalización (signaling/server.js):**
- ✅ NUNCA inspeccionar, registrar o cachear contenido de SDP/ICE
- ✅ Validar que JSON que llega es SDP o ICE válido (estructura correcta)
- ✅ Timeout de sesión: 30 minutos inactividad → desconectar
- ✅ Rate limiting: 10 signaling messages por segundo por cliente
- ✅ Error responses deben ser genéricos (no revelar causas específicas)

---

## **NIVEL 5: DATA INTEGRITY & FORENSICS**

### Regla 5.1: Merkle Tree Validation
**Para state integrity (core/src/merkle.rs):**
- ✅ TODOS los cambios a storage deben actualizar raíz Merkle
- ✅ Cada node debe verificar `merkle_verify()` antes de aplicar cambio remoto
- ✅ Si verificación falla → RECHAZAR paquete + LOG incident
- ✅ Generar `merkle_proof` para auditoría

### Regla 5.2: Message Integrity
**Para TODOS los mensajes en tránsito (core/src/crypto.rs):**
- ✅ Estructura obligatoria:
  ```json
  {
    "id": "sha256(content + timestamp)",
    "content": "AES-256-GCM(plaintext, aad=metadata)",
    "aad": {"sender":"did:red:...", "recipient":"did:red:...", "timestamp": 123456},
    "delivery_ack": "signature(id, nonce)"
  }
  ```
- ✅ Validar `id` matches hash de payload
- ✅ Validar `delivery_ack` signature con sender public key
- ✅ Rechazar si timestamp > 1 hora en el pasado

### Regla 5.3: Audit Logging
**Para TODOS los eventos sensibles:**
- ✅ Login attempts (success + failure)
- ✅ Vault unlock/lock
- ✅ Message send/receive
- ✅ Contact add/remove
- ✅ Key rotation
- ✅ Formato: JSON con timestamp, user_id (anónimo), action, result
- ✅ Almacenar en archivo immutable (Sled con flag `no_overwrite`)
- ✅ Rotar logs cada 7 días, máximo 12 meses de historia

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
- ✅ TODOS los checks en verde (lint, security, build, test)
- ✅ Code review aprobado por 2+ contributors
- ✅ Cambios en `core/` o `blockchain/` requieren crypto expert approval
- ✅ Commit message debe seguir formato `type(scope): description`
  - type: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`
  - scope: `crypto`, `auth`, `mesh`, `ui`, etc.
  - Ejemplo: `feat(crypto): add key rotation for AES`
- ✅ Branch naming: `feature/description`, `fix/description`, `docs/description`

### Regla 6.3: Release Management
**Triggers a versionado + deployment:**
- ✅ Versión automática = `X.Y.Z` (semántica)
- ✅ CHANGELOG.md actualizado automáticamente
- ✅ Git tags: `v64.0.0` apuntando a commit
- ✅ Release artifacts generados:
  - `red-node` (Linux/Windows/macOS)
  - `app-release.apk` (Android)
  - `SHA256SUMS.txt` (checksums)
  - SBOM (Software Bill of Materials)
- ✅ Generar release notes automáticas del CHANGELOG

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

- ✅ Scan imágenes con Trivy: `trivy image darckrovert/red-node:latest`
- ✅ NO hardcode secrets en imagen
- ✅ Usar multi-stage builds para minimizar size

### Regla 7.2: Android APK Validation
**Antes de publicar en Play Store:**
- ✅ Verificar firma: `jarsigner -verify -verbose app-release.apk`
- ✅ Scan con MobSF (Mobile Security Framework)
- ✅ Test en Android 12+ emulator: instalación, flujo auth, envío mensaje
- ✅ Verificar permisos solicitados (BiometricPrompt, BLE, GPS, etc.)

### Regla 7.3: Runtime Security Checks
**En startup de aplicación:**
- ✅ Verificar integridad de binary (checksum)
- ✅ Verificar que Sled DB puede abrirse (no corrupted)
- ✅ Verificar que certificados TLS son válidos (si aplica)
- ✅ Verificar que proceso se ejecuta con permisos correctos (NO root si no necesario)
- ✅ Inicializar logging (no revelar paths ni IPs internas)

---

## **NIVEL 8: DOCUMENTATION & COMPLIANCE**

### Regla 8.1: Documentation Requirements
**ARCHIVOS OBLIGATORIOS:**
- ✅ `README.md` (actualizado en cada version)
- ✅ `ARCHITECTURE.md` (sincronizado con código)
- ✅ `CHANGELOG.md` (entrada por cada commit a main)
- ✅ `USER_MANUAL.md` (actualizado con nuevos features)
- ✅ `ADMIN_MANUAL.md` (instrucciones deployment)
- ✅ `CONTRIBUTING.md` (cómo contribuir, style guide)
- ✅ `SECURITY.md` (cómo reportar vulnerabilidades, no público)
- ✅ `LICENSE` (AGPL-3.0)
- ✅ `CODE_OF_CONDUCT.md`

### Regla 8.2: API Documentation
**Para TODOS los endpoints Axum:**
- ✅ Generar OpenAPI/Swagger spec
- ✅ Documentar: método, path, params, request body, response, errors
- ✅ Ejemplo para `POST /api/messages`:
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
**Para release a producción:**
- ✅ GDPR: No almacenar datos personales sin consentimiento
- ✅ License compliance: Todos los deps tienen compatible licenses
- ✅ Accessibility: WCAG 2.1 AA para UI web
- ✅ Security: Zero critical/high vulns en dependencies
- ✅ Performance: API response time < 500ms (p95)
- ✅ Availability: Uptime >= 99.5% (si es servicio)

---

## **NIVEL 9: MONITORING & OBSERVABILITY**

### Regla 9.1: Logging Strategy
**Niveles y uso:**
- `ERROR`: Fallos que impiden operación (auth failed, DB error, crypto error)
- `WARN`: Condiciones anómalas pero manejables (slow network, missing device)
- `INFO`: Eventos importantes (user login, message sent, connection established)
- `DEBUG`: Detalles de ejecución (sent X bytes, received ACK from Y)
- `TRACE`: Datos muy verbosos (cada operación criptográfica)

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
**Basado en métricas, disparar alertas si:**
- Error rate > 1% en última hora
- Latencia p99 > 5 segundos
- Storage > 80% capacity
- Menos de 2 peers conectados en malla
- Batería < 10%
- ProVerif prueba FALLA

---

## **NIVEL 10: VERSIONING & RELEASE CYCLE**

### Regla 10.1: Semantic Versioning
**Format: `MAJOR.MINOR.PATCH`**
- **MAJOR**: Breaking changes (Cargo version bump, new crate required)
- **MINOR**: New features (new module, new encryption algo)
- **PATCH**: Bug fixes, security patches

**Regla**: TODOS los Cargo.toml deben sincronizar versión. Si alguno diverge → CI falla.

### Regla 10.2: Release Branch Strategy
```
main (stable)
  ↑
  ├─ release/v64.0.0 (release candidate)
  │   ↑
  │   └─ develop (integration branch)
  │       ↑
  │       └─ feature/*, fix/*, docs/* (developer branches)
```

- **main**: Solo tags y hotfixes, CI/CD corre completo
- **develop**: Integration branch, CI/CD sin deploy
- **feature/**: Del developer, merge → develop after review

### Regla 10.3: Release Checklist
**Antes de crear tag `vX.Y.Z` en main:**
- ✅ Versión actualizada en Cargo.toml (workspace + crates)
- ✅ Versión actualizada en package.json
- ✅ CHANGELOG.md tiene sección `## [X.Y.Z] - YYYY-MM-DD`
- ✅ README.md menciona versión actual
- ✅ ARCHITECTURE.md sincronizado con cambios
- ✅ TODO CI/CD jobs verdes
- ✅ Security scan: zero critical vulns
- ✅ Code coverage >= 70%
- ✅ ProVerif proofs passed
- ✅ Release notes generadas
- ✅ Binarios compilados y checksummed
- ✅ Git tag creado: `git tag -s v64.0.0 -m "Release 64.0.0"`
- ✅ Tag pusheado: `git push origin v64.0.0`

---

## **NIVEL 11: INCIDENT RESPONSE & ROLLBACK**

### Regla 11.1: Critical Bug Procedure
**Si bug crítico en main:**
1. Crear branch `hotfix/issue-name` desde main
2. Hacer fix mínimal (NO refactors)
3. Bump PATCH version (63.0.X → 63.0.X+1)
4. Update CHANGELOG.md con entrada `Security` o `Hotfix`
5. PR review por 2+ core maintainers
6. Merge a main y develop
7. Tag and release

### Regla 11.2: Rollback Procedure
**Si release X tiene problema:**
1. Revert tag: `git push -d origin vX.Y.Z`
2. Revert commits: `git revert -n HEAD~N..HEAD` (N = número de commits)
3. Crear release `X.Y.Z-rollback`
4. CI/CD valida versión anterior

### Regla 11.3: Security Incident
**Si vulnerabilidad descubierta:**
1. NO publicar detalles públicamente
2. Crear private security advisory en GitHub
3. Fix en rama privada `security/cve-XXXX`
4. Audit por security expert
5. Patch release (X.Y.Z+1)
6. Publicar advisory con créditos

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
  ✅ Docker build & push
  ✅ Update website/docs
  ✅ Notify community
  ✅ Archive old releases (keep 5 latest)
```

---

## **VALIDACIÓN FINAL: CHECKLIST POR SPRINT**

- ✅ Todas las branchs se deletean después de merge
- ✅ No hay código muerto o comentarios TODOs sin issue
- ✅ Versión sincronizada en TODOS los places
- ✅ No hay `console.log` en producción
- ✅ No hay `println!` en producción Rust
- ✅ No hay secretos en .env (use GitHub Secrets)
- ✅ Dependencies actualizadas (al menos review semanal)
- ✅ Security advisories resueltas dentro de 48h (critical)
- ✅ ProVerif proofs ejecutadas y passing
- ✅ Documentación refleja código

---

**Implementación**: Este ruleset debe ejecutarse automáticamente por **Husky** (pre-commit hooks) + **GitHub Actions** (CI/CD). Cero manual intervention = **100% deterministic governance**.
