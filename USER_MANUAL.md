# 📘 Manual Operativo del Usuario — RED v30.0.0

Bienvenido al manual de operaciones tácticas de **RED**, la plataforma descentralizada de comunicaciones soberanas, cifradas e inmunes a fallos de infraestructura o censura.

---

## 📋 Tabla de Contenidos

1. [Primer Inicio & Autenticación Soberana](#1-primer-inicio--autenticación-soberana)
2. [Gestión de Seguridad & Modo Señuelo](#2-gestión-de-seguridad--modo-señuelo)
3. [Manual Operativo de los 28 Módulos Tácticos](#3-manual-operativo-de-los-28-módulos-tácticos)
4. [Interruptor del Hombre Muerto (DMS) & Purga](#4-interruptor-del-hombre-muerto-dms--purga)
5. [Inmunidad a VPNs & Red Mesh Off-Grid](#5-inmunidad-a-vpns--red-mesh-off-grid)
6. [Preguntas Frecuentes & Solución de Problemas](#6-preguntas-frecuentes--solución-de-problemas)

---

## 1. Primer Inicio & Autenticación Soberana

1. Al abrir la aplicación RED por primera vez, el sistema te solicitará ingresar una **Contraseña Maestra**.
2. Esta contraseña protege tu **Bóveda de Claves Criptográficas** en la memoria segura del dispositivo (Android KeyStore / Secure Storage).
3. Tras la verificación de contraseña, el motor nativo en Rust ejecutará un proceso de **Prueba de Trabajo (Proof of Work - PoW)** local para generar tu Identidad Soberana única (`did:red:<identity_hash>:<public_key>`).

---

## 2. Gestión de Seguridad & Modo Señuelo

- **PIN Maestro:** Acceso a la bóveda principal con todos los chats, contactos e historial cifrado.
- **PIN Señuelo (`decoy_pin`):** Iniciar sesión con el PIN señuelo abre un entorno totalmente limpio y verosímil sin dejar rastro de tus comunicaciones reales.
- **PIN de Pánico (`panic_pin`):** Iniciar sesión con el PIN de pánico ejecuta inmediatamente el protocolo de autodestrucción nativo (`RedNodePlugin.destroy`), purgando las llaves y la base de datos SQLite.

---

## 3. Manual Operativo de los 28 Módulos Tácticos

1. **Radar Topográfico Off-Grid:** Abre `OffGridCompassModal.tsx` para orientación con magnetómetro, declinación WMM2025 y altímetro barométrico.
2. **Escáner Signos Vitales PPG:** Usa `VitalScanModal.tsx` colocando el índice en la cámara y linterna LED para medir pulso y nivel de estrés.
3. **Baliza SOS & Módem SoundMesh:** En `SurvivalBeaconModal.tsx`, emite alertas de socorro GPS y transmisiones por ultrasonido en 18–20 kHz BFSK.
4. **Copiloto IA Neuronal Offline:** Invocación de `AICopilotModal.tsx` para consultas, traducción y resúmenes sin internet mediante `LaMini-Flan-T5`.
5. **Proximidad Zero-Touch & Radar Wave:** En `ProximityWaveModal.tsx`, detecta pares físicamente cercanos mediante firmas Doppler de ultrasonido.
6. **Pizarra Táctica P2P en Vivo:** En `LiveCanvasModal.tsx`, dibuja planos tácticos sincronizados en tiempo real por la red malla.
7. **Resiliencia de Batería Eco-Mesh:** Ajusta el consumo energético en `EcoMeshPanel.tsx` adaptando el intervalo de beaconing.
8. **Walkie-Talkie Mesh Push-To-Talk:** Presiona en `P2PWalkieTalkieModal.tsx` para hablar por radio digital cifrada en tiempo real.
9. **Alertas Tácticas AMBER:** Gestiona emergencias comunitarias en `AmberAdminPanel.tsx` con avisos de alta prioridad.
10. **Boletines Climáticos Off-Grid:** Revisa el barómetro e informes meteorológicos en `WeatherAlertPanel.tsx`.
11. **Canales Públicos Locales:** Explora temas abiertos en `PublicChannelsPanel.tsx` con moderación automática por Guardian IA.
12. **Bóveda Criptográfica StegoVault:** Oculta mensajes cifrados en fotos usando `StegoVaultModal.tsx`.
13. **Historias Tácticas & Estados:** Publica imágenes efímeras de 24 horas desde `StoriesBar.tsx`.
14. **Transmisión de Video P2P en Vivo:** Emite o recibe video local en tiempo real con `LiveStreamBroadcaster.tsx` y `LiveStreamViewer.tsx`.
15. **Notas de Voz Cifradas:** Graba notas comprimidas a 12 Kbps en `VoiceMessage.tsx` para transmisión fluida en LoRa/BLE.
16. **Encuestas y Votaciones Tácticas:** Crea votaciones P2P con firma digital en `PollMessage.tsx`.
17. **Respaldo Cifrado AES-256-GCM:** Exporta e importa copias de seguridad en `BackupRestoreModal.tsx`.
18. **Explorador Blockchain RED:** Consulta transacciones y bloques de la red en `BlockchainExplorer.tsx`.
19. **Espectro RF & Monitoreo SDR:** Analiza interferencias de radiofrecuencia en `RfSpectrumModal.tsx`.
20. **Mapa de Nodos & Telemetría P2P:** Visualiza las posiciones GPS de tus pares en `NodeMap.tsx`.
21. **Hombre Muerto DMS:** Configura la ventana de purga por inactividad en `DMSSettings.tsx`.
22. **Identidad Digital DID & Shamir SSS:** Divide tu clave en 5 fragmentos en `IdentityVaultModal.tsx`.
23. **Protocolo Incógnito / Señuelo:** Configura PINs de pánico y camuflaje de icono en `SecurityPanel.tsx`.
24. **Infraestructura de Red Mesh:** Revisa las métricas del enrutador Controlled Flood en `meshRouter.ts`.
25. **Llamadas Tácticas WebRTC:** Inicia videollamadas cifradas P2P en `CallScreen.tsx`.
26. **Contactos & Grupos Cifrados:** Administra integrantes e identidades en `GroupsPanel.tsx`.
27. **Mensajería E2EE en Tiempo Real:** Envía mensajes con confirmación de entrega en `ChatWindow.tsx`.
28. **Centro de Control Táctico:** Controla la navegación general del nodo desde `StatusView.tsx` y `Sidebar.tsx`.

---

## 4. Interruptor del Hombre Muerto (DMS) & Purga

- Si el operador entra en estado de incapacitación o arresto, el motor `evaluateLocalDMS` detecta la inactividad.
- Al expirar el temporizador, se emite una última baliza de socorro y se limpian las bases de datos y la Keystore.

---

## 5. Inmunidad a VPNs & Red Mesh Off-Grid

- El transporte **Bluetooth LE (BLE)** funciona a nivel de hardware HCI y no pasa por la pila TCP/IP de Android.
- La aplicación permanece 100% operativa incluso si una VPN activa bloquea el tráfico de red comercial.

---

## 6. Preguntas Frecuentes & Solución de Problemas

- **¿Dónde se guardan los mensajes?**  
  Exclusivamente en la base de datos cifrada SQLite local de tu dispositivo.
- **¿Cómo me conecto con otros nodos?**  
  Automáticamente mediante BLE, WiFi Direct, LoRa o SoundMesh al abrir la aplicación.
