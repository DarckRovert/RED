/**
 * MeshSosBeaconEngine.ts — RED Sovereign Multi-Hop Emergency SOS Distress Beacon Engine
 * 
 * Manages active emergency beacons, automated periodic SOS heartbeats, TCCC triage encoding,
 * and high-priority mesh flooding with DTN store-and-forward persistence.
 */

import { meshRouter } from '../mesh/meshRouter';
import { dtnStorage } from '../mesh/dtnStorage';

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
     * Activa una baliza SOS y comienza la difusión de emergencia
     */
    public async activateSosBeacon(
        beaconData: Partial<SosBeaconPacket>,
        authorDid: string,
        authorName: string
    ): Promise<SosBeaconPacket> {
        const now = Date.now();
        const id = `SOS-${authorDid.substring(0, 8).toUpperCase()}-${now.toString(36).toUpperCase()}`;

        const beacon: SosBeaconPacket = {
            id,
            issuerDid: authorDid,
            issuerName: authorName || 'Operador en Peligro',
            coords: beaconData.coords || {},
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

        // Difusión inmediata
        await this.broadcastSosHeartbeat();

        return beacon;
    }

    /**
     * Desactiva la baliza SOS local
     */
    public async deactivateSosBeacon(beaconId?: string): Promise<boolean> {
        if (!this.myBeacon) return false;

        const cancelledBeacon: SosBeaconPacket = {
            ...this.myBeacon,
            active: false,
            timestamp: Date.now(),
            note: 'EMERGENCIA CANCELADA / RESCATE COMPLETADO',
        };

        this.myBeacon = null;
        this.meshBeacons.set(cancelledBeacon.id, cancelledBeacon);
        this.saveState();

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
     * y difunde inmediatamente la actualización a la malla.
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
    }

    /**
     * Emite una ráfaga de telemetría de la baliza SOS activa
     */
    public async broadcastSosHeartbeat() {
        if (!this.myBeacon || !this.myBeacon.active) return;

        try {
            const envelope = `SOS_BEACON_V1:${JSON.stringify(this.myBeacon)}`;
            const bytes = new TextEncoder().encode(envelope);

            // 1. Envío prioritario por la malla local
            await meshRouter.broadcast(bytes);

            // 2. Almacenamiento en Bóveda DTN con prioridad SOS máxima (10)
            dtnStorage.enqueue({
                recipient: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                sender: this.myBeacon.issuerDid,
                ttl: 7,
                flags: 0x01,
                timestamp: Date.now(),
                nonce: `sos_${this.myBeacon.id}_${Date.now()}`,
                payload: bytes,
            }, 10);
        } catch (e) {
            console.warn('[MeshSosBeaconEngine] Heartbeat broadcast error:', e);
        }
    }

    /**
     * Procesa un paquete SOS recibido de otro nodo
     */
    public processIncomingSosBeacon(beacon: SosBeaconPacket) {
        if (!beacon || !beacon.id) return;

        const existing = this.meshBeacons.get(beacon.id);
        if (!existing || beacon.timestamp > existing.timestamp) {
            beacon.hopCount = (beacon.hopCount || 0) + 1;
            this.meshBeacons.set(beacon.id, beacon);
            this.saveState();
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
