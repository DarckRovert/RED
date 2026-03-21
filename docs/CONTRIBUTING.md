# 🤝 Guía de Contribución - RED

¡Gracias por tu interés en contribuir a RED! Este documento te guiará a través del proceso.

---

## 🎯 Código de Conducta

Al participar en este proyecto, aceptas seguir nuestro [Código de Conducta](../CODE_OF_CONDUCT.md). Esperamos que todos los contribuidores:

- Sean respetuosos y considerados
- Acepten críticas constructivas
- Se enfoquen en lo mejor para la comunidad
- Muestren empatía hacia otros miembros

---

## 🚀 Cómo Contribuir

### 1. Reportar Bugs

Si encuentras un bug, por favor crea un issue con:

```markdown
## Descripción del Bug
[Descripción clara y concisa]

## Pasos para Reproducir
1. Ir a '...'
2. Hacer click en '...'
3. Ver error

## Comportamiento Esperado
[Qué debería pasar]

## Comportamiento Actual
[Qué pasa realmente]

## Entorno
- OS: [ej. Windows 11]
- Versión de RED: [ej. 0.1.0]
- Versión de Rust: [ej. 1.70.0]

## Logs/Screenshots
[Si aplica]
```

### 2. Sugerir Mejoras

Para nuevas funcionalidades:

```markdown
## Resumen
[Descripción breve de la mejora]

## Motivación
[¿Por qué es necesaria esta mejora?]

## Propuesta de Solución
[Cómo implementarías esta mejora]

## Alternativas Consideradas
[Otras opciones que consideraste]
```

### 3. Contribuir Código

#### Configurar Entorno de Desarrollo

```bash
# 1. Fork del repositorio en GitHub

# 2. Clonar tu fork
git clone https://github.com/TU_USUARIO/red.git
cd red

# 3. Agregar upstream
git remote add upstream https://github.com/DarckRovert/RED.git

# 4. Instalar dependencias de desarrollo
cargo build
cargo test

# 5. Instalar herramientas de desarrollo
rustup component add clippy rustfmt
cargo install cargo-audit cargo-tarpaulin
```

#### Flujo de Trabajo

```bash
# 1. Crear rama para tu feature/fix
git checkout -b feature/mi-nueva-funcionalidad

# 2. Hacer cambios y commits
git add .
git commit -m "feat: agregar nueva funcionalidad X"

# 3. Mantener actualizado con upstream
git fetch upstream
git rebase upstream/main

# 4. Push a tu fork
git push origin feature/mi-nueva-funcionalidad

# 5. Crear Pull Request en GitHub
```

---

## 📝 Estándares de Código

### Estilo de Código Rust

Usamos `rustfmt` con configuración estándar:

```bash
# Formatear código
cargo fmt

# Verificar formato
cargo fmt -- --check
```

### Linting

```bash
# Ejecutar clippy
cargo clippy -- -D warnings

# Clippy con todas las features
cargo clippy --all-features -- -D warnings
```

### Convenciones de Nombrado

```rust
// Structs: PascalCase
pub struct MessageHeader { ... }

// Funciones y métodos: snake_case
pub fn encrypt_message(data: &[u8]) -> Result<Vec<u8>> { ... }

// Constantes: SCREAMING_SNAKE_CASE
const MAX_MESSAGE_SIZE: usize = 65536;

// Módulos: snake_case
mod crypto_utils;

// Traits: PascalCase
pub trait Encryptable { ... }
```

### Documentación

Todo código público debe estar documentado:

```rust
/// Cifra un mensaje usando ChaCha20-Poly1305.
///
/// # Arguments
///
/// * `key` - Clave de 256 bits para cifrado
/// * `plaintext` - Datos a cifrar
///
/// # Returns
///
/// Vector con nonce (12 bytes) + ciphertext + tag (16 bytes)
///
/// # Errors
///
/// Retorna `CryptoError` si el cifrado falla
///
/// # Example
///
/// ```rust
/// use red_core::crypto::encrypt;
///
/// let key = [0u8; 32];
/// let plaintext = b"Hello, World!";
/// let ciphertext = encrypt(&key, plaintext)?;
/// ```
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    // ...
}
```

---

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
cargo test --all

# Tests de un módulo específico
cargo test --package red-core --lib crypto

# Tests con output
cargo test -- --nocapture

# Tests de integración
cargo test --test integration
```

### Escribir Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = [0u8; 32];
        let plaintext = b"Hello, World!";
        
        let ciphertext = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &ciphertext).unwrap();
        
        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_encrypt_with_invalid_key() {
        let key = [0u8; 16]; // Clave inválida (muy corta)
        let plaintext = b"Hello";
        
        let result = encrypt(&key, plaintext);
        assert!(result.is_err());
    }

    #[test]
    #[should_panic(expected = "key must be 32 bytes")]
    fn test_encrypt_panics_on_wrong_key_size() {
        // ...
    }
}
```

### Cobertura de Tests

```bash
# Generar reporte de cobertura
cargo tarpaulin --out Html

# Ver reporte
open tarpaulin-report.html
```

**Objetivo**: Mínimo 80% de cobertura para código nuevo.

---

## 💬 Convenciones de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<alcance>): <descripción>

[cuerpo opcional]

[footer opcional]
```

### Tipos de Commit

| Tipo | Descripción |
|------|-------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Cambios en documentación |
| `style` | Formato, sin cambios de código |
| `refactor` | Refactorización de código |
| `perf` | Mejoras de rendimiento |
| `test` | Agregar o modificar tests |
| `chore` | Tareas de mantenimiento |
| `security` | Mejoras de seguridad |

### Ejemplos

```bash
# Nueva funcionalidad
git commit -m "feat(crypto): agregar soporte para claves post-cuánticas"

# Corrección de bug
git commit -m "fix(network): corregir timeout en conexión P2P"

# Documentación
git commit -m "docs(api): actualizar ejemplos de uso de Identity"

# Seguridad
git commit -m "security(ratchet): borrar claves de memoria después de uso"
```

---

## 🔀 Pull Requests

### Checklist antes de crear PR

- [ ] Código formateado con `cargo fmt`
- [ ] Sin warnings de `cargo clippy`
- [ ] Tests pasan: `cargo test --all`
- [ ] Documentación actualizada
- [ ] CHANGELOG actualizado (si aplica)
- [ ] Commits siguen convenciones

### Plantilla de PR

```markdown
## Descripción
[Descripción clara de los cambios]

## Tipo de Cambio
- [ ] Bug fix
- [ ] Nueva funcionalidad
- [ ] Breaking change
- [ ] Documentación

## ¿Cómo se ha probado?
[Describe las pruebas realizadas]

## Checklist
- [ ] Mi código sigue las guías de estilo
- [ ] He revisado mi propio código
- [ ] He comentado código complejo
- [ ] He actualizado la documentación
- [ ] Mis cambios no generan warnings
- [ ] He agregado tests
- [ ] Tests nuevos y existentes pasan
```

### Proceso de Revisión

1. **Revisión automática**: CI verifica formato, linting, tests
2. **Revisión de código**: Al menos 1 maintainer debe aprobar
3. **Revisión de seguridad**: Para cambios en crypto/network
4. **Merge**: Squash and merge a main

---

## 🏗️ Áreas de Contribución

### 🔐 Criptografía (Prioridad Alta)

- Revisión de implementaciones criptográficas
- Mejoras en Double Ratchet
- Implementación de criptografía post-cuántica
- Optimizaciones de rendimiento

**Requisitos**: Experiencia en criptografía aplicada

### 🌐 Networking (Prioridad Alta)

- Mejoras en onion routing
- Optimización de gossip protocol
- Implementación de NAT traversal
- Resistencia a ataques de red

**Requisitos**: Experiencia en redes P2P

### 📱 Clientes (Prioridad Media)

- Cliente móvil (Flutter)
- Cliente desktop (Tauri)
- Cliente web (WASM)
- Mejoras en CLI

**Requisitos**: Experiencia en desarrollo de aplicaciones

### 📝 Documentación (Prioridad Media)

- Traducciones
- Tutoriales
- Ejemplos de código
- Diagramas y visualizaciones

**Requisitos**: Buena comunicación escrita

### 🧪 Testing (Prioridad Media)

- Tests de integración
- Fuzzing
- Benchmarks
- Tests de seguridad

**Requisitos**: Experiencia en QA/testing

---

## 🏆 Reconocimiento

Todos los contribuidores serán reconocidos en:

- Archivo CONTRIBUTORS.md
- Página de créditos en la web
- Release notes

---

## ❓ Preguntas

¿Tienes preguntas? Contáctanos:

- **X / Twitter**: https://x.com/DarckRovert
- **GitHub Discussions**: https://github.com/DarckRovert/RED/discussions
- **Email**: darckrovert@gmail.com

---

<p align="center">
  ¡Gracias por contribuir a RED! 🔴
</p>
