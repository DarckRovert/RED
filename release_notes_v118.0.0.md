# RED v118.0.0 — Blindaje Concurrente, Resiliencia Táctica y Estabilidad de Malla P2P

**Fecha de Release:** 2026-09-23  
**Build Code:** 118000  
**SHA-256:** (ver SHA256SUMS.txt)  
**Canal:** stable-p2p  

---

## 🛡️ Nuevas Capacidades y Fortalecimiento Arquitectónico

### Blindaje Concurrente & Sanidad del Ciclo de Vida de React 19
- **Erradicación de Mutaciones en Render (`MaleCnsConnectomeHUD`):** Corrección del acceso a referencias mutables durante la fase de renderizado de React 19. Sincronización desacoplada mediante `useEffect` reactivo, eliminando fallas de reconciliación y *state tearing* en el canvas 3D y bucle WebGL.
- **Eliminación Total de Temporal Dead Zone (TDZ) en Llamadas de Malla (`useSquadCallMesh`):** Reestructuración topológica de 10 funciones auxiliares de señalización, SDP, WebRTC y audio antes de los hooks de ciclo de vida, previniendo `ReferenceError: Cannot access before initialization` en desmontajes o transiciones rápidas de llamada.
- **Hoisting y Enrutamiento Limpio de Señalización (`IncomingCallBanner` & `CalculatorScreen`):** Reubicación de controladores de llamadas y escuchas de teclado físico previo a guardas condicionales (`early return`), garantizando que la interceptación LIFO de retroceso físico (`BackHandlerRegistry`) responda de forma determinista.

### Resiliencia de Enlace de Malla y Prevención de Fugas de Recursos
- **Gestión Higiénica de Clientes MQTT y Reintentos (`companionSyncEngine`):** Erradicación de clientes MQTT "zombies" y temporizadores huérfanos durante el ciclo de búsqueda de brokers de relevo. Cada intento de relé cierra explícitamente sus sockets y temporizadores si no se recibe confirmación (ACK) antes de conmutar al siguiente broker o recurrir al enlace P2P local.
- **Protección Top-Level de Promesas Asíncronas:** Conversión del ejecutor de promesas en sincronizador encapsulado con IIFE y captura de rechazos `try/catch` de nivel superior, erradicando eventos `UnhandledPromiseRejection` en el WebView Android.
- **Depuración de Paquetes Enlazados (Bonded DTN Storage):** Enrutamiento DTN con asignación estricta de nonces base y purga en cascada de fragmentos enlazados ante la recepción de `DELIVERY_ACK`.

### Paridad de Localización Internacional e Integridad de Plataforma
- **Cobertura de 11 Idiomas al 100%:** Sincronización y restauración completa de 11 claves críticas de interfaz en todos los catálogos lingüísticos (`es`, `en`, `de`, `fr`, `it`, `ja`, `ko`, `pt`, `ru`, `zh`, `ar`, `qu`).
- **Alineación Total de Contratos Rust Backend (`red-node`):** Verificación de 100% de paridad en tipos de datos entre el servidor nativo y la interfaz TypeScript (`/api/status`, `/api/identity`, `/api/conversations`).
- **Protección de Firmas Android Dual (v1 + v2):** Habilitación explícita de firmas APK v1 (JAR Signature) y v2 (APK Signature Scheme) en Gradle para compatibilidad universal desde Android 7.0 (API 24) hasta Android 15.

---

## 🐛 Registro de Correcciones Específicas

| ID | Componente | Descripción de la Causa Raíz y Solución Aplicada |
|---|---|---|
| **FIX-01** | `MaleCnsConnectomeHUD.tsx` | Eliminada mutación de `architectureModeRef.current` durante render; sincronizado vía `useEffect`. |
| **FIX-02** | `useSquadCallMesh.ts` | Resuelto fallo de TDZ; `cleanupAll`, `broadcastSignal` y `setupVAD` reordenados antes de `useEffect`. |
| **FIX-03** | `companionSyncEngine.ts` | Eliminado antipatrón `new Promise(async)`; captura global de errores y cierre higiénico de clientes MQTT huérfanos. |
| **FIX-04** | `IncomingCallBanner.tsx` | Hoisting de `handleAccept` y `handleReject` por encima de la guarda condicional `return null`. |
| **FIX-05** | `CalculatorScreen.tsx` | Funciones `clearAll` y `triggerHaptic` declaradas antes del listener del `BackHandlerRegistry`. |
| **FIX-06** | `meshRouter.ts` | Asignación de nonce canónico en encolado DTN y purga de prefijos de shard en recepción de ACKs. |
| **FIX-07** | `NetworkPanel.tsx` | Corrección de rutas relativas de importación para `dnsTunnelEngine` y `sniSpoofEngine`. |
| **FIX-08** | `locales/*.ts` | Integración de claves ausentes de Workspace y navegación tablet en los 11 archivos de localización. |
| **FIX-09** | `build.gradle` | Habilitación de `v1SigningEnabled true` y `v2SigningEnabled true` en la configuración de firma de producción. |

---

## 📋 Verificación y Certificación de Calidad

- **TypeScript Compiler (`tsc`):** 0 errores.
- **ESLint / React Compiler:** 0 errores (2063 warnings de tipado flexible).
- **Next.js Turbopack:** 5/5 rutas estáticas pre-renderizadas exitosamente.
- **Release Integrity Audit:** 27/27 comprobaciones aprobadas al 100%.
- **Firmas Criptográficas:** APK firmado con RSA 4096-bit SHA-256 with RSA.
