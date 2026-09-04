# 🛡️ RED Sovereign Mesh OS — Release v88.0.0 (Familiar Mode & Resilient Mesh Master Edition)

### 🌟 Hitos Arquitectónicos y Mejoras Principales:
- **Paridad Estética y Ergonómica Total con WhatsApp / Telegram (Modo Familiar):**
  - **Conversaciones Flat & Limpias:** Implementación de diseño plano en `ConversationList.tsx` con fondo `#111B21`, tarjeta de escuadrón táctico oculta en modo familiar, selector de chat activo en `#2A3942`, avatares circulares sin bordes poligonales y marcas de tiempo relativas ("14:20", "Ayer", "02/09").
  - **Cabecera de Conversación Cotidiana:** Subtítulo "en línea" y "escribiendo..." en verde `#25D366` en `ChatHeader.tsx`, erradicando tecnicismos crípticos innecesarios en el modo cotidiano.
  - **Burbujas de Mensaje WhatsApp:** Entrantes en `#202C33`, salientes en `#005C4B`, colas angulares laterales y checks vectoriales SVG entrelazados (reloj pendiente, ✓ gris, ✓✓ gris, ✓✓ azul leído).
  - **Fondo con Patrón Doodle Vectorial:** Integración de `WhatsAppDoodleBackground.tsx` ultra ligero en CSS inline con soporte de wallpapers personalizables (`doodle_dark`, `doodle_green`, `void_black`).
  - **Botón Dinámico de Enviar / Grabador de Audio:** Botón circular esmeralda (`#00A884`) en `ChatInput.tsx` que alterna dinámicamente entre avión de papel (cuando hay texto) y grabador de notas de voz P2P.
  - **Modal de Nuevo Chat Rápido:** `NewChatModal.tsx` con acceso inmediato a escáner QR, compartir mi QR, nodos cercanos en radio de alcance y lista alfabética de contactos.
  - **Lista de Contactos WhatsApp:** `ContactList.tsx` con fila de "Nuevo contacto", ordenamiento alfabético real y acciones directas.
  - **Ajustes y Privacidad Refinados:** Configuración de confirmaciones de lectura (doble check azul), bloqueo biométrico con TEE nativo y selector de Modo Dual (Familiar vs. Táctico C4ISR).
- **Transporte Descentralizado & Hardening Cero Simulación:**
  - Cero datos simulados ni hardcodeados: todos los componentes vinculados a stores persistentes e identidades criptográficas Ed25519 / BLAKE3.
  - Carga verificada de librerías nativas JNI `libred_mobile.so` en hardware real.
- **Despliegue & Depuración en Hardware Real:**
  - Despliegue en limpio verificado vía ADB en **Motorola Moto G22** (`ZT322B386P`) y **Lenovo Tab TB305XU** (`HA2CHKZ2`), auditado con `adb logcat` en tiempo real (0 fallos, 0 ANR, carga exitosa de JNI).
- **Validación Automatizada 100% PASS:**
  - TypeScript estricto con 0 errores (`tsc --noEmit`).
  - Prerender estático completo en `next build`.
  - Pruebas criptográficas (`test:crypto`), de resiliencia y gobernanza (`test:governance`) al 100% PASS.

### Binarios Oficiales para Descarga Directa:
- `red-v88.0.0-release.apk` (58.04 MB) — SHA256: `CD7AE4F212C83CFEE3ABA25AD7C16C5F415480B59A8C5AC8004715548360F1D9`
- `red-latest.apk` (58.04 MB) — SHA256: `CD7AE4F212C83CFEE3ABA25AD7C16C5F415480B59A8C5AC8004715548360F1D9`
- `SHA256SUMS.txt`

> **Web App:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
