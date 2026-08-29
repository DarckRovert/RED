/**
 * ForensicBlackBoxEngine.ts — RED Sovereign Immutable Black-Box Flight Recorder
 * 
 * Provides an append-only, SHA-256 chained audit ledger for all critical operational events
 * (SOS beacons, Man-Down triggers, Panic Purges, Geofence breaches, Drone SIGINT alerts,
 * and P2P barter transactions) with post-mission cryptographic verification.
 */

import { sha256 } from '@noble/hashes/sha2.js';

export type BlackBoxEventType = 
    | 'SYSTEM_BOOT' 
    | 'PANIC_PURGE' 
    | 'SOS_BROADCAST' 
    | 'MAN_DOWN_TRIGGER' 
    | 'GEOFENCE_BREACH' 
    | 'DRONE_SIGINT_ALERT' 
    | 'MAGNETIC_ANOMALY' 
    | 'P2P_TRANSACTION';

export interface BlackBoxEvent {
    index: number;
    timestamp: number;
    eventType: BlackBoxEventType;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    details: string;
    prevHash: string;
    hash: string;
}

const STORAGE_BLACKBOX_KEY = 'red_forensic_blackbox_ledger_v1';
const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class ForensicBlackBoxEngine {
    private static instance: ForensicBlackBoxEngine | null = null;
    private events: BlackBoxEvent[] = [];
    private listeners: Set<() => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            this.loadLedger();
            this.recordEvent('SYSTEM_BOOT', 'INFO', 'Nodo RED iniciado y centinela forense activado');
        }
    }

    public static getInstance(): ForensicBlackBoxEngine {
        if (!this.instance) {
            this.instance = new ForensicBlackBoxEngine();
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

    private loadLedger() {
        try {
            const raw = localStorage.getItem(STORAGE_BLACKBOX_KEY);
            if (raw) {
                this.events = JSON.parse(raw);
            }
        } catch (e) {
            console.error('[ForensicBlackBoxEngine] Error loading ledger:', e);
        }
    }

    private saveLedger() {
        try {
            localStorage.setItem(STORAGE_BLACKBOX_KEY, JSON.stringify(this.events));
            this.notify();
        } catch (e) {
            console.error('[ForensicBlackBoxEngine] Error saving ledger:', e);
        }
    }

    private uint8ToHex(bytes: Uint8Array): string {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Registra un evento inmutable en la cadena forense
     */
    public recordEvent(
        eventType: BlackBoxEventType,
        severity: 'INFO' | 'WARNING' | 'CRITICAL',
        details: string
    ): BlackBoxEvent {
        const now = Date.now();
        const index = this.events.length;
        const prevHash = index > 0 ? this.events[index - 1].hash : GENESIS_PREV_HASH;

        const payloadToHash = `${index}:${now}:${eventType}:${severity}:${details}:${prevHash}`;
        const hashBytes = sha256(new TextEncoder().encode(payloadToHash));
        const hash = this.uint8ToHex(hashBytes);

        const event: BlackBoxEvent = {
            index,
            timestamp: now,
            eventType,
            severity,
            details,
            prevHash,
            hash,
        };

        this.events.push(event);
        // Mantener los últimos 1,000 eventos críticos
        if (this.events.length > 1000) {
            this.events.shift();
        }

        this.saveLedger();
        return event;
    }

    /**
     * Verifica la integridad criptográfica de la cadena completa
     */
    public verifyChainIntegrity(): boolean {
        for (let i = 0; i < this.events.length; i++) {
            const current = this.events[i];
            const prevHash = i > 0 ? this.events[i - 1].hash : GENESIS_PREV_HASH;

            if (current.prevHash !== prevHash) {
                return false;
            }

            const payloadToHash = `${current.index}:${current.timestamp}:${current.eventType}:${current.severity}:${current.details}:${current.prevHash}`;
            const hashBytes = sha256(new TextEncoder().encode(payloadToHash));
            const recomputedHash = this.uint8ToHex(hashBytes);

            if (current.hash !== recomputedHash) {
                return false;
            }
        }
        return true;
    }

    public getEvents(): BlackBoxEvent[] {
        return [...this.events].reverse();
    }

    public exportAuditReport(): string {
        return JSON.stringify({
            exportedAt: Date.now(),
            totalEvents: this.events.length,
            isChainValid: this.verifyChainIntegrity(),
            latestHash: this.events.length > 0 ? this.events[this.events.length - 1].hash : null,
            events: this.events,
        }, null, 2);
    }
}

export const forensicBlackBox = ForensicBlackBoxEngine.getInstance();
