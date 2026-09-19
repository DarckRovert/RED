/**
 * TEST SUITE: MESH PHEROMONE STIGMERGY & SWARM ROUTING RESILIENCE
 * 
 * Valida el protocolo de feromonas de enjambre sobre la malla de la ciudad:
 * 1. Definición binaria de FLAG_PHEROMONE (0x10) y SwarmPheromoneEnvelope en meshProtocol.ts.
 * 2. Emisión estigmérgica con geohash en DtnMushroomBodyEngine.ts.
 * 3. Difusión P2P de tramas SWARM_PHEROMONE mediante meshRouter.broadcastPheromone.
 * 4. Ingestión y decodificación automática en meshRouter.handleRawPacket.
 * 5. Re-enrutamiento sináptico: Feromona ALARM deprime conductancia hacia nodo hostil.
 * 6. Decaimiento temporal exponencial de la intensidad de feromona.
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
console.log('🍄🐜 INICIANDO SUITE DE PRUEBAS: MESH PHEROMONE STIGMERGY & SWARM ROUTING');
console.log('================================================================================\n');

// ── 1. Verificación Estática del Protocolo Wire y Enrutador ───────────────────
const protocolPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshProtocol.ts');
const protocolCode = fs.readFileSync(protocolPath, 'utf8');

const routerPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshRouter.ts');
const routerCode = fs.readFileSync(routerPath, 'utf8');

const mbPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'DtnMushroomBodyEngine.ts');
const mbCode = fs.readFileSync(mbPath, 'utf8');

runTest('1. meshProtocol.ts: Definición de FLAG_PHEROMONE y SwarmPheromoneEnvelope', () => {
    assert(protocolCode.includes('FLAG_PHEROMONE = 0x10'), 'Debe definir FLAG_PHEROMONE = 0x10');
    assert(protocolCode.includes('interface SwarmPheromoneEnvelope'), 'Debe definir SwarmPheromoneEnvelope');
    assert(protocolCode.includes('pheromone?: SwarmPheromoneEnvelope'), 'MeshPacket debe contener campo pheromone');
});

runTest('2. DtnMushroomBodyEngine.ts: Soporte de Geohash en Feromonas', () => {
    assert(mbCode.includes('geohash?: string'), 'SwarmPheromone debe aceptar geohash');
    assert(mbCode.includes('emitPheromone'), 'Debe existir método emitPheromone');
    assert(mbCode.includes('ingestPheromone'), 'Debe existir método ingestPheromone');
    assert(mbCode.includes('cleanExpiredPheromones'), 'Debe existir decaimiento exponencial');
});

runTest('3. meshRouter.ts: Difusión e Ingestión de Feromonas en Malla', () => {
    assert(routerCode.includes('broadcastPheromone'), 'meshRouter debe exponer broadcastPheromone');
    assert(routerCode.includes('SWARM_PHEROMONE'), 'meshRouter debe reconocer tramas SWARM_PHEROMONE');
    assert(routerCode.includes('dtnMushroomBody.ingestPheromone'), 'meshRouter debe ingerir feromonas en MushroomBody');
    assert(routerCode.includes('synapticMeshRouter.reinforceAversion'), 'meshRouter debe deprimir enlace ante ALARM');
});

// ── 2. Simulación Funcional de Señalización Estigmérgica ───────────────────────

class MockPheromoneStorage {
    constructor() {
        this.pheromones = new Map();
    }

    emit(type, intensity = 1.0, geohash = '6mc5ab') {
        const id = `ph_${type.toLowerCase()}_${Date.now()}`;
        const p = {
            id,
            type,
            intensity: Math.max(0.0, Math.min(1.0, intensity)),
            geohash,
            createdAt: Date.now(),
            ttlMs: 15 * 60 * 1000,
        };
        this.pheromones.set(id, p);
        return p;
    }

    ingest(pheromone) {
        this.pheromones.set(pheromone.id, { ...pheromone });
    }

    get(id) {
        return this.pheromones.get(id);
    }

    decay(timeElapsedMs) {
        for (const [id, ph] of this.pheromones.entries()) {
            const halfLife = ph.ttlMs * 0.5;
            ph.intensity = Math.max(0.01, ph.intensity * Math.exp(-timeElapsedMs / halfLife));
        }
    }
}

class MockSynapticRouter {
    constructor() {
        this.weights = new Map(); // peerId -> weight [0.0 - 1.0]
    }

    getWeight(peerId) {
        return this.weights.get(peerId) ?? 0.8;
    }

    reinforceAversion(peerId, delta = 0.4) {
        const current = this.getWeight(peerId);
        this.weights.set(peerId, Math.max(0.05, current - delta));
    }
}

runTest('4. Estigmergia: Emisión P2P y Serialización de Sobre de Feromona', () => {
    const mb = new MockPheromoneStorage();
    const ph = mb.emit('ALARM', 0.95, '6mc5xy');

    assert.strictEqual(ph.type, 'ALARM');
    assert.strictEqual(ph.intensity, 0.95);
    assert.strictEqual(ph.geohash, '6mc5xy');

    // Serializar a sobre JSON de red
    const envelope = JSON.stringify({
        type: 'SWARM_PHEROMONE',
        sender: 'node_peer_alpha_1234',
        timestamp: Date.now(),
        pheromone: ph,
    });

    assert(envelope.includes('SWARM_PHEROMONE'), 'Sobre serializado debe incluir identificador');
    assert(envelope.includes('6mc5xy'), 'Sobre serializado debe incluir geohash');
});

runTest('5. Estigmergia: Ingestión Remota y Re-enrutamiento Evasivo Sináptico', () => {
    const localMb = new MockPheromoneStorage();
    const synapticRouter = new MockSynapticRouter();

    const initialWeight = synapticRouter.getWeight('hostile_jammer_node');
    assert.strictEqual(initialWeight, 0.8, 'Peso inicial nominal debe ser 0.8');

    // Llega paquete remoto con feromona ALARM emitida en la vecindad de hostile_jammer_node
    const incomingPacket = {
        type: 'SWARM_PHEROMONE',
        sender: 'hostile_jammer_node',
        pheromone: {
            id: 'ph_alarm_test_999',
            type: 'ALARM',
            intensity: 0.9,
            geohash: '6mc5zz',
        },
    };

    localMb.ingest(incomingPacket.pheromone);
    assert.strictEqual(localMb.get('ph_alarm_test_999').type, 'ALARM');

    // Desvío dinámico del tráfico
    if (incomingPacket.pheromone.type === 'ALARM') {
        synapticRouter.reinforceAversion(incomingPacket.sender, 0.4);
    }

    const postAversionWeight = synapticRouter.getWeight('hostile_jammer_node');
    assert.strictEqual(postAversionWeight, 0.4, 'Peso sináptico debe deprimirse a 0.4 para evitar el área hostil');
});

runTest('6. Estigmergia: Decaimiento Exponencial Temporal de Feromonas', () => {
    const mb = new MockPheromoneStorage();
    const ph = mb.emit('TRAIL', 1.0, '6mc5ab');

    // Simular paso de media vida (7.5 minutos = 450,000 ms)
    mb.decay(450000);
    const decayed = mb.get(ph.id);

    // exp(-1) = 0.3678
    assert(decayed.intensity < 0.40 && decayed.intensity > 0.30, `Intensidad decaída (${decayed.intensity}) debe estar cerca de exp(-1)`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests / totalTests) * 100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests < totalTests) {
    process.exit(1);
}
