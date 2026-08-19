# RED — Sovereign Mesh OS v35.0.0
> **Build Code:** `35000` | **Release Channel:** `stable-p2p` | **Protocol Version:** `RED/35.0-NOISE-PQC`

Plataforma táctica de comunicaciones descentralizadas y soberanas fuera de red (Off-Grid) con criptografía post-cuántica (Kyber-768 / Dilithium), canales E2E Noise XK, enrutamiento en malla P2P multi-radio (BLE + WiFi Direct + WebRTC + MQTT Blind Relay) y experiencia táctica avanzada de nivel producción.

---

## Novedades y Mejoras Principales en v35.0.0

### 1. Motor Acústico Singleton & Corrección Definitiva del Timbre (`CallRingtoneEngine.ts`)
- **Síntesis Multitono Web Audio API:** Generación en tiempo real de 4 tonos acústicos (*Táctico Alfa*, *Pulso Radar*, *Sintetizador Suave*, *Silencioso*) sin dependencias externas de archivos.
- **Cancelación Atómica Garantizada:** El método `CallRingtoneEngine.stop()` asegura el apagado incondicional de osciladores, ganancias, timers de intervalos y patrones hápticos al contestar, rechazar o montar la pantalla de llamada (`CallScreen.tsx`), resolviendo el bug de timbre persistente.

### 2. Videollamadas P2P WebRTC Resilientes (`CallScreen.tsx`)
- **Corrección Crítica de Timestamps:** Normalización de marcas de tiempo en la cola de señales WebRTC (`itemTs = item.timestamp > 1e11 ? item.timestamp : item.timestamp * 1000`), evitando el descarte erróneo del 100% de las respuestas SDP (`answer`) y candidatos ICE remotos por disparidad de unidades (segundos vs milisegundos).
- **Matching Insensible a Mayúsculas/Minúsculas en DIDs:** Normalización de identificadores (`toLowerCase()`) en el procesamiento de colas de señalización P2P.
- **Transceivers Bidireccionales Explícitos:** Inclusión de `pc.addTransceiver('audio', { direction: 'sendrecv' })` y `pc.addTransceiver('video', { direction: 'sendrecv' })` para garantizar la negociación bidireccional de flujos de video y audio en hardware Android heterogéneo.
- **Captura de Cámara Adaptativa:** Restricciones de resolución configurables (`720p HD`, `480p SD`, `360p Eco`) con soporte de fallbacks resilientes multinivel para evitar fallos de hardware en sensores de dispositivos móviles.

### 3. Centro Maestro de Ajustes & Configuración Soberana (`SettingsModal.tsx`)
- **8 Paneles Tácticos Especializados:** Navegación por pestañas para *Apariencia & Temas*, *Llamadas & Video*, *Sonido & Tonos*, *Almacenamiento & Caché*, *Privacidad & Biometría*, *Malla & Batería*, *Identidad & Claves* y *Actualizador OTA*.
- **Gestión Real de Almacenamiento:** Cálculo en vivo del espacio ocupado por mensajes, conversaciones y medios temporales en la bóveda local (`localStorage`), con herramienta de purga de caché de medios sin alterar contactos ni chats.
- **Configuración WebRTC Personalizable:** Servidores STUN personalizables, supresión de eco y control de altavoz predeterminado en videollamadas.

---

## Binarios Oficiales para Descarga Directa

| Archivo | Descripción | Plataforma |
| :--- | :--- | :--- |
| **`red-v35.0.0-latest.apk`** | Instalador Universal Oficial v35.0.0 | Android 7.0+ (ARM64) |
| **`red-latest.apk`** | Enlace canónico de última versión | Android 7.0+ (ARM64) |

> **Web App:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
