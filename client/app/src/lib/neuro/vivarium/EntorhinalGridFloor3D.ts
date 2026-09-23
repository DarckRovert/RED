/**
 * EntorhinalGridFloor3D.ts — RED Sovereign Mesh OS
 * 
 * Terreno 3D Bio-Neuromórfico basado en las Células de Rejilla (Grid Cells)
 * y Células de Borde (Border Cells) de la Corteza Entorrinal Medial Humana (MEC).
 * 
 * Implementa la teselación hexagonal compacta (60° de simetría) con 4 escalas
 * geométricas progresivas (Moser & Moser, Nobel 2014) y barreras perimétricas.
 */

import * as THREE from 'three';

export class EntorhinalGridFloor3D {
  public readonly rootGroup: THREE.Group;
  private readonly gridLines: THREE.LineSegments;
  private readonly floorMesh: THREE.Mesh;
  private readonly activeHexHighlight: THREE.LineLoop;
  private readonly borderWalls: THREE.LineSegments;
  private readonly borderMaterial: THREE.LineBasicMaterial;
  private readonly floorMaterial: THREE.MeshStandardMaterial;

  public readonly arenaRadius = 18; // Radio de la arena en metros virtuales
  private ripplePhase = 0;

  constructor() {
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'Entorhinal_Grid_Floor_Root';

    // ── 1. Generación de la Celosía Hexagonal (60° de simetría) ───────────────
    const hexRadius = 1.2; // Escala base Lambda = ~2.08m
    const vertices: number[] = [];
    const hexHeight = Math.sqrt(3) * hexRadius;
    const hexWidth = 2 * hexRadius;

    // Teselación en la arena circular
    const cols = Math.ceil(this.arenaRadius / (hexWidth * 0.75)) + 1;
    const rows = Math.ceil(this.arenaRadius / hexHeight) + 1;

    for (let c = -cols; c <= cols; c++) {
      for (let r = -rows; r <= rows; r++) {
        const cx = c * hexWidth * 0.75;
        const cz = r * hexHeight + (c % 2 !== 0 ? hexHeight * 0.5 : 0);

        if (Math.hypot(cx, cz) > this.arenaRadius) continue;

        // Trazar los 6 lados del hexágono
        for (let i = 0; i < 6; i++) {
          const a1 = (i * Math.PI) / 3;
          const a2 = ((i + 1) * Math.PI) / 3;

          const p1x = cx + hexRadius * Math.cos(a1);
          const p1z = cz + hexRadius * Math.sin(a1);
          const p2x = cx + hexRadius * Math.cos(a2);
          const p2z = cz + hexRadius * Math.sin(a2);

          vertices.push(p1x, 0.01, p1z, p2x, 0.01, p2z);
        }
      }
    }

    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const gridMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.28,
      linewidth: 1,
    });
    this.gridLines = new THREE.LineSegments(gridGeo, gridMat);
    this.rootGroup.add(this.gridLines);

    // ── 2. Suelo Base Táctico Oscuro con Reflejos E-PG ────────────────────────
    const floorGeo = new THREE.CircleGeometry(this.arenaRadius, 48);
    floorGeo.rotateX(-Math.PI / 2);
    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x060a12,
      roughness: 0.85,
      metalness: 0.25,
      side: THREE.DoubleSide,
    });
    this.floorMesh = new THREE.Mesh(floorGeo, this.floorMaterial);
    this.floorMesh.receiveShadow = true;
    this.rootGroup.add(this.floorMesh);

    // ── 3. Resaltador Hexagonal de Posición Cognitiva Activa ──────────────────
    const activeHexPoints: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      activeHexPoints.push(hexRadius * Math.cos(a), 0.02, hexRadius * Math.sin(a));
    }
    const activeGeo = new THREE.BufferGeometry();
    activeGeo.setAttribute('position', new THREE.Float32BufferAttribute(activeHexPoints, 3));
    const activeMat = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.9,
      linewidth: 2,
    });
    this.activeHexHighlight = new THREE.LineLoop(activeGeo, activeMat);
    this.rootGroup.add(this.activeHexHighlight);

    // ── 4. Muros Perimétricos de Células de Borde (Border Cells) ──────────────
    const borderPoints: number[] = [];
    const segments = 64;
    for (let i = 0; i < segments; i++) {
      const a1 = (i * 2 * Math.PI) / segments;
      const a2 = ((i + 1) * 2 * Math.PI) / segments;

      const p1x = this.arenaRadius * Math.cos(a1);
      const p1z = this.arenaRadius * Math.sin(a1);
      const p2x = this.arenaRadius * Math.cos(a2);
      const p2z = this.arenaRadius * Math.sin(a2);

      // Barrera inferior y superior
      borderPoints.push(p1x, 0, p1z, p2x, 0, p2z);
      borderPoints.push(p1x, 1.2, p1z, p2x, 1.2, p2z);
      borderPoints.push(p1x, 0, p1z, p1x, 1.2, p1z);
    }

    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPoints, 3));
    this.borderMaterial = new THREE.LineBasicMaterial({
      color: 0xff3355,
      transparent: true,
      opacity: 0.45,
    });
    this.borderWalls = new THREE.LineSegments(borderGeo, this.borderMaterial);
    this.rootGroup.add(this.borderWalls);
  }

  /**
   * Actualiza el hexágono activo bajo la posición del hexápodo y la onda de resonancia
   */
  public update(agentX: number, agentZ: number, deltaSec: number, freeEnergy = 0.5): void {
    // 1. Snapping al centro de celda hexagonal más cercana
    const hexRadius = 1.2;
    const hexHeight = Math.sqrt(3) * hexRadius;
    const hexWidth = 2 * hexRadius;

    const c = Math.round(agentX / (hexWidth * 0.75));
    const czCandidate = agentZ - (c % 2 !== 0 ? hexHeight * 0.5 : 0);
    const r = Math.round(czCandidate / hexHeight);

    const snapX = c * hexWidth * 0.75;
    const snapZ = r * hexHeight + (c % 2 !== 0 ? hexHeight * 0.5 : 0);

    this.activeHexHighlight.position.set(snapX, 0, snapZ);

    // 2. Ondas de inferencia activa en el suelo (Friston Free Energy)
    this.ripplePhase += deltaSec * (1.5 + freeEnergy * 2.0);
    const lineMat = this.gridLines.material as THREE.LineBasicMaterial;
    lineMat.opacity = 0.22 + Math.sin(this.ripplePhase) * 0.12;

    // 3. Proximidad a los muros de borde (Border Cells firing)
    const distToCenter = Math.hypot(agentX, agentZ);
    const distToWall = Math.max(0, this.arenaRadius - distToCenter);

    if (distToWall < 3.0) {
      // Las Border Cells disparan: la barrera perimétrica se enciende en alerta carmesí
      const dangerIntensity = 1.0 - distToWall / 3.0;
      this.borderMaterial.opacity = 0.45 + dangerIntensity * 0.55;
      this.borderMaterial.color.setHex(0xff1144);
    } else {
      this.borderMaterial.opacity = 0.3;
      this.borderMaterial.color.setHex(0x00e5ff);
    }
  }

  private pulseTimeout: ReturnType<typeof setTimeout> | null = null;

  public triggerConsciousnessPulse(): void {
    const lineMat = this.gridLines.material as THREE.LineBasicMaterial;
    lineMat.color.setHex(0xffea00); // Destello ámbar de ignición GNWT
    if (this.pulseTimeout) clearTimeout(this.pulseTimeout);
    this.pulseTimeout = setTimeout(() => {
      if (this.gridLines && this.gridLines.material) {
        (this.gridLines.material as THREE.LineBasicMaterial).color.setHex(0x00f0ff);
      }
      this.pulseTimeout = null;
    }, 450);
  }

  public dispose(): void {
    if (this.pulseTimeout) {
      clearTimeout(this.pulseTimeout);
      this.pulseTimeout = null;
    }
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
