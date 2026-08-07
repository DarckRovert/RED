# 📱 RED Client SPA — Next.js 16 + Capacitor Mobile App v30.0.0

Plataforma de interfaz táctica soberana e integración con motor nativo de Rust.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## 🛠️ Comandos de Compilación & Sincronización

```bash
# 1. Instalar dependencias del cliente
npm install

# 2. Servidor de desarrollo SPA
npm run dev

# 3. Exportación estática e integración con Capacitor Android
npm run build
npx cap sync android
```

## 📱 Arquitectura de Componentes de Interfaz

- **`src/app/page.tsx`**: Enrutador principal SPA e hidratación dinámica de componentes tácticos.
- **`src/components/Sidebar.tsx`**: Panel principal de chat y acceso prominente a `⚡ MÓDULOS`.
- **`src/components/SecurityPanel.tsx`**: Módulo de Seguridad Táctica Zero-Trust y `FLAG_SECURE`.
- **`src/components/SecurityReportModal.tsx`**: Ficha de auditoría con dictamen de **IA Neuronal ONNX WASM** (`LaMini-Flan-T5`).
- **`src/components/NodeLogsModal.tsx`**: Consola de logs en vivo conectada al stream SSE del motor de Rust.
- **`src/lib/localAiEngine.ts`**: Motor de IA local 100% offline basado en `onnxruntime-web`.
- **`src/lib/api.ts`**: Cliente REST/SSE de comunicación local con `http://127.0.0.1:7333`.
