# GOBERNANZA AUTOMÁTICA Y ESTÁNDARES RED v91.0.0

Este espacio de trabajo se rige estrictamente bajo el documento maestro `GOVERNANCE.md`.

## Directrices Operativas Clave para el Asistente:
1. **Nivel 0 - Path Segregation & Cero Binarios en Raíz**:
   - `core/`: Rust `red_core`.
   - `blockchain/`: Rust `red-blockchain`.
   - `node/`: Rust CLI `red-node`.
   - `red_mobile/`: Rust + JNI `red_mobile`.
   - `client/app/`: Next.js 16 + React 19 + Capacitor.
   - `signaling/`: Servidor de señalización WebRTC.
   - `proofs/`: Modelos formales ProVerif (`.pv`).
   - `specs/`: Especificaciones formales TLA+ (`.tla`).
   - `tests/`: Tests de integración.
   - `docs/`: Documentación técnica markdown.
   - `release-assets/`: Binarios y ejecutables con control Git LFS. NUNCA colocar `.exe`, `.apk`, `.so`, `.dll` en la raíz.

2. **Nivel 1 - Estándares de Código y Calidad**:
   - **Rust**: `cargo fmt`, `cargo clippy -- -D warnings`, cero `unsafe` no justificado/documentado con mínimo 3 líneas explicativas.
   - **TypeScript**: Estricto, cero tipo `any`, cero `console.log` en rutas de producción (solo `console.error`/`console.warn`).

3. **Nivel 2 - SSOT de Protocolo & Cero Duplicación Backend**:
   - **Single Source of Truth**: Todos los modelos de datos, structs de red, DTOs y enums de comunicación P2P (AMBER, SOS, Clima, Canales, Social, Guardian, Audio, Efímeros, Proximidad, Batería, Sanitizador, Chunker, IA Copilot) DEBEN residir exclusivamente en `core/src/protocol/tactical.rs`.
   - **Prohibición de Duplicación**: Queda estrictamente prohibido redefinir structs duplicados en `node/src/` o `red_mobile/src/`. Ambos crates deben re-exportar e importar directamente desde `red_core::protocol::tactical`.
   - **Aislamiento de Plataforma**: `node` conserva su almacenamiento persistente en disco (`sled::Db`) y CLI `main.rs`, mientras que `red_mobile` conserva su almacenamiento liviano en RAM (`RwLock<HashMap>`) y su puente JNI C-ABI intacto.

4. **Nivel 3 - Criptografía Post-Cuántica & Seguridad**:
   - `ML-KEM-768` SIEMPRE en modo híbrido con `X25519`.
   - `AES-256-GCM` con nonces estrictamente monotónicos (nunca reutilizados).
   - Generación de entropía con `ChaCha20Rng` o `OsRng`.
   - Derivación de claves con `HKDF-SHA256` y `Argon2id` (`m_cost >= 65536, t_cost >= 3, parallelism >= 4`).
   - Cifrado total en reposo para Sled DB (`CryptoEngine::encrypt()` / `CryptoEngine::decrypt()`).

5. **Nivel 5 - Versionado Atómico & Pre-Build Hygiene (SSOT)**:
   - **Prohibición de Edición Manual Dispersa**: Queda estrictamente prohibido actualizar manualmente la versión en archivos aislados. Todo incremento o sincronización de versión DEBE ejecutarse mediante `node scripts/bump_version.js <X.Y.Z>`.
   - **Pre-Flight Check Obligatorio**: Antes de compilar cualquier bundle (`next build`, `cap sync`, Gradle APK), ES OBLIGATORIO ejecutar `node scripts/pre_build_check.js` para purgar caché obsoleta y validar 100% de paridad en los 12 archivos SSOT.

6. **Nivel 6 - Automatización CI/CD**:
   - Todos los cambios deben pasar sin excepción los pipelines de `.github/workflows/` (`lint.yml`, `security.yml`, `build.yml`, `test.yml`, `build-android.yml`, `release.yml`).

7. **Nivel 7 - Soberanía y Despliegue Web Determinista (Resiliencia CI/CD)**:
   - **Independencia de Cloud Runners**: Ante retenciones administrativas de cuenta (Billing issues/holds), agotamiento de cuotas de minutos en GitHub Actions o indisponibilidad de la nube, el despliegue del portal web y cliente companion (`https://darckrovert.github.io/RED/`) NUNCA debe detenerse.
   - **Comando Estándar de Despliegue Local Soberano**: Todo despliegue web soberano debe ejecutarse directamente mediante `npm run deploy:gh` en `client/app` o mediante el script `scripts/deploy_gh_pages.ps1` / `scripts/deploy_web.bat`.
   - **Requisitos de Empaquetado Web**: La exportación estática de Next.js DEBE compilarse con `NEXT_PUBLIC_BASE_PATH='/RED'`, generar `out/404.html` (copia de `index.html` para enrutamiento SPA sin servidor) y crear `out/.nojekyll`, publicando directamente en la rama `gh-pages`.

8. **Nivel 8 - Coherencia de Manifiestos Cargo & Grafo de Dependencias Rust**:
   - **Nombre Inmutable de Crates**: El crate de blockchain DEBE mantenerse estrictamente como `name = "red-blockchain"` en `blockchain/Cargo.toml` para coincidir con las declaraciones `red-blockchain = { path = "../blockchain" }` en `core/Cargo.toml`, `node/Cargo.toml` y `red_mobile/Cargo.toml`.
   - **Prohibición de Renombrado Huérfano**: Queda prohibido alterar guiones o guiones bajos (`-` vs `_`) en los paquetes del workspace sin actualizar simétricamente todos los dependientes y comprobar `cargo check --workspace`.
   - **Sincronización de Lockfile**: Cualquier modificación en crates locales debe ser validada contra `Cargo.lock` para garantizar que no existan discrepancias entre las versiones declaradas y bloqueadas.

9. **Nivel 9 - Soberanía Absoluta contra SDKs Centralizados & Cero Telemetría Publicitaria**:
   - **Prohibición Total de AdMob / Trackers**: Queda estrictamente prohibido incorporar SDKs de publicidad o telemetría corporativa (Google AdMob, Firebase Analytics, Facebook SDK, etc.). Todo modelo de sostenimiento debe ser descentralizado y soberano (Proof-of-Relay, vales $RED P2P locales).
   - **Purga de Metadatos**: El manifiesto de Android y la configuración de Capacitor nunca deben incluir IDs de aplicación de redes publicitarias.

10. **Nivel 10 - Seguridad Zero-Trust en APIs Locales & Protección de Bóvedas**:
    - **Cero Claves en Texto Claro**: Queda prohibido almacenar PIN maestro, PIN de pánico o PIN señuelo en texto plano en `localStorage` o `sessionStorage`. La verificación debe usar derivación KDF o permanecer en memoria volátil de sesión.
    - **Prohibición de Bypasses Inseguros**: Queda prohibido omitir la autenticación local basándose en la ausencia de cabeceras HTTP como `X-Forwarded-For`.
    - **Aislamiento de CORS**: El servidor Axum local debe restringir CORS exclusivamente a orígenes locales autorizados (`capacitor://localhost`, `http://127.0.0.1:7333`, `http://localhost:7333`, `https://localhost`), prohibiendo `CorsLayer::permissive()`.
    - **Unificación de Cabeceras**: El frontend y los servidores backend deben sincronizar estrictamente la cabecera `X-API-Key` con el token de sesión.
    - **Cero Puertas Traseras**: Prohibido incluir PINs o contraseñas hardcodeadas en código fuente (ej. `password === '9999'`).

11. **Nivel 11 - Integridad del Proceso de Empaquetado & Firmado de Producción**:
    - **Prohibición de Firma Debug en Release**: Ningún APK o artefacto de release debe compilarse utilizando `signingConfigs.debug`.
    - **Protección JNI en ProGuard/R8**: Las reglas de ProGuard deben conservar explícitamente las interfaces nativas JNI (`-keep class f.red.app.** { *; }`, `-keepclasseswithmembernames class * { native <methods>; }`) permitiendo que R8 optimice sin romper la carga de `libred_mobile.so`.
    - **Tráfico en Texto Claro Acotado**: `android:usesCleartextTraffic="true"` debe erradicarse a nivel de aplicación global; el tráfico sin TLS solo se autoriza en loopback (`127.0.0.1` / `localhost`) mediante `network_security_config.xml`.

12. **Nivel 12 - Compatibilidad Multiplataforma de Radios (iOS CoreBluetooth & Android)**:
    - Todo transporte BLE debe aceptar de forma transparente tanto direcciones MAC físicas (`XX:XX:XX:...`) como identificadores UUID de CoreBluetooth (`[0-9a-fA-F-]{36}`) para no bloquear conexiones en dispositivos Apple.

13. **Nivel 13 - Verificación Empírica de Pruebas (Cero Pruebas Fantasma)**:
    - Las suites de pruebas en `client/app/scripts/` deben ejecutar lógica real en runtime, evitando pruebas que únicamente lean archivos fuente mediante `fs.readFileSync` para verificar presencia de cadenas.



