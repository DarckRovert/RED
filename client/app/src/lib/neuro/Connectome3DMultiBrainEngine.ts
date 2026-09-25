/**
 * Connectome3DMultiBrainEngine.ts — RED Sovereign Mesh OS
 * 
 * Motor Gráfico 3D WebGL de Alto Rendimiento para la Capa Bio-Cibernética y Conectómica.
 * Desarrollado con Three.js bajo el Estándar de Excelencia L9:
 * 
 * 1. MODO SUBCORTICAL_MALE_CNS (Cerebro Drosophila melanogaster — FlyWire MaleCNS v1.0):
 *    - Central Complex (CX): Anillo toroidal de 16 cuñas E-PG con vector azimutal,
 *      Puente Protocerebral (PB) de 16 glomérulos y pares de Noduli (NO).
 *    - Fan-Shaped Body (FB): Matriz 3D de 16 columnas y 9 estratos laminares.
 *    - Mushroom Body (MB): Cálices de células de Kenyon, pedúnculo y lóbulos alfa/beta/gamma con plasticidad STDP.
 *    - Optic Lobes (OL): Retícula omatidial de facetas hexagonales y detectores de colisión LC4/LPLC2.
 *    - Giant Fiber System (GFS): Somas protocerebrales y axones descendentes hacia TTMn torácico.
 *    - Johnston's Organ (JO): Aristas antenales mecanosensoriales.
 *    - Pulsos sinápticos activos en 3D (AER Micro-spikes) viajando a lo largo de las sinapsis.
 * 
 * 2. MODO HUMAN_NEOCORTEX (Neocorteza Humana — 7 Núcleos Cognitivos):
 *    - Modelo anatómico volumétrico de hemisferios cerebrales con circunvoluciones y surcos.
 *    - 7 regiones corticales diferenciadas: PFC, M1, S1, AIC (Ínsula), HC/MEC (Hipocampo), V1 y OFC.
 *    - Luminiscencia hemodinámica en tiempo real acoplada a HumanBrainOrchestrator.
 *    - Vías tálamo-corticales y de proyección corticoespinal.
 * 
 * 3. MODO CONSCIOUS_SWARM_BUS (Espacio de Trabajo Global GNWT & Enjambre):
 *    - Hipergrafo cognitivo 3D que integra Subcortex Fly + 7 Hubs Neocorticales + Nodos P2P de Malla LoRa.
 *    - Onda esférica volumétrica de ignición atencional (Dehaene/Changeux) expansiva en tiempo real.
 * 
 * 4. Interacción & Resiliencia:
 *    - Control orbital cinemático (Touch / Mouse Orbit, Pan, Zoom).
 *    - Raycasting interactivo táctil para inspección de somas y núcleos.
 *    - ResizeObserver adaptativo al 100% del viewport sin límites artificiales de móvil.
 */

import * as THREE from 'three';

// ── GPU Tier Detection (tier-aware WebGL quality scaling) ────────────────
function detectGpuTierConnectome(): 'low' | 'mid' | 'high' {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = (probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase() : '';

      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();

      if (
        /powervr|ge8320|ge8300|mali-g31|mali-g51|mali-g52|mali-t|adreno.*(504|505|506|610|612|615)|intel.*(hd|uhd).*graphics.*(400|500|600|605|610)|swiftshader|llvmpipe/i.test(
          renderer
        )
      ) {
        return 'low';
      }
    }
  } catch {}

  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const memory   = nav.deviceMemory ?? 4;
  const cores    = nav.hardwareConcurrency ?? 4;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  if (isMobile && (memory <= 3 || cores <= 4)) return 'low';
  if (isMobile && memory <= 6)                  return 'mid';
  return 'high';
}
import { ringAttractor, RingAttractorTelemetry } from './RingAttractorEngine';
import { fanShapedBody, FanShapedBodyTelemetry } from './FanShapedBodyEngine';
import { giantFiberReflex, GiantFiberTelemetry } from './GiantFiberReflexEngine';
import { dtnMushroomBody, MushroomBodyTelemetry } from './DtnMushroomBodyEngine';
import { johnstonOrgan, JohnstonOrganTelemetry } from './JohnstonOrganEngine';
import { metabolicGovernor, MetabolicGovernorTelemetry } from './MetabolicNeuromorphicGovernor';
import { opticLobe, OpticLobeTelemetry } from './OpticLobeEngine';
import { humanBrainOrchestrator, HumanBrainTelemetrySnapshot } from './human/HumanBrainOrchestrator';
import { globalWorkspaceConsciousnessBus, ConsciousnessSnapshot } from './GlobalWorkspaceConsciousnessBus';
import { meshRouter } from '../mesh/meshRouter';
import { synapticMeshRouter, RfPeerBearing } from './SynapticMeshRouterEngine';

export type ConnectomeBrainArchitecture =
  | 'SUBCORTICAL_MALE_CNS'
  | 'HUMAN_NEOCORTEX'
  | 'CONSCIOUS_SWARM_BUS';

export interface ConnectomeRaycastHit {
  id: string;
  name: string;
  system: string;
  activity: number;
  details: string;
  position: { x: number; y: number; z: number };
}

export class Connectome3DMultiBrainEngine {
  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private resizeObserver: ResizeObserver | null = null;
  private animFrameId: number | null = null;

  // Grupos raíz de las 3 arquitecturas
  private flyConnectomeGroup: THREE.Group;
  private humanNeocortexGroup: THREE.Group;
  private consciousSwarmGroup: THREE.Group;

  // Estado del motor
  private currentMode: ConnectomeBrainArchitecture = 'SUBCORTICAL_MALE_CNS';
  private targetCameraPos = new THREE.Vector3(0, 0, 16);
  private currentCameraLookAt = new THREE.Vector3(0, 0, 0);
  private autoRotate = true;

  // Controles de cámara orbital táctil / ratón
  private isPointerDown = false;
  private isDragging = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private prevPointerX = 0;
  private prevPointerY = 0;
  private spherical = { radius: 16, phi: Math.PI / 2.8, theta: 0 };
  private pinchStartDist = 0;

  // Resiliencia WebGL ante cambio de contexto en SO / app
  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.stopRenderLoop();
  };

  private onContextRestored = (): void => {
    this.startRenderLoop();
  };

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private mouseVec = new THREE.Vector2();
  private interactiveMeshes: THREE.Mesh[] = [];
  private onSelectCallback: ((hit: ConnectomeRaycastHit | null) => void) | null = null;

  // Elementos de Drosophila MaleCNS
  private epgWedgeMeshes: THREE.Mesh[] = [];
  private pbGlomeruliMeshes: THREE.Mesh[] = [];
  private fbLayerMeshes: THREE.Mesh[] = [];
  private mbLobeMeshes: THREE.Mesh[] = [];
  private gfsAxonTubes: THREE.Mesh[] = [];
  private lc4LoomingMeshes: THREE.Mesh[] = [];
  private antennalCiliaMeshes: THREE.Mesh[] = [];
  private synapticPulses: Array<{ mesh: THREE.Mesh; path: THREE.CatmullRomCurve3; progress: number; speed: number }> = [];

  // Elementos de Neocorteza Humana
  private humanLobeMeshes: Map<string, THREE.Mesh> = new Map();
  private thalamocorticalTracts: THREE.LineSegments | null = null;

  // Elementos de Enjambre GNWT
  private gnwtNodeMeshes: THREE.Mesh[] = [];
  private gnwtEdgeLines: THREE.LineSegments | null = null;
  private gnwtIgnitionSphere: THREE.Mesh | null = null;
  private ignitionScale = 0;

  // Suscripciones y telemetrías en caché
  private unsubs: Array<() => void> = [];
  private cxTelemetry: RingAttractorTelemetry = ringAttractor.getTelemetry();
  private fbTelemetry: FanShapedBodyTelemetry = fanShapedBody.getTelemetry();
  private gfsTelemetry: GiantFiberTelemetry = giantFiberReflex.getTelemetry();
  private mbTelemetry: MushroomBodyTelemetry = dtnMushroomBody.getTelemetry();
  private joTelemetry: JohnstonOrganTelemetry = johnstonOrgan.getTelemetry();
  private metTelemetry: MetabolicGovernorTelemetry = metabolicGovernor.getTelemetry();
  private opticTelemetry: OpticLobeTelemetry = opticLobe.getTelemetry();
  private humanSnapshot: HumanBrainTelemetrySnapshot = humanBrainOrchestrator.getSnapshot();
  private consciousnessTelemetry: ConsciousnessSnapshot = globalWorkspaceConsciousnessBus.getSnapshot();
  private rfBearings: RfPeerBearing[] = [];
  private gpuTier: 'low' | 'mid' | 'high' = 'high';

  constructor() {
    this.gpuTier = detectGpuTierConnectome();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);
    this.scene.fog = new THREE.FogExp2(0x02040a, 0.022);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.updateCameraFromSpherical();

    // Iluminación Táctica de Grado Quirúrgico
    const ambientLight = new THREE.AmbientLight(0x0a1224, 2.5);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.8);
    dirLight1.position.set(10, 15, 12);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff3355, 1.2);
    dirLight2.position.set(-12, -8, -10);
    this.scene.add(dirLight2);

    // Grupos principales
    this.flyConnectomeGroup = new THREE.Group();
    this.humanNeocortexGroup = new THREE.Group();
    this.consciousSwarmGroup = new THREE.Group();

    this.scene.add(this.flyConnectomeGroup);
    this.scene.add(this.humanNeocortexGroup);
    this.scene.add(this.consciousSwarmGroup);

    // Construcción procedural 3D de las 3 arquitecturas
    this.buildSubcorticalFlyConnectome3D();
    this.buildHumanNeocortex3D();
    this.buildConsciousSwarmHypergraph3D();

    this.setMode('SUBCORTICAL_MALE_CNS');
    this.setupTelemetrySubscriptions();
  }

  // ── 1. Construcción Drosophila MaleCNS v1.0 3D ──────────────────────────────
  private buildSubcorticalFlyConnectome3D(): void {
    const group = this.flyConnectomeGroup;
    group.name = 'Fly_MaleCNS_3D';

    // 1.1 Central Complex (CX) — Ellipsoid Body (EB) Torus Segmentado en 16 Cuñas
    const ebGroup = new THREE.Group();
    ebGroup.name = 'CentralComplex_EB';
    const wedgeCount = 16;
    const ebRadius = 3.2;
    const tubeRadius = 0.55;

    for (let i = 0; i < wedgeCount; i++) {
      const angle = (i / wedgeCount) * Math.PI * 2;
      const arcLen = (Math.PI * 2) / wedgeCount * 0.92;
      const wedgeGeo = new THREE.TorusGeometry(ebRadius, tubeRadius, 14, 12, arcLen);
      const wedgeMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.35,
        roughness: 0.25,
        metalness: 0.8,
        wireframe: false,
      });
      const wedgeMesh = new THREE.Mesh(wedgeGeo, wedgeMat);
      wedgeMesh.rotation.z = angle;
      wedgeMesh.userData = {
        id: `CX_EPG_${i}`,
        name: `E-PG Wedge ${i + 1} (Compass Ring Attractor)`,
        system: 'CENTRAL_COMPLEX_CX',
        details: `Cuña azimutal ${(i * 22.5).toFixed(1)}°-${((i + 1) * 22.5).toFixed(1)}°. Rumbo de navegación e integración de trayectoria.`,
      };
      ebGroup.add(wedgeMesh);
      this.epgWedgeMeshes.push(wedgeMesh);
      this.interactiveMeshes.push(wedgeMesh);
    }

    // Flecha indicadora de rumbo en el centro del EB
    const arrowConeGeo = new THREE.ConeGeometry(0.35, 1.2, 16);
    arrowConeGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.8,
    });
    const arrowMesh = new THREE.Mesh(arrowConeGeo, arrowMat);
    arrowMesh.name = 'CX_Heading_Vector_Arrow';
    ebGroup.add(arrowMesh);
    group.add(ebGroup);

    // 1.2 Protocerebral Bridge (PB) — Arco Horizontal Dorsal con 16 Glomérulos
    const pbGroup = new THREE.Group();
    pbGroup.position.set(0, 3.2, -0.6);
    for (let g = 0; g < 16; g++) {
      const x = -3.8 + g * (7.6 / 15);
      const y = -Math.pow((g - 7.5) / 7.5, 2) * 0.7;
      const glomerulusGeo = new THREE.SphereGeometry(0.24, 12, 12);
      const glomerulusMat = new THREE.MeshStandardMaterial({
        color: 0x76ff03,
        emissive: 0x76ff03,
        emissiveIntensity: 0.5,
      });
      const gMesh = new THREE.Mesh(glomerulusGeo, glomerulusMat);
      gMesh.position.set(x, y, 0);
      gMesh.userData = {
        id: `CX_PB_${g}`,
        name: `PB Glomerulus ${g + 1} (Protocerebral Bridge)`,
        system: 'CENTRAL_COMPLEX_CX',
        details: 'Centro de conmutación de velocidad angular y modulación sináptica colinérgica.',
      };
      pbGroup.add(gMesh);
      this.pbGlomeruliMeshes.push(gMesh);
      this.interactiveMeshes.push(gMesh);

      // Conexión fibrosa hacia el EB
      const linePts = [
        new THREE.Vector3(x, y + 3.2, -0.6),
        new THREE.Vector3(Math.cos((g / 16) * Math.PI * 2) * 2.8, Math.sin((g / 16) * Math.PI * 2) * 2.8, 0),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25 });
      group.add(new THREE.Line(lineGeo, lineMat));
    }
    group.add(pbGroup);

    // 1.3 Fan-Shaped Body (FB) — 16 Columnas y 9 Estratos Laminares (Matriz 3D)
    const fbGroup = new THREE.Group();
    fbGroup.name = 'FanShapedBody_Matrix';
    fbGroup.position.set(0, 0, 1.2);
    for (let c = 0; c < 16; c++) {
      const colAngle = (c / 16) * Math.PI * 2;
      const fx = Math.cos(colAngle) * 2.2;
      const fy = Math.sin(colAngle) * 2.2;
      for (let l = 0; l < 9; l += 2) {
        const fz = (l - 4) * 0.35;
        const colGeo = new THREE.BoxGeometry(0.25, 0.25, 0.15);
        const colMat = new THREE.MeshStandardMaterial({
          color: 0xffd600,
          emissive: 0xffb300,
          emissiveIntensity: 0.3,
          roughness: 0.3,
        });
        const colMesh = new THREE.Mesh(colGeo, colMat);
        colMesh.position.set(fx, fy, fz);
        colMesh.userData = {
          id: `FB_C${c}_L${l}`,
          name: `FB Col ${c + 1} Layer ${l + 1}`,
          system: 'FAN_SHAPED_BODY_FB',
          details: 'Cálculo de vector de viento, flujo óptico egocéntrico y memoria barométrica 3D.',
        };
        fbGroup.add(colMesh);
        this.fbLayerMeshes.push(colMesh);
        this.interactiveMeshes.push(colMesh);
      }
    }
    group.add(fbGroup);

    // 1.4 Mushroom Body (MB) — Bilateral Calyx, Pedunculus y Lóbulos Alfa/Beta/Gamma
    [-1, 1].forEach((side) => {
      const sideName = side === 1 ? 'Right' : 'Left';
      const mbSideGroup = new THREE.Group();
      mbSideGroup.position.set(side * 4.6, 1.5, 0.5);

      // Calyx (Células de Kenyon)
      const calyxGeo = new THREE.SphereGeometry(0.9, 16, 16);
      const calyxMat = new THREE.MeshStandardMaterial({
        color: 0xff5252,
        emissive: 0xff1744,
        emissiveIntensity: 0.45,
        roughness: 0.4,
      });
      const calyxMesh = new THREE.Mesh(calyxGeo, calyxMat);
      calyxMesh.userData = {
        id: `MB_CALYX_${sideName.toUpperCase()}`,
        name: `Mushroom Body Calyx (${sideName})`,
        system: 'MUSHROOM_BODY_MB',
        details: '2,000 células de Kenyon con plasticidad Hebbiana STDP y aprendizaje asociativo de olores/RF.',
      };
      mbSideGroup.add(calyxMesh);
      this.mbLobeMeshes.push(calyxMesh);
      this.interactiveMeshes.push(calyxMesh);

      // Pedunculus y Lóbulos
      const lobeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-side * 1.2, -1.2, 0.4),
        new THREE.Vector3(-side * 2.0, -2.4, 0.2),
        new THREE.Vector3(-side * 1.5, -3.2, 0.8),
      ]);
      const lobeGeo = new THREE.TubeGeometry(lobeCurve, 20, 0.28, 10, false);
      const lobeMat = new THREE.MeshStandardMaterial({
        color: 0xff4081,
        emissive: 0xf50057,
        emissiveIntensity: 0.4,
      });
      const lobeMesh = new THREE.Mesh(lobeGeo, lobeMat);
      lobeMesh.userData = {
        id: `MB_LOBES_${sideName.toUpperCase()}`,
        name: `Lóbulos MB α/β/γ (${sideName})`,
        system: 'MUSHROOM_BODY_MB',
        details: 'Circuitos de valencia dopaminérgica DAN y neuronas de salida MBON para escape/búsqueda.',
      };
      mbSideGroup.add(lobeMesh);
      this.mbLobeMeshes.push(lobeMesh);
      this.interactiveMeshes.push(lobeMesh);

      group.add(mbSideGroup);
    });

    // 1.5 Optic Lobes (OL) & Omatidios Hexagonales Bilaterales
    [-1, 1].forEach((side) => {
      const olGroup = new THREE.Group();
      olGroup.position.set(side * 6.5, 0, 0);

      // Cúpula omatidial
      const eyeGeo = new THREE.SphereGeometry(2.0, 16, 16, 0, Math.PI);
      eyeGeo.rotateY(side === 1 ? -Math.PI / 2 : Math.PI / 2);
      const eyeMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x0099ff,
        emissiveIntensity: 0.6,
        wireframe: true,
      });
      const eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);
      eyeMesh.userData = {
        id: `OPTIC_LOBE_${side === 1 ? 'R' : 'L'}`,
        name: `Lóbulo Óptico & Omatidios (${side === 1 ? 'Der' : 'Izq'})`,
        system: 'OPTIC_LOBE_SENSORY',
        details: 'Mosaico de 750 facetas fotorreceptoras (R1-R6), detección de movimiento elemental EMD.',
      };
      olGroup.add(eyeMesh);
      this.interactiveMeshes.push(eyeMesh);

      // Detector LC4 / LPLC2 Looming Somas
      const lc4Geo = new THREE.SphereGeometry(0.4, 12, 12);
      const lc4Mat = new THREE.MeshStandardMaterial({
        color: 0xff0055,
        emissive: 0xff0055,
        emissiveIntensity: 0.8,
      });
      const lc4Mesh = new THREE.Mesh(lc4Geo, lc4Mat);
      lc4Mesh.position.set(-side * 0.8, 0.4, 0.6);
      lc4Mesh.userData = {
        id: `LC4_LOOMING_${side === 1 ? 'R' : 'L'}`,
        name: `Neurona LC4 Detector de Looming (${side === 1 ? 'Der' : 'Izq'})`,
        system: 'GIANT_FIBER_GFS',
        details: 'Detección balística de sombras en expansión rápida (depredadores/hormigas).',
      };
      olGroup.add(lc4Mesh);
      this.lc4LoomingMeshes.push(lc4Mesh);
      this.interactiveMeshes.push(lc4Mesh);

      group.add(olGroup);
    });

    // 1.6 Giant Fiber System (GFS) — Axones Gigantes Descendentes hacia Tórax
    [-1, 1].forEach((side) => {
      const gfCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 1.5, 2.0, 0),
        new THREE.Vector3(side * 0.8, 0, -0.5),
        new THREE.Vector3(side * 0.4, -2.5, -1.0),
        new THREE.Vector3(side * 0.3, -5.0, -1.2), // Inserción en motoneurona TTMn
      ]);
      const gfGeo = new THREE.TubeGeometry(gfCurve, 24, 0.22, 10, false);
      const gfMat = new THREE.MeshStandardMaterial({
        color: 0xff3355,
        emissive: 0xff1744,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      });
      const gfMesh = new THREE.Mesh(gfGeo, gfMat);
      gfMesh.userData = {
        id: `GFS_AXON_${side === 1 ? 'R' : 'L'}`,
        name: `Axón Gigante Descendente GFS (${side === 1 ? 'Der' : 'Izq'})`,
        system: 'GIANT_FIBER_GFS',
        details: 'Transmisión monosináptica ultra-rápida (<4ms) hacia el músculo de salto torácico TTMn.',
      };
      group.add(gfMesh);
      this.gfsAxonTubes.push(gfMesh);
      this.interactiveMeshes.push(gfMesh);

      // Motoneurona TTMn en el tórax
      const ttmnGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
      const ttmnMat = new THREE.MeshStandardMaterial({
        color: 0xff9100,
        emissive: 0xff6d00,
        emissiveIntensity: 0.75,
      });
      const ttmnMesh = new THREE.Mesh(ttmnGeo, ttmnMat);
      ttmnMesh.position.set(side * 0.3, -5.0, -1.2);
      ttmnMesh.userData = {
        id: `TTMN_MOTOR_${side === 1 ? 'R' : 'L'}`,
        name: `Motoneurona de Salto TTMn (${side === 1 ? 'Der' : 'Izq'})`,
        system: 'GIANT_FIBER_GFS',
        details: 'Actuación directa sobre las patas mesotorácicas T2 para despegue inmediato.',
      };
      group.add(ttmnMesh);
      this.interactiveMeshes.push(ttmnMesh);
    });

    // 1.7 Johnston's Organ (Antenas Mecanosensoriales)
    [-1, 1].forEach((side) => {
      const joCiliaGeo = new THREE.CylinderGeometry(0.04, 0.08, 2.2, 8);
      joCiliaGeo.rotateZ(side * 0.45);
      const joMat = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.6,
      });
      const joMesh = new THREE.Mesh(joCiliaGeo, joMat);
      joMesh.position.set(side * 1.8, 4.6, 0.8);
      joMesh.userData = {
        id: `JOHNSTON_ORGAN_${side === 1 ? 'R' : 'L'}`,
        name: `Órgano de Johnston / Antena (${side === 1 ? 'Der' : 'Izq'})`,
        system: 'SENSORY_ACOUSTIC',
        details: 'Percepción de vibraciones acústicas, oscilaciones de viento y sonido ultrasónico de cortejo.',
      };
      group.add(joMesh);
      this.antennalCiliaMeshes.push(joMesh);
      this.interactiveMeshes.push(joMesh);
    });

    // 1.8 Generación de Pulsos Sinápticos Activos (AER Micro-Spikes en tiempo real)
    for (let p = 0; p < 24; p++) {
      const fromAngle = (p / 24) * Math.PI * 2;
      const toAngle = ((p + 3) / 24) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(fromAngle) * 3.2, Math.sin(fromAngle) * 3.2, 0),
        new THREE.Vector3(Math.cos((fromAngle + toAngle) / 2) * 1.5, Math.sin((fromAngle + toAngle) / 2) * 1.5, 0.8),
        new THREE.Vector3(Math.cos(toAngle) * 3.2, Math.sin(toAngle) * 3.2, 0),
      ]);

      const pulseGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      group.add(pulseMesh);
      this.synapticPulses.push({
        mesh: pulseMesh,
        path: curve,
        progress: Math.random(),
        speed: 0.008 + Math.random() * 0.012,
      });
    }
  }

  // ── 2. Construcción Neocorteza Humana 3D (7 Núcleos Cognitivos) ──────────────
  private buildHumanNeocortex3D(): void {
    const group = this.humanNeocortexGroup;
    group.name = 'Human_Neocortex_3D';

    // 2.1 Malla Base Hemisférica Anatómica Bilateral con Surcos
    [-1, 1].forEach((hemi) => {
      const hemiGeo = new THREE.SphereGeometry(4.2, 28, 24);
      hemiGeo.scale(0.85, 0.95, 1.35); // Proporción antero-posterior humana
      const hemiMat = new THREE.MeshStandardMaterial({
        color: 0x1a233a,
        roughness: 0.65,
        metalness: 0.2,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      });
      const hemiMesh = new THREE.Mesh(hemiGeo, hemiMat);
      hemiMesh.position.set(hemi * 1.9, 0, 0);
      group.add(hemiMesh);
    });

    // 2.2 Definición Volumétrica de los 7 Núcleos Neocorticales
    const nucleiConfigs = [
      {
        id: 'PFC',
        name: 'Corteza Prefrontal Dorsolateral (PFC)',
        system: 'NEOCORTEX_HUMAN',
        color: 0x00e5ff,
        pos: new THREE.Vector3(0, 1.8, 3.8),
        scale: new THREE.Vector3(2.4, 1.8, 1.8),
        details: 'Memoria de trabajo, toma de decisiones ejecutivas y planificación estratégica en red.',
      },
      {
        id: 'M1',
        name: 'Corteza Motora Primaria (M1)',
        system: 'NEOCORTEX_HUMAN',
        color: 0xff3355,
        pos: new THREE.Vector3(0, 3.4, 0.4),
        scale: new THREE.Vector3(3.2, 1.2, 1.2),
        details: 'Control motor fino, modulación de marcha y emisión de comandos cinemáticos.',
      },
      {
        id: 'S1',
        name: 'Corteza Somatosensorial (S1)',
        system: 'NEOCORTEX_HUMAN',
        color: 0xffb300,
        pos: new THREE.Vector3(0, 3.2, -0.9),
        scale: new THREE.Vector3(3.2, 1.1, 1.2),
        details: 'Integración háptica, propiocepción e información táctil de sensores inerciales.',
      },
      {
        id: 'AIC',
        name: 'Corteza Insular Anterior (AIC)',
        system: 'NEOCORTEX_HUMAN',
        color: 0xe040fb,
        pos: new THREE.Vector3(0, 0.2, 0.8),
        scale: new THREE.Vector3(2.0, 1.4, 1.4),
        details: 'Interocepción profunda, alerta de estrés cinético y balance alostático corporal.',
      },
      {
        id: 'HC',
        name: 'Hipocampo & Corteza Entorrinal (HC/MEC)',
        system: 'NEOCORTEX_HUMAN',
        color: 0x76ff03,
        pos: new THREE.Vector3(0, -1.8, -0.6),
        scale: new THREE.Vector3(2.6, 1.2, 2.0),
        details: 'Navegación espacial 3D, celdas de red hexagonales y consolidación de memoria episódica.',
      },
      {
        id: 'V1',
        name: 'Corteza Visual Primaria (V1)',
        system: 'NEOCORTEX_HUMAN',
        color: 0x38bdf8,
        pos: new THREE.Vector3(0, -0.6, -4.2),
        scale: new THREE.Vector3(2.4, 1.6, 1.4),
        details: 'Descodificación retinotópica, contraste de luminancia y flujo visual balístico.',
      },
      {
        id: 'OFC',
        name: 'Corteza Orbitofrontal (OFC)',
        system: 'NEOCORTEX_HUMAN',
        color: 0x14b8a6,
        pos: new THREE.Vector3(0, -1.6, 2.8),
        scale: new THREE.Vector3(2.2, 1.0, 1.6),
        details: 'Economía de trueque P2P, cálculo de valor de recursos y días de autarquía restante.',
      },
    ];

    for (const n of nucleiConfigs) {
      const geo = new THREE.DodecahedronGeometry(1.0, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: n.color,
        emissive: n.color,
        emissiveIntensity: 0.5,
        roughness: 0.25,
        metalness: 0.8,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(n.pos);
      mesh.scale.copy(n.scale);
      mesh.userData = {
        id: n.id,
        name: n.name,
        system: n.system,
        details: n.details,
      };
      group.add(mesh);
      this.humanLobeMeshes.set(n.id, mesh);
      this.interactiveMeshes.push(mesh);
    }

    // 2.3 Tractos Tálamo-Corticales (Vías Radiales 3D)
    const tractPoints: THREE.Vector3[] = [];
    const thalamusCenter = new THREE.Vector3(0, 0, 0);
    nucleiConfigs.forEach((n) => {
      tractPoints.push(thalamusCenter);
      tractPoints.push(n.pos);
    });
    const tractGeo = new THREE.BufferGeometry().setFromPoints(tractPoints);
    const tractMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
    });
    this.thalamocorticalTracts = new THREE.LineSegments(tractGeo, tractMat);
    group.add(this.thalamocorticalTracts);
  }

  // ── 3. Construcción Espacio de Trabajo Global GNWT (Hipergrafo 3D) ───────────
  private buildConsciousSwarmHypergraph3D(): void {
    const group = this.consciousSwarmGroup;
    group.name = 'ConsciousSwarm_GNWT_3D';

    // 3.1 Esfera de Ignición Volumétrica Atencional (Expansiva al Ignitar)
    const ignGeo = new THREE.SphereGeometry(1, 32, 32);
    const ignMat = new THREE.MeshBasicMaterial({
      color: 0xff3355,
      transparent: true,
      opacity: 0.0,
      wireframe: true,
    });
    this.gnwtIgnitionSphere = new THREE.Mesh(ignGeo, ignMat);
    this.gnwtIgnitionSphere.name = 'GNWT_Ignition_Wavefront';
    group.add(this.gnwtIgnitionSphere);

    // 3.2 Nodo Central: Subcórtex Drosophila
    const flyCoreGeo = new THREE.IcosahedronGeometry(1.2, 2);
    const flyCoreMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.7,
      metalness: 0.9,
    });
    const flyCoreMesh = new THREE.Mesh(flyCoreGeo, flyCoreMat);
    flyCoreMesh.position.set(0, 0, 0);
    flyCoreMesh.userData = {
      id: 'GNWT_CORE_FLY',
      name: 'Subcórtex FlyWire MaleCNS',
      system: 'CONSCIOUS_SWARM_BUS',
      details: 'Motor central bio-neuromórfico de 124,289 neuronas y bucles sensoriales de reflejo.',
    };
    group.add(flyCoreMesh);
    this.gnwtNodeMeshes.push(flyCoreMesh);
    this.interactiveMeshes.push(flyCoreMesh);

    // 3.3 Nodos Neocorticales Orbitantes
    const neocortexLabels = ['PFC', 'M1', 'S1', 'AIC', 'HC', 'V1', 'OFC'];
    const neoRadius = 4.8;
    for (let i = 0; i < neocortexLabels.length; i++) {
      const angle = (i / neocortexLabels.length) * Math.PI * 2;
      const x = Math.cos(angle) * neoRadius;
      const y = Math.sin(angle) * neoRadius * 0.7;
      const z = Math.sin(angle * 2) * 1.5;

      const nodeGeo = new THREE.DodecahedronGeometry(0.65, 1);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: 0x76ff03,
        emissive: 0x76ff03,
        emissiveIntensity: 0.6,
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.position.set(x, y, z);
      nodeMesh.userData = {
        id: `GNWT_HUB_${neocortexLabels[i]}`,
        name: `Hub Neocortical ${neocortexLabels[i]}`,
        system: 'CONSCIOUS_SWARM_BUS',
        details: 'Módulo cognitivo local compitiendo por acceso a la radiodifusión del espacio global.',
      };
      group.add(nodeMesh);
      this.gnwtNodeMeshes.push(nodeMesh);
      this.interactiveMeshes.push(nodeMesh);
    }

    // 3.4 Nodos de Enjambre P2P Externos (Constelación LoRa/BLE)
    const peerRadius = 8.5;
    for (let p = 0; p < 8; p++) {
      const angle = (p / 8) * Math.PI * 2 + 0.35;
      const px = Math.cos(angle) * peerRadius;
      const py = Math.sin(angle) * peerRadius * 0.5;
      const pz = Math.cos(angle * 3) * 2.2;

      const peerGeo = new THREE.OctahedronGeometry(0.5, 0);
      const peerMat = new THREE.MeshStandardMaterial({
        color: 0xe040fb,
        emissive: 0xd500f9,
        emissiveIntensity: 0.5,
      });
      const peerMesh = new THREE.Mesh(peerGeo, peerMat);
      peerMesh.position.set(px, py, pz);
      peerMesh.userData = {
        id: `PEER_NODE_${p}`,
        name: `Nodo de Enjambre Mesh #${100 + p}`,
        system: 'CONSCIOUS_SWARM_BUS',
        details: 'Compañero P2P en enlace LoRa TDMA contribuyendo a la coherencia de fase Kuramoto.',
      };
      group.add(peerMesh);
      this.gnwtNodeMeshes.push(peerMesh);
      this.interactiveMeshes.push(peerMesh);
    }

    // 3.5 Topología de Enlace (Aristas del Hipergrafo)
    const edgePoints: THREE.Vector3[] = [];
    for (let i = 1; i <= neocortexLabels.length; i++) {
      edgePoints.push(flyCoreMesh.position);
      edgePoints.push(this.gnwtNodeMeshes[i].position);

      const nextIdx = i === neocortexLabels.length ? 1 : i + 1;
      edgePoints.push(this.gnwtNodeMeshes[i].position);
      edgePoints.push(this.gnwtNodeMeshes[nextIdx].position);
    }
    // Conectar pares externos con el anillo neocortical
    for (let p = 0; p < 8; p++) {
      const pIdx = 1 + neocortexLabels.length + p;
      const nIdx = 1 + (p % neocortexLabels.length);
      edgePoints.push(this.gnwtNodeMeshes[pIdx].position);
      edgePoints.push(this.gnwtNodeMeshes[nIdx].position);
    }

    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
    });
    this.gnwtEdgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    group.add(this.gnwtEdgeLines);
  }

  // ── 4. Gestión de Modos y Transiciones de Cámara ────────────────────────────
  public setMode(mode: ConnectomeBrainArchitecture): void {
    this.currentMode = mode;

    this.flyConnectomeGroup.visible = mode === 'SUBCORTICAL_MALE_CNS';
    this.humanNeocortexGroup.visible = mode === 'HUMAN_NEOCORTEX';
    this.consciousSwarmGroup.visible = mode === 'CONSCIOUS_SWARM_BUS';

    if (mode === 'SUBCORTICAL_MALE_CNS') {
      this.spherical.radius = 14;
      this.spherical.phi = Math.PI / 2.6;
    } else if (mode === 'HUMAN_NEOCORTEX') {
      this.spherical.radius = 16;
      this.spherical.phi = Math.PI / 2.4;
    } else {
      this.spherical.radius = 20;
      this.spherical.phi = Math.PI / 3.0;
    }
    this.updateCameraFromSpherical();
  }

  public setAutoRotate(enabled: boolean): void {
    this.autoRotate = enabled;
  }

  public resetCamera(): void {
    this.spherical.theta = 0;
    this.setMode(this.currentMode);
  }

  public setOnSelect(cb: (hit: ConnectomeRaycastHit | null) => void): void {
    this.onSelectCallback = cb;
  }

  // ── 5. Suscripciones a los Motores Fisiológicos Reales ──────────────────────
  private setupTelemetrySubscriptions(): void {
    this.unsubs.push(ringAttractor.subscribe((t) => { this.cxTelemetry = t; }));
    this.unsubs.push(fanShapedBody.subscribe((t) => { this.fbTelemetry = t; }));
    this.unsubs.push(giantFiberReflex.subscribe((t) => { this.gfsTelemetry = t; }));
    this.unsubs.push(dtnMushroomBody.subscribe((t) => { this.mbTelemetry = t; }));
    this.unsubs.push(johnstonOrgan.subscribe((t) => { this.joTelemetry = t; }));
    this.unsubs.push(metabolicGovernor.subscribe((t) => { this.metTelemetry = t; }));
    this.unsubs.push(opticLobe.subscribe((t) => { this.opticTelemetry = t; }));
    this.unsubs.push(humanBrainOrchestrator.subscribe((t) => { this.humanSnapshot = t; }));
    this.unsubs.push(globalWorkspaceConsciousnessBus.subscribe((t) => { this.consciousnessTelemetry = t; }));
    this.unsubs.push(synapticMeshRouter.subscribe(() => {
      this.rfBearings = synapticMeshRouter.getAllActiveBearings();
    }));
  }

  // ── 6. Bucle de Renderizado y Física Biofísica con Cadencia Adaptativa ───────
  private startRenderLoop(): void {
    if (this.animFrameId !== null) return;
    const targetFps = this.gpuTier === 'low' ? 30 : this.gpuTier === 'mid' ? 45 : 60;
    const minFrameIntervalMs = 1000 / targetFps;
    let lastRenderTime = 0;

    const render = (now: number) => {
      this.animFrameId = requestAnimationFrame(render);

      const elapsedSinceRender = now - lastRenderTime;
      if (elapsedSinceRender < minFrameIntervalMs - 1.5) {
        return;
      }
      lastRenderTime = now;

      this.updateSimulationTick();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  private stopRenderLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private updateSimulationTick(): void {
    // Rotación automática si está activa y no hay interacción táctil
    if (this.autoRotate && !this.isPointerDown) {
      this.spherical.theta += 0.005;
      this.updateCameraFromSpherical();
    }

    // ── 6.1 Actualización Drosophila MaleCNS ──
    if (this.currentMode === 'SUBCORTICAL_MALE_CNS') {
      // Orientación del vector de brújula en el centro del EB
      const headingRad = (((this.cxTelemetry.headingDeg ?? 0) * Math.PI) / 180);
      const arrow = this.flyConnectomeGroup.getObjectByName('CX_Heading_Vector_Arrow');
      if (arrow) {
        arrow.rotation.z = headingRad;
      }

      // Iluminación activa de la cuña E-PG correspondiente al rumbo actual
      const activeWedgeIdx = Math.floor((((headingRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / 16));
      this.epgWedgeMeshes.forEach((mesh, idx) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const isActive = idx === activeWedgeIdx;
        mat.emissiveIntensity = isActive ? 0.95 : 0.25;
        mat.color.setHex(isActive ? 0x00ff88 : 0x00f0ff);
      });

      // Fan-Shaped Body modulación por capas
      const matrix = this.fbTelemetry.columnLayerMatrix;
      this.fbLayerMeshes.forEach((mesh, idx) => {
        const act = matrix?.[idx] ?? 0.3;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.2 + act * 0.8;
      });

      // Vibración de aristas antenales (Johnston's Organ)
      const windEnergy = this.joTelemetry.acousticEnergyLevel ?? 0.1;
      this.antennalCiliaMeshes.forEach((cilia, idx) => {
        const sign = idx === 0 ? -1 : 1;
        cilia.rotation.z = sign * (0.45 + Math.sin(Date.now() * 0.015) * 0.12 * (1 + windEnergy * 2));
      });

      // Detectores de colisión LC4 Looming
      const loomingActive = this.gfsTelemetry.isReflexActive || (this.opticTelemetry.loomingThreat?.isThreatDetected ?? false);
      this.lc4LoomingMeshes.forEach((lc4) => {
        const mat = lc4.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = loomingActive ? 1.0 : 0.35;
        lc4.scale.setScalar(loomingActive ? 1.35 : 1.0);
      });

      // Movimiento de pulsos sinápticos activos
      this.synapticPulses.forEach((pulse) => {
        pulse.progress = (pulse.progress + pulse.speed) % 1.0;
        const pt = pulse.path.getPoint(pulse.progress);
        pulse.mesh.position.copy(pt);
      });
    }

    // ── 6.2 Actualización Neocorteza Humana ──
    if (this.currentMode === 'HUMAN_NEOCORTEX') {
      const now = Date.now() * 0.003;
      this.humanLobeMeshes.forEach((mesh, lobeId) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        let act = 0.5;
        if (lobeId === 'PFC') act = (this.humanSnapshot.workingMemory?.overallProgressPct ?? 50) / 100;
        else if (lobeId === 'M1') act = 1.0 - (this.humanSnapshot.predictive?.currentFreeEnergy ?? 0.2);
        else if (lobeId === 'S1') act = this.humanSnapshot.insular?.criticalTourniquetWarning ? 0.95 : 0.4;
        else if (lobeId === 'AIC') act = this.humanSnapshot.insular?.isBoxBreathingActive ? 0.85 : 0.35;
        else if (lobeId === 'HC') act = (this.humanSnapshot.hippocampal?.totalStoredEngrams ?? 0) > 0 ? 0.75 : 0.3;
        else if (lobeId === 'V1') act = this.humanSnapshot.entorhinal?.compositeGridActivity ?? 0.5;
        else if (lobeId === 'OFC') act = (this.humanSnapshot.orbitofrontal?.autarkyDaysRemaining ?? 0) > 0 ? 0.7 : 0.3;

        const pulse = Math.sin(now + mesh.position.x) * 0.15;
        mat.emissiveIntensity = Math.min(1.0, 0.3 + act * 0.6 + pulse);
      });
    }

    // ── 6.3 Actualización Espacio de Trabajo Global GNWT ──
    if (this.currentMode === 'CONSCIOUS_SWARM_BUS') {
      if (this.gnwtIgnitionSphere) {
        const isIgnited = this.consciousnessTelemetry.isIgnited;
        if (isIgnited) {
          this.ignitionScale += 0.28;
          if (this.ignitionScale > 10.0) this.ignitionScale = 0;
          this.gnwtIgnitionSphere.scale.setScalar(this.ignitionScale);
          const mat = this.gnwtIgnitionSphere.material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(0, 0.85 - this.ignitionScale / 10.0);
        } else {
          this.ignitionScale = 0;
          (this.gnwtIgnitionSphere.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      }
    }
  }

  // ── 7. Manejadores de Eventos del DOM & Raycasting Táctil ────────────────────
  private bindDomListeners(container: HTMLElement): void {
    const onDown = (e: MouseEvent | TouchEvent) => {
      this.isPointerDown = true;
      this.isDragging = false;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      this.prevPointerX = clientX;
      this.prevPointerY = clientY;
      this.pointerStartX = clientX;
      this.pointerStartY = clientY;

      if ('touches' in e && e.touches.length === 2) {
        this.isDragging = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.pinchStartDist = Math.hypot(dx, dy);
      }
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!this.isPointerDown) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const dragDist = Math.hypot(clientX - this.pointerStartX, clientY - this.pointerStartY);
      if (dragDist > 6) {
        this.isDragging = true;
      }

      if ('touches' in e && e.touches.length === 2) {
        this.isDragging = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = this.pinchStartDist / dist;
        this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius * factor, 5, 45);
        this.pinchStartDist = dist;
        this.updateCameraFromSpherical();
      } else {
        const deltaX = clientX - this.prevPointerX;
        const deltaY = clientY - this.prevPointerY;
        this.spherical.theta -= deltaX * 0.008;
        this.spherical.phi = THREE.MathUtils.clamp(
          this.spherical.phi - deltaY * 0.008,
          0.15,
          Math.PI - 0.15
        );
        this.updateCameraFromSpherical();
      }
      this.prevPointerX = clientX;
      this.prevPointerY = clientY;
    };

    const onUp = (e: MouseEvent | TouchEvent) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;
      if (!this.isDragging) {
        this.checkRaycastClick(e);
      }
      this.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.015;
      this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius + zoomDelta, 5, 45);
      this.updateCameraFromSpherical();
    };

    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: false });

    (container as any)._cleanupListeners = () => {
      container.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      container.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      container.removeEventListener('wheel', onWheel);
    };
  }

  private checkRaycastClick(e: MouseEvent | TouchEvent): void {
    if (!this.container || !this.onSelectCallback) return;
    const rect = this.container.getBoundingClientRect();
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;

    // Descartar clics fuera de los límites físicos del canvas 3D
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return;
    }

    this.mouseVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveMeshes, false);

    if (intersects.length > 0) {
      const hitObj = intersects[0].object as THREE.Mesh;
      const data = hitObj.userData;
      if (data && data.id) {
        this.onSelectCallback({
          id: data.id,
          name: data.name || data.id,
          system: data.system || 'NEURAL_CIRCUIT',
          activity: 0.85,
          details: data.details || '',
          position: { x: hitObj.position.x, y: hitObj.position.y, z: hitObj.position.z },
        });
        return;
      }
    }
    this.onSelectCallback(null);
  }

  private updateCameraFromSpherical(): void {
    const { radius, phi, theta } = this.spherical;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.currentCameraLookAt);
  }

  // ── 8. Acople al Ciclo de Vida del DOM ───────────────────────────────────────
  public attach(container: HTMLElement): void {
    if (this.container === container && this.renderer) return;
    this.detach();

    this.container = container;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.gpuTier !== 'low',
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    // DPR tier-aware: low → 1.0 (PowerVR GE8320), mid → 1.25, high → 1.75
    const maxDpr = this.gpuTier === 'low' ? 1.0 : this.gpuTier === 'mid' ? 1.25 : 1.75;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    container.appendChild(this.renderer.domElement);

    // Resiliencia WebGL ante cambio de contexto en SO / app
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored, false);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0 && this.renderer) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
            // Re-clampear DPR tras rotación de pantalla
            const maxDprR = this.gpuTier === 'low' ? 1.0 : this.gpuTier === 'mid' ? 1.25 : 1.75;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDprR));
          }
        }
      });
      this.resizeObserver.observe(container);
    }

    this.bindDomListeners(container);
    this.startRenderLoop();
  }

  public detach(): void {
    this.stopRenderLoop();

    if (this.container && (this.container as any)._cleanupListeners) {
      (this.container as any)._cleanupListeners();
      delete (this.container as any)._cleanupListeners;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
      this.renderer = null;
    }
    this.container = null;
  }

  public dispose(): void {
    this.detach();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];

    // Limpieza universal de geometrías y materiales (Mesh, Line, LineSegments, Points)
    this.scene.traverse((obj) => {
      const anyObj = obj as any;
      if (anyObj.geometry) {
        anyObj.geometry.dispose();
      }
      if (anyObj.material) {
        if (Array.isArray(anyObj.material)) {
          anyObj.material.forEach((mat: THREE.Material) => mat.dispose());
        } else {
          anyObj.material.dispose();
        }
      }
    });
  }
}
