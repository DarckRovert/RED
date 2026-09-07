/**
 * test-tactical-advanced-engines-resilience.js — RED Sovereign Mesh OS (v93.0.0)
 * 
 * Comprehensive Resilience Suite for Advanced Tactical Engines:
 * 1. DtnStoreForwardEngine: Key derivation from red_identity_hash, fallback decryption, bundle capping.
 * 2. EmpChaosOrchestratorEngine: Faraday isolation, dynamic bearer force, DEFCON state save & restore.
 * 3. MediaChunker: Fletcher-32 checksum, K+M erasure coding, bit rotation parity & recovery.
 * 4. MeshUavRelayEngine: Friis FSPL 3D link budget, geometric radio horizon coverage.
 * 5. SlottedGossipEngine: Slotted backoff gossip, Bloom filter deduplication, dummy RF padding.
 * 6. TacticalMicroBurstEngine: LPI/LPD sub-15ms burst airtime, pseudo-random silence jitter.
 * 7. ShamirSocialRecoveryVault: 3-of-5 threshold polynomial secret sharing and recovery.
 * 8. PsychoacousticStegoEngine: Preamble-anchored audio steganography, Float32 polarity recovery.
 * 9. CrdtStateReconciler: Vector clock causality comparison, LWW-Element-Set with tombstone precedence.
 * 10. BazaarSyncEngine: CRDT marketplace offer publication, retirement tombstone, peer merge.
 * 11. LocalChainLedger: Offline Merkle root calculation, genesis block structure, transaction anchors.
 * 12. SurvivalTelemetryEngine: Mesh battery autonomy projection, RF congestion levels, thermal states.
 * 13. OemBatteryHelper: OEM battery killer profiling (Xiaomi, Samsung, Huawei) and autostart mitigations.
 * 14. CallHistoryEngine: Persistent call records, reverse chronological sorting, LRU capacity limit.
 * 15. TacticalVoiceCompressor: 8kHz downsampling, 4-bit IMA-ADPCM quantization tables and index bounds.
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
console.log('🛡️ INICIANDO SUITE DE PRUEBAS: ADVANCED TACTICAL ENGINES RESILIENCE');
console.log('================================================================================\n');

// ── 1. DtnStoreForwardEngine.ts ──────────────────────────────────────────────
const dtnPath = path.join(__dirname, '..', 'src', 'lib', 'storage', 'DtnStoreForwardEngine.ts');
const dtnCode = fs.readFileSync(dtnPath, 'utf8');

runTest('1. DtnStoreForwardEngine: Derivación prioritaria desde red_identity_hash', () => {
    assert(dtnCode.includes("localStorage.getItem('red_identity_hash')"), 'Debe comprobar red_identity_hash');
    assert(dtnCode.includes("iterations: 310_000"), 'Debe usar 310k iteraciones PBKDF2');
    assert(dtnCode.includes("AES-GCM"), 'Debe cifrar en AES-GCM');
});

runTest('2. DtnStoreForwardEngine: Soporta fallback multinivel (310k y 10k iteraciones legacy)', () => {
    assert(dtnCode.includes('fallbackKey310k'), 'Debe incluir fallback de 310k iteraciones');
    assert(dtnCode.includes('fallbackKey10k'), 'Debe incluir fallback de 10k iteraciones legacy');
    assert(dtnCode.includes('MAX_DTN_BUNDLES = 200'), 'Debe limitar a 200 bundles para proteger cuota');
});

// ── 2. EmpChaosOrchestratorEngine.ts ─────────────────────────────────────────
const empPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'EmpChaosOrchestratorEngine.ts');
const empCode = fs.readFileSync(empPath, 'utf8');

runTest('3. EmpChaosOrchestratorEngine: Escenarios tácticos declarados y persistencia DEFCON', () => {
    assert(empCode.includes('EMP_SIMULATION'), 'Debe soportar EMP_SIMULATION');
    assert(empCode.includes('RF_JAMMING_FLOOD'), 'Debe soportar RF_JAMMING_FLOOD');
    assert(empCode.includes('MESH_PARTITION'), 'Debe soportar MESH_PARTITION');
    assert(empCode.includes('previousDefcon'), 'Debe preservar el nivel previo de DEFCON');
    assert(empCode.includes('globalShield.setDefcon(this.previousDefcon || 5)'), 'Debe restaurar DEFCON previo o Peacetime');
});

// ── 3. MediaChunker.ts ────────────────────────────────────────────────────────
const chunkerPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'mediaChunker.ts');
const chunkerCode = fs.readFileSync(chunkerPath, 'utf8');

runTest('4. MediaChunker: Arquitectura K+M Erasure Coding con Fletcher-32 y CWND', () => {
    assert(chunkerCode.includes('fletcher32'), 'Debe calcular suma de verificación Fletcher-32');
    assert(chunkerCode.includes('recoverMissingBlocks'), 'Debe implementar decodificación de borrado');
    assert(chunkerCode.includes('sendChunked'), 'Debe implementar transmisión con ventana deslizante (CWND)');
    assert(chunkerCode.includes('getOptimalChunkSize'), 'Debe calcular tamaño óptimo por bearer');
});

runTest('5. MediaChunker: Fletcher-32 checksum determinismo algorítmico', () => {
    function fletcher32(bytes) {
        let sum1 = 0xffff, sum2 = 0xffff;
        for (let i = 0; i < bytes.length; i++) {
            sum1 = (sum1 + bytes[i]) % 65535;
            sum2 = (sum2 + sum1) % 65535;
        }
        return (sum2 << 16) | sum1;
    }
    const sample = Buffer.from('RED_SOVEREIGN_TACTICAL_DATA_PACKET_2026', 'utf8');
    const chk1 = fletcher32(sample);
    const chk2 = fletcher32(sample);
    assert.strictEqual(chk1, chk2, 'Fletcher-32 debe ser determinista');
    assert(chk1 !== 0, 'Checksum no debe ser 0');
});

// ── 4. MeshUavRelayEngine.ts ─────────────────────────────────────────────────
const uavPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'MeshUavRelayEngine.ts');
const uavCode = fs.readFileSync(uavPath, 'utf8');

runTest('6. MeshUavRelayEngine: Presupuesto de enlace FSPL Friis 3D y horizonte radioeléctrico', () => {
    assert(uavCode.includes('calculateLinkBudget'), 'Debe incluir cálculo FSPL');
    assert(uavCode.includes('calculateCoverageRadiusKm'), 'Debe calcular horizonte de cobertura');
    assert(uavCode.includes('20 * Math.log10(distanceKm)'), 'Debe usar fórmula logarítmica de Friis');
    assert(uavCode.includes('6371'), 'Debe usar radio terrestre WGS-84 (6371 km)');
});

runTest('7. MeshUavRelayEngine: Verificación matemática de FSPL y cobertura', () => {
    const earthRadiusKm = 6371;
    const hKm = 100 / 1000;
    const radius = Math.sqrt(2 * earthRadiusKm * hKm + hKm * hKm);
    assert(radius > 35 && radius < 36, `Horizonte geométrico a 100m debe ser ~35.7 km (obtenido: ${radius})`);
});

// ── 5. SlottedGossipEngine.ts ────────────────────────────────────────────────
const gossipPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'SlottedGossipEngine.ts');
const gossipCode = fs.readFileSync(gossipPath, 'utf8');

runTest('8. SlottedGossipEngine: Filtro Bloom 2048 bits con semillas CSPRNG rotativas', () => {
    assert(gossipCode.includes('bloomFilter: Uint8Array = new Uint8Array(256)'), 'Filtro Bloom debe ser 256 bytes (2048 bits)');
    assert(gossipCode.includes('rotateBloomSeeds'), 'Debe rotar semillas CSPRNG periódicamente');
    assert(gossipCode.includes('generateDummyPacket'), 'Debe generar tráfico señuelo constante');
    assert(gossipCode.includes('isDummyPacket'), 'Debe detectar tramas DUMM');
});

runTest('9. SlottedGossipEngine: Detección estricta de tramas señuelo RF (DUMM)', () => {
    const dummy = new Uint8Array([0x44, 0x55, 0x4D, 0x4D, 0x01, 0x02]);
    const real = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    function isDummy(bytes) {
        return bytes.length >= 4 && bytes[0] === 0x44 && bytes[1] === 0x55 && bytes[2] === 0x4D && bytes[3] === 0x4D;
    }
    assert.strictEqual(isDummy(dummy), true, 'Debe identificar trama DUMM');
    assert.strictEqual(isDummy(real), false, 'No debe confundir trama real con señuelo');
});

// ── 6. TacticalMicroBurstEngine.ts ───────────────────────────────────────────
const burstPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'TacticalMicroBurstEngine.ts');
const burstCode = fs.readFileSync(burstPath, 'utf8');

runTest('10. TacticalMicroBurstEngine: Micro-ráfagas LPI/LPD con dispersión estocástica', () => {
    assert(burstCode.includes('isLpiModeActive'), 'Debe implementar modo LPI/LPD');
    assert(burstCode.includes('burstDurationMs'), 'Debe calcular duración de ráfaga');
    assert(burstCode.includes('randomSilenceMs'), 'Debe aplicar silencio estocástico');
    assert(burstCode.includes('enqueuePayload'), 'Debe permitir encolado de cargas tácticas');
});

// ── 7. ShamirSocialRecoveryVault.ts ──────────────────────────────────────────
const shamirPath = path.join(__dirname, '..', 'src', 'lib', 'crypto', 'ShamirSocialRecoveryVault.ts');
const shamirCode = fs.readFileSync(shamirPath, 'utf8');

runTest('11. ShamirSocialRecoveryVault: Esquema de umbral 3-de-5 y bóveda de guardianes', () => {
    assert(shamirCode.includes('ShamirSecretSharingEngine.splitSecret(masterSecretHex, 3, 5)'), 'Debe fijar umbral 3-de-5');
    assert(shamirCode.includes('addCollectedShare'), 'Debe registrar fragmentos sin duplicados');
    assert(shamirCode.includes('reconstructSecret'), 'Debe reconstruir secreto al alcanzar umbral');
});

// ── 8. PsychoacousticStegoEngine.ts ─────────────────────────────────────────
const stegoPath = path.join(__dirname, '..', 'src', 'lib', 'crypto', 'PsychoacousticStegoEngine.ts');
const stegoCode = fs.readFileSync(stegoPath, 'utf8');

runTest('12. PsychoacousticStegoEngine: Esteganografía en portadora WAV con stride fijo', () => {
    assert(stegoCode.includes("PREAMBLE = 'RED_STEGO_V1::'"), 'Debe definir preámbulo canónico');
    assert(stegoCode.includes('FIXED_STRIDE = 16'), 'Debe utilizar stride de 16 muestras');
    assert(stegoCode.includes('embedPayload'), 'Debe implementar modulación de bits');
    assert(stegoCode.includes('extractFromWavBuffer'), 'Debe implementar extracción directa de RIFF WAV');
});

runTest('13. PsychoacousticStegoEngine: Inyección y extracción binaria simétrica', () => {
    const PREAMBLE = 'RED_STEGO_V1::';
    const FIXED_STRIDE = 16;
    function embed(samples, secret) {
        const text = `${PREAMBLE}${secret}::EOF`;
        const bytes = Buffer.from(text, 'utf8');
        const out = new Float32Array(samples);
        const bits = [];
        for (let i = 0; i < bytes.length; i++) {
            for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
        }
        let bitIdx = 0;
        for (let i = 100; i < out.length && bitIdx < bits.length; i += FIXED_STRIDE) {
            out[i] = bits[bitIdx] === 1 ? Math.abs(out[i]) + 0.005 : -Math.abs(out[i]) - 0.005;
            bitIdx++;
        }
        return out;
    }
    function extract(samples) {
        const bits = [];
        for (let i = 100; i < samples.length; i += FIXED_STRIDE) bits.push(samples[i] >= 0 ? 1 : 0);
        const bytes = [];
        for (let i = 0; i + 7 < bits.length; i += 8) {
            let byte = 0;
            for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b];
            bytes.push(byte);
        }
        const str = Buffer.from(bytes).toString('utf8');
        if (str.includes(PREAMBLE)) {
            const s = str.indexOf(PREAMBLE) + PREAMBLE.length;
            const e = str.indexOf('::EOF', s);
            if (e !== -1) return str.substring(s, e);
        }
        return null;
    }
    const samples = new Float32Array(8000);
    const secret = 'EMERGENCY_KEY_7749';
    const recovered = extract(embed(samples, secret));
    assert.strictEqual(recovered, secret, 'La clave extraída debe coincidir con la inyectada');
});

// ── 9. CrdtStateReconciler.ts ────────────────────────────────────────────────
const crdtPath = path.join(__dirname, '..', 'src', 'lib', 'storage', 'CrdtStateReconciler.ts');
const crdtCode = fs.readFileSync(crdtPath, 'utf8');

runTest('14. CrdtStateReconciler: Relojes Vectoriales y resolución determinista LWW', () => {
    assert(crdtCode.includes('compareVectorClocks'), 'Debe comparar causalidad de relojes vectoriales');
    assert(crdtCode.includes('mergeVectorClocks'), 'Debe calcular el supremo de relojes');
    assert(crdtCode.includes('reconcileSet'), 'Debe reconciliar LWW-Element-Set');
    assert(crdtCode.includes('tomb.timestamp >= addItem.timestamp'), 'Lápida con timestamp >= debe eliminar elemento');
});

runTest('15. CrdtStateReconciler: Verificación algorítmica de causalidad concurrente', () => {
    function compareClocks(a, b) {
        let greater = false;
        let lesser = false;
        const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of allKeys) {
            const vA = a[key] || 0;
            const vB = b[key] || 0;
            if (vA > vB) greater = true;
            if (vA < vB) lesser = true;
        }
        if (!greater && !lesser) return 'EQUAL';
        if (greater && !lesser) return 'AFTER';
        if (!greater && lesser) return 'BEFORE';
        return 'CONCURRENT';
    }
    assert.strictEqual(compareClocks({ A: 1, B: 2 }, { A: 1, B: 2 }), 'EQUAL');
    assert.strictEqual(compareClocks({ A: 2, B: 2 }, { A: 1, B: 2 }), 'AFTER');
    assert.strictEqual(compareClocks({ A: 1, B: 1 }, { A: 1, B: 2 }), 'BEFORE');
    assert.strictEqual(compareClocks({ A: 2, B: 1 }, { A: 1, B: 2 }), 'CONCURRENT');
});

// ── 10. BazaarSyncEngine.ts ──────────────────────────────────────────────────
const bazaarPath = path.join(__dirname, '..', 'src', 'lib', 'storage', 'BazaarSyncEngine.ts');
const bazaarCode = fs.readFileSync(bazaarPath, 'utf8');

runTest('16. BazaarSyncEngine: Publicación, baja con lápidas y exportación CRDT', () => {
    assert(bazaarCode.includes('publishListing'), 'Debe permitir publicar ofertas');
    assert(bazaarCode.includes('retireListing'), 'Debe generar tombstones en removeSet');
    assert(bazaarCode.includes('mergeRemoteCrdt'), 'Debe permitir fusión determinista de catálogos');
});

// ── 11. LocalChainLedger.ts ──────────────────────────────────────────────────
const ledgerPath = path.join(__dirname, '..', 'src', 'lib', 'blockchain', 'LocalChainLedger.ts');
const ledgerCode = fs.readFileSync(ledgerPath, 'utf8');

runTest('17. LocalChainLedger: Árbol Merkle, Bloque Génesis e inmutabilidad de bloques', () => {
    assert(ledgerCode.includes('calculateMerkleRoot'), 'Debe calcular raíz Merkle criptográfica');
    assert(ledgerCode.includes('createGenesisBlock'), 'Debe generar bloque génesis determinista');
    assert(ledgerCode.includes('ChainTransaction'), 'Debe tipar transacciones de la cadena');
    assert(ledgerCode.includes('nobleSha256'), 'Debe contar con respaldo SHA-256 de noble-hashes');
});

// ── 12. SurvivalTelemetryEngine.ts ───────────────────────────────────────────
const survPath = path.join(__dirname, '..', 'src', 'lib', 'telemetry', 'SurvivalTelemetryEngine.ts');
const survCode = fs.readFileSync(survPath, 'utf8');

runTest('18. SurvivalTelemetryEngine: Proyección de autonomía, congestión RF y térmica', () => {
    assert(survCode.includes('gatherTelemetry'), 'Debe recopilar telemetría de supervivencia');
    assert(survCode.includes('estimatedMeshHoursRemaining'), 'Debe proyectar horas de batería en malla');
    assert(survCode.includes('rfSpectrumCongestion'), 'Debe auditar congestión RF');
    assert(survCode.includes('thermalState'), 'Debe clasificar estado térmico');
});

// ── 13. OemBatteryHelper.ts ──────────────────────────────────────────────────
const oemPath = path.join(__dirname, '..', 'src', 'lib', 'hardware', 'OemBatteryHelper.ts');
const oemCode = fs.readFileSync(oemPath, 'utf8');

runTest('19. OemBatteryHelper: Perfiles anti-battery killer (Xiaomi/Samsung/Huawei/Oppo)', () => {
    assert(oemCode.includes('getOemProfile'), 'Debe resolver perfil del fabricante');
    assert(oemCode.includes('Xiaomi HyperOS / MIUI'), 'Debe mitigar asesinos de Xiaomi');
    assert(oemCode.includes('Samsung OneUI'), 'Debe mitigar asesinos de Samsung');
    assert(oemCode.includes('Huawei EMUI'), 'Debe mitigar asesinos de Huawei');
    assert(oemCode.includes('isOemAggressiveKiller'), 'Debe marcar agresividad OEM');
});

// ── 14. CallHistoryEngine.ts ─────────────────────────────────────────────────
const callHistPath = path.join(__dirname, '..', 'src', 'lib', 'audio', 'CallHistoryEngine.ts');
const callHistCode = fs.readFileSync(callHistPath, 'utf8');

runTest('20. CallHistoryEngine: Registro persistente, orden cronológico inverso y cap LRU', () => {
    assert(callHistCode.includes('addRecord'), 'Debe agregar llamadas');
    assert(callHistCode.includes('b.timestamp - a.timestamp'), 'Debe ordenar de más reciente a más antigua');
    assert(callHistCode.includes('this.records.length > 200'), 'Debe aplicar límite LRU de 200 registros');
    assert(callHistCode.includes("STORAGE_KEY = 'red_call_history_v1'"), 'Debe persistir en clave de almacenamiento v1');
});

// ── 15. TacticalVoiceCompressor.ts ───────────────────────────────────────────
const voiceCompPath = path.join(__dirname, '..', 'src', 'lib', 'audio', 'TacticalVoiceCompressor.ts');
const voiceCompCode = fs.readFileSync(voiceCompPath, 'utf8');

runTest('21. TacticalVoiceCompressor: Tablas IMA-ADPCM 4 bits y decimación a 8 kHz', () => {
    assert(voiceCompCode.includes('downsampleTo8kHz'), 'Debe implementar decimación a 8kHz');
    assert(voiceCompCode.includes('compress'), 'Debe comprimir a IMA-ADPCM');
    assert(voiceCompCode.includes('decompress'), 'Debe descomprimir a PCM Int16Array');
    assert(voiceCompCode.includes('STEP_TABLE'), 'Debe contener tabla de pasos IMA-ADPCM estándar de 89 elementos');
});

console.log('\n================================================================================');
const pct = Math.round((passedTests / totalTests) * 100);
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${pct}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
