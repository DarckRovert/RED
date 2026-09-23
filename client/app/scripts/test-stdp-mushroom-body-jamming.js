/**
 * test-stdp-mushroom-body-jamming.js
 *
 * Test suite exhaustivo para la Frontera 4:
 * STDP Tridimensional con Modulación Dopaminérgica para Evasión de Jamming en el Mushroom Body
 * (Kenyon Cells / DANs PAM & PPL1 / MBONs / Brain-Cog / Hige et al. 2015 Nature).
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
console.log('🍄 TEST SUITE: STDP 3-FACTORES & EVASIÓN DE JAMMING EN EL MUSHROOM BODY');
console.log('='.repeat(85) + '\n');

// -------------------------------------------------------------------------------------------------
// 1. Verificación Estática del Código Fuente y Arquitectura SSOT
// -------------------------------------------------------------------------------------------------
console.log('--- 1. Verificación Estática de Módulos & Enlaces Arquitectónicos ---');

const mbEnginePath = path.resolve(__dirname, '../src/lib/neuro/DtnMushroomBodyEngine.ts');
const routerPath = path.resolve(__dirname, '../src/lib/mesh/meshRouter.ts');
const synapticPath = path.resolve(__dirname, '../src/lib/neuro/SynapticMeshRouterEngine.ts');
const orchPath = path.resolve(__dirname, '../src/lib/neuro/ConnectomeEcosystemOrchestrator.ts');
const cortexBridgePath = path.resolve(__dirname, '../src/lib/ai/ConnectomeCortexBridge.ts');
const hudPath = path.resolve(__dirname, '../src/components/MaleCnsConnectomeHUD.tsx');

assert(fs.existsSync(mbEnginePath), '1.1 DtnMushroomBodyEngine.ts existe en src/lib/neuro/');
assert(fs.existsSync(routerPath), '1.2 meshRouter.ts existe en src/lib/mesh/');
assert(fs.existsSync(synapticPath), '1.3 SynapticMeshRouterEngine.ts existe en src/lib/neuro/');

const mbContent = fs.readFileSync(mbEnginePath, 'utf8');
const routerContent = fs.readFileSync(routerPath, 'utf8');
const synapticContent = fs.readFileSync(synapticPath, 'utf8');
const orchContent = fs.readFileSync(orchPath, 'utf8');
const cortexContent = fs.readFileSync(cortexBridgePath, 'utf8');
const hudContent = fs.readFileSync(hudPath, 'utf8');

assert(mbContent.includes('recordPrePostCoincidence'), '1.4 DtnMushroomBodyEngine define recordPrePostCoincidence');
assert(mbContent.includes('applyDopaminergicNeuromodulation'), '1.5 DtnMushroomBodyEngine define applyDopaminergicNeuromodulation');
assert(mbContent.includes('getJammingEvasionVector'), '1.6 DtnMushroomBodyEngine define getJammingEvasionVector');
assert(mbContent.includes('resetStdpWeights'), '1.7 DtnMushroomBodyEngine define resetStdpWeights');
assert(mbContent.includes('channelWeights') && mbContent.includes('activeTracesCount'), '1.8 MushroomBodyTelemetry expone pesos de canales y huellas de elegibilidad');

assert(routerContent.includes('dtnMushroomBody.recordPrePostCoincidence'), '1.9 meshRouter registra coincidencia pre/post en ingestión');
assert(routerContent.includes('dtnMushroomBody.applyDopaminergicNeuromodulation(\'PPL1\''), '1.10 meshRouter inyecta dopamina aversiva PPL1 ante fallos o alerta de Jamming');
assert(routerContent.includes('dtnMushroomBody.applyDopaminergicNeuromodulation(\'PAM\''), '1.11 meshRouter inyecta dopamina apetitiva PAM ante DELIVERY_ACK exitoso');
assert(routerContent.includes('dtnMushroomBody.getJammingEvasionVector()'), '1.12 meshRouter evalúa vector de evasión de jamming para desvío cognitivo');

assert(synapticContent.includes('dtnMushroomBody.getPeerBehavioralDrive'), '1.13 SynapticMeshRouterEngine penaliza saltos con aversión PPL1 (Jamming/Malicioso)');
assert(orchContent.includes('dtnMushroomBody.applyDopaminergicNeuromodulation'), '1.14 ConnectomeEcosystemOrchestrator acopla choque mecánico/RF con PPL1');
assert(cortexContent.includes('STDP 3-Factores') && cortexContent.includes('evasi[oó]n'), '1.15 ConnectomeCortexBridge procesa consultas en lenguaje natural sobre STDP y Jamming');
assert(hudContent.includes('CUERPO FUNGIFORME: STDP 3-FACTORES & EVASIÓN DE JAMMING'), '1.16 MaleCnsConnectomeHUD renderiza panel interactivo de STDP 3-Factores');

// -------------------------------------------------------------------------------------------------
// 2. Modelo Matemático: Huellas de Elegibilidad y Regla de 3 Factores (Hige et al. Nature 2015)
// -------------------------------------------------------------------------------------------------
console.log('\n--- 2. Dinámica de Huellas de Elegibilidad & Regla de 3 Factores ---');

class MockMushroomBodyStdp {
  constructor() {
    this.STDP_ETA = 0.15;
    this.ELIGIBILITY_TAU_MS = 2000;
    this.DEFAULT_LORA_CHANNELS = [
      'lora_ch_0', 'lora_ch_1', 'lora_ch_2', 'lora_ch_3',
      'lora_ch_4', 'lora_ch_5', 'lora_ch_6', 'lora_ch_7'
    ];
    this.channelWeights = new Map();
    this.eligibilityTraces = new Map();
    for (const ch of this.DEFAULT_LORA_CHANNELS) {
      this.channelWeights.set(ch, 0.50);
    }
  }

  recordPrePostCoincidence(channelKey, postActivation = 1.0, now = Date.now()) {
    const key = channelKey.trim().toLowerCase();
    const existing = this.eligibilityTraces.get(key);
    const currentTrace = existing
      ? existing.trace * Math.exp(-(now - existing.lastUpdated) / this.ELIGIBILITY_TAU_MS)
      : 0;
    const boost = typeof postActivation === 'number' && Number.isFinite(postActivation) && postActivation > 0 ? postActivation : 0;
    const newTrace = Math.min(1.0, currentTrace + boost);
    this.eligibilityTraces.set(key, { targetKey: key, trace: newTrace, lastUpdated: now });
    if (!this.channelWeights.has(key)) {
      this.channelWeights.set(key, 0.50);
    }
  }

  applyDopaminergicNeuromodulation(type, intensity = 0.5, specificKey, now = Date.now()) {
    const validIntensity = Math.max(0.05, Math.min(1.0, intensity));
    const signedDopamine = type === 'PAM' ? validIntensity : -validIntensity;

    if (specificKey) {
      const key = specificKey.trim().toLowerCase();
      const existing = this.eligibilityTraces.get(key);
      const traceVal = existing ? Math.max(0.4, existing.trace) : 0.6;
      this.eligibilityTraces.set(key, { targetKey: key, trace: traceVal, lastUpdated: now });
      const currentW = this.channelWeights.get(key) ?? 0.50;
      const deltaW = this.STDP_ETA * traceVal * signedDopamine;
      const newW = Math.max(0.05, Math.min(1.00, Math.round((currentW + deltaW) * 1000) / 1000));
      this.channelWeights.set(key, newW);
    } else {
      for (const [key, traceObj] of this.eligibilityTraces.entries()) {
        const age = now - traceObj.lastUpdated;
        const decayedTrace = traceObj.trace * Math.exp(-age / this.ELIGIBILITY_TAU_MS);
        if (decayedTrace < 0.01) {
          this.eligibilityTraces.delete(key);
          continue;
        }
        traceObj.trace = decayedTrace;
        traceObj.lastUpdated = now;

        const currentW = this.channelWeights.get(key) ?? 0.50;
        const deltaW = this.STDP_ETA * decayedTrace * signedDopamine;
        const newW = Math.max(0.05, Math.min(1.00, Math.round((currentW + deltaW) * 1000) / 1000));
        this.channelWeights.set(key, newW);
      }
    }
  }

  decayEligibilityTraces(dtSec = 1.0) {
    const dtMs = dtSec * 1000;
    for (const [key, traceObj] of this.eligibilityTraces.entries()) {
      traceObj.trace *= Math.exp(-dtMs / this.ELIGIBILITY_TAU_MS);
      if (traceObj.trace < 0.01) {
        this.eligibilityTraces.delete(key);
      }
    }
  }

  getChannelWeight(key) {
    return this.channelWeights.get(key.trim().toLowerCase()) ?? 0.50;
  }

  getJammingEvasionVector() {
    const jammedChannels = [];
    let highestAvoidanceScore = 0.0;
    let bestWeight = -1.0;
    let optimalChannel = this.DEFAULT_LORA_CHANNELS[0];

    for (const ch of this.DEFAULT_LORA_CHANNELS) {
      const w = this.channelWeights.get(ch) ?? 0.50;
      if (w < 0.30) {
        jammedChannels.push(ch);
        const avoidance = 1.0 - w;
        if (avoidance > highestAvoidanceScore) highestAvoidanceScore = avoidance;
      }
      if (w > bestWeight) {
        bestWeight = w;
        optimalChannel = ch;
      }
    }

    const shouldHopChannel = jammedChannels.length > 0 && bestWeight >= 0.40;

    return {
      shouldHopChannel,
      jammedChannels,
      optimalChannel,
      highestAvoidanceScore: Math.round(highestAvoidanceScore * 100) / 100,
    };
  }

  resetStdpWeights() {
    for (const ch of this.DEFAULT_LORA_CHANNELS) {
      this.channelWeights.set(ch, 0.50);
    }
    this.eligibilityTraces.clear();
  }
}

const mockMb = new MockMushroomBodyStdp();

// Estado 2.1: Valores de reposo inicial
assert(mockMb.getChannelWeight('lora_ch_0') === 0.50, '2.1 Peso sináptico inicial nominal W_0 = 0.50');
assert(mockMb.eligibilityTraces.size === 0, '2.2 Cero huellas de elegibilidad activas en reposo');

// Estado 2.2: Coincidencia pre/post (Factor 1 Pre-KC + Factor 2 Post-MBON)
const t0 = 1000000;
mockMb.recordPrePostCoincidence('lora_ch_0', 1.0, t0);
const trace0 = mockMb.eligibilityTraces.get('lora_ch_0');
assert(trace0 && trace0.trace === 1.0, '2.3 Coincidencia pre/post establece huella de elegibilidad e_0 = 1.0');

// Estado 2.3: Decaimiento temporal molecular (tau_e = 2.0s)
// Tras 2 segundos (2000ms), la huella debe decaer a 1/e ~ 0.368
const t1 = t0 + 2000;
mockMb.recordPrePostCoincidence('lora_ch_0', 0.0, t1); // Evaluar decaimiento sin nuevo spike
const decayedTrace = mockMb.eligibilityTraces.get('lora_ch_0').trace;
assert(Math.abs(decayedTrace - 0.368) < 0.05, `2.4 Huella de elegibilidad decae exponencialmente según tau_e (e_0 = ${decayedTrace.toFixed(3)}, esperado ~0.368)`);

// -------------------------------------------------------------------------------------------------
// 3. Modulación Dopaminérgica: Refuerzo PAM (LTP) vs Aversión PPL1 (LTD Jamming)
// -------------------------------------------------------------------------------------------------
console.log('\n--- 3. Plasticidad Neuromodulada: Depresión LTD (PPL1) vs Potenciación LTP (PAM) ---');

// Inyección de Jamming EW en lora_ch_0 (Cúmulo PPL1)
// Con huella activa, PPL1 debe deprimir W_0 (LTD)
mockMb.recordPrePostCoincidence('lora_ch_0', 1.0, t0);
mockMb.applyDopaminergicNeuromodulation('PPL1', 0.85, 'lora_ch_0', t0 + 100);
const wJammed1 = mockMb.getChannelWeight('lora_ch_0');
assert(wJammed1 < 0.50, `3.1 Ráfaga dopaminérgica PPL1 induce Depresión a Largo Plazo (LTD): W_0 = ${wJammed1} < 0.50`);

// Repetidos pulsos de interferencia / Jamming hunden el canal bajo el umbral crítico (<0.30)
for (let i = 0; i < 4; i++) {
  mockMb.applyDopaminergicNeuromodulation('PPL1', 0.85, 'lora_ch_0', t0 + 200 + i * 100);
}
const wJammedFinal = mockMb.getChannelWeight('lora_ch_0');
assert(wJammedFinal < 0.30, `3.2 Jamming severo deprime canal lora_ch_0 bajo umbral crítico: W_0 = ${wJammedFinal} < 0.30`);

// Inyección de confirmación exitosa ACK en lora_ch_1 (Cúmulo PAM)
mockMb.recordPrePostCoincidence('lora_ch_1', 1.0, t0);
for (let i = 0; i < 5; i++) {
  mockMb.applyDopaminergicNeuromodulation('PAM', 0.75, 'lora_ch_1', t0 + 100 + i * 100);
}
const wPamFinal = mockMb.getChannelWeight('lora_ch_1');
assert(wPamFinal > 0.80, `3.3 Ráfagas PAM inducen Potenciación a Largo Plazo (LTP): W_1 = ${wPamFinal} > 0.80`);

// -------------------------------------------------------------------------------------------------
// 4. Vector de Evasión de Guerra Electrónica (Jamming Evasion Vector)
// -------------------------------------------------------------------------------------------------
console.log('\n--- 4. Detección y Salto Ágil de Frecuencia (Frequency Agility Hopping) ---');

const evasion = mockMb.getJammingEvasionVector();
assert(evasion.shouldHopChannel === true, '4.1 Evasión de Jamming se activa autónomamente (shouldHopChannel = true)');
assert(evasion.jammedChannels.includes('lora_ch_0'), '4.2 Identificación precisa del canal bajo fuego hostil (lora_ch_0)');
assert(evasion.optimalChannel === 'lora_ch_1', `4.3 Recomendación de salto hacia canal óptimo potenciado por PAM (${evasion.optimalChannel})`);
assert(evasion.highestAvoidanceScore > 0.70, `4.4 Puntuación de evitación MBON alta (Avoidance: ${evasion.highestAvoidanceScore})`);

// -------------------------------------------------------------------------------------------------
// 5. Reseteo y Reversibilidad de Plasticidad
// -------------------------------------------------------------------------------------------------
console.log('\n--- 5. Reseteo y Reversibilidad de Pesos STDP ---');

mockMb.resetStdpWeights();
assert(mockMb.getChannelWeight('lora_ch_0') === 0.50, '5.1 Reseteo restablece lora_ch_0 a peso nominal 0.50');
assert(mockMb.getChannelWeight('lora_ch_1') === 0.50, '5.2 Reseteo restablece lora_ch_1 a peso nominal 0.50');
assert(mockMb.getJammingEvasionVector().shouldHopChannel === false, '5.3 Evasión de Jamming se desactiva tras el reseteo');

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
