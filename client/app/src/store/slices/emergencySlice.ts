import { StateCreator } from 'zustand';
import { RedStore } from '../types';
import { toast } from '../../components/Toast';

export const createEmergencySlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    activeSosBeacons: [],

    activeWeatherReports: [],

    activeChannelMessages: {},

    activeVoiceBursts: [],

    setSosBeacons: (beacons: any[]) => set({ activeSosBeacons: Array.isArray(beacons) ? beacons : [] }),

    addSosBeacon: (beacon: any) => {
        const current = get().activeSosBeacons || [];
        if (!current.some((b: any) => b.id === beacon.id)) {
            set({ activeSosBeacons: [beacon, ...current] });
            toast.error(`🚨 ¡ALERTA SOS RECIBIDA! Operador: ${beacon.sender_name || 'Desconocido'}`);
        }
    },

    resolveSosBeacon: (id: string) => {
        const current = get().activeSosBeacons || [];
        set({ activeSosBeacons: current.filter((b: any) => b.id !== id) });
        toast.info("Baliza SOS resuelta por la red");
    },

    addWeatherReport: (report: any) => {
        const current = get().activeWeatherReports || [];
        if (!current.some((r: any) => r.id === report.id)) {
            set({ activeWeatherReports: [report, ...current] });
            if (report.is_storm_warning || report.severity === 'Severe' || report.severity === 'Extreme') {
                toast.warning(`⚠️ Alerta Meteorológica: ${report.phenomenon || 'Tormenta Severa'}`);
            }
        }
    },

    addChannelMessage: (msg: any) => {
        const channelId = msg.channel_id || 'red-local-general';
        const channels = { ...get().activeChannelMessages };
        const list = channels[channelId] || [];
        if (!list.some((m: any) => m.id === msg.id)) {
            channels[channelId] = [...list, msg];
            set({ activeChannelMessages: channels });
        }
    },

    addVoiceBurst: (burst: any) => {
        const current = get().activeVoiceBursts || [];
        set({ activeVoiceBursts: [burst, ...current].slice(0, 50) });
    },

    // Social Feed,
});
