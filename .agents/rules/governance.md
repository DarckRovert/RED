# GOBERNANZA AUTOMÁTICA Y ESTÁNDARES RED v121.0.0

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

4. **Nivel 4 - Manejo de Errores, Observabilidad y Resiliencia**:
   - **Cero Panic en Producción**: En código Rust de `node/` y `red_mobile/`, los errores recuperables DEBEN manejarse con `Result<T, E>`. El uso de `.unwrap()` o `.expect()` sin `// SAFETY:` comentado está prohibido en rutas de código productivo.
   - **Logging Trazable**: Los errores de red, fallos JNI y errores de API deben loguearse con contexto suficiente: módulo, función, causa raíz. Usar `tracing::error!` en Rust y `console.error` (nunca `console.log`) en TypeScript.
   - **Degradación Graceful**: Todo componente de UI que dependa de la API local (`127.0.0.1:7333`) DEBE tener un estado de error visible y recuperable. Prohibido dejar la UI en blanco (white screen of death).

5. **Nivel 5 - Versionado Atómico & Pre-Build Hygiene (SSOT)**:
   - **Prohibición de Edición Manual Dispersa**: Queda estrictamente prohibido actualizar manualmente la versión en archivos aislados. Todo incremento o sincronización de versión DEBE ejecutarse mediante `node scripts/bump_version.js <X.Y.Z>`.
   - **Pre-Flight Check Obligatorio**: Antes de compilar cualquier bundle, ES OBLIGATORIO ejecutar `node scripts/pre_build_check.js`.
   - **Pipeline de APK Obligatorio (3 pasos en orden)**: El script `build:apk` ejecuta SOLO `gradlew`. Omitir los pasos previos bake el bundle JS de la versión anterior en el APK, causando que los dispositivos muestren la versión vieja.
     1. `npm run build` — bake version.ts en el bundle JS (Next.js static export)
     2. `npx cap sync android` — copiar bundle a assets Android WebView
     3. `npm run build:apk` — compilar APK con Gradle

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

14. **Nivel 14 - Estándares de Escalabilidad Planetaria, TDMA LoRa y Repetidores Autónomos**:
    - **Coordinación Espectral Obligatoria**: Toda transmisión a través de radios LoRa sub-GHz (Semtech SX1262 / Meshtastic) DEBE canalizarse a través de `LoRaTdmaSchedulerEngine` para evitar la saturación del canal ALOHA en concentraciones masivas. Únicamente se permite bypass inmediato para ráfagas críticas SOS de salvamento de vida (prioridad >= 9).
    - **Poda Espacial en Enrutamiento DTN**: Queda prohibido el transporte ciego de paquetes transcontinentales en mulas de datos y satélites LEO. Todo paquete encolado para custodia a largo plazo debe indexarse mediante Geohash en `dtnStorage` (IndexedDB v2). Las mulas móviles y satélites deben aplicar poda espacial estricta (`GeohashSpatialRouting.shouldCarrierAcceptPacket`) descartando tráfico fuera de su vector geográfico de desplazamiento.
    - **Estándares de Firmware Embebido (`firmware/esp32-repeater/`)**: Todo firmware para repetidores autónomos ESP32/ESP32-S3 debe operar a frecuencia reducida (80 MHz) para garantizar un consumo en reposo centinela inferior a 12 mA. En placas Heltec WiFi LoRa 32 V3 es mandatorio inicializar explícitamente los pines de bus SPI dedicados (SCK=9, MISO=11, MOSI=10, NSS=8) y configurar el oscilador TCXO a 1.8V para prevenir fallas de detección de radio en arranque frío.

15. **Nivel 15 - OTA Update Engine (Distribución Soberana In-App)**:
    - **Pipeline Canónico por Nombre Exacto**: El `updateManager.ts` DEBE buscar el asset del APK en GitHub Release por nombre canónico exacto (`red-latest.apk`) antes de caer en búsquedas genéricas. Prohibido tomar el primer `.apk` disponible sin verificar nombre.
    - **Verificación SHA-256 Pre-Instalación**: Todo APK descargado vía OTA DEBE verificarse contra `RED_APK_SHA256` de `version.ts` antes de pasar al `PackageInstaller`. Un APK cuyo hash no coincida DEBE rechazarse con error visible al usuario.
    - **Invalidación de Caché Post-Instalación**: Tras instalar exitosamente, `UpdateManager.cachedUpdateInfo` DEBE ponerse a `null` para que el siguiente `checkForUpdates` refleje la versión recién instalada.
    - **Sincronización de `release-assets/red-latest.apk`**: El archivo `release-assets/red-latest.apk` es el que verifica `check_release_integrity.js`. Debe actualizarse junto con `red-latest.apk` en la raíz en cada release.




