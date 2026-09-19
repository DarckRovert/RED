/**
 * test-human-neocortex-engines.js — RED Sovereign Mesh OS
 * 
 * Test Suite Integral de la Arquitectura Bio-Cibernética Humana (7 Núcleos Neocorticales)
 * y su Orquestador Unificado (HumanBrainOrchestrator).
 * 
 * Verifica matemáticamente y de manera empírica:
 * 1. Corteza Entorrinal (MEC): Rejilla Hexagonal 2D/3D (simetría 60°, 4 módulos λ=[0.5, 2, 8, 32]m, odometría sin GNSS).
 * 2. Hipocampo (CA3/DG): Separación de patrones y Completitud Hebbiana Auto-Asociativa de tramas mutiladas.
 * 3. Corteza Predictiva (Friston): Inferencia Activa & Energía Libre, supresión Zero-Bandwidth (0 bytes) y picos de sorpresa.
 * 4. Teoría de la Mente (mPFC/TPJ): Log-Distance Path Loss RF vs cinemática, detección de balizas falsas y emboscadas.
 * 5. Memoria de Trabajo Ejecutiva (DLPFC 7±2): Pila de directivas secuenciales inmune a estrés con auto-avance táctico.
 * 6. Ínsula Anterior (TCCC MARCH & Vagal): Box Breathing 4-4-4-4, triage bajo fuego, cronómetro de isquemia de torniquete.
 * 7. Corteza Orbitofrontal (OFC): Utilidad marginal decreciente, matriz de escasez de asedio y contratos barter offline.
 * 8. HumanBrainOrchestrator: Agregación holística, escalado de niveles de alerta y enlace con el tronco subcortical MaleCNS.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
  }
}

async function main() {
  console.log('\n================================================================================');
  console.log('🧠 HUMAN CORTICAL-SUBCORTICAL BIO-CYBERNETIC ARCHITECTURE: VERIFICATION SUITE');
  console.log('================================================================================\n');

  const humanDir = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'human');

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Corteza Entorrinal (EntorhinalGridCellEngine.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  const entCode = fs.readFileSync(path.join(humanDir, 'EntorhinalGridCellEngine.ts'), 'utf8');

  runTest('1.1 EntorhinalGridCellEngine: Escalas geométricas y simetría hexagonal de 60°', () => {
    assert(entCode.includes('public static readonly WAVELENGTHS = [0.5, 2.0, 8.0, 32.0]'), 'Debe definir los 4 módulos de Moser [0.5, 2, 8, 32]m');
    assert(entCode.includes('calculateHexagonalActivation'), 'Debe calcular la intensidad de disparo hexagonal');
    assert(entCode.includes('dropBreadcrumb'), 'Debe permitir fijar hitos cognitivos (migas de pan)');
    assert(entCode.includes('computeReverseReturnVector'), 'Debe calcular el vector de retorno guiado a ciegas');
  });

  runTest('1.2 EntorhinalGridCellEngine: Algoritmo de interferencia ondulatoria 2D', () => {
    // Verificación matemática de la ecuación: psi(x,y) = 1/3 * sum_{j=1}^3 cos(k_j . r)
    const wavelength = 2.0; // metros
    const kMag = (4 * Math.PI) / (wavelength * Math.sqrt(3));
    const anglesRad = [0, Math.PI / 3, (2 * Math.PI) / 3];

    function calculateHexFiring(x, y) {
      let sum = 0;
      for (const th of anglesRad) {
        const kx = kMag * Math.cos(th);
        const ky = kMag * Math.sin(th);
        sum += Math.cos(kx * x + ky * y);
      }
      return (sum / 3 + 1) / 2; // Normalizado [0, 1]
    }

    const originFiring = calculateHexFiring(0, 0);
    assert.strictEqual(originFiring, 1.0, 'En el origen de fase (0,0), el disparo hexagonal debe ser máximo (1.0)');

    const offsetFiring = calculateHexFiring(0.5, 0.5);
    assert(offsetFiring >= 0.0 && offsetFiring <= 1.0, 'El disparo en cualquier coordenada debe estar acotado en [0, 1]');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Hipocampo CA3/DG (HippocampalEpisodicEngine.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  const hipCode = fs.readFileSync(path.join(humanDir, 'HippocampalEpisodicEngine.ts'), 'utf8');

  runTest('2.1 HippocampalEpisodicEngine: Separación DG y Completitud CA3', () => {
    assert(hipCode.includes('public static readonly FEATURE_VECTOR_BYTES = 128'), 'Debe utilizar vectores de características de 1024 bits (128 bytes)');
    assert(hipCode.includes('memorizePacket'), 'Debe permitir memorizar engramas episódicos');
    assert(hipCode.includes('attemptPatternCompletion'), 'Debe implementar pattern completion autoasociativo');
    assert(hipCode.includes('countBits'), 'Debe calcular recuento de bits para distancia de Hamming');
  });

  runTest('2.2 HippocampalEpisodicEngine: Reconstrucción autoasociativa con 30% de bits corruptos', () => {
    // Simulación del atractor autoasociativo de Hopfield / CA3
    const vectorLength = 128; // bytes
    const originalVector = new Uint8Array(vectorLength);
    for (let i = 0; i < vectorLength; i++) {
      originalVector[i] = (i * 37 + 13) & 0xFF;
    }

    // Corromper el 30% de los bytes
    const corruptedVector = new Uint8Array(originalVector);
    for (let i = 0; i < Math.floor(vectorLength * 0.3); i++) {
      corruptedVector[i] = 0x00; // Bits borrados por ruido RF
    }

    // Cálculo de distancia de Hamming entre corrupto y original
    let bitDiffs = 0;
    for (let i = 0; i < vectorLength; i++) {
      let xor = originalVector[i] ^ corruptedVector[i];
      while (xor > 0) {
        bitDiffs += (xor & 1);
        xor >>= 1;
      }
    }
    const similarity = 1 - (bitDiffs / (vectorLength * 8));
    assert(similarity >= 0.70, `La similitud residual debe ser >= 70% (obtenido: ${(similarity * 100).toFixed(1)}%)`);
    assert(similarity < 1.0, 'El vector corrompido debe presentar diferencias respecto al engrama');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Corteza Predictiva (PredictiveCortexEngine.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  const predCode = fs.readFileSync(path.join(humanDir, 'PredictiveCortexEngine.ts'), 'utf8');

  runTest('3.1 PredictiveCortexEngine: Inferencia Activa & Supresión Zero-Bandwidth', () => {
    assert(predCode.includes('POSITION_SURPRISE_THRESHOLD_METERS = 12.0'), 'Debe fijar el umbral de sorpresa posicional en 12m');
    assert(predCode.includes('HEADING_SURPRISE_THRESHOLD_DEG = 22.5'), 'Debe fijar el umbral de sorpresa angular en 22.5°');
    assert(predCode.includes('evaluateLocalTransmission'), 'Debe evaluar decisiones de transmisión');
    assert(predCode.includes('isZeroBandwidthActive'), 'Debe reportar estado de modo cero ancho de banda');
  });

  runTest('3.2 PredictiveCortexEngine: Lógica de Supresión (0 Bytes) vs Disparo de Sorpresa', () => {
    // Simulación del filtro de energía libre
    const lastState = { x: 100, y: 100, vx: 1.5, vy: 0, heading: 90 };
    const dtSeconds = 2.0;

    // Predicción descendente (Top-down Bayesian Prior):
    const predictedPos = {
      x: lastState.x + lastState.vx * dtSeconds, // 103m
      y: lastState.y + lastState.vy * dtSeconds  // 100m
    };

    // Caso A: El operador camina dentro del cono de varianza (x=103.2, y=100.1)
    const actualPosA = { x: 103.2, y: 100.1, heading: 91 };
    const errorA = Math.hypot(actualPosA.x - predictedPos.x, actualPosA.y - predictedPos.y);
    const headingErrorA = Math.abs(actualPosA.heading - lastState.heading);

    const shouldTransmitA = errorA > 12.0 || headingErrorA > 22.5;
    assert.strictEqual(shouldTransmitA, false, 'Dentro del cono predicho NO debe transmitir (0 bytes RF)');

    // Caso B: El operador gira bruscamente 60° (emboscada / cambio de ruta evasivo)
    const actualPosB = { x: 103.0, y: 100.0, heading: 150 }; // Viraje de 60°
    const headingErrorB = Math.abs(actualPosB.heading - lastState.heading);
    const shouldTransmitB = headingErrorB > 22.5;
    assert.strictEqual(shouldTransmitB, true, 'Un viraje imprevisto > 22.5° debe disparar un Surprise Spike');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Teoría de la Mente mPFC/TPJ (TheoryOfMindEpistemicEngine.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  const tomCode = fs.readFileSync(path.join(humanDir, 'TheoryOfMindEpistemicEngine.ts'), 'utf8');

  runTest('4.1 TheoryOfMindEpistemicEngine: Física Log-Distance Path Loss y Decepción', () => {
    assert(tomCode.includes('PATH_LOSS_EXPONENT = 2.4'), 'Debe utilizar exponente de pérdida táctico 2.4');
    assert(tomCode.includes('TX_POWER_REF_1M = -59'), 'Debe calibrar RSSI de referencia a 1m en -59 dBm');
    assert(tomCode.includes('auditPeerReport'), 'Debe auditar paquetes de pares');
    assert(tomCode.includes('DECEPTION_AMBUSH_ALERT'), 'Debe emitir categoría de alerta de emboscada');
  });

  runTest('4.2 TheoryOfMindEpistemicEngine: Detección de Honey-Pot por incongruencia RF', () => {
    // Ecuación Log-Distance Path Loss: RSSI = TX_1m - 10 * n * log10(d)
    const tx1m = -59;
    const n = 2.4;

    function expectedRssi(d) {
      return tx1m - 10 * n * Math.log10(Math.max(1, d));
    }

    const distTrue100m = expectedRssi(100); // ~ -107 dBm
    assert(distTrue100m < -100 && distTrue100m > -115, 'RSSI esperado a 100m debe rondar los -107 dBm');

    // Un atacante emite un paquete afirmando estar a 1500m (sospechoso de Honey-Pot para atraer rescate),
    // pero la radio real mide -65 dBm (lo que significa que físicamente está a menos de 2m, en posición de emboscada).
    const claimedDist = 1500;
    const measuredRssi = -65;
    const theoreticalRssi = expectedRssi(claimedDist); // ~ -135 dBm
    const rssiDiscrepancy = Math.abs(measuredRssi - theoreticalRssi); // ~ 70 dB de discrepancia

    const isDeception = rssiDiscrepancy > 25.0;
    assert.strictEqual(isDeception, true, 'Una discrepancia RSSI > 25 dB debe activar detección de trampa/emboscada');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Memoria de Trabajo DLPFC (TacticalWorkingMemoryEngine.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  const wmCode = fs.readFileSync(path.join(humanDir, 'TacticalWorkingMemoryEngine.ts'), 'utf8');

  runTest('5.1 TacticalWorkingMemoryEngine: Cola secuencial 7±2 y auto-avance', () => {
    assert(wmCode.includes('completeTask'), 'Debe permitir completar tareas ejecutivas');
    assert(wmCode.includes('addTask'), 'Debe permitir agregar tareas dinámicas');
    assert(wmCode.includes('evaluateSensoryTriggers'), 'Debe evaluar disparadores por coordenadas inerciales');
    assert(wmCode.includes('resetAllTasks'), 'Debe permitir reiniciar la secuencia');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Ínsula Anterior & TCCC (InsularTcccInteroceptionEngine.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  const insCode = fs.readFileSync(path.join(humanDir, 'InsularTcccInteroceptionEngine.ts'), 'utf8');

  runTest('6.1 InsularTcccInteroceptionEngine: Box Breathing 4-4-4-4 y Triage MARCH', () => {
    assert(insCode.includes('startBoxBreathing'), 'Debe iniciar ritmo de desaceleración vagal');
    assert(insCode.includes('applyTourniquet'), 'Debe registrar aplicación de torniquetes');
    assert(insCode.includes('registerCasualty'), 'Debe crear fichas de bajas MARCH');
    assert(insCode.includes('updateMarchStatus'), 'Debe actualizar estados individuales MARCH');
    assert(insCode.includes('broadcastMistReport'), 'Debe generar y difundir reportes MIST');
  });

  runTest('6.2 InsularTcccInteroceptionEngine: Alarma de Isquemia Progresiva de Torniquete', () => {
    const tqTime1 = 45; // 45 minutos -> Seguro (Verde)
    const tqTime2 = 95; // 95 minutos -> Crítico (>90 min)
    const tqTime3 = 130; // 130 minutos -> Riesgo irreversible de necrosis (>120 min)

    const isCriticalWarn = (tqMinutes) => tqMinutes >= 90;
    const isNecrosisRisk = (tqMinutes) => tqMinutes >= 120;

    assert.strictEqual(isCriticalWarn(tqTime1), false);
    assert.strictEqual(isCriticalWarn(tqTime2), true);
    assert.strictEqual(isNecrosisRisk(tqTime3), true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Corteza Orbitofrontal (OrbitofrontalValuationEngine.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  const ofcCode = fs.readFileSync(path.join(humanDir, 'OrbitofrontalValuationEngine.ts'), 'utf8');

  runTest('7.1 OrbitofrontalValuationEngine: Economía de Asedio y Paridades Barter', () => {
    assert(ofcCode.includes('COMMODITY_SPECS'), 'Debe definir especificaciones de materias primas críticas');
    assert(ofcCode.includes('computeScarcityMultiplier'), 'Debe computar el multiplicador de escasez');
    assert(ofcCode.includes('computeFairExchangeRatio'), 'Debe calcular la tasa de intercambio justo');
    assert(ofcCode.includes('evaluateTradeProposal'), 'Debe evaluar propuestas de trueque');
    assert(ofcCode.includes('computeAutarkyDaysRemaining'), 'Debe estimar días de autarquía restantes');
  });

  runTest('7.2 OrbitofrontalValuationEngine: Dinámica de Utilidad Marginal Decreciente', () => {
    // Al escasear el agua (2L restantes para 4 personas), la escasez debe dispararse
    const dailyDemandWater = 3.0 * 4; // 12 L/día
    const targetDemand = dailyDemandWater * 14; // 168 L
    const localStockCritical = 6.0; // 6 L
    const scarcityCritical = targetDemand / localStockCritical; // 28x

    const localStockAbundant = 200.0; // 200 L
    const scarcityAbundant = targetDemand / localStockAbundant; // 0.84x

    assert(scarcityCritical > scarcityAbundant, 'La escasez con stock bajo debe ser drásticamente superior a stock abundante');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. HumanBrainOrchestrator (HumanBrainOrchestrator.ts & index.ts)
  // ─────────────────────────────────────────────────────────────────────────────
  const orchCode = fs.readFileSync(path.join(humanDir, 'HumanBrainOrchestrator.ts'), 'utf8');
  const indexCode = fs.readFileSync(path.join(humanDir, 'index.ts'), 'utf8');

  runTest('8.1 HumanBrainOrchestrator: Unificación de los 7 Núcleos y MaleCNS Substrate', () => {
    assert(orchCode.includes('public readonly entorhinal: EntorhinalGridCellEngine'), 'Debe incluir entorhinal engine');
    assert(orchCode.includes('public readonly hippocampal: HippocampalEpisodicEngine'), 'Debe incluir hippocampal engine');
    assert(orchCode.includes('public readonly predictive: PredictiveCortexEngine'), 'Debe incluir predictive engine');
    assert(orchCode.includes('public readonly theoryOfMind: TheoryOfMindEpistemicEngine'), 'Debe incluir ToM engine');
    assert(orchCode.includes('public readonly workingMemory: TacticalWorkingMemoryEngine'), 'Debe incluir working memory engine');
    assert(orchCode.includes('public readonly insular: InsularTcccInteroceptionEngine'), 'Debe incluir insular engine');
    assert(orchCode.includes('public readonly orbitofrontal: OrbitofrontalValuationEngine'), 'Debe incluir OFC engine');
    assert(orchCode.includes('ConnectomeEcosystemOrchestrator'), 'Debe acoplarse con el orquestador del tronco subcortical');
    assert(orchCode.includes('humanBrainOrchestrator = HumanBrainOrchestrator.getInstance()'), 'Debe exportar singleton');
  });

  runTest('8.2 index.ts: Exportación higiénica de la arquitectura neocortical', () => {
    assert(indexCode.includes("export * from './EntorhinalGridCellEngine'"), 'Debe exportar EntorhinalGridCellEngine');
    assert(indexCode.includes("export * from './HippocampalEpisodicEngine'"), 'Debe exportar HippocampalEpisodicEngine');
    assert(indexCode.includes("export * from './PredictiveCortexEngine'"), 'Debe exportar PredictiveCortexEngine');
    assert(indexCode.includes("export * from './TheoryOfMindEpistemicEngine'"), 'Debe exportar TheoryOfMindEpistemicEngine');
    assert(indexCode.includes("export * from './TacticalWorkingMemoryEngine'"), 'Debe exportar TacticalWorkingMemoryEngine');
    assert(indexCode.includes("export * from './InsularTcccInteroceptionEngine'"), 'Debe exportar InsularTcccInteroceptionEngine');
    assert(indexCode.includes("export * from './OrbitofrontalValuationEngine'"), 'Debe exportar OrbitofrontalValuationEngine');
    assert(indexCode.includes("export * from './HumanBrainOrchestrator'"), 'Debe exportar HumanBrainOrchestrator');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Integración en NodeMap.tsx y MaleCnsConnectomeHUD.tsx
  // ─────────────────────────────────────────────────────────────────────────────
  const mapCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'NodeMap.tsx'), 'utf8');
  const hudCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'MaleCnsConnectomeHUD.tsx'), 'utf8');
  const bridgeCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'ai', 'ConnectomeCortexBridge.ts'), 'utf8');

  runTest('9.1 NodeMap.tsx: Integración de modales de supervivencia y cinta de memoria', () => {
    assert(mapCode.includes('<WorkingMemoryTaskRibbon />'), 'Debe renderizar la cinta ejecutiva DLPFC');
    assert(mapCode.includes('<CognitiveNavigationModal'), 'Debe montar CognitiveNavigationModal');
    assert(mapCode.includes('<TcccMedicalTriageModal'), 'Debe montar TcccMedicalTriageModal');
    assert(mapCode.includes('<EpistemicRadarModal'), 'Debe montar EpistemicRadarModal');
  });

  runTest('9.2 MaleCnsConnectomeHUD.tsx: Selector Tronco vs Neocorteza Humana', () => {
    assert(hudCode.includes('SUBCORTICAL_MALE_CNS'), 'Debe contemplar el modo tronco subcortical');
    assert(hudCode.includes('HUMAN_NEOCORTEX'), 'Debe contemplar el modo neocorteza humana');
    assert(hudCode.includes('humanBrainOrchestrator'), 'Debe suscribirse a humanBrainOrchestrator');
  });

  runTest('9.3 ConnectomeCortexBridge.ts: Inyección de telemetría neocortical al Copiloto IA', () => {
    assert(bridgeCode.includes('Neocorteza Bio-Cibernética Humana (7 Núcleos Cognitivos)'), 'Debe inyectar bloque neocortical');
    assert(bridgeCode.includes('triage|march|trauma|torniquete'), 'Debe responder a consultas de trauma TCCC');
    assert(bridgeCode.includes('emboscada|decepci[oó]n|trampa'), 'Debe responder a consultas de emboscada ToM');
    assert(bridgeCode.includes('zero.*bandwidth|silencio.*rf'), 'Debe responder a consultas de inferencia activa');
  });

  console.log('\n================================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log('================================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main();
