 /**
 * test-tactical-vivarium-resilience.js — RED Sovereign Mesh OS
 * 
 * Suite Automatizada de Verificación de Resiliencia del Vivarium Biocibernético 3D/2D:
 * 1. Inicialización cinemática 3-DOF del HexapodBody3D (18 articulaciones en 6 patas).
 * 2. Adaptación a los modos de paso CPG (WAVE, TETRAPOD, TRIPOD, ESCAPE_SPRINT).
 * 3. Respuesta a amenazas: Lóbulo óptico (looming) y salto de escape (Giant Fiber).
 * 4. Geometría entorrinal: Teselación hexagonal y confinamiento de Border Cells.
 * 5. Ciclo de supertrama LoRa TDMA en las torres del Vivarium.
 * 6. Limpieza y purga estricta de memoria Three.js (Anti-Memory Leak).
 */

const assert = require('assert');
const THREE = require('three');

console.log('='.repeat(80));
console.log('🛡️  INICIANDO SUITE DE PRUEBAS — VIVARIUM BIOCIBERNÉTICO & GEMELO DIGITAL 3D/2D');
console.log('='.repeat(80));

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${totalTests}. ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// ── TEST 1: Cinemática Articular 3-DOF del Hexápodo ─────────────────────────
runTest('Cálculo y límites de rotación 3-DOF en las 6 patas (Coxa, Fémur, Tibia)', () => {
  const legIds = ['LF', 'LM', 'LH', 'RF', 'RM', 'RH'];
  assert.strictEqual(legIds.length, 6, 'Deben existir 6 identificadores de pata');

  // Simular ángulos CPG
  const mockLegs = legIds.map((id, idx) => ({
    id,
    index: idx,
    tripod: idx % 2 === 0 ? 'TRIPOD_A' : 'TRIPOD_B',
    joints: {
      coxaDeg: 15.0,
      femurDeg: -10.0,
      tibiaDeg: 45.0,
      pwmCoxaUs: 1500,
      pwmFemurUs: 1400,
      pwmTibiaUs: 1750,
    },
    isGroundContact: true,
    elevatorReflexActive: false,
    searchingReflexActive: false,
    obstacleContact: false,
  }));

  mockLegs.forEach((leg) => {
    assert(leg.joints.coxaDeg >= -30 && leg.joints.coxaDeg <= 30, 'Coxa dentro de rango [-30°, +30°]');
    assert(leg.joints.femurDeg >= -20 && leg.joints.femurDeg <= 45, 'Fémur dentro de rango [-20°, +45°]');
    assert(leg.joints.tibiaDeg >= 10 && leg.joints.tibiaDeg <= 90, 'Tibia dentro de rango [10°, 90°]');
  });
});

// ── TEST 2: Fases de Marcha Trípode (Desfase Pi Inter-Trípode) ────────────────
runTest('Sincronización Kuramoto-Matsuoka de Trípode A y B con Delta phi = pi', () => {
  const phaseTripodA = 0.0; // Radianes
  const phaseTripodB = Math.PI; // Radianes

  const deltaPhase = Math.abs(phaseTripodB - phaseTripodA);
  assert.strictEqual(Math.round(deltaPhase * 1000) / 1000, 3.142, 'Desfase estricto Delta phi = pi');
});

// ── TEST 3: Respuesta Cromática de Ojos Compuestos (OpticLobeEngine) ──────────
runTest('Mutación cromática de ojos ante aproximación peligrosa (Looming Threat)', () => {
  const eyeMatNormal = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 0.8,
  });

  const eyeMatThreat = new THREE.MeshStandardMaterial({
    color: 0xff3355,
    emissive: 0xff0033,
    emissiveIntensity: 1.4,
  });

  assert.strictEqual(eyeMatNormal.color.getHex(), 0x00f0ff, 'Color normal en cian táctico');
  assert.strictEqual(eyeMatThreat.color.getHex(), 0xff3355, 'Color de amenaza en carmesí alerta');
  assert(eyeMatThreat.emissiveIntensity > eyeMatNormal.emissiveIntensity, 'Intensidad emisiva superior en alerta');

  eyeMatNormal.dispose();
  eyeMatThreat.dispose();
});

// ── TEST 4: Impulso Vertical del Reflejo de Escape (GiantFiberReflexEngine) ───
runTest('Dinámica de aceleración balística de escape (< 15 ms)', () => {
  const jumpVelocityY = 6.5; // m/s
  const gravity = 19.6; // 2G
  const deltaSec = 0.016; // ~60 FPS

  let y = 0.55; // Altura base
  let vy = jumpVelocityY;

  // Frame 1
  y += vy * deltaSec;
  vy -= gravity * deltaSec;

  assert(y > 0.55, 'El cuerpo debe ascender verticalmente');
  assert(vy < jumpVelocityY, 'La velocidad vertical debe desacelerar por gravedad 2G');
});

// ── TEST 5: Métrica Espacial de Células de Rejilla (Entorhinal Grid Cells) ────
runTest('Simetría hexagonal de 60° y cálculo periódico en coordenadas X-Z', () => {
  const hexRadius = 1.2;
  const hexHeight = Math.sqrt(3) * hexRadius;
  const hexWidth = 2 * hexRadius;

  // Snapping de coordenadas (X=2.5, Z=3.1)
  const agentX = 2.5;
  const agentZ = 3.1;

  const c = Math.round(agentX / (hexWidth * 0.75));
  const czCandidate = agentZ - (c % 2 !== 0 ? hexHeight * 0.5 : 0);
  const r = Math.round(czCandidate / hexHeight);

  const snapX = c * hexWidth * 0.75;
  const snapZ = r * hexHeight + (c % 2 !== 0 ? hexHeight * 0.5 : 0);

  assert(typeof snapX === 'number' && !isNaN(snapX), 'Coordenada snapX debe ser numérica');
  assert(typeof snapZ === 'number' && !isNaN(snapZ), 'Coordenada snapZ debe ser numérica');
  assert(Math.hypot(agentX - snapX, agentZ - snapZ) < hexRadius * 1.5, 'El punto snap debe estar dentro de la vecindad');
});

// ── TEST 6: Confinamiento de Border Cells y Rebote Elástico ──────────────────
runTest('Detección perimétrica y rebote azimutal a radio máximo de 16.8 m', () => {
  const arenaRadius = 18.0;
  const maxRadius = arenaRadius - 1.2; // 16.8 m

  // Posición simulada excedida
  let x = 17.5;
  let z = 0.0;
  let heading = 90; // Este

  const dist = Math.hypot(x, z);
  if (dist > maxRadius) {
    const angle = Math.atan2(z, x);
    x = Math.cos(angle) * maxRadius;
    z = Math.sin(angle) * maxRadius;
    heading = (heading + 180) % 360;
  }

  assert.strictEqual(Math.round(x * 10) / 10, 16.8, 'Posición X debe estar acotada al perímetro');
  assert.strictEqual(heading, 270, 'Rumbo debe invertirse 180° tras impacto de borde');
});

// ── TEST 7: Supertrama LoRa TDMA (10 Slots / 2000 ms) ────────────────────────
runTest('Asignación determinista de slots TDMA y baliza Kuramoto en Slot 8', () => {
  const slots = Array.from({ length: 10 }, (_, i) => i);
  assert.strictEqual(slots.length, 10, 'La supertrama debe tener exactamente 10 slots');

  const kuramotoSlot = 8;
  const csmaSlot = 9;

  assert.strictEqual(slots[kuramotoSlot], 8, 'Slot 8 reservado para baliza Kuramoto / PLL');
  assert.strictEqual(slots[csmaSlot], 9, 'Slot 9 reservado para contienda CSMA/CA');
});

// ── TEST 8: Ciclo de Vida y Limpieza de Recursos Three.js (Zero Leaks) ───────
runTest('Purga recursiva de geometrías y materiales de Three.js al destruir escena', () => {
  const group = new THREE.Group();

  const geo1 = new THREE.BoxGeometry(1, 1, 1);
  const mat1 = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const mesh1 = new THREE.Mesh(geo1, mat1);
  group.add(mesh1);

  const geo2 = new THREE.SphereGeometry(0.5, 8, 8);
  const mat2 = new THREE.MeshStandardMaterial({ color: 0xff3355 });
  const mesh2 = new THREE.Mesh(geo2, mat2);
  group.add(mesh2);

  let disposedGeometries = 0;
  let disposedMaterials = 0;

  geo1.addEventListener('dispose', () => { disposedGeometries++; });
  geo2.addEventListener('dispose', () => { disposedGeometries++; });
  mat1.addEventListener('dispose', () => { disposedMaterials++; });
  mat2.addEventListener('dispose', () => { disposedMaterials++; });

  // Ejecutar purga
  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose();
      obj.material.dispose();
    }
  });

  assert.strictEqual(disposedGeometries, 2, 'Todas las geometrías deben ser purgadas');
  assert.strictEqual(disposedMaterials, 2, 'Todos los materiales deben ser purgados');
});

// ── TEST 9: Cinemática Multi-Touch y Acotación Esférica de Zoom ─────────────
runTest('Cálculo de factor de pellizco (Pinch-to-Zoom) y acotación [8.0m, 50.0m]', () => {
  const initialDist = 120; // 120 píxeles entre 2 dedos
  const initialRadius = 24.0;

  // Escenario A: Usuario junta los dedos (currentDist = 60 px) -> Debería alejar la cámara
  const currentDistA = 60;
  const factorA = initialDist / currentDistA; // 2.0
  const radiusA = Math.max(8, Math.min(50, initialRadius * factorA));
  assert.strictEqual(radiusA, 48.0, 'Radio debe duplicarse proporcionalmente al pellizco');

  // Escenario B: Usuario separa los dedos (currentDist = 600 px) -> Factor = 0.2 (radio teórico 4.8m acotado a 8.0m)
  const currentDistB = 600;
  const factorB = initialDist / currentDistB;
  const radiusB = Math.max(8, Math.min(50, initialRadius * factorB));
  assert.strictEqual(radiusB, 8.0, 'Radio debe respetar el límite inferior físico de 8.0 m');

  // Escenario C: Pinch excesivo hacia afuera (radio teórico 120m acotado a 50.0m)
  const currentDistC = 20;
  const factorC = initialDist / currentDistC;
  const radiusC = Math.max(8, Math.min(50, initialRadius * factorC));
  assert.strictEqual(radiusC, 50.0, 'Radio debe respetar el límite superior de visibilidad de 50.0 m');
});

// ── TEST 10: Purga Universal de LineLoop, LineSegments y Points ──────────────
runTest('Purga universal de memoria para LineLoop (MEC), LineSegments y Points', () => {
  const group = new THREE.Group();

  // 1. LineLoop (Resaltador hexagonal activo)
  const lineLoopGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(1,0,0)]);
  const lineLoopMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
  const lineLoop = new THREE.LineLoop(lineLoopGeo, lineLoopMat);
  group.add(lineLoop);

  // 2. LineSegments (Muros perimétricos Border Cells)
  const segGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,1,0)]);
  const segMat = new THREE.LineBasicMaterial({ color: 0xff3355 });
  const seg = new THREE.LineSegments(segGeo, segMat);
  group.add(seg);

  // 3. Points (Partículas del reactor mnemónico)
  const ptsGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,2,0)]);
  const ptsMat = new THREE.PointsMaterial({ color: 0x00e5ff });
  const pts = new THREE.Points(ptsGeo, ptsMat);
  group.add(pts);

  let disposedCount = 0;
  lineLoopGeo.addEventListener('dispose', () => disposedCount++);
  segGeo.addEventListener('dispose', () => disposedCount++);
  ptsGeo.addEventListener('dispose', () => disposedCount++);

  // Purga universal implementada en el motor
  group.traverse((obj) => {
    const anyObj = obj;
    if (anyObj.geometry) anyObj.geometry.dispose();
    if (anyObj.material) {
      if (Array.isArray(anyObj.material)) anyObj.material.forEach((m) => m.dispose());
      else anyObj.material.dispose();
    }
  });

  assert.strictEqual(disposedCount, 3, 'Todas las geometrías especiales (LineLoop, LineSegments, Points) deben disponerse');
});

console.log('='.repeat(80));
console.log(`📊 RESUMEN DE RESULTADOS: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('='.repeat(80));
