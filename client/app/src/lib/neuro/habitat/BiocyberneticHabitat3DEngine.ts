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
} from './BiocyberneticHabitatEngine';
import { HexapodBody3D } from '../vivarium/HexapodBody3D';
import { centralPatternGenerator, CpgLocomotionTelemetry } from '../CentralPatternGeneratorEngine';
import { TacticalAudioEngine } from '../../audio/TacticalAudioEngine';

export type HabitatCameraMode = 'ORBITAL' | 'FOLLOW_AGENT' | 'TOP_DOWN_GOD';

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

// ── 3. Motor Principal 3D del Hábitat Biocibernético ──────────────────────────
export class BiocyberneticHabitat3DEngine {
  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private animFrameId: number | null = null;
  private isRunning = false;
  private lastTimeMs = 0;

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
  private barrierMeshes: Map<string, THREE.Mesh> = new Map();

  // Raycasting para interacción táctil sobre el suelo 3D
  private readonly raycaster: THREE.Raycaster;
  private readonly groundPlane: THREE.Plane;

  // Callbacks a UI React
  private onSelectOrganismCallback?: (id: string) => void;
  private onAlertCallback?: (msg: string) => void;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020813);
    this.scene.fog = new THREE.FogExp2(0x020813, 0.022);

    this.camera = new THREE.PerspectiveCamera(52, 1.0, 0.1, 150);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // ── Iluminación Táctica y Cyberpunk ─────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x18263a, 1.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
    dirLight.position.set(8, 16, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 12;
    dirLight.shadow.camera.bottom = -12;
    this.scene.add(dirLight);

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
    // 1. Actualizar Textura Química de Fick (Glucosa, Rastro de Hormigas, Alarma)
    this.updateChemicalTexture();

    // 2. Sincronizar y Renderizar Organismos Vivos 3D
    this.updateOrganisms3D(deltaSec);

    // 3. Sincronizar Barreras Acústicas 3D
    this.updateBarriers3D();

    // 4. Actualizar Posición Cinemática de la Cámara
    this.updateCameraPosition();
  }

  private updateChemicalTexture(): void {
    const grid = biocyberneticHabitat.diffusionGrid;
    const gBuf = grid.getBuffer('GLUCOSE');
    const pBuf = grid.getBuffer('PHEROMONE_TRAIL');
    const aBuf = grid.getBuffer('ALARM_PHEROMONE');

    const totalCells = 64 * 64;
    for (let i = 0; i < totalCells; i++) {
      const g = gBuf[i] || 0;
      const p = pBuf[i] || 0;
      const a = aBuf[i] || 0;

      // Color coding táctico:
      // Glucosa: Esmeralda brillante (G: alto, B: medio)
      // Rastro Pheromone: Ámbar/Dorado (R: 255, G: 160, B: 20)
      // Alarma: Carmesí neón (R: 255, G: 20, B: 60)
      const rVal = Math.min(255, Math.floor(a * 500 + p * 240));
      const gVal = Math.min(255, Math.floor(g * 400 + p * 150));
      const bVal = Math.min(255, Math.floor(g * 180 + a * 30 + 15));
      const alphaVal = Math.min(255, Math.floor(Math.max(g * 350, p * 300, a * 450) + 18));

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

      if (org.species === 'DROSOPHILA') {
        let fly = this.flies3D.get(org.id);
        if (!fly) {
          fly = new HexapodBody3D();
          fly.rootGroup.scale.set(0.68, 0.68, 0.68);
          this.scene.add(fly.rootGroup);
          this.flies3D.set(org.id, fly);
        }

        // Posicionamiento en el suelo X-Z
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
        worm.update(org.wormJoints);

      } else if (org.species === 'ANT') {
        let ant = this.ants3D.get(org.id);
        if (!ant) {
          ant = new AntBody3D();
          this.scene.add(ant.rootGroup);
          this.ants3D.set(org.id, ant);
        }

        ant.rootGroup.position.set(org.x, 0, org.y);
        ant.rootGroup.rotation.y = Math.PI / 2 - org.headingRad;
        ant.update(org.speedMps, org.isCarryingFood, org.behaviorState, deltaSec);
      }
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

  private updateCameraPosition(): void {
    if (this.cameraMode === 'ORBITAL') {
      const { radius, theta, phi } = this.camSpherical;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      this.camera.position.set(x, Math.max(1.5, y), z);
      this.camera.lookAt(0, 0.4, 0);

    } else if (this.cameraMode === 'FOLLOW_AGENT') {
      const leader = biocyberneticHabitat.getLeader() || biocyberneticHabitat.getAllOrganisms()[0];
      if (leader) {
        const camDist = 3.6;
        const camHeight = 2.2;
        const targetX = leader.x - Math.cos(leader.headingRad) * camDist;
        const targetZ = leader.y - Math.sin(leader.headingRad) * camDist;

        this.camera.position.lerp(new THREE.Vector3(targetX, camHeight, targetZ), 0.12);
        this.camera.lookAt(leader.x, 0.35, leader.y);
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
        const curTool = biocyberneticHabitat.getTelemetry().activeTool;
        const insideArena = Math.hypot(groundPt.x, groundPt.z) <= this.arenaRadius;

        if (insideArena && curTool !== 'NONE') {
          this.isInteractingWithTool = true;
          this.lastPaintedToolPos = { x: groundPt.x, z: groundPt.z };

          if (curTool === 'AIR_PUFF_POKE') {
            biocyberneticHabitat.applyToolAt(groundPt.x, groundPt.z);
            this.triggerAirPuffVfx(groundPt.x, groundPt.z);
          } else if (curTool === 'OPTOGENETIC_LASER' || curTool === 'OPTOGENETIC_CHR2') {
            biocyberneticHabitat.applyToolAt(groundPt.x, groundPt.z);
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
      const curTool = biocyberneticHabitat.getTelemetry().activeTool;

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
      const curTool = biocyberneticHabitat.getTelemetry().activeTool;
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

    setTimeout(() => {
      this.toolVfxGroup.remove(laserMesh);
      laserMesh.geometry.dispose();
      (laserMesh.material as THREE.Material).dispose();
    }, 120);
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
    const anim = () => {
      const elapsed = (performance.now() - start) * 0.001;
      const progress = elapsed / 0.55;
      if (progress >= 1.0) {
        this.toolVfxGroup.remove(ringMesh);
        ringGeo.dispose();
        ringMat.dispose();
      } else {
        const curScale = 1.0 + progress * 6.5;
        ringMesh.scale.set(curScale, curScale, curScale);
        ringMat.opacity = 0.8 * (1.0 - progress);
        requestAnimationFrame(anim);
      }
    };
    requestAnimationFrame(anim);
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
    const anim = () => {
      const elapsed = (performance.now() - start) * 0.001;
      const progress = elapsed / 0.45;
      if (progress >= 1.0) {
        this.toolVfxGroup.remove(colMesh);
        colGeo.dispose();
        colMat.dispose();
      } else {
        colMesh.scale.set(1.0 + progress * 0.8, 1.0 + progress * 0.5, 1.0 + progress * 0.8);
        colMat.opacity = 0.65 * (1.0 - progress);
        requestAnimationFrame(anim);
      }
    };
    requestAnimationFrame(anim);
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
    const anim = () => {
      const elapsed = (performance.now() - start) * 0.001;
      const progress = elapsed / 0.6;
      if (progress >= 1.0) {
        this.toolVfxGroup.remove(diskMesh);
        diskGeo.dispose();
        diskMat.dispose();
      } else {
        const curScale = 1.0 + progress * 8.5;
        diskMesh.scale.set(curScale, curScale, curScale);
        diskMat.opacity = 0.85 * (1.0 - progress);
        requestAnimationFrame(anim);
      }
    };
    requestAnimationFrame(anim);
  }

  public dispose(): void {
    this.detach();
    this.removeBarrierPreview();
    this.flies3D.forEach((f) => f.dispose());
    this.flies3D.clear();
    this.worms3D.forEach((w) => w.dispose());
    this.worms3D.clear();
    this.ants3D.forEach((a) => a.dispose());
    this.ants3D.clear();
    this.barrierMeshes.forEach((m) => {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.barrierMeshes.clear();
    this.selectionReticle.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      }
    });
    this.chemicalTexture.dispose();
  }
}
