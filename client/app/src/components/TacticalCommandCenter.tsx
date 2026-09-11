"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRedStore, ScreenView } from '../store/useRedStore';
import { useTranslation } from '../lib/i18n/i18nEngine';
import { globalShield } from '../lib/network/GlobalShieldEngine';
import { MonetizationEngine } from '../lib/network/MonetizationEngine';
import { meshSosBeacon } from '../lib/emergency/MeshSosBeaconEngine';
import { rfSigintWatchdog, SigintTelemetry } from '../lib/sensors/RfSigintWatchdogEngine';
import { dynamicBearerGovernor, SwarmHealthTelemetry } from '../lib/mesh/DynamicBearerGovernor';
import { dtnStorage } from '../lib/mesh/dtnStorage';
import { SwarmHealthHUD } from './SwarmHealthHUD';
import { GlobalSearchModal } from './GlobalSearchModal';
import { toast } from './Toast';
import { BackHandlerRegistry } from '../lib/navigation/BackHandlerRegistry';
import { TacticalAudioEngine } from '../lib/audio/TacticalAudioEngine';
import { TacIcon } from './ui/TacIcon';

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
    const { navigate, identity, nodeOnline, currentScreen, goBack } = useRedStore();
    const [activeDomain, setActiveDomain] = useState<CommandDomain>('favs');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [activeSosCount, setActiveSosCount] = useState<number>(0);
    const [sigintTelemetry, setSigintTelemetry] = useState<SigintTelemetry>(() => rfSigintWatchdog.getTelemetry());
    const [swarmTelemetry, setSwarmTelemetry] = useState<SwarmHealthTelemetry>(() => dynamicBearerGovernor.getTelemetry());
    const [shieldTelemetry, setShieldTelemetry] = useState(() => globalShield.getTelemetry());
    const [dtnPacketCount, setDtnPacketCount] = useState<number>(() => dtnStorage.count);
    const [showSwarmHUD, setShowSwarmHUD] = useState<boolean>(false);

    // ── Intercepción Jerárquica LIFO de navegación Atrás ───────────────────
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            if (isSearchOpen) {
                setIsSearchOpen(false);
                return true;
            }
            if (showSwarmHUD) {
                setShowSwarmHUD(false);
                return true;
            }
            if (searchQuery.trim()) {
                setSearchQuery('');
                return true;
            }
            if (activeDomain !== 'favs') {
                setActiveDomain('favs');
                return true;
            }
            if (currentScreen === 'commandCenter') {
                goBack();
                return true;
            }
            return false;
        });
        return unregister;
    }, [isSearchOpen, showSwarmHUD, searchQuery, activeDomain, currentScreen, goBack]);

    useEffect(() => {
        const unsub = globalShield.subscribe(setShieldTelemetry);
        const dtnTimer = setInterval(() => {
            setDtnPacketCount(dtnStorage.count);
        }, 2000);
        return () => {
            unsub();
            clearInterval(dtnTimer);
        };
    }, []);

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
        const isFav = favoriteModules.includes(modId);
        if (isFav) {
            TacticalAudioEngine.playTap();
        } else {
            TacticalAudioEngine.playRogerBeep();
        }
        const next = isFav
            ? favoriteModules.filter(id => id !== modId)
            : [...favoriteModules, modId];
        setFavoriteModules(next);
        try {
            localStorage.setItem("red_fav_modules", JSON.stringify(next));
        } catch {}
        toast.info(isFav ? "Módulo quitado de favoritos" : "⭐ Módulo fijado en favoritos");
    };

    const modulesByDomain: Record<Exclude<CommandDomain, 'favs'>, ModuleCardItem[]> = useMemo(() => ({
        comms: [
            {
                id: 'channels',
                action: 'channels',
                icon: '📻',
                title: t('tactical_modules.channels_title'),
                subtitle: t('tactical_modules.channels_title'),
                badge: t('tactical_modules.channels_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'walkie',
                action: 'walkie',
                icon: '🎙️',
                title: t('tactical_modules.walkie_title'),
                subtitle: t('tactical_modules.walkie_title'),
                badge: t('tactical_modules.walkie_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'call',
                action: 'call',
                icon: '📞',
                title: t('tactical_modules.call_title'),
                subtitle: t('tactical_modules.call_title'),
                badge: t('tactical_modules.call_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'groups',
                action: 'groups',
                icon: '👥',
                title: t('tactical_modules.groups_title'),
                subtitle: t('tactical_modules.groups_title'),
                badge: t('tactical_modules.groups_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'socialFeed',
                action: 'socialFeed',
                icon: '🌍',
                title: t('tactical_modules.socialFeed_title'),
                subtitle: t('tactical_modules.socialFeed_title'),
                badge: t('tactical_modules.socialFeed_badge'),
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'liveStream',
                action: 'liveStream',
                icon: '📺',
                title: t('tactical_modules.liveStream_title'),
                subtitle: t('tactical_modules.liveStream_title'),
                badge: t('tactical_modules.liveStream_badge'),
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.2)'
            },
            {
                id: 'canvas',
                action: 'canvas',
                icon: '🎨',
                title: t('tactical_modules.canvas_title'),
                subtitle: t('tactical_modules.canvas_title'),
                badge: t('tactical_modules.canvas_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'dtnStorage',
                action: 'network',
                icon: '📦',
                title: t('tactical_modules.dtnStorage_title'),
                subtitle: t('tactical_modules.dtnStorage_title'),
                badge: `${dtnPacketCount} EN COLA`,
                badgeColor: dtnPacketCount > 0 ? '#FFB300' : '#00E676',
                accentGlow: dtnPacketCount > 0 ? 'rgba(255, 179, 0, 0.2)' : 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'broadcast',
                action: 'broadcast',
                icon: '📢',
                title: t('tactical_modules.broadcast_title'),
                subtitle: t('tactical_modules.broadcast_title'),
                badge: t('tactical_modules.broadcast_badge'),
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.2)'
            },
            {
                id: 'loraTransceiver',
                action: 'loraTransceiver',
                icon: '📻',
                title: t('tactical_modules.loraTransceiver_title'),
                subtitle: t('tactical_modules.loraTransceiver_title'),
                badge: t('tactical_modules.loraTransceiver_badge'),
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'acousticWarfare',
                action: 'acousticWarfare',
                icon: '🔊',
                title: t('tactical_modules.acousticWarfare_title'),
                subtitle: t('tactical_modules.acousticWarfare_title'),
                badge: t('tactical_modules.acousticWarfare_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            }
        ],
        nav: [
            {
                id: 'radar',
                action: 'radar',
                icon: '📡',
                title: t('tactical_modules.radar_title'),
                subtitle: t('tactical_modules.radar_title'),
                badge: t('tactical_modules.radar_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'nearby',
                action: 'nearby',
                icon: '📡',
                title: t('tactical_modules.nearby_title'),
                subtitle: t('tactical_modules.nearby_title'),
                badge: t('tactical_modules.nearby_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'nodemap',
                action: 'nodemap',
                icon: '🗺️',
                title: t('tactical_modules.nodemap_title'),
                subtitle: t('tactical_modules.nodemap_title'),
                badge: t('tactical_modules.nodemap_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'offGridCompass',
                action: 'offGridCompass',
                icon: '🧭',
                title: t('tactical_modules.offGridCompass_title'),
                subtitle: t('tactical_modules.offGridCompass_title'),
                badge: t('tactical_modules.offGridCompass_badge'),
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'p2pCompass',
                action: 'p2pCompass',
                icon: '🎯',
                title: t('tactical_modules.p2pCompass_title'),
                subtitle: t('tactical_modules.p2pCompass_title'),
                badge: t('tactical_modules.p2pCompass_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'celestialPdr',
                action: 'celestialPdr',
                icon: '✨',
                title: t('tactical_modules.celestialPdr_title'),
                subtitle: t('tactical_modules.celestialPdr_title'),
                badge: t('tactical_modules.celestialPdr_badge'),
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'sonarSeismic',
                action: 'sonarSeismic',
                icon: '🦇',
                title: t('tactical_modules.sonarSeismic_title'),
                subtitle: t('tactical_modules.sonarSeismic_title'),
                badge: t('tactical_modules.sonarSeismic_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'tacticalFoxhunt',
                action: 'tacticalFoxhunt',
                icon: '🦊',
                title: t('tactical_modules.tacticalFoxhunt_title'),
                subtitle: t('tactical_modules.tacticalFoxhunt_title'),
                badge: t('tactical_modules.tacticalFoxhunt_badge'),
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'shakePair',
                action: 'shakePair',
                icon: '📳',
                title: t('tactical_modules.shakePair_title'),
                subtitle: t('tactical_modules.shakePair_title'),
                badge: t('tactical_modules.shakePair_badge'),
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'proximityWave',
                action: 'proximityWave',
                icon: '🌊',
                title: t('tactical_modules.proximityWave_title'),
                subtitle: t('tactical_modules.proximityWave_title'),
                badge: t('tactical_modules.proximityWave_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'rfSpectrum',
                action: 'rfSpectrum',
                icon: '🛡️',
                title: t('tactical_modules.rfSpectrum_title'),
                subtitle: t('tactical_modules.rfSpectrum_title'),
                badge: t('tactical_modules.rfSpectrum_badge'),
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            }
        ],
        survival: [
            {
                id: 'extremeSurvival',
                action: 'extremeSurvival',
                icon: '⚡',
                title: t('tactical_modules.extremeSurvival_title'),
                subtitle: t('tactical_modules.extremeSurvival_title'),
                badge: t('tactical_modules.extremeSurvival_badge'),
                badgeColor: '#FF1E40',
                accentGlow: 'rgba(255, 30, 64, 0.35)'
            },
            {
                id: 'vitalScan',
                action: 'vitalScan',
                icon: '🫀',
                title: t('tactical_modules.vitalScan_title'),
                subtitle: t('tactical_modules.vitalScan_title'),
                badge: t('tactical_modules.vitalScan_badge'),
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.25)'
            },
            {
                id: 'tcccBallistics',
                action: 'tcccBallistics',
                icon: '🎯',
                title: t('tactical_modules.tcccBallistics_title'),
                subtitle: t('tactical_modules.tcccBallistics_title'),
                badge: t('tactical_modules.tcccBallistics_badge'),
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.25)'
            },
            {
                id: 'survivalBeacon',
                action: 'survivalBeacon',
                icon: '🚨',
                title: t('tactical_modules.survivalBeacon_title'),
                subtitle: t('tactical_modules.survivalBeacon_title'),
                badge: t('tactical_modules.survivalBeacon_badge'),
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.25)'
            },
            {
                id: 'weather',
                action: 'weather',
                icon: '🌤️',
                title: t('tactical_modules.weather_title'),
                subtitle: t('tactical_modules.weather_title'),
                badge: t('tactical_modules.weather_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'atmosphericSafety',
                action: 'atmosphericSafety',
                icon: '💨',
                title: t('tactical_modules.atmosphericSafety_title'),
                subtitle: t('tactical_modules.atmosphericSafety_title'),
                badge: t('tactical_modules.atmosphericSafety_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'vitalResources',
                action: 'vitalResources',
                icon: '💧',
                title: t('tactical_modules.vitalResources_title'),
                subtitle: t('tactical_modules.vitalResources_title'),
                badge: t('tactical_modules.vitalResources_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'cbrnSatellite',
                action: 'cbrnSatellite',
                icon: '☢️',
                title: t('tactical_modules.cbrnSatellite_title'),
                subtitle: t('tactical_modules.cbrnSatellite_title'),
                badge: t('tactical_modules.cbrnSatellite_badge'),
                badgeColor: '#FF9100',
                accentGlow: 'rgba(255, 145, 0, 0.25)'
            },
            {
                id: 'amber',
                action: 'amber',
                icon: '🟠',
                title: t('tactical_modules.amber_title'),
                subtitle: t('tactical_modules.amber_title'),
                badge: t('tactical_modules.amber_badge'),
                badgeColor: '#FF9100',
                accentGlow: 'rgba(255, 145, 0, 0.2)'
            },
            {
                id: 'zkBarterSubsurface',
                action: 'zkBarterSubsurface',
                icon: '⚖️',
                title: t('tactical_modules.zkBarterSubsurface_title'),
                subtitle: t('tactical_modules.zkBarterSubsurface_title'),
                badge: t('tactical_modules.zkBarterSubsurface_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            }
        ],
        security: [
            {
                id: 'idVault',
                action: 'idVault',
                icon: '🪪',
                title: t('tactical_modules.idVault_title'),
                subtitle: t('tactical_modules.idVault_title'),
                badge: t('tactical_modules.idVault_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'crypto',
                action: 'crypto',
                icon: '🔐',
                title: t('tactical_modules.crypto_title'),
                subtitle: t('tactical_modules.crypto_title'),
                badge: t('tactical_modules.crypto_badge'),
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'globalShield',
                action: 'globalShield',
                icon: '🛡️',
                title: t('tactical_modules.globalShield_title'),
                subtitle: t('tactical_modules.globalShield_title'),
                badge: `DEFCON ${shieldTelemetry.currentDefcon}`,
                badgeColor: shieldTelemetry.activeProfile?.color || (shieldTelemetry.currentDefcon === 1 ? 'var(--accent-crimson)' : shieldTelemetry.currentDefcon === 2 ? '#FF8008' : shieldTelemetry.currentDefcon === 3 ? '#FFB300' : shieldTelemetry.currentDefcon === 5 ? '#00E676' : '#00E5FF'),
                accentGlow: shieldTelemetry.currentDefcon === 1 ? 'rgba(255, 51, 85, 0.2)' : shieldTelemetry.currentDefcon === 2 ? 'rgba(255, 128, 8, 0.2)' : shieldTelemetry.currentDefcon === 5 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'c4isrEmpDrill',
                action: 'c4isrEmpDrill',
                icon: '⚡',
                title: t('tactical_modules.c4isrEmpDrill_title'),
                subtitle: t('tactical_modules.c4isrEmpDrill_title'),
                badge: t('tactical_modules.c4isrEmpDrill_badge'),
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'tacticalVisionScan',
                action: 'tacticalVisionScan',
                icon: '👁️',
                title: t('tactical_modules.tacticalVisionScan_title'),
                subtitle: t('tactical_modules.tacticalVisionScan_title'),
                badge: t('tactical_modules.tacticalVisionScan_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'airGapStego',
                action: 'airGapStego',
                icon: '📷',
                title: t('tactical_modules.airGapStego_title'),
                subtitle: t('tactical_modules.airGapStego_title'),
                badge: t('tactical_modules.airGapStego_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'stegoVault',
                action: 'stegoVault',
                icon: '🖼️',
                title: t('tactical_modules.stegoVault_title'),
                subtitle: t('tactical_modules.stegoVault_title'),
                badge: t('tactical_modules.stegoVault_badge'),
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'shamirRecovery',
                action: 'shamirRecovery',
                icon: '🔑',
                title: t('tactical_modules.shamirRecovery_title'),
                subtitle: t('tactical_modules.shamirRecovery_title'),
                badge: t('tactical_modules.shamirRecovery_badge'),
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'blackout',
                action: 'blackout',
                icon: '⚡',
                title: t('tactical_modules.blackout_title'),
                subtitle: t('tactical_modules.blackout_title'),
                badge: t('tactical_modules.blackout_badge'),
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'dms',
                action: 'dms',
                icon: '💀',
                title: t('tactical_modules.dms_title'),
                subtitle: t('tactical_modules.dms_title'),
                badge: t('tactical_modules.dms_badge'),
                badgeColor: '#FF3355',
                accentGlow: 'rgba(255, 51, 85, 0.2)'
            },
            {
                id: 'calculator',
                action: 'calculator',
                icon: '🧮',
                title: t('tactical_modules.calculator_title'),
                subtitle: t('tactical_modules.calculator_title'),
                badge: t('tactical_modules.calculator_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'guardian',
                action: 'guardian',
                icon: '🛡️',
                title: t('tactical_modules.guardian_title'),
                subtitle: t('tactical_modules.guardian_title'),
                badge: t('tactical_modules.guardian_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'security',
                action: 'security',
                icon: '🛡️',
                title: t('tactical_modules.security_title'),
                subtitle: t('tactical_modules.security_title'),
                badge: t('tactical_modules.security_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'secReport',
                action: 'secReport',
                icon: '📑',
                title: t('tactical_modules.secReport_title'),
                subtitle: t('tactical_modules.secReport_title'),
                badge: t('tactical_modules.secReport_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'backup',
                action: 'backup',
                icon: '💾',
                title: t('tactical_modules.backup_title'),
                subtitle: t('tactical_modules.backup_title'),
                badge: t('tactical_modules.backup_badge'),
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'network',
                action: 'network',
                icon: '🌐',
                title: t('tactical_modules.network_title'),
                subtitle: t('tactical_modules.network_title'),
                badge: t('tactical_modules.network_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            }
        ],
        economy: [
            {
                id: 'commercialHub',
                action: 'commercialHub',
                icon: '⚡',
                title: t('tactical_modules.commercialHub_title'),
                subtitle: t('tactical_modules.commercialHub_title'),
                badge: t('tactical_modules.commercialHub_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'p2pPay',
                action: 'p2pPay',
                icon: '💳',
                title: t('tactical_modules.p2pPay_title'),
                subtitle: t('tactical_modules.p2pPay_title'),
                badge: t('tactical_modules.p2pPay_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'web3Vault',
                action: 'web3Vault',
                icon: '🦊',
                title: t('tactical_modules.web3Vault_title'),
                subtitle: t('tactical_modules.web3Vault_title'),
                badge: t('tactical_modules.web3Vault_badge'),
                badgeColor: '#FFB300',
                accentGlow: 'rgba(255, 179, 0, 0.2)'
            },
            {
                id: 'explorer',
                action: 'explorer',
                icon: '⛓️',
                title: t('tactical_modules.explorer_title'),
                subtitle: t('tactical_modules.explorer_title'),
                badge: t('tactical_modules.explorer_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'aiCopilot',
                action: 'aiCopilot',
                icon: '🧠',
                title: t('tactical_modules.aiCopilot_title'),
                subtitle: t('tactical_modules.aiCopilot_title'),
                badge: t('tactical_modules.aiCopilot_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'appStore',
                action: 'appStore',
                icon: '🏪',
                title: t('tactical_modules.appStore_title'),
                subtitle: t('tactical_modules.appStore_title'),
                badge: t('tactical_modules.appStore_badge'),
                badgeColor: '#B388FF',
                accentGlow: 'rgba(179, 136, 255, 0.2)'
            },
            {
                id: 'hyperBrowser',
                action: 'hyperBrowser',
                icon: '🌐',
                title: t('tactical_modules.hyperBrowser_title'),
                subtitle: t('tactical_modules.hyperBrowser_title'),
                badge: t('tactical_modules.hyperBrowser_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'health',
                action: 'health',
                icon: '📊',
                title: t('tactical_modules.health_title'),
                subtitle: t('tactical_modules.health_title'),
                badge: t('tactical_modules.health_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'nodeLogs',
                action: 'nodeLogs',
                icon: '📋',
                title: t('tactical_modules.nodeLogs_title'),
                subtitle: t('tactical_modules.nodeLogs_title'),
                badge: t('tactical_modules.nodeLogs_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'webCompanionLink',
                action: 'webCompanionLink',
                icon: '💻',
                title: t('tactical_modules.webCompanionLink_title'),
                subtitle: t('tactical_modules.webCompanionLink_title'),
                badge: t('tactical_modules.webCompanionLink_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'ecoMesh',
                action: 'ecoMesh',
                icon: '🔋',
                title: t('tactical_modules.ecoMesh_title'),
                subtitle: t('tactical_modules.ecoMesh_title'),
                badge: t('tactical_modules.ecoMesh_badge'),
                badgeColor: '#00E676',
                accentGlow: 'rgba(0, 230, 118, 0.2)'
            },
            {
                id: 'swarmHealthHUD',
                action: 'swarmHealthHUD',
                icon: '📶',
                title: t('tactical_modules.swarmHealthHUD_title'),
                subtitle: t('tactical_modules.swarmHealthHUD_title'),
                badge: t('tactical_modules.swarmHealthHUD_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            },
            {
                id: 'settings',
                action: 'settings',
                icon: '⚙️',
                title: t('tactical_modules.settings_title'),
                subtitle: t('tactical_modules.settings_title'),
                badge: t('tactical_modules.settings_badge'),
                badgeColor: '#94A3B8',
                accentGlow: 'rgba(148, 163, 184, 0.2)'
            },
            {
                id: 'updater',
                action: 'updater',
                icon: '🚀',
                title: t('tactical_modules.updater_title'),
                subtitle: t('tactical_modules.updater_title'),
                badge: t('tactical_modules.updater_badge'),
                badgeColor: '#00E5FF',
                accentGlow: 'rgba(0, 229, 255, 0.2)'
            }
        ]
    }), [t]);

    const allFlatModules: ModuleCardItem[] = useMemo(() => {
        return Object.values(modulesByDomain).flat();
    }, [modulesByDomain]);

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
    }, [activeDomain, searchQuery, favoriteModules, allFlatModules, modulesByDomain]);

    const domainCategories: { id: CommandDomain; label: string; icon: string; count: number }[] = [
        { id: 'favs', label: t('tactical_modules.domain_favs') || 'Favoritos', icon: '⭐', count: favoriteModules.length },
        { id: 'comms', label: t('tactical_modules.domain_comms') || 'Comunicaciones', icon: '💬', count: modulesByDomain.comms.length },
        { id: 'nav', label: t('tactical_modules.domain_nav') || 'Navegación & Sensores', icon: '🧭', count: modulesByDomain.nav.length },
        { id: 'survival', label: t('tactical_modules.domain_survival') || 'Supervivencia & Salud', icon: '🚨', count: modulesByDomain.survival.length },
        { id: 'security', label: t('tactical_modules.domain_security') || 'Seguridad & Bóvedas', icon: '🛡️', count: modulesByDomain.security.length },
        { id: 'economy', label: t('tactical_modules.domain_economy') || 'Economía & Sistema', icon: '⚡', count: modulesByDomain.economy.length },
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
                        {currentScreen === 'commandCenter' && (
                            <button
                                onClick={() => { TacticalAudioEngine.playTap(); goBack(); }}
                                className="btn-icon"
                                style={{ width: '36px', height: '36px', color: '#00E5FF' }}
                                title="Volver"
                            >
                                ←
                            </button>
                        )}
                        <div style={{
                            width: '38px', height: '38px', borderRadius: '12px',
                            background: 'rgba(0, 229, 255, 0.15)', border: '1px solid rgba(0, 229, 255, 0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 15px rgba(0, 229, 255, 0.2)'
                        }}>
                            <TacIcon name="tools" size={20} color="#00E5FF" />
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
                            onClick={() => { TacticalAudioEngine.playTap(); setIsSearchOpen(true); }}
                            style={{
                                padding: '6px 12px', borderRadius: '10px',
                                background: 'rgba(0, 229, 255, 0.12)', border: '1px solid rgba(0, 229, 255, 0.35)',
                                color: 'var(--accent-cyan, #00E5FF)', fontSize: '0.75rem', fontWeight: 900,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <TacIcon name="search" size={14} color="currentColor" /> <span className="hidden sm:inline">BUSCAR</span>
                        </button>

                        <button
                            onClick={() => { TacticalAudioEngine.playTap(); setShowSwarmHUD(true); }}
                            style={{
                                padding: '6px 12px', borderRadius: '10px',
                                background: 'rgba(0, 230, 118, 0.12)', border: '1px solid rgba(0, 230, 118, 0.35)',
                                color: 'var(--accent-emerald, #00E676)', fontSize: '0.75rem', fontWeight: 900,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <TacIcon name="globe" size={14} color="currentColor" /> <span className="hidden sm:inline">ENJAMBRE</span>
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
                        <div className="tabular-telemetry" style={{ fontSize: '0.85rem', fontWeight: 900, color: sigintTelemetry.activeEmittersCount > 0 ? '#FFB300' : '#00E676' }}>
                            {sigintTelemetry.activeEmittersCount} ACTIVAS
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ fontSize: '0.6rem', color: '#94A3B8', fontWeight: 800 }}>BALIZAS SOS</div>
                        <div className="tabular-telemetry" style={{ fontSize: '0.85rem', fontWeight: 900, color: activeSosCount > 0 ? '#FF3355' : '#00E676' }}>
                            {activeSosCount > 0 ? `🚨 ${activeSosCount}` : '0 ALERTAS'}
                        </div>
                    </div>
                    <div 
                        onClick={() => { TacticalAudioEngine.playTap(); navigate('globalShield'); }}
                        style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', cursor: 'pointer' }}
                        title="Abrir Escudo Global DEFCON"
                    >
                        <div style={{ fontSize: '0.6rem', color: '#94A3B8', fontWeight: 800 }}>DEFCON</div>
                        <div className="tabular-telemetry" style={{ fontSize: '0.85rem', fontWeight: 900, color: shieldTelemetry.activeProfile?.color || (shieldTelemetry.currentDefcon === 5 ? '#00E676' : '#00E5FF') }}>
                            NIVEL {shieldTelemetry.currentDefcon || 5}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <div style={{ fontSize: '0.6rem', color: '#94A3B8', fontWeight: 800 }}>FAILOVERS</div>
                        <div className="tabular-telemetry" style={{ fontSize: '0.85rem', fontWeight: 900, color: '#00E676' }}>
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
                                onClick={() => { TacticalAudioEngine.playTap(); setSearchQuery(''); setActiveDomain(cat.id); }}
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
                            onClick={() => { TacticalAudioEngine.playTap(); navigate(mod.action); }}
                            className="tactical-card-hud card-tactical-interactive"
                            style={{
                                background: 'linear-gradient(135deg, rgba(16, 22, 44, 0.85) 0%, rgba(8, 12, 28, 0.95) 100%)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '14px',
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
