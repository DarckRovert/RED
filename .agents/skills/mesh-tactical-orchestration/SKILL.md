---
name: mesh-tactical-orchestration
description: Diagnóstico, calibración y orquestación de la red mesh táctica de RED (LoRa TDMA, Geohash Spatial Routing, repetidores solares autónomos ESP32-S3 y transporte satelital LEO).
---

# Skill: Orquestación Táctica de Malla RED (LoRa TDMA, Geohash & Solar Repeaters)

Esta habilidad proporciona procedimientos operativos estandarizados (SOPs) y runbooks para auditar, calibrar y desplegar la pila de red mesh soberana de **RED v98.0.0**.

---

## Capacidades Principales:
1. **Planificador LoRa TDMA:** Diagnóstico de supertramas de 2000 ms, balanceo de slots (0-7 deterministas por FNV-1a, slot 8 baliza, slot 9 contienda CSMA/CA) y verificación de canal limpio.
2. **Enrutamiento Espacial Geohash:** Configuración de granularidad espacial (Geohash longitud 4 ~39km vs longitud 6 ~1.2km) y validación de poda DTN para transporte satelital o mulas de datos móviles.
3. **Flota de Repetidores Solares Autónomos ESP32-S3:** Pautas de flasheo con PlatformIO, diagnóstico de pines SPI para Heltec WiFi LoRa 32 V3, voltajes TCXO (1.8V), telemetría de batería y dimensionamiento de filtros Bloom (2048 bits).

---

## Comandos y Procedimientos de Diagnóstico:

### 1. Validación de Pruebas Unitarias de Malla
```powershell
# Ejecutar suite de poda espacial Geohash
node client/app/scripts/test-geohash-spatial-pruning.js

# Ejecutar suite de planificador TDMA LoRa
node client/app/scripts/test-lora-tdma-scheduler.js

# Ejecutar integración de transporte satelital LEO
node client/app/scripts/test-phase10-satellite-transport-integration.js
```

### 2. Parámetros Críticos de Hardware (Heltec LoRa 32 V3):
Al desplegar o modificar firmware en `firmware/esp32-repeater/`:
- **Pines SPI SX1262:** `SCK=9, MISO=11, MOSI=10, NSS=8`. Mandatorio ejecutar `SPI.begin(9, 11, 10, 8)` antes de `radio.begin(...)`.
- **Oscilador TCXO:** Configurar tensión TCXO a `1.8V` en `radio.begin(..., 8, 1.8)` para evitar descalibración térmica y fallas de enganche PLL (-2 chip not found).
- **Consumo Energético:** Operar MCU a 80 MHz (`setCpuFrequencyMhz(80)`). El consumo en escucha centinela debe permanecer por debajo de 12 mA.

### 3. Matriz de Slots TDMA:
- **Supertrama:** 2000 ms
- **Duración de Slot:** 200 ms
- **Slots 0–7:** Asignación pseudo-aleatoria pero determinista basada en `FNV-1a(nodeId) % 8`.
- **Slot 8:** Reservado para balizas de sincronización de reloj y telemetría de red.
- **Slot 9:** Ranura de contienda CSMA/CA con backoff exponencial para nodos transitorios.
- **Prioridad >= 9 (SOS):** Transmisión inmediata con interrupción de supertrama para protección de vidas.
