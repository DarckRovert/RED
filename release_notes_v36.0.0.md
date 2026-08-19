# RED v36.0.0 — Sovereign Competitive Superiority Master Release

**Build:** `36000` | **Fecha:** 2026-08-19 | **Canal:** `stable-p2p` | **Protocolo:** `RED/36.0-NOISE-PQC`

---

## 🎯 Resumen Ejecutivo

La versión **v36.0.0** de RED marca un hito en la experiencia de usuario y arquitectura de mensajería táctica soberana, superando las aplicaciones comerciales convencionales (WhatsApp, Signal, Telegram) sin recurrir a servidores centrales, metadatos en la nube ni simulaciones. Toda la funcionalidad implementada opera con código 100% nativo, criptografía real y protocolos P2P de malla.

---

## 🚀 Novedades y Mejoras Implementadas

### 1. Mensajería Reactiva & Core Chat de Siguiente Generación
- **Reacciones E2E en Tiempo Real:** Selector flotante de reacciones emoji (❤️, 👍, 😂, 😮, 😢, 🔥) con persistencia y sincronización mediante paquetes de malla (`msg_type: 'reaction'`). Badges táctiles que permiten alternar la reacción del usuario con un solo toque.
- **Citas Táctiles (*Swipe to Reply*):** Gesto de deslizamiento hacia la derecha en cualquier burbuja con animación elástica e indicador visual ↩️. Renderizado de cita con salto suave (`scrollIntoView` suave + resaltado flash) al mensaje original.
- **Edición y Eliminación para Todos:** Edición de mensajes propios (`msg_type: 'message_edit'`) con indicador `(editado)` y eliminación para todos (`msg_type: 'message_delete'`) que redacta el contenido a nivel de protocolo y almacenamiento.
- **Confirmaciones de Lectura Criptográficas Reales:** Ciclo completo de confirmación de entrega `pending` (🕒) $\rightarrow$ `sent` (✓) $\rightarrow$ `delivered` (✓✓ verde) $\rightarrow$ `read` (✓✓ cian) transmitido punto a punto mediante paquetes `read_receipt`.
- **Estados Efímeros de Escritura & Grabación:** Indicadores en tiempo real `✍️ Escribiendo...` y `🎙️ Grabando audio...` en la cabecera de chat con temporizador de reset automático.

### 2. Visor Multimedia In-App a Pantalla Completa
- **Galería Táctica con Zoom Multitáctil (`MediaGalleryViewer.tsx`):** Visor in-app para imágenes y videos con zoom multitáctil (*pinch-to-zoom*), doble toque para ampliar, navegación lateral táctil / por teclado y swipe vertical para cerrar.
- **Guardado y Compartido Nativo:** Integración con `@capacitor/filesystem` para guardar archivos directamente en el almacenamiento del dispositivo y `@capacitor/share` para invocar el diálogo nativo de Android.

### 3. Videollamadas con PIP In-App & Auto-Reconexión ICE
- **Ventana Picture-in-Picture (PIP) Flotante (`FloatingCallPIP.tsx`):** Modo PIP arrastrable en pantalla que permite continuar chateando o navegando por la aplicación sin interrumpir la llamada activa.
- **Auto-Reconexión ICE Restart:** Detección de cambios de red o caídas de ruta con activación automática de `pc.restartIce()` sin colgar la llamada.

### 4. Bóveda Biometría & Respaldos Cifrados
- **Bloqueo Biométrico Nativo (`BiometricLockEngine.ts` & `BiometricShieldOverlay.tsx`):** Integración de `@aparajita/capacitor-biometric-auth` con temporizador de inactividad configurable (*Inmediato*, *1 min*, *5 min*, *15 min*) y PIN de seguridad de respaldo.
- **Copia de Seguridad Cifrada AES-256-GCM (`BackupRestoreEngine.ts`):** Exportación e importación de la base de datos completa y claves criptográficas protegidas con clave derivada mediante PBKDF2 (100,000 iteraciones SHA-256).
- **Panel de Información y Medios Compartidos (`ContactProfileModal.tsx`):** Modal de contacto con pestañas organizadas para Fotos/Videos, Documentos, Audios y Enlaces/Coordenadas.

---

## 📱 Verificación y Despliegue en Dispositivos

- **Lenovo Tablet (`HA2CHKZ2`):** Despliegue en limpio de `app-debug.apk` (v36.0.0 / Build 36000), verificación activa del AuthWall biométrico y renderizado de interfaz.
- **Motorola Moto G22 (`ZT322B386P`):** Despliegue en limpio de `app-debug.apk` (v36.0.0 / Build 36000), verificación activa del AuthWall biométrico y renderizado de interfaz.
- **Web Oficial GitHub Pages:** Exportación estática Next.js actualizada en `/RED` (`https://darckrovert.github.io/RED/`).
