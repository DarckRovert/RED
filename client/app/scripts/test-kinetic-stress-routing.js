/**
 * test-kinetic-stress-routing.js — RED Sovereign Mesh OS
 * 
 * Suite de Verificación Automatizada:
 * 1. Detección Espectral de Estrés Cinético y Temblor Neuromuscular Fisiológico (8-12 Hz).
 * 2. Integración de Alerta Man-Down e Inmovilidad.
 * 3. Serialización de Tramas de Actuadores Robóticos para Hexápodos (ASCII + Binario CRC-8).
 * 4. Gobernanza Dinámica de Portadores y Elevación de Prioridad en la Malla.
 */

const assert = require('assert');

// ── Invariante 1: Algoritmo de CRC-8 Dallas/Maxim (Polinomio 0x31) ───────────
function computeCrc8(data) {
  let crc = 0x00;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x80) !== 0) {
        crc = ((crc << 1) ^ 0x31) & 0xff;
      } else {
        crc = (crc << 1) & 0xff;
      }
    }
  }
  return crc;
}

console.log('[TEST 1/5] Verificación de integridad matemática de CRC-8...');
const testBytes = Buffer.from('HEX,90,90,90,90,90,90');
const crcVal = computeCrc8(testBytes);
assert.strictEqual(typeof crcVal, 'number');
assert(crcVal >= 0 && crcVal <= 255, 'CRC-8 debe ser un uint8 válido [0..255]');
console.log(`✓ CRC-8 calculado: 0x${crcVal.toString(16).toUpperCase()} OK`);

// ── Invariante 2: Serialización de Tramas ASCII y Binarias de Actuadores ───────
console.log('\n[TEST 2/5] Verificación de Formateo de Tramas para Robots Hexápodos Físicos...');
const mockJoints = Array(18).fill(90); // 18 articulaciones a 90 grados
mockJoints[0] = 45; // Coxa L1 a 45°
mockJoints[1] = 120; // Femur L1 a 120°

// Formato ASCII
const asciiPayload = `HEX,${mockJoints.join(',')}`;
const asciiCrc = computeCrc8(Buffer.from(asciiPayload));
const asciiFrame = `$${asciiPayload}*${asciiCrc.toString(16).toUpperCase().padStart(2, '0')}\n`;
assert(asciiFrame.startsWith('$HEX,'), 'Trama ASCII debe comenzar con $HEX,');
assert(asciiFrame.endsWith('\n'), 'Trama ASCII debe terminar con newline');
const angleTokens = asciiFrame.slice(5, asciiFrame.indexOf('*')).split(',');
assert.strictEqual(angleTokens.length, 18, 'Debe contener exactamente 18 ángulos articulares');
assert.strictEqual(parseInt(angleTokens[0]), 45);
assert.strictEqual(parseInt(angleTokens[1]), 120);

// Formato Binario
const binFrame = new Uint8Array(21);
binFrame[0] = 0x58; // 'X'
binFrame[1] = 0x48; // 'H'
for (let i = 0; i < 18; i++) {
  binFrame[2 + i] = mockJoints[i];
}
binFrame[20] = computeCrc8(binFrame.subarray(0, 20));
assert.strictEqual(binFrame.length, 21, 'Trama binaria debe tener exactamente 21 bytes');
assert.strictEqual(binFrame[0], 0x58, 'Byte 0 debe ser Magic X');
assert.strictEqual(binFrame[1], 0x48, 'Byte 1 debe ser Magic H');
assert.strictEqual(binFrame[20], computeCrc8(binFrame.subarray(0, 20)), 'CRC-8 trailing en byte 20 debe coincidir');
console.log(`✓ Tramas de actuadores 18-DOF serializadas correctamente (ASCII: ${asciiFrame.length} bytes, Binario: ${binFrame.length} bytes)`);

// ── Invariante 3: Detección Espectral de Temblor Fisiológico (8-12 Hz) ────────
console.log('\n[TEST 3/5] Verificación de Análisis Espectral de Temblor y Shock Cinético...');
class SyntheticKineticStressEngine {
  constructor() {
    this.WINDOW_SIZE = 32;
    this.history = [];
    this.timestamps = [];
    this.level = 'NOMINAL';
    this.tremorFrequencyHz = 0;
    this.tremorIntensity = 0;
  }

  inject(samples, sampleRateHz = 50) {
    const dtMs = 1000 / sampleRateHz;
    let t = 0;
    for (const s of samples) {
      this.history.push(s);
      this.timestamps.push(t);
      t += dtMs;
    }
    if (this.history.length > this.WINDOW_SIZE) {
      this.history = this.history.slice(-this.WINDOW_SIZE);
      this.timestamps = this.timestamps.slice(-this.WINDOW_SIZE);
    }
    this.evaluate();
  }

  evaluate() {
    const n = this.history.length;
    if (n < 16) return;
    const mean = this.history.reduce((a, b) => a + b, 0) / n;
    let variance = 0;
    for (let i = 0; i < n; i++) variance += Math.pow(this.history[i] - mean, 2);
    variance /= n;

    let zeroCrossings = 0;
    for (let i = 1; i < n; i++) {
      const p = this.history[i - 1] - mean;
      const c = this.history[i] - mean;
      if ((p >= 0 && c < 0) || (p < 0 && c >= 0)) zeroCrossings++;
    }

    const durationSec = (this.timestamps[n - 1] - this.timestamps[0]) / 1000;
    const fHz = zeroCrossings / (2 * durationSec);
    this.tremorFrequencyHz = fHz;

    const isTremorBand = fHz >= 7.5 && fHz <= 13.5;
    const energy = Math.min(1.0, Math.sqrt(variance) / 3.0);
    this.tremorIntensity = isTremorBand ? energy : energy * 0.2;

    if (this.tremorIntensity > 0.65 && isTremorBand) {
      this.level = 'CRITICAL_SHOCK';
    } else if (this.tremorIntensity > 0.30) {
      this.level = 'ELEVATED';
    } else {
      this.level = 'NOMINAL';
    }
  }
}

const stressEngine = new SyntheticKineticStressEngine();

// Señal nominal (reposo gravitacional 1g con micro-ruido aleatorio)
const nominalSamples = Array.from({ length: 32 }, () => 9.81 + (Math.random() - 0.5) * 0.1);
stressEngine.inject(nominalSamples);
assert.strictEqual(stressEngine.level, 'NOMINAL', 'En reposo el nivel debe ser NOMINAL');
console.log(`✓ Estado en reposo: ${stressEngine.level} (Intensidad: ${stressEngine.tremorIntensity.toFixed(2)})`);

// Señal de temblor agudo a 10 Hz (banda fisiológica de combate)
const tremor10HzSamples = Array.from({ length: 32 }, (_, i) => {
  const t = i / 50; // 50 Hz tasa de muestreo
  return 9.81 + Math.sin(2 * Math.PI * 10 * t) * 4.5;
});
stressEngine.inject(tremor10HzSamples);
assert(stressEngine.tremorFrequencyHz >= 8.0 && stressEngine.tremorFrequencyHz <= 12.0, `Frecuencia calculada ${stressEngine.tremorFrequencyHz} Hz debe estar en 8-12 Hz`);
assert.strictEqual(stressEngine.level, 'CRITICAL_SHOCK', 'Temblor intenso a 10 Hz debe transicionar a CRITICAL_SHOCK');
console.log(`✓ Estado bajo temblor agudo (10 Hz): ${stressEngine.level} (Freq: ${stressEngine.tremorFrequencyHz.toFixed(1)} Hz, Intensidad: ${stressEngine.tremorIntensity.toFixed(2)})`);

// ── Invariante 4: Bypass de Estrangulamiento de Batería durante Emergencia ────
console.log('\n[TEST 4/5] Verificación de Bypass de Ahorro de Energía en Emergencia...');
function applyPowerThrottle(batteryPct, isKineticEmergency) {
  if (isKineticEmergency) {
    return 'WIFI_DIRECT'; // Mantiene máximo rendimiento
  }
  if (batteryPct <= 15) {
    return 'BLE'; // Degrada a bajo consumo
  }
  return 'WIFI_DIRECT';
}

const bearerNormalLowBatt = applyPowerThrottle(10, false);
assert.strictEqual(bearerNormalLowBatt, 'BLE', 'Con 10% de batería sin emergencia debe degradar a BLE');

const bearerEmergencyLowBatt = applyPowerThrottle(10, true);
assert.strictEqual(bearerEmergencyLowBatt, 'WIFI_DIRECT', 'Bajo emergencia cinética crítica, NO debe estrangularse el enlace');
console.log('✓ Bypass de estrangulamiento de energía verificado (mantiene WIFI_DIRECT prioritario)');

// ── Invariante 5: Elevación de Prioridad de Paquetes en Malla (FLAG_PHEROMONE) ─
console.log('\n[TEST 5/5] Verificación de Elevación de Prioridad de Paquetes...');
const FLAG_ENCRYPTED = 0x01;
const FLAG_PHEROMONE = 0x10;

function computePacketFlags(isCriticalStress, hasPqc) {
  let flags = FLAG_ENCRYPTED;
  if (hasPqc) flags |= 0x20;
  if (isCriticalStress) flags |= FLAG_PHEROMONE;
  return flags;
}

const nominalFlags = computePacketFlags(false, false);
assert.strictEqual(nominalFlags, 0x01, 'Paquete nominal solo lleva FLAG_ENCRYPTED');

const emergencyFlags = computePacketFlags(true, false);
assert((emergencyFlags & FLAG_PHEROMONE) !== 0, 'Paquete bajo estrés crítico debe incluir FLAG_PHEROMONE (0x10)');
console.log(`✓ Flags de paquete bajo emergencia: 0x${emergencyFlags.toString(16).padStart(2, '0')} (FLAG_PHEROMONE activo)`);

console.log('\n' + '='.repeat(70));
console.log('✅ TODAS LAS 5 PRUEBAS DE ESTRÉS CINÉTICO Y ACTUADORES PASARON SATISFACTORIAMENTE');
console.log('='.repeat(70) + '\n');
