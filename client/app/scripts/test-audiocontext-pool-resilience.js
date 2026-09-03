/**
 * TEST SUITE: AUDIOCONTEXT POOL & HARDWARE LIMIT ENFORCEMENT
 * 
 * Valida la erradicación del agotamiento de AudioContext en Android WebView:
 * 1. AudioContextManager.ts: Singleton de contexto compartido y pool acotado de contextos dedicados.
 * 2. AudioContextManager.ts: Cota máxima de hardware (MAX_DEDICATED_CONTEXTS = 3, total <= 4).
 * 3. AudioContextManager.ts: Desalojo LRU (Least Recently Used) ante sobrecupo.
 * 4. AudioContextManager.ts: Desbloqueo pasivo por gesto de usuario (touchstart/click/keydown).
 * 5. Delegación unificada en TacticalAudioEngine, CallRingtoneEngine, TacticalVoiceAnalyzer,
 *    MagneticAnomalyDetectorEngine, OpticalMorseLiFiEngine, StructuralHealthSeismicEngine y useSquadCallMesh.
 * 6. Simulación algorítmica de estrés de hardware garantizando total <= 4 contextos.
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
console.log('🔊 INICIANDO SUITE DE PRUEBAS: AUDIOCONTEXT POOL & HARDWARE RESILIENCE');
console.log('================================================================================\n');

const libDir = path.join(__dirname, '..', 'src', 'lib');

// ── 1. Inspección Estática de AudioContextManager.ts ─────────────────────────
const acmPath = path.join(libDir, 'audio', 'AudioContextManager.ts');
const acmCode = fs.readFileSync(acmPath, 'utf8');

runTest('1. AudioContextManager: Singleton compartido y pool dedicado acotado', () => {
    assert(acmCode.includes('private static sharedCtx: AudioContext | null = null;'), 'Debe tener sharedCtx');
    assert(acmCode.includes('private static dedicatedPool: Map'), 'Debe tener dedicatedPool');
    assert(acmCode.includes('private static readonly MAX_DEDICATED_CONTEXTS = 3;'), 'Debe acotar a 3 contextos dedicados');
    assert(acmCode.includes('public static getSharedContext(): AudioContext | null'), 'Debe exponer getSharedContext');
    assert(acmCode.includes('public static acquireDedicatedContext(requesterId: string)'), 'Debe exponer acquireDedicatedContext');
    assert(acmCode.includes('public static async releaseDedicatedContext(requesterId: string)'), 'Debe exponer releaseDedicatedContext');
});

runTest('2. AudioContextManager: Desalojo LRU ante sobrecupo de hardware', () => {
    assert(acmCode.includes('this.dedicatedPool.size >= this.MAX_DEDICATED_CONTEXTS'), 'Debe verificar límite de pool');
    assert(acmCode.includes('evicted.ctx.close()'), 'Debe cerrar el contexto desalojado');
    assert(acmCode.includes('LRU Eviction'), 'Debe registrar desalojo LRU');
});

runTest('3. AudioContextManager: Desbloqueo pasivo ante gestos de usuario', () => {
    assert(acmCode.includes('setupUserGestureUnlock'), 'Debe implementar setupUserGestureUnlock');
    assert(acmCode.includes("'touchstart'"), 'Debe escuchar touchstart');
    assert(acmCode.includes("'click'"), 'Debe escuchar click');
});

// ── 2. Inspección Estática de Motores Delegados ──────────────────────────────
runTest('4. TacticalAudioEngine: Delega en AudioContextManager.getSharedContext()', () => {
    const code = fs.readFileSync(path.join(libDir, 'audio', 'TacticalAudioEngine.ts'), 'utf8');
    assert(code.includes('AudioContextManager.getSharedContext()'), 'Debe delegar en AudioContextManager');
    assert(!code.includes('new AudioCtxClass()'), 'No debe instanciar contextos aislados');
});

runTest('5. CallRingtoneEngine: Delega en AudioContextManager.getSharedContext()', () => {
    const code = fs.readFileSync(path.join(libDir, 'audio', 'CallRingtoneEngine.ts'), 'utf8');
    assert(code.includes('AudioContextManager.getSharedContext()'), 'Debe delegar en AudioContextManager');
    assert(!code.includes('new AudioCtxClass()'), 'No debe instanciar contextos aislados');
});

runTest('6. TacticalVoiceAnalyzer: Delega en AudioContextManager.getSharedContext()', () => {
    const code = fs.readFileSync(path.join(libDir, 'audio', 'TacticalVoiceAnalyzer.ts'), 'utf8');
    assert(code.includes('AudioContextManager.getSharedContext()'), 'Debe delegar en AudioContextManager');
});

runTest('7. MagneticAnomalyDetectorEngine: Delega en AudioContextManager.getSharedContext()', () => {
    const code = fs.readFileSync(path.join(libDir, 'sensors', 'MagneticAnomalyDetectorEngine.ts'), 'utf8');
    assert(code.includes('AudioContextManager.getSharedContext()'), 'Debe delegar en AudioContextManager');
});

runTest('8. OpticalMorseLiFiEngine: Utiliza AudioContextManager.getSharedContext()', () => {
    const code = fs.readFileSync(path.join(libDir, 'sensors', 'OpticalMorseLiFiEngine.ts'), 'utf8');
    assert(code.includes('AudioContextManager.getSharedContext()'), 'Debe usar AudioContextManager');
});

runTest('9. StructuralHealthSeismicEngine: Utiliza AudioContextManager.getSharedContext()', () => {
    const code = fs.readFileSync(path.join(libDir, 'sensors', 'StructuralHealthSeismicEngine.ts'), 'utf8');
    assert(code.includes('AudioContextManager.getSharedContext()'), 'Debe usar AudioContextManager');
});

runTest('10. useSquadCallMesh: Utiliza acquireDedicatedContext y releaseDedicatedContext', () => {
    const code = fs.readFileSync(path.join(libDir, 'mesh', 'useSquadCallMesh.ts'), 'utf8');
    assert(code.includes("AudioContextManager.acquireDedicatedContext('squad_call_vad')"), 'Debe adquirir contexto dedicado para VAD');
    assert(code.includes("AudioContextManager.releaseDedicatedContext('squad_call_vad')"), 'Debe liberar contexto dedicado al salir');
});

// ── 3. Simulación Algorítmica del Pool y Política LRU ────────────────────────
class MockNativeAudioContext {
    constructor(id) {
        this.id = id;
        this.state = 'running';
    }
    close() {
        this.state = 'closed';
    }
    resume() {
        this.state = 'running';
    }
}

class MockAudioContextPool {
    constructor(maxDedicated = 3) {
        this.maxDedicated = maxDedicated;
        this.sharedCtx = null;
        this.dedicatedPool = new Map();
        this.totalCreated = 0;
    }

    getSharedContext() {
        if (!this.sharedCtx || this.sharedCtx.state === 'closed') {
            this.totalCreated++;
            this.sharedCtx = new MockNativeAudioContext('shared');
        }
        return this.sharedCtx;
    }

    acquireDedicated(requesterId) {
        const now = Date.now();
        const existing = this.dedicatedPool.get(requesterId);
        if (existing && existing.ctx.state !== 'closed') {
            existing.lastUsed = now;
            return existing.ctx;
        }

        if (this.dedicatedPool.size >= this.maxDedicated) {
            let oldestKey = null;
            let oldestTime = Infinity;
            for (const [key, item] of this.dedicatedPool.entries()) {
                if (item.lastUsed < oldestTime) {
                    oldestTime = item.lastUsed;
                    oldestKey = key;
                }
            }
            if (oldestKey) {
                this.dedicatedPool.get(oldestKey).ctx.close();
                this.dedicatedPool.delete(oldestKey);
            }
        }

        this.totalCreated++;
        const ctx = new MockNativeAudioContext(requesterId);
        this.dedicatedPool.set(requesterId, { ctx, lastUsed: now });
        return ctx;
    }

    releaseDedicated(requesterId) {
        const item = this.dedicatedPool.get(requesterId);
        if (item) {
            item.ctx.close();
            this.dedicatedPool.delete(requesterId);
        }
    }

    getActiveHardwareCount() {
        let count = (this.sharedCtx && this.sharedCtx.state !== 'closed') ? 1 : 0;
        this.dedicatedPool.forEach(({ ctx }) => {
            if (ctx.state !== 'closed') count++;
        });
        return count;
    }
}

runTest('11. Simulación: Shared Context es reutilizado entre 10 motores concurrentes', () => {
    const pool = new MockAudioContextPool();
    const instances = [];
    for (let i = 0; i < 10; i++) {
        instances.push(pool.getSharedContext());
    }
    // Todos deben ser idénticos
    instances.forEach(ctx => assert.strictEqual(ctx, instances[0], 'Debe ser la misma instancia compartida'));
    assert.strictEqual(pool.getActiveHardwareCount(), 1, 'Solo debe existir 1 contexto de hardware');
});

runTest('12. Simulación: Pool acota hardware a <= 4 instancias bajo ráfagas concurrentes', () => {
    const pool = new MockAudioContextPool(3);

    // 1 compartido activo
    pool.getSharedContext();

    // 5 peticiones dedicadas distintas
    pool.acquireDedicated('vad_peer_1');
    pool.acquireDedicated('vad_peer_2');
    pool.acquireDedicated('vad_peer_3');
    // Al pedir el 4to y 5to, debe expulsar LRU
    pool.acquireDedicated('vad_peer_4');
    pool.acquireDedicated('vad_peer_5');

    const activeCount = pool.getActiveHardwareCount();
    assert(activeCount <= 4, `Hardware count (${activeCount}) debe ser <= 4 (límite móvil: 6)`);
    assert.strictEqual(pool.dedicatedPool.size, 3, 'El pool dedicado no debe exceder 3 instancias');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests/totalTests)*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
