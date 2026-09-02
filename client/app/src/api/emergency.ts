import { AmberAlert, AmberAlertCreate, AmberSighting, SosBeacon, TriageReport, TriageReportRecord, EmergencyBeaconRecord } from './types';
import { fetchWithFallback, getStored, setStored, hashStringSha256, sha256Hex, stripExifCanvas, STORAGE_KEYS } from './core';
import { RedAPI } from './client';

export async function getAmberAlerts(): Promise<AmberAlert[]> {
    const res = await fetchWithFallback<any>('/api/amber/alerts', undefined, () => {
        const alerts = getStored<AmberAlert[]>(STORAGE_KEYS.AMBER_ALERTS, []);
        const nowSecs = Math.floor(Date.now() / 1000);
        return alerts.filter(a => a.status === 'Active' && (!a.expires_at || a.expires_at > nowSecs));
    });
    if (Array.isArray(res)) return res;
    if (res && typeof res === 'object') {
        if (Array.isArray(res.alerts)) return res.alerts;
        if (Array.isArray(res.value)) return res.value;
    }
    return [];
}

/** Obtener alerta específica por ID (incluye foto) */
export async function getAmberAlert(id: string): Promise<AmberAlert> {
    return fetchWithFallback(`/api/amber/alerts/${id}`, undefined, () => {
        const alerts = getStored<AmberAlert[]>(STORAGE_KEYS.AMBER_ALERTS, []);
        const found = alerts.find(a => a.id === id);
        if (found) return found;
        throw new Error(`AMBER alert ${id} no encontrada`);
    });
}

/** Crear nueva alerta AMBER (requiere autoridad) */
export async function createAmberAlert(payload: AmberAlertCreate): Promise<{ ok: boolean; alert: AmberAlert }> {
    return fetchWithFallback('/api/amber/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, async () => {
        const identity = await RedAPI.getIdentity();
        if (!identity || !identity.identity_hash) {
            throw new Error('Identidad de nodo requerida para emitir alerta AMBER');
        }
        const now = Date.now();
        const idHash = await hashStringSha256(`amber_${now}_${payload.name}`);

        const isNullIsland = (typeof payload.last_seen_lat === 'number' && typeof payload.last_seen_lon === 'number')
            && (Math.abs(payload.last_seen_lat) < 0.0001 && Math.abs(payload.last_seen_lon) < 0.0001);

        const safeLat = (!isNullIsland && typeof payload.last_seen_lat === 'number' && isFinite(payload.last_seen_lat))
            ? payload.last_seen_lat : undefined;
        const safeLon = (!isNullIsland && typeof payload.last_seen_lon === 'number' && isFinite(payload.last_seen_lon))
            ? payload.last_seen_lon : undefined;

        const alert: AmberAlert = {
            id: `amber_${now}_${idHash.slice(0, 8)}`,
            name: payload.name,
            age: payload.age,
            description: payload.description,
            photo_b64: payload.photo_b64,
            last_seen_lat: safeLat,
            last_seen_lon: safeLon,
            last_seen_location: payload.last_seen_location,
            issued_at: Math.floor(now / 1000),
            expires_at: Math.floor(now / 1000) + (payload.ttl_secs || 86400),
            authority_node_id: payload.authority_node_id || `did:red:${identity.identity_hash.slice(0, 12)}`,
            authority_signature: payload.authority_signature || identity.public_key || identity.identity_hash,
            status: 'Active',
            sighting_count: 0,
        };
        const alerts = getStored<AmberAlert[]>(STORAGE_KEYS.AMBER_ALERTS, []);
        alerts.unshift(alert);
        if (alerts.length > 200) alerts.length = 200;
        setStored(STORAGE_KEYS.AMBER_ALERTS, alerts);

        // Broadcast AMBER alert across P2P Mesh
        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: alert.id,
                msg_type: 'amber_alert',
                alert,
                timestamp: alert.issued_at
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch {}

        return { ok: true, alert };
    });
}

/** Resolver alerta (persona encontrada) */
export async function resolveAmberAlert(
    id: string,
    payload: { authority_node_id: string; authority_signature: string; resolution_notes?: string }
): Promise<{ ok: boolean; alert: AmberAlert }> {
    return fetchWithFallback(`/api/amber/alerts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, () => {
        const alerts = getStored<AmberAlert[]>(STORAGE_KEYS.AMBER_ALERTS, []);
        const target = alerts.find(a => a.id === id);
        if (!target) throw new Error(`Alerta AMBER ${id} no existe`);
        target.status = 'Resolved';
        target.resolution_notes = payload.resolution_notes;
        setStored(STORAGE_KEYS.AMBER_ALERTS, alerts);
        return { ok: true, alert: target };
    });
}

/** Reportar avistamiento */
export async function reportSighting(
    alertId: string,
    payload: { lat?: number; lon?: number; notes?: string }
): Promise<{ ok: boolean }> {
    return fetchWithFallback(`/api/amber/alerts/${alertId}/sighting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, () => {
        const alerts = getStored<AmberAlert[]>(STORAGE_KEYS.AMBER_ALERTS, []);
        const target = alerts.find(a => a.id === alertId);
        if (target) {
            target.sighting_count = (target.sighting_count || 0) + 1;
            setStored(STORAGE_KEYS.AMBER_ALERTS, alerts);
        }
        return { ok: true };
    });
}

// ─── v19.0: Funciones API Guardian ───────────────────────────────────────────


export async function emitSos(payload: {
    sender_name: string;
    lat?: number;
    lon?: number;
    altitude?: number;
    battery_level: number;
    note: string;
}): Promise<{ ok: boolean; sos: SosBeacon }> {
    return fetchWithFallback('/api/sos/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, async () => {
        const identity = await RedAPI.getIdentity();
        if (!identity || !identity.identity_hash) {
            throw new Error('Identidad de nodo no inicializada para emitir baliza SOS');
        }
        const now = Date.now();
        const sender_did = `did:red:${identity.identity_hash.slice(0, 12)}`;
        
        let battLevel = payload.battery_level;
        if (!battLevel && typeof navigator !== 'undefined' && 'getBattery' in navigator) {
            try {
                const b: any = await (navigator as any).getBattery();
                battLevel = Math.round((b.level || 1) * 100);
            } catch {}
        }

        const isNullIsland = (typeof payload.lat === 'number' && typeof payload.lon === 'number')
            && (Math.abs(payload.lat) < 0.0001 && Math.abs(payload.lon) < 0.0001);

        const safeLat = (!isNullIsland && typeof payload.lat === 'number' && isFinite(payload.lat))
            ? payload.lat : undefined;
        const safeLon = (!isNullIsland && typeof payload.lon === 'number' && isFinite(payload.lon))
            ? payload.lon : undefined;
        const safeAlt = (typeof payload.altitude === 'number' && isFinite(payload.altitude))
            ? payload.altitude : undefined;

        const idHash = await sha256Hex(`sos_${now}_${sender_did}`);
        const sos: SosBeacon = {
            id: `sos_${now}_${idHash.slice(0, 8)}`,
            sender_did,
            sender_name: payload.sender_name || identity.nickname || 'Operador',
            lat: safeLat,
            lon: safeLon,
            altitude: safeAlt,
            timestamp: now,
            battery_level: battLevel || 100,
            note: payload.note || 'ALERTA SOS SOLICITANDO AUXILIO',
            is_active: true,
            signature: await sha256Hex(`sos_${now}_${safeLat ?? 'none'}_${safeLon ?? 'none'}`),
        };
        const beacons = getStored<SosBeacon[]>(STORAGE_KEYS.SOS_BEACONS, []);
        beacons.unshift(sos);
        if (beacons.length > 200) beacons.length = 200;
        setStored(STORAGE_KEYS.SOS_BEACONS, beacons);

        // Broadcast SOS packet across P2P Mesh
        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: sos.id,
                msg_type: 'sos_beacon',
                beacon: sos,
                sender: sos.sender_did,
                timestamp: sos.timestamp
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch {}

        return { ok: true, sos };
    });
}

/** Desactivar baliza SOS */
export async function resolveSos(sosId: string): Promise<{ ok: boolean; resolved: boolean }> {
    return fetchWithFallback(`/api/sos/resolve/${sosId}`, { method: 'POST' }, async () => {
        const beacons = getStored<SosBeacon[]>(STORAGE_KEYS.SOS_BEACONS, []);
        const target = beacons.find(b => b.id === sosId);
        if (target) {
            target.is_active = false;
            setStored(STORAGE_KEYS.SOS_BEACONS, beacons);
        }

        // Broadcast resolution packet across P2P Mesh
        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: `resolve_${sosId}`,
                msg_type: 'sos_resolve',
                sos_id: sosId,
                timestamp: Date.now()
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch {}

        return { ok: true, resolved: true };
    });
}

export async function getActiveSos(): Promise<SosBeacon[]> {
    const res = await fetchWithFallback<any>('/api/sos/active', undefined, () => {
        const beacons = getStored<SosBeacon[]>(STORAGE_KEYS.SOS_BEACONS, []);
        return beacons.filter(b => b.is_active);
    });
    if (Array.isArray(res)) return res;
    if (res && typeof res === 'object') {
        if (Array.isArray(res.active_beacons)) return res.active_beacons;
        if (Array.isArray(res.beacons)) return res.beacons;
        if (Array.isArray(res.value)) return res.value;
    }
    return [];
}

/** Obtener mensajes de canal público local */

export async function getEmergencyBeacons(): Promise<EmergencyBeaconRecord[]> {
    return fetchWithFallback('/api/emergency/beacons', undefined, () => {
        return getStored<EmergencyBeaconRecord[]>(STORAGE_KEYS.EMERGENCY_BEACONS, []);
    });
}

export async function broadcastEmergencyBeacon(beacon: EmergencyBeaconRecord): Promise<EmergencyBeaconRecord> {
    return fetchWithFallback('/api/emergency/beacons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(beacon)
    }, async () => {
        const list = getStored<EmergencyBeaconRecord[]>(STORAGE_KEYS.EMERGENCY_BEACONS, []);
        const id = beacon.beacon_id || `sos_${Date.now()}`;
        const record: EmergencyBeaconRecord = { ...beacon, beacon_id: id, timestamp: beacon.timestamp || Date.now(), active: true };
        list.unshift(record);
        setStored(STORAGE_KEYS.EMERGENCY_BEACONS, list);

        // Broadcast SOS packet across P2P Mesh
        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: record.beacon_id,
                msg_type: 'emergency_beacon',
                beacon: record,
                sender: beacon.sender_did || 'did:red:sos',
                timestamp: record.timestamp
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch (e) {}

        return record;
    });
}

export async function cancelEmergencyBeacon(id: string): Promise<{ ok: boolean; cancelled: string }> {
    return fetchWithFallback('/api/emergency/beacons/' + id + '/cancel', { method: 'POST' }, async () => {
        const list = getStored<EmergencyBeaconRecord[]>(STORAGE_KEYS.EMERGENCY_BEACONS, []);
        const updated = list.map(b => b.beacon_id === id ? { ...b, active: false } : b);
        setStored(STORAGE_KEYS.EMERGENCY_BEACONS, updated);

        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: `cancel_${id}`,
                msg_type: 'emergency_beacon_cancel',
                beacon_id: id,
                timestamp: Date.now()
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch (e) {}

        return { ok: true, cancelled: id };
    });
}

// --- Triage Reports Engine ---
export async function getTriageReports(): Promise<TriageReportRecord[]> {
    return fetchWithFallback('/api/triage/reports', undefined, () => {
        return getStored<TriageReportRecord[]>(STORAGE_KEYS.TRIAGE_REPORTS, []);
    });
}

export async function saveTriageReport(report: TriageReportRecord): Promise<TriageReportRecord> {
    return fetchWithFallback('/api/triage/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
    }, async () => {
        const list = getStored<TriageReportRecord[]>(STORAGE_KEYS.TRIAGE_REPORTS, []);
        const id = report.id || report.report_id || `triage_${Date.now()}`;
        const record: TriageReportRecord = { ...report, id, report_id: id, timestamp: report.timestamp || Date.now() };
        list.unshift(record);
        setStored(STORAGE_KEYS.TRIAGE_REPORTS, list);

        // Broadcast triage report across mesh
        try {
            const { meshRouter } = await import('../lib/mesh/meshRouter');
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: record.id,
                msg_type: 'triage_report',
                report: record,
                timestamp: record.timestamp
            }));
            await meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', payloadBytes);
        } catch (e) {}

        return record;
    });
}

export async function deleteTriageReport(id: string): Promise<{ ok: boolean; deleted: string }> {
    return fetchWithFallback('/api/triage/reports/' + id, { method: 'DELETE' }, () => {
        const list = getStored<TriageReportRecord[]>(STORAGE_KEYS.TRIAGE_REPORTS, []);
        setStored(STORAGE_KEYS.TRIAGE_REPORTS, list.filter(r => r.id !== id && r.report_id !== id));
        return { ok: true, deleted: id };
    });
}

// --- Decentralized Social Posts ---
