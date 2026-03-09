# 🚀 Guía de Inicio Rápido - RED

> Empieza a usar RED en menos de 5 minutos

---

## Requisitos Previos

### Sistema Operativo
- **Windows** 10/11 (x64)
- **macOS** 12+ (Intel/Apple Silicon)
- **Linux** (Ubuntu 20.04+, Debian 11+, Fedora 35+)

### Software Necesario
- **Rust** 1.70 o superior
- **Git** 2.30 o superior
- **OpenSSL** 1.1+ (Linux/macOS)

### Verificar Instalación

```bash
# Verificar Rust
rustc --version
# Esperado: rustc 1.70.0 o superior

# Verificar Cargo
cargo --version
# Esperado: cargo 1.70.0 o superior

# Verificar Git
git --version
# Esperado: git version 2.30.0 o superior
```

---

## Instalación

### Opción 1: Desde Código Fuente (Recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/DarckRovert/RED.git
cd red

# 2. Compilar en modo release
cargo build --release

# 3. Verificar la compilación
cargo test --all

# 4. Instalar binarios (opcional)
cargo install --path client
cargo install --path node
```

### Opción 2: Binarios Pre-compilados

```bash
# Windows (PowerShell)
irm https://raw.githubusercontent.com/DarckRovert/RED/main/install.ps1 | iex

# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/DarckRovert/RED/main/install.sh | bash
```

### Opción 3: Docker

```bash
# Descargar imagen
docker pull rednetwork/red:latest

# Ejecutar cliente interactivo
docker run -it rednetwork/red:latest red-cli
```

---

## Tu Primera Identidad

### 1. Generar Identidad

```bash
# Crear nueva identidad anónima
red identity new
```

**Salida esperada:**
```
🔐 Generando identidad...

✅ Identidad creada exitosamente

📍 Tu ID público: red_7x8k2m9p4q3r5t6y8u9i0o...
🔑 Clave pública: a1b2c3d4e5f6...

⚠️  IMPORTANTE: Guarda tu frase de recuperación en un lugar seguro:

    1. ocean    2. tiger    3. mountain    4. river
    5. sunset   6. crystal  7. thunder    8. forest
    9. diamond  10. silver  11. golden    12. phoenix

❌ NUNCA compartas esta frase con nadie
✅ Úsala para recuperar tu identidad si pierdes acceso
```

### 2. Ver tu Identidad

```bash
# Mostrar información de identidad
red identity show
```

**Salida:**
```
📋 Tu Identidad RED

ID Público:     red_7x8k2m9p4q3r5t6y8u9i0o...
Clave Pública:  a1b2c3d4e5f6...
Creada:         2026-02-01 23:30:00 UTC
Última Rotación: Nunca
Estado:         ✅ Activa
```

### 3. Exportar Identidad (Backup)

```bash
# Crear backup cifrado
red identity export --output mi_identidad.red

# Te pedirá una contraseña para cifrar el backup
```

---

## Conectar a la Red

### 1. Iniciar Conexión

```bash
# Conectar a la red RED
red connect
```

**Salida:**
```
🌐 Conectando a la red RED...

📡 Buscando nodos bootstrap...
✅ Conectado a node1.red.network:9000
✅ Conectado a node2.red.network:9000

🔗 Peers conectados: 47
📊 Blockchain sincronizada: bloque #12,345

✅ ¡Listo para enviar mensajes!

Escribe 'help' para ver comandos disponibles.
```

### 2. Ver Estado de Conexión

```bash
# Estado de la red
red status
```

**Salida:**
```
📊 Estado de la Red

Conexión:       ✅ Conectado
Peers:          47 activos
Latencia:       45ms promedio
Blockchain:     Sincronizada (bloque #12,345)
Mensajes:       3 pendientes
Última actividad: hace 2 minutos
```

---

## Enviar tu Primer Mensaje

### 1. Agregar un Contacto

```bash
# Agregar contacto por su ID público
red contact add red_9y2j5n8r3t... --name "Alice"
```

**Salida:**
```
✅ Contacto agregado

Nombre:  Alice
ID:      red_9y2j5n8r3t...
Estado:  ⏳ Pendiente de verificación

💡 Tip: Verifica la identidad de Alice por otro canal
        para asegurar que es quien dice ser.
```

### 2. Enviar Mensaje

```bash
# Enviar mensaje de texto
red send "Alice" "¡Hola! Este es mi primer mensaje en RED 🔴"
```

**Salida:**
```
📤 Enviando mensaje...

🔐 Cifrando con Double Ratchet...
🧅 Aplicando onion routing (3 capas)...
📡 Transmitiendo a la red...

✅ Mensaje enviado exitosamente

ID del mensaje: msg_abc123...
Tiempo de envío: 0.3s
```

### 3. Ver Mensajes Recibidos

```bash
# Ver bandeja de entrada
red inbox
```

**Salida:**
```
📬 Bandeja de Entrada (3 mensajes nuevos)

┌─────────────────────────────────────────────────────────┐
│ [1] De: Alice                          hace 5 minutos  │
│     "¡Hola! ¿Cómo estás?"                              │
├─────────────────────────────────────────────────────────┤
│ [2] De: Bob                            hace 1 hora     │
│     "Reunión mañana a las 10"                          │
├─────────────────────────────────────────────────────────┤
│ [3] De: Carol                          hace 2 horas    │
│     "Te envío el documento adjunto"                    │
└─────────────────────────────────────────────────────────┘

Usa 'red read <número>' para ver el mensaje completo.
```

---

## Comandos Esenciales

### Identidad

| Comando | Descripción |
|---------|-------------|
| `red identity new` | Crear nueva identidad |
| `red identity show` | Ver tu identidad |
| `red identity rotate` | Rotar identidad (nueva clave) |
| `red identity export` | Exportar backup cifrado |
| `red identity import` | Importar desde backup |

### Contactos

| Comando | Descripción |
|---------|-------------|
| `red contact add <id>` | Agregar contacto |
| `red contact list` | Listar contactos |
| `red contact remove <nombre>` | Eliminar contacto |
| `red contact verify <nombre>` | Verificar contacto |

### Mensajes

| Comando | Descripción |
|---------|-------------|
| `red send <dest> <msg>` | Enviar mensaje |
| `red inbox` | Ver mensajes recibidos |
| `red read <id>` | Leer mensaje específico |
| `red delete <id>` | Eliminar mensaje |

### Red

| Comando | Descripción |
|---------|-------------|
| `red connect` | Conectar a la red |
| `red disconnect` | Desconectar |
| `red status` | Ver estado de conexión |
| `red peers` | Listar peers conectados |

---

## Modo Interactivo

```bash
# Iniciar cliente interactivo
red interactive
```

```
🔴 RED Interactive Client v0.1.0

Conectado como: red_7x8k2m9p4q...
Peers: 47 | Blockchain: #12,345

red> help

Comandos disponibles:
  send <contacto> <mensaje>  - Enviar mensaje
  inbox                      - Ver mensajes
  contacts                   - Listar contactos
  status                     - Estado de la red
  quit                       - Salir

red> send Alice Hola, ¿qué tal?
✅ Mensaje enviado

red> inbox
📬 1 mensaje nuevo de Alice

red> quit
👋 ¡Hasta pronto!
```

---

## Solución de Problemas

### Error: "No se puede conectar a la red"

```bash
# Verificar conectividad
red diagnose network

# Intentar con nodos alternativos
red connect --bootstrap node3.red.network:9000
```

### Error: "Identidad no encontrada"

```bash
# Verificar que existe identidad
red identity show

# Si no existe, crear una nueva
red identity new

# O importar desde backup
red identity import mi_identidad.red
```

### Error: "Mensaje no entregado"

```bash
# Verificar estado del destinatario
red contact status "Alice"

# Reintentar envío
red send "Alice" "mensaje" --retry
```

---

## Próximos Pasos

1. 📖 Lee la [Documentación Completa](./SPECIFICATION.md)
2. 🔐 Aprende sobre [Seguridad](./SECURITY_AUDIT.md)
3. 🛠️ Explora la [API](./API.md)
4. 💬 Únete a nuestra [Comunidad en X](https://x.com/DarckRovert)

---

## ¿Necesitas Ayuda?

- 📚 **Documentación**: https://github.com/DarckRovert/RED
- 💬 **X / Twitter**: https://x.com/DarckRovert
- 🐛 **Reportar Bug**: https://github.com/DarckRovert/RED/issues
- 📧 **Email**: darckrovert@gmail.com

---

<p align="center">
  <strong>RED</strong> - Porque la privacidad es un derecho, no un privilegio.
</p>
