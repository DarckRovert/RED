# 🛡️ RED — Sovereign Mesh OS v52.0.0
> **Build Code:** `52000` | **Release Channel:** `stable-p2p` | **Protocol Version:** `RED/52.0-AUTONOMOUS-LQS`

Plataforma táctica de comunicaciones soberanas, descentralizadas y resistentes a censura fuera de red (Off-Grid). Diseñada para operar sin infraestructura celular ni servidores centrales mediante enlaces híbridos BLE GATT, WiFi Direct, LoRa y WebRTC DataChannels.

---

## 🚀 Novedades Principales en v52.0.0

### 1. Sincronización Dinámica de Perfiles & Difusión de Identidad Multi-Nodo (En Vivo)
- **Emisión Reactiva de Perfil:** Al actualizar el alias, biografía o teléfono en la Bóveda de Identidad, el nodo emite en simultáneo un paquete estructurado `profile_update` por broadcast mesh (`ffffffff...`) y a todos sus contactos directos.
- **Balizas Enriquecidas `IDENTITY_ANNOUNCE`:** Incorporación de biografía, teléfono y versión dentro de los paquetes de baliza de radio local BLE y WiFi Direct.
- **Ingesta Dinámica de Contactos:** Reconciliación en memoria y almacenamiento local automático en todos los nodos pares al recibir actualizaciones de perfil.
- **Resolución de Nombres en Caliente:** `Sidebar`, `ChatWindow` y `ContactProfileModal` leen prioritariamente el nombre actualizado de los pares descubiertos en la malla.

### 2. Smart Dynamic Mesh & Enrutamiento Autónomo Multi-Transporte LQS
- **Fast-Path Unicast:** Si el par de destino está directamente conectado vía WebRTC DataChannel (54 Mbps, <30ms), el mensaje se entrega directamente por WiFi Direct y **se cancela la emisión por BLE/LoRa**, ahorrando batería y descongestionando el espectro de radio.
- **Conmutación Dinámica LQS:** Si la conexión directa no está disponible, conmuta a BLE GATT (<100ms) validando métrica de calidad de enlace LQS (`LQS >= 20%`).
- **Multi-hop Flood con Filtro LQS:** Para pares no directos, retransmite a través de vecinos con `LQS >= 15%`, suprimiendo bucles y enlaces degradados.
- **Auto-Asociación Proactiva de Enlaces BLE en Caliente:** Negociación de MTU (512B) e intercambio de identidades en segundo plano tan pronto como se detecta una baliza `RED-`.

### 3. Criptografía Post-Cuántica (ML-KEM-768 + ECDH P-256)
- **Motor Híbrido Dual:** Protección contra ataques retrospectivos "Harvest Now, Decrypt Later" integrando ML-KEM-768 (FIPS 203) con ECDH P-256 clásico.
- **Benchmark en Tiempo Real:** Verificación interactiva de rendimiento e integridad bit a bit de claves de sesión derivadas.

### 4. Optimizaciones de Compilación y Estabilidad
- **Heap de Gradle Ampliado a 4GB:** Optimización de empaquetado para modelos neuronales ONNX y motores WASM.
- **Validación en Hardware Físico:** Verificado en Xiaomi Redmi Note 14 (Android 16), Lenovo Tablet (Android 15) y Motorola Moto G22 (Android 12) con 0 errores de compilación y 0 crashes.

---

## 📱 Instaladores Oficiales Adjuntos

| Archivo | Plataforma | Descripción |
| :--- | :--- | :--- |
| **`red-v52.0.0.apk`** | Android 7.0+ (ARM64) | Instalador APK Universal v52.0.0 Oficial |
| **`red-latest.apk`** | Android 7.0+ (ARM64) | Enlace canónico a la última versión estable |

---

> 🌐 **Página Web Oficial:** [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/)  
> 📖 **Documentación:** [Manual de Usuario](https://github.com/DarckRovert/RED/blob/main/USER_MANUAL.md) | [Manual del Administrador](https://github.com/DarckRovert/RED/blob/main/ADMIN_MANUAL.md)
