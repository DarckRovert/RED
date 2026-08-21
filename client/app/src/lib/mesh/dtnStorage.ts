/**
 * RED DTN (Delay-Tolerant Networking) Persistent Storage
 * 
 * Manages persistent Store-and-Forward packet queuing across app reboots,
 * background mode transitions, and intermittent network blackouts.
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

const STORAGE_KEY = 'red_dtn_pending_queue_v1';
const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days retention for sovereign mesh DTN
const MAX_QUEUE_SIZE = 1000;

class DtnStorage {
  private cache: DtnQueueItem[] | null = null;

  private getItems(): DtnQueueItem[] {
    if (this.cache !== null) return this.cache;
    if (typeof window === 'undefined') return [];

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.cache = JSON.parse(raw);
        if (!Array.isArray(this.cache)) this.cache = [];
      } else {
        this.cache = [];
      }
    } catch (e) {
      console.warn('[DtnStorage] Failed to parse DTN queue from storage:', e);
      this.cache = [];
    }
    return this.cache;
  }

  private saveItems(items: DtnQueueItem[]) {
    this.cache = items;
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('[DtnStorage] Storage quota reached, pruning expired and lowest priority packets:', e);
      try {
        const now = Date.now();
        const pruned = items.filter(it => it.expiresAt > now).slice(-200);
        this.cache = pruned;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
      } catch (inner) {
        console.error('[DtnStorage] Critical storage error, keeping in-memory queue only:', inner);
      }
    }
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
      items.shift();
    }

    items.push(item);
    this.saveItems(items);
    console.log(`[DtnStorage] Enqueued packet ${nonce.slice(0, 8)} (Priority: ${calculatedPriority}) for ${packet.recipient.slice(0, 8)} (queue size: ${items.length})`);
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
      items.splice(idx, 1);
      this.saveItems(items);
      console.log(`[DtnStorage] Packet ${nonce.slice(0, 8)} delivered and removed from DTN queue`);
    } else {
      // Calculate exponential backoff: 3s, 6s, 12s, 24s... capped at 5 minutes
      const item = items[idx];
      item.attempts += 1;
      item.lastAttempt = Date.now();
      const backoffSec = Math.min(300, Math.pow(2, Math.min(item.attempts, 8)) * 2);
      item.nextRetryAfter = Date.now() + backoffSec * 1000;
      this.saveItems(items);
    }
  }

  public remove(nonce: string): boolean {
    const items = this.getItems();
    const initialLen = items.length;
    const filtered = items.filter(it => it.id !== nonce);
    if (filtered.length !== initialLen) {
      this.saveItems(filtered);
      return true;
    }
    return false;
  }

  public removeByRecipient(recipient: string): void {
    const items = this.getItems();
    const filtered = items.filter(it => it.targetRecipient !== recipient && !it.targetRecipient.startsWith(recipient));
    if (filtered.length !== items.length) {
      this.saveItems(filtered);
    }
  }

  public purgeExpired(): number {
    const now = Date.now();
    const items = this.getItems();
    const initialLen = items.length;
    const active = items.filter(it => it.expiresAt > now);
    if (active.length !== initialLen) {
      this.saveItems(active);
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
  }
}

export const dtnStorage = new DtnStorage();
