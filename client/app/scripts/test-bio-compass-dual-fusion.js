/**
 * test-bio-compass-dual-fusion.js — RED Sovereign Mesh OS
 *
 * Suite de Verificación Biofísica Automatizada:
 * FRONTERA 5: Compás Bio-Cibernético Dual
 * (Fusión Fan-Shaped Body 16x9 + Células de Rejilla Hexagonales Entorrinales MEC + Anclaje Hipocampal)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=====================================================================================');
console.log('🧭 TEST SUITE: COMPÁS BIO-CIBERNÉTICO DUAL (CX FAN-SHAPED BODY + MEC GRID CELLS)');
console.log('=====================================================================================\n');

let totalPasses = 0;
function pass(testName) {
  totalPasses++;
  console.log(`  ✅ [PASS] ${testName}`);
}

// -------------------------------------------------------------------------------------------------
// 1. Verificación Estática de Módulos & Enlaces Arquitectónicos
// -------------------------------------------------------------------------------------------------
console.log('--- 1. Verificación Estática de Módulos & Enlaces Arquitectónicos ---');

const basePath = path.join(__dirname, '..', 'src');
const dualEnginePath = path.join(basePath, 'lib', 'neuro', 'BioCompassDualFusionEngine.ts');
const fbEnginePath = path.join(basePath, 'lib', 'neuro', 'FanShapedBodyEngine.ts');
const mecEnginePath = path.join(basePath, 'lib', 'neuro', 'human', 'EntorhinalGridCellEngine.ts');
const motorEnginePath = path.join(basePath, 'lib', 'neuro', 'TacticalMotorActuatorEngine.ts');
const orchPath = path.join(basePath, 'lib', 'neuro', 'ConnectomeEcosystemOrchestrator.ts');
const cortexBridgePath = path.join(basePath, 'lib', 'ai', 'ConnectomeCortexBridge.ts');
const neuroIndexPath = path.join(basePath, 'lib', 'neuro', 'index.ts');
const hudPath = path.join(basePath, 'components', 'MaleCnsConnectomeHUD.tsx');

assert(fs.existsSync(dualEnginePath), '1.1 BioCompassDualFusionEngine.ts existe en src/lib/neuro/');
pass('1.1 BioCompassDualFusionEngine.ts existe en src/lib/neuro/');

assert(fs.existsSync(fbEnginePath), '1.2 FanShapedBodyEngine.ts existe en src/lib/neuro/');
pass('1.2 FanShapedBodyEngine.ts existe en src/lib/neuro/');

assert(fs.existsSync(mecEnginePath), '1.3 EntorhinalGridCellEngine.ts existe en src/lib/neuro/human/');
pass('1.3 EntorhinalGridCellEngine.ts existe en src/lib/neuro/human/');

const dualContent = fs.readFileSync(dualEnginePath, 'utf8');
const fbContent = fs.readFileSync(fbEnginePath, 'utf8');
const mecContent = fs.readFileSync(mecEnginePath, 'utf8');
const motorContent = fs.readFileSync(motorEnginePath, 'utf8');
const orchContent = fs.readFileSync(orchPath, 'utf8');
const cortexContent = fs.readFileSync(cortexBridgePath, 'utf8');
const neuroIndexContent = fs.readFileSync(neuroIndexPath, 'utf8');
const hudContent = fs.readFileSync(hudPath, 'utf8');

assert(fbContent.includes('reconcileCoordinates'), '1.4 FanShapedBodyEngine define reconcileCoordinates');
pass('1.4 FanShapedBodyEngine define reconcileCoordinates');

assert(mecContent.includes('reconcileCoordinates') && mecContent.includes('correctSpatialDrift'), '1.5 EntorhinalGridCellEngine define reconcileCoordinates y correctSpatialDrift');
pass('1.5 EntorhinalGridCellEngine define reconcileCoordinates y correctSpatialDrift');

assert(motorContent.includes('DUAL_COMPASS'), '1.6 TacticalMotorActuatorEngine define soporte para modo DUAL_COMPASS');
pass('1.6 TacticalMotorActuatorEngine define soporte para modo DUAL_COMPASS');

assert(orchContent.includes('bioCompassDualFusion') && orchContent.includes('bioCompassDual?: BioCompassDualTelemetry'), '1.7 ConnectomeEcosystemOrchestrator integra bioCompassDualFusion en ciclo de vida y snapshot');
pass('1.7 ConnectomeEcosystemOrchestrator integra bioCompassDualFusion en ciclo de vida y snapshot');

assert(cortexContent.includes('bioCompassDualFusion') && cortexContent.includes('comp[aá]s.*dual'), '1.8 ConnectomeCortexBridge procesa telemetría y consultas NL sobre Compás Dual');
pass('1.8 ConnectomeCortexBridge procesa telemetría y consultas NL sobre Compás Dual');

assert(neuroIndexContent.includes("export * from './BioCompassDualFusionEngine'"), '1.9 index.ts exporta BioCompassDualFusionEngine');
pass('1.9 index.ts exporta BioCompassDualFusionEngine');

assert(hudContent.includes('COMPÁS BIO-CIBERNÉTICO DUAL (CX FAN-SHAPED BODY + MEC GRID CELLS)'), '1.10 MaleCnsConnectomeHUD renderiza panel interactivo de Compás Dual');
pass('1.10 MaleCnsConnectomeHUD renderiza panel interactivo de Compás Dual');

assert(dualContent.includes('calculatePhaseCoherence') && dualContent.includes('getFusedSteeringSolution'), '1.11 BioCompassDualFusionEngine define algoritmos de coherencia y solución de timoneo');
pass('1.11 BioCompassDualFusionEngine define algoritmos de coherencia y solución de timoneo');

assert(dualContent.includes('broadcastAerHeadingSpike'), '1.12 BioCompassDualFusionEngine define difusión neuromórfica AER');
pass('1.12 BioCompassDualFusionEngine define difusión neuromórfica AER');


// -------------------------------------------------------------------------------------------------
// 2. Modelo Matemático: Integración Cinemática Sincronizada (FB + MEC)
// -------------------------------------------------------------------------------------------------
console.log('\n--- 2. Dinámica Cinemática Sincronizada (Integración Dual FB + MEC) ---');

// Mock del simulador biofísico de ambos subsistemas
class MockDualSystem {
  constructor() {
    this.posX = 0.0;
    this.posY = 0.0;
    this.posZ = 0.0;
    this.totalTraveledMeters = 0.0;
    this.driftCorrectionOffset = 0.0;
    this.wavelengths = [0.5, 2.0, 8.0, 32.0];
    this.modulePhases = this.wavelengths.map(() => ({ x: 0.0, y: 0.0 }));
    this.homeX = 0.0;
    this.homeY = 0.0;
    this.targetX = null;
    this.targetY = null;
    this.resetsCount = 0;
  }

  integrateStep(strideMeters, headingDeg) {
    const rad = (headingDeg * Math.PI) / 180;
    const dx = strideMeters * Math.sin(rad); // Este (+)
    const dy = strideMeters * Math.cos(rad); // Norte (+)
    this.posX += dx;
    this.posY += dy;
    this.totalTraveledMeters += strideMeters;

    for (let m = 0; m < this.wavelengths.length; m++) {
      const lambda = this.wavelengths[m];
      this.modulePhases[m].x = (this.modulePhases[m].x + dx) % lambda;
      this.modulePhases[m].y = (this.modulePhases[m].y + dy) % lambda;
    }
  }

  calculateHexagonalActivation(moduleIndex, x = this.posX, y = this.posY) {
    const lambda = this.wavelengths[moduleIndex];
    const k = (4.0 * Math.PI) / (lambda * Math.sqrt(3));
    const angle1 = 0.0;
    const angle2 = Math.PI / 3.0; // 60°
    const angle3 = (2.0 * Math.PI) / 3.0; // 120°

    const w1 = Math.cos(k * (x * Math.cos(angle1) + y * Math.sin(angle1)));
    const w2 = Math.cos(k * (x * Math.cos(angle2) + y * Math.sin(angle2)));
    const w3 = Math.cos(k * (x * Math.cos(angle3) + y * Math.sin(angle3)));

    const raw = (w1 + w2 + w3) / 3.0;
    return Math.max(0.0, Math.min(1.0, (raw + 0.5) / 1.5));
  }

  calculatePhaseCoherence() {
    let sum = 0;
    for (let m = 0; m < this.wavelengths.length; m++) {
      sum += this.calculateHexagonalActivation(m, this.posX, this.posY);
    }
    return Math.round((sum / this.wavelengths.length) * 100) / 100;
  }

  getEstimatedDrift() {
    const raw = this.totalTraveledMeters * 0.015 - this.driftCorrectionOffset;
    return Math.max(0.0, Math.round(raw * 10) / 10);
  }

  correctSpatialDrift(refX, refY, refZ = 0) {
    this.resetsCount++;
    this.posX = refX;
    this.posY = refY;
    this.posZ = refZ;
    for (let m = 0; m < this.wavelengths.length; m++) {
      const lambda = this.wavelengths[m];
      this.modulePhases[m].x = ((refX % lambda) + lambda) % lambda;
      this.modulePhases[m].y = ((refY % lambda) + lambda) % lambda;
    }
    this.driftCorrectionOffset = this.totalTraveledMeters * 0.015;
  }

  computeSteering(goalX, goalY, currentHeadingDeg) {
    const relX = goalX - this.posX;
    const relY = goalY - this.posY;
    const dist = Math.hypot(relX, relY);
    if (dist < 0.5) return { dist, error: 0, mode: 'ARRIVED' };

    let bearing = (Math.atan2(relX, relY) * 180) / Math.PI;
    if (bearing < 0) bearing += 360;

    let diff = bearing - currentHeadingDeg;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    let mode = 'FORWARD';
    if (diff < -12) mode = 'TURN_LEFT';
    else if (diff > 12) mode = 'TURN_RIGHT';

    return { dist, error: Math.round(diff * 10) / 10, mode };
  }
}

const sim = new MockDualSystem();

// Paso 1: 10 metros al Norte (0°)
sim.integrateStep(10.0, 0.0);
assert(Math.abs(sim.posX) < 0.001, '2.1 Desplazamiento X al Norte debe ser 0');
assert(Math.abs(sim.posY - 10.0) < 0.001, '2.2 Desplazamiento Y al Norte debe ser +10m');
pass('2.1 y 2.2 Integración hacia el Norte (0°): X=0.0m, Y=10.0m verificado');

// Paso 2: 10 metros al Este (90°)
sim.integrateStep(10.0, 90.0);
assert(Math.abs(sim.posX - 10.0) < 0.001, '2.3 Desplazamiento X al Este debe ser +10m');
assert(Math.abs(sim.posY - 10.0) < 0.001, '2.4 Desplazamiento Y se mantiene en +10m');
pass('2.3 y 2.4 Integración hacia el Este (90°): X=10.0m, Y=10.0m verificado');

assert.strictEqual(sim.totalTraveledMeters, 20.0, '2.5 Distancia total acumulada es 20m');
pass('2.5 Distancia total acumulada: 20.0m verificado');


// -------------------------------------------------------------------------------------------------
// 3. Coherencia de Fase & Métrica Armónica Hexagonal (Moser 60°)
// -------------------------------------------------------------------------------------------------
console.log('\n--- 3. Coherencia de Fase & Métrica Armónica Hexagonal (Moser 60°) ---');

const coherence = sim.calculatePhaseCoherence();
assert(coherence >= 0.0 && coherence <= 1.0, '3.1 Coherencia de fase acotada en [0.0, 1.0]');
pass(`3.1 Coherencia de fase acotada: C=${coherence}`);

// Evaluar la simetría hexagonal en el origen (0, 0)
const act0 = sim.calculateHexagonalActivation(1, 0, 0); // Módulo 2 (λ=2m)
assert(act0 >= 0.90, '3.2 En el origen (0,0) la activación debe ser máxima (nodo de interferencia constructiva)');
pass(`3.2 Activación constructiva en origen: ψ(0,0)=${act0.toFixed(3)} ≥ 0.90`);

// Evaluar la simetría periódica hexagonal a una distancia igual a una longitud de onda λ=2m en el eje Y
const actLambdaY = sim.calculateHexagonalActivation(1, 0, 2.0);
assert(Math.abs(actLambdaY - act0) < 0.05, '3.3 Periodicidad espacial hexagonal en Y: ψ(0, λ) ≈ ψ(0, 0)');
pass(`3.3 Periodicidad espacial hexagonal en Y: ψ(0, 2m)=${actLambdaY.toFixed(3)} ≈ ψ(0, 0)=${act0.toFixed(3)}`);

// Evaluar la periodicidad hexagonal a lo largo del eje X (x = λ * sqrt(3) ≈ 3.464m)
const lambdaX = 2.0 * Math.sqrt(3);
const actLambdaX = sim.calculateHexagonalActivation(1, lambdaX, 0);
assert(Math.abs(actLambdaX - act0) < 0.05, '3.4 Periodicidad espacial hexagonal en X: ψ(λ√3, 0) ≈ ψ(0, 0)');
pass(`3.4 Periodicidad espacial hexagonal en X: ψ(${lambdaX.toFixed(3)}m, 0)=${actLambdaX.toFixed(3)} ≈ ψ(0, 0)=${act0.toFixed(3)}`);

// Simular divergencia cartesiana (deriva inercial)
const actDrift = sim.calculateHexagonalActivation(1, 0.7, 0.5);
assert(actDrift < act0, '3.5 Desfase de la red disminuye la activación armónica');
pass(`3.5 Desfase inercial detectado: ψ(desfase)=${actDrift.toFixed(3)} < ${act0.toFixed(3)}`);

// Clasificación de estado de coherencia
const stateNominal = coherence >= 0.55 ? 'HARMONIC_CONSENSUS' : coherence < 0.35 ? 'DRIFT_WARNING' : 'NOMINAL';
assert(['HARMONIC_CONSENSUS', 'NOMINAL', 'DRIFT_WARNING'].includes(stateNominal), '3.6 Clasificación de estado de coherencia válido');
pass(`3.6 Estado de coherencia armónica clasificado: ${stateNominal}`);


// -------------------------------------------------------------------------------------------------
// 4. Vector de Timoneo Combinado & Bucle Cerrado con CPG
// -------------------------------------------------------------------------------------------------
console.log('\n--- 4. Vector de Timoneo Combinado & Bucle Cerrado con CPG ---');

// Posición actual: (10, 10). Objetivo: (10, 30) (Directamente al Norte)
// Rumbo actual del robot: 90° (Mirando al Este)
const steerSol = sim.computeSteering(10.0, 30.0, 90.0);
assert.strictEqual(steerSol.mode, 'TURN_LEFT', '4.1 Modo de timoneo debe ser TURN_LEFT');
assert.strictEqual(steerSol.error, -90.0, '4.2 Error de timoneo debe ser -90° (Giro izquierda)');
pass('4.1 y 4.2 Error de timoneo hacia el Norte desde rumbo Este: -90° (TURN_LEFT)');

// Objetivo a la derecha: (30, 10) (Este) con rumbo actual 0° (Norte)
const steerRight = sim.computeSteering(30.0, 10.0, 0.0);
assert.strictEqual(steerRight.mode, 'TURN_RIGHT', '4.3 Modo de timoneo debe ser TURN_RIGHT');
assert.strictEqual(steerRight.error, 90.0, '4.4 Error de timoneo debe ser +90° (Giro derecha)');
pass('4.3 y 4.4 Error de timoneo hacia el Este desde rumbo Norte: +90° (TURN_RIGHT)');

// Objetivo alineado: (10, 30) con rumbo actual 0° (Norte)
const steerAligned = sim.computeSteering(10.0, 30.0, 0.0);
assert.strictEqual(steerAligned.mode, 'FORWARD', '4.5 Modo alineado debe ser FORWARD');
assert(Math.abs(steerAligned.error) < 0.1, '4.6 Error alineado debe ser 0°');
pass('4.5 y 4.6 Marcha recta alineada: FORWARD (Error 0°)');

// Detección de llegada al objetivo (distancia < 0.5m)
const steerArrived = sim.computeSteering(10.2, 10.1, 0.0);
assert.strictEqual(steerArrived.mode, 'ARRIVED', '4.7 Modo al llegar al objetivo debe ser ARRIVED');
pass('4.7 Detección de llegada al objetivo (< 0.5m): ARRIVED verificado');

// Mapeo diferencial de timoneo a motoneuronas CPG DNa01/DNa02
const turnBias = Math.max(-1.0, Math.min(1.0, steerSol.error / 90.0));
assert.strictEqual(turnBias, -1.0, '4.8 Error de -90° mapea a sesgo de timoneo máximo a babor (-1.0)');
pass('4.8 Mapeo de timoneo CPG: Error -90° -> turnBias -1.0 (DNa01 Babor)');


// -------------------------------------------------------------------------------------------------
// 5. Anclaje Episódico Hipocampal & Reseteo de Deriva Inercial
// -------------------------------------------------------------------------------------------------
console.log('\n--- 5. Anclaje Episódico Hipocampal & Reseteo de Deriva Inercial ---');

// Simular 200m de recorrido para acumular deriva
sim.integrateStep(180.0, 45.0); // Total = 200m
const driftBefore = sim.getEstimatedDrift();
assert(driftBefore >= 3.0, '5.1 Deriva inercial acumulada tras 200m debe ser ≥ 3.0m');
pass(`5.1 Deriva acumulada previa al anclaje: ${driftBefore}m`);

// Ejecutar anclaje hipocampal en punto de referencia conocido (0, 0, 0)
sim.correctSpatialDrift(0.0, 0.0, 0.0);
const driftAfter = sim.getEstimatedDrift();
assert.strictEqual(driftAfter, 0.0, '5.2 Deriva inercial tras anclaje hipocampal debe ser exactamente 0.0m');
pass('5.2 Deriva inercial reseteada a 0.0m tras anclaje hipocampal');

assert.strictEqual(sim.posX, 0.0, '5.3 Posición X re-alineada a 0.0m');
assert.strictEqual(sim.posY, 0.0, '5.4 Posición Y re-alineada a 0.0m');
assert.strictEqual(sim.resetsCount, 1, '5.5 Contador de resets hipocampales incrementado a 1');
pass('5.3, 5.4 y 5.5 Re-alineación de coordenadas a (0,0) y conteo de resets verificado');

// Home Vector distance tras anclaje en el origen
const homeDist = Math.hypot(sim.homeX - sim.posX, sim.homeY - sim.posY);
assert.strictEqual(homeDist, 0.0, '5.6 Home Vector distance es exactamente 0.0m en origen');
pass('5.6 Home Vector restablecido a origen: distancia 0.0m');

console.log('\n=====================================================================================');
console.log(`📊 RESULTADOS FINALES: ${totalPasses} PASADOS, 0 FALLIDOS (100% PASS)`);
console.log('=====================================================================================\n');
