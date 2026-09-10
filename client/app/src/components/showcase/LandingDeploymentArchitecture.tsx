'use client';

import React, { useState } from 'react';

interface DeploymentTab {
    id: string;
    label: string;
    icon: string;
    title: string;
    subtitle: string;
    diagram: React.ReactNode;
    techDetails: { title: string; desc: string; badge: string }[];
    billOfMaterials?: { component: string; cost: string; purpose: string }[];
}

interface LandingDeploymentArchitectureProps {
    handleCopy: (text: string) => void;
    copiedText: string | null;
}

export const LandingDeploymentArchitecture: React.FC<LandingDeploymentArchitectureProps> = ({
    handleCopy,
    copiedText
}) => {
    const isGhPages = typeof window !== 'undefined' && window.location.pathname.includes('/RED');
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (isGhPages ? '/RED' : '');
    const [activeTab, setActiveTab] = useState<string>('radio-layers');

    const deploymentTabs: DeploymentTab[] = [
        {
            id: 'radio-layers',
            label: 'Capas de Radio Multi-Frecuencia',
            icon: '📡',
            title: 'Topología Híbrida de 4 Capas Físicas de Radio',
            subtitle: 'Conmutación dinámica y tolerante a fallos: si una banda es interferida o bloqueada, el tráfico se redirige automáticamente.',
            diagram: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
                    {/* Layer 4: LoRa Long Range */}
                    <div
                        style={{
                            padding: '16px 20px',
                            borderRadius: '14px',
                            background: 'rgba(0, 229, 255, 0.08)',
                            border: '1.5px solid rgba(0, 229, 255, 0.35)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}
                    >
                        <div>
                            <div style={{ fontSize: '11px', color: '#00E5FF', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                                CAPA 4 • LARGO ALCANCE TÁCTICO (1 – 25+ KM)
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: '#FFF', marginTop: '2px' }}>
                                Semtech SX1262 LoRa (US915 / EU868 / 433MHz)
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '2px' }}>
                                Puertos dedicados: Puerto 64 (Voz Vocoder 1.2 kbps) y Puerto 65 (Tramas Post-Cuánticas ML-KEM).
                            </div>
                        </div>
                        <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(0, 229, 255, 0.2)', color: '#00E5FF', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                            SF7-SF12 • 22 dBm TX
                        </span>
                    </div>

                    {/* Layer 3: Wi-Fi Direct P2P */}
                    <div
                        style={{
                            padding: '16px 20px',
                            borderRadius: '14px',
                            background: 'rgba(0, 230, 118, 0.08)',
                            border: '1.5px solid rgba(0, 230, 118, 0.35)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}
                    >
                        <div>
                            <div style={{ fontSize: '11px', color: '#00E676', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                                CAPA 3 • BANDA ANCHA DE ESCUADRÓN (0 – 120 METROS)
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: '#FFF', marginTop: '2px' }}>
                                Wi-Fi Direct P2P / 802.11ac Ad-Hoc
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '2px' }}>
                                Transferencia de mapas vectoriales, video táctico H.264 WebRTC y distribución de APK de nodo a nodo.
                            </div>
                        </div>
                        <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(0, 230, 118, 0.2)', color: '#00E676', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                            Hasta 54 Mbps • Zero Router
                        </span>
                    </div>

                    {/* Layer 2: BLE Mesh */}
                    <div
                        style={{
                            padding: '16px 20px',
                            borderRadius: '14px',
                            background: 'rgba(192, 132, 252, 0.08)',
                            border: '1.5px solid rgba(192, 132, 252, 0.35)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}
                    >
                        <div>
                            <div style={{ fontSize: '11px', color: '#C084FC', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                                CAPA 2 • PROXIMIDAD PERPETUA DE BAJO CONSUMO (0 – 40 METROS)
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: '#FFF', marginTop: '2px' }}>
                                Bluetooth 5.0+ LE (Servidor GATT Concurrente)
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '2px' }}>
                                Balizas de descubrimiento ciego HMAC, telemetría de pulso cardíaco y sincronización Gossipsub en reposo.
                            </div>
                        </div>
                        <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(192, 132, 252, 0.2)', color: '#C084FC', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                            ~2.5 mA • KineticDutyGovernor
                        </span>
                    </div>

                    {/* Layer 1: SoundMesh Ultrasonic */}
                    <div
                        style={{
                            padding: '16px 20px',
                            borderRadius: '14px',
                            background: 'rgba(255, 179, 0, 0.08)',
                            border: '1.5px solid rgba(255, 179, 0, 0.35)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}
                    >
                        <div>
                            <div style={{ fontSize: '11px', color: '#FFB300', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                                CAPA 1 • CANAL ACÚSTICO DE MÁXIMO AISLAMIENTO (0 – 15 METROS)
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: '#FFF', marginTop: '2px' }}>
                                SoundMesh Ultrasonido FSK (18.5 – 20.5 kHz)
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '2px' }}>
                                Inmune a interferencias electromagnéticas (EW) y utilizable en jaulas de Faraday o búnkeres subterráneos.
                            </div>
                        </div>
                        <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(255, 179, 0, 0.2)', color: '#FFB300', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                            WebAudio DSP • Cero RF
                        </span>
                    </div>
                </div>
            ),
            techDetails: [
                {
                    title: 'Failover Autónomo Multi-Radio',
                    desc: 'El árbitro de enlace (Cognitive Arbiter) evalúa la tasa de pérdida de paquetes y la varianza de ruido. Si el canal BLE sufre saturación, conmuta las tramas a LoRa o Ultrasonido en menos de 80ms.',
                    badge: 'Auto-Failover'
                },
                {
                    title: 'Deduplicación de Tramas por Hash BLAKE3',
                    desc: 'Cada paquete que ingresa por cualquiera de las 4 interfaces físicas es indexado en un filtro Bloom con ventana de 72 horas. Se evitan bucles de retransmisión incluso con topologías circulares complejas.',
                    badge: 'Zero Broadcast Storm'
                },
                {
                    title: 'Gobernador Cinemático de Energía',
                    desc: 'KineticDutyGovernor modula la frecuencia de escaneo y emisión según los sensores inerciales del operador: en reposo nocturno reduce el consumo hasta en un 82%.',
                    badge: 'Kinetic Energy'
                }
            ]
        },
        {
            id: 'solar-repeater',
            label: 'Repetidor Solar de Cresta ($35 USD)',
            icon: '☀️',
            title: 'Nodo Repetidor Autónomo Solar de Ultra-Bajo Costo',
            subtitle: 'Despliegue permanente en cimas montañosas, torres de vigilancia o techos comunales para cubrir radios de hasta 40 km.',
            diagram: (
                <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(6, 10, 20, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', textAlign: 'center' }}>
                        <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255, 179, 0, 0.1)', border: '1px solid rgba(255, 179, 0, 0.3)' }}>
                            <div style={{ fontSize: '24px' }}>☀️</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#FFB300', marginTop: '6px' }}>Panel Solar Monocristalino</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>5V / 5W IP67 Resistente a Intemperie</div>
                        </div>
                        <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.3)' }}>
                            <div style={{ fontSize: '24px' }}>🔋</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', marginTop: '6px' }}>Batería LiFePO4 / 18650</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>3.7V 3500mAh (7 días de autonomía sin sol)</div>
                        </div>
                        <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)' }}>
                            <div style={{ fontSize: '24px' }}>📻</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#00E5FF', marginTop: '6px' }}>Placa Heltec V3 / RAK4631</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Semtech SX1262 LoRa + MCU ESP32-S3</div>
                        </div>
                        <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(192, 132, 252, 0.1)', border: '1px solid rgba(192, 132, 252, 0.3)' }}>
                            <div style={{ fontSize: '24px' }}>📡</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#C084FC', marginTop: '6px' }}>Antena Omnidireccional</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Fibra de vidrio 5.8 dBi sintonizada a 915MHz</div>
                        </div>
                    </div>
                </div>
            ),
            billOfMaterials: [
                { component: 'Módulo Heltec WiFi LoRa 32 V3 (ESP32-S3 + SX1262)', cost: '~$19 USD', purpose: 'Núcleo de procesamiento y radio LoRa 915MHz' },
                { component: 'Celda Li-Ion 18650 3500mAh con circuito BMS', cost: '~$4 USD', purpose: 'Almacenamiento de energía continuo día y noche' },
                { component: 'Panel Solar Mini 5V 5W Monocristalino', cost: '~$6 USD', purpose: 'Recarga pasiva diurna continua' },
                { component: 'Caja Estanca IP67 + Conector Antena SMA', cost: '~$6 USD', purpose: 'Blindaje climático contra lluvia, polvo y radiación UV' }
            ],
            techDetails: [
                {
                    title: 'Operación Desatendida Zero-Mantenimiento',
                    desc: 'El microcontrolador ESP32-S3 ejecuta el firmware repetidor autónomo RED Mesh. Entra en suspensión profunda (deep sleep) entre ráfagas de paquetes, manteniendo un consumo medio inferior a 12 mA.',
                    badge: 'Zero Maintenance'
                },
                {
                    title: 'Proof-of-Relay Criptográfico',
                    desc: 'El nodo repetidor firma cada paquete que retransmite con su clave Ed25519 embebida en hardware, acumulando prueba de servicio para el esquema de recompensas DePIN de la red.',
                    badge: 'Proof-of-Relay'
                }
            ]
        },
        {
            id: 'airgap-companion',
            label: 'Web Companion & Air-Gap Sync',
            icon: '💻',
            title: 'Terminal de Puesto de Mando en Computadora sin Conexión',
            subtitle: 'Conecta cualquier PC, laptop o terminal Linux al enjambre móvil mediante WebRTC local o Web Bluetooth directo.',
            diagram: (
                <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(6, 10, 20, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '32px' }}>📱</div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#00E5FF' }}>Dispositivo RED Android</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Bóveda TEE + Radios Físicas</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <div style={{ fontSize: '11px', color: '#00E676', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                                ⚡ Túnel WebRTC P2P Directo / Web Bluetooth
                            </div>
                            <div style={{ width: '180px', height: '2px', background: 'linear-gradient(90deg, #00E5FF 0%, #00E676 100%)' }} />
                            <div style={{ fontSize: '10.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                Cifrado AES-256-GCM + Handshake QR
                            </div>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '32px' }}>💻</div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#00E676' }}>Laptop / Puesto C4ISR</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Navegador Web Air-Gapped</div>
                        </div>
                    </div>
                </div>
            ),
            techDetails: [
                {
                    title: 'Cero Instalación de Software en la PC',
                    desc: 'Cualquier computadora con navegador moderno (Chrome, Edge, Firefox, Brave) se convierte en estación C4ISR con mapa de pantalla gigante y gestión de escuadrón abriendo el archivo HTML sin internet.',
                    badge: 'Zero-Install'
                },
                {
                    title: 'Emparejamiento por QR Criptográfico',
                    desc: 'La laptop genera un código QR efímero que contiene una clave pública de sesión y candidatos ICE locales. La cámara del celular lo escanea y el enlace se establece en menos de 2 segundos.',
                    badge: 'Local WebRTC'
                },
                {
                    title: 'Aislamiento Estricto de Bóvedas',
                    desc: 'Las claves privadas maestras nunca abandonan el chip TEE del teléfono Android. La computadora actúa únicamente como terminal de visualización y comando autenticado.',
                    badge: 'TEE Keystore Protected'
                }
            ]
        },
        {
            id: 'p2p-distribution',
            label: 'Distribución Viral del APK (Sneakernet)',
            icon: '📲',
            title: 'Propagación de Nodo a Nodo sin Internet ni Google Play',
            subtitle: 'En un apagón de telecomunicaciones, la aplicación se propaga de celular en celular utilizando los propios teléfonos de la comunidad.',
            diagram: (
                <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(6, 10, 20, 0.9)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                        <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.25)' }}>
                            <div style={{ fontSize: '18px' }}>📡</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#00E5FF', marginTop: '4px' }}>Servidor HTTP Embebido</div>
                            <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '4px' }}>
                                El teléfono crea un Hotspot Wi-Fi local. Los demás usuarios abren <code style={{ color: '#00FF88' }}>http://192.168.43.1:8080</code> en su navegador y descargan el APK instantáneamente.
                            </div>
                        </div>
                        <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.25)' }}>
                            <div style={{ fontSize: '18px' }}>📳</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#00E676', marginTop: '4px' }}>Bluetooth APK Share</div>
                            <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '4px' }}>
                                Envío nativo mediante perfil Bluetooth OPP (Object Push Profile) directo a teléfonos cercanos sin requerir Wi-Fi ni emparejamiento previo.
                            </div>
                        </div>
                        <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(192, 132, 252, 0.1)', border: '1px solid rgba(192, 132, 252, 0.25)' }}>
                            <div style={{ fontSize: '18px' }}>💾</div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#C084FC', marginTop: '4px' }}>Memoria USB OTG / MicroSD</div>
                            <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '4px' }}>
                                El binario compilado de RED OS ocupa menos de 28 MB y puede ser distribuido masivamente en memorias flash USB o tarjetas microSD de rescate.
                            </div>
                        </div>
                    </div>
                </div>
            ),
            techDetails: [
                {
                    title: 'Verificación Criptográfica de Integridad',
                    desc: 'Cada APK distribuido incluye la firma digital del desarrollador y su hash SHA-256 publicado en la micro-cadena. Android verifica automáticamente la clave de firma antes de permitir la instalación.',
                    badge: 'v2/v3 Signature'
                },
                {
                    title: 'Actualizaciones Binarias P2P (OTA)',
                    desc: 'Cuando un nodo conectado a internet recibe una versión más reciente, la fragmenta en bloques de 32 KB y la propaga por Gossipsub a los nodos desconectados del enjambre.',
                    badge: 'Mesh OTA'
                }
            ]
        }
    ];

    const currentTab = deploymentTabs.find((t) => t.id === activeTab) || deploymentTabs[0];

    return (
        <section id="deployment" style={{ padding: '75px 0 70px', position: 'relative' }}>
            <div style={{ textAlign: 'center', marginBottom: '38px' }}>
                <span
                    style={{
                        fontSize: '11px',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        background: 'rgba(0, 230, 118, 0.12)',
                        color: '#00E676',
                        border: '1px solid rgba(0, 230, 118, 0.35)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 800,
                        letterSpacing: '1.2px'
                    }}
                >
                    ARQUITECTURA DE DESPLIEGUE REAL EN CAMPO • GUÍA DE INFRAESTRUCTURA
                </span>
                <h2
                    style={{
                        fontSize: 'clamp(28px, 4.2vw, 42px)',
                        fontWeight: 900,
                        color: '#FFF',
                        marginTop: '14px',
                        marginBottom: '12px',
                        letterSpacing: '-0.6px'
                    }}
                >
                    Topología & Despliegue Off-Grid
                </h2>
                <p
                    style={{
                        fontSize: '16px',
                        color: '#94A3B8',
                        maxWidth: '860px',
                        margin: '0 auto',
                        lineHeight: 1.65
                    }}
                >
                    Cómo implementar y sostener una red soberana de comunicaciones tácticas durante catástrofes naturales, apagones masivos o censura gubernamental sin depender de antenas celulares ni infraestructura centralizada.
                </p>
            </div>

            <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '0 16px' }}>
                {/* Navigation Pills for Deployment Modes */}
                <div
                    style={{
                        display: 'flex',
                        gap: '10px',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        marginBottom: '32px'
                    }}
                >
                    {deploymentTabs.map((tab) => {
                        const isActive = tab.id === activeTab;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '16px',
                                    fontSize: '13px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    fontFamily: 'Inter, sans-serif',
                                    border: isActive ? '1.5px solid #00E676' : '1px solid rgba(255, 255, 255, 0.08)',
                                    background: isActive ? 'rgba(0, 230, 118, 0.2)' : 'rgba(14, 18, 34, 0.75)',
                                    color: isActive ? '#FFF' : '#94A3B8',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Main Content Card */}
                <div
                    style={{
                        padding: 'clamp(24px, 3.5vw, 40px)',
                        borderRadius: '24px',
                        background: 'linear-gradient(145deg, rgba(14, 20, 36, 0.95) 0%, rgba(8, 12, 22, 0.98) 100%)',
                        border: '1.5px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 25px 80px rgba(0, 0, 0, 0.75)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '28px'
                    }}
                >
                    <div>
                        <h3 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 900, color: '#FFF', marginBottom: '8px' }}>
                            {currentTab.title}
                        </h3>
                        <p style={{ fontSize: '15px', color: '#94A3B8', lineHeight: 1.6, maxWidth: '900px' }}>
                            {currentTab.subtitle}
                        </p>
                    </div>

                    {/* Interactive Diagram / Schematic Box */}
                    {currentTab.diagram}

                    {/* Bill of Materials (If tab is solar repeater) */}
                    {currentTab.billOfMaterials && (
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#FFB300', fontFamily: 'JetBrains Mono, monospace', marginBottom: '12px' }}>
                                LISTA DE MATERIALES (BOM) ESTIMADA PARA REPETIDOR DE $35 USD:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                                {currentTab.billOfMaterials.map((bom, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: '14px',
                                            borderRadius: '12px',
                                            background: 'rgba(0, 0, 0, 0.4)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFF' }}>{bom.component}</span>
                                            <span style={{ fontSize: '12px', color: '#00E676', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>{bom.cost}</span>
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{bom.purpose}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Technical Features Grid */}
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#00E5FF', fontFamily: 'JetBrains Mono, monospace', marginBottom: '12px' }}>
                            ESPECIFICACIONES Y GARANTÍAS DE RESILIENCIA:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                            {currentTab.techDetails.map((tech, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        padding: '18px',
                                        borderRadius: '14px',
                                        background: 'rgba(6, 10, 18, 0.65)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#FFF' }}>
                                            {tech.title}
                                        </div>
                                        <span
                                            style={{
                                                fontSize: '10px',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                background: 'rgba(0, 229, 255, 0.15)',
                                                color: '#00E5FF',
                                                fontFamily: 'JetBrains Mono, monospace',
                                                fontWeight: 700
                                            }}
                                        >
                                            {tech.badge}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.55 }}>
                                        {tech.desc}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
