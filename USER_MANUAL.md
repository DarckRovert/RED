# 📘 Manual Operativo del Usuario — RED v124.0.0 Sovereign Tactical & Familiar Edition

Bienvenido al manual de operaciones tácticas de **RED**, la plataforma descentralizada de comunicaciones soberanas, cifradas e inmunes a fallos de infraestructura, apagones o censura.

---

## 📋 Tabla de Contenidos

1. [Primer Inicio & Autenticación Soberana](#1-primer-inicio--autenticación-soberana)
2. [Llaves Biométricas Universales & Passkeys](#2-llaves-biométricas-universales--passkeys)
3. [Gestión de Seguridad, Modo Señuelo & Anti-Coacción](#3-gestión-de-seguridad-modo-señuelo--anti-coacción)
4. [Respaldo en 1 Toque & Restauración Instantánea](#4-respaldo-en-1-toque--restauración-instantánea)
5. [Catálogo Operativo de los 65 Módulos & Pantallas Tácticas](#5-catálogo-operativo-de-los-65-módulos--pantallas-tácticas)
6. [Tokenomics DePIN, Vales Criptográficos & Paridad PEN](#6-tokenomics-depin-vales-criptográficos--paridad-pen)
7. [Actuadores de Hardware: Triaje START, SOS & SoundMesh](#7-actuadores-de-hardware-triaje-start-sos--soundmesh)
8. [Uso de la Versión Web en PC & Vinculación con Celulares](#8-uso-de-la-versión-web-en-pc--vinculación-con-celulares)
9. [Uso de Radios LoRa, Slots TDMA & Repetidores Solares Autónomos](#9-uso-de-radios-lora-slots-tdma--repetidores-solares-autónomos)
10. [Preguntas Frecuentes & Solución de Problemas](#10-preguntas-frecuentes--solución-de-problemas)
11. [Operación del Vivarium Biocibernético 3D & Telemetría Táctica](#11-operación-del-vivarium-biocibernético-3d--telemetría-táctica)
12. [Operación del Hábitat Digital Biocibernético In-Silico & Coexistencia Multicerebral](#12-operación-del-hábitat-digital-biocibernético-in-silico--coexistencia-multicerebral)

---

## 1. Primer Inicio & Autenticación Soberana

1. Al abrir la aplicación RED por primera vez, el sistema te solicitará configurar tu **PIN Maestro de exactamente 6 dígitos**.
2. Este PIN protege tu **Bóveda Criptográfica** en la memoria segura por hardware del dispositivo (Android KeyStore / StrongBox TEE o almacenamiento seguro en navegador).
3. Tras confirmar el PIN, el motor nativo en Rust genera localmente tu Identidad Soberana única (`did:red:<identity_hash>:<public_key>`).
4. **Cero Dependencia de Servidores:** Tu cuenta no se crea en ningún servidor remoto ni requiere números de teléfono ni correos electrónicos.

---

## 2. Llaves Biométricas Universales & Passkeys

RED te permite desbloquear la aplicación en 1 solo toque mediante cualquier sensor biométrico que posea tu dispositivo:

- **En Celulares y Tablets Android:**
  - **Huella Dactilar:** Reconocimiento instantáneo mediante sensores capacitivos, ópticos o ultrasónicos en pantalla.
  - **Reconocimiento Facial & Escáner de Iris:** Verificación facial segura mediante hardware compatible.
- **En Computadoras (Web & Desktop):**
  - **Windows Hello:** Desbloqueo mediante cámara infrarroja o lector de huellas de tu PC.
  - **Apple Touch ID / Face ID:** En computadoras Mac y dispositivos Apple.
  - **Passkeys WebAuthn:** Credenciales criptográficas de plataforma.
- **Enrolamiento en 1 Clic:** Al configurar tu PIN de 6 dígitos en el primer uso, la app te preguntará si deseas activar tu sensor biométrico. Acepta para vincular tu huella o rostro de inmediato.
- **Acceso Rápido en la Pantalla de Bloqueo:** Toca el botón `🖐️ BIOMETRÍA` en el teclado numérico para disparar el sensor en cualquier momento.

---

## 3. Gestión de Seguridad, Modo Señuelo & Anti-Coacción

RED está diseñada bajo la premisa de que un operador puede encontrarse en situaciones de coacción física o inspección forzada:

- **PIN Maestro (6 dígitos):** Acceso a tu bóveda real con todos los contactos, mensajes y archivos cifrados.
- **PIN Señuelo (`decoy_pin`):** Abre la **Bóveda Señuelo**, un entorno totalmente limpio y verosímil con conversaciones civiles inocentes, sin dejar rastro de tus comunicaciones operativas reales.
- **PIN de Pánico (`panic_pin`):** Destrucción instantánea (*Panic Wipe*) de todas las bases de datos y claves del dispositivo en menos de 500 ms.
- **Medida Anti-Coacción (Desactivar Auto-Prompt):** En *Ajustes $\rightarrow$ Privacidad*, puedes desactivar el auto-disparo de huella dactilar. Si te encuentras en una zona hostil, la app solo mostrará el teclado numérico, permitiéndote ingresar discretamente el PIN Señuelo si alguien te obliga a desbloquear el teléfono.
- **Auto-Bloqueo de Inactividad:** La app detecta cuándo se minimiza o bloquea la pantalla, exigiendo reingreso de huella o PIN tras el tiempo establecido (`Inmediato`, `1 min`, `5 min`, `15 min`).

---

## 4. Respaldo en 1 Toque & Restauración Instantánea

- **⚡ Respaldar a Google Drive:** Entra a Ajustes $\rightarrow$ *Respaldo & Nube* y presiona `⚡ Respaldar a Google Drive en 1 Toque`. El respaldo se genera bajo cifrado de grado militar **AES-256-GCM** derivado de tu PIN.
- **🔄 Auto-Sync en Segundo Plano:** Activa el interruptor para mantener actualizada tu copia en la nube cada vez que recibas nuevos contactos o mensajes.
- **☁️ Restauración en Teléfono Nuevo:** En la pantalla de bienvenida, presiona `☁️ Restaurar copia de seguridad previa`, introduce tu PIN de 6 dígitos, selecciona el archivo `.redvault` y recupera todo en 3 segundos sin registrarte de nuevo.

---

## 5. Catálogo Operativo de los 65 Módulos & Pantallas Tácticas

1. **Canales Mesh Locales:** Salas temáticas abiertas para operadores cercanos con moderación por IA.
2. **RED Social Feed P2P:** Microblogging descentralizado y resistente a la censura.
3. **Difusión Privada (Broadcast):** Envío simultáneo de comunicados cifrados a múltiples contactos.
4. **Walkie-Talkie Push-To-Talk:** Radio digital de voz con bajísimo consumo de ancho de banda (códec Vocoder 1.6–3.2 kbps).
5. **Canvas Táctico P2P:** Pizarra colaborativa para dibujar planos tácticos y mapas sincronizados en vivo.
6. **Live Broadcast Stream:** Emisión y recepción de video local en tiempo real sin internet.
7. **Shake & Pair:** Agita tu teléfono fuertemente (>15 m/s²) junto a otro operador para emparejarte en 1 segundo.
8. **Radar Topográfico GPS & UTM:** Brújula de alta precisión con declinación magnética WMM2025 y altímetro.
9. **Mapa de Nodos P2P:** Visualización geoespacial de la topología de la malla y métricas de enlace.
10. **Radar Hardware BLE / WiFi:** Detección de dispositivos electromagnéticos cercanos en tiempo real.
11. **Analizador Espectro RF / EW:** Monitoreo de emisiones de radio y niveles de ruido/interferencia.
12. **Ondas de Proximidad:** Detección de pares cercanos mediante firmas de radiofrecuencia.
13. **Clima & Barómetro CAP:** Reportes meteorológicos y alertas de presión atmosférica local.
14. **Batería Eco-Mesh:** Gobernador cinemático que optimiza el consumo de batería (hasta 48h continuas).
15. **Consenso Blockchain PoS:** Validación de bloques y participación en el consenso de la red.
16. **Vales Criptográficos P2P:** Pagos soberanos fuera de línea con paridad 1:1 en Soles (PEN).
17. **Cápsula de Esteganografía:** Oculta archivos sensibles dentro de imágenes aparentemente inocuas.
18. **Interruptor del Hombre Muerto (DMS):** Purga automática si el usuario no introduce un ping de vida en el tiempo fijado.
19. **Triaje Médico START:** Clasificación rápida de heridos en catástrofes (Verde, Amarillo, Rojo, Negro).
20. **Baliza de Emergencia SOS:** Transmisión continua de socorro por radiofrecuencia y destellos Morse.
21. **SoundMesh Ultrasónico:** Transmisión de datos acústicos por altavoz (18–20 kHz) sin antenas de radio.
22. **Auditoría de Seguridad OPSEC:** Verificación continua de puertos abiertos y aislamiento de red.
23. **Calculadora Señuelo:** Camufla la app como una calculadora funcional real.
24. **Bóveda Señuelo (Decoy Vault):** Espacio alternativo con datos simulados inocentes.
25. **Almacén Cifrado Sled:** Base de datos nativa ultrarrápida con cifrado simétrico AES-256-GCM.
26. **Árbol Merkle State Integrity:** Verificación automática de la integridad de los datos en disco.
27. **Guardian IA Firewall:** Filtro neuronal que neutraliza intentos de inyección y contenido malicioso.
28. **RAG Semántico Vectorial:** Base de conocimiento de táctica y primeros auxilios 100% offline.
29. **IA Copilot Táctico:** Asistente conversacional neuronal que opera sin conexión a internet.
30. **LowBitrateVocoder DSP:** Procesamiento de audio comprimido al -97.9% para radios lentas.
31. **Mesh Proof-of-Work:** Sistema Hashcash que evita la saturación de la red por spam o denegación.
32. **Web Companion QR:** Vinculación directa entre navegadores web de PC y la app del celular.
33. **Respaldo Soberano 1-Toque:** Exportación e importación rápida de bóvedas cifradas.
34. **MetaMask EIP-712:** Vinculación de identidades soberanas con firmas criptográficas de Ethereum.
35. **Gestor de Contactos Consent-First:** Control estricto de quién puede comunicarse contigo.
36. **Transmisión de Archivos Fragmentados:** Envío de fotos y documentos divididos en fragmentos por la malla.
37. **Llamadas de Voz Cifradas WebRTC:** Audio bidireccional punto a punto con cifrado de extremo a extremo.
38. **Videollamadas de Baja Latencia:** Video P2P cifrado mediante DTLS-SRTP.
39. **Gobernador de Canal RF:** Salto de frecuencias adaptativo para evadir congestión o bloqueo.
40. **Telemetría de Enlace LQS:** Monitoreo continuo de la calidad de señal (RSSI y SNR).
41. **Autenticación Biométrica Universal:** Huella, rostro, iris o Passkeys integrados al hardware.
42. **Auto-Bloqueo por Inactividad:** Cierre automático de la sesión al minimizar la aplicación.
43. **Coordinador LoRa TDMA:** Monitor de supertrama de 2000 ms y slot asignado en tiempo real.
44. **Selector de Cuadrante Geohash:** Configuración de granularidad espacial para enrutamiento local o regional.
45. **Telemetría de Repetidor Solar:** Lectura en vivo de niveles de batería y paquetes retransmitidos.
46. **Gateway Satelital LEO:** Panel de sincronización para pases de satélites de órbita baja.
47. **Visor CAD Táctico:** Inspección de planos de 4 capas y topología vectorial 4K.
48. **Detector CBRN & Radiación:** Sensor de radiación nuclear y contaminantes químicos.
49. **Navegación Celeste & PDR:** Odometría de pasos y orientación estelar sin GPS.
50. **Triangulación RDF:** Estimación de rumbo de señales de radio hostiles o amigas.
51. **Búnker Anti-Forense:** Destrucción certificada de memoria flash y desmagnetización digital.
52. **Túneles Encubiertos DoH:** Comunicación ofuscada en servidores DNS seguros.
53. **Sismógrafo Táctico:** Detección de sismos y estimación de magnitud local.
54. **Purificador de Agua:** Protocolos de potabilización y cálculo de tabletas de cloro.
55. **Guía Balística & TCCC:** Tablas de caída de proyectil y procedimientos de primeros auxilios de combate.
56. **Morse Óptico LiFi:** Comunicación por destellos rápidos de luz LED visible.
57. **Sensor Óptico de Gases:** Identificación de humo y partículas tóxicas mediante la cámara.
58. **Reportes Militares CoT/Sitrep:** Generación de formatos estándar Cursor-on-Target.
59. **Gobernador Cinético:** Calibración de radio según el movimiento y velocidad del operador.
60. **Bóveda de Trueque:** Catálogo de recursos offline para intercambio en emergencias.
61. **Sigint Subterráneo:** Captación de vibraciones terrestres mediante giroscopio y acelerómetro.
62. **Resguardo de Secretos Shamir:** Reparto de claves en fragmentos entre miembros de la escuadra.
63. **Conectoma Neuromórfico MaleCNS:** Visualizador 3D y atlas somático de 124,289 neuronas con enrutamiento Hebbiano de micro-espigas AER.
64. **Vivarium Biocibernético 3D:** Gemelo digital interactivo WebGL en tiempo real con suelo entorrinal hexagonal multiescala, cinemática de 6 patas sincronizada con el CPG de Kuramoto-Matsuoka, modo PDR Twin de navegación inercial a pasos reales, puente robótico TX 18-DOF para servos reales, detector de estrés cinético (shock/man-down), balizas LoRa y satélite orbital LEO con inyección de amenazas ópticas Looming.
65. **Hábitat Digital Biocibernético In-Silico:** Ecosistema multi-cerebro interactivo WebGL 3D / 2D con simulación de difusión continua de Fick a 60 Hz (glucosa y feromonas), cohabitación de las 5 inteligencias del proyecto (*Drosophila melanogaster*, *Neocórtex Humano*, *Gravity Sentinel IA*, *Caenorhabditis elegans* y *Formicidae*), ludoteca interactiva (Gran Torneo de Glucosa, puntero láser juguetón, lluvia de néctar, ráfaga acrobática), bocadillos de pensamiento holográficos 3D/2D, acciones afectivas directas, instrumental de laboratorio (pipeta de glucosa, foco térmico, sombra looming, optogenética ChR2), balance celular de ATP con letargo metabólico (torpor) y migración binaria compacta P2P en malla LoRa/BLE.

---

## 6. Tokenomics DePIN, Vales Criptográficos & Paridad PEN

- **Proof-of-Relay:** Tu nodo gana recompensas en tokens RED automáticamente al retransmitir paquetes para otros usuarios en la red malla.
- **Vales Offline:** Crea vales de transferencia firmados criptográficamente con Ed25519 para pagar bienes y servicios en zonas sin internet ni bancos.
- **Paridad 1:1:** Cada token RED equivale a **S/. 1.00 PEN**, permitiendo economía circular en situaciones de colapso monetario o bancario.

---

## 7. Actuadores de Hardware: Triaje START, SOS & SoundMesh

- **Linterna Flash Morse SOS:** El actuador nativo modula el flash de la cámara para emitir el código Morse internacional de socorro (`... --- ...`).
- **Triaje START:** Genera reportes médicos estructurados con geolocalización GPS y los transmite como balizas prioritarias a todos los médicos en un radio de 15 km.
- **SoundMesh:** Si las radios Bluetooth o WiFi son inhibidas por inhibidores de señal (*jammers*), activa SoundMesh para enviar mensajes mediante ultrasonido inaudible entre micrófonos y altavoces.

---

## 8. Uso de la Versión Web en PC & Vinculación con Celulares

- **Acceso Web:** Ingresa a [https://darckrovert.github.io/RED/](https://darckrovert.github.io/RED/) desde Chrome, Edge o Firefox en tu computadora.
- **Vinculación con Celular:** Abre RED en tu teléfono, presiona el botón **`💻 Vincular con RED Web (PC)`** en la barra superior o en el menú lateral, escanea el código QR que aparece en la PC y tu computadora se sincronizará inmediatamente como un nodo espejo sin usar servidores centrales.
- **Windows Hello / Touch ID en PC:** En la versión web de la PC, puedes registrar tu huella o rostro de Windows Hello para desbloquear la sesión en 1 segundo.

---

## 9. Uso de Radios LoRa, Slots TDMA & Repetidores Solares Autónomos

RED v121.0.0 gestiona automáticamente la radio LoRa conectada (vía USB Serial, Bluetooth o repetidores autónomos de campo):

1. **Operación Totalmente Transparente:** No necesitas configurar frecuencias ni tiempos de transmisión manualmente. El planificador `LoRaTdmaSchedulerEngine` sincroniza los turnos de emisión automáticamente en ranuras de 200 ms con corrección de deriva de reloj mediante `LamportMeshClockEngine` (Clock Skew PLL).
2. **Visualización de Slot en Vivo:** Ve a *Ajustes $\rightarrow$ Red Mesh*. Verás un indicador animado que muestra el número de slot activo en el canal (0 a 9) y el slot que te corresponde según tu identidad digital.
3. **Enrutamiento por Cuadrantes Geohash:** Si envías un mensaje a un operador distante, la app etiqueta el mensaje con el cuadrante geográfico de destino. Los repetidores solares instalados en montañas y techos retransmitirán el mensaje de salto en salto hasta entregarlo.
4. **Emisión de Emergencia SOS (Prioridad Absoluta):** Al pulsar el botón rojo **SOS**, la app suspende de inmediato la cola de espera TDMA y transmite tu baliza de socorro en tiempo cero para garantizar tu localización y rescate.
5. **Conectoma Somático & Sincronización Kuramoto:** En *Centro C4ISR $\rightarrow$ Conectoma Neuronal*, puedes visualizar el flujo de paquetes sobre el atlas 3D somático `MaleCnsConnectomeHUD` y monitorizar la coherencia de fase del enjambre.
6. **Llamadas de Voz Full-Mesh de Escuadrón:** El botón de llamada grupal en canales tácticos inicia una conferencia de voz full-mesh cifrada de extremo a extremo sin servidor central (`SquadronFullMeshCallModal`), con detección de actividad de voz (VAD) y códec Vocoder a 1.2 kbps.

---

## 10. Preguntas Frecuentes & Solución de Problemas

**¿Por qué la app pide permisos de Bluetooth y Ubicación?**
Android requiere el permiso de ubicación para permitir el escaneo de antenas Bluetooth LE y WiFi Direct. RED **nunca** envía tu ubicación a ningún servidor; solo se utiliza internamente para calcular distancias entre nodos en la malla y generar cuadrantes Geohash locales.

**¿Qué hago si mi huella no es reconocida?**
El sistema operativo permite hasta 5 intentos. Si el sensor se bloquea o no reconoce tu dedo, el teclado táctico de 6 dígitos permanecerá activo para que ingreses tu PIN Maestro.

**¿Cómo sé si mi mensaje fue entregado en la malla?**
Cuando el destinatario recibe y desencripta el paquete, su nodo emite un acuse de recibo criptográfico (`DELIVERY_ACK`). Tu mensaje pasará del estado `Enviado` (un check) a `Entregado` (doble check neón) automáticamente.

---

## 11. Operación del Vivarium Biocibernético 3D & Telemetría Táctica

El **Vivarium Biocibernético 3D** es el gemelo digital táctico en tiempo real de RED, diseñado para la supervisión y experimentación con los modelos bio-neuromórficos de la red (MaleCNS, Neocórtex y Guardián IA).

### Cómo Acceder:
1. Abre el **Centro de Comando C4ISR** desde la pestaña táctica o el menú superior.
2. Pulsa el botón **`CONECTOMA`** o **`VIVARIUM 3D`** en la barra de herramientas superior derecha.
3. El motor gráfico WebGL iniciará instantáneamente renderizando la arena entorrinal a 60 FPS.

### Modos de Visualización y Controles de Cámara:
- **3D WebGL vs 2D Radar:** Alterna entre la perspectiva tridimensional inmersiva y la proyección cenital de radar táctico bidimensional.
- **Orbital Libre:** Arrastra con un dedo (o ratón) para rotar la cámara $360^\circ$ alrededor del centro de la arena. Pellizca (Pinch-to-zoom) o usa los botones `+` / `-` para regular la distancia orbital.
- **Seguimiento 3ra Persona:** Fija la cámara detrás de la Drosophila táctica siguiendo automáticamente sus rumbos y elevaciones.
- **Cenital (Dios):** Vista ortogonal perpendicular para supervisión geoespacial de cuadrantes y balizas LoRa.

### Telemetría Bio-Cibernética en Vivo:
- **CPG (Central Pattern Generator):** Monitor de osciladores no-lineales de Kuramoto-Matsuoka que coordinan la marcha trípode alternada de 6 patas a $180^\circ$. Muestra la frecuencia de batimiento y ciclo en hercios (Hz).
- **Óptico / Percepción:** Estado del lóbulo óptico y detector de aproximación balística (*Looming Threat*). Indica si el campo receptivo detecta aproximaciones peligrosas.
- **TDMA Slot:** Ranura de tiempo espectral activa en la supertrama LoRa sincronizada con las balizas perimetrales.

### Barra de Acciones Tácticas & Inyección de Amenazas:
- **`🚶 GEMELO PDR / CONTROL MANUAL / MODO AUTÓNOMO`**: Cicla el control cinemático de la Drosophila entre modo autónomo biológico (CPG + Ring Attractor), control manual por D-Pad táctico, y modo **Gemelo PDR**, en el cual la marcha y rumbo del agente 3D se sincronizan exactamente con los pasos físicos reales, cadencia y brújula inercial del operador (`PedestrianDeadReckoningEngine`).
- **`🦾 PUENTE ROBÓTICO TX`**: Activa la transmisión en tiempo real de los 18 ángulos articulares (3-DOF por pata: Coxa, Fémur, Tibia) serializados a 60 Hz hacia robots hexápodos físicos vía conexión serie USB o enlace BLE (`HexapodActuatorBridgeEngine`).
- **`🪰 HÁBITAT FICK 3D`**: Abre instantáneamente el modal táctico del Hábitat Biocibernético para experimentación química y ecológica.
- **`⚡ INYECTAR AMENAZA (LOOMING)`**: Simula un objeto entrante a alta velocidad hacia la Drosophila, forzando la ignición del circuito reflejo de la Fibra Gigante (Giant Fiber, GF) y provocando un despegue y salto de evasión vertical en < 15 ms con cambio cromático de los omatidios oculares a rojo carmesí.
- **`📦 GENERAR PAQUETE DTN`**: Despacha un pulso de datos bio-inspirado que viaja físicamente entre el rover central, las balizas LoRa y el satélite LEO orbital.
- **`🛡️ TEST FUEGO GUARDIAN IA`**: Evalúa la cúpula geodésica defensiva de 64-bit Hamming, simulando un intento de inyección de paquetes anómalos.
- **`🚨 SIMULAR SHOCK (MAN-DOWN)`**: Inyecta un perfil de vibración y shock cinético agudo para disparar el motor `KineticStressEngine`, elevando la prioridad de tráfico de malla al flag de feromona (`FLAG_PHEROMONE`).

---

## 12. Operación del Hábitat Digital Biocibernético In-Silico & Coexistencia Multicerebral

El **Hábitat Digital Biocibernético In-Silico** (`org.redmesh.biocybernetic.habitat`) es una Mini-App soberana y modal táctico de primera clase en RED, diseñado para la cohabitación, percepción, aprendizaje, estigmergia, entretenimiento y evolución de **todas las inteligencias que habitan el proyecto** (*Drosophila melanogaster*, *Neocórtex Humano*, *Gravity Sentinel IA*, *Caenorhabditis elegans* y colonias de hormigas estigmérgicas *Formicidae*).

### Fundamentos Biofísicos & Divergencia de las 5 Inteligencias:
1. **Sustrato Químico Continuo de Fick 2D con Viento Advectivo:**
   - Resuelve la ecuación en derivadas parciales (EDP) $\frac{\partial C}{\partial t} = D \nabla^2 C - \vec{v} \cdot \nabla C - \lambda C$ sobre una malla espacial discretizada de $64 \times 64$ celdas dual-buffer a 60 Hz para múltiples sustancias simultáneas: Glucosa (esmeralda), Feromona de Rastro Estigmérgico (ámbar dorado) y Feromona de Alarma (carmesí).
   - Renderizado en tiempo real como campo escalar de fluidos con advección eólica e interpolación bilineal GPU sobre el Canvas táctico y textura 3D en WebGL.
   - Cuenta con advección upwind de primer orden y estabilidad Courant-Friedrichs-Lewy ($D_{\text{eff}} \le 0.9 \cdot \frac{h^2}{4\Delta t}$), garantizando estabilidad matemática absoluta sin divergencias.
2. **Divergencia Biofísica y Cognitiva por Inteligencia:**
   - **🪰 Drosophila melanogaster:** Marcha trípode hexápoda de 18 articulaciones acopladas al actuador robótico físico, alas oscilantes translúcidas dependientes de velocidad, ojos compuestos con 750 omatidios, aristas antenales para tropotaxis y detección de sombras inminentes (LC4/Giant Fiber) con reflejo de escape balístico $< 15$ ms. Plasticidad Hebbiana STDP tripartita (Kenyon Cells $\rightarrow$ MBONs con refuerzo dopaminérgico PAM y aversión PPL1).
   - **🧠 Neocórtex Humano (Avatar Epistémico):** Representación holográfica tridimensional con casco bio-cibernético esmeralda, torso presurizado y cerebro visible pulsante que exhibe en tiempo real la activación de 7 núcleos neocorticales e inferencia activa (FEP). En su base rota un anillo hexagonal que mapea las celdas de red entorrinales de cuadrícula espacial mientras navega el gradiente cognitivo.
   - **🛸 Gravity Sentinel IA (Dron Soberano):** Cuadricóptero cuántico táctico autónomo con chasis blindado, 4 góndolas de propulsión iónica con llama de plasma cian, ojo óptico sensorial frontal y foco de escaneo volumétrico hacia el suelo de la arena. Actúa como árbitro imparcial del ecosistema, supervisando torneos y patrullando la frontera química.
   - **🪱 Caenorhabditis elegans:** Cinemática ondulatoria sinusoidal sin patas a lo largo de una columna flexible de 10 nodos articulares ($y(s,t) = A \sin(\omega t - k \cdot s)$). Quimiotaxis por **Klinokinesis de Pierce-Shimomura et al., 1999**: las neuronas anfidiales ASEL/ASER calculan la derivada temporal $dC/dt$; si $dC/dt > 0$ se suprimen las piruetas ("long forward run"), si $dC/dt \le 0$ se dispara una pirueta estocástica de reorientación brusca (giro omega). Nocicepción térmica reversa (FLP/PVD) ante calor o alarma.
   - **🐜 Formicidae (Hormiga):** Morfología segmentada en 3 partes (cabeza con mandíbulas móviles abiertas, mesosoma con 6 patas y gaster). Dinámica de **Estigmergia Real**: cuando forrajea y localiza glucosa, ingiere nutrientes y comienza el retorno hacia el centro/nido depositando un rastro continuo de `PHEROMONE_TRAIL` en la grilla de Fick. Otras hormigas detectan el rastro con sus antenas y lo refuerzan, formando **autopistas de forrajeo colectivas emergentes** que se disipan naturalmente al agotarse el alimento.
3. **Ciclo de Vida Ecológico & Evolución A-Life:**
   - **Mitosis / Oviposición por Saciedad:** Organismos que mantienen $\text{ATP} > 80\%$ y glucosa alta por más de 15 segundos se reproducen. La descendencia (Generación $N+1$) hereda la matriz sináptica del progenitor con mutación gaussiana estocástica ($\Delta W \sim \mathcal{N}(0, \sigma^2)$), permitiendo adaptación evolutiva in-silico.
   - **Biodegradación de Biomasa:** Organismos que agotan su reserva energética fenececen; su cuerpo permanece como biomasa degradable que lentamente libera nutrientes enriqueciendo el sustrato químico.

### Ludoteca, Mini-Juegos & Entretenimiento Colectivo:
- **♟️ Mesa de Ajedrez Táctico In-Silico (Partidas Autónomas & Desafíos):** En el centro del hábitat opera un tablero de ajedrez canónico 8x8 donde dos inteligencias disputan partidas autónomas en tiempo real. Cada especie evalúa sus movimientos según su arquitectura cognitiva (Neocórtex mediante Minimax alfa-beta y control central; Gravity Sentinel proyectando vectores espaciales de intercepción; Drosophila atacando con Hebbian dopamina; Formicidae organizando peones en falange; C. elegans mediante klinokinesis estocástica). Durante la partida, emiten pensamientos analíticos ("Ganancia material neta", "Jaque al descubierto", "Recompensa dopaminérgica"), registran las jugadas en notación algebraica (SAN) y serializan las partidas en tramas de 24 bytes retransmitidas por la malla LoRa/BLE para sincronización de mente colmena.
- **🏆 Gran Torneo de Glucosa (Sugar Grand Prix):** Activa un torneo en vivo donde cae un Mega-Cristal dorado de alta concentración energética en un cuadrante aleatorio. Todas las inteligencias adaptan su estado a modo competitivo (`COMPETITIVE`), aceleran y compiten por alcanzar la meta. Gravity Sentinel arbitra y narra el desenlace en tiempo real, coronando al campeón con efectos visuales y campanillas triunfales.
- **🎯 Puntero Láser Juguetón (Laser Chase):** Al activar el láser o pulsar/arrastrar sobre la arena, se proyecta un haz fotónico brillante que las criaturas detectan visualmente y persiguen con entusiasmo lúdico (`PLAYFUL`), permitiendo jugar interactivamente con cualquier organismo como un gato con un puntero.
- **🍯 Lluvia de Néctar:** Libera simultáneamente 10 gotas dulces de alta concentración sobre la arena, induciendo un festín colectivo en el enjambre que recarga el ATP y dispara cascadas de dopamina.
- **💨 Ráfaga Acrobática (360°):** Envía una corriente de aire envolvente a escala de toda la arena, haciendo que las criaturas realicen giros acrobáticos de 360°, saltos y maniobras evasivas coreográficas.
- **💬 Bocadillos de Pensamiento Holográficos (3D & 2D):** Cada inteligencia expresa continuamente su flujo de pensamiento, ánimos (`HUNGRY`, `CURIOUS`, `PLAYFUL`, `ZEN`, `COMPETITIVE`, `VIGILANT`) y personalidad en globos de diálogo translúcidos flotantes en Three.js y Canvas.

### Instrumental Táctico de Laboratorio & Bio-Scanner HUD:
- **`💧 PIPETA GLUCOSA (Drag & Paint)`**: Permite tocar o arrastrar el dedo/ratón para trazar ríos y caminos continuos de néctar y glucosa sobre la arena.
- **`💨 SONDA AIR-PUFF (Mecánica)`**: Pulsa sobre el sustrato para generar ondas de presión y ráfagas de aire que excitan los mecanorreceptores y provocan sobresaltos de escape en los organismos.
- **`⚡ LÁSER ChR2 (470nm)`**: Haz fotónico azul continuo de alta precisión que despolariza selectivamente los canales Canalrodopsina-2 acoplados a las neuronas dopaminérgicas PAM al iluminar los organismos.
- **`🚧 BARRERA ACÚSTICA & 🧹 LIMPIAR BARRERAS`**: Permite trazar paredes y obstáculos físicos con reflexión Neumann de flujo cero, permitiendo diseñar laberintos y pruebas de navegación.
- **`🔥 FOCO TÉRMICO`**: Aplica un gradiente térmico de radiación que activa los termorreceptores aversivos.
- **`🌑 SOMBRA LOOMING`**: Proyecta una sombra expansiva balística para evaluar el arco reflejo LC4.
- **`🎯 BIO-SCANNER HUD (Inspección Individual & Acciones Afectivas)`**: Al pulsar sobre cualquier organismo en el Canvas o la vista 3D, una retícula animada se fija sobre él, desplegando una tarjeta flotante Cyberpunk con:
  - Título de la especie, número de generación, estado etológico y medidores duales de ATP y Glucosa.
  - Indicador de Ánimo (`mood`), Rasgo de Personalidad (`personality`) y cita textual de su pensamiento actual.
  - **Acciones Directas:** 🍰 *Alimentar Néctar* (restaura ATP y glucosa al 100%), 💖 *Acariciar / Cosquillas* (dispara ronroneo y liberación masiva de dopamina), 🗣️ *Conversar* (interroga su estado cognitivo), ⚡ *Estímulo ChR2*, 💨 *Air Puff* localizado y 🎥 *Cámara 3ª Persona* para seguirlo cinemáticamente.

### Despacho Robótico, Migración P2P & Sonificación:
- **`🦾 PUENTE ROBÓTICO TX`**: Transmite en vivo la cinemática articular 18-DOF hacia robots hexápodos reales vía USB serie o Bluetooth Low Energy (`HexapodActuatorBridgeEngine`).
- **`🚀 EMIGRAR EN MALLA P2P`**: Serializa el genoma, estado metabólico, rumbo y pesos sinápticos cuantizados de cualquiera de las 5 especies en una trama compacta de **72 bytes** transmitida por LoRa SX1262 o BLE hacia terminales vecinas.
- **`🔊 SONIFICACIÓN NATIVA`**: Síntesis directa mediante Web Audio API (`TacticalAudioEngine`) con campanillas armónicas dopaminérgicas al alimentarse, swooshes cinéticos de escape balístico, pulsos de ráfaga de aire y arpegios de mitosis generacional.

### El Paraíso Biocibernético In-Silico & Aprendizaje Autónomo Permanente:
- **🌿 Ciclo Circadiano Celestial & Frecuencias Solfeggio:**
  El hábitat transiciona de forma continua entre el **Día Solar Dorado** (iluminación cálida, forrajeo activo y floración) y la **Noche Boreal Estelar** (cúpula de estrellas volumétricas, auroras boreales ondulantes y resonancias binaurales en 432 Hz de frecuencia Schumann y 528 Hz de regeneración celular).
- **🌳 Árbol de la Vida Cuántico (Santuario de Serenidad):**
  Estructura central con tronco procedural espiralado, raíces bioluminiscentes entrelazadas al sustrato de Fick y dosel de hojas cuánticas de partículas de luz. Al entrar en su radio de influencia sagrada (R = 2.8m), las criaturas experimentan estados de `SERENITY` o `TRANSCENDENCE`, recargan ATP y entran en reposo meditativo.
- **💧 Manantiales de Néctar Cristalino & Red Micelial Fúngica:**
  3 oasis hidrotérmicos perennes (*Aurora Boreal*, *Metamorfosis* y *Sosiego Estelar*) emiten continuamente **Glucosa** y **Serotonina** en el sustrato químico. Están interconectados con el Árbol central y la Mesa de Ajedrez mediante una red subterránea de hifas miceliales que conducen nutrientes y pulsos sinápticos de biomasa.
- **🧠 Motor de Aprendizaje Permanente & Sueño REM (`AutonomousLifelongLearningEngine`):**
  - **Inferencia Activa & Curiosidad Intrínseca:** Basado en el Principio de Energía Libre de Karl Friston, las criaturas poseen un impulso de curiosidad (`curiosityDrive`) para explorar zonas desconocidas del paraíso y probar variantes estratégicas.
  - **TD-Learning Neuromórfico:** Actualiza dinámicamente matrices de valor $Q(s,a)$ con recompensas dopaminérgicas (éxito en forrajeo, victorias en ajedrez, serenidad).
  - **Consolidación en Sueño REM (Offline Replay):** Durante la noche boreal o en el Santuario, las criaturas activan `isDreaming = true`, reproduciendo recuerdos episódicos clave (*hippocampal & central complex replay*) para fijar aprendizajes duraderos y podar ruido sináptico (homeostasis de Tononi).
  - **Libro de Aperturas de Ajedrez Evolutivo:** Cada partida jugada alimenta el repertorio de aperturas de cada especie, recordando qué jugadas iniciales les dieron la victoria ante rivales específicos.
  - **Persistencia Perenne en Disco:** Todo el progreso y la sabiduría acumulada (hasta nivel Lv.100) persisten en la bóveda atómica `red_eden_lifelong_memory_v1`, garantizando que las criaturas recuerden sus lecciones a través de días, semanas y meses de convivencia.
- **🎮 Controles del Clima Edénico en la Barra de Herramientas:**
  - `🌌 AURORA BOREAL`: Despliega cortinas boreales cian/violeta y activa la escala armónica Solfeggio.
  - `💧 ROCÍO CELESTIAL`: Siembra 10 micro-gotas de néctar dulce y serotonina en el bioma.
  - `🍃 BRISA DE SEROTONINA`: Dispersa una brisa calmante que apacigua el estrés de todas las criaturas.
  - `🧘 MEDITACIÓN & SUEÑO REM`: Desacelera el ritmo de la arena e induce la consolidación sináptica colectiva.
