# Guía de Pruebas Móviles en Hardware Real (Android)

Este documento detalla el procedimiento verificado de pruebas e instalación mediante **Android Debug Bridge (ADB)** en dispositivos físicos conectados por USB.

---

## 📲 Dispositivos Calibrados en Banco de Pruebas

- **Dispositivo 1**: Motorola Moto G22 (Serial: `ZT322B386P`)
- **Dispositivo 2**: Lenovo Tablet (Serial: `HA2CHKZ2`)

---

## 🛠️ Procedimiento de Compilación e Instalación

### 1. Requisitos de Entorno
- **JDK Java**: OpenJDK JBR de Android Studio (`C:\Program Files\Android\Android Studio\jbr`).
- **Android SDK Platform Tools**: ADB instalado (`C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe`).

### 2. Comprobación de Dispositivos Conectados
```bash
adb devices -l
```

### 3. Compilación e Instalación Automatizada (PowerShell)
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# Sincronización de activos web exportados por Next.js Turbopack
Set-Location "d:\PROYECTO RED\client\app"
npm run build
npx cap sync android

# Compilación de APK Debug en Gradle
Set-Location "d:\PROYECTO RED\client\app\android"
cmd.exe /c "gradlew.bat assembleDebug"

# Despliegue mediante Streamed Install en ambos equipos
$Apk = "app\build\outputs\apk\debug\app-debug.apk"
$Adb = "C:\Users\darck\AppData\Local\Android\Sdk\platform-tools\adb.exe"

& $Adb -s ZT322B386P install -r $Apk
& $Adb -s HA2CHKZ2 install -r $Apk
```

---

## 📋 Lista de Verificación de Pruebas

- [x] **Booteo Nativo JNI**: Rust Node inicializa correctamente tras la autenticación de contraseña.
- [x] **Prueba de Navegación**: El botón `←` y la tecla de retroceso nativa Android retornan limpiamente del chat al sidebar.
- [x] **Escaneo QR de Claves Públicas**: Lectura de `did:red:<hash>:<public_key>` asigna la clave pública en el nodo Rust.
- [x] **Auto-Intercambio Recíproco**: La recepción de `contact_request` almacena la clave del remitente y envía `contact_response`.
- [x] **Recepción en Segundo Plano**: Los mensajes entrantes cuando el chat no está abierto disparan la notificación local y refrescan la lista de conversaciones (`fetchData`).
- [x] **Inmunidad a VPN**: El transporte BLE y el servidor GATT nativo continúan operando con VPN activa.
- [x] **Difusión P2P Mesh Integral (v34.0.0)**: Canales públicos, PTT Walkie-Talkie, Balizas SOS, Triaje START y Vales Soberanos propagados y recibidos en tiempo real entre Moto G y Tablet.
- [x] **Auto-Reparación de Integridad Merkle**: `StateIntegrityEngine` verifica y aísla registros flash corruptos en el arranque sin crasheos.
- [x] **Biometría de Hardware Adaptativa**: Huella dactilar activa en Moto G (`biometryType: 3`) y degradación limpia a PIN soberano en Tablet (`biometryNotAvailable`).
