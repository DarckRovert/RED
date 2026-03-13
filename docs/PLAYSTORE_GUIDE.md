# 🤖 Guía de Publicación en Google Play Store - RED

Esta guía te llevará paso a paso desde el código de RED hasta tener la aplicación disponible para descargar en la Play Store.

---

## 📋 Requisitos Previos

1.  **Cuenta de Desarrollador**: Debes tener una cuenta en [Google Play Console](https://play.google.com/console/signup) (pago único de $25).
2.  **Activos Visuales**:
    *   Icono de la app (512x512 px, PNG/WebP).
    *   Gráfico de funciones (1024x500 px).
    *   Al menos 2 capturas de pantalla de la app.
3.  **Android Studio**: Instalado y configurado con el SDK de Android.

---

## 🛠️ Paso 1: Generar el Almacén de Claves (Keystore)

Para subir una app, debe estar firmada digitalmente. Genera tu clave privada:

```bash
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias
```
*Guarda este archivo `my-release-key.jks` en un lugar seguro. Si lo pierdes, no podrás actualizar la app nunca más.*

---

## 🏗️ Paso 2: Preparar el Build con Capacitor

Sigue estos comandos en la raíz de tu proyecto RED:

1.  **Generar el build estático de Next.js**:
    ```bash
    npm run build
    ```
2.  **Sincronizar con el proyecto Android**:
    ```bash
    npx cap sync android
    ```
3.  **Abrir en Android Studio**:
    ```bash
    npx cap open android
    ```

---

## ⚙️ Paso 3: Configurar el Proyecto en Android Studio

Una vez abierto Android Studio:

1.  **Cambiar el ID de la App**: En `app/build.gradle`, asegúrate de que `applicationId` sea único (ej: `f.red.app`).
2.  **Versión**: Incrementa `versionCode` (entero) y `versionName` (ej: "1.0.0") en cada actualización.
3.  **Certificado de Firma**:
    *   Ve a **Build > Generate Signed Bundle / APK...**
    *   Selecciona **Android App Bundle (.aab)**.
    *   Usa el archivo `.jks` que creaste en el Paso 1.

---

## 🚀 Paso 4: Subir a Google Play Console

1.  Crea una nueva aplicación en la consola.
2.  Completa los detalles de la ficha (nombre, descripción, categoría).
3.  Configura el contenido de la aplicación (privacidad, anuncios, etc.).
4.  Ve a **Producción > Crear nueva versión**.
5.  Sube el archivo `.aab` generado por Android Studio.
6.  Envía para revisión. (Suele tardar entre 2 y 7 días la primera vez).

---

## 💡 Consejos de RED

*   **Política de Privacidad**: Al ser una app descentralizada, recalca que RED no recolecta datos personales ni metadatos en servidores centrales. Esto suele agilizar la aprobación.
*   **Permisos**: La app pedirá permisos de cámara (para QR y fotos) y micrófono (para notas de voz). Asegúrate de explicar por qué en la ficha de la Play Store.

---
**RED** — Privacidad total en el bolsillo de todos.
