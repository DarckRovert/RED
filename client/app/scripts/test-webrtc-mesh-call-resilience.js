/**
 * TEST SUITE: WEBRTC P2P MESH CALLS, DATACHANNEL & TACTICAL VOCODER
 * 
 * Valida la resiliencia y acondicionamiento táctico en llamadas P2P y de escuadrón:
 * 1. Acondicionamiento SDP táctico a 16 kbps Opus mono con FEC y límite b=AS:20.
 * 2. Canal de datos bidireccional RTCDataChannel out-of-band (<5ms) en CallScreen.tsx.
 * 3. Transmisión y decodificación de audio de contingencia con LowBitrateVocoder.
 * 4. Canal de datos RTCDataChannel en llamadas de escuadrón en useSquadCallMesh.ts.
 * 5. Señalización instantánea de VAD sobre DataChannel en malla de escuadrón.
 * 6. Indicadores de telemetría y controles tácticos en CallHeader.tsx.
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
console.log('📡 INICIANDO SUITE DE PRUEBAS: WEBRTC P2P MESH CALLS & TACTICAL VOCODER');
console.log('================================================================================\n');

const callScreenPath = path.join(__dirname, '..', 'src', 'components', 'CallScreen.tsx');
const callScreenCode = fs.readFileSync(callScreenPath, 'utf8');

runTest('1. Acondicionamiento SDP Táctico: CallScreen.tsx limita Opus a 16 kbps mono con in-band FEC', () => {
    assert(callScreenCode.includes('applyTacticalSdpConstraints'), 'Debe definir applyTacticalSdpConstraints');
    assert(callScreenCode.includes('maxaveragebitrate=16000;stereo=0;sprop-stereo=0'), 'Debe forzar maxaveragebitrate=16000 y stereo=0');
    assert(callScreenCode.includes('b=AS:20'), 'Debe inyectar directiva de ancho de banda b=AS:20');
    assert(callScreenCode.includes('applyTacticalSdpConstraints(rawOffer.sdp'), 'Debe acondicionar la oferta del llamador');
    assert(callScreenCode.includes('applyTacticalSdpConstraints(rawAnswer.sdp'), 'Debe acondicionar la respuesta del receptor');
});

runTest('2. RTCDataChannel en Llamadas 1 a 1: CallScreen.tsx negocia canal out-of-band red-tactical-comms', () => {
    assert(callScreenCode.includes('pc.createDataChannel("red-tactical-comms"'), 'El llamador debe iniciar el DataChannel táctico');
    assert(callScreenCode.includes('pc.ondatachannel = (event) =>'), 'El receptor debe escuchar ondatachannel');
    assert(callScreenCode.includes('setupDataChannel(event.channel)'), 'Debe vincular el canal recibido');
});

runTest('3. Vocoder de Contingencia en DataChannel: Decodificación y síntesis de tramas de voz', () => {
    assert(callScreenCode.includes('LowBitrateVocoder.createAudioBufferFromEncoded'), 'Debe decodificar y sintetizar tramas vocoder');
    assert(callScreenCode.includes('event.data instanceof ArrayBuffer'), 'Debe procesar frames binarios en DataChannel');
    assert(callScreenCode.includes('toggleVocoderMode'), 'Debe permitir conmutación de modo vocoder');
});

const squadPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'useSquadCallMesh.ts');
const squadCode = fs.readFileSync(squadPath, 'utf8');

runTest('4. Malla de Escuadrón: useSquadCallMesh.ts integra RTCDataChannel red-squad-data', () => {
    assert(squadCode.includes("pc.createDataChannel('red-squad-data'"), 'Debe crear canal red-squad-data por par');
    assert(squadCode.includes('setupSquadDataChannel(targetPeerHash'), 'Debe inicializar el canal con cada nodo del escuadrón');
    assert(squadCode.includes('squadDataChannelsRef.current.get(peerHash)'), 'Debe gestionar los DataChannels del pool de peers');
});

runTest('5. VAD Out-of-Band en Escuadrón: Difusión inmediata (<5ms) de estado de habla sin pasar por servidor', () => {
    assert(squadCode.includes("type: 'vad-speaking', isSpeaking: speaking"), 'Debe emitir vad-speaking por el DataChannel');
    assert(squadCode.includes("msg.type === 'vad-speaking'"), 'Debe procesar vad-speaking entrante');
});

const headerPath = path.join(__dirname, '..', 'src', 'components', 'call', 'CallHeader.tsx');
const headerCode = fs.readFileSync(headerPath, 'utf8');

runTest('6. HUD Táctico CallHeader: Badges visuales de DataChannel (⚡ DC) y Vocoder (🎙️ VOC-16K)', () => {
    assert(headerCode.includes('isDataChannelReady &&'), 'Debe admitir estado de DataChannel');
    assert(headerCode.includes('· ⚡ DC'), 'Debe renderizar badge táctico DC');
    assert(headerCode.includes('· 🎙️ VOC-16K'), 'Debe renderizar badge táctico vocoder');
    assert(headerCode.includes('toggleVocoderMode'), 'Debe permitir alternar vocoder en el menú táctico');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests/totalTests)*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
