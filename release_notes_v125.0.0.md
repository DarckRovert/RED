# RED v125.0.0 — Blindaje Legal Soberano, Salón de la Fama Open Source & Ecosistema Web Tri-Mirror

**Fecha de Release:** 2026-09-25  
**Build Code:** 125000  
**Canal:** stable-p2p  

---

## 🏛️ Nuevas Capacidades y Fortalecimiento Arquitectónico

### 1. Blindaje Legal Soberano & Clickwrap Digital Gate (`LegalAgreementManager.ts` & `DigitalContractGateModal.tsx`)
- **Single Source of Truth (SSOT) de Cumplimiento Legal:** Creación de `LegalAgreementManager.ts` como árbitro autoritativo inmutable para la gestión de términos, descargos de responsabilidad y licencias.
- **Clickwrap Digital Contract Gate:** Interceptación del arranque en `page.tsx` mediante un modal de consentimiento expreso e informado (`DigitalContractGateModal.tsx`). Bloqueo total de acceso al sistema operativo RED hasta la firma afirmativa de 4 descargos obligatorios:
  - Términos de Servicio y EULA bajo licencia GNU AGPL-3.0.
  - Descargo Operativo de Emergencias y Canales de Rescate VHF/UHF.
  - Regulación de Espectro Radioeléctrico, Potencia ERP y Cumplimiento LoRa Sub-GHz.
  - Descargo Médico Táctico TCCC, Soporte Vital y Monitoreo Biométrico.
- **Resiliencia de Consentimiento en Android (Native Storage Fallback):** Recuperación y persistencia mediante `SecureStoragePlugin` (`isContractAcceptedNativeFallback()`), previniendo bloqueos involuntarios cuando el recolector de memoria de Android WebView purga `localStorage`.

### 2. Salón de la Fama & Atribución Open Source (`CREDITS.md`, `credits.html` & `HallOfFameData.ts`)
- **Atribución Inmutable y Reconocimiento Comunitario:** Honores formales a 19 pioneros y autores fundamentales de la informática, criptografía, radiofrecuencia, neurobiología y sistemas distribuidos.
- **Reconocimiento al Creador:** Mención de honor y atribución de autoría y arquitectura principal a Rodrigo Alejandro Vega Rojas (alias "DarckRovert") por la concepción y diseño integral de RED Sovereign Mesh OS.
- **Interfaz Interactiva de Salón de la Fama (`HallOfFameModal.tsx`):** Componente táctico con buscador en tiempo real, filtros por categoría (Core, Criptografía, RF LoRa, Neuro, Medicina, GIS, Comunidad), insignias de licencia (AGPLv3, GPLv3, MIT, Apache 2.0, BSD) y enlaces directos a repositorios fuente.
- **Integración Omnipresente en el OS:** Accesible a través de la pestaña 6 de `LegalComplianceModal.tsx`, la pestaña de Privacidad, la pestaña de Actualizaciones y el pie de página de la landing page.

### 3. Ecosistema Web de 3 Destinos (Triple-Mirror Serving Architecture)
- **Sincronización Automatizada Bit-a-Bit:** Los documentos web estáticos esenciales (`terms.html`, `privacy.html`, `credits.html`) residen y se sincronizan de forma idéntica en:
  1. *Raíz (`./`)*: Respaldo canónico y portal GitHub Pages companion.
  2. *Next.js SPA (`client/app/public/`)*: Activos estáticos públicos para cliente local y PWA.
  3. *Servidor Rust Axum (`node/src/web/`)*: Archivos embebidos físicamente en el binario `red-node` mediante `include_str!()` en `api.rs`.
- **Nuevas Rutas Públicas en red-node:** Endpoints `/credits` y `/credits.html` servidos directamente por el daemon en Rust con cabeceras `Content-Type: text/html; charset=utf-8` y exclusión de autenticación de sesión.
- **Gobernanza Automatizada:** Actualización atómica de los 3 destinos integrada en `scripts/bump_version.js` y validación estricta de paridad binaria en `scripts/pre_build_check.js` (Paso 3.1) y `client/app/scripts/check_release_integrity.js` (CHECK 6).

### 4. Gobernanza Nivel 15 & Nivel 16
- **Nivel 15 (OTA Update Engine):** Búsqueda canónica de assets por nombre exacto (`red-latest.apk`), verificación de hash SHA-256 pre-instalación e invalidación de caché.
- **Nivel 16 (Blindaje Legal, Atribución Open Source & Ecosistema Web de 3 Destinos):** Normativa estricta que prohíbe modificaciones aisladas en satélites y exige paridad de versiones en la matriz completa de 29 componentes.

---

## 🛡️ Rendimiento Móvil & Verificación Empírica en Hardware

### 1. Certificación en Hardware Físico Real
- **Lenovo Tab M9 (`HA2CHKZ2` - Android 13 / TB305XU):** Despliegue limpio del APK oficial de producción firmado con keystore de 4096 bits. Verificación en Logcat de JNI (`libred_mobile.so`), servidor loopback `127.0.0.1:7333`, WebRTC y renderizado a 60 FPS sin bloqueos en el hilo UI.
- **Motorola Moto G22 (`ZT322B386P` - Android 12 / hawaiip):** Despliegue limpio del APK oficial. Conexión SSE (`/api/events`), radar táctico y transporte de malla activos sin caídas (0 crashes, 0 excepciones no controladas).

### 2. Auditoría Integral y Resiliencia
- **Release Integrity Check:** 39/39 comprobaciones superadas con 0 errores y 0 advertencias (`check_release_integrity.js --strict`).
- **Pre-Build Hygiene Check:** 100% de paridad en los archivos maestros del sistema (`v125.0.0`) y 100% identidad en los 3 destinos web (`pre_build_check.js`).
- **Tipado Estático:** TypeScript `tsc --noEmit` con 0 errores.
- **Backend Rust:** `cargo check -p red_node` finalizado limpiamente.
