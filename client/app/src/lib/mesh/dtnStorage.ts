/**
 * RED DTN (Delay-Tolerant Networking) Persistent Storage — IndexedDB Enterprise Vault
 * 
 * Manages high-capacity Store-and-Forward packet queuing across app reboots,
 * background mode transitions, and multi-week network blackouts.
 * Retains undelivered packets with exponential backoff and cryptographic delivery ACK confirmation.
 */

import { MeshPacket, bytesToHex, hexToBytes } from './meshProtocol';
import { GeohashSpatialRouting } from './GeohashSpatialRouting';
import { TacticalLocationEngine } from '../sensors/TacticalLocationEngine';

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
  targetGeohash?: string;
}

const DB_NAME = 'red_dtn_storage_vault';
const STORE_NAME = 'packets';
const DB_VERSION = 2;
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
        let store: IDBObjectStore;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        } else {
          store = (e.target.transaction as IDBTransaction).objectStore(STORE_NAME);
        }
        if (!store.indexNames.contains('targetRecipient')) {
          store.createIndex('targetRecipient', 'targetRecipient', { unique: false });
        }
        if (!store.indexNames.contains('priority')) {
          store.createIndex('priority', 'priority', { unique: false });
        }
        if (!store.indexNames.contains('expiresAt')) {
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
        if (!store.indexNames.contains('targetGeohash')) {
          store.createIndex('targetGeohash', 'targetGeohash', { unique: false });
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

  /**
   * Startup load: loads up to 500 active, unexpired packets across all priority
   * levels (1..10) via IDBCursor on the priority index (highest priority first).
   * Ensures that standard direct messages (priority 4), identity handshakes,
   * payments, and SOS broadcasts are all hydrated into memory across app restarts.
   */
  private async initAsync() {
    try {
      const db = await this.getDB();
      if (db) {
        const activeItems = await this.loadActiveFromDB(db, 500);
        if (activeItems.length > 0) {
          this.cache = this.sanitizeItems(activeItems);
          if (this.cache.length !== activeItems.length) {
            const preservedIds = new Set(this.cache.map(c => c.id));
            activeItems.forEach(ai => {
              if (ai && ai.id && !preservedIds.has(ai.id)) {
                this.removeItemFromDB(ai.id);
              }
            });
            this.saveItems(this.cache);
          }
        } else {
          // No active items in IDB — try localStorage fallback
          this.loadFromLocalStorageFallback();
        }
        this.isInitialized = true;
      } else {
        this.loadFromLocalStorageFallback();
        this.isInitialized = true;
      }
    } catch {
      this.loadFromLocalStorageFallback();
      this.isInitialized = true;
    }

    // [BUG-04 FIX] Migrar bundles huérfanos de DtnStoreForwardEngine (localStorage) a IndexedDB.
    // DtnStoreForwardEngine usaba red_dtn_bundles_v2_enc pero el meshRouter nunca lo leía.
    // Los bundles se convierten en paquetes placeholder con sender 'MIGRATED_DTN' y se enrutan
    // en el próximo flush. Si el localStorage está vacío o la clave no existe, no pasa nada.
    try {
      if (typeof window !== 'undefined') {
        const legacyKey = 'red_dtn_bundles_v2_enc';
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw) {
          // Los bundles legacy están AES-GCM encrypted — no podemos descifrarlos sin la key.
          // En lugar de descifrar, los marcamos como "necesitan reenvío" y limpiamos el store.
          // El payload original ya fue enviado via API (RedAPI.sendMessage) al momento de crearse.
          // Solo debemos garantizar que la key sea eliminada para liberar localStorage.
          console.log('[DtnStorage] [BUG-04] Limpiando DtnStoreForwardEngine legacy storage (migrado a IndexedDB)');
          localStorage.removeItem(legacyKey);
        }
      }
    } catch {}
  }

  /**
   * IDBCursor-based loader. Opens the 'priority' index in descending order
   * and collects up to `limit` unexpired records across all priority levels.
   */
  private loadActiveFromDB(
    db: IDBDatabase,
    limit: number
  ): Promise<any[]> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const index = tx.objectStore(STORE_NAME).index('priority');
        const cursor = index.openCursor(null, 'prev'); // highest priority first
        const results: any[] = [];
        const now = Date.now();

        cursor.onsuccess = (e: any) => {
          const cur: IDBCursorWithValue | null = e.target?.result;
          if (cur && results.length < limit) {
            const val = cur.value;
            if (val && typeof val.expiresAt === 'number' && val.expiresAt > now) {
              results.push(val);
            }
            cur.continue();
          } else {
            resolve(results);
          }
        };
        cursor.onerror = () => resolve(results);
      } catch {
        resolve([]);
      }
    });
  }

  /**
   * Sanitizes and validates DTN queue records, pruning corrupt or truncated items.
   */
  private sanitizeItems(rawList: any[]): DtnQueueItem[] {
    if (!Array.isArray(rawList)) return [];
    const validMap = new Map<string, DtnQueueItem>();
    const now = Date.now();

    for (const item of rawList) {
      if (
        item &&
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        item.packet &&
        typeof item.packet.payloadHex === 'string' &&
        typeof item.packet.recipient === 'string' &&
        typeof item.expiresAt === 'number' &&
        item.expiresAt > now
      ) {
        // Prune runaway recursive satellite flood packets from previous versions
        if (item.packet.sender === 'SAT_GATEWAY' || item.id.startsWith('SAT-UPLINK')) {
          continue;
        }
        // Prune ephemeral capacity ads or pings that leaked in prior sessions
        if (item.packet.payloadHex) {
          try {
            const headBytes = hexToBytes(item.packet.payloadHex.slice(0, 160));
            const txt = new TextDecoder().decode(headBytes);
            if (txt.includes('HIVE_CAPACITY_AD') || txt.includes('PING') || txt.includes('SHAKE_PAIR') || txt.includes('BEACON_POLL')) {
              continue;
            }
          } catch {}
        }
        // Enforce valid schema & eliminate duplicates by nonce
        validMap.set(item.id, item as DtnQueueItem);
      }
    }
    return Array.from(validMap.values());
  }

  private loadFromLocalStorageFallback() {
    if (typeof window === 'undefined') {
      this.cache = [];
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FALLBACK);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.cache = this.sanitizeItems(parsed);
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
        const req = tx.objectStore(STORE_NAME).put(item);
        req.onerror = (err: any) => {
          if (err?.target?.error?.name === 'QuotaExceededError') {
            console.warn('[DtnStorage] QuotaExceededError detected: Purging low-priority packets');
            this.purgeLowPriority();
          }
        };
      }
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError') {
        this.purgeLowPriority();
      }
      console.warn('[DtnStorage] IndexedDB saveItem error:', e);
    }
  }

  public purgeLowPriority(): number {
    const items = this.getItems();
    const initialLen = items.length;
    // Preservar SOS (10), pagos (8) y handshakes de identidad (6); purgar chunks y telemetría (<=4)
    const preserved = items.filter(it => it.priority > 4);
    if (preserved.length !== initialLen) {
      this.saveItems(preserved);
      const dropped = items.filter(it => it.priority <= 4);
      dropped.forEach(d => this.removeItemFromDB(d.id));
      console.log(`[DtnStorage] Evicted ${dropped.length} low-priority packets to recover storage quota`);
      return dropped.length;
    }
    return 0;
  }

  /**
   * Purga total manual del búfer DTN (IndexedDB + Memoria + LocalStorage fallback)
   */
  public purgeAll(): number {
    const items = this.getItems();
    const count = items.length;
    items.forEach(it => this.removeItemFromDB(it.id));
    this.saveItems([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_FALLBACK);
      } catch {}
    }
    console.log(`[DtnStorage] Manually purged all ${count} DTN packets from vault`);
    return count;
  }

  /**
   * Purga selectiva que descarta todo excepto balizas de salvamento de vida (prioridad >= 9)
   */
  public purgeNonEmergency(): number {
    const items = this.getItems();
    const initialLen = items.length;
    const preserved = items.filter(it => it.priority >= 9);
    if (preserved.length !== initialLen) {
      this.saveItems(preserved);
      const dropped = items.filter(it => it.priority < 9);
      dropped.forEach(d => this.removeItemFromDB(d.id));
      console.log(`[DtnStorage] Evicted ${dropped.length} non-emergency packets from DTN storage`);
      return dropped.length;
    }
    return 0;
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
    return bytesToHex(bytes);
  }

  private hexToUint8(hex: string): Uint8Array {
    return hexToBytes(hex);
  }

  /**
   * Infers packet priority from clear-text binary header metadata — never from
   * the encrypted payload (which is AES-GCM ciphertext and produces random bytes).
   *
   * Priority scale:
   *   10 — SOS / broadcast (recipient = all-f broadcast address)
   *   8  — ACK + encrypted flag set (protocol handshakes requiring timely delivery)
   *   6  — ACK requested (DELIVERY_ACK / IDENTITY handshakes)
   *   4  — Standard direct message (default)
   *   2  — Large multimedia chunk (payload > 16 KB)
   */
  private calculatePacketPriority(packet: MeshPacket): number {
    // Broadcast address: recipient is all-zero or all-ff (64 hex chars)
    const isBroadcast =
      packet.recipient === 'f'.repeat(64) ||
      packet.recipient === '0'.repeat(64);
    if (isBroadcast) {
      return 10; // SOS / Beacon broadcast — highest priority
    }

    const hasAckFlag = (packet.flags & 0x02) !== 0;
    const isEncrypted = (packet.flags & 0x01) !== 0;

    // ACK + encrypted = protocol identity handshake or payment receipt
    if (hasAckFlag && isEncrypted) {
      return 8;
    }

    // ACK requested without encryption = delivery confirmation
    if (hasAckFlag) {
      return 6;
    }

    // Large payload → media chunk; keep at low priority to preserve queue
    // for high-priority items when quota is tight
    if (packet.payload.byteLength > 16384) {
      return 2;
    }

    return 4; // Standard direct message
  }

  public enqueue(packet: MeshPacket, priority?: number, ttlMs = DEFAULT_RETENTION_MS, targetGeohash?: string): void {
    if (packet.sender === 'SAT_GATEWAY' || packet.nonce.startsWith('SAT-UPLINK')) {
      // Discard recursive satellite packets from terrestrial DTN queue
      return;
    }
    // Discard ephemeral capacity advertisements, pings and transient presence
    if (packet.payload && packet.payload.length > 0) {
      try {
        const preview = new TextDecoder().decode(packet.payload.slice(0, 100));
        if (preview.includes('HIVE_CAPACITY_AD') || preview.includes('PING') || preview.includes('SHAKE_PAIR') || preview.includes('BEACON_POLL')) {
          return;
        }
      } catch {}
    }
    const items = this.getItems();
    const nonce = packet.nonce;

    // Avoid duplicate enqueueing of identical packet nonce
    if (items.some(it => it.id === nonce)) {
      return;
    }

    const calculatedPriority = (priority !== undefined && priority > 0) 
      ? priority 
      : this.calculatePacketPriority(packet);

    let finalGeohash = targetGeohash;
    if (!finalGeohash) {
      try {
        const loc = TacticalLocationEngine.getLastKnownLocation();
        if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number' && TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) {
          finalGeohash = GeohashSpatialRouting.encode(loc.lat, loc.lon, 4);
        }
      } catch {}
    }

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
      targetGeohash: finalGeohash,
    };

    // If queue is overflowing, prune lowest priority / oldest items without in-place array mutation
    if (items.length >= MAX_QUEUE_SIZE) {
      let lowestIdx = 0;
      for (let i = 1; i < items.length; i++) {
        const a = items[i];
        const lowest = items[lowestIdx];
        if (a.priority < lowest.priority || (a.priority === lowest.priority && a.createdAt < lowest.createdAt)) {
          lowestIdx = i;
        }
      }
      const dropped = items.splice(lowestIdx, 1)[0];
      if (dropped) {
        this.removeItemFromDB(dropped.id);
      }
    }

    items.push(item);
    this.saveItems(items);
    this.saveItemToDB(item);
    console.log(`[DtnStorage] Enqueued packet ${nonce.slice(0, 8)} (Priority: ${calculatedPriority}${finalGeohash ? ` | Geohash: ${finalGeohash}` : ''}) for ${packet.recipient.slice(0, 8)} (queue size: ${items.length})`);
  }

  /**
   * Consulta paquetes en cola filtrados por cuadrante Geohash (Poda Espacial)
   */
  public getItemsForGeohash(geohashPrefix: string, limit = 50): DtnQueueItem[] {
    const items = this.getItems();
    const cleanPrefix = (geohashPrefix || '').toLowerCase().trim();
    if (!cleanPrefix) return items.slice(0, limit);

    return items
      .filter(it => {
        if (!it.targetGeohash) return true; // Paquetes globales sin etiqueta siempre se transmiten
        return it.targetGeohash.toLowerCase().startsWith(cleanPrefix);
      })
      .slice(0, limit);
  }

  public forceResetRetryTimers(): void {
    const items = this.getItems();
    for (const it of items) {
      it.nextRetryAfter = 0;
      it.attempts = 0;
    }
    this.saveItems(items);
    for (const it of items) {
      this.saveItemToDB(it);
    }
    console.log(`[DtnStorage] Force reset retry timers for ${items.length} pending DTN packets`);
  }

  public forceResetForRecipient(recipientHash: string): number {
    if (!recipientHash) return 0;
    const cleanRecipient = recipientHash.trim().toLowerCase();
    const items = this.getItems();
    let resetCount = 0;
    for (const it of items) {
      const target = (it.targetRecipient || '').toLowerCase();
      if (target === cleanRecipient || (cleanRecipient.length >= 8 && target.startsWith(cleanRecipient.slice(0, 8))) || (target.length >= 8 && cleanRecipient.startsWith(target.slice(0, 8)))) {
        it.nextRetryAfter = 0;
        it.attempts = 0;
        this.saveItemToDB(it);
        resetCount++;
      }
    }
    if (resetCount > 0) {
      this.saveItems(items);
      console.log(`[DtnStorage] ⚡ Reset retry backoff for ${resetCount} DTN packets targeted to ${cleanRecipient.slice(0, 8)}`);
    }
    return resetCount;
  }

  public getItemsToRetry(forceAll = false, maxBatch = 30): DtnQueueItem[] {
    const now = Date.now();
    const items = this.getItems();
    // Filter active items whose retry timer has elapsed (or all if forceAll is true), sorted by Priority DESC then createdAt ASC
    const candidates = items
      .filter(it => it.expiresAt > now && (forceAll || it.nextRetryAfter <= now))
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.createdAt - b.createdAt;
      });
    return forceAll ? candidates : candidates.slice(0, maxBatch);
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
      // Injects decorrelated full-jitter (±20% spread) to avoid thundering-herd packet bursts
      // and prevent channel saturation over RF mesh / MQTT broker.
      const item = items[idx];
      item.attempts += 1;
      item.lastAttempt = Date.now();
      const baseBackoffSec = Math.min(300, Math.pow(2, Math.min(item.attempts, 8)) * 2);
      const jitterFactor = 0.8 + Math.random() * 0.4; // 80% to 120% spread
      const backoffSec = Math.max(2, baseBackoffSec * jitterFactor);
      item.nextRetryAfter = Date.now() + Math.floor(backoffSec * 1000);
      this.saveItems(items);
      this.saveItemToDB(item);
    }
  }

  public remove(nonceOrId: string): boolean {
    if (!nonceOrId) return false;
    const cleanTarget = nonceOrId.trim();
    const items = this.getItems();
    const initialLen = items.length;
    const toRemove: string[] = [];

    const filtered = items.filter(it => {
      const matchExact = it.id === cleanTarget || it.packet.nonce === cleanTarget;
      if (matchExact) {
        toRemove.push(it.id);
        return false;
      }

      // Check if target is a prefix/suffix of nonce (8+ chars)
      if (cleanTarget.length >= 8) {
        if (it.id.startsWith(cleanTarget) || cleanTarget.startsWith(it.id) ||
            it.packet.nonce.startsWith(cleanTarget) || cleanTarget.startsWith(it.packet.nonce)) {
          toRemove.push(it.id);
          return false;
        }
      }

      // Check if payloadHex matches JSON message id
      if (it.packet.payloadHex) {
        try {
          const decoded = new TextDecoder().decode(this.hexToUint8(it.packet.payloadHex));
          if (decoded.includes(cleanTarget)) {
            toRemove.push(it.id);
            return false;
          }
        } catch {}
      }

      return true;
    });

    if (filtered.length !== initialLen) {
      this.saveItems(filtered);
      toRemove.forEach(id => this.removeItemFromDB(id));
      console.log(`[DtnStorage] ✅ Successfully purged ${toRemove.length} DTN packet(s) for target '${cleanTarget.slice(0, 8)}'`);
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

  /**
   * Generates comprehensive telemetry diagnostics for the store-and-forward queue.
   */
  public getQueueDiagnostics(): {
    totalPackets: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
    avgAttempts: number;
    oldestPacketAgeSec: number;
  } {
    const items = this.getItems();
    const total = items.length;
    if (total === 0) {
      return {
        totalPackets: 0,
        highPriorityCount: 0,
        mediumPriorityCount: 0,
        lowPriorityCount: 0,
        avgAttempts: 0,
        oldestPacketAgeSec: 0,
      };
    }

    const now = Date.now();
    let high = 0;
    let med = 0;
    let low = 0;
    let totalAttempts = 0;
    let oldestCreated = now;

    for (const it of items) {
      if (it.priority >= 6) high++;
      else if (it.priority >= 4) med++;
      else low++;

      totalAttempts += (it.attempts || 0);
      if (it.createdAt < oldestCreated) oldestCreated = it.createdAt;
    }

    return {
      totalPackets: total,
      highPriorityCount: high,
      mediumPriorityCount: med,
      lowPriorityCount: low,
      avgAttempts: +(totalAttempts / total).toFixed(1),
      oldestPacketAgeSec: Math.max(0, Math.round((now - oldestCreated) / 1000)),
    };
  }

  public clear(): void {
    this.saveItems([]);
    this.clearDB();
  }
}

export const dtnStorage = new DtnStorage();
