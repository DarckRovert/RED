/**
 * RED v64.0.0 — DNS Tunneling Engine (UDP 53 & DoH Fallback)
 * 
 * Permite la transmisión de paquetes cifrados Noise XK a través de consultas DNS
 * cuando el usuario no posee saldo de datos en su red celular.
 * Las operadoras no pueden bloquear las consultas DNS (UDP 53 / DoH) al ser requeridas
 * para resolver dominios y portales de pago.
 */

export interface DnsPacketFrame {
  id: string;
  chunkIndex: number;
  totalChunks: number;
  payloadBase32: string;
  timestamp: number;
}

export interface DnsTunnelStats {
  packetsSent: number;
  packetsReceived: number;
  bytesTransmitted: number;
  activeProvider: string;
  lastResponseTimeMs: number;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Codifica una cadena o Uint8Array a Base32 URL-Safe para subdominios DNS
 */
export function encodeBase32(buffer: Uint8Array): string {
  if (!buffer || typeof buffer.length !== 'number' || buffer.length === 0) {
    return "";
  }
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output.toLowerCase();
}

/**
 * Decodifica una cadena Base32 a Uint8Array
 */
export function decodeBase32(input: string): Uint8Array {
  const cleanInput = typeof input === 'string' ? input.toUpperCase().replace(/=+$/, "") : "";
  if (!cleanInput) return new Uint8Array(0);

  const output: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleanInput.length; i++) {
    const index = BASE32_ALPHABET.indexOf(cleanInput[i]);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

export class DnsTunnelEngine {
  private static stats: DnsTunnelStats = {
    packetsSent: 0,
    packetsReceived: 0,
    bytesTransmitted: 0,
    activeProvider: "DoH (Cloudflare 1.1.1.1 / Google 8.8.8.8)",
    lastResponseTimeMs: 18,
  };

  private static DOH_PROVIDERS = [
    "https://1.1.1.1/dns-query",
    "https://8.8.8.8/resolve",
    "https://dns.quad9.net/dns-query",
  ];

  /**
   * Encapsula un mensaje cifrado Noise XK en subdominios DNS (max 63 chars por etiqueta)
   */
  public static packPayloadIntoDnsQuery(encryptedPayloadHex: string, domainZone = "dns.redmesh.net"): string[] {
    const rawStr = typeof encryptedPayloadHex === 'string' ? encryptedPayloadHex : '';
    if (!rawStr) return [];
    const rawBytes = new TextEncoder().encode(rawStr);
    const b32 = encodeBase32(rawBytes);
    if (!b32) return [];
    
    // Fragmentar en etiquetas DNS de máximo 48 caracteres para seguridad
    const CHUNK_SIZE = 48;
    const chunks: string[] = [];
    const rand = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint16Array(1))[0] : (Date.now() & 0xffff);
    const sessionId = (1000 + (rand % 9000)).toString(36);

    for (let i = 0; i < b32.length; i += CHUNK_SIZE) {
      chunks.push(b32.slice(i, i + CHUNK_SIZE));
    }

    return chunks.map((chunk, idx) => `${chunk}.s${sessionId}.p${idx + 1}of${chunks.length}.${domainZone}`);
  }

  /**
   * Ejecuta la transmisión de una consulta DNS sin saldo vía DoH o UDP
   */
  public static async transmitDnsQuery(dnsHostname: string): Promise<{ success: boolean; responseTxt?: string; latencyMs: number; reason?: string }> {
    const safeHostname = typeof dnsHostname === 'string' ? dnsHostname.trim() : '';
    if (!safeHostname) {
      return {
        success: false,
        responseTxt: undefined,
        latencyMs: 0,
        reason: 'Hostname DNS nulo o vacío',
      };
    }

    const startTime = performance.now();
    this.stats.packetsSent++;
    this.stats.bytesTransmitted += safeHostname.length;

    // 1. Intento por DoH (Cloudflare / Google / Quad9)
    for (const provider of this.DOH_PROVIDERS) {
      try {
        const dohUrl = `${provider}?name=${encodeURIComponent(safeHostname)}&type=TXT`;
        const res = await fetch(dohUrl, {
          headers: { Accept: "application/dns-json" },
          cache: "no-store",
          signal: AbortSignal.timeout(3500),
        });

        const latencyMs = Math.round(performance.now() - startTime);
        this.stats.lastResponseTimeMs = latencyMs;

        if (res.ok) {
          const json = await res.json();
          this.stats.packetsReceived++;
          const answer = json.Answer && json.Answer.length > 0 ? json.Answer[0].data : "OK_ACK";
          return { success: true, responseTxt: answer, latencyMs };
        }
      } catch {}
    }

    // 2. Fallback a UDP Puerto 53 sin saldo (vía backend local RED / Native UDP Socket)
    try {
      let nodeUrl = 'http://127.0.0.1:7333';
      try {
        const { getNodeUrl } = await import('../../api/core');
        nodeUrl = getNodeUrl();
      } catch {}
      const res = await fetch(`${nodeUrl}/api/dns/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: safeHostname, record_type: 'TXT', port: 53 }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const json = await res.json();
        const latencyMs = Math.round(performance.now() - startTime);
        this.stats.lastResponseTimeMs = latencyMs;
        this.stats.packetsReceived++;
        return { success: true, responseTxt: json.answer || "UDP_53_ACK", latencyMs };
      }
    } catch {}

    const latencyMs = Math.round(performance.now() - startTime);
    return {
        success: false,
        responseTxt: undefined,
        latencyMs,
        reason: 'DoH y UDP 53 fallaron (red celular sin conectividad de nombres)',
    };
  }

  public static getStats(): DnsTunnelStats {
    return { ...this.stats };
  }

  public static resetStats(): void {
    this.stats = {
      packetsSent: 0,
      packetsReceived: 0,
      bytesTransmitted: 0,
      activeProvider: "DoH (Cloudflare 1.1.1.1 / Google 8.8.8.8)",
      lastResponseTimeMs: 18,
    };
  }
}
