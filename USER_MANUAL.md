# 🔴 RED - Manual del Usuario (v5.0)

Bienvenido a **RED (Red Encriptada Descentralizada)**. Este manual te guiará para que saques el máximo provecho de la plataforma de mensajería soberana, ahora con una interfaz más sólida y capacidades de hardware directo.

---

## 🏁 1. Empezando: Generando tu Identidad (DID)

A diferencia de otras aplicaciones, en RED no necesitas un número de teléfono ni un correo electrónico. Tu identidad es un **DID (Decentralized Identifier)** generado localmente en tu dispositivo.

1. **Pantalla de Onboarding**: Al abrir RED por primera vez, verás el asistente de configuración de la bóveda.
2. **Creación de PIN Maestro**: Deberás crear un PIN numérico seguro de al menos 6 dígitos. Este PIN se cifrará a nivel hardware en el Keystore de tu teléfono. **No existe opción de recuperación.**
3. **Generación de Claves**: La aplicación generará tus claves criptográficas (DID). Este proceso es 100% privado.
4. **Biometría (Opcional)**: En tu próximo inicio de sesión, podrás usar tu huella dactilar o FaceID para acceder rápidamente a tu bóveda.

---

## 👥 2. Contactos y Grupos

### Añadir Contactos
- **Por Enlace:** Pega el enlace RED (`red://add-contact/...`) recibido de otra persona.
- **Por Escaneo QR:** Pulsa en el icono de cámara en Ajustes > Perfil para escanear el código de un amigo.
- **RADAR Nearby:** La función más potente de la v5.0. Si estás cerca de alguien, usa la pestaña de **RED Nearby** para descubrir y añadir contactos mediante señales Bluetooth BLE y WiFi Direct sin necesidad de internet.

### Grupos Descentralizados
En la pestaña **Grupos**, puedes crear salas de chat. Los grupos en RED no tienen un servidor central.
- **Administración Real:** Si eres admin, puedes promover a otros miembros, silenciarlos o expulsarlos del grupo en tiempo real.

---

## 💬 3. Mensajería y Nueva Interfaz "Solid UI"

### Mensajería Sólida
RED v5.0 presenta un diseño inspirado en la mensajería clásica pero con privacidad moderna:
- **Burbujas con Cola:** Los mensajes tienen indicadores direccionales claros.
- **Confirmación (Ticks):**
    - **Un tick (✓):** Enviado a la red Mesh.
    - **Doble tick (✓✓):** Recibido por el destinatario.
    - **Ticks Azules:** Mensaje leído.
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

---

## 🛠️ 5. Conectividad y Radar RED

Si no tienes acceso a la red de internet global, RED sigue funcionando:
- **Malla Mesh:** Los mensajes se almacenan y reenvían automáticamente entre nodos cercanos (vía Bluetooth/WiFi).
- **Puente LoRaWAN Sub-GHz:** Si existe un Módulo LoRa conectado por Serial/USB-C, la app enviará la telemetría P2P codificada rebotando hasta a 15Km de distancia saltándose toda infraestructura de telecomunicación moderna.
- **Mesh APK Updater (Inmune a App Stores):** Si RED es eliminado de internet, un solo teléfono puede propagar el archivo `.apk` a los teléfonos vecinos enviándolos a la ruta `http://<ip-radar>:7331/api/mesh/apk`.
- **HUD de Conexión:** Revisa en la barra superior o en el Explorador de Nodos si tu tráfico está fluyendo vía LAN, BLE o Internet.

---

## ❓ Preguntas Frecuentes

**¿Necesito internet para chatear?**
No necesariamente. Gracias a la v5.0, si tus contactos están cerca de ti físicamente, RED chateará a través de ondas de radio (Bluetooth/WiFi) formando una red mesh autónoma.

**¿Qué pasa si pierdo mi teléfono?**
Tus mensajes y contactos están cifrados localmente. Sin tu **Identity Hash** y tu respaldo físico, nadie podrá recuperar esos datos.

---

**RED** — Tu comunicación, tu hardware, tu soberanía.
