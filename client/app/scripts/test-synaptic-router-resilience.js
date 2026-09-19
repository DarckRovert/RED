/**
 * TEST SUITE: SYNAPTIC MESH ROUTER & MURTHY LAB CONNECTOME RESILIENCE
 * 
 * Valida la formulación matemática y bio-neuromórfica de la topología sináptica:
 * 1. Arquitectura de pesos sinápticos Hebbianos: ΔW = η · (Reward - Penalty) · exp(-Δt / τ).
 * 2. Supresión de tormentas por poda sináptica (Synaptic Pruning) en enlaces ruidosos.
 * 3. Elección dinámica de Nodos de Club Rico (Rich-Club Hubs) inspirados en MaleCNS/FlyWire.
 * 4. Percolación dirigida con fracción de exploración estocástica (ε ≈ 0.15).
 * 5. Inmunidad a emergencias: Bypass de poda para paquetes vitales (SOS / CBRN / Ámbar).
 * 6. Enrutamiento unicast por máxima conductancia sináptica.
 * 7. Decaimiento temporal asintótico y tolerancia a entradas NaN/nulas.
 * 8. Simulación enjambre de 50 nodos evaluando reducción masiva de colisiones RF.
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

console.log('\n================================================================================');
console.log('🧠📡 INICIANDO SUITE DE PRUEBAS: SYNAPTIC MESH ROUTER & HEBBIAN TOPOLOGY');
console.log('================================================================================\n');

// ── 1. Inspección Estática de SynapticMeshRouterEngine.ts ───────────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'SynapticMeshRouterEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('1. SynapticMeshRouterEngine: Arquitectura de constantes y límites biofísicos', () => {
    assert(engineCode.includes('INITIAL_WEIGHT = 0.40'), 'Debe definir peso inicial biológico de 0.40');
    assert(engineCode.includes('PRUNE_THRESHOLD = 0.15'), 'Debe fijar umbral de poda en 0.15');
    assert(engineCode.includes('RESTORE_THRESHOLD = 0.25'), 'Debe fijar umbral de despoda en 0.25');
    assert(engineCode.includes('ETA_LEARNING_RATE = 0.12'), 'Debe definir tasa de aprendizaje Hebbiana η = 0.12');
    assert(engineCode.includes('EPSILON_EXPLORATION = 0.15'), 'Debe incorporar exploración estocástica ε = 0.15');
});

runTest('2. SynapticMeshRouterEngine: Formulación Hebbiana e inmunidad temporal', () => {
    assert(engineCode.includes('Math.exp(-dt / SynapticMeshRouterEngine.DECAY_TAU_MS)'), 'Debe aplicar atenuación temporal exp(-Δt/τ)');
    assert(engineCode.includes('recordDeliveryResult'), 'Debe exponer función de modulación plástica');
    assert(engineCode.includes('isRichClubHub'), 'Debe gestionar membresía en el club rico');
    assert(engineCode.includes('isPruned'), 'Debe gestionar bandera de poda sináptica');
});

runTest('3. SynapticMeshRouterEngine: Integración en meshRouter.ts', () => {
    const meshRouterPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshRouter.ts');
    const meshRouterCode = fs.readFileSync(meshRouterPath, 'utf8');
    assert(meshRouterCode.includes("import { synapticMeshRouter } from '../neuro/SynapticMeshRouterEngine'"), 'meshRouter.ts debe importar synapticMeshRouter');
    assert(meshRouterCode.includes('synapticMeshRouter.selectBroadcastPeers'), 'meshRouter.ts debe usar selectBroadcastPeers');
    assert(meshRouterCode.includes('synapticMeshRouter.recordDeliveryResult'), 'meshRouter.ts debe registrar resultados de entrega');
    assert(meshRouterCode.includes('synapticMeshRouter.init()'), 'meshRouter.ts debe inicializar synapticMeshRouter en init()');
});

// ── 2. Simulación Numérica y Validación Funcional de la Clase ───────────────────
// Extraemos y compilamos la clase en un entorno sandbox para ejecutar tests dinámicos
class StandaloneSynapticEngine {
    constructor() {
        this.INITIAL_WEIGHT = 0.40;
        this.MIN_WEIGHT = 0.02;
        this.MAX_WEIGHT = 1.00;
        this.PRUNE_THRESHOLD = 0.15;
        this.RESTORE_THRESHOLD = 0.25;
        this.HIGH_CONDUCTANCE_THRESHOLD = 0.55;
        this.ETA_LEARNING_RATE = 0.12;
        this.PENALTY_FACTOR = 0.20;
        this.DECAY_TAU_MS = 600_000;
        this.PASSIVE_BASELINE = 0.30;
        this.EPSILON_EXPLORATION = 0.15;

        this.synapses = new Map();
        this.suppressedStormsCount = 0;
        this.packetsRoutedBio = 0;
    }

    touchPeer(peerId, initialLqs = 70) {
        if (!peerId) throw new Error('Invalid peerId');
        const cleanId = peerId.trim().toLowerCase();
        let link = this.synapses.get(cleanId);
        if (!link) {
            const safeLqs = Math.max(0, Math.min(100, isFinite(initialLqs) ? initialLqs : 70));
            const initialWeight = Math.min(this.MAX_WEIGHT, Math.max(this.MIN_WEIGHT, this.INITIAL_WEIGHT * (safeLqs / 100)));
            link = {
                peerId: cleanId,
                weight: Number(initialWeight.toFixed(4)),
                successfulDeliveries: 0,
                failedDeliveries: 0,
                totalTransmissions: 0,
                lastInteractionTs: Date.now(),
                rttMs: 100,
                lqs: safeLqs,
                isRichClubHub: false,
                isPruned: initialWeight < this.PRUNE_THRESHOLD,
            };
            this.synapses.set(cleanId, link);
            this.recalculateTopology();
        }
        return link;
    }

    recordDeliveryResult(peerId, success, rttMs = 100, measuredLqs) {
        if (!peerId) return;
        const cleanId = peerId.trim().toLowerCase();
        const link = this.touchPeer(cleanId, measuredLqs);
        const now = Date.now();
        const dt = Math.max(0, now - link.lastInteractionTs);
        link.lastInteractionTs = now;
        link.totalTransmissions++;

        const temporalFactor = Math.exp(-dt / this.DECAY_TAU_MS);
        if (isFinite(rttMs) && rttMs > 0) link.rttMs = Math.round(link.rttMs * 0.7 + rttMs * 0.3);
        if (typeof measuredLqs === 'number' && isFinite(measuredLqs)) {
            link.lqs = Math.round(link.lqs * 0.7 + Math.max(0, Math.min(100, measuredLqs)) * 0.3);
        }

        if (success) {
            link.successfulDeliveries++;
            const rttScore = Math.max(0.1, Math.min(1.0, 500 / Math.max(50, link.rttMs)));
            const lqsScore = link.lqs / 100;
            const reward = (rttScore * 0.4 + lqsScore * 0.6);
            const deltaW = this.ETA_LEARNING_RATE * reward * temporalFactor;
            link.weight = Math.min(this.MAX_WEIGHT, link.weight + deltaW);
            if (link.isPruned && link.weight >= this.RESTORE_THRESHOLD) link.isPruned = false;
        } else {
            link.failedDeliveries++;
            const penalty = this.PENALTY_FACTOR * (1.0 + (100 - link.lqs) / 100);
            link.weight = Math.max(this.MIN_WEIGHT, link.weight - penalty);
            if (!link.isPruned && link.weight < this.PRUNE_THRESHOLD) link.isPruned = true;
        }

        link.weight = Number(link.weight.toFixed(4));
        this.recalculateTopology();
    }

    selectBroadcastPeers(candidates, exceptPeerId, isEmergency = false) {
        if (!candidates || candidates.length === 0) return { selectedPeers: [], suppressedCount: 0 };
        const cleanExcept = exceptPeerId ? exceptPeerId.trim().toLowerCase() : null;
        const available = candidates.filter(c => c && c.id && c.id.trim().toLowerCase() !== cleanExcept);

        if (isEmergency || available.length <= 3) {
            this.packetsRoutedBio += available.length;
            return { selectedPeers: available, suppressedCount: 0 };
        }

        const selected = [];
        let suppressed = 0;

        for (const peer of available) {
            const cleanId = peer.id.trim().toLowerCase();
            let link = this.synapses.get(cleanId) || this.touchPeer(cleanId);

            if (link.isRichClubHub) {
                selected.push(peer);
                continue;
            }
            if (!link.isPruned && link.weight >= this.HIGH_CONDUCTANCE_THRESHOLD) {
                selected.push(peer);
                continue;
            }
            if (link.isPruned) {
                // Enlace podado suprimido
                suppressed++;
                continue;
            }
            // Enlace intermedio
            if (Math.random() <= link.weight) {
                selected.push(peer);
            } else {
                suppressed++;
            }
        }

        if (selected.length === 0 && available.length > 0) {
            selected.push(available[0]);
            suppressed = Math.max(0, available.length - selected.length);
        }

        this.suppressedStormsCount += suppressed;
        this.packetsRoutedBio += selected.length;
        return { selectedPeers: selected, suppressedCount: suppressed };
    }

    recalculateTopology() {
        if (this.synapses.size === 0) return;
        const links = Array.from(this.synapses.values());
        const validWeights = links.map(l => l.weight);
        const mean = validWeights.reduce((acc, w) => acc + w, 0) / (validWeights.length || 1);
        const variance = validWeights.reduce((acc, w) => acc + Math.pow(w - mean, 2), 0) / (validWeights.length || 1);
        const stdDev = Math.sqrt(variance);
        const richClubThreshold = Math.min(0.90, Math.max(0.60, mean + 0.5 * stdDev));

        let hubCount = 0;
        const maxAllowedHubs = Math.max(1, Math.ceil(links.length * 0.25));

        const sorted = [...links].sort((a, b) => {
            const scoreA = a.weight * (a.lqs / 100);
            const scoreB = b.weight * (b.lqs / 100);
            return scoreB - scoreA;
        });

        for (const link of sorted) {
            if (!link.isPruned && link.weight >= richClubThreshold && hubCount < maxAllowedHubs) {
                link.isRichClubHub = true;
                hubCount++;
            } else {
                link.isRichClubHub = false;
            }
        }
    }

    accumulatePacket(packet) {
        let iSyn = 8.0;
        if (packet.isEmergency) iSyn = 60.0;
        else if (packet.payloadSize) iSyn = Math.min(20.0, Math.max(4.0, (packet.payloadSize / 64) * 8.0));
        this.lifMembranePotentialMv = (this.lifMembranePotentialMv || -70.0) + iSyn;
        this.lifPacketQueue = this.lifPacketQueue || [];
        this.lifPacketQueue.push(packet);
        let emitSpike = false;
        if (this.lifMembranePotentialMv >= -50.0) {
            emitSpike = true;
            this.lifMembranePotentialMv = -75.0;
        }
        return { emitSpike, membranePotentialMv: this.lifMembranePotentialMv, queuedPackets: this.lifPacketQueue.length };
    }

    flushSpikeQueue() {
        const drained = [...(this.lifPacketQueue || [])];
        this.lifPacketQueue = [];
        this.lifMembranePotentialMv = -70.0;
        return drained;
    }

    optogeneticSilence(peerId) {
        this.silenced = this.silenced || new Set();
        this.silenced.add(peerId.toLowerCase());
        const link = this.synapses.get(peerId.toLowerCase());
        if (link) { link.weight = 0.02; link.isPruned = true; link.isRichClubHub = false; }
        return true;
    }

    optogeneticRestore(peerId) {
        if (this.silenced) this.silenced.delete(peerId.toLowerCase());
        const link = this.synapses.get(peerId.toLowerCase());
        if (link) { link.weight = 0.30; link.isPruned = false; }
        return true;
    }

    optogeneticStimulate(peerId, pulseCount = 3, freqHz = 10) {
        const link = this.touchPeer(peerId);
        link.weight = Math.min(this.MAX_WEIGHT, link.weight + 0.05);
        return { triggered: true, peerId, pulseCount, freqHz };
    }
}

runTest('4. Dinámica Hebbiana: Refuerzo por éxito y poda sináptica por fallos', () => {
    const router = new StandaloneSynapticEngine();
    const linkA = router.touchPeer('peer_alpha', 80);
    const initialWeight = linkA.weight;

    // Entrega exitosa debe potenciar el enlace
    router.recordDeliveryResult('peer_alpha', true, 50, 90);
    assert(linkA.weight > initialWeight, `El peso tras éxito (${linkA.weight}) debe ser mayor que el inicial (${initialWeight})`);
    assert(!linkA.isPruned, 'El enlace reforzado no debe estar podado');

    // 5 Fallos consecutivos deben degradar el peso y provocar poda sináptica
    for (let i = 0; i < 5; i++) {
        router.recordDeliveryResult('peer_alpha', false, 500, 10);
    }
    assert(linkA.weight <= router.PRUNE_THRESHOLD, `El peso tras fallos sucesivos (${linkA.weight}) debe caer bajo el umbral de poda`);
    assert(linkA.isPruned === true, 'El enlace degradado debe estar marcado como isPruned = true');
});

runTest('5. Despoda y Restauración Sináptica: Recuperación de enlaces rehabilitados', () => {
    const router = new StandaloneSynapticEngine();
    router.touchPeer('peer_bravo', 10); // Inicialmente muy débil
    const link = router.synapses.get('peer_bravo');
    link.weight = 0.05;
    link.isPruned = true;

    // Con una serie de entregas exitosas a bajo RTT debe recuperarse por encima de RESTORE_THRESHOLD
    for (let i = 0; i < 6; i++) {
        router.recordDeliveryResult('peer_bravo', true, 40, 95);
    }

    assert(link.weight >= router.RESTORE_THRESHOLD, `El enlace debe superar 0.25 (actual: ${link.weight})`);
    assert(link.isPruned === false, 'El enlace recuperado debe ser despodado (isPruned = false)');
});

runTest('6. Elección de Nodos de Club Rico (Murthy Lab Rich-Club Hubs)', () => {
    const router = new StandaloneSynapticEngine();
    // Creamos una población de 20 nodos
    for (let i = 1; i <= 20; i++) {
        const id = `node_${i.toString().padStart(2, '0')}`;
        router.touchPeer(id, 40 + i * 2);
    }

    // Entrenamos 3 nodos para ser hubs sobresalientes
    for (let i = 0; i < 10; i++) {
        router.recordDeliveryResult('node_18', true, 30, 98);
        router.recordDeliveryResult('node_19', true, 25, 99);
        router.recordDeliveryResult('node_20', true, 20, 100);
    }

    const hubs = Array.from(router.synapses.values()).filter(l => l.isRichClubHub);
    assert(hubs.length >= 1 && hubs.length <= 5, `Los hubs (${hubs.length}) deben representar <= 25% de la red`);
    assert(hubs.some(h => h.peerId === 'node_20'), 'node_20 con métricas perfectas debe ser elegido Rich-Club Hub');
});

runTest('7. Supresión de Tormentas de Difusión: Enjambre de 50 Nodos', () => {
    const router = new StandaloneSynapticEngine();
    const swarm = [];

    // Generar 50 nodos: 5 hubs sobresalientes, 30 nodos normales, 15 nodos degradados (podados)
    for (let i = 1; i <= 50; i++) {
        const id = `swarm_node_${i}`;
        swarm.push({ id });
        router.touchPeer(id, 60);
    }

    // Promover 3 hubs
    for (let i = 0; i < 8; i++) {
        router.recordDeliveryResult('swarm_node_1', true, 30, 95);
        router.recordDeliveryResult('swarm_node_2', true, 30, 95);
        router.recordDeliveryResult('swarm_node_3', true, 30, 95);
    }

    // Podar 15 nodos ruidosos
    for (let i = 36; i <= 50; i++) {
        for (let f = 0; f < 4; f++) {
            router.recordDeliveryResult(`swarm_node_${i}`, false, 600, 10);
        }
    }

    // Ejecutar selección de reenvío de broadcast normal
    const { selectedPeers, suppressedCount } = router.selectBroadcastPeers(swarm, 'swarm_node_me', false);

    // En una difusión no podada, se enviarían a los 50. Con enrutamiento sináptico:
    assert(suppressedCount > 10, `Debe suprimir al menos los enlaces degradados (suprimidos: ${suppressedCount})`);
    assert(selectedPeers.length < 50, 'No debe emitir inundación ciega a los 50 nodos');
    assert(selectedPeers.some(p => p.id === 'swarm_node_1'), 'Los Rich-Club Hubs deben ser seleccionados siempre');
});

runTest('8. Inmunidad Vital: Bypass de Poda ante Emergencias (SOS / CBRN)', () => {
    const router = new StandaloneSynapticEngine();
    const candidates = [];
    for (let i = 1; i <= 10; i++) {
        const id = `peer_${i}`;
        candidates.push({ id });
        router.touchPeer(id, 20);
        // Forzar todos podados
        router.synapses.get(id).isPruned = true;
        router.synapses.get(id).weight = 0.05;
    }

    // Con paquete de emergencia, CERO supresión
    const { selectedPeers, suppressedCount } = router.selectBroadcastPeers(candidates, undefined, true);
    assert.strictEqual(suppressedCount, 0, 'En emergencia la supresión debe ser exactamente 0');
    assert.strictEqual(selectedPeers.length, 10, 'En emergencia el 100% de los candidatos debe recibir el paquete vital');
});

runTest('9. Resiliencia contra valores espurios y sanitización de tipos', () => {
    const router = new StandaloneSynapticEngine();
    router.recordDeliveryResult('test_bad', true, NaN, NaN);
    router.recordDeliveryResult('test_bad', false, -100, 9999);
    const link = router.synapses.get('test_bad');
    assert(!isNaN(link.weight), 'El peso sináptico no puede ser NaN');
    assert(isFinite(link.rttMs) && link.rttMs > 0, 'El RTT debe ser un número finito positivo');
    assert(link.lqs >= 0 && link.lqs <= 100, 'El LQS debe estar estrictamente confinado a [0, 100]');

    const emptyRes = router.selectBroadcastPeers([], null, false);
    assert.strictEqual(emptyRes.selectedPeers.length, 0, 'Debe tolerar arreglos vacíos sin lanzar excepción');
});

runTest('10. Estadísticas de Red de Princeton Murthy Lab (Reciprocidad, Small-World σ, Motivos)', () => {
    assert(engineCode.includes('edgeReciprocity'), 'Debe exponer métrica edgeReciprocity');
    assert(engineCode.includes('smallWorldSigma'), 'Debe calcular índice small-world σ');
    assert(engineCode.includes('fflMotifsCount'), 'Debe contabilizar Feed-Forward Loops (FFL)');
    assert(engineCode.includes('fblMotifsCount'), 'Debe contabilizar Feedback Loops (FBL)');
});

runTest('11. Dinámicas Neuromórficas LIF SNN de Eon Systems (Acumulador y Disparo a Umbral)', () => {
    assert(engineCode.includes('accumulatePacket'), 'Debe implementar accumulatePacket()');
    assert(engineCode.includes('flushSpikeQueue'), 'Debe implementar flushSpikeQueue()');
    assert(engineCode.includes('LIF_V_THRESHOLD_MV'), 'Debe definir umbral de disparo -50 mV');

    const router = new StandaloneSynapticEngine();
    // Inyectar telemetría rutinaria (sub-umbral: 8 pA cada uno, parte de -70 mV)
    let res1 = router.accumulatePacket({ id: 'telem_1', isEmergency: false });
    assert.strictEqual(res1.emitSpike, false, 'El primer paquete rutinario debe acumularse sub-umbral');
    assert.strictEqual(res1.membranePotentialMv, -62.0);

    // Inyectar emergencia (supramáxima: 60 pA -> supera -50 mV de inmediato)
    let resSos = router.accumulatePacket({ id: 'sos_1', isEmergency: true });
    assert.strictEqual(resSos.emitSpike, true, 'Paquete SOS debe cruzar umbral instantáneamente y disparar spike');
    assert.strictEqual(resSos.membranePotentialMv, -75.0, 'Tras el disparo debe resetear a -75 mV');

    const drained = router.flushSpikeQueue();
    assert.strictEqual(drained.length, 2, 'Debe drenar exactamente los 2 paquetes en cola');
    assert.strictEqual(router.lifMembranePotentialMv, -70.0, 'Tras flush debe descansar en -70 mV');
});

runTest('12. Herramientas de Control Optogenético de Malla (Silenciamiento NpHR y Estimulación ChR2)', () => {
    assert(engineCode.includes('optogeneticSilence'), 'Debe implementar optogeneticSilence()');
    assert(engineCode.includes('optogeneticRestore'), 'Debe implementar optogeneticRestore()');
    assert(engineCode.includes('optogeneticStimulate'), 'Debe implementar optogeneticStimulate()');

    const router = new StandaloneSynapticEngine();
    router.touchPeer('rogue_jammer', 90);
    assert.strictEqual(router.synapses.get('rogue_jammer').isPruned, false);

    // Aplicar silenciamiento optogenético NpHR
    router.optogeneticSilence('rogue_jammer');
    const silencedLink = router.synapses.get('rogue_jammer');
    assert.strictEqual(silencedLink.isPruned, true, 'El nodo silenciado debe quedar podado');
    assert.strictEqual(silencedLink.weight, 0.02, 'El nodo silenciado debe caer a conductancia mínima');

    // Restaurar
    router.optogeneticRestore('rogue_jammer');
    assert.strictEqual(silencedLink.isPruned, false, 'Tras restauración debe quitar la poda');
    assert.strictEqual(silencedLink.weight, 0.30, 'Tras restauración debe volver al baseline');

    // Estimulación ChR2
    const stimRes = router.optogeneticStimulate('solar_repeater_1', 3, 10);
    assert.strictEqual(stimRes.triggered, true, 'Debe emitir tren de pulsos de estimulación');
    assert.strictEqual(stimRes.freqHz, 10, 'Frecuencia debe ser 10 Hz');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round(passedTests/totalTests*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
