# 📱 RED Client SPA — Next.js 16 + Capacitor Mobile App v62.0.0

Plataforma de interfaz táctica soberana, gestión de estado modular con Zustand Slices, llaves biométricas universales e integración nativa con el motor de Rust (`red_mobile` y `red_node`).

---

## 🛠️ Comandos de Desarrollo & Compilación

```bash
# 1. Instalar dependencias
npm install

# 2. Servidor de desarrollo SPA local (Turbopack)
npm run dev

# 3. Verificación de tipado estricto
npx tsc --noEmit

# 4. Compilación estática optimizada para producción
npm run build

# 5. Sincronización de assets con Capacitor Android
npx cap sync android
```

---

## 🏗️ Arquitectura Modular del Frontend

```
client/app/src/
├── app/
│   ├── layout.tsx         # Contenedor raíz y metadatos SEO
│   └── page.tsx           # Enrutador táctico SPA principal
├── store/
│   ├── slices/            # Zustand Slices atómicos
│   │   ├── authSlice.ts       # Sesión, PIN y bóveda
│   │   ├── chatSlice.ts       # Mensajes, hilos y estados
│   │   ├── contactsSlice.ts   # Directorio canónico y deduplicación
│   │   ├── emergencySlice.ts  # Triaje START y balizas SOS
│   │   └── socialSlice.ts     # Feed P2P y canales
│   ├── messageDispatcher.ts   # Enrutador desacoplado de eventos
│   └── useRedStore.ts         # Hook unificado con compatibilidad retroactiva
├── api/                   # Cliente HTTP Axum modularizado (http://127.0.0.1:7333)
│   ├── types.ts, core.ts, client.ts, emergency.ts, channels.ts, ai.ts, sensors.ts, economy.ts
├── lib/                   # Motores de dominio desacoplados
│   ├── crypto/            # BiometricLockEngine (Huella/Rostro/WebAuthn), PqcCryptoEngine
│   ├── ai/                # LocalAIEngine (ONNX WASM), GuardianEngine (64-bit Hamming)
│   ├── audio/             # LowBitrateVocoder, SoundMesh
│   ├── sensors/           # Hardware GPS, Barómetro, Brújula WMM2025
│   └── storage/           # DtnStorage, StateIntegrityEngine
└── components/            # 42 Módulos tácticos y componentes UI
    ├── AuthWall.tsx       # Teclado táctico de 6 dígitos y biométrica universal
    ├── Sidebar.tsx        # Panel de conversaciones y contactos
    └── settings/          # Pestañas de configuración modular (PrivacyTab, MeshTab, etc.)
```
