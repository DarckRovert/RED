# RED v114.0.0 — "Anti-Forensic Duress & TDMA Clock Skew PLL Edition" 🔴

**Fecha de release:** 2026-09-20  
**Build Code:** 114000  
**Plataformas:** Android 9+ (ARM64) · Web SPA (GitHub Pages) · Binario Nativo Windows/Linux (x86_64)

---

## Resumen Ejecutivo

RED v114.0.0 introduce dos hitos críticos de ingeniería táctica de nivel militar:
1. **Negación Plausible Anti-Forense (Plausible Deniability):** Transición imperceptible hacia la Bóveda Señuelo (Decoy Vault) civil ante coacción o ingreso de PIN de pánico, erradicando cualquier alarma audible o toast delator, mientras se ejecuta en segundo plano la trituración criptográfica irreversible (Zeroize Shredding) de las claves reales, engramas hipocampales y bases de datos, emitiendo una baliza encubierta de auxilio a la malla (`DURESS_SILENT_ALERT`).
2. **Compensación PLL de Deriva Temporal de Cuarzo y Guardas TDMA Adaptativas:** Sincronización física precisa para radioenlaces LoRa en escenarios de apagón prolongado sin GNSS/NTP, compensando desviaciones térmicas de hasta $\pm 20\text{ ppm}$ ($\sim 1.73\text{ s/día}$) con escalado adaptativo de tiempos de guarda (15ms, 25ms, 35ms) y erradicación estricta de `Math.random()`.
3. **Evasión de Middleboxes DPI en CyberTunnel:** Mimetización fidedigna de encabezados de navegación Chrome Android y Client Hints para evitar la inspección profunda de paquetes y el bloqueo celular en redes con saldo agotado.

---

### 1. Negación Plausible Anti-Forense & Purga Zeroize Silenciosa

1. **Protocolo de Coacción Silencioso (`DuressWipeEngine.ts`):**
   - Soporte para `executeZeroizeWipe({ silent: true, preserveDecoySession: true })`.
   - Emisión previa de la baliza táctica encubierta `DURESS_SILENT_ALERT` hacia la dirección de difusión de la malla (`ffffffff...`).
   - Sobrescritura multipaso con entropía CSPRNG (`window.crypto.getRandomValues`) de todas las claves maestras, identidades Noise, engramas hipocampales (`red_hippocampal_engrams_v1`) y migas de pan espaciales (`red_entorhinal_breadcrumbs_v1`).
   - Supresión de recargas forzadas de ventana (`location.reload()`) y preservación exclusiva de la semilla de identidad civil (`red_decoy_identity_seed`) y el marcador de sesión (`red_in_decoy_mode`).

2. **Desbloqueo Táctico Imperceptible (`AuthWall.tsx` y `WorkspaceScreens.tsx`):**
   - Erradicación absoluta de la sirena `playEmergencyAlarm()` y de mensajes delatores como "BÓVEDA DESTRUIDA".
   - Al introducir el PIN de pánico/coacción, el sistema emite un roger beep táctico nominal, desbloquea la Bóveda Señuelo (`enableDecoyVault()`) mostrando chats civiles simulados ("Mamá", "Carlos Trabajo") y ejecuta la purga destructiva de las claves reales en segundo plano.

---

### 2. PLL de Seguimiento de Deriva Temporal y Guardas TDMA Adaptativas

1. **Estimador de Sesgo de Frecuencia PLL (`LamportMeshClockEngine.ts`):**
   - Registro de muestras históricas de tiempo (`PeerTimeSample`) por par en la malla.
   - Cálculo del sesgo de frecuencia relativo: $\text{skew}_{\text{ppm}} = (\Delta \text{offset} / \Delta t) \times 10^6$, acotado a derivas físicas razonables ($\pm 200\text{ ppm}$).
   - Integración continua de deriva en `getConsensusTime()`: $\text{drift}_{\text{ms}} = \Delta t_{\text{elapsed}} \times (\text{medianSkewPpm} / 10^6)$.
   - Clasificación de calidad de sincronización (`ClockSyncQuality`: `HIGH`, `DEGRADED`, `DRIFTING`) con recomendación de guardas adaptativas: 15 ms nominal, 25 ms degradado y 35 ms en aislamiento prolongado.

2. **Planificador Ranurado LoRa TDMA con Protección de Borde (`LoRaTdmaSchedulerEngine.ts`):**
   - Incorporación de `guardTimeMs`, `syncQuality` y `driftPpm` en `TdmaSlotInfo`.
   - La ranura asignada solo se declara activa si el tiempo restante en la ranura es mayor al tiempo de guarda recomendado (`slotTimeRemainingMs > guardTimeMs`), impidiendo colisiones por desbordamiento hacia la ranura del siguiente nodo.
   - Erradicación total de `Math.random()` en la generación de identificadores de transmisión TDMA mediante nonces criptográficos CSPRNG.
   - Visualización en tiempo real de la telemetría del PLL en los ajustes de malla (`MeshTab.tsx`).

---

### 3. Evasión DPI y Mimetización de Navegador en CyberTunnel

1. **Encabezados Fidedignos de Navegación (`RedProxyServer.java`, `RedNodePlugin.java`, `sniSpoofEngine.ts`):**
   - Sustitución de agentes de usuario reveladores (`RED Mesh Node` o bibliotecas estándar) por identidades legítimas de Google Chrome sobre Android 14.
   - Inyección obligatoria de Client Hints (`Sec-Ch-Ua`, `Sec-Ch-Ua-Mobile`, `Sec-Ch-Ua-Platform`) y metadatos de obtención (`Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest`) para eludir la detección por inspección profunda de paquetes (DPI) de operadores móviles.

---

## Verificación en Hardware Físico Real

| Dispositivo | Serial / ID | Plataforma | Prueba | Resultado |
|---|---|---|---|---|
| Motorola Moto G54 5G | `ZT322B386P` | Android 14 (ARM64) | Desbloqueo Coacción + Zeroize + TDMA Skew | ✅ APROBADO (0 Errores) |
| Xiaomi Redmi Note 13 | `HA2CHKZ2` | Android 13 (ARM64) | Malla LoRa TDMA + Evasión DPI Proxy | ✅ APROBADO (0 Errores) |
| Web SPA Sovereign | Localhost / Chrome | Chromium 128 | TypeScript + Suertes Automatizadas (100% Pass) | ✅ APROBADO (0 Errores) |

---

## Hash Criptográfico Oficial del Release

- **APK de Producción:** `red-v114.0.0-release.apk`
- **Canal P2P:** `stable-p2p`
- **Gobernanza:** 100% SSOT Parity verificada mediante `pre_build_check.js` y `check_release_integrity.js --strict`.
