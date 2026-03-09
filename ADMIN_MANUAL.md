# 🔴 RED - Manual del Administrador (Node Ops)

Este manual está dirigido a operadores de nodos, desarrolladores e integradores que deseen desplegar, mantener o extender la infraestructura de RED.

---

## 🛠️ 1. Despliegue del Nodo (red-node)

El nodo es el corazón de la red. Puede ejecutarse en local o en un servidor (computación perimetral/edge).

### Requisitos Mínimos
- OS: Linux (recomendado), macOS o Windows.
- RAM: 2GB (mínimo), 4GB (recomendado para nodos de relay).
- Almacenamiento: SSD con al menos 10GB libres para la base de datos de la blockchain ligera y mensajes.

### Instalación desde Fuente
```bash
git clone https://github.com/DarckRovert/RED
cd RED
cargo build --release
```

### Comandos de Gestión
- `red-node init`: Inicializa la base de datos y genera el par de claves del nodo.
- `red-node start`: Arranca el nodo en modo foreground.
- `red-node status`: Muestra estadísticas de sincronización y número de peers conectados.

### Despliegue en App Stores
Para publicar RED en la Google Play Store, consulta la guía detallada en:
`[docs/PLAYSTORE_GUIDE.md](./docs/PLAYSTORE_GUIDE.md)`

### Administración del Frontend (Móvil)
RED utiliza **Next.js Static Export**. Para actualizar el contenido del frontend:
1. Navega a `client/app`.
2. Ejecuta `npm run build`.
3. Sincroniza con Capacitor: `npx cap sync android` o `npx cap sync ios`.
4. El contenido de la carpeta `out` se copiará automáticamente a los binarios nativos.

---

## 🌐 2. API e Integración

El nodo expone una API REST (por defecto en el puerto 7333) y un canal de eventos SSE para integraciones en tiempo real.

### Endpoints Principales
- `GET /api/v1/status`: Retorna el estado del nodo, versión y métricas P2P.
- `POST /api/v1/message/send`: Envía un mensaje cifrado a un DID específico.
- `GET /api/v1/conversations`: Lista los hilos de conversación activos.
- `GET /api/v1/events`: Endpoint de Server-Sent Events (SSE) para recibir notificaciones de nuevos mensajes.

---

## 🔒 3. Seguridad y Hardening

### Cifrado de Almacenamiento
Por seguridad, la base de datos local (RocksDB) está cifrada en reposo. Al iniciar el nodo, se requiere la `RED_KEY` o una contraseña interactiva.

### Cortafuegos (Firewall)
Para una conectividad óptima, asegúrate de permitir tráfico en:
- **Port 7331 (UDP/TCP)**: Tráfico P2P (libp2p).
- **Port 7333 (Local)**: Acceso a la API (se recomienda no exponer este puerto a internet sin un proxy inverso con autenticación).

---

## 📊 4. Monitorización y Salud de la Red

Los administradores pueden monitorear la salud del nodo mediante el Dashboard de RED o herramientas de logging:
- **Logs**: El nodo utiliza la caja `tracing`. Puedes ajustar el nivel de log con `RUST_LOG=debug`.
- **Métricas**: El explorador de blockchain integrado permite verificar la sincronización de bloques y la propagación de transacciones de identidad.

---

## 🚑 5. Resolución de Problemas

**El nodo no encuentra peers:**
- Verifica el acceso a internet y los puertos del firewall.
- Intenta añadir un nodo semilla (bootstrap) manualmente en la configuración: `red-node start --peer <MULTIADDR>`.

**Error al descifrar mensajes:**
- Asegúrate de que el reloj del sistema esté sincronizado (NTP). El Double Ratchet de RED es sensible a desvíos temporales grandes para evitar ataques de repetición.

---

**RED Admin Docs** — Construyendo un futuro sin vigilancia centralizada.
