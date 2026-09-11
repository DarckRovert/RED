"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { RED_VERSION, RED_APK_NAME } from '../../lib/version';
import { TacIcon } from '../ui/TacIcon';

interface SlideData {
    id: number;
    tag: string;
    title: string;
    subtitle: string;
    badgeColor: string;
    renderContent: (basePath: string) => React.ReactNode;
}

export const PitchDeck: React.FC = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const apkUrl = `https://github.com/DarckRovert/RED/releases/download/v${RED_VERSION}/${RED_APK_NAME}`;

    const slides: SlideData[] = [
        // SLIDE 1: PORTADA & HOOK
        {
            id: 1,
            tag: "VISIÓN ESTRATÉGICA • v99.0.0",
            title: "La Red que Nunca Cae",
            subtitle: "El primer sistema operativo táctico de malla soberana 100% off-grid del mundo. Comunicaciones directas de dispositivo a dispositivo sin internet, sin antenas celulares y sin intermediarios.",
            badgeColor: "border-emerald-500/40 text-emerald-400 bg-emerald-950/40",
            renderContent: (base) => (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full">
                    <div className="lg:col-span-6 space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/30 text-emerald-400 text-xs font-mono uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            RED OS v{RED_VERSION} — SOVEREIGN MESH
                        </div>
                        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-none">
                            COMUNICACIÓN <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">ABSOLUTA</span> SIN INTERNET
                        </h1>
                        <p className="text-lg text-slate-300 leading-relaxed font-light">
                            Cuando la infraestructura convencional colapsa por desastres naturales, apagones o censura, los smartphones ordinarios se convierten en ladrillos. <strong>RED transforma cada dispositivo en un nodo de telecomunicaciones autónomo</strong> capaz de hablar a kilómetros de distancia.
                        </p>
                        <div className="grid grid-cols-3 gap-3 pt-2">
                            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md text-center">
                                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">0%</div>
                                <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">Internet Requerido</div>
                            </div>
                            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md text-center">
                                <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">25 km</div>
                                <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">Alcance LoRa TDMA</div>
                            </div>
                            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md text-center">
                                <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">62</div>
                                <div className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">Módulos Tácticos</div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-6 flex justify-center">
                        <div className="relative w-full max-w-lg aspect-video sm:aspect-square rounded-2xl overflow-hidden border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.15)] group">
                            <img
                                src={`${base}/assets/red_pitch_mesh_concept.jpg`}
                                alt="RED Sovereign Mesh Concept"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs font-mono text-emerald-300">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> NODO MOTOROLA MOTO G22 EN TERRENO
                                </span>
                                <span className="text-slate-400">RADIO LoRa TDMA ACTIVO</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },

        // SLIDE 2: EL PROBLEMA
        {
            id: 2,
            tag: "EL PROBLEMA GLOBAL",
            title: "Un Castillo de Naipes Digital",
            subtitle: "El 99.9% de las comunicaciones civiles dependen de una red centralizada, frágil y vulnerable que puede apagarse en segundos.",
            badgeColor: "border-rose-500/40 text-rose-400 bg-rose-950/40",
            renderContent: () => (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-center">
                    <div className="p-6 rounded-2xl border border-rose-500/20 bg-gradient-to-b from-rose-950/20 to-slate-900/60 backdrop-blur-md relative overflow-hidden flex flex-col justify-between h-full">
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 text-2xl font-mono">
                                ⚡
                            </div>
                            <h3 className="text-xl font-bold text-white">Apagones & Desastres Naturales</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Terremotos, huracanes, inundaciones o fallas en la red eléctrica colapsan las torres de telefonía celular en <strong>menos de 2 horas</strong> tras agotarse sus baterías de respaldo.
                            </p>
                        </div>
                        <div className="mt-6 pt-4 border-t border-rose-500/20 text-xs font-mono text-rose-400">
                            93% de las víctimas pierden comunicación en las primeras 48h de rescate.
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-950/20 to-slate-900/60 backdrop-blur-md relative overflow-hidden flex flex-col justify-between h-full">
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-2xl font-mono">
                                🔒
                            </div>
                            <h3 className="text-xl font-bold text-white">Censura & Bloqueos Estatales</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Con una sola orden a tres proveedores de telecomunicaciones centralizados, un gobierno o monopolio puede <strong>desconectar a millones de personas</strong> durante protestas, conflictos o crisis políticas.
                            </p>
                        </div>
                        <div className="mt-6 pt-4 border-t border-amber-500/20 text-xs font-mono text-amber-400">
                            Más de 180 apagones de internet ordenados en el mundo durante 2025-2026.
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-indigo-950/20 to-slate-900/60 backdrop-blur-md relative overflow-hidden flex flex-col justify-between h-full">
                        <div className="space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-2xl font-mono">
                                👁️
                            </div>
                            <h3 className="text-xl font-bold text-white">Vigilancia & Dependencia Económica</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Pagamos tarifas mensuales perpetuas por una red que nos vigila, comercializa nuestros metadatos y nos deja indefensos si no pagamos o si salimos de su mapa comercial de cobertura.
                            </p>
                        </div>
                        <div className="mt-6 pt-4 border-t border-indigo-500/20 text-xs font-mono text-indigo-400">
                            4,000 millones de personas en zonas rurales o marginadas sin acceso confiable.
                        </div>
                    </div>
                </div>
            )
        },

        // SLIDE 3: LA SOLUCIÓN RED
        {
            id: 3,
            tag: "LA ARQUITECTURA SOBERANA",
            title: "Malla P2P: De Teléfono a Teléfono",
            subtitle: "En vez de enviar un mensaje a un centro de datos a 5,000 km, RED lo envía por el aire directamente a quienes te rodean.",
            badgeColor: "border-cyan-500/40 text-cyan-400 bg-cyan-950/40",
            renderContent: (base) => (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full">
                    <div className="lg:col-span-7">
                        <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)] group">
                            <img
                                src={`${base}/assets/red_infographic_comparison.jpg`}
                                alt="Infografía Comparativa de Malla"
                                className="w-full h-auto object-contain"
                            />
                            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-cyan-500/40 text-[11px] font-mono text-cyan-300">
                                COMPARATIVA FÍSICA: RED TRADICIONAL vs RED SOVEREIGN MESH
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-5 space-y-4">
                        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-md space-y-1">
                            <div className="text-cyan-400 font-bold text-base flex items-center gap-2">
                                <span>🔗</span> Efecto Dominó Táctico
                            </div>
                            <p className="text-xs sm:text-sm text-slate-300">
                                Si necesitas enviar un mensaje a 10 km, tu teléfono no busca internet: el paquete salta de forma silenciosa e invisible a través de otros celulares o repetidores intermedios hasta llegar a su destino.
                            </p>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-md space-y-1">
                            <div className="text-emerald-400 font-bold text-base flex items-center gap-2">
                                <span>🛡️</span> Criptografía Post-Cuántica (Zero-Knowledge)
                            </div>
                            <p className="text-xs sm:text-sm text-slate-300">
                                Los nodos que retransmiten tus paquetes nunca pueden leerlos ni saber quién los envió. Cifrado de extremo a extremo NIST FIPS 203 (ML-KEM-768) inviolable incluso para supercomputadoras cuánticas.
                            </p>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-md space-y-1">
                            <div className="text-amber-400 font-bold text-base flex items-center gap-2">
                                <span>📈</span> Red Anti-Frágil (Crece al Usarse)
                            </div>
                            <p className="text-xs sm:text-sm text-slate-300">
                                En las redes tradicionales, más usuarios colapsan la antena. <strong>En RED, cada nuevo usuario que instala la app amplía la cobertura y hace a la malla más rápida, resistente y extensa.</strong>
                            </p>
                        </div>
                    </div>
                </div>
            )
        },

        // SLIDE 4: TECNOLOGÍA INVISIBLE
        {
            id: 4,
            tag: "TECNOLOGÍA SUB-GHZ & ALGORITMOS",
            title: "¿Cómo Funciona sin Antenas Celulares?",
            subtitle: "Tres capas de radio transparente que operan en paralelo para garantizar entrega de paquetes en cualquier condición física.",
            badgeColor: "border-purple-500/40 text-purple-400 bg-purple-950/40",
            renderContent: () => (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-center">
                    <div className="p-6 rounded-2xl border border-purple-500/30 bg-slate-900/70 backdrop-blur-md space-y-4 h-full flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 text-2xl font-mono">
                                📡
                            </div>
                            <h3 className="text-xl font-bold text-white">1. LoRa TDMA (15–25 km)</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Ondas de radio sub-GHz (915 MHz / 868 MHz) de penetración extrema. Atraviesan montañas, bosques y muros de hormigón. El planificador temporal determinista <strong>TDMA v99.0.0</strong> organiza 10 ranuras por segundo, erradicando colisiones de radio.
                            </p>
                        </div>
                        <div className="text-xs font-mono text-purple-400 pt-3 border-t border-purple-500/20">
                            Eficiencia espectral: &gt;70% sin colisiones en el aire.
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-cyan-500/30 bg-slate-900/70 backdrop-blur-md space-y-4 h-full flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-2xl font-mono">
                                📶
                            </div>
                            <h3 className="text-xl font-bold text-white">2. BLE & Wi-Fi Direct (100–300m)</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Comunicación silenciosa entre teléfonos ordinarios sin accesorios externos. Ciclo de trabajo táctico (20 ms de escucha cada segundo) que preserva la batería móvil, permitiendo <strong>más de 48 horas de operación continua</strong> en modo Doze.
                            </p>
                        </div>
                        <div className="text-xs font-mono text-cyan-400 pt-3 border-t border-cyan-500/20">
                            Consumo de batería: &lt; 2% de drenaje diario en reposo.
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-emerald-500/30 bg-slate-900/70 backdrop-blur-md space-y-4 h-full flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl font-mono">
                                🌍
                            </div>
                            <h3 className="text-xl font-bold text-white">3. Poda Geohash & Mulas DTN</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Si no hay conexión en línea recta, los mensajes se almacenan en el teléfono (Store-and-Forward) y viajan en vehículos, bicicletas o drones. El enrutamiento <strong>Geohash espacial</strong> asegura que solo los portadores que viajan hacia tu cuadrante lleven tu mensaje.
                            </p>
                        </div>
                        <div className="text-xs font-mono text-emerald-400 pt-3 border-t border-emerald-500/20">
                            Cero saturación intercontinental de satélites o transportes.
                        </div>
                    </div>
                </div>
            )
        },

        // SLIDE 5: REPETIDORES SOLARES $15 USD
        {
            id: 5,
            tag: "INFRAESTRUCTURA LIBRE DE BAJO COSTO",
            title: "Repetidores Solares de $15 USD",
            subtitle: "Cualquier persona, brigada de rescate o comunidad puede instalar cobertura eterna en tejados o colinas por el precio de una cena.",
            badgeColor: "border-amber-500/40 text-amber-400 bg-amber-950/40",
            renderContent: () => (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full items-center">
                    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-3">
                        <div className="text-3xl">☀️</div>
                        <h4 className="text-lg font-bold text-white">Autonomía Solar Eterna</h4>
                        <p className="text-xs text-slate-300">
                            Alimentado por un panel solar de 5W y una sola batería 18650. Consume menos de 12 mA a 80 MHz, permitiendo <strong>más de 12 días continuos de transmisión sin ver la luz del sol</strong>.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-3">
                        <div className="text-3xl">💵</div>
                        <h4 className="text-lg font-bold text-white">Costo Disruptivo (~$15-20)</h4>
                        <p className="text-xs text-slate-300">
                            Frente a las antenas celulares que cuestan entre $50,000 y $250,000 USD, un repetidor RED ESP32-S3 cuesta menos de $20 USD. 100 repetidores cubren un valle entero por $1,500 USD.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-3">
                        <div className="text-3xl">⚙️</div>
                        <h4 className="text-lg font-bold text-white">Filtro de Bloom Anti-Bucle</h4>
                        <p className="text-xs text-slate-300">
                            El firmware C++ implementa deduplicación matemática instantánea de 2048 bits en RAM volátil. Reenvía paquetes en microsegundos sin saturar el canal ni registrar información privada.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-3">
                        <div className="text-3xl">🛡️</div>
                        <h4 className="text-lg font-bold text-white">Código 100% Abierto</h4>
                        <p className="text-xs text-slate-300">
                            Firmware documentado en <code className="text-amber-400 font-mono">firmware/esp32-repeater</code>. Compatible con placas Heltec LoRa 32 V3 y LilyGO T-Beam disponibles en cualquier tienda electrónica global.
                        </p>
                    </div>
                </div>
            )
        },

        // SLIDE 6: 62 MÓDULOS TÁCTICOS
        {
            id: 6,
            tag: "EL ECOSISTEMA INTEGRAL",
            title: "Mucho Más que un Chat: 62 Módulos",
            subtitle: "Un sistema operativo táctico integral para supervivencia, logística, respuesta médica y coordinación civil.",
            badgeColor: "border-blue-500/40 text-blue-400 bg-blue-950/40",
            renderContent: () => (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 h-full items-center">
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-md space-y-1">
                        <div className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                            <span>💬</span> Comunicaciones Tácticas
                        </div>
                        <p className="text-xs text-slate-300">
                            Chat P2P cifrado, canales de difusión SOS de máxima prioridad y notas de voz Vocoder militar comprimidas a 1.2 kbps sobre radio.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-md space-y-1">
                        <div className="text-cyan-400 font-bold text-sm flex items-center gap-2">
                            <span>🗺️</span> Geonavegación Offline
                        </div>
                        <p className="text-xs text-slate-300">
                            Mapas vectoriales descargables, brújula táctica cinemática con corrección magnética y balizas de posicionamiento en vivo sin Google Maps.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-md space-y-1">
                        <div className="text-rose-400 font-bold text-sm flex items-center gap-2">
                            <span>🏥</span> Supervivencia & Salud
                        </div>
                        <p className="text-xs text-slate-300">
                            Ficha médica de triaje rápido TCCC, detector de caída (Man-Down), calculadoras de purificación de agua y protocolos de emergencia.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-md space-y-1">
                        <div className="text-amber-400 font-bold text-sm flex items-center gap-2">
                            <span>📐</span> Visor CAD Vectorial 4K
                        </div>
                        <p className="text-xs text-slate-300">
                            Inspección en terreno de planos arquitectónicos, esquemáticos eléctricos y mapas de infraestructura técnica sin internet.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-md space-y-1">
                        <div className="text-purple-400 font-bold text-sm flex items-center gap-2">
                            <span>💳</span> Economía Soberana P2P
                        </div>
                        <p className="text-xs text-slate-300">
                            Billetera criptográfica offline con ledger inmutable DAG para intercambios comerciales de bienes y servicios sin bancos centrales.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl border border-blue-400 font-bold text-sm flex items-center gap-2">
                        <span>🛰️</span> Pasarela Satelital LEO
                        <p className="text-xs font-normal text-slate-300">
                            Descarga de ráfagas satelitales en cuadrantes específicos mediante telemetría orbital calculada localmente en el teléfono.
                        </p>
                    </div>
                </div>
            )
        },

        // SLIDE 7: LLAMADO A LA ACCIÓN
        {
            id: 7,
            tag: "EL FUTURO ES AHORA",
            title: "Despliega la Soberanía",
            subtitle: "RED ya está verificado en hardware real, compilado con 0 errores y disponible libremente para el mundo.",
            badgeColor: "border-emerald-500/40 text-emerald-400 bg-emerald-950/40",
            renderContent: () => (
                <div className="max-w-3xl mx-auto text-center space-y-8 h-full flex flex-col justify-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-sm font-mono mx-auto">
                        VERIFICACIÓN EN HARDWARE REAL CERTIFICADA: MOTOROLA MOTO G22 & LENOVO TABLET
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
                        Construyamos la Red que Jamás Podrán Apagar
                    </h2>
                    <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-light">
                        Ya seas un usuario individual que busca estar protegido ante emergencias, una brigada de rescate que necesita enlace táctico, o una comunidad que busca independencia digital: <strong>RED es tu infraestructura libre.</strong>
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <a
                            href={apkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-base tracking-wide uppercase transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2"
                        >
                            <span>📲</span> Descargar APK Oficial v{RED_VERSION}
                        </a>
                        <a
                            href="https://github.com/DarckRovert/RED"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-white font-bold text-base transition-all flex items-center justify-center gap-2"
                        >
                            <span>⭐️</span> Ver Código Abierto en GitHub
                        </a>
                        <a
                            href={`${basePath}/`}
                            className="w-full sm:w-auto px-6 py-4 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white font-medium text-sm transition-all flex items-center justify-center gap-2"
                        >
                            <span>🌐</span> Explorar Portal Web Completo
                        </a>
                    </div>
                </div>
            )
        }
    ];

    const nextSlide = useCallback(() => {
        setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
    }, [slides.length]);

    const prevSlide = useCallback(() => {
        setCurrentSlide((prev) => (prev > 0 ? prev - 1 : slides.length - 1));
    }, [slides.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
                e.preventDefault();
                nextSlide();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                prevSlide();
            } else if (e.key === 'f' || e.key === 'F') {
                toggleFullscreen();
            } else if (e.key >= '1' && e.key <= '7') {
                const idx = parseInt(e.key) - 1;
                if (idx < slides.length) setCurrentSlide(idx);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nextSlide, prevSlide, slides.length]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    // Touch navigation for mobile devices
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX === null) return;
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        if (diff > 50) nextSlide();
        else if (diff < -50) prevSlide();
        setTouchStartX(null);
    };

    const slide = slides[currentSlide];

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="fixed inset-0 bg-[#06070B] text-slate-100 flex flex-col justify-between overflow-hidden select-none font-sans"
        >
            {/* BACKGROUND GLOWS */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none" />

            {/* TOP BAR: PROGRESS & BRAND */}
            <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center font-black text-red-400 font-mono">
                        R
                    </div>
                    <div>
                        <div className="font-bold text-white tracking-wide text-sm flex items-center gap-2">
                            RED — Sovereign Mesh OS
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                                v{RED_VERSION}
                            </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                            PRESENTACIÓN EJECUTIVA • PITCH DECK
                        </div>
                    </div>
                </div>

                {/* SLIDE PROGRESS TABS */}
                <div className="hidden md:flex items-center gap-1.5">
                    {slides.map((s, idx) => (
                        <button
                            key={s.id}
                            onClick={() => setCurrentSlide(idx)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                idx === currentSlide
                                    ? 'w-8 bg-gradient-to-r from-emerald-400 to-cyan-400'
                                    : 'w-2 bg-slate-800 hover:bg-slate-700'
                            }`}
                            title={`Diapositiva ${s.id}: ${s.title}`}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleFullscreen}
                        className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-mono text-slate-300 transition-colors hidden sm:flex items-center gap-1.5"
                    >
                        <span>⛶</span> {isFullscreen ? "Salir" : "Pantalla Completa"}
                    </button>
                    <a
                        href={`${basePath}/`}
                        className="px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-colors flex items-center gap-1"
                    >
                        <span>←</span> Web
                    </a>
                </div>
            </header>

            {/* MAIN SLIDE STAGE */}
            <main className="relative z-10 flex-1 px-6 sm:px-12 md:px-16 lg:px-24 py-6 overflow-y-auto flex flex-col justify-center">
                <div className="max-w-7xl mx-auto w-full">
                    {/* SLIDE HEADER */}
                    <div className="mb-6">
                        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-mono tracking-wider uppercase mb-2 ${slide.badgeColor}`}>
                            {slide.tag}
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                            {slide.title}
                        </h2>
                        <p className="text-sm sm:text-base text-slate-400 mt-1 max-w-3xl font-light">
                            {slide.subtitle}
                        </p>
                    </div>

                    {/* SLIDE BODY */}
                    <div className="min-h-[380px]">
                        {slide.renderContent(basePath)}
                    </div>
                </div>
            </main>

            {/* BOTTOM CONTROLS BAR */}
            <footer className="relative z-20 flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
                <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
                    <span className="text-white font-bold text-base">
                        0{slide.id} <span className="text-slate-600 font-normal">/ 0{slides.length}</span>
                    </span>
                    <span className="hidden sm:inline text-slate-500">|</span>
                    <span className="hidden sm:inline text-slate-400">Usa [←] [→] o [Espacio] para navegar</span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={prevSlide}
                        className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-white font-mono text-sm transition-all hover:scale-105 active:scale-95"
                    >
                        ← Anterior
                    </button>
                    <button
                        onClick={nextSlide}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm tracking-wide transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-105 active:scale-95"
                    >
                        {currentSlide === slides.length - 1 ? "Reiniciar ↺" : "Siguiente →"}
                    </button>
                </div>
            </footer>
        </div>
    );
};
