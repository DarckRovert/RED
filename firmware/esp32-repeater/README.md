# Repetidor Autónomo Solar de Bajo Costo (~$15 - $20 USD) para RED

Este módulo contiene el firmware de código abierto y las especificaciones de hardware para construir y desplegar **Nodos Repetidores Autónomos** de la red **RED Sovereign Mesh OS**. 

Permite crear una infraestructura de telecomunicaciones soberana e indestructible desplegando nodos en tejados, árboles o colinas, alimentados indefinidamente por energía solar sin depender de teléfonos móviles ni de la red eléctrica.

---

## 1. Lista de Materiales (Bill of Materials - BOM)

| Componente | Especificación Técnica | Costo Estimado |
| :--- | :--- | :---: |
| **Microcontrolador + Radio** | **Heltec WiFi LoRa 32 V3** (ESP32-S3 + Semtech SX1262) o **LilyGO T-Beam** (US915 / EU868) | ~$14.00 - $18.00 USD |
| **Batería Recargable** | Celda de Ion-Litio 18650 (3.7V, 3000-3500 mAh con protección PCM) | ~$3.00 - $4.00 USD |
| **Panel Solar** | Panel Fotovoltaico Monocristalino 5V / 2W a 3W (Resistente a intemperie IP65) | ~$2.50 - $4.00 USD |
| **Caja Estanca** | Gabinete de plástico ABS para exteriores con prensaestopas PG7 | ~$2.00 - $3.00 USD |
| **Antena** | Antena dipolo omnidireccional sub-GHz 915MHz / 868MHz (3dBi a 5dBi, conector IPEX/SMA) | ~$2.00 USD |
| **Total Estimado** | | **~$23.50 - $31.00 USD** (o ~$16 USD comprando en lote) |

---

## 2. Esquemático de Conexión Eléctrica y Solar

```
        ┌─────────────────────────┐
        │   Panel Solar 5V (2W)   │
        └───────────┬─────────────┘
                    │ (+) & (-)
                    ▼
        ┌─────────────────────────┐
        │ Conector 5V / USB Heltec│
        │   (Controlador TP4054)  │
        └───────────┬─────────────┘
                    │
            ┌───────┴───────┐
            │               │
            ▼               ▼
    ┌───────────────┐ ┌───────────────────────────┐
    │ Batería 18650 │ │ Heltec WiFi LoRa 32 V3    │
    │ 3.7V 3400mAh  │ │ (ESP32-S3 + SX1262)       │
    └───────────────┘ └─────────────┬─────────────┘
                                    │ RF IPEX
                                    ▼
                              ┌───────────┐
                              │  Antena   │
                              │ 915MHz 5dB│
                              └───────────┘
```

El módulo Heltec V3 incorpora un circuito de carga de batería Li-Ion nativo (conector JST 1.25mm de 2 pines). El panel solar se puede conectar directamente a los pines `5V` y `GND` de la placa o a través de un puerto USB-C sellado.

---

## 3. Instrucciones de Compilación y Flasheo

### Requisitos Previos:
- [Visual Studio Code](https://code.visualstudio.com/) con la extensión **PlatformIO IDE** instalada.
- Cable USB-C de datos conectado al microcontrolador.

### Pasos de Flasheo:
1. Abrir la carpeta `firmware/esp32-repeater/` en VS Code / PlatformIO.
2. Seleccionar el entorno correspondiente en la barra inferior de PlatformIO:
   - `env:heltec_wifi_lora_32_v3` (para módulos Heltec V3 ESP32-S3).
   - `env:lilygo_t_beam` (para módulos LilyGO T-Beam ESP32).
3. Compilar y cargar el firmware:
   ```bash
   pio run --target upload
   ```
4. Abrir el monitor serie para verificar el arranque:
   ```bash
   pio device monitor
   ```
   Deberás observar:
   ```
   =======================================================
   🚀 RED Sovereign Mesh OS — Repetidor Autónomo Solar
   Versión Firmware: 1.0.0
   =======================================================
   ✅ Radio LoRa SX1262 inicializada correctamente
   👂 Centinela en escucha activa (Duty cycle optimizado)...
   ```

---

## 4. Algoritmos Implementados en el Repetidor

1. **Desencapsulación de Malla Soberana:** Valida el número mágico `0x52454401` (`RED\x01`) en el encabezado binario de 96 bytes.
2. **Filtro Bloom Rotativo de 2048 bits:** Permite procesar y deduplicar miles de paquetes diarios utilizando menos de 256 bytes de memoria RAM, eliminando por completo los bucles infinitos de retransmisión.
3. **Poda y Decremento TTL:** Si un paquete llega con $\text{TTL} \le 1$, el repetidor lo suprime automáticamente para preservar el espectro electromagnético. Si tiene $\text{TTL} > 1$, decrementa el salto y lo reemite.
4. **Jitter de Desfase Anti-Colisión:** Introduce un retardo estocástico de 30 a 120 ms antes de cada transmisión para desincronizar nodos repetidores vecinos y evitar colisiones destructivas en el aire.
5. **Cero Retención de Claves Privadas:** El repetidor opera en modo "ciego" (*zero-knowledge relay*); no almacena ni necesita conocer las claves de cifrado de los usuarios para encaminar su tráfico.
