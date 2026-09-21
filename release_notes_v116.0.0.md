# RED v116.0.0 — Arquitectura Bio-Cibernética Unificada: MaleCNS + Neocórtex + GNWT + Kuramoto

**Fecha de Release:** 2026-09-21  
**Build Code:** 116000  
**SHA-256:** (ver SHA256SUMS.txt)

---

## 🧠 Nuevas Capacidades

### Espacio de Trabajo Neuronal Global (GNWT)
- `GlobalWorkspaceConsciousnessBus.ts`: Implementación del bus singleton de ignición consciente con inhibición lateral (θ = 0.60).
- Evaluación en tiempo real de 8 flujos sensoriales/tácticos: Isquemia Crítica, Evasión EMCON, Emboscada RF, Choque Balístico, Colisión Looming, Sorpresa Cinemática, Feromonas de Alarma y Consenso Kuramoto.
- Cálculo de Información Integrada de Tononi (Φ_approx) y Energía Libre Variacional de Friston (F).
- Actuación directa sobre DLPFC humano para síntesis de directivas MEDEVAC/EMCON.
- Throttling reactivo a 10 Hz (UI_THROTTLE_MS = 100) — 60 FPS estables garantizados.

### Sincronización de Enjambre Kuramoto P2P
- `RingAttractorEngine.ts`: Ecuación diferencial de acoplamiento de fase: Δθ = K · e^(-Δt/τ) · sin(θ_remote - θ_local).
- Parámetro de Orden R = |1/N · Σ e^{iθ_j}| para coherencia de enjambre.
- Discretización compacta a 1 byte ([0,360) → [0,255]) para LoRa Slot-8 TDMA.
- `meshProtocol.ts`: FLAG_KURAMOTO_SYNC = 0x40 (Bit 6 reservado).
- `meshRouter.ts`: Ingesta de fase remota y broadcast reactivo `broadcastKuramotoPhase()`.

### HUD Táctico — Pestaña CONSCIOUS_SWARM_BUS
- `MaleCnsConnectomeHUD.tsx`: Nueva tercera pestaña táctica.
- Medidor de ignición GNWT con umbral dinámico y estado IGNITED/LATENT.
- Monitores en vivo de Φ (IIT Tononi) y F (Friston Free Energy).
- Visualizador circular de fase Kuramoto local vs. enjambre con vector R.
- Monitor estigmérgico de feromonas activas (ALARM, TRAIL, AGGREGATION).
- Fix React 19: eliminado acceso a `ref.current` durante render → estado reactivo `isDraggingUI`.

### Copilot AI Bridge
- `ConnectomeCortexBridge.ts`: Snapshot de estado consciente (ignición, Φ, F, R) inyectado en contexto del copiloto LLM.

---

## 🐛 Correcciones Críticas de Estabilidad

### Estabilización de Memoria y Radio (OOM Fix)
- `messageDispatcher.ts`: Early-exit gates para `P2P_VOICE_BURST` → previene desbordamiento de memoria por ráfagas de audio.
- `messageDispatcher.ts`: Early-exit para beacons `SOS_BEACON_V1` → elimina contaminación de chats con datos crudos.

### Higiene de Autenticación / SOS
- `authSlice.ts`: Intercepción de `SOS_BEACON_V1` antes de degradación a texto plano.
- `authSlice.ts`: Mapeo explícito de tipos de mensajes tácticos para prevenir pérdida de tipo en el store.
- `MeshSosBeaconEngine.ts`: Sincronización proactiva con RedStore → `SOSEmergencyBanner.tsx` se activa correctamente.

### Estabilización de NodeMap
- `NodeMap.tsx`: Eliminada dependencia `[realGPS]` que causaba bucle destructivo del watcher GNSS.
- `NodeMap.tsx`: Deadband cinemático (5m / 8s) en `broadcastLocation` — reducción de tráfico RF.
- `NodeMap.tsx`: Integración de `meshRouter.peers` + `blePeers` → visibilidad completa de pares mesh.
- `NodeMap.tsx`: Normalización `lat/lng` vs `latitude/longitude` — sin pérdida de nodos remotos.

---

## ✅ Suite de Tests (No-Regresión Total)

| Suite | Resultado |
|-------|-----------|
| `test-global-workspace-consciousness.js` | **12/12 PASS** |
| `test-human-neocortex-engines.js` | **28/28 PASS** |
| `test-crypto-core.js` | **4/4 PASS** |
| `pre_build_check.js` | **12/12 SSOT @ v116.0.0** |
| ESLint | **0 errores, 0 advertencias** |
| `tsc --noEmit` | **0 errores** |

---

## 📦 Instalación

```bash
# Android (APK directo)
adb install -r red-v116.0.0-release.apk

# Web
https://darckrovert.github.io/RED/
```

**SHA-256:** Ver `SHA256SUMS.txt` adjunto al release.
