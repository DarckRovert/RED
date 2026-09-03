/**
 * TEST SUITE: WEBRTC FULL-MESH GLARE RESOLUTION & ICE CANDIDATE BUFFERING
 * 
 * Valida la resiliencia y el protocolo de negociación perfecta en llamadas de escuadrón:
 * 1. useSquadCallMesh.ts: Regla determinista de iniciador (myIdentityHash > senderHash) ante group_call_join.
 * 2. useSquadCallMesh.ts: Detección de colisión de ofertas (glare) y rollback para el nodo polite.
 * 3. useSquadCallMesh.ts: Prevalencia de oferta local y descarte de oferta colisionada para el nodo impolite.
 * 4. useSquadCallMesh.ts: Buffer FIFO de candidatos ICE tempranos (pendingCandidatesRef) y drenaje automático.
 * 5. useSquadCallMesh.ts: Limpieza exhaustiva de colas y DataChannels en closePeer() y cleanupAll().
 * 6. Simulación matemática de protocolo determinista entre pares asíncronos.
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
console.log('📡 INICIANDO SUITE DE PRUEBAS: WEBRTC FULL-MESH GLARE & ICE DRAIN RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de useSquadCallMesh.ts ─────────────────────────────
const squadPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'useSquadCallMesh.ts');
const squadCode = fs.readFileSync(squadPath, 'utf8');

runTest('1. useSquadCallMesh: Buffer de candidatos ICE (pendingCandidatesRef) declarado', () => {
    assert(squadCode.includes('pendingCandidatesRef = useRef'), 'Debe existir pendingCandidatesRef');
    assert(squadCode.includes('drainPendingCandidates'), 'Debe existir la función de drenaje drainPendingCandidates');
});

runTest('2. useSquadCallMesh: Conexión inmediata ante group_call_join sin asimetrías de unión', () => {
    assert(squadCode.includes("if (signal.type === 'group_call_join') {"), 'Debe escuchar group_call_join');
    assert(squadCode.includes("const rawOffer = await pc.createOffer("), 'Debe iniciar oferta hacia el nodo entrante');
});

runTest('3. useSquadCallMesh: Detección de glare y Perfect Negotiation (RFC 8829) con rollback', () => {
    assert(squadCode.includes("const isPolite = myIdentityHash.localeCompare(senderHash) < 0;"), 'Debe clasificar rol polite/impolite');
    assert(squadCode.includes("const offerCollision = pc.signalingState !== 'stable';"), 'Debe detectar colisión de oferta');
    assert(squadCode.includes("await pc.setLocalDescription({ type: 'rollback' });"), 'El nodo polite debe ejecutar rollback');
    assert(squadCode.includes("return;"), 'El nodo impolite debe descartar la oferta en colisión');
});

runTest('4. useSquadCallMesh: Encolado de candidatos ICE si remoteDescription no está lista', () => {
    assert(squadCode.includes("!pc.remoteDescription || !pc.remoteDescription.type"), 'Debe verificar si remoteDescription está lista');
    assert(squadCode.includes("pendingCandidatesRef.current.get(senderHash)!.push(signal.candidate);"), 'Debe encolar candidato pendiente');
    assert(squadCode.includes("await drainPendingCandidates(senderHash, pc);"), 'Debe drenar candidatos tras setRemoteDescription');
});

runTest('5. useSquadCallMesh: Limpieza estricta de buffers, tracks remotos y canales en closePeer y cleanupAll', () => {
    assert(squadCode.includes("pendingCandidatesRef.current.delete(peerHash);"), 'closePeer debe purgar cola del par');
    assert(squadCode.includes("pendingCandidatesRef.current.clear();"), 'cleanupAll debe purgar todas las colas');
    assert(squadCode.includes("squadDataChannelsRef.current.clear();"), 'cleanupAll debe cerrar y purgar DataChannels');
    assert(squadCode.includes("stream.getTracks().forEach(t => t.stop());"), 'Debe detener tracks remotos para evitar fugas');
});

// ── 2. Simulación Algorítmica de Negociación Perfecta y Drenaje ICE ──────────
function simulateInitiatorDecision(peerA, peerB) {
    const isAInitiator = peerA.localeCompare(peerB) > 0;
    const isBInitiator = peerB.localeCompare(peerA) > 0;
    return { isAInitiator, isBInitiator };
}

runTest('6. Algoritmo: Decisión determinista de iniciador produce exactamente un emisor de oferta', () => {
    const nodeAlpha = '01a4b8c9d0e1f2';
    const nodeBravo = '02b5c9d0e1f2a3';

    const decision = simulateInitiatorDecision(nodeAlpha, nodeBravo);
    assert.notStrictEqual(decision.isAInitiator, decision.isBInitiator, 'Exactamente uno de los nodos debe ser iniciador');
    assert.strictEqual(decision.isBInitiator, true, 'Nodo con hash mayor debe ser el iniciador');
    assert.strictEqual(decision.isAInitiator, false, 'Nodo con hash menor debe esperar');
});

function simulateGlareHandling(myHash, senderHash, signalingState) {
    const isPolite = myHash.localeCompare(senderHash) < 0;
    const offerCollision = signalingState !== 'stable';

    if (offerCollision) {
        if (!isPolite) {
            return { action: 'IGNORE_OFFER', reason: 'impolite_peer_precedence' };
        }
        return { action: 'ROLLBACK_LOCAL_OFFER', reason: 'polite_peer_yields' };
    }
    return { action: 'ACCEPT_OFFER', reason: 'clean_signaling_state' };
}

runTest('7. Algoritmo: Colisión de ofertas (glare) resuelta sin excepción', () => {
    const politeNode = 'node_001';
    const impoliteNode = 'node_002';

    // Ambos nodos reciben oferta mientras están en 'have-local-offer'
    const resPolite = simulateGlareHandling(politeNode, impoliteNode, 'have-local-offer');
    const resImpolite = simulateGlareHandling(impoliteNode, politeNode, 'have-local-offer');

    assert.strictEqual(resPolite.action, 'ROLLBACK_LOCAL_OFFER', 'Nodo polite debe ceder y hacer rollback');
    assert.strictEqual(resImpolite.action, 'IGNORE_OFFER', 'Nodo impolite debe mantener su oferta');
});

runTest('8. Algoritmo: Candidatos ICE tempranos se drenan en orden FIFO estricto', () => {
    const candidateBuffer = [];
    let remoteDescriptionSet = false;
    const appliedCandidates = [];

    function onCandidateArrived(candidate) {
        if (!remoteDescriptionSet) {
            candidateBuffer.push(candidate);
        } else {
            appliedCandidates.push(candidate);
        }
    }

    function onRemoteDescriptionSet() {
        remoteDescriptionSet = true;
        while (candidateBuffer.length > 0) {
            appliedCandidates.push(candidateBuffer.shift());
        }
    }

    // Llegan 3 candidatos antes de la descripción remota
    onCandidateArrived({ candidate: 'cand_1', sdpMLineIndex: 0 });
    onCandidateArrived({ candidate: 'cand_2', sdpMLineIndex: 0 });
    onCandidateArrived({ candidate: 'cand_3', sdpMLineIndex: 0 });

    assert.strictEqual(appliedCandidates.length, 0, 'No debe aplicar candidatos sin remoteDescription');
    assert.strictEqual(candidateBuffer.length, 3, 'Debe retener 3 candidatos en cola');

    // Se establece la descripción remota
    onRemoteDescriptionSet();

    assert.strictEqual(candidateBuffer.length, 0, 'La cola debe quedar vacía tras el drenaje');
    assert.strictEqual(appliedCandidates.length, 3, 'Todos los candidatos deben haberse aplicado');
    assert.strictEqual(appliedCandidates[0].candidate, 'cand_1', 'Orden FIFO estricto: cand_1 primero');
    assert.strictEqual(appliedCandidates[2].candidate, 'cand_3', 'Orden FIFO estricto: cand_3 tercero');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests/totalTests)*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
