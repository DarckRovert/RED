# 📘 Manual Operativo del Usuario — RED v31.0.0 Sovereign Master

Bienvenido al manual de operaciones tácticas de **RED**, la plataforma descentralizada de comunicaciones soberanas, cifradas e inmunes a fallos de infraestructura o censura.

---

## 📋 Tabla de Contenidos

1. [Primer Inicio & Autenticación Soberana](#1-primer-inicio--autenticación-soberana)
2. [Gestión de Seguridad & Modo Señuelo](#2-gestión-de-seguridad--modo-señuelo)
3. [Manual Operativo de los 35 Módulos Tácticos](#3-manual-operativo-de-los-35-módulos-tácticos)
4. [Actuadores de Hardware: Flash LED Morse SOS & Triaje START](#4-actuadores-de-hardware-flash-led-morse-sos--triaje-start)
5. [Interruptor del Hombre Muerto (DMS) & Purga](#5-interruptor-del-hombre-muerto-dms--purga)
6. [Inmunidad a VPNs & Red Mesh Off-Grid](#6-inmunidad-a-vpns--red-mesh-off-grid)
7. [Preguntas Frecuentes & Solución de Problemas](#7-preguntas-frecuentes--solución-de-problemas)

---

## 1. Primer Inicio & Autenticación Soberana

1. Al abrir la aplicación RED por primera vez, el sistema te solicitará ingresar una **Contraseña Maestra**.
2. Esta contraseña protege tu **Bóveda de Claves Criptográficas** en la memoria segura del dispositivo (Android KeyStore / Secure Storage).
3. Tras la verificación de contraseña, el motor nativo en Rust ejecutará un proceso de **Prueba de Trabajo (Proof of Work - PoW)** local para generar tu Identidad Soberana única (`did:red:<identity_hash>:<public_key>`).

---

## 2. Gestión de Seguridad & Modo Señuelo

- **PIN Maestro:** Acceso a la bóveda principal con todos los chats, contactos e historial cifrado.
- **PIN Señuelo (`decoy_pin`):** Iniciar sesión con el PIN señuelo abre un entorno totalmente limpio y verosímil sin dejar rastro de tus comunicaciones reales.
- **PIN de Pánico (`panic_pin`):** Iniciar sesión con el PIN de pánico ejecuta inmediatamente el protocolo de autodestrucción nativo (`RedNodePlugin.destroy`), purgando las llaves y la base de datos Sled.

---

## 3. Manual Operativo de los 35 Módulos Tácticos

1. **Canales Mesh Locales:** Explora temas abiertos en `PublicChannelsPanel.tsx` con moderación automática por Guardian IA.
2. **RED Social Feed P2P:** Publicaciones descentralizadas resistentes a censura en `SocialFeedPanel.tsx`.
3. **Difusión Privada (Broadcast):** Envía comunicados simultáneos cifrados en `BroadcastPanel.tsx`.
4. **Walkie-Talkie Mesh Push-To-Talk:** Presiona en `P2PWalkieTalkieModal.tsx` para hablar por radio digital en tiempo real.
5. **Canvas Táctico P2P en Vivo:** En `LiveCanvasModal.tsx`, dibuja planos tácticos sincronizados en tiempo real por la red malla.
6. **Live Broadcast Stream:** Emite o recibe video local en tiempo real con `LiveStreamBroadcaster.tsx` y `LiveStreamViewer.tsx`.
7. **Shake & Pair (Acelerómetro):** En `ShakePairModal.tsx`, sacude tu teléfono (>15 m/s²) cerca de otro operador para emparejarte al instante.
8. **Radar Topográfico GPS & UTM:** Abre `OffGridCompassModal.tsx` para orientación con magnetómetro, declinación WMM2025 y altímetro barométrico.
9. **Mapa de Nodos P2P:** Visualiza nodos cercanos, distancias estimadas y telemetría en `NodeMap.tsx`.
10. **Radar Hardware BLE / WiFi:** Escaneo de dispositivos de radio en `NearbyDevicesPanel.tsx`.
11. **Analizador Espectro RF / EW:** Monitorea interferencias en `RfSpectrumModal.tsx`.
12. **Ondas de Proximidad:** En `ProximityWaveModal.tsx`, detecta pares físicamente cercanos mediante firmas de radio.
13. **Clima & Barómetro CAP:** Revisa el barómetro e informes meteorológicos en `WeatherAlertPanel.tsx`.
14. **Batería Eco-Mesh:** Ajusta el consumo energético en `EcoMeshPanel.tsx` adaptando el intervalo de beaconing.
15. **Topología de Red:** Supervisa la salud del enjambre libp2p en `NetworkPanel.tsx`.
16. **Perfil & Bóveda DID:** Gestiona tu identidad soberana y esquema de fragmentación Shamir en `IdentityVaultModal.tsx`.
17. **Pagos & Vouchers P2P:** Genera y transfiere vouchers de valor fuera de línea en `RedP2PPayModal.tsx`.
18. **Bóveda Criptográfica PQC:** Inspecciona claves Post-Cuánticas Kyber-1024 en `CryptoPanel.tsx`.
19. **Explorador Blockchain RED:** Verifica bloques y transacciones inmutables en `BlockchainExplorer.tsx`.
20. **Bóveda Esteganográfica:** Oculta mensajes cifrados en fotos usando `StegoVaultModal.tsx`.
21. **Respaldos & Restauración:** Exporta respaldos cifrados protegidos por PBKDF2 en `BackupRestoreModal.tsx`.
22. **Signos Vitales & Triaje START:** En `VitalScanModal.tsx`, coloca el dedo sobre la cámara trasera y el flash LED para medir pulso cardíaco, SpO2 y evaluar el triaje de víctimas.
23. **Baliza SOS & Módem SoundMesh:** En `SurvivalBeaconModal.tsx`, emite alertas de socorro GPS, activa el flash LED SOS en código Morse y transmite por ultrasonido en 18–20 kHz BFSK.
24. **Sistema Alerta AMBER:** Gestiona emergencias comunitarias en `AmberAdminPanel.tsx` con avisos de alta prioridad.
25. **Hombre Muerto DMS:** Configura el temporizador de inactividad de seguridad en `DMSSettings.tsx`.
26. **Simulador Apagón Blackout:** Realiza pruebas de estrés desconectando la WAN en `BlackoutSimulatorModal.tsx`.
27. **Copiloto IA Offline:** Invocación de `AICopilotModal.tsx` para consultas tácticas mediante LLM en memoria.
28. **Guardian IA (Firewall):** Supervisa el firewall cognitivo en `GuardianStatusPanel.tsx`.
29. **Diagnóstico Salud Sistema:** Evalúa el rendimiento de CPU, memoria y almacenamiento en `SystemHealthModal.tsx`.
30. **Logs del Nodo Rust SSE:** Visualiza la consola de eventos en tiempo real en `NodeLogsModal.tsx`.
31. **Calculadora Señuelo (Camuflaje):** Accede al camuflaje de calculadora en `CalculatorScreen.tsx`.
32. **Reporte Auditoría Seguridad:** Revisa el informe de integridad Zero-Trust en `SecurityReportModal.tsx`.
33. **Seguridad Zero-Trust:** Configura tus PINs de acceso y políticas de purga en `SecurityPanel.tsx`.
34. **Llamadas Tácticas P2P:** Inicia videollamadas cifradas en `CallScreen.tsx`.
35. **Centro de Mensajería E2EE:** Chatea de forma privada con Double Ratchet en `ChatWindow.tsx`.

---

## 4. Actuadores de Hardware: Flash LED Morse SOS & Triaje START

### Flash LED Morse SOS
Al activar la función en la Baliza de Supervivencia (`SurvivalBeaconModal.tsx`):
- El sistema toma control directo del hardware mediante `CameraManager.setTorchMode()`.
- Un hilo nativo genera pulsos luminosos de emergencia con el patrón internacional SOS:
  - 3 pulsos cortos (150ms)
  - 3 pulsos largos (450ms)
  - 3 pulsos cortos (150ms)
- El flash opera incluso si la pantalla se apaga o la interfaz cambia de pestaña.

### Triaje START & Escáner Fotopletismográfico (PPG)
En `VitalScanModal.tsx`:
1. Coloca la yema del dedo cubriendo completamente el lente de la cámara trasera y el flash LED.
2. El flash LED se encenderá a máxima intensidad para iluminar el lecho capilar.
3. El algoritmo extraerá la curva de pulso hemodinámico rojo/verde calculando BPM y SpO2% reales.
4. Responde las 5 preguntas del protocolo START para clasificar a la víctima con código de color internacional.

---

## 5. Interruptor del Hombre Muerto (DMS) & Purga

- Si el operador entra en estado de incapacitación o arresto, el motor `evaluateLocalDMS` detecta la inactividad.
- Al expirar el temporizador, se emite una última baliza de socorro y se limpian las bases de datos y la Keystore.

---

## 5. Inmunidad a VPNs & Red Mesh Off-Grid

- El transporte **Bluetooth LE (BLE)** funciona a nivel de hardware HCI y no pasa por la pila TCP/IP de Android.
- La aplicación permanece 100% operativa incluso si una VPN activa bloquea el tráfico de red comercial.

---

---

## 6. Suite de Inteligencia Artificial (IA) Soberana 100% Offline

### Copiloto Táctico RAG (Retrieval-Augmented Generation)
- **Modelos Compatibles:** LaMini-Flan-T5 (ONNX WASM en proceso), Qwen 2.5 1.5B, Llama 3.2 1B, Gemma 2B, Phi-3 Mini 3.8B (GGUF cuantizado Q4 ejecutado nativamente en ARM64 vía Candle Rust).
- **Base de Conocimiento Táctica Integrada (16 Protocolos):**
  - Triage START en masa
  - Control de hemorragias arteriales exanguinantes y torniquete táctico
  - Reanimación Cardiopulmonar (RCP) y manejo de DEA
  - Quemaduras térmicas, químicas y eléctricas
  - Inmovilización de fracturas y trauma raquimedular
  - Potabilización de agua (ebullición, cloración y filtro multicapa de carbón)
  - Hipotermia severa y golpe de calor
  - Protocolo de autoprotección y repliegue QBRN / HazMat
  - Terremotos, derrumbes y localización acústica bajo escombros
  - Incendios forestales y repliegue hacia zonas negras
  - Rescate en inundaciones y escape de vehículos sumergidos
  - Control de emisiones electromagnéticas (EMCON) y evasión RF
  - Manejo de mordeduras de serpientes venenosas (vendaje compresivo)
  - Señalización de rescate óptico Morse SOS y silbato de montaña
  - Interruptor del Hombre Muerto y purga criptográfica anti-forense.

### Traductor Táctico Determinista (6 Idiomas)
- Diccionario determinista de emergencia sin alucinaciones disponible en **Español, English, Português, Français, Deutsch y Quechua (Runa Simi)** con soporte para pronunciación fonética.

### Centinela Guardian IA S4 & Moderación en el Emisor
- Clasificación semántica de vectores en espacio latente y red neuronal `toxic-bert`.
- De-ofuscador leetspeak automático y detector de imágenes mediante pHash diferencial de 64 bits.

---

## 7. Preguntas Frecuentes & Solución de Problemas

- **¿Dónde se guardan los mensajes?**  
  Exclusivamente en la base de datos cifrada SQLite local de tu dispositivo.
- **¿Cómo me conecto con otros nodos?**  
  Automáticamente mediante BLE, WiFi Direct, LoRa o SoundMesh al abrir la aplicación.
- **¿La IA envía mis consultas a servidores externos?**  
  No. Todo el procesamiento corre 100% de manera local en el procesador de tu dispositivo o se delega opcionalmente a nodos vecinos con mayor capacidad en la red malla (Mente Colmena P2P).


