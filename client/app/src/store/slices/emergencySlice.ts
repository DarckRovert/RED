import { StateCreator } from 'zustand';
import { RedStore, TacticalTargetPoint } from '../types';
import { toast } from '../../components/Toast';

/** Claves localStorage legacy que otros módulos aún leen como fallback */
const LS_TARGET_KEYS = ['red_active_target', 'red_tactical_target_point'] as const;

export const createEmergencySlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    activeSosBeacons: [],

    activeWeatherReports: [],

    activeChannelMessages: {},

    activeVoiceBursts: [],

    setSosBeacons: (beacons: any[]) => {
        const myHash = get().identity?.identity_hash || get().status?.identity_hash;
        const normMyHash = myHash ? myHash.toLowerCase() : '';
        const list = Array.isArray(beacons) ? beacons : [];
        const enriched = list.map((b: any) => {
            const sender = (b.sender_did || b.sender || b.issuerDid || '').toLowerCase();
            const isMine = Boolean(
                b.is_mine ||
                (normMyHash && (
                    sender === normMyHash ||
                    sender === `did:red:${normMyHash}` ||
                    (normMyHash.length >= 8 && sender.includes(normMyHash.slice(0, 12)))
                ))
            );
            return { ...b, is_mine: isMine };
        });
        set({ activeSosBeacons: enriched });
    },

    addSosBeacon: (beacon: any) => {
        const current = get().activeSosBeacons || [];
        const beaconId = beacon.id || beacon.beacon_id;
        if (!beaconId) return;

        const myHash = get().identity?.identity_hash || get().status?.identity_hash;
        const normMyHash = myHash ? myHash.toLowerCase() : '';
        const sender = (beacon.sender_did || beacon.sender || beacon.issuerDid || '').toLowerCase();
        const isMine = Boolean(
            beacon.is_mine ||
            (normMyHash && (
                sender === normMyHash ||
                sender === `did:red:${normMyHash}` ||
                (normMyHash.length >= 8 && sender.includes(normMyHash.slice(0, 12)))
            ))
        );

        const enrichedBeacon = { ...beacon, is_mine: isMine };
        const existingIdx = current.findIndex((b: any) => (b.id || b.beacon_id) === beaconId);

        if (existingIdx === -1) {
            set({ activeSosBeacons: [enrichedBeacon, ...current] });
            if (!isMine) {
                toast.error(`🚨 ¡ALERTA SOS RECIBIDA! Operador: ${beacon.sender_name || 'Desconocido'}`);
            }
        } else {
            const existing = current[existingIdx];
            const isNewer = !existing.timestamp || !beacon.timestamp || beacon.timestamp >= existing.timestamp;
            if (isNewer) {
                const updated = [...current];
                updated[existingIdx] = {
                    ...existing,
                    ...enrichedBeacon,
                    lat: beacon.lat ?? existing.lat,
                    lon: beacon.lon ?? existing.lon,
                    altitude: beacon.altitude ?? existing.altitude,
                };
                set({ activeSosBeacons: updated });
            }
        }
    },

    resolveSosBeacon: (id: string) => {
        const current = get().activeSosBeacons || [];
        const prevCount = current.length;
        const filtered = current.filter((b: any) => 
            b.id !== id && 
            b.beacon_id !== id &&
            (id.startsWith('did:red:') ? b.sender_did !== id : (b.sender_did !== `did:red:${id}` && b.sender_did !== id))
        );
        if (filtered.length !== prevCount) {
            set({ activeSosBeacons: filtered });
            toast.info("Baliza SOS resuelta por la red");
        }
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
        if (!current.some((b: any) => b.id === burst.id)) {
            set({ activeVoiceBursts: [burst, ...current].slice(0, 50) });
        }
    },

    removeVoiceBurst: (id: string) => {
        const current = get().activeVoiceBursts || [];
        set({ activeVoiceBursts: current.filter((b: any) => b.id !== id) });
    },

    setVoiceBursts: (bursts: any[]) => {
        set({ activeVoiceBursts: Array.isArray(bursts) ? bursts.slice(0, 50) : [] });
    },

    // Social Feed,

    // ── Tactical Target (Blanco Táctico) ─────────────────────────────────────
    tacticalTarget: null,

    setTacticalTarget: (target: TacticalTargetPoint | null, source?: string) => {
        const enriched: TacticalTargetPoint | null = target
            ? { ...target, source: source ?? target.source }
            : null;

        set({ tacticalTarget: enriched });

        // Backward-compat: mantener las claves legacy sincronizadas para módulos
        // que aún leen localStorage directamente. Se migrarán de forma incremental.
        try {
            if (enriched) {
                const serialized = JSON.stringify(enriched);
                LS_TARGET_KEYS.forEach(k => localStorage.setItem(k, serialized));
            } else {
                LS_TARGET_KEYS.forEach(k => localStorage.removeItem(k));
            }
        } catch {}
    },

    clearTacticalTarget: () => {
        set({ tacticalTarget: null });
        try {
            LS_TARGET_KEYS.forEach(k => localStorage.removeItem(k));
        } catch {}
    },
});

