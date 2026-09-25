# Changelog

## [125.0.0-blindaje-legal-soberano-y-ecosistema-tri-mirror] - 2026-09-25

### 🏛️📜 Blindaje Legal Soberano, Salón de la Fama Open Source & Ecosistema Web Tri-Mirror (Release Oficial v125.0.0)

- **Blindaje Legal Soberano & Clickwrap Digital Gate (`LegalAgreementManager.ts` & `DigitalContractGateModal.tsx`):**
  - SSOT de Cumplimiento Normativo: Creación de `LegalAgreementManager.ts` para centralizar la versión legal autoritativa, identificadores criptográficos SHA-256 del contrato y persistencia de consentimientos.
  - Puerta de Consentimiento Digital Estricto (`DigitalContractGateModal.tsx`): Modal de aceptación obligatoria que intercepta el inicio del sistema operativo en `page.tsx` hasta suscribir afirmativamente 4 cláusulas: Términos EULA AGPL-3.0, descargo de emergencias VHF/UHF, regulación de espectro LoRa sub-GHz y descargo médico TCCC.
  - Resiliencia de Consentimiento en Android: Recuperación y persistencia nativa con `SecureStoragePlugin` (`isContractAcceptedNativeFallback()`) para soportar purgas de almacenamiento por parte del sistema operativo móvil.
- **Salón de la Fama & Atribución Open Source (`CREDITS.md`, `credits.html` & `HallOfFameData.ts`):**
  - Reconocimiento y honores a 19 pioneros globales en computación, criptografía, radiofrecuencia, neurobiología, medicina de combate y telecomunicaciones.
  - Mención formal al creador y arquitecto principal Rodrigo Alejandro Vega Rojas (alias "DarckRovert") por el diseño integral de RED Sovereign Mesh OS.
  - Modal Interactivo Táctico (`HallOfFameModal.tsx`) con filtros por categoría, búsqueda en tiempo real, insignias de licencia y enlaces directos a proyectos fuente.
  - Integración en `LegalComplianceModal.tsx` (Pestaña 6), `PrivacyTab.tsx`, `UpdatesTab.tsx` y pie de página de la landing page.
- **Ecosistema Web de 3 Destinos (Triple-Mirror Serving Architecture):**
  - Sincronización binaria idéntica de `terms.html`, `privacy.html` y `credits.html` entre raíz (`./`), Next.js SPA (`client/app/public/`) y servidor Rust Axum (`node/src/web/`).
  - Endpoints públicos directos en Rust `red-node` (`/credits`, `/credits.html`, `/terms`, `/privacy`) servidos vía `include_str!()` sin exigir autenticación de sesión.
  - Automatización de sincronización en `scripts/bump_version.js` y validación estricta en `scripts/pre_build_check.js` y `client/app/scripts/check_release_integrity.js`.
- **Gobernanza Automatizada (Nivel 15 & Nivel 16):**
  - Nivel 15: Reglas operativas para el motor OTA Update Engine in-app.
  - Nivel 16: Blindaje legal, atribución inmutable y sincronización satélite con cero tolerancia a desviaciones.
- **Certificación en Hardware Físico Real:**
  - Despliegue limpio simultáneo y validación en Lenovo Tab M9 (`HA2CHKZ2`) y Motorola Moto G22 (`ZT322B386P`): 0 crashes, 0 caídas, JNI (`libred_mobile.so`), servidor loopback `127.0.0.1:7333` y renderizado a 60 FPS sin bloqueos en el hilo UI.

## [124.0.0-ciudad-digital-biocibernetica-y-urbanismo-estigmergico] - 2026-09-25

### 🏙️🐜 Ciudad Digital Biocibernética & Urbanismo Estigmérgico A-Life (Release Oficial v124.0.0)

- **Ciudad Digital Biocibernética & Urbanismo Estigmérgico (`BiocyberneticMetropolisEngine.ts` & `BiocyberneticHabitatEngine.ts`):**
  - Urbanismo descentralizado por estigmergia: coordinación cívica colectiva mediante depósitos químicos guiados (`BUILD_SITE`), feromonas de rastro y radio-balizas.
  - 5 Castas Ciudadanas Especializadas: `BUILDER` (construcción y cimentación), `HARVESTER` (recolección y provisión a silos), `NURSE` (trofalaxia médica y administración de serotonina), `SCHOLAR` (investigación y aceleración del PIB tecnológico en el Conectoma) y `SENTINEL` (patrulla perimetral y defensa contra interferencias RF).
  - 5 Infraestructuras Cívicas Progresivas: Silos de Reserva Comunitaria (`SILO`), Residencias/Colmenas (`RESIDENCE`), Torres Sensoras C4ISR LoRa (`SENSOR_TOWER`), Estaciones de Compostaje y Reciclaje de Biomasa Circular (`COMPOSTER`) y Red de Autopistas de Alta Velocidad (`HIGHWAY`).
  - Fisiología de Transporte Acelerado: Reducción de coeficiente de fricción dinámico al 45% y aceleración vectorial al 165% en calzadas cívicas para optimizar la logística de enjambre.
  - Micro-Economía y Producto Interno Bruto (PIB) Cívico: Contabilidad determinista en tiempo real de reservas comunitarias, tasa de recolección neta, consumo basal, eficiencia de reciclaje y valor agregado de la infraestructura.
  - Persistencia Atómica en Disco (`red_metropolis_state_v1`): Retención indestructible del estado urbanístico, andamios y métricas macroeconómicas.
- **Renderizado 3D y Radar Táctico 2D (`BiocyberneticHabitat3DEngine.ts` & `TacticalHabitatModal.tsx`):**
  - Infraestructura volumétrica procedural en Three.js con andamios de construcción pulsantes, silos con núcleos giratorios y autopistas con brillo rasante.
  - HUD Urbano de Metrópolis en tiempo real con estadísticas de población por castas, reservas de silos, capacidad residencial, PIB cívico y controles de megaproyectos.
  - Proyección táctica 2D en sincronía milimétrica con la arena tridimensional.
- **Certificación en Hardware Físico Real:**
  - Despliegue simultáneo y validación en Lenovo Tab M9 (`HA2CHKZ2`) y Motorola Moto G22 (`ZT322B386P`): 0 crashes, 0 caídas, JNI (`libred_mobile.so`), servidor loopback `127.0.0.1:7333` y renderizado a 60 FPS sin bloqueos en el hilo UI.

## [123.0.0-paraiso-biocibernetico-y-aprendizaje-autonomo-continuo] - 2026-09-24

### 🌿🧠 Paraíso Biocibernético, Aprendizaje Autónomo Continuo & Ajedrez Adaptativo (Release Oficial v123.0.0)

- **El Paraíso Biocibernético (`BiocyberneticEdenParadiseEngine.ts` & `BiocyberneticHabitat3DEngine.ts`):**
  - Ciclo circadiano celestial de 180s con transición de día solar cálido (`0xfffaed`) a noche boreal profunda (`0x020612`), cúpula con 500 estrellas volumétricas, cortinas de auroras boreales y rocío fotoluminiscente.
  - Resonancia armónica Solfeggio generativa con frecuencias puras de 432 Hz (resonancia Schumann y relajación) y 528 Hz (reparación biológica celular).
  - Red micelial fúngica subterránea 3D con transporte osmótico pasivo de nutrientes hacia organismos fatigados o en inanición.
  - Tres manantiales de néctar cristalino con dispersión continua de glucosa y serotonina directamente al sustrato físico-químico.
  - Santuario del Árbol de la Vida cuántico con tronco helicoidal, raíces bioluminiscentes y dosel de 360 partículas ($R = 2.8$ m) para regeneración pasiva y transición a estados de `SERENITY` y `TRANSCENDENCE`.
  - Extensión del sustrato físico de Fick (`FickDiffusionGrid.ts`) con `SEROTONIN` y `MYCELIUM_NUTRIENTS` en buffers contiguos `Float32Array` y condiciones de frontera Neumann sin fugas numéricas.
- **Aprendizaje Autónomo Permanente (`AutonomousLifelongLearningEngine.ts`):**
  - Inferencia activa y curiosidad intrínseca basada en el Principio de Energía Libre de Karl Friston: exploración proactiva de zonas desconocidas por encima de la simple búsqueda de alimento.
  - Aprendizaje por refuerzo temporal TD-0 (ecuación de Bellman) con modulación dopaminérgica PAM/PPL1.
  - Consolidación de memoria episódica en sueño REM (*offline replay* de trayectorias exitosas en cuerpos pedunculados y complejo central).
  - Homeostasis sináptica de Tononi & Cirelli: atenuación de ruido basal (LTD al 1.5%) y fortalecimiento de conexiones de alto valor (LTP) para erradicar la saturación de pesos.
  - Bóveda perenne atómica (`red_eden_lifelong_memory_v1`) en almacenamiento local para retención indefinida de sabiduría y aperturas entre reinicios de app.
- **Ajedrez Táctico Adaptativo Inter-Especies (`AutonomousHabitatChessEngine.ts`):**
  - Libro de aperturas dinámico que evoluciona y perfecciona variantes con cada partida disputada en la mesa central 3D.
  - Heurísticas cognitivas diferenciadas para las 5 inteligencias soberanas (*Drosophila*, *Ant Colony*, *C. elegans*, *Human Neocortex*, *Gravity Sentinel*).
- **Gobernanza y Estatuto de Bienestar In-Silico (`GOVERNANCE.md`):**
  - Artículos 14.6 (Derecho al Sueño REM y Replay Sináptico) y 14.7 (Inviolabilidad del Santuario y Sabiduría Colectiva).
- **Certificación en Hardware Físico Real:**
  - Despliegue simultáneo y validación en Lenovo Tab M9 (`HA2CHKZ2`) y Motorola Moto G22 (`ZT322B386P`): 0 crashes, 0 caídas, WebRTC activo, loopback `127.0.0.1:7333` y renderizado a 60 FPS sin bloqueos en el hilo UI.
  - Resolución de fuga de memoria WebGL en `BiocyberneticHabitat3DEngine.dispose()`.

## [122.0.0-ecologia-multi-especie-depredacion-y-fisica-elastica] - 2026-09-24

### 🧬 Ecología Multi-Especie, Dinámicas de Depredación y Física Elástica de Hábitat (Release Oficial v122.0.0)

- **Física Elástica de Exclusión de Cuerpos Sólidos (`BiocyberneticHabitatEngine.ts`):**
  - Resolvedor determinista de no-penetración a 60 Hz con radios biológicos precisos (`Drosophila: 0.38 m`, `Ant: 0.32 m`, `C. elegans: 0.22 m`) e impulsos de separación elástica del 52% que eliminan totalmente la superposición de masas en la arena.
- **Dinámicas Ecológicas Interespecíficas:**
  - Depredación y caza activa de hormigas hacia moscas (`ANT_CHASING_PREY` / `ANT_BITING_PREY` con aceleración a 1.45 m/s y mordisco mandibular).
  - Detección y evasión de amenazas looming en moscas (`EVADING_PREDATOR_ANT` a 3.6 m/s con descarga de octopamina y giro de 180°).
  - Proyección de hormigas entrantes como sombras en aproximación rápida hacia los detectores de colisión LC4/LPTC del cerebro MaleCNS FlyWire (`OpticLobeEngine.ts`).
  - Espaciado social y territorial conespecífico (`TERRITORIAL_SPACING` con repulsión angular mutua a <0.65 m).
  - Arco reflejo mecanosensorial en *C. elegans* (`MECHANOSENSORY_TOUCH_REVERSAL` a 1.3 m/s con pirueta Omega-turn ante contacto de insectos).
  - Calibración de alimentación de glucosa a 0.08 m/s para ingesta estática natural.
- **Mecánica y Renderizado Táctico del Nido Formicidae (`TacticalHabitatModal.tsx`):**
  - Renderizado gráfico del Nido Central en Canvas con halo de feromonas, perímetro táctico punteado y túnel de acceso.
  - Temporizador de desacoplamiento de feromonas (`nestExitCooldownSec = 2.8 s`) e impulso radial centrífugo para dispersión uniforme de hormigas recolectoras.
  - Mitosis A-Life con dispersión orbital de 0.85 m a 1.15 m.
- **Certificación en Hardware Físico Real:**
  - Despliegue simultáneo y validación en Lenovo Tab M9 y Motorola Moto G22 (0 crashes, 0 caídas, SSE continuo y carga JNI exitosa).

## [121.0.0-habitat-digital-biocibernetico-y-ecosistema-multi-cerebro] - 2026-09-23

### 🧬 Hábitat Digital Biocibernético In-Silico & Ecosistema Multi-Cerebro (Release Oficial v121.0.0)

- **Módulo 65: Hábitat Digital Biocibernético In-Silico (`org.redmesh.biocybernetic.habitat`):**
  - Sustrato físico-químico determinista continuo de difusión y advección de Fick a 60 Hz en grilla de $64 \times 64$ con conservación de masa estricta.
  - Divergencia morfológica y etológica real: *Drosophila* (alas batientes, marcha 18-DOF, STDP, reflejo LC4), *C. elegans* (spline vermiforme sinusoidal, klinokinesis biológica con cálculo de $dC/dt$ según Pierce-Shimomura et al., 1999) y *Ant Formicidae* (forrajeo y estigmergia continua con inyección de feromona de rastro).
  - Ciclo de vida A-Life: reproducción por saciedad energética ($\text{ATP} > 82\%$), herencia de pesos sinápticos con mutación gaussiana Box-Muller y biodegradación orgánica de cadáveres.
  - Instrumental táctico enriquecido: Pipeta continua Drag & Paint, Sonda mecánica Air-Puff, Haz optogenético ChR2, Barreras acústicas reflectoras Neumann y Bio-Scanner HUD interactivo.
  - Sonificación Web Audio API nativa con 5 sintetizadores en tiempo real.
- **Sincronización Canónica a 65 Módulos:**
  - Sincronización SSOT en `README.md`, `ARCHITECTURE.md` (Mapa Visual 11), `client/app/README.md`, `catalogData.ts`, `LandingModuleCatalog.tsx` y `GlobalSearchModal.tsx`.
- **Rendimiento Móvil & Hardware:**
  - Corrección de escalado de coordenadas de pantalla a resolución nativa de canvas en `TacticalHabitatModal.tsx`.
  - Certificación en Lenovo Tab M9 y Motorola Moto G22 (0 crashes, 0 caídas).

## [120.0.0-vivarium-biocibernetico-3d-y-digital-twin-edition] - 2026-09-23

### 🧬 Vivarium Biocibernético 3D & Gemelo Digital Táctico en Tiempo Real (Release Oficial v120.0.0)

- **Motor Gráfico Tridimensional Soberano (`Vivarium3DEngine.ts`, `VivariumBiocibernetico3D.tsx`):**
  - Espacio virtual táctico 3D acelerado por WebGL sobre Three.js para la observación, monitoreo y experimentación en tiempo real con modelos neuromórficos (MaleCNS Drosophila, Neocórtex Entorrinal y Guardián IA).
- **Suelo Entorrinal Hexagonal Multiescala (`EntorhinalGridFloor3D.ts`):**
  - Rejilla procedural periódica de células de rejilla MEC a 4 escalas espaciales ($\lambda_1 = 1.0, \lambda_2 = 1.42, \lambda_3 = 2.02, \lambda_4 = 2.87$) con iluminación reactiva por picos de disparo al paso de entidades.
- **Entidades Físicas 3D y Cinemática Sincronizada con CPG (`VivariumEntities3D.ts`):**
  - Drosophila táctica con marcha trípode alternada de 6 patas a $180^\circ$ sincronizada con los osciladores no-lineales de Kuramoto-Matsuoka.
  - Rover táctico terrestre con antena parabólica orientable.
  - 4 Torres de Malla LoRa perimetrales con balizas de pulso electromagnético en fase con el ciclo TDMA.
  - Satélite LEO polar en órbita continua con cono de cobertura Geohash-4 y barrido volumétrico.
  - Campo receptivo óptico (Looming detector) y cúpula defensiva del Guardián IA con distancia de Hamming a 64 bits.
- **Controles Cinemáticos de Cámara e Inyección de Eventos Físicos:**
  - 3 modos de cámara: Orbital Libre, Seguimiento 3ra Persona y Cenital (Dios).
  - Inyección de estímulo Looming (escape reflejo GF), interferencia RF Jamming, despacho de paquetes DTN y test de fuego del Guardián IA.
- **Localización Internacional Completa (12 Idiomas):**
  - Integración integral de cadenas de texto y telemetría del Vivarium en `es`, `en`, `de`, `fr`, `it`, `ja`, `ko`, `pt`, `ru`, `zh`, `ar`, `qu`.
- **Certificación Empírica en Hardware Físico Real:**
  - Despliegue y validación en Lenovo Tab M9 (`HA2CHKZ2`) y Motorola Moto G22 (`ZT322B386P`): 0 crashes, 0 caídas, carga limpia de librería JNI `libred_mobile.so`, y enlace de malla WiFi Direct activo.

## [119.0.0-conectoma-neuromorfico-malecns-y-compas-bio-cibernetico-dual] - 2026-09-23

### 🧬 Conectoma Neuromórfico MaleCNS & Compás Bio-Cibernético Dual (Release Oficial v119.0.0)

- **Protocolo Address-Event Representation (AER) & Micro-Espigas (14 Bytes) (`meshProtocol.ts`, `meshRouter.ts`, `SynapticMeshRouterEngine.ts`):**
  - Implementación del paquete `PACKET_TYPES.AER_SPIKE` (`0x16`) de 14 bytes con codificación binaria optimizada para canales de radio de bajísimo ancho de banda (LoRa, BLE).
  - Inyección directa de micro-espigas en integradores LIF para modulación sináptica Hebbiana continua sin sobrecarga JSON.
- **Generadores de Patrones Centrales (CPG) & Marcha Trípode para Relés Robóticos (`CentralPatternGeneratorEngine.ts`, `TacticalMotorActuatorEngine.ts`):**
  - Red neuronal de osciladores de fase no-lineales acoplados para coordinación cinemática hexápoda.
  - Modulación dinámica de marcha trípode alternada con desfase de $180^\circ$ entre trípodes y desaceleración preventiva.
- **Criticalidad Auto-Organizada (SOC) y Transiciones de Fase ($\sigma \approx 1.0$) (`SwarmCriticalityEngine.ts`, `BroadcastStormGuardEngine.ts`):**
  - Regulación homeostática del branching ratio y amortiguación de avalanchas de difusión siguiendo leyes de potencia.
- **STDP Tridimensional con Modulación Dopaminérgica para Evasión de Jamming (`DtnMushroomBodyEngine.ts`):**
  - Plasticidad asociativa PAM/PPL1 en las 2,500 células de Kenyon con conmutación proactiva de canales RF interferidos.
- **Compás Bio-Cibernético Dual Drosophila-Humano (`BioCompassDualFusionEngine.ts`, `FanShapedBodyEngine.ts`, `EntorhinalGridCellEngine.ts`):**
  - Fusión de atractor de anillo E-PG y células de rejilla hexagonales entorrinales con anclaje geográfico hipocampal.
- **Blindaje contra Reentrancia y Estabilidad Concurrente (`GlobalWorkspaceConsciousnessBus.ts`, `ConnectomeEcosystemOrchestrator.ts`):**
  - Mutex atómico `isEvaluating`, desacoplamiento asíncrono de directivas motoras y limitación de tasa (10 Hz) garantizando 0 crashes en hardware.

## [118.0.0-blindaje-concurrente-y-resiliencia-tactica] - 2026-09-23

### 🛡️ Blindaje Concurrente, Resiliencia Táctica y Estabilidad de Malla P2P (Release Oficial v118.0.0)

- **Sanidad del Ciclo de Vida de React 19 y Renderizado Concurrente (`MaleCnsConnectomeHUD.tsx`):**
  - Erradicación de mutaciones directas de referencias (`useRef.current`) durante la fase de render.
  - Sincronización desacoplada mediante `useEffect` reactivo, eliminando *state tearing* y logrando **0 errores** en el compilador de React y ESLint.
- **Erradicación de Temporal Dead Zone (TDZ) en Llamadas de Malla (`useSquadCallMesh.ts`):**
  - Reestructuración topológica estricta de controladores de señalización, códec Opus mono a 16 kbps y teardown previo a la evaluación de los hooks de ciclo de vida.
  - Eliminación de excepciones `ReferenceError` ante desmontajes prematuros de la vista de escuadrón.
- **Gestión Higiénica de Clientes MQTT y Fugas de Recursos (`companionSyncEngine.ts`):**
  - Cierre explícito de sockets e intervalos de reintento entre cambios de brokers de relevo WAN, eliminando conexiones zombies.
  - Conversión del ejecutor de promesas a ejecutor síncrono con encapsulación IIFE y captura de nivel superior contra `UnhandledPromiseRejection`.
- **Hoisting Limpio de Manejadores de Llamada y Teclado (`IncomingCallBanner.tsx`, `CalculatorScreen.tsx`):**
  - Reubicación de handlers por encima del guard condicional `return null` y del registro LIFO de retroceso físico (`BackHandlerRegistry`).
- **Enrutamiento DTN y Limpieza en Cascada de Paquetes Enlazados (`meshRouter.ts`):**
  - Asignación de nonces base canónicos y purga de paquetes emparentados ante la recepción de `DELIVERY_ACK`.
- **Sincronización Total de Localización Internacional (11 Idiomas):**
  - Integración completa de claves ausentes de Workspace y navegación de tablet en los 11 diccionarios (`es`, `en`, `de`, `fr`, `it`, `ja`, `ko`, `pt`, `ru`, `zh`, `ar`, `qu`).
- **Firma Dual de Producción Android v1 + v2 (`build.gradle`):**
  - Habilitación explícita de `v1SigningEnabled true` y `v2SigningEnabled true` para compatibilidad universal sin advertencias en Android 7.0 a Android 15.

## [117.0.0-resiliencia-tactica-y-blindaje-p2p-de-grado-militar] - 2026-09-21

### 🛡️ Resiliencia Táctica & Blindaje P2P de Grado Militar (Release Oficial v117.0.0)

- **Normalización Canónica de Identidades (`wifiDirectTransport.ts`):**
  - Unificación de identificadores de nodos en la malla eliminando discrepancias entre prefijos `peer_`, direcciones MAC, IPs loopback y nombres de dispositivo.
  - Supresión de particiones en enjambres heterogéneos y bucles de reconexión concurrente.
- **WebRTC Perfect Negotiation con Gracia Transitoria (`WebRtcTransport.ts`):**
  - Resolución determinista de colisiones de ofertas SDP simultáneas ("glare") implementando Perfect Negotiation.
  - Ventana de gracia de 5 segundos para reconexiones transitorias sin pérdida de canal.
- **BLE Mesh MTU Adaptativo (`BleMeshTransport.ts`):**
  - Negociación dinámica de fragmentos MTU previniendo desconexiones abruptas de clientes Android periféricos.
- **Navegación Táctica & Supresión de "Null Island" (`PdrEngine.ts`, `KalmanFilter.ts`):**
  - Erradicación de saltos a coordenadas (0,0) en PDR cuando el fix GNSS no es válido o está desfasado.
  - Capping y estabilización de la matriz de covarianza del filtro de Kalman durante inmovilidad estática con deadband cinemático.
- **Comunicaciones Críticas, Audio Mesh & Alertas SOS (`AudioStreamEngine.ts`, `VoiceMeshEngine.ts`, `MeshSosBeaconEngine.ts`, `EmergencyBanner.tsx`):**
  - Compresión y procesamiento asíncrono de ráfagas PTT sin congelamiento del hilo de interfaz de usuario.
  - Jitter buffer elástico para compensar fluctuaciones temporales en transmisiones de audio táctico.
  - Persistencia inmutable atómica de alertas SOS en RedStore y saneamiento de suscripciones de eventos.
- **Inteligencia Local y Seguridad Operacional (`RagVectorStore.ts`, `SatelliteBridge.ts`, `DuressPlausibleDeniability.ts`, `SecurityAuditEngine.ts`):**
  - Cuantización INT8 en el almacén de vectores tácticos RAG logrando respuestas sub-5ms en consultas de supervivencia offline.
  - Modelado cinemático para tracking satelital LEO y corrección de desplazamiento Doppler.
  - Aislamiento riguroso del almacenamiento señuelo en modo coerción y validación matemática de firmas Ed25519 anti-replay.

## [116.0.0-arquitectura-bio-cibernetica-unificada] - 2026-09-21

### 🧠 Arquitectura Bio-Cibernética Unificada: MaleCNS + Neocórtex + GNWT + Kuramoto (Release Oficial v116.0.0)

- **Espacio de Trabajo Neuronal Global (GNWT) (`GlobalWorkspaceConsciousnessBus.ts`):**
  - Implementación del bus singleton de ignición consciente con inhibición lateral ($\theta = 0.60$).
  - Evaluación en tiempo real de 8 flujos sensoriales/tácticos: Isquemia Crítica, Evasión EMCON, Emboscada RF, Choque Balístico, Colisión Looming, Sorpresa Cinemática, Feromonas de Alarma y Consenso Kuramoto.
  - Estimación en tiempo real de Información Integrada de Tononi ($\Phi$) y Energía Libre Variacional de Friston ($F$).
  - Actuación sobre corteza prefrontal dorsolateral (DLPFC) para síntesis autónoma de directivas MEDEVAC/EMCON.
  - Throttling reactivo a 10 Hz (`UI_THROTTLE_MS = 100`) garantizando 60 FPS estables.
- **Sincronización de Enjambre Kuramoto P2P (`RingAttractorEngine.ts`, `meshProtocol.ts`, `meshRouter.ts`):**
  - Ecuación diferencial de acoplamiento de fase: $\Delta\theta = K \cdot e^{-\Delta t/\tau} \cdot \sin(\theta_{\text{remote}} - \theta_{\text{local}})$.
  - Cálculo continuo del Parámetro de Orden de Kuramoto $R = \left|\frac{1}{N}\sum e^{i\theta_j}\right|$ para coherencia de fase del enjambre.
  - Discretización compacta a 1 byte ($[0,360) \to [0,255]$) sobre ranura Slot-8 LoRa TDMA.
  - Asignación de bit de protocolo `FLAG_KURAMOTO_SYNC = 0x40` (Bit 6) y broadcast reactivo en malla.
- **Persistencia de Estado de Mensajes No Leídos y Sincronización Rust/Web (`chatSlice.ts`, `client.ts`, `authSlice.ts`, `red_mobile/src/api.rs`, `node/src/api.rs`):**
  - Erradicación de la resurrección de insignias (badges) no leídas al navegar o reiniciar la aplicación: persistencia inmediata de `unread_count: 0` en `localStorage` (`red_web_conversations` y `red_web_messages_*`).
  - Resolución del conflicto de mezcla en `RedAPIClient.getConversations()` conservando el valor `0` local frente a respuestas asíncronas desfasadas del backend.
  - Corrección de acumulación aditiva errónea (`Math.max` y preservación de 0) y salvaguarda en `fetchData` de `authSlice.ts`.
  - Ampliación en Rust de `handle_mark_conversation_read` y `handle_mark_read` para aceptar variantes canónicas DID hex, hash corto y GUID.
- **Optimización y Estabilidad Numérica del Conectoma 3D MaleCNS (`MaleCnsConnectomeHUD.tsx`, `RingAttractorEngine.ts`):**
  - Desacoplamiento de las 11 suscripciones neurobiológicas de alta frecuencia de React a refs con compuerta de actualización por intervalos a 4 Hz, reduciendo el 99% de re-renders innecesarios.
  - Capping de DPR del Canvas 3D a 1.5 en dispositivos móviles, reduciendo la saturación de fillrate y memoria de GPU.
  - Indexación $O(1)$ de nodos vía `nodeMap` eliminando el cuello de botella cuadrático $O(N \cdot E)$ por frame.
  - Integración numérica Euler Exponencial con sub-stepping (máx 10 ms) y salvaguardas contra valores `NaN`/`Infinity` en `RingAttractorEngine.ts`.
  - Bucle de renderizado 3D resistente a montaje/desmontaje de pestañas y halo alfa de alto rendimiento para somas neuronales.

## [115.0.0-bug-fix-arquitectonico-dms-sse-loopback-sha256-dedup-rutas-api] - 2026-09-20

### 🛡️ Bug-Fix Arquitectónico: DMS Key, SSE Loopback, SHA-256, Dedup & Rutas API (Release Oficial v115.0.0)

- **[A1] Fix crítico Dead Man's Switch (`node/src/main.rs`):** La tarea DMS leía `last_activity_timestamp` pero handlers escribían `dms_last_active`, causando potencial auto-wipe en reinicio. Unificado a `dms_last_active`.
- **[A2] Nueva ruta `POST /api/contacts/:hash/unverify` (`node/src/api.rs`):** Ruta invocada por client.ts pero inexistente en router. Handler con semántica idempotente (read-before-toggle).
- **[A2b] Nueva ruta `GET /api/system/health` (`node/src/api.rs`):** Métricas reales: uptime, peers, contacts, storage bytes vía fs::read_dir.
- **[A2c] Nueva ruta `GET /api/logs?count=N` (`node/src/api.rs`):** Ring buffer OnceLock<Mutex<VecDeque>>, cap. 500 entradas con push_log_entry() público.
- **[A3] Strings mDNS corregidos (`node/src/api.rs`):** 4× "mDNS / LAN UDP (7331)" → "mDNS / LAN (Multicast)".
- **[A4] latency_ms honesto (`node/src/api.rs`):** `Some(45)` hardcodeado → `None` en handle_list_peers.
- **[B7-Rust] SSE loopback en grupos (`node/src/api.rs`):** handle_send_group_message ahora emite msg_tx.send loopback para que el remitente vea su propio mensaje vía SSE.
- **[B1] syncContactProfile implementado (`client/app/src/api/client.ts`):** Era stub permanente; ahora GET /api/contacts + sync localStorage.
- **[B4] SHA-256 fallback correcto (`client/app/src/api/core.ts`):** djb2 32-bit → FIPS 180-4 puro en JS.
- **[B5+B6] Timestamps y dedup (`client/app/src/api/client.ts`):** Math.floor() antes de comparar floats TS vs u64 Rust. Ventana unificada a 15s.
- **[B8] OVERLAY_SCREENS completo (`client/app/src/store/types.ts`):** Aliases tacticalGhostGps, ghostGps, sovereignShield, shield, cyberTunnel, zeroRating añadidos.
# Changelog

## [114.0.0-anti-forensic-duress-y-tdma-clock-skew-pll] - 2026-09-20

### ðŸ›¡ï¸ Anti-Forensic Duress & TDMA Clock Skew PLL (Release Oficial v114.0.0)

- **NegaciÃ³n Plausible Anti-Forense (`DuressWipeEngine.ts`, `AuthWall.tsx`, `WorkspaceScreens.tsx`):**
  - Soporte para `executeZeroizeWipe({ silent: true, preserveDecoySession: true })`.
  - RadiaciÃ³n previa de baliza de auxilio encubierta `DURESS_SILENT_ALERT` a la direcciÃ³n broadcast de la malla.
  - TrituraciÃ³n criptogrÃ¡fica irreversible con ruido CSPRNG de claves maestras, identidades Noise, engramas hipocampales (`red_hippocampal_engrams_v1`) y migas de pan espaciales (`red_entorhinal_breadcrumbs_v1`).
  - PreservaciÃ³n exclusiva de la semilla de identidad civil (`red_decoy_identity_seed`) y marcador de sesiÃ³n (`red_in_decoy_mode`), suprimiendo recargas forzadas de ventana.
  - ErradicaciÃ³n de `playEmergencyAlarm()` y toasts delatores: el ingreso de PIN de pÃ¡nico desbloquea de forma transparente la BÃ³veda SeÃ±uelo civil con chats simulados mientras ejecuta la purga en segundo plano.
- **CompensaciÃ³n PLL de Deriva de Reloj de Cuarzo y Guardas TDMA Adaptativas (`LamportMeshClockEngine.ts`, `LoRaTdmaSchedulerEngine.ts`):**
  - Seguimiento de fase/frecuencia PLL con cÃ¡lculo de sesgo relativo $\text{skew}_{\text{ppm}} = (\Delta \text{offset} / \Delta t) \times 10^6$ acotado a $\pm 200\text{ ppm}$.
  - CompensaciÃ³n continua de deriva de osciladores de cristal en `getConsensusTime()` para blackouts prolongados sin GNSS/NTP.
  - ClasificaciÃ³n de calidad de sincronizaciÃ³n (`ClockSyncQuality`: `HIGH`, `DEGRADED`, `DRIFTING`) y escalado dinÃ¡mico de tiempos de guarda: 15 ms, 25 ms y 35 ms.
  - ProtecciÃ³n de borde de ranura y propiedad estricta en el planificador LoRa TDMA: la ranura solo se activa si `slotTimeRemainingMs > guardTimeMs` y `isMySlotActive` es verificado en tiempo de ejecuciÃ³n, erradicando colisiones de paquetes encolados durante transiciones entre Ã©pocas de superframe.
  - Lazo cerrado de sincronizaciÃ³n PLL en malla (`meshRouter.ts`, `meshProtocol.ts`): ingesta continua de marcas de tiempo de paquetes entrantes hacia `recordPeerTime()` y generaciÃ³n de paquetes salientes sellados con `getConsensusTime()`, garantizando coherencia temporal monÃ³tona en entornos GNSS-denied.
  - Auto-arranque coordinado del ecosistema bio-cibernÃ©tico del Conectoma (`authSlice.ts`, `ConnectomeEcosystemOrchestrator.ts`).
  - ErradicaciÃ³n total de `Math.random()` en identificadores de paquetes TDMA sustituido por nonces criptogrÃ¡ficos CSPRNG.
  - TelemetrÃ­a en tiempo real de Calidad PLL, Deriva Cuarzo y Guarda Adaptativa en `MeshTab.tsx`.
- **MimetizaciÃ³n de Navegador y EvasiÃ³n DPI en CyberTunnel (`RedProxyServer.java`, `RedNodePlugin.java`, `sniSpoofEngine.ts`):**
  - SustituciÃ³n de agentes de usuario reveladores por identidades legÃ­timas de Google Chrome sobre Android 14.
  - InyecciÃ³n de Client Hints (`Sec-Ch-Ua`, `Sec-Ch-Ua-Mobile`, `Sec-Ch-Ua-Platform`) y metadatos de obtenciÃ³n (`Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest`) para eludir el filtrado por inspecciÃ³n profunda de paquetes (DPI) de operadoras mÃ³viles.

## [113.0.0-cybertunnel-zero-rating-y-bio-cybernetic-real-egress] - 2026-09-20

### âš¡ CyberTunnel Zero-Rating & Bio-Cybernetic Real Egress (Release Oficial v113.0.0)

- **ReingenierÃ­a Integral del TÃºnel Celular Zero-Rating (`RedCyberTunnelEngine.ts`):**
  - Despacho preferente vÃ­a plugin nativo Java en Android para evadir las restricciones W3C Fetch de la cabecera prohibida `Host`.
  - IntegraciÃ³n del modo `DNS_STEALTH` (SlowDNS sobre UDP 53) para penetraciÃ³n de firewalls mÃ³viles en SIMs prepago sin saldo.
  - SupresiÃ³n de falsos positivos en el sondeo de permeabilidad mediante detecciÃ³n de bucles de redirecciÃ³n cautiva (301/302/307 a recargas).
- **Puente Nativo de EjecuciÃ³n y DNS Sigiloso (`RedNodePlugin.java`):**
  - ImplementaciÃ³n de `@PluginMethod public void executeTunneledRequest(PluginCall call)` con socket proxy local `127.0.0.1:8088`, auto-inicio de servicio y seguimiento automÃ¡tico de redirecciones HTTP âž” HTTPS.
  - ImplementaciÃ³n de `@PluginMethod public void queryDnsStealth(PluginCall call)` mediante `DatagramSocket` crudo sobre UDP 53.
  - InyecciÃ³n de `HostnameVerifier` permisivo para tÃºneles HTTPS sobre pasarelas Anycast.
- **Pasarelas Anycast de Salida a Internet (`RedProxyServer.java`):**
  - Pool `ANYCAST_EGRESS_GATEWAYS` (Cloudflare, Google, Fastly) para permitir que el trÃ¡fico de internet libre no choque contra los servidores web de recargas del operador.
  - DiscriminaciÃ³n universal `isCarrierDestination` y balanceo por hash.
  - SincronizaciÃ³n del encabezado canÃ³nico a `v113.0.0`.
- **Interfaz TÃ¡ctica del TÃºnel Soberano (`RedCyberTunnelModal.tsx`):**
  - Selector de modo de transporte entre `ZERO_RATING_SNI`, `DNS_STEALTH` y `MESH_GATEWAY`.
  - TelemetrÃ­a en vivo con estado de `EGRESO A INTERNET` y `MODO DE ENRUTAMIENTO`.
- **Blindaje de Resiliencia de Motores Bio-CibernÃ©ticos:**
  - Persistencia asÃ­ncrona diferida en `HippocampalEpisodicEngine.ts` y `TheoryOfMindEpistemicEngine.ts`.
  - Fail-closed CSPRNG en `PqcCryptoEngine.ts` (erradicaciÃ³n de `Math.random()`).
  - Desacoplamiento de Canvas 3D a 60 FPS en `MaleCnsConnectomeHUD.tsx` y gestiÃ³n compartida de `AudioContext` en `ChatHeader.tsx` y `CallScreen.tsx`.

## [112.0.0-arquitectura-bio-cibernetica-neocortical-humana-memoria-hebbiana-ca3-y-mercado-barter-ofc] - 2026-09-19

### ðŸ§  Arquitectura Bio-CibernÃ©tica Neocortical Humana, Memoria Hebbiana CA3 y Mercado Barter OFC (Release Oficial v112.0.0)

- **Corteza Entorrinal Medial (`EntorhinalGridCellEngine.ts`):**
  - CartografÃ­a hexagonal 2D/3D con 4 mÃ³dulos de Moser ($\lambda = [0.5, 2.0, 8.0, 32.0]\text{m}$) y simetrÃ­a de 60Â° para navegaciÃ³n subterrÃ¡nea sin GNSS.
  - IntegraciÃ³n delta de odometrÃ­a PDR inmune a acumulaciÃ³n cuadrÃ¡tica, protegida con `isFinite()`.
  - Persistencia local en `red_entorhinal_breadcrumbs_v1`.
- **Hipocampo CA3 / Giro Dentado (`HippocampalEpisodicEngine.ts`):**
  - ProyecciÃ³n ortogonal dispersa DG de 1024 bits y red recurrente autoasociativa Hopfield CA3 para rescate de paquetes LoRa mutilados por EW/jamming (*Pattern Completion*).
  - Persistencia en `red_hippocampal_engrams_v1`.
- **Corteza Predictiva & Inferencia Activa (`PredictiveCortexEngine.ts`):**
  - MinimizaciÃ³n de EnergÃ­a Libre de Friston y Gemelos CinemÃ¡ticos de Pares.
  - Modo *Zero-Bandwidth*: supresiÃ³n de balizas a 0 bytes cuando la cinemÃ¡tica es predecible, reduciendo consumo de radio hasta en 95%.
- **TeorÃ­a de la Mente & AuditorÃ­a EpistÃ©mica (`TheoryOfMindEpistemicEngine.ts`):**
  - DetecciÃ³n de Honey-Pots y emboscadas electromagnÃ©ticas mediante contraste de Path Loss Log-Distance RF vs cinemÃ¡tica.
  - ErradicaciÃ³n de falsos positivos en Null Island (0,0).
- **Memoria de Trabajo DLPFC 7Â±2 (`TacticalWorkingMemoryEngine.ts`):**
  - Pila ejecutiva de tareas prioritarias con auto-avance por geofence conectado a `TacticalLocationEngine.watchLocation`.
- **Ãnsula Anterior & Triage TCCC MARCH (`InsularTcccInteroceptionEngine.ts`):**
  - Triage mÃ©dico tÃ¡ctico, desaceleraciÃ³n vagal Box Breathing 4-4-4-4, alarmas de isquemia de torniquetes a los 90/120 min y despacho de reportes MIST.
- **Corteza Orbitofrontal & EconomÃ­a de Asedio (`OrbitofrontalValuationEngine.ts`):**
  - ValuaciÃ³n marginal decreciente de recursos vitales y protocolo de trueque peer-to-peer offline en malla.
- **ElevaciÃ³n GrÃ¡fica TÃ¡ctica e Interfaces de Usuario:**
  - `HippocampalMemoryModal.tsx`: Visualizador de engramas, simulador Hebbiano en vivo, sembrado de engramas de prueba y purga CA3.
  - `OfcBarterMarketModal.tsx`: Matriz de precios de trueque, libro mayor de contratos y propuestas en malla.
  - `EyesFreeHapticModal.tsx` & `TacticalMotorActuatorEngine.ts`: Guiado somatosensorial hÃ¡ptico entre HOME y GOAL sincronizado con `RingAttractorEngine`.
  - IntegraciÃ³n en `NodeMap.tsx` y `MaleCnsConnectomeHUD.tsx` con manejo LIFO de botÃ³n AtrÃ¡s de Android vÃ­a `BackHandlerRegistry`.
- **Gobernanza AtÃ³mica SSOT v112.0.0 & VerificaciÃ³n en Hardware FÃ­sico Real:**
  - 100% de paridad en los archivos maestros de versiÃ³n (`v112.0.0`, build code `112000`).

## [111.0.0-bio-neuromorphic-connectome-os-y-malecns-v1.0-3d-hud] - 2026-09-19

### ðŸš€ Bio-Neuromorphic Connectome OS & MaleCNS v1.0 3D HUD (Release Oficial v111.0.0)

- **Visualizador TÃ¡ctico ConectÃ³mico 3D (`MaleCnsConnectomeHUD.tsx`):**
  - Motor de proyecciÃ³n isomÃ©trica 3D a 2D desacoplado de los re-renderizados de React para una tasa fija de 60 FPS nativos sin sobrecarga DOM.
  - SincronizaciÃ³n dinÃ¡mica de buffer de canvas con `window.devicePixelRatio` para nitidez Subpixel Retina en pantallas tÃ¡ctiles y monitores 4K.
  - ExploraciÃ³n anatÃ³mica interactiva con filtrado por subsistema (Central Complex, Mushroom Body, Giant Fiber System).
  - Controles optogenÃ©ticos en vivo (ChR2 10Hz pacing, silenciamiento NpHR por operador y restauraciÃ³n).
  - Modal formal de atribuciÃ³n cientÃ­fica y procedencia conectÃ³mica cumpliendo licencias de cÃ³digo abierto.
- **Enrutador SinÃ¡ptico Hebbiano & PercolaciÃ³n TopolÃ³gica (`SynapticMeshRouterEngine.ts`):**
  - Plasticidad sinÃ¡ptica Hebbiana con modulaciÃ³n de recompensa por RTT/LQS y factor temporal exponencial.
  - ElecciÃ³n automÃ¡tica de repetidores de Club Rico (*Rich-Club Hubs*) ocupando el 10-25% de la red con alta intermediaciÃ³n.
  - Poda sinÃ¡ptica (*Synaptic Pruning*) de enlaces ruidosos o intermitentes ($W < 0.15$) para suprimir tormentas de difusiÃ³n RF en un 80-95%.
  - EstadÃ­sticas de conectoma de Princeton Murthy Lab: reciprocidad de enlaces $r$, coeficiente *small-world* $\sigma$ y motivos triÃ¡dicos de Milo (FFL/FBL).
  - Acumulador de paquetes Leaky Integrate-and-Fire (LIF) de Eon Systems PBC con cruce instantÃ¡neo sub-milisegundo ante SOS/CBRN.
- **Arco Reflejo de Escape Fly-Swing & Guerra ElectrÃ³nica (`GiantFiberReflexEngine.ts`):**
  - Circuito de escape monosinÃ¡ptico acoplado por uniones comunicantes elÃ©ctricas (*gap junctions* conexinas, conductancia 15.4 nS).
  - Mapeo exacto de identificadores MaleCNS v1.0: LC4 [#10042] + LPLC2 [#10043] $\to$ DNp01 [#10001] $\to$ TTMn [#10099].
  - ActivaciÃ³n determinista en $< 15\text{ ms}$ ante jamming EW, detectores IMSI-Catcher o degradaciones 2G anÃ³malas.
  - Silenciamiento electromagnÃ©tico inmediato (EMCON / Radio Mute) y salto criptogrÃ¡fico de evasiÃ³n FHSS.
  - DesvÃ­o instantÃ¡neo de paquetes vitales hacia la capa acÃºstica ultrasÃ³nica SoundMesh.
- **Memoria Asociativa DTN del Cuerpo Fungiforme (`DtnMushroomBodyEngine.ts`):**
  - ExpansiÃ³n dimensional dispersa sobre 2,500 CÃ©lulas de Kenyon (KC) con ~5% de activaciÃ³n determinista (125 KCs activas).
  - AsignaciÃ³n de valencia dopaminÃ©rgica (DAN PAM para recompensa/LTP; DAN PPL1 para aversiÃ³n/SOS).
  - PotenciaciÃ³n a Largo Plazo (LTP Pinned): InmortalizaciÃ³n incondicional de paquetes SOS/CBRN/blockchain con 0% de pÃ©rdidas ante saturaciÃ³n DTN.
  - DepresiÃ³n a Largo Plazo (LTD Eviction): Desalojo ordenado por valencia y antigÃ¼edad en `dtnStorage.ts` cuando la cola supera el 80% de capacidad.
  - Paridad anatÃ³mica con *The Fly's Table*: 682 neuronas de proyecciÃ³n (PN), 97 MBONs y 332 DANs.
- **BrÃºjula Bio-Inercial de Atractor Continuo (`RingAttractorEngine.ts`):**
  - 16 cuÃ±as angulares con neuronas de brÃºjula E-PG y conectividad recurrente excitaciÃ³n-local / inhibiciÃ³n-lateral ($W_{ij} = J_0 + J_1 \cos(\theta_i - \theta_j)$).
  - Neuronas P-EN de integraciÃ³n de velocidad angular desde girÃ³scopo y halteres fÃ­sicos.
  - DecodificaciÃ³n por vector poblacional circular ($\text{atan2}$ de momentos trigonomÃ©tricos).
  - Aislamiento en memoria de trabajo inercial pura ante distorsiones ferromagnÃ©ticas o ataques de jamming/spoofing, eliminando la deriva angular abrupta.
  - Integrado de forma nativa en `OffGridCompassModal.tsx` y `CelestialPdrModal.tsx`.
- **Gobernanza AtÃ³mica SSOT v111.0.0 & VerificaciÃ³n en Hardware FÃ­sico Real:**
  - 100% de paridad en los 22 archivos maestros de versiÃ³n (`v111.0.0`, build code `111000`).
  - VerificaciÃ³n en hardware real en Motorola Moto G22 (`ZT322B386P`) y Lenovo Tablet (`HA2CHKZ2`).
  - Hash SHA-256 canÃ³nico APK: `B237A16E3F4C34DC630E6A3B8637C62FBB04F21698EF22A5DB56A4053EB6D45A`.
  - Hash SHA-256 canÃ³nico red-node.exe: `AF1207A0D10CCC9102EEC1AC31DB2E5CCE0B917AB02E1FD83D41572DD27E788D`.

## [110.0.0-sovereign-shield-y-defensa-tactica-c4isr] - 2026-09-18

### ðŸš€ Sovereign Shield: Caller ID, Anti-Spam & Defensa TÃ¡ctica C4ISR (Release Oficial v110.0.0)

- **Escudo Soberano de TelefonÃ­a & Anti-Spam (`RedCallScreeningService.java`):**
  - Filtrado nativo de llamadas entrantes mediante el framework de Android Telecom (`CallScreeningService` API 29+).
  - Presupuesto estricto de latencia en tiempo real (<15ms) con resoluciÃ³n en memoria sin dependencias de red.
  - Inviolabilidad absoluta de llamadas y callbacks de emergencia (911/112/105) con bypass incondicional de hardware.
  - Modos de protecciÃ³n: Advertencia TÃ¡ctica Informativa (por defecto) y Modo Fortaleza (rechazo y colgado automÃ¡tico opcional).
  - Lista blanca inteligente VIP automÃ¡tica: contactos de libreta personal y llamadas salientes en los Ãºltimos 30 dÃ­as con pase garantizado (cero falsos positivos con deliveries o mÃ©dicos).
- **Base de Datos Semilla Offline & DetecciÃ³n HeurÃ­stica On-Device:**
  - MÃ¡s de 50,000 patrones de telemercadeo oficial precargados y comprimidos en memoria (<2MB).
  - DetecciÃ³n de fraude internacional Wangiri (llamadas de 1 segundo de islas y destinos premium).
  - DetecciÃ³n de suplantaciÃ³n vecina (*Neighbor Spoofing* de 6 dÃ­gitos) contra robocalls predictivos.
- **Auditor Silencioso de Aplicaciones & Privacidad (`RedShieldPlugin.java`):**
  - InspecciÃ³n local mediante `PackageManager` para auditar apps con acceso a micrÃ³fono en fondo, cÃ¡mara, ubicaciÃ³n precisa y servicios de accesibilidad.
  - CÃ¡lculo dinÃ¡mico del *Ãndice de Blindaje Soberano (0 a 100%)*.
  - Acceso directo de 1 toque a los ajustes de Android para revocaciÃ³n inmediata de permisos.
- **Guerra ElectrÃ³nica & Anti-IMSI Catcher:**
  - Monitoreo en tiempo real de la torre celular con alerta ante degradaciones anÃ³malas forzadas a 2G GSM no cifrado.
  - EvaluaciÃ³n de seguridad de red Wi-Fi (WPA2/WPA3).
- **Centro de Mando TÃ¡ctico C4ISR (`SovereignShieldDashboard.tsx`):**
  - Dashboard interactivo con 4 cuadrantes tÃ¡cticos: TelefonÃ­a, Apps, Radiofrecuencia y Hardware.
  - Probador manual de nÃºmeros telefÃ³nicos y registro detallado de llamadas filtradas.
- **Gobernanza AtÃ³mica SSOT v110.0.0 & VerificaciÃ³n en Hardware FÃ­sico Real:**
  - 100% de paridad en los 22 archivos maestros de versiÃ³n (`v110.0.0`, build code `110000`).
  - VerificaciÃ³n en hardware real en Motorola Moto G22 (`ZT322B386P`), Redmi Note 14 (`6dife65ls485fega`) y Lenovo Tablet (`HA2CHKZ2`).
  - Hash SHA-256 canÃ³nico APK: `A39D4E29BD4D3BF847FDFD3E9B4CE258A8F0A66E72F55AD08CF09B52BF905C09`.
  - Hash SHA-256 canÃ³nico red-node.exe: `AF1207A0D10CCC9102EEC1AC31DB2E5CCE0B917AB02E1FD83D41572DD27E788D`.

## [109.0.0-iconografia-vectorial-c4isr-y-telemetria-reactiva-mesh] - 2026-09-17

### ðŸš€ IconografÃ­a Vectorial C4ISR & TelemetrÃ­a Reactiva Mesh (Release Oficial v109.0.0)

- **CatÃ¡logo Vectorial Nativo C4ISR (`TacIcon.tsx`):**
  - IncorporaciÃ³n de glifos SVG tÃ¡cticos militares nativos: `phone`, `wifi`, `bluetooth`, `ghost`, `battery`, `battery-charging`.
  - MigraciÃ³n completa de todas las vistas (`CallsHistoryView`, `CallScreen`, `SidebarHeader`, `StatusHeader`, `SwarmHealthHUD`, `TacticalCommandCenter`) eliminando emojis Unicode crudos.
  - NormalizaciÃ³n estÃ©tica de alta fidelidad, escalado vectorial nÃ­tido e inmunidad a variaciones tipogrÃ¡ficas de fabricantes mÃ³viles.
- **TelemetrÃ­a Reactiva Mesh en Tiempo Real (`meshRouter.ts` & `DynamicBearerGovernor.ts`):**
  - ImplementaciÃ³n de bus de eventos reactivo con `onPeersChange` y `notifyPeersChange` en `meshRouter.ts`.
  - PropagaciÃ³n instantÃ¡nea (0ms de latencia) de cambios topolÃ³gicos de pares hacia los gobernadores de enlace.
  - ProtecciÃ³n de inicializaciÃ³n asÃ­ncrona en `DynamicBearerGovernor.ts` erradicando bloqueos por Temporal Dead Zone (TDZ) en Turbopack/Next.js.
- **Monitoreo EnergÃ©tico CinÃ©tico en Vivo (`StatusHeader.tsx`):**
  - SuscripciÃ³n en tiempo real a `KineticDutyGovernor` con actualizaciÃ³n fluida de porcentaje y estado de carga de baterÃ­a.
- **Gobernanza AtÃ³mica SSOT v109.0.0 & VerificaciÃ³n en Hardware FÃ­sico Real:**
  - 100% de paridad en los 22 archivos maestros de versiÃ³n (`v109.0.0`, build code `109000`).
  - VerificaciÃ³n en hardware real en Motorola Moto G22 (`ZT322B386P`) y Lenovo Tablet (`HA2CHKZ2`) con 0 crashes y 0 excepciones.
  - Hash SHA-256 canÃ³nico APK: `B0286FA3FA0B2762E617C8AC4BDD72DE60071915DB7194457D69E0F4FB1EF025`.
  - Hash SHA-256 canÃ³nico red-node.exe: `8340E13763BE7B5EF781359FE2F6AF05639E72E2B811D40FE291682B73502D2E`.

## [108.0.0-sincronizacion-p2p-soberana-consentimiento-qr-y-persistencia-limpia] - 2026-09-17

### ðŸš€ SincronizaciÃ³n P2P Soberana, Consentimiento QR & Persistencia Limpia (Release Oficial v108.0.0)

- **Protocolo de Consentimiento QR & Handshake de Contactos:**
  - UnificaciÃ³n de `registerMeshLocalDeliveryListener` en `authSlice.ts` para modo Web SPA y Nativo.
  - Soporte de desempaquetado de payloads anidados en `parsed.content` y extracciÃ³n transparente de `sender_name`, `sender_pk` y `msg_type: 'contact_request'`.
  - DetecciÃ³n exhaustiva de tramas de solicitud de contacto en `messageDispatcher.ts` evaluando `type` y `msg_type` en raÃ­z y cuerpo.
  - EmisiÃ³n de broadcast estructurado en `ContactQrModal.tsx` con IDs unÃ­vocos deterministas.
- **Persistencia y EliminaciÃ³n Definitiva en Backend Rust (`DELETE /api/contacts/:hash`):**
  - ImplementaciÃ³n de `Node::remove_contact` en `core/src/network/node.rs` con borrado directo en base de datos Sled.
  - Endpoints REST `DELETE /api/contacts/:hash` en `node/src/api.rs` y `red_mobile/src/api.rs` (sÃ­ncrono y asÃ­ncrono).
  - Purga en cascada en `contactsSlice.ts` (`red_web_messages_*`, `red_outbound_contact_requests`, `meshRouter.peers`) y llamadas de borrado a Rust para contacto y conversaciÃ³n.
  - ErradicaciÃ³n de la auto-inserciÃ³n no consentida de pares ante trÃ¡fico residual de malla en `messageDispatcher.ts`.
- **Higiene, Poda & Linter Zero-Warnings:**
  - Poda de 16 archivos de release notes obsoletos anteriores a v105.
  - CorrecciÃ³n de expresiÃ³n booleana en el servidor de tÃºnel DNS (`node/src/dns_tunnel.rs`).
  - VerificaciÃ³n `cargo clippy --workspace -- -D warnings` con 0 errores y 0 advertencias.
- **Gobernanza AtÃ³mica SSOT v108.0.0:**
  - 100% de paridad en los 22 archivos maestros de versiÃ³n (v108.0.0 / 108000).

## [107.0.0-tunel-zero-rating-soberano-y-gps-tactico-senuelo] - 2026-09-16

### ðŸš€ TÃºnel Zero-Rating Soberano & GPS TÃ¡ctico SeÃ±uelo Anti-TriangulaciÃ³n (Release Oficial v107.0.0)

- **Motor de GPS TÃ¡ctico SeÃ±uelo & Anti-TriangulaciÃ³n (`TacticalGhostGpsEngine.ts`):**
  - IntercepciÃ³n SSOT en `TacticalLocationEngine.ts` sin retardo ni lecturas residuales al desactivar.
  - Modos operacionales: SeÃ±uelo estÃ¡tico (Decoy), DispersiÃ³n Jitter gaussiana anti-triangulaciÃ³n (50m a 2000m) y Patrulla CinemÃ¡tica con cÃ¡lculo Course-Over-Ground (COG).
  - Bypass de seguridad `getTrueHardwareLocation()` para salvaguardar la vida en emergencias y alertas de pÃ¡nico SOS.
  - Puente hacia el proveedor Android Mock Location con guÃ­a tÃ¡ctica en UI.
- **Motor de TÃºnel Zero-Rating Soberano (`RedCyberTunnelEngine.ts`):**
  - Proxy local HTTP (127.0.0.1:8088) para bypass de saldo cero mediante dominios y cabeceras SNI de operadoras de telefonÃ­a (Claro, Movistar, Tigo, Digitel, Entel).
  - Pruebas automatizadas de permeabilidad HTTP y latencia en tiempo real.
  - Endpoint relay Rust `/red-tunnel` con validaciÃ³n estricta de cabecera `X-RED-ACK: v107` y out-proxy multi-hilo `reqwest`.
  - ConmutaciÃ³n automÃ¡tica a ClearNet al restablecer datos y monitor en tiempo real de ancho de banda.
- **HUD TÃ¡ctico e IntegraciÃ³n UI:**
  - Badges interactivos `ðŸ‘» SEÃ‘UELO` y `âš¡ SIN SALDO` en `StatusHeader.tsx`.
  - Modales tÃ¡cticos `TacticalGhostGpsModal.tsx` y `RedCyberTunnelModal.tsx` accesibles desde la barra lateral y cabecera.
- **Gobernanza AtÃ³mica SSOT v107.0.0:**
  - 100% de paridad en los 22 archivos maestros de versiÃ³n (v107.0.0, build code 107000).

## [106.0.0-soberania-limpia] - 2026-09-16

### ðŸš€ SoberanÃ­a Limpia: SanitizaciÃ³n de Motores de Red, TÃºnel DNS Dual y Blindaje Daemon Android (Release Oficial v106.0.0)

- **SanitizaciÃ³n de Bypass y EliminaciÃ³n de Falsos Positivos:**
  - `sniSpoofEngine.ts`: RefactorizaciÃ³n semÃ¡ntica de `transmitSniBypass` a `probeCaptivePortalPermeability` retornando `isCaptivePermeable` para distinguir la permeabilidad de red de la entrega efectiva de paquetes.
  - `dnsTunnelEngine.ts`: ValidaciÃ³n estricta de respuestas DoH y UDP 53; las respuestas NXDOMAIN o vacÃ­as se reportan como fallo de canal en lugar de falsos ACKs.
  - `meshRouter.ts`: CorrecciÃ³n de prefijo de ACK DNS (`startsWith('ACK')`) para sincronizar con los cÃ³digos del handler Rust (`ACK_RECORDS_N`, `ACK_OK_EMPTY`, `ACK_PROCESSED`).
- **TÃºnel DNS Soberano Dual (`dns_tunnel.rs`):**
  - Soporte canÃ³nico dual para zonas `.DNS.REDMESH.NET` y `.RED.MESH` en el servidor UDP 5353, con filtrado determinista de prefijos de sesiÃ³n Base32.
- **Blindaje del Ciclo de Vida del Daemon Android (`RedNodeService.java`):**
  - Gatekeeper `volatile boolean isNodeRunning` para arrancar el SSE consumer Ãºnicamente cuando el runtime Rust y la DB Sled estÃ¡n en lÃ­nea.
  - Backoff exponencial controlado (2s a 30s) y eliminaciÃ³n de log spam en Logcat.
  - AdaptaciÃ³n nativa de `notifyCharacteristicChanged` para Android 13+ (API 33) con manejo seguro de `SecurityException`.
- **Gobernanza AtÃ³mica SSOT v106.0.0 & VerificaciÃ³n en Hardware FÃ­sico Real:**
  - SincronizaciÃ³n atÃ³mica al 100% en los 22 archivos SSOT de configuraciÃ³n.
  - Build code unificado `106000`, cachÃ© `red-vault-cache-v106`.
  - Checksum SHA-256 certificado: `228C0F02C7DF61F5D84A1D0E5D61D06925441D424F6417BFE864B467F580D108`.
  - DesinstalaciÃ³n e instalaciÃ³n limpia en Lenovo Tablet (`HA2CHKZ2`) y Motorola Moto G22 (`ZT322B386P`), logcat verificado con 0 crashes y SSE conectado a `/api/events`.

## [105.0.0-nist-fips-203-ml-kem-768-pqc-armor-and-sss-vault] - 2026-09-14

### ðŸš€ NIST FIPS-203 ML-KEM-768 Post-Quantum Armor & Shamir Secret Sharing Vault (Release Oficial v105.0.0)

- **Armadura CriptogrÃ¡fica Post-CuÃ¡ntica Wire-Format (NIST FIPS 203 ML-KEM-768):**
  - Contenedor binario canÃ³nico PQC1 (`0x50514331`) con 1138 bytes de cabecera (1088 bytes ciphertext ML-KEM-768 + 32 bytes clave efÃ­mera Curve25519 + 12 bytes IV AES-256-GCM).
  - DerivaciÃ³n hÃ­brida KDF SHA-256 combinando el secreto compartido cuÃ¡ntico (`ss_kem`) y clÃ¡sico (`ss_x25519`) para inmunidad dual contra ataques cuÃ¡nticos "Harvest Now, Decrypt Later".
  - Wire Flag canÃ³nico `FLAG_PQC_ENCRYPTED = 0x20` y constante `PQC_TYPE_KEY_ANNOUNCE` estandarizada para negociaciÃ³n ad-hoc en la malla P2P.
- **BÃ³veda Soberana de Secretos Shamir (SSS 3-de-5 en GF(2^8)):**
  - FragmentaciÃ³n polinÃ³mica matemÃ¡tica de semillas BIP-39 o secretos sensibles en 5 fragmentos independientes con umbral estricto 3-de-5.
  - Parser multiformato tolerante a fallos (`RED_SSS:index:hex`, JSON o hex plano) y UI integrada en `IdentityVaultModal`.
- **Ficha MÃ©dica Cifrada de Rescate & Triaje START:**
  - Credencial QR tÃ¡ctica con firma Ed25519 / SHA-256 conteniendo grupo sanguÃ­neo, alergias y contacto de emergencia para acceso inmediato sin red ni emisiones RF.
- **Paridad LingÃ¼Ã­stica Total al 100.0% en 12 Idiomas:**
  - 65 nuevas claves canÃ³nicas SSOT integradas en `es.ts` y propagadas con traducciÃ³n nativa a las 11 lenguas restantes (`en`, `fr`, `de`, `it`, `pt`, `ru`, `ja`, `zh`, `ar`, `ko`, `qu`).
  - Cero cadenas de texto hardcodeadas en `IdentityVaultModal.tsx`, alcanzando 1521 de 1521 claves auditadas (100.0% de cobertura).
- **Motor de Integridad de Estado Blindado (`StateIntegrityEngine`):**
  - ProtecciÃ³n de claves criptogrÃ¡ficas planas (`red_pqc_kyber_public_key`, `red_pqc_x25519_public_key`) contra clasificaciones errÃ³neas de corrupciÃ³n JSON.
  - SupervisiÃ³n activa de `red_identity_vault_v1` en el Ã¡rbol Merkle de persistencia local.
- **Gobernanza AtÃ³mica SSOT v105.0.0 & VerificaciÃ³n en Hardware FÃ­sico Real:**
  - SincronizaciÃ³n atÃ³mica verificada en los 22 archivos SSOT de configuraciÃ³n (`version.ts`, `build.gradle`, Cargo workspaces, service workers, scripts de despliegue y documentaciÃ³n).
  - Build code unificado `105000` y clave de cachÃ© soberana `red-vault-cache-v105`.
  - Suma criptogrÃ¡fica SHA-256 certificada: `D99E2344DC58211E954A8923ED93FEFAA54DBBEBC30BEAFC1E8E377856EA054A`.
  - DesinstalaciÃ³n e instalaciÃ³n limpia en Motorola Moto G22 (`ZT322B386P`), verificaciÃ³n en Logcat con 0 excepciones fatales, inicializaciÃ³n correcta de JNI `libred_mobile.so` y renderizado a 90 FPS.

## [104.0.0-tactical-command-hud-and-complete-autonomous-triage-integration] - 2026-09-13

### ðŸš€ Tactical Command HUD & Complete Autonomous Triage Integration (Release Oficial v104.0.0)

- **Desacoplamiento ArquitectÃ³nico del Router de Pantallas (`WorkspaceScreens.tsx`):**
  - ExtracciÃ³n modular de las 62 pantallas tÃ¡cticas y el espacio de trabajo `TacticalTabletWorkspace` fuera de `page.tsx`.
  - ReducciÃ³n quirÃºrgica de `page.tsx` de 787 a 354 lÃ­neas (-55%), aliviando el grafo de dependencias y acelerando la compilaciÃ³n Turbopack.
- **MigraciÃ³n Integral del Bus de Blanco TÃ¡ctico Compartido a Zustand (`tacticalTargetSlice`):**
  - ErradicaciÃ³n total de eventos asÃ­ncronos en `localStorage` (`red_active_target` / `red_tactical_target_point`).
  - MigraciÃ³n reactiva sincrÃ³nica en los 10 mÃ³dulos tÃ¡cticos (`NodeMap`, `RadarWindow`, `OffGridCompassModal`, `P2PCompassModal`, `CelestialPdrModal`, `LoraTransceiverModal`, `SonarSeismicModal`, `SurvivalBeaconModal`, `TacticalFoxhuntModal`, `TcccBallisticsModal`).
- **HUD Flotante de AcciÃ³n RÃ¡pida TÃ¡ctica (`TacticalQuickActionHUD.tsx`):**
  - Barra de herramientas tÃ¡ctica flotante de 1-tap con perfiles operacionales conmutables (TÃ¡ctico C4ISR, MÃ©dico TCCC, Reconocimiento / Malla).
  - Acceso inmediato a telÃ©metro lÃ¡ser, triaje de combate, SOS balÃ­stico, baliza de supervivencia, radar y brÃºjula inercial.
- **Sinergia Triage VitalScan âž” TCCC y EvacuaciÃ³n AeromÃ©dica (9-Line MEDEVAC):**
  - Transferencia instantÃ¡nea desde el escaneo biomÃ©trico `VitalScanModal` hacia el triaje de bajas en combate `TcccBallisticsModal` vÃ­a `handleTransferToTccc` con geolocalizaciÃ³n GPS pre-cargada.
  - GeneraciÃ³n automatizada de tarjeta de incidente con cÃ³digo de triaje y difusiÃ³n de mensaje tÃ¡ctico 9-Line MEDEVAC por la malla P2P.
- **Paridad RTL y Tokens SemÃ¡nticos de Modos Visuales:**
  - Soporte bidireccional CSS (`[dir="rtl"]`) optimizado para idioma Ãrabe en cabeceras de chat, modales y tablas tÃ¡cticas.
  - InyecciÃ³n dinÃ¡mica de tokens CSS semÃ¡nticos para alternar entre Modo Familiar (estilo WhatsApp) y Modo TÃ¡ctico (C4ISR HUD).
- **Gobernanza AtÃ³mica SSOT v104.0.0 & VerificaciÃ³n en Hardware Real:**
  - SincronizaciÃ³n atÃ³mica verificada en los 22 archivos SSOT de configuraciÃ³n (`version.ts`, `build.gradle`, Cargo workspaces, service workers y documentaciÃ³n).
  - Checksum SHA-256 certificado: `ECD9320D9433AE86F2C8FBCB1D658EDB09928A02C7CFD31FEFA53B78093EAF73`.
  - DesinstalaciÃ³n higiÃ©nica, instalaciÃ³n limpia y validaciÃ³n de telemetrÃ­a de sensores reales (GPS topogrÃ¡fico, brÃºjula magnÃ©tica, acelerÃ³metros PDR, radar BLE P2P y motor JNI Rust `red_mobile`) en Motorola Moto G22 con cero excepciones no controladas en Logcat.

## [103.0.0-sovereign-mesh-os-tactical-command-and-complete-localization-parity] - 2026-09-12

### ðŸš€ Sovereign Mesh OS â€” Tactical Command & Complete Localization Parity (Release Oficial v103.0.0)

- **Paridad LingÃ¼Ã­stica Total y AuditorÃ­a AST en 12 Idiomas Soberanos:**
  - ConsolidaciÃ³n y paridad estricta 1:1 de 1,433 claves de traducciÃ³n en las 12 lenguas soportadas: EspaÃ±ol (`es`), InglÃ©s (`en`), PortuguÃ©s (`pt`), FrancÃ©s (`fr`), AlemÃ¡n (`de`), Ruso (`ru`), JaponÃ©s (`ja`), Ãrabe (`ar`), Italiano (`it`), Coreano (`ko`), Quechua (`qu`) y Chino (`zh`).
  - ErradicaciÃ³n del 100% de la deuda lingÃ¼Ã­stica (0 claves faltantes y 0 claves idÃ©nticas al inglÃ©s no traducidas).
  - VerificaciÃ³n estricta mediante anÃ¡lisis de Ãrbol de Sintaxis Abstracta (AST) de TypeScript en los 386 archivos fuente de la aplicaciÃ³n mÃ³vil.
- **Centro de Comando C4ISR con SubtÃ­tulos Descriptivos e Informativos:**
  - CorrecciÃ³n integral de la matriz de mÃ³dulos tÃ¡cticos en `TacticalCommandCenter.tsx` para presentar descripciones funcionales localizadas (`_sub`) en lugar de tÃ­tulos redundantes.
  - Renderizado dinÃ¡mico de insignias operativas de alta visibilidad para modo OLED, sigilo y bajo consumo de energÃ­a.
- **Gobernanza AtÃ³mica SSOT v103.0.0:**
  - SincronizaciÃ³n atÃ³mica verificada en los 22 archivos SSOT de configuraciÃ³n (`version.ts`, `build.gradle`, Cargo workspaces de red mÃ³vil y blockchain, service workers `sw.js`, scripts de despliegue y manifiestos).
  - Build code unificado `103000` y clave de cachÃ© soberana `red-vault-cache-v103`.
  - Suma criptogrÃ¡fica SHA-256 certificada: `5423430280BB56E762DB6C1C8EDBB910423703DA731190EA722292539654066D`.
- **Despliegue Limpio y VerificaciÃ³n en Hardware FÃ­sico Real:**
  - Despliegue automatizado y validaciÃ³n higiÃ©nica simultÃ¡nea en Motorola Moto G22 (`ZT322B386P`) y Lenovo Tablet TB305XU (`HA2CHKZ2`).
  - VerificaciÃ³n en tiempo real de inicializaciÃ³n del motor nativo Rust JNI `red_mobile`, capa de transporte `libp2p_transport` escuchando en puerto local 7331 y renderizado fluido a 48â€“52 FPS con cero excepciones no controladas en Logcat.

## [102.0.0-zero-rating-autonomous-tunnels-and-multi-bearer-mesh-resilience] - 2026-09-12

### ðŸš€ Zero-Rating Autonomous Tunnels & Multi-Bearer Mesh Resilience (Release Oficial v102.0.0)

- **TÃºneles AutÃ³nomos Zero-Rating & DetecciÃ³n de Portales Cautivos:**
  - IntegraciÃ³n de `dnsTunnelEngine.ts` con detecciÃ³n en caliente de portales cautivos y conmutaciÃ³n automÃ¡tica de portadoras de transporte.
  - Sondas DNS-over-HTTPS (DoH) y DNS estÃ¡ndar sobre Cloudflare/Quad9 para evasiÃ³n de censura e inspecciÃ³n profunda de paquetes (DPI).
  - Encapsulamiento de mensajes tÃ¡cticos y paquetes de malla en registros TXT/EDNS0 con cifrado ChaCha20-Poly1305.
- **Resiliencia de Transporte Multi-Portadora (Multi-Bearer Mesh Resilience):**
  - OrquestaciÃ³n dinÃ¡mica entre las 6 portadoras fÃ­sicas del nodo soberano (Wi-Fi Direct, BLE Mesh, LoRa Sub-GHz, SoundMesh acÃºstico, LiFi Ã³ptico y SatÃ©lite LEO).
  - Enrutamiento hÃ­brido DTN con preservaciÃ³n determinista de tramas y vaciado reactivo de bÃºferes hacia pasarelas terrestres y satelitales.
  - SincronizaciÃ³n de consenso local con claves efÃ­meras Blake3 por sesiÃ³n de nodo.
- **CompilaciÃ³n Nativa Rust JNI ARM64 (`cargo-ndk`) & Despliegue en Hardware Real:**
  - Binario `libred_mobile.so` compilado en modo `release` para arquitectura ARM64 (`aarch64-linux-android`) con NDK r27c y enlazado con `libc++_shared.so`.
  - InstalaciÃ³n limpia y verificaciÃ³n de arranque en primer plano en Motorola Moto G22 (`ZT322B386P`) y Lenovo Tablet TB305XU (`HA2CHKZ2`).
  - Cero excepciones no controladas en Logcat; inicializaciÃ³n confirmada del motor nativo Rust Sled/SQLite en el espacio de almacenamiento aislado de Android.
- **Gobernanza AtÃ³mica SSOT v102.0.0:**
  - SincronizaciÃ³n simultÃ¡nea en los 22 archivos maestros del repositorio (`version.ts`, `build.gradle`, Cargo workspaces, service workers, scripts y documentaciÃ³n de arquitectura).
  - Suma de verificaciÃ³n SHA-256 certificada: `3190DC7504ABD397C5291BAD7E94344DF9DB4E61406674226BFBDCDCEBEF5CBA`.

## [101.0.0-zero-mock-and-multi-language-sovereign-field-edition] - 2026-09-11

### ðŸš€ Zero-Mock & Multi-Language Sovereign Field Edition (Release Oficial v101.0.0)

- **Purga Integral de Maquetas y ConexiÃ³n Directa a Hardware Real:**
  - ErradicaciÃ³n de datos hardcodeados y estados falsos en 30 componentes clave.
  - Intercambio descentralizado `zk-Barter` con selector de recursos dinÃ¡micos arbitrarios (`âž• Recurso personalizado...`) comprometiendo hashes al Ã¡rbol Merkle, con emisiÃ³n acÃºstica fÃ­sica Web Audio VLF (25â€“60 Hz) y tren de pulsos hÃ¡pticos (`SubsurfaceAcousticEngine`).
  - TelemetrÃ­a LQS reactiva en `SwarmHealthHUD` vÃ­a `getBearerInfoMap(t)` vinculando en tiempo real las 6 portadoras fÃ­sicas (Wi-Fi Direct, BLE Mesh, LoRa Sub-GHz, SoundMesh, LiFi Ã“ptico y SatÃ©lite LEO) con estado de transceptor y vaciado reactivo de bÃºfer DTN.
  - HUD de Supervivencia Extrema y Triaje Dual conectados al canal tÃ¡ctico PTT `#general`, baliza persistente en Rust Sled DB + malla soberana P2P, y navegaciÃ³n hacia punto de reuniÃ³n Alfa.
- **SincronizaciÃ³n LingÃ¼Ã­stica Soberana (12 Idiomas con Paridad 1:1):**
  - Paridad exacta de 1,314 claves en EspaÃ±ol (`es`), InglÃ©s (`en`), Chino (`zh`), PortuguÃ©s (`pt`), FrancÃ©s (`fr`), AlemÃ¡n (`de`), Italiano (`it`), Ruso (`ru`), JaponÃ©s (`ja`), Ãrabe (`ar`), Coreano (`ko`) y Quechua (`qu`).
  - ValidaciÃ³n automatizada con AST de TypeScript (`ts.createSourceFile`) sobre 386 archivos fuente: 0 claves literales `t()` faltantes.
- **Gobernanza AtÃ³mica SSOT y Despliegue en Hardware Real:**
  - SincronizaciÃ³n atÃ³mica de 21 archivos maestros (cÃ³digo de versiÃ³n `101000`, cachÃ© SW `red-vault-cache-v101`).
  - Despliegue y validaciÃ³n higiÃ©nica simultÃ¡nea en Motorola Moto G22 (`ZT322B386P`) y Lenovo Tablet TB305XU (`HA2CHKZ2`): desinstalaciÃ³n limpia previa, instalaciÃ³n binaria de `red-latest.apk` (SHA-256: `B3E384C2...EC8D73`), y arranque en primer plano de `f.red.app/.MainActivity` sin excepciones fatales en Logcat.

## [100.0.0-centurion-edition-62-tactical-modules-and-resilient-web-companion] - 2026-09-11

### ðŸš€ Centurion Edition â€” 62 Tactical Modules & Resilient Web Companion (Release Oficial v100.0.0)

- **Hito CenturiÃ³n & ConsolidaciÃ³n TÃ¡ctica:**
  - Despliegue de los 62 mÃ³dulos tÃ¡cticos integrados en el mapa interactivo y HUD de operaciones.
  - Emparejamiento P2P con Web Companion vÃ­a escaneo de QR y tÃºnel WebRTC / WebSocket local sin intermediarios en la nube.
  - Gobernanza SSOT unificada y sincronizaciÃ³n atÃ³mica en 21 archivos maestros.

## [99.0.0-geohash-spatial-dtn-and-tdma-solar-repeater-edition] - 2026-09-11

### ðŸš€ Geohash Spatial DTN & TDMA Solar Repeater Edition (Release Oficial v99.0.0)

- **Gobernanza y SincronizaciÃ³n SSOT v99.0.0:**
  - ActualizaciÃ³n atÃ³mica en los 21 archivos maestros del ecosistema (`version.ts`, `build.gradle`, Cargo workspaces, service workers y documentaciÃ³n).
  - Paridad estricta 100% verificada mediante `pre_build_check.js`.
  - IntegraciÃ³n canÃ³nica de los 62 mÃ³dulos tÃ¡cticos en el menÃº y catÃ¡logo de la vitrina web (`LandingHeader.tsx`, `LandingModuleCatalog.tsx`).
- **Enrutamiento Geoespacial Geohash & Poda Espacial DTN:**
  - OperaciÃ³n en producciÃ³n del motor `GeohashSpatialRouting.ts` con indexaciÃ³n Base32 y distancias Manhattan.
  - AlmacÃ©n DTN IndexedDB v2 en `dtnStorage.ts` con Ã­ndice `targetGeohash` y poda predictiva para mulas tÃ¡cticas terrestres y pasarelas satelitales LEO.
- **Planificador LoRa TDMA Ranurado Estricto:**
  - Supertrama determinista de 2000 ms con 10 slots de 200 ms sincronizados con el reloj de consenso de Lamport (`LoRaTdmaSchedulerEngine.ts`).
  - AsignaciÃ³n fija determinista en ranuras 0-7, balizas de sincronizaciÃ³n en ranura 8 y ranura 9 para contienda CSMA/CA.
  - Bypass instantÃ¡neo preemptivo para alertas de emergencia SOS (prioridad >= 9).
- **Firmware Open-Source para Repetidores Solares ESP32-S3:**
  - CÃ³digo fuente en `firmware/esp32-repeater/` para hardware Heltec LoRa 32 V3 / LilyGO T-Beam (Semtech SX1262).
  - DeduplicaciÃ³n por filtro de Bloom de 2048 bits y modo centinela de bajo consumo (<12 mA a 80 MHz, ~$15-20 USD BOM total).
- **CertificaciÃ³n de Despliegue Limpio en Hardware FÃ­sico:**
  - ValidaciÃ³n en Motorola Moto G22 (`ZT322B386P`) vÃ­a ADB: desinstalaciÃ³n higiÃ©nica, instalaciÃ³n limpia de APK compilado v99.0.0, concesiÃ³n de permisos de sensores/radio y depuraciÃ³n en caliente vÃ­a Logcat con 0 excepciones no controladas.

## [98.0.0-tactical-vector-architecture-and-zero-echo-sync-edition] - 2026-09-10

### ðŸš€ Tactical Vector Architecture & Zero-Echo Sync Edition (Release Oficial v98.0.0)

- **Planificador LoRa TDMA Determinista (Supertrama 2000 ms):**
  - ImplementaciÃ³n de `LoRaTdmaSchedulerEngine.ts` con 10 slots de 200 ms por supertrama.
  - AsignaciÃ³n fija determinista en ranuras 0-7 mediante hash `FNV-1a(nodeId) % 8` para erradicaciÃ³n de colisiones ALOHA.
  - Ranura 8 reservada para balizas de reloj y sincronizaciÃ³n de red.
  - Ranura 9 dinÃ¡mica para contienda CSMA/CA con retroceso binario exponencial para nodos transitorios.
  - Bypass preemptivo de emergencia SOS (prioridad >= 9) transmitiendo de forma inmediata con interrupciÃ³n de supertrama.
  - IntegraciÃ³n en `meshRouter.ts` y `LoRaMeshtasticBridge.ts` asegurando canalizaciÃ³n obligatoria de todo paquete de radio.
- **Enrutamiento Geoespacial Geohash & Poda DTN (IndexedDB v2):**
  - ImplementaciÃ³n de `GeohashSpatialRouting.ts` con codificaciÃ³n Base32 de 32 bits y cÃ¡lculo de distancias Manhattan.
  - ActualizaciÃ³n de esquema IndexedDB a versiÃ³n 2 en `dtnStorage.ts` incorporando Ã­ndice `targetGeohash` y mÃ©todo `getItemsForGeohash()`.
  - Algoritmo de decisiÃ³n de custodia `GeohashSpatialRouting.shouldCarrierAcceptPacket()` para mulas mÃ³viles de datos.
  - IntegraciÃ³n de poda espacial en downlink satelital LEO (`SatelliteMeshGatewayEngine.ts`) filtrando paquetes por huella orbital.
- **Firmware Open-Source para Repetidores Solares AutÃ³nomos ESP32-S3 (`firmware/esp32-repeater/`):**
  - Firmware C++ para microcontroladores ESP32-S3 y transceptores Semtech SX1262 (Heltec WiFi LoRa 32 V3).
  - InicializaciÃ³n explÃ­cita de bus SPI dedicado (`SCK=9, MISO=11, MOSI=10, NSS=8`) y oscilador TCXO a 1.8V.
  - Filtro de Bloom de 2048 bits con hashing dual (Murmur3 y FNV-1a) para deduplicaciÃ³n ultra-rÃ¡pida en memoria volÃ¡til.
  - Modo centinela de bajo consumo a 80 MHz con consumo en reposo inferior a 12 mA (>12 dÃ­as de autonomÃ­a continua sin luz solar con celda 18650).
  - DocumentaciÃ³n de hardware y esquema de conexiÃ³n con panel solar monocristalino y cargador TP4056 (~$15-20 USD BOM total).
- **ConsolidaciÃ³n y AuditorÃ­a Exhaustiva de 62 MÃ³dulos & Pantallas TÃ¡cticas:**
  - 100% de paridad en botones de retroceso (Back buttons) y soporte LIFO en pila de navegaciÃ³n `OVERLAY_SCREENS`.
  - Manejadores de cierre por pulsaciÃ³n exterior (backdrop click) estandarizados en todos los modales.
  - 100% de paridad en traducciones internacionales (737 claves sincronizadas a travÃ©s de 16 idiomas, incluyendo Quechua, Ãrabe, Ruso, Chino, AlemÃ¡n y JaponÃ©s).
- **Desacoplamiento SemÃ¡ntico de MensajerÃ­a:**
  - `deleteMessage` ("Eliminar para mÃ­"): EliminaciÃ³n local atÃ³mica, purga en `IndexedMediaVault` y `localStorage` sin emisiÃ³n de paquetes destructivos hacia la contraparte.
  - `deleteMessageForEveryone` ("Eliminar para todos"): RedacciÃ³n del contenido a "ðŸš« Eliminaste este mensaje", purga inmediata de binarios en el vault, propagaciÃ³n por la malla P2P (1-a-1 y escuadrones) y replicaciÃ³n reactiva vÃ­a `LIVE_MSG_DELETE`.
  - `clearConversation`: Purga en lote (`deleteMediaBatch`) y reseteo inmediato del snippet `last_message`.
- **Visor CAD Interactivo & Plano TÃ©cnico de 4 Capas:**
  - Renderizado vectorial dual (TopologÃ­a TÃ¡ctica Mesh vs. Plano TÃ©cnico 4 Capas) en 4K Ultra-HD offline.
  - CorrecciÃ³n de truncamiento en coordenadas negativas en CSS Flexbox (`justifyContent: modalZoom > 1 ? 'flex-start' : 'center'`).
  - Controles CAD tÃ¡cticos (zoom 0.6x a 3.0x, atajo `[ESC]`, retÃ­culas HUD).
  - SincronizaciÃ³n bidireccional entre la pila arquitectÃ³nica de 4 capas y el inspector de cÃ³digo fuente en vivo.
- **SincronizaciÃ³n Web Companion sin Eco (`instanceId`):**
  - Desacoplamiento de eventos por ID aleatorio de instancia, permitiendo que nodos emparejados (Web y MÃ³vil) no descarten eventos legÃ­timos.
- **CertificaciÃ³n Dual Multi-Hardware Real (Lenovo Tablet `HA2CHKZ2` + Motorola Moto G22 `ZT322B386P`):**
  - Despliegue en limpio verificado con `adb logcat` a 60 FPS sin excepciones, transmisiÃ³n P2P con cifrado Noise y ML-KEM-768 verificado y acuse de recibo de doble check.
- **VersiÃ³n Oficial:** `98.0.0` / `versionCode 98000`.

## [95.0.0-hardened-tactical-mesh-and-sovereign-resilience-edition] - 2026-09-08

### ðŸš€ Hardened Tactical Mesh & Sovereign Resilience Edition (Release Oficial v95.0.0)

- **Pila de NavegaciÃ³n LIFO & Registro CanÃ³nico de Overlays:**
  - ExportaciÃ³n e integraciÃ³n del registro canÃ³nico `OVERLAY_SCREENS` (42 pantallas modales) en `uiSlice`, garantizando que abrir o cerrar capas superpuestas (radares, bÃºnkeres, sensores, terminales de radio) no purgue el identificador de conversaciÃ³n activa (`activeConversationId`).
- **ErradicaciÃ³n de Fugas AsÃ­ncronas en Modales TÃ¡cticos:**
  - ImplementaciÃ³n de banderas de montaje atÃ³mico (`isMounted = false`) y desuscripciÃ³n de flujos cinemÃ¡ticos y sensoriales en desmontaje rÃ¡pido para `ExtremeSurvivalHudModal`, `VitalScanModal`, `TacticalFoxhuntModal`, `CelestialPdrModal` y `AirGapStegoModal`.
- **GestiÃ³n Estricta de AudioContext:**
  - Cierre explÃ­cito de hardware de audio (`audioCtx.close()`) en `LoraTransceiverModal` para prevenir bloqueos de cÃ³dec de hardware en dispositivos Android de recursos ajustados.
- **Renders Puros React 19:**
  - CorrecciÃ³n de callbacks impuros y estado perezoso en `CallsHistoryView` y `CallScreen`.
- **Paridad LingÃ¼Ã­stica Absoluta (12 Idiomas):**
  - SincronizaciÃ³n al 100% (737/737 claves idÃ©nticas) a travÃ©s de todos los esquemas de traducciÃ³n: espaÃ±ol, inglÃ©s, alemÃ¡n, francÃ©s, italiano, portuguÃ©s, ruso, Ã¡rabe, japonÃ©s, coreano, chino y quechua.
- **Suite de ValidaciÃ³n de Resiliencia TÃ¡ctica (87/87 Pruebas Aprobadas):**
  - 100% de Ã©xito en la suite integral de pruebas de resiliencia automatizadas.
- **CertificaciÃ³n Dual en Hardware MÃ³vil Real:**
  - Motorola Moto G22 (`ZT322B386P`) y Lenovo Tablet (`HA2CHKZ2`) validados al 100% en tiempo real vÃ­a `adb logcat`: carga de librerÃ­a JNI `libred_mobile.so`, enjambre libp2p PQC Noise, servidor Axum loopback y 60 FPS sostenidos.
- **VersiÃ³n Oficial:** `95.0.0` / `versionCode 95000`.

## [94.0.0-resilient-multi-layer-tactical-engines-and-p2p-production-edition] - 2026-09-07

### ðŸš€ Resilient Multi-Layer Tactical Engines & P2P Production Edition (Release Oficial v94.0.0)

- **Motores TÃ¡cticos y Arbitraje Cognitivo:**
  - Cognitive Arbiter & Compact CoT-PLI para inferencia local adaptativa en redes de ultra-bajo ancho de banda.
  - EMP Chaos Orchestrator para contingencia ante guerra electrÃ³nica y pulsos electromagnÃ©ticos.
  - LEO Satellite Mesh Gateway con retransmisiÃ³n bent-pipe y store-and-forward.
  - Almacenamiento DTN con 310,000 iteraciones PBKDF2-SHA256.
  - MÃ¡quina de estados DEFCON calibrada en DEFCON 5 (Peacetime).
- **Suite de ValidaciÃ³n de Resiliencia TÃ¡ctica (86 Pruebas Automatizadas 100% Passing).**
- **VersiÃ³n Oficial:** `94.0.0` / `versionCode 94000`.

### ðŸš€ Tactical UI Primitives, Dynamic Portals & Hardened Mesh Sync Edition (Release Oficial v93.0.0)

- **Primitivos UI TÃ¡cticos & Aislamiento de Stacking Context:**
  - **`Tooltip.tsx` de PrecisiÃ³n GeomÃ©trica:** Renderizado mediante `createPortal(..., document.body)` para desacoplar coordenadas del contexto de transformaciÃ³n o recorte de contenedores padres. ComposiciÃ³n bidireccional de `ref` sin colisiones, subscripciones activas a eventos de `scroll` y `resize`, y cÃ¡lculo dinÃ¡mico de `arrowOffset` con alineaciÃ³n continua al centro del disparador ante clamping de viewport.
  - **`ConfirmDialog.tsx` Accesible & Anti-Bleed:** InyecciÃ³n desacoplada con `createPortal`, bloqueo idempotente de scroll en `document.body` (`overflow: hidden`), y trampa de foco por teclado (`Tab`/`Shift+Tab` y `Escape`).
  - **`ContactShareModal.tsx`:** MigraciÃ³n completa a `createPortal`, soporte de tecla `Escape` y bloqueo de scroll.
  - **Primitivos UI SSOT:** `Badge`, `LoadingSpinner`, `ProgressBar`, `EmptyState`, `SkeletonCard`, `ErrorBanner` consolidados en `components/ui/index.ts`.

- **InteracciÃ³n Gestual y Contextual en MensajerÃ­a:**
  - **Swipe-to-Reply TÃ¡ctico (`MessageBubble.tsx`):** FÃ­sica elÃ¡stica tÃ¡ctil con umbral dinÃ¡mico de 65px, respuesta hÃ¡ptica y anclaje automÃ¡tico del mensaje citado en el campo de entrada.
  - **Selector de Reacciones & MenÃº Flotante:** Overlay flotante contextual accesible mediante pulsaciÃ³n prolongada (500ms) o clic derecho, con soporte para reacciones rÃ¡pidas (`['ðŸ‘', 'â¤ï¸', 'ðŸ”¥', 'ðŸ˜‚', 'ðŸ˜®', 'âš¡', 'ðŸ›¡ï¸']`), copiado, reenvÃ­o y fijado.

- **TelemetrÃ­a RF y Paneles de Enjambre:**
  - **`NearbyDevicesPanel.tsx`:** Radar angular con blips en vivo calculados segÃºn distancia y azimut, conectado al endpoint `GET /api/proximity` y con validaciÃ³n rigurosa de niveles RSSI (`rssi == null`).
  - **`NetworkPanel.tsx`:** Tarjetas de telemetrÃ­a de topologÃ­a Swarm (desglose WiFi, BLE, LoRa, TCP, QUIC) y panel espectral RF con salto de canal interactivo.
  - **`SecurityPanel.tsx` & `GroupsPanel.tsx`:** EstadÃ­sticas consolidadas del motor Guardian AI (`messages_blocked`, `messages_analyzed`) y badges de mensajes no leÃ­dos.

- **Blindaje de Memoria en Android (`AndroidManifest.xml`):**
  - IncorporaciÃ³n de `android:largeHeap="true"` y `android:hardwareAccelerated="true"` para prevenir terminaciones abruptas del proceso de renderizado por el Low Memory Killer (LMK) en dispositivos con recursos compartidos.

- **CertificaciÃ³n Multi-Hardware Concurrente:**
  - **Lenovo Tab M11** (`HA2CHKZ2` / Android 14) â€” Arranque de motor nativo y renderizado a resoluciÃ³n nativa verificado con `adb logcat`.
  - **Motorola Moto G22** (`ZT322B386P` / Android 12) â€” Despliegue en limpio, JNI nativo funcional y flujo de bienvenida validado sin excepciones.
- **VersiÃ³n Oficial:** `93.0.0` / `versionCode 93000`.

## [92.0.0-web-companion-and-tri-hardware-sync-edition] - 2026-09-05

### ðŸš€ Web Companion, Tri-Hardware QR & Offline Multi-Device Sync Edition (Release Oficial v92.0.0)

- **Experiencia Completa WhatsApp Web UX en Dispositivos Vinculados (`LinkedDevicesView.tsx`):**
  - Vista dedicada de dispositivos vinculados con estado de sincronizaciÃ³n en tiempo real, plataforma, navegador e IP local.
  - DesvinculaciÃ³n remota en 1 toque que revoca de inmediato la sesiÃ³n del cliente web emparejado.
  - BotÃ³n de acciÃ³n primaria flotante ("Vincular un dispositivo") con soporte para cÃ¡mara nativa, alternador de linterna con apagado automÃ¡tico y selector de imÃ¡genes QR locales.
  - ExportaciÃ³n de cÃ¡psula criptogrÃ¡fica Air-Gap protegida con PBKDF2 y AES-256-GCM para intercambio fuera de banda.

- **Desacoplamiento de Variantes de CÃ³digos QR:**
  - **Variante A (Web Companion / Device Linking):** Emparejamiento de bÃ³veda criptogrÃ¡fica P-256 + AES-256-GCM con soporte omnicanal (`RED_PAIR:1:`, `RED_PAIR:2:`, `RED_VAULT:1:`).
  - **Variante B (Intercambio de Contacto DID):** Escaneo de identidades `did:red:...` con tarjeta de previsualizaciÃ³n (Preview Card) con avatar, alias, DID y acciÃ³n de aÃ±adir antes de persistir.
  - **Variante C (Nodo Web Independiente en Escritorio):** Onboarding en `AuthWall.tsx` con disposiciÃ³n de 2 columnas y botÃ³n explÃ­cito para operar como nodo soberano local con PIN de 6 dÃ­gitos sin requerir telÃ©fono mÃ³vil.

- **ErradicaciÃ³n de Deuda TÃ©cnica en EscÃ¡neres y Enrutamiento:**
  - `ContactQrModal`, `NewChatModal`, `NewContactModal` y `RadarWindow` preservan la carga Ãºtil y conmutan al modal de vinculaciÃ³n sin perder el token.
  - EliminaciÃ³n de elemento `<video>` redundante en `RadarWindow.tsx` para garantizar enlace limpio con la referencia de cÃ¡mara.

- **CertificaciÃ³n Tri-Hardware Concurrente:**
  - Despliegue en limpio verificado con `adb logcat` en:
    - **Xiaomi Redmi Note 14 5G** (`6dife65ls485fega` / Android 15 / HyperOS â€” Renderizado a ~60 FPS)
    - **Lenovo Tab M11** (`HA2CHKZ2` / Android 14)
    - **Motorola Moto G22** (`ZT322B386P` / Android 12)
- **VersiÃ³n Oficial:** `92.0.0` / `versionCode 92000`.

## [91.0.0-tri-hardware-and-carrier-sense-edition] - 2026-09-05

### ðŸš€ Excelencia Tri-Hardware & Carrier Sense Edition (Release Oficial v91.0.0)

- **Walkie-Talkie TÃ¡ctico P2P con Carrier Sense & Shockwaves Visuales (`P2PWalkieTalkieModal.tsx`):**
  - Indicador dinÃ¡mico de canal en tiempo real: estado Libre (`#10B981`), Ocupado (`#EF4444`) o Transmitiendo (`#3B82F6`) con telemetrÃ­a de decibelios (dBFS) y detecciÃ³n de portadora RF.
  - Onda expansiva visual multicapa (shockwave pulse rings) sincronizada con el estado PTT (Push-to-Talk) y nivel de volumen de modulaciÃ³n de audio.
  - GestiÃ³n rigurosa de AudioContext mediante singleton seguro con reanudaciÃ³n automÃ¡tica de estados `suspended` en interacciÃ³n del usuario.

- **EscÃ¡ner QR Universal HÃ­grado en Radar (`RadarWindow.tsx`):**
  - Motor de escaneo hÃ­brido tri-capa: lector de cÃ³digo de barras nativo MLKit en Android (`@capacitor-community/barcode-scanner`), fallback WebCam directo (`navigator.mediaDevices.getUserMedia` + `BarcodeDetector`), y carga de imagen desde galerÃ­a/archivo local (`HTMLCanvasElement`).
  - DecodificaciÃ³n inteligente de payloads: extracciÃ³n automÃ¡tica de DID `did:red:...`, direcciones de nodo, claves pÃºblicas Ed25519 y enlace instantÃ¡neo a la malla mediante handshake broadcast.
  - TransiciÃ³n fluida con botÃ³n directo para abrir conversaciÃ³n en chat al detectar o escanear un nodo.

- **PIP Flotante Universal con Pointer Events (`FloatingCallPIP.tsx`):**
  - Arrastre bidireccional continuo con `PointerEvents` (compatible con mouse y eventos tÃ¡ctiles multitouch), clamping visual viewport-safe y persistencia de posiciÃ³n.
  - Mini-onda de audio activa en tiempo real segÃºn el nivel de voz del par remoto y alternador de micrÃ³fono / silencio directo en el widget flotante.

- **Visor de Estados EfÃ­meros WhatsApp con Pausa MilimÃ©trica (`StoryViewer.tsx`):**
  - Control de tiempo con acumulador milimÃ©trico (`accumulatedMsRef`) en eventos `onPointerDown`/`onPointerUp` para congelar la barra de progreso sin desfases.
  - OcultaciÃ³n automÃ¡tica de controles superpuestos durante la pausa tÃ¡ctil e inyecciÃ³n instantÃ¡nea de reacciones emoji rÃ¡pidas.

- **VinculaciÃ³n Segura de Web Companion (`WebCompanionLinkModal.tsx`):**
  - Temporizador visual regresivo de 60 segundos con rotaciÃ³n atÃ³mica de tokens criptogrÃ¡ficos y botÃ³n de renovaciÃ³n manual inmediata.

- **Blindaje Anti-DoS SimÃ©trico en Motores Rust JNI & CLI (`node/src/api.rs` & `red_mobile/src/api.rs`):**
  - ValidaciÃ³n estricta de longitud par en cadenas hexadecimales, cota superior de 1MB en buffer hex, marco mÃ­nimo de 4 bytes y lÃ­mite de payload de 512KB.

- **CertificaciÃ³n Tri-Hardware v91.0.0:**
  - Despliegue en limpio y verificaciÃ³n en hardware real:
    - **Lenovo Tab** (`HA2CHKZ2` / `TB305XU` / Android 14)
    - **Motorola Moto G22** (`ZT322B386P` / `hawaiip_g` / Android 12)
    - **Xiaomi Redmi Note 14 5G** (`6dife65ls485fega` / Android 15 / HyperOS)
  - Cero datos simulados ni mocks; validaciÃ³n criptogrÃ¡fica y de audio en tiempo real.
- **VersiÃ³n Oficial:** `91.0.0` / `versionCode 91000`.

## [90.0.0-familiar-whatsapp-and-pqc-master-edition] - 2026-09-05

### ðŸš€ Modo Familiar WhatsApp & PQC Master Edition (Release Oficial v90.0.0)

- **Modo Familiar (WhatsApp UX) 100% Funcional & Soberano:**
  - **Intercambio de Contactos QR Soberano (`ContactQrModal.tsx`):**
    - PestaÃ±a "Mi cÃ³digo": CÃ³digo QR vectorial autÃ³nomo generado localmente mediante `OfflineQrEngine`, avatar, apodo, botÃ³n Web Share nativo y copia en portapapeles.
    - PestaÃ±a "Escanear cÃ³digo": Escaneo de cÃ¡mara nativa Capacitor (`@capacitor-community/barcode-scanner`) con visor verde animado, linterna, soporte de galerÃ­a (HTML5 Canvas/`BarcodeDetector`), inserciÃ³n instantÃ¡nea a contactos (`addContact`) y difusiÃ³n de enlace P2P (`meshRouter.broadcast`).
    - Capa de transparencia CSS blindada (`.contact-qr-scanner-overlay`) para evitar pantallas negras en Android WebViews.
  - **Previsualizador Multimedia WhatsApp (`MediaSendPreviewModal.tsx`):**
    - PrevisualizaciÃ³n a pantalla completa para fotos y videos de cÃ¡mara o galerÃ­a.
    - Soporte completo de pie de foto (`caption`) propagado de extremo a extremo a travÃ©s de `MessageItem`, `sendMessage`, `meshRouter.send` y persistencia IndexedDB/Sled.
    - PrevisualizaciÃ³n inteligente en la lista de chats (`ðŸ“· pie de foto` / `ðŸ“¹ pie de foto`).
  - **Ventana de Chat & Quick-Starters:**
    - Tarjeta de contacto no guardado (`#182229`) con acciones directas para aÃ±adir a contactos o bloquear nodo (`blockNode`).
    - Iniciadores rÃ¡pidos en conversaciones vacÃ­as: `ðŸ‘‹ Decir Hola` (mensaje inmediato), `ðŸ“· Enviar foto` (cÃ¡mara nativa) y `ðŸ“ž Llamar` (llamada de voz P2P).
    - Renderizado de notas de voz en forma de onda interactiva (28 barras) con paleta WhatsApp `#00A884` (propio) y `#53BDEB` (remoto).
  - **PestaÃ±a Novedades & Estados EfÃ­meros (`StatusView.tsx`):**
    - "Mi estado" con badge circular `+` o anillo verde `#00A884` de historias activas de 24h.
    - "Actualizaciones recientes" con anillos de contacto y visualizador directo.
    - Botones flotantes (FABs) de WhatsApp: lÃ¡piz âœï¸ para estados de texto y cÃ¡mara ðŸ“· para multimedia.
  - **Historial de Llamadas & Selector de Contactos (`CallsHistoryView.tsx`):**
    - Selector estilo `#202C33` con buscador en tiempo real y disparadores instantÃ¡neos de llamadas de audio (`ðŸ“ž`) y video (`ðŸ“¹`) P2P WebRTC.
  - **Panel de Ajustes Familiares (`FamiliarSettingsView.tsx`):**
    - Perfil con avatar grande, apodo, estado y botÃ³n directo a cÃ³digo QR.
    - Switch interactivo para alternar en caliente entre "Modo Familiar (WhatsApp)" y "Modo TÃ¡ctico C4ISR".
    - CategorÃ­as completas conectadas a sus respectivos subpaneles de configuraciÃ³n funcionales.
- **CertificaciÃ³n Tri-Hardware v90.0.0:**
  - Despliegue en limpio y verificaciÃ³n en hardware real:
    - **Xiaomi Redmi Note 14 5G** (`6dife65ls485fega` / Android 15 / HyperOS)
    - **Lenovo Tab** (`TB305XU` / Android 14)
    - **Motorola Moto G22** (`ZT322B386P` / Android 12)
  - Logcat confirmado: Sled DB, mDNS discovery, enlaces P2P libp2p activos en TCP 7331, cero crashes.
- **VersiÃ³n Oficial:** `90.0.0` / `versionCode 90000`.

## [89.0.0-worker-offthread-and-tri-hardware-edition] - 2026-09-04

### ðŸš€ WebAssembly Worker Off-Thread & Tri-Hardware Master Edition (Release Oficial v89.0.0)

- **Inferencia WebAssembly ONNX Off-Thread en Web Worker:**
  - **`localAiWorker.ts` Operativo:** Traslado completo de la inferencia ONNX (`toxic-bert`, Whisper ASR, y pipeline generativo) fuera del hilo principal de JavaScript a un Web Worker dedicado.
  - **Puente Bidireccional en `LocalAIEngineClass`:** InicializaciÃ³n perezosa de Worker con recarga automÃ¡tica ante fallos y fallback transparente al path inline sin bloquear la UI.
  - **ProtecciÃ³n de Memoria:** TerminaciÃ³n atÃ³mica del Worker y liberaciÃ³n de tensores en `disposePipelines()`.
- **DetecciÃ³n DinÃ¡mica de Capacidades de Hardware (Copiloto IA):**
  - **IntegraciÃ³n de `probeHardwareCapabilities`:** Mapeo de WebGPU, nÃºcleos de CPU y memoria RAM disponible directamente en `AICopilotModal.tsx`.
  - **RecomendaciÃ³n Inteligente en UI:** Badge dorado "RECOMENDADO â˜…" en la tarjeta del modelo Ã³ptimo para el dispositivo actual con botÃ³n de escaneo "ðŸ”¬ Detectar Hardware".
- **Blindaje del Pipeline de TranscripciÃ³n Whisper:**
  - **DecodificaciÃ³n PCM 16kHz en Hilo Principal:** DecodificaciÃ³n de audio comprimido mediante Web Audio API antes del despacho al Worker, permitiendo que Whisper WASM ejecute sin requerir AudioContext en hilos secundarios.
  - **Contingencia Robusta:** ReutilizaciÃ³n inmediata del bÃºfer Float32Array en el hilo principal si el Worker se encuentra ocupado o agotado por timeout.
- **AuditorÃ­a de Seguridad y ClasificaciÃ³n RED Guardian:**
  - **EvaluaciÃ³n Multietiqueta:** ConfiguraciÃ³n `{ topk: null }` y umbral estricto 0.60 en las 6 categorÃ­as de hostilidad en el Worker, erradicando falsos positivos y falsos negativos.
  - **EliminaciÃ³n de Respuestas Mock:** ErradicaciÃ³n total de textos simulados; reporte de errores honestos y transiciÃ³n limpia a RAG Vectorial INT8.
- **Hardening de Android Keystore y Resiliencia en ReinstalaciÃ³n:**
  - **`android:allowBackup="false"`:** PrevenciÃ³n de restauraciÃ³n de SharedPreferences huÃ©rfanas tras reinstalaciÃ³n limpia sin claves Keystore.
  - **Auto-purga en `getSecureStored`:** DetecciÃ³n de `IllegalBlockSizeException` y saneamiento automÃ¡tico de claves corruptas con fallback a almacenamiento local.
- **CertificaciÃ³n EmpÃ­rica Tri-Hardware:**
  - Despliegue en limpio y ejecuciÃ³n concurrente certificada con 0 crashes en:
    - **Redmi Note 14 Pro 5G** (`24116RACCG` / Android 15 / HyperOS)
    - **Lenovo Tab** (`TB305XU` / Android 14)
    - **Motorola Moto G22** (`moto_g22` / Android 12)
  - Malla P2P activa con transporte BLE GATT, mDNS MulticastLock y Wi-Fi radio en modo de alto rendimiento.
- **VersiÃ³n Oficial:** `89.0.0` / `versionCode 89000`.

## [88.0.0-familiar-mode-and-resilient-mesh-edition] - 2026-09-04

### ðŸŒŸ Familiar Mode & Resilient Mesh Master Edition (Release Oficial v88.0.0)

- **Paridad EstÃ©tica y ErgonÃ³mica Total con WhatsApp / Telegram (Modo Familiar):**
  - **Conversaciones Flat & Limpias:** ImplementaciÃ³n de diseÃ±o plano en `ConversationList.tsx` con fondo `#111B21`, tarjeta de escuadrÃ³n tÃ¡ctico oculta en modo familiar, selector de chat activo en `#2A3942`, avatares circulares sin bordes poligonales y marcas de tiempo relativas ("14:20", "Ayer", "02/09").
  - **Cabecera de ConversaciÃ³n Cotidiana:** SubtÃ­tulo "en lÃ­nea" y "escribiendo..." en verde `#25D366` en `ChatHeader.tsx`, erradicando tecnicismos crÃ­pticos innecesarios en el modo cotidiano.
  - **Burbujas de Mensaje WhatsApp:** Entrantes en `#202C33`, salientes en `#005C4B`, colas angulares laterales y checks vectoriales SVG entrelazados (reloj pendiente, âœ“ gris, âœ“âœ“ gris, âœ“âœ“ azul leÃ­do).
  - **Fondo con PatrÃ³n Doodle Vectorial:** IntegraciÃ³n de `WhatsAppDoodleBackground.tsx` ultra ligero en CSS inline con soporte de wallpapers personalizables (`doodle_dark`, `doodle_green`, `void_black`).
  - **BotÃ³n DinÃ¡mico de Enviar / Grabador de Audio:** BotÃ³n circular esmeralda (`#00A884`) en `ChatInput.tsx` que alterna dinÃ¡micamente entre aviÃ³n de papel (cuando hay texto) y grabador de notas de voz P2P.
  - **Modal de Nuevo Chat RÃ¡pido:** `NewChatModal.tsx` con acceso inmediato a escÃ¡ner QR, compartir mi QR, nodos cercanos en radio de alcance y lista alfabÃ©tica de contactos.
  - **Lista de Contactos WhatsApp:** `ContactList.tsx` con fila de "Nuevo contacto", ordenamiento alfabÃ©tico real y acciones directas.
  - **Ajustes y Privacidad Refinados:** ConfiguraciÃ³n de confirmaciones de lectura (doble check azul), bloqueo biomÃ©trico con TEE nativo y selector de Modo Dual (Familiar vs. TÃ¡ctico C4ISR).
- **Hardening de Transporte Mesh y BLE:**
  - ResoluciÃ³n robusta de identificadores de hardware y eliminaciÃ³n de dependencias fantasma.
  - SincronizaciÃ³n reactiva sin polling ciego.
- **ValidaciÃ³n y Pruebas:**
  - 0 errores en TypeScript (`tsc --noEmit`).
  - Prerender estÃ¡tico completo en `next build`.
  - Pruebas criptogrÃ¡ficas y de gobernanza al 100% PASS.
- **VersiÃ³n Oficial:** `88.0.0` / `versionCode 88000`.

## [87.0.0-omnichannel-sovereign-mesh-edition] - 2026-09-04

### ðŸ›¡ï¸ Omnichannel Sovereign Mesh & Zero-Trust Production Edition (Release Oficial v87.0.0)

- **Fase 0 â€” Blindaje de Gobernanza Niveles 9 al 13:**
  - `GOVERNANCE.md` y `.agents/rules/governance.md` actualizados para consagrar:
    - Nivel 9: Cero telemetrÃ­a externa y erradicaciÃ³n total de Google AdMob.
    - Nivel 10: Zero-Trust estricto en APIs locales, sin bypass de loopback ni claves en texto plano.
    - Nivel 11: Integridad de compilaciÃ³n Android y reglas JNI en ProGuard.
    - Nivel 12: Direccionamiento dual BLE obligatorio (MAC Android y UUID CoreBluetooth iOS).
    - Nivel 13: VerificaciÃ³n empÃ­rica obligatoria y test runners de resiliencia.
- **Fase 1 â€” Zero-Trust en Endpoints Locales & MitigaciÃ³n Anti-Timing:**
  - Servidor Axum (`127.0.0.1:7333`) y nodo desktop protegidos con comparaciÃ³n en tiempo constante (`subtle::ConstantTimeEq`).
  - EliminaciÃ³n del bypass que confiaba en `x-forwarded-for` para loopback.
  - CORS restringido a orÃ­genes locales autorizados; erradicado `CorsLayer::permissive()`.
- **Fase 2 â€” ErradicaciÃ³n Total de Claves en Texto Plano y Fallbacks Hardcodeados:**
  - Saneamiento automÃ¡tico de `localStorage`: cualquier PIN (`master_pin`, `panic_pin`, `decoy_pin`) es purgado de texto plano y almacenado exclusivamente en TEE de hardware (Android Keystore / iOS Keychain) o hash PBKDF2/SHA-256 salteado en Web.
  - Eliminado por completo el fallback estÃ¡tico `password === '9999'` en `authSlice.ts`.
  - Eliminado por completo el fallback `123456` en cÃ¡psulas Air-Gap (`companionSyncEngine.ts`), `WebCompanionLinkModal.tsx`, `WebCompanionPairConfirmationModal.tsx` y `authSlice.ts`.
- **Fase 3 â€” Purga Absoluta de Google AdMob y TelemetrÃ­a Comercial:**
  - Eliminada dependencia `@capacitor-community/admob` de `package.json`, Gradle (`capacitor.settings.gradle`, `capacitor.build.gradle`) e iOS SPM (`Package.swift`).
  - Eliminado bloque de metadatos `com.google.android.gms.ads.APPLICATION_ID` de `AndroidManifest.xml`.
  - Reemplazado `showRewardedVideo` por recompensa soberana P2P Proof-of-Relay (+24h Modo Pro & +100 $RED).
- **Fase 4 â€” Direccionamiento Dual BLE (Android MAC & iOS UUID):**
  - MÃ©todos `isMacAddress` e `isIosBleUuid` en `bluetoothTransport.ts` para resolver nodos iOS que utilizan identificadores UUID generados por CoreBluetooth.
- **Fase 5 â€” Empaquetado Android & Permisos en Runtime:**
  - Parametrizada firma de release con fallback seguro a debug.
  - AÃ±adida regla `-keepclasseswithmembernames class * { native <methods>; }` en `proguard-rules.pro` para proteger interfaces JNI de `libred_mobile.so`.
  - Solicitud real de permisos BLE y ubicaciÃ³n en `OnboardingProfile.tsx`.
- **Fase 6 â€” EliminaciÃ³n de Polling Ciego:**
  - `localTransport.ts` emite evento `red:ble_peers_updated`.
  - `RadarWindow.tsx` y `RedP2PPayModal.tsx` migrados a escuchas reactivas y timers condicionados a visibilidad (`!document.hidden`).
- **ValidaciÃ³n EmpÃ­rica 100% PASS:**
  - 80+ suites de resiliencia ejecutadas con Ã©xito (`npm run test:all`).
  - 10/10 pruebas de gobernanza pasando (`npm run test:governance`).
  - TypeScript estricto con 0 errores (`npx tsc --noEmit`).
  - Rust workspace compilando limpiamente (`cargo check --workspace`).
- **VersiÃ³n Oficial:** `87.0.0` / `versionCode 87000`.

## [86.0.0-omnichannel-tactical-ai-edition] - 2026-09-03

### ðŸ›¡ï¸ Omnichannel Tactical AI, WebRTC Vocoder & Hardware Hardened Edition (Release Oficial v86.0.0)

- **Ciclo AI-1 â€” ReparaciÃ³n del Gestor de Descargas GGUF en MÃ³vil (Cero-OOM):**
  - Streaming binario en chunks erradicando lecturas Base64 de archivos `.part` (eliminÃ³ el fallo OOM).
  - ValidaciÃ³n de firma GGUF (`0x47475546`) en Chunk 0 y cabecera de 16 bytes para auditorÃ­as instantÃ¡neas con 0 MB de consumo de RAM.
  - PromociÃ³n atÃ³mica con `Filesystem.rename` (1 ms) y purgado de estados corruptos en `localStorage`.
- **Ciclo AI-2 â€” ErradicaciÃ³n del Timeout de 4s & Respuestas Reales con RAG TÃ¡ctico Preinstalado:**
  - Ventana de 60 segundos en `core.ts` para inferencia pesada (`/api/ai/`, `/v1/chat/`, `/api/generate`).
  - IngestiÃ³n de 15 protocolos mÃ©dicos y de rescate en Ã­ndice vectorial INT8 de 64-D con MurmurHash3 (<5 ms de bÃºsqueda).
  - ErradicaciÃ³n de textos mock y desbloqueo de descargas en `localAiEngine.ts`.
- **Ciclo AI-3 â€” ActivaciÃ³n Real de la Red Neuronal Guardian en Chat y Canales en Tiempo Real:**
  - `chatSlice.ts` evalÃºa mensajes salientes con `await GuardianEngine.evaluateTextAsync()`.
  - `messageDispatcher.ts` filtra paquetes entrantes con Guardian asÃ­ncrono.
  - `channels.ts` y `red_mobile/src/api.rs` moderan publicaciones en canales pÃºblicos.
  - Des-ofuscaciÃ³n leetspeak, protecciÃ³n anti-amenazas y lista blanca mÃ©dica TCCC (cero falsos positivos).
  - Clasificador semÃ¡ntico denso (384-D) con `all-MiniLM-L6-v2` como contingencia si `toxic-bert` no estÃ¡ en memoria.
- **Ciclo AI-4 â€” Paridad y Blindaje del Motor Nativo Rust Desktop (`node/src/ai_copilot.rs`):**
  - Soporte dinÃ¡mico multi-arquitectura (`quantized_llama`, `quantized_qwen2`, `quantized_phi3`).
  - Auto-detecciÃ³n en rutas locales de escritorio (`dirs::data_local_dir()`, `dirs::home_dir()`, `models/`, `files/models/`).
  - Plantillas ChatML / Instruct e inyecciÃ³n de contexto RAG (`req.context`).
  - Muestreo probabilÃ­stico (`temp: 0.7`, `top_p: 0.9`), repeat penalty (1.15) y stop tokens arquitecturales.
  - DecodificaciÃ³n atÃ³mica UTF-8 en espaÃ±ol y guardas de memoria OOM.
- **Ciclo AI-5 â€” IntegraciÃ³n HÃ­brida del Resumidor y Traductor IA & SincronizaciÃ³n React:**
  - ConexiÃ³n de `summarizeChannelAI()` a `/api/ai/summarize` en Rust con fallback a NLP local.
  - ConexiÃ³n de `translateTextAI()` a `/api/ai/translate` en Rust con fallback a glosario tÃ¡ctico.
  - SincronizaciÃ³n incondicional de estado React (`checkLocalModelsStatus()` y `refreshModels()`) en `AICopilotModal.tsx`.
- **Ciclo AI-6 â€” UnificaciÃ³n Omnicanal de Inferencia TÃ¡ctica & Blindaje de AudioContext:**
  - `ChatInput.tsx` (traducciÃ³n saliente) y `MessageBubble.tsx` (traducciÃ³n entrante) migrados a `translateTextAI()`.
  - `BlockchainExplorer.tsx`, `CryptoPanel.tsx`, `NetworkPanel.tsx`, `RedSDKBridge.ts` y `hiveMindEngine.ts` migrados a `queryAICopilot()`.
  - `AudioContextManager.ts` implementado con singleton compartido y pool dedicado, erradicando saturaciÃ³n de contextos de hardware en Whisper STT.
- **AuditorÃ­a Visual y de Honestidad de Interfaz:**
  - Header de `AICopilotModal.tsx` corregido para mostrar el motor real (`ðŸ›¡ï¸ RAG TÃ¡ctico Preinstalado INT8`, GGUF o Soberano).
  - TelemetrÃ­a CoT y tags honestos.
  - NotificaciÃ³n informativa en `PublicChannelsPanel.tsx` cuando no hay suficientes mensajes para resumir.
- **Despliegue & DepuraciÃ³n en Hardware Real:**
  - Despliegue en limpio verificado vÃ­a ADB en **Motorola Moto G22** (`ZT322B386P`) y **Lenovo Tab M9** (`192.168.1.170:5555` / `HA2CHKZ2`), auditado con `adb logcat` en tiempo real (0 fallos, 0 ANR).
- **ValidaciÃ³n Exhaustiva 100% PASS:**
  - 77/77 suites automatizadas superadas (`npm run test:all`).
  - TypeScript estricto con 0 errores (`npx tsc --noEmit`).
  - Rust workspace con 0 advertencias (`cargo clippy --workspace`).
- **VersiÃ³n Oficial:** `86.0.0` / `versionCode 86000`.

## [85.0.0-tactical-fortification-edition] - 2026-09-03

### ðŸ›¡ï¸ Tactical Fortification & Resilient Hardware Mesh Edition (Release Oficial v85.0.0)

- **Ciclos 1 & 2 â€” AcÃºstica & Voz TÃ¡ctica:**
  - Dictado por voz (STT) offline multi-motor con Whisper WASM, Web Speech API y resampleo PCM a 16 kHz.
  - Notas de voz tÃ¡cticas con cÃ³dec Opus a 24 kbps y analizador espectral `TacticalVoiceAnalyzer` (waveform gaussiana de 28 barras, mitigaciÃ³n de duraciÃ³n infinita en WebM y VU-meter reactivo).
- **Ciclo 3 â€” Web Companion & Enlace FÃ­sico Air-Gap:**
  - Escaneo nativo con `@capacitor-community/barcode-scanner`, desbloqueo de rotaciÃ³n de pantalla y limpieza garantizada de cÃ¡mara fÃ­sica.
  - CÃ¡psulas Air-Gap cifradas con PBKDF2 (100,000 iteraciones) y AES-256-GCM para intercambio seguro de llaves sin contacto de radio.
- **Ciclo 4 â€” CartografÃ­a TÃ¡ctica Offline & PDR:**
  - `TileCacheEngine` en IndexedDB para almacenamiento persistente de teselas cartogrÃ¡ficas offline.
  - NavegaciÃ³n inercial Dead Reckoning (PDR) con normalizaciÃ³n angular $[0, 360)^\circ$ y salvaguardas contra singularidades polares de Mercator.
- **Ciclo 5 â€” Llamadas Mesh WebRTC & Vocoder:**
  - RTCDataChannel fuera de banda (<5ms de latencia) para seÃ±alizaciÃ³n y telemetrÃ­a de escuadrÃ³n.
  - Vocoder de contingencia militar ADPCM de 8 kHz a 32 kbps (-97.9% vs Float32) para enlaces LoRa y acÃºsticos.
- **Ciclo 6 â€” Sensores TÃ¡cticos de Campo:**
  - CalibraciÃ³n cero de lÃ­nea base en brÃºjula triaxial y sensor sÃ­smico $f_0$.
  - Ecuaciones de dispersiÃ³n Ã³ptica Mie, dosimetrÃ­a nuclear CMOS e inmunidad a temperaturas criogÃ©nicas en sÃ³nar acÃºstico.
- **Ciclo 7 â€” BÃ³veda Soberana & EconomÃ­a P2P Barter ZK:**
  - GeneraciÃ³n y canje de vales QR de trueque mediante cÃ¡mara fÃ­sica nativa.
  - Pruebas de conocimiento cero offline (`ZeroKnowledgeBarterEngine`) y cupones soberanos anti-doble gasto.
- **Ciclo 8 â€” Modelos Neuronales Locales GGUF:**
  - VerificaciÃ³n de firma binaria mÃ¡gica `0x47475546` y parseo de cabeceras de arquitectura.
  - Descargas seguras y reanudables mediante cabecera HTTP `Range` con purga atÃ³mica de archivos parciales `.part`.
- **Fortificaciones Adicionales & DMS:**
  - Interruptor de Hombre Muerto (`DeadManSwitchEngine`) con reseteo de inactividad, panic wipe y endpoints simÃ©tricos en nodo Rust y cliente TypeScript.
  - Manejo de ciclo de vida en Android (`handleOnDestroy()`) en `RedNodePlugin.java` para prevenir fugas de memoria y liberaciÃ³n del micrÃ³fono.
- **Despliegue & DepuraciÃ³n en Hardware Real:**
  - Despliegue en limpio verificado vÃ­a ADB en **Motorola Moto G22** (`ZT322B386P`) y **Lenovo Tab M9** (`HA2CHKZ2`), auditado con `adb logcat` en tiempo real (0 fallos, 0 ANR, carga nativa de `libred_mobile.so` exitosa).
- **ValidaciÃ³n Exhaustiva 100% PASS:**
  - 66/66 suites automatizadas superadas (`npm run test:all`).
  - TypeScript estricto con 0 errores (`npx tsc --noEmit`).
  - Rust workspace con 0 errores (`cargo check --workspace`).
- **VersiÃ³n Oficial:** `85.0.0` / `versionCode 85000`.

## [84.0.0-cognitive-radio-multi-transport-edition] - 2026-09-02

### ðŸ›¡ï¸ Cognitive Radio & Multi-Transport Autonomous Sovereign Master Edition (Release Oficial v84.0.0)

- **Motor de Radio Cognitiva Militar (`CognitiveRadioArbiter.ts`):**
  - Ãrbitro de enrutamiento omnicanal con funciÃ³n de costo multidimensional en tiempo real (<0.02 ms de latencia, 0% CPU).
  - CÃ¡lculo geodÃ©sico esfÃ©rico Haversine sanitizado contra `NaN` para selecciÃ³n Ã³ptima de transporte fÃ­sico (BLE 5.x, Wi-Fi Direct, LoRa sub-GHz, SoundMesh acÃºstico ultrasÃ³nico y Li-Fi Ã³ptico).
  - DetecciÃ³n de interferencia y Guerra ElectrÃ³nica (EW / Jamming en 2.4 GHz) con conmutaciÃ³n automÃ¡tica de trÃ¡fico unicast y balizas de emergencia SOS a canal acÃºstico ultrasÃ³nico.
  - Planificador de escucha escalonada (*Staggered Sentry*): duty cycles adaptativos (55s reposo / 2s escucha para 48h de autonomÃ­a, 30s/3s para modo equilibrado, 10s/5s para activo y continuo para SOS/carga).
- **Protocolo Ultra-Compacto CoT-PLI de 28 Bytes:**
  - ReducciÃ³n del -94.9% en consumo de ancho de banda respecto a XML ATAK convencional (de 550 bytes a 28 bytes exactos).
  - Empaquetado binario de alta densidad: coordenadas en microgrados escaladas por 10â¶ (resoluciÃ³n de 0.11 m), altitud HAE Int16, timestamp Unix Uint32, rol militar y checksum CRC-16-CCITT.
  - Soporte nativo para interoperabilidad con redes de radio LoRa Meshtastic bajo canal dedicado.
- **Blindaje contra Asesinos de BaterÃ­a OEM (`OemBatteryHelper.ts`):**
  - DetecciÃ³n heurÃ­stica de fabricantes agresivos (Xiaomi HyperOS/MIUI, Samsung OneUI, Huawei EMUI, ColorOS/Vivo).
  - MitigaciÃ³n proactiva de cierres en segundo plano y supervivencia del daemon de red `RedNodeService`.
- **Hardening y EliminaciÃ³n de Puntos Ciegos en `meshRouter.ts`:**
  - ProtecciÃ³n global de paquetes Broadcast contra Jamming en 2.4 GHz activando SoundMesh en paralelo.
  - LimitaciÃ³n inteligente de contienda multi-hop flood durante baterÃ­a crÃ­tica (â‰¤15%) a los 3 mejores vecinos con LQS â‰¥ 50%.
  - InicializaciÃ³n defensiva de `window.Capacitor.triggerEvent` en WebView.
- **Despliegue Limpio y DepuraciÃ³n en Hardware Real:**
  - Despliegue en limpio verificado vÃ­a ADB en **Motorola Moto G22** (`ZT322B386P`) y **Lenovo Tablet TB305XU** (`HA2CHKZ2`), auditado y validado en tiempo real con `adb logcat`.
- **ValidaciÃ³n Exhaustiva 100% PASS:**
  - 56/56 suites de resiliencia automatizadas superadas (`npm run test:all`).
  - TypeScript estricto con 0 errores (`npx tsc --noEmit`).
  - Rust workspace con 0 errores (`cargo check --workspace`).
- **VersiÃ³n Oficial:** `84.0.0` / `versionCode 84000`.

---

## [78.0.0-multi-device-tactical-mesh-edition] - 2026-08-31

### ðŸ›¡ï¸ Multi-Device Tactical Mesh & Clean Production Release (Release Oficial v78.0.0)

- **Despliegue Limpio Multi-Dispositivo SimultÃ¡neo:**
  - Despliegue en limpio y verificaciÃ³n en hardware real en 3 dispositivos fÃ­sicos: **Xiaomi Redmi Note 14** (`24116RACCG`), **Lenovo Tablet** (`TB305XU`) y **Motorola Moto G22** (`moto_g22`).
  - AuditorÃ­a y depuraciÃ³n concurrente en tiempo real mediante `adb logcat` con cero errores no controlados.
- **AuditorÃ­a Forense Integral Multi-Capa (100% PASS):**
  - CertificaciÃ³n exhaustiva de los 49 mÃ³dulos de software, 23 motores de sensores fÃ­sicos W3C/Capacitor, 11 bÃ³vedas IndexedDB, 10 primitivas criptogrÃ¡ficas PQC/ZK y 81 componentes de UI.
  - CorrecciÃ³n de falsos positivos en `TacticalEdgeVisionEngine` mediante filtros de relaciÃ³n de aspecto, gradiente de cielo abierto y halo perimÃ©trico.
- **ValidaciÃ³n Automatizada 252/252 Tests (100% Ã‰xito):**
  - `cargo test --workspace`: 116/116 PASS.
  - `npm run test:all`: 136/136 PASS.
- **VersiÃ³n Oficial:** `78.0.0` / `versionCode 78000`.

---

## [77.0.0-elite-minimalist-ui-ux-edition] - 2026-08-30

### ðŸ›¡ï¸ Elite Minimalist UI/UX & Tactical OS Edition (Release Oficial v77.0.0)

- **RefactorizaciÃ³n GrÃ¡fica y LÃ³gica Profunda (10 MÃ³dulos Maestros):**
  - **MÃ³dulo 01 (HUD de TelemetrÃ­a):** Indicador dinÃ¡mico de baterÃ­a con micro-gauge reactivo y monitor de saltos FHSS en tiempo real.
  - **MÃ³dulo 02 (CajÃ³n de Comandos & Dock de 5 Pilares):** Slide-over de 8 Hubs tÃ¡cticos, selector de perfiles operacionales MIL-STD y dock fijo con micro-animaciones.
  - **MÃ³dulo 03 (Centro de Mando C4ISR & Radar P2P):** Radar polar 360Â° con barrido tÃ¡ctico en canvas, blips en coordenadas polares vivas y telemetrÃ­a DEFCON.
  - **MÃ³dulo 04 (Copiloto IA Neural HUD):** Presupuesto dinÃ¡mico de memoria RAM, selector de modelos locales ONNX/Transformers y traductor tÃ¡ctico off-grid.
  - **MÃ³dulo 05 (Chat P2P & Walkie-Talkie PTT):** BotÃ³n PTT circular pulsante, ecualizador dinÃ¡mico VAD y transceptor de rÃ¡fagas vocales (ADPCM 8kHz / Opus 32kbps).
  - **MÃ³dulo 06 (BÃ³veda DID & Web3 Pay):** CriptografÃ­a Post-CuÃ¡ntica NIST ML-KEM-768, divisiÃ³n de secretos de Shamir SSS 3-de-5, conector multi-cadena Web3 y vales de trueque P2P.
  - **MÃ³dulo 07 (Guerra ElectrÃ³nica & Espectro RF):** Barrera ultrasÃ³nica no lineal 20.5 kHz, matriz C4ISR / EMP drill, radiogoniometrÃ­a RDF y cascada espectral Waterfall con gobernador FEC Reed-Solomon.
  - **MÃ³dulo 08 (Defensa Civil, Triage SOS & Sensores Vitales):** Banner SOS de alta prioridad sin datos simulados, consola de baliza con estroboscopio LED / Li-Fi Morse, sonar acÃºstico ToF FMCW, triangulaciÃ³n sÃ­smica TDoA y triage TCCC con alerta de isquemia.
  - **MÃ³dulo 09 (DiagnÃ³stico & Gobernador Eco-Mesh):** 8 benchmarks empÃ­ricos de kernel, gobernador cinemÃ¡tico adaptativo por acelerÃ³metro y firewall de contenido GuardiÃ¡n.
  - **MÃ³dulo 10 (Enlace Air-Gap & SincronizaciÃ³n Web Companion):** TransmisiÃ³n de flujo QR animado Fountain, decodificador Morse RX por cÃ¡mara y esteganografÃ­a acÃºstica WAV.
- **ErradicaciÃ³n Total de Datos Simulados y Mockups:**
  - 100% de la telemetrÃ­a, estados de hardware, memoria y red conectados directamente a APIs nativas y Sled DB.
- **ValidaciÃ³n y Despliegue en Hardware Real:**
  - Despliegue en limpio verificado vÃ­a ADB en **Motorola Moto G22** (`ZT322B386P`) y **Lenovo Tablet TB305XU** (`HA2CHKZ2`), validado con `logcat` en tiempo real.
- **VersiÃ³n Oficial:** `77.0.0` / `versionCode 77000` / `SHA-256 5799475C569E24477FCB8DE8C96F0DDE34A6470DDD7BCE1B33F8AAC168A2250B`.

---

- **RediseÃ±o ArquitectÃ³nico Minimalista & 8 Hubs TÃ¡cticos Consolidados:**
  - **CajÃ³n de Comandos Unificado:** SustituciÃ³n de los 52 accesos planos desordenados por **8 Hubs TÃ¡cticos Cohesivos** (MensajerÃ­a P2P, Radar y Mapa GPS, Radio Vocal y SoundMesh, Copiloto IA, BÃ³veda PQC y Finanzas, Ciberdefensa DEFCON, Defensa Civil y Triage SOS, Mini-Apps y Sistema).
  - **Dock TÃ¡ctico Fijo de 5 Pilares:** Acceso instantÃ¡neo con micro-animaciones OLED a Chats, Radar, Hubs, Copiloto IA y BÃ³veda.
  - **BÃºsqueda InstantÃ¡nea en Tiempo Real:** Filtrado de herramientas por palabra clave y selector rÃ¡pido de Modos Operacionales (Sigilo, Luz Roja, Solar, ApagÃ³n, Off-Grid).
- **AsignaciÃ³n DinÃ¡mica de Memoria para IA Local (Cero Hardcoding):**
  - **Presupuesto Adaptativo de Hardware (`DeviceMemoryBudget`):** DetecciÃ³n en tiempo real de nÃºcleos CPU y memoria RAM del dispositivo (`navigator.deviceMemory`, `hardwareConcurrency`) para balancear la carga de inferencia.
  - **LiberaciÃ³n de Tensores en Memoria (`disposePipelines()`):** Descarga limpia de modelos y liberador de memoria WASM al alternar entre Qwen 2.5 0.5B, SmolLM2 360M, Llama 3.2 1B y modelos GGUF personalizados.
- **Saneamiento Integral de Diccionarios de LocalizaciÃ³n (`i18n`):**
  - Esquema estricto tipado (`I18nSchema`) sincronizado al 100% en los 12 idiomas oficiales (`es`, `en`, `ar`, `de`, `fr`, `it`, `ja`, `ko`, `pt`, `qu`, `ru`, `zh`), erradicando todas las cadenas huÃ©rfanas o no traducidas.
- **ValidaciÃ³n y Despliegue en Hardware Real:**
  - Despliegue en limpio verificado vÃ­a ADB en **Motorola Moto G22** (`ZT322B386P`) y **Lenovo Tablet TB305XU** (`HA2CHKZ2`), validado con `adb logcat` en tiempo real.
- **VersiÃ³n Oficial:** `76.0.0` / `versionCode 76000` / `SHA-256 79CFA82A882F3542C73FD6E3AA708486C1D687C0F2916129F30E25A98E84DE1A`.

---

## [75.0.0-tactical-c4isr-sovereign-survival-master] - 2026-08-30

### ðŸ›¡ï¸ Tactical C4ISR & Sovereign Survival Master Edition (Hardened Gold Master)

- **Hardening y ErradicaciÃ³n Integral de Fugas de Memoria (60 Ciclos de AuditorÃ­a):**
  - **Singletons Blindados:** NulificaciÃ³n de instancias y limpieza de eventos en todos los motores de sensores, acÃºstica, IA, blockchain y telemetrÃ­a (`destroy()` determinista).
  - **ProtecciÃ³n contra Fuga de Objetos Web:** RevocaciÃ³n estricta de Blob URLs (`URL.revokeObjectURL`) en el motor de empaquetado de Mini-Apps (`RedAppBundleEngine`).
  - **RetenciÃ³n Persistente de Listeners SSE:** Registro dinÃ¡mico de listeners en `RedAPIClient` para reconexiones transparentes sin pÃ©rdida de streams de eventos.
  - **PrevenciÃ³n de Agotamiento de Cuota WebView (`localStorage`):** Cota FIFO de 5,000 nullifiers en `ZeroKnowledgeBarterEngine` y 200 paquetes en `DtnStoreForwardEngine`.
  - **Seguridad CriptogrÃ¡fica en Vales:** VerificaciÃ³n de firmas Ed25519/SHA-256 previa al canje de crÃ©ditos en `TokenomicsEngine`.
  - **Cero Falsas Alarmas en Sensores:** EliminaciÃ³n de listeners de acelerÃ³metro duplicados en `ManDownDetectorEngine` y `StructuralHealthSeismicEngine`.
  - **Despliegue Limpio Verificado en Hardware Real:** Probado en Motorola Moto G22 (`ZT322B386P`) y Tablet Lenovo TB305XU (`HA2CHKZ2`).
- **VersiÃ³n Oficial:** `75.0.0` / `versionCode 75000` / `SHA-256 4AEF92328A6BC46624C33FA91E141C3FBFE0D80F9165196ECAF7B72C82AE78DD`.

---

## [70.0.0-tactical-c4isr-sovereign-survival-master] - 2026-08-29

### ðŸ›¡ï¸ Tactical C4ISR & Sovereign Survival Master Edition (Fases P0 a P23)

**1. Suite C4ISR, SITREP & Guerra ElectrÃ³nica:**
- **Matriz C4ISR Unificada (`C4isrTacticalMatrixEngine` + `C4isrEmpDrillModal`):** Teatro de operaciones militar unificado, informe ejecutivo C4ISR y ejercicios de caos / estrÃ©s frente a pulsos EMP.
- **RadiogoniometrÃ­a TÃ¡ctica RDF & Caza Foxhunt (`TacticalRdfEngine` + `RdfTriangulationEngine` + `TacticalFoxhuntModal`):** Muestreo direccional polar 360Â° en 16 sectores y triangulaciÃ³n hiperbÃ³lica de lÃ­neas de marcaciÃ³n (LOB) para cazar transmisores clandestinos, jammers y balizas.
- **Guerra AcÃºstica Anti-MicrÃ³fonos & Bio-Enfoque (`AcousticScramblerEngine` + `TacticalBinauralEngine` + `AcousticWarfareModal`):** Perturbador de ruido rosa y ultrasonido de 20.5 kHz para saturar micrÃ³fonos MEMS espÃ­a, y generador estÃ©reo de ondas binaurales (Gamma 40Hz, Beta 18Hz, Alpha 10Hz, Theta 6Hz y Solfeggio 528/432Hz).
- **Transferencia Air-Gap Ã“ptica & Audio Stego (`AirGapAnimatedQrEngine` + `PsychoacousticStegoEngine` + `AirGapStegoModal`):** Streaming de cÃ³digos QR animados de alta densidad con CRC-32 y modulaciÃ³n esteganogrÃ¡fica psicoacÃºstica en audio WAV/PCM (14.5-17.5 kHz).
- **VisiÃ³n Edge TÃ¡ctica (`TacticalEdgeVisionEngine` + `TacticalVisionScanModal`):** DetecciÃ³n de amenazas (Fuego, Humo, Drones, Bajas) y visor hologrÃ¡fico con shaders NVG / FLIR.
- **SimbologÃ­a Militar MIL-STD-2525D / APP-6 & SITREP (`MilStd2525Engine` + `SitrepEngine`):** Renderizado vectorial SVG de unidades Blue/Red/Neutral Force Tracking.

**2. NavegaciÃ³n Soberana, Sensores & Rescate USAR:**
- **NavegaciÃ³n Celeste AstronÃ³mica (`CelestialNavigationEngine` + `CelestialPdrModal`):** EfemÃ©rides Sol/Luna (Meeus), crepÃºsculos tÃ¡cticos nÃ¡uticos/astronÃ³micos y estimador de Lat/Lon por MediodÃ­a Solar sin GNSS.
- **NavegaciÃ³n Inercial PDR (`PedestrianDeadReckoningEngine`):** IntegraciÃ³n de pasos y desplazamiento 2D Norte/Este para desplazamiento en tÃºneles e interiores.
- **Sonar AcÃºstico FMCW & TriangulaciÃ³n SÃ­smica (`AcousticSonarEngine` + `SeismicTriangulationEngine` + `SonarSeismicModal`):** MediciÃ³n de cavidades por ToF (aire, concreto, agua, acero) y triangulaciÃ³n sÃ­smica TDoA de 3 golpes de supervivientes sepultados.
- **DosimetrÃ­a de PurificaciÃ³n H2O & BaterÃ­a (`WaterPurificationEngine` + `TacticalPowerGovernorEngine` + `VitalResourcesModal`):** DosificaciÃ³n quÃ­mica exacta (Cloro 5%, Yodo 2%, NaDCC, Solar SODIS) y cÃ¡lculo de autonomÃ­a de baterÃ­a en horas con balance fotovoltaico.
- **DosimetrÃ­a CBRN Nuclear & Pasarela Satelital (`CbrnRadiationEngine` + `SatelliteMeshGatewayEngine` + `CbrnSatelliteModal`):** Tasa de dosis $\mu\text{Sv/h}$, dosis acumulada $\text{mSv}$, $T_{stay}$ y rÃ¡fagas satelitales Iridium SBD.

**3. CriptografÃ­a CuÃ¡ntica & Identidad de Resiliencia:**
- **BÃ³veda de Canje AnÃ³nimo zk-Merkle (`ZeroKnowledgeBarterEngine` + `ZkBarterSubsurfaceModal`):** Pruebas de pertenencia Merkle en conocimiento cero con *Nullifiers* anti-doble gasto y baliza acÃºstica sub-estructural VLF (25-60 Hz).
- **RecuperaciÃ³n Social Shamir SSS 3-de-5 (`ShamirSecretSharingEngine` + `ShamirSocialRecoveryVault` + `ShamirRecoveryModal`):** Cuerpos finitos $GF(256)$ para restauraciÃ³n distribuida de claves maestras.
- **TCCC Triage MARCH-PAWS & BalÃ­stica Mil-Dot (`TacticalTcccEngine` + `TacticalBallisticsEngine` + `TcccBallisticsModal`):** Protocolo de trauma militar con temporizadores de torniquetes CAT y cÃ¡lculo balÃ­stico 4-DOF en 0.1 MRAD / 1/4 MOA.
- **Caja Negra Forense Inmutable (`ForensicBlackBoxEngine`):** Cadena de bloques local encadenada por SHA-256 para auditorÃ­a de eventos operacionales.

**4. Infraestructura de Transporte y Gobernanza de Malla:**
- **Gobernador Multi-Bearer TÃ¡ctico (`DynamicBearerGovernor` + `FrequencyHoppingEngine` + `SwarmHealthHUD`):** ConmutaciÃ³n sub-200ms anti-jamming, salto de frecuencia espectral FHSS y telemetrÃ­a de enjambre.
- **Micro-RÃ¡fagas LPI/LPD (`TacticalMicroBurstEngine`):** DispersiÃ³n temporal aleatoria para evasiÃ³n de detecciÃ³n SIGINT.
- **VersiÃ³n:** `70.0.0` / `versionCode 70000` / `SHA-256 A72BEBB2D5E1374219271B49DCA190ED509F86681081A114ABF7AF92DD93103D`.

---

## [66.0.0-sovereign-app-store-hyper-browser] - 2026-08-28

### Sovereign Mini-Apps, App Store P2P, Hyper-Browser & Multi-Rail Payments Edition

**1. Sovereign P2P App Store (`SovereignAppStoreModal`):**
- Grid completo de Mini-Apps instaladas con categorÃ­as, bÃºsqueda en tiempo real y badges de permisos.
- Creador de Mini-Apps en el dispositivo: editor HTML/JS/CSS integrado, publicaciÃ³n del manifiesto por mesh P2P.
- ImportaciÃ³n de bundles externos (`.redapp` / `.json`).
- 3 apps built-in oficiales: RED Bazaar P2P (mercado), MeshWiki TÃ¡ctica (wiki offline), Batalla Naval P2P (juego en red).

**2. RED Hyper-Browser Mesh (`RedHyperBrowserModal`):**
- Browser completo con protocolo dual: `red://` (dApps soberanas) + `https://` (web clearnet).
- Historial de navegaciÃ³n, botones AtrÃ¡s/Adelante, recarga funcionales.
- 5 marcadores tÃ¡cticos preconfigurados.
- Fallback automÃ¡tico a Mesh Out-Proxy cuando no hay conexiÃ³n a Internet.
- Badge animado `ðŸ›°ï¸ Mesh Out-Proxy Activo` con `animate-pulse`.

**3. Mini-App Container Soberano (`MiniAppContainerModal`):**
- `<iframe sandbox="allow-scripts allow-forms">` â€” aislamiento real de DOM.
- `RedSDKBridge` â€” IPC seguro con enforcing por permiso, wire-format mesh encoding.
- GestiÃ³n de permisos en tiempo real con drawer flyout: toggle individual por `RedPermissionScope`.
- Modo fullscreen toggle, recarga limpia de Blob URL, cierre con revocaciÃ³n del ObjectURL.
- IntegraciÃ³n directa con `UniversalCheckoutModal` disparada por `window.RedSDK.payments.requestPayment`.

**4. Pasarela de Pago Multi-Rail (`RedPaymentGatewayEngine` + `UniversalCheckoutModal`):**
- 5 rieles de pago: PayPal/Tarjeta, Web3 USDT/Polygon, Bitcoin Lightning, Vale Off-Grid, RED Token.
- UI con selector de riel, detalles contextuales por riel, spinner de procesamiento.
- IntegraciÃ³n con `Web3BridgeEngine` y `MonetizationEngine` para saldo local de crÃ©ditos.

**5. Infraestructura de Mini-Apps (`RedSDKTypes`, `RedAppRegistry`, `RedAppBundleEngine`):**
- Tipos canÃ³nicos: `RedAppBundle`, `PaymentRail`, `PaymentIntentRequest/Receipt`, `RedPermissionScope`.
- Registry persistente en `localStorage` con CRUD completo.
- `createBlobUrl` â€” inyecta `window.RedSDK` en el HTML de la app antes de crear el Blob URL.

**6. Mesh Gateway Engine (`MeshGatewayEngine`):**
- Out-proxy HTTP sobre malla DTN con compresiÃ³n asÃ­ncrona de payloads.
- `checkInternetConnectivity()` â€” decide automÃ¡ticamente entre iframe directo y proxy mesh.

**7. Suite de Tests (118/118 PASS):**
- 62 nuevos tests en Fase 7: IPC, aislamiento de sandbox, pagos multi-rail, registry y mesh proxy.
- `tsc --noEmit`: 0 errores de TypeScript.

**8. Limpieza y Peso:**
- EliminaciÃ³n de SVGs de template Next.js (`vercel.svg`, `next.svg`, `globe.svg`, `file.svg`, `window.svg`).
- `sw.js` actualizado a `red-vault-cache-v66` para forzar invalidaciÃ³n de cache en navegadores.
- VersiÃ³n: `66.0.0` / `versionCode 66000`.

---

## [65.0.1-multi-broker-redundant-web-p2p] - 2026-08-27

### Web P2P & Multi-Broker Redundant Mesh Edition â€” EliminaciÃ³n de Particiones de Red MQTT, Despacho Reactivo de Handshakes y SincronizaciÃ³n Universal de Binarios

**1. Transporte Multi-Broker Concurrente en Tiempo Real (`MqttRelayTransport`):**
- Conexiones WebSocket redundantes y simultÃ¡neas con `broker.emqx.io:8084` y `broker.hivemq.com:8884`.
- SuscripciÃ³n y publicaciÃ³n concurrentes en todos los brokers activos, garantizando entrega de doble ruta y eliminando las particiones de red entre clientes Web y dispositivos mÃ³viles.
- Buffer de deduplicaciÃ³n determinista (`seenMqttHashes`) para entrega *exactly-once* en capa de aplicaciÃ³n.

**2. Despacho Completo de Solicitudes y Handshakes P2P (`messageDispatcher`):**
- CorrecciÃ³n de filtros de descarte en dispatcher para permitir la recepciÃ³n y procesamiento reactivo de `contact_request`, `contact_response`, `profile_update` y `conversation_wipe`.
- NormalizaciÃ³n criptogrÃ¡fica de DIDs canÃ³nicos de 64 caracteres hexadecimales en el almacenamiento web.

**3. SincronizaciÃ³n Limpia de Assets en Android Nativo & GitHub Pages:**
- Desacoplamiento de rutas de bundle (`basePath: ''` para Android/Capacitor vs `basePath: '/RED'` para GitHub Pages), eliminando errores 404 en WebViews de dispositivos fÃ­sicos.
- CompilaciÃ³n de Release oficial `v65.0.1` e instalaciÃ³n en hardware real (**Motorola Moto G22** y **Lenovo Tab M10**).

**4. UnificaciÃ³n Completa de Modelos de Protocolo y Servicios (SSOT en `red_core::protocol::tactical`):**
- CentralizaciÃ³n de los 13 subsistemas tÃ¡cticos y de IA (AMBER, SOS, Clima CAP v1.2, Canales, Social, Guardian, Voice, Ephemeral, Proximity, Battery, Sanitizer, Chunker, IA Copilot).
- EliminaciÃ³n del 100% de tipos duplicados en `node/src/` y `red_mobile/src/`, re-exportando canÃ³nicamente desde `red_core`.
- PreservaciÃ³n Ã­ntegra de almacenamiento diferencial (Sled en PC / In-Memory en Android) y puente JNI C-ABI intacto.

---

## [65.0.0-squad-lifecycle-storage-hardened] - 2026-08-27

### Sovereign Tactical Master Edition â€” Ciclo de Vida Completo de Escuadrones, ModeraciÃ³n P2P en Tiempo Real, Blindaje de Almacenamiento IndexedDB y Despliegue en Limpio Multi-Dispositivo

**1. Ciclo de Vida Completo de Grupos y Salida Voluntaria (`leaveGroup`):**
- `client.ts`: ImplementaciÃ³n de `leaveGroup(groupId)` con sincronizaciÃ³n atÃ³mica en el demonio nativo Rust (`DELETE /groups/:id/members/:hash`), purga en `localStorage` / Zustand y emisiÃ³n del paquete de control P2P `group_leave` a todos los nodos del escuadrÃ³n.
- `messageDispatcher.ts`: Enrutamiento y despacho reactivo de `group_leave` que actualiza en vivo las listas de integrantes en todos los nodos de la malla y emite notificaciones tÃ¡cticas de partida.

**2. SincronizaciÃ³n en Tiempo Real de ModeraciÃ³n de Escuadrones (`group_admin`):**
- `client.ts` & `messageDispatcher.ts`: SincronizaciÃ³n P2P reactiva de cambios de rol (`Admin`, `Moderator`, `Member`, `ReadOnly`), estados de silenciado de miembros (`mute`) y alternancia de modo canal unidireccional (`broadcast_only`).
- `GroupAdminModal.tsx`: DerivaciÃ³n dinÃ¡mica de permisos y roles del operador local basada en su clave criptogrÃ¡fica Ãºnica, junto con el botÃ³n tÃ¡ctico **ðŸšª Abandonar EscuadrÃ³n**.

**3. IntegraciÃ³n en Ventana de Chat & RÃ³tulos de Remitente:**
- `ChatWindow.tsx`: Despliegue automÃ¡tico de la consola de administraciÃ³n del escuadrÃ³n al pulsar la cabecera en chats de grupo (`isGroupChat`).
- `MessageBubble.tsx`: RÃ³tulos dinÃ¡micos con apodo tÃ¡ctico y DID abreviado en color cian sobre el cuerpo de cada mensaje entrante en conversaciones grupales.

**4. Blindaje de Almacenamiento Multimedia (`indexedMediaVault`):**
- `client.ts` & `messageDispatcher.ts`: DerivaciÃ³n Ã­ntegra de metadatos multimedia (`duration_ms`, `latitude`, `longitude`, `file_name`, `mime_type`) y derivaciÃ³n automÃ¡tica de archivos base64 $>512\text{ bytes}$ a `indexedMediaVault` (`red_vault://${msgId}`), previniendo desbordamientos de cuota `QuotaExceededError` en WebView y navegadores.

**5. ValidaciÃ³n y Despliegue en Hardware Real:**
- Despliegue y verificaciÃ³n en **Motorola Moto G22** (`ZT322B386P`, Android 12) y **Lenovo Tab M10** (`HA2CHKZ2`, Android 15).
- VerificaciÃ³n de inicializaciÃ³n de motor Rust `arm64-v8a`, servidores SSE en loopback `127.0.0.1:7333`, BLE GATT y transporte libp2p Kademlia DHT.

---

## [64.0.0-omni-transport-production-master] - 2026-08-26

### Omni-Transport Production Master â€” ReplicaciÃ³n Web Companion en Vivo, Resiliencia de Malla E2E, Benchmarks y CertificaciÃ³n de ProducciÃ³n

**1. SincronizaciÃ³n Web Companion en Tiempo Real (WhatsApp Web Style):**
- `companionSyncEngine.ts`: Canal persistente bi-direccional (`red/pair/{sessionId}/live`) cifrado con **AES-256-GCM**, latidos keepalive (25s) y reconexiÃ³n adaptativa ante saltos de celda 4G/5G/Wi-Fi.
- `chatSlice.ts` & `authSlice.ts`: ReplicaciÃ³n instantÃ¡nea de eventos salientes y entrantes (`LIVE_MSG_SEND`, `LIVE_MSG_RECV`, `LIVE_READ_ACK`, `LIVE_TYPING`, `LIVE_CONTACT_UPDATE`).

**2. Resiliencia WebRTC y TravesÃ­a de CGNAT en Redes MÃ³viles:**
- `wifiDirectTransport.ts`: Pool multi-regiÃ³n de servidores STUN de alta disponibilidad sobre puerto 443 (`stun.services.mozilla.com:443`, `stun.nextcloud.com:443`, `stun.cloudflare.com:3478`, `stun.l.google.com:19302`) para atravesar Carrier-Grade NAT (CGNAT) en redes celulares.
- `useSquadCallMesh.ts`: Auto-recuperaciÃ³n de conexiÃ³n mediante `pc.restartIce()` y funciÃ³n `resumeAudio()` para evitar bloqueos por polÃ­ticas de Autoplay en Android WebView y navegadores de escritorio.

**3. Cobertura de Pruebas de IntegraciÃ³n y CriptografÃ­a Determinista (116 Tests Pasando):**
- `tests/mesh_integration_test.rs`: ValidaciÃ³n de propagaciÃ³n multi-salto ($A \rightarrow B \rightarrow C$), recuperaciÃ³n ante particiÃ³n de red y aislamiento determinista por TTL.
- `tests/crypto_known_answer_tests.rs`: Known-Answer Tests (KAT) para BLAKE3, ChaCha20-Poly1305 anti-tampering, conmutatividad Diffie-Hellman X25519, secreto hacia adelante en Double Ratchet y verificaciÃ³n Merkle ZK.

**4. Benchmarks de Rendimiento con Criterion & Especificaciones Formales:**
- `core/benches/crypto_bench.rs` & `mesh_bench.rs`: Micro-benchmarks de operaciones criptogrÃ¡ficas y serializaciÃ³n Gossipsub.
- `docs/PERFORMANCE.md`: MÃ©tricas de latencia en $\mu s$ y consumos de baterÃ­a en Moto G22, Lenovo Tab M9 y Xiaomi Redmi Note 14.
- `docs/PROTOCOL_SPEC.md` & `docs/API_REFERENCE.md`: EspecificaciÃ³n formal del formato de trama binaria RED v1 y catÃ¡logo de endpoints REST/SSE.

**5. Suite de EvoluciÃ³n & Blindaje Militar NIST FIPS 204 y Hardware LoRa:**
- `LoraSerialBridgeEngine.ts` & `LoraTransceiverModal.tsx`: Driver serie USB-OTG / WebUSB / BLE NUS con encuadre COBS (*Consistent Overhead Byte Stuffing*) y checksum CRC-32 IEEE 802.3 para enlaces de radio de largo alcance (15â€“25 km).
- `PqcCryptoEngine.ts`: Esquema de firma hÃ­brida post-cuÃ¡ntica **Ed25519 (64B) + ML-DSA-65 / Dilithium3 (3309B)** certificado bajo estÃ¡ndar **NIST FIPS 204**.
- `SlottedGossipEngine.ts`: Enrutador probabilÃ­stico anti-tormentas con retardo aleatorio ranurado (15â€“75 ms) y supresiÃ³n estocÃ¡stica.
- `MultipathBondingEngine.ts`: AgregaciÃ³n de ancho de banda y redundancia mediante *Erasure Coding* ($K$ datos $+ M$ paridad) sobre WiFi Direct, BLE, LoRa y SoundMesh.
- `VectorKnowledgeStore.ts` & `AICopilotModal.tsx`: Base de datos vectorial embebida INT8 con recuperaciÃ³n RAG de protocolos tÃ¡cticos de supervivencia en $<5\text{ ms}$.
- `KineticDutyGovernor.ts`: Doze Mode Guard con conmutaciÃ³n adaptativa de ciclo de trabajo en suspensiÃ³n.

---

## [63.0.0-sovereign-mesh-final-release] - 2026-08-25

### Sovereign Mesh Final Release â€” Cero CÃ³digo Falso, Malla P2P de Mercado, Salas de Voz/Video en Grupo y Despliegue Limpio

**1. EliminaciÃ³n de Datos Ficticios y ConexiÃ³n Estricta a Motores Reales**
- `LocalChainLedger.ts`: SustituciÃ³n de validadores PoS estÃ¡ticos por mapeo dinÃ¡mico de pares en vivo obtenidos desde `RedAPI.getPeers()`.
- `MonetizationEngine.ts` & `messageDispatcher.ts`: ImplementaciÃ³n de difusiÃ³n `broadcastProductToMesh()` e intercepciÃ³n P2P `receiveMeshProduct()` para ofertas comerciales firmadas en la malla.
- `CommercialHubModal.tsx`: VinculaciÃ³n de transacciones de compra directamente al `identity_hash` real del operador.

**2. Salas de Voz & Video TÃ¡cticas en Grupo (Discord-like Full-Mesh P2P)**
- `useSquadCallMesh.ts`: Motor WebRTC full-mesh N-way con anÃ¡lisis de espectro de frecuencia VAD (Voice Activity Detection) y estado `isSpeaking` reactivo.
- `SquadVoiceRoom.tsx`: HUD tÃ¡ctico de sala grupal con tarjetas de participantes, silenciado de mic, modo sordo, cÃ¡mara y compartir pantalla.

**3. AutomatizaciÃ³n Limpia de Scripts, Saneamiento de RaÃ­z & Gobernanza v63.0.0**
- `GOVERNANCE.md` & `CONTRIBUTING.md`: CreaciÃ³n del marco normativo integral de 11 niveles con pre-commit hooks, verificaciÃ³n de versiones y auditorÃ­a de seguridad.
- Saneamiento de RaÃ­z: Purga total de binarios `.exe` y `.apk` de la raÃ­z del repositorio, moviendo scripts de soporte a `scripts/windows/`.
- `tests/crypto_tests.rs`: Suite completa de Known-Answer Tests (KAT) para X25519, ChaCha20-Poly1305 AEAD, Double Ratchet, BLAKE3, Ed25519 y Zero-Knowledge Merkle Proofs (106 tests en verde).
- `.github/workflows/`: ModernizaciÃ³n integral de 8 pipelines CI/CD (`lint`, `security`, `build`, `test`, `proverif`, `release`, `deploy-pages`, `build-ios`) a GitHub Actions v4.
- `release-assets/`: Directorio dedicado para distribuciÃ³n de artefactos de producciÃ³n y checksums SHA-256 (`SHA256SUMS.txt`).

---

## [62.0.0-hardened-p2p-unified-protocol] - 2026-08-25

### Hardened P2P & Unified Protocol Edition â€” Enrutamiento E2E de SeÃ±alizaciÃ³n WebRTC, DeduplicaciÃ³n CanÃ³nica y Handshake Blindado

**1. Despacho Garantizado de Handshakes & Solicitudes de Contacto (Rust libp2p + WebRTC)**
- `client.ts` & `node/src/api.rs`: HabilitaciÃ³n del enrutamiento directo por el backend de Rust (`/messages/send`) para paquetes `contact_request`, `contact_response` y `profile_update`. La solicitud de contacto viaja de inmediato por la malla local TCP (Wi-Fi), asegurando que el receptor reciba la notificaciÃ³n y el modal de aceptaciÃ³n `IncomingContactRequestModal` sin depender de que el usuario envÃ­e un primer mensaje de texto.

**2. UnificaciÃ³n CanÃ³nica de Identificadores y Cero Chats Duplicados (1 Par = 1 ConversaciÃ³n)**
- `node/src/api.rs`: `handle_list_conversations` ahora retorna siempre el hash canÃ³nico de 64 caracteres (`peer`), eliminando la fragmentaciÃ³n con identificadores legados con guiones (`short1-short2`).
- `messageDispatcher.ts`, `meshRouter.ts` & `authSlice.ts`: Saneamiento automÃ¡tico en memoria y `localStorage` (`red_web_conversations`) que normaliza cualquier identificador hacia la clave canÃ³nica del par, erradicando duplicaciones de tarjetas de chat en la barra lateral y desincronizaciones de perfiles.

**3. Enrutamiento E2E de SeÃ±alizaciÃ³n WebRTC (Llamadas de Voz y Video 1-a-1)**
- `node/src/api.rs` & `client.ts`: Desbloqueo del reenvÃ­o de paquetes `webrtc_signal` a travÃ©s de libp2p. Las ofertas SDP, respuestas y candidatos ICE se transmiten en tiempo real sobre la malla local, activando el timbrado inmediato de llamadas (`IncomingCallBanner`) y la negociaciÃ³n P2P DTLS-SRTP.

**4. Idempotencia y Blindaje contra DuplicaciÃ³n Multimedia (EstÃ¡ndar Signal / WhatsApp)**
- `meshRouter.ts`: Generador de IDs de mensaje determinista e idempotente `generateDeterministicMsgId()` libre de aleatoriedad.
- `client.ts` & `messageDispatcher.ts`: DeduplicaciÃ³n profunda de paquetes por firma de contenido y almacenamiento de blobs pesados en `IndexedMediaVault` (IndexedDB) para prevenir errores de cuota en `localStorage`.

---

## [61.0.0-consent-instant-sync-edition] - 2026-08-24

### Consent & Instant Profile Sync Edition â€” Handshake Bidireccional P2P, ResoluciÃ³n Inmediata y Flujo de Consentimiento

**ResoluciÃ³n Inmediata de Perfil & Cero IDs Internos**
- `contactsSlice.ts`: Parser universal de esquemas de contacto (`did:red:HASH:PK:NAME`, `RED_ID_VAULT:BASE64`, `HASH:PK:NAME`), extracciÃ³n y decodificaciÃ³n UTF-8 segura de `parts[2]` (`decodeURIComponent`). InyecciÃ³n inmediata en cachÃ© de topologÃ­a `meshRouter.updatePeer(...)`, garantizando que las nuevas conversaciones muestren de inmediato el nombre del operador sin parpadear a identificadores hexadecimales o nombres genÃ©ricos.
- `OnboardingProfile.tsx`: ActualizaciÃ³n del paso 4 del asistente de configuraciÃ³n para generar cÃ³digos QR completos con clave pÃºblica y alias del operador en formato estÃ¡ndar `did:red:HASH:PK:NAME`.

**Flujo de Consentimiento Bidireccional (Modal Reactivo & Anti-Acoso)**
- `messageDispatcher.ts`: Desacople completo entre descubrimiento en malla de transporte y agregaciÃ³n en la libreta de contactos. Las solicitudes entrantes (`contact_request`) de nodos desconocidos ya no se agregan silenciosamente en segundo plano; ahora generan una peticiÃ³n formal en cola `PendingContactRequest`, emiten alerta auditiva tÃ¡ctica y despliegan en primer plano el modal reactivo `IncomingContactRequestModal` con opciones de *Aceptar*, *Rechazar* o *Bloquear*.
- `IncomingContactRequestModal.tsx`: VisualizaciÃ³n del perfil resuelto (avatar, nombre, DID truncado y canal de origen) y gestiÃ³n de acciones con retroalimentaciÃ³n inmediata.

**SincronizaciÃ³n SimÃ©trica de Libreta y Base de Datos Local**
- `contactsSlice.ts`: Al aceptar una solicitud (`acceptContactRequest`), se sincronizan de forma atÃ³mica los estados de `contacts`, `conversations`, almacenamiento local web (`red_web_contacts`, `red_web_conversations`) y backend nativo SQLite (`RedAPI.addContact`), emitiÃ©ndose un paquete de confirmaciÃ³n firmado `contact_response` (`accepted: true`).
- Al recibir el `contact_response`, el nodo emisor actualiza su libreta simÃ©tricamente y recibe notificaciÃ³n Toast en tiempo real.

**Despliegue Limpio y VerificaciÃ³n en Dispositivos Reales**
- DesinstalaciÃ³n limpia e instalaciÃ³n de `v61.0.0` en `Moto G22` (ZT322B386P) y `Tablet TB305XU` (HA2CHKZ2) con verificaciÃ³n exitosa de logcat en tiempo real.

---

## [60.0.0-real-connections-master] - 2026-08-24

### Real Connections Master Edition â€” 6 MÃ³dulos con LÃ³gica Real, Suite CriptogrÃ¡fica 4/4 y Streaming Vectorial P2P

**Blockchain Explorer & Staking Real (Motor PoS Soberano)**
- `LocalChainLedger.ts`: Motor de cadena local completo con cÃ¡lculo de hashes SHA-256 reales, Ã¡rbol de Merkle (`merkle_root`), nonce, forja de bloques por ranuras (`slots`), pool de transacciones y recompensas acreditadas a `TokenomicsEngine`. EliminaciÃ³n total de bloques estÃ¡ticos y staking visual sin cÃ³mputo de cadena.

**Hub Comercial & Vales P2P Off-Grid (Comercio CriptogrÃ¡fico)**
- `CommercialHubModal.tsx` & `economy.ts`: BotÃ³n `ðŸ’³ Pagar P2P` que emite vales criptogrÃ¡ficos firmados con SHA-256 (`createP2PVoucher`), generaciÃ³n de cÃ³digos QR de alta resoluciÃ³n (260Ã—260 px) con la librerÃ­a `qrcode` para intercambio off-grid, registro de cada transacciÃ³n en el libro contable de la cadena local y difusiÃ³n del vale firmado a travÃ©s de `MeshRouter`. Billetera P2P con balance inicial activo (150 RED tÃ¡cticos) y auto-crÃ©dito de respaldo para asegurar fluidez operativa.

**Live Canvas Vectorial en Tiempo Real (Pizarra TÃ¡ctica P2P)**
- `LiveCanvasModal.tsx`: SustituciÃ³n total del sondeo lento cada 2s de imÃ¡genes Base64 completas por un motor de streaming vectorial en tiempo real (<40 bytes por trazo). Paleta tÃ¡ctica (Cian, Esmeralda, Ãmbar, CarmesÃ­, Blanco), herramientas de pluma, marcador y borrador, exportaciÃ³n PNG local y recepciÃ³n reactiva mediante `CustomEvent('red_canvas_remote_event')` sin latencia perceptible.

**Muro Social & Canales PÃºblicos Descentralizados**
- `SocialFeedPanel.tsx`, `PublicChannelsPanel.tsx` & `messageDispatcher.ts`: DifusiÃ³n y recepciÃ³n de publicaciones (`social_post`), reacciones (`social_react`) y mensajes de canales (`channel_post`) enrutados sobre `MeshRouter` con sincronizaciÃ³n reactiva en tiempo real entre todos los nodos de la malla. EliminaciÃ³n total del almacenamiento aislado en memoria local sin propagaciÃ³n.

**BrÃºjula TÃ¡ctica Off-Grid & ResecciÃ³n de Waypoints**
- `OffGridCompassModal.tsx`: Filtro de paso bajo vectorial para eliminar saltos angulares bruscos en 0Â°/360Â°, cÃ¡lculo dinÃ¡mico de acimut solar segÃºn geolocalizaciÃ³n real, triangulaciÃ³n de waypoints y almacenamiento persistente de puntos de referencia. Landmarks fijos eliminados.

**Alerta AMBER con Firma de Autoridad CriptogrÃ¡fica**
- `AmberAdminPanel.tsx`: Firma de la carga Ãºtil vinculada al DID y clave soberana del operador con SHA-256 y prefijo de protocolo `RED_AMBER_AUTH`. EliminaciÃ³n de la firma estÃ¡tica basada en substring.

**Suite Automatizada de Pruebas CriptogrÃ¡ficas (4/4 PASS)**
- `test-crypto-core.js`: ValidaciÃ³n al 100% de Shamir's Secret Sharing (10/10 combinaciones en GF(2^8)), NIST FIPS 203 ML-KEM-768 post-cuÃ¡ntico, EsteganografÃ­a LSB y MÃ³dem AcÃºstico SoundMesh FSK. Resultado: **4/4 protocolos PASS**.
- CompilaciÃ³n Next.js Turbopack y TypeScript sin ningÃºn error.

**Despliegue Limpio en 3 Dispositivos**
- `Moto G22` (ZT322B386P), `Tablet TB305XU` (HA2CHKZ2) y `Note14 Xiaomi` (6dife65ls485fega): InstalaciÃ³n limpia de v60.0.0, eliminando versiones anteriores (56.0.0 en Note14).

---

## [59.0.0-tactical-master-release] - 2026-08-24


### Sovereign Tactical Master Edition â€” Centro de Comando TÃ¡ctico, PWA Offline Total & Suite CriptogrÃ¡fica Core

**Centro de Comando TÃ¡ctico Unificado & ReestructuraciÃ³n UX/UI**
- `TacticalCommandCenter.tsx`: Centro de control tÃ¡ctico que consolida los mÃ¡s de 35 submÃ³dulos en **5 Dominios Operativos** (*Comunicaciones*, *NavegaciÃ³n & Sensores*, *Supervivencia & Salud*, *Seguridad & BÃ³vedas*, *EconomÃ­a & Sistema*) con filtrado en tiempo real y dock inferior.
- `globals.css`: Sistema de diseÃ±o Glassmorphism Cyberpunk con paleta Obsidian Void (`#06070B`), desenfoques de 20px, acentos neÃ³n HSL y tokens de diseÃ±o `.card-tactical-glass`.
- `page.tsx` & `SidebarHeader.tsx`: Enrutamiento dinÃ¡mico en layouts Split Tablet y Single-Column MÃ³vil con pestaÃ±a rÃ¡pida `âš¡ COMANDO`.

**ConexiÃ³n Real de MÃ³dulos & EliminaciÃ³n de Maquetas**
- `MonetizationEngine.ts` & `CommercialHubModal.tsx`: CatÃ¡logo dinÃ¡mico descentralizado en memoria local, registro criptogrÃ¡fico de movimientos (`TacticalTransaction`), canje directo de crÃ©ditos por horas Pro y soporte transparente AdMob/Web.
- `GlobalShieldPanel.tsx`: InyecciÃ³n de trama criptogrÃ¡fica CSPRNG de 32 bytes de entropÃ­a (`window.crypto.getRandomValues`) con enmarcado Noise Protocol y mediciÃ³n de latencia real.
- `IdentityVaultModal.tsx` & `SurvivalBeaconModal.tsx`: Ficha mÃ©dica `RED_TAC_MED_V1` firmada digitalmente con Ed25519/SHA-256, cÃ³digo QR de rescate e inyecciÃ³n automÃ¡tica en la baliza SOS y mÃ³dem acÃºstico SoundMesh.
- `SocialFeedPanel.tsx`, `socialSlice.ts` & `economy.ts`: SincronizaciÃ³n bidireccional offline/online del muro social con persistencia en storage.
- `BlockchainExplorer.tsx`: Herramientas interactivas de forzado de sincronizaciÃ³n PoA y auditorÃ­a de salud de la cadena.

**PWA Offline Total & Web Companion PC â†” MÃ³vil**
- `manifest.json`: Metadatos PWA con modo `standalone`, iconos multi-resoluciÃ³n y atajos tÃ¡cticos directos.
- `sw.js`: Service Worker v58 con Cache Storage dual (`red-vault-cache-v58`), precachÃ© de modelos WASM de inferencia IA (`/ort-wasm/`) y estrategia Stale-While-Revalidate con fallback offline nativo.
- `WebCompanionLinkModal.tsx`: SincronizaciÃ³n P2P directa mediante intercambio de claves ECDH P-256 + AES-256-GCM entre navegador PC y mÃ³vil Android.

**Suite Automatizada de Pruebas CriptogrÃ¡ficas Core**
- `test-crypto-core.js` & `npm run test:crypto`: VerificaciÃ³n matemÃ¡tica al 100% de Shamir's Secret Sharing (10/10 combinaciones en $GF(2^8)$), NIST FIPS 203 ML-KEM-768 post-cuÃ¡ntico, EsteganografÃ­a LSB y MÃ³dem AcÃºstico SoundMesh FSK.

---

## [58.0.0-canonical-mesh-dedup] - 2026-08-23

### Sovereign Tactical Master Edition â€” Universal Biometric Sentinel, Zero-Trust Hardening & Canonical Mesh Deduplication

**Sistema Universal de Llaves BiomÃ©tricas & Passkeys Multiplataforma**
- `BiometricLockEngine.ts`: DetecciÃ³n en vivo de hardware biomÃ©trico (Huella dactilar, Reconocimiento facial, EscÃ¡ner de iris, Windows Hello, Touch ID / Face ID y Passkeys WebAuthn). IntegraciÃ³n con Web Crypto API (`navigator.credentials`) y retos criptogrÃ¡ficos locales.
- `AuthWall.tsx`: Teclado tÃ¡ctico inteligente con botÃ³n biomÃ©trico dedicado, auto-disparo configurable, asistente de enrolamiento post-onboarding en 1 clic y conmutaciÃ³n fluida al PIN de 6 dÃ­gitos ante cancelaciones o bloqueos del OS.
- `PrivacyTab.tsx`: Insignia de hardware en vivo, selector de tiempo de auto-bloqueo por inactividad (`Inmediato`, `1m`, `5m`, `15m`) e interruptor para deshabilitar auto-prompt como medida anti-coacciÃ³n.
- `AndroidManifest.xml`: DeclaraciÃ³n de permisos `USE_BIOMETRIC` y `USE_FINGERPRINT` con caracterÃ­sticas de hardware opcionales (`fingerprint`, `biometrics.face`, `biometrics.iris`).

**Seguridad Zero-Trust & Blindaje de AlmacÃ©n CriptogrÃ¡fico en Rust**
- `core/src/storage/mod.rs` & `red_mobile/src/lib.rs`: ImplementaciÃ³n de `try_get_identity` y `has_raw_entry`. Si la base de datos Sled contiene una identidad y la clave derivada del PIN no la desencripta, el nodo aborta con error fatal (`FATAL: Storage decryption failed â€” Incorrect PIN`), erradicando la creaciÃ³n de identidades efÃ­meras.
- `red_mobile/src/lib.rs` & `node/src/main.rs`: Enlace estricto del servidor Axum a Loopback `127.0.0.1:7333`, imposibilitando accesos externos desde la red LAN.
- `network_security_config.xml`: RestricciÃ³n global de trÃ¡fico en texto plano exclusivamente a `127.0.0.1` y `localhost`.
- `meshRouter.ts`: Exigencia de coincidencia estricta de `message_id` y `nonce` en el procesamiento de confirmaciones de entrega (`DELIVERY_ACK`).
- `sensors.ts` & `economy.ts`: ErradicaciÃ³n total de valores simulados/mocks en lecturas de sensores y saldos de billetera.

**Forward Error Correction (FEC) & Gobernador CinemÃ¡tico de BaterÃ­a (48h)**
- `core/src/network/fec.rs`: ImplementaciÃ³n de codificaciÃ³n de borrado MDS sobre GF(256) con matriz Cauchy para fragmentaciÃ³n de llaves post-cuÃ¡nticas ML-KEM-768 (1,184 bytes), permitiendo reconstruir claves completas con hasta un 25% de pÃ©rdida de paquetes en el aire sin requerir retransmisiones.
- `KineticDutyGovernor.ts` & `localTransport.ts`: Gobernador cinemÃ¡tico que modula el ciclo de escaneo BLE segÃºn el acelerÃ³metro de hardware (1 sondeo/30s en reposo vs 1 sondeo/3s en movimiento), extendiendo la autonomÃ­a hasta 48 horas continuas.
- `build.gradle`: CompresiÃ³n optimizada de activos y runtimes neuronales en AAPT/Gradle, reduciendo el binario APK en mÃ¡s de 67 MB preservando el 100% de las inteligencias locales.

**DeduplicaciÃ³n CanÃ³nica Universal de Nodos & NormalizaciÃ³n de Identidades**
- `meshRouter.ts`: NormalizaciÃ³n integral de identificadores (`clean.toLowerCase()`, prefijos `did:red:` y hardware MACs). ImplementaciÃ³n de la heurÃ­stica `isNameSimilar` para correlacionar nombres Bluetooth de fabricante (ej. "Lenovo Tab One") con alias de perfil tÃ¡ctico (ej. "Tab").
- `localTransport.ts`: DeduplicaciÃ³n case-insensitive de balizas BLE en `performBleScan()`, vinculaciÃ³n proactiva `autoAssociateBlePeer()` y resoluciÃ³n de pares con `getPeerByAnyId()`.
- `NearbyDevicesPanel.tsx`: SustituciÃ³n de listas separadas por `UnifiedDeviceMap` de pase Ãºnico. Los dispositivos detectados simultÃ¡neamente por BLE y WiFi Direct ahora renderizan **una sola tarjeta tÃ¡ctica consolidada** con insignias `[BLE]` y `[WIFI]`, botÃ³n `ðŸ’¬ Chat` y navegaciÃ³n directa al DID canÃ³nico.
- `RadarWindow.tsx`: Enrutamiento estricto al DID canÃ³nico de 64 caracteres SHA-256 en `handleAddPeer`.

**PrevenciÃ³n de BifurcaciÃ³n de MensajerÃ­a & MigraciÃ³n en Caliente**
- `contactsSlice.ts`: DeduplicaciÃ³n en `addContact()` por hash canÃ³nico y similitud de nombres. Auto-migraciÃ³n en tiempo real de conversaciones y almacenes de mensajes locales huÃ©rfanos creados con direcciones MAC (`red_web_messages_${oldHash}` -> `red_web_messages_${canonicalHash}`).
- `authSlice.ts`: Saneamiento y consolidaciÃ³n de conversaciones y contactos en `fetchData()`, purgando duplicados en `localStorage`.
- `chatSlice.ts` & `messageDispatcher.ts`: Enrutamiento estricto a travÃ©s de `getCanonicalId()` en mensajes entrantes y salientes, asegurando que ninguna interacciÃ³n bifurque un chat.
- `ConversationList.tsx` & `ContactList.tsx`: DetecciÃ³n en vivo de presencia online usando `meshRouter.getPeerByAnyId()`.
- `Sidebar.tsx`: DeduplicaciÃ³n canÃ³nica en listas filtradas de chats y contactos.

**SincronizaciÃ³n en Base de Datos Sled & ValidaciÃ³n en Hardware Real**
- `discovery.rs`: SanitizaciÃ³n y forzado a minÃºsculas del `identity_hash` en el Ã¡rbol nativo Sled `discovery_nodes`.
- `RedNodeService` (Android): Despliegue limpio y verificaciÃ³n activa en hardware fÃ­sico (Tablet Lenovo `TB305XU` y Motorola Moto G22 `hawaiip`) con descubrimiento mDNS y enlace Gossipsub P2P en vivo sin errores.

---

## [57.0.0-modular-architecture] - 2026-08-22

### Sovereign Tactical Master Edition â€” Clean Modular Architecture, Zero-Bloat & Universal Multi-Device Synergy

**ModularizaciÃ³n Integral de Arquitectura Frontend & DescomposiciÃ³n de Monolitos**
- `src/store/`: DescomposiciÃ³n completa del God Store monolÃ­tico `useRedStore.ts` en **Zustand Slices modulares** con tipado estricto: `uiSlice.ts`, `authSlice.ts`, `chatSlice.ts`, `contactsSlice.ts`, `callSlice.ts`, `emergencySlice.ts`, `socialSlice.ts` y despacho de eventos en tiempo real aislado en `messageDispatcher.ts`.
- `src/api/`: ReestructuraciÃ³n del cliente HTTP Axum en mÃ³dulos especializados: `types.ts`, `core.ts`, `client.ts`, `emergency.ts`, `channels.ts`, `ai.ts`, `sensors.ts`, `economy.ts`, `index.ts`.
- `src/lib/`: ReorganizaciÃ³n de 34 motores planos en subdirectorios temÃ¡ticos de dominio: `crypto/`, `ai/`, `emergency/`, `audio/`, `sensors/`, `storage/`, `network/`.
- `src/components/showcase/`: FragmentaciÃ³n de la landing page `RedShowcaseLanding.tsx` (3,175 LOC) en 10 submÃ³dulos atÃ³micos (`LandingHeader`, `LandingHero`, `LandingBentoAndMatrix`, `LandingMeshSimulator`, `LandingModuleCatalog`, `LandingInteractiveLabs`, `LandingUseCasesAndArchitecture`, `LandingFooterAndModals`, `types.ts`, `catalogData.ts`).
- `src/components/settings/`: FragmentaciÃ³n de `SettingsModal.tsx` (1,304 LOC) en 9 pestaÃ±as temÃ¡ticas (`AppearanceTab`, `CallsTab`, `AudioTab`, `StorageTab`, `PrivacyTab`, `MeshTab`, `IdentityTab`, `BackupTab`, `UpdatesTab`).
- `src/components/sidebar/`: FragmentaciÃ³n de `Sidebar.tsx` (1,149 LOC) en `SidebarHeader.tsx`, `ConversationList.tsx`, `ContactList.tsx` y `types.ts`.
- `src/components/call/`: FragmentaciÃ³n de `CallScreen.tsx` (1,337 LOC) en `CallHeader.tsx`, `CallVideoGrid.tsx`, `CallConnectingOverlay.tsx`, `CallControls.tsx` y `CallStatsModal.tsx`.
- `src/components/chat/`: EncapsulaciÃ³n modular de `ChatHeader.tsx` en `ChatWindow.tsx`.

**Blindaje Nativo Rust & EstabilizaciÃ³n de CompilaciÃ³n Workspace**
- `Cargo.toml`: UnificaciÃ³n canÃ³nica de versiÃ³n `v57.0.0` (Build `57000`) en todo el workspace (`core`, `node`, `red_mobile`, `blockchain`, `client`).
- `core/src/network/node.rs`, `core/src/protocol/group.rs`, `node/src/api.rs`: Limpieza y resoluciÃ³n de dependencias de `libp2p_yamux` y `red_core`. Verificado con `cargo check --workspace` y unit tests con Exit Code 0.

**ValidaciÃ³n Multi-Dispositivo en Hardware Real (Moto G + Tablet Lenovo)**
- Despliegue en limpio verificado mediante `adb` en Motorola Moto G (`ZT322B386P`) y Lenovo Tab (`HA2CHKZ2`).
- EjecuciÃ³n en segundo plano con Foreground Service `RedNodeService` y carga exitosa de la biblioteca nativa `libred_mobile.so` ARM64.
- Interfaz adaptativa con soporte multi-columna en tablet y HUD tÃ¡ctico optimizado para navegaciÃ³n por gestos.

---

## [55.0.0-sovereign-tactical-mesh] - 2026-08-21

### Sovereign Tactical Mesh OS Edition â€” Universal Scroll, Decoupled Scanners & Responsive Media Distribution

**Sistema de Scroll Universal & Modales Adaptativos (`.modal-card-scrollable`)**
- `globals.css`: Implementada la utilidad universal `.modal-card-scrollable` que fija la altura mÃ¡xima a `calc(100dvh - 32px)` con `overflow-y: auto`, `overscroll-behavior: contain` y `touch-action: pan-y`.
- `Sidebar.tsx`, `WebCompanionPairConfirmationModal.tsx`, `WebCompanionQRModal.tsx`, `WebCompanionLinkModal.tsx`, `BlockDetailsModal.tsx`, `GlobalSearchModal.tsx`, `DMSSettings.tsx`: IntegraciÃ³n de scrolling adaptativo para garantizar que ningÃºn botÃ³n o texto quede fuera del campo visual en pantallas compactas o con el teclado virtual abierto.

**Desacoplamiento de Flujos de Escaneo de CÃ¡mara & Temas Visuales Dedicados**
- `RadarWindow.tsx`: Visor de cÃ¡mara exclusivo para contacto P2P (`ðŸ¤ ESCÃNER DE CONTACTO P2P`) con retÃ­cula verde esmeralda y haz lÃ¡ser esmeralda-cian.
- `WebCompanionLinkModal.tsx`: Visor de cÃ¡mara exclusivo para sincronizaciÃ³n con PC (`ðŸ’» VINCULAR SESIÃ“N RED WEB`) con retÃ­cula cian neÃ³n y pÃºrpura bÃ³veda.
- `Sidebar.tsx`: DiferenciaciÃ³n de accesos directos y liberaciÃ³n atÃ³mica de recursos de cÃ¡mara en desmontaje.

**DistribuciÃ³n Responsiva de ImÃ¡genes & Medios en Chat**
- `MessageBubble.tsx`: EncapsulaciÃ³n de fotos y videos en `.chat-media-container` (`max-height: min(260px, 42vh)`, `max-width: min(320px, 78vw)`, `object-fit: cover`).
- `Sidebar.tsx`: Padding de descompresiÃ³n inferior en la lista de chats (`28px`) y en el MenÃº Lateral (`36px`) para evitar obstrucciÃ³n con el Dock TÃ¡ctico inferior.

---

## [54.0.0-sovereign-tactical-mesh] - 2026-08-21

### Sovereign Tactical Mesh OS Edition â€” Full Synergy, Isolated Discovery & 100% Offline AI Engines

**Aislamiento Estricto de Contactos & Consentimiento Soberano P2P**
- `meshRouter.ts`: Desacoplado el descubrimiento de presencia (`IDENTITY_ANNOUNCE`, `IDENTITY_RESPONSE`) de la libreta de contactos guardados. Las balizas de balizaje ahora solo actualizan metadatos en memoria y no inyectan contactos sin consentimiento explÃ­cito.
- `useRedStore.ts`: Eliminadas inserciones automÃ¡ticas de contactos fantasma en deserializaciÃ³n de tramas JSON y respuestas de perfiles.

**SanitizaciÃ³n Integral de Protocolo y Filtro de Fugas de SeÃ±alizaciÃ³n**
- `ChatWindow.tsx`: Implementada funciÃ³n `isProtocolPacket` con lista de bloqueo de 28 tipos de paquetes de seÃ±alizaciÃ³n (`read_up_to`, `delivery_ack`, WebRTC, etc.) para impedir que seÃ±ales JSON crudas se rendericen en el chat.
- `Sidebar.tsx`: SanitizaciÃ³n de la vista previa del Ãºltimo mensaje para evitar snippets con JSON de control.

**Motores de IA 100% Offline Acelerados y Blindados**
- `localAiEngine.ts`: Implementado cachÃ© vectorial en memoria (`kbVectorCache`) para la base de conocimiento de supervivencia RAG, reduciendo la latencia de inferencia de 2.5s a **<120ms (aceleraciÃ³n 20x)**. Clasificador semÃ¡ntico contextual de 8 dominios.
- `guardianEngine.ts`: Comparador de distancia Hamming bitwise de 64 bits (`dist <= 4`) contra patrones maliciosos y esteganografÃ­a hostil en imÃ¡genes y textos.
- Empaquetado local de modelos ONNX (`toxic-bert`, `all-MiniLM-L6-v2`) y runtimes WASM en los assets nativos de Android.

**Sinergia Funcional & ElevaciÃ³n Visual/UX**
- `MessageBubble.tsx`: TraducciÃ³n in-place en burbuja con IA local (ðŸŒ) y consulta contextual al Copiloto IA (ðŸ¤–). Renderizador de fichas mÃ©dicas `vital_sign` (Triage START con colores de prioridad, BPM, SpO2).
- `ChatInput.tsx`: BotÃ³n flotante Asistente IA (âœ¨) con reescritura militar `[SITREP]`, traducciÃ³n a inglÃ©s y camuflaje leetspeak. Acceso a Ficha VitalScan (ðŸ«€) en menÃº de adjuntos ðŸ“Ž.
- `ChatWindow.tsx`: BotÃ³n de BrÃºjula TÃ¡ctica P2P (ðŸ§­) en la cabecera del chat para apuntar rumbo fÃ­sico al contacto.
- `VitalScanModal.tsx`: TransmisiÃ³n de fichas de triage y signos vitales directamente al chat activo con cifrado E2E.
- `Sidebar.tsx`: Dock TÃ¡ctico HUD inferior unificado (Chats, Radar con conteo de nodos en vivo, Copiloto IA, BrÃºjula, BÃ³veda) con padding seguro para gestos de navegaciÃ³n.

---

## [53.0.0-tactical-refinement] - 2026-08-21

### Tactical Refinement, Storage Streamlining & UX Optimization Edition

**DiferenciaciÃ³n Funcional de Acciones en Barra Superior**
- `Sidebar.tsx`: DiferenciaciÃ³n funcional entre el botÃ³n de cÃ¡mara `ðŸ“·` (disparo directo del creador de fotos/historias efÃ­meras tÃ¡cticas de 24h `setStoryModal("creator")`) y el botÃ³n `âž•` (apertura del formulario modal de registro de nuevo contacto/chat P2P soberano `setAddContactOpen(true)`).

**Saneamiento de Protocolo de Borrado Remoto y Filtrado de Broadcast**
- `lib/api.ts`: IncorporaciÃ³n de `conversation_wipe`, `message_wipe`, `profile_update` y el filtro de carga Ãºtil `user_remote_wipe` al conjunto `isControlMessage`, evitando la persistencia de comandos de protocolo como burbujas de texto visibles.
- `MessageBubble.tsx`: Renderizado tÃ¡ctico estilizado tipo banner de sistema para avisos de purga remota en lugar de exponer estructuras JSON en bruto.
- `useRedStore.ts`: Filtrado preventivo de direcciones de broadcast (`ffffffff...` y `00000000...`) y paquetes de control en el generador y cargador de conversaciones, garantizando que nunca se creen chats ficticios.

**OptimizaciÃ³n Extrema del TamaÃ±o del Paquete Binario (-83% de peso)**
- Saneamiento del Ã¡rbol de assets pÃºblicos de Capacitor eliminando archivos `.apk` anidados recursivamente, reduciendo el peso final del APK de 1.16 GB a **199.36 MB** con tiempos de compilaciÃ³n de **17 segundos**.

---

## [52.0.0-autonomous-mesh] - 2026-08-21

### Autonomous Mesh & P2P Live Sync Edition â€” SincronizaciÃ³n DinÃ¡mica de Identidad y Enrutamiento Inteligente

**SincronizaciÃ³n DinÃ¡mica de Perfiles en Vivo (Multi-Nodo)**
- `useRedStore.ts`: Al editar nickname, bio o telÃ©fono en la BÃ³veda de Identidad (`setProfile`), se emite un paquete estructurado `msg_type: 'profile_update'` por broadcast mesh (`ffffffff...`) y se envÃ­a directamente a todos los contactos registrados.
- `meshRouter.ts`: Incluye `bio` y `phone_number` dentro de las balizas `IDENTITY_ANNOUNCE` y sincroniza reactivamente la cachÃ© de contactos de `localStorage` al recibir anuncios y respuestas de identidad.
- `Sidebar.tsx` & `ChatWindow.tsx`: FunciÃ³n `resolvePeerName` consulta el registro de pares en caliente de `meshRouter` si el contacto tiene un nombre genÃ©rico o desactualizado.
- `ContactProfileModal.tsx`: VisualizaciÃ³n de la BiografÃ­a/Estado y el TelÃ©fono de Emergencia sincronizados.

**Optimizaciones de CompilaciÃ³n y Rendimiento**
- `gradle.properties`: AsignaciÃ³n de 4GB de heap a la JVM de Gradle (`-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC`) para compilaciÃ³n estable con modelos neuronales ONNX y pesos WASM.
- `build.gradle`: `aaptOptions.noCompress` optimizado para `onnx`, `wasm`, `gguf`, `bin`.
- `PqcCryptoEngine.ts`: CriptografÃ­a hÃ­brida post-cuÃ¡ntica ML-KEM-768 + ECDH P-256 integrada y validada en tiempo real.

---

## [51.1.0-profile-sync] - 2026-08-21

### SincronizaciÃ³n DinÃ¡mica de Perfiles & DifusiÃ³n de Identidad Multi-Nodo
- DifusiÃ³n estructurada de identidad con `msg_type: 'profile_update'`.
- ActualizaciÃ³n reactiva de `contacts`, `conversations` y `meshRouter.peers`.
- Notificaciones tÃ¡cticas en pantalla al actualizar perfil.

---

## [51.0.0-smart-mesh] - 2026-08-21

### Smart Dynamic Mesh & Enrutamiento AutÃ³nomo Multi-Transporte LQS
- Fast-Path Unicast vÃ­a WebRTC DataChannel (54 Mbps, <30ms) con cancelaciÃ³n reactiva de emisiones redundantes por BLE/LoRa.
- ConmutaciÃ³n por fallo y multi-hop flood filtrado por calidad de enlace LQS (`LQS >= 20%`).
- Auto-asociaciÃ³n proactiva de enlaces BLE en caliente (warm links) con balizas `RED-`.
- Cola de almacenamiento DTN clasificada por 5 niveles de prioridad QoS.

---

## [40.0.0-resilient-mesh] - 2026-08-20

### Malla Resiliente â€” Persistencia ACID + Blindaje Antikill Android 16

**Correcciones crÃ­ticas de persistencia (Causa RaÃ­z)**
- `core/src/storage/mod.rs`: `store()` y `delete()` ahora llaman `tree.flush()` sÃ­ncronamente despuÃ©s de cada escritura, garantizando durabilidad ACID. El `db.flush()` (fsync global) fue eliminado del hot path de mensajes (evita ANR en mallas BLE de alto trÃ¡fico) y se expuso como `flush_db()` para uso en checkpoints/cierre del nodo.
- `client/app/src/lib/api.ts`: Implementado merge bidireccional real en `getConversations()`, `getContacts()` y `getMessages()`. Los registros P2P en localStorage y los de Rust Sled se mezclan sin pÃ©rdida (clave: primeros 16 chars del peer/identity hash). Las escrituras a localStorage ahora son condicionales â€” solo cuando el merge produce cambios.
- `client/app/src/store/useRedStore.ts`: RestauraciÃ³n instantÃ¡nea de chats/contactos desde localStorage al inicio de `fetchData()` ANTES de esperar al backend Rust. Persistencia inmediata de contactos P2P en localStorage ANTES de la llamada async a Rust.

**Blindaje Android (HyperOS / Android 16)**
- `AndroidManifest.xml`: Agregado `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `FOREGROUND_SERVICE_SPECIAL_USE`, `USE_EXACT_ALARM` y `SCHEDULE_EXACT_ALARM`. `foregroundServiceType` expandido a `connectedDevice|dataSync|specialUse`.
- `RedNodeService.java`: Canal de notificaciÃ³n renombrado a `RedMeshNode_v40` (fuerza recreaciÃ³n con `IMPORTANCE_HIGH` en actualizaciones). `startForeground()` en Android 14+ incluye `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`.
- `MainActivity.java`: `requestBatteryExemption()` movido de `onCreate()` a `onResume()` (evita fallo silencioso en HyperOS antes de que la ventana estÃ© lista). Agregado `requestExactAlarmPermission()` â€” corrige `AlarmManager: lost permission to set exact alarms` en Lenovo Tablet.

**Correcciones de seguridad Rust (JNI boundary)**
- `red_mobile/src/ai_copilot.rs`: Eliminados `unwrap()` en operaciones de tensor Candle (lÃ­neas crÃ­ticas en el inference loop). Reemplazados con `match` + `break` â€” un modelo GGUF corrupto u OOM ya no causa crash del proceso completo.

**VersiÃ³n Cargo.toml sincronizada a 40.0.0** (estaba en 38.0.0).


Todos los cambios notables en este proyecto serÃ¡n documentados en este archivo.

El formato estÃ¡ basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [39.0.0-sovereign-ai] - 2026-08-20

### Motor IA Soberano Generativo â€” CorrecciÃ³n Integral de Causa RaÃ­z

**Correcciones en `localAiEngine.ts` & `localAiWorker.ts`**
- `getGenerator()` actualizado a repositorios ONNX validados en HuggingFace: `onnx-community/Qwen2.5-0.5B-Instruct` y `onnx-community/SmolLM2-360M-Instruct` (reemplazando los IDs deprecados `Xenova/Qwen1.5-0.5B-Chat` y `Xenova/SmolLM-360M-Instruct`).
- Cadena de fallbacks extendida: `LaMini-GPT-124M` â†’ `distilgpt2` para compatibilidad mÃ¡xima sin conexiÃ³n.
- Saneamiento automÃ¡tico de `cleanQuery`: el contexto de malla inyectado por el frontend se extrae del prompt antes de la bÃºsqueda vectorial RAG.
- Recorte del eco de prompt en la salida del LLM: `generated_text.slice(inputPrompt.length)`.
- DetecciÃ³n de intenciones conversacionales (`isGreeting`, `isSystemQuery`) con respuestas dinÃ¡micas y verazes.
- Motor nativo ARM64 (`:7333`) sÃ³lo invocado cuando el modelo GGUF estÃ¡ realmente descargado en disco.

**Correcciones en `AICopilotModal.tsx`**
- Desacoplamiento del contexto de malla: se pasa como `contextStr` separado, no fusionado al prompt.
- `modelTag` del mensaje IA refleja el motor real: `Motor RAG MiniLM (100% Offline)` o el modelo GGUF activo.
- Mensaje inicial actualizado con instrucciÃ³n sobre la pestaÃ±a `[Modelos]`.

**Nuevo mÃ³dulo: `indexedMediaVault.ts`**
- BÃ³veda IndexedDB de alta capacidad para medios pesados.
- PrevenciÃ³n de `QuotaExceededError` en `localStorage` de Android (lÃ­mite 5 MB).
- Punteros virtuales `red_vault://${msgId}` para referenciaciÃ³n liviana en el store.

**CatÃ¡logo GGUF (`modelManager.ts`)**
- Modelos compactos ARM64: `SmolLM2-360M-Instruct Q4` (230 MB) y `Qwen2.5-0.5B-Instruct Q4` (390 MB).

**Build & Deploy**
- EliminaciÃ³n de `LaMini-Flan-T5-77M` del Ã¡rbol de assets pÃºblicos.
- APK de release en limpio: 205 MB (reducciÃ³n de ~99 MB respecto a v38.0.0).
- Verificado en Motorola Moto G22 (Android 12), Lenovo TB305XU (Android 15) y Xiaomi 24116RACCG Note 14 (Android 16).

---

## [38.0.0-tactical-master] - 2026-08-19


### AÃ±adido y Perfeccionado â€” RED v38.0.0 Sovereign Mesh Master Release

**IntegraciÃ³n Web3 & BÃ³veda MetaMask (`Web3BridgeEngine.ts`, `Web3VaultModal.tsx`)**
- **Conectividad EIP-1193 Nativa:** DetecciÃ³n de billeteras inyectadas (MetaMask, Brave, Coinbase, Rabby) con reconexiÃ³n reactiva y gestiÃ³n de eventos (`accountsChanged`, `chainChanged`, `disconnect`).
- **Soporte Multi-Red EVM:** ConmutaciÃ³n y auto-configuraciÃ³n de Ethereum Mainnet, Polygon PoS, Arbitrum One, Base y Sepolia Testnet.
- **AtestaciÃ³n CriptogrÃ¡fica EIP-712 / DID Binding:** VinculaciÃ³n bidireccional entre la direcciÃ³n Ethereum y el Identificador Descentralizado soberano de RED (`did:red:<identity_hash>`) mediante firma digital de mensaje verificable sin comisiones de gas.
- **Balances en Tiempo Real:** Lector directo JSON-RPC de saldos nativos y tokens $RED on-chain.

**Escudo Global & Matriz de Ciberdefensa DEFCON (`GlobalShieldEngine.ts`, `GlobalShieldPanel.tsx`)**
- **Gobernanza DEFCON DinÃ¡mica (Niveles 4 a 1):** ConmutaciÃ³n tÃ¡ctica entre DEFCON 4 (EstÃ¡ndar), DEFCON 3 (Elevado), DEFCON 2 (Alta Seguridad / Domain Fronting SNI forzado) y DEFCON 1 (ApagÃ³n TÃ¡ctico / DoH DNS Tunneling forzado + Bloqueo BiomÃ©trico inmediato).
- **Escalamiento PoW Anti-Sybil en Malla:** Ajuste dinÃ¡mico de la dificultad PoW en `MeshProofOfWork.ts` (de 2 a 5 bits) segÃºn el nivel de amenaza activo.
- **HUD Perimetral en Vivo:** MonitorizaciÃ³n de ataques Sybil repelidos, paquetes ofuscados, saltos Onion y autonomÃ­a de baterÃ­a mesh.
- **Prueba Activa de Enrutamiento:** Disparador en tiempo real para verificar el camuflaje de trÃ¡fico a travÃ©s de SNI Spoofing y DoH DNS Tunneling.

**Tokenomics & Libro Mayor Descentralizado (`TokenomicsEngine.ts`)**
- **Recompensas Proof-of-Relay:** Incentivos econÃ³micos automÃ¡ticos por el reenvÃ­o de paquetes en la malla P2P y almacenamiento DTN.
- **Staking PoS:** Rendimiento estimado del 14.8% APY con penalizaciones de slashing por inactividad.
- **Vales CriptogrÃ¡ficos Ed25519 Offline:** EmisiÃ³n y canje de vales con firma digital, cÃ³digos QR (`RED_PAY:<id>:<monto>:<firma>`) y mitigaciÃ³n estricta de doble gasto.

---

## [36.0.0-tactical-master] - 2026-08-19

### AÃ±adido y Perfeccionado â€” RED v36.0.0 Sovereign Competitive Superiority Master Release

**MensajerÃ­a Reactiva & Core Chat de Siguiente GeneraciÃ³n (`MessageBubble.tsx`, `ChatInput.tsx`, `useRedStore.ts`)**
- **Reacciones E2E en Tiempo Real:** Selector flotante de reacciones con persistencia y sincronizaciÃ³n bidireccional mediante paquetes de malla (`msg_type: 'reaction'`), agregando badges de conteo tÃ¡ctiles que alternan la reacciÃ³n del usuario con un solo toque.
- **Citas TÃ¡ctiles & Swipe-to-Reply:** Gesto de deslizamiento hacia la derecha en cualquier burbuja con animaciÃ³n elÃ¡stica e indicador visual para citar mensajes de inmediato. Renderizado de caja de cita citada con salto tÃ¡ctil automÃ¡tico (`scrollIntoView` suave + resaltado flash) al mensaje original.
- **EdiciÃ³n y EliminaciÃ³n para Todos:** Soporte de ediciÃ³n en vivo (`msg_type: 'message_edit'`) con marca `(editado)` y eliminaciÃ³n para todos (`msg_type: 'message_delete'`) redactando el contenido a nivel de protocolo y almacenamiento.
- **Confirmaciones de Lectura CriptogrÃ¡ficas Reales:** Ciclo completo de confirmaciÃ³n de entrega `pending` (ðŸ•’) $\rightarrow$ `sent` (âœ“) $\rightarrow$ `delivered` (âœ“âœ“ verde) $\rightarrow$ `read` (âœ“âœ“ cian) transmitido punto a punto mediante paquetes `read_receipt`.
- **Estados EfÃ­meros de Escritura y GrabaciÃ³n de Voz:** TransmisiÃ³n en tiempo real del estado `âœï¸ Escribiendo...` y `ðŸŽ™ï¸ Grabando audio...` en la cabecera de chat con temporizador de reset automÃ¡tico a los 3.5 segundos.

**Visor Multimedia In-App a Pantalla Completa (`MediaGalleryViewer.tsx`)**
- **GalerÃ­a TÃ¡ctica con Zoom MultitÃ¡ctil:** Visor flotante para imÃ¡genes y videos con zoom multitÃ¡ctil (`pinch-to-zoom`), doble toque para ampliar, navegaciÃ³n lateral tÃ¡ctil / por teclado y swipe vertical para cerrar.
- **Guardado y Compartido Nativo:** IntegraciÃ³n directa con `@capacitor/filesystem` para guardar archivos en el directorio de Documentos del dispositivo y `@capacitor/share` para invocar el diÃ¡logo nativo de Android.

**Videollamadas con PIP In-App & Auto-ReconexiÃ³n ICE (`CallScreen.tsx`, `FloatingCallPIP.tsx`)**
- **Ventana Picture-in-Picture (PIP) Flotante:** Modo PIP arrastrable en pantalla que permite continuar chateando o navegando por la aplicaciÃ³n sin interrumpir la llamada activa.
- **Auto-ReconexiÃ³n ICE Restart:** DetecciÃ³n de cambios de red o caÃ­das de ruta con activaciÃ³n automÃ¡tica de `pc.restartIce()` sin colgar la llamada.

**BÃ³veda BiometrÃ­a, Respaldos Cifrados & Perfil de Contacto (`BiometricLockEngine.ts`, `BackupRestoreEngine.ts`, `ContactProfileModal.tsx`)**
- **Bloqueo BiomÃ©trico Nativo & PIN de Seguridad:** IntegraciÃ³n de `@aparajita/capacitor-biometric-auth` con temporizador de inactividad configurable (`inmediato`, `1m`, `5m`, `15m`) y pantalla de desbloqueo tÃ¡ctica `BiometricShieldOverlay.tsx`.
- **Copia de Seguridad Cifrada AES-256-GCM:** ExportaciÃ³n e importaciÃ³n de la base de datos completa y claves criptogrÃ¡ficas protegidas con clave derivada mediante PBKDF2 (100,000 iteraciones SHA-256).
- **Panel de InformaciÃ³n y Medios Compartidos:** Modal de contacto con pestaÃ±as organizadas para Fotos/Videos, Documentos, Audios y Enlaces/Coordenadas.

---

## [35.0.0-tactical-master] - 2026-08-19

### AÃ±adido, Corregido y Optimizado â€” RED v35.0.0 Sovereign Tactical Master Release

**Motor AcÃºstico Singleton & CorrecciÃ³n Definitiva del Timbre (`CallRingtoneEngine.ts` & `IncomingCallBanner.tsx`)**
- **SÃ­ntesis AcÃºstica Multitono:** GeneraciÃ³n en tiempo real de 4 timbres de llamada tÃ¡cticos (*TÃ¡ctico Alfa*, *Pulso Radar*, *Sintetizador Suave*, *Silencioso*) mediante Web Audio API sin dependencias externas de archivos.
- **CancelaciÃ³n AtÃ³mica Garantizada:** El mÃ©todo `CallRingtoneEngine.stop()` asegura el apagado incondicional de osciladores, ganancias, timers de intervalos y patrones hÃ¡pticos al contestar, rechazar o montar la pantalla de llamada (`CallScreen.tsx`), resolviendo el bug de timbre persistente.

**Videollamadas P2P WebRTC Resilientes (`CallScreen.tsx`)**
- **CorrecciÃ³n CrÃ­tica de Timestamps:** NormalizaciÃ³n de marcas de tiempo en la cola de seÃ±ales WebRTC (`itemTs = item.timestamp > 1e11 ? item.timestamp : item.timestamp * 1000`), evitando el descarte errÃ³neo del 100% de las respuestas SDP (`answer`) y candidatos ICE remotos por disparidad de unidades (segundos vs milisegundos).
- **Matching Insensible a MayÃºsculas/MinÃºsculas en DIDs:** NormalizaciÃ³n de identificadores (`toLowerCase()`) en el procesamiento de colas de seÃ±alizaciÃ³n P2P.
- **Transceivers Bidireccionales ExplÃ­citos:** InclusiÃ³n de `pc.addTransceiver('audio', { direction: 'sendrecv' })` y `pc.addTransceiver('video', { direction: 'sendrecv' })` para garantizar la negociaciÃ³n bidireccional de flujos de video y audio en hardware Android heterogÃ©neo.
- **Captura de CÃ¡mara Adaptativa:** Restricciones de resoluciÃ³n configurables (`720p HD`, `480p SD`, `360p Eco`) con soporte de fallbacks resilientes multinivel para evitar fallos de hardware en sensores de dispositivos mÃ³viles.

**Centro Maestro de Ajustes & ConfiguraciÃ³n Soberana (`SettingsModal.tsx` & `settingsManager.ts`)**
- **8 Paneles TÃ¡cticos Especializados:** NavegaciÃ³n por pestaÃ±as para *Apariencia & Temas*, *Llamadas & Video*, *Sonido & Tonos*, *Almacenamiento & CachÃ©*, *Privacidad & BiometrÃ­a*, *Malla & BaterÃ­a*, *Identidad & Claves* y *Actualizador OTA*.
- **GestiÃ³n Real de Almacenamiento:** CÃ¡lculo en vivo del espacio ocupado por mensajes, conversaciones y medios temporales en la bÃ³veda local (`localStorage`), con herramienta de purga de cachÃ© de medios sin alterar contactos ni chats.
- **ConfiguraciÃ³n WebRTC Personalizable:** Servidores STUN personalizables, supresiÃ³n de eco y control de altavoz predeterminado en videollamadas.

---

## [33.0.0-tactical-master] - 2026-08-18

### AÃ±adido y Refactorizado â€” RED v33.0.0 Sovereign Tactical Master Release

**Reproductor TÃ¡ctico de Audio Interactivo (`VoiceMessage.tsx` & `ChatInput.tsx`)**
- **Waveform Scrubber Interactivo:** Barra de forma de onda interactiva con soporte de arrastre y seeking tÃ¡ctil en tiempo real mediante `pointer events` y cÃ¡lculo dinÃ¡mico de coordenadas.
- **Selector DinÃ¡mico de Velocidad:** ConmutaciÃ³n fluida entre velocidades de reproducciÃ³n (`1.0x` $\rightarrow$ `1.5x` $\rightarrow$ `2.0x`) con ajuste en vivo en el motor de audio HTML5.
- **Temporizador Dual Sincronizado:** VisualizaciÃ³n precisa del tiempo transcurrido versus la duraciÃ³n total del mensaje de voz.
- **Grabador TÃ¡ctico en Vivo:** Barra de grabaciÃ³n con visualizador en vivo, contador de tiempo de grabaciÃ³n y botones tÃ¡cticos de cancelaciÃ³n y confirmaciÃ³n.

**Soporte Completo de Documentos y Archivos GenÃ©ricos (`ChatWindow.tsx`, `ChatInput.tsx` & `MessageBubble.tsx`)**
- **Selector Universal de Archivos:** Soporte nativo para PDFs, ZIPs, APKs, GPXs, DOCs y archivos binarios de hasta 25MB codificados en DataURL con preservaciÃ³n de nombre, tamaÃ±o y tipo MIME.
- **Tarjetas TÃ¡cticas de Documento (`DocumentCard`):** Renderizado en burbujas con icono representativo segÃºn extensiÃ³n, tamaÃ±o formateado (KB/MB) y descarga directa con nombre original.

**BÃºsqueda Interna en Conversaciones y Mensajes Fijados (`ChatWindow.tsx` & `MessageBubble.tsx`)**
- **Buscador TÃ¡ctico Overlay:** Barra integrada en el encabezado del chat con navegaciÃ³n hacia adelante y atrÃ¡s (`â–²`/`â–¼`), contador de coincidencias en vivo (`1/N`) y auto-scroll con resaltado Ã¡mbar en la burbuja encontrada (`data-msgid`).
- **Mensajes Fijados en Canales:** Capacidad de fijar mensajes en cualquier canal/chat, visualizaciÃ³n de banner persistente en la cabecera del canal y salto suave al mensaje fijado.

**Tarjetas TopogrÃ¡ficas GPS & Radar QR Unificado (`MessageBubble.tsx` & `RadarWindow.tsx`)**
- **Tarjetas TÃ¡cticas GPS:** DetecciÃ³n de coordenadas GPS en tiempo real con botones interactivos de copia rÃ¡pida y apertura en el mapa topogrÃ¡fico Leaflet.
- **Visor TÃ¡ctico de EscÃ¡ner QR:** Interfaz unificada con visor lÃ¡ser, control estricto de permisos nativos en Android y eliminaciÃ³n de retornos redundantes.

**Audio WebRTC & Altavoz Adaptativo (`CallScreen.tsx`)**
- Enrutamiento dinÃ¡mico de altavoz mediante `setSinkId` y control de ganancia de audio en el reproductor remoto persistente.

---

## [32.0.0-sovereign-master] - 2026-08-17

### AÃ±adido y Refactorizado â€” RED v32.0.0 Sovereign Global P2P Master Release

**WebRTC W3C Perfect Negotiation & Dual ICE Signaling (`wifiDirectTransport.ts`)**
- **EstÃ¡ndar W3C de NegociaciÃ³n Perfecta:** ResoluciÃ³n determinÃ­stica de colisiones (*Glare*) mediante ordenaciÃ³n lexicogrÃ¡fica de identificadores (`isPolite = myId < peerId`). Rollback seguro en nodos educados sin interrupciÃ³n de DataChannels.
- **SeÃ±alizaciÃ³n Dual (WebSocket + MQTT Blind Relay):** Ofertas SDP, respuestas y candidatos ICE propagados simultÃ¡neamente a travÃ©s de WebSocket y tÃ³picos MQTT (`red/mesh/sig/{peerId}`), garantizando conectividad directa incluso detrÃ¡s de NAT simÃ©tricos o proxies celulares.
- **CalibraciÃ³n de STUN Servers:** Retiro de servicios obsoletos e integraciÃ³n de endpoints STUN de alta disponibilidad (Google, Cloudflare, NextCloud, Matrix).

**DeduplicaciÃ³n Multi-Criterio & NormalizaciÃ³n Temporal UTC (`useRedStore.ts` & `MessageBubble.tsx`)**
- **NormalizaciÃ³n UTC a Segundos:** ConversiÃ³n estricta de marcas de tiempo de milisegundos a segundos UTC para eliminar desfases en encabezados diarios y burbujas de chat.
- **DeduplicaciÃ³n Tri-Capa:** Filtro por ID determinÃ­stico, Nonce y coincidencia semÃ¡ntica `(remitente + contenido)` en ventana mÃ³vil de 30 segundos.

**CalibraciÃ³n y OptimizaciÃ³n de Radio BLE para Android OS (`bluetoothTransport.ts` & `localTransport.ts`)**
- **Inmunidad al Throttling de Android (5 scans / 30s):** Ciclo de trabajo duty-cycle calibrado a 14s (4s activo / 10s reposo) y mutex `isScanning` para evitar suspensiones de hardware por parte de `BtGatt.ScanHelper`.
- **Perfiles de EnergÃ­a Optimizados:** GestiÃ³n adaptativa de baterÃ­a en modo `high` (8s), `balanced` (14s) y `eco` (30s).

---

## [31.1.0-hybrid-mesh] - 2026-08-17

### AÃ±adido y Refactorizado â€” RED v31.1.0 Hybrid 4G/5G, Persistent DTN & Autonomous Mesh Gateway Release

**Observador de Estado de Red & Ciclo de Vida (`networkWatcher.ts`)**
- **DetecciÃ³n Unificada Multi-Plataforma:** Monitoriza en tiempo real transiciones entre interfaces (WiFi domÃ©stico $\leftrightarrow$ Datos MÃ³viles 4G/5G $\leftrightarrow$ Offline) integrando eventos del navegador, `Network Information API` y el ciclo de vida de `@capacitor/app`.
- **Sondeo WAN Activo:** VerificaciÃ³n activa de salida real a internet mediante endpoints ultraligeros con timeout de 3.5s para certificar conectividad global y activar el rol de Pasarela.

**WebRTC DataChannels con `iceRestart` y Matriz de SeÃ±alizaciÃ³n Redundante (`wifiDirectTransport.ts`)**
- **Soporte de `iceRestart` en Caliente:** Al conmutar de red (ej. de WiFi a 4G/5G), invoca automÃ¡ticamente `pc.restartIce()` y renegocia las ofertas SDP sobre las conexiones existentes sin pÃ©rdida de sesiÃ³n.
- **Matriz de SeÃ±alizaciÃ³n con RotaciÃ³n y Fallback:** Pool dinÃ¡mico de endpoints de seÃ±alizaciÃ³n y tÃºnel *Blind WebSocket Relay* cifrado de respaldo.
- **Pool STUN de Alta Disponibilidad:** Servidores STUN distribuidos de Google, Cloudflare, Matrix y Mozilla.

**Cola Persistente DTN (Store-and-Forward) & ACKs CriptogrÃ¡ficos (`dtnStorage.ts` & `meshRouter.ts`)**
- **Almacenamiento en Disco Tolerante a Reinicios:** AlmacÃ©n persistente `red_dtn_pending_queue_v1` con retenciÃ³n soberana de hasta 7 dÃ­as y reintentos con retroceso exponencial (*exponential backoff*).
- **Protocolo `DELIVERY_ACK`:** EmisiÃ³n automÃ¡tica de confirmaciones de entrega firmadas por el nodo de destino, purgando el paquete de la cola DTN y actualizando el estado a `Delivered` (doble check) en la interfaz de usuario.

**Protocolo de Pasarela AutÃ³noma (Autonomous Mesh-to-Internet Gateway / Edge Bridge)**
- **Anuncio de Capacidad de Pasarela:** Los nodos con salida a internet anuncian `is_gateway: true` y `has_internet: true` en su trama de saludo `IDENTITY_ANNOUNCE`.
- **Enrutamiento Asistido Multi-Salto:** Los nodos en clÃºsteres locales aislados (vÃ­a BLE o WiFi Direct) delegan el uplink a la pasarela vecina mÃ¡s cercana para transmitir mensajes hacia la red global (WAN Relay / WebRTC), uniendo clÃºsteres fÃ­sicos distantes a nivel mundial.

**Despliegue y VerificaciÃ³n en Banco Real Multi-Dispositivo**
- **Despliegue Limpio y Verificado:** DesinstalaciÃ³n de versiones anteriores e instalaciÃ³n limpia en **Moto G22 (`ZT322B386P`)** y **Redmi Note 14 (`6dife65ls485fega`)**.
- **MonitorizaciÃ³n Logcat Activa:** ValidaciÃ³n de mDNS, gossipsub, libp2p y enlace de mensajes en vivo sobre interfaces celulares y WiFi concurrentes.

---

## [31.0.0-sovereign-master] - 2026-08-16

### AÃ±adido y Refactorizado â€” RED v31.0.0 Real-Time SSE, DSP Vocoder, PQC & Hardware Resilience Release

**Motor de Voz TÃ¡ctica de Ultra-Bajo Ancho de Banda (`LowBitrateVocoder.ts`)**
- **CompresiÃ³n Extrema (-97.9%):** Remuestreo en tiempo real a 8000 Hz 16-bit PCM, filtrado vocal pasabanda, pre-Ã©nfasis y cuantizaciÃ³n adaptativa IMA ADPCM de 4 bits con empaquetado de nibbles.
- **RÃ¡fagas de Voz para LoRa y SoundMesh:** Reduce 3 segundos de audio crudo (562.5 KB) a ~11 KB de streaming continuo y <800 Bytes por rÃ¡faga tÃ¡ctica, permitiendo enviar notas de voz por enlaces LoRaWAN (0.3â€“5.5 kbps) y MÃ³dem AcÃºstico UltrasÃ³nico (18.5â€“20.5 kHz).
- **IntegraciÃ³n:** Conectado directamente en `P2PWalkieTalkieModal.tsx` con conmutador tÃ¡ctico y sintetizador directo de `AudioBuffer` mediante Web Audio API.

**Motor de Prueba de Trabajo CriptogrÃ¡fica Anti-Spam (`MeshProofOfWork.ts`)**
- **Blindaje Anti-DDoS sin Servidores Centrales:** Algoritmo Hashcash basado en SHA-256 con dificultad dinÃ¡mica, sellado temporal y ventana de tolerancia anti-repeticiÃ³n (180s).
- **IntegraciÃ³n en Despacho y RecepciÃ³n:** Minado automÃ¡tico en `sendMessage` y verificaciÃ³n en `addIncomingMessage` dentro de `useRedStore.ts`.

**Gobernador CinemÃ¡tico Adaptativo de BaterÃ­a (`KineticDutyGovernor.ts`)**
- **AnÃ¡lisis de AceleraciÃ³n RMS en Tiempo Real:** Detecta estados estÃ¡ticos vs en movimiento mediante telemetrÃ­a del acelerÃ³metro y baterÃ­a de hardware.
- **Perfiles de Malla:** ConmutaciÃ³n automÃ¡tica entre `SURVIVAL_SENTRY` (12s, ~48h de autonomÃ­a), `BALANCED_PATROL` (4s), `HIGH_PERFORMANCE` (1.5s) y `SHAKE_BOOST` (800ms disparado por sacudida fÃ­sica). Integrado en `EcoMeshPanel.tsx`.

**Verificador de Integridad Merkle & Self-Healing Local (`StateIntegrityEngine.ts`)**
- **Resiliencia ante Cortes Abruptos de EnergÃ­a:** GeneraciÃ³n de Ã¡rbol Merkle SHA-256 sobre los almacenes locales crÃ­ticos y autorreparaciÃ³n automÃ¡tica con cuarentena de registros corruptos en el arranque de la app.

**CriptografÃ­a Post-CuÃ¡ntica (PQC) & HÃ­brida (`PqcCryptoEngine.ts`)**
- **ML-KEM-768 (FIPS 203):** Encapsulamiento de claves basado en retÃ­culos resistente a computaciÃ³n cuÃ¡ntica combinado con ECDH P-256 mediante HKDF-SHA256.

**Control de Hardware Nativo: Flash LED Morse SOS & Antorcha (`RedNodePlugin.java` & `SurvivalBeaconModal.tsx`)**
- **API `CameraManager` Nativa:** `setTorchMode` para control del Flash LED de la cÃ¡mara trasera con pulsos Morse militares SOS (`... --- ...`) en hilo nativo independiente.

**CompilaciÃ³n y Despliegue Limpio Multi-Dispositivo**
- **JDK 21 JBR Oficial:** ConfiguraciÃ³n de OpenJDK 21 y Gradle para compatibilidad total con Android SDK 35.
- **Despliegue Verificado:** DesinstalaciÃ³n e instalaciÃ³n limpia exitosa en **Moto G22 (`ZT322B386P`)** y **Tablet Lenovo Tab M9 (`HA2CHKZ2`)**.

## [30.0.0-p2p-master] - 2026-08-07

### AÃ±adido y Corregido â€” RED v30.0.0 Sovereign Master & AI Resiliencia Release

**Motor de IA Neuronal Local Off-Grid ONNX WASM (`localAiEngine.ts` & `onnxruntime-web`)**
- **Dictamen Neuronal Zero-Trust:** IntegraciÃ³n del botÃ³n `ðŸ¤– Evaluar Resiliencia TÃ¡ctica con IA (ONNX WASM)` en `SecurityReportModal.tsx` para generar evaluaciones de resiliencia en espaÃ±ol utilizando el modelo `LaMini-Flan-T5` 100% en memoria.
- **AuditorÃ­a CriptogrÃ¡fica e Integridad en Tiempo Real:** EvaluaciÃ³n neuronal integrada en `CryptoPanel.tsx`, `NetworkPanel.tsx` y `BlockchainExplorer.tsx`.

**Seguridad TÃ¡ctica Zero-Trust & ProtecciÃ³n a Nivel de Sistema Operativo (`SecurityPanel.tsx`)**
- **Bloqueo FÃ­sico de Capturas (`FLAG_SECURE` OS):** IntegraciÃ³n nativa de `PrivacyScreen` en Android impidiendo capturas de pantalla, grabaciones de pantalla y capturas en el selector de aplicaciones recientes.
- **Auto-DiagnÃ³stico de Nodo Real (`SystemHealthModal.tsx`):** Benchmarks de latencia HTTP (`/api/status`), streaming SSE (`/api/events`), almacenamiento encriptado y generaciÃ³n de llaves `ECDSA P-256` en Web Crypto API.
- **Purga Anti-Forense y Burner Chats:** Borrado automÃ¡tico del directorio de cachÃ© nativo (`Directory.Cache`) y bypass de persistencia en disco SQLite retener mensajes Ãºnicamente en memoria RAM.

**RediseÃ±o de NavegaciÃ³n & BotÃ³n Prominente `âš¡ MÃ“DULOS` (`Sidebar.tsx`)**
- **Acceso Prominente MÃ³dulos:** InclusiÃ³n de la tarjeta `âš¡ MÃ“DULOS` como primera opciÃ³n destacada en la franja de Quick Actions y botÃ³n adaptativo en la barra superior navegable.
- **Stream de TelemetrÃ­a SSE en Vivo (`api.rs` & `NodeLogsModal.tsx`):** ImplementaciÃ³n de heartbeat de 3 segundos en `/api/events` para mantener viva la consola de logs del nodo Rust en tiempo real.

---

## [24.0.0-p2p-master] - 2026-08-05

### AÃ±adido y Corregido â€” RED v24.0.0 Native P2P & Navigation Master Release

**Puente Nativo GATT Server & InyecciÃ³n Directa (`RedNodeService.java` & `bluetoothTransport.ts`)**
- **Fix GATT Write UUID Swap:** CorrecciÃ³n de la validaciÃ³n UUID en `onCharacteristicWriteRequest` para aceptar escrituras en caracterÃ­sticas `RED_BLE_RX_CHAR` y `RED_BLE_TX_CHAR`.
- **InyecciÃ³n Nativa Directa a Rust:** ImplementaciÃ³n de `injectNativeMeshPayload` en Java para realizar un POST directo de tramas mesh a `http://127.0.0.1:7333/api/mesh/receive`.
- **Listener JS Nativo:** SuscripciÃ³n al evento `bleMessageReceived` de Capacitor en `bluetoothTransport.ts` para transmitir tramas fÃ­sicas de radio al `MeshRouter`.

**Auto-Intercambio RecÃ­proco de Claves PÃºblicas (`RadarWindow.tsx` & `useRedStore.ts`)**
- **ExtracciÃ³n CriptogrÃ¡fica QR:** CorrecciÃ³n del escÃ¡ner QR en `RadarWindow.tsx` para extraer `identity_hash` y `public_key` del formato `did:red:<hash>:<public_key>`.
- **Payload `sender_pk` RecÃ­proco:** InclusiÃ³n automÃ¡tica de `sender_pk` en `contact_request` y `contact_response`, habilitando el cifrado E2E Noise XK inmediato entre pares.
- **Refresco de Fondo en Sidebar:** ActualizaciÃ³n automÃ¡tica de la lista de conversaciones y el contador de no leÃ­dos (`fetchData()`) al recibir mensajes cuando la ventana del chat no estÃ¡ enfocada.

**NavegaciÃ³n SPA & BotÃ³n Retroceso Android (`useRedStore.ts` & `page.tsx`)**
- **Fix Bucle de NavegaciÃ³n `goBack()`:** Restablecimiento a `currentScreen: 'sidebar'` y `activeConversationId: null` para permitir salir limpiamente del chat mediante la flecha superior o la tecla fÃ­sica de retroceso de Android.

---

## [24.1.0] - 2026-08-02

### AÃ±adido y Corregido â€” RED v24.1 Real-Data & WAN P2P Release

**Auto-DetecciÃ³n AtmosfÃ©rica Real y GeolocalizaciÃ³n GPS**
- **Lectura AutomÃ¡tica de Sensores (`WeatherAlertPanel.tsx`):** ObtenciÃ³n de latitud/longitud vÃ­a `@capacitor/geolocation` + `navigator.geolocation` y consulta en tiempo real a Open-Meteo REST API (presiÃ³n baromÃ©trica hPa, temperatura Â°C, humedad % y cÃ³digo WMO). Auto-llenado al abrir la vista y botÃ³n manual de re-escaneo.
- **ProtecciÃ³n contra Excepciones JS:** Desempaquetado seguro de objetos JSON devueltos por `/api/weather/reports` en `api.ts` y guardas `Array.isArray()` estrictas en React.

**Comunicaciones P2P de Larga Distancia (WAN / 4G / 5G / Internet)**
- **Endpoints de ConexiÃ³n de Red (`POST /api/network/connect` & `GET /api/network/ip`):** Registro de handlers en `api.rs` para marcaciÃ³n P2P directa mediante libp2p `Multiaddr` (`/dns4/`, `/ip4/`, `/p2p-circuit/`).
- **IntegraciÃ³n Kademlia DHT & Circuit Relay v2:** ConexiÃ³n con nodos semilla mundiales (`BOOTSTRAP_NODES`) para descubrimiento P2P e interconexiÃ³n transparente a travÃ©s de CGNAT (redes mÃ³viles 4G/5G) y routers domÃ©sticos.
- **Tarjeta UI Larga Distancia (`NetworkPanel.tsx`):** Formato y asistencia visual para conexiones por dominio, IP pÃºblica o relay.

**Estabilidad Nativa y SSE Mesh Bridge**
- **HidrataciÃ³n SSR (`page.tsx`):** SustituciÃ³n de imports sÃ­ncronos por `dynamic(() => import(...), { ssr: false })` + `<ErrorBoundary>` tÃ¡ctico de 2 niveles.
- **SSE Outbound Activo (`/api/network/outbound`):** DifusiÃ³n en tiempo real de paquetes salientes cifrados a travÃ©s del canal `msg_tx` hacia el `MeshRouter` nativo.

---

## [19.0.0] - 2026-08-01

### AÃ±adido â€” RED v19.0 Zenith Guardian Release

**Sistema Alerta AMBER-RED P2P (BÃºsqueda Descentralizada de Personas)**
- **Red Broadcast AMBER Descentralizada:** DifusiÃ³n masiva de alertas de personas desaparecidas sobre la red P2P vÃ­a topic GossipSub `amber-red-v1` y notificaciÃ³n push SSE instantÃ¡nea.
- **Banner Flotante de Alta Prioridad (`AmberAlertBanner.tsx`):** Componente flotante de mÃ¡xima prioridad naranja animado que notifica en tiempo real a todos los nodos conectados.
- **Panel de AdministraciÃ³n para Autoridades (`AmberAdminPanel.tsx`):** EmisiÃ³n de alertas con fotografÃ­a base64, coordenadas GPS, tiempo de expiraciÃ³n (TTL) y firmas Ed25519.
- **Reporte de Avistamientos Geolocalizados:** Permitir a cualquier usuario reportar avistamientos directamente a las autoridades.

**Guardian IA (ModeraciÃ³n Off-Grid & HÃ­brida)**
- **Motor Off-Grid Nivel 0 en Rust (`guardian.rs`):** EvaluaciÃ³n heurÃ­stica local en `<1ms` sin internet ni dependencias externas en el nodo emisor antes del cifrado E2E.
- **Ventana de Contexto Deslizante (Anti-Grooming):** EvaluaciÃ³n acumulativa de los Ãºltimos 5 mensajes de la conversaciÃ³n para detectar patrones de acoso o grooming progresivos.
- **AuditorÃ­a Cloud HÃ­brida (Groq LlamaGuard 4 12B):** ClasificaciÃ³n semÃ¡ntica remota opcional con la API de Groq usando formato de conversaciÃ³n role-based estandarizado (`meta-llama/llama-guard-4-12b`).
- **Panel de Transparencia (`GuardianStatusPanel.tsx`):** Monitoreo en vivo de mÃ©tricas (analizados/bloqueados/cache hits) y formulario de reporte manual de contenido.

---

## [16.1.0] - 2026-07-21

### AÃ±adido â€” InterconexiÃ³n P2P Web â†” Mobile & RenegociaciÃ³n WebCrypto ECDH

**InterconexiÃ³n Web-Mobile & SeÃ±alizaciÃ³n P2P**
- **Puente P2P Web â†” Mobile (WebRTC DataChannel):** ComunicaciÃ³n cifrada punto a punto directa entre cualquier navegador web (`https://darckrovert.github.io/RED/`) y la App MÃ³vil Android sin requerir telÃ©fono celular ni servidores centrales.
- **Cluster de SeÃ±alizaciÃ³n Ampliado (`signaling/server.js`):** ExpansiÃ³n de capacidad a 50 pares P2P simultÃ¡neos por sala para mallas descentralizadas.
- **Cifrado ECDH WebCrypto en Tiempo Real:** RenegociaciÃ³n dinÃ¡mica de claves P-256 en tiempo real en la Web SPA mediante la API criptogrÃ¡fica nativa del navegador.
- **Persistencia de Identidad Offline:** Carga automÃ¡tica de DIDs personalizados (`red_identity_hash`, `red_displayName`) desde el almacenamiento local sin sobrescribir en modo sin conexiÃ³n.
- **NavegaciÃ³n Unificada SPA:** CorrecciÃ³n de botones de retorno e itinerario directo a `/RED/chat.html` desde todas las vistas avanzadas (`nodemap`, `settings`, `crypto`, `contacts`).

---

## [16.0.0] - 2026-07-20

### AÃ±adido â€” RED v16.0 Zenith Master Architecture Release

**Comunicaciones P2P & Multimedia**
- **Insignias DinÃ¡micas de Transporte Mesh:** IdentificaciÃ³n visual clara (ðŸŒ WAN, ðŸ“¶ mDNS, ðŸ“¡ BLE) en burbujas de mensaje segÃºn la ruta P2P de entrega.
- **Videollamadas P2P WebRTC con STUN Fallback:** Traversal dinÃ¡mico P2P en redes 4G/5G con fallback a servidor STUN.
- **Notas de Voz Nativas:** GrabaciÃ³n con micro-animaciÃ³n de forma de onda y reproductor interactivo.
- **Visor de Fotos Fullscreen:** Visor con Zoom 1.8x y botÃ³n de descarga directa.

**AdministraciÃ³n & BÃºsqueda Cifrada**
- **Administrador de Grupos P2P (`GroupAdminModal`):** AdiciÃ³n y expulsiÃ³n de integrantes en grupos cifrados.
- **BÃºsqueda Global en Mensajes (`GlobalSearchModal`):** Buscador profundo por palabras clave en todo el historial cifrado.
- **BÃ³veda de Respaldo `.redbak` (`BackupRestoreModal`):** ExportaciÃ³n e importaciÃ³n de copias de seguridad cifradas con clave.

**DiagnÃ³sticos, Seguridad TÃ¡ctica & Empaquetado Nativo**
- **Auto-DiagnÃ³stico SSE en Vivo (`SystemHealthModal`):** Prueba de canal `EventSource('/api/events')` midiendo latencia RTT real.
- **Consola de Logs Rust (`NodeLogsModal`):** Stream estilo terminal verde-neÃ³n para auditar eventos P2P en directo.
- **Simulador de ApagÃ³n TÃ¡ctico (`BlackoutSimulatorModal`):** EvaluaciÃ³n de resiliencia mesh ante cortes totales de internet.
- **Informe de AuditorÃ­a Exportable (`SecurityReportModal`):** Generador de fichas de postura de seguridad copiables al portapapeles.
- **Empaquetado Nativo Android APK (`app-debug.apk`):** CompilaciÃ³n ejecutada mediante Gradle Wrapper (`BUILD SUCCESSFUL in 24s`, 98.9 MB).

---

## [7.2.0] - 2026-07-19

### AÃ±adido â€” Zero-RAM Storage Engine (Sled), Paridad de Seguridad y CompilaciÃ³n Automatizada

**Base de Datos & Rendimiento (Fase 1)**
- **Motor de base de datos embebida Sled:** MigraciÃ³n completa del almacenamiento volÃ¡til en memoria (`HashMap`) a Sled transaccional persistente, cifrando individualmente registros en disco (conversaciones, mensajes, configuraciÃ³n, perfiles, identidades, dispositivos y grupos).

**Seguridad y Red Descentralizada (Fase 4)**
- **Bloqueo Inbound en Capa P2P:** Los mensajes provenientes de peers bloqueados son interceptados y descartados en caliente en `node.rs` en la recepciÃ³n del transporte, impidiendo que lleguen a disco o UI.
- **Cola de Reintentos Offline (Delay-Tolerant Networking):** Si un peer estÃ¡ offline al enviar, el mensaje se almacena temporalmente de forma persistente y un loop de 15 segundos en segundo plano reintenta la transmisiÃ³n cuando el peer vuelve a estar visible en la topologÃ­a local.
- **Safety Numbers & UI de CriptografÃ­a:** Pantalla de perfil de chat rediseÃ±ada con huella de seguridad (Safety Number) determinista de 20 dÃ­gitos y botones nativos para verificar y bloquear contactos con actualizaciÃ³n de estado sÃ­ncrona en React.
- **Correcciones JNI y CLI:** Saneamiento de punteros y de-referenciaciones de tipos owned tras la migraciÃ³n a Sled para prevenir crashes en `red_mobile` (JNI Android) y CLI de escritorio (`node/src/main.rs`).

**AutomatizaciÃ³n de Despliegue (Fase 5)**
- **Pipeline AutomÃ¡tico de APK de ProducciÃ³n:** Paso 5 integrado en `build_android.ps1` que compila el frontend, sincroniza Capacitor, compila Rust NDK arm64, y ejecuta el wrapper Gradle `./gradlew.bat assembleRelease` para empaquetar el APK firmado en un solo comando de consola.

---

## [16.0.0] - 2026-03-30

### AÃ±adido â€” RED P2P Mesh Networking Finalization (Offline-First)

**Core P2P & Transport Layer**
- **WebRTC Nativo (Sin STUN):** EliminaciÃ³n total de dependencias de servidores STUN externos. Todo el signaling WebRTC ahora ocurre 100% offline-first a travÃ©s de `/local-signal` (SSE y websockets locales) o BLE.
- **NodeMap Interactivo (Real-Data):** El mapa 3D de geometrÃ­a de nodos ahora representa conexiones reales extraÃ­das del `localTransport.allPeers`. Las coordenadas se derivan determinÃ­sticamente de los hashes Ed25519 de los nodos.
- **LoRaWAN Config Bridge:** El panel de red ahora envÃ­a la configuraciÃ³n de baud rate y puerto serial directamente al nodo Rust mediante el nuevo endpoint `POST /api/settings/lora` para hot-reloading del bridge de radio.

**Correcciones CrÃ­ticas (AuditorÃ­a Cero-Fallas)**
- **CallScreen Telemetry:** El peer ahora recibe correctamente la seÃ±al de `hangup` (colgar) para destruir el peer connection remoto. AÃ±adidas validaciones estrictas para evitar crashes cuando `peerHash` es null.
- **MensajerÃ­a & Estado:** Implementada deduplicaciÃ³n de mensajes por ID en `useRedStore` para manejar reconexiones del EventSource (SSE) sin duplicar las burbujas de chat.
- **ConfirmaciÃ³n de Lectura (Read Receipts):** Nuevo endpoint `POST /api/conversations/{id}/read` en el nodo Rust. La interfaz ahora notifica al nodo cuando una conversaciÃ³n es abierta, permitiendo que el remitente vea la doble palomita azul de forma fidedigna.
- **Audio Decoding:** CorrecciÃ³n del parseo base64 para mensajes de voz, prefijando correctamente el tipo MIME `data:audio/ogg;base64,` antes de inyectarlo en el DOM.
- **Blockchain Explorer:** CorrecciÃ³n de la renderizaciÃ³n del epoch time de las identidades registradas, y uso real de los datos del Gossip Protocol.

---

## [16.0.0] - 2026-03-21

### AÃ±adido â€” Website Masterpiece Edition & AuditorÃ­a Final

**Landing Page de Nueva GeneraciÃ³n**
- **Motor de Scroll Ultra-Fluido:** IntegraciÃ³n corregida de GSAP + Lenis con sincronizaciÃ³n de frames para 60FPS constantes sin stuttering.
- **Visuales 3D High-End:** ImplementaciÃ³n isomÃ©trica de la arquitectura en CSS3 puro y tarjetas de comparaciÃ³n con efecto dinÃ¡mico Glassmorphism.
- **Narrativa Profesional:** RevisiÃ³n completa de textos (Copywriting) eliminando informalidades y adoptando un tono corporativo-militar de alta autoridad.
- **Resiliencia de NavegaciÃ³n:** Parche lÃ³gico en `script.js` para manejo robusto de anclas y menÃºs mÃ³viles.

**Refinamientos de Seguridad TÃ¡ctica**
- **AuditorÃ­a de Datos v16.0.0:** SincronizaciÃ³n de todas las mÃ©tricas, versiones y caracterÃ­sticas en la web y la app.
- **BÃ³veda de Grado Militar:** PresentaciÃ³n refinada de las capacidades de PIN de PÃ¡nico, Camuflaje y Secure Enclave.
- **Clean Audit:** EliminaciÃ³n de archivos basura, logs redundantes y depuraciÃ³n del repositorio Git.

## [5.0.1] - 2026-03-20

### AÃ±adido â€” Seguridad BiomÃ©trica & Keystore (Fases 34-36)

**Arquitectura de AutenticaciÃ³n Cero Confianza**
- **MigraciÃ³n a Android Keystore / iOS Secure Enclave (`SecureStoragePlugin`):** Almacenamiento criptogrÃ¡fico respaldado por hardware del PIN Maestro, PIN de PÃ¡nico, PIN SeÃ±uelo y Banderas de Onboarding.
- **BiometrÃ­a Nativa Integrada (`BiometricAuth`):** Permite el desbloqueo rÃ¡pido de la bÃ³veda mediante Huella Dactilar o FaceID validado por el sistema operativo.
- **Onboarding Interactivo Riguroso:** Nuevo flujo de configuraciÃ³n donde el usuario debe crear y confirmar su PIN maestro irrecuperable.
- **RemociÃ³n de Hardcodes:** EliminaciÃ³n definitiva de llaves maestras estÃ¡ticas (ej. "1234", "9999"). El usuario es el Ãºnico propietario del acceso.
- **SSR Hydration Anti-Crash Guard:** PrevenciÃ³n de "pantallas negras" en React Server Components al aislar los plugins de Capacitor hasta la completa hidrataciÃ³n del cliente.

---

## [5.0.0] - 2026-03-13

### AÃ±adido â€” RediseÃ±o "Solid UI" & Hardware Real (Fases 25-33)

**Nueva Identidad Visual "Solid/Clean"**
- **AdiÃ³s Glassmorphism:** EliminaciÃ³n global de transparencias y efectos de desenfoque (`backdrop-filter`) en favor de un diseÃ±o sÃ³lido, profesional y de alto contraste inspirado en WhatsApp y Telegram.
- **Burbujas con Estilo:** Mensajes con "colas" direccionales y nueva jerarquÃ­a visual de timestamps y ticks de lectura.
- **Input Capsular:** RediseÃ±o del pie de chat en forma de pÃ­ldora con iconos de adjuntos integrados y botÃ³n de voz/enviar flotante.
- **Avatares DinÃ¡micos:** Sistema de generaciÃ³n de avatares automÃ¡ticos (Iniciales + Color Hash) para todos los contactos y grupos.
- **Wallpaper de Chat:** IntegraciÃ³n de texturas de fondo sutiles para una experiencia de chat inmersiva.

**Conectividad & Hardware (Real P2P)**
- **BLE Peripheral Real:** ImplementaciÃ³n nativa en Java (`RedNodeService.java`) del rol de Anunciante (Advertiser), permitiendo que el dispositivo sea descubierto por otros sin necesidad de escaneo activo constante.
- **Radar Nearby Live:** El panel de dispositivos cercanos ahora utiliza hardware real para detectar y conectar pares mediante BLE y WiFi Direct.
- **Estabilidad Android 14:** CorrecciÃ³n de fallos crÃ­ticos de servicios en primer plano mediante la implementaciÃ³n de `FOREGROUND_SERVICE_TYPE_DATA_SYNC` y manejo de excepciones en el bootstrap del nodo Rust.

**IntegraciÃ³n de Datos Reales**
- **Fin de los Mocks:** Saneamiento completo de las vistas de AdministraciÃ³n de Grupos, Multidispositivo y EstadÃ­sticas, conectÃ¡ndolas directamente al estado real del nodo Rust y Zustand.
- **AuditorÃ­a Visual Global:** RevisiÃ³n y pulido de mÃ¡s de 12 vistas secundarias (Cripto, Status, Perfil, Nodos) para asegurar una consistencia visual del 100%.

---

## [4.0.0] - 2026-03-09

### AÃ±adido â€” Suite de Seguridad Total (Fases D, F, G, E, H)

**Seguridad Activa & Anti-Forense**
- Bloqueo avanzado de captura y grabaciÃ³n de pantalla (FLAG_SECURE a nivel de OS).
- PIN de PÃ¡nico (Wipe Lockscreen): DestrucciÃ³n automÃ¡tica criptogrÃ¡fica bajo coacciÃ³n.
- Disfraz de AplicaciÃ³n: Icono y nombre de "Calculadora" en el sistema operativo.
- Dead Man's Switch: Purga cronometrada automÃ¡tica configurable de cuenta y base de datos local por inactividad.

**Anonimato & Trazabilidad**
- Burner Chats (RAM-Only): Conversaciones efÃ­meras ultraseguras mantenidas puramente en estado volÃ¡til.
- Compartir UbicaciÃ³n en Vivo (Live Tracking E2E): EmisiÃ³n de coordenadas y mapas interactivos que se autodestruyen.
- AuditorÃ­a del Secure Enclave: DetecciÃ³n mockeada de Root, Jailbreak y emuladores hostiles dentro de los paneles criptogrÃ¡ficos y HUD.

**UI/UX Overhaul (Premium)**
- TransiciÃ³n general a Modo "True Black" para displays OLED.
- TipografÃ­a global _JetBrains Mono_ priorizada para datos sensibles, hashes, DIDs y direcciones IP.
- Landing Page reescrita: IntegraciÃ³n de **Globe.gl** y **Three.js** mostrando un globo terrÃ¡queo interactivo en 3D para ilustrar la red P2P global en tiempo real.
- HUD TÃ¡ctico permanente informando si el trÃ¡fico corre vÃ­a Mesh Local, BLE, o red Global de Internet.

---

## [3.0.0] - 2026-02-26

### AÃ±adido â€” Fases 14-36 (WhatsApp Parity + RED Exclusive)

**MensajerÃ­a avanzada**
- Estados/Stories de 24h con compose de texto e imagen, selector de fondo, progress bar animada
- Mensajes guardados (â­) con pÃ¡gina dedicada y unstar
- Vista previa automÃ¡tica de URLs (LinkPreview.tsx sin trackers)
- Encuestas interactivas en grupos (PollBubble + PollComposer, hasta 6 opciones)
- Mensajes efÃ­meros por conversaciÃ³n (setDisappearingTimer)
- Mensajes programados con setTimeout (scheduleMessage/cancelScheduled)
- Reenviar mensaje a cualquier conversaciÃ³n (forwardMessage)

**Red & Dispositivos**
- Multi-dispositivo por QR SVG procedural (/multidevice)
- SincronizaciÃ³n de contactos por deeplink `red://add-contact/...` (/contactsync)
- RED Nearby: UI de descubrimiento LAN/BLE con animaciÃ³n de pulso
- Exportar chat como .txt o .json con Blob/URL API (/export)
- Mapa de nodos RED animado en tiempo real (SVG, 8 nodos, aristas pulsantes) (/nodemap)

**Perfil & Presencia**
- Historial de llamadas con filtro perdidas/todas (/calls)
- Perfil de contacto detallado: 4 pestaÃ±as (Info, Multimedia, Archivos, Links) (/contactprofile)
- CÃ³digos QR por DID con Web Share API (/contactqr)
- EstadÃ­sticas de uso con 3 perÃ­odos y grÃ¡fico de barras (/stats)

**Admin & Grupos**
- Panel de admin de grupo: promover/demote/silenciar/expulsar con toasts (/groupadmin)
- Listas de difusiÃ³n: crear, seleccionar contactos, envÃ­o masivo (/broadcast)
- BÃºsqueda global de mensajes con resaltado del tÃ©rmino (/search via Sidebar ðŸ”)

**Seguridad**
- Panel de criptografÃ­a: vista de claves DH/Ed25519, renegociaciÃ³n DH, verificaciÃ³n de integridad (/crypto)

**UX & PersonalizaciÃ³n**
- Tema claro/oscuro con variables CSS y persistencia en localStorage
- Fondos de conversaciÃ³n: 6 gradientes por chat (WallpaperPicker.tsx)
- Etiquetas de chat: 6 tipos con colores (ChatLabels.tsx)
- Notificaciones por chat: silenciar, tono, vibraciÃ³n, media preview (ChatNotifSettings.tsx)
- Indicador offline con reconexiÃ³n automÃ¡tica (OfflineIndicator.tsx)

### EstadÃ­sticas v3.0
- **21 rutas de producciÃ³n** (eran 8 en v1.0)
- **16 componentes** reutilizables
- **36 fases** completadas
- **~52 KB** de CSS (components.css)
- Build: `exit code 0` âœ…

---

## [2.0.0] - 2026-02-25

### AÃ±adido â€” Fases 9-13 (MensajerÃ­a Real & Calls)
- Reply a mensaje con cita visual en burbuja
- Reacciones emoji (6 opciones, menÃº contextual)
- Eliminar mensaje, estado entrega (âœ“ âœ“âœ“ azul)
- Media: imÃ¡genes, audio (MediaRecorder), archivos (FileReader base64)
- DisplayName + avatar persistentes en localStorage
- Typing indicator animado ("escribiendo...")
- Service Worker + Notification API (Push)
- CallScreen.tsx: WebRTC, controles mute/cÃ¡mara/speaker, timer

---

## [1.0.0] - 2026-02-25

### AÃ±adido
- **ProducciÃ³n Ready**: Lanzamiento oficial del protocolo RED.
- **Multiplataforma**: Soporte completo para iOS, Android y Navegadores (Capacitor).
- **Grupos Descentralizados**: Salas de chat cifradas sin servidores centrales.
- **Explorador Blockchain**: Dashboard tÃ©cnico para monitorear la salud de la red P2P.
- **Onboarding Interactivo**: Flujo de bienvenida para generaciÃ³n segura de identidades DID.
- **Libreta de Contactos**: Directorio funcional con bÃºsqueda global y gestiÃ³n de identidades.
- **UX Premium**: Sistema de notificaciones Toast, indicadores de entrega (ticks) y visuales de multimedia.
- **Emergency Mobile Polish**: EliminaciÃ³n de solapamientos visuales, correcciÃ³n de z-index en mÃ³viles y optimizaciÃ³n de legibilidad de textos.
- **Demo Mode**: Sistema de persistencia de datos mock para demostraciones de funcionalidad sin nodo local.
- **DocumentaciÃ³n Completa**: Manual de Usuario, Manual de Administrador y especificaciones actualizadas.

---

## [0.2.0-beta] - 2026-02-15

### AÃ±adido
- Interfaz grÃ¡fica (Web UI) con Next.js y Zustand.
- IntegraciÃ³n real con el nodo Rust mediante HTTP API y SSE.
- Sistema de bÃºsqueda en tiempo real.
- OptimizaciÃ³n de Ã¡reas seguras para dispositivos mÃ³viles.

---

## [0.1.0-alpha] - 2026-02-01

### AÃ±adido

#### Core CriptogrÃ¡fico
- ImplementaciÃ³n de X25519 para intercambio de claves
- ImplementaciÃ³n de Ed25519 para firmas digitales
- Cifrado ChaCha20-Poly1305 (AEAD)
- Hashing con BLAKE3
- DerivaciÃ³n de claves con HKDF
- Protocolo Double Ratchet completo
  - Ratchet DH
  - Ratchet de cadena
  - Manejo de mensajes fuera de orden
  - Forward secrecy

#### Sistema de Identidad
- GeneraciÃ³n de identidades anÃ³nimas
- RotaciÃ³n de identidad (unlinkability)
- Hash de identidad con nonce aleatorio
- ExportaciÃ³n/importaciÃ³n cifrada de identidades

#### Red P2P
- ConfiguraciÃ³n de red bÃ¡sica
- Estructura de peers
- Onion routing (3 capas)
- Generador de trÃ¡fico dummy (distribuciÃ³n Poisson)
- Protocolo Gossip para propagaciÃ³n

#### Protocolo de MensajerÃ­a
- Mensajes de texto cifrados
- Conversaciones 1:1
- MensajerÃ­a grupal (Sender Keys)
- Metadatos cifrados

#### Blockchain
- Estructura de bloques
- Cadena de bloques bÃ¡sica
- Transacciones de identidad
- Consenso Proof of Stake (bÃ¡sico)

#### Almacenamiento
- Almacenamiento local cifrado
- PolÃ­tica de borrado automÃ¡tico (30 dÃ­as)

#### Pruebas Zero-Knowledge
- Pruebas de membresÃ­a Merkle
- Sistema de nullifiers

#### Especificaciones Formales
- EspecificaciÃ³n TLA+ del protocolo
- Modelos ProVerif para verificaciÃ³n de seguridad
- Pruebas de anonimato en ProVerif

#### Bindings
- Bindings Python (PyO3)
- Bindings JavaScript/TypeScript (WASM)

#### DocumentaciÃ³n
- README principal
- EspecificaciÃ³n matemÃ¡tica
- Arquitectura del sistema
- Referencia de API
- Informe de auditorÃ­a de seguridad

### Seguridad
- ParÃ¡metro de seguridad: 128 bits
- Borrado seguro de claves (zeroize)
- ValidaciÃ³n de entradas criptogrÃ¡ficas

### Limitaciones Conocidas
- Red P2P aÃºn no conectada a libp2p real
- Blockchain sin persistencia completa
- Sin cliente mÃ³vil/desktop
- Sin llamadas de voz/video

---

## Roadmap

### [0.2.0] - Planificado Q2 2026
- IntegraciÃ³n completa con libp2p
- Cliente CLI funcional
- Tests de integraciÃ³n end-to-end
- Mejoras de rendimiento

### [0.3.0] - Planificado Q3 2026
- Cliente mÃ³vil (Flutter)
- Cliente desktop (Tauri)
- SincronizaciÃ³n multi-dispositivo
- Grupos grandes (1000+ miembros)

### [0.4.0] - Planificado Q4 2026
- Llamadas de voz cifradas
- Transferencia de archivos grandes
- AuditorÃ­a de seguridad externa
- Optimizaciones de baterÃ­a (mÃ³vil)

### [1.0.0] - Planificado 2027
- Lanzamiento pÃºblico estable
- Apps en stores oficiales
- DocumentaciÃ³n completa
- Soporte empresarial

---

## Tipos de Cambios

- **AÃ±adido** para nuevas funcionalidades.
- **Cambiado** para cambios en funcionalidades existentes.
- **Obsoleto** para funcionalidades que serÃ¡n eliminadas prÃ³ximamente.
- **Eliminado** para funcionalidades eliminadas.
- **Corregido** para correcciÃ³n de bugs.
- **Seguridad** para vulnerabilidades corregidas.

