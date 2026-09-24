/**
 * HabitatMeshBridgeEngine.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Protocolo de Migración Ecológica Inter-Dispositivo en Malla P2P (mesh.bio.habitat.v1).
 * 
 * Permite que organismos bio-cibernéticos in-silico (Drosophila, C. elegans, etc.)
 * migren físicamente entre terminales móviles o tabletas conectadas por radio LoRa,
 * Bluetooth LE o WiFi Direct sin intermediación de servidores centrales:
 * - Serializa el genoma, reserva de ATP y matriz de plasticidad sináptica STDP a una trama binaria compacta (72 bytes).
 * - Despacha la trama por difusión (broadcast) en la malla táctica a través de meshRouter.
 * - Desempaqueta y reencarna al organismo en la terminal receptora preservando su aprendizaje.
 */

import { meshRouter } from '../../mesh/meshRouter';

export type MigratoryOrganismType = 'DROSOPHILA' | 'C_ELEGANS' | 'ANT' | 'HUMAN_NEOCORTEX' | 'GRAVITY_SENTINEL';

export interface ImmigrantOrganismData {
  type: MigratoryOrganismType;
  atpLevel: number;        // [0.0 - 1.0]
  headingRad: number;      // Rumbo angular al emerger
  speedMps: number;        // Velocidad inercial
  generation: number;
  synapticWeights: Uint8Array; // 64 bytes de pesos sinápticos STDP
  originPeerId: string;
  receivedAt: number;
}

export interface HabitatMeshTelemetry {
  isListening: boolean;
  totalEmigrations: number;
  totalImmigrations: number;
  lastMigrationTimestamp: number;
  connectedMeshPeersCount: number;
}

export class HabitatMeshBridgeEngine {
  private static instance: HabitatMeshBridgeEngine | null = null;

  public static readonly PROTOCOL_MAGIC = 0xbe; // Bio-Ecosystem Magic Byte
  public static readonly PROTOCOL_VERSION = 0x01;
  public static readonly BROADCAST_RECIPIENT = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

  private isListening = false;
  private totalEmigrations = 0;
  private totalImmigrations = 0;
  private lastMigrationTimestamp = 0;

  private unsubMesh: (() => void) | null = null;
  private listeners: Set<(immigrant: ImmigrantOrganismData) => void> = new Set();

  private constructor() {}

  public static getInstance(): HabitatMeshBridgeEngine {
    if (!this.instance) {
      this.instance = new HabitatMeshBridgeEngine();
    }
    return this.instance;
  }

  /**
   * Inicia la escucha de tramas de migración ecológica en la malla P2P.
   */
  public start(): void {
    if (this.isListening) return;
    this.isListening = true;

    try {
      this.unsubMesh = meshRouter.onLocalDelivery((packet: any) => {
        if (!packet || !packet.payload) return;
        this.handleInboundPacket(packet.payload, packet.sender || 'unknown-peer');
      });
    } catch (e) {
      console.warn('[HabitatMeshBridge] No se pudo acoplar a meshRouter en este entorno:', e);
    }
  }

  public stop(): void {
    if (this.unsubMesh) {
      this.unsubMesh();
      this.unsubMesh = null;
    }
    this.isListening = false;
  }

  public onOrganismImmigrated(cb: (immigrant: ImmigrantOrganismData) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Serializa un organismo a una trama de 72 bytes y la transmite por la malla táctica.
   */
  public async broadcastEmigration(
    type: MigratoryOrganismType,
    atpLevel: number,
    headingRad: number,
    speedMps: number,
    generation: number,
    synapticWeights: Uint8Array
  ): Promise<boolean> {
    const payload = this.serializeOrganism(type, atpLevel, headingRad, speedMps, generation, synapticWeights);
    this.totalEmigrations++;
    this.lastMigrationTimestamp = Date.now();

    try {
      const res = await meshRouter.send(HabitatMeshBridgeEngine.BROADCAST_RECIPIENT, payload);
      return res === 'sent' || res === 'queued';
    } catch {
      return false;
    }
  }

  /**
   * Serializa un organismo a trama binaria compacta de 72 bytes:
   * [0]: Magic Byte (0xBE)
   * [1]: Version (0x01)
   * [2]: Type (1=Drosophila, 2=C_Elegans, 3=Ant)
   * [3]: ATP Ratio (0..100)
   * [4..5]: Heading (uint16: 0..3600 -> 0.1 deg)
   * [6]: Speed (uint8: 0..255 -> 0.02 m/s)
   * [7]: Generation (uint8)
   * [8..71]: 64 bytes de pesos cuantizados STDP
   */
  public serializeOrganism(
    type: MigratoryOrganismType,
    atpLevel: number,
    headingRad: number,
    speedMps: number,
    generation: number,
    synapticWeights: Uint8Array
  ): Uint8Array {
    const buffer = new Uint8Array(72);
    buffer[0] = HabitatMeshBridgeEngine.PROTOCOL_MAGIC;
    buffer[1] = HabitatMeshBridgeEngine.PROTOCOL_VERSION;

    let typeCode = 1;
    if (type === 'C_ELEGANS') typeCode = 2;
    else if (type === 'ANT') typeCode = 3;
    else if (type === 'HUMAN_NEOCORTEX') typeCode = 4;
    else if (type === 'GRAVITY_SENTINEL') typeCode = 5;
    buffer[2] = typeCode;

    buffer[3] = Math.floor(Math.max(0, Math.min(1, atpLevel)) * 100);

    const deg = (((headingRad * 180.0 / Math.PI) % 360.0) + 360.0) % 360.0;
    const degInt = Math.floor(deg * 10); // 0..3599
    buffer[4] = (degInt >> 8) & 0xff;
    buffer[5] = degInt & 0xff;

    buffer[6] = Math.floor(Math.max(0, Math.min(5.0, speedMps)) * 50); // 0..250
    buffer[7] = Math.min(255, generation);

    const weightsLen = Math.min(64, synapticWeights.length);
    for (let i = 0; i < weightsLen; i++) {
      buffer[8 + i] = synapticWeights[i];
    }

    return buffer;
  }

  /**
   * Deserializa una trama binaria y la valida.
   */
  public deserializeOrganism(payload: Uint8Array, senderPeerId: string): ImmigrantOrganismData | null {
    if (payload.length < 72) return null;
    if (payload[0] !== HabitatMeshBridgeEngine.PROTOCOL_MAGIC || payload[1] !== HabitatMeshBridgeEngine.PROTOCOL_VERSION) {
      return null;
    }

    let type: MigratoryOrganismType = 'DROSOPHILA';
    if (payload[2] === 2) type = 'C_ELEGANS';
    else if (payload[2] === 3) type = 'ANT';
    else if (payload[2] === 4) type = 'HUMAN_NEOCORTEX';
    else if (payload[2] === 5) type = 'GRAVITY_SENTINEL';

    const atpLevel = payload[3] / 100.0;
    const degInt = (payload[4] << 8) | payload[5];
    const headingRad = (degInt / 10.0) * (Math.PI / 180.0);
    const speedMps = payload[6] / 50.0;
    const generation = payload[7];

    const synapticWeights = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      synapticWeights[i] = payload[8 + i];
    }

    return {
      type,
      atpLevel,
      headingRad,
      speedMps,
      generation,
      synapticWeights,
      originPeerId: senderPeerId,
      receivedAt: Date.now(),
    };
  }

  private handleInboundPacket(payload: Uint8Array, sender: string): void {
    const immigrant = this.deserializeOrganism(payload, sender);
    if (!immigrant) return;

    this.totalImmigrations++;
    this.lastMigrationTimestamp = Date.now();

    this.listeners.forEach(cb => {
      try {
        cb(immigrant);
      } catch (err) {
        console.error('[HabitatMeshBridge] Error procesando inmigrante:', err);
      }
    });
  }

  public getTelemetry(): HabitatMeshTelemetry {
    return {
      isListening: this.isListening,
      totalEmigrations: this.totalEmigrations,
      totalImmigrations: this.totalImmigrations,
      lastMigrationTimestamp: this.lastMigrationTimestamp,
      connectedMeshPeersCount: meshRouter?.peers ? meshRouter.peers.size : 0,
    };
  }
}

export const habitatMeshBridge = HabitatMeshBridgeEngine.getInstance();
