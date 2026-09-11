# 🛡️ RED Sovereign Mesh OS — Release v98.0.0 (Tactical Vector Architecture & Zero-Echo Sync Edition)

## 🌟 Aspectos Destacados de la Versión v98.0.0

Esta versión consolida la arquitectura gráfica, visual y de sincronización de **RED OS** con soporte vectorial de ultra alta fidelidad para planos de arquitectura e ingeniería soberana, visor CAD interactivo con anclaje dinámico anti-truncamiento, desacoplamiento semántico estricto entre borrado local y revocación remota en malla, y sincronización sin ecos entre dispositivos emparejados.

---

### 1. Desacoplamiento Semántico de Mensajería: "Eliminar para mí" vs. "Eliminar para todos"
- **Borrado Local Estricto (`deleteMessage`):** Erradica el mensaje en el cliente local, libera espacio de almacenamiento y purga los binarios de medios de IndexedDB sin propagar órdenes de borrado a los demás nodos de la malla.
- **Revocación Global en Malla (`deleteMessageForEveryone`):** Redacta el mensaje en memoria (`🚫 Eliminaste este mensaje`), purga los binarios de `IndexedMediaVault`, persiste el estado redactado en el almacenamiento local para evitar la resurrección al reiniciar la app, transmite el control packet `message_delete` por la malla (1-a-1 y escuadrones) y replica la orden a través de `companionSyncEngine.ts` vía `LIVE_MSG_DELETE`.
- **Limpieza Transaccional de Conversaciones (`clearConversation`):** Recalcula inmediatamente el snippet `last_message` y purga atómicamente todos los mensajes y archivos pesados en almacenamiento local e IndexedDB.

---

### 2. Visor CAD Interactivo & Plano Técnico de 4 Capas
- **Renderizado Gráfico Dual:** Conmutador fluido entre **Topología Táctica Mesh P2P** y **Plano Técnico de 4 Capas Conectadas** en 4K Ultra-HD offline.
- **Anclaje Dinámico Anti-Truncamiento en CSS Flexbox:** Corrección a nivel de raíz del desbordamiento en coordenadas negativas al aplicar zoom > 1.0x, garantizando navegación fluida y completa por todo el lienzo del plano.
- **Controles CAD en Tiempo Real:** Botones de zoom interactivo `[-]`, `[100%]`, `[+]` (de 0.6x a 3.0x), retículas HUD tácticas en las esquinas y atajo de teclado `[ESC]` con listener reactivo y desmontaje limpio.
- **Sincronización Bidireccional:** Vinculación directa entre el selector de capas arquitectónicas y las pestañas del inspector de código en vivo (Rust, PQC, Vocoder, Android).

---

### 3. Sincronización Web Companion sin Eco (`instanceId`)
- **Aislamiento de Instancia:** Generación de un `instanceId` aleatorio y único por sesión en el motor de sincronización. Impide que dos nodos con la misma identidad criptográfica (nodo móvil y nodo web compañero) descarten mutuamente sus eventos legítimos en tiempo real.
- **Sincronización de Borrados:** Eventos `LIVE_MSG_DELETE` y `LIVE_CONV_CLEAR` integrados en el protocolo reactivo entre terminales.

---

### 4. Gobernanza y Paridad SSOT de Versión
- Sincronización unificada de la versión `v98.0.0` y `versionCode 98000` en los 21 archivos y manifiestos del sistema (`build.gradle`, `package.json`, `version.ts`, crates Rust `red_core`, `red_mobile`, `red_node`, `red_blockchain`, `Cargo.lock`, Service Workers PWA y documentación técnica).

---

### 5. Certificación Multi-Hardware Concurrente
Despliegue y validación en limpio en hardware real con **0 crashes** y **100% de funcionalidad**:
- **Lenovo Tab M11 / TB305XU** (`HA2CHKZ2` / Android 14) — Enlace P2P automático establecido, recepción y renderizado instantáneo de mensajes de chat cifrados.
- **Motorola Moto G22** (`ZT322B386P` / Android 12) — Transmisión P2P Noise + ML-KEM-768 hacia la tablet, acuse de recibo de doble check verificado.

---

### 6. Binarios Oficiales para Descarga Directa
- `red-v98.0.0-release.apk` (71.21 MB / 74,670,556 bytes) — SHA256: `32701A18A9C257A7C99470233852FBE258035CC0663434D240A1E71C27876163`
- `red-latest.apk` (71.21 MB / 74,670,556 bytes) — SHA256: `32701A18A9C257A7C99470233852FBE258035CC0663434D240A1E71C27876163`
- `SHA256SUMS.txt`

> **Web App & Descarga Directa:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
