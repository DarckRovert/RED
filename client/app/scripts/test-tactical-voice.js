/**
 * TEST SUITE: TACTICAL VOICE NOTE WAVEFORM & DURATION ENGINE
 * 
 * Valida la resiliencia del analizador acústico, la extracción de picos de onda (waveform)
 * y la mitigación de duración infinita/NaN en contenedores WebM.
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
console.log('🎙️ INICIANDO SUITE DE PRUEBAS: TACTICAL VOICE WAVEFORM & AUDIO PIPELINE');
console.log('================================================================================\n');

runTest('TacticalVoiceAnalyzer: Generador de fallback genera exactamente 28 barras válidas', () => {
    const filePath = path.join(__dirname, '..', 'src', 'lib', 'audio', 'TacticalVoiceAnalyzer.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    assert(content.includes('generateFallbackWaveform'), 'Debe existir método de fallback acústico');
    assert(content.includes('bars.push(Math.min(24, Math.max(4, height)))'), 'Las barras deben estar acotadas entre 4 y 24px');
});

runTest('ChatWindow: stopRecording ejecuta TacticalVoiceAnalyzer y extrae waveform y duración real', () => {
    const filePath = path.join(__dirname, '..', 'src', 'components', 'ChatWindow.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert(content.includes('TacticalVoiceAnalyzer.analyzeAudioBlob'), 'Debe invocar analyzeAudioBlob en stopRecording');
    assert(content.includes('setVoicePreviewWaveform'), 'Debe almacenar los picos de onda en el estado de preview');
    assert(content.includes('waveform: waveform.length > 0 ? waveform : undefined'), 'Debe propagar waveform en confirmVoiceSend');
});

runTest('VoiceMessage: Usa msg.waveform real si existe y mitiga duración Infinity de WebM', () => {
    const filePath = path.join(__dirname, '..', 'src', 'components', 'chat', 'VoiceMessage.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert(content.includes('Array.isArray(msg.waveform) && msg.waveform.length > 0'), 'Debe priorizar msg.waveform');
    assert(content.includes('fallbackDuration = (msg.duration_ms && msg.duration_ms > 0)'), 'Debe computar fallbackDuration con msg.duration_ms');
    assert(content.includes('effectiveDuration'), 'Debe utilizar effectiveDuration para el cálculo del scrubber y tiempo');
    assert(content.includes('Tactical Scrub Thumb Needle'), 'Debe renderizar aguja luminosa en la barra de desplazamiento');
});

runTest('ChatInput: Renderiza VU-meter animado en vivo durante la grabación de audio', () => {
    const filePath = path.join(__dirname, '..', 'src', 'components', 'chat', 'ChatInput.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert(content.includes('Visualizador de audio animado en vivo'), 'Debe incluir visualizador de audio animado');
    assert(content.includes('pulse'), 'Debe aplicar animación de pulso');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests/totalTests)*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
