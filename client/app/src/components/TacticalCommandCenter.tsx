"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRedStore, ScreenView } from '../store/useRedStore';
import { useTranslation } from '../lib/i18n/i18nEngine';
import { globalShield } from '../lib/network/GlobalShieldEngine';
import { MonetizationEngine } from '../lib/network/MonetizationEngine';
import { TacticalAudioEngine } from '../lib/audio/TacticalAudioEngine';
import { meshSosBeacon } from '../lib/emergency/MeshSosBeaconEngine';
import { rfSigintWatchdog, SigintTelemetry } from '../lib/sensors/RfSigintWatchdogEngine';
import { forensicBlackBox } from '../lib/security/ForensicBlackBoxEngine';
import { dynamicBearerGovernor, SwarmHealthTelemetry } from '../lib/mesh/DynamicBearerGovernor';
import { SwarmHealthHUD } from './SwarmHealthHUD';
import { GlobalSearchModal } from './GlobalSearchModal';
import { toast } from './Toast';

type CommandDomain = 'favs' | 'comms' | 'nav' | 'survival' | 'security' | 'economy';

interface ModuleCardItem {
    id: string;
    action: ScreenView;
    icon: string;
    title: string;
    subtitle: string;
    badge?: string;
    badgeColor?: string;
    accentClass?: string;
}

export const TacticalCommandCenter: React.FC = () => {
    const { t } = useTranslation();
    const { navigate, identity, nodeOnline, conversations, contacts } = useRedStore();
    const [activeDomain, setActiveDomain] = useState<CommandDomain>('favs');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [activeSosCount, setActiveSosCount] = useState<number>(0);
    const [sigintTelemetry, setSigintTelemetry] = useState<SigintTelemetry>(() => rfSigintWatchdog.getTelemetry());
    const [swarmTelemetry, setSwarmTelemetry] = useState<SwarmHealthTelemetry>(() => dynamicBearerGovernor.getTelemetry());
    const [showSwarmHUD, setShowSwarmHUD] = useState<boolean>(false);

    useEffect(() => {
        const updateSos = () => setActiveSosCount(meshSosBeacon.getActiveDistressCount());
        updateSos();
        const unsub = meshSosBeacon.subscribe(updateSos);
        return unsub;
    }, []);

    useEffect(() => {
        rfSigintWatchdog.startScanning();
        const unsub = rfSigintWatchdog.subscribe(setSigintTelemetry);
        return () => {
            unsub();
            rfSigintWatchdog.stopScanning();
        };
    }, []);

    useEffect(() => {
        const unsub = dynamicBearerGovernor.subscribe(setSwarmTelemetry);
        return unsub;
    }, []);

    const [favoriteModules, setFavoriteModules] = useState<string[]>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("red_fav_modules");
                if (saved) return JSON.parse(saved);
            } catch {}
        }
        return ["channels", "walkie", "offGridCompass", "vitalScan", "nearby", "idVault"];
    });

    const toggleFavorite = (e: React.MouseEvent, modId: string) => {
        e.stopPropagation();
        const next = favoriteModules.includes(modId)
            ? favoriteModules.filter(id => id !== modId)
            : [...favoriteModules, modId];
        setFavoriteModules(next);
        try {
            localStorage.setItem("red_fav_modules", JSON.stringify(next));
        } catch {}
        toast.info(favoriteModules.includes(modId) ? "Módulo quitado de favoritos" : "⭐ Módulo fijado en favoritos");
    };

    const shieldTelemetry = globalShield.getTelemetry();
    const proStatus = MonetizationEngine.getProStatus();

    const domainCategories: { id: CommandDomain; label: string; icon: string; count: number }[] = [
        { id: 'favs', label: 'Favoritos', icon: '⭐', count: favoriteModules.length },
        { id: 'comms', label: 'Comunicaciones', icon: '💬', count: 6 },
        { id: 'nav', label: 'Navegación & Sensores', icon: '🧭', count: 6 },
        { id: 'survival', label: 'Supervivencia & Salud', icon: '🚨', count: 4 },
        { id: 'security', label: 'Seguridad & Bóvedas', icon: '🛡️', count: 6 },
        { id: 'economy', label: 'Economía & Sistema', icon: '⚡', count: 6 },
    ];

    const modulesByDomain: Record<Exclude<CommandDomain, 'favs'>, ModuleCardItem[]> = {
        comms: [
            {
                id: 'channels',
                action: 'channels',
                icon: '📻',
                title: 'Canales Mesh Públicos',
                subtitle: 'Difusión y sintonización por radio y Bluetooth sin Internet.',
                badge: 'OFF-GRID',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'walkie',
                action: 'walkie',
                icon: '🎙️',
                title: 'Walkie-Talkie P2P',
                subtitle: 'Voz en tiempo real semidúplex con baja latencia y compresión Opus.',
                badge: 'VOZ DIRECTA',
                badgeColor: 'var(--accent-emerald)',
                accentClass: 'glow-border-emerald'
            },
            {
                id: 'socialFeed',
                action: 'socialFeed',
                icon: '🌍',
                title: 'Muro Social Descentralizado',
                subtitle: 'Microblogging y publicaciones multimedia sobre la malla táctica.',
                badge: 'P2P FEED',
                badgeColor: 'var(--accent-purple)',
                accentClass: 'glow-border-purple'
            },
            {
                id: 'liveStream',
                action: 'liveStream',
                icon: '📺',
                title: 'Live Stream Multicast',
                subtitle: 'Transmisión de video táctico P2P con compresión adaptativa.',
                badge: 'STREAM',
                badgeColor: 'var(--accent-crimson)',
                accentClass: 'glow-border-crimson'
            },
            {
                id: 'canvas',
                action: 'canvas',
                icon: '🎨',
                title: 'Lienzo Táctico Colaborativo',
                subtitle: 'Pizarra gráfica sincronizada para mapas, marcas y notas de misión.',
                badge: 'CANVAS',
                badgeColor: 'var(--accent-amber)',
                accentClass: 'glow-border-amber'
            },
            {
                id: 'broadcast',
                action: 'broadcast',
                icon: '📢',
                title: 'Difusión de Alertas Masivas',
                subtitle: 'Inyección de anuncios de alta prioridad en todos los nodos de la malla.',
                badge: 'EMERGENCIA',
                badgeColor: 'var(--accent-crimson)',
                accentClass: 'glow-border-crimson'
            }
        ],
        nav: [
            {
                id: 'nearby',
                action: 'nearby',
                icon: '📡',
                title: 'Radar de Proximidad Mesh',
                subtitle: 'Descubrimiento táctico de nodos en rango mediante BLE y Wi-Fi Direct.',
                badge: 'RADAR',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'offGridCompass',
                action: 'offGridCompass',
                icon: '🧭',
                title: 'Brújula Off-Grid & Azimut Solar',
                subtitle: 'Navegación astronómica y magnética sin necesidad de satélites GPS.',
                badge: 'AZIMUT',
                badgeColor: 'var(--accent-emerald)',
                accentClass: 'glow-border-emerald'
            },
            {
                id: 'nodemap',
                action: 'nodemap',
                icon: '🗺️',
                title: 'Mapa Topológico de Nodos',
                subtitle: 'Visualización geoespacial de la red malla y saltos de enrutamiento.',
                badge: 'TOPOLOGÍA',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'rfSpectrum',
                action: 'rfSpectrum',
                icon: '📊',
                title: 'Espectro RF & Anti-Jamming',
                subtitle: 'Monitoreo de densidad espectral y detección de interferencias hostiles.',
                badge: 'ESPECTRO',
                badgeColor: 'var(--accent-purple)',
                accentClass: 'glow-border-purple'
            },
            {
                id: 'weather',
                action: 'weather',
                icon: '🌤️',
                title: 'Clima & Barómetro CAP',
                subtitle: 'Presión atmosférica, alertas meteorológicas CAP y predicción local.',
                badge: 'SENSOR',
                badgeColor: 'var(--accent-amber)',
                accentClass: 'glow-border-amber'
            },
            {
                id: 'ecoMesh',
                action: 'ecoMesh',
                icon: '🔋',
                title: 'Eco-Mesh & Gestión de Energía',
                subtitle: 'Control inteligente de duty-cycle y potencia de radio para autonomía extrema.',
                badge: 'BATERÍA',
                badgeColor: 'var(--accent-emerald)',
                accentClass: 'glow-border-emerald'
            }
        ],
        survival: [
            {
                id: 'survivalBeacon',
                action: 'survivalBeacon',
                icon: '🚨',
                title: 'Baliza SOS de Emergencia',
                subtitle: 'Transmisión acústica SoundMesh, Morse LED de hardware y SOS mesh.',
                badge: 'CRÍTICO',
                badgeColor: 'var(--accent-crimson)',
                accentClass: 'glow-border-crimson'
            },
            {
                id: 'vitalScan',
                action: 'vitalScan',
                icon: '🫀',
                title: 'Triaje START & VitalScan PPG',
                subtitle: 'Lectura fotopletismográfica de pulso, SpO2 y clasificación médica.',
                badge: 'SALUD',
                badgeColor: 'var(--accent-emerald)',
                accentClass: 'glow-border-emerald'
            },
            {
                id: 'amber',
                action: 'amber',
                icon: '🟠',
                title: 'Alertas Amber & Rescate Táctico',
                subtitle: 'Protocolo de búsqueda y rescate de personas desaparecidas en zona cero.',
                badge: 'SAR',
                badgeColor: 'var(--accent-amber)',
                accentClass: 'glow-border-amber'
            },
            {
                id: 'blackout',
                action: 'blackout',
                icon: '⚡',
                title: 'Simulador de Apagón Total',
                subtitle: 'Pruebas de estrés y resiliencia ante pérdida absoluta de infraestructura.',
                badge: 'SIMULACRO',
                badgeColor: 'var(--accent-purple)',
                accentClass: 'glow-border-purple'
            },
            {
                id: 'tacticalVisionScan',
                action: 'tacticalVisionScan',
                icon: '👁️',
                title: 'Visión Táctica Edge AI',
                subtitle: 'Escaneo y reconocimiento de amenazas en vivo con filtros NVG, FLIR y bounding boxes.',
                badge: 'EDGE AI',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'cbrnSatellite',
                action: 'cbrnSatellite',
                icon: '☢️',
                title: 'Telemetría CBRN & Satélite LEO',
                subtitle: 'Dosimetría nuclear en µSv/h, dosis biológica acumulada y enlace orbital DTN.',
                badge: 'CBRN / LEO',
                badgeColor: 'var(--accent-amber)',
                accentClass: 'glow-border-amber'
            },
            {
                id: 'tcccBallistics',
                action: 'tcccBallistics',
                icon: '🩸',
                title: 'TCCC Triage & Balística Mil-Dot',
                subtitle: 'Protocolo MARCH-PAWS, temporizadores de torniquetes CAT y cálculo balístico MRAD.',
                badge: 'TCCC / MRAD',
                badgeColor: 'var(--accent-crimson)',
                accentClass: 'glow-border-crimson'
            },
            {
                id: 'celestialPdr',
                action: 'celestialPdr',
                icon: '☀️',
                title: 'Navegación Celeste & PDR',
                subtitle: 'Efemérides Sol/Luna, coordenadas por mediodía solar y navegación inercial sin GNSS.',
                badge: 'CELESTE / PDR',
                badgeColor: 'var(--accent-amber)',
                accentClass: 'glow-border-amber'
            },
            {
                id: 'vitalResources',
                action: 'vitalResources',
                icon: '💧',
                title: 'Recursos Vitales: Agua & Energía',
                subtitle: 'Dosimetría de purificación química/SODIS de H2O y cálculo de autonomía de batería.',
                badge: 'H2O / POWER',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'sonarSeismic',
                action: 'sonarSeismic',
                icon: '📡',
                title: 'Sonar Acústico & Sismología',
                subtitle: 'Medición FMCW ToF de cavidades y triangulación sísmica TDoA de supervivientes.',
                badge: 'SONAR / SÍSMICO',
                badgeColor: 'var(--accent-emerald)',
                accentClass: 'glow-border-emerald'
            },
            {
                id: 'atmosphericSafety',
                action: 'atmosphericSafety',
                icon: '💨',
                title: 'Espectrometría de Gas & Calidad de Aire',
                subtitle: 'Detección óptica de humo, PM2.5/PM10, CO ppm y cálculo de índice AQI por cámara.',
                badge: 'AQI / HAZMAT',
                badgeColor: 'var(--accent-amber)',
                accentClass: 'glow-border-amber'
            }
        ],
        security: [
            {
                id: 'globalShield',
                action: 'globalShield',
                icon: '🛡️',
                title: 'Escudo Global DEFCON',
                subtitle: 'Ofuscación de tráfico con ruido criptográfico CSPRNG y anti-análisis.',
                badge: `DEFCON ${shieldTelemetry.currentDefcon}`,
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'dms',
                action: 'dms',
                icon: '💀',
                title: "Dead Man's Switch (DMS)",
                subtitle: 'Temporizador de hombre muerto con purga criptográfica automática.',
                badge: 'ANTI-CAPTURA',
                badgeColor: 'var(--accent-crimson)',
                accentClass: 'glow-border-crimson'
            },
            {
                id: 'calculator',
                action: 'calculator',
                icon: '🧮',
                title: 'Pantalla Antiforense (Calculadora)',
                subtitle: 'Camuflaje visual que oculta la interfaz detrás de una calculadora real.',
                badge: 'SEÑUELO',
                badgeColor: 'var(--accent-amber)',
                accentClass: 'glow-border-amber'
            },
            {
                id: 'stegoVault',
                action: 'stegoVault',
                icon: '🖼️',
                title: 'Bóveda Esteganográfica',
                subtitle: 'Incrustación de archivos y mensajes secretos en píxeles LSB con AES-256.',
                badge: 'ESTEGANOGRAFÍA',
                badgeColor: 'var(--accent-purple)',
                accentClass: 'glow-border-purple'
            },
            {
                id: 'idVault',
                action: 'idVault',
                icon: '🪪',
                title: 'Bóveda Identidad & PQC ML-KEM',
                subtitle: 'Criptografía post-cuántica ML-KEM-768, Shamir Secret Sharing y ficha médica.',
                badge: 'POST-CUÁNTICO',
                badgeColor: 'var(--accent-emerald)',
                accentClass: 'glow-border-emerald'
            },
            {
                id: 'guardian',
                action: 'guardian',
                icon: '🤖',
                title: 'Guardián IA & Auditoría',
                subtitle: 'Detección local de anomalías, ataques Sybil y telemetría de red.',
                badge: 'IA LOCAL',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'shamirRecovery',
                action: 'shamirRecovery',
                icon: '🧩',
                title: 'Recuperación Social Shamir',
                subtitle: 'Bóveda umbral 3-de-5 con distribución polinómica de claves a 5 guardianes.',
                badge: 'SHAMIR SSS',
                badgeColor: 'var(--accent-emerald)',
                accentClass: 'glow-border-emerald'
            },
            {
                id: 'c4isrEmpDrill',
                action: 'c4isrEmpDrill',
                icon: '🛰️',
                title: 'Matriz C4ISR & Caos EMP',
                subtitle: 'Teatro militar unificado, informe ejecutivo C4ISR y ejercicios de estrés frente a EMP.',
                badge: 'C4ISR / EMP',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'airGapStego',
                action: 'airGapStego',
                icon: '🎞️',
                title: 'Transferencia Air-Gap & Audio Stego',
                subtitle: 'Flujo óptico QR animado a alta velocidad y ocultación psicoacústica en audio WAV.',
                badge: 'AIR-GAP / AUDIO',
                badgeColor: 'var(--accent-purple)',
                accentClass: 'glow-border-purple'
            },
            {
                id: 'acousticWarfare',
                action: 'acousticWarfare',
                icon: '🔇',
                title: 'Guerra Acústica & Ondas Binaurales',
                subtitle: 'Perturbador ultrasónico anti-micrófonos MEMS y ondas binaurales Gamma/Beta para combate.',
                badge: 'AUDIO JAM / BRAIN',
                badgeColor: 'var(--accent-crimson)',
                accentClass: 'glow-border-crimson'
            },
            {
                id: 'tacticalFoxhunt',
                action: 'tacticalFoxhunt',
                icon: '🦊',
                title: 'Radiogoniometría RDF & Caza Foxhunt',
                subtitle: 'Localización polar y triangulación LOB de emisores hostiles, jammers y balizas.',
                badge: 'RDF / FOXHUNT',
                badgeColor: 'var(--accent-amber)',
                accentClass: 'glow-border-amber'
            }
        ],
        economy: [
            {
                id: 'p2pPay',
                action: 'p2pPay',
                icon: '💳',
                title: 'Billetera de Pagos P2P & Vales',
                subtitle: 'Transacciones y vales firmados digitalmente sin conexión a Internet.',
                badge: 'OFFLINE PAY',
                badgeColor: 'var(--accent-emerald)',
                accentClass: 'glow-border-emerald'
            },
            {
                id: 'zkBarterSubsurface',
                action: 'zkBarterSubsurface',
                icon: '🪙',
                title: 'Canje zk-Barter & Rescate VLF',
                subtitle: 'Pruebas ZK de pertenencia Merkle anónimas y baliza acústica sub-estructural.',
                badge: 'ZK / VLF',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'web3Vault',
                action: 'web3Vault',
                icon: '🦊',
                title: 'Bóveda Web3 Soberana',
                subtitle: 'Gestión local de claves privadas, firma de transacciones y tokens.',
                badge: 'WEB3',
                badgeColor: 'var(--accent-purple)',
                accentClass: 'glow-border-purple'
            },
            {
                id: 'explorer',
                action: 'explorer',
                icon: '⛓️',
                title: 'Explorador Blockchain',
                subtitle: 'Inspección de bloques PoA, árbol de consenso y validadores del nodo.',
                badge: 'DAG / PoS',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'commercialHub',
                action: 'commercialHub',
                icon: '⚡',
                title: 'Hub Comercial & Beneficios Pro',
                subtitle: 'Catálogo dinámico de hardware, recompensas y canje de créditos.',
                badge: proStatus.isPro ? 'PRO ACTIVO' : 'CRÉDITOS',
                badgeColor: proStatus.isPro ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                accentClass: 'glow-border-amber'
            },
            {
                id: 'health',
                action: 'health',
                icon: '📊',
                title: 'Diagnóstico de Salud del Nodo',
                subtitle: 'Telemetría de sockets WebRTC/BLE, base de datos Sled y memoria.',
                badge: 'DIAGNÓSTICO',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            },
            {
                id: 'backup',
                action: 'backup',
                icon: '💾',
                title: 'Copia de Seguridad Blindada',
                subtitle: 'Exportación e importación de bóvedas cifradas con Argon2id.',
                badge: 'ENCRIPTADO',
                badgeColor: 'var(--accent-purple)',
                accentClass: 'glow-border-purple'
            },
            {
                id: 'appStore',
                action: 'appStore',
                icon: '🛒',
                title: 'Sovereign App Store',
                subtitle: 'Instala, crea y publica Mini-Apps P2P soberanas con pagos multi-rail integrados.',
                badge: 'MINI-APPS',
                badgeColor: 'var(--accent-emerald)',
                accentClass: 'glow-border-emerald'
            },
            {
                id: 'hyperBrowser',
                action: 'hyperBrowser',
                icon: '🌐',
                title: 'RED Hyper-Browser',
                subtitle: 'Navega red:// y https:// sobre malla satelital. Sin censura, sin ISP.',
                badge: 'MESH HTTP',
                badgeColor: 'var(--accent-cyan)',
                accentClass: 'glow-border-cyan'
            }
        ]
    };

    const handleCardClick = (action: ScreenView) => {
        TacticalAudioEngine.playTap();
        navigate(action);
    };

    const allModulesList: ModuleCardItem[] = useMemo(() => {
        const lists = Object.values(modulesByDomain) as ModuleCardItem[][];
        return lists.flat();
    }, []);

    const currentModules: ModuleCardItem[] = useMemo(() => {
        if (activeDomain === 'favs') {
            const favs = allModulesList.filter(m => favoriteModules.includes(m.id));
            return favs.length > 0 ? favs : allModulesList.slice(0, 6);
        }
        return (modulesByDomain as Record<string, ModuleCardItem[]>)[activeDomain] || [];
    }, [activeDomain, favoriteModules, allModulesList]);

    const searchFilteredModules: ModuleCardItem[] | null = searchQuery.trim() 
        ? allModulesList.filter(m => {
            const q = searchQuery.toLowerCase();
            return m.title.toLowerCase().includes(q) ||
                   m.subtitle.toLowerCase().includes(q) ||
                   (m.badge && m.badge.toLowerCase().includes(q));
          })
        : null;

    return (
        <div className="command-center-container animate-fade-in">
            {/* Header Táctico Superior */}
            <header style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'linear-gradient(180deg, rgba(14, 18, 28, 0.96) 0%, rgba(8, 10, 18, 0.98) 100%)',
                backdropFilter: 'blur(24px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                zIndex: 20
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #00F0FF 0%, #0077B6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.3rem',
                        boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)'
                    }}>
                        ⚡
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.3px', color: '#FFFFFF' }}>
                                Centro de Comando Táctico
                            </h1>
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: nodeOnline ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                                boxShadow: `0 0 8px ${nodeOnline ? 'var(--accent-emerald)' : 'var(--accent-amber)'}`
                            }} />
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {identity?.display_name || 'Operador'} · Nodo {identity?.identity_hash ? identity.identity_hash.substring(0, 10) : 'Offline'} · DEFCON {shieldTelemetry.currentDefcon}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setShowSwarmHUD(!showSwarmHUD)}
                        className="btn-icon"
                        style={{
                            width: '38px', height: '38px', borderRadius: '10px',
                            background: showSwarmHUD ? 'rgba(0, 229, 255, 0.25)' : undefined,
                            border: showSwarmHUD ? '1px solid #00E5FF' : undefined
                        }}
                        title="Enjambre Multi-Bearer & EW C2"
                    >
                        🌐
                    </button>
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="btn-icon"
                        style={{ width: '38px', height: '38px', borderRadius: '10px' }}
                        title="Búsqueda Universal (Ctrl+K)"
                    >
                        🔍
                    </button>
                    <button
                        onClick={() => navigate('settings')}
                        className="btn-icon"
                        style={{ width: '38px', height: '38px', borderRadius: '10px' }}
                        title="Configuración de Nodo"
                    >
                        ⚙️
                    </button>
                </div>
            </header>

            {/* Modal Overlay / Dropdown de Swarm Health HUD */}
            {showSwarmHUD && (
                <div style={{ padding: '12px 20px', background: 'rgba(5, 8, 18, 0.95)', borderBottom: '1px solid rgba(0, 229, 255, 0.3)' }}>
                    <SwarmHealthHUD onClose={() => setShowSwarmHUD(false)} />
                </div>
            )}

            {/* Alerta SIGINT Drone C-UAS Banner */}
            {sigintTelemetry.threatLevel !== 'CLEAR' && (
                <div style={{
                    padding: '10px 16px', background: sigintTelemetry.threatLevel === 'DRONE_DETECTED' ? 'rgba(232,33,58,0.25)' : 'rgba(255,179,0,0.18)',
                    borderBottom: `1px solid ${sigintTelemetry.threatLevel === 'DRONE_DETECTED' ? 'var(--accent-crimson)' : 'var(--accent-amber)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 800, color: '#fff' }}>
                        <span>{sigintTelemetry.threatLevel === 'DRONE_DETECTED' ? '🛸' : '📡'}</span>
                        <span>
                            {sigintTelemetry.threatLevel === 'DRONE_DETECTED' 
                                ? `ALERTA SIGINT: DRONE / OPEN-DRONE-ID DETECTADO (~${sigintTelemetry.closestDrone?.estimatedDistanceMeters}m)` 
                                : `ALERTA SIGINT: VIGILANCIA RF SOSPECHOSA (${sigintTelemetry.suspiciousEmittersCount} balizas activas)`}
                        </span>
                    </div>
                    <span className="badge-tactical badge-tactical-crimson" style={{ fontSize: '0.65rem' }}>
                        {sigintTelemetry.threatLevel}
                    </span>
                </div>
            )}

            {/* Barra HUD de Acciones Críticas 1-Tap */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '8px',
                padding: '12px 20px',
                background: 'rgba(10, 14, 24, 0.85)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(16px)'
            }}>
                <button
                    onClick={() => handleCardClick('survivalBeacon')}
                    className="btn-tactical-danger"
                    style={{ padding: '8px 10px', fontSize: '0.74rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px', textTransform: 'uppercase' }}
                >
                    <span>🚨</span> <span>SOS Malla {activeSosCount > 0 && `(${activeSosCount})`}</span>
                </button>
                <button
                    onClick={() => handleCardClick('walkie')}
                    className="btn-tactical-primary"
                    style={{ padding: '8px 10px', fontSize: '0.74rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px', textTransform: 'uppercase' }}
                >
                    <span>🎙️</span> <span>Walkie P2P</span>
                </button>
                <button
                    onClick={() => handleCardClick('offGridCompass')}
                    className="btn-tactical-secondary"
                    style={{ padding: '8px 10px', fontSize: '0.74rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px', textTransform: 'uppercase' }}
                >
                    <span>🧭</span> <span>Brújula</span>
                </button>
                <button
                    onClick={() => handleCardClick('nearby')}
                    className="btn-tactical-secondary"
                    style={{ padding: '8px 10px', fontSize: '0.74rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px', textTransform: 'uppercase' }}
                >
                    <span>📡</span> <span>Radar BLE</span>
                </button>
                <button
                    onClick={() => handleCardClick('aiCopilot')}
                    className="btn-tactical-secondary"
                    style={{ padding: '8px 10px', fontSize: '0.74rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px', textTransform: 'uppercase' }}
                >
                    <span>🤖</span> <span>Copilot IA</span>
                </button>
                <button
                    onClick={() => handleCardClick('p2pPay')}
                    className="btn-tactical-secondary"
                    style={{ padding: '8px 10px', fontSize: '0.74rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px', textTransform: 'uppercase' }}
                >
                    <span>💳</span> <span>Vales P2P</span>
                </button>
            </div>

            {/* Selector de Dominios Operativos (Chips Horizontales) */}
            <div style={{
                display: 'flex',
                gap: '8px',
                padding: '12px 20px',
                background: 'rgba(6, 8, 14, 0.65)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                flexShrink: 0
            }}>
                {domainCategories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            setActiveDomain(cat.id);
                            setSearchQuery('');
                        }}
                        className={`domain-pill-chip ${activeDomain === cat.id && !searchQuery ? 'active' : ''}`}
                    >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                        <span style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '8px',
                            background: activeDomain === cat.id && !searchQuery ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.1)',
                            fontWeight: 800,
                            fontFamily: 'JetBrains Mono, monospace'
                        }}>
                            {cat.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Quick Filter Search Input */}
            <div style={{ padding: '10px 20px 0 20px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 14px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>🔍</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filtrar módulos, sensores o protocolos tácticos..."
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#FFFFFF',
                            fontSize: '0.82rem'
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Cuadrícula de Módulos (Bento Grid Táctico) */}
            <div className="scroll-container" style={{
                flex: 1,
                padding: '16px 20px 80px 20px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '14px',
                alignContent: 'start'
            }}>
                {(searchFilteredModules || currentModules).map((mod) => (
                    <div
                        key={mod.id}
                        onClick={() => handleCardClick(mod.action)}
                        className={`card-tactical-glass card-tactical-interactive ${mod.accentClass || ''}`}
                        style={{
                            padding: '18px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '12px',
                            minHeight: '140px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.25rem',
                                    flexShrink: 0
                                }}>
                                    {mod.icon}
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: '#FFFFFF' }}>
                                        {mod.title}
                                    </h3>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                    onClick={(e) => toggleFavorite(e, mod.id)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '1rem',
                                        padding: '2px',
                                        color: favoriteModules.includes(mod.id) ? '#FFD700' : 'rgba(255,255,255,0.25)',
                                        transition: 'transform 0.15s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    title={favoriteModules.includes(mod.id) ? "Quitar de favoritos" : "Fijar en favoritos"}
                                >
                                    {favoriteModules.includes(mod.id) ? '⭐' : '☆'}
                                </button>
                                {mod.badge && (
                                    <span style={{
                                        fontSize: '9px',
                                        fontWeight: 800,
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        color: mod.badgeColor || 'var(--text-secondary)',
                                        border: `1px solid ${mod.badgeColor || 'rgba(255,255,255,0.15)'}40`,
                                        fontFamily: 'JetBrains Mono, monospace',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {mod.badge}
                                    </span>
                                )}
                            </div>
                        </div>

                        <p style={{
                            margin: 0,
                            fontSize: '0.76rem',
                            color: 'rgba(255, 255, 255, 0.65)',
                            lineHeight: 1.4
                        }}>
                            {mod.subtitle}
                        </p>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: 'var(--accent-cyan)',
                            gap: '4px'
                        }}>
                            <span>Ejecutar módulo</span>
                            <span>→</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Dock Inferior de Navegación Rápida */}
            <nav className="command-dock">
                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        navigate('sidebar');
                    }}
                    className="command-dock-btn"
                >
                    <span style={{ fontSize: '1.1rem' }}>💬</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>Chats ({conversations.length})</span>
                </button>

                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveDomain('comms');
                    }}
                    className={`command-dock-btn ${activeDomain === 'comms' ? 'active' : ''}`}
                >
                    <span style={{ fontSize: '1.1rem' }}>📻</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>Comms</span>
                </button>

                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveDomain('nav');
                    }}
                    className={`command-dock-btn ${activeDomain === 'nav' ? 'active' : ''}`}
                >
                    <span style={{ fontSize: '1.1rem' }}>🧭</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>Radar</span>
                </button>

                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveDomain('survival');
                    }}
                    className={`command-dock-btn ${activeDomain === 'survival' ? 'active' : ''}`}
                >
                    <span style={{ fontSize: '1.1rem' }}>🚨</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>SOS</span>
                </button>

                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveDomain('security');
                    }}
                    className={`command-dock-btn ${activeDomain === 'security' ? 'active' : ''}`}
                >
                    <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>Escudo</span>
                </button>

                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveDomain('economy');
                    }}
                    className={`command-dock-btn ${activeDomain === 'economy' ? 'active' : ''}`}
                >
                    <span style={{ fontSize: '1.1rem' }}>⚡</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>Bóvedas</span>
                </button>
            </nav>

            {/* Modal de Búsqueda Global */}
            {isSearchOpen && (
                <GlobalSearchModal
                    onClose={() => setIsSearchOpen(false)}
                />
            )}
        </div>
    );
};

export default TacticalCommandCenter;
