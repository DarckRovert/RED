"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRedStore, ScreenView } from '../store/useRedStore';
import { useTranslation } from '../lib/i18n/i18nEngine';
import { globalShield } from '../lib/network/GlobalShieldEngine';
import { MonetizationEngine } from '../lib/network/MonetizationEngine';
import { meshSosBeacon } from '../lib/emergency/MeshSosBeaconEngine';
import { rfSigintWatchdog, SigintTelemetry } from '../lib/sensors/RfSigintWatchdogEngine';
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
    accentGlow?: string;
}

export const TacticalCommandCenter: React.FC = () => {
    const { t } = useTranslation();
    const { navigate, identity, nodeOnline } = useRedStore();
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
        return ["channels", "walkie", "offGridCompass", "vitalScan", "nearby", "idVault", "aiCopilot", "appStore"];
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

    const modulesByDomain: Record<Exclude<CommandDomain, 'favs'>, ModuleCardItem[]> = {
        comms: [
            {
                id: 'channels',
                action: 'channels',
                icon: '📻',
                title: 'Canales Mesh Públicos',
                subtitle: 'Difusión y sintonización por radio y Bluetooth sin Internet.',
                badge: 'OFF-GRID',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'walkie',
                action: 'walkie',
                icon: '🎙️',
                title: 'Walkie-Talkie P2P',
                subtitle: 'Voz en tiempo real semidúplex con baja latencia y compresión LPC.',
                badge: 'VOZ DIRECTA',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'groups',
                action: 'groups',
                icon: '👥',
                title: 'Escuadrones P2P & Grupos',
                subtitle: 'Salas tácticas cerradas con cifrado de grupo SenderKeys y rotación.',
                badge: 'SQUAD',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'socialFeed',
                action: 'socialFeed',
                icon: '🌍',
                title: 'Muro Social Descentralizado',
                subtitle: 'Microblogging y publicaciones multimedia sobre la malla táctica.',
                badge: 'P2P FEED',
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'liveStream',
                action: 'liveStream',
                icon: '📺',
                title: 'Live Stream Multicast',
                subtitle: 'Transmisión de video táctico P2P con compresión adaptativa.',
                badge: 'STREAM',
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.2)'
            },
            {
                id: 'canvas',
                action: 'canvas',
                icon: '🎨',
                title: 'Lienzo Táctico Colaborativo',
                subtitle: 'Pizarra gráfica sincronizada para mapas, marcas y notas de misión.',
                badge: 'CANVAS',
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'broadcast',
                action: 'broadcast',
                icon: '📢',
                title: 'Difusión de Alertas Masivas',
                subtitle: 'Inyección de anuncios de alta prioridad en todos los nodos de la malla.',
                badge: 'EMERGENCIA',
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.2)'
            },
            {
                id: 'loraTransceiver',
                action: 'loraTransceiver',
                icon: '📻',
                title: 'Transceptor LoRa RF 25km',
                subtitle: 'Radio de largo alcance (25km) Semtech SX1262 / ESP32. Sin Internet.',
                badge: 'LORA 915MHz',
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'acousticWarfare',
                action: 'acousticWarfare',
                icon: '🔊',
                title: 'Guerra Acústica & Scrambler',
                subtitle: 'Emisión de pulsos ultrasónicos y contramedidas acústicas de perímetro.',
                badge: 'ULTRASONIDO',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            }
        ],
        nav: [
            {
                id: 'nearby',
                action: 'nearby',
                icon: '📡',
                title: 'Radar de Proximidad Mesh',
                subtitle: 'Descubrimiento táctico de nodos en rango mediante BLE y Wi-Fi Direct.',
                badge: 'RADAR 360°',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'nodemap',
                action: 'nodemap',
                icon: '🗺️',
                title: 'Mapa de Nodos & Topología',
                subtitle: 'Cartografía táctica offline con renderizado vectorial y rutas dinámicas.',
                badge: 'GPS OFFLINE',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'offGridCompass',
                action: 'offGridCompass',
                icon: '🧭',
                title: 'Brújula & PDR Táctico',
                subtitle: 'Navegación inercial y azimut magnético para orientación en campo.',
                badge: 'AZIMUT',
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'p2pCompass',
                action: 'p2pCompass',
                icon: '🎯',
                title: 'Brújula P2P (Búsqueda de Pares)',
                subtitle: 'Rastreo direccional hacia nodos aliados mediante señales de radio.',
                badge: 'TRACKING',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'celestialPdr',
                action: 'celestialPdr',
                icon: '✨',
                title: 'Navegación Celeste J2000 & PDR',
                subtitle: 'Orientación astronómica por efemérides solares/estelares sin satélites.',
                badge: 'CELESTIAL',
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'sonarSeismic',
                action: 'sonarSeismic',
                icon: '🦇',
                title: 'Ecosonda ToF & Sismógrafo',
                subtitle: 'Sondeo de cavidades por ultrasonido y detección de vibraciones TDoA.',
                badge: 'SONAR/SEISMIC',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'tacticalFoxhunt',
                action: 'tacticalFoxhunt',
                icon: '🦊',
                title: 'Radiogoniometría RDF Foxhunt',
                subtitle: 'Triangulación de balizas y emisores de radio clandestinos.',
                badge: 'RDF HUNT',
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'shakePair',
                action: 'shakePair',
                icon: '📳',
                title: 'Shake & Pair (Acelerómetro)',
                subtitle: 'Emparejamiento criptográfico instantáneo agitando ambos dispositivos.',
                badge: 'CINÉTICO',
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'proximityWave',
                action: 'proximityWave',
                icon: '🌊',
                title: 'Ola de Proximidad Ultrasónica',
                subtitle: 'Descubrimiento sonoro en la banda de 18 a 20 kHz sin radios activos.',
                badge: 'ULTRASONIDO',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            }
        ],
        survival: [
            {
                id: 'extremeSurvival',
                action: 'extremeSurvival',
                icon: '⚡',
                title: 'HUD Supervivencia Extrema (3 Botones)',
                subtitle: 'Modo de pánico y alto estrés: SOS Médico, PTT Directo y Brújula de Evacuación.',
                badge: 'ALTO ESTRÉS',
                badgeColor: '#FF1E40',
                accentGlow: 'rgba(255, 30, 64, 0.35)'
            },
            {
                id: 'vitalScan',
                action: 'vitalScan',
                icon: '🫀',
                title: 'Escaneo Vital & Triage START',
                subtitle: 'Evaluación rápida de pulso (rPPG fotopletismografía) y clasificación de heridos.',
                badge: 'TRIAGE USAR',
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.25)'
            },
            {
                id: 'tcccBallistics',
                action: 'tcccBallistics',
                icon: '🎯',
                title: 'Triage TCCC & Balística 4-DOF',
                subtitle: 'Protocolo MARCH-PAWS y calculador de tiro balístico RK4 en campo.',
                badge: 'TCCC / 4-DOF',
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.25)'
            },
            {
                id: 'survivalBeacon',
                action: 'survivalBeacon',
                icon: '🚨',
                title: 'Baliza SOS Multimodal',
                subtitle: 'Emisión acústica, lumínica en código Morse y paquetes SOS en la malla.',
                badge: 'SOS CRÍTICO',
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.25)'
            },
            {
                id: 'weather',
                action: 'weather',
                icon: '🌤️',
                title: 'Alertas Meteorológicas & Barómetro',
                subtitle: 'Lectura barométrica de hardware y predicción de tormentas sin Internet.',
                badge: 'BARÓMETRO',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'atmosphericSafety',
                action: 'atmosphericSafety',
                icon: '💨',
                title: 'Seguridad Atmosférica & AQI',
                subtitle: 'Monitoreo de calidad de aire, índice óptico de polución y radiación solar.',
                badge: 'AQI SENSOR',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'vitalResources',
                action: 'vitalResources',
                icon: '💧',
                title: 'Recursos Vitales H2O & Batería',
                subtitle: 'Gestión táctica de reservas de agua, raciones y balance energético.',
                badge: 'LOGÍSTICA',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'cbrnSatellite',
                action: 'cbrnSatellite',
                icon: '☢️',
                title: 'Detector Radiológico & Satélite',
                subtitle: 'Detección gamma en sensor CMOS y pasarela de satélites LEO (Iridium).',
                badge: 'CBRN SENSOR',
                badgeColor: '#FF9100',
                accentGlow: 'rgba(255, 145, 0, 0.25)'
            },
            {
                id: 'amber',
                action: 'amber',
                icon: '🟠',
                title: 'Protocolo de Alerta AMBER P2P',
                subtitle: 'Búsqueda descentralizada comunitaria con propagación epidémica de fichas.',
                badge: 'AMBER RESCUE',
                badgeColor: '#FF9100',
                accentGlow: 'rgba(255, 145, 0, 0.2)'
            },
            {
                id: 'zkBarterSubsurface',
                action: 'zkBarterSubsurface',
                icon: '⚖️',
                title: 'Trueque ZK & Rescate Sub-Estructural',
                subtitle: 'Intercambio de recursos en conocimiento cero y geolocalización de atrapados.',
                badge: 'ZK-BARTER',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            }
        ],
        security: [
            {
                id: 'idVault',
                action: 'idVault',
                icon: '🪪',
                title: 'Bóveda de Identidad & Claves',
                subtitle: 'Gestor de credenciales soberanas, claves de sesión y respaldos BIP-39.',
                badge: 'SOBERANO',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'crypto',
                action: 'crypto',
                icon: '🔐',
                title: 'Criptografía Post-Cuántica (PQC)',
                subtitle: 'Cifrado híbrido ML-KEM-768 (Kyber) y firmas digitales cuántico-resistentes.',
                badge: 'FIPS 203',
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'globalShield',
                action: 'globalShield',
                icon: '🛡️',
                title: 'Escudo Global DEFCON',
                subtitle: 'Monitoreo de integridad perimetral, firewall local y detección de ataques.',
                badge: 'DEFCON 1',
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.2)'
            },
            {
                id: 'c4isrEmpDrill',
                action: 'c4isrEmpDrill',
                icon: '⚡',
                title: 'Matriz C4ISR & Drill EMP',
                subtitle: 'Simulación de pulso electromagnético y procedimientos de recuperación.',
                badge: 'EMP DRILL',
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'tacticalVisionScan',
                action: 'tacticalVisionScan',
                icon: '👁️',
                title: 'Visión Táctica Edge AI & UAV',
                subtitle: 'Detección visual de drones, siluetas térmicas y fuego sin nube.',
                badge: 'EDGE AI',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'airGapStego',
                action: 'airGapStego',
                icon: '📷',
                title: 'Esteganografía Air-Gap QR',
                subtitle: 'Transferencia óptica aislada de cargas cifradas mediante secuencias QR animadas.',
                badge: 'AIR-GAP',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'stegoVault',
                action: 'stegoVault',
                icon: '🖼️',
                title: 'Bóveda Esteganográfica LSB',
                subtitle: 'Ocultación de mensajes y documentos dentro de los bits de imágenes PNG/JPG.',
                badge: 'STEGO LSB',
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'shamirRecovery',
                action: 'shamirRecovery',
                icon: '🔑',
                title: 'Respaldo Shamir SSS (3-de-5)',
                subtitle: 'División criptográfica del secreto en fragmentos distribuidos entre aliados.',
                badge: 'SHAMIR SSS',
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'blackout',
                action: 'blackout',
                icon: '⚡',
                title: 'Simulador de Apagón Tecnológico',
                subtitle: 'Pruebas de estrés y corte deliberado de interfaces para validar resiliencia.',
                badge: 'CHAOS DRILL',
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'dms',
                action: 'dms',
                icon: '💀',
                title: "Dead-Man's Switch (Hombre Muerto)",
                subtitle: 'Activación automática de protocolos de contingencia o borrado seguro.',
                badge: 'PANIC WIPER',
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.2)'
            },
            {
                id: 'calculator',
                action: 'calculator',
                icon: '🧮',
                title: 'Calculadora Señuelo (Camuflaje)',
                subtitle: 'Interfaz señuelo funcional para ocultar la bóveda bajo coacción.',
                badge: 'STEALTH PIN',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'guardian',
                action: 'guardian',
                icon: '🛡️',
                title: 'Guardián IA & Firewall',
                subtitle: 'Análisis heurístico de paquetes y protección anti-inyección en tiempo real.',
                badge: 'ZERO-TRUST',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            }
        ],
        economy: [
            {
                id: 'commercialHub',
                action: 'commercialHub',
                icon: '⚡',
                title: 'Hub Comercial & Recompensas',
                subtitle: 'Vales firmados con Ed25519 y mercado offline en conocimiento cero.',
                badge: 'ZK-BARTER',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'p2pPay',
                action: 'p2pPay',
                icon: '💳',
                title: 'RED Pay (Pagos Malla P2P)',
                subtitle: 'Transferencias de crédito seguras entre pares sin conexión a bancos.',
                badge: 'VALES P2P',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'web3Vault',
                action: 'web3Vault',
                icon: '🦊',
                title: 'Bóveda Web3 & MetaMask',
                subtitle: 'Gestión de claves EVM (Polygon, Ethereum, Arbitrum) y firma offline.',
                badge: 'WEB3 EVM',
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'explorer',
                action: 'explorer',
                icon: '⛓️',
                title: 'Explorador Blockchain PoS',
                subtitle: 'Libro mayor distribuido, validadores y trazabilidad de bloques.',
                badge: 'LEDGER',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'aiCopilot',
                action: 'aiCopilot',
                icon: '🧠',
                title: 'Copiloto de IA Táctico Offline',
                subtitle: 'Inferencia local WASM con memoria dinámica y RAG para supervivencia.',
                badge: 'DYNAMIC AI',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'appStore',
                action: 'appStore',
                icon: '🏪',
                title: 'App Store P2P (Mini-Apps)',
                subtitle: 'Ecosistema de micro-aplicaciones descentralizadas seguras y aisladas.',
                badge: 'SANDBOX',
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'hyperBrowser',
                action: 'hyperBrowser',
                icon: '🌐',
                title: 'RED Hyper-Browser Mesh',
                subtitle: 'Navegación web descentralizada mediante enrutamiento P2P por saltos.',
                badge: 'MESH HTTP',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'health',
                action: 'health',
                icon: '📊',
                title: 'Diagnóstico & Salud del Sistema',
                subtitle: 'Métricas de CPU, memoria, almacenamiento y estado de la batería.',
                badge: 'DIAGNÓSTICO',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'nodeLogs',
                action: 'nodeLogs',
                icon: '📋',
                title: 'Logs del Nodo Rust SSE',
                subtitle: 'Registro de eventos de bajo nivel, paquetes reenviados y estado de red.',
                badge: 'RUST SSE',
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'webCompanionLink',
                action: 'webCompanionLink',
                icon: '💻',
                title: 'Vincular con PC (Web Companion)',
                subtitle: 'Sincronización segura de sesión y mensajes con la versión de escritorio.',
                badge: 'LINK PC',
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            }
        ]
    };

    const allFlatModules: ModuleCardItem[] = useMemo(() => {
        return Object.values(modulesByDomain).flat();
    }, []);

    const displayedModules = useMemo(() => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return allFlatModules.filter(m =>
                m.title.toLowerCase().includes(q) ||
                m.subtitle.toLowerCase().includes(q) ||
                (m.badge && m.badge.toLowerCase().includes(q))
            );
        }

        if (activeDomain === 'favs') {
            return allFlatModules.filter(m => favoriteModules.includes(m.id));
        }

        return modulesByDomain[activeDomain] || [];
    }, [activeDomain, searchQuery, favoriteModules, allFlatModules]);

    const domainCategories: { id: CommandDomain; label: string; icon: string; count: number }[] = [
        { id: 'favs', label: 'Favoritos', icon: '⭐', count: favoriteModules.length },
        { id: 'comms', label: 'Comunicaciones', icon: '💬', count: modulesByDomain.comms.length },
        { id: 'nav', label: 'Navegación & Sensores', icon: '🧭', count: modulesByDomain.nav.length },
        { id: 'survival', label: 'Supervivencia & Salud', icon: '🚨', count: modulesByDomain.survival.length },
        { id: 'security', label: 'Seguridad & Bóvedas', icon: '🛡️', count: modulesByDomain.security.length },
        { id: 'economy', label: 'Economía & Sistema', icon: '⚡', count: modulesByDomain.economy.length },
    ];

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
            background: 'linear-gradient(180deg, #050814 0%, #03050B 100%)',
            color: '#FFFFFF', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden'
        }}>
            {/* Header Táctico C4ISR */}
            <div style={{
                padding: 'calc(8px + var(--safe-top, 0px)) 16px 10px 16px',
                background: 'linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)',
                borderBottom: '1.5px solid rgba(0, 229, 255, 0.3)',
                boxShadow: '0 4px 25px rgba(0, 0, 0, 0.8)',
                display: 'flex', flexDirection: 'column', gap: '10px',
                flexShrink: 0, zIndex: 10
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '38px', height: '38px', borderRadius: '12px',
                            background: 'rgba(0, 229, 255, 0.15)', border: '1px solid rgba(0, 229, 255, 0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                            boxShadow: '0 0 15px rgba(0, 229, 255, 0.2)'
                        }}>
                            ⚡
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, letterSpacing: '0.8px', color: '#FFFFFF' }}>
                                CENTRO DE COMANDO C4ISR
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--accent-cyan, #00E5FF)', fontWeight: 800 }}>
                                SOVEREIGN MESH OPERATIONAL MATRIX
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            onClick={() => setIsSearchOpen(true)}
                            style={{
                                padding: '6px 12px', borderRadius: '10px',
                                background: 'rgba(0, 229, 255, 0.12)', border: '1px solid rgba(0, 229, 255, 0.35)',
                                color: 'var(--accent-cyan, #00E5FF)', fontSize: '0.75rem', fontWeight: 900,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <span>🔍</span> <span className="hidden sm:inline">BUSCAR</span>
                        </button>

                        <button
                            onClick={() => setShowSwarmHUD(true)}
                            style={{
                                padding: '6px 12px', borderRadius: '10px',
                                background: 'rgba(0, 230, 118, 0.12)', border: '1px solid rgba(0, 230, 118, 0.35)',
                                color: 'var(--accent-emerald, #00E676)', fontSize: '0.75rem', fontWeight: 900,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <span>🌐</span> <span className="hidden sm:inline">ENJAMBRE</span>
                        </button>
                    </div>
                </div>

                {/* Telemetry HUD Bar */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px',
                    background: 'rgba(0, 0, 0, 0.5)', padding: '8px', borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6rem', color: '#94A3B8', fontWeight: 800 }}>SIGINT RF</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: sigintTelemetry.activeEmittersCount > 0 ? '#FFB300' : '#00E676' }}>
                            {sigintTelemetry.activeEmittersCount} ACTIVAS
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ fontSize: '0.6rem', color: '#94A3B8', fontWeight: 800 }}>BALIZAS SOS</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: activeSosCount > 0 ? '#FF3355' : '#00E676' }}>
                            {activeSosCount > 0 ? `🚨 ${activeSosCount}` : '0 ALERTAS'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ fontSize: '0.6rem', color: '#94A3B8', fontWeight: 800 }}>DEFCON</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#00E5FF' }}>
                            NIVEL {shieldTelemetry.currentDefcon || 4}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ fontSize: '0.6rem', color: '#94A3B8', fontWeight: 800 }}>FAILOVERS</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#00E676' }}>
                            {swarmTelemetry.totalFailoversExecuted} EJEC
                        </div>
                    </div>
                </div>

                {/* Categorías de Dominios */}
                <div style={{
                    display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px',
                    scrollbarWidth: 'none', msOverflowStyle: 'none'
                }}>
                    {domainCategories.map(cat => {
                        const isSelected = activeDomain === cat.id && !searchQuery.trim();
                        return (
                            <button
                                key={cat.id}
                                onClick={() => { setSearchQuery(''); setActiveDomain(cat.id); }}
                                style={{
                                    padding: '7px 12px', borderRadius: '10px',
                                    background: isSelected ? 'linear-gradient(135deg, rgba(0, 229, 255, 0.22) 0%, rgba(10, 25, 45, 0.85) 100%)' : 'rgba(255, 255, 255, 0.03)',
                                    border: isSelected ? '1.5px solid var(--accent-cyan, #00E5FF)' : '1px solid rgba(255, 255, 255, 0.08)',
                                    color: isSelected ? '#00E5FF' : 'var(--text-secondary, #94A3B8)',
                                    fontSize: '0.74rem', fontWeight: isSelected ? 900 : 700,
                                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    transition: 'all 0.15s ease',
                                    boxShadow: isSelected ? '0 0 15px rgba(0, 229, 255, 0.25)' : 'none'
                                }}
                            >
                                <span>{cat.icon}</span>
                                <span>{cat.label}</span>
                                <span style={{
                                    fontSize: '0.6rem', padding: '1px 5px', borderRadius: '4px',
                                    background: isSelected ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                    fontWeight: 900
                                }}>
                                    {cat.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Grid de Módulos */}
            <div className="scroll-container" style={{
                flex: 1, padding: '16px', overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '14px', alignContent: 'start'
            }}>
                {displayedModules.map(mod => {
                    const isFav = favoriteModules.includes(mod.id);
                    return (
                        <div
                            key={mod.id}
                            onClick={() => navigate(mod.action)}
                            style={{
                                background: 'linear-gradient(135deg, rgba(16, 22, 44, 0.85) 0%, rgba(8, 12, 28, 0.95) 100%)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '16px',
                                padding: '16px',
                                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                gap: '12px', cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6)',
                                position: 'relative'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '42px', height: '42px', borderRadius: '12px',
                                        background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.12)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem'
                                    }}>
                                        {mod.icon}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.3px' }}>
                                            {mod.title}
                                        </div>
                                        {mod.badge && (
                                            <span style={{
                                                fontSize: '0.58rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px',
                                                background: `${mod.badgeColor || '#00E5FF'}18`,
                                                color: mod.badgeColor || '#00E5FF',
                                                border: `1px solid ${mod.badgeColor || '#00E5FF'}40`,
                                                display: 'inline-block', marginTop: '3px'
                                            }}>
                                                {mod.badge}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => toggleFavorite(e, mod.id)}
                                    style={{
                                        background: 'transparent', border: 'none',
                                        fontSize: '1.1rem', cursor: 'pointer', padding: '4px',
                                        color: isFav ? '#FFD600' : 'rgba(255, 255, 255, 0.2)',
                                        transition: 'all 0.15s ease'
                                    }}
                                    title={isFav ? "Quitar de favoritos" : "Fijar en favoritos"}
                                >
                                    ★
                                </button>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)', lineHeight: 1.4 }}>
                                {mod.subtitle}
                            </p>

                            <div style={{
                                display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                                paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                            }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--accent-cyan, #00E5FF)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    EJECUTAR MÓDULO →
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal de Búsqueda Global */}
            {isSearchOpen && <GlobalSearchModal onClose={() => setIsSearchOpen(false)} />}

            {/* Modal de Enjambre Multi-Bearer */}
            {showSwarmHUD && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(2, 4, 12, 0.88)', backdropFilter: 'blur(25px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
                        animation: 'fadeIn 0.2s ease'
                    }}
                    onClick={() => setShowSwarmHUD(false)}
                >
                    <div style={{ width: '100%', maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
                        <SwarmHealthHUD onClose={() => setShowSwarmHUD(false)} />
                    </div>
                </div>
            )}
        </div>
    );
};
