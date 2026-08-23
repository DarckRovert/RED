# RED — Sovereign Mesh OS v57.0.0
> **Build Code:** `57000` | **Release Channel:** `stable-p2p` | **Protocol Version:** `RED/57.0-NOISE-PQC`

Plataforma táctica de comunicaciones descentralizadas y soberanas fuera de red (Off-Grid) con criptografía post-cuántica (Kyber-768 / Dilithium), canales E2E Noise XK, enrutamiento en malla P2P multi-radio (BLE + WiFi Direct + WebRTC + MQTT Blind Relay) y experiencia táctica avanzada de nivel producción.

---

## [57.0.0-modular-architecture] - 2026-08-22

### Sovereign Tactical Master Edition — Clean Modular Architecture, Zero-Bloat & Universal Multi-Device Synergy

**Modularización Integral de Arquitectura Frontend & Descomposición de Monolitos**
- `src/store/`: Descomposición completa del God Store monolítico `useRedStore.ts` en **Zustand Slices modulares** con tipado estricto: `uiSlice.ts`, `authSlice.ts`, `chatSlice.ts`, `contactsSlice.ts`, `callSlice.ts`, `emergencySlice.ts`, `socialSlice.ts` y despacho de eventos en tiempo real aislado en `messageDispatcher.ts`.
- `src/api/`: Reestructuración del cliente HTTP Axum en módulos especializados: `types.ts`, `core.ts`, `client.ts`, `emergency.ts`, `channels.ts`, `ai.ts`, `sensors.ts`, `economy.ts`, `index.ts`.
- `src/lib/`: Reorganización de 34 motores planos en subdirectorios temáticos de dominio: `crypto/`, `ai/`, `emergency/`, `audio/`, `sensors/`, `storage/`, `network/`.
- `src/components/showcase/`: Fragmentación de la landing page `RedShowcaseLanding.tsx` (3,175 LOC) en 10 submódulos atómicos (`LandingHeader`, `LandingHero`, `LandingBentoAndMatrix`, `LandingMeshSimulator`, `LandingModuleCatalog`, `LandingInteractiveLabs`, `LandingUseCasesAndArchitecture`, `LandingFooterAndModals`, `types.ts`, `catalogData.ts`).
- `src/components/settings/`: Fragmentación de `SettingsModal.tsx` (1,304 LOC) en 9 pestañas temáticas (`AppearanceTab`, `CallsTab`, `AudioTab`, `StorageTab`, `PrivacyTab`, `MeshTab`, `IdentityTab`, `BackupTab`, `UpdatesTab`).
- `src/components/sidebar/`: Fragmentación de `Sidebar.tsx` (1,149 LOC) en `SidebarHeader.tsx`, `ConversationList.tsx`, `ContactList.tsx` y `types.ts`.
- `src/components/call/`: Fragmentación de `CallScreen.tsx` (1,337 LOC) en `CallHeader.tsx`, `CallVideoGrid.tsx`, `CallConnectingOverlay.tsx`, `CallControls.tsx` y `CallStatsModal.tsx`.
- `src/components/chat/`: Encapsulación modular de `ChatHeader.tsx` en `ChatWindow.tsx`.

**Blindaje Nativo Rust & Estabilización de Compilación Workspace**
- `Cargo.toml`: Unificación canónica de versión `v57.0.0` (Build `57000`) en todo el workspace (`core`, `node`, `red_mobile`, `blockchain`, `client`).
- `core/src/network/node.rs`, `core/src/protocol/group.rs`, `node/src/api.rs`: Limpieza y resolución de dependencias de `libp2p_yamux` y `red_core`. Verificado con `cargo check --workspace` y unit tests con Exit Code 0.

**Validación Multi-Dispositivo en Hardware Real (Moto G + Tablet Lenovo)**
- Despliegue en limpio verificado mediante `adb` en Motorola Moto G (`ZT322B386P`) y Lenovo Tab (`HA2CHKZ2`).
- Ejecución en segundo plano con Foreground Service `RedNodeService` y carga exitosa de la biblioteca nativa `libred_mobile.so` ARM64.
- Interfaz adaptativa con soporte multi-columna en tablet y HUD táctico optimizado para navegación por gestos.

---


## Binarios Oficiales para Descarga Directa

| Archivo | Descripción | Plataforma |
| :--- | :--- | :--- |
| **`red-v57.0.0-latest.apk`** | Instalador Universal Oficial v57.0.0 | Android 7.0+ (ARM64) |
| **`red-latest.apk`** | Enlace canónico de última versión | Android 7.0+ (ARM64) |

> **Web App:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)
