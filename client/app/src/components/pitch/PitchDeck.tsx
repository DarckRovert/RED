"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { RED_VERSION, RED_APK_NAME } from '../../lib/version';

interface SlideData {
    id: number;
    tag: string;
    title: string;
    subtitle: string;
    tagColor: string;
    tagBorder: string;
    tagBg: string;
    renderContent: (basePath: string) => React.ReactNode;
}

export const PitchDeck: React.FC = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);

    const isGhPages = typeof window !== "undefined" && window.location.pathname.includes("/RED");
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (isGhPages ? "/RED" : "");
    const apkUrl = `https://github.com/DarckRovert/RED/releases/download/v${RED_VERSION}/${RED_APK_NAME}`;

    const slides: SlideData[] = [
        // SLIDE 1: PORTADA & HOOK
        {
            id: 1,
            tag: `VISIÓN ESTRATÉGICA • v${RED_VERSION}`,
            title: "La Red que Nunca Cae",
            subtitle: "El primer sistema operativo táctico de malla soberana 100% off-grid del mundo. Comunicaciones directas de dispositivo a dispositivo sin internet, sin antenas celulares y sin intermediarios.",
            tagColor: "#00FF88",
            tagBorder: "rgba(0, 255, 136, 0.4)",
            tagBg: "rgba(0, 255, 136, 0.1)",
            renderContent: (base) => (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "32px", alignItems: "center", width: "100%" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: "8px",
                            padding: "6px 14px", borderRadius: "9999px",
                            border: "1px solid rgba(0, 255, 136, 0.3)",
                            background: "rgba(0, 255, 136, 0.08)",
                            color: "#00FF88", fontSize: "11px",
                            fontFamily: "JetBrains Mono, monospace",
                            letterSpacing: "1px", width: "fit-content"
                        }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00FF88", boxShadow: "0 0 10px #00FF88" }} />
                            RED OS v{RED_VERSION} — SOVEREIGN MESH
                        </div>

                        <h1 style={{
                            fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 900,
                            lineHeight: 1.1, color: "#FFFFFF", letterSpacing: "-1px", margin: 0
                        }}>
                            COMUNICACIÓN <span style={{
                                background: "linear-gradient(90deg, #00FF88 0%, #00E5FF 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent"
                            }}>ABSOLUTA</span> SIN INTERNET
                        </h1>

                        <p style={{ fontSize: "1.05rem", color: "#CBD5E1", lineHeight: 1.6, fontWeight: 300, margin: 0 }}>
                            Cuando la infraestructura convencional colapsa por desastres naturales, apagones o censura, los smartphones ordinarios se convierten en ladrillos. <strong>RED transforma cada dispositivo en un nodo de telecomunicaciones autónomo</strong> capaz de hablar a kilómetros de distancia.
                        </p>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", paddingTop: "8px" }}>
                            <div style={{
                                padding: "14px", borderRadius: "14px",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                background: "rgba(15, 23, 42, 0.65)",
                                backdropFilter: "blur(16px)", textAlign: "center"
                            }}>
                                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#00FF88", fontFamily: "JetBrains Mono, monospace" }}>0%</div>
                                <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#94A3B8", marginTop: "4px" }}>Internet Requerido</div>
                            </div>
                            <div style={{
                                padding: "14px", borderRadius: "14px",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                background: "rgba(15, 23, 42, 0.65)",
                                backdropFilter: "blur(16px)", textAlign: "center"
                            }}>
                                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#00E5FF", fontFamily: "JetBrains Mono, monospace" }}>25 km</div>
                                <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#94A3B8", marginTop: "4px" }}>Alcance LoRa TDMA</div>
                            </div>
                            <div style={{
                                padding: "14px", borderRadius: "14px",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                background: "rgba(15, 23, 42, 0.65)",
                                backdropFilter: "blur(16px)", textAlign: "center"
                            }}>
                                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#FFB300", fontFamily: "JetBrains Mono, monospace" }}>62</div>
                                <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#94A3B8", marginTop: "4px" }}>Módulos Tácticos</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                        <div style={{
                            position: "relative", width: "100%", maxWidth: "560px",
                            borderRadius: "20px", overflow: "hidden",
                            border: "1px solid rgba(0, 255, 136, 0.35)",
                            boxShadow: "0 0 50px rgba(0, 255, 136, 0.15)",
                            aspectRatio: "16 / 9", background: "#0c0d14"
                        }}>
                            <img
                                src={`${base}/assets/red_pitch_mesh_concept.jpg`}
                                alt="RED Sovereign Mesh Concept"
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                            <div style={{
                                position: "absolute", bottom: 0, left: 0, right: 0,
                                background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
                                padding: "16px 20px", display: "flex", justifyContent: "space-between",
                                alignItems: "center", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#00FF88"
                            }}>
                                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00FF88" }} />
                                    NODO TÁCTICO MOTO G22 EN TERRENO
                                </span>
                                <span style={{ color: "#94A3B8" }}>RADIO LoRa TDMA ACTIVO</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },

        // SLIDE 2: EL PROBLEMA GLOBAL
        {
            id: 2,
            tag: "EL PROBLEMA GLOBAL",
            title: "Un Castillo de Naipes Digital",
            subtitle: "El 99.9% de las comunicaciones civiles dependen de una red centralizada, frágil y vulnerable que puede apagarse en segundos.",
            tagColor: "#FF3355",
            tagBorder: "rgba(255, 51, 85, 0.4)",
            tagBg: "rgba(255, 51, 85, 0.1)",
            renderContent: () => (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", width: "100%" }}>
                    <div style={{
                        padding: "24px", borderRadius: "20px",
                        border: "1px solid rgba(255, 51, 85, 0.25)",
                        background: "linear-gradient(180deg, rgba(255, 51, 85, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)",
                        backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", justifyContent: "space-between"
                    }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{
                                width: "48px", height: "48px", borderRadius: "12px",
                                background: "rgba(255, 51, 85, 0.15)", border: "1px solid rgba(255, 51, 85, 0.4)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"
                            }}>
                                ⚡
                            </div>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>
                                Apagones & Catástrofes
                            </h3>
                            <p style={{ fontSize: "0.92rem", color: "#CBD5E1", lineHeight: 1.6, margin: 0 }}>
                                Terremotos, huracanes, inundaciones o fallas eléctricas colapsan las torres de telefonía celular en <strong>menos de 2 horas</strong> tras agotarse sus baterías de respaldo.
                            </p>
                        </div>
                        <div style={{ marginTop: "24px", paddingTop: "14px", borderTop: "1px solid rgba(255, 51, 85, 0.2)", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#FF3355" }}>
                            93% de las víctimas pierden comunicación en las primeras 48h de rescate.
                        </div>
                    </div>

                    <div style={{
                        padding: "24px", borderRadius: "20px",
                        border: "1px solid rgba(255, 179, 0, 0.25)",
                        background: "linear-gradient(180deg, rgba(255, 179, 0, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)",
                        backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", justifyContent: "space-between"
                    }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{
                                width: "48px", height: "48px", borderRadius: "12px",
                                background: "rgba(255, 179, 0, 0.15)", border: "1px solid rgba(255, 179, 0, 0.4)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"
                            }}>
                                🔒
                            </div>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>
                                Censura & Bloqueos de Estado
                            </h3>
                            <p style={{ fontSize: "0.92rem", color: "#CBD5E1", lineHeight: 1.6, margin: 0 }}>
                                Con una sola orden a tres proveedores centralizados, un gobierno o corporación puede <strong>desconectar a millones de personas</strong> durante crisis políticas o conflictos.
                            </p>
                        </div>
                        <div style={{ marginTop: "24px", paddingTop: "14px", borderTop: "1px solid rgba(255, 179, 0, 0.2)", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#FFB300" }}>
                            Más de 180 apagones de internet ordenados en el mundo durante 2025-2026.
                        </div>
                    </div>

                    <div style={{
                        padding: "24px", borderRadius: "20px",
                        border: "1px solid rgba(0, 229, 255, 0.25)",
                        background: "linear-gradient(180deg, rgba(0, 229, 255, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)",
                        backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", justifyContent: "space-between"
                    }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{
                                width: "48px", height: "48px", borderRadius: "12px",
                                background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.4)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"
                            }}>
                                👁️
                            </div>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>
                                Monopolio & Vigilancia
                            </h3>
                            <p style={{ fontSize: "0.92rem", color: "#CBD5E1", lineHeight: 1.6, margin: 0 }}>
                                Pagamos tarifas mensuales continuas por una red que nos rastrea, comercializa nuestros datos y nos desconecta si salimos de su mapa comercial de rentabilidad.
                            </p>
                        </div>
                        <div style={{ marginTop: "24px", paddingTop: "14px", borderTop: "1px solid rgba(0, 229, 255, 0.2)", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#00E5FF" }}>
                            4,000 millones de personas en zonas remotas sin acceso confiable.
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
            subtitle: "En vez de enviar un mensaje a un servidor a 5,000 km, RED lo envía por el aire directamente a quienes te rodean.",
            tagColor: "#00E5FF",
            tagBorder: "rgba(0, 229, 255, 0.4)",
            tagBg: "rgba(0, 229, 255, 0.1)",
            renderContent: (base) => (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "32px", alignItems: "center", width: "100%" }}>
                    <div style={{ width: "100%" }}>
                        <div style={{
                            position: "relative", borderRadius: "20px", overflow: "hidden",
                            border: "1px solid rgba(0, 229, 255, 0.35)",
                            boxShadow: "0 0 40px rgba(0, 229, 255, 0.15)",
                            background: "#0c0d14", aspectRatio: "16 / 9"
                        }}>
                            <img
                                src={`${base}/assets/red_infographic_comparison.jpg`}
                                alt="Infografía Comparativa de Malla"
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                            <div style={{
                                position: "absolute", top: "12px", left: "12px",
                                background: "rgba(6, 10, 18, 0.85)", backdropFilter: "blur(12px)",
                                padding: "6px 12px", borderRadius: "9999px",
                                border: "1px solid rgba(0, 229, 255, 0.4)",
                                fontSize: "10px", fontFamily: "JetBrains Mono, monospace", color: "#00E5FF"
                            }}>
                                RED TRADICIONAL vs RED SOVEREIGN MESH
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{
                            padding: "16px", borderRadius: "16px",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)"
                        }}>
                            <div style={{ color: "#00E5FF", fontWeight: 800, fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                <span>🔗</span> Efecto Dominó Táctico
                            </div>
                            <p style={{ fontSize: "0.88rem", color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>
                                Si necesitas enviar un mensaje a 10 km, tu teléfono no busca internet: el paquete salta de forma silenciosa e invisible a través de otros celulares o repetidores intermedios hasta llegar a su destino.
                            </p>
                        </div>

                        <div style={{
                            padding: "16px", borderRadius: "16px",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)"
                        }}>
                            <div style={{ color: "#00FF88", fontWeight: 800, fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                <span>🛡️</span> Criptografía Post-Cuántica (Zero-Knowledge)
                            </div>
                            <p style={{ fontSize: "0.88rem", color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>
                                Los nodos que retransmiten tus paquetes nunca pueden leerlos ni saber quién los envió. Cifrado de extremo a extremo NIST FIPS 203 (ML-KEM-768) inviolable para supercomputadoras.
                            </p>
                        </div>

                        <div style={{
                            padding: "16px", borderRadius: "16px",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)"
                        }}>
                            <div style={{ color: "#FFB300", fontWeight: 800, fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                <span>📈</span> Red Anti-Frágil (Crece al Usarse)
                            </div>
                            <p style={{ fontSize: "0.88rem", color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>
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
            tag: "TECNOLOGÍA SUB-GHZ & PROTOCOLOS",
            title: "¿Cómo Funciona sin Antenas Celulares?",
            subtitle: "Tres capas de radio transparente que operan en paralelo para garantizar entrega de paquetes en cualquier condición física.",
            tagColor: "#B388FF",
            tagBorder: "rgba(179, 136, 255, 0.4)",
            tagBg: "rgba(179, 136, 255, 0.1)",
            renderContent: () => (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", width: "100%" }}>
                    <div style={{
                        padding: "24px", borderRadius: "20px",
                        border: "1px solid rgba(179, 136, 255, 0.3)",
                        background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)",
                        display: "flex", flexDirection: "column", justifyContent: "space-between"
                    }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{
                                width: "48px", height: "48px", borderRadius: "12px",
                                background: "rgba(179, 136, 255, 0.15)", border: "1px solid rgba(179, 136, 255, 0.4)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"
                            }}>
                                📡
                            </div>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>
                                1. LoRa TDMA (15–25 km)
                            </h3>
                            <p style={{ fontSize: "0.92rem", color: "#CBD5E1", lineHeight: 1.6, margin: 0 }}>
                                Ondas de radio sub-GHz (915 MHz / 868 MHz) de penetración táctica. Atraviesan montañas, bosques y muros de hormigón. El planificador <strong>TDMA v99.0.0</strong> organiza 10 ranuras por segundo, erradicando colisiones.
                            </p>
                        </div>
                        <div style={{ marginTop: "24px", paddingTop: "14px", borderTop: "1px solid rgba(179, 136, 255, 0.2)", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#B388FF" }}>
                            Eficiencia espectral: &gt;70% sin colisiones en el aire.
                        </div>
                    </div>

                    <div style={{
                        padding: "24px", borderRadius: "20px",
                        border: "1px solid rgba(0, 229, 255, 0.3)",
                        background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)",
                        display: "flex", flexDirection: "column", justifyContent: "space-between"
                    }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{
                                width: "48px", height: "48px", borderRadius: "12px",
                                background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.4)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"
                            }}>
                                📶
                            </div>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>
                                2. BLE & Wi-Fi Direct (100–300m)
                            </h3>
                            <p style={{ fontSize: "0.92rem", color: "#CBD5E1", lineHeight: 1.6, margin: 0 }}>
                                Comunicación silenciosa entre teléfonos ordinarios sin accesorios externos. Ciclo táctico (20 ms de escucha cada segundo) que preserva la batería móvil, permitiendo <strong>más de 48 horas de operación continua</strong> en modo Doze.
                            </p>
                        </div>
                        <div style={{ marginTop: "24px", paddingTop: "14px", borderTop: "1px solid rgba(0, 229, 255, 0.2)", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#00E5FF" }}>
                            Consumo de batería: &lt; 2% de drenaje diario en reposo.
                        </div>
                    </div>

                    <div style={{
                        padding: "24px", borderRadius: "20px",
                        border: "1px solid rgba(0, 255, 136, 0.3)",
                        background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)",
                        display: "flex", flexDirection: "column", justifyContent: "space-between"
                    }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{
                                width: "48px", height: "48px", borderRadius: "12px",
                                background: "rgba(0, 255, 136, 0.15)", border: "1px solid rgba(0, 255, 136, 0.4)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"
                            }}>
                                🌍
                            </div>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>
                                3. Poda Geohash & Mulas DTN
                            </h3>
                            <p style={{ fontSize: "0.92rem", color: "#CBD5E1", lineHeight: 1.6, margin: 0 }}>
                                Si no hay conexión en línea recta, los mensajes se almacenan en el teléfono (Store-and-Forward) y viajan en vehículos, bicicletas o drones. El enrutamiento <strong>Geohash espacial</strong> asegura que solo los portadores adecuados lleven tu mensaje.
                            </p>
                        </div>
                        <div style={{ marginTop: "24px", paddingTop: "14px", borderTop: "1px solid rgba(0, 255, 136, 0.2)", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "#00FF88" }}>
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
            tagColor: "#FFB300",
            tagBorder: "rgba(255, 179, 0, 0.4)",
            tagBg: "rgba(255, 179, 0, 0.1)",
            renderContent: () => (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", width: "100%" }}>
                    <div style={{
                        padding: "20px", borderRadius: "16px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(16px)",
                        display: "flex", flexDirection: "column", gap: "10px"
                    }}>
                        <div style={{ fontSize: "28px" }}>☀️</div>
                        <h4 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>Autonomía Solar Eterna</h4>
                        <p style={{ fontSize: "0.85rem", color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>
                            Panel solar de 5W y una batería 18650. Consume menos de 12 mA a 80 MHz, permitiendo <strong>más de 12 días continuos de transmisión en oscuridad total sin sol</strong>.
                        </p>
                    </div>

                    <div style={{
                        padding: "20px", borderRadius: "16px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(16px)",
                        display: "flex", flexDirection: "column", gap: "10px"
                    }}>
                        <div style={{ fontSize: "28px" }}>💵</div>
                        <h4 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>Costo Disruptivo (~$15-20)</h4>
                        <p style={{ fontSize: "0.85rem", color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>
                            Frente a las antenas celulares que cuestan entre $50,000 y $250,000 USD, un repetidor RED ESP32-S3 cuesta menos de $20 USD. 100 repetidores cubren un valle entero por $1,500 USD.
                        </p>
                    </div>

                    <div style={{
                        padding: "20px", borderRadius: "16px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(16px)",
                        display: "flex", flexDirection: "column", gap: "10px"
                    }}>
                        <div style={{ fontSize: "28px" }}>⚙️</div>
                        <h4 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>Filtro de Bloom Anti-Bucle</h4>
                        <p style={{ fontSize: "0.85rem", color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>
                            Deduplicación matemática instantánea de 2048 bits en memoria volátil. Reenvía paquetes en microsegundos sin saturar el canal ni registrar información privada.
                        </p>
                    </div>

                    <div style={{
                        padding: "20px", borderRadius: "16px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(16px)",
                        display: "flex", flexDirection: "column", gap: "10px"
                    }}>
                        <div style={{ fontSize: "28px" }}>🛡️</div>
                        <h4 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>Código 100% Abierto</h4>
                        <p style={{ fontSize: "0.85rem", color: "#CBD5E1", lineHeight: 1.5, margin: 0 }}>
                            Firmware documentado en <code style={{ color: "#FFB300", fontFamily: "JetBrains Mono, monospace" }}>firmware/esp32-repeater</code>. Compatible con placas Heltec LoRa 32 V3 y LilyGO T-Beam disponibles globalmente.
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
            tagColor: "#38BDF8",
            tagBorder: "rgba(56, 189, 248, 0.4)",
            tagBg: "rgba(56, 189, 248, 0.1)",
            renderContent: () => (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", width: "100%" }}>
                    <div style={{
                        padding: "16px", borderRadius: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)"
                    }}>
                        <div style={{ color: "#00FF88", fontWeight: 800, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span>💬</span> Comunicaciones Tácticas
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "#CBD5E1", lineHeight: 1.4, margin: 0 }}>
                            Chat P2P cifrado, canales de difusión SOS de máxima prioridad y notas de voz Vocoder militar comprimidas a 1.2 kbps sobre radio.
                        </p>
                    </div>

                    <div style={{
                        padding: "16px", borderRadius: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)"
                    }}>
                        <div style={{ color: "#00E5FF", fontWeight: 800, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span>🗺️</span> Geonavegación Offline
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "#CBD5E1", lineHeight: 1.4, margin: 0 }}>
                            Mapas vectoriales descargables, brújula táctica cinemática con corrección magnética y balizas de posicionamiento sin Google Maps.
                        </p>
                    </div>

                    <div style={{
                        padding: "16px", borderRadius: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)"
                    }}>
                        <div style={{ color: "#FF3355", fontWeight: 800, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span>🏥</span> Supervivencia & Salud
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "#CBD5E1", lineHeight: 1.4, margin: 0 }}>
                            Ficha médica de triaje rápido TCCC, detector de caída (Man-Down), calculadoras de purificación de agua y protocolos de emergencia.
                        </p>
                    </div>

                    <div style={{
                        padding: "16px", borderRadius: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)"
                    }}>
                        <div style={{ color: "#FFB300", fontWeight: 800, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span>📐</span> Visor CAD Vectorial 4K
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "#CBD5E1", lineHeight: 1.4, margin: 0 }}>
                            Inspección en terreno de planos arquitectónicos, esquemáticos eléctricos y mapas de infraestructura técnica sin internet.
                        </p>
                    </div>

                    <div style={{
                        padding: "16px", borderRadius: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)"
                    }}>
                        <div style={{ color: "#B388FF", fontWeight: 800, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span>💳</span> Economía Soberana P2P
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "#CBD5E1", lineHeight: 1.4, margin: 0 }}>
                            Billetera criptográfica offline con ledger inmutable DAG para intercambios comerciales de bienes y servicios sin bancos centrales.
                        </p>
                    </div>

                    <div style={{
                        padding: "16px", borderRadius: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(16px)"
                    }}>
                        <div style={{ color: "#38BDF8", fontWeight: 800, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span>🛰️</span> Pasarela Satelital LEO
                        </div>
                        <p style={{ fontSize: "0.82rem", color: "#CBD5E1", lineHeight: 1.4, margin: 0 }}>
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
            tagColor: "#00FF88",
            tagBorder: "rgba(0, 255, 136, 0.4)",
            tagBg: "rgba(0, 255, 136, 0.1)",
            renderContent: () => (
                <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center" }}>
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: "8px",
                        padding: "6px 16px", borderRadius: "9999px",
                        border: "1px solid rgba(0, 255, 136, 0.4)",
                        background: "rgba(0, 255, 136, 0.1)",
                        color: "#00FF88", fontSize: "12px", fontFamily: "JetBrains Mono, monospace"
                    }}>
                        VERIFICACIÓN EN HARDWARE REAL CERTIFICADA: MOTO G22 & TABLET LENOVO
                    </div>

                    <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 900, color: "#FFFFFF", lineHeight: 1.15, margin: 0 }}>
                        Construyamos la Red que Jamás Podrán Apagar
                    </h2>

                    <p style={{ fontSize: "1.05rem", color: "#CBD5E1", lineHeight: 1.6, fontWeight: 300, margin: 0 }}>
                        Ya seas un usuario individual que busca estar protegido ante emergencias, una brigada de rescate que necesita enlace táctico, o una comunidad que busca independencia digital: <strong>RED es tu infraestructura libre.</strong>
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "14px", paddingTop: "12px", width: "100%" }}>
                        <a
                            href={apkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                padding: "14px 28px", borderRadius: "14px",
                                background: "linear-gradient(135deg, #00FF88 0%, #00E5FF 100%)",
                                color: "#050B14", fontWeight: 900, fontSize: "14px",
                                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px",
                                boxShadow: "0 0 30px rgba(0, 255, 136, 0.35)", transition: "all 0.2s ease"
                            }}
                        >
                            <span>📲</span> Descargar APK Oficial v{RED_VERSION}
                        </a>
                        <a
                            href="https://github.com/DarckRovert/RED"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                padding: "14px 24px", borderRadius: "14px",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                background: "rgba(15, 23, 42, 0.8)",
                                color: "#FFFFFF", fontWeight: 800, fontSize: "14px",
                                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <span>⭐️</span> Ver Código Abierto en GitHub
                        </a>
                        <a
                            href={`${basePath}/`}
                            style={{
                                padding: "14px 22px", borderRadius: "14px",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                color: "#94A3B8", fontWeight: 600, fontSize: "14px",
                                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px",
                                transition: "all 0.2s ease"
                            }}
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
            style={{
                position: "fixed", inset: 0,
                backgroundColor: "#06070B",
                color: "#F8FAFC",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                overflow: "hidden", userSelect: "none",
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
            }}
        >
            {/* AMBIENT GLOWS */}
            <div style={{
                position: "absolute", top: 0, left: "20%",
                width: "400px", height: "400px",
                background: "rgba(0, 255, 136, 0.08)",
                borderRadius: "50%", filter: "blur(140px)",
                pointerEvents: "none"
            }} />
            <div style={{
                position: "absolute", bottom: 0, right: "20%",
                width: "400px", height: "400px",
                background: "rgba(0, 229, 255, 0.08)",
                borderRadius: "50%", filter: "blur(140px)",
                pointerEvents: "none"
            }} />

            {/* TOP BAR */}
            <header style={{
                position: "relative", zIndex: 20,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(6, 10, 18, 0.85)", backdropFilter: "blur(20px)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: "34px", height: "34px", borderRadius: "10px",
                        background: "rgba(232, 33, 58, 0.2)", border: "1px solid rgba(232, 33, 58, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, color: "#FF3355", fontFamily: "JetBrains Mono, monospace", fontSize: "16px"
                    }}>
                        R
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, color: "#FFFFFF", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                            RED — Sovereign Mesh OS
                            <span style={{
                                fontSize: "10px", fontFamily: "JetBrains Mono, monospace",
                                padding: "2px 8px", borderRadius: "6px",
                                background: "rgba(0, 255, 136, 0.12)", border: "1px solid rgba(0, 255, 136, 0.3)",
                                color: "#00FF88"
                            }}>
                                v{RED_VERSION}
                            </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }}>
                            PRESENTACIÓN EJECUTIVA • PITCH DECK
                        </div>
                    </div>
                </div>

                {/* SLIDE PILLS */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {slides.map((s, idx) => (
                        <button
                            key={s.id}
                            onClick={() => setCurrentSlide(idx)}
                            style={{
                                height: "6px",
                                width: idx === currentSlide ? "32px" : "8px",
                                borderRadius: "9999px",
                                background: idx === currentSlide ? "linear-gradient(90deg, #00FF88, #00E5FF)" : "rgba(255, 255, 255, 0.15)",
                                border: "none", cursor: "pointer",
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                padding: 0
                            }}
                            title={`Diapositiva ${s.id}: ${s.title}`}
                        />
                    ))}
                </div>

                {/* CONTROLS */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={toggleFullscreen}
                        style={{
                            padding: "6px 12px", borderRadius: "8px",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            background: "rgba(255, 255, 255, 0.05)",
                            color: "#CBD5E1", fontSize: "11px", fontFamily: "JetBrains Mono, monospace",
                            cursor: "pointer"
                        }}
                    >
                        {isFullscreen ? "Salir" : "Pantalla Completa [F]"}
                    </button>
                    <a
                        href={`${basePath}/`}
                        style={{
                            padding: "6px 14px", borderRadius: "8px",
                            border: "1px solid rgba(0, 229, 255, 0.35)",
                            background: "rgba(0, 229, 255, 0.12)",
                            color: "#00E5FF", fontSize: "11px", fontFamily: "JetBrains Mono, monospace",
                            fontWeight: 700, textDecoration: "none"
                        }}
                    >
                        ← Volver a la Web
                    </a>
                </div>
            </header>

            {/* STAGE */}
            <main style={{
                position: "relative", zIndex: 10, flex: 1,
                padding: "24px 32px", overflowY: "auto",
                display: "flex", flexDirection: "column", justifyContent: "center"
            }}>
                <div style={{ maxWidth: "1280px", margin: "0 auto", width: "100%" }}>
                    {/* SLIDE HEADER */}
                    <div style={{ marginBottom: "24px" }}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: "6px",
                            padding: "4px 12px", borderRadius: "9999px",
                            border: `1px solid ${slide.tagBorder}`,
                            background: slide.tagBg, color: slide.tagColor,
                            fontSize: "11px", fontFamily: "JetBrains Mono, monospace",
                            letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px"
                        }}>
                            {slide.tag}
                        </div>
                        <h2 style={{
                            fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", fontWeight: 900,
                            color: "#FFFFFF", letterSpacing: "-0.5px", margin: "0 0 6px 0"
                        }}>
                            {slide.title}
                        </h2>
                        <p style={{ fontSize: "1rem", color: "#94A3B8", margin: 0, maxWidth: "800px", fontWeight: 300, lineHeight: 1.5 }}>
                            {slide.subtitle}
                        </p>
                    </div>

                    {/* CONTENT */}
                    <div style={{ minHeight: "360px", display: "flex", alignItems: "center" }}>
                        {slide.renderContent(basePath)}
                    </div>
                </div>
            </main>

            {/* BOTTOM BAR */}
            <footer style={{
                position: "relative", zIndex: 20,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 24px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(6, 10, 18, 0.85)", backdropFilter: "blur(20px)"
            }}>
                <div style={{ fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: "#94A3B8", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ color: "#FFFFFF", fontWeight: 800, fontSize: "16px" }}>
                        0{slide.id} <span style={{ color: "#475569", fontWeight: 400 }}>/ 0{slides.length}</span>
                    </span>
                    <span style={{ color: "#334155" }}>|</span>
                    <span style={{ color: "#64748B" }}>Navegación: [←] [→] o [Espacio]</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                        onClick={prevSlide}
                        style={{
                            padding: "8px 18px", borderRadius: "10px",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            background: "rgba(255, 255, 255, 0.05)",
                            color: "#FFFFFF", fontSize: "13px", fontWeight: 700,
                            cursor: "pointer", transition: "all 0.15s ease"
                        }}
                    >
                        ← Anterior
                    </button>
                    <button
                        onClick={nextSlide}
                        style={{
                            padding: "8px 24px", borderRadius: "10px",
                            background: "linear-gradient(135deg, #00FF88 0%, #00E5FF 100%)",
                            color: "#050B14", fontSize: "13px", fontWeight: 900,
                            border: "none", cursor: "pointer",
                            boxShadow: "0 0 20px rgba(0, 255, 136, 0.25)",
                            transition: "all 0.15s ease"
                        }}
                    >
                        {currentSlide === slides.length - 1 ? "Reiniciar ↺" : "Siguiente →"}
                    </button>
                </div>
            </footer>
        </div>
    );
};
