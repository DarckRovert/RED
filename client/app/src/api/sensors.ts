// RED Hardware, Sensors, Weather, Battery & RF Spectrum API

import { WeatherReport, ProximityNode, EphemeralConfig, EcoMeshStatus, ProximityFilterConfig, ProximityDigest, RustLogEntry, BlackoutStatusResponse, RfMetricsResponse, NativeBarometerResult } from './types';
import { fetchWithFallback, getStored, setStored, hashStringSha256, sha256Hex, STORAGE_KEYS } from './core';
import { RedAPI } from './client';

export async function postWeatherReport(payload: {
    sender_name: string;
    pressure_hpa: number;
    temperature_c?: number;
    humidity_percent?: number;
    condition_summary: string;
    is_disaster_alert: boolean;
}): Promise<{ ok: boolean; report: WeatherReport }> {
    return fetchWithFallback('/api/weather/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, async () => {
        const now = Date.now();
        const identity = await RedAPI.getIdentity().catch(() => null);
        const sender_did = identity ? `did:red:${identity.identity_hash.slice(0, 12)}` : 'did:red:local_node';

        const wxHash = await sha256Hex(`wx_${now}_${payload.pressure_hpa}`);
        const report: WeatherReport = {
            id: `wx_${now}_${wxHash.slice(0, 8)}`,
            sender_did,
            sender_name: payload.sender_name || (identity && identity.nickname ? identity.nickname : 'Nodo Local'),
            pressure_hpa: payload.pressure_hpa,
            temperature_c: payload.temperature_c,
            humidity_percent: payload.humidity_percent,
            condition_summary: payload.condition_summary || 'Reporte Manual Sensor',
            is_disaster_alert: payload.is_disaster_alert || false,
            timestamp: now,
        };
        const reports = getStored<WeatherReport[]>(STORAGE_KEYS.WEATHER_REPORTS, []);
        reports.unshift(report);
        setStored(STORAGE_KEYS.WEATHER_REPORTS, reports.slice(0, 30));

        // Mesh broadcast to weather monitors & CAP alert banners
        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: report.id,
                msg_type: 'weather_report',
                report,
                sender: sender_did,
                timestamp: now
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch (e) {}

        return { ok: true, report };
    });
}

/** Obtener boletines climáticos locales */
export async function getWeatherReports(): Promise<WeatherReport[]> {
    const res = await fetchWithFallback<any>('/api/weather/reports', undefined, () => {
        return getStored<WeatherReport[]>(STORAGE_KEYS.WEATHER_REPORTS, []);
    });
    if (Array.isArray(res)) return res;
    if (res && typeof res === 'object' && Array.isArray(res.reports)) return res.reports;
    if (res && typeof res === 'object' && Array.isArray(res.value)) return res.value;
    return [];
}

// ─── v22.0: Interfaces & API Discovery + Ephemeral + Battery ──────────────────




/** Obtener nodos por proximidad zero-touch (<5m) desde peers P2P conectados reales */
export async function getProximityNodes(): Promise<ProximityNode[]> {
    const res = await fetchWithFallback<any>('/api/discovery/proximity', undefined, async () => {
        const peers = await RedAPI.getPeers().catch(() => []);
        let storeContacts: any[] = [];
        if (typeof window !== 'undefined') {
            try {
                const { useRedStore } = await import('../store/useRedStore');
                storeContacts = useRedStore.getState().contacts || [];
            } catch {}
        }

        if (peers.length > 0) {
            return peers.map(p => {
                const matched = storeContacts.find((c: any) => c.identity_hash === p.id || (c.identity_hash && p.id.startsWith(c.identity_hash)));
                const name = matched?.display_name || `Nodo Peer (${p.id.slice(0, 8)})`;
                // BUG-5 Fix: latencia TCP ≠ distancia física. Sin hardware BLE real → null.
                return {
                    identity_hash: p.id,
                    display_name: name,
                    rssi_dbm: null,         // null = sin medición BLE real
                    distance_meters: null,  // null = sin ranging hardware
                    transport: p.transport || 'P2P Mesh',
                    last_seen: Date.now(),
                };
            });
        }

        if (storeContacts.length > 0) {
            return storeContacts.map((c: any) => ({
                identity_hash: c.identity_hash,
                display_name: c.display_name || `Contacto (${c.identity_hash.slice(0, 8)})`,
                rssi_dbm: null,        // Sin hardware BLE: no inventar RSSI
                distance_meters: null, // Sin ranging: no inventar distancia
                transport: 'BLE / WiFi Direct',
                last_seen: Date.now(),
            }));
        }

        return [];
    });
    if (Array.isArray(res)) return res;
    if (res && typeof res === 'object') {
        if (Array.isArray(res.proximity_nodes)) return res.proximity_nodes;
        if (Array.isArray(res.nodes)) return res.nodes;
        if (Array.isArray(res.value)) return res.value;
    }
    return [];
}

/** Iniciar saludo P2P instantáneo de proximidad */
export async function triggerWaveHandshake(targetIdentityHash: string): Promise<{ ok: boolean; wave_handshake: ProximityNode }> {
    return fetchWithFallback('/api/discovery/wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_identity_hash: targetIdentityHash }),
    }, async () => {
        let contactName = `Nodo (${targetIdentityHash.slice(0, 8)})`;
        if (typeof window !== 'undefined') {
            try {
                const { useRedStore } = await import('../store/useRedStore');
                const contacts = useRedStore.getState().contacts || [];
                const matched = contacts.find((c: any) => c.identity_hash === targetIdentityHash || targetIdentityHash.startsWith(c.identity_hash));
                if (matched?.display_name) contactName = matched.display_name;
            } catch {}
        }

        // BUG-6 Fix: Sin hardware BLE real, no inventar RSSI ni distancia.
        const wave_handshake: ProximityNode = {
            identity_hash: targetIdentityHash,
            display_name: contactName,
            rssi_dbm: null,        // Requiere medición BLE hardware real
            distance_meters: null, // Requiere UWB/BLE ranging real
            transport: 'BLE Handshake',
            last_seen: Date.now(),
        };
        return { ok: true, wave_handshake };
    });
}

/** Configurar temporizador efímero de autodestrucción */
export async function setEphemeralTimer(config: EphemeralConfig): Promise<{ ok: boolean; config: EphemeralConfig }> {
    return fetchWithFallback('/api/ephemeral/set_timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    }, () => {
        setStored(STORAGE_KEYS.EPHEMERAL_CONFIG, config);
        return { ok: true, config };
    });
}

/** Consultar estado Eco-Mesh y resiliencia de batería leyéndola en tiempo real */
export async function getBatteryStatus(): Promise<EcoMeshStatus> {
    return fetchWithFallback('/api/battery/status', undefined, async () => {
        let level = 85;

        try {
            const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
            if (cap && cap.Plugins && cap.Plugins.Device) {
                const info = await cap.Plugins.Device.getBatteryInfo();
                if (info && typeof info.batteryLevel === 'number') {
                    level = Math.round(info.batteryLevel * 100);
                }
            }
        } catch {}

        if (level === 85 && typeof navigator !== 'undefined' && 'getBattery' in navigator) {
            try {
                const b: any = await (navigator as any).getBattery();
                level = Math.round((b.level || 1) * 100);
            } catch {}
        }
        const isLow = level < 20;
        return {
            battery_level: level,
            ble_scan_interval_ms: isLow ? 10000 : 3000,
            lora_tx_power_dbm: isLow ? 10 : 14,
            estimated_mesh_hours: Math.round((level / 100) * (isLow ? 52 : 36)),
            eco_mode_enabled: true,
        };
    });
}

/** Actualizar nivel de batería y recalcular ciclo Eco-Mesh */
export async function updateBatteryOptimize(batteryLevel: number): Promise<{ ok: boolean; battery_status: EcoMeshStatus }> {
    return fetchWithFallback('/api/battery/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battery_level: batteryLevel }),
    }, () => {
        const isLow = batteryLevel < 20;
        const battery_status: EcoMeshStatus = {
            battery_level: batteryLevel,
            ble_scan_interval_ms: isLow ? 10000 : 3000,
            lora_tx_power_dbm: isLow ? 10 : 14,
            estimated_mesh_hours: Math.round((batteryLevel / 100) * (isLow ? 52 : 36)),
            eco_mode_enabled: true,
        };
        return { ok: true, battery_status };
    });
}

// ─── v23.0: Interfaces & API Proximity Anti-Spam & Stealth Guard ───────────────




/** Obtener configuración de filtro anti-spam de proximidad */
export async function getDiscoveryConfig(): Promise<ProximityFilterConfig> {
    return fetchWithFallback('/api/discovery/config', undefined, () => {
        return getStored<ProximityFilterConfig>(STORAGE_KEYS.DISCOVERY_CONFIG, {
            cooldown_seconds: 30,
            rssi_threshold_dbm: -75,
            stealth_mode: 'vibrate',
            digest_enabled: true,
            safe_zones: [],
        });
    });
}

/** Actualizar configuración de filtro anti-spam y Modo Sigilo */
export async function setDiscoveryConfig(config: ProximityFilterConfig): Promise<{ ok: boolean; config: ProximityFilterConfig }> {
    return fetchWithFallback('/api/discovery/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    }, () => {
        setStored(STORAGE_KEYS.DISCOVERY_CONFIG, config);
        return { ok: true, config };
    });
}

/** Obtener resumen por lote de proximidad */
export async function getDiscoveryDigest(): Promise<ProximityDigest> {
    return fetchWithFallback('/api/discovery/digest', undefined, async () => {
        const nodes = await getProximityNodes();
        return {
            total_nodes_detected: nodes.length,
            nodes_summary: nodes.length > 0 ? nodes.map(n => `${n.display_name} (${n.distance_meters}m)`) : ['Sin nodos en rango de proximidad'],
            timestamp: Date.now(),
            is_in_safe_zone: false,
        };
    });
}

// ─── v30.0: Interfaces & API AI Copilot + Summarizer + Translator ──────────────




/** Consultar al Copiloto / Asistente Táctico de Emergencia Offline */

export async function getBlackoutStatus(): Promise<BlackoutStatusResponse> {
    return fetchWithFallback('/api/blackout/status', undefined, () => {
        return getStored<BlackoutStatusResponse>(STORAGE_KEYS.BLACKOUT_STATUS, {
            is_blackout: false,
            isolated_wan: false,
            active_transports: ['BLE', 'WiFi_Direct', 'SoundMesh'],
            epidemic_ttl: 3
        });
    });
}

export async function setBlackoutMode(mode: boolean | { mode: boolean }): Promise<BlackoutStatusResponse> {
    const isEnabled = typeof mode === 'boolean' ? mode : !!mode?.mode;
    return fetchWithFallback('/api/blackout/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: isEnabled })
    }, () => {
        const status: BlackoutStatusResponse = {
            is_blackout: isEnabled,
            isolated_wan: isEnabled,
            active_transports: isEnabled ? ['BLE', 'SoundMesh'] : ['BLE', 'WiFi_Direct', 'SoundMesh', 'WAN'],
            epidemic_ttl: isEnabled ? 7 : 3
        };
        setStored(STORAGE_KEYS.BLACKOUT_STATUS, status);
        return status;
    });
}

// --- DMS Extensions ---


export async function pingDmsActivity(): Promise<{ success: boolean; last_active_timestamp: number }> {
    return fetchWithFallback('/api/settings/dms/ping', { method: 'POST' }, () => {
        const now = Math.floor(Date.now() / 1000);
        const cfg = getStored<any>(STORAGE_KEYS.DMS_CONFIG, {});
        cfg.last_active_timestamp = now;
        setStored(STORAGE_KEYS.DMS_CONFIG, cfg);
        return { success: true, last_active_timestamp: now };
    });
}

export async function panicWipe(): Promise<{ success: boolean; wiped: boolean }> {
    return fetchWithFallback('/api/settings/dms/panic_wipe', { method: 'POST' }, () => {
        try {
            if (typeof window !== 'undefined') {
                const preserveKeys = ['red_node_url', 'red_p2p_power_mode'];
                const saved: Record<string, string | null> = {};
                preserveKeys.forEach(k => { saved[k] = localStorage.getItem(k); });
                localStorage.clear();
                sessionStorage.clear();
                preserveKeys.forEach(k => { if (saved[k]) localStorage.setItem(k, saved[k]!); });
            }
        } catch {}
        return { success: true, wiped: true };
    });
}

// --- NodeLogs Extensions ---

export async function getNodeLogs(count?: number): Promise<RustLogEntry[]> {
    return fetchWithFallback('/api/logs?count=' + (count || 100), undefined, () => {
        const logs = getStored<RustLogEntry[]>(STORAGE_KEYS.NODE_LOGS, []);
        return logs.slice(-(count || 100));
    });
}

// --- Voice Extensions ---

export async function getRfMetrics(): Promise<RfMetricsResponse> {
    return fetchWithFallback('/api/network/rf_metrics', undefined, () => {
        const cfg = getStored<any>(STORAGE_KEYS.RF_CONFIG, { channel: 1, fec_mode: '4/8 (Reed-Solomon)', total_hops: 0 });
        const ch = cfg.channel || 1;
        return {
            active_channel: ch,
            frequency_mhz: 915.0 + (ch - 1) * 0.5,
            noise_floor_dbm: -114,
            fec_mode: cfg.fec_mode || '4/8 (Reed-Solomon)',
            packets_transmitted: 0,
            packets_received: 0,
            crc_errors: 0,
            current_channel_mhz: 915.0 + (ch - 1) * 0.5,
            total_hops_count: cfg.total_hops || 0
        };
    });
}

export async function triggerChannelHop(channel?: number): Promise<any> {
    return fetchWithFallback('/api/network/rf/channel_hop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel })
    }, () => {
        const cfg = getStored<any>(STORAGE_KEYS.RF_CONFIG, { channel: 1, fec_mode: '4/8 (Reed-Solomon)', total_hops: 0 });
        const target = channel || ((cfg.channel % 8) + 1);
        cfg.channel = target;
        cfg.total_hops = (cfg.total_hops || 0) + 1;
        setStored(STORAGE_KEYS.RF_CONFIG, cfg);
        return { ok: true, new_channel: target, frequency_mhz: 915.0 + (target - 1) * 0.5 };
    });
}

export async function setRfFecMode(mode: string): Promise<any> {
    return fetchWithFallback('/api/network/rf/fec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
    }, () => {
        const cfg = getStored<any>(STORAGE_KEYS.RF_CONFIG, { channel: 1, fec_mode: '4/8 (Reed-Solomon)', total_hops: 0 });
        cfg.fec_mode = mode;
        setStored(STORAGE_KEYS.RF_CONFIG, cfg);
        return { ok: true, fec_mode: mode };
    });
}

export async function broadcastShakePair(name?: string): Promise<any> {
    return fetchWithFallback('/api/proximity/shake_pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_name: name })
    }, () => {
        return {
            success: true,
            sender_name: name || 'Operador RED',
            sender_hash: 'did:red:local',
            timestamp: Date.now()
        };
    });
}

// --- Stego Vault Capsule Engine ---

export async function getNativeBarometerReading(): Promise<NativeBarometerResult> {
    try {
        if (typeof window !== 'undefined') {
            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const plugin = registerPlugin<any>('RedNode');
                const reading = await plugin.getBarometerSensor();
                if (reading && reading.available) {
                    return {
                        value: reading.pressure_hpa || reading.value,
                        unit: 'hPa',
                        available: true,
                        pressure_hpa: reading.pressure_hpa || reading.value,
                        sensor_name: reading.sensor_name || 'Android Sensor.TYPE_PRESSURE',
                        accuracy: reading.accuracy
                    };
                }
            }
        }
    } catch {}

    return {
        value: 0,
        unit: 'hPa',
        available: false,
        pressure_hpa: 0,
        sensor_name: 'Sensor Barométrico No Disponible'
    };
}

export async function getNativeThermometerReading(): Promise<any> {
    try {
        if (typeof window !== 'undefined') {
            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const plugin = registerPlugin<any>('RedNode');
                const reading = await plugin.getThermometerSensor();
                if (reading && reading.available) {
                    return {
                        value: reading.value,
                        unit: '°C',
                        available: true,
                        sensor_name: reading.sensor_name || 'Sensor.TYPE_AMBIENT_TEMPERATURE'
                    };
                }
            }
        }
    } catch {}

    return {
        value: null,
        unit: '°C',
        available: false,
        sensor_name: 'Sensor Térmico No Disponible'
    };
}

export async function getNativeHygrometerReading(): Promise<any> {
    try {
        if (typeof window !== 'undefined') {
            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const plugin = registerPlugin<any>('RedNode');
                const reading = await plugin.getHygrometerSensor();
                if (reading && reading.available) {
                    return {
                        value: reading.value,
                        unit: '%',
                        available: true,
                        sensor_name: reading.sensor_name || 'Sensor.TYPE_RELATIVE_HUMIDITY'
                    };
                }
            }
        }
    } catch {}

    return {
        value: null,
        unit: '%',
        available: false,
        sensor_name: 'Higrómetro No Disponible'
    };
}

export async function getNativeCompassReading(): Promise<any> {
    try {
        if (typeof window !== 'undefined') {
            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const plugin = registerPlugin<any>('RedNode');
                const reading = await plugin.getCompassSensor();
                if (reading && reading.available) {
                    return {
                        azimuth: reading.azimuth || reading.heading || 0,
                        available: true,
                        sensor_name: 'Sensor.TYPE_ROTATION_VECTOR'
                    };
                }
            }
        }
    } catch {}

    return {
        azimuth: 0,
        available: false,
        sensor_name: 'Brújula No Disponible'
    };
}

