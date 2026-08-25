# Guía de Contribución - RED v63.0.0

Gracias por tu interés en contribuir a RED. Esta guía describe el proceso de desarrollo, estándares de código y cómo enviar cambios.

## Antes de Empezar

1. **Revisa Issues Existentes**: Verifica que tu idea/problema no está duplicado en [Issues](https://github.com/DarckRovert/RED/issues)
2. **Discute Cambios Mayores**: Para cambios significativos en criptografía o arquitectura, abre una [Discussion](https://github.com/DarckRovert/RED/discussions) primero
3. **Sigue Nuestro Código de Conducta**: Lee [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Setup de Desarrollo

### Requisitos
- **Rust**: 1.80+ (instalación: https://rustup.rs/)
- **Node.js**: 18.x+ (instalación: https://nodejs.org/)
- **Java**: 11+ (para Android, opcional)
- **Git**: 2.40+

### Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/DarckRovert/RED.git
cd RED

# Rust setup
rustup update stable
cargo build --workspace

# JavaScript setup
cd client/app
npm ci
npm run build
cd ../..

# Instalar pre-commit hooks
npm install husky --save-dev
npx husky install
```

## Flujo de Trabajo (Git)

### 1. Crear Rama
```bash
# Desde main/develop
git checkout develop
git pull origin develop

# Crear rama feature
git checkout -b feature/descripcion-clara

# O bugfix
git checkout -b fix/descripcion-clara
```

**Convención de nombres:**
- `feature/` - Nueva funcionalidad
- `fix/` - Bug fix
- `docs/` - Documentación
- `refactor/` - Refactor sin cambios funcionales
- `chore/` - Tareas mantenimiento (deps, config)

### 2. Hacer Cambios

**Estructura de commits:**
```
feat(scope): descripción clara

Descripción detallada si es necesario.
Referencia issue si existe: fixes #123
```

**Tipos permitidos:**
- `feat`: Nueva funcionalidad
- `fix`: Corrección de bug
- `docs`: Cambios documentación
- `test`: Agregar/modificar tests
- `refactor`: Refactor código
- `chore`: Actualizar deps, config

### 3. Validaciones Automáticas

**ANTES de push:** El hook pre-commit valida automáticamente:
```bash
✅ Rust: fmt + clippy
✅ TypeScript: eslint + prettier
✅ Versiones sincronizadas
✅ Estructura del proyecto
✅ No binarios en raíz
✅ Documentación válida
```

Si falla alguno:
```bash
# Rust
cargo fmt --all
cargo clippy --fix --allow-dirty

# TypeScript
npm run lint -- --fix

# Manual fixes, luego:
git add .
git commit -m "..."
```

### 4. Push y Pull Request

```bash
# Push a remoto
git push origin feature/descripcion

# Crear PR en GitHub
# Link a issue: "fixes #123"
# Describe cambios y por qué
```

**PR debe tener:**
- ✅ Descripción clara de cambios
- ✅ Reference a issue (`fixes #123`)
- ✅ Checklist completado
- ✅ Screenshots (si UI change)
- ✅ Changelog entry (en CHANGELOG.md)

## Estándares de Código

### Rust
```rust
// ✅ BUENO
pub fn encrypt_message(plaintext: &str, key: &[u8; 32]) -> Result<Vec<u8>> {
    // Documentación clara
    validate_input(plaintext)?;
    let ciphertext = cipher.encrypt(plaintext, key)?;
    Ok(ciphertext)
}

// ❌ MAL
fn encrypt(pt: &str, k: &[u8; 32]) -> Result<Vec<u8>> {
    cipher.encrypt(pt, k)
}
```

**Reglas:**
- Format: `cargo fmt --all`
- Linting: `cargo clippy --all -- -D warnings`
- Naming: snake_case para functions, UPPER_CASE para constants
- Comments: Explicar el "por qué", no el "qué"
- Unsafe: SOLO si necesario + comentario de 3 líneas

### TypeScript/JavaScript
```typescript
// ✅ BUENO
export interface MessagePayload {
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: number;
}

export async function sendMessage(payload: MessagePayload): Promise<void> {
  validatePayload(payload);
  const encrypted = await encryptPayload(payload);
  await postToServer(encrypted);
}

// ❌ MAL
export const sendMsg = (p: any) => {
  return encrypt(p).then(e => fetch('/api/msg', { body: e }));
};
```

**Reglas:**
- Format: `prettier --write`
- Linting: `eslint --fix`
- Types: NUNCA `any`, siempre tipos explícitos
- Console: SOLO `console.error()`, `console.warn()`
- Async/await: Preferir sobre `.then()`

## Testing

### Rust
```bash
# Tests unitarios
cargo test --lib

# Tests integración
cargo test --test '*'

# Cobertura
cargo tarpaulin --out Html
```

### TypeScript
```bash
cd client/app
npm run test:crypto
```

**Requisitos:**
- Coverage >= 70% para código crítico
- TODOS los tests en verde antes de PR
- Agregar tests para nuevo código

## Documentación

### Changelog
**Archivo:** `CHANGELOG.md`

Agregar entrada en la sección `## [Unreleased]`:
```markdown
### Added
- Nueva feature X

### Fixed
- Bug en componente Y

### Security
- Parche de seguridad Z
```

### Comentarios de Código
```rust
// ✅ BUENO: Explica por qué, no qué
// Usamos Argon2id con estos parámetros para resistir ataques
// GPU/ASIC según OWASP 2021 guidelines
const ARGON2_M_COST: u32 = 65536;

// ❌ MAL
const ARGON2_M_COST: u32 = 65536; // m_cost
```

## Proceso de Review

1. **Automático (CI/CD)**
   - Tests pasan ✅
   - Linting pasa ✅
   - Coverage sube o mantiene ✅
   - Versiones sincronizadas ✅
   - ProVerif proofs pasan (si crypto) ✅

2. **Manual (Humans)**
   - 2+ reviews requeridos
   - Crypto changes: Expert review obligatorio
   - Merge solo después de ✅ todo

3. **Merge**
   - Squash or rebase (configurable)
   - Delete rama después

## Reporte de Bugs

1. **Revisa issues** existentes
2. **Crea issue** con:
   - Título claro
   - Versión afectada
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Logs/screenshots si aplica

## Reporte de Seguridad

⚠️ **NO reportes vulns públicamente**

Lee [SECURITY.md](SECURITY.md) para instrucciones confidenciales.

## Preguntas?

- **Documentación:** [ARCHITECTURE.md](ARCHITECTURE.md), [USER_MANUAL.md](USER_MANUAL.md)
- **Discussions:** [GitHub Discussions](https://github.com/DarckRovert/RED/discussions)
- **Slack/Discord:** Comunidad RED

---

**¡Gracias por contribuir a RED! 🚀**
