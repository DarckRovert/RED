"use client";

import React from "react";

interface RedShowcaseLandingProps {
  onEnterApp: () => void;
}

export default function RedShowcaseLanding({ onEnterApp }: RedShowcaseLandingProps) {
  const apkDownloadUrl = process.env.NEXT_PUBLIC_BASE_PATH 
    ? `${process.env.NEXT_PUBLIC_BASE_PATH}/assets/red-v24.0.0-latest.apk`
    : `/assets/red-v24.0.0-latest.apk`;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans selection:bg-red-500 selection:text-white relative overflow-x-hidden flex flex-col">
      {/* Dynamic Background Mesh Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(220,38,38,0.25),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

      {/* Header / Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-10 border-b border-red-900/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-black text-xl tracking-tighter shadow-lg shadow-red-900/40 border border-red-500/30">
            Ω
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-wider text-white flex items-center gap-2">
              RED <span className="text-xs px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/40 font-mono">v24.0.0</span>
            </span>
            <p className="text-[10px] text-slate-400 tracking-widest uppercase font-mono">Plataforma Táctica P2P Mesh</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onEnterApp}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all"
          >
            Abrir Web App ↗
          </button>
          <a
            href={apkDownloadUrl}
            download="red-v24.0.0-latest.apk"
            className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 rounded-xl shadow-lg shadow-red-900/40 border border-red-500/40 transition-all flex items-center gap-2"
          >
            <span>📥</span> Descargar APK
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-6xl mx-auto px-6 pt-16 pb-24 z-10 flex-grow flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/60 border border-red-800/40 text-xs font-mono text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Soberanía Criptográfica Absoluta & Operación Off-Grid
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400">
            Comunicaciones Tácticas Indestructibles Sin Internet
          </h1>

          <p className="text-base md:text-lg text-slate-300 leading-relaxed font-light">
            Diseñado para operar en zonas de apagón, censura estatal y situaciones de emergencia extrema. RED convierte cada smartphone en un nodo mesh que cifra y enruta mensajes por <strong className="text-red-400 font-semibold">Bluetooth LE, WiFi Direct, LoRa y Redes Celulares 4G/5G</strong> sin servidores centrales.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={apkDownloadUrl}
              download="red-v24.0.0-latest.apk"
              className="w-full sm:w-auto px-8 py-4 text-base font-extrabold text-white bg-gradient-to-r from-red-600 via-red-700 to-red-900 hover:from-red-500 hover:to-red-800 rounded-2xl shadow-xl shadow-red-950/60 border border-red-500/40 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
            >
              <span className="text-xl">📥</span>
              <div className="text-left">
                <div className="leading-none">Descargar APK Oficial</div>
                <div className="text-[10px] text-red-200 font-mono mt-1 font-normal">v24.0.0 Zenith Master • Android 8.0+</div>
              </div>
            </a>

            <button
              onClick={onEnterApp}
              className="w-full sm:w-auto px-8 py-4 text-base font-bold text-slate-200 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/60 rounded-2xl transition-all flex items-center justify-center gap-3 backdrop-blur-md"
            >
              <span>💻</span> Probador Web App
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm hover:border-red-900/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-800/40 flex items-center justify-center text-2xl mb-4">
              🛡️
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Cifrado Noise XK + Ed25519</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Handshakes elípticos de curva X25519 y cifrado simétrico autenticado ChaCha20-Poly1305. Identidad soberana criptográfica pura (`did:red:`).
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm hover:border-red-900/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-800/40 flex items-center justify-center text-2xl mb-4">
              🎒
            </div>
            <h3 className="text-lg font-bold text-white mb-2">DTN Store-and-Forward</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Mula de datos humana (*Sneakernet*). Los mensajes no entregados saltan de teléfono en teléfono cifrados hasta alcanzar su destinatario.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm hover:border-red-900/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-800/40 flex items-center justify-center text-2xl mb-4">
              🔒
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Inmunidad a VPNs & Modo Señuelo</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              El transporte BLE opera a nivel de hardware directo sin pasar por el stack IP. Ingresa la clave `9999` para desplegar un perfil señuelo en caso de emboscada.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm hover:border-red-900/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-800/40 flex items-center justify-center text-2xl mb-4">
              🎙️
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Notas de Voz Tácticas (12 Kbps)</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Compresión acústica de alta eficiencia optimizada para transmisión en canales de radio de baja velocidad (BLE / LoRa).
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm hover:border-red-900/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-800/40 flex items-center justify-center text-2xl mb-4">
              🚨
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Baliza SOS GPS</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Emisión de coordenadas GPS de socorro de máxima prioridad a todos los nodos P2P dentro del área de radio.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm hover:border-red-900/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-800/40 flex items-center justify-center text-2xl mb-4">
              🌐
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Relés 4G/5G P2P Globales</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Integración con nodos semilla Kademlia DHT para conexión intercontinental mediante datos celulares atravesando NATs.
            </p>
          </div>
        </div>

        {/* Documentation Links Box */}
        <div className="mt-16 p-8 rounded-3xl bg-gradient-to-r from-red-950/40 via-slate-900/60 to-slate-900/40 border border-red-900/30 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h4 className="text-xl font-extrabold text-white">Documentación Técnica & Especificaciones</h4>
            <p className="text-sm text-slate-400">Consulta los manuales de usuario, arquitectura de red y especificación criptográfica del Protocolo Ω.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/DarckRovert/RED/blob/main/README.md"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all"
            >
              📖 README Técnico
            </a>
            <a
              href="https://github.com/DarckRovert/RED/blob/main/USER_MANUAL.md"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all"
            >
              📘 Manual de Usuario
            </a>
            <a
              href="https://github.com/DarckRovert/RED/blob/main/docs/ARCHITECTURE.md"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-all"
            >
              🏗️ Arquitectura
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 py-8 px-6 text-center text-xs text-slate-500 font-mono z-10">
        <p>© 2026 PROYECTO RED — Plataforma Soberana de Comunicaciones P2P Mesh. Código Abierto.</p>
      </footer>
    </div>
  );
}
