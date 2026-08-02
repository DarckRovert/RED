# 🔴 RED - Manual del Usuario (v18.3 Zenith Master Edition)

Bienvenido a **RED (Red Encriptada Descentralizada)**. Este manual te guiará para que saques el máximo provecho de la plataforma de mensajería táctica y comunicación soberana en la versión v18.3 Zenith Release.

---

## 🏁 1. Empezando: Generando tu Identidad (DID)

A diferencia de otras aplicaciones como WhatsApp, en RED no necesitas un número de teléfono ni un correo electrónico, ni requieres vincular un celular para usar la Web.

### Uso desde la Web (Web SPA en Navegador)
- Accede libremente desde cualquier navegador web a `https://darckrovert.github.io/RED/chat.html`.
- Tu navegador generará un **DID (Decentralized Identifier)** criptográfico único en menos de 10ms (ejemplo: `did:red:f3a298...`).
- Tu identidad se almacena de forma segura en tu propio navegador. No requiere servidores de registro centralizados.

### 🛡️ 8. Sistema Guardian IA (Protección y Moderación Off-Grid)

RED incorpora **Guardian IA**, un motor de moderación que protege la red contra contenido ilícito y grooming antes de que los mensajes salgan de tu dispositivo:

* **Moderación Pre-Cifrado**: El análisis ocurre en tu dispositivo emisor **antes de cifrar el mensaje con Double Ratchet**. El receptor nunca sabe si hubo evaluación ni se expone contenido cifrado a terceros.
* **Operación Off-Grid (<1ms)**: Funciona 100% sin internet usando un motor heurístico local en Rust. Si no hay red, la moderación no se detiene ni bloquea la aplicación.
* **Ventana de Contexto (Anti-Grooming)**: Evalúa los mensajes recientes de la conversación para detectar patrones de acoso o grooming acumulativos.
* **Transparencia y Estadísticas**: Haz clic en el botón 🛡️ **Guardian** en la barra superior o menú para ver cuántos mensajes/imágenes han sido analizados o bloqueados, verificar el modo (Estricto/Warn/Off) y reportar contenido manualmente.

---

## 🟠 9. Sistema Alerta AMBER-RED (Búsqueda de Personas Desaparecidas)

El **Sistema AMBER-RED** es una red P2P descentralizada para la difusión inmediata de alertas de personas desaparecidas:

* **Banner Alerta Flotante**: Cuando se emite una alerta en la red P2P, aparece automáticamente un banner de alta prioridad naranja animado sobre la pantalla de todos los usuarios conectados.
* **Reporte de Avistamientos**: Si ves a la persona desaparecida, puedes presionar **📍 Reportar Avistamiento** directamente en el banner para notificar de forma inmediata a las autoridades con tu ubicación aproximada o notas.
* **Compartir Alerta**: Puedes copiar la información esencial de la alerta con un solo toque para difundirla fuera de RED.
* **Panel de Alertas (para Autoridades)**: Las autoridades registradas pueden acceder al botón 🟠 **AMBER** para emitir nuevas alertas con fotografía, coordenadas GPS y tiempo de expiración (24h a 30 días), o marcar alertas como **Persona Encontrada**.

### Uso desde la App Móvil (Android APK)
1. **Pantalla de Onboarding**: Al abrir RED por primera vez, verás el asistente de configuración de la bóveda.
2. **Creación de PIN Maestro**: Deberás crear un PIN numérico seguro de al menos 6 dígitos. Este PIN se cifrará a nivel hardware en el Keystore de tu teléfono.
3. **Generación de Claves**: La aplicación generará tus claves criptográficas (DID). Este proceso es 100% privado.

### Comunicación P2P Web ↔ Mobile
- Puedes chatear entre la Web App y la App Móvil sin restricciones.
- Solicitas el DID del contacto móvil (o web), lo añades en `+ Añadir Contacto` y el sistema inicia un **túnel P2P cifrado mediante WebRTC DataChannels (AES-256-GCM + Double Ratchet)**.

---

## 👥 2. Contactos y Grupos

### Añadir Contactos
- **Por Enlace:** Pega el enlace RED (`red://add-contact/...`) recibido de otra persona.
- **Por Escaneo QR:** Pulsa en el icono de cámara en Ajustes > Perfil para escanear el código de un amigo.
- **RADAR Nearby:** La función más potente de la v18.3. Si estás cerca de alguien, usa la pestaña de **RED Nearby** para descubrir y añadir contactos mediante señales Bluetooth BLE y WiFi Direct sin necesidad de internet.
- **Bloqueo y Verificación Real:** En el modal de perfil de tu chat con un contacto, ahora puedes ver si su identidad está verificada o bloquearlo. Si bloqueas un contacto, el nodo Rust local descartará todo su tráfico en la capa de red nativa de forma transparente.

### Grupos Descentralizados
En la pestaña **Grupos**, puedes crear salas de chat. Los grupos en RED no tienen un servidor central.
- **Administración Real:** Si eres admin, puedes promover a otros miembros, silenciarlos o expulsarlos del grupo en real.

---

## 💬 3. Mensajería y Nueva Interfaz "Solid UI"

### Mensajería Sólida
RED v18.3 presenta un diseño inspirado en la mensajería clásica pero con privacidad moderna y confirmación real en red Mesh:
- **Burbujas con Cola:** Los mensajes tienen indicadores direccionales claros.
- **Confirmación (Ticks):**
    - **Un tick (✓):** Enviado a la red Mesh (y en cola de reintentos offline si el destinatario no está disponible al instante).
    - **Doble tick (✓✓):** Recibido por el destinatario (tras conexión directa o descarga de la cola offline).
    - **Ticks Azules:** Mensaje leído.
- **Huella de Seguridad (Safety Numbers):** Compara el código numérico de 20 dígitos en la info de perfil de tu contacto. Si coincide exactamente, garantiza la integridad criptográfica contra ataques Man-In-The-Middle (MITM).
- **Input Capsular:** El campo de escritura ahora es una cápsula ovalada con iconos de adjuntos integrados para un acceso más rápido.

### Funciones Avanzadas
- **Mensajes Guardados (⭐):** Guarda mensajes importantes pulsando prolongadamente sobre ellos; aparecerán en tu sección de "Mensajes Guardados".
- **Historias/Status:** Comparte estados de texto o imagen que desaparecen a las 24 horas.

---

## 🔐 4. Seguridad y Herramientas Tácticas

### Defensa Anti-Forense (Nivel Dios)
- **Bloqueo de Capturas:** La aplicación impide capturas de pantalla y grabaciones para proteger tus chats de software espía.
- **Dead Man's Switch:** Configura una purga automática si no accedes a la app en X días.
- **Bóveda Señuelo Autopoblada (Coacción):** Si te obligan a abrir tu teléfono, ingresa el **PIN Señuelo** (Configurable en Ajustes > Seguridad). RED abrirá una "Bóveda Falsa" (Decoy Vault) e instantáneamente generará docenas de chats mundanos con contactos creíbles, con fechas de la última semana. A los ojos de cualquier interrogador, serás un ciudadano común chateando con su familia.
- **PIN de Pánico:** Ingresa tu **PIN destructivo** (Configurable en Ajustes) en el bloqueo de pantalla para destruir electromagnéticamente la base de datos local y borrar tus rastros de inmediato.
- **App Disguise (Calculadora):** Activa el modo camuflaje para que el icono de RED se transforme en una calculadora funcional. Solo al ingresar tu PIN maestro en el teclado numérico de la calculadora se revelará la interfaz real de RED.

---

## 🛠️ 5. Conectividad y Radar RED

Si no tienes acceso a la red de internet global, RED sigue funcionando:
- **Malla Mesh:** Los mensajes se almacenan y reenvían automáticamente entre nodos cercanos (vía Bluetooth/WiFi).
- **Puente LoRaWAN Sub-GHz:** Conecta tu módulo de radio LoRa por Serial/USB-C. Ve a **Ajustes > Red (Network Panel)** e ingresa el puerto (`COM3`, `/dev/ttyUSB0`) y el baud rate (ej: `115200`). RED auto-configurará el hardware puente para enviar telemetría a ~15Km sin operadoras.
- **Mesh APK Updater (Inmune a App Stores):** Si RED es eliminado de internet, un solo teléfono puede propagar el archivo `.apk` a los teléfonos vecinos enviándolos a la ruta `http://<ip-radar>:7331/api/mesh/apk`.
- **Geometría de Nodos (Mapa 3D):** Puedes ver una representación en tiempo real de tu topología de red abriendo el visualizador global. El mapa extrae las conexiones vivas del transporte local y las posiciona geográficamente usando derivadas criptográficas de sus identidades.

---

## 🛠️ 6. Herramientas Tácticas y Diagnóstico de Red (v18.3)

- **Consola de Logs Rust (`NodeLogsModal`):** Accede desde el panel de Criptografía para auditar el tráfico de paquetes de ruido blanco, handshakes Kyber y pings RTT en vivo.
- **Simulador de Apagón Táctico (`BlackoutSimulatorModal`):** Prueba cómo la aplicación conmuta automáticamente del transporte WAN hacia mDNS, Bluetooth LE y LoRa al cortar la conectividad a internet.
- **Bóveda Cifrada `.redbak` (`BackupRestoreModal`):** Exporta tus conversaciones e identidades protegidas por contraseña en un archivo compacto para migrar entre teléfonos.
- **Informe de Auditoría Exportable (`SecurityReportModal`):** Genera una ficha técnica de la postura de seguridad de tu nodo para auditar el Kill-Switch, Camuflaje y paridad PQC.
- **Buscador Global:** Toca el icono de lupa en la barra lateral para buscar cualquier palabra o frase cifrada en todo tu historial de chats de manera instantánea.

---

---

## 🛠️ 7. Nuevas Herramientas Tácticas de Auxilio y Difusión (v20.0)

- **🧭 Brújula Táctica y Radar P2P (`P2PCompassModal`):** Abre la brújula desde los accesos rápidos. Permite ubicar físicamente la dirección cardinal (N, S, E, W) y distancia relativa en metros de nodos o contactos RED cercanos usando la intensidad de señal de radio (BLE/WiFi Direct) en apagones totales o desastres.
- **🚨 Baliza SOS Táctica de Auxilio (`SOSEmergencyBanner`):** En situaciones de peligro inminente, activa la baliza SOS para transmitir inmediatamente un faro de socorro cifrado E2E a tus contactos de auxilio con tus coordenadas GPS y nota de emergencia.
- **📻 Canales de Difusión Mesh Locales (`PublicChannelsPanel`):** Accede a canales de radio digital comunitarios descentralizados (ej. `#red-local-general`, `#red-emergency-lima`) para publicar noticias, boletines de tráfico o alertas vecinales sin depender de servidores centrales ni riesgo de censura.

---

## 🛠️ 8. Nuevas Herramientas Tácticas y Privacidad de Fotos (v21.0)

- **🎙️ Walkie-Talkie Mesh Push-to-Talk (`P2PWalkieTalkieModal`):** Mantén presionado el botón central para hablar y enviar ráfagas de audio de voz ultra-comprimidas (Codec Opus a 8 kbps) que se propagan inmediatamente por ondas de radio Bluetooth BLE y WiFi Direct.
- **🧹 Sanitizador de Metadatos EXIF en Fotos (`sanitizer.rs`):** El motor borra automáticamente las coordenadas GPS, fecha/hora y modelo de teléfono de cualquier foto antes de cifrarla y enviarla para impedir tu geolocalización.
- **🌤️ Alertas Barométricas y Clima Mesh (`WeatherAlertPanel`):** Lectura del sensor barométrico del celular para publicar boletines meteorológicos locales y alertas de desastres naturales en tiempo real.
- **🪪 Bóveda Cifrada de Identidad Táctica (`IdentityVaultModal`):** Almacena tus datos médicos, tipo de sangre y pase de auxilio cifrado con hardware Keystore, permitiendo generar un código QR de verificación de un solo uso (*One-Time QR*).

---

## ❓ Preguntas Frecuentes

**¿Necesito internet para chatear?**
No necesariamente. Gracias a la arquitectura v21.0, si tus contactos están cerca de ti físicamente, RED chateará a través de ondas de radio (Bluetooth/WiFi/LoRa) usando señalización WebRTC P2P totalmente Offline.

**¿Qué pasa si pierdo mi teléfono?**
Tus mensajes y contactos están cifrados localmente. Sin tu **Identity Hash** y tu respaldo físico, nadie podrá recuperar esos datos.

---

**RED** — Tu comunicación, tu hardware, tu soberanía.


