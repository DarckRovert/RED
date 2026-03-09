# ❓ Preguntas Frecuentes (FAQ) - RED

---

## General

### ¿Qué es RED?

RED es un sistema de mensajería descentralizado y privado. A diferencia de WhatsApp o Telegram, RED no tiene servidores centrales. Tus mensajes viajan directamente entre usuarios a través de una red peer-to-peer, cifrados de extremo a extremo.

### ¿Por qué debería usar RED en lugar de WhatsApp?

| Aspecto | RED | WhatsApp |
|---------|-----|----------|
| Servidores | Ninguno (P2P) | Centralizados (Meta) |
| Metadatos | Protegidos | Recolectados |
| Código | Open source | Cerrado |
| Identidad | Anónima | Teléfono requerido |
| Censura | Resistente | Puede ser bloqueado |

### ¿RED es gratis?

Sí, RED es completamente gratuito y open source bajo licencia AGPL-3.0. No hay costos ocultos, suscripciones ni publicidad.

### ¿Quién desarrolla RED?

RED es desarrollado por una comunidad open source. Cualquiera puede contribuir al código, revisar la seguridad o proponer mejoras.

---

## Privacidad y Seguridad

### ¿Qué tan seguro es RED?

RED utiliza criptografía de nivel militar:

- **Cifrado**: ChaCha20-Poly1305 (256 bits)
- **Intercambio de claves**: X25519 (Curve25519)
- **Firmas**: Ed25519
- **Hash**: BLAKE3
- **Protocolo**: Double Ratchet (como Signal)

Además, RED protege tus metadatos con onion routing (como Tor).

### ¿Pueden leer mis mensajes?

No. Nadie excepto tú y tu destinatario puede leer tus mensajes:

- Los nodos de la red solo ven datos cifrados
- No hay servidores centrales que almacenen mensajes
- Las claves de cifrado solo existen en tus dispositivos

### ¿Qué es "forward secrecy"?

Forward secrecy significa que si alguien obtiene tus claves actuales, no puede descifrar mensajes anteriores. RED genera nuevas claves para cada mensaje usando el protocolo Double Ratchet.

### ¿Qué pasa si pierdo mi dispositivo?

- Tus mensajes anteriores están seguros (forward secrecy)
- Puedes restaurar tu identidad desde un backup cifrado
- Puedes crear una nueva identidad y notificar a tus contactos

### ¿RED protege mis metadatos?

Sí. RED usa varias técnicas:

1. **Onion routing**: Tu mensaje pasa por 3 nodos intermedios, cada uno solo conoce el anterior y siguiente
2. **Tráfico dummy**: Se generan mensajes falsos para ocultar patrones
3. **Identidades rotativas**: Tu ID cambia periódicamente

### ¿Puede el gobierno bloquear RED?

Es muy difícil:

- No hay servidores centrales que bloquear
- El tráfico parece tráfico normal de internet
- La red se adapta automáticamente si algunos nodos son bloqueados

---

## Uso

### ¿Necesito un número de teléfono?

No. RED usa identidades criptográficas anónimas. No necesitas proporcionar ningún dato personal.

### ¿Cómo agrego contactos?

Compartes tu ID público (una cadena como `red_7x8k2m9p4q...`) con la otra persona. Puedes hacerlo:

- Mostrando un código QR
- Copiando y pegando el ID
- Usando un canal seguro existente

### ¿Puedo usar RED en múltiples dispositivos?

Sí. Puedes sincronizar tu identidad entre dispositivos usando un backup cifrado. Los mensajes se sincronizan automáticamente.

### ¿Hay límite de tamaño de mensajes?

El límite actual es 64KB por mensaje. Para archivos grandes, se fragmentan automáticamente.

### ¿Puedo crear grupos?

Sí. RED soporta grupos cifrados de hasta 1000 miembros. Cada miembro tiene su propia clave de envío (protocolo Sender Keys).

### ¿Hay llamadas de voz/video?

Está en desarrollo para futuras versiones.

---

## Técnico

### ¿Qué es la blockchain de RED?

RED usa una blockchain ligera **solo para registrar identidades**, no para mensajes. Esto permite:

- Verificar que una identidad es única
- Registrar rotaciones de identidad
- Mantener un registro descentralizado

Los mensajes **nunca** se almacenan en la blockchain.

### ¿Qué es Proof of Stake?

Es el mecanismo de consenso de la blockchain de RED. Los validadores bloquean tokens RED como garantía. Si se comportan mal, pierden sus tokens (slashing).

### ¿Puedo ejecutar mi propio nodo?

Sí, y es recomendable. Ejecutar un nodo:

- Mejora tu privacidad
- Ayuda a la red
- Te permite participar como validador (con staking)

```bash
# Ejecutar nodo
red-node start
```

### ¿Qué lenguaje de programación usa RED?

- **Core**: Rust (seguridad y rendimiento)
- **Bindings**: Python, JavaScript/TypeScript
- **Móvil**: Flutter (Dart)
- **Desktop**: Tauri (Rust + Web)

### ¿Dónde se almacenan mis mensajes?

Localmente en tu dispositivo, cifrados con tu clave personal. Los mensajes se borran automáticamente después de 30 días (configurable).

### ¿Qué pasa si estoy offline?

Los mensajes se almacenan temporalmente en la red (cifrados) hasta que te conectes. El tiempo máximo de retención es 7 días.

---

## Comparaciones

### RED vs Signal

| Aspecto | RED | Signal |
|---------|-----|--------|
| Arquitectura | Descentralizada | Centralizada |
| Metadatos | Protegidos (onion) | Parcialmente expuestos |
| Identidad | Anónima | Teléfono requerido |
| Protocolo | Double Ratchet | Double Ratchet |

### RED vs Telegram

| Aspecto | RED | Telegram |
|---------|-----|----------|
| E2E por defecto | Sí | No (solo "chats secretos") |
| Servidores | Ninguno | Centralizados |
| Código servidor | N/A (P2P) | Cerrado |
| Metadatos | Protegidos | Recolectados |

### RED vs Matrix/Element

| Aspecto | RED | Matrix |
|---------|-----|--------|
| Arquitectura | P2P puro | Federada (servidores) |
| Metadatos | Onion routing | Expuestos a servidores |
| Complejidad | Simple | Compleja |
| Identidad | Anónima | Usuario@servidor |

---

## Problemas Comunes

### "No puedo conectar a la red"

1. Verifica tu conexión a internet
2. Intenta con nodos bootstrap alternativos:
   ```bash
   red connect --bootstrap node3.red.network:9000
   ```
3. Si estás detrás de un firewall restrictivo, habilita el modo Tor:
   ```bash
   red connect --tor
   ```

### "Mensaje no entregado"

- El destinatario puede estar offline
- El mensaje se entregará cuando se conecte (hasta 7 días)
- Verifica que tienes la identidad correcta del contacto

### "Error de sincronización de ratchet"

Esto puede ocurrir si los estados de sesión se desincronizaron. Solución:

```bash
red session reset <contacto>
```

Ambos usuarios deben hacer esto.

### "Identidad no encontrada"

- Verifica que creaste una identidad: `red identity show`
- Si no existe, crea una: `red identity new`
- Si perdiste tu identidad, restaura desde backup: `red identity import`

---

## Contribuir

### ¿Cómo puedo ayudar?

- **Código**: Contribuye en GitHub
- **Documentación**: Mejora o traduce docs
- **Testing**: Reporta bugs
- **Difusión**: Comparte RED con otros
- **Nodos**: Ejecuta un nodo para fortalecer la red

### ¿Hay recompensas por encontrar bugs?

Sí, tenemos un programa de bug bounty para vulnerabilidades de seguridad. Contacta: security@red.network

---

## Contacto

- **Discord**: https://discord.gg/red-network
- **GitHub**: https://github.com/red-network/red
- **Email**: support@red.network
- **Twitter**: @red_network

---

¿Tienes una pregunta que no está aquí? ¡Pregúntanos en Discord!
