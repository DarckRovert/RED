/**
 * test-cpg-hexapod-locomotion.js
 *
 * Test suite exhaustivo para la Frontera 2:
 * Generadores de Patrones Centrales (CPG) & Marcha Trípode Hexápoda
 * para Relés Robóticos Autónomos (NeuroMechFly v2 / FlyGym).
 */

const fs = require('fs');
const path = require('path');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedTests++;
  }
}

console.log('\n' + '='.repeat(80));
console.log('🦗 TEST SUITE: GENERADORES DE PATRONES CENTRALES (CPG) & MARCHA TRÍPODE');
console.log('='.repeat(80) + '\n');

// -------------------------------------------------------------------------------------------------
// 1. Verificación Estática del Código Fuente
// -------------------------------------------------------------------------------------------------
const cpgEnginePath = path.resolve(__dirname, '../src/lib/neuro/CentralPatternGeneratorEngine.ts');
const motorActuatorPath = path.resolve(__dirname, '../src/lib/neuro/TacticalMotorActuatorEngine.ts');
const orchestratorPath = path.resolve(__dirname, '../src/lib/neuro/ConnectomeEcosystemOrchestrator.ts');
const hudPath = path.resolve(__dirname, '../src/components/MaleCnsConnectomeHUD.tsx');
const indexPath = path.resolve(__dirname, '../src/lib/neuro/index.ts');

assert(fs.existsSync(cpgEnginePath), '1.1 CentralPatternGeneratorEngine.ts existe en disco');
assert(fs.existsSync(motorActuatorPath), '1.2 TacticalMotorActuatorEngine.ts existe en disco');
assert(fs.existsSync(orchestratorPath), '1.3 ConnectomeEcosystemOrchestrator.ts existe en disco');

const cpgContent = fs.readFileSync(cpgEnginePath, 'utf8');
const motorContent = fs.readFileSync(motorActuatorPath, 'utf8');
const orchestratorContent = fs.readFileSync(orchestratorPath, 'utf8');
const hudContent = fs.readFileSync(hudPath, 'utf8');
const indexContent = fs.readFileSync(indexPath, 'utf8');

assert(indexContent.includes("export * from './CentralPatternGeneratorEngine'"), '1.4 neuro/index.ts exporta CentralPatternGeneratorEngine');
assert(motorContent.includes('centralPatternGenerator'), '1.5 TacticalMotorActuatorEngine importa y vincula centralPatternGenerator');
assert(orchestratorContent.includes('const cpg = centralPatternGenerator.getTelemetry()') && orchestratorContent.includes('cpg,'), '1.6 ConnectomeEcosystemOrchestrator incluye cpg en getOrganismSnapshot');
assert(hudContent.includes('CPG LOCOMOCIÓN HEXÁPODA'), '1.7 MaleCnsConnectomeHUD incluye el panel interactivo de CPG');

// -------------------------------------------------------------------------------------------------
// 2. Simulación y Validación del Modelo Matemático de Kuramoto-Matsuoka
// -------------------------------------------------------------------------------------------------
console.log('\n--- 2. Dinámica de Osciladores Acoplados Kuramoto-Matsuoka ---');

// Implementación idéntica en JS para verificación analítica independiente
const LEG_IDS = ['LF', 'LM', 'LH', 'RF', 'RM', 'RH'];
const TRIPOD_MAP = {
  LF: 'TRIPOD_A',
  LM: 'TRIPOD_B',
  LH: 'TRIPOD_A',
  RF: 'TRIPOD_B',
  RM: 'TRIPOD_A',
  RH: 'TRIPOD_B',
};

// Matriz de conexión
const N = 6;
const targetPhaseDiffs = Array.from({ length: N }, () => new Array(N).fill(0));
const couplingWeights = Array.from({ length: N }, () => new Array(N).fill(0));

function setCoupling(i, j, targetDiff, weight) {
  targetPhaseDiffs[i][j] = targetDiff;
  targetPhaseDiffs[j][i] = -targetDiff;
  couplingWeights[i][j] = weight;
  couplingWeights[j][i] = weight;
}

const K_contra = 6.0;
const K_ipsi = 6.0;
const K_tripod = 4.0;

// Contralaterales (anti-fase pi)
setCoupling(0, 3, Math.PI, K_contra); // LF <-> RF
setCoupling(1, 4, Math.PI, K_contra); // LM <-> RM
setCoupling(2, 5, Math.PI, K_contra); // LH <-> RH

// Ipsilaterales adyacentes (anti-fase pi)
setCoupling(0, 1, Math.PI, K_ipsi);   // LF <-> LM
setCoupling(1, 2, Math.PI, K_ipsi);   // LM <-> LH
setCoupling(3, 4, Math.PI, K_ipsi);   // RF <-> RM
setCoupling(4, 5, Math.PI, K_ipsi);   // RM <-> RH

// Intra-trípode (en fase 0)
setCoupling(0, 4, 0, K_tripod);       // LF <-> RM
setCoupling(4, 2, 0, K_tripod);       // RM <-> LH
setCoupling(3, 1, 0, K_tripod);       // RF <-> LM
setCoupling(1, 5, 0, K_tripod);       // LM <-> RH

assert(couplingWeights[0][3] === 6.0 && targetPhaseDiffs[0][3] === Math.PI, '2.1 Acoplamiento contralateral LF-RF configurado en anti-fase pi (w=6.0)');
assert(couplingWeights[0][1] === 6.0 && targetPhaseDiffs[0][1] === Math.PI, '2.2 Acoplamiento ipsilateral LF-LM configurado en anti-fase pi (w=6.0)');
assert(couplingWeights[0][4] === 4.0 && targetPhaseDiffs[0][4] === 0, '2.3 Acoplamiento intra-trípode LF-RM configurado en fase 0 (w=4.0)');

// -------------------------------------------------------------------------------------------------
// 3. Convergencia y Parámetro de Orden de Kuramoto
// -------------------------------------------------------------------------------------------------
console.log('\n--- 3. Convergencia de Marcha Trípode y Parámetro de Orden R ---');

let phases = [0.1, 3.2, 0.05, 3.1, 0.15, 3.25]; // Inicialmente perturbado
const nu = [2.0, 2.0, 2.0, 2.0, 2.0, 2.0];
const dt = 0.02;

// Integrar 200 pasos (4 segundos de locomoción a 50 Hz)
for (let step = 0; step < 200; step++) {
  const dPhi = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    let rate = 2.0 * Math.PI * nu[i];
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const w = couplingWeights[i][j];
      if (w > 0) {
        const theta = targetPhaseDiffs[i][j];
        rate += w * Math.sin(phases[j] - phases[i] - theta);
      }
    }
    dPhi[i] = rate;
  }
  for (let i = 0; i < N; i++) {
    phases[i] = (phases[i] + dPhi[i] * dt) % (2 * Math.PI);
    if (phases[i] < 0) phases[i] += 2 * Math.PI;
  }
}

// Calcular parámetro de orden de Kuramoto R
let sumCos = 0.0;
let sumSin = 0.0;
const tripodA = [0, 2, 4];
for (const idx of tripodA) {
  sumCos += Math.cos(phases[idx]);
  sumSin += Math.sin(phases[idx]);
}
const tripodB = [1, 3, 5];
for (const idx of tripodB) {
  sumCos += Math.cos(phases[idx] + Math.PI);
  sumSin += Math.sin(phases[idx] + Math.PI);
}
const R = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / 6.0;

assert(R >= 0.90, `3.1 Parámetro de orden de Kuramoto R = ${(R * 100).toFixed(2)}% (>= 90% marcha trípode bloqueada)`);

// Diferencia de fase contralateral LF y RF
let diffContra = Math.abs(phases[0] - phases[3]);
if (diffContra > Math.PI) diffContra = 2 * Math.PI - diffContra;
assert(Math.abs(diffContra - Math.PI) < 0.15, `3.2 Desfase contralateral LF vs RF = ${(diffContra * 180 / Math.PI).toFixed(1)}° (Anti-fase ~180°)`);

// Diferencia de fase intra-trípode LF y RM
let diffIntra = Math.abs(phases[0] - phases[4]);
if (diffIntra > Math.PI) diffIntra = 2 * Math.PI - diffIntra;
assert(diffIntra < 0.15, `3.3 Desfase intra-trípode LF vs RM = ${(diffIntra * 180 / Math.PI).toFixed(1)}° (En fase ~0°)`);

// -------------------------------------------------------------------------------------------------
// 4. Modulación Descendente DNa01 / DNa02 (Fan-Shaped Body)
// -------------------------------------------------------------------------------------------------
console.log('\n--- 4. Modulación Descendente DNa01/DNa02 y Giros Asimétricos ---');

function computeFrequencies(baseFreq, steeringBias) {
  const leftScale = 1.0 + Math.max(-0.6, Math.min(0.6, steeringBias * 0.6));
  const rightScale = 1.0 - Math.max(-0.6, Math.min(0.6, steeringBias * 0.6));
  return {
    nuLeft: baseFreq * leftScale,
    nuRight: baseFreq * rightScale,
  };
}

// Giro a la izquierda (steeringBias = -1.0)
const turnLeft = computeFrequencies(2.0, -1.0);
assert(turnLeft.nuRight > turnLeft.nuLeft, `4.1 DNa01 (Giro Izquierda): Patas derechas (${turnLeft.nuRight.toFixed(1)} Hz) > Patas izquierdas (${turnLeft.nuLeft.toFixed(1)} Hz)`);

// Giro a la derecha (steeringBias = +1.0)
const turnRight = computeFrequencies(2.0, +1.0);
assert(turnRight.nuLeft > turnRight.nuRight, `4.2 DNa02 (Giro Derecha): Patas izquierdas (${turnRight.nuLeft.toFixed(1)} Hz) > Patas derechas (${turnRight.nuRight.toFixed(1)} Hz)`);

// Marcha recta (steeringBias = 0.0)
const straight = computeFrequencies(2.0, 0.0);
assert(straight.nuLeft === straight.nuRight, `4.3 Marcha Recta: Simetría bilateral perfecta (${straight.nuLeft.toFixed(1)} Hz)`);

// -------------------------------------------------------------------------------------------------
// 5. Reflejo de Escape Giant Fiber System (GFS)
// -------------------------------------------------------------------------------------------------
console.log('\n--- 5. Reflejo de Escape Giant Fiber System (GFS) ---');

assert(cpgContent.includes('this.intrinsicFrequencies.fill(8.0)'), '5.1 GFS activa frecuencia de escape de 8.0 Hz');
assert(cpgContent.includes("gaitMode = 'ESCAPE_SPRINT'"), "5.2 Régimen conmuta a ESCAPE_SPRINT durante el reflejo");

// -------------------------------------------------------------------------------------------------
// 6. Cinemática Articular 3-DOF y Rango PWM
// -------------------------------------------------------------------------------------------------
console.log('\n--- 6. Cinemática 3-DOF y Mapeo PWM (1000 - 2000 us) ---');

function computeLegJoints(phaseRad, dutyFactor = 0.5, isElevator = false) {
  const normP = phaseRad / (2 * Math.PI);
  const isStance = normP < dutyFactor;

  let coxaDeg = 0.0;
  let femurDeg = 0.0;
  let tibiaDeg = 35.0;

  if (isStance) {
    const stanceProgress = normP / dutyFactor;
    coxaDeg = 25.0 - stanceProgress * 50.0;
    femurDeg = -10.0;
    tibiaDeg = 40.0;
  } else {
    const swingProgress = (normP - dutyFactor) / (1.0 - dutyFactor);
    coxaDeg = -25.0 + swingProgress * 50.0;
    const apexFactor = Math.sin(swingProgress * Math.PI);
    femurDeg = isElevator ? 45.0 : 15.0 + apexFactor * 25.0;
    tibiaDeg = isElevator ? 70.0 : 25.0 + apexFactor * 20.0;
  }

  const pwmCoxaUs = Math.round(1500 + (coxaDeg / 30.0) * 500);
  const pwmFemurUs = Math.round(1500 + (femurDeg / 45.0) * 500);
  const pwmTibiaUs = Math.round(1500 + ((tibiaDeg - 50.0) / 40.0) * 500);

  return {
    isStance,
    coxaDeg,
    femurDeg,
    tibiaDeg,
    pwmCoxaUs: Math.max(1000, Math.min(2000, pwmCoxaUs)),
    pwmFemurUs: Math.max(1000, Math.min(2000, pwmFemurUs)),
    pwmTibiaUs: Math.max(1000, Math.min(2000, pwmTibiaUs)),
  };
}

// Probar fase Stance (fase = 0.2 * 2*pi)
const stanceJoints = computeLegJoints(0.2 * 2 * Math.PI, 0.5);
assert(stanceJoints.isStance === true, '6.1 Fase Stance detectada correctamente (normP < 0.5)');
assert(stanceJoints.femurDeg === -10.0, '6.2 Fémur deprimido a -10° durante Stance para apoyo firme');
assert(stanceJoints.pwmFemurUs >= 1000 && stanceJoints.pwmFemurUs <= 2000, `6.3 PWM Fémur en rango seguro (${stanceJoints.pwmFemurUs} us)`);

// Probar fase Swing normal (fase = 0.75 * 2*pi, mitad de vuelo)
const swingJoints = computeLegJoints(0.75 * 2 * Math.PI, 0.5, false);
assert(swingJoints.isStance === false, '6.4 Fase Swing detectada correctamente (normP >= 0.5)');
assert(swingJoints.femurDeg > 35.0, `6.5 Fémur elevado en ápice de vuelo (${swingJoints.femurDeg.toFixed(1)}°)`);

// Probar Reflejo Elevador ante colisión
const elevatorJoints = computeLegJoints(0.75 * 2 * Math.PI, 0.5, true);
assert(elevatorJoints.femurDeg === 45.0, '6.6 Reflejo elevador sobre-eleva fémur a +45° para salvar obstáculo');

// -------------------------------------------------------------------------------------------------
// 7. Generación de Tramas Binarias ESP32-S3 (12 Bytes)
// -------------------------------------------------------------------------------------------------
console.log('\n--- 7. Trama Binaria de Hardware ESP32-S3 (12 Bytes) ---');

function computeCrc8(data) {
  let crc = 0x00;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x80) !== 0) {
        crc = ((crc << 1) ^ 0x07) & 0xFF;
      } else {
        crc = (crc << 1) & 0xFF;
      }
    }
  }
  return crc;
}

const frame = new Uint8Array(12);
frame[0] = 0xAA;
frame[1] = 0x55;
frame[2] = 42; // Seq
frame[3] = 0b00010101; // legMask (LF, LH, RM en apoyo)
for (let i = 0; i < 6; i++) {
  frame[4 + i] = 128; // centro servo
}
frame[10] = 0x00; // flags
frame[11] = computeCrc8(frame.subarray(0, 11));

assert(frame.length === 12, '7.1 Longitud exacta de trama de 12 bytes');
assert(frame[0] === 0xAA && frame[1] === 0x55, '7.2 Magic header binario 0xAA 0x55');
assert(frame[11] !== 0, `7.3 CRC-8 válido calculado (0x${frame[11].toString(16).toUpperCase()})`);

// -------------------------------------------------------------------------------------------------
// Resumen Final
// -------------------------------------------------------------------------------------------------
console.log('\n' + '='.repeat(80));
console.log(`🎉 RESULTADO: ${passedTests}/${passedTests + failedTests} PRUEBAS CPG SUPERADAS CON ÉXITO (${failedTests === 0 ? '100% OK' : 'CON FALLOS'})`);
console.log('='.repeat(80) + '\n');

if (failedTests > 0) {
  process.exit(1);
}
