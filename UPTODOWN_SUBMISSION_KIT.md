# 🛡️ Kit de Publicación y Aprobación en Uptodown — RED v120.0.0

Este documento contiene todos los recursos, textos exactos y el dossier técnico para re-enviar **RED** a la **Consola de Desarrolladores de Uptodown** (`https://www.uptodown.dev/`) y garantizar su aprobación inmediata.

---

## 📌 1. Archivos Listos para Subir

| Tipo de Recurso | Ruta Local en tu PC | Especificaciones |
| :--- | :--- | :--- |
| **APK de Release** | `release-assets/red-v120.0.0-release.apk` *(o `red-latest.apk`)* | v120.0.0, 65.8 MB, Firma Dual v1+v2 Oficial: `CN=RED Sovereign Foundation` |
| **Icono de la App** | `release-assets/store_assets/icon_512.png` | 512 × 512 px, PNG alta resolución |
| **Banner / Cabecera** | `release-assets/store_assets/feature_graphic_1024x500.png` | 1024 × 500 px, Gráfico promocional Cyber/Táctico |
| **Captura 1 (Móvil)** | `release-assets/store_assets/screenshot_phone_1.png` | Radar P2P & Descubrimiento BLE Swarm |
| **Captura 2 (Móvil)** | `release-assets/store_assets/screenshot_2_mobile_swarm_health.png` | Telemetría de Enjambre, Batería & Duty-Cycle |
| **Captura 3 (Tablet/Móvil)**| `release-assets/store_assets/screenshot_4_tablet_tactical_map.png` | Mapa Táctico GPS Offline OpenStreetMap |
| **Captura 4 (Panorámica)**| `release-assets/store_assets/screenshot_tablet_1.png` | Centro de Mando C4ISR & 64 Módulos |
| **Captura 5 (Móvil)** | `release-assets/store_assets/screenshot_phone_2.png` | Brújula 3D & Azimut de Navegación |
| **Captura 6 (Tablet)** | `release-assets/store_assets/screenshot_3_tablet_lenovo_m8.png` | Espacio de Trabajo Nodo Soberano |

---

## 📝 2. Metadatos de la Ficha en Uptodown

### Datos Generales:
* **Nombre de la Aplicación:** `RED — Sovereign Mesh OS & Tactical P2P` *(Evitar poner solo "RED" para que el equipo editorial distinga inmediatamente su propósito especializado)*
* **ID de Paquete:** `f.red.app`
* **Versión:** `118.0.0` (Build `118000`)
* **Categoría Principal:** `Herramientas / Tools` o `Comunicación / Communication`
* **Licencia:** `Open Source (AGPL-3.0)`
* **Sitio Web:** `https://darckrovert.github.io/RED/`
* **Política de Privacidad:** `https://darckrovert.github.io/RED/privacy.html`

### Subtítulo / Descripción Corta (Español):
> Sistema operativo táctico en malla off-grid, cifrado post-cuántico e IA local.

### Descripción Completa (Español):
```text
RED (Sovereign Tactical Mesh OS) es un sistema operativo táctico de comunicaciones descentralizadas y supervivencia off-grid diseñado para operar con CERO dependencia de internet, torres celulares ni servidores centrales.

Convierte tu teléfono en un nodo de malla autónomo capaz de comunicarse mediante radioenlaces Bluetooth Low Energy (BLE), Wi-Fi Direct y hardware LoRaWAN.

CARACTERÍSTICAS PRINCIPALES:

📡 RED EN MALLA DESCENTRALIZADA OFF-GRID
- Mensajería cifrada punto a punto sin señal celular ni internet.
- Enrutamiento multi-salto con tolerancia a desconexión (DTN): los paquetes saltan de nodo en nodo hasta alcanzar su destino.
- Conectividad con radios de largo alcance LoRa (868/915 MHz).

🔐 CRIPTOGRAFÍA MILITAR POST-CUÁNTICA
- Blindaje resistente a computación cuántica mediante ML-KEM (Kyber-768).
- Cifrado simétrico autenticado AES-256-GCM y ChaCha20-Poly1305.
- Perfect Forward Secrecy (PFS) con claves efímeras por paquete.
- Bóveda de coacción con PIN señuelo y autodestrucción criptográfica.

🧭 NAVEGACIÓN Y SENSORES TÁCTICOS 100% OFFLINE
- Brújula táctica 3D con filtrado inercial anti-vibración y rumbo de evacuación.
- Navegación celeste astronómica (efemérides solares y lunares sin GPS).
- Odometría inercial peatonal (PDR) con estimación de posición a ciegas.
- Cartografía vectorial OpenStreetMap con teselas almacenadas en local.

🎙️ COMUNICACIONES DE VOZ Y GUERRA ACÚSTICA
- Walkie-Talkie táctico P2P con códec ultraligero Vocoder LPC / IMA-ADPCM.
- Módem ultrasónico SoundMesh (FSK) para transmitir datos a través del aire mediante audio inaudible.

🤖 INTELIGENCIA ARTIFICIAL LOCAL (AIR-GAP)
- Copiloto táctico con modelos GGUF ejecutados en la CPU del dispositivo.
- Asistente de supervivencia médica (triaje TCCC) y potabilización sin conexión.

100% SOBERANO: Sin publicidad, sin rastreadores y sin telemetría.
```

---

## 📋 3. "Notas para el Revisor" (Reviewer Instructions)

> **Copia y pega este texto en el campo de notas para el equipo de revisión o en el ticket de apelación:**

```text
Estimado equipo editorial de Uptodown:

Agradecemos su revisión. Adjuntamos la versión de producción v120.0.0 de RED. La versión rechazada anteriormente (v108) era una versión preliminar desactualizada que no reflejaba la estabilidad actual del software.

RED es un Sistema Operativo de Comunicaciones en Malla y Navegación Off-Grid, diseñado específicamente para funcionar SIN CONEXIÓN A INTERNET y SIN SERVIDORES mediante enlaces directos entre dispositivos (Bluetooth LE, Wi-Fi Direct y LoRa).

CÓMO PROBAR LA APLICACIÓN EN 2 MINUTOS (MODO STANDALONE EN LABORATORIO):
Al probar la app en una oficina o dispositivo individual (donde no hay otros nodos de radio cerca), los siguientes módulos demuestran su funcionamiento autónomo inmediato:
1. Inicie la aplicación y cree un alias de operador y un PIN de acceso (ejemplo: 123456).
2. En el menú principal o barra lateral:
   - Toque "BRÚJULA": Observará la brújula táctica 3D operando en tiempo real con los sensores inerciales del dispositivo.
   - Toque "MAPA": Podrá explorar el visor cartográfico vectorial offline.
   - Toque "RADAR": Verá el motor de escaneo BLE buscando paquetes de radio en radiofrecuencia local.
   - Toque "COPILOTO IA": Pruebe el asistente táctico que corre en local en la CPU del teléfono sin consultar ninguna API en la nube.
   - Toque "CRIPTO / BÓVEDA": Verifique la generación criptográfica de claves post-cuánticas Kyber-768 (ML-KEM) y Shamir Secret Sharing.
   - Toque "CONECTOMA / VIVARIUM 3D": Observe el gemelo digital en tiempo real y la arena entorrinal WebGL 3D a 60 FPS.

JUSTIFICACIÓN DE PERMISOS DE ANDROID:
- Bluetooth (BLUETOOTH_SCAN, CONNECT, ADVERTISE) y Ubicación: Requeridos obligatoriamente por el sistema operativo Android para emitir y recibir tramas BLE de malla entre dispositivos cercanos sin conexión a internet.
- Llamadas y Contactos (READ_PHONE_STATE, CallScreeningService): Utilizados estrictamente de forma local por el módulo de defensa "Sovereign Shield" para filtrado de llamadas sospechosas en el propio terminal. Ningún dato se transmite a terceros.
- Arquitectura: Compilado para arquitecturas nativas Android ARM64 de 64 bits (arm64-v8a).

La aplicación es completamente de código abierto bajo licencia AGPL-3.0 y cumple rigurosamente con los estándares de privacidad y calidad técnica.
```

---

## 🚀 4. Procedimiento de Re-Envío en la Consola (Paso a Paso)

1. Ingresa a [https://www.uptodown.dev/](https://www.uptodown.dev/) con tu cuenta `darckrovert@gmail.com`.
2. Ve a la sección **Apps** y haz clic sobre **RED**.
3. Cambia el estado a **Editar / Draft** (Borrador).
4. Reemplaza el APK anterior subiendo el archivo:
   `release-assets/red-v120.0.0-release.apk`
5. Actualiza los assets gráficos con los archivos de `release-assets/store_assets/` (Icono, Feature Graphic y Screenshots).
6. Actualiza el título a `RED — Sovereign Mesh OS & Tactical P2P` y pega la descripción oficial.
7. En el apartado de comentarios o notas al editor, pega las **"Notas para el Revisor"** del Punto 3.
8. Haz clic en **Enviar a Revisión (Submit for Review)**.
