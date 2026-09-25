/**
 * BiocyberneticHabitat3DEngine.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Motor Gráfico 3D de Alto Rendimiento para el Hábitat Digital Biocibernético.
 * Desarrollado con Three.js bajo el Estándar de Excelencia L9 (WebGL Nativo):
 * - Arena circular biofísica (R = 10m) con sustrato químico de Fick en tiempo real:
 *   * Glucosa: bioluminiscencia esmeralda viva.
 *   * Feromona de rastro: senderos estigmérgicos ámbar/dorados.
 *   * Alarma/Térmico: zonas de calor y peligro carmesí reactivas.
 * - Divergencia morfológica 3D multi-especie completa:
 *   * Drosophila: HexapodBody3D con patas 18-DOF, alas plegadas/desplegadas, ojos y antenas.
 *   * C. elegans: Cuerpo cilíndrico translúcido de 10 nodos con ondulación sinusoidal continua.
 *   * Formicidae: Hormiga 3D con mandíbulas articuladas, antenas acodadas, 6 patas y pepita de glucosa transportable.
 * - Nido táctico central 3D con cráter subterráneo y halo de feromona.
 * - Barreras acústicas holográficas verticales 3D con mallas energéticas.
 * - Efectos visuales de herramientas tácticas en 3D:
 *   * Láser optogenético ChR2 (haz volumétrico cenital de 470 nm).
 *   * Sonda Air-Puff (ondas de choque toroidales expansivas).
 *   * Pipeta de glucosa (aspersión de gotas luminosas).
 *   * Foco térmico (columna de calor convectiva).
 * - Modos de cámara cinemática 3D: Orbital Táctico, Seguimiento Tercera Persona y Cenital Dios 3D.
 * - Raycasting interactivo y controles táctiles multi-touch (rotación, arrastre y pinch-to-zoom).
 */

import * as THREE from 'three';
import {
  biocyberneticHabitat,
  HabitatOrganism,
  HabitatToolType,
  OrganismSpecies,
  OrganismMood,
  UrbanStructure,
} from './BiocyberneticHabitatEngine';
import { HexapodBody3D } from '../vivarium/HexapodBody3D';
import { centralPatternGenerator, CpgLocomotionTelemetry } from '../CentralPatternGeneratorEngine';
import { TacticalAudioEngine } from '../../audio/TacticalAudioEngine';
import { biocyberneticEdenParadise } from './BiocyberneticEdenParadiseEngine';

export type HabitatCameraMode = 'ORBITAL' | 'FOLLOW_AGENT' | 'TOP_DOWN_GOD';

// ── GPU Tier Detection ───────────────────────────────────────────────────────
/**
 * Detecta el tier de GPU del dispositivo basándose en memoria RAM del sistema,
 * núcleos de CPU y user-agent. Usado para escalar calidad de sombras y DPR.
 * - 'low'  → Moto G22 / Helio G37 / PowerVR GE8320 (≤4GB RAM, ≤4 cores mobile)
 * - 'mid'  → Gama media Android (≤6GB RAM, mobile)
 * - 'high' → Desktop / flagship móvil
 */
function detectGpuTier(): 'low' | 'mid' | 'high' {
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const memory  = nav.deviceMemory ?? 4;      // GB — sólo disponible en Chrome/Android
  const cores   = nav.hardwareConcurrency ?? 4;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  if (isMobile && (memory <= 3 || cores <= 4)) return 'low';
  if (isMobile && memory <= 6)                  return 'mid';
  return 'high';
}

// ── 1. Modelo 3D de Caenorhabditis elegans ────────────────────────────────────
class WormBody3D {
  public readonly rootGroup: THREE.Group;
  private readonly segmentMeshes: THREE.Mesh[] = [];
  private readonly cuticleMaterial: THREE.MeshStandardMaterial;
  private readonly headMaterial: THREE.MeshStandardMaterial;

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'Celegans_Root';

    this.cuticleMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x00bbf9,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
    });

    this.headMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    });

    // 10 nodos segmentarios con gradiente morfológico (cabeza redondeada, cuerpo grueso, cola afilada)
    const radii = [0.08, 0.09, 0.095, 0.09, 0.085, 0.075, 0.065, 0.05, 0.035, 0.02];
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.SphereGeometry(radii[i], 10, 10);
      const mesh = new THREE.Mesh(geo, i === 0 ? this.headMaterial : this.cuticleMaterial);
      mesh.castShadow = true;
      this.segmentMeshes.push(mesh);
      this.rootGroup.add(mesh);
    }
  }

  public update(joints: Array<{ x: number; y: number }>): void {
    if (!joints || joints.length === 0) return;
    for (let i = 0; i < this.segmentMeshes.length; i++) {
      const pt = joints[i] || joints[joints.length - 1];
      if (pt) {
        this.segmentMeshes[i].position.set(pt.x, 0.07, pt.y);
      }
    }
  }

  public dispose(): void {
    this.rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
      }
    });
    this.cuticleMaterial.dispose();
    this.headMaterial.dispose();
  }
}

// ── 2. Modelo 3D de Formicidae (Hormiga Táctica) ─────────────────────────────
class AntBody3D {
  public readonly rootGroup: THREE.Group;
  private readonly headGroup: THREE.Group;
  private readonly leftMandible: THREE.Mesh;
  private readonly rightMandible: THREE.Mesh;
  private readonly foodPellet: THREE.Mesh;
  private readonly legs: THREE.Group[] = [];
  private readonly chitinMaterial: THREE.MeshStandardMaterial;
  private readonly foodMaterial: THREE.MeshStandardMaterial;
  private walkPhase = 0;

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'Formicidae_Root';

    this.chitinMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1512,
      roughness: 0.35,
      metalness: 0.7,
    });

    this.foodMaterial = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: 0xfb8500,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.2,
    });

    const antScale = 0.55;
    this.rootGroup.scale.set(antScale, antScale, antScale);

    // Alitrunk (Tórax medio)
    const thoraxGeo = new THREE.CapsuleGeometry(0.12, 0.28, 6, 8);
    thoraxGeo.rotateX(Math.PI / 2);
    const thoraxMesh = new THREE.Mesh(thoraxGeo, this.chitinMaterial);
    thoraxMesh.position.set(0, 0.22, 0);
    thoraxMesh.castShadow = true;
    this.rootGroup.add(thoraxMesh);

    // Cabeza & Mandíbulas
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.22, 0.28);

    const headGeo = new THREE.SphereGeometry(0.13, 8, 8);
    headGeo.scale(1.1, 0.9, 1.2);
    const headMesh = new THREE.Mesh(headGeo, this.chitinMaterial);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Ojos compuestos oscuros
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.1 });
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.11, 0.04, 0.05);
    this.headGroup.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.11, 0.04, 0.05);
    this.headGroup.add(rightEye);

    // Mandíbulas articuladas que pinzan al morder
    const mandGeo = new THREE.ConeGeometry(0.035, 0.14, 4);
    mandGeo.rotateX(Math.PI / 2);
    this.leftMandible = new THREE.Mesh(mandGeo, this.chitinMaterial);
    this.leftMandible.position.set(-0.06, -0.04, 0.14);
    this.leftMandible.rotation.y = 0.35;
    this.headGroup.add(this.leftMandible);

    this.rightMandible = new THREE.Mesh(mandGeo, this.chitinMaterial);
    this.rightMandible.position.set(0.06, -0.04, 0.14);
    this.rightMandible.rotation.y = -0.35;
    this.headGroup.add(this.rightMandible);

    // Antenas acodadas
    const antMat = new THREE.MeshStandardMaterial({ color: 0x221a15, roughness: 0.5 });
    for (let side = -1; side <= 1; side += 2) {
      const antGroup = new THREE.Group();
      antGroup.position.set(side * 0.05, 0.06, 0.1);
      const scape = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), antMat);
      scape.position.set(0, 0.07, 0);
      scape.rotation.z = side * 0.4;
      antGroup.add(scape);

      const flagellum = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 4), antMat);
      flagellum.position.set(side * 0.05, 0.14, 0.08);
      flagellum.rotation.x = 0.6;
      antGroup.add(flagellum);
      this.headGroup.add(antGroup);
    }

    // Pepita de alimento transportada entre mandíbulas
    const pelletGeo = new THREE.DodecahedronGeometry(0.09, 1);
    this.foodPellet = new THREE.Mesh(pelletGeo, this.foodMaterial);
    this.foodPellet.position.set(0, -0.02, 0.22);
    this.foodPellet.visible = false;
    this.headGroup.add(this.foodPellet);

    this.rootGroup.add(this.headGroup);

    // Pecíolo (nodo de cintura)
    const petioleGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const petioleMesh = new THREE.Mesh(petioleGeo, this.chitinMaterial);
    petioleMesh.position.set(0, 0.2, -0.22);
    this.rootGroup.add(petioleMesh);

    // Gáster (Abdomen posterior)
    const gasterGeo = new THREE.SphereGeometry(0.18, 8, 8);
    gasterGeo.scale(1.0, 0.9, 1.5);
    const gasterMesh = new THREE.Mesh(gasterGeo, this.chitinMaterial);
    gasterMesh.position.set(0, 0.22, -0.48);
    gasterMesh.castShadow = true;
    this.rootGroup.add(gasterMesh);

    // 6 Patas articuladas (marcha hexápoda alternada)
    const legConfigs = [
      { x: -0.12, z: 0.1, isLeft: true },
      { x: -0.14, z: 0.0, isLeft: true },
      { x: -0.12, z: -0.1, isLeft: true },
      { x: 0.12, z: 0.1, isLeft: false },
      { x: 0.14, z: 0.0, isLeft: false },
      { x: 0.12, z: -0.1, isLeft: false },
    ];

    legConfigs.forEach((cfg, idx) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(cfg.x, 0.18, cfg.z);

      const sign = cfg.isLeft ? -1 : 1;
      const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.22, 4), this.chitinMaterial);
      femur.position.set(sign * 0.08, 0, 0);
      femur.rotation.z = (sign * Math.PI) / 3.2;
      legGroup.add(femur);

      const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.008, 0.24, 4), this.chitinMaterial);
      tibia.position.set(sign * 0.18, -0.1, 0);
      tibia.rotation.z = -(sign * Math.PI) / 4.5;
      legGroup.add(tibia);

      this.rootGroup.add(legGroup);
      this.legs.push(legGroup);
    });
  }

  public update(speedMps: number, isCarryingFood: boolean, behaviorState: string, deltaSec: number): void {
    this.foodPellet.visible = isCarryingFood;

    // Animación de mandíbulas al morder presas
    if (behaviorState === 'ANT_BITING_PREY') {
      const bitePinch = Math.sin(Date.now() * 0.035) * 0.25;
      this.leftMandible.rotation.y = 0.35 + bitePinch;
      this.rightMandible.rotation.y = -0.35 - bitePinch;
    } else {
      this.leftMandible.rotation.y = 0.35;
      this.rightMandible.rotation.y = -0.35;
    }

    // Cinemática de patas hexápodas
    if (speedMps > 0.05) {
      this.walkPhase += deltaSec * speedMps * 18.0;
      this.legs.forEach((leg, i) => {
        const phaseOffset = i % 2 === 0 ? 0 : Math.PI;
        leg.rotation.x = Math.sin(this.walkPhase + phaseOffset) * 0.35;
      });
    }
  }

  public dispose(): void {
    this.rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
      }
    });
    this.chitinMaterial.dispose();
    this.foodMaterial.dispose();
  }
}

// ── Helper de Ajuste de Línea para Canvas de Bocadillos 3D ───────────────────
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  let linesRendered = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, curY);
      line = words[n] + ' ';
      curY += lineHeight;
      linesRendered++;
      if (linesRendered >= 2) {
        ctx.fillText((line + '...').trim(), x, curY);
        return;
      }
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, curY);
}

// ── 3. Modelo 3D de Gravity AI Sentinel (Dron Soberano de Vigilancia) ─────────
class GravitySentinel3D {
  public readonly rootGroup: THREE.Group;
  private readonly bodyGroup: THREE.Group;
  private readonly thrusters: THREE.Mesh[] = [];
  private readonly eyeMesh: THREE.Mesh;
  private readonly spotLight: THREE.SpotLight;
  private readonly scanCircle: THREE.Mesh;
  private hoverPhase = 0;

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'GravitySentinel_Root';
    this.bodyGroup = new THREE.Group();
    this.rootGroup.add(this.bodyGroup);

    // Fuselaje central en aleación de titanio oscuro
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x09101f,
      metalness: 0.9,
      roughness: 0.2,
    });
    const coreGeo = new THREE.OctahedronGeometry(0.32, 2);
    coreGeo.scale(1.2, 0.65, 1.2);
    const coreMesh = new THREE.Mesh(coreGeo, hullMat);
    coreMesh.castShadow = true;
    this.bodyGroup.add(coreMesh);

    // Anillo giratorio de inducción cuántica
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.9,
      metalness: 0.5,
      roughness: 0.1,
    });
    const ringGeo = new THREE.TorusGeometry(0.42, 0.022, 8, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.bodyGroup.add(ringMesh);

    // Ojo óptico sensorial frontal (lente cuántica cian)
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.6,
      roughness: 0.1,
    });
    const eyeGeo = new THREE.SphereGeometry(0.09, 16, 16);
    this.eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeMesh.position.set(0, 0, 0.32);
    this.bodyGroup.add(this.eyeMesh);

    // 4 Góndolas de propulsión iónica (outriggers) con llamas de plasma cian
    const nacelleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const plasmaMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const angles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    angles.forEach((ang) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(Math.cos(ang) * 0.46, -0.05, Math.sin(ang) * 0.46);

      const podGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.22, 10);
      const pod = new THREE.Mesh(podGeo, nacelleMat);
      armGroup.add(pod);

      const thrusterGeo = new THREE.ConeGeometry(0.05, 0.14, 8);
      thrusterGeo.rotateX(Math.PI);
      const thruster = new THREE.Mesh(thrusterGeo, plasmaMat);
      thruster.position.y = -0.14;
      armGroup.add(thruster);
      this.thrusters.push(thruster);

      this.bodyGroup.add(armGroup);
    });

    // Foco cónico de escaneo hacia el suelo
    this.spotLight = new THREE.SpotLight(0x00f0ff, 2.8, 9.0, Math.PI / 6, 0.35, 1.2);
    this.spotLight.position.set(0, 0, 0);
    this.spotLight.target.position.set(0, -3.0, 0);
    this.rootGroup.add(this.spotLight);
    this.rootGroup.add(this.spotLight.target);

    // Retícula circular de escaneo que barre el suelo
    const scanGeo = new THREE.RingGeometry(0.35, 0.42, 24);
    scanGeo.rotateX(-Math.PI / 2);
    const scanMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    this.scanCircle = new THREE.Mesh(scanGeo, scanMat);
    this.rootGroup.add(this.scanCircle);
  }

  public update(x: number, y: number, z: number, headingRad: number, speedMps: number, deltaSec: number): void {
    this.hoverPhase += deltaSec * 3.2;
    const hoverOffset = Math.sin(this.hoverPhase) * 0.08;
    this.rootGroup.position.set(x, Math.max(0.6, z + hoverOffset), y);
    this.rootGroup.rotation.y = headingRad;

    // Cabeceo dinámico al acelerar
    const tiltPitch = Math.min(0.25, speedMps * 0.12);
    this.bodyGroup.rotation.x = tiltPitch;
    this.bodyGroup.rotation.z = Math.sin(this.hoverPhase * 0.5) * 0.05;

    // Pulso iónico en los propulsores
    const pulse = 0.8 + 0.4 * Math.sin(this.hoverPhase * 6.0);
    this.thrusters.forEach((t) => {
      t.scale.set(1.0, pulse, 1.0);
    });

    // Ubicar retícula en el suelo
    this.scanCircle.position.set(0, -this.rootGroup.position.y + 0.03, 0);
    this.scanCircle.rotation.z += deltaSec * 2.5;
  }

  public dispose(): void {
    this.rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
      }
    });
    this.spotLight.dispose();
  }
}

// ── 4. Modelo 3D de Neocorteza Humana (Avatar Cognitivo Epistémico) ────────────
class HumanNeocortexAvatar3D {
  public readonly rootGroup: THREE.Group;
  private readonly headGroup: THREE.Group;
  private readonly brainMesh: THREE.Mesh;
  private readonly entorhinalRing: THREE.Mesh;
  private readonly auraLight: THREE.PointLight;
  private walkPhase = 0;

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'HumanNeocortex_Root';

    // Armadura biomecánica cibernética esmeralda
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x072714,
      emissive: 0x10b981,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.7,
      transparent: true,
      opacity: 0.9,
    });

    // Torso estilizado
    const torsoGeo = new THREE.CapsuleGeometry(0.18, 0.45, 6, 8);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.y = 0.65;
    torso.castShadow = true;
    this.rootGroup.add(torso);

    // Cabeza y Casco Holográfico
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 1.05;

    // Visor translúcido
    const visorGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x052e16,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.1,
    });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    this.headGroup.add(visorMesh);

    // Cerebro 3D pulsante visible en el interior (7 núcleos neocorticales)
    const brainMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x34d399,
      emissiveIntensity: 1.3,
      roughness: 0.2,
      wireframe: true,
    });
    const brainGeo = new THREE.SphereGeometry(0.13, 10, 10);
    brainGeo.scale(1.2, 0.9, 1.3);
    this.brainMesh = new THREE.Mesh(brainGeo, brainMat);
    this.headGroup.add(this.brainMesh);

    this.rootGroup.add(this.headGroup);

    // Anillo hexagonal de celdas entorrinales en la base
    const ringGeo = new THREE.RingGeometry(0.45, 0.52, 6);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    this.entorhinalRing = new THREE.Mesh(ringGeo, ringMat);
    this.entorhinalRing.position.y = 0.03;
    this.rootGroup.add(this.entorhinalRing);

    // Aura cognitiva esmeralda
    this.auraLight = new THREE.PointLight(0x10b981, 1.2, 3.5);
    this.auraLight.position.y = 1.05;
    this.rootGroup.add(this.auraLight);
  }

  public update(x: number, y: number, headingRad: number, speedMps: number, deltaSec: number): void {
    this.walkPhase += deltaSec * (speedMps > 0.1 ? 4.5 : 1.5);
    const bob = Math.sin(this.walkPhase) * 0.04;
    this.rootGroup.position.set(x, bob, y);
    this.rootGroup.rotation.y = headingRad;

    // Pulsación del cerebro neocortical según actividad de inferencia activa
    const brainPulse = 1.0 + Math.sin(this.walkPhase * 2.0) * 0.08;
    this.brainMesh.scale.set(brainPulse, brainPulse, brainPulse);

    // Rotación del anillo entorrinal hexagonal
    this.entorhinalRing.rotation.z += deltaSec * 1.2;
  }

  public dispose(): void {
    this.rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
      }
    });
    this.auraLight.dispose();
  }
}

// ── 5. Bocadillo de Pensamiento Holográfico 3D (Billboard Sprite) ─────────────
class ThoughtBubbleSprite3D {
  public readonly sprite: THREE.Sprite;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private lastRenderedKey = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 384;
    this.canvas.height = 128;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(spriteMat);
    this.sprite.scale.set(2.4, 0.8, 1.0);
  }

  public update(
    x: number,
    y: number,
    z: number,
    species: OrganismSpecies,
    name: string,
    thought: string,
    mood: OrganismMood,
    themeColor: string
  ): void {
    this.sprite.position.set(x, y + 0.85, z);

    const key = `${species}-${name}-${thought}-${mood}`;
    if (key === this.lastRenderedKey) return;
    this.lastRenderedKey = key;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Fondo bocadillo redondeado táctico con glassmorphism
    ctx.fillStyle = 'rgba(6, 14, 28, 0.88)';
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 3;

    const r = 16;
    const bw = w - 12;
    const bh = h - 28;
    const bx = 6;
    const by = 6;

    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    // Puntero triangular hacia el organismo abajo
    ctx.lineTo(bx + bw / 2 + 10, by + bh);
    ctx.lineTo(bx + bw / 2, by + bh + 16);
    ctx.lineTo(bx + bw / 2 - 10, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Encabezado con Icono, Nombre y Mood
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillStyle = themeColor;
    ctx.fillText(`${name}`, 18, 28);

    // Mood badge emoji
    const moodEmoji =
      mood === 'COMPETITIVE'
        ? '🏆'
        : mood === 'PLAYFUL'
        ? '⚡'
        : mood === 'HUNGRY'
        ? '🍓'
        : mood === 'ZEN'
        ? '🧘'
        : '🔍';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${moodEmoji} ${mood}`, bw - 90, 28);

    // Línea divisoria fina
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, 36);
    ctx.lineTo(bw - 10, 36);
    ctx.stroke();

    // Texto del pensamiento con ajuste de línea
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f1f5f9';
    wrapText(ctx, thought, 18, 56, bw - 28, 18);

    this.texture.needsUpdate = true;
  }

  public dispose(): void {
    this.texture.dispose();
    (this.sprite.material as THREE.Material).dispose();
  }
}

// ── 6. Mega-Cristal de Glucosa Dorada para el Gran Torneo ─────────────────────
class SugarMegaCrystal3D {
  public readonly rootGroup: THREE.Group;
  private readonly crystalMesh: THREE.Mesh;
  private readonly ringMesh: THREE.Mesh;
  private readonly beaconLight: THREE.PointLight;

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'SugarMegaCrystal_Root';
    this.rootGroup.visible = false;

    // Cristal de glucosa facetado dorado brillante
    const crystalGeo = new THREE.OctahedronGeometry(0.55, 1);
    crystalGeo.scale(1.0, 1.6, 1.0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 1.5,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.92,
    });
    this.crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    this.crystalMesh.position.y = 0.9;
    this.crystalMesh.castShadow = true;
    this.rootGroup.add(this.crystalMesh);

    // Anillo orbital giratorio
    const ringGeo = new THREE.TorusGeometry(0.85, 0.03, 8, 32);
    ringGeo.rotateX(Math.PI / 3);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.position.y = 0.9;
    this.rootGroup.add(this.ringMesh);

    // Luz dorada brillante
    this.beaconLight = new THREE.PointLight(0xffd700, 2.5, 8.0);
    this.beaconLight.position.y = 1.0;
    this.rootGroup.add(this.beaconLight);
  }

  public update(deltaSec: number, x: number, z: number, visible: boolean): void {
    this.rootGroup.visible = visible;
    if (!visible) return;
    this.rootGroup.position.set(x, 0, z);
    this.crystalMesh.rotation.y += deltaSec * 1.5;
    this.ringMesh.rotation.z += deltaSec * 2.0;
    this.ringMesh.rotation.x += deltaSec * 0.8;
  }

  public dispose(): void {
    this.rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
      }
    });
    this.beaconLight.dispose();
  }
}

// ── 7. Puntero Láser Juguetón 3D ──────────────────────────────────────────────
class PlayfulLaserMesh3D {
  public readonly rootGroup: THREE.Group;
  private readonly laserDot: THREE.Mesh;
  private readonly laserBeam: THREE.Mesh;

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.visible = false;

    // Punto brillante en el suelo
    const dotGeo = new THREE.CircleGeometry(0.25, 16);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      side: THREE.DoubleSide,
    });
    this.laserDot = new THREE.Mesh(dotGeo, dotMat);
    this.laserDot.position.y = 0.025;
    this.rootGroup.add(this.laserDot);

    // Haz cilíndrico desde el techo
    const beamGeo = new THREE.CylinderGeometry(0.02, 0.08, 12, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.35,
    });
    this.laserBeam = new THREE.Mesh(beamGeo, beamMat);
    this.laserBeam.position.y = 6.0;
    this.rootGroup.add(this.laserBeam);
  }

  public setPosition(x: number, z: number, visible: boolean): void {
    this.rootGroup.visible = visible;
    if (visible) {
      this.rootGroup.position.set(x, 0, z);
    }
  }

  public dispose(): void {
    this.laserDot.geometry.dispose();
    this.laserBeam.geometry.dispose();
  }
}

// ── 8. Motor Principal 3D del Hábitat Biocibernético ──────────────────────────
export class BiocyberneticHabitat3DEngine {
  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private animFrameId: number | null = null;
  private isRunning = false;
  private lastTimeMs = 0;
  private simTimeSec = 0;

  // Modos de Cámara y Navegación
  public cameraMode: HabitatCameraMode = 'ORBITAL';
  private selectedOrgId: string | null = null;
  private camSpherical = { radius: 18.0, theta: 0.0, phi: Math.PI / 3.4 };

  // Control táctil / ratón (Arrastre y Zoom)
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private activePointers: Map<number, { x: number; y: number }> = new Map();
  private initialPinchDist = 0;
  private initialPinchRadius = 18.0;

  // Entorno 3D de la Arena
  private readonly arenaRadius = 10.0;
  private readonly chemicalTexture: THREE.DataTexture;
  private readonly chemicalData: Uint8Array;
  private readonly groundMesh: THREE.Mesh;
  private readonly perimeterWall: THREE.Mesh;
  private readonly nestMound: THREE.Group;
  private readonly toolVfxGroup: THREE.Group;
  private readonly selectionReticle: THREE.Group;

  // Interacción Táctica vs Órbita de Cámara 3D
  private isInteractingWithTool = false;
  private barrierStartPoint: THREE.Vector2 | null = null;
  private barrierPreviewMesh: THREE.Mesh | null = null;
  private lastPaintedToolPos: { x: number; z: number } | null = null;

  // Pools de Organismos Vivos 3D
  private flies3D: Map<string, HexapodBody3D> = new Map();
  private worms3D: Map<string, WormBody3D> = new Map();
  private ants3D: Map<string, AntBody3D> = new Map();
  private sentinels3D: Map<string, GravitySentinel3D> = new Map();
  private humans3D: Map<string, HumanNeocortexAvatar3D> = new Map();
  private thoughtBubbles3D: Map<string, ThoughtBubbleSprite3D> = new Map();
  private barrierMeshes: Map<string, THREE.Mesh> = new Map();

  // Registros de IDs de animaciones VFX transitorias (para cancelación en dispose/detach)
  private readonly activeVfxRafIds = new Set<number>();
  private readonly activeVfxTimeoutIds = new Set<ReturnType<typeof setTimeout>>();

  // Entidades Lúdicas y Mini-Juegos 3D
  private sugarMegaCrystal: SugarMegaCrystal3D;
  private playfulLaserMesh: PlayfulLaserMesh3D;
  private ambientSpores: THREE.Points;
  private tacticalChessTable!: THREE.Group;

  // Entidades del Paraíso Biocibernético 3D
  private treeOfLifeGroup!: THREE.Group;
  private nectarSpringsGroup!: THREE.Group;
  private myceliumNetworkGroup!: THREE.Group;
  private celestialDome!: THREE.Group;
  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;
  private gpuTier: 'low' | 'mid' | 'high' = 'high'; // sobreescrito en constructor
  private auroraMesh: THREE.Mesh | null = null;

  // Entidades de la Metrópolis Biocibernética 3D
  private metropolisGroup!: THREE.Group;
  private structureMeshes: Map<string, THREE.Group> = new Map();
  private highwayLines: THREE.LineSegments | null = null;
  private lastHighwayCount = -1;

  // Raycasting para interacción táctil sobre el suelo 3D
  private readonly raycaster: THREE.Raycaster;
  private readonly groundPlane: THREE.Plane;

  // Callbacks a UI React
  private onSelectOrganismCallback?: (id: string) => void;
  private onAlertCallback?: (msg: string) => void;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    // ── Detección de tier de GPU antes de cualquier inicialización ──────────
    this.gpuTier = detectGpuTier();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020813);
    this.scene.fog = new THREE.FogExp2(0x020813, 0.022);

    this.camera = new THREE.PerspectiveCamera(52, 1.0, 0.1, 150);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // ── Iluminación Táctica y Cyberpunk Circadiana (tier-aware) ────────────
    this.ambientLight = new THREE.AmbientLight(0x18263a, 1.4);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
    this.dirLight.position.set(8, 16, 8);

    if (this.gpuTier !== 'low') {
      // Solo tier mid/high activa sombras dinámicas.
      // Low (Moto G22 / PowerVR GE8320): sombras desactivadas por completo.
      this.dirLight.castShadow = true;
      const shadowRes = this.gpuTier === 'high' ? 1024 : 512;
      this.dirLight.shadow.mapSize.width  = shadowRes;
      this.dirLight.shadow.mapSize.height = shadowRes;
      this.dirLight.shadow.camera.near   = 1;
      this.dirLight.shadow.camera.far    = 40;
      this.dirLight.shadow.camera.left   = -12;
      this.dirLight.shadow.camera.right  = 12;
      this.dirLight.shadow.camera.top    = 12;
      this.dirLight.shadow.camera.bottom = -12;
    }

    this.scene.add(this.dirLight);

    const fillLight = new THREE.DirectionalLight(0xff9f43, 0.6);
    fillLight.position.set(-8, 10, -8);
    this.scene.add(fillLight);

    // ── Suelo Táctico y Textura Química Fick en Vivo (64x64 RGBA) ───────────
    const texRes = 64;
    this.chemicalData = new Uint8Array(texRes * texRes * 4);
    this.chemicalTexture = new THREE.DataTexture(
      this.chemicalData,
      texRes,
      texRes,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    this.chemicalTexture.minFilter = THREE.LinearFilter;
    this.chemicalTexture.magFilter = THREE.LinearFilter;
    this.chemicalTexture.needsUpdate = true;

    const groundGeo = new THREE.CircleGeometry(this.arenaRadius, 64);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x050c18,
      roughness: 0.65,
      metalness: 0.35,
      map: this.chemicalTexture,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Anillos Concéntricos Tácticos de Alcance
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.25,
    });
    for (let r = 2; r <= 10; r += 2) {
      const ringPts: THREE.Vector3[] = [];
      for (let a = 0; a <= 64; a++) {
        const th = (a / 64) * Math.PI * 2;
        ringPts.push(new THREE.Vector3(Math.cos(th) * r, 0.015, Math.sin(th) * r));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      this.scene.add(new THREE.Line(ringGeo, ringMat));
    }

    // Muro Perimétrico de Energía Luminoso (R = 10m)
    const wallGeo = new THREE.CylinderGeometry(this.arenaRadius, this.arenaRadius, 0.45, 64, 1, true);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.perimeterWall = new THREE.Mesh(wallGeo, wallMat);
    this.perimeterWall.position.y = 0.225;
    this.scene.add(this.perimeterWall);

    // Nido Central de Hormigas 3D (Montículo táctico con cráter central)
    this.nestMound = this.createNestMound();
    this.scene.add(this.nestMound);

    // Grupo de Efectos Visuales Tácticos (Láser, Air-Puff, Pipeta)
    this.toolVfxGroup = new THREE.Group();
    this.scene.add(this.toolVfxGroup);

    // Retícula Táctica de Selección Holográfica 3D (para Bio-Scanner)
    this.selectionReticle = this.createSelectionReticle();
    this.scene.add(this.selectionReticle);

    // Mega-Cristal de Glucosa Dorada para el Gran Torneo
    this.sugarMegaCrystal = new SugarMegaCrystal3D();
    this.scene.add(this.sugarMegaCrystal.rootGroup);

    // Puntero Láser Juguetón 3D
    this.playfulLaserMesh = new PlayfulLaserMesh3D();
    this.scene.add(this.playfulLaserMesh.rootGroup);

    // Mesa de Ajedrez Táctico In-Silico 3D
    this.tacticalChessTable = this.createTacticalChessTable3D();
    this.scene.add(this.tacticalChessTable);

    // Entidades del Paraíso Biocibernético 3D
    this.treeOfLifeGroup = this.createTreeOfLife3D();
    this.scene.add(this.treeOfLifeGroup);

    this.nectarSpringsGroup = this.createNectarSprings3D();
    this.scene.add(this.nectarSpringsGroup);

    this.myceliumNetworkGroup = this.createMyceliumNetwork3D();
    this.scene.add(this.myceliumNetworkGroup);

    this.celestialDome = this.createCelestialDome3D();
    this.scene.add(this.celestialDome);

    // Esporas bioluminiscentes atmosféricas
    const sporeCount = 160;
    const sporeGeo = new THREE.BufferGeometry();
    const sporePositions = new Float32Array(sporeCount * 3);
    for (let i = 0; i < sporeCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * 9.5;
      sporePositions[i * 3] = Math.cos(ang) * dist;
      sporePositions[i * 3 + 1] = 0.4 + Math.random() * 4.2;
      sporePositions[i * 3 + 2] = Math.sin(ang) * dist;
    }
    sporeGeo.setAttribute('position', new THREE.BufferAttribute(sporePositions, 3));
    const sporeMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.12,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    this.ambientSpores = new THREE.Points(sporeGeo, sporeMat);
    this.scene.add(this.ambientSpores);

    // Metrópolis Biocibernética 3D (Silos, Torres, Composteros, Balizas, Carreteras)
    this.metropolisGroup = new THREE.Group();
    this.metropolisGroup.name = 'MetropolisGroup_3D';
    this.scene.add(this.metropolisGroup);
  }

  private createSelectionReticle(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'BioScanner_SelectionReticle_3D';
    group.visible = false;

    // Anillo giratorio exterior
    const ringGeo = new THREE.RingGeometry(0.75, 0.85, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    // 4 Brackets esquineros tácticos
    const bracketMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const bracketGeo = new THREE.BoxGeometry(0.18, 0.02, 0.04);
      const bMesh = new THREE.Mesh(bracketGeo, bracketMat);
      bMesh.position.set(Math.cos(angle) * 0.95, 0.02, Math.sin(angle) * 0.95);
      bMesh.rotation.y = -angle;
      group.add(bMesh);
    }

    return group;
  }

  private updateBarrierPreview(x1: number, z1: number, x2: number, z2: number): void {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const angle = Math.atan2(z2 - z1, x2 - x1);
    const midX = (x1 + x2) * 0.5;
    const midZ = (z1 + z2) * 0.5;

    if (!this.barrierPreviewMesh) {
      const geo = new THREE.PlaneGeometry(1, 1.2);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        wireframe: true,
      });
      this.barrierPreviewMesh = new THREE.Mesh(geo, mat);
      this.scene.add(this.barrierPreviewMesh);
    }

    this.barrierPreviewMesh.scale.set(Math.max(0.01, len), 1, 1);
    this.barrierPreviewMesh.position.set(midX, 0.6, midZ);
    this.barrierPreviewMesh.rotation.y = -angle;
    this.barrierPreviewMesh.visible = true;
  }

  private removeBarrierPreview(): void {
    if (this.barrierPreviewMesh) {
      this.scene.remove(this.barrierPreviewMesh);
      this.barrierPreviewMesh.geometry.dispose();
      (this.barrierPreviewMesh.material as THREE.Material).dispose();
      this.barrierPreviewMesh = null;
    }
  }

  private createNestMound(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'AntNest_Mound_3D';

    // Montículo terroso truncado
    const moundGeo = new THREE.CylinderGeometry(0.45, 1.25, 0.25, 16);
    const moundMat = new THREE.MeshStandardMaterial({
      color: 0x241812,
      roughness: 0.85,
      metalness: 0.15,
    });
    const moundMesh = new THREE.Mesh(moundGeo, moundMat);
    moundMesh.position.y = 0.125;
    moundMesh.receiveShadow = true;
    moundMesh.castShadow = true;
    group.add(moundMesh);

    // Cráter/túnel subterráneo oscuro
    const tunnelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16);
    const tunnelMat = new THREE.MeshBasicMaterial({ color: 0x020408 });
    const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
    tunnelMesh.position.y = 0.255;
    group.add(tunnelMesh);

    // Halo luminoso de feromona en la entrada
    const haloGeo = new THREE.RingGeometry(0.3, 0.65, 24);
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xff9f43,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.y = 0.26;
    group.add(haloMesh);

    return group;
  }

  /**
   * Crea la Mesa de Ajedrez Táctico Central 3D con pedestal y tablero cuadriculado
   */
  private createTacticalChessTable3D(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(0, 0, 1.2);

    // 1. Pedestal Cilíndrico Táctico
    const pedGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.18, 24);
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x0a1424,
      roughness: 0.35,
      metalness: 0.85,
    });
    const pedMesh = new THREE.Mesh(pedGeo, pedMat);
    pedMesh.position.y = 0.09;
    pedMesh.receiveShadow = true;
    group.add(pedMesh);

    // 2. Anillo de Luz Cian / Neón en la Base
    const ringGeo = new THREE.RingGeometry(0.56, 0.68, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.185;
    group.add(ringMesh);

    // 3. Tablero 8x8 Cuadriculado
    const boardSize = 0.8;
    const cellSize = boardSize / 8;
    const boardGroup = new THREE.Group();
    boardGroup.position.y = 0.19;

    const cellGeo = new THREE.PlaneGeometry(cellSize * 0.95, cellSize * 0.95);
    cellGeo.rotateX(-Math.PI / 2);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.3, emissive: 0x003366, emissiveIntensity: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x07111e, roughness: 0.5 });

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const cellMesh = new THREE.Mesh(cellGeo, isLight ? lightMat : darkMat);
        cellMesh.position.set((c - 3.5) * cellSize, 0, (r - 3.5) * cellSize);
        boardGroup.add(cellMesh);
      }
    }
    group.add(boardGroup);

    // 4. Prisma Holográfico Flotante de Ajedrez
    const crownGeo = new THREE.OctahedronGeometry(0.12, 0);
    const crownMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const crownMesh = new THREE.Mesh(crownGeo, crownMat);
    crownMesh.position.y = 0.55;
    group.add(crownMesh);

    return group;
  }

  /**
   * Crea el Árbol de la Vida Cuántico 3D (Santuario Central de Regeneración y Paz)
   */
  private createTreeOfLife3D(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    // 1. Tronco Cibernético Espiralado
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.65, 3.2, 16);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x031826,
      roughness: 0.25,
      metalness: 0.8,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.15,
    });
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
    trunkMesh.position.y = 1.6;
    trunkMesh.castShadow = true;
    group.add(trunkMesh);

    // 2. Raíces Bioluminiscentes Radiales
    const rootMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.5,
    });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const rootGeo = new THREE.CylinderGeometry(0.08, 0.02, 1.8, 8);
      rootGeo.rotateZ(Math.PI / 3);
      rootGeo.rotateY(angle);
      const rootMesh = new THREE.Mesh(rootGeo, rootMat);
      rootMesh.position.set(Math.cos(angle) * 0.9, 0.1, Math.sin(angle) * 0.9);
      group.add(rootMesh);
    }

    // 3. Dosel de Partículas Cuánticas Bioluminiscentes (Hojas de Luz)
    const particleCount = 360;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.2 + Math.random() * 1.4;

      const px = r * Math.sin(phi) * Math.cos(theta);
      const py = 3.2 + (r * 0.6) * Math.cos(phi);
      const pz = r * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;

      // Gradiente Esmeralda - Turquesa - Violeta
      colors[i * 3] = 0.05 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.85 + Math.random() * 0.15;
      colors[i * 3 + 2] = 0.75 + Math.random() * 0.25;
    }

    const canopyGeo = new THREE.BufferGeometry();
    canopyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    canopyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const canopyMat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const canopyPoints = new THREE.Points(canopyGeo, canopyMat);
    group.add(canopyPoints);

    // 4. Faro / Prisma Central de Meditación
    const coreGeo = new THREE.OctahedronGeometry(0.35, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 3.2;
    group.add(coreMesh);

    return group;
  }

  /**
   * Crea los 3 Manantiales de Néctar Cristalino y Balnearios de Serenidad
   */
  private createNectarSprings3D(): THREE.Group {
    const group = new THREE.Group();

    const springs = [
      { x: 0.0, z: 6.2, r: 1.8, color: 0x00f0ff },
      { x: -5.4, z: -4.2, r: 1.6, color: 0xa855f7 },
      { x: 5.4, z: -4.2, r: 1.6, color: 0x22c55e },
    ];

    for (const sp of springs) {
      const springGroup = new THREE.Group();
      springGroup.position.set(sp.x, 0, sp.z);

      // Estanque circular en el suelo
      const poolGeo = new THREE.CircleGeometry(sp.r, 32);
      poolGeo.rotateX(-Math.PI / 2);
      const poolMat = new THREE.MeshBasicMaterial({
        color: sp.color,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const poolMesh = new THREE.Mesh(poolGeo, poolMat);
      poolMesh.position.y = 0.02;
      springGroup.add(poolMesh);

      // Anillo perimétrico cristalino
      const rimGeo = new THREE.RingGeometry(sp.r * 0.95, sp.r * 1.08, 32);
      rimGeo.rotateX(-Math.PI / 2);
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x071b2d,
        emissive: sp.color,
        emissiveIntensity: 0.6,
        roughness: 0.3,
        metalness: 0.7,
        side: THREE.DoubleSide,
      });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.position.y = 0.035;
      springGroup.add(rimMesh);

      group.add(springGroup);
    }

    return group;
  }

  /**
   * Crea las líneas luminiscentes de la Red Micelial Fúngica Subterránea
   */
  private createMyceliumNetwork3D(): THREE.Group {
    const group = new THREE.Group();
    const connections: Array<[[number, number], [number, number]]> = [
      [[0, 0], [0, 1.2]],
      [[0, 1.2], [0, 6.2]],
      [[0, 0], [-5.4, -4.2]],
      [[0, 0], [5.4, -4.2]],
      [[-5.4, -4.2], [5.4, -4.2]],
    ];

    const hyphaMat = new THREE.LineBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.4,
    });

    for (const [from, to] of connections) {
      const points: THREE.Vector3[] = [];
      const steps = 12;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = from[0] + (to[0] - from[0]) * t;
        const z = from[1] + (to[1] - from[1]) * t;
        // Leve curvatura ondulante
        const arcY = Math.sin(t * Math.PI) * 0.12;
        points.push(new THREE.Vector3(x, 0.02 + arcY, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      group.add(new THREE.Line(geo, hyphaMat));
    }

    return group;
  }

  /**
   * Crea la Cúpula Celeste con Estrellas y Cortinas de Aurora Boreal
   */
  private createCelestialDome3D(): THREE.Group {
    const group = new THREE.Group();

    // 1. Estrellas Volumétricas
    const starCount = 500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * (Math.PI / 2.2); // Hemisferio superior
      const r = 42.0 + Math.random() * 4.0;

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.35,
      transparent: true,
      opacity: 0.85,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    group.add(starPoints);

    // 2. Arco Ondulante de Aurora Boreal
    const auroraGeo = new THREE.CylinderGeometry(38, 38, 14, 48, 1, true);
    const auroraMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.0,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    this.auroraMesh = new THREE.Mesh(auroraGeo, auroraMat);
    this.auroraMesh.position.y = 12.0;
    group.add(this.auroraMesh);

    return group;
  }

  public setOnSelectOrganism(cb: (id: string) => void): void {
    this.onSelectOrganismCallback = cb;
  }

  public setOnAlert(cb: (msg: string) => void): void {
    this.onAlertCallback = cb;
  }

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
    // DPR tier-aware: PowerVR GE8320 (low) → 1.0, mid → 1.25, high → 1.75.
    // Nunca clampear a 2.0: a 1600×1800 el fill-rate del GPU low-end se satura.
    const maxDpr = this.gpuTier === 'low' ? 1.0
                 : this.gpuTier === 'mid' ? 1.25
                 : 1.75;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    // Sombras tier-aware: low → desactivadas, mid → BasicShadowMap (1 sample),
    // high → PCFSoftShadowMap (9 samples, sólo en GPU capaz).
    this.renderer.shadowMap.enabled = this.gpuTier !== 'low';
    this.renderer.shadowMap.type = this.gpuTier === 'high'
      ? THREE.PCFSoftShadowMap
      : THREE.BasicShadowMap;

    container.appendChild(this.renderer.domElement);

    // Resiliencia WebGL ante cambio de contexto en SO / app
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored, false);

    // Observador de Redimensionamiento Dinámico para pantallas móviles y cambio de orientación
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0 && this.renderer) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
            // Re-clampear DPR tras rotación de pantalla para evitar framebuffer
            // oversized al pasar de portrait a landscape en móviles.
            const maxDprResize = this.gpuTier === 'low' ? 1.0
                               : this.gpuTier === 'mid' ? 1.25
                               : 1.75;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDprResize));
          }
        }
      });
      this.resizeObserver.observe(container);
    }

    this.bindDomListeners(container);
    this.start();
  }

  public detach(): void {
    this.pause();
    this.unbindDomListeners();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

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
    this.lastTimeMs = performance.now();

    const loop = (now: number) => {
      if (!this.isRunning) return;
      const deltaSec = Math.min(0.1, (now - this.lastTimeMs) * 0.001);
      this.lastTimeMs = now;

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

  public setSelectedOrganism(id: string | null): void {
    this.selectedOrgId = id;
  }

  public setCameraMode(mode: HabitatCameraMode): void {
    this.cameraMode = mode;
    TacticalAudioEngine.playTap();
  }

  // ── Bucle de Simulación y Sincronización Gráfica 3D ──────────────────────────
  private tick(deltaSec: number): void {
    this.simTimeSec += deltaSec;
    // 1. Actualizar Textura Química de Fick (Glucosa, Rastro de Hormigas, Alarma)
    this.updateChemicalTexture();

    // 2. Sincronizar y Renderizar Organismos Vivos 3D (con bocadillos de pensamiento)
    this.updateOrganisms3D(deltaSec);

    // 3. Sincronizar Barreras Acústicas 3D
    this.updateBarriers3D();

    // 4. Actualizar Mega-Cristal del Gran Torneo de Glucosa
    const sugarRace = biocyberneticHabitat.getSugarRaceState();
    this.sugarMegaCrystal.update(deltaSec, sugarRace.targetX, sugarRace.targetY, sugarRace.isActive);

    // 5. Actualizar Puntero Láser Juguetón si está activo
    const globalLaser = biocyberneticHabitat.getLaserChaseTarget();
    const curTool = biocyberneticHabitat.getActiveTool();
    const isLaserTool = curTool === 'OPTOGENETIC_LASER' || curTool === 'OPTOGENETIC_CHR2';
    if (globalLaser) {
      this.playfulLaserMesh.setPosition(globalLaser.x, globalLaser.y, true);
    } else if (this.lastPaintedToolPos && isLaserTool) {
      this.playfulLaserMesh.setPosition(this.lastPaintedToolPos.x, this.lastPaintedToolPos.z, true);
    } else {
      this.playfulLaserMesh.setPosition(0, 0, false);
    }

    // 6. Ondulación de esporas atmosféricas bioluminiscentes
    if (this.ambientSpores) {
      this.ambientSpores.rotation.y += deltaSec * 0.04;
    }

    // 6.1 Animación de la Mesa de Ajedrez Táctico 3D
    if (this.tacticalChessTable) {
      const crown = this.tacticalChessTable.children[this.tacticalChessTable.children.length - 1];
      if (crown) {
        crown.rotation.y += deltaSec * 0.8;
        crown.position.y = 0.55 + Math.sin(this.simTimeSec * 3.0) * 0.04;
      }
    }

    // 6.2 Animación del Paraíso Biocibernético (Árbol de la Vida, Manantiales & Ciclo Circadiano)
    const circadian = biocyberneticEdenParadise.getCircadianState();
    if (this.ambientLight) {
      this.ambientLight.color.setHex(circadian.ambientLightHex);
      this.ambientLight.intensity = circadian.isDaytime ? 1.4 : 0.8;
    }
    if (this.dirLight) {
      this.dirLight.position.set(circadian.sunPosition.x, circadian.sunPosition.y, circadian.sunPosition.z);
      this.dirLight.intensity = circadian.isDaytime ? 1.2 : 0.3;
    }
    if (this.auroraMesh) {
      const auroraMat = this.auroraMesh.material as THREE.MeshBasicMaterial;
      if (auroraMat) {
        auroraMat.opacity = circadian.auroraIntensity * 0.35;
      }
      this.auroraMesh.rotation.y += deltaSec * 0.05;
    }
    if (this.treeOfLifeGroup) {
      const canopy = this.treeOfLifeGroup.children[2];
      if (canopy) {
        canopy.rotation.y += deltaSec * 0.15;
      }
      const core = this.treeOfLifeGroup.children[3];
      if (core) {
        core.rotation.y += deltaSec * 0.6;
        core.position.y = 3.2 + Math.sin(this.simTimeSec * 2.0) * 0.05;
      }
    }

    // 6.3 Sincronización de la Metrópolis Biocibernética 3D (Silos, Torres, Composteros, Balizas, Carreteras)
    this.updateMetropolis3D(deltaSec);

    // 7. Actualizar Posición Cinemática de la Cámara
    this.updateCameraPosition();
  }

  private updateChemicalTexture(): void {
    const grid = biocyberneticHabitat.diffusionGrid;
    const gBuf = grid.getBuffer('GLUCOSE');
    const pBuf = grid.getBuffer('PHEROMONE_TRAIL');
    const aBuf = grid.getBuffer('ALARM_PHEROMONE');
    const sBuf = grid.getBuffer('SEROTONIN');

    const totalCells = 64 * 64;
    for (let i = 0; i < totalCells; i++) {
      const g = gBuf[i] || 0;
      const p = pBuf[i] || 0;
      const a = aBuf[i] || 0;
      const s = sBuf ? sBuf[i] || 0 : 0;

      // Color coding táctico edénico:
      // Glucosa: Esmeralda brillante (G: alto)
      // Rastro Pheromone: Ámbar/Dorado (R: 255, G: 160)
      // Alarma: Carmesí neón (R: 255, B: 60)
      // Serotonina: Violeta/Cian celestial relajante
      const rVal = Math.min(255, Math.floor(a * 500 + p * 240 + s * 140));
      const gVal = Math.min(255, Math.floor(g * 400 + p * 150 + s * 80));
      const bVal = Math.min(255, Math.floor(g * 180 + a * 30 + s * 450 + 15));
      const alphaVal = Math.min(255, Math.floor(Math.max(g * 350, p * 300, a * 450, s * 380) + 18));

      const idx4 = i * 4;
      this.chemicalData[idx4] = rVal;
      this.chemicalData[idx4 + 1] = gVal;
      this.chemicalData[idx4 + 2] = bVal;
      this.chemicalData[idx4 + 3] = alphaVal;
    }
    this.chemicalTexture.needsUpdate = true;
  }

  private updateOrganisms3D(deltaSec: number): void {
    const organisms = biocyberneticHabitat.getAllOrganisms();
    const activeIds = new Set<string>();

    const cpgTelem = centralPatternGenerator.getTelemetry();

    for (const org of organisms) {
      activeIds.add(org.id);

      const pScale = org.genome?.phenotypeScale || 1.0;

      if (org.species === 'DROSOPHILA') {
        let fly = this.flies3D.get(org.id);
        if (!fly) {
          fly = new HexapodBody3D();
          this.scene.add(fly.rootGroup);
          this.flies3D.set(org.id, fly);
        }

        const flyScale = 0.68 * pScale;
        fly.rootGroup.scale.set(flyScale, flyScale, flyScale);
        fly.rootGroup.position.set(org.x, 0, org.y);

        // Orientación: Drosophila 3D tiene cabeza en +Z, así que rotamos hacia headingRad
        const headingDeg = (org.headingRad * 180) / Math.PI;
        const isThreat = org.behaviorState.includes('EVADING') || org.behaviorState.includes('ESCAPE');
        const isJumping = org.behaviorState === 'ESCAPE_REFLEX' || org.speedMps > 3.0;

        fly.update(deltaSec, cpgTelem, -headingDeg, isThreat, isJumping, 0.5);

      } else if (org.species === 'C_ELEGANS') {
        let worm = this.worms3D.get(org.id);
        if (!worm) {
          worm = new WormBody3D();
          this.scene.add(worm.rootGroup);
          this.worms3D.set(org.id, worm);
        }
        const wormScale = 1.0 * pScale;
        worm.rootGroup.scale.set(wormScale, wormScale, wormScale);
        worm.update(org.wormJoints);

      } else if (org.species === 'ANT') {
        let ant = this.ants3D.get(org.id);
        if (!ant) {
          ant = new AntBody3D();
          this.scene.add(ant.rootGroup);
          this.ants3D.set(org.id, ant);
        }

        const antScale = 0.55 * pScale;
        ant.rootGroup.scale.set(antScale, antScale, antScale);
        ant.rootGroup.position.set(org.x, 0, org.y);
        ant.rootGroup.rotation.y = Math.PI / 2 - org.headingRad;
        ant.update(org.speedMps, org.isCarryingFood, org.behaviorState, deltaSec);

      } else if (org.species === 'GRAVITY_SENTINEL') {
        let sentinel = this.sentinels3D.get(org.id);
        if (!sentinel) {
          sentinel = new GravitySentinel3D();
          this.scene.add(sentinel.rootGroup);
          this.sentinels3D.set(org.id, sentinel);
        }
        const senScale = 1.0 * pScale;
        sentinel.rootGroup.scale.set(senScale, senScale, senScale);
        sentinel.update(org.x, org.y, org.altitudeMeters || 1.8, org.headingRad, org.speedMps, deltaSec);

      } else if (org.species === 'HUMAN_NEOCORTEX') {
        let human = this.humans3D.get(org.id);
        if (!human) {
          human = new HumanNeocortexAvatar3D();
          this.scene.add(human.rootGroup);
          this.humans3D.set(org.id, human);
        }
        const humScale = 1.0 * pScale;
        human.rootGroup.scale.set(humScale, humScale, humScale);
        human.update(org.x, org.y, org.headingRad, org.speedMps, deltaSec);
      }

      // ── Actualizar Bocadillo de Pensamiento Holográfico 3D ──
      let bubble = this.thoughtBubbles3D.get(org.id);
      if (!bubble) {
        bubble = new ThoughtBubbleSprite3D();
        this.scene.add(bubble.sprite);
        this.thoughtBubbles3D.set(org.id, bubble);
      }

      const entityZ = org.species === 'GRAVITY_SENTINEL' ? (org.altitudeMeters || 1.8) : 0;
      let themeColor =
        org.species === 'DROSOPHILA'
          ? '#00e5ff'
          : org.species === 'GRAVITY_SENTINEL'
          ? '#38bdf8'
          : org.species === 'HUMAN_NEOCORTEX'
          ? '#34d399'
          : org.species === 'C_ELEGANS'
          ? '#2dd4bf'
          : '#fbbf24';

      if (org.behaviorState === 'SOCIAL_TROPHALLAXIS') themeColor = '#00ff88';
      else if (org.behaviorState.includes('MITOSIS')) themeColor = '#ffd700';
      else if (org.behaviorState === 'SENESCENT_DECAY' || org.isDecomposing) themeColor = '#fb923c';
      else if (org.isDreaming) themeColor = '#c084fc';

      const genBadge = org.generation > 1 ? ` [G${org.generation}]` : '';
      bubble.update(
        org.x,
        entityZ + 0.35,
        org.y,
        org.species,
        `${biocyberneticHabitat.getSpeciesDisplayName(org.species)}${genBadge}`,
        org.currentThought || 'Observando...',
        org.mood || 'CURIOUS',
        themeColor
      );
    }

    // Purgar organismos muertos / emigrados que ya no están en la simulación
    for (const [id, fly] of this.flies3D.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(fly.rootGroup);
        fly.dispose();
        this.flies3D.delete(id);
      }
    }
    for (const [id, worm] of this.worms3D.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(worm.rootGroup);
        worm.dispose();
        this.worms3D.delete(id);
      }
    }
    for (const [id, ant] of this.ants3D.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(ant.rootGroup);
        ant.dispose();
        this.ants3D.delete(id);
      }
    }
    for (const [id, sentinel] of this.sentinels3D.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(sentinel.rootGroup);
        sentinel.dispose();
        this.sentinels3D.delete(id);
      }
    }
    for (const [id, human] of this.humans3D.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(human.rootGroup);
        human.dispose();
        this.humans3D.delete(id);
      }
    }
    for (const [id, bubble] of this.thoughtBubbles3D.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(bubble.sprite);
        bubble.dispose();
        this.thoughtBubbles3D.delete(id);
      }
    }

    // Actualizar Retícula Holográfica de Selección 3D (Bio-Scanner HUD)
    if (this.selectedOrgId) {
      const selectedOrg = biocyberneticHabitat.getOrganism(this.selectedOrgId);
      if (selectedOrg && !selectedOrg.isDecomposing) {
        this.selectionReticle.visible = true;
        this.selectionReticle.position.set(selectedOrg.x, 0.03, selectedOrg.y);
        this.selectionReticle.rotation.y += deltaSec * 1.8;
      } else {
        this.selectionReticle.visible = false;
      }
    } else {
      this.selectionReticle.visible = false;
    }
  }

  private updateBarriers3D(): void {
    const barriers = biocyberneticHabitat.diffusionGrid.getBarriers();
    const activeIds = new Set<string>();

    for (const b of barriers) {
      activeIds.add(b.id);
      let mesh = this.barrierMeshes.get(b.id);

      // Re-centrar coordenadas a la arena [-10, 10]
      const gridCenter = 10.0;
      const x1 = b.x1 - gridCenter;
      const z1 = b.y1 - gridCenter;
      const x2 = b.x2 - gridCenter;
      const z2 = b.y2 - gridCenter;

      const len = Math.hypot(x2 - x1, z2 - z1);
      const angle = Math.atan2(z2 - z1, x2 - x1);
      const midX = (x1 + x2) * 0.5;
      const midZ = (z1 + z2) * 0.5;

      if (!mesh) {
        const barrierGeo = new THREE.PlaneGeometry(len, 1.2);
        const barrierMat = new THREE.MeshStandardMaterial({
          color: 0x00f0ff,
          emissive: 0x00e5ff,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
        });
        mesh = new THREE.Mesh(barrierGeo, barrierMat);
        this.scene.add(mesh);
        this.barrierMeshes.set(b.id, mesh);
      }

      mesh.position.set(midX, 0.6, midZ);
      mesh.rotation.y = -angle;
    }

    for (const [id, m] of this.barrierMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(m);
        m.geometry.dispose();
        this.barrierMeshes.delete(id);
      }
    }
  }

  // ── Metrópolis Biocibernética 3D: Estructuras e Infraestructura Urbana ──────
  private createUrbanStructureMesh(struct: UrbanStructure): THREE.Group {
    const group = new THREE.Group();
    group.name = `Metropolis_${struct.type}_${struct.id}`;
    group.position.set(struct.x, 0, struct.y);

    if (struct.type === 'CENTRAL_SILO') {
      // ── Silo Central de Biopolímeros y ATP ──
      const baseGeo = new THREE.CylinderGeometry(0.9, 1.0, 0.2, 6);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.7, metalness: 0.8 });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.1;
      baseMesh.castShadow = true;
      group.add(baseMesh);

      const tankGeo = new THREE.CylinderGeometry(0.75, 0.75, 1.6, 16);
      const tankMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.45,
        roughness: 0.15,
        metalness: 0.3,
      });
      const tankMesh = new THREE.Mesh(tankGeo, tankMat);
      tankMesh.position.y = 1.0;
      group.add(tankMesh);

      const coreGeo = new THREE.CylinderGeometry(0.62, 0.62, 1.4, 16);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 1.2,
        roughness: 0.2,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.name = 'SiloLiquidCore';
      coreMesh.position.y = 1.0;
      group.add(coreMesh);

      const domeGeo = new THREE.SphereGeometry(0.75, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMat = new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.9, roughness: 0.2 });
      const domeMesh = new THREE.Mesh(domeGeo, domeMat);
      domeMesh.position.y = 1.8;
      group.add(domeMesh);

      const siloLight = new THREE.PointLight(0xf59e0b, 1.5, 4.0);
      siloLight.position.y = 1.2;
      group.add(siloLight);

    } else if (struct.type === 'BIO_TOWER_DWELLING') {
      // ── Torre / Hábitat Hexagonal Multi-Piso ──
      const baseGeo = new THREE.CylinderGeometry(1.0, 1.15, 0.25, 6);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.5, metalness: 0.7 });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.125;
      baseMesh.castShadow = true;
      group.add(baseMesh);

      const bodyGeo = new THREE.CylinderGeometry(0.55, 0.9, 2.5, 6);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x312e81,
        roughness: 0.4,
        metalness: 0.6,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = 1.45;
      bodyMesh.castShadow = true;
      group.add(bodyMesh);

      const cellGeo = new THREE.CylinderGeometry(0.57, 0.92, 2.3, 6);
      const cellMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      });
      const cellMesh = new THREE.Mesh(cellGeo, cellMat);
      cellMesh.position.y = 1.45;
      group.add(cellMesh);

      const spireGeo = new THREE.ConeGeometry(0.45, 1.1, 6);
      const spireMat = new THREE.MeshStandardMaterial({
        color: 0x4f46e5,
        emissive: 0x818cf8,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      });
      const spireMesh = new THREE.Mesh(spireGeo, spireMat);
      spireMesh.name = 'TowerSpire';
      spireMesh.position.y = 3.25;
      group.add(spireMesh);

      const orbGeo = new THREE.SphereGeometry(0.14, 8, 8);
      const orbMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
      const orbMesh = new THREE.Mesh(orbGeo, orbMat);
      orbMesh.position.y = 3.85;
      group.add(orbMesh);

    } else if (struct.type === 'BIO_COMPOSTER') {
      // ── Compostero Bio-Circular de Reciclaje ──
      const drumGeo = new THREE.CylinderGeometry(0.9, 0.75, 0.6, 16);
      const drumMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.6, metalness: 0.4 });
      const drumMesh = new THREE.Mesh(drumGeo, drumMat);
      drumMesh.position.y = 0.3;
      drumMesh.castShadow = true;
      group.add(drumMesh);

      const vortexGeo = new THREE.CylinderGeometry(0.8, 0.1, 0.5, 16);
      const vortexMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x34d399,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      });
      const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
      vortexMesh.name = 'CompostVortex';
      vortexMesh.position.y = 0.35;
      group.add(vortexMesh);

      const ringGeo = new THREE.TorusGeometry(0.95, 0.05, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.name = 'CompostCatalystRing';
      ringMesh.position.y = 0.65;
      group.add(ringMesh);

    } else if (struct.type === 'DEFENSE_BEACON') {
      // ── Baliza Táctica de Defensa y Vigilancia ──
      const tripodGeo = new THREE.ConeGeometry(0.65, 1.6, 4);
      const tripodMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });
      const tripodMesh = new THREE.Mesh(tripodGeo, tripodMat);
      tripodMesh.position.y = 0.8;
      group.add(tripodMesh);

      const lensGeo = new THREE.OctahedronGeometry(0.28);
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x22d3ee,
        emissiveIntensity: 2.0,
      });
      const lensMesh = new THREE.Mesh(lensGeo, lensMat);
      lensMesh.name = 'BeaconLens';
      lensMesh.position.y = 1.7;
      group.add(lensMesh);

      const beamGeo = new THREE.CylinderGeometry(0.4, 0.05, 3.5, 12);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.y = 3.4;
      group.add(beamMesh);
    }

    return group;
  }

  private updateMetropolis3D(deltaSec: number): void {
    const metropolisEngine = biocyberneticHabitat.getMetropolisEngine();
    const telemetry = metropolisEngine.getTelemetry();
    const activeIds = new Set<string>();

    for (const struct of telemetry.structures) {
      activeIds.add(struct.id);
      let group = this.structureMeshes.get(struct.id);
      if (!group) {
        group = this.createUrbanStructureMesh(struct);
        this.metropolisGroup.add(group);
        this.structureMeshes.set(struct.id, group);
      }

      if (struct.type === 'BIO_COMPOSTER') {
        const ring = group.getObjectByName('CompostCatalystRing');
        if (ring) ring.rotation.z += deltaSec * 2.5;
        const vortex = group.getObjectByName('CompostVortex');
        if (vortex) {
          const s = 0.95 + Math.sin(this.simTimeSec * 4.0) * 0.05;
          vortex.scale.set(s, 1.0, s);
        }
      } else if (struct.type === 'CENTRAL_SILO') {
        const core = group.getObjectByName('SiloLiquidCore');
        if (core) {
          const stored = struct.storedGlucose + struct.storedAtp;
          const fillRatio = Math.max(0.15, Math.min(1.0, stored / Math.max(1, struct.capacity)));
          core.scale.y = fillRatio;
          core.position.y = 0.3 + (fillRatio * 1.4) * 0.5;
        }
      } else if (struct.type === 'DEFENSE_BEACON') {
        const lens = group.getObjectByName('BeaconLens');
        if (lens) {
          lens.rotation.y += deltaSec * 1.8;
          lens.rotation.x += deltaSec * 0.6;
        }
      }

      const buildScale = Math.max(0.3, struct.constructionProgress);
      group.scale.y = buildScale;
    }

    for (const [id, grp] of this.structureMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.metropolisGroup.remove(grp);
        grp.traverse((obj) => {
          const anyObj = obj as unknown as { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
          if (anyObj.geometry) anyObj.geometry.dispose();
          if (anyObj.material) {
            if (Array.isArray(anyObj.material)) anyObj.material.forEach((m) => m.dispose());
            else anyObj.material.dispose();
          }
        });
        this.structureMeshes.delete(id);
      }
    }

    const highways = telemetry.highways;
    if (highways.length !== this.lastHighwayCount) {
      this.lastHighwayCount = highways.length;
      if (this.highwayLines) {
        this.metropolisGroup.remove(this.highwayLines);
        this.highwayLines.geometry.dispose();
        (this.highwayLines.material as THREE.Material).dispose();
        this.highwayLines = null;
      }

      if (highways.length > 0) {
        const positions = new Float32Array(highways.length * 6);
        for (let i = 0; i < highways.length; i++) {
          const hw = highways[i];
          positions[i * 6] = hw.x1;
          positions[i * 6 + 1] = 0.025;
          positions[i * 6 + 2] = hw.y1;
          positions[i * 6 + 3] = hw.x2;
          positions[i * 6 + 4] = 0.025;
          positions[i * 6 + 5] = hw.y2;
        }
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xffb703,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
        });
        this.highwayLines = new THREE.LineSegments(lineGeo, lineMat);
        this.metropolisGroup.add(this.highwayLines);
      }
    }
  }

  private updateCameraPosition(): void {
    if (this.cameraMode === 'ORBITAL') {
      const { radius, theta, phi } = this.camSpherical;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      this.camera.position.set(x, Math.max(1.5, y), z);
      this.camera.lookAt(0, 0.4, 0);

    } else if (this.cameraMode === 'FOLLOW_AGENT') {
      const targetOrg =
        (this.selectedOrgId ? biocyberneticHabitat.getOrganism(this.selectedOrgId) : null) ||
        biocyberneticHabitat.getLeader() ||
        biocyberneticHabitat.getAllOrganisms()[0];

      if (targetOrg) {
        const isSentinel = targetOrg.species === 'GRAVITY_SENTINEL';
        const camDist = isSentinel ? 4.2 : 3.6;
        const orgY = isSentinel ? targetOrg.altitudeMeters || 1.8 : 0;
        const camHeight = orgY + 2.2;
        const targetX = targetOrg.x - Math.cos(targetOrg.headingRad) * camDist;
        const targetZ = targetOrg.y - Math.sin(targetOrg.headingRad) * camDist;

        this.camera.position.lerp(new THREE.Vector3(targetX, camHeight, targetZ), 0.12);
        this.camera.lookAt(targetOrg.x, orgY + 0.35, targetOrg.y);
      }

    } else if (this.cameraMode === 'TOP_DOWN_GOD') {
      this.camera.position.lerp(new THREE.Vector3(0, 24, 0.001), 0.1);
      this.camera.lookAt(0, 0, 0);
    }
  }

  // ── Interacción Táctil y Puntero con Raycasting 3D ───────────────────────────
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

  private getRaycastGroundPoint(clientX: number, clientY: number): THREE.Vector3 | null {
    if (!this.container) return null;
    const rect = this.container.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const target = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, target);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 1) {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };

      const groundPt = this.getRaycastGroundPoint(e.clientX, e.clientY);
      if (groundPt) {
        // Verificar si pulsó sobre un organismo 3D para el Bio-Scanner HUD
        const organisms = biocyberneticHabitat.getAllOrganisms();
        let hitOrg: HabitatOrganism | null = null;
        for (const org of organisms) {
          if (Math.hypot(org.x - groundPt.x, org.y - groundPt.z) < 1.1) {
            hitOrg = org;
            break;
          }
        }

        if (hitOrg) {
          this.setSelectedOrganism(hitOrg.id);
          this.onSelectOrganismCallback?.(hitOrg.id);
          this.isInteractingWithTool = false;
          TacticalAudioEngine.playTap();
          return;
        }

        // Si no pulsó un organismo, evaluar si interactúa con una herramienta en el suelo de la arena
        const curTool = biocyberneticHabitat.getActiveTool();
        const insideArena = Math.hypot(groundPt.x, groundPt.z) <= this.arenaRadius;

        if (insideArena && curTool !== 'NONE') {
          this.isInteractingWithTool = true;
          this.lastPaintedToolPos = { x: groundPt.x, z: groundPt.z };

          if (curTool === 'AIR_PUFF_POKE') {
            biocyberneticHabitat.applyToolAt(groundPt.x, groundPt.z);
            this.triggerAirPuffVfx(groundPt.x, groundPt.z);
          } else if (curTool === 'OPTOGENETIC_LASER' || curTool === 'OPTOGENETIC_CHR2') {
            biocyberneticHabitat.applyToolAt(groundPt.x, groundPt.z);
            biocyberneticHabitat.triggerPlayfulLaser(groundPt.x, groundPt.z);
            this.triggerLaserVfx(groundPt.x, groundPt.z);
          } else if (curTool === 'HEAT_INFRARED') {
            biocyberneticHabitat.applyToolAt(groundPt.x, groundPt.z);
            this.triggerHeatVfx(groundPt.x, groundPt.z);
          } else if (curTool === 'LOOMING_SHADOW') {
            biocyberneticHabitat.applyToolAt(groundPt.x, groundPt.z);
            this.triggerLoomingVfx(groundPt.x, groundPt.z);
          } else if (curTool === 'GLUCOSE_PIPETTE') {
            biocyberneticHabitat.applyToolAt(groundPt.x, groundPt.z);
          } else if (curTool === 'ACOUSTIC_BARRIER') {
            this.barrierStartPoint = new THREE.Vector2(groundPt.x, groundPt.z);
            this.updateBarrierPreview(groundPt.x, groundPt.z, groundPt.x, groundPt.z);
          }
        } else {
          this.isInteractingWithTool = false;
        }
      } else {
        this.isInteractingWithTool = false;
      }

    } else if (this.activePointers.size === 2) {
      this.isDragging = false;
      this.isInteractingWithTool = false;
      this.removeBarrierPreview();
      this.barrierStartPoint = null;
      const pts = Array.from(this.activePointers.values());
      this.initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.initialPinchRadius = this.camSpherical.radius;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size === 1 && this.isDragging) {
      const groundPt = this.getRaycastGroundPoint(e.clientX, e.clientY);
      const curTool = biocyberneticHabitat.getActiveTool();

      if (this.isInteractingWithTool && groundPt) {
        // Interacción exclusiva con herramientas tácticas (sin rotar la cámara)
        if (curTool === 'GLUCOSE_PIPETTE' || curTool === 'HEAT_INFRARED') {
          if (this.lastPaintedToolPos) {
            const dist = Math.hypot(groundPt.x - this.lastPaintedToolPos.x, groundPt.z - this.lastPaintedToolPos.z);
            if (dist > 0.45 && Math.hypot(groundPt.x, groundPt.z) <= this.arenaRadius) {
              biocyberneticHabitat.applyToolAt(groundPt.x, groundPt.z);
              if (curTool === 'HEAT_INFRARED') {
                this.triggerHeatVfx(groundPt.x, groundPt.z);
              }
              this.lastPaintedToolPos = { x: groundPt.x, z: groundPt.z };
            }
          }
        } else if (curTool === 'OPTOGENETIC_LASER' || curTool === 'OPTOGENETIC_CHR2') {
          biocyberneticHabitat.applyToolAt(groundPt.x, groundPt.z);
          biocyberneticHabitat.triggerPlayfulLaser(groundPt.x, groundPt.z);
          this.triggerLaserVfx(groundPt.x, groundPt.z);
        } else if (curTool === 'ACOUSTIC_BARRIER' && this.barrierStartPoint) {
          this.updateBarrierPreview(
            this.barrierStartPoint.x,
            this.barrierStartPoint.y,
            groundPt.x,
            groundPt.z
          );
        }
      } else {
        // Navegación Órbita de Cámara 3D (cuando no se usa una herramienta en el suelo)
        const deltaX = e.clientX - this.previousMousePosition.x;
        const deltaY = e.clientY - this.previousMousePosition.y;

        if (this.cameraMode === 'ORBITAL') {
          this.camSpherical.theta -= deltaX * 0.007;
          this.camSpherical.phi = Math.max(
            0.15,
            Math.min(Math.PI / 2 - 0.05, this.camSpherical.phi - deltaY * 0.007)
          );
        }
      }

      this.previousMousePosition = { x: e.clientX, y: e.clientY };

    } else if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.initialPinchDist > 0 && currentDist > 0) {
        const factor = this.initialPinchDist / currentDist;
        this.camSpherical.radius = Math.max(5.0, Math.min(35.0, this.initialPinchRadius * factor));
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.isInteractingWithTool && this.barrierStartPoint) {
      const curTool = biocyberneticHabitat.getActiveTool();
      if (curTool === 'ACOUSTIC_BARRIER') {
        const groundPt = this.getRaycastGroundPoint(e.clientX, e.clientY);
        if (groundPt) {
          const dist = Math.hypot(groundPt.x - this.barrierStartPoint.x, groundPt.z - this.barrierStartPoint.y);
          if (dist >= 0.4) {
            const gridCenter = 10.0;
            biocyberneticHabitat.diffusionGrid.addBarrier({
              id: `barrier-${Date.now()}`,
              x1: this.barrierStartPoint.x + gridCenter,
              y1: this.barrierStartPoint.y + gridCenter,
              x2: groundPt.x + gridCenter,
              y2: groundPt.z + gridCenter,
            });
            TacticalAudioEngine.playTap();
            this.onAlertCallback?.('🚧 Barrera acústica reflectora trazada (3D)');
          }
        }
      }
      this.removeBarrierPreview();
      this.barrierStartPoint = null;
    }

    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size === 0) {
      this.isDragging = false;
      this.isInteractingWithTool = false;
      this.lastPaintedToolPos = null;
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.camSpherical.radius = Math.max(
      5.0,
      Math.min(35.0, this.camSpherical.radius + e.deltaY * 0.015)
    );
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.pause();
  };

  private onContextRestored = (): void => {
    this.start();
  };

  // ── Efectos Visuales Tácticos Transitorios 3D ────────────────────────────────
  public triggerLaserVfx(x: number, z: number): void {
    const laserMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 })
    );
    laserMesh.position.set(x, 7, z);
    this.toolVfxGroup.add(laserMesh);

    const tid = setTimeout(() => {
      this.activeVfxTimeoutIds.delete(tid);
      this.toolVfxGroup.remove(laserMesh);
      laserMesh.geometry.dispose();
      (laserMesh.material as THREE.Material).dispose();
    }, 120);
    this.activeVfxTimeoutIds.add(tid);
  }

  public triggerAirPuffVfx(x: number, z: number): void {
    const ringGeo = new THREE.RingGeometry(0.1, 0.3, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(x, 0.05, z);
    this.toolVfxGroup.add(ringMesh);

    const start = performance.now();
    let rafId: number;
    const anim = () => {
      const elapsed = (performance.now() - start) * 0.001;
      const progress = elapsed / 0.55;
      if (progress >= 1.0) {
        this.activeVfxRafIds.delete(rafId);
        this.toolVfxGroup.remove(ringMesh);
        ringGeo.dispose();
        ringMat.dispose();
      } else {
        const curScale = 1.0 + progress * 6.5;
        ringMesh.scale.set(curScale, curScale, curScale);
        ringMat.opacity = 0.8 * (1.0 - progress);
        rafId = requestAnimationFrame(anim);
        this.activeVfxRafIds.add(rafId);
      }
    };
    rafId = requestAnimationFrame(anim);
    this.activeVfxRafIds.add(rafId);
  }

  public triggerHeatVfx(x: number, z: number): void {
    const colGeo = new THREE.CylinderGeometry(0.5, 0.85, 3.5, 16, 1, true);
    const colMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const colMesh = new THREE.Mesh(colGeo, colMat);
    colMesh.position.set(x, 1.75, z);
    this.toolVfxGroup.add(colMesh);

    const start = performance.now();
    let rafId: number;
    const anim = () => {
      const elapsed = (performance.now() - start) * 0.001;
      const progress = elapsed / 0.45;
      if (progress >= 1.0) {
        this.activeVfxRafIds.delete(rafId);
        this.toolVfxGroup.remove(colMesh);
        colGeo.dispose();
        colMat.dispose();
      } else {
        colMesh.scale.set(1.0 + progress * 0.8, 1.0 + progress * 0.5, 1.0 + progress * 0.8);
        colMat.opacity = 0.65 * (1.0 - progress);
        rafId = requestAnimationFrame(anim);
        this.activeVfxRafIds.add(rafId);
      }
    };
    rafId = requestAnimationFrame(anim);
    this.activeVfxRafIds.add(rafId);
  }

  public triggerLoomingVfx(x: number, z: number): void {
    const diskGeo = new THREE.CircleGeometry(0.4, 24);
    diskGeo.rotateX(-Math.PI / 2);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0x050811,
      transparent: true,
      opacity: 0.85,
    });
    const diskMesh = new THREE.Mesh(diskGeo, diskMat);
    diskMesh.position.set(x, 0.02, z);
    this.toolVfxGroup.add(diskMesh);

    const start = performance.now();
    let rafId: number;
    const anim = () => {
      const elapsed = (performance.now() - start) * 0.001;
      const progress = elapsed / 0.6;
      if (progress >= 1.0) {
        this.activeVfxRafIds.delete(rafId);
        this.toolVfxGroup.remove(diskMesh);
        diskGeo.dispose();
        diskMat.dispose();
      } else {
        const curScale = 1.0 + progress * 8.5;
        diskMesh.scale.set(curScale, curScale, curScale);
        diskMat.opacity = 0.85 * (1.0 - progress);
        rafId = requestAnimationFrame(anim);
        this.activeVfxRafIds.add(rafId);
      }
    };
    rafId = requestAnimationFrame(anim);
    this.activeVfxRafIds.add(rafId);
  }

  public dispose(): void {
    // Cancelar TODOS los bucles VFX activos ANTES de detach() para evitar
    // acceso a geometrías ya liberadas en un contexto WebGL perdido.
    this.activeVfxRafIds.forEach((id) => cancelAnimationFrame(id));
    this.activeVfxRafIds.clear();
    this.activeVfxTimeoutIds.forEach((id) => clearTimeout(id));
    this.activeVfxTimeoutIds.clear();

    this.detach();
    this.removeBarrierPreview();
    this.flies3D.forEach((f) => f.dispose());
    this.flies3D.clear();
    this.worms3D.forEach((w) => w.dispose());
    this.worms3D.clear();
    this.ants3D.forEach((a) => a.dispose());
    this.ants3D.clear();
    this.sentinels3D.forEach((s) => s.dispose());
    this.sentinels3D.clear();
    this.humans3D.forEach((h) => h.dispose());
    this.humans3D.clear();
    this.thoughtBubbles3D.forEach((b) => b.dispose());
    this.thoughtBubbles3D.clear();
    this.sugarMegaCrystal.dispose();
    this.playfulLaserMesh.dispose();

    if (this.ambientSpores) {
      this.scene.remove(this.ambientSpores);
      this.ambientSpores.geometry.dispose();
      (this.ambientSpores.material as THREE.Material).dispose();
    }

    this.barrierMeshes.forEach((m) => {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.barrierMeshes.clear();

    const disposeHierarchy = (root?: THREE.Object3D | null) => {
      if (!root) return;
      this.scene.remove(root);
      root.traverse((obj) => {
        const anyObj = obj as unknown as { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
        if (anyObj.geometry) anyObj.geometry.dispose();
        if (anyObj.material) {
          if (Array.isArray(anyObj.material)) {
            anyObj.material.forEach((mat: THREE.Material) => mat.dispose());
          } else {
            anyObj.material.dispose();
          }
        }
      });
    };

    disposeHierarchy(this.treeOfLifeGroup);
    disposeHierarchy(this.nectarSpringsGroup);
    disposeHierarchy(this.myceliumNetworkGroup);
    disposeHierarchy(this.celestialDome);
    disposeHierarchy(this.tacticalChessTable);
    this.structureMeshes.forEach((mesh) => disposeHierarchy(mesh));
    this.structureMeshes.clear();
    if (this.highwayLines) {
      this.scene.remove(this.highwayLines);
      this.highwayLines.geometry.dispose();
      (this.highwayLines.material as THREE.Material).dispose();
      this.highwayLines = null;
    }
    disposeHierarchy(this.metropolisGroup);
    disposeHierarchy(this.nestMound);
    disposeHierarchy(this.toolVfxGroup);
    disposeHierarchy(this.selectionReticle);
    disposeHierarchy(this.groundMesh);
    disposeHierarchy(this.perimeterWall);
    if (this.auroraMesh) {
      this.scene.remove(this.auroraMesh);
      this.auroraMesh.geometry.dispose();
      (this.auroraMesh.material as THREE.Material).dispose();
      this.auroraMesh = null;
    }

    this.chemicalTexture.dispose();
  }
}

