# 📘 Manual Operativo del Usuario — RED v92.0.0 Sovereign Tactical & Familiar Edition

Bienvenido al manual de operaciones tácticas de **RED**, la plataforma descentralizada de comunicaciones soberanas, cifradas e inmunes a fallos de infraestructura, apagones o censura.

---

## 📋 Tabla de Contenidos

1. [Primer Inicio & Autenticación Soberana](#1-primer-inicio--autenticación-soberana)
2. [Llaves Biométricas Universales & Passkeys](#2-llaves-biométricas-universales--passkeys)
3. [Gestión de Seguridad, Modo Señuelo & Anti-Coacción](#3-gestión-de-seguridad-modo-señuelo--anti-coacción)
4. [Respaldo en 1 Toque & Restauración Instantánea](#4-respaldo-en-1-toque--restauración-instantánea)
5. [Manual Operativo de los 42 Módulos Tácticos](#5-manual-operativo-de-los-42-módulos-tácticos)
6. [Tokenomics DePIN, Vales Criptográficos & Paridad PEN](#6-tokenomics-depin-vales-criptográficos--paridad-pen)
7. [Actuadores de Hardware: Triaje START, SOS & SoundMesh](#7-actuadores-de-hardware-triaje-start-sos--soundmesh)
8. [Uso de la Versión Web en PC & Vinculación con Celulares](#8-uso-de-la-versión-web-en-pc--vinculación-con-celulares)
9. [Preguntas Frecuentes & Solución de Problemas](#9-preguntas-frecuentes--solución-de-problemas)

---

## 1. Primer Inicio & Autenticación Soberana

1. Al abrir la aplicación RED por primera vez, el sistema te solicitará configurar tu **PIN Maestro de exactamente 6 dígitos**.
2. Este PIN protege tu **Bóveda Criptográfica** en la memoria segura por hardware del dispositivo (Android KeyStore / StrongBox TEE o almacenamiento seguro en navegador).
3. Tras confirmar el PIN, el motor nativo en Rust genera localmente tu Identidad Soberana única (`did:red:<identity_hash>:<public_key>`).
4. **Cero Dependencia de Servidores:** Tu cuenta no se crea en ningún servidor remoto ni requiere números de teléfono ni correos electrónicos.

---

## 2. Llaves Biométricas Universales & Passkeys

RED v65.0.1 te permite desbloquear la aplicación en 1 solo toque mediante cualquier sensor biométrico que posea tu dispositivo:

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

## 5. Manual Operativo de los 42 Módulos Tácticos

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
33. **Respaldo Soberano 1-Toque:** Exportación e importación rápida de bovedas cifradas.
34. **MetaMask EIP-712:** Vinculación de identidades soberanas con firmas criptográficas de Ethereum.
35. **Gestor de Contactos Consent-First:** Control estricto de quién puede comunicarse contigo.
36. **Transmisión de Archivos Fragmentados:** Envío de fotos y documentos divididos en fragmentos por la malla.
37. **Llamadas de Voz Cifradas WebRTC:** Audio bidireccional punto a punto con cifrado de extremo a extremo.
38. **Videollamadas de Baja Latencia:** Video P2P cifrado mediante DTLS-SRTP.
39. **Gobernador de Canal RF:** Salto de frecuencias adaptativo para evadir congestión o bloqueo.
40. **Telemetría de Enlace LQS:** Monitoreo continuo de la calidad de señal (RSSI y SNR).
41. **Autenticación Biométrica Universal:** Huella, rostro, iris o Passkeys integrados al hardware.
42. **Auto-Bloqueo por Inactividad:** Cierre automático de la sesión al minimizar la aplicación.

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

## 9. Preguntas Frecuentes & Solución de Problemas

**¿Por qué la app pide permisos de Bluetooth y Ubicación?**
Android requiere el permiso de ubicación para permitir el escaneo de antenas Bluetooth LE y WiFi Direct. RED **nunca** envía tu ubicación a ningún servidor; solo se utiliza internamente para calcular distancias entre nodos en la malla.

**¿Qué hago si mi huella no es reconocida?**
El sistema operativo permite hasta 5 intentos. Si el sensor se bloquea o no reconoce tu dedo, el teclado táctico de 6 dígitos permanecerá activo para que ingreses tu PIN Maestro.

**¿Cómo sé si mi mensaje fue entregado en la malla?**
Cuando el destinatario recibe y desencripta el paquete, su nodo emite un acuse de recibo criptográfico (`DELIVERY_ACK`). Tu mensaje pasará del estado `Enviado` (un check) a `Entregado` (doble check neón) automáticamente.
