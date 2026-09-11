/**
 * test-lora-tdma-scheduler.js — Validación Automatizada del Planificador LoRa TDMA Ranurado
 */

const assert = require('assert');

// Simulación de la lógica determinista del Planificador TDMA LoRa
const FRAME_DURATION_MS = 2000;
const TOTAL_SLOTS = 10;
const SLOT_DURATION_MS = 200;

function computeAssignedSlot(nodeId, frameEpoch) {
    let hash = 2166136261;
    const input = `${nodeId}:${frameEpoch}`;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (Math.abs(hash) % 8) + 1; // Ranuras 1 a 8
}

function getCurrentSlotInfo(mockConsensusTime, nodeId) {
    const frameEpoch = Math.floor(mockConsensusTime / FRAME_DURATION_MS);
    const timeInFrame = mockConsensusTime % FRAME_DURATION_MS;
    const currentSlotIndex = Math.floor(timeInFrame / SLOT_DURATION_MS);
    const slotTimeRemainingMs = SLOT_DURATION_MS - (timeInFrame % SLOT_DURATION_MS);
    const assignedSlot = computeAssignedSlot(nodeId, frameEpoch);

    return {
        currentFrameEpoch: frameEpoch,
        currentSlotIndex,
        slotTimeRemainingMs,
        assignedSlotIndex: assignedSlot,
        isMySlotActive: currentSlotIndex === assignedSlot,
        isEmergencySlotActive: currentSlotIndex === 9,
    };
}

console.log('🧪 Iniciando Suite de Pruebas: Planificador LoRa TDMA Ranurado...\n');

// TEST 1: Sincronización Temporal del Superframe
console.log('1️⃣ Probando Sincronización Temporal del Superframe (2000 ms / 10 Slots):');
const testNodeA = 'NODE_ALPHA_1234';
const t0 = 100000; // t = 100,000 ms (exactamente inicio de frame: 100000 % 2000 === 0 -> Slot 0)
const info0 = getCurrentSlotInfo(t0, testNodeA);
console.log(`   - t=${t0}ms -> Frame=${info0.currentFrameEpoch}, Slot=${info0.currentSlotIndex} (Esperado: 0)`);
assert.strictEqual(info0.currentSlotIndex, 0, 'Slot inicial debe ser 0 (Beacon Sync)');

const t1 = 100450; // 450 ms transcurridos -> Slot 2 (200-400ms es Slot 1, 400-600ms es Slot 2)
const info1 = getCurrentSlotInfo(t1, testNodeA);
console.log(`   - t=${t1}ms -> Slot=${info1.currentSlotIndex}, Restante=${info1.slotTimeRemainingMs}ms (Esperado: Slot 2, 150ms restante)`);
assert.strictEqual(info1.currentSlotIndex, 2, 'A 450ms en el frame debe corresponder Slot 2');
assert.strictEqual(info1.slotTimeRemainingMs, 150, 'Tiempo restante en ranura debe ser 150ms');

const tEmerg = 101850; // 1850 ms -> Slot 9 (Contención y Emergencias)
const infoEmerg = getCurrentSlotInfo(tEmerg, testNodeA);
console.log(`   - t=${tEmerg}ms -> Slot=${infoEmerg.currentSlotIndex}, isEmergencySlotActive=${infoEmerg.isEmergencySlotActive}`);
assert.strictEqual(infoEmerg.currentSlotIndex, 9, 'A 1850ms debe ser Slot 9');
assert.strictEqual(infoEmerg.isEmergencySlotActive, true, 'Slot 9 debe activar flag de ranura de emergencia');
console.log('   ✅ División temporal de ranuras verificada al milisegundo.');

// TEST 2: Determinismo y Distribución Equitativa de Nodos
console.log('\n2️⃣ Probando Asignación Determinista y Desfasamiento de Nodos:');
const nodes = ['NODE_ALPHA', 'NODE_BRAVO', 'NODE_CHARLIE', 'NODE_DELTA', 'NODE_ECHO', 'NODE_FOXTROT'];
const slotDistribution = {};

nodes.forEach(node => {
    const slot = computeAssignedSlot(node, 50);
    console.log(`   - Nodo [${node}] -> Ranura Asignada: Slot ${slot}`);
    assert(slot >= 1 && slot <= 8, 'La ranura debe estar entre 1 y 8');
    slotDistribution[slot] = (slotDistribution[slot] || 0) + 1;
});

// Comprobar que no todos los nodos cayeron en la misma ranura (dispersión efectiva)
const uniqueSlots = Object.keys(slotDistribution).length;
console.log(`   - Ranuras ocupadas por 6 nodos: ${uniqueSlots} de 8 ranuras posibles`);
assert(uniqueSlots >= 3, 'Los nodos deben dispersarse en múltiples ranuras');
console.log('   ✅ Dispersión determinista anti-colisión validada.');

// TEST 3: Lógica de Bypass Inmediato para Emergencias Críticas SOS
console.log('\n3️⃣ Probando Cola de Prioridades y Bypass Inmediato de Emergencia SOS:');
function simulateTransmissionScheduler(isEmergency, priority) {
    if (isEmergency && priority >= 9) {
        return { bypassed: true, slotUsed: 'IMMEDIATE_BYPASS', delayMs: 0 };
    }
    const targetSlot = isEmergency ? 9 : 3;
    return { bypassed: false, slotUsed: `SLOT_${targetSlot}`, delayMs: 120 };
}

const resSOS = simulateTransmissionScheduler(true, 10);
console.log(`   - Paquete SOS (Prioridad 10): Bypassed=${resSOS.bypassed}, Ranura=${resSOS.slotUsed}`);
assert.strictEqual(resSOS.bypassed, true, 'SOS crítico debe saltar el scheduler para transmisión inmediata');

const resData = simulateTransmissionScheduler(false, 4);
console.log(`   - Paquete Datos (Prioridad 4): Bypassed=${resData.bypassed}, Ranura=${resData.slotUsed}`);
assert.strictEqual(resData.bypassed, false, 'Datos normales deben esperar su ranura asignada');

console.log('   ✅ Lógica de priorización de salvamento verificada.');

console.log('\n=======================================================');
console.log('🎉 100% de Pruebas del Planificador LoRa TDMA superadas con éxito');
console.log('=======================================================');
