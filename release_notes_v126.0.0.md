# RED v126.0.0 — Estabilización Táctica Integral, Blindaje Viewport Móvil & Resiliencia UI/UX Soberana

**Fecha de Release:** 2026-09-26  
**Build Code:** 126000  
**Canal:** stable-p2p  

---

## 🛡️ Nuevas Capacidades y Fortalecimiento Arquitectónico

### 1. Blindaje Integral de Viewport Móvil & Prevención de Desbordamientos (32 Modales Tácticos)
- **Erradicación de Explosiones de Cabecera:** Resolución sistemática de desbordamientos horizontales (>100px a 280px) en pantallas compactas de 360px (Motorola Moto G22, Redmi Note 14).
- **Arquitectura Elástica:** Aplicación rigurosa de `minWidth: 0, flex: 1` con elipsis de texto (`textOverflow: "ellipsis"`) en bloques de título y `flexShrink: 0` en botones de acción y cierre en toda la suite táctica:
  - `LoraTransceiverModal.tsx`: corrección de desbordamiento de 282px provocado por subtítulos unificados de ATAK y Vocoder.
  - `RfSpectrumModal.tsx`: resolución de expulsión lateral del conmutador de salto de frecuencia FHSS.
  - `SonarSeismicModal.tsx`: elipsis en títulos y adaptabilidad del panel de geófono físico.
  - `AcousticWarfareModal.tsx`: ajuste dinámico de defensas sónicas y ondas binaurales.
  - `ZkBarterSubsurfaceModal.tsx`: blindaje de cabecera (116px), selectores de recursos flexibles y baliza sísmica.
  - `DigitalContractGateModal.tsx`, `MultiRailCheckoutModal.tsx`, `TacticalQuickActionHUD.tsx`, `CallScreen.tsx`, `CalculatorScreen.tsx`, etc.

### 2. Contenedores Táctiles Desplazables & Protección Safe-Area
- **Scrollers Táctiles con Inercia:** Conversión de selectores de pestañas rígidos a scrollers horizontales (`.scroll-container`, `overflowX: "auto"`, `-webkit-overflow-scrolling: touch`, `whiteSpace: "nowrap"`) que previenen colapsos y quiebres de texto irregulares en las 12 lenguas soportadas.
- **Protección Safe-Area para Hardware Real:** Inclusión de `calc(10px + var(--safe-top, 0px))` y `calc(16px + var(--safe-bottom, 0px))` en cabeceras y cuerpos de modales para evitar invasiones visuales por el notch, cámara frontal punch-hole y barra de gestos de Android.

### 3. Síntesis Acústica Táctica Canónica (`TacticalAudioEngine.ts`)
- **Ampliación de Métodos de Audio Operativo:** Incorporación de `playNotification()` y `playHangup()` como métodos estáticos canónicos en el motor piezoeléctrico Web Audio API, eliminando dependencias de archivos de sonido externos y garantizando latencia cero.

### 4. Pila de Navegación LIFO & Registro de Retorno (`BackHandlerRegistry.ts`)
- **Blindaje del Botón Atrás Físico:** Interceptación jerárquica LIFO en sub-estados de escaneo de cámara, modales hijos y visores de medios antes del cierre del modal padre, evitando desorientación o pérdida accidental de contexto táctico.

### 5. Auditoría de Integridad Lingüística (i18n)
- **Consistencia Multilingüe en 12 Idiomas:** Verificación completa de paridad en los diccionarios de localización (`ar`, `de`, `en`, `es`, `fr`, `it`, `ja`, `ko`, `pt`, `qu`, `ru`, `zh`) sin claves huérfanas ni duplicadas.

---

## 📱 Certificación en Hardware Físico Real

### 1. Pruebas de Despliegue en Hardware Real
- **Motorola Moto G22 (`ZT322B386P` - Android 12 / hawaiip):** Despliegue limpio del APK oficial de producción firmado con keystore de 4096 bits. Verificación en Logcat de JNI (`libred_mobile.so`), servidor loopback `127.0.0.1:7333`, conexión SSE (`/api/events`) y 0 crashes o excepciones no controladas.
- **Lenovo Tab M8 (`HA2CHKZ2` - Android 13 / TB305XU):** Despliegue limpio del APK oficial. Validación de renderizado a 60 FPS, adaptabilidad en pantalla ancha y estabilidad de transporte de malla P2P.

### 2. Auditoría y Control de Integridad
- **Pre-Build Hygiene Check:** 100% de paridad en los archivos maestros del sistema (`v126.0.0`) y 100% identidad en los 3 destinos web (`pre_build_check.js`).
- **Verificación Estática TypeScript:** `tsc --noEmit` completado con 0 errores.
- **Backend Rust:** `cargo check -p red_node` finalizado limpiamente con 0 errores.
