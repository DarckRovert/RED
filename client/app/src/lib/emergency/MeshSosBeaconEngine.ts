/**
 * MeshSosBeaconEngine.ts — RED Sovereign Multi-Hop Emergency SOS Distress Beacon Engine
 * 
 * Manages active emergency beacons, automated periodic SOS heartbeats, TCCC triage encoding,
 * and high-priority mesh flooding with DTN store-and-forward persistence.
 */

import { meshRouter } from '../mesh/meshRouter';
import { dtnStorage } from '../mesh/dtnStorage';
import { forensicBlackBox } from '../security/ForensicBlackBoxEngine';

export type SosDistressType = 'TCCC_MEDICAL' | 'SEARCH_RESCUE' | 'EVACUATION' | 'NATURAL_DISASTER' | 'GENERAL_DISTRESS';
export type TriageColor = 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';

export interface SosBeaconPacket {
    id: string;
    issuerDid: string;
    issuerName: string;
    coords: {
        lat?: number;
        lon?: number;
        alt?: number;
    };
    distressType: SosDistressType;
    triageColor: TriageColor;
    note: string;
    batteryLevel: number;
    timestamp: number;
    active: boolean;
    hopCount: number;
    signature?: string;
}

const STORAGE_ACTIVE_SOS_KEY = 'red_active_sos_beacon_v1';
const STORAGE_RECEIVED_BEACONS_KEY = 'red_received_mesh_beacons_v1';

export class MeshSosBeaconEngine {
    private static instance: MeshSosBeaconEngine | null = null;
    private myBeacon: SosBeaconPacket | null = null;
    private meshBeacons: Map<string, SosBeaconPacket> = new Map();
    private heartbeatTimer: any = null;
    private listeners: Set<() => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            this.loadState();
            this.startHeartbeatLoop();
            this.listenToMesh();
        }
    }

    private listenToMesh() {
        try {
            meshRouter.onLocalDelivery(async (packet) => {
                try {
                    const text = new TextDecoder().decode(packet.payload);
                    if (text.startsWith('SOS_BEACON_V1:')) {
                        const jsonStr = text.substring(14);
                        const beacon: SosBeaconPacket = JSON.parse(jsonStr);
                        this.processIncomingSosBeacon(beacon);
                    } else if (text.startsWith('{')) {
                        const obj = JSON.parse(text);
                        if (obj.msg_type === 'sos_beacon' || obj.type === 'SOS_BEACON') {
                            const b = obj.beacon || obj;
                            this.processIncomingSosBeacon({
                                id: b.id || b.beacon_id,
                                issuerDid: b.sender_did || obj.sender || 'unknown',
                                issuerName: b.sender_name || 'Operador en Peligro',
                                coords: { lat: b.lat, lon: b.lon, alt: b.altitude },
                                distressType: b.distress_type || 'GENERAL_DISTRESS',
                                triageColor: b.triageColor || 'RED',
                                note: b.note || 'ALERTA SOS SOLICITANDO AUXILIO',
                                batteryLevel: b.battery_level ?? 100,
                                timestamp: b.timestamp || Date.now(),
                                active: b.is_active ?? b.active ?? true,
                                hopCount: b.hopCount || 0
                            });
                        } else if (obj.msg_type === 'sos_resolve' || obj.type === 'SOS_RESOLVE') {
                            const id = obj.sos_id || obj.id || obj.beacon_id;
                            if (id) this.deactivateRemoteBeacon(id);
                        }
                    }
                } catch {}
            });
        } catch {}
    }

    public static getInstance(): MeshSosBeaconEngine {
        if (!this.instance) {
            this.instance = new MeshSosBeaconEngine();
        }
        return this.instance;
    }

    public subscribe(cb: () => void): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private notify() {
        this.listeners.forEach(cb => {
            try { cb(); } catch {}
        });
    }

    private loadState() {
        try {
            const rawMine = localStorage.getItem(STORAGE_ACTIVE_SOS_KEY);
            if (rawMine) {
                this.myBeacon = JSON.parse(rawMine);
            }
            const rawMesh = localStorage.getItem(STORAGE_RECEIVED_BEACONS_KEY);
            if (rawMesh) {
                const arr: SosBeaconPacket[] = JSON.parse(rawMesh);
                arr.forEach(b => this.meshBeacons.set(b.id, b));
            }
        } catch (e) {
            console.error('[MeshSosBeaconEngine] Error loading state:', e);
        }
    }

    private saveState() {
        try {
            if (this.myBeacon) {
                localStorage.setItem(STORAGE_ACTIVE_SOS_KEY, JSON.stringify(this.myBeacon));
            } else {
                localStorage.removeItem(STORAGE_ACTIVE_SOS_KEY);
            }
            const arr = Array.from(this.meshBeacons.values());
            localStorage.setItem(STORAGE_RECEIVED_BEACONS_KEY, JSON.stringify(arr));
            this.notify();
        } catch (e) {
            console.error('[MeshSosBeaconEngine] Error saving state:', e);
        }
    }

    /**
     * Almacena de forma determinista e idempotente una copia de la baliza en la bóveda DTN
     * para reenvío oportunista por nodos mulas sin inundar la base de datos.
     */
    private enqueueBeaconInDtn(beacon: SosBeaconPacket, relayHop?: number) {
        try {
            const envelope = `SOS_BEACON_V1:${JSON.stringify(beacon)}`;
            const bytes = new TextEncoder().encode(envelope);
            const deterministicNonce = relayHop 
                ? `sos_relay_${beacon.id}` 
                : `sos_${beacon.id}`;

            // Actualizar / reemplazar registro previo en DTN sin generar duplicados
            dtnStorage.remove(deterministicNonce);

            dtnStorage.enqueue({
                recipient: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                sender: beacon.issuerDid,
                ttl: relayHop ? Math.max(1, 7 - relayHop) : 7,
                flags: 0x01,
                timestamp: beacon.timestamp,
                nonce: deterministicNonce,
                payload: bytes,
            }, 10);
        } catch (e) {
            console.warn('[MeshSosBeaconEngine] Error enqueuing SOS in DTN:', e);
        }
    }

    /**
     * Activa una baliza SOS y comienza la difusión de emergencia
     */
    public async activateSosBeacon(
        beaconData: Partial<SosBeaconPacket>,
        authorDid: string,
        authorName: string
    ): Promise<SosBeaconPacket> {
        const now = Date.now();
        const id = beaconData.id || `SOS-${authorDid.substring(0, 8).toUpperCase()}-${now.toString(36).toUpperCase()}`;

        const beacon: SosBeaconPacket = {
            id,
            issuerDid: authorDid,
            issuerName: authorName || 'Operador en Peligro',
            coords: beaconData.coords ? { ...beaconData.coords } : {},
            distressType: beaconData.distressType || 'GENERAL_DISTRESS',
            triageColor: beaconData.triageColor || 'RED',
            note: beaconData.note || 'AUXILIO INMEDIATO REQUERIDO',
            batteryLevel: beaconData.batteryLevel ?? 100,
            timestamp: now,
            active: true,
            hopCount: 0,
        };

        this.myBeacon = beacon;
        this.meshBeacons.set(beacon.id, beacon);
        this.saveState();

        forensicBlackBox.recordEvent(
            'SOS_BROADCAST',
            'CRITICAL',
            `Baliza SOS activada: ${beacon.id} (${beacon.issuerName}) [${beacon.distressType}/${beacon.triageColor}] - ${beacon.note}`
        );

        // 1. Difusión inmediata en vivo por la malla local
        await this.broadcastSosHeartbeat();

        // 2. Custodia única e idempotente en DTN para transporte off-grid
        this.enqueueBeaconInDtn(beacon);

        return beacon;
    }

    /**
     * Desactiva la baliza SOS local
     */
    public async deactivateSosBeacon(beaconId?: string): Promise<boolean> {
        if (!this.myBeacon) return false;

        const targetId = this.myBeacon.id;
        const cancelledBeacon: SosBeaconPacket = {
            ...this.myBeacon,
            coords: this.myBeacon.coords ? { ...this.myBeacon.coords } : {},
            active: false,
            timestamp: Date.now(),
            note: 'EMERGENCIA CANCELADA / RESCATE COMPLETADO',
        };

        this.myBeacon = null;
        this.meshBeacons.set(cancelledBeacon.id, cancelledBeacon);
        this.saveState();

        // Purgar de la bóveda DTN para que el nodo no siga mulando un SOS cancelado
        try {
            dtnStorage.remove(`sos_${targetId}`);
        } catch {}

        // Emitir paquete de desactivación a la malla
        try {
            const envelope = `SOS_BEACON_V1:${JSON.stringify(cancelledBeacon)}`;
            const bytes = new TextEncoder().encode(envelope);
            await meshRouter.broadcast(bytes);
        } catch {}

        return true;
    }

    /**
     * Actualiza las coordenadas de la baliza SOS activa cuando se obtiene un fix GNSS tardío
     * y difunde inmediatamente la actualización a la malla y a la custodia DTN.
     */
    public async updateCoords(coords: { lat: number; lon: number; alt?: number }) {
        if (!this.myBeacon || !this.myBeacon.active) return;
        this.myBeacon.coords = {
            lat: coords.lat,
            lon: coords.lon,
            alt: coords.alt
        };
        this.myBeacon.timestamp = Date.now();
        this.saveState();
        
        await this.broadcastSosHeartbeat();
        this.enqueueBeaconInDtn(this.myBeacon);
    }

    /**
     * Emite una ráfaga de telemetría de la baliza SOS activa en vivo.
     * Solo transmite por radio (BLE/LoRa/WiFi); NUNCA encola en DTN en cada latido.
     */
    public async broadcastSosHeartbeat() {
        if (!this.myBeacon || !this.myBeacon.active) return;

        try {
            const envelope = `SOS_BEACON_V1:${JSON.stringify(this.myBeacon)}`;
            const bytes = new TextEncoder().encode(envelope);

            // Envío prioritario por la malla local en vivo
            await meshRouter.broadcast(bytes);
        } catch (e) {
            console.warn('[MeshSosBeaconEngine] Heartbeat broadcast error:', e);
        }
    }

    /**
     * Procesa un paquete SOS recibido de otro nodo
     */
    public processIncomingSosBeacon(beacon: SosBeaconPacket) {
        if (!beacon || !beacon.id) return;

        // Ignorar ecos de nuestra propia baliza activa
        if (this.myBeacon && (beacon.issuerDid === this.myBeacon.issuerDid || beacon.id === this.myBeacon.id)) {
            return;
        }

        const existing = this.meshBeacons.get(beacon.id);
        if (!existing || beacon.timestamp > existing.timestamp) {
            const isNewAlert = !existing && beacon.active;
            const nextHop = (beacon.hopCount || 0) + 1;

            // Clonación inmutable para evitar mutaciones indeseadas por referencia
            const updatedBeacon: SosBeaconPacket = {
                ...beacon,
                coords: beacon.coords ? { ...beacon.coords } : {},
                hopCount: nextHop,
            };

            this.meshBeacons.set(beacon.id, updatedBeacon);
            this.saveState();

            // Si la baliza remota fue cancelada o resuelta, purgar su custodia en DTN
            if (!beacon.active) {
                try {
                    dtnStorage.remove(`sos_${beacon.id}`);
                    dtnStorage.remove(`sos_relay_${beacon.id}`);
                } catch {}
            }

            if (isNewAlert) {
                forensicBlackBox.recordEvent(
                    'SOS_BROADCAST',
                    'CRITICAL',
                    `Alerta SOS remota recibida: ${beacon.id} (${beacon.issuerName}) [${beacon.distressType}/${beacon.triageColor}] hop=${nextHop}`
                );
            }

            // Sincronización reactiva inmediata con el RedStore (activa SOSEmergencyBanner global)
            try {
                import('../../store/useRedStore').then(({ useRedStore }) => {
                    if (beacon.active) {
                        useRedStore.getState().addSosBeacon({
                            id: beacon.id,
                            beacon_id: beacon.id,
                            sender_did: beacon.issuerDid,
                            sender_name: beacon.issuerName,
                            lat: beacon.coords?.lat,
                            lon: beacon.coords?.lon,
                            altitude: beacon.coords?.alt,
                            timestamp: beacon.timestamp,
                            battery_level: beacon.batteryLevel,
                            note: beacon.note || `Emergencia ${beacon.distressType}`,
                            is_active: beacon.active,
                            distress_type: beacon.distressType
                        });
                    } else {
                        useRedStore.getState().resolveSosBeacon(beacon.id);
                    }
                }).catch(() => {});
            } catch (err) {
                console.warn('[MeshSosBeaconEngine] Failed to sync with RedStore:', err);
            }

            // Inundación Multi-Salto Táctica & Bóveda DTN (hasta 7 saltos)
            if (nextHop <= 7 && beacon.active) {
                setTimeout(async () => {
                    try {
                        const envelope = `SOS_BEACON_V1:${JSON.stringify(updatedBeacon)}`;
                        const bytes = new TextEncoder().encode(envelope);
                        await meshRouter.broadcast(bytes);
                        
                        // Custodia determinista única para relay
                        this.enqueueBeaconInDtn(updatedBeacon, nextHop);
                    } catch {}
                }, 120 + Math.random() * 200);
            }
        }
    }

    public deactivateRemoteBeacon(beaconId: string) {
        const existing = this.meshBeacons.get(beaconId);
        if (existing && existing.active) {
            this.processIncomingSosBeacon({
                ...existing,
                coords: existing.coords ? { ...existing.coords } : {},
                active: false,
                timestamp: Date.now(),
                note: 'EMERGENCIA RESUELTA / CANCELADA'
            });
        }
    }

    public getMyActiveBeacon(): SosBeaconPacket | null {
        return this.myBeacon && this.myBeacon.active ? this.myBeacon : null;
    }

    public getMeshSosBeacons(): SosBeaconPacket[] {
        // Filtrar y podar balizas con más de 72 horas
        const cutoff = Date.now() - (72 * 3600 * 1000);
        for (const [id, beacon] of this.meshBeacons.entries()) {
            if (beacon.timestamp <= cutoff) {
                this.meshBeacons.delete(id);
            }
        }
        return Array.from(this.meshBeacons.values())
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    public getActiveDistressCount(): number {
        return this.getMeshSosBeacons().filter(b => b.active).length;
    }

    public destroy(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        this.listeners.clear();
        MeshSosBeaconEngine.instance = null;
    }

    private startHeartbeatLoop() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        // Cada 25 segundos se retransmite la baliza activa
        this.heartbeatTimer = setInterval(() => {
            if (this.myBeacon && this.myBeacon.active) {
                this.broadcastSosHeartbeat().catch(() => {});
            }
        }, 25000);
    }
}

export const meshSosBeacon = MeshSosBeaconEngine.getInstance();
