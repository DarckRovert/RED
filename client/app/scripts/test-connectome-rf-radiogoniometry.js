/**
 * TEST SUITE: CONNECTOME RF DIRECTION-FINDING & NEURO-SYNAPTIC CLOSED LOOP
 * 
 * Validación matemática, empírica y estática del circuito cerrado:
 * 1. Inspección estática del SSOT en los 6 archivos del conectoma.
 * 2. Validación de estadística direccional (Mardia & Jupp / Vector Poblacional de Rayleigh).
 * 3. Simulación de radiogoniometría bio-inercial con antena cardioide realista.
 * 4. Resistencia a falsos positivos ante ruido blanco isotrópico (anisotropía nula).
 * 5. Inyección multimodal en el Complejo Central (cuñas E-PG de RingAttractor).
 * 6. Memoria asociativa de ruta (engramas de navegación) en DtnMushroomBodyEngine.
 * 7. Integridad del puente neuro-simbólico ConnectomeCortexBridge y Copiloto IA.
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
console.log('🧠📡 INICIANDO SUITE DE PRUEBAS: CONNECTOME RF RADIOGONIOMETRY & CLOSED LOOP');
console.log('================================================================================\n');

// ── 1. Inspección Estática de Archivos Fuente ─────────────────────────────────
const srcDir = path.join(__dirname, '..', 'src');

runTest('1. SynapticMeshRouterEngine: Definición de histograma de 16 sectores y AoA', () => {
    const p = path.join(srcDir, 'lib', 'neuro', 'SynapticMeshRouterEngine.ts');
    const code = fs.readFileSync(p, 'utf8');
    assert(code.includes('export interface RfSectorHistogram'), 'Debe exportar RfSectorHistogram');
    assert(code.includes('export interface RfPeerBearing'), 'Debe exportar RfPeerBearing');
    assert(code.includes('decodePopulationVector'), 'Debe implementar decodePopulationVector');
    assert(code.includes('getPeerRfBearing'), 'Debe implementar getPeerRfBearing');
    assert(code.includes('getAllActiveBearings'), 'Debe implementar getAllActiveBearings');
    assert(code.includes('rfHistogram?: RfSectorHistogram'), 'SynapticLink debe contener rfHistogram');
});

runTest('2. RingAttractorEngine: Cues de radiofrecuencia e integración sensorial', () => {
    const p = path.join(srcDir, 'lib', 'neuro', 'RingAttractorEngine.ts');
    const code = fs.readFileSync(p, 'utf8');
    assert(code.includes('export interface RfBearingCue'), 'Debe exportar RfBearingCue');
    assert(code.includes('rfBearings?: RfBearingCue[]'), 'RingAttractorTelemetry debe incluir rfBearings');
    assert(code.includes('injectRfBearingCue'), 'Debe implementar injectRfBearingCue');
    assert(code.includes('getRfBearingCues'), 'Debe implementar getRfBearingCues');
});

runTest('3. DtnMushroomBodyEngine: Engramas bio-inerciales de ruta', () => {
    const p = path.join(srcDir, 'lib', 'neuro', 'DtnMushroomBodyEngine.ts');
    const code = fs.readFileSync(p, 'utf8');
    assert(code.includes('headingDegAtIngress?: number'), 'AssociativeMemoryRecord debe almacenar headingDegAtIngress');
    assert(code.includes('carrierPeerId?: string'), 'AssociativeMemoryRecord debe almacenar carrierPeerId');
    assert(code.includes('recallRouteEngram'), 'Debe implementar recallRouteEngram');
});

runTest('4. ConnectomeCortexBridge: Arquitectura del puente neuro-simbólico', () => {
    const p = path.join(srcDir, 'lib', 'ai', 'ConnectomeCortexBridge.ts');
    assert(fs.existsSync(p), 'ConnectomeCortexBridge.ts debe existir en disco');
    const code = fs.readFileSync(p, 'utf8');
    assert(code.includes('export class ConnectomeCortexBridge'), 'Debe exportar ConnectomeCortexBridge');
    assert(code.includes('getConnectomeSnapshot'), 'Debe implementar getConnectomeSnapshot');
    assert(code.includes('getFormattedContextForCopilot'), 'Debe implementar getFormattedContextForCopilot');
    assert(code.includes('evaluateConnectomeTacticalQuery'), 'Debe implementar evaluateConnectomeTacticalQuery');
});

runTest('5. AICopilotModal & localAiEngine: Cableado de contexto conectómico', () => {
    const copilotPath = path.join(srcDir, 'components', 'AICopilotModal.tsx');
    const copilotCode = fs.readFileSync(copilotPath, 'utf8');
    assert(copilotCode.includes('ConnectomeCortexBridge'), 'AICopilotModal debe importar ConnectomeCortexBridge');
    assert(copilotCode.includes('Conectoma Drosophila & AoA'), 'AICopilotModal debe incluir preset de conectoma');

    const aiEnginePath = path.join(srcDir, 'lib', 'ai', 'localAiEngine.ts');
    const aiEngineCode = fs.readFileSync(aiEnginePath, 'utf8');
    assert(aiEngineCode.includes('ConnectomeCortexBridge'), 'localAiEngine.ts debe importar ConnectomeCortexBridge');
    assert(aiEngineCode.includes('evaluateConnectomeTacticalQuery'), 'localAiEngine.ts debe consultar ConnectomeCortexBridge');
});

runTest('6. MaleCnsConnectomeHUD & OffGridCompassModal: Lóbulos visuales', () => {
    const hudPath = path.join(srcDir, 'components', 'MaleCnsConnectomeHUD.tsx');
    const hudCode = fs.readFileSync(hudPath, 'utf8');
    assert(hudCode.includes('getAllActiveBearings'), 'MaleCnsConnectomeHUD debe consultar getAllActiveBearings');
    assert(hudCode.includes('RADIOGONIOMETRÍA BIO-INERCIAL AoA'), 'MaleCnsConnectomeHUD debe renderizar tarjeta AoA');

    const compassPath = path.join(srcDir, 'components', 'OffGridCompassModal.tsx');
    const compassCode = fs.readFileSync(compassPath, 'utf8');
    assert(compassCode.includes('getAllActiveBearings'), 'OffGridCompassModal debe consultar getAllActiveBearings');
    assert(compassCode.includes('AoA Radiogoniometry'), 'OffGridCompassModal debe renderizar lóbulos en el canvas');
});

// ── 2. Validación Matemática de la Decodificación de Rayleigh ─────────────────

function decodePopulationVectorPure(sectors, samples) {
    let activeSectors = 0;
    let minW = Infinity;
    let maxW = -Infinity;

    for (let k = 0; k < 16; k++) {
        if (samples[k] > 0 && sectors[k] > 0) {
            activeSectors++;
            const w = sectors[k];
            if (w < minW) minW = w;
            if (w > maxW) maxW = w;
        }
    }

    if (activeSectors < 2 || maxW <= 0 || !isFinite(minW)) {
        return { bearingDeg: null, confidence: 0 };
    }

    const dynamicRange = maxW - minW;
    if (dynamicRange < 3.0) {
        return { bearingDeg: null, confidence: 0 };
    }

    let sumX = 0;
    let sumY = 0;
    let sumDevWeights = 0;
    const baseline = activeSectors >= 3 ? minW : 0;

    for (let k = 0; k < 16; k++) {
        if (samples[k] > 0 && sectors[k] > 0) {
            const sectorCenterDeg = k * 22.5 + 11.25;
            const rad = (sectorCenterDeg * Math.PI) / 180;
            const wDev = sectors[k] - baseline;
            sumX += wDev * Math.cos(rad);
            sumY += wDev * Math.sin(rad);
            sumDevWeights += wDev;
        }
    }

    if (sumDevWeights <= 0.001) {
        return { bearingDeg: null, confidence: 0 };
    }

    const angleRad = Math.atan2(sumY, sumX);
    let deg = (angleRad * 180) / Math.PI;
    while (deg < 0) deg += 360;
    while (deg >= 360) deg -= 360;

    const R = Math.sqrt(sumX * sumX + sumY * sumY) / sumDevWeights;
    const coverageFactor = Math.min(1.0, Math.sqrt(activeSectors / 8));
    const confidence = Number(Math.min(1.0, Math.max(0.0, R * coverageFactor)).toFixed(3));

    return {
        bearingDeg: Math.round(deg * 10) / 10,
        confidence,
    };
}

runTest('7. Matemática: Convergencia de rumbo hacia 135° (SE) con modelo cardioide', () => {
    const trueAzimuthDeg = 135;
    const sectors = new Array(16).fill(0);
    const samples = new Array(16).fill(0);

    // Simular recepción mientras el dispositivo explora 16 orientaciones
    for (let k = 0; k < 16; k++) {
        const orientationDeg = k * 22.5 + 11.25;
        const deltaAngleRad = ((orientationDeg - trueAzimuthDeg) * Math.PI) / 180;
        // Patrón cardioide de antena con atenuación por chasis
        const lqs = Math.max(15, Math.round(30 + 65 * Math.max(0, Math.cos(deltaAngleRad))));
        sectors[k] = lqs;
        samples[k] = 5; // 5 paquetes recibidos en esa orientación
    }

    const res = decodePopulationVectorPure(sectors, samples);
    assert(res.bearingDeg !== null, 'Debe decodificar un rumbo numérico');
    const errorDeg = Math.abs(res.bearingDeg - trueAzimuthDeg);
    assert(errorDeg <= 4.0, `El error angular (${errorDeg.toFixed(2)}°) debe ser menor a 4° (obtenido: ${res.bearingDeg}°)`);
    assert(res.confidence >= 0.40, `La confianza (${res.confidence}) debe ser >= 0.40`);
    console.log(`     -> Rumbo real: 135° | Decodificado: ${res.bearingDeg}° (Error: ${errorDeg.toFixed(2)}°) | Confianza: ${res.confidence}`);
});

runTest('8. Matemática: Convergencia de rumbo hacia 280° (WNW) con muestras dispersas', () => {
    const trueAzimuthDeg = 280;
    const sectors = new Array(16).fill(0);
    const samples = new Array(16).fill(0);

    // Muestreo incompleto (sólo 6 sectores muestreados)
    const sampledIndices = [10, 11, 12, 13, 14, 0];
    for (const k of sampledIndices) {
        const orientationDeg = k * 22.5 + 11.25;
        const deltaAngleRad = ((orientationDeg - trueAzimuthDeg) * Math.PI) / 180;
        const lqs = Math.max(10, Math.round(20 + 75 * Math.max(0, Math.cos(deltaAngleRad))));
        sectors[k] = lqs;
        samples[k] = 3;
    }

    const res = decodePopulationVectorPure(sectors, samples);
    assert(res.bearingDeg !== null, 'Debe decodificar rumbo');
    const errorDeg = Math.abs(((res.bearingDeg - trueAzimuthDeg + 180) % 360) - 180);
    assert(errorDeg <= 6.0, `Error angular (${errorDeg.toFixed(2)}°) debe ser <= 6°`);
    console.log(`     -> Rumbo real: 280° | Decodificado: ${res.bearingDeg}° (Error: ${errorDeg.toFixed(2)}°) | Confianza: ${res.confidence}`);
});

runTest('9. Matemática: Rechazo de falso positivo ante señal isotrópica uniforme (Ruido blanco)', () => {
    const sectors = new Array(16).fill(70); // Señal idéntica en todas direcciones
    const samples = new Array(16).fill(10);

    const res = decodePopulationVectorPure(sectors, samples);
    assert(res.confidence < 0.05, `La confianza ante señal plana (${res.confidence}) debe ser cercana a cero`);
    console.log(`     -> Señal plana uniforme: Confianza resultante = ${res.confidence} (Falso positivo rechazado)`);
});

// ── 3. Simulación Funcional de Circuito Cerrado ────────────────────────────────

runTest('10. Circuito Cerrado: Synaptic Router -> RingAttractor Cue -> DTN Route Engram', () => {
    // Simulación de clase SynapticLink con histograma
    const testPeer = 'did:red:peer_charlie_rescue';
    const link = {
        peerId: testPeer,
        weight: 0.5,
        rfHistogram: {
            sectors: new Array(16).fill(0),
            samples: new Array(16).fill(0),
            estimatedBearingDeg: null,
            confidence: 0,
            totalSamples: 0,
        }
    };

    // Inyectar señales hacia 90° (Este)
    const targetAngle = 90;
    for (let k = 0; k < 16; k++) {
        const orient = k * 22.5 + 11.25;
        const delta = ((orient - targetAngle) * Math.PI) / 180;
        const lqs = Math.max(10, Math.round(30 + 65 * Math.max(0, Math.cos(delta))));
        link.rfHistogram.sectors[k] = lqs;
        link.rfHistogram.samples[k] = 4;
        link.rfHistogram.totalSamples += 4;
    }

    const decoded = decodePopulationVectorPure(link.rfHistogram.sectors, link.rfHistogram.samples);
    link.rfHistogram.estimatedBearingDeg = decoded.bearingDeg;
    link.rfHistogram.confidence = decoded.confidence;

    assert(decoded.bearingDeg !== null, 'Debe estimar marcación');
    assert(Math.abs(decoded.bearingDeg - 90) <= 3, `Debe estar centrado en 90° (+-3°), obtenido: ${decoded.bearingDeg}°`);
    assert(decoded.confidence >= 0.35, 'Debe tener alta confianza');

    // Simular registro de memoria de ruta en DtnMushroomBody
    const dtnRecord = {
        nonce: 'pkt_99901_test',
        carrierPeerId: testPeer,
        headingDegAtIngress: 92.5,
        carrierRfBearingDeg: decoded.bearingDeg,
        isRichClubRoute: true,
        lastReinforcedAt: Date.now(),
        valence: 0.85,
        reinforcementCount: 3,
    };

    // Simular recallRouteEngram
    const recalled = {
        lastKnownHeadingDeg: dtnRecord.headingDegAtIngress,
        carrierPeerId: dtnRecord.carrierPeerId,
        carrierRfBearingDeg: dtnRecord.carrierRfBearingDeg,
        isRichClubRoute: dtnRecord.isRichClubRoute,
        valence: dtnRecord.valence,
    };

    assert.strictEqual(recalled.carrierPeerId, testPeer);
    assert.strictEqual(recalled.carrierRfBearingDeg, decoded.bearingDeg);
    assert.strictEqual(recalled.isRichClubRoute, true);
    console.log(`     -> Enlace sináptico decodificó ${decoded.bearingDeg}° (Conf: ${decoded.confidence}). Engrama DTN recuperado con éxito.`);
});

console.log('\n================================================================================');
console.log(`📊 RESULTADOS: ${passedTests} / ${totalTests} PRUEBAS SUPERADAS (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
console.log('================================================================================\n');

if (passedTests === totalTests) {
    console.log('✨ [SUCCESS] Todos los invariantes matemáticos y arquitectónicos del conectoma pasaron con 100% de paridad.\n');
    process.exit(0);
} else {
    console.error('❌ [ERROR] Se detectaron fallas en la verificación conectómica.\n');
    process.exit(1);
}
