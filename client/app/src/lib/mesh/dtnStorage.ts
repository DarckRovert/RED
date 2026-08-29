/**
 * RED DTN (Delay-Tolerant Networking) Persistent Storage — IndexedDB Enterprise Vault
 * 
 * Manages high-capacity Store-and-Forward packet queuing across app reboots,
 * background mode transitions, and multi-week network blackouts.
 * Retains undelivered packets with exponential backoff and cryptographic delivery ACK confirmation.
 */

import { MeshPacket } from './meshProtocol';

export interface DtnQueueItem {
  id: string; // Packet nonce
  packet: {
    recipient: string;
    sender: string;
    ttl: number;
    flags: number;
    timestamp: number;
    nonce: string;
    payloadHex: string;
  };
  createdAt: number;
  expiresAt: number;
  attempts: number;
  lastAttempt: number;
  nextRetryAfter: number;
  targetRecipient: string;
  priority: number;
}

const DB_NAME = 'red_dtn_storage_vault';
const STORE_NAME = 'packets';
const DB_VERSION = 1;
const STORAGE_KEY_FALLBACK = 'red_dtn_pending_queue_v1';
const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days retention for sovereign mesh DTN
const MAX_QUEUE_SIZE = 5000;

class DtnStorage {
  private cache: DtnQueueItem[] | null = null;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAsync();
    }
  }

  private getDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return resolve(null);
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e: any) => {
        const db = e.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('targetRecipient', 'targetRecipient', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[DtnStorage] IndexedDB open error, falling back to memory/local storage');
        resolve(null);
      };
    });

    return this.dbPromise;
  }

  private async initAsync() {
    try {
      const db = await this.getDB();
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          if (Array.isArray(req.result) && req.result.length > 0) {
            this.cache = req.result;
          } else {
            // Check fallback localStorage
            this.loadFromLocalStorageFallback();
          }
          this.isInitialized = true;
        };
        req.onerror = () => {
          this.loadFromLocalStorageFallback();
          this.isInitialized = true;
        };
      } else {
        this.loadFromLocalStorageFallback();
        this.isInitialized = true;
      }
    } catch {
      this.loadFromLocalStorageFallback();
      this.isInitialized = true;
    }
  }

  private loadFromLocalStorageFallback() {
    if (typeof window === 'undefined') {
      this.cache = [];
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FALLBACK);
      if (raw) {
        this.cache = JSON.parse(raw);
        if (!Array.isArray(this.cache)) this.cache = [];
      } else {
        this.cache = [];
      }
    } catch {
      this.cache = [];
    }
  }

  private getItems(): DtnQueueItem[] {
    if (this.cache !== null) return this.cache;
    this.loadFromLocalStorageFallback();
    return this.cache || [];
  }

  private async saveItemToDB(item: DtnQueueItem) {
    try {
      const db = await this.getDB();
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
      }
    } catch (e) {
      console.warn('[DtnStorage] IndexedDB saveItem error:', e);
    }
  }

  private async removeItemFromDB(id: string) {
    try {
      const db = await this.getDB();
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
      }
    } catch (e) {
      console.warn('[DtnStorage] IndexedDB removeItem error:', e);
    }
  }

  private async clearDB() {
    try {
      const db = await this.getDB();
      if (db) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
      }
    } catch (e) {
      console.warn('[DtnStorage] IndexedDB clear error:', e);
    }
  }

  private saveItems(items: DtnQueueItem[]) {
    this.cache = items;
    if (typeof window === 'undefined') return;

    // Persist small subset into localStorage fallback
    try {
      const topItems = items.slice(-100);
      localStorage.setItem(STORAGE_KEY_FALLBACK, JSON.stringify(topItems));
    } catch {}
  }

  private uint8ToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private hexToUint8(hex: string): Uint8Array {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    const len = Math.floor(clean.length / 2);
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      u8[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    }
    return u8;
  }

  private calculatePacketPriority(packet: MeshPacket): number {
    try {
      const text = new TextDecoder().decode(packet.payload);
      if (text.includes('"sos"') || text.includes('SOS_BEACON') || text.includes('SOS_ALERT') || text.includes('DISTRESS')) {
        return 10; // Máxima prioridad: Emergencias y auxilio
      }
      if (text.includes('p2p_payment') || text.includes('p2p_voucher') || text.includes('RED_PAY:') || text.includes('voucher')) {
        return 8; // Alta prioridad: Pagos y transacciones P2P
      }
      if (text.includes('DELIVERY_ACK') || text.includes('IDENTITY_ANNOUNCE') || text.includes('IDENTITY_RESPONSE')) {
        return 6; // Prioridad protocolo: Handshakes y confirmaciones
      }
      if (text.includes('"media_chunk"') || text.includes('"voice_chunk"') || text.includes('"file"')) {
        return 2; // Baja prioridad: Chunks multimedia pesados
      }
    } catch {}
    return 4; // Prioridad estándar para mensajes de texto directo
  }

  public enqueue(packet: MeshPacket, priority?: number, ttlMs = DEFAULT_RETENTION_MS): void {
    const items = this.getItems();
    const nonce = packet.nonce;

    // Avoid duplicate enqueueing of identical packet nonce
    if (items.some(it => it.id === nonce)) {
      return;
    }

    const calculatedPriority = (priority !== undefined && priority > 0) 
      ? priority 
      : this.calculatePacketPriority(packet);

    const now = Date.now();
    const item: DtnQueueItem = {
      id: nonce,
      packet: {
        recipient: packet.recipient,
        sender: packet.sender,
        ttl: packet.ttl,
        flags: packet.flags,
        timestamp: packet.timestamp,
        nonce: packet.nonce,
        payloadHex: this.uint8ToHex(packet.payload),
      },
      createdAt: now,
      expiresAt: now + ttlMs,
      attempts: 0,
      lastAttempt: 0,
      nextRetryAfter: now,
      targetRecipient: packet.recipient,
      priority: calculatedPriority,
    };

    // If queue is overflowing, prune lowest priority / oldest items
    if (items.length >= MAX_QUEUE_SIZE) {
      items.sort((a, b) => a.priority === b.priority ? a.createdAt - b.createdAt : a.priority - b.priority);
      const dropped = items.shift();
      if (dropped) {
        this.removeItemItemAsync(dropped.id);
      }
    }

    items.push(item);
    this.saveItems(items);
    this.saveItemToDB(item);
    console.log(`[DtnStorage] Enqueued packet ${nonce.slice(0, 8)} (Priority: ${calculatedPriority}) for ${packet.recipient.slice(0, 8)} (queue size: ${items.length})`);
  }

  private removeItemItemAsync(id: string) {
    this.removeItemFromDB(id);
  }

  public getItemsToRetry(): DtnQueueItem[] {
    const now = Date.now();
    const items = this.getItems();
    // Filter active items whose retry timer has elapsed, sorted by Priority DESC then createdAt ASC
    return items
      .filter(it => it.expiresAt > now && it.nextRetryAfter <= now)
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.createdAt - b.createdAt;
      });
  }

  public markAttempt(nonce: string, success: boolean): void {
    const items = this.getItems();
    const idx = items.findIndex(it => it.id === nonce);
    if (idx === -1) return;

    if (success) {
      // Remove successfully delivered item
      const removed = items.splice(idx, 1)[0];
      this.saveItems(items);
      if (removed) this.removeItemFromDB(removed.id);
      console.log(`[DtnStorage] Packet ${nonce.slice(0, 8)} delivered and removed from DTN queue`);
    } else {
      // Calculate exponential backoff: 3s, 6s, 12s, 24s... capped at 5 minutes
      const item = items[idx];
      item.attempts += 1;
      item.lastAttempt = Date.now();
      const backoffSec = Math.min(300, Math.pow(2, Math.min(item.attempts, 8)) * 2);
      item.nextRetryAfter = Date.now() + backoffSec * 1000;
      this.saveItems(items);
      this.saveItemToDB(item);
    }
  }

  public remove(nonce: string): boolean {
    const items = this.getItems();
    const initialLen = items.length;
    const filtered = items.filter(it => it.id !== nonce);
    if (filtered.length !== initialLen) {
      this.saveItems(filtered);
      this.removeItemFromDB(nonce);
      return true;
    }
    return false;
  }

  public removeByRecipient(recipient: string): void {
    const items = this.getItems();
    const toRemove: string[] = [];
    const filtered = items.filter(it => {
      if (it.targetRecipient === recipient || it.targetRecipient.startsWith(recipient)) {
        toRemove.push(it.id);
        return false;
      }
      return true;
    });

    if (filtered.length !== items.length) {
      this.saveItems(filtered);
      toRemove.forEach(id => this.removeItemFromDB(id));
    }
  }

  public purgeExpired(): number {
    const now = Date.now();
    const items = this.getItems();
    const initialLen = items.length;
    const toRemove: string[] = [];
    const active = items.filter(it => {
      if (it.expiresAt <= now) {
        toRemove.push(it.id);
        return false;
      }
      return true;
    });

    if (active.length !== initialLen) {
      this.saveItems(active);
      toRemove.forEach(id => this.removeItemFromDB(id));
      const purged = initialLen - active.length;
      console.log(`[DtnStorage] Purged ${purged} expired DTN packets`);
      return purged;
    }
    return 0;
  }

  public toMeshPacket(item: DtnQueueItem): MeshPacket {
    return {
      recipient: item.packet.recipient,
      sender: item.packet.sender,
      ttl: item.packet.ttl,
      flags: item.packet.flags,
      timestamp: item.packet.timestamp,
      nonce: item.packet.nonce,
      payload: this.hexToUint8(item.packet.payloadHex),
    };
  }

  public get count(): number {
    return this.getItems().length;
  }

  public clear(): void {
    this.saveItems([]);
    this.clearDB();
  }
}

export const dtnStorage = new DtnStorage();
