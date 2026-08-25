# GOBERNANZA AUTOMÁTICA Y ESTÁNDARES RED v63.0.0

Este espacio de trabajo se rige estrictamente bajo el documento maestro `GOVERNANCE.md`.

## Directrices Operativas Clave para el Asistente:
1. **Nivel 0 - Path Segregation & Cero Binarios en Raíz**:
   - `core/`: Rust `red_core`.
   - `blockchain/`: Rust `red_blockchain`.
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

3. **Nivel 3 - Criptografía Post-Cuántica & Seguridad**:
   - `ML-KEM-768` SIEMPRE en modo híbrido con `X25519`.
   - `AES-256-GCM` con nonces estrictamente monotónicos (nunca reutilizados).
   - Generación de entropía con `ChaCha20Rng` o `OsRng`.
   - Derivación de claves con `HKDF-SHA256` y `Argon2id` (`m_cost >= 65536, t_cost >= 3, parallelism >= 4`).
   - Cifrado total en reposo para Sled DB (`CryptoEngine::encrypt()` / `CryptoEngine::decrypt()`).

4. **Nivel 6 - Automatización CI/CD**:
   - Todos los cambios deben pasar sin excepción los pipelines de `.github/workflows/` (`lint.yml`, `security.yml`, `build.yml`, `test.yml`, `proverif.yml`, `release.yml`).
