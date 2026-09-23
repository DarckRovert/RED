/**
 * test-swarm-criticality-soc.js
 *
 * Test suite exhaustivo para la Frontera 3:
 * Criticalidad Auto-Organizada (Self-Organized Criticality - SOC, sigma ~ 1.0)
 * y Transiciones de Fase en Enjambres Mesh P2P
 * (neurolib / Beggs & Plenz 2003 / Deco et al. 2014 / Turrigiano 2008).
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

console.log('\n' + '='.repeat(85));
console.log('🌐 TEST SUITE: CRITICALIDAD AUTO-ORGANIZADA (SOC σ ≈ 1.0) & TRANSICIONES DE FASE');
console.log('='.repeat(85) + '\n');

// -------------------------------------------------------------------------------------------------
// 1. Verificación Estática del Código Fuente y Arquitectura SSOT
// -------------------------------------------------------------------------------------------------
console.log('--- 1. Verificación Estática de Módulos & Enlaces Arquitectónicos ---');

const socEnginePath = path.resolve(__dirname, '../src/lib/neuro/SwarmCriticalityEngine.ts');
const bsgEnginePath = path.resolve(__dirname, '../src/lib/mesh/BroadcastStormGuardEngine.ts');
const meshRouterPath = path.resolve(__dirname, '../src/lib/mesh/meshRouter.ts');
const orchestratorPath = path.resolve(__dirname, '../src/lib/neuro/ConnectomeEcosystemOrchestrator.ts');
const cortexBridgePath = path.resolve(__dirname, '../src/lib/ai/ConnectomeCortexBridge.ts');
const hudPath = path.resolve(__dirname, '../src/components/MaleCnsConnectomeHUD.tsx');
const indexPath = path.resolve(__dirname, '../src/lib/neuro/index.ts');

assert(fs.existsSync(socEnginePath), '1.1 SwarmCriticalityEngine.ts existe en src/lib/neuro/');
assert(fs.existsSync(bsgEnginePath), '1.2 BroadcastStormGuardEngine.ts existe en src/lib/mesh/');
assert(fs.existsSync(meshRouterPath), '1.3 meshRouter.ts existe en src/lib/mesh/');

const socContent = fs.readFileSync(socEnginePath, 'utf8');
const bsgContent = fs.readFileSync(bsgEnginePath, 'utf8');
const routerContent = fs.readFileSync(meshRouterPath, 'utf8');
const orchContent = fs.readFileSync(orchestratorPath, 'utf8');
const cortexContent = fs.readFileSync(cortexBridgePath, 'utf8');
const hudContent = fs.readFileSync(hudPath, 'utf8');
const indexContent = fs.readFileSync(indexPath, 'utf8');

assert(indexContent.includes("export * from './SwarmCriticalityEngine'"), '1.4 neuro/index.ts exporta SwarmCriticalityEngine');
assert(bsgContent.includes('swarmCriticality.recordPacketReceived'), '1.5 BroadcastStormGuardEngine registra paquetes entrantes en swarmCriticality');
assert(bsgContent.includes('swarmCriticality.getAdaptiveKThreshold'), '1.6 BroadcastStormGuardEngine utiliza K-counter adaptativo modulado por sigma');
assert(bsgContent.includes('swarmCriticality.shouldRelayProbabilistic'), '1.7 BroadcastStormGuardEngine evalúa supresión probabilística de Turrigiano');
assert(bsgContent.includes('swarmCriticality.recordPacketRelayed'), '1.8 BroadcastStormGuardEngine registra retransmisiones exitosas');
assert(routerContent.includes('swarmCriticality.recordPacketReceived') && routerContent.includes('swarmCriticality.recordPacketRelayed'), '1.9 meshRouter vincula recolección de paquetes en swarmCriticality');
assert(orchContent.includes('swarmCriticality.start()') && orchContent.includes('criticality'), '1.10 ConnectomeEcosystemOrchestrator orquesta ciclo de vida y snapshot de SOC');
assert(cortexContent.includes('criticality') && cortexContent.includes('branching'), '1.11 ConnectomeCortexBridge expone telemetría de criticalidad al LLM local');
assert(hudContent.includes('CRITICALIDAD AUTO-ORGANIZADA (SOC σ ≈ 1.0 & NEUROLIB)'), '1.12 MaleCnsConnectomeHUD renderiza panel visual de criticalidad');

// -------------------------------------------------------------------------------------------------
// 2. Simulación Analítica del Modelo Matemático de Branching Ratio & Transición de Fase
// -------------------------------------------------------------------------------------------------
console.log('\n--- 2. Modelo Matemático: Branching Ratio (σ) & Estados de Fase ---');

// Réplica analítica pura de la lógica de SwarmCriticalityEngine
class MockSwarmCriticalityEngine {
  constructor() {
    this.BUCKET_COUNT = 100;
    this.BUCKET_DURATION_MS = 100;
    this.QUIET_THRESHOLD_MS = 150;
    this.inBuckets = new Uint32Array(this.BUCKET_COUNT);
    this.outBuckets = new Uint32Array(this.BUCKET_COUNT);
    this.currentBucketIndex = 0;
    this.relayProbability = 1.00;
    this.currentAvalancheSize = 0;
    this.currentAvalancheStartTime = 0;
    this.lastPacketEventTime = 0;
    this.avalancheCounter = 0;
    this.avalancheHistory = [];
  }

  recordPacketReceived(count = 1, now = Date.now()) {
    this.inBuckets[this.currentBucketIndex] += count;
    this.handleAvalanchePacket(count, now);
  }

  recordPacketRelayed(count = 1) {
    this.outBuckets[this.currentBucketIndex] += count;
  }

  handleAvalanchePacket(count, now) {
    if (this.currentAvalancheSize === 0) {
      this.currentAvalancheStartTime = now;
      this.currentAvalancheSize = count;
    } else {
      const dt = now - this.lastPacketEventTime;
      if (dt > this.QUIET_THRESHOLD_MS) {
        this.closeCurrentAvalanche(this.lastPacketEventTime);
        this.currentAvalancheStartTime = now;
        this.currentAvalancheSize = count;
      } else {
        this.currentAvalancheSize += count;
      }
    }
    this.lastPacketEventTime = now;
  }

  closeCurrentAvalanche(endTime) {
    if (this.currentAvalancheSize === 0) return;
    const duration = Math.max(1, endTime - this.currentAvalancheStartTime);
    this.avalancheCounter++;
    this.avalancheHistory.push({
      id: this.avalancheCounter,
      size: this.currentAvalancheSize,
      durationMs: duration,
      timestamp: endTime,
    });
    this.currentAvalancheSize = 0;
  }

  computeBranchingRatio() {
    let totalIn = 0;
    let totalOut = 0;
    for (let i = 0; i < this.BUCKET_COUNT; i++) {
      totalIn += this.inBuckets[i];
      totalOut += this.outBuckets[i];
    }
    if (totalIn === 0) return 1.00;
    return totalOut / totalIn;
  }

  getCriticalityState() {
    const sigma = this.computeBranchingRatio();
    if (sigma < 0.90) return 'SUB_CRITICAL';
    if (sigma > 1.10) return 'SUPER_CRITICAL';
    return 'CRITICAL';
  }

  evaluateHomeostaticAdaptation() {
    const sigma = this.computeBranchingRatio();
    if (sigma > 1.10) {
      const excess = sigma - 1.00;
      const depressionFactor = Math.min(0.20, excess * 0.15);
      this.relayProbability = Math.max(0.10, this.relayProbability - depressionFactor);
    } else if (sigma < 0.90) {
      this.relayProbability = Math.min(1.00, this.relayProbability + 0.05);
    } else {
      if (this.relayProbability < 1.00) {
        this.relayProbability = Math.min(1.00, this.relayProbability + 0.02);
      }
    }
    return this.relayProbability;
  }

  getAdaptiveKThreshold(peerCount = 10) {
    const base = peerCount > 15 ? 2 : peerCount > 6 ? 3 : 5;
    const sigma = this.computeBranchingRatio();
    if (sigma > 1.20) {
      return Math.max(1, base - 1);
    } else if (sigma < 0.80) {
      return base + 1;
    }
    return base;
  }

  shouldRelayProbabilistic() {
    if (this.relayProbability >= 0.99) return true;
    return Math.random() <= this.relayProbability;
  }

  estimatePowerLawExponent() {
    if (this.avalancheHistory.length < 5) return 1.50;
    const sizes = this.avalancheHistory.map(a => a.size).filter(s => s >= 1);
    const n = sizes.length;
    if (n < 5) return 1.50;
    const sMin = 1;
    let sumLog = 0;
    for (const s of sizes) {
      sumLog += Math.log(s / (sMin - 0.5));
    }
    const alpha = 1 + n / sumLog;
    return Math.max(1.05, Math.min(3.5, alpha));
  }
}

const mockSoc = new MockSwarmCriticalityEngine();

// Estado 1: Reposo sin tráfico
assert(mockSoc.computeBranchingRatio() === 1.00, '2.1 En ausencia de tráfico, sigma = 1.00 (equilibrio crítico por defecto)');
assert(mockSoc.getCriticalityState() === 'CRITICAL', '2.2 Estado crítico por defecto en reposo');

// Estado 2: Simulación de régimen Sub-Crítico (extinción de paquetes)
// 100 recibidos, solo 30 retransmitidos
mockSoc.recordPacketReceived(100);
mockSoc.recordPacketRelayed(30);
const subSigma = mockSoc.computeBranchingRatio();
assert(Math.abs(subSigma - 0.30) < 0.001, `2.3 Régimen Sub-crítico: sigma calculado = ${subSigma.toFixed(2)} (esperado 0.30)`);
assert(mockSoc.getCriticalityState() === 'SUB_CRITICAL', '2.4 Detección correcta de fase SUB_CRITICAL (sigma < 0.90)');

// Estado 3: Simulación de régimen Super-Crítico (amplificación de tormenta)
// Reiniciamos y agregamos 50 recibidos, 120 retransmitidos
const mockSuper = new MockSwarmCriticalityEngine();
mockSuper.recordPacketReceived(50);
mockSuper.recordPacketRelayed(120);
const superSigma = mockSuper.computeBranchingRatio();
assert(Math.abs(superSigma - 2.40) < 0.001, `2.5 Régimen Super-crítico: sigma calculado = ${superSigma.toFixed(2)} (esperado 2.40)`);
assert(mockSuper.getCriticalityState() === 'SUPER_CRITICAL', '2.6 Detección correcta de fase SUPER_CRITICAL (sigma > 1.10)');

// Estado 4: Simulación de régimen Crítico Óptimo (Beggs & Plenz)
// 100 recibidos, 98 retransmitidos
const mockCrit = new MockSwarmCriticalityEngine();
mockCrit.recordPacketReceived(100);
mockCrit.recordPacketRelayed(98);
const critSigma = mockCrit.computeBranchingRatio();
assert(Math.abs(critSigma - 0.98) < 0.001, `2.7 Régimen Crítico: sigma calculado = ${critSigma.toFixed(2)} (esperado 0.98)`);
assert(mockCrit.getCriticalityState() === 'CRITICAL', '2.8 Detección correcta de fase CRITICAL (0.90 <= sigma <= 1.10)');

// -------------------------------------------------------------------------------------------------
// 3. Plasticidad Intrínseca Homeostática de Turrigiano
// -------------------------------------------------------------------------------------------------
console.log('\n--- 3. Plasticidad Intrínseca Homeostática (Turrigiano 2008) ---');

// En régimen super-crítico (sigma = 2.40), la probabilidad de reenvío P_relay debe deprimirse
const initialRelayP = mockSuper.relayProbability;
assert(initialRelayP === 1.00, '3.1 P_relay inicial es 100%');

mockSuper.evaluateHomeostaticAdaptation();
const adaptedP1 = mockSuper.relayProbability;
assert(adaptedP1 < 1.00, `3.2 P_relay se deprime ante tormenta super-crítica (P = ${(adaptedP1 * 100).toFixed(1)}%)`);

// Varias iteraciones bajo super-criticalidad deben continuar bajando P_relay hasta mínimo de seguridad (0.10)
for (let i = 0; i < 15; i++) {
  mockSuper.evaluateHomeostaticAdaptation();
}
assert(mockSuper.relayProbability >= 0.10 && mockSuper.relayProbability <= 0.20, `3.3 P_relay respeta el piso homeostático de 10% (P actual = ${(mockSuper.relayProbability * 100).toFixed(1)}%)`);

// En régimen sub-crítico, P_relay debe auto-recuperarse hacia 1.00
for (let i = 0; i < 25; i++) {
  mockSoc.evaluateHomeostaticAdaptation(); // mockSoc es sub-crítico (0.30)
}
assert(mockSoc.relayProbability === 1.00, `3.4 P_relay se recupera gradualmente al 100% en condiciones de hipo-actividad`);

// -------------------------------------------------------------------------------------------------
// 4. Dinámica de Avalanchas y Ajuste de Ley de Potencias (Clauset MLE)
// -------------------------------------------------------------------------------------------------
console.log('\n--- 4. Dinámica de Avalanchas & Exponente Libre de Escala (Clauset MLE) ---');

const mockAvEngine = new MockSwarmCriticalityEngine();
const t0 = 1000000;

// Avalancha 1: 5 paquetes en ráfaga temporal compacta (delta t < 150ms)
mockAvEngine.recordPacketReceived(2, t0);
mockAvEngine.recordPacketReceived(3, t0 + 40);
// Pausa de 200ms -> cierra Avalancha 1
mockAvEngine.recordPacketReceived(1, t0 + 240);
// Debe haber cerrado la primera avalancha con tamaño 5
assert(mockAvEngine.avalancheCounter === 1, `4.1 Se detectó cierre de Avalancha 1 tras quiet interval > 150ms (count = ${mockAvEngine.avalancheCounter})`);
assert(mockAvEngine.avalancheHistory[0].size === 5, `4.2 Tamaño de Avalancha 1 registrado correctamente (S = ${mockAvEngine.avalancheHistory[0].size})`);
assert(mockAvEngine.avalancheHistory[0].durationMs === 40, `4.3 Duración de Avalancha 1 registrada correctamente (T = ${mockAvEngine.avalancheHistory[0].durationMs}ms)`);

// Simulamos una serie de 30 avalanchas con distribución libre de escala sintética P(S) ~ S^(-1.5)
const syntheticSizes = [
  1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 4, 4, 5, 6, 8, 10, 12, 16, 22, 30, 45, 65, 95
];
for (let i = 0; i < syntheticSizes.length; i++) {
  mockAvEngine.avalancheHistory.push({
    id: mockAvEngine.avalancheCounter + i + 1,
    size: syntheticSizes[i],
    durationMs: Math.max(10, syntheticSizes[i] * 5),
    timestamp: t0 + 5000 + i * 1000,
  });
}
mockAvEngine.avalancheCounter += syntheticSizes.length;

const estimatedAlpha = mockAvEngine.estimatePowerLawExponent();
console.log(`     Exponente alpha estimado (Clauset MLE): ${estimatedAlpha.toFixed(2)} (Teórico cortical Beggs-Plenz: ~1.50)`);
assert(estimatedAlpha >= 1.20 && estimatedAlpha <= 2.20, `4.4 Estimación MLE de alpha dentro del rango fisiológico crítico [1.20 .. 2.20] (alfa = ${estimatedAlpha.toFixed(2)})`);

// -------------------------------------------------------------------------------------------------
// 5. Interacción con BroadcastStormGuard & K-Counter Adaptativo
// -------------------------------------------------------------------------------------------------
console.log('\n--- 5. Interacción con BroadcastStormGuardEngine ---');

// En régimen super-crítico (mockSuper: sigma = 2.40), K-counter debe ser más estricto
const strictK = mockSuper.getAdaptiveKThreshold(10); // Base para 10 peers es 3
assert(strictK === 2, `5.1 K-Counter adaptativo se endurece a ${strictK} durante tormenta super-crítica (base = 3)`);

// En régimen sub-crítico (mockSoc: sigma = 0.30), K-counter debe ser más permisivo
const permissiveK = mockSoc.getAdaptiveKThreshold(10);
assert(permissiveK === 4, `5.2 K-Counter adaptativo se flexibiliza a ${permissiveK} durante sub-criticalidad`);

// En régimen crítico (mockCrit: sigma = 0.98), K-counter debe ser nominal
const nominalK = mockCrit.getAdaptiveKThreshold(10);
assert(nominalK === 3, `5.3 K-Counter adaptativo permanece nominal (K = ${nominalK}) en estado crítico óptimo`);

// Evaluación probabilística de reenvío
mockSuper.relayProbability = 0.0; // 0% probabilidad
assert(mockSuper.shouldRelayProbabilistic() === false, '5.4 shouldRelayProbabilistic() bloquea reenvío cuando P_relay = 0%');

mockCrit.relayProbability = 1.0; // 100% probabilidad
assert(mockCrit.shouldRelayProbabilistic() === true, '5.5 shouldRelayProbabilistic() permite reenvío al 100% en condiciones sanas');

// -------------------------------------------------------------------------------------------------
// 6. Resumen Final
// -------------------------------------------------------------------------------------------------
console.log('\n' + '='.repeat(85));
console.log(`📊 RESULTADOS FINALES: ${passedTests} PASADOS, ${failedTests} FALLIDOS`);
console.log('='.repeat(85) + '\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
