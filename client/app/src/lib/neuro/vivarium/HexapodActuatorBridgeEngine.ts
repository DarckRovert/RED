/**
 * HexapodActuatorBridgeEngine.ts — RED Sovereign Mesh OS
 * 
 * Puente de Telemetría y Actuación Robótica Física para Hexápodos.
 * Traduce la cinemática biológica 3D calculada por el CentralPatternGeneratorEngine
 * y HexapodBody3D (18 servomotores / articulaciones 3-DOF: Coxa, Fémur, Tibia x 6 patas)
 * a tramas binarias y ASCII serializadas para controlar robots hexápodos físicos reales
 * (ESP32-S3, Arduino, controladores PCA9685 de 18 canales, etc.) vía USB-OTG o BLE NUS.
 */

import { LoraSerialBridgeEngine } from '../../hardware/LoraSerialBridgeEngine';

export interface HexapodJointAngles {
  legIndex: number; // 0=L1, 1=L2, 2=L3, 3=R1, 4=R2, 5=R3
  coxaDeg: number;  // [0..180]
  femurDeg: number; // [0..180]
  tibiaDeg: number; // [0..180]
}

export interface ActuatorBridgeTelemetry {
  isStreaming: boolean;
  framesSent: number;
  lastAsciiFrame: string;
  lastBinaryFrameHex: string;
  updateRateHz: number;
  lastTimestamp: number;
}

export class HexapodActuatorBridgeEngine {
  private static instance: HexapodActuatorBridgeEngine | null = null;

  private isStreaming = false;
  private framesSent = 0;
  private lastAsciiFrame = '';
  private lastBinaryFrameHex = '';
  private lastSendTime = 0;
  private readonly THROTTLE_MS = 33; // ~30 Hz (tasa estándar óptima para servomotores PWM 50Hz)

  // Amortiguación de re-renders para UI / React (4 Hz = 250 ms)
  private static readonly HUD_NOTIFY_THROTTLE_MS = 250;
  private lastNotifyTime = 0;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  private listeners: Set<(t: ActuatorBridgeTelemetry) => void> = new Set();

  private constructor() {}

  public static getInstance(): HexapodActuatorBridgeEngine {
    if (!this.instance) {
      this.instance = new HexapodActuatorBridgeEngine();
    }
    return this.instance;
  }

  public subscribe(cb: (t: ActuatorBridgeTelemetry) => void): () => void {
    this.listeners.add(cb);
    cb(this.getTelemetry());
    return () => this.listeners.delete(cb);
  }

  private notify(force = false): void {
    const now = performance.now();
    const elapsed = now - this.lastNotifyTime;

    if (force || elapsed >= HexapodActuatorBridgeEngine.HUD_NOTIFY_THROTTLE_MS) {
      if (this.notifyTimer) {
        clearTimeout(this.notifyTimer);
        this.notifyTimer = null;
      }
      this.lastNotifyTime = now;
      this.dispatchTelemetry();
    } else if (!this.notifyTimer) {
      this.notifyTimer = setTimeout(() => {
        this.notifyTimer = null;
        this.lastNotifyTime = performance.now();
        this.dispatchTelemetry();
      }, HexapodActuatorBridgeEngine.HUD_NOTIFY_THROTTLE_MS - elapsed);
    }
  }

  private dispatchTelemetry(): void {
    const tel = this.getTelemetry();
    this.listeners.forEach((cb) => {
      try {
        cb(tel);
      } catch (err) {
        console.error('[HexapodActuatorBridgeEngine] Listener error:', err);
      }
    });
  }

  public getTelemetry(): ActuatorBridgeTelemetry {
    return {
      isStreaming: this.isStreaming,
      framesSent: this.framesSent,
      lastAsciiFrame: this.lastAsciiFrame,
      lastBinaryFrameHex: this.lastBinaryFrameHex,
      updateRateHz: 30,
      lastTimestamp: this.lastSendTime,
    };
  }

  public setStreaming(enabled: boolean): void {
    this.isStreaming = enabled;
    this.notify(true);
  }

  /**
   * Calcula el CRC-8 Dallas/Maxim (polinomio 0x31, init 0x00)
   */
  public static computeCrc8(data: Uint8Array): number {
    let crc = 0x00;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x80) !== 0) {
          crc = ((crc << 1) ^ 0x31) & 0xff;
        } else {
          crc = (crc << 1) & 0xff;
        }
      }
    }
    return crc;
  }

  /**
   * Serializa los 18 ángulos articulares en una trama ASCII canónica:
   * $HEX,c0,f0,t0,c1,f1,t1,...,c5,f5,t5*<CRC8_HEX>\n
   */
  public static serializeAsciiFrame(angles: number[]): string {
    const clamped = angles.map((a) => Math.max(0, Math.min(180, Math.round(a))));
    const payload = `HEX,${clamped.join(',')}`;
    const encoder = new TextEncoder();
    const crc = this.computeCrc8(encoder.encode(payload));
    const crcHex = crc.toString(16).toUpperCase().padStart(2, '0');
    return `$${payload}*${crcHex}\n`;
  }

  /**
   * Serializa los 18 ángulos articulares en una trama binaria compacta (21 bytes):
   * [0x58, 0x48, ...18 bytes de ángulos uint8, CRC8]
   */
  public static serializeBinaryFrame(angles: number[]): Uint8Array {
    const clamped = angles.map((a) => Math.max(0, Math.min(180, Math.round(a))));
    const frame = new Uint8Array(21);
    frame[0] = 0x58; // 'X'
    frame[1] = 0x48; // 'H'
    for (let i = 0; i < 18; i++) {
      frame[2 + i] = clamped[i] ?? 90;
    }
    frame[20] = this.computeCrc8(frame.subarray(0, 20));
    return frame;
  }

  /**
   * Procesa y despacha la cinemática de un fotograma del CPG a hardware físico
   * @param jointAngles Array plano de 18 números en grados [L1_c, L1_f, L1_t, L2_c, ..., R3_t]
   */
  public dispatchJointAngles(jointAngles: number[]): void {
    if (!this.isStreaming || jointAngles.length < 18) return;

    const now = performance.now();
    if (now - this.lastSendTime < this.THROTTLE_MS) return;
    this.lastSendTime = now;

    const ascii = HexapodActuatorBridgeEngine.serializeAsciiFrame(jointAngles);
    const binary = HexapodActuatorBridgeEngine.serializeBinaryFrame(jointAngles);

    this.lastAsciiFrame = ascii.trim();
    this.lastBinaryFrameHex = Array.from(binary)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    this.framesSent++;

    // Despacho a través de LoraSerialBridgeEngine si hay enlace conectado
    try {
      const lora = LoraSerialBridgeEngine.getInstance();
      const loraTel = lora.getTelemetry();
      if (loraTel.connected) {
        // Enviar trama binaria COBS
        const cobsFrame = LoraSerialBridgeEngine.encodeCOBS(binary);
        lora.sendPacket(cobsFrame).catch(() => {});
      }
    } catch (err) {
      // Hardware bridge no disponible en este ciclo
    }

    this.notify();
  }

  public destroy(): void {
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
    }
    this.listeners.clear();
    this.isStreaming = false;
    HexapodActuatorBridgeEngine.instance = null;
  }
}

export const hexapodActuatorBridge = HexapodActuatorBridgeEngine.getInstance();
