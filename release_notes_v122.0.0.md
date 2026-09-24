# RED v122.0.0 — Ecología Multi-Especie, Dinámicas de Depredación y Física Elástica de Hábitat

**Fecha de Release:** 2026-09-24  
**Build Code:** 122000  
**SHA-256:** 88E8513447DD1BE528E0D2DE0ACCA25A1A6B3D141F1A736E60FA7472DA5ACDF2  
**Canal:** stable-p2p  

---

## 🧬 Nuevas Capacidades y Fortalecimiento Arquitectónico

### 1. Dinámicas Ecológicas Multi-Especie & Física Elástica de No-Penetración (`BiocyberneticHabitatEngine.ts`)
- **Resolvedor Elástico de Cuerpos Sólidos (Non-Penetration Solver):** Introducción de radios de colisión biológicos específicos (`Drosophila`: 0.38 m, `Ant`: 0.32 m, `C. elegans`: 0.22 m). Resolución de penetración espacial en `physicsTick(dt)` a 60 Hz con impulsos elásticos simétricos del 52% que erradican completamente el solapamiento o apilamiento de masas en la arena.
- **Depredación Realista Formicidae ➔ Drosophila (`ANT_CHASING_PREY` / `ANT_BITING_PREY`):** Las hormigas en forrajeo detectan moscas a menos de 0.95 m y aceleran a 1.45 m/s para darles caza, asestando mordiscos mandibulares que extraen biomasa celular al llegar a distancia de contacto (<0.38 m).
- **Arco Reflejo Giant Fiber Evasivo ante Amenaza Looming (`EVADING_PREDATOR_ANT`):** Las moscas detectan la aproximación visual de hormigas depredadoras; a <1.15 m entran en alerta y desvían su curso, y a <0.75 m activan el circuito Giant Fiber con un salto balístico de escape a 3.6 m/s, descarga de octopamina y giro de 180°.
- **Integración con Lóbulos Ópticos del Conectoma (`OpticLobeEngine.ts`):** En el organismo líder controlado por el cerebro MaleCNS FlyWire, la cercanía física de una hormiga se proyecta automáticamente a los detectores de colisión LC4/LPTC como sombra en aproximación rápida (*looming threat*).
- **Distancia Social y Territorial Conespecífica (`TERRITORIAL_SPACING`):** Repulsión angular mutua entre moscas que previene concentraciones artificiales a distancias menores a 0.65 m.
- **Reflejo Mecanosensorial en Nematodos (`MECHANOSENSORY_TOUCH_REVERSAL`):** *C. elegans* reacciona al contacto físico de insectos (<0.45 m) con un retroceso retrógrado instantáneo a 1.3 m/s y una pirueta Omega-turn evasiva.
- **Calibración Cinética de Alimentación:** Desaceleración a 0.08 m/s para absorción estática de glucosa con probóscide, eliminando la anomalía de carreras descontroladas sobre el alimento.

### 2. Mecánica y Renderizado Táctico del Nido Formicidae (`TacticalHabitatModal.tsx`)
- **Nido Central de la Colonia:** Señalización gráfica en el Canvas mediante halo biofísico de feromonas gradiente ámbar/carmesí, perímetro perimétrico táctico punteado y túnel de apertura subterránea.
- **Dispersión Centrífuga de Hormigas:** Las hormigas recolectoras descargan alimento en el nido (<0.85 m), activan un temporizador de desacoplamiento de feromonas (`nestExitCooldownSec = 2.8 s`) y son impulsadas en una trayectoria radial hacia afuera a 1.35 m/s para forrajear por toda la arena sin estancarse en el centro.
- **Dispersión en Reproducción A-Life:** La mitosis genera descendencia a una distancia radial segura de 0.85 m - 1.15 m, evitando el nacimiento intra-corporal de clones.

### 3. Conectoma MaleCNS FlyWire en Lazo Cerrado con el Hábitat
- Puente bidireccional físico-cerebral plenamente operativo con traducción de CPG de marcha trípode, quimiotaxis antenal en el Ring Attractor E-PG y respuesta de torpor metabólico.

---

## 🛡️ Rendimiento Móvil & Verificación Empírica en Hardware

### 1. Certificación en Hardware Físico Real
- **Lenovo Tab M9 (`HA2CHKZ2` - Android 13 / TB305XU):** Despliegue limpio del APK Release firmado con keystore de 4096 bits. Carga de binarios JNI `libred_mobile.so`, loopback `127.0.0.1:7333`, renderizado continuo a 60 FPS.
- **Motorola Moto G22 (`ZT322B386P` - Android 12 / hawaiip):** Despliegue limpio, conexión SSE activa (`/api/events`), radar táctico y transporte físico sin bloqueos en el hilo UI.
- **Integridad de Release:** 27 de 27 verificaciones superadas con éxito en `check_release_integrity.js`.
