/**
 * HexapodBody3D.ts — RED Sovereign Mesh OS
 * 
 * Modelo Biomecánico Procedural 3D de Drosophila melanogaster (NeuroMechFly / FlyGym).
 * Articula 6 patas con cinemática 3-DOF real (Coxa, Fémur, Tibia) alimentada por
 * el CentralPatternGeneratorEngine, ojos compuestos adaptativos (OpticLobeEngine),
 * antenas mecanosensoriales (JohnstonOrganEngine) y reflejo monosináptico de escape
 * (GiantFiberReflexEngine).
 */

import * as THREE from 'three';
import { CpgLocomotionTelemetry, LegIdentifier } from '../CentralPatternGeneratorEngine';

interface LegJoints3D {
  coxaPivot: THREE.Group;
  femurPivot: THREE.Group;
  tibiaPivot: THREE.Group;
  tarsusTip: THREE.Mesh;
  coxaMesh: THREE.Mesh;
  femurMesh: THREE.Mesh;
  tibiaMesh: THREE.Mesh;
}

export class HexapodBody3D {
  public readonly rootGroup: THREE.Group;
  private readonly bodyGroup: THREE.Group;
  private readonly headMesh: THREE.Mesh;
  private readonly leftEyeMesh: THREE.Mesh;
  private readonly rightEyeMesh: THREE.Mesh;
  private readonly eyeMaterial: THREE.MeshStandardMaterial;
  private readonly thoraxMesh: THREE.Mesh;
  private readonly abdomenMesh: THREE.Mesh;
  private readonly leftAntenna: THREE.Group;
  private readonly rightAntenna: THREE.Group;
  private readonly leftWing: THREE.Mesh;
  private readonly rightWing: THREE.Mesh;
  private readonly metabolicCore: THREE.PointLight;

  private legs: Map<LegIdentifier, LegJoints3D> = new Map();

  // Dinámica de salto del reflejo de fibra gigante
  private jumpVelocityY = 0;
  private jumpOffsetY = 0;
  private isJumping = false;

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'Drosophila_Hexapod_Root';

    this.bodyGroup = new THREE.Group();
    this.rootGroup.add(this.bodyGroup);

    // ── 1. Paleta de Materiales Tácticos Soberanos ───────────────────────────
    const chitinMaterial = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.35,
      metalness: 0.65,
      wireframe: false,
    });

    const carapaceGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0x222a38,
      roughness: 0.25,
      metalness: 0.8,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.15,
    });

    this.eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.9,
    });

    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // ── 2. Anatomía del Tagma Central (Tórax) ────────────────────────────────
    // El tórax es el centro de gravedad (T1, T2, T3) donde articulan las 6 patas
    const thoraxGeo = new THREE.BoxGeometry(0.7, 0.45, 1.1);
    this.thoraxMesh = new THREE.Mesh(thoraxGeo, carapaceGlowMaterial);
    this.thoraxMesh.castShadow = true;
    this.bodyGroup.add(this.thoraxMesh);

    // Luz metabólica en el núcleo del tórax (pulsada por el gobernador de torpor)
    this.metabolicCore = new THREE.PointLight(0x00f0ff, 0.8, 2.5);
    this.metabolicCore.position.set(0, 0, 0);
    this.bodyGroup.add(this.metabolicCore);

    // ── 3. Cabeza & Ojos Compuestos (Lóbulos Ópticos) ────────────────────────
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.1, 0.75);

    const headGeo = new THREE.DodecahedronGeometry(0.32, 1);
    this.headMesh = new THREE.Mesh(headGeo, chitinMaterial);
    this.headMesh.castShadow = true;
    headGroup.add(this.headMesh);

    // Ojo Compuesto Izquierdo
    const eyeGeo = new THREE.SphereGeometry(0.16, 12, 12);
    this.leftEyeMesh = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    this.leftEyeMesh.position.set(-0.24, 0.08, 0.08);
    this.leftEyeMesh.scale.set(0.9, 1.2, 1.1);
    headGroup.add(this.leftEyeMesh);

    // Ojo Compuesto Derecho
    this.rightEyeMesh = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    this.rightEyeMesh.position.set(0.24, 0.08, 0.08);
    this.rightEyeMesh.scale.set(0.9, 1.2, 1.1);
    headGroup.add(this.rightEyeMesh);

    // Antenas con Órgano de Johnston (mecanosensores de viento)
    this.leftAntenna = this.createAntenna();
    this.leftAntenna.position.set(-0.1, 0.15, 0.28);
    headGroup.add(this.leftAntenna);

    this.rightAntenna = this.createAntenna();
    this.rightAntenna.position.set(0.1, 0.15, 0.28);
    headGroup.add(this.rightAntenna);

    this.bodyGroup.add(headGroup);

    // ── 4. Abdomen Segmentado ────────────────────────────────────────────────
    const abdomenGroup = new THREE.Group();
    abdomenGroup.position.set(0, -0.05, -0.9);

    const abdomenGeo = new THREE.ConeGeometry(0.42, 1.3, 10);
    abdomenGeo.rotateX(-Math.PI / 2);
    this.abdomenMesh = new THREE.Mesh(abdomenGeo, chitinMaterial);
    this.abdomenMesh.castShadow = true;
    abdomenGroup.add(this.abdomenMesh);

    this.bodyGroup.add(abdomenGroup);

    // ── 5. Alas Plegadas con Resonancia Acústica ──────────────────────────────
    const wingGeo = new THREE.PlaneGeometry(0.45, 1.4);
    wingGeo.translate(0, 0, -0.7);

    this.leftWing = new THREE.Mesh(wingGeo, wingMaterial);
    this.leftWing.position.set(-0.15, 0.26, 0.1);
    this.leftWing.rotation.x = -0.15;
    this.leftWing.rotation.y = 0.12;
    this.leftWing.rotation.z = -0.05;
    this.bodyGroup.add(this.leftWing);

    this.rightWing = new THREE.Mesh(wingGeo, wingMaterial);
    this.rightWing.position.set(0.15, 0.26, 0.1);
    this.rightWing.rotation.x = -0.15;
    this.rightWing.rotation.y = -0.12;
    this.rightWing.rotation.z = 0.05;
    this.bodyGroup.add(this.rightWing);

    // ── 6. Articulación Cinemática 3-DOF para las 6 Patas ─────────────────────
    // Configuración morfológica real de NeuroMechFly v2:
    // LF (T1-L), LM (T2-L), LH (T3-L), RF (T1-R), RM (T2-R), RH (T3-R)
    const legConfigs: Array<{
      id: LegIdentifier;
      x: number;
      y: number;
      z: number;
      isLeft: boolean;
      baseAngleY: number;
    }> = [
      { id: 'LF', x: -0.35, y: -0.1, z: 0.35, isLeft: true, baseAngleY: Math.PI / 4 },
      { id: 'LM', x: -0.38, y: -0.1, z: 0.0, isLeft: true, baseAngleY: 0 },
      { id: 'LH', x: -0.35, y: -0.1, z: -0.35, isLeft: true, baseAngleY: -Math.PI / 4 },
      { id: 'RF', x: 0.35, y: -0.1, z: 0.35, isLeft: false, baseAngleY: -Math.PI / 4 },
      { id: 'RM', x: 0.38, y: -0.1, z: 0.0, isLeft: false, baseAngleY: 0 },
      { id: 'RH', x: 0.35, y: -0.1, z: -0.35, isLeft: false, baseAngleY: Math.PI / 4 },
    ];

    legConfigs.forEach((cfg) => {
      const leg = this.createArticulatedLeg(cfg.isLeft, chitinMaterial);
      leg.coxaPivot.position.set(cfg.x, cfg.y, cfg.z);
      leg.coxaPivot.rotation.y = cfg.baseAngleY;
      this.bodyGroup.add(leg.coxaPivot);
      this.legs.set(cfg.id, leg);
    });

    // Altura base sobre el suelo (para que los tarsos toquen el plano Y=0)
    this.bodyGroup.position.y = 0.55;
  }

  private createAntenna(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, roughness: 0.4 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.25, 6), mat);
    stem.position.y = 0.12;
    stem.rotation.x = Math.PI / 3;
    group.add(stem);

    const arista = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 5), mat);
    arista.position.set(0, 0.24, 0.12);
    arista.rotation.x = Math.PI / 2.5;
    group.add(arista);
    return group;
  }

  private createArticulatedLeg(isLeft: boolean, mat: THREE.Material): LegJoints3D {
    const sign = isLeft ? -1 : 1;

    // Pivote 1: Coxa (Yaw en eje Y)
    const coxaPivot = new THREE.Group();
    coxaPivot.name = 'Coxa_Pivot';

    const coxaGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.28, 7);
    coxaGeo.rotateZ((sign * Math.PI) / 3);
    const coxaMesh = new THREE.Mesh(coxaGeo, mat);
    coxaMesh.position.set(sign * 0.12, 0, 0);
    coxaMesh.castShadow = true;
    coxaPivot.add(coxaMesh);

    // Pivote 2: Fémur (Pitch en eje Z)
    const femurPivot = new THREE.Group();
    femurPivot.name = 'Femur_Pivot';
    femurPivot.position.set(sign * 0.24, 0, 0);
    coxaPivot.add(femurPivot);

    const femurGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.55, 7);
    femurGeo.rotateZ((sign * Math.PI) / 4);
    const femurMesh = new THREE.Mesh(femurGeo, mat);
    femurMesh.position.set(sign * 0.22, 0.12, 0);
    femurMesh.castShadow = true;
    femurPivot.add(femurMesh);

    // Pivote 3: Tibia (Pitch en eje Z)
    const tibiaPivot = new THREE.Group();
    tibiaPivot.name = 'Tibia_Pivot';
    tibiaPivot.position.set(sign * 0.44, 0.24, 0);
    femurPivot.add(tibiaPivot);

    const tibiaGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.7, 7);
    tibiaGeo.rotateZ((sign * -Math.PI) / 3.5);
    const tibiaMesh = new THREE.Mesh(tibiaGeo, mat);
    tibiaMesh.position.set(sign * 0.2, -0.3, 0);
    tibiaMesh.castShadow = true;
    tibiaPivot.add(tibiaMesh);

    // Extremo Tarsal (Contacto con el suelo)
    const tarsusGeo = new THREE.SphereGeometry(0.045, 6, 6);
    const tarsusMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const tarsusTip = new THREE.Mesh(tarsusGeo, tarsusMat);
    tarsusTip.position.set(sign * 0.38, -0.62, 0);
    tibiaPivot.add(tarsusTip);

    return {
      coxaPivot,
      femurPivot,
      tibiaPivot,
      tarsusTip,
      coxaMesh,
      femurMesh,
      tibiaMesh,
    };
  }

  /**
   * Actualiza la cinemática de las 6 patas y la respuesta sensorial de la mosca en cada frame
   */
  public update(
    deltaSec: number,
    cpgTelemetry: CpgLocomotionTelemetry,
    headingDeg: number,
    isThreatLooming = false,
    isReflexJumping = false,
    windIntensity = 0.5
  ): void {
    // 1. Orientación azimuthal en el plano X-Z
    const targetRotY = (-headingDeg * Math.PI) / 180;
    this.rootGroup.rotation.y = THREE.MathUtils.lerp(
      this.rootGroup.rotation.y,
      targetRotY,
      Math.min(1.0, deltaSec * 8.0)
    );

    // 2. Respuesta cromática de los Ojos Compuestos (OpticLobeEngine)
    if (isThreatLooming) {
      this.eyeMaterial.color.setHex(0xff3355);
      this.eyeMaterial.emissive.setHex(0xff0033);
      this.eyeMaterial.emissiveIntensity = 1.4;
    } else {
      this.eyeMaterial.color.setHex(0x00f0ff);
      this.eyeMaterial.emissive.setHex(0x00e5ff);
      this.eyeMaterial.emissiveIntensity = 0.8;
    }

    // 3. Mecanorrecepción de Antenas (JohnstonOrganEngine)
    const windFlutter = Math.sin(Date.now() * 0.012) * 0.15 * windIntensity;
    this.leftAntenna.rotation.z = windFlutter;
    this.rightAntenna.rotation.z = -windFlutter;

    // 4. Salto de Escape de la Fibra Gigante (GiantFiberReflexEngine)
    if (isReflexJumping && !this.isJumping) {
      this.isJumping = true;
      this.jumpVelocityY = 6.5; // Impulso vertical m/s
    }

    if (this.isJumping) {
      this.jumpOffsetY += this.jumpVelocityY * deltaSec;
      this.jumpVelocityY -= 19.6 * deltaSec; // Gravedad 2G de escape

      // Desplegar alas en el aire
      this.leftWing.rotation.z = -0.7;
      this.rightWing.rotation.z = 0.7;

      if (this.jumpOffsetY <= 0) {
        this.jumpOffsetY = 0;
        this.isJumping = false;
        this.jumpVelocityY = 0;
        this.leftWing.rotation.z = -0.05;
        this.rightWing.rotation.z = 0.05;
      }
    } else {
      // Leve aleteo durante marcha activa
      if (cpgTelemetry.gaitMode !== 'QUIESCENT') {
        const wingBuzz = Math.sin(Date.now() * 0.04) * 0.08;
        this.leftWing.rotation.x = -0.15 + wingBuzz;
        this.rightWing.rotation.x = -0.15 + wingBuzz;
      }
    }

    this.bodyGroup.position.y = 0.55 + this.jumpOffsetY;

    // 5. Aplicación Cinemática de Ángulos Articulares 3-DOF por Pata
    for (const [legId, legJoints] of this.legs.entries()) {
      const legState = cpgTelemetry.legs[legId as LegIdentifier];
      if (!legState) continue;

      const { joints, isGroundContact, elevatorReflexActive } = legState;
      const isLeft = legId.startsWith('L');
      const sign = isLeft ? 1 : -1;

      // Rotación Coxa (Yaw en grados a radianes)
      const coxaRad = (joints.coxaDeg * Math.PI) / 180;
      legJoints.coxaPivot.rotation.z = coxaRad * sign;

      // Rotación Fémur (Pitch en grados a radianes + reflejo elevador)
      const elevatorBonus = elevatorReflexActive ? 0.35 : 0.0;
      const femurRad = ((joints.femurDeg + (isLeft ? 0 : 0)) * Math.PI) / 180;
      legJoints.femurPivot.rotation.y = (femurRad + elevatorBonus) * sign;

      // Rotación Tibia (Extensión/Flexión en grados a radianes)
      const tibiaRad = (joints.tibiaDeg * Math.PI) / 180;
      legJoints.tibiaPivot.rotation.y = -tibiaRad * sign;

      // Color del tarso: se ilumina al tocar el suelo
      const tarsusMat = legJoints.tarsusTip.material as THREE.MeshBasicMaterial;
      if (isGroundContact) {
        tarsusMat.color.setHex(0x00ff88);
      } else {
        tarsusMat.color.setHex(0x00e5ff);
      }
    }

    // 6. Pulso de núcleo metabólico (Gobernador de torpor)
    const pulseSpeed = cpgTelemetry.gaitMode === 'ESCAPE_SPRINT' ? 0.015 : 0.005;
    this.metabolicCore.intensity = 0.7 + Math.sin(Date.now() * pulseSpeed) * 0.3;
  }

  public getFlatJointAngles(cpgTelemetry: CpgLocomotionTelemetry): number[] {
    const legOrder: LegIdentifier[] = ['LF', 'LM', 'LH', 'RF', 'RM', 'RH'];
    const angles: number[] = [];
    for (const legId of legOrder) {
      const leg = cpgTelemetry.legs[legId];
      if (leg) {
        angles.push(leg.joints.coxaDeg, leg.joints.femurDeg, leg.joints.tibiaDeg);
      } else {
        angles.push(90, 90, 90);
      }
    }
    return angles;
  }

  public dispose(): void {
    this.rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
  }
}
