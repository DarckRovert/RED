# 🔴 RED — Guía de Inicio (v5.0 "Solid Gold")

RED es un sistema de mensajería soberana, descentralizada y cifrada end-to-end que ahora cuenta con una interfaz sólida estilo WhatsApp/Telegram y capacidades de hardware directo (BLE/WiFi Mesh).

## Instalación

### Requisitos
- [Rust Toolchain](https://rustup.rs/) (para el Core P2P)
- [Node.js v20+](https://nodejs.org/) (para la interfaz Solid UI)
- [Android Studio](https://developer.android.com/studio) (opcional, para compilar el .APK nativo)

```bash
# Instalar dependencias del frontend
cd client/app
npm install

# Compilar el core Rust
cd ../..
cargo build --release
```

## Uso Rápido

### 1. Inicializar y Arrancar (Modo Desarrollo)
```bash
# Terminal 1: Iniciar el Frontend Solid UI
cd client/app
npm run dev

# Terminal 2: Iniciar el Nodo P2P local (vía Rust)
./target/release/red-node start
```

### 2. Acceso a la Interfaz
- **Navegador:** Abre `http://localhost:3000` (Frontend) -> Asegúrate de que el Nodo Rust esté en `7333`.
- **Móvil (Recomendado):** Sigue los pasos en `docs/DEPLOYMENT.md` para empaquetar con Capacitor 8 y disfrutar de las funciones de hardware real.

### 3. Generación de Identidad
1. Al abrir la app, pulsa en **"Empezar"**.
2. Tu dispositivo generará una identidad **DID** única.
3. **CRÍTICO:** Copia y guarda tu **Identity Hash**. RED no tiene "recuperación de contraseña" por correo; si pierdes este código, pierdes tu cuenta.

## Características de la v5.0
- **Solid UI:** Interfaz premium, rápida y minimalista.
- **RED Nearby:** Radar de contactos por Bluetooth BLE sin necesidad de internet.
- **Mesh Storage:** Los mensajes se reenvían entre nodos cercanos automáticamente.
- **Anti-Forense:** Bloqueo de capturas y PIN de pánico integrados.

---

## Comandos Tácticos (CLI)

```bash
# Ver salud del nodo local
./target/release/red status --stats

# Forzar descubrimiento BLE
./target/release/red scan --nearby
```

---

**RED** — Soberanía tecnológica para el siglo XXI.
