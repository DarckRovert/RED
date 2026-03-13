# Servidor de Señalización RED — Guía de Despliegue

El servidor de señalización permite que dos instancias de RED negocien una
conexión  WebRTC (SDP offer/answer + ICE candidates) sin que el servidor
vea el contenido de los mensajes. Sólo rutea metadatos de conexión.

## Arquitectura

```
Dispositivo A ──WS──► Signaling Server ◄──WS── Dispositivo B
     │                    (Relay)                    │
     │                                               │
     └──── RTCPeerConnection (P2P directo) ──────────┘
                 Audio / Video cifrado WebRTC
```

## Inicio rápido (desarrollo)

```bash
cd RED/signaling
npm install
npm run dev        # Usa node --watch para hot-reload
```

El servidor arrancará en:
- **WebSocket**: `ws://localhost:3001`
- **Health check**: `http://localhost:3001/health`

## Producción

### Opción 1 — VPS / servidor propio

```bash
# En el servidor
cd RED/signaling
npm install --production
PORT=3001 node server.js

# Con PM2 (recomendado)
npm install -g pm2
pm2 start server.js --name red-signaling
pm2 save && pm2 startup
```

### Opción 2 — Railway / Render / Fly.io (gratuito)

```bash
# Railway
railway init && railway up

# Render: conecta el repo, build command = npm install, start = node server.js
```

### Variable de entorno en la app cliente

```bash
# client/app/.env.local
NEXT_PUBLIC_SIGNALING_URL=wss://tu-servidor.railway.app

# Para desarrollo local
NEXT_PUBLIC_SIGNALING_URL=ws://localhost:3001
```

## Protocolo de mensajes

| Tipo | Dirección | Descripción |
|---|---|---|
| `register` | cliente → server | Registra peer en una sala |
| `registered` | server → cliente | Confirmación + peerId asignado |
| `call-request` | caller → callee | Notificación de llamada entrante |
| `offer` | caller → callee | SDP offer WebRTC |
| `answer` | callee → caller | SDP answer WebRTC |
| `ice-candidate` | caller ↔ callee | Candidatos ICE |
| `call-accepted` | callee → caller | Llamada aceptada |
| `call-rejected` | callee → caller | Llamada rechazada |
| `hangup` | cualquiera | Colgar |
| `peer-joined` | server → sala | Otro peer se conectó |
| `peer-left` | server → sala | Otro peer se desconectó |

## Sala (Room ID)

La sala se derive de los IDs de ambos peers ordenados alfabéticamente:

```
roomId = sort([peerA.did, peerB.did]).join("-")
```

Esto garantiza que ambos lados calculen el mismo roomId sin coordinación.

## Seguridad

- El servidor **NO** ve el contenido de ningún mensaje multimedia
- Los SDP/ICE que pasan son metadata de red (IPs, puertos), no audio/video
- El audio/video viaja directamente entre los peers (P2P), cifrado por DTLS-SRTP (estándar WebRTC)
- Para mayor privacidad, desplegar el servidor en infraestructura propia

## Nginx reverse proxy (HTTPS + WSS)

```nginx
server {
    listen 443 ssl;
    server_name signal.red.app;
    
    ssl_certificate     /etc/letsencrypt/live/signal.red.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/signal.red.app/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
