/**
 * CallHistoryEngine.ts — RED Persistent WebRTC & Squad Call Logs Engine
 * 
 * Manages real, persistent call history (Incoming, Outgoing, Missed) with duration,
 * peer identity resolution and timestamping across sessions.
 */

export interface CallRecord {
    id: string;
    peerHash: string;
    peerName: string;
    direction: 'INCOMING' | 'OUTGOING' | 'MISSED';
    callType: 'audio' | 'video' | 'squad';
    timestamp: number;
    durationSeconds: number;
}

const STORAGE_KEY = 'red_call_history_v1';

export class CallHistoryEngine {
    private static instance: CallHistoryEngine | null = null;
    private records: CallRecord[] = [];
    private listeners: Set<(records: CallRecord[]) => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            this.loadHistory();
        }
    }

    public static getInstance(): CallHistoryEngine {
        if (!this.instance) {
            this.instance = new CallHistoryEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (records: CallRecord[]) => void): () => void {
        this.listeners.add(cb);
        cb(this.getHistory());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const history = this.getHistory();
        this.listeners.forEach(cb => {
            try { cb(history); } catch {}
        });
    }

    private loadHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this.records = JSON.parse(raw);
            } else {
                this.records = [];
            }
        } catch (e) {
            console.error('[CallHistoryEngine] Failed to load call history:', e);
            this.records = [];
        }
    }

    private saveHistory() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
            this.notify();
        } catch (e) {
            console.error('[CallHistoryEngine] Failed to save call history:', e);
        }
    }

    public getHistory(): CallRecord[] {
        return [...this.records].sort((a, b) => b.timestamp - a.timestamp);
    }

    public addRecord(recordData: Omit<CallRecord, 'id'>): CallRecord {
        const rand = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(2))).map(b => b.toString(16).padStart(2, '0')).join('')
            : (Date.now() % 1000).toString();
        const id = `call_${Date.now()}_${rand}`;
        
        const record: CallRecord = {
            id,
            ...recordData,
        };

        this.records.unshift(record);
        if (this.records.length > 200) {
            this.records = this.records.slice(0, 200);
        }

        this.saveHistory();
        return record;
    }

    public deleteRecord(id: string) {
        this.records = this.records.filter(r => r.id !== id);
        this.saveHistory();
    }

    public removeRecord(id: string) {
        this.deleteRecord(id);
    }


    public clearHistory() {
        this.records = [];
        this.saveHistory();
    }
}

export const callHistory = CallHistoryEngine.getInstance();
