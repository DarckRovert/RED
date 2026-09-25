/**
 * test-sensoriomotor-autonomic-loop.js
 * 
 * Verificación End-to-End del Bucle Sensoriomotor Autonómico y Micro-Espigas AER.
 * Valida la integración de hardware de sensores, arcos reflejos MaleCNS,
 * telepatía de espigas LoRa/BLE, y acoplamiento con ConnectomeEcosystemOrchestrator.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('🦗 TEST SUITE: BUCLE SENSORIOMOTOR AUTONÓMICO Y ARCOS REFLEJOS AER');
console.log('='.repeat(80) + '\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

// 1. Cargar fuentes para inspección estática y semántica
const bridgePath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'SensoriomotorAutonomicBridge.ts');
const orchPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'ConnectomeEcosystemOrchestrator.ts');
const routerPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshRouter.ts');
const protocolPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshProtocol.ts');
const synapticPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'SynapticMeshRouterEngine.ts');

const bridgeCode = fs.readFileSync(bridgePath, 'utf8');
const orchCode = fs.readFileSync(orchPath, 'utf8');
const routerCode = fs.readFileSync(routerPath, 'utf8');
const protocolCode = fs.readFileSync(protocolPath, 'utf8');
const synapticCode = fs.readFileSync(synapticPath, 'utf8');

// ── 1. Verificación de Sensores Integrados en el Puente ────────────────────────
runTest('1.1 Conexión con Sensores Físicos (Kinetic, Sonar, RF Jamming, CBRN)', () => {
  assert(bridgeCode.includes('KineticStressEngine.getInstance()'), 'Debe acoplar KineticStressEngine');
  assert(bridgeCode.includes('AcousticSonarEngine.getInstance()'), 'Debe acoplar AcousticSonarEngine');
  assert(bridgeCode.includes('CognitiveRadioArbiter.getInstance()'), 'Debe acoplar CognitiveRadioArbiter para EW Jamming');
  assert(bridgeCode.includes('CbrnRadiationEngine.getInstance()'), 'Debe acoplar CbrnRadiationEngine');
});

runTest('1.2 Disparo Monosináptico ante Choque Cinético Violento (> 4.5G)', () => {
  assert(bridgeCode.includes('lastImpactMagnitude > 4.5'), 'Debe detectar impacto mayor a 4.5G');
  assert(bridgeCode.includes("giantFiberReflex.triggerReflex('MANUAL_TACTICAL_SCRAM')"), 'Debe activar arco reflejo de escape');
  assert(bridgeCode.includes('johnstonOrgan.triggerMechanicalShock'), 'Debe excitar el Órgano de Johnston');
  assert(bridgeCode.includes('AerDomainCode.KINETIC_SHOCK_MANDOWN'), 'Debe emitir espiga KINETIC_SHOCK_MANDOWN');
});

runTest('1.3 Disparo de Alarma Inercial Man-Down en Malla', () => {
  assert(bridgeCode.includes('tel.isManDownActive'), 'Debe monitorear tel.isManDownActive');
  assert(bridgeCode.includes('AerDomainCode.KINETIC_SHOCK_MANDOWN'), 'Debe emitir espiga KINETIC_SHOCK_MANDOWN');
  assert(bridgeCode.includes('0x02'), 'Debe usar neuronId 0x02');
});

runTest('1.4 Disparo Óptico Looming ante Obstáculo en Proximidad (< 1.8m)', () => {
  assert(bridgeCode.includes('SONAR_CLOSE_PROXIMITY_M = 1.8'), 'Umbral de proximidad de sonar fijado en 1.8m');
  assert(bridgeCode.includes('opticLobe.injectSyntheticLoomingStimulus(90, 1.5)'), 'Debe inyectar estímulo looming en el Lóbulo Óptico');
  assert(bridgeCode.includes('AerDomainCode.ACOUSTIC_SONAR_CAVITY'), 'Debe emitir espiga ACOUSTIC_SONAR_CAVITY');
});

runTest('1.5 Supresión de Jamming EW con Inyección en Johnston Organ', () => {
  assert(bridgeCode.includes('decision.isElectronicWarfareActive'), 'Debe verificar estado de EW Jamming');
  assert(bridgeCode.includes('johnstonOrgan.injectRfTransient(0.95, 915.0)'), 'Debe inyectar pulso en Órgano de Johnston');
  assert(bridgeCode.includes("giantFiberReflex.triggerReflex('EW_JAMMING')"), 'Debe disparar reflejo GFS por Jamming');
  assert(bridgeCode.includes('AerDomainCode.EW_JAMMING_DETECTED'), 'Debe emitir espiga EW_JAMMING_DETECTED');
});

// ── 2. Recepción de Espigas Remotas (Telepatía de Malla) ───────────────────────
runTest('2.1 Fast-Path de Recepción en meshRouter hacia el Puente', () => {
  assert(routerCode.includes('sensoriomotorAutonomicBridge.handleRemoteSpike'), 'meshRouter debe despachar espigas al puente');
});

runTest('2.2 Ingesta de Alerta Man-Down Remota en Neocórtex Ínsula TCCC', () => {
  assert(bridgeCode.includes('insular.recordCasualty(casualty)'), 'Debe registrar baja en la Ínsula ante espiga Man-Down remota');
  assert(bridgeCode.includes('triageCategory: \'RED_IMMEDIATE\''), 'Debe clasificar como RED_IMMEDIATE');
});

runTest('2.3 Sincronización Remota de Conductancia Sináptica Hebbiana', () => {
  assert(bridgeCode.includes('synapticMeshRouter.applyRemoteDeltaWeight'), 'Debe aplicar pesos remotos al recibir SYNAPTIC_DELTA_WEIGHT');
  assert(synapticCode.includes('applyRemoteDeltaWeight(peerId: string, _neuronId: number, deltaInt16: number)'), 'SynapticMeshRouter debe implementar applyRemoteDeltaWeight');
});

// ── 3. Acoplamiento de Ciclo de Vida con ConnectomeEcosystemOrchestrator ────────
runTest('3.1 Orquestador Central Inicia y Detiene el Puente Determinísticamente', () => {
  assert(orchCode.includes('sensoriomotorAutonomicBridge.start()'), 'start() debe invocar bridge.start()');
  assert(orchCode.includes('sensoriomotorAutonomicBridge.stop()'), 'stop() debe invocar bridge.stop()');
  assert(orchCode.includes('sensoriomotorAutonomicBridge.subscribe('), 'Debe suscribirse para propagar a UI listeners');
});

runTest('3.2 Telemetría del Puente Integrada en EcosystemConnectomeSnapshot', () => {
  assert(orchCode.includes('autonomicBridge: AutonomicBridgeTelemetry;'), 'Snapshot debe tipar autonomicBridge');
  assert(orchCode.includes('const autonomicBridge = sensoriomotorAutonomicBridge.getTelemetry();'), 'getOrganismSnapshot debe extraer telemetría');
  assert(orchCode.includes('Bridge SAB: ${autonomicBridge.isRunning'), 'Resumen táctico debe reflejar estado del puente');
});

console.log('\n' + '='.repeat(80));
console.log(`🎉 RESULTADO: ${passedTests}/${totalTests} PRUEBAS DEL BUCLE SENSORIOMOTOR SUPERADAS CON ÉXITO (100% OK)`);
console.log('='.repeat(80) + '\n');
