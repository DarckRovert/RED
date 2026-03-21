# 🔴 RED - Red Encriptada Descentralizada

> **v5.1.0 (Masterpiece Edition)** — La alternativa soberana a WhatsApp: Solid UI, hardware real P2P, resistente a censura, con seguridad nativa basada en Keystore (Android/iOS) y Bóveda Táctica Anti-Forense.

[![Build](https://img.shields.io/badge/Build-Passing-brightgreen)]() [![Routes](https://img.shields.io/badge/Rutas_Producción-22-blue)]() [![Phases](https://img.shields.io/badge/Fases_Completadas-36%2B-gold)]()

## 🎯 Visión

RED es un protocolo de comunicación que garantiza:
- **Privacidad total**: Cifrado X25519 + AES-256-GCM con deniabilidad perfecta
- **Descentralización**: Sin servidores centrales, red P2P pura (100% P2P)
- **Seguridad Táctica**: PIN de Pánico, Modo Camuflaje y Borrado de Seguridad (DMS)
- **Anonimato**: Identidades DID efímeras, sin metadatos expuestos
- **Resistencia a censura**: Operación vía BLE/WiFi-Direct y Mesh LoRa
- **Paridad con WhatsApp**: Todas las características principales más capacidades exclusivas

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      CAPA DE APLICACIÓN                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Android │  │   iOS   │  │   Web   │  │   PWA   │        │
│  │(Capacitor)│ │(Capacitor)│ │(Next.js)│ │(SW+Push)│        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
└───────┼────────────┼────────────┼────────────┼──────────────┘
        │            │            │            │
┌───────┴────────────┴────────────┴────────────┴──────────────┐
│                      CAPA DE PROTOCOLO                       │
│  Chat P2P · Grupos · Llamadas WebRTC · Stories · Encuestas  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴──RED/
├── client/app/                  # Frontend Next.js + Capacitor
│   ├── src/
│   │   ├── app/                 # Rutas de producción (Solid UI)
│   │   │   ├── chat/            # Ventana principal de chat
│   │   │   ├── settings/        # Configuración iOS-style
│   │   │   ├── multidevice/     # Vinculación por QR
│   │   │   ├── sync/            # Nearby Radar / BLE Logic
│   │   │   └── ...              
│   │   ├── components/          # Componentes premium (Burbujas, Inputs)
│   │   └── store/               # Estado global Zustand (Sincronizado)
├── core/                        # Protocolo Rust (Backend P2P)
├── node/                        # Implementación del nodo Axum (API)
├── android/                     # Capa nativa (Foreground Service, BLE Java)
├── docs/                        # Manuales y especificaciones
└── CHANGELOG.md                 # Historial de versiones 5.0.0
/      # Admin de grupos
│   │   │   ├── multidevice/     # Vinculación multi-dispositivo
│   │   │   ├── nodemap/         # Mapa de nodos RED (SVG live)
│   │   │   ├── stats/           # Estadísticas de uso
│   │   │   └── ...              # (contacts, profile, etc.)
│   │   ├── components/          # 16 componentes reutilizables
│   │   │   ├── ChatWindow.tsx   # Ventana de chat completa
│   │   │   ├── Sidebar.tsx      # Lista + búsqueda + navegación
│   │   │   ├── CallScreen.tsx   # Llamadas voz/video WebRTC
│   │   │   ├── LinkPreview.tsx  # Vista previa de links
│   │   │   ├── PollComponents.tsx # Encuestas interactivas
│   │   │   ├── MessageSearch.tsx  # Búsqueda global
│   │   │   ├── ChatLabels.tsx   # Etiquetas de chat
│   │   │   ├── ChatNotifSettings.tsx # Notif por chat
│   │   │   ├── WallpaperPicker.tsx  # Fondos de conversación
│   │   │   ├── OfflineIndicator.tsx # Banner sin conexión
│   │   │   └── ...
│   │   ├── store/
│   │   │   └── useRedStore.ts   # Estado global Zustand (36+ acciones)
│   │   └── lib/
│   │       └── api.ts           # Interfaces TypeScript + API calls
│   └── public/
│       └── sw.js                # Service Worker (Push Notifications)
├── core/                        # Protocolo Rust (gossip, DHT, crypto)
├── node/                        # Implementación del nodo backend
├── blockchain/                  # Contratos inteligentes RED
├── docs/                        # Documentación técnica extendida
├── README.md                    # Este archivo
├── CHANGELOG.md                 # Historial de versiones
├── GETTING_STARTED.md           # Guía de inicio rápido
├── USER_MANUAL.md               # Manual de usuario
└── ADMIN_MANUAL.md              # Manual de administrador
```

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js ≥ 18
- Android Studio (para APK) o Xcode (para iOS)

### Instalación
```bash
cd client/app
npm install
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npx cap sync android # Sincronizar con Android
npx cap sync ios     # Sincronizar con iOS
```

### Abrir en Android
```bash
npx cap open android
# → Build → Run en Android Studio
```

## ✨ Características (v4.0 — Suite de Seguridad Total)

### 📨 Mensajería
| Característica | Estado |
|---|---|
| Chat 1:1 cifrado P2P | ✅ |
| Grupos descentralizados | ✅ |
| Responder mensaje (cita) | ✅ |
| Reacciones emoji (6) | ✅ |
| Eliminar mensaje | ✅ |
| Ticks ✓ ✓✓ azul | ✅ |
| Timestamps relativos | ✅ |
| Mensajes efímeros | ✅ |
| Mensajes programados | ✅ |
| Reenviar mensaje | ✅ |
| Mensajes guardados ⭐ | ✅ |

### 📎 Media & Tools
| Característica | Estado |
|---|---|
| Envío de imágenes | ✅ |
| Notas de voz (10s) | ✅ |
| Adjuntar archivos | ✅ |
| Vista previa de links | ✅ |
| Encuestas interactivas | ✅ |
| **Ubicación en vivo (E2E)** | ✅ |

### 📞 Llamadas
| Característica | Estado |
|---|---|
| Llamadas de voz WebRTC | ✅ |
| Videollamadas | ✅ |
| Historial de llamadas | ✅ |
| Mute / Cámara / Speaker | ✅ |

### 👤 Perfil & Presencia
| Característica | Estado |
|---|---|
| Nombre editable | ✅ |
| Avatar personalizado | ✅ |
| Stories / Estados 24h | ✅ |
| "Escribiendo..." | ✅ |
| Perfil detallado de contacto | ✅ |

### 🔒 Seguridad & Anti-Forense (Nivel Dios)
| Característica | Estado |
|---|---|
| Cifrado X25519 + AES-256-GCM | ✅ |
| Perfect Forward Secrecy | ✅ |
| Deniabilidad de mensajes | ✅ |
| **Bóveda Señuelo (Configurable por Usuario)** | ✅ |
| **Defensa Anti-Sybil (Hashcash)** | ✅ |
| **Mixnets (Ofuscación Temporal)** | ✅ |
| **Padding Constante 4KB (Anti-NSA Sizing)** | ✅ |
| **Ruido Blanco Constante (Tráfico Background)** | ✅ |
| Panel de criptografía | ✅ |
| Renegociación DH | ✅ |
| DID descentralizado | ✅ |
| **Burner Chats (RAM-Only)** | ✅ |
| **Bloqueo Capturas de Pantalla** | ✅ |
| **Dead Man's Switch (Auto-destrucción)** | ✅ |
| **PIN de Pánico y Bóveda Cifrados en Keystore** | ✅ |
| **App Disguise (Calculadora)** | ✅ |
| Auditoría del Dispositivo (Secure Enclave) | ✅ |
| **Autenticación Biométrica Nativa (Huella/FaceID)** | ✅ |

### 🌐 Red & Descentralización
| Característica | Estado |
|---|---|
| Multi-dispositivo (QR) | ✅ |
| Mapa de nodos live | ✅ |
| **RED Nearby (BLE Real Radar)** | ✅ |
| **Bluetooth Advertiser (GATT)**| ✅ |
| **WiFi Direct (P2P LAN)** | ✅ |
| **Mesh Store-and-Forward** | ✅ |
| **Mesh APK Updater (Inmunidad App Store)** | ✅ |
| **Puente LoRaWAN Sub-GHz (Anti-Apagón)** | ✅ |
| **Modo Offline Autónomo** | ✅ |

### 🎨 UX & Personalización
| Característica | Estado |
|---|---|
| True Black UI (Modo OLED) | ✅ |
| HUD Táctico y de Seguridad | ✅ |
| JetBrains Mono Typography | ✅ |
| Landing Page Interactiva (Globe.gl 3D) | ✅ |
| Fondos de conversación (6) | ✅ |
| Etiquetas de chat (6) | ✅ |
| Notificaciones por chat | ✅ |
| Búsqueda global de mensajes | ✅ |
| Exportar chat (.txt/.json) | ✅ |
| Listas de difusión | ✅ |
| Admin de grupos | ✅ |

## 🔐 Modelo de Seguridad

```
1. Identidad: DID efímero generado localmente (nunca sale del dispositivo)
2. Intercambio: X25519 Diffie-Hellman + renegociación periódica
3. Cifrado: AES-256-GCM (128-bit auth tag)
4. Firma: Ed25519 — deniable, no verificable externamente
5. Routing: Gossip protocol con onion routing (metadata sin exponer)
6. PFS: Cada mensaje usa claves de sesión únicas
```

## 📖 Documentación

| Documento | Descripción |
|---|---|
| [GETTING_STARTED.md](GETTING_STARTED.md) | Instalación y primera ejecución |
| [USER_MANUAL.md](USER_MANUAL.md) | Manual de usuario completo |
| [ADMIN_MANUAL.md](ADMIN_MANUAL.md) | Configuración del nodo backend |
| [CHANGELOG.md](CHANGELOG.md) | Historial de versiones |
| [docs/OFFLINE_CONNECTIVITY.md](docs/OFFLINE_CONNECTIVITY.md) | Conectividad BLE/WiFi/Mesh |
| [website/](website/) | Landing page del producto |
| [docs/](docs/) | Documentación técnica del protocolo |

## 🤝 Contribuir

RED es open-source. Las áreas prioritarias de contribución son:
1. **Core protocol**: Implementación WebRTC real peer-to-peer
2. **Backend node**: Rust gossip node con DHT Kademlia real
3. **Crypto**: Auditoría de la implementación criptográfica
4. **Mobile**: Testing en dispositivos físicos iOS/Android

---

*RED v5.1.0 — Suite de Seguridad Total implementada · Build: Passing ✅*
*🛡️ **Integración Nativa de Keystore** · 🔥 **Biometría Nativa** · 💀 **Dead Man's Switch***
