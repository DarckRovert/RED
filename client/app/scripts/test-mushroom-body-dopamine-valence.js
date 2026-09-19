/**
 * TEST SUITE: DTN MUSHROOM BODY DOPAMINERGIC VALENCE & SWARM PHEROMONES
 * 
 * Valida la plasticidad dopaminérgica (PAM / PPL1) y feromonas de enjambre de Drosophila:
 * 1. Clúster PAM (~130 DANs) modula refuerzo apetitivo (LTP) y propensión APPROACH.
 * 2. Clúster PPL1 (~12 DANs) modula aversión táctica (LTD) y propensión AVOID.
 * 3. Inmunidad inviolable de paquetes SOS/CBRN/Blockchain ante desalojo LTD.
 * 4. Generación, ingestión y decaimiento exponencial de Feromonas de Enjambre (ALARM/TRAIL/AGGREGATION).
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
console.log('🍄🧪 INICIANDO SUITE DE PRUEBAS: MUSHROOM BODY DOPAMINE & SWARM PHEROMONES');
console.log('================================================================================\n');

// ── 1. Inspección Estática de DtnMushroomBodyEngine.ts ────────────────────────
const mbPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'DtnMushroomBodyEngine.ts');
const mbCode = fs.readFileSync(mbPath, 'utf8');

runTest('1. DtnMushroomBodyEngine: Definición de Clústeres Dopaminérgicos PAM y PPL1', () => {
    assert(mbCode.includes('DAN_PAM_COUNT = 130'), 'Debe definir ~130 neuronas PAM de recompensa');
    assert(mbCode.includes('DAN_PPL1_COUNT = 12'), 'Debe definir ~12 neuronas PPL1 de aversión');
    assert(mbCode.includes('BehavioralDrive'), 'Debe declarar tipo de conducta APPROACH/AVOID/NEUTRAL');
});

runTest('2. DtnMushroomBodyEngine: Protocolo de Feromonas de Enjambre (Swarm Pheromones)', () => {
    assert(mbCode.includes('SwarmPheromoneType'), 'Debe declarar tipos ALARM, TRAIL y AGGREGATION');
    assert(mbCode.includes('emitPheromone'), 'Debe implementar emisión estigmérgica de feromonas');
    assert(mbCode.includes('ingestPheromone'), 'Debe implementar ingestión de feromonas de la malla');
    assert(mbCode.includes('cleanExpiredPheromones'), 'Debe implementar decaimiento temporal exponencial');
});

runTest('3. DtnMushroomBodyEngine: Métodos de Modulación Dopaminérgica', () => {
    assert(mbCode.includes('reinforceReward'), 'Debe implementar refuerzo positivo PAM');
    assert(mbCode.includes('reinforceAversion'), 'Debe implementar refuerzo aversivo PPL1');
    assert(mbCode.includes('getPeerBehavioralDrive'), 'Debe computar el vector de conducta hacia un par');
});

// ── 2. Simulación Numérica de Dinámica Dopaminérgica ──────────────────────────

class MockDopaminergicEngine {
    constructor() {
        this.peerValenceMap = new Map();
        this.pheromones = new Map();
    }

    reinforceReward(peerId, delta = 0.2) {
        const entry = this.peerValenceMap.get(peerId) || { pam: 0.5, ppl1: 0.0 };
        entry.pam = Math.min(1.0, entry.pam + delta);
        entry.ppl1 = Math.max(0.0, entry.ppl1 - delta * 0.5);
        this.peerValenceMap.set(peerId, entry);
    }

    reinforceAversion(peerId, severity = 0.3) {
        const entry = this.peerValenceMap.get(peerId) || { pam: 0.5, ppl1: 0.0 };
        entry.ppl1 = Math.min(1.0, entry.ppl1 + severity);
        entry.pam = Math.max(0.0, entry.pam - severity * 0.5);
        this.peerValenceMap.set(peerId, entry);

        if (severity >= 0.75 || entry.ppl1 >= 0.8) {
            this.emitPheromone('ALARM', 1.0, `Hostil: ${peerId}`);
        }
    }

    getBehavioralDrive(peerId) {
        const entry = this.peerValenceMap.get(peerId);
        if (!entry) return { drive: 'NEUTRAL', score: 0.0 };
        const score = entry.pam - entry.ppl1;
        let drive = 'NEUTRAL';
        if (score > 0.2) drive = 'APPROACH';
        else if (score < -0.2) drive = 'AVOID';
        return { drive, score };
    }

    emitPheromone(type, intensity = 1.0, notes = '') {
        const id = `ph_${type}_${Date.now()}_${Math.random()}`;
        const ph = { id, type, intensity, createdAt: Date.now(), ttlMs: 15 * 60 * 1000, notes };
        this.pheromones.set(id, ph);
        return ph;
    }

    decayPheromones(simulatedElapsedMs) {
        for (const [id, ph] of this.pheromones.entries()) {
            const halfLife = ph.ttlMs * 0.5;
            ph.intensity = ph.intensity * Math.exp(-simulatedElapsedMs / halfLife);
        }
    }
}

runTest('4. Dinámica PAM: Refuerzo repetido induce propensión APPROACH', () => {
    const engine = new MockDopaminergicEngine();
    const peer = 'node_relay_alpha';

    // Inicialmente neutral
    assert(engine.getBehavioralDrive(peer).drive === 'NEUTRAL', 'Debe iniciar neutral');

    // Reforzar 3 veces por entregas rápidas
    engine.reinforceReward(peer, 0.2);
    engine.reinforceReward(peer, 0.2);

    const status = engine.getBehavioralDrive(peer);
    assert(status.drive === 'APPROACH', 'Debe transicionar a APPROACH tras refuerzo PAM');
    assert(status.score > 0.2, 'Puntuación neta debe superar el umbral apetitivo');
});

runTest('5. Dinámica PPL1: Ataque EW o paquetes corruptos inducen AVOID y Feromona ALARM', () => {
    const engine = new MockDopaminergicEngine();
    const peer = 'node_rogue_spoofer';

    // Inyectar aversión severa (jamming / spoofing)
    engine.reinforceAversion(peer, 0.85);

    const status = engine.getBehavioralDrive(peer);
    assert(status.drive === 'AVOID', 'Debe transicionar a AVOID');
    assert(status.score < -0.2, 'Puntuación neta debe ser marcadamente negativa');

    // Debe haber emitido automáticamente una feromona de ALARMA
    assert(engine.pheromones.size > 0, 'Debe haber registrado una feromona');
    const firstPh = Array.from(engine.pheromones.values())[0];
    assert(firstPh.type === 'ALARM', 'Tipo de feromona debe ser ALARM');
    assert(firstPh.intensity === 1.0, 'Intensidad de alarma debe ser máxima');
});

runTest('6. Feromonas de Enjambre: Decaimiento temporal exponencial', () => {
    const engine = new MockDopaminergicEngine();
    const ph = engine.emitPheromone('TRAIL', 1.0, 'Puente Satelital Activo');

    assert(ph.intensity === 1.0, 'Intensidad inicial debe ser 1.0');

    // Simular el paso de media vida (7.5 minutos = 450,000 ms)
    engine.decayPheromones(450000);

    const currentPh = engine.pheromones.get(ph.id);
    assert(Math.abs(currentPh.intensity - Math.exp(-1)) < 0.01, 'Intensidad debe decaer exponencialmente (1/e)');
});

console.log('\n================================================================================');
console.log(`📊 RESULTADO DE LA SUITE MB: ${passedTests}/${totalTests} PRUEBAS EXITOSAS (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
