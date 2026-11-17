# RED v126.1.0 — Depuración Táctica Profunda, Resiliencia C4ISR & Soberanía Anti-Billing CI/CD

**Fecha de Release:** 2026-11-17  
**Build Code:** 126100  
**Canal:** stable-p2p  

---

## 🛡️ Nuevas Capacidades y Fortalecimiento Arquitectónico

### 1. Ciclo de Depuración Táctica Integral (17 Bugs Críticos Subsanados)

1. **Protocolo Amber Alert & Sincronización de Consulta (`node/src/api.rs`, `red_mobile/src/api.rs`):**
   - Corrección del desajuste en el parámetro de consulta `?all=true` en los endpoints Axum Rust.
   - Garantiza la recuperación uniforme de todas las alertas tácticas (activas e históricas) sin silenciamiento de notificaciones.

2. **Visor de Bóveda Táctica & Exportación de Medios (`MediaGalleryViewer.tsx`):**
   - Erradicación de parpadeos y fallas de exportación de archivos protegidos bajo esquema `red_vault://`.
   - Resolución desacoplada asíncrona de caché y generación de BlobURLs nativas para descarga instantánea.

3. **Enrutamiento de Canales & Desplazamiento HUD (`Sidebar.tsx`, `TacticalQuickActionHUD.tsx`):**
   - Eliminación del truncamiento erróneo del prefijo de canal (`slice(0, 16)`).
   - Ajuste de márgenes y apilamiento z-index para prevenir solapamientos visuales con la barra de navegación táctica inferior.

4. **Reproducción de Medios Cifrados en Burbujas de Chat (`MessageBubble.tsx`):**
   - Soporte nativo para renderizado y reproducción de video cifrado y descarga de documentos referenciados mediante `red_vault://`.

5. **Normalización de URIs en Perfil de Contactos (`ContactProfileModal.tsx`):**
   - Corrección de prefijos sintéticos no estándar (`red_vault://image`) y soporte para previsualización directa de audios y videos codificados en base64.

6. **Deduplicación Inteligente de Mensajes (`ChatWindow.tsx`):**
   - Prevención del descarte erróneo de afirmaciones cortas consecutivas idénticas (e.g. "si", "ok", "recibido") mediante discriminación temporal estricta de ID y timestamp.

7. **Flujo de Edición de Mensajes en el Cliente (`ChatInput.tsx`, `ChatWindow.tsx`):**
   - Conexión del flujo de edición UI directamente con `RedAPI.editMessage()` y actualización reactiva inmediata en la vista.

8. **Rutas Axum Backend para Edición y Borrado (`red_mobile/src/api.rs`):**
   - Implementación de endpoints REST y handlers Axum `/api/messages/:id` (`PUT`, `DELETE`) para persistencia en base de datos SQLite/RocksDB local y difusión en la malla P2P.

9. **Sincronización de Mensajes Fijados (`ChatWindow.tsx`, `MessageBubble.tsx`, `chatSlice.ts`):**
   - Unificación del estado de mensajes anclados entre el store Zustand y los componentes de visualización, con persistencia atómica en almacenamiento local.

10. **Supresión de Tormenta de Paquetes PTT Walkie-Talkie & Doble Roger Beep (`messageDispatcher.ts`, `channels.ts`, `P2PWalkieTalkieModal.tsx`, `ExtremeSurvivalHudModal.tsx`):**
    - Supresión de bucles de retransmisión de ráfagas de audio PTT y eliminación del doble pitido de confirmación piezoeléctrico (Roger Beep) en canales tácticos y HUD de supervivencia extrema.

11. **Congelamiento de Cámara Radar & Visualización CSS (`RadarWindow.tsx`):**
    - Resolución del bloqueo de cámara en Android durante el escaneo de códigos QR y erradicación del reseteo indebido de display CSS en clases `.scanner-active`.

12. **Bóveda Esteganográfica & Extracción JPEG (`StegoVaultModal.tsx`):**
    - Corrección de fallos en la descarga y desempaquetado de archivos ocultos en imágenes esteganográficas.
    - Soporte completo para extracción de portadores JPEG directos de cámara física.

13. **Protocolo Social P2P & Persistencia de Reacciones (`SocialFeedPanel.tsx`, `messageDispatcher.ts`):**
    - Alineación de constantes de difusión de red (`SOCIAL_POST_BROADCAST` vs `social_post`).
    - Soporte completo para transporte de `media_data` adjunto, persistencia de reacciones emoji y eliminación de código sombreado.

14. **Balizas de Emergencia SOS & Cancelación Desincronizada (`emergency.ts`, `messageDispatcher.ts`, `emergencySlice.ts`):**
    - Erradicación del sombreado de identificadores (`cancel_${id}`).
    - Unificación de almacenamiento entre `red_sos_beacons` y `red_emergency_beacons`, despacho reactivo en Zustand y purga de latidos residuales en segundo plano.

15. **Monedero P2P & Prevención de Corrupción de Saldo (`economy.ts`, `messageDispatcher.ts`):**
    - Corrección de mutación recursiva en clave `STORAGE_KEYS.P2P_WALLET`.
    - Blindaje contra reseteos a saldo cero ("dinero infinito" o balances fantasmas), decodificación robusta de vales QR con prefijo `VOUCHER:1:` y emisión garantizada del evento `red:wallet_updated`.

16. **Interruptor del Hombre Muerto / Dead Man's Switch (`sensors.ts`, `client.ts`, `DMSSettings.tsx`, `BiometricLockEngine.ts`, `messageDispatcher.ts`):**
    - Respeto riguroso de la bandera `wipe_identity: false` (previniendo borrados involuntarios de la identidad del operador).
    - Difusión garantizada del mensaje de contingencia (`dead_message`) y sincronización global de presencia para erradicar falsos disparos.

17. **Filtrado de Paquetes de Control DTN & Formateo en Lista de Conversaciones (`client.ts`, `messageDispatcher.ts`, `ConversationList.tsx`):**
    - Clasificación exhaustiva de más de 30 tipos de señalización interna como mensajes de control (`isControlMessage`).
    - Prevención de inyección de paquetes de señalización en bandejas de chat personales y supresión de cadenas JSON crudas en los snippets de previsualización de la barra lateral.

---

### 2. Soberanía de CI/CD & Política Anti-Billing de GitHub Actions (Costo $0)

- **Auditoría Preventiva y Desmantelamiento de Disparadores Automáticos:**
  - Desmantelamiento total de triggers `push`, `pull_request`, `schedule` y `release` en todos los workflows de `.github/workflows/`:
    - `build-android.yml`
    - `build-ios.yml`
    - `build.yml`
    - `lint.yml`
    - `proverif.yml`
    - `publish-aptoide.yml`
    - `release.yml`
    - `security.yml`
    - `test.yml`
    - `deploy-pages.yml`
  - Todos los flujos quedan restringidos a ejecución manual controlada (`workflow_dispatch`), garantizando costo permanente de $0.00 en minutos de computación en la nube.
- **Soberanía Local de Pruebas y Compilación:**
  - Suite de pruebas y validaciones ejecutables 100% en local en la máquina del desarrollador (`cargo check`, `cargo test`, `tsc --noEmit`).

---

## 📱 Verificación Técnica y Paridad del Sistema

- **Compilación Frontend TypeScript:** `tsc --noEmit` completado con 0 errores.
- **Compilación Backend Rust:** `cargo check --workspace` y `cargo test -p red_mobile` verificados limpiamente.
- **Gobernanza SSOT:** Sincronización atómica completada en 37 archivos maestros del proyecto mediante `bump_version.js`.
