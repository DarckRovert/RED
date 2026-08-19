# 🛡️ RED v37.0.0 — Sovereign Mesh Master Release

**Fecha de Lanzamiento:** 19 de Agosto de 2026  
**Build Code:** 37000  
**Licencia:** GNU AGPLv3  
**Canal:** `stable-p2p`  
**Protocolo:** `RED/37.0-NOISE-PQC`

---

## 🌐 Resumen del Release v37.0.0

La versión **v37.0.0** de RED consolida la arquitectura soberana off-grid, perfecciona la legibilidad táctica de alta definición (WCAG AAA) en todos los temas visuales, y valida la interoperabilidad P2P directa en hardware real entre dispositivos móviles y la web.

---

## 🚀 Principales Novedades y Mejoras

### 1. 🎨 Ergonomía Visual & Contraste Táctico Universal (WCAG AAA)
- **Legibilidad Perfeccionada:** Corrección integral de contraste en burbujas salientes (`isMine`), citas de respuesta (`reply_to`), tarjetas de coordenadas GPS y notas de voz.
- **Tipografía Universal en Blanco `#FFFFFF`:** Máxima nitidez y diferenciación visual mediante gradientes de cristal carmesí (`linear-gradient(135deg, rgba(232, 33, 58, 0.32) 0%, rgba(170, 18, 40, 0.46) 100%)`) y pizarra táctica oscura (`rgba(18, 22, 36, 0.95)`).
- **Adaptabilidad a los 6 Temas Tácticos:** Soporte dinámico para `void-crimson`, `cyber-cyan`, `emerald-recon`, `ghost-purple`, `solar-amber` y `stealth-dark` con tokens de gradiente y borde calibrados.

### 2. 🔐 Canal Cifrado Noise E2E Handshake & Zero Mock
- Intercambio de mensajes verificado en hardware real (Lenovo Tablet y Motorola Moto G22) sobre canales Noise Handshake.
- Ticks de entrega y lectura instantáneos (`✓` enviado, `✓✓` entregado/leído) sincronizados vía WebSockets/P2P.
- Eliminación total de datos ficticios: 100% funcionalidad real operativa en todos los módulos tácticos.

### 3. 🛡️ Integridad Merkle & Self-Healing de Estado
- Verificación automática de raíz Merkle SHA-256 en almacenamiento local `sled` con cuarentena y aislamiento automático de registros corruptos en el arranque.

### 4. 🎙️ LowBitrateVocoder DSP (1.6–3.2 kbps)
- Procesamiento de audio vocal táctico con remuestreo a 8000 Hz, pre-énfasis y compresión IMA-ADPCM de 4 bits (-97.9% de reducción de tamaño) para envío sobre enlaces de baja velocidad (LoRa / SoundMesh).

---

## 📱 Descarga e Instalación

- **Binario Oficial:** `red-v37.0.0-latest.apk` / `red-latest.apk`
- **Descarga Web:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
- **Requisitos:** Android 7.0 (Nougat, API 24) o superior. Arquitectura ARM64 (`arm64-v8a`).
