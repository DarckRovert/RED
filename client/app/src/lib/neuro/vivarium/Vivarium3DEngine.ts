/**
 * Vivarium3DEngine.ts — RED Sovereign Mesh OS
 * 
 * Orquestador de Renderizado 3D WebGL (Three.js) del Vivarium Biocibernético.
 * Integra el agente hexápodo (CPG/Drosophila), la celosía entorrinal humana,
 * el centinela Guardian IA y la topología espectral LoRa TDMA en una arena
 * interactiva a 60 FPS con gestión de ciclo de vida desacoplada y sin fugas de VRAM.
 */

import * as THREE from 'three';
import { HexapodBody3D } from './HexapodBody3D';
import { EntorhinalGridFloor3D } from './EntorhinalGridFloor3D';
import { VivariumEntities3D } from './VivariumEntities3D';
import { centralPatternGenerator, CpgLocomotionTelemetry } from '../CentralPatternGeneratorEngine';
import { giantFiberReflex } from '../GiantFiberReflexEngine';
import { ringAttractor } from '../RingAttractorEngine';
import { johnstonOrgan } from '../JohnstonOrganEngine';
import { metabolicGovernor } from '../MetabolicNeuromorphicGovernor';
import { fanShapedBody } from '../FanShapedBodyEngine';
import { humanBrainOrchestrator } from '../human/HumanBrainOrchestrator';
import { PedestrianDeadReckoningEngine } from '../../sensors/PedestrianDeadReckoningEngine';
import { tacticalCompass } from '../../sensors/TacticalCompassEngine';
import { DynamicBearerGovernor } from '../../mesh/DynamicBearerGovernor';
import { RfSigintWatchdogEngine } from '../../sensors/RfSigintWatchdogEngine';
import { LoraSerialBridgeEngine } from '../../hardware/LoraSerialBridgeEngine';
import { loraTdmaScheduler } from '../../mesh/LoRaTdmaSchedulerEngine';
import { hexapodActuatorBridge } from './HexapodActuatorBridgeEngine';

export type VivariumCameraMode = 'ORBITAL' | 'FOLLOW_FLY' | 'TOP_DOWN_GOD';
export type VivariumControlMode = 'AUTONOMOUS' | 'MANUAL_DPAD' | 'PDR_TWIN';

export interface VivariumStimulusState {
  threatLoomingActive: boolean;
  rfJammingActive: boolean;
  guardianActive: boolean;
  activeTdmaSlot: number;
  dtnPacketTarget: { x: number; z: number } | null;
}

export class Vivarium3DEngine {
  private container: HTMLElement | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer | null = null;
  private animFrameId: number | null = null;
  private isRunning = false;

  // Entidades 3D
  private readonly hexapod: HexapodBody3D;
  private readonly floor: EntorhinalGridFloor3D;
  private readonly entities: VivariumEntities3D;
  private packetMesh: THREE.Mesh | null = null;

  // Estado Cinematográfico y Posición del Agente
  public cameraMode: VivariumCameraMode = 'ORBITAL';
  public controlMode: VivariumControlMode = 'AUTONOMOUS';
  public isActuatorStreaming = false;

  public get isManualControl(): boolean {
    return this.controlMode === 'MANUAL_DPAD';
  }
  public set isManualControl(val: boolean) {
    this.controlMode = val ? 'MANUAL_DPAD' : 'AUTONOMOUS';
  }

  private manualHeading = 0;
  private manualSpeed = 0;

  public agentX = 0;
  public agentZ = 0;
  public agentHeading = 0; // Grados [0 - 360)
  private currentCpgTelemetry: CpgLocomotionTelemetry;

  // Control de Cámara Orbital y Multi-Touch (Arrastre y Pinch-to-Zoom)
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private camSpherical = { radius: 24, theta: Math.PI / 4, phi: Math.PI / 3 };
  private activePointers = new Map<number, { x: number; y: number }>();
  private initialPinchDist: number | null = null;
  private initialPinchRadius = 24;

  // Control de Estímulos y Amenazas
  public stimulus: VivariumStimulusState = {
    threatLoomingActive: false,
    rfJammingActive: false,
    guardianActive: true,
    activeTdmaSlot: 0,
    dtnPacketTarget: null,
  };

  private tdmaTimer: ReturnType<typeof setInterval> | null = null;
  private threatTimeout: ReturnType<typeof setTimeout> | null = null;
  private jammingTimeout: ReturnType<typeof setTimeout> | null = null;
  private loraUnsub: (() => void) | null = null;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03060c);
    this.scene.fog = new THREE.FogExp2(0x03060c, 0.022);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.updateCameraPosition();

    // ── Iluminación Ambiental y Táctica ──────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x0e1726, 1.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 0.85);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    // ── Inicializar Entidades Procedurales ───────────────────────────────────
    this.floor = new EntorhinalGridFloor3D();
    this.scene.add(this.floor.rootGroup);

    this.entities = new VivariumEntities3D(this.floor.arenaRadius);
    this.scene.add(this.entities.rootGroup);

    this.hexapod = new HexapodBody3D();
    this.scene.add(this.hexapod.rootGroup);

    this.currentCpgTelemetry = centralPatternGenerator.getTelemetry();

    // Sincronización de supertrama LoRa TDMA con el programador real
    this.tdmaTimer = setInterval(() => {
      this.stimulus.activeTdmaSlot = loraTdmaScheduler.getCurrentSlot();
    }, 100);

    // Escucha de paquetes LoRa físicos para activar pulsos de torres y celosía
    try {
      this.loraUnsub = LoraSerialBridgeEngine.getInstance().onPacketReceived((_pkt) => {
        this.floor.triggerConsciousnessPulse();
        const towerPos = new THREE.Vector3(this.floor.arenaRadius * 0.9, 2.0, 0);
        this.entities.triggerGuardianIntercept(towerPos, false);
      });
    } catch {}
  }

  /**
   * Conecta el motor WebGL a un contenedor DOM
   */
  public attach(container: HTMLElement): void {
    if (this.container === container && this.renderer) return;
    this.detach();

    this.container = container;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    container.appendChild(this.renderer.domElement);

    // Resiliencia ante pérdida de contexto WebGL por suspensión de SO / app
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored, false);

    this.bindDomListeners(container);
    this.start();
  }

  public detach(): void {
    this.pause();
    this.unbindDomListeners();

    if (this.renderer && this.container) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);

      if (this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
      this.renderer = null;
    }
    this.container = null;
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

      if (this.renderer && this.container) {
        this.renderer.render(this.scene, this.camera);
      }
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

  /**
   * Bucle de simulación física y cinemática en cada tick
   */
  private tick(deltaSec: number): void {
    // 1. Obtener telemetría de los motores vivos del workspace
    this.currentCpgTelemetry = centralPatternGenerator.getTelemetry();
    const gfsTelemetry = giantFiberReflex.getTelemetry();
    const joTelemetry = johnstonOrgan.getTelemetry();

    // Sincronizar slot TDMA con el reloj de red LoRa real
    this.stimulus.activeTdmaSlot = loraTdmaScheduler.getCurrentSlot();

    // 1.5. Detectar perturbación RF / Guerra Electrónica real de hardware
    try {
      const isEwActive = DynamicBearerGovernor.getInstance().getTelemetry().isElectronicWarfareActive;
      const sigintThreat = RfSigintWatchdogEngine.getInstance().getTelemetry().threatLevel !== 'CLEAR';
      if (isEwActive || sigintThreat) {
        this.stimulus.rfJammingActive = true;
      }
    } catch {}

    // 2. Navegación y Cinemática de Desplazamiento del Agente
    let speedMps = 0;
    if (this.currentCpgTelemetry.gaitMode === 'TRIPOD') speedMps = 2.2;
    else if (this.currentCpgTelemetry.gaitMode === 'TETRAPOD') speedMps = 1.4;
    else if (this.currentCpgTelemetry.gaitMode === 'WAVE') speedMps = 0.8;
    else if (this.currentCpgTelemetry.gaitMode === 'ESCAPE_SPRINT') speedMps = 5.0;

    if (this.controlMode === 'MANUAL_DPAD') {
      speedMps = this.manualSpeed;
      this.agentHeading = this.manualHeading;
    } else if (this.controlMode === 'PDR_TWIN') {
      // MODO GEMELO FÍSICO PDR: Sincronización inercial con pasos reales
      const pdrState = PedestrianDeadReckoningEngine.getInstance().getState();
      const compassHeading = tacticalCompass.getTelemetry().headingDeg;
      this.agentHeading = compassHeading;

      if (pdrState.isTracking && pdrState.stepFrequencyHz > 0.15) {
        speedMps = Math.min(3.5, Math.max(0.8, pdrState.stepFrequencyHz * 0.8));
        centralPatternGenerator.setLocomotionDrive(Math.min(1.0, speedMps / 2.5), 0);
      } else {
        speedMps = 0;
        centralPatternGenerator.setLocomotionDrive(0, 0);
      }
    } else {
      // Modo Autónomo: Si hay paquete DTN en el campo, navegar hacia él
      if (this.stimulus.dtnPacketTarget) {
        const dx = this.stimulus.dtnPacketTarget.x - this.agentX;
        const dz = this.stimulus.dtnPacketTarget.z - this.agentZ;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.8) {
          const targetRad = Math.atan2(dx, dz);
          let targetDeg = (targetRad * 180) / Math.PI;
          if (targetDeg < 0) targetDeg += 360;

          // Rotar suavemente hacia el paquete
          const diff = ((targetDeg - this.agentHeading + 180) % 360) - 180;
          this.agentHeading += Math.sign(diff) * Math.min(Math.abs(diff), deltaSec * 90);
        } else {
          // Paquete entregado / absorbido
          this.consumeDtnPacket();
        }
      } else {
        // Exploración autónoma guiada por el Ring Attractor y Fan-Shaped Body
        this.agentHeading = ringAttractor.getTelemetry().headingDeg;
      }
    }

    // Calcular desplazamiento X-Z
    const headingRad = (this.agentHeading * Math.PI) / 180;
    this.agentX += Math.sin(headingRad) * speedMps * deltaSec;
    this.agentZ += Math.cos(headingRad) * speedMps * deltaSec;

    // Confinamiento en la arena (Border Cells rebotan)
    const distToCenter = Math.hypot(this.agentX, this.agentZ);
    const maxRadius = this.floor.arenaRadius - 1.2;
    if (distToCenter > maxRadius) {
      const angle = Math.atan2(this.agentZ, this.agentX);
      this.agentX = Math.cos(angle) * maxRadius;
      this.agentZ = Math.sin(angle) * maxRadius;
      this.agentHeading = (this.agentHeading + 180) % 360; // Rebote 180°
    }

    this.hexapod.rootGroup.position.set(this.agentX, 0, this.agentZ);

    // 3. Actualizar modelo biomecánico del hexápodo
    this.hexapod.update(
      deltaSec,
      this.currentCpgTelemetry,
      this.agentHeading,
      this.stimulus.threatLoomingActive,
      gfsTelemetry.isReflexActive,
      joTelemetry.acousticEnergyLevel
    );

    // Despacho de cinemática articular al actuador robótico si el streaming está activo
    if (this.isActuatorStreaming) {
      const jointAngles = this.hexapod.getFlatJointAngles(this.currentCpgTelemetry);
      hexapodActuatorBridge.dispatchJointAngles(jointAngles);
    }

    // 4. Actualizar suelo de cuadrícula entorrinal
    this.floor.update(this.agentX, this.agentZ, deltaSec);

    // 5. Actualizar entidades de IA y satélite
    this.entities.update(
      deltaSec,
      this.stimulus.activeTdmaSlot,
      this.stimulus.threatLoomingActive || this.stimulus.rfJammingActive
    );

    // 6. Actualizar cámara según el modo seleccionado
    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    if (this.cameraMode === 'ORBITAL') {
      const { radius, theta, phi } = this.camSpherical;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      this.camera.position.set(x, Math.max(1.5, y), z);
      this.camera.lookAt(0, 1.2, 0);
    } else if (this.cameraMode === 'FOLLOW_FLY') {
      const headingRad = (this.agentHeading * Math.PI) / 180;
      const camDist = 4.2;
      const camHeight = 2.4;
      const targetCamX = this.agentX - Math.sin(headingRad) * camDist;
      const targetCamZ = this.agentZ - Math.cos(headingRad) * camDist;

      this.camera.position.lerp(new THREE.Vector3(targetCamX, camHeight, targetCamZ), 0.12);
      this.camera.lookAt(this.agentX, 0.6, this.agentZ);
    } else if (this.cameraMode === 'TOP_DOWN_GOD') {
      this.camera.position.set(0, 32, 0.001);
      this.camera.lookAt(0, 0, 0);
    }
  }

  // ── Interacción y Disparo de Estímulos Tácticos ─────────────────────────────
  public injectThreatLooming(): void {
    this.stimulus.threatLoomingActive = true;
    giantFiberReflex.triggerReflex('VISUAL_LOOMING_THREAT');

    // Guardián neutraliza la amenaza virtual
    const threatPos = new THREE.Vector3(this.agentX + 1, 1.5, this.agentZ + 1);
    this.entities.triggerGuardianIntercept(threatPos, true);

    if (this.threatTimeout) clearTimeout(this.threatTimeout);
    this.threatTimeout = setTimeout(() => {
      this.stimulus.threatLoomingActive = false;
      this.threatTimeout = null;
    }, 1800);
  }

  public injectRfJamming(): void {
    this.stimulus.rfJammingActive = true;
    this.floor.triggerConsciousnessPulse();

    if (this.jammingTimeout) clearTimeout(this.jammingTimeout);
    this.jammingTimeout = setTimeout(() => {
      this.stimulus.rfJammingActive = false;
      this.jammingTimeout = null;
    }, 2500);
  }

  public spawnDtnPacket(): void {
    if (this.packetMesh) {
      this.scene.remove(this.packetMesh);
      this.packetMesh.geometry.dispose();
      if (Array.isArray(this.packetMesh.material)) {
        this.packetMesh.material.forEach((m) => m.dispose());
      } else {
        this.packetMesh.material.dispose();
      }
      this.packetMesh = null;
    }

    // Ubicación aleatoria en la arena
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 8;
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.packetMesh = new THREE.Mesh(geo, mat);
    this.packetMesh.position.set(px, 0.35, pz);
    this.scene.add(this.packetMesh);

    this.stimulus.dtnPacketTarget = { x: px, z: pz };
  }

  private consumeDtnPacket(): void {
    if (this.packetMesh) {
      this.scene.remove(this.packetMesh);
      this.packetMesh.geometry.dispose();
      if (Array.isArray(this.packetMesh.material)) {
        this.packetMesh.material.forEach((m) => m.dispose());
      } else {
        this.packetMesh.material.dispose();
      }
      this.packetMesh = null;
    }
    this.stimulus.dtnPacketTarget = null;
    this.floor.triggerConsciousnessPulse();
  }

  public setControlMode(mode: VivariumControlMode): void {
    this.controlMode = mode;
    if (mode === 'PDR_TWIN') {
      PedestrianDeadReckoningEngine.getInstance().startTracking();
      centralPatternGenerator.setLocomotionDrive(0, 0);
    } else if (mode === 'MANUAL_DPAD') {
      this.manualHeading = this.agentHeading;
      this.manualSpeed = 0;
      centralPatternGenerator.setLocomotionDrive(0, 0);
    } else {
      centralPatternGenerator.setLocomotionDrive(0.65, 0);
    }
  }

  public setManualControl(active: boolean): void {
    this.setControlMode(active ? 'MANUAL_DPAD' : 'AUTONOMOUS');
  }

  public setActuatorStreaming(streaming: boolean): void {
    this.isActuatorStreaming = streaming;
    hexapodActuatorBridge.setStreaming(streaming);
  }

  public setManualSteering(speed: number, headingOffsetDeg: number): void {
    this.manualSpeed = speed;
    this.manualHeading = ((this.manualHeading + headingOffsetDeg) % 360 + 360) % 360;
    const speedNorm = Math.min(1.0, speed / 3.0);
    const turnBias = Math.max(-1.0, Math.min(1.0, headingOffsetDeg / 45.0));
    centralPatternGenerator.setLocomotionDrive(speedNorm, turnBias);
  }

  // ── Gestión de Eventos DOM y Controles de Puntero ───────────────────────────
  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.pause();
  };

  private onContextRestored = (): void => {
    this.start();
  };

  private bindDomListeners(container: HTMLElement): void {
    container.addEventListener('pointerdown', this.onPointerDown);
    container.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    container.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private unbindDomListeners(): void {
    if (this.container) {
      this.container.removeEventListener('pointerdown', this.onPointerDown);
      this.container.removeEventListener('pointercancel', this.onPointerUp);
      this.container.removeEventListener('wheel', this.onWheel);
    }
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.activePointers.clear();
    this.isDragging = false;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 1) {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    } else if (this.activePointers.size === 2) {
      this.isDragging = false;
      const pts = Array.from(this.activePointers.values());
      this.initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.initialPinchRadius = this.camSpherical.radius;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.cameraMode !== 'ORBITAL') return;

    if (this.activePointers.size === 1 && this.isDragging) {
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.camSpherical.theta -= deltaX * 0.008;
      this.camSpherical.phi = Math.max(
        0.15,
        Math.min(Math.PI / 2.1, this.camSpherical.phi - deltaY * 0.008)
      );

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    } else if (this.activePointers.size === 2 && this.initialPinchDist) {
      // Gesto táctil de pellizco (Pinch-to-zoom)
      const pts = Array.from(this.activePointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (currentDist > 5) {
        const factor = this.initialPinchDist / currentDist;
        this.camSpherical.radius = Math.max(8, Math.min(50, this.initialPinchRadius * factor));
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);

    if (this.activePointers.size === 0) {
      this.isDragging = false;
      this.initialPinchDist = null;
    } else if (this.activePointers.size === 1) {
      const remaining = this.activePointers.values().next().value;
      if (remaining) {
        this.previousMousePosition = { x: remaining.x, y: remaining.y };
        this.isDragging = true;
      }
      this.initialPinchDist = null;
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.cameraMode !== 'ORBITAL') return;
    this.camSpherical.radius = Math.max(8, Math.min(50, this.camSpherical.radius + e.deltaY * 0.025));
  };

  // ── Controles de Zoom y Cámara Tácticos ──────────────────────────────────────
  public zoomIn(): void {
    if (this.cameraMode !== 'ORBITAL') return;
    this.camSpherical.radius = Math.max(8, this.camSpherical.radius - 3.5);
  }

  public zoomOut(): void {
    if (this.cameraMode !== 'ORBITAL') return;
    this.camSpherical.radius = Math.min(50, this.camSpherical.radius + 3.5);
  }

  public resetCamera(): void {
    this.camSpherical = { radius: 24, theta: Math.PI / 4, phi: Math.PI / 3 };
  }

  public handleResize(): void {
    if (!this.container || !this.renderer) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public dispose(): void {
    this.detach();
    if (this.tdmaTimer) clearInterval(this.tdmaTimer);
    if (this.loraUnsub) {
      this.loraUnsub();
      this.loraUnsub = null;
    }
    if (this.threatTimeout) {
      clearTimeout(this.threatTimeout);
      this.threatTimeout = null;
    }
    if (this.jammingTimeout) {
      clearTimeout(this.jammingTimeout);
      this.jammingTimeout = null;
    }

    this.hexapod.dispose();
    this.floor.dispose();
    this.entities.dispose();

    if (this.packetMesh) {
      this.packetMesh.geometry.dispose();
      if (Array.isArray(this.packetMesh.material)) {
        this.packetMesh.material.forEach((m) => m.dispose());
      } else {
        this.packetMesh.material.dispose();
      }
      this.packetMesh = null;
    }
  }
}
