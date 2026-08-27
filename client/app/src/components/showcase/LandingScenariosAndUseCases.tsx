'use client';

import React, { useState } from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';

export const LandingScenariosAndUseCases: React.FC = () => {
    const { t } = useTranslation();
    const [selectedScenario, setSelectedScenario] = useState<"mining" | "disasters" | "defense" | "drone_sat">("mining");

    const isGhPages = typeof window !== "undefined" && window.location.pathname.includes("/RED");
    const basePath = isGhPages ? "/RED" : "";

    const scenarios = [
        {
            id: "mining",
            tabLabel: "⛏️ Minería & Socavón",
            badge: "SECTOR MINERO, ENERGÍA & PETRÓLEO",
            title: "Comunicaciones Subterráneas donde el 4G y la Fibra son Inviables",
            description: "En interior de mina y frentes de avance subterráneos, las señales celulares no penetran la roca y la fibra óptica se rompe constantemente con las voladuras. RED despliega balizas mesh en las paredes de los túneles que retransmiten voz comprimida (Vocoder 1.6 kbps), telemetría de gases y alertas de derrumbe al puesto de mando.",
            imageSrc: `${basePath}/assets/red_scenario_mining.png`,
            imageAlt: "Mineros comunicándose en socavón con radios LoRa Mesh de RED",
            metrics: [
                { value: "0 ms", label: "Cero Dependencia de Fibra en Frentes de Avance" },
                { value: "1.6 kbps", label: "Voz Ultracomprimida por Radio LoRa" },
                { value: "100% Offline", label: "Monitoreo Ambiental de CO/Metano" }
            ],
            keyFeatures: [
                "Balizas repetidoras autónomas alimentadas por batería o iluminación",
                "Walkie-Talkie Push-To-Talk con altavoz manos libres para cuadrillas",
                "Alerta sísmica y de desprendimiento transmitida en milisegundos a todos los niveles",
                "Ahorro de hasta $150,000 USD frente a sistemas cableados de interior mina"
            ],
            accentColor: "#FFB300"
        },
        {
            id: "disasters",
            tabLabel: "🚨 Desastres & Terremotos (INDECI)",
            badge: "GESTIÓN DEL RIESGO DE DESASTRES & DEFENSA CIVIL",
            title: "Supervivencia y Rescate ante el Colapso Total de la Red Celular",
            description: "Tras un sismo de gran magnitud o tsunami, las antenas telefónicas colapsan por corte eléctrico y sobrecarga. RED convierte los teléfonos de los brigadistas y ciudadanos en una red de auxilio instantánea. Permite clasificar heridos mediante el protocolo de Triaje START y coordinar cuadrillas de rescate con la Brújula Táctica Off-Grid.",
            imageSrc: `${basePath}/assets/red_scenario_rescue.png`,
            imageAlt: "Brigadas de rescate e INDECI operando en apagón total con la malla RED",
            metrics: [
                { value: "Grado 8.5+", label: "Inmune a la Caída de la Red Eléctrica" },
                { value: "Triaje START", label: "Clasificación de Víctimas en Masa" },
                { value: "Resección", label: "Triangulación Topográfica sin GPS" }
            ],
            keyFeatures: [
                "Radar táctico con orientación solar y geodésica sin conexión a satélites",
                "Baliza SOS acústica ultrasónica para localizar personas atrapadas en escombros",
                "Censo y distribución de agua y víveres mediante libro mayor local",
                "Acreditación inmediata para compras de emergencia del Estado (Ley N° 30225)"
            ],
            accentColor: "#E8213A"
        },
        {
            id: "defense",
            tabLabel: "🛡️ Seguridad & Operaciones Tácticas",
            badge: "SEGURIDAD CIUDADANA, POLICÍA & OPERACIONES CRÍTICAS",
            title: "Cifrado Post-Cuántico sin Servidores Centrales ni Puertas Traseras",
            description: "En operaciones de custodia, inteligencia o patrullaje en zonas rojas, las comunicaciones celulares pueden ser intervenidas mediante antenas espía (IMSI-Catchers) o bloqueadores comerciales. RED utiliza criptografía cuántica NIST FIPS 203 y canales efímeros sin registro en ninguna compañía de telecomunicaciones.",
            imageSrc: `${basePath}/assets/red_hardware_ecosystem.png`,
            imageAlt: "Maletín táctico Pelican con transceptores LoRa y terminales cifrados",
            metrics: [
                { value: "ML-KEM-768", label: "Criptografía Post-Cuántica (Kyber)" },
                { value: "Zero-Logs", label: "Cero Registro en Servidores Centrales" },
                { value: "Camuflaje", label: "Disfraz Bajo Calculadora Funcional" }
            ],
            keyFeatures: [
                "Protocolo Double Ratchet: una llave criptográfica única por cada mensaje",
                "Botón de Pánico / Dead Man's Switch con borrado seguro e instantáneo",
                "Esteganografía acústica y visual para ocultar mensajes en sonidos o imágenes",
                "Canales cerrados de escuadrón con verificación biométrica local"
            ],
            accentColor: "#00E5FF"
        },
        {
            id: "drone_sat",
            tabLabel: "🛰️ Drones & Gateway Satelital",
            badge: "INNOVACIÓN DISRUPTIVA • REPETIDOR AÉREO Y SATÉLITE COMPARTIDO",
            title: "Extensión de Malla a 30+ km con Drones y Reparto de Internet Satelital",
            description: "En la geografía accidentada de los Andes o la Amazonía, un dron comercial equipado con un nodo RED vuela a 100m de altura actuando como torre repetidora aérea que conecta valles enteros. Además, un solo campamento con antena satelital (Starlink/Iridium) puede retransmitir datos vitales a cientos de usuarios en tierra vía LoRa sin costo adicional por terminal.",
            imageSrc: `${basePath}/assets/red_scenario_drone_sat.png`,
            imageAlt: "Dron táctico repetidor sobrevolando los Andes conectado a antena satelital",
            metrics: [
                { value: "30+ km", label: "Alcance con Dron Repetidor Aéreo" },
                { value: "1 Antena", label: "Satelital Compartida con Cientos de Nodos" },
                { value: "US915 MHz", label: "Banda Libre MTC (Cero Canon / Cero Licencia)" }
            ],
            keyFeatures: [
                "Nodos ligeros (menos de 45 gramos) montables en cualquier dron comercial",
                "Conexión de puestos de salud rurales aislados con hospitales regionales",
                "Transmisión de telemetría agrícola y sensores climáticos en tiempo real",
                "Pasarela transparente entre la malla terrestre y constelaciones satelitales LEO"
            ],
            accentColor: "#00E676"
        }
    ];

    const current = scenarios.find(s => s.id === selectedScenario) || scenarios[0];

    return (
        <section id="scenarios" style={{ padding: "70px 0 80px", position: "relative" }}>
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
                <span style={{
                    fontSize: "11px", padding: "5px 14px", borderRadius: "20px",
                    background: "rgba(255, 179, 0, 0.12)", color: "#FFB300",
                    border: "1px solid rgba(255, 179, 0, 0.3)",
                    fontFamily: "JetBrains Mono, monospace", fontWeight: 800, letterSpacing: "1px"
                }}>
                    DESPLIEGUE EN ESCENARIOS REALES • B2B & B2G
                </span>
                <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "12px", letterSpacing: "-0.5px" }}>
                    Resiliencia Extrema para Quienes No Pueden Fallar
                </h2>
                <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
                    Diseñado para industrias extractivas, cuerpos de rescate del Estado, seguridad táctica y comunidades aisladas donde la caída de internet cuesta vidas o millones de dólares.
                </p>
            </div>

            <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px" }}>
                {/* Scenario Selector Tabs */}
                <div style={{
                    display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center",
                    marginBottom: "28px"
                }}>
                    {scenarios.map(s => {
                        const isSelected = s.id === selectedScenario;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setSelectedScenario(s.id as any)}
                                style={{
                                    padding: "12px 22px", borderRadius: "14px",
                                    background: isSelected ? `${s.accentColor}22` : "rgba(14, 18, 30, 0.7)",
                                    border: isSelected ? `1.5px solid ${s.accentColor}` : "1px solid rgba(255, 255, 255, 0.08)",
                                    color: isSelected ? "#FFF" : "#94A3B8",
                                    fontSize: "14px", fontWeight: 800,
                                    cursor: "pointer",
                                    boxShadow: isSelected ? `0 6px 24px ${s.accentColor}30` : "none",
                                    transition: "all 0.2s ease"
                                }}
                            >
                                {s.tabLabel}
                            </button>
                        );
                    })}
                </div>

                {/* Scenario Presentation Card (Split 2 Columns: Details on Left, High-Res Visual on Right) */}
                <div style={{
                    background: "linear-gradient(180deg, rgba(14, 18, 34, 0.95) 0%, rgba(8, 10, 20, 0.98) 100%)",
                    border: `1.5px solid ${current.accentColor}55`,
                    borderRadius: "24px", padding: "36px",
                    backdropFilter: "blur(20px)",
                    boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${current.accentColor}15`,
                    display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "36px",
                    alignItems: "center"
                }} className="scenario-split-grid">
                    
                    {/* Left Column: Details & Bullets */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div>
                            <div style={{
                                display: "inline-block", fontSize: "11px", padding: "4px 12px",
                                borderRadius: "10px", background: `${current.accentColor}22`,
                                color: current.accentColor, fontWeight: 800,
                                fontFamily: "JetBrains Mono, monospace", marginBottom: "12px",
                                border: `1px solid ${current.accentColor}44`
                            }}>
                                {current.badge}
                            </div>
                            <h3 style={{ fontSize: "clamp(22px, 2.5vw, 28px)", fontWeight: 900, color: "#FFF", lineHeight: 1.25, marginBottom: "12px" }}>
                                {current.title}
                            </h3>
                            <p style={{ fontSize: "15px", color: "#CBD5E1", lineHeight: 1.7 }}>
                                {current.description}
                            </p>
                        </div>

                        {/* Metric Badges */}
                        <div style={{
                            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                            gap: "10px"
                        }}>
                            {current.metrics.map((m, mIdx) => (
                                <div key={mIdx} style={{
                                    background: "rgba(0,0,0,0.45)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: "14px", padding: "14px",
                                    textAlign: "center"
                                }}>
                                    <div style={{ fontSize: "18px", fontWeight: 900, color: current.accentColor, fontFamily: "JetBrains Mono, monospace" }}>
                                        {m.value}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px", fontWeight: 600 }}>
                                        {m.label}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bullet Points */}
                        <div style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: "14px", padding: "16px",
                            display: "flex", flexDirection: "column", gap: "8px"
                        }}>
                            {current.keyFeatures.map((feat, fIdx) => (
                                <div key={fIdx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "#E2E8F0" }}>
                                    <span style={{ color: current.accentColor, fontWeight: 900, fontSize: "14px" }}>✓</span>
                                    <span>{feat}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: High-Res Scenario Image */}
                    <div style={{
                        borderRadius: "20px", overflow: "hidden",
                        border: `1.5px solid ${current.accentColor}66`,
                        boxShadow: `0 15px 40px rgba(0,0,0,0.8), 0 0 30px ${current.accentColor}20`,
                        background: "rgba(0,0,0,0.6)"
                    }}>
                        <img
                            src={current.imageSrc}
                            alt={current.imageAlt}
                            style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }}
                            onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};
