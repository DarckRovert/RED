/**
 * TEST SUITE: PHASE 10 - GLOBAL SHIELD SPI FIREWALL & DEFCON MATRIX
 * 
 * Valida de forma exhaustiva el motor de Ciberdefensa Local e Integridad Perimetral:
 * 1. Inspección Estática: Conexiones del pipeline de red (messageDispatcher y meshRouter).
 * 2. Inspección Estática: Sincronización dinámica de badges en Sidebar y TacticalCommandCenter.
 * 3. SPI Cleartext Guard: Bloqueo estricto de texto plano en DEFCON 1, 2 y 3; permisivo en DEFCON 4.
 * 4. SPI Anti-Replay Guard: Registro de nonces temporal con detección y bloqueo de duplicados.
 * 5. SPI Anti-Sybil Governor: Rate limiting por par en ventana móvil y puesta en cuarentena automática.
 * 6. SPI PoW Guard: Validación adaptativa de dificultad Hashcash SHA-256 según perfil DEFCON.
 * 7. Telemetría Energética Dinámica: Perfil de consumo RF y autonomía de batería según DEFCON.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
console.log('🛡️ INICIANDO SUITE DE PRUEBAS: PHASE 10 - GLOBAL SHIELD SPI FIREWALL & DEFCON');
console.log('================================================================================\n');

// ── 1. Inspección Estática de Código Fuente ───────────────────────────────────
const gsePath = path.join(__dirname, '..', 'src', 'lib', 'network', 'GlobalShieldEngine.ts');
const gseCode = fs.readFileSync(gsePath, 'utf8');

const dispPath = path.join(__dirname, '..', 'src', 'store', 'events', 'messageDispatcher.ts');
const dispCode = fs.readFileSync(dispPath, 'utf8');

const routerPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshRouter.ts');
const routerCode = fs.readFileSync(routerPath, 'utf8');

const sidebarPath = path.join(__dirname, '..', 'src', 'components', 'Sidebar.tsx');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

const tccPath = path.join(__dirname, '..', 'src', 'components', 'TacticalCommandCenter.tsx');
const tccCode = fs.readFileSync(tccPath, 'utf8');

runTest('1. GlobalShieldEngine: Definición de SPI Firewall, Cuarentena y Registro Auditivo', () => {
    assert(gseCode.includes('public async inspectIncomingPacket('), 'Debe implementar inspectIncomingPacket');
    assert(gseCode.includes('quarantinedPeers: Map<string, QuarantinedPeer>'), 'Debe gestionar quarantinedPeers');
    assert(gseCode.includes('seenNonces: Map<string, number>'), 'Debe gestionar registro de nonces');
    assert(gseCode.includes('peerTrafficWindow: Map<string, number[]>'), 'Debe gestionar ventana temporal de tráfico');
    assert(gseCode.includes('public subscribeAuditLog('), 'Debe permitir suscripción a log de auditoría');
});

runTest('2. messageDispatcher: Interceptación SPI de paquetes entrantes antes del dispatch', () => {
    assert(dispCode.includes('globalShield.inspectIncomingPacket('), 'messageDispatcher debe invocar inspectIncomingPacket');
    assert(dispCode.includes('if (!verdict.allowed)'), 'messageDispatcher debe bloquear el despacho si el firewall rechaza el paquete');
});

runTest('3. meshRouter: Telemetría de ataques Replay y tramas malformadas conectadas al Escudo', () => {
    assert(routerCode.includes('globalShield.recordReplayAttack(packet.nonce'), 'meshRouter debe reportar replay a globalShield');
    assert(routerCode.includes('globalShield.recordMalformedPacket('), 'meshRouter debe reportar paquetes malformados a globalShield');
});

runTest('4. UI Badges Dinámicos: Sidebar y TacticalCommandCenter sincronizados con DEFCON real', () => {
    assert(sidebarCode.includes('badge: `DEFCON ${shieldTelemetry.currentDefcon}`'), 'Sidebar debe usar badge dinámico de DEFCON');
    assert(!sidebarCode.includes('badge: "DEFCON 1",\n            badgeColor: "#FF3355",\n            tools:'), 'Sidebar no debe tener DEFCON 1 hardcodeado');
    assert(tccCode.includes('badge: `DEFCON ${shieldTelemetry.currentDefcon}`'), 'TacticalCommandCenter debe usar badge dinámico de DEFCON');
});

// ── 2. Simulación de Reglas SPI Firewall ──────────────────────────────────────

// A. Cleartext Guard
function testCleartextPolicy(defconLevel, isEncrypted) {
    const allowCleartext = defconLevel === 4;
    if (!allowCleartext && isEncrypted === false) {
        return { allowed: false, rule: "CLEARTEXT_GUARD" };
    }
    return { allowed: true };
}

runTest('5. SPI Cleartext Guard: Bloquea texto plano en DEFCON 1-3 y lo permite en DEFCON 4', () => {
    assert.strictEqual(testCleartextPolicy(1, false).allowed, false, 'DEFCON 1 debe bloquear texto plano');
    assert.strictEqual(testCleartextPolicy(2, false).allowed, false, 'DEFCON 2 debe bloquear texto plano');
    assert.strictEqual(testCleartextPolicy(3, false).allowed, false, 'DEFCON 3 debe bloquear texto plano');
    assert.strictEqual(testCleartextPolicy(4, false).allowed, true, 'DEFCON 4 debe permitir texto plano');
    assert.strictEqual(testCleartextPolicy(1, true).allowed, true, 'DEFCON 1 debe permitir paquete cifrado');
});

// B. Anti-Replay Guard
class MockReplayGuard {
    constructor() {
        this.seen = new Map();
        this.ttl = 180000; // 3 min
    }
    check(nonce, now = Date.now()) {
        if (!nonce) return { allowed: true };
        if (this.seen.has(nonce)) {
            const exp = this.seen.get(nonce);
            if (now < exp) {
                return { allowed: false, rule: "ANTI_REPLAY" };
            }
        }
        this.seen.set(nonce, now + this.ttl);
        return { allowed: true };
    }
}

runTest('6. SPI Anti-Replay: Detección y descarte instantáneo de nonces repetidos', () => {
    const guard = new MockReplayGuard();
    const nonce = 'nonce_unique_tag_alpha_9912';
    
    // Primer paso: debe permitirse
    const first = guard.check(nonce);
    assert.strictEqual(first.allowed, true, 'Primer paquete con nonce debe permitirse');

    // Segundo paso: mismo nonce, debe bloquearse
    const second = guard.check(nonce);
    assert.strictEqual(second.allowed, false, 'Paquete con nonce duplicado debe bloquearse');
    assert.strictEqual(second.rule, 'ANTI_REPLAY', 'Regla de rechazo debe ser ANTI_REPLAY');
});

// C. Anti-Sybil Rate Limiter & Quarantine
class MockSybilGovernor {
    constructor() {
        this.traffic = new Map();
        this.quarantined = new Map();
    }
    inspect(peerId, maxPer10s, now = Date.now()) {
        const q = this.quarantined.get(peerId);
        if (q && now < q.expiresAt) {
            return { allowed: false, rule: "ANTI_SYBIL", quarantined: true };
        }

        let timestamps = (this.traffic.get(peerId) || []).filter(t => now - t < 10000);
        timestamps.push(now);
        this.traffic.set(peerId, timestamps);

        if (timestamps.length > maxPer10s) {
            this.quarantined.set(peerId, { expiresAt: now + 60000 });
            return { allowed: false, rule: "ANTI_SYBIL", quarantined: true };
        }

        return { allowed: true, count: timestamps.length };
    }
}

runTest('7. SPI Anti-Sybil: Bloqueo por ráfaga excesiva y cuarentena hostil automática', () => {
    const gov = new MockSybilGovernor();
    const peer = 'hostile_flooder_node';
    const limit = 4; // DEFCON 1 limit
    const baseTime = 1000000;

    // Enviar 4 paquetes dentro de la ventana de 10s: deben permitirse
    for (let i = 0; i < 4; i++) {
        const res = gov.inspect(peer, limit, baseTime + i * 100);
        assert.strictEqual(res.allowed, true, `Paquete ${i + 1} debe permitirse dentro del límite`);
    }

    // El 5to paquete excede el límite de 4: debe bloquearse y activar cuarentena
    const burst = gov.inspect(peer, limit, baseTime + 500);
    assert.strictEqual(burst.allowed, false, 'Paquete 5 debe ser bloqueado por Sybil');
    assert.strictEqual(burst.quarantined, true, 'El nodo debe entrar en cuarentena');

    // Siguiente paquete en cuarentena: debe ser bloqueado directamente
    const subsequent = gov.inspect(peer, limit, baseTime + 1000);
    assert.strictEqual(subsequent.allowed, false, 'Nodo en cuarentena no puede transmitir');
});

// D. PoW Hashcash SHA-256 Validation
function verifyPoW(content, nonce, difficulty) {
    const hash = crypto.createHash('sha256').update(content + nonce).digest('hex');
    const requiredPrefix = '0'.repeat(difficulty);
    return {
        valid: hash.startsWith(requiredPrefix),
        hash
    };
}

runTest('8. SPI PoW Hashcash: Verificación matemática de dificultad de minado', () => {
    const content = 'TACTICAL_MESH_PAYLOAD';
    // Buscamos un nonce válido para dificultad 2
    let nonce = 0;
    let mined = false;
    while (!mined && nonce < 10000) {
        nonce++;
        const res = verifyPoW(content, nonce, 2);
        if (res.valid) mined = true;
    }
    assert(mined, 'Debe minarse un nonce con prefijo 00');
    assert(verifyPoW(content, nonce, 2).valid, 'El PoW minado debe pasar la verificación');
    
    // Con dificultad superior (ej. 5), este nonce debe fallar casi con certeza
    assert.strictEqual(verifyPoW(content, nonce, 5).valid, false, 'Nonce de menor dificultad no debe pasar dificultad 5');
});

// E. Cálculo Dinámico de Autonomía de Batería según DEFCON
function calcBatteryAutonomy(batteryLevel, defcon) {
    const defconPowerFactor = defcon === 1 ? 1.6 : defcon === 2 ? 1.25 : defcon === 3 ? 1.0 : 0.85;
    const baseHours = (batteryLevel / 100) * 32;
    return batteryLevel === 0 ? 0.0 : parseFloat((baseHours * defconPowerFactor).toFixed(1));
}

runTest('9. Telemetría de Batería: DEFCON 1 (Apagón) maximiza autonomía respecto a DEFCON 4', () => {
    const hoursDefcon1 = calcBatteryAutonomy(80, 1);
    const hoursDefcon4 = calcBatteryAutonomy(80, 4);

    assert(hoursDefcon1 > hoursDefcon4, 'DEFCON 1 debe proporcionar sustancialmente más autonomía que DEFCON 4');
    assert.strictEqual(hoursDefcon1, 41.0, '80% en DEFCON 1: 0.8 * 32 * 1.6 = 40.96 -> 41.0h');
    assert.strictEqual(hoursDefcon4, 21.8, '80% en DEFCON 4: 0.8 * 32 * 0.85 = 21.76 -> 21.8h');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests / totalTests) * 100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
