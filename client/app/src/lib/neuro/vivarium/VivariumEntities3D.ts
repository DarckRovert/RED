/**
 * VivariumEntities3D.ts — RED Sovereign Mesh OS
 * 
 * Entidades Tridimensionales de Inteligencia Artificial y Radiofrecuencia del Vivarium:
 * 1. Centinela Guardian IA: Orbe perimétrico de intercepción y fuego defensivo.
 * 2. Torres de Radio LoRa TDMA: Balizas periféricas sincronizadas en supertrama de 10 slots.
 * 3. Satélite Orbital LEO: Gateway espacial con cono de cobertura Geohash-4.
 * 4. Reactor Mnemónico RAG / Hipocampo: Constelación asociativa de embeddings vectoriales.
 */

import * as THREE from 'three';

export class VivariumEntities3D {
  public readonly rootGroup: THREE.Group;

  // Guardian Sentinel
  public readonly guardianGroup: THREE.Group;
  private readonly guardianCore: THREE.Mesh;
  private readonly guardianRing: THREE.Mesh;
  private readonly guardianShield: THREE.Mesh;
  private readonly guardianLight: THREE.PointLight;
  private readonly defenseBeam: THREE.Line;
  private defenseBeamTimeout: ReturnType<typeof setTimeout> | null = null;

  // LoRa TDMA Towers
  private towers: Array<{
    group: THREE.Group;
    slotId: number;
    light: THREE.PointLight;
    beaconMesh: THREE.Mesh;
  }> = [];

  // LEO Satellite
  private readonly satGroup: THREE.Group;
  private readonly satCone: THREE.Mesh;
  private satAngle = 0;

  // Mnemonic Reactor (RAG Vectorial & Hipocampo CA3)
  private readonly reactorGroup: THREE.Group;
  private readonly particlePoints: THREE.Points;

  constructor(arenaRadius: number) {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'Vivarium_Entities_Root';

    // ── 1. Centinela Guardian IA ─────────────────────────────────────────────
    this.guardianGroup = new THREE.Group();
    this.guardianGroup.position.set(0, 4.5, 0);

    const coreGeo = new THREE.IcosahedronGeometry(0.55, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.9,
      wireframe: true,
    });
    this.guardianCore = new THREE.Mesh(coreGeo, coreMat);
    this.guardianGroup.add(this.guardianCore);

    const ringGeo = new THREE.TorusGeometry(0.9, 0.04, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.guardianRing = new THREE.Mesh(ringGeo, ringMat);
    this.guardianRing.rotation.x = Math.PI / 3;
    this.guardianGroup.add(this.guardianRing);

    // Cúpula / Escudo de plasma
    const shieldGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
    });
    this.guardianShield = new THREE.Mesh(shieldGeo, shieldMat);
    this.guardianGroup.add(this.guardianShield);

    this.guardianLight = new THREE.PointLight(0x00e5ff, 1.8, 8);
    this.guardianGroup.add(this.guardianLight);

    // Haz de intercepción cinética / rayo defensivo
    const beamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -3, 0),
    ]);
    const beamMat = new THREE.LineBasicMaterial({
      color: 0xff3355,
      transparent: true,
      opacity: 0,
      linewidth: 3,
    });
    this.defenseBeam = new THREE.Line(beamGeo, beamMat);
    this.guardianGroup.add(this.defenseBeam);

    this.rootGroup.add(this.guardianGroup);

    // ── 2. Torres de Radio LoRa TDMA Periféricas ─────────────────────────────
    const towerSlots = [0, 2, 4, 8]; // Slots representativos (Fijos y Baliza Kuramoto)
    const towerDist = arenaRadius - 1.5;

    towerSlots.forEach((slot, idx) => {
      const angle = (idx * 2 * Math.PI) / towerSlots.length + Math.PI / 4;
      const x = towerDist * Math.cos(angle);
      const z = towerDist * Math.sin(angle);

      const tGroup = new THREE.Group();
      tGroup.position.set(x, 0, z);

      // Mástil de la torre
      const mastGeo = new THREE.CylinderGeometry(0.12, 0.28, 3.8, 6);
      const mastMat = new THREE.MeshStandardMaterial({
        color: 0x1f293d,
        metalness: 0.8,
        roughness: 0.3,
      });
      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.y = 1.9;
      tGroup.add(mast);

      // Baliza de emisión
      const beaconGeo = new THREE.OctahedronGeometry(0.25, 0);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.y = 3.9;
      tGroup.add(beaconMesh);

      const light = new THREE.PointLight(0x00e5ff, 0.4, 4);
      light.position.y = 4.0;
      tGroup.add(light);

      this.rootGroup.add(tGroup);
      this.towers.push({ group: tGroup, slotId: slot, light, beaconMesh });
    });

    // ── 3. Satélite Orbital LEO & Huella Geohash-4 ───────────────────────────
    this.satGroup = new THREE.Group();
    this.satGroup.position.set(0, 11, 0);

    const satBodyGeo = new THREE.BoxGeometry(0.6, 0.4, 0.4);
    const satBodyMat = new THREE.MeshStandardMaterial({ color: 0xe0e6ed, metalness: 0.9 });
    const satBody = new THREE.Mesh(satBodyGeo, satBodyMat);
    this.satGroup.add(satBody);

    // Paneles solares del satélite
    const panelGeo = new THREE.BoxGeometry(1.6, 0.02, 0.5);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0055ff, roughness: 0.2 });
    const panels = new THREE.Mesh(panelGeo, panelMat);
    this.satGroup.add(panels);

    // Cono de cobertura Geohash-4 (Downlink Footprint)
    const coneGeo = new THREE.ConeGeometry(5.5, 11, 24, 1, true);
    coneGeo.rotateX(Math.PI);
    coneGeo.translate(0, -5.5, 0);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.satCone = new THREE.Mesh(coneGeo, coneMat);
    this.satGroup.add(this.satCone);

    this.rootGroup.add(this.satGroup);

    // ── 4. Reactor Mnemónico RAG (Vector Knowledge & Hipocampo CA3) ──────────
    this.reactorGroup = new THREE.Group();
    this.reactorGroup.position.set(-arenaRadius * 0.65, 3.2, -arenaRadius * 0.65);

    const particleCount = 180;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.1 * Math.cbrt(Math.random());
      const sinPhi = Math.sin(phi);

      particlePositions[i * 3] = r * sinPhi * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * sinPhi * Math.sin(theta);
      particlePositions[i * 3 + 2] = r * Math.cos(phi);
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffb300,
      size: 0.09,
      transparent: true,
      opacity: 0.75,
    });
    this.particlePoints = new THREE.Points(particleGeo, particleMat);
    this.reactorGroup.add(this.particlePoints);

    const reactorLight = new THREE.PointLight(0xffb300, 0.8, 5);
    this.reactorGroup.add(reactorLight);

    this.rootGroup.add(this.reactorGroup);
  }

  /**
   * Actualiza las órbitas, rotaciones del centinela y estados TDMA
   */
  public update(deltaSec: number, currentTdmaSlot = 0, isThreatDetected = false): void {
    // 1. Animación del Centinela Guardian
    this.guardianCore.rotation.y += deltaSec * 0.8;
    this.guardianCore.rotation.x += deltaSec * 0.4;
    this.guardianRing.rotation.z += deltaSec * 1.2;
    this.guardianGroup.position.y = 4.5 + Math.sin(Date.now() * 0.002) * 0.3;

    if (isThreatDetected) {
      (this.guardianCore.material as THREE.MeshStandardMaterial).color.setHex(0xff1144);
      (this.guardianCore.material as THREE.MeshStandardMaterial).emissive.setHex(0xff0033);
      this.guardianLight.color.setHex(0xff0033);
    } else {
      (this.guardianCore.material as THREE.MeshStandardMaterial).color.setHex(0x00f0ff);
      (this.guardianCore.material as THREE.MeshStandardMaterial).emissive.setHex(0x00e5ff);
      this.guardianLight.color.setHex(0x00e5ff);
    }

    // 2. Órbita del Satélite LEO
    this.satAngle += deltaSec * 0.15;
    const satDist = 12;
    this.satGroup.position.x = satDist * Math.cos(this.satAngle);
    this.satGroup.position.z = satDist * Math.sin(this.satAngle);
    this.satGroup.rotation.y = this.satAngle + Math.PI / 2;

    // 3. Sincronización de supertrama TDMA en las torres
    for (const t of this.towers) {
      if (t.slotId === currentTdmaSlot) {
        t.beaconMesh.scale.set(1.5, 1.5, 1.5);
        (t.beaconMesh.material as THREE.MeshBasicMaterial).color.setHex(
          t.slotId === 8 ? 0xffea00 : 0x00ff88 // Slot 8 es Baliza Kuramoto (Dorado)
        );
        t.light.intensity = 1.4;
      } else {
        t.beaconMesh.scale.set(1.0, 1.0, 1.0);
        (t.beaconMesh.material as THREE.MeshBasicMaterial).color.setHex(0x005577);
        t.light.intensity = 0.2;
      }
    }

    // 4. Rotación del Reactor Mnemónico (RAG)
    this.reactorGroup.rotation.y += deltaSec * 0.3;
    this.reactorGroup.rotation.x += deltaSec * 0.15;
  }

  /**
   * Dispara un arco de plasma del Guardián IA para neutralizar una amenaza
   */
  public triggerGuardianIntercept(targetPos: THREE.Vector3, isMalicious: boolean): void {
    const startPos = new THREE.Vector3().copy(this.guardianGroup.position);
    const lineGeo = this.defenseBeam.geometry as THREE.BufferGeometry;
    lineGeo.setFromPoints([new THREE.Vector3(0, 0, 0), targetPos.clone().sub(startPos)]);
    lineGeo.attributes.position.needsUpdate = true;

    const mat = this.defenseBeam.material as THREE.LineBasicMaterial;
    mat.color.setHex(isMalicious ? 0xff0044 : 0x00ff88);
    mat.opacity = 1.0;

    if (this.defenseBeamTimeout) clearTimeout(this.defenseBeamTimeout);
    this.defenseBeamTimeout = setTimeout(() => {
      mat.opacity = 0.0;
    }, 380);
  }

  public dispose(): void {
    if (this.defenseBeamTimeout) clearTimeout(this.defenseBeamTimeout);
    this.rootGroup.traverse((obj) => {
      const anyObj = obj as any;
      if (anyObj.geometry) {
        anyObj.geometry.dispose();
      }
      if (anyObj.material) {
        if (Array.isArray(anyObj.material)) {
          anyObj.material.forEach((m: any) => m.dispose());
        } else {
          anyObj.material.dispose();
        }
      }
    });
  }
}
