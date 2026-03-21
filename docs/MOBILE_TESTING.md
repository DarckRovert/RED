# 📲 Guía Rápida: Generar Instalador para Colegas

He preparado todo el código de RED para que generar el instalador sea lo más sencillo posible. Los **archivos de instalación** (carpetas de proyecto) están listos en tu disco duro.

---

## 📂 ¿Dónde están los archivos?

- **Proyecto Android**: `f:\RED\client\app\android`
- **Proyecto iOS (Xcode)**: `f:\RED\client\app\ios`
- **Archivos Web (Optimizados)**: `f:\RED\client\app\out`

---

## 🤖 Android (Generar el archivo .apk)

Ya he realizado la compilación de producción de Next.js y la sincronización con Capacitor. Solo falta el paso final:

1.  **Abrir Android Studio**.
2.  Importa el proyecto que está en: `f:\RED\client\app\android`.
3.  Espera a que termine el "Gradle Sync" (verás una barra de progreso abajo).
4.  En el menú superior, ve a: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5.  Cuando termine, aparecerá un globo abajo a la derecha con el enlace **"locate"**. ¡Ese es tu `.apk` para compartir!

---

## 🍎 iOS (Generar IPA / TestFlight)

Para iOS, **necesitas un Mac con Xcode instalado**:

1.  Copia la carpeta `f:\RED\client\app` a tu Mac.
2.  En la terminal del Mac, dentro de esa carpeta, ejecuta:
    ```bash
    npx cap open ios
    ```
3.  Se abrirá Xcode. Selecciona tu "Team" en la pestaña **Signing & Capabilities**.
4.  Crea el archivo instalador: **Product > Archive**.
5.  Sigue los pasos de "Distribute App" para enviarlo a **TestFlight** o generar un `.ipa`.

---

## 🚀 Lo que yo ya he hecho por ti:
*   **Migración de Estilos**: He movido todos los estilos de `styled-jsx` a un archivo CSS global (`components.css`). Esto era crítico porque las versiones modernas de Next.js fallaban al compilar para móvil con estilos inline.
*   **Static Export**: He configurado `next.config.ts` para que la app sea 100% estática, requisito de Capacitor.
*   **Sincronización**: He ejecutado `cap sync`, por lo que el proyecto Android ya tiene la última versión del código visual "WOW".
*   **Autenticación Nivel Dios**: He configurado el Keystore Nativo (`SecureStoragePlugin`) y la Biometría (`BiometricAuth`). El bypass "1234" ya no existe; al abrir el APK por primera vez, el usuario enfrentará un verdadero Onboarding para crear su PIN maestro irrecuperable.

---
**RED** — Listo para testear. Compartir privacidad nunca fue tan fácil.
