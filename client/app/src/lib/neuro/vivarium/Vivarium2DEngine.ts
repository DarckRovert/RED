/**
 * Vivarium2DEngine.ts — RED Sovereign Mesh OS
 * 
 * Motor de Renderizado 2D Táctico Ultra-Ligero (HTML5 Canvas Sonar / Radar).
 * Diseñado para operar en smartphones de campo con consumo inferior al 2% de CPU.
 * Dibuja la celosía entorrinal, las 6 patas articuladas del hexápodo según el CPG,
 * el cono de visión del lóbulo óptico, las torres LoRa y el estado del Guardián.
 */

import { centralPatternGenerator, CpgLocomotionTelemetry, LegIdentifier } from '../CentralPatternGeneratorEngine';
import { ringAttractor } from '../RingAttractorEngine';
import { giantFiberReflex } from '../GiantFiberReflexEngine';

export class Vivarium2DEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private isRunning = false;

  // Estado del Agente
  public agentX = 0;
  public agentZ = 0;
  public agentHeading = 0; // Grados
  public isManualControl = false;
  private manualHeading = 0;
  private manualSpeed = 0;

  // Estímulos
  public threatActive = false;
  public dtnPacket: { x: number; z: number } | null = null;
  public activeTdmaSlot = 0;

  private tdmaTimer: ReturnType<typeof setInterval> | null = null;

  // Zoom Táctico del Radar
  public zoomFactor = 1.0;

  constructor() {
    this.tdmaTimer = setInterval(() => {
      this.activeTdmaSlot = (this.activeTdmaSlot + 1) % 10;
    }, 200);
  }

  public attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.handleResize();
    this.start();
  }

  public detach(): void {
    this.pause();
    this.canvas = null;
    this.ctx = null;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;
      const deltaSec = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      this.tick(deltaSec);
      this.draw();

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public pause(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private tick(deltaSec: number): void {
    const cpgTel = centralPatternGenerator.getTelemetry();

    // Velocidad
    let speed = 2.0;
    if (cpgTel.gaitMode === 'ESCAPE_SPRINT') speed = 4.8;
    else if (cpgTel.gaitMode === 'QUIESCENT') speed = 0;

    if (this.isManualControl) {
      speed = this.manualSpeed;
      this.agentHeading = this.manualHeading;
    } else {
      if (this.dtnPacket) {
        const dx = this.dtnPacket.x - this.agentX;
        const dz = this.dtnPacket.z - this.agentZ;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.8) {
          const targetDeg = (Math.atan2(dx, dz) * 180) / Math.PI;
          this.agentHeading = targetDeg;
        } else {
          this.dtnPacket = null;
        }
      } else {
        this.agentHeading = ringAttractor.getTelemetry().headingDeg;
      }
    }

    const rad = (this.agentHeading * Math.PI) / 180;
    this.agentX += Math.sin(rad) * speed * deltaSec;
    this.agentZ += Math.cos(rad) * speed * deltaSec;

    // Límite de arena (Radio 16m)
    const dist = Math.hypot(this.agentX, this.agentZ);
    if (dist > 15) {
      const angle = Math.atan2(this.agentZ, this.agentX);
      this.agentX = Math.cos(angle) * 15;
      this.agentZ = Math.sin(angle) * 15;
      this.agentHeading = (this.agentHeading + 180) % 360;
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = (Math.min(w, h) / 38) * this.zoomFactor; // 38 metros visibles escalados por zoomFactor

    // 1. Limpiar fondo táctico
    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, 0, w, h);

    // 2. Anillos de Radar y Celosía
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    [5, 10, 15].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Muro perimétrico
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 16 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Dibujar Torres LoRa TDMA
    const towerCoords = [
      { x: -11, z: -11, slot: 0 },
      { x: 11, z: -11, slot: 2 },
      { x: 11, z: 11, slot: 4 },
      { x: -11, z: 11, slot: 8 },
    ];

    towerCoords.forEach((t) => {
      const tx = cx + t.x * scale;
      const ty = cy + t.z * scale;
      const isActive = t.slot === this.activeTdmaSlot;

      ctx.fillStyle = isActive ? '#00ff88' : '#1f293d';
      ctx.strokeStyle = isActive ? '#00ff88' : '#00f0ff';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (isActive) {
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
        ctx.beginPath();
        ctx.arc(tx, ty, 16, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = '#a0aec0';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`SLOT ${t.slot}`, tx - 18, ty - 10);
    });

    // 4. Centinela Guardian IA Central
    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.strokeStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#00f0ff';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText('GUARDIAN', cx - 22, cy + 24);

    // 5. Paquete DTN si existe
    if (this.dtnPacket) {
      const px = cx + this.dtnPacket.x * scale;
      const py = cy + this.dtnPacket.z * scale;
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 10;
      ctx.fillRect(px - 5, py - 5, 10, 10);
      ctx.shadowBlur = 0;
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText('DTN BUNDLE', px - 25, py - 8);
    }

    // 6. Dibujar Agente Hexápodo (Drosophila)
    const ax = cx + this.agentX * scale;
    const ay = cy + this.agentZ * scale;
    const hRad = (this.agentHeading * Math.PI) / 180;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(hRad);

    // Cono de Detección Visual (Lóbulo Óptico)
    const fovAngle = Math.PI / 2.5; // ~72°
    const fovDist = 4.5 * scale;
    ctx.fillStyle = this.threatActive
      ? 'rgba(255, 51, 85, 0.35)'
      : 'rgba(0, 240, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, fovDist, -fovAngle / 2 - Math.PI / 2, fovAngle / 2 - Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // Cuerpo Táctico (Tórax y Abdomen)
    ctx.fillStyle = '#222a38';
    ctx.strokeStyle = this.threatActive ? '#ff3355' : '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cabeza y Ojos
    ctx.fillStyle = this.threatActive ? '#ff0033' : '#00ff88';
    ctx.beginPath();
    ctx.arc(-4, -12, 3, 0, Math.PI * 2);
    ctx.arc(4, -12, 3, 0, Math.PI * 2);
    ctx.fill();

    // 6 Patas Esquemáticas articuladas
    const cpgTel = centralPatternGenerator.getTelemetry();
    const legOffsets = [
      { id: 'LF', x: -6, y: -6, sign: -1 },
      { id: 'LM', x: -7, y: 0, sign: -1 },
      { id: 'LH', x: -6, y: 6, sign: -1 },
      { id: 'RF', x: 6, y: -6, sign: 1 },
      { id: 'RM', x: 7, y: 0, sign: 1 },
      { id: 'RH', x: 6, y: 6, sign: 1 },
    ];

    legOffsets.forEach((l) => {
      const state = cpgTel.legs[l.id as LegIdentifier];
      const isGround = state ? state.isGroundContact : false;
      const kneeX = l.x + l.sign * 8;
      const kneeY = l.y + (state ? (state.joints.femurDeg * 0.15) : 0);
      const tipX = kneeX + l.sign * 6;
      const tipY = kneeY + 4;

      ctx.strokeStyle = isGround ? '#00ff88' : '#4a5568';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    });

    ctx.restore();
  }

  private threatTimeout: ReturnType<typeof setTimeout> | null = null;

  public triggerThreat(): void {
    this.threatActive = true;
    giantFiberReflex.triggerReflex('VISUAL_LOOMING_THREAT');
    if (this.threatTimeout) clearTimeout(this.threatTimeout);
    this.threatTimeout = setTimeout(() => {
      this.threatActive = false;
      this.threatTimeout = null;
    }, 1800);
  }

  public spawnPacket(): void {
    const angle = Math.random() * Math.PI * 2;
    const d = 5 + Math.random() * 7;
    this.dtnPacket = {
      x: Math.cos(angle) * d,
      z: Math.sin(angle) * d,
    };
  }

  public setManualControl(active: boolean): void {
    this.isManualControl = active;
    if (active) {
      this.manualHeading = this.agentHeading;
      this.manualSpeed = 0;
      centralPatternGenerator.setLocomotionDrive(0, 0);
    } else {
      centralPatternGenerator.setLocomotionDrive(0.65, 0);
    }
  }

  public setManualSteering(speed: number, headingOffsetDeg: number): void {
    this.manualSpeed = speed;
    this.manualHeading = ((this.manualHeading + headingOffsetDeg) % 360 + 360) % 360;
    const speedNorm = Math.min(1.0, speed / 3.0);
    const turnBias = Math.max(-1.0, Math.min(1.0, headingOffsetDeg / 45.0));
    centralPatternGenerator.setLocomotionDrive(speedNorm, turnBias);
  }

  public zoomIn(): void {
    this.zoomFactor = Math.min(2.5, this.zoomFactor + 0.25);
  }

  public zoomOut(): void {
    this.zoomFactor = Math.max(0.6, this.zoomFactor - 0.25);
  }

  public resetZoom(): void {
    this.zoomFactor = 1.0;
  }

  public handleResize(): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
    }
  }

  public dispose(): void {
    this.detach();
    if (this.tdmaTimer) clearInterval(this.tdmaTimer);
    if (this.threatTimeout) {
      clearTimeout(this.threatTimeout);
      this.threatTimeout = null;
    }
  }
}
