# 🔴 RED — Guía de Inicio (v1.0.0 Producción)

RED es un sistema de mensajería privada, decentralizada y cifrada end-to-end. No hay servidores centrales.

## Instalación

Necesitas [Rust](https://rustup.rs/) instalado.

```bash
cargo build --release
```

## Uso

### 1. Inicializar el nodo (solo la primera vez)

```bash
./target/release/red-node init
```

Se te pedirá crear una contraseña para cifrar tu almacenamiento local.

### 2. Arrancar el nodo

```bash
./target/release/red-node start
```

Deberías ver:
```
╔════════════════════════════════════════════════╗
║  🔴 RED Node is running                        ║
║  Port (P2P):  7331                             ║
║  Port (Web UI):  7333                          ║
║                                                ║
║  Abre en tu navegador:                         ║
║  http://localhost:7333                          ║
╚════════════════════════════════════════════════╝
```

### 3. Abrir la interfaz web o App Móvil

- **Web**: Abre **http://localhost:7333** en tu navegador.
- **Móvil**: Sigue la guía en `docs/DEPLOYMENT.md` para empaquetar RED para iOS o Android.

### 4. Flujo de Onboarding
Al entrar, RED te guiará para generar tu **DID (Decentralized Identifier)**. 
- Sigue los pasos para crear tu identidad criptográfica.
- **Respalda tu Master Key**: Copia el Identity Hash mostrado. Es la única forma de recuperar tu cuenta.

### 5. Navegación y Uso
- **Chats**: Conversaciones 1:1 con cifrado Double Ratchet.
- **Grupos**: Salas descentralizadas para múltiples miembros.
- **Contactos**: Busca y añade a otros usuarios mediante su DID.
- **Explorador**: Monitorea el estado de la red e identidades registradas en la blockchain de RED.

---

## CLI (alternativa)

También puedes usar el cliente de línea de comandos:

```bash
# Ver estado del nodo
./target/release/red status

# Enviar un mensaje
./target/release/red send --to <IDENTITY_HASH> "Hola"

# Ver conversaciones
./target/release/red list

# Chat interactivo
./target/release/red interactive
```

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `RED_PASSWORD` | Si se define, se usa como contraseña sin prompt (útil para scripts) |

---

## Seguridad

- Todos los mensajes van cifrados con **ChaCha20-Poly1305** (E2E)
- El almacenamiento local está cifrado con tu contraseña
- Las identidades son anónimas por defecto — no están vinculadas a nombre ni email
- El enrutamiento onion protege tu IP frente a otros peers

---

**RED** — Porque la privacidad es un derecho, no un privilegio.
