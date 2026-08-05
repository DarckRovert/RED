# 📘 Manual Operativo del Usuario — RED v24.0.0

Bienvenido al manual de operaciones tácticas de **RED**, la plataforma descentralizada de comunicaciones soberanas, cifradas e inmunes a fallos de infraestructura o censura.

---

## 📋 Tabla de Contenidos

1. [Primer Inicio & Configuración de Seguridad](#1-primer-inicio--configuración-de-seguridad)
2. [Modo Señuelo (Decoy Mode - Clave `9999`)](#2-modo-señuelo-decoy-mode---clave-9999)
3. [Gestión de Identidad & Bóveda Criptográfica](#3-gestión-de-identidad--bóveda-criptográfica)
4. [Agregar Contactos & Escaneo QR](#4-agregar-contactos--escaneo-qr)
5. [Mensajería Directa & Notas de Voz Tácticas](#5-mensajería-directa--notas-de-voz-tácticas)
6. [Navegación & Interfaz de Usuario](#6-navegación--interfaz-de-usuario)
7. [Radar P2P & Descubrimiento de Nodos](#7-radar-p2p--descubrimiento-de-nodos)
8. [Balizas de Emergencia SOS](#8-balizas-de-emergencia-sos)
9. [Herramientas Tácticas Avanzadas](#9-herramientas-tácticas-avanzadas)
10. [Interruptor del Hombre Muerto (DMS)](#10-interruptor-del-hombre-muerto-dms)
11. [Preguntas Frecuentes & Solución de Problemas](#11-preguntas-frecuentes--solución-de-problemas)

---

## 1. Primer Inicio & Configuración de Seguridad

1. Al abrir la aplicación RED por primera vez, el sistema te solicitará ingresar una **Contraseña Maestra**.
2. Esta contraseña protege tu **Bóveda de Claves Criptográficas** en la memoria segura del dispositivo (Android KeyStore / Secure Storage).
3. Tras la verificación de contraseña, el motor nativo en Rust ejecutará un proceso de **Prueba de Trabajo (Proof of Work - PoW)** local para generar tu Identidad Soberana única (`did:red:<identity_hash>:<public_key>`).

---

## 2. Modo Señuelo (Decoy Mode - Clave `9999`)

Si te encuentras en una situación de riesgo donde seas forzado a desbloquear tu dispositivo:
- Ingresa la contraseña de emboscada **`9999`**.
- La aplicación abrirá un **Perfil Señuelo completamente limpio** sin rastro de tus chats, contactos reales, claves privadas ni archivos personales.
- No existe ninguna indicación visual en la pantalla que revele que el sistema está operando en modo señuelo.

---

## 3. Gestión de Identidad & Bóveda Criptográfica

En la pestaña de **Bóveda de Identidad (ID Vault)** podrás:
- Consultar tu **Hash de Identidad Soberana** y tu **Short ID** táctico.
- Configurar datos médicos de emergencia opcionales (Tipo de sangre, alergias y contacto de emergencia) cifrados localmente.
- Generar un **Código QR de Verificación Temporal (validez de 5 minutos)** para validar tu identidad de forma presencial.

---

## 4. Agregar Contactos & Escaneo QR

Para establecer comunicación cifrada E2E con otro usuario existen tres métodos:

### Método A: Escaneo de Código QR (Recomendado)
1. En el teléfono A, abre la pestaña **Radar P2P** o presiona **📷 Mi QR** en el menú.
2. En el teléfono B, presiona el botón de **Escanear QR**.
3. Apunta la cámara al código QR del teléfono A.
4. El sistema extraerá el `identity_hash` y la `public_key` del contacto, guardando ambos datos y abriendo la conversación de forma instantánea.

### Método B: Auto-Intercambio Recíproco
- Si agregas manualmente a un usuario por su Hash o Short ID, tu teléfono enviará automáticamente una solicitud de contacto (`contact_request`) incluyendo tu clave pública (`sender_pk`).
- El destinatario recibirá un aviso `🤝 Operador te ha agregado como contacto` y su teléfono responderá guardando tu clave pública automáticamente.

### Método C: Ingreso Manual de Hash / Short ID
- Presiona el botón **+** en la lista de chats e ingresa el hash de 64 caracteres hex o el Short ID de 8 caracteres.

---

## 5. Mensajería Directa & Notas de Voz Tácticas

- **Burbujas de Chat & Reacciones**: Envía mensajes de texto, imágenes y reacciona con emojis manteniendo presionado un mensaje.
- **Notas de Voz Tácticas (12 Kbps)**: Mantén presionado el icono de micrófono. El audio se grabará y comprimirá a **12 Kbps (OGG/Opus)** para permitir su transmisión ágil por radios de baja velocidad como LoRa o Bluetooth BLE.
- **Respuestas & Reenvíos**: Mantén presionado cualquier mensaje para responder directamente o reenviarlo a otros contactos o grupos.

---

## 6. Navegación & Interfaz de Usuario

- **Salir de un Chat**: Para volver a la lista principal de conversaciones desde cualquier chat, presiona la flecha **`←`** ubicada en la barra superior o presiona el botón físico/gesto de retroceso de Android.
- **Indicadores de Estado de Red**:
  - **`⚡ P2P MESH`**: Conectado a la malla mediante subred local IP o relés.
  - **`🔵 BLE`**: Conectado directamente por la antena física de Bluetooth LE (Inmune a VPNs).
  - **`📶 WIFI`**: Conectado por canal ad-hoc WiFi Direct.
  - **`📻 LORA`**: Conectado por módem de radio LoRa.
  - **`🛡️ STANDALONE`**: Operación local aislada.

---

## 7. Radar P2P & Descubrimiento de Nodos

- Accede al **Radar P2P** para visualizar un mapa de calor y listado en tiempo real de todos los dispositivos RED detectados en tu radio de alcance por Bluetooth LE o red WiFi local.
- Podrás consultar la distancia aproximada en metros, la fuerza de señal (RSSI) y agregar nodos directamente con un toque.

---

## 8. Balizas de Emergencia SOS

- En caso de desastre o emergencia física, presiona el botón flotante **SOS** o ingresa a la pestaña SOS.
- El sistema transmitirá una **Baliza de Socorro de Máxima Prioridad** que contiene tu ubicación GPS real y una señal auditiva a todos los nodos P2P en tu área de cobertura.

---

## 9. Herramientas Tácticas Avanzadas

- **P2P Walkie-Talkie**: Transmisión de voz en vivo por radio digital sin servidores.
- **Pizarra Táctica Colaborativa (Live Canvas)**: Dibujo y mapa esquemático sincronizado entre nodos.
- **Transmisión de Video en Vivo Off-Grid**: Emisión y recepción de video local entre pares.
- **Brújula P2P (P2P Compass)**: Orientación mediante magnetómetro para localizar la dirección de nodos cercanos.

---

## 10. Interruptor del Hombre Muerto (DMS)

- Configura el **Dead Man's Switch (DMS)** en la pestaña de Configuración.
- Si dejas de usar la aplicación durante el tiempo especificado (por ejemplo, 24 horas), el sistema destruirá automáticamente la base de datos cifrada y las claves de identidad.

---

## 11. Preguntas Frecuentes & Solución de Problemas

- **¿Qué pasa si tengo una VPN activa?**  
  No hay ningún problema. El transporte Bluetooth LE (BLE) opera a nivel de hardware y no es afectado por VPNs ni Kill-Switches.
- **¿Qué ocurre si no hay Internet ni señal celular?**  
  RED opera en modo **DTN Store-and-Forward**. Los mensajes saltarán de teléfono en teléfono hasta llegar a su destinatario.
