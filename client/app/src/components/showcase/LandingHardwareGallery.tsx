'use client';

import React, { useState } from 'react';

interface HardwareItem {
    id: string;
    name: string;
    role: string;
    model: string;
    adbSerial: string;
    androidVer: string;
    arch: string;
    radios: string[];
    batteryRuntime: string;
    sensors: string[];
    imageSrc: string;
    badge: string;
    badgeColor: string;
    description: string;
    fieldNotes: string[];
    tacticalSpecs: { label: string; value: string }[];
}

interface LandingHardwareGalleryProps {
    onEnterApp: () => void;
}

export const LandingHardwareGallery: React.FC<LandingHardwareGalleryProps> = ({ onEnterApp }) => {
    const isGhPages = typeof window !== 'undefined' && window.location.pathname.includes('/RED');
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (isGhPages ? '/RED' : '');
    const [activeTab, setActiveTab] = useState<string>('moto-g22');
    const [isZoomed, setIsZoomed] = useState<boolean>(false);

    const hardwareItems: HardwareItem[] = [
        {
            id: 'moto-g22',
            name: 'Motorola Moto G22 (hawaiip)',
            role: 'Nodo Táctico Individual & Triaje START / rPPG',
            model: 'Motorola hawaiip_g (XT2231-5)',
            adbSerial: 'ZT322B386P',
            androidVer: 'Android 12 (Kernel Linux 4.19)',
            arch: 'ARM64-v8a (MediaTek Helio G37)',
            radios: ['BLE 5.0 GATT Server', 'Wi-Fi Direct P2P', 'SoundMesh Acústico FSK', 'LoRa SX1262 (OTG/BLE)'],
            batteryRuntime: '48h continuo (KineticDutyGovernor activo)',
            sensors: ['Cámara CMOS 50MP (Dosímetro Gamma)', 'Acelerómetro Triaxial', 'Magnetómetro 3D', 'Giroscopio Táctico'],
            imageSrc: `${basePath}/assets/moto_g22_live.png`,
            badge: 'CERTIFICADO EN CAMPO',
            badgeColor: '#00E5FF',
            description: 'Terminal de patrulla individual optimizado para bajo peso y máxima autonomía. Ejecuta el motor criptográfico Post-Cuántico ML-KEM-768 y procesa fotopletismografía remota (rPPG) por cámara para clasificar heridos en catástrofes en menos de 15 segundos sin tocar al paciente.',
            fieldNotes: [
                'Captura óptica directa de pulso cardíaco mediante canal verde FFT en sensor de cámara.',
                'Navegación PDR (Pedestrian Dead Reckoning) que estima pasos y azimut en túneles sin GNSS.',
                'Atenuación térmica pasiva: consumo de radio modulado por el acelerómetro cuando el operador está estático.'
            ],
            tacticalSpecs: [
                { label: 'Identificador ADB', value: 'ZT322B386P' },
                { label: 'Resolución de Pantalla', value: '720 x 1600 px (90Hz Max)' },
                { label: 'Bóveda Criptográfica', value: 'Android Keystore TEE + Sled DB' },
                { label: 'Modo Sigilo', value: 'DEFCON 1 (MAC BLE rotativa cada 15m)' }
            ]
        },
        {
            id: 'lenovo-tab-m8',
            name: 'Lenovo Tab M8 HD (TB305XU)',
            role: 'Puesto de Mando C4ISR & Coordinador de Malla',
            model: 'Lenovo Tab M8 (4ta Gen TB305XU)',
            adbSerial: 'HA2CHKZ2',
            androidVer: 'Android 12 Go Edition',
            arch: 'ARM64-v8a (MediaTek Helio A22)',
            radios: ['BLE 5.0 Multilink', 'Wi-Fi 802.11ac Ad-Hoc', 'LoRa 915MHz Bridge', 'WebRTC DataChannel'],
            batteryRuntime: '72h en modo base C4ISR con display dinámico',
            sensors: ['Acelerómetro', 'Sensor de Luz Ambiental', 'GPS / GLONASS / Galileo GNSS'],
            imageSrc: `${basePath}/assets/lenovo_tab_m8_live.png`,
            badge: 'PUESTO DE MANDO C4ISR',
            badgeColor: '#00FF88',
            description: 'Centro táctico de operaciones desplegado en vehículos ligeros, carpas de triaje o puestos de socorro. Proyecta en pantalla amplia el mapa de calor de nodos amigos (Blue-Force Tracking), enruta paquetes entre sub-redes aisladas y coordina evacuaciones con simbología militar OTAN MIL-STD-2525D.',
            fieldNotes: [
                'Coordinador Gossipsub que deduplica tramas multi-salto y almacena búferes DTN para retransmisión.',
                'Interoperabilidad nativa con ATAK/CivTAK mediante puerto CoT XML broadcast.',
                'Capacidad de enlace con servidor satelital o repetidor solar LoRa de cresta montañosa.'
            ],
            tacticalSpecs: [
                { label: 'Identificador ADB', value: 'HA2CHKZ2' },
                { label: 'Resolución de Pantalla', value: '1340 x 800 px Wide HD' },
                { label: 'Capacidad de Enlace', value: 'Hasta 64 pares concurrentes directos' },
                { label: 'Ruta C4ISR', value: 'Kademlia DHT XOR + Sneakernet Relay' }
            ]
        },
        {
            id: 'tactical-cone',
            name: 'Mapa Táctico C4ISR (Lenovo Tab M8)',
            role: 'Cartografía Operacional & Blue-Force Tracking',
            model: 'Matriz C4ISR sobre Lenovo Tab M8 (TB305XU)',
            adbSerial: 'C4ISR-TABLET',
            androidVer: 'Android 12 Go Edition',
            arch: 'ARM64-v8a • C4ISR Core',
            radios: ['GNSS Satelital Multicanal', 'CoT v2.0 UDP', 'PDR Engine', 'Mesh Waypoints'],
            batteryRuntime: 'Autonomía base C4ISR extendida',
            sensors: ['GPS / GLONASS / Galileo', 'Filtro Kalman Vectorial', 'Cartografía Offline'],
            imageSrc: `${basePath}/assets/tactical_map_cone.png`,
            badge: 'C4ISR BLUE-FORCE',
            badgeColor: '#00E5FF',
            description: 'Captura en vivo del Centro de Comando C4ISR en la tablet Lenovo Tab M8: visualización cartográfica vectorial sin internet, fijación de coordenadas en tiempo real (-12.13828, -76.98291), cono azimutal dinámico, interoperabilidad ATAK CoT y marcado de SITREPs.',
            fieldNotes: [
                'Proyección de vector de rumbo azimutal de 45° con orientación continua en la cartografía.',
                'Marcado de puntos tácticos seleccionados, waypoints de patrulla y fijación de objetivos.',
                'Matriz operativa de 57 módulos con acceso directo a Ecosonda, CoT y Sismógrafo.'
            ],
            tacticalSpecs: [
                { label: 'Fijación Satelital', value: 'GPS FIJADO (±20m) • En tiempo real' },
                { label: 'Topología Malla', value: '1 Nodo Activo • Malla Swarm en vivo' },
                { label: 'Interoperabilidad', value: 'ATAK CoT v2.0 XML + PDR Inercial' },
                { label: 'Nivel DEFCON', value: 'DEFCON 5 (Operacional Normal)' }
            ]
        },
        {
            id: 'pdr-dead-reckoning',
            name: 'Navegación Inercial PDR (Moto G22)',
            role: 'Estimación de Pasos en Túneles sin GNSS',
            model: 'Motor PDR Activo sobre Motorola Moto G22',
            adbSerial: 'PDR-HAWAIIP',
            androidVer: 'Capa HAL Sensores Nativos',
            arch: 'Inertial Dead-Reckoning',
            radios: ['Magnetómetro Triaxial', 'Acelerómetro Gravedad', 'Brújula Tilt-Compensated'],
            batteryRuntime: 'Consumo residual < 1.4% por hora de navegación',
            sensors: ['Magnetómetro 3D', 'Acelerómetro Zancadas', 'Sensor Fusion 50Hz'],
            imageSrc: `${basePath}/assets/swarm_health_hud.png`,
            badge: 'PDR DEAD-RECKONING',
            badgeColor: '#FFB300',
            description: 'Captura en vivo del motor Pedestrian Dead-Reckoning (PDR) operando en el Motorola Moto G22: fusión inercial del sensor magnético y acelerómetro para navegación bajo tierra, edificios colapsados o interferencias de guerra electrónica sin satélites.',
            fieldNotes: [
                'Detección de zancadas y estimación de distancia caminada en tiempo real.',
                'Retención del azimut cinemático al detenerse para evitar oscilaciones en la aguja de rumbo.',
                'Orientación azimutal continua con aguja táctica naranja proyectada en el mapa.'
            ],
            tacticalSpecs: [
                { label: 'Estado Motor PDR', value: 'PDR INERCIAL ACTIVO (0 Pasos iniciales)' },
                { label: 'Frecuencia de Muestreo', value: '50 Hz (SensorManager.SENSOR_DELAY_GAME)' },
                { label: 'Aguja de Rumbo', value: 'Vector Azimutal Dinámico 0° a 360°' },
                { label: 'Fusión de Sensores', value: 'Kalman / Complementary Filter ponderado' }
            ]
        }
    ];

    const currentItem = hardwareItems.find((i) => i.id === activeTab) || hardwareItems[0];

    return (
        <section id="hardware" style={{ padding: '80px 0 70px', position: 'relative' }}>
            {/* Header / Title */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <span
                    style={{
                        fontSize: '11px',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        background: 'rgba(0, 229, 255, 0.12)',
                        color: '#00E5FF',
                        border: '1px solid rgba(0, 229, 255, 0.35)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 800,
                        letterSpacing: '1.2px'
                    }}
                >
                    GALERÍA DE HARDWARE FÍSICO CERTIFICADO • OPERACIÓN EN VIVO
                </span>
                <h2
                    style={{
                        fontSize: 'clamp(28px, 4.2vw, 44px)',
                        fontWeight: 900,
                        color: '#FFF',
                        marginTop: '16px',
                        marginBottom: '14px',
                        letterSpacing: '-0.8px'
                    }}
                >
                    Validación Empírica en Silicio Real
                </h2>
                <p
                    style={{
                        fontSize: '16px',
                        color: '#94A3B8',
                        maxWidth: '840px',
                        margin: '0 auto',
                        lineHeight: 1.65
                    }}
                >
                    RED OS no es un concepto teórico ni una maqueta digital. El sistema opera de forma nativa sobre hardware comercial de bajo costo y alta disponibilidad, garantizando despliegues soberanos accesibles para cualquier brigada de rescate o comunidad off-grid.
                </p>
            </div>

            {/* Interactive Tabs */}
            <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '0 16px' }}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '12px',
                        marginBottom: '32px'
                    }}
                >
                    {hardwareItems.map((item) => {
                        const isActive = item.id === activeTab;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id);
                                    setIsZoomed(false);
                                }}
                                style={{
                                    padding: '16px 18px',
                                    borderRadius: '16px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontFamily: 'Inter, sans-serif',
                                    border: isActive
                                        ? `1.5px solid ${item.badgeColor}`
                                        : '1px solid rgba(255, 255, 255, 0.08)',
                                    background: isActive
                                        ? `linear-gradient(135deg, rgba(14, 22, 40, 0.95) 0%, rgba(6, 12, 24, 0.98) 100%)`
                                        : 'rgba(12, 16, 30, 0.65)',
                                    boxShadow: isActive
                                        ? `0 10px 30px ${item.badgeColor}25, inset 0 0 20px ${item.badgeColor}15`
                                        : 'none',
                                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span
                                        style={{
                                            fontSize: '10px',
                                            fontWeight: 800,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            color: item.badgeColor,
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            background: `${item.badgeColor}18`
                                        }}
                                    >
                                        {item.badge}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: '10px',
                                            color: '#64748B',
                                            fontFamily: 'JetBrains Mono, monospace'
                                        }}
                                    >
                                        {item.adbSerial}
                                    </span>
                                </div>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: isActive ? '#FFF' : '#CBD5E1' }}>
                                    {item.name.split('(')[0]}
                                </div>
                                <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.4 }}>
                                    {item.role.split('&')[0]}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Main Showcase Device Panel */}
                <div
                    style={{
                        borderRadius: '24px',
                        background: 'linear-gradient(145deg, rgba(14, 20, 36, 0.95) 0%, rgba(8, 12, 22, 0.98) 100%)',
                        border: '1.5px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 25px 80px rgba(0, 0, 0, 0.75)',
                        overflow: 'hidden',
                        padding: 'clamp(20px, 3.5vw, 36px)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                        gap: '36px',
                        alignItems: 'center'
                    }}
                >
                    {/* Left Column: Device Screenshot with Tactical HUD Frame */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div
                            style={{
                                position: 'relative',
                                width: '100%',
                                maxWidth: currentItem.id === 'lenovo-tab-m8' || currentItem.id === 'swarm-telemetry' ? '560px' : '360px',
                                borderRadius: '20px',
                                padding: '12px',
                                background: 'rgba(4, 6, 12, 0.85)',
                                border: `1.5px solid ${currentItem.badgeColor}40`,
                                boxShadow: `0 0 35px ${currentItem.badgeColor}18`,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                            onClick={() => setIsZoomed(!isZoomed)}
                            title="Click para ampliar captura"
                        >
                            {/* Device Top Status Bar Simulation */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '6px 10px',
                                    marginBottom: '8px',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                    fontSize: '11px',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    color: '#94A3B8'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: '#00E676',
                                            boxShadow: '0 0 8px #00E676'
                                        }}
                                    />
                                    ADB: {currentItem.adbSerial}
                                </span>
                                <span style={{ color: currentItem.badgeColor, fontWeight: 700 }}>
                                    LIVE CAPTURE • {currentItem.arch.split(' ')[0]}
                                </span>
                            </div>

                            {/* Live Screenshot Image */}
                            <div
                                style={{
                                    position: 'relative',
                                    overflow: 'hidden',
                                    borderRadius: '14px',
                                    background: '#000',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    maxHeight: isZoomed ? '700px' : '460px',
                                    transition: 'max-height 0.3s ease'
                                }}
                            >
                                <img
                                    src={currentItem.imageSrc}
                                    alt={`Captura real en ${currentItem.name}`}
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        maxHeight: isZoomed ? '700px' : '460px',
                                        objectFit: 'contain',
                                        display: 'block'
                                    }}
                                    onError={(e) => {
                                        // Fallback if image path is not yet ready
                                        (e.target as HTMLElement).style.display = 'none';
                                    }}
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        right: '8px',
                                        fontSize: '10px',
                                        background: 'rgba(0, 0, 0, 0.75)',
                                        color: '#FFF',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontFamily: 'JetBrains Mono, monospace'
                                    }}
                                >
                                    {isZoomed ? '🔍 Reducir' : '🔍 Click para Zoom'}
                                </div>
                            </div>
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
                            Captura directa sin edición vía <code style={{ color: '#00E5FF' }}>adb exec-out screencap -p</code> sobre dispositivo físico.
                        </div>
                    </div>

                    {/* Right Column: Device Specifications & Field Evaluation */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <span
                                    style={{
                                        fontSize: '11px',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        background: `${currentItem.badgeColor}20`,
                                        color: currentItem.badgeColor,
                                        fontWeight: 800,
                                        fontFamily: 'JetBrains Mono, monospace'
                                    }}
                                >
                                    {currentItem.badge}
                                </span>
                                <span style={{ fontSize: '13px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                                    {currentItem.model}
                                </span>
                            </div>
                            <h3 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 900, color: '#FFF', marginBottom: '10px' }}>
                                {currentItem.name}
                            </h3>
                            <p style={{ fontSize: '15px', color: '#CBD5E1', lineHeight: 1.65 }}>
                                {currentItem.description}
                            </p>
                        </div>

                        {/* Tactical Specs Grid */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: '12px',
                                padding: '16px',
                                borderRadius: '16px',
                                background: 'rgba(6, 10, 18, 0.7)',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                            }}
                        >
                            {currentItem.tacticalSpecs.map((spec, idx) => (
                                <div key={idx}>
                                    <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {spec.label}
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#E2E8F0', marginTop: '3px' }}>
                                        {spec.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Field Notes List */}
                        <div>
                            <div
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 800,
                                    color: currentItem.badgeColor,
                                    fontFamily: 'JetBrains Mono, monospace',
                                    marginBottom: '8px'
                                }}
                            >
                                NOTAS OPERATIVAS DE CERTIFICACIÓN:
                            </div>
                            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {currentItem.fieldNotes.map((note, idx) => (
                                    <li key={idx} style={{ fontSize: '13.5px', color: '#94A3B8', lineHeight: 1.5 }}>
                                        {note}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Connected Radios & Sensors Pills */}
                        <div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace', marginBottom: '8px' }}>
                                RADIOS & SENSORES ACTIVOS EN DISPOSITIVO:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {currentItem.radios.map((r, idx) => (
                                    <span
                                        key={idx}
                                        style={{
                                            fontSize: '11px',
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            background: 'rgba(0, 229, 255, 0.1)',
                                            color: '#00E5FF',
                                            border: '1px solid rgba(0, 229, 255, 0.25)',
                                            fontFamily: 'JetBrains Mono, monospace',
                                            fontWeight: 700
                                        }}
                                    >
                                        📻 {r}
                                    </span>
                                ))}
                                {currentItem.sensors.map((s, idx) => (
                                    <span
                                        key={idx}
                                        style={{
                                            fontSize: '11px',
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            background: 'rgba(0, 230, 118, 0.1)',
                                            color: '#00E676',
                                            border: '1px solid rgba(0, 230, 118, 0.25)',
                                            fontFamily: 'JetBrains Mono, monospace',
                                            fontWeight: 700
                                        }}
                                    >
                                        🔬 {s}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Launch Action Button */}
                        <div style={{ display: 'flex', gap: '14px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <button
                                onClick={onEnterApp}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '12px 24px',
                                    borderRadius: '12px',
                                    background: `linear-gradient(135deg, ${currentItem.badgeColor} 0%, #00F0FF 100%)`,
                                    color: '#050B14',
                                    fontWeight: 900,
                                    fontSize: '13px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: `0 0 25px ${currentItem.badgeColor}40`
                                }}
                            >
                                <span>🚀</span>
                                <span>Probar Módulos en RED OS</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
