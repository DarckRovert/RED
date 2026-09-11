---
description: Suite automatizada de verificación de resiliencia de malla, TDMA LoRa, Geohash spatial pruning y enlaces satelitales
globs: ["client/app/src/lib/mesh/**", "client/app/scripts/test-*"]
---

# Workflow: Verificación de Malla Táctica y Resiliencia (`/mesh-verification`)

Este flujo de trabajo ejecuta empíricamente la batería completa de pruebas de transporte de malla, coordinación TDMA, filtrado espacial Geohash y conmutación por falla (failover).

## Requisitos Previos:
- Terminal en `client/app/`
- Node.js >= 20

---

## Batería de Pruebas de Malla:

### 1. Enrutamiento Espacial Geohash & Poda DTN
Verifica el filtrado de cuadrantes Geohash, distancia Manhattan, podas a 1 y 2 caracteres, y la indexación en IndexedDB v2:
```powershell
node client/app/scripts/test-geohash-spatial-pruning.js
```
*Criterio de Aprobación:* 8/8 pruebas aprobadas (100%), 0 fallos.

### 2. Planificador TDMA LoRa (Superframe 2000ms)
Verifica la sincronización de supertrama de 2000 ms, división en 10 slots de 200 ms, asignación determinista FNV-1a en slots 0-7, contienda CSMA/CA en slot 9, y bypass preemptivo de ráfagas SOS (prioridad >= 9):
```powershell
node client/app/scripts/test-lora-tdma-scheduler.js
```
*Criterio de Aprobación:* 7/7 pruebas aprobadas (100%), 0 fallos.

### 3. Pasarela de Transporte Satelital LEO & Poda Downlink
Verifica la integración del gateway bent-pipe satelital con filtrado de paquetes por vector de pasada orbital:
```powershell
node client/app/scripts/test-phase10-satellite-transport-integration.js
```
*Criterio de Aprobación:* 11/11 pruebas aprobadas (100%), 0 fallos.

### 4. Resiliencia de Enlace WebRTC Mesh
Verifica la negociación P2P local, recuperación de glare (ofertas cruzadas simultáneas) y reconexión ICE:
```powershell
node client/app/scripts/test-webrtc-mesh-call-resilience.js
```
*Criterio de Aprobación:* 6/6 pruebas aprobadas (100%), 0 fallos.

### 5. Conmutación por Falla Celular a DTN
Verifica la conmutación transparente cuando la conectividad IP o celular se degrada a cero:
```powershell
node client/app/scripts/test-cellular-dtn-failover.js
```
*Criterio de Aprobación:* 5/5 pruebas aprobadas (100%), 0 fallos.

---

## Verificación de Compilación y Tipado TypeScript:
Tras ejecutar las pruebas unitarias de scripts, es mandatorio validar que no existan regresiones estáticas:
```powershell
cd client/app
npx tsc --noEmit
```
*Criterio de Aprobación:* Código de salida 0, cero errores de tipo.
