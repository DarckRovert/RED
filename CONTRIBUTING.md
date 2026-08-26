# Guía de Contribución — RED v64.0.0

Bienvenido al proyecto **RED (Red Criptográfica Off-Grid & P2P Mesh)**. Para mantener la integridad matemática, la seguridad zero-trust y la estabilidad en dispositivos reales, todas las contribuciones deben seguir estas directrices.

---

## 📋 Tabla de Contenidos
1. [Código de Conducta](#1-código-de-conducta)
2. [Entorno de Desarrollo & Requisitos](#2-entorno-de-desarrollo--requisitos)
3. [Estrategia de Ramas & Git Workflow](#3-estrategia-de-ramas--git-workflow)
4. [Convención de Commits (Conventional Commits)](#4-convención-de-commits)
5. [Validaciones Pre-Commit](#5-validaciones-pre-commit)
6. [Estándares de Código (Rust & TypeScript)](#6-estándares-de-código)
7. [Proceso de Pull Request](#7-proceso-de-pull-request)

---

## 1. Código de Conducta
Revisa y respeta [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Este proyecto protege los derechos de privacidad, libertad de expresión y supervivencia de personas en zonas de conflicto y catástrofe.

---

## 2. Entorno de Desarrollo & Requisitos
- **Rust Toolchain:** `1.80.0+` (`rustup update stable`)
- **Node.js:** `v20.x+` con `npm`
- **Android SDK & NDK:** `r26d+` con target `aarch64-linux-android`
- **Git:** `2.40+`

### Configuración Rápida
```bash
# 1. Clonar el repositorio
git clone https://github.com/DarckRovert/RED.git
cd RED

# 2. Compilar el workspace en Rust
cargo build --workspace

# 3. Instalar dependencias del cliente web/móvil
cd client/app
npm ci
cd ../..

# 4. Ejecutar las suites de pruebas completas
cargo test --workspace
cd client/app && npm run test:crypto
```

---

## 3. Estrategia de Ramas & Git Workflow
- `main`: Rama de producción estable. Todo commit en `main` debe compilar en verde y pasar todos los tests.
- `develop`: Rama de integración activa.
- `feature/<nombre-feature>`: Nuevas capacidades o módulos tácticos.
- `fix/<nombre-bug>`: Correcciones de errores o vulnerabilidades.
- `perf/<nombre-mejora>`: Optimizaciones de rendimiento o compresión DSP.
- `docs/<nombre-doc>`: Actualizaciones de manuales o especificaciones.

---

## 4. Convención de Commits

Seguimos estrictamente el formato **Conventional Commits**:

```
<tipo>(<scope>): <descripción concisa en imperativo>

[cuerpo opcional con justificación arquitectónica]

[referencias a issues, ej: Closes #123]
```

### Tipos Permitidos
- `feat`: Nueva funcionalidad de usuario o módulo.
- `fix`: Corrección de bug o error en tiempo de ejecución.
- `docs`: Cambios en documentación, manuales o especificaciones.
- `test`: Adición o refactorización de pruebas unitarias/KAT/integración.
- `refactor`: Refactorización interna sin cambio funcional externo.
- `perf`: Mejoras de latencia, throughput o eficiencia energética.
- `chore`: Tareas de mantenimiento, dependencias o scripts de compilación.
- `ci`: Modificaciones en pipelines de GitHub Actions.

### Scopes Permitidos
`crypto`, `mesh`, `auth`, `ui`, `android`, `ios`, `core`, `blockchain`, `storage`, `api`, `companion`, `governance`.

---

## 5. Validaciones Pre-Commit

Antes de enviar cualquier cambio, los siguientes comandos deben pasar con **cero errores**:

```bash
# Formateo y linter estricto en Rust
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings

# Linter y verificación TypeScript
cd client/app && npm run lint

# Validación de estructura y versiones
bash scripts/validate-structure.sh
bash scripts/validate-version.sh
```

---

## 6. Estándares de Código

### Rust
- **Cero Unsafe Injustificado:** Bloques `unsafe` prohibidos a menos que interactúen con la interfaz FFI de Android JNI y cuenten con documentación explicativa.
- **Manejo de Errores Idiomático:** Prohibido el uso de `.unwrap()` o `.expect()` en código de producción; utiliza `Result<T, RedError>` y propagación con `?`.
- **Zeroize en Memoria:** Toda estructura que contenga secretos criptográficos debe implementar `zeroize::ZeroizeOnDrop`.

### TypeScript / Next.js
- **TypeScript Estricto:** Prohibido el uso de `any` en interfaces públicas y contratos de store.
- **Aislamiento de Logs:** Cero llamadas a `console.log` en producción. Utiliza `console.warn` y `console.error` exclusivamente para fallos excepcionales.
- **Rutas Relativas PWA:** Los assets estáticos deben resolver mediante `process.env.NEXT_PUBLIC_BASE_PATH` para compatibilidad universal con GitHub Pages y Capacitor WebView.

---

## 7. Proceso de Pull Request
1. Abre un issue o discussion antes de realizar refactorizaciones arquitectónicas mayores.
2. Asegúrate de incluir pruebas unitarias o de integración para cualquier nuevo endpoint o algoritmo criptográfico.
3. El PR debe contar con la aprobación del CI/CD (8 workflows en verde) y revisión de código.
