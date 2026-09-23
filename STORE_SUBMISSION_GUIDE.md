# GUÍA DE CERTIFICACIÓN Y PUBLICACIÓN EN TIENDAS (APP STORES)
## RED v120.0.0 — Sovereign Mesh Communication & Decentralized P2P Infrastructure
**Licencia:** GNU Affero General Public License v3.0 (AGPL-3.0)  
**ID de Aplicación:** `f.red.app`  
**Repositorio Oficial:** [https://github.com/DarckRovert/RED](https://github.com/DarckRovert/RED)  
**Póliza de Privacidad Web:** [https://darckrovert.github.io/RED/privacy.html](https://darckrovert.github.io/RED/privacy.html)  
**Términos de Servicio Web:** [https://darckrovert.github.io/RED/terms.html](https://darckrovert.github.io/RED/terms.html)  

---

## 1. INTRODUCCIÓN & DIAGNÓSTICO DE RECHAZOS HISTÓRICOS

En auditorías previas de publicación en Google Play Console y tiendas de terceros, las aplicaciones tácticas o descentralizadas suelen ser rechazadas o ignoradas por tres motivos críticos que fueron **resueltos empíricamente en v120.0.0**:

1. **Firma Criptográfica Inválida (Debug Keystore):**
   - *Error:* Las tiendas rechazan APKs firmados con certificados de depuración (`CN=Android Debug, O=Android, C=US`).
   - *Solución:* RED v120.0.0 implementa una keystore de producción RSA de 4096 bits (`SHA384withRSA`) válida por 30 años (2026–2056) firmada con esquema dual v1 (JAR) + v2 (APK Signature Scheme) por la Autoridad Soberana de RED.

2. **Permisos de Alto Riesgo Prohibidos en el Manifest:**
   - *Error:* `REQUEST_INSTALL_PACKAGES` (causa rechazo automático inmediato en Google Play si no es un instalador de paquetes dedicado), `USE_EXACT_ALARM` (restringido a apps de reloj despertador/calendario desde Android 13/API 33), y `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
   - *Solución:* Fueron removidos quirúrgicamente de `AndroidManifest.xml`. Las alarmas de auto-destrucción usan `SCHEDULE_EXACT_ALARM` conforme a las guías de Google Play.

3. **Incongruencia en "Data Safety" y Falta de URLs Legales:**
   - *Error:* Formularios de seguridad de datos contradictorios o ausencia de URL pública y modal in-app accesible offline.
   - *Solución:* URLs activas en GitHub Pages con soporte responsive y modal nativo `LegalComplianceModal.tsx` integrado en la pestaña de Privacidad.

---

## 2. GOOGLE PLAY CONSOLE: GUÍA PASO A PASO

### 2.1 Formato de Entrega Obligatorio
- Desde agosto de 2021, Google Play exige **Android App Bundle (.aab)** para nuevas aplicaciones.
- Para generar el `.aab` firmado para producción:
  ```bash
  cd client/app
  npm run build:aab
  ```
- El archivo resultante se ubica en:
  `client/app/android/app/build/outputs/bundle/release/app-release.aab`
- Sube este archivo en la sección **Producción > Crear nueva versión**.

### 2.2 Acceso a la Aplicación (App Access)
- **Pregunta:** ¿Todas las funciones de tu app están disponibles sin restricciones de inicio de sesión o requieren credenciales?
- **Respuesta:** **"Todas las funciones están disponibles sin restricciones de acceso"** (All functionality is available without special access).
- **Justificación Técnica:** RED es una red peer-to-peer descentralizada y Zero-Knowledge. No existe un servidor central, base de datos en la nube ni sistema de usuario/contraseña. El usuario genera sus llaves criptográficas localmente en el enclave seguro del dispositivo al iniciar la app.

### 2.3 Seguridad de los Datos (Data Safety Section)
Este cuestionario es el principal motivo de rechazo si no se responde con estricta veracidad técnica:

| Pregunta de la Consola | Respuesta | Justificación Técnica |
| :--- | :--- | :--- |
| **¿Tu aplicación recopila o comparte algún tipo de datos del usuario?** | **NO** | RED no recopila, transmite, almacena ni comparte datos de usuario en ningún servidor externo. |
| **¿Se cifran todos los datos de usuario en tránsito?** | **SÍ** | Todo paquete transmitido por LoRa, Bluetooth Mesh, WebRTC P2P o WebSocket usa cifrado de extremo a extremo (E2EE) con Curve25519, XChaCha20-Poly1305 y Double Ratchet. |
| **¿Ofreces un mecanismo para que los usuarios soliciten la eliminación de sus datos?** | **SÍ** | Protocolo *Zeroize Data Protocol* (Wipe Criptográfico en `DuressWipeEngine.ts`) que sobreescribe y purga todas las llaves y bases de datos SQLite locales a voluntad del usuario. |

#### Si la consola insiste en detallar tipos de datos específicos debido a los permisos declarados:
- **Ubicación (Location):**
  - *¿Recopilada?* **NO**. Se procesa exclusivamente en memoria local y efímera para calcular distancias vectoriales y geohash de enrutamiento LoRa en mallas tácticas offline. Nunca sale a servidores de telemetría.
- **Audio / Micrófono:**
  - *¿Recopilada?* **NO**. Los audios se graban localmente, se cifran en el dispositivo del usuario y se envían directamente al par por el canal P2P/LoRa.
- **Fotos / Videos / Cámara:**
  - *¿Recopilada?* **NO**. La cámara se usa exclusivamente en tiempo real para escanear códigos QR de llaves públicas de pares. Ninguna imagen se almacena ni se transmite.

### 2.4 Declaración de Criptografía y Exportación (EAR / ECCN US Export Compliance)
- **Pregunta:** ¿Tu aplicación incluye, utiliza o contiene funciones criptográficas o de cifrado?
- **Respuesta:** **SÍ**.
- **Pregunta:** ¿Está tu aplicación exenta de los requisitos de notificación de exportación de EE. UU. según las Regulaciones de Administración de Exportaciones (EAR)?
- **Respuesta:** **SÍ (Exenta)**.
- **Fundamento Legal & Citar:**
  - **ECCN:** 5D002 (Information Security Software).
  - **Exención:** **License Exception TSU (Technology and Software - Unrestricted) / EAR § 742.15(b)** para software de código abierto disponible públicamente.
  - El código fuente completo de RED y sus librerías de cifrado (`libsodium`, `@noble/ed25519`, `tweetnacl`) son de acceso público universal bajo licencia AGPL-3.0 en el repositorio:
    `https://github.com/DarckRovert/RED`
  - No se requiere una autorización de exportación individual previa (Self-Classification / Mass Market Open Source Notification).

### 2.5 Declaración de Permisos Sensibles (Permissions Declaration)

1. **`android.permission.RECORD_AUDIO`**:
   - *Finalidad:* Grabar notas de voz cifradas y llamadas de audio tácticas peer-to-peer (WebRTC).
   - *Uso:* Solo activo cuando el usuario presiona activamente el botón de micrófono en el chat o inicia una llamada.
2. **`android.permission.CAMERA`**:
   - *Finalidad:* Escáner óptico de códigos QR para intercambio de identidades criptográficas (huellas de llave pública ED25519) sin intermediarios.
3. **`android.permission.ACCESS_FINE_LOCATION` & `ACCESS_COARSE_LOCATION`**:
   - *Finalidad:* Georreferenciación de balizas de rescate SOS en mapas tácticos offline y enrutamiento geográfico por Geohash en radio LoRa.
4. **`android.permission.BLUETOOTH_SCAN` & `BLUETOOTH_CONNECT`**:
   - *Finalidad:* Conexión y comando por radio BLE con hardware de campo ESP32-S3 / LoRa SX1262 acoplado al dispositivo móvil.
5. **`android.permission.SCHEDULE_EXACT_ALARM`**:
   - *Finalidad:* Temporizadores de autodestrucción efímera de mensajes en segundo plano y verificación periódica de integridad contra manipulación.

### 2.6 Categorización y Clasificación de Contenido
- **Categoría:** Comunicación / Herramientas (Communication / Tools).
- **Cuestionario IARC:**
  - *¿Permite la app comunicarse con otros usuarios?* **SÍ**.
  - *¿Se modera el contenido?* Indicar: *"Comunicación directa P2P cifrada de extremo a extremo sin intermediarios ni almacenamiento central"*.
  - *Clasificación recomendada resultante:* 18+ o Madurez Media/Alta debido a comunicación sin restricciones entre pares.

---

## 3. PUBLICACIÓN EN APTOIDE

Aptoide no exige el formato `.aab`; admite directamente el APK firmado de producción:

1. **Generar APK Firmado:**
   ```bash
   cd client/app
   npm run build:apk
   ```
   El archivo se genera en:
   `client/app/android/app/build/outputs/apk/release/app-release.apk`
   (O la copia automatizada `release-assets/red-v120.0.0-release.apk`).

2. **Subida en Aptoide Back Office (Aptoide Uploader / Developer Console):**
   - Inicia sesión en [Aptoide Developer](https://catappult.io/) o [Aptoide Apps](https://aptoide.com/).
   - Arrastra el APK firmado `app-release.apk`.
   - **Verificación Antivirus (Aptoide Trusted Badge):** El sistema Aptoide analizará el APK con más de 20 motores antivirus. Debido a que el APK está firmado con un certificado RSA 4096 legítimo y no contiene código ofuscado malicioso ni malware de telemetría, obtendrá automáticamente la insignia verde **"Confianza / Trusted"**.

3. **Metadatos Recomendados para Aptoide:**
   - **Título:** RED - Sovereign Mesh & Tactical P2P Chat
   - **Descripción Corta:** Mensajería táctica descentralizada, cifrado E2EE post-cuántico, comunicaciones LoRa off-grid y cero telemetría.
   - **Categoría:** Comunicación / Seguridad.
   - **Página Web:** `https://darckrovert.github.io/RED/`
   - **URL de Privacidad:** `https://darckrovert.github.io/RED/privacy.html`

---

## 4. PUBLICACIÓN EN F-DROID (CRITERIOS OPEN-SOURCE)

F-Droid es el repositorio por excelencia para software 100% libre. Para someter RED a `fdroiddata`:

1. **Cumplimiento de Políticas F-Droid:**
   - Licencia declarada en la raíz del repositorio: `LICENSE` (AGPL-3.0).
   - No contiene dependencias binarias propietarias en runtime (sin Google Play Services / Firebase Analytics obligatorios).
   - El código fuente compila de forma reproducible.

2. **Plantilla de Receta F-Droid (`f.red.app.yml`):**
   ```yaml
   Categories:
     - Connectivity
     - Internet
     - Security
   License: AGPL-3.0-or-later
   SourceCode: https://github.com/DarckRovert/RED
   IssueTracker: https://github.com/DarckRovert/RED/issues
   WebSite: https://darckrovert.github.io/RED/

   AutoUpdateMode: Version v%v
   UpdateCheckMode: Tags
   CurrentVersion: 120.0.0
   CurrentVersionCode: 120000

   Builds:
     - versionName: 120.0.0
       versionCode: 120000
       commit: v120.0.0
       subdir: client/app/android
       gradle:
         - yes
       prebuild:
         - cd ../.. && npm install && npm run build
   ```

---

## 5. AMAZON APPSTORE

1. **Subida de APK:**
   - Compatible con `app-release.apk` (o el `.aab` si se opta por App Bundles en Amazon Developer Console).
2. **Compatibilidad:**
   - Compatible con dispositivos Fire OS y teléfonos Android estándar.
3. **Póliza de Privacidad y EULA:**
   - Se deben ingresar los enlaces web de GitHub Pages correspondientes a `privacy.html` y `terms.html`.

---

## 6. RESUMEN DE LLAVES Y HUELLAS CRIPTOGRÁFICAS

Para verificar o certificar los binarios en cualquier consola de desarrollador:

- **Ruta de Keystore:** `client/app/android/red-release.keystore`
- **Alias:** `red-release-key`
- **Algoritmo:** RSA 4096-bit / SHA384withRSA
- **Propietario / Emisor:** `CN=RED Sovereign Foundation, OU=Tactical Cryptography, O=RED Project, L=Global, ST=Decentralized, C=CH`
- **Huella Digital SHA-256:**  
  `22:58:08:51:2A:EE:A6:26:F6:92:59:55:1B:6F:A4:2C:9D:A2:71:02:08:21:11:20:89:F3:17:07:61:9B:2E:4F`
- **Huella Digital SHA-1:**  
  `8C:D1:D7:81:EE:51:75:A8:17:60:3B:5A:19:D9:D2:C3:FF:11:F5:BD`

> [!IMPORTANT]
> Nunca compartas ni comprometas en Git el archivo binario `red-release.keystore` ni sus contraseñas. El archivo está protegido por `.gitignore`. Guarda un respaldo cifrado offline seguro de esta llave para futuras actualizaciones v106+.
