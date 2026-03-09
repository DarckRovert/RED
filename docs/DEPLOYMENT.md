# 🚀 Guía de Despliegue - RED

Esta guía cubre el despliegue de nodos RED en diferentes entornos.

---

## Tabla de Contenidos

1. [Requisitos](#requisitos)
2. [Despliegue Local](#despliegue-local)
3. [Despliegue en Servidor](#despliegue-en-servidor)
4. [Despliegue con Docker](#despliegue-con-docker)
5. [Despliegue en Kubernetes](#despliegue-en-kubernetes)
6. [Configuración de Red](#configuración-de-red)
7. [Monitoreo](#monitoreo)
8. [Mantenimiento](#mantenimiento)
9. [Despliegue Móvil (Capacitor)](#despliegue-móvil-capacitor)
10. [Publicación en Play Store (Guía Detallada)](./PLAYSTORE_GUIDE.md)

---

## Requisitos

### Hardware Mínimo (Nodo Relay)

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 4+ GB |
| Disco | 20 GB SSD | 50+ GB SSD |
| Red | 10 Mbps | 100+ Mbps |

### Hardware Mínimo (Nodo Validador)

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16+ GB |
| Disco | 100 GB SSD | 500+ GB NVMe |
| Red | 100 Mbps | 1 Gbps |

### Software

- **OS**: Linux (Ubuntu 22.04+, Debian 12+), macOS 13+, Windows Server 2022
- **Rust**: 1.70+ (para compilar desde fuente)
- **Docker**: 24.0+ (opcional)
- **OpenSSL**: 3.0+

---

## Despliegue Local

### Compilar desde Fuente

```bash
# Clonar repositorio
git clone https://github.com/red-network/red.git
cd red

# Compilar en modo release
cargo build --release --package red-node

# El binario estará en:
# ./target/release/red-node
```

### Configuración Básica

Crear archivo `config.toml`:

```toml
[node]
# Tipo de nodo: "relay" o "validator"
type = "relay"

# Puerto de escucha
listen_port = 9000

# Dirección pública (para NAT)
external_address = "auto"

[network]
# Nodos bootstrap
bootstrap_nodes = [
    "node1.red.network:9000",
    "node2.red.network:9000",
    "node3.red.network:9000"
]

# Máximo de peers
max_peers = 50

# Habilitar relay
relay_enabled = true

[storage]
# Directorio de datos
data_dir = "./data"

# Retención de mensajes (segundos)
message_retention = 604800  # 7 días

[logging]
# Nivel: "error", "warn", "info", "debug", "trace"
level = "info"

# Archivo de log (opcional)
file = "./logs/red-node.log"
```

### Iniciar Nodo

```bash
# Iniciar con configuración
./target/release/red-node --config config.toml

# O con parámetros en línea de comandos
./target/release/red-node \
    --port 9000 \
    --data-dir ./data \
    --log-level info
```

---

## Despliegue en Servidor

### Ubuntu/Debian

```bash
# 1. Actualizar sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependencias
sudo apt install -y build-essential pkg-config libssl-dev

# 3. Instalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 4. Clonar y compilar
git clone https://github.com/red-network/red.git
cd red
cargo build --release --package red-node

# 5. Crear usuario de servicio
sudo useradd -r -s /bin/false red

# 6. Crear directorios
sudo mkdir -p /opt/red /var/lib/red /var/log/red
sudo cp target/release/red-node /opt/red/
sudo chown -R red:red /opt/red /var/lib/red /var/log/red

# 7. Crear configuración
sudo nano /opt/red/config.toml
```

### Servicio Systemd

Crear `/etc/systemd/system/red-node.service`:

```ini
[Unit]
Description=RED Network Node
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=red
Group=red
WorkingDirectory=/opt/red
ExecStart=/opt/red/red-node --config /opt/red/config.toml
Restart=always
RestartSec=10

# Seguridad
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/red /var/log/red
PrivateTmp=true

# Recursos
LimitNOFILE=65535
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

```bash
# Habilitar e iniciar servicio
sudo systemctl daemon-reload
sudo systemctl enable red-node
sudo systemctl start red-node

# Verificar estado
sudo systemctl status red-node

# Ver logs
sudo journalctl -u red-node -f
```

### Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 9000/tcp comment "RED P2P"
sudo ufw allow 9001/tcp comment "RED API"

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --permanent --add-port=9001/tcp
sudo firewall-cmd --reload
```

---

## Despliegue con Docker

### Dockerfile

```dockerfile
# Build stage
FROM rust:1.75-bookworm AS builder

WORKDIR /app
COPY . .

RUN cargo build --release --package red-node

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/red-node /usr/local/bin/

# Crear usuario no-root
RUN useradd -r -s /bin/false red
USER red

EXPOSE 9000 9001

ENTRYPOINT ["red-node"]
CMD ["--config", "/etc/red/config.toml"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  red-node:
    image: rednetwork/red-node:latest
    container_name: red-node
    restart: unless-stopped
    ports:
      - "9000:9000"  # P2P
      - "9001:9001"  # API
    volumes:
      - ./config.toml:/etc/red/config.toml:ro
      - red-data:/var/lib/red
      - red-logs:/var/log/red
    environment:
      - RUST_LOG=info
    healthcheck:
      test: ["CMD", "red-node", "health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

volumes:
  red-data:
  red-logs:
```

```bash
# Iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

---

## Despliegue en Kubernetes

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: red-node
  labels:
    app: red-node
spec:
  replicas: 3
  selector:
    matchLabels:
      app: red-node
  template:
    metadata:
      labels:
        app: red-node
    spec:
      containers:
      - name: red-node
        image: rednetwork/red-node:latest
        ports:
        - containerPort: 9000
          name: p2p
        - containerPort: 9001
          name: api
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        volumeMounts:
        - name: config
          mountPath: /etc/red
        - name: data
          mountPath: /var/lib/red
        livenessProbe:
          httpGet:
            path: /health
            port: 9001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 9001
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: config
        configMap:
          name: red-config
      - name: data
        persistentVolumeClaim:
          claimName: red-data-pvc
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: red-node
spec:
  type: LoadBalancer
  ports:
  - port: 9000
    targetPort: 9000
    name: p2p
  - port: 9001
    targetPort: 9001
    name: api
  selector:
    app: red-node
```

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: red-config
data:
  config.toml: |
    [node]
    type = "relay"
    listen_port = 9000
    
    [network]
    bootstrap_nodes = [
        "node1.red.network:9000",
        "node2.red.network:9000"
    ]
    max_peers = 50
    
    [storage]
    data_dir = "/var/lib/red"
```

---

## Configuración de Red

### NAT Traversal

Si estás detrás de NAT:

```toml
[network]
# Especificar IP pública manualmente
external_address = "203.0.113.50:9000"

# O usar STUN para detección automática
stun_servers = [
    "stun.l.google.com:19302",
    "stun.red.network:3478"
]

# Habilitar hole punching
hole_punching = true
```

### Tor (Opcional)

Para máxima privacidad:

```toml
[tor]
enabled = true
socks_port = 9050

# Crear servicio oculto
hidden_service = true
hidden_service_port = 9000
```

### Rate Limiting

```toml
[rate_limit]
# Mensajes por segundo por peer
messages_per_second = 100

# Conexiones por IP
connections_per_ip = 5

# Bandwidth total (bytes/s)
max_bandwidth = 104857600  # 100 MB/s
```

---

## Monitoreo

### Métricas Prometheus

Habilitar en configuración:

```toml
[metrics]
enabled = true
port = 9090
path = "/metrics"
```

Métricas disponibles:

```
# Conexiones
red_peers_connected
red_peers_total

# Mensajes
red_messages_sent_total
red_messages_received_total
red_messages_relayed_total

# Red
red_bandwidth_in_bytes
red_bandwidth_out_bytes
red_latency_seconds

# Blockchain
red_blockchain_height
red_blockchain_sync_progress
```

### Grafana Dashboard

Importar dashboard desde: `monitoring/grafana-dashboard.json`

### Alertas

Ejemplo de reglas de alerta:

```yaml
groups:
- name: red-alerts
  rules:
  - alert: RedNodeDown
    expr: up{job="red-node"} == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "RED node is down"
      
  - alert: RedLowPeers
    expr: red_peers_connected < 10
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "RED node has few peers"
      
  - alert: RedHighLatency
    expr: red_latency_seconds > 5
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "RED node experiencing high latency"
```

---

## Mantenimiento

### Actualizaciones

```bash
# 1. Descargar nueva versión
cd /opt/red
git pull
cargo build --release --package red-node

# 2. Detener servicio
sudo systemctl stop red-node

# 3. Reemplazar binario
sudo cp target/release/red-node /opt/red/red-node

# 4. Iniciar servicio
sudo systemctl start red-node
```

### Backup

```bash
# Backup de datos
tar -czvf red-backup-$(date +%Y%m%d).tar.gz /var/lib/red

# Backup de configuración
cp /opt/red/config.toml /backup/
```

### Logs

```bash
# Rotar logs
cat > /etc/logrotate.d/red-node << EOF
/var/log/red/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 red red
}
EOF
```

### Troubleshooting

```bash
# Ver estado del nodo
red-node status

# Verificar conectividad
red-node diagnose network

# Verificar blockchain
red-node diagnose blockchain

# Reiniciar estado (cuidado!)
red-node reset --keep-identity
```

---

## Despliegue Móvil (Capacitor 8)

RED utiliza **Capacitor 8** para convertir la aplicación web en una experiencia nativa para iOS y Android.

### Requisito: Next.js Static Export
Para que la app funcione en móviles, `next.config.ts` debe tener `output: 'export'`.

### Preparación del entorno
```bash
npm install -g @capacitor/cli
npx cap init RED f.red.app --web-dir out
```

### Build para Android
```bash
# 1. Compilar Next.js a estático (genera carpeta /out)
npm run build

# 2. Sincronizar con Capacitor
npx cap add android  # Solo la primera vez
npx cap sync android

# 3. Abrir en Android Studio
npx cap open android
```

### Build para iOS
```bash
# 1. Sincronizar
npx cap add ios
npx cap sync

# 2. Abrir en Xcode
npx cap open ios
```

---

## Seguridad

### Hardening del Sistema
...

```bash
# Deshabilitar root SSH
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Instalar fail2ban
sudo apt install fail2ban

# Actualizaciones automáticas de seguridad
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### Backup de Claves

```bash
# Exportar clave del nodo (cifrada)
red-node export-key --output node-key.enc --password

# Guardar en lugar seguro (offline)
```

---

## Soporte

- **Documentación**: https://docs.red.network/deployment
- **Discord**: https://discord.gg/red-network (canal #node-operators)
- **GitHub Issues**: https://github.com/red-network/red/issues
