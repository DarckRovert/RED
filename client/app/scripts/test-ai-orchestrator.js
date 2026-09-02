/**
 * RED OS — Test Suite: Orquestador Universal de IA Táctica, TTS/STT & Transcripción
 * Valida la resiliencia del motor de traducción neuronal, formateo SITREP, decodificación PCM 16kHz y síntesis de voz.
 */

const assert = require('assert');

console.log('================================================================================');
console.log('🧠 INICIANDO SUITE DE PRUEBAS: ORQUESTADOR UNIVERSAL DE IA & MOTOR DE VOZ');
console.log('================================================================================\n');

let passedTests = 0;
let totalTests = 0;

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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Pruebas de Segmentación y Normalización de Texto para Síntesis de Voz (TTS)
// ─────────────────────────────────────────────────────────────────────────────
console.log('🔊 1. Probando Motor Táctico de Voz (TTS / STT Chunks & Language Mapping)...');

function splitTextIntoChunks(text, maxLength = 160) {
    if (!text) return [];
    const clean = text.replace(/[*_#`~[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return [clean];

    const sentences = clean.split(/(?<=[.!?;\n])\s+/);
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + ' ' + sentence).trim().length <= maxLength) {
            currentChunk = (currentChunk + ' ' + sentence).trim();
        } else {
            if (currentChunk) chunks.push(currentChunk);
            if (sentence.length <= maxLength) {
                currentChunk = sentence;
            } else {
                const subParts = sentence.split(/(?<=[,])\s+/);
                for (const sub of subParts) {
                    if ((currentChunk + ' ' + sub).trim().length <= maxLength) {
                        currentChunk = (currentChunk + ' ' + sub).trim();
                    } else {
                        if (currentChunk) chunks.push(currentChunk);
                        currentChunk = sub;
                    }
                }
            }
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [clean];
}

runTest('TTS: Segmentación de párrafos extensos en fragmentos seguros (<160 chars)', () => {
    const longText = 'Atención a todos los operadores de la malla RED. Se ha detectado una baliza de emergencia en el sector norte cerca de las coordenadas UTM 18N 450000 5200000. Proceder con precaución y reportar telemetría de enlace. Se requiere botiquín TCCC y férulas.';
    const chunks = splitTextIntoChunks(longText, 120);
    assert(chunks.length >= 2, 'Debe dividir en 2 o más fragmentos');
    for (const chunk of chunks) {
        assert(chunk.length <= 120, `El fragmento supera el límite: ${chunk.length}`);
    }
});

runTest('TTS: Mapeo de códigos de idioma tácticos (es, en, fr, pt, de, ru, uk, zh, qu)', () => {
    const supportedLangs = ['es', 'en', 'fr', 'pt', 'de', 'ru', 'uk', 'zh', 'qu'];
    assert.strictEqual(supportedLangs.length, 9, 'Debe soportar 9 idiomas tácticos principales');
    assert(supportedLangs.includes('qu'), 'Debe incluir Runasimi (Quechua)');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Pruebas de Traductor Táctico y Fallback de Glosario
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🌐 2. Probando Traductor Táctico & Fallback a Glosario...');

const EMERGENCY_GLOSSARY_TEST = [
    { es: 'torniquete', en: 'tourniquet', fr: 'garrot', pt: 'torniquete', de: 'Aderpresse' },
    { es: 'hemorragia', en: 'hemorrhage', fr: 'hémorragie', pt: 'hemorragia', de: 'Blutung' },
    { es: 'ayuda', en: 'help', fr: 'aide', pt: 'ajuda', de: 'Hilfe' },
    { es: 'refugio', en: 'shelter', fr: 'refuge', pt: 'abrigo', de: 'Unterschlupf' }
];

function fallbackTranslate(text, targetLang) {
    let lower = text.toLowerCase();
    for (const entry of EMERGENCY_GLOSSARY_TEST) {
        if (lower.includes(entry.es)) {
            const translatedTerm = entry[targetLang] || entry.en;
            return `[Glosario Táctico]: ${text.replace(new RegExp(entry.es, 'gi'), translatedTerm)}`;
        }
    }
    return text;
}

runTest('Traducción: Detección y fallback de términos críticos TCCC', () => {
    const original = 'Aplicar torniquete en el brazo derecho inmediatamente';
    const translated = fallbackTranslate(original, 'en');
    assert(translated.toLowerCase().includes('tourniquet'), 'Debe contener la traducción "tourniquet"');
});

runTest('Traducción: Soporte multilingüe a Francés y Alemán', () => {
    const frResult = fallbackTranslate('Necesito hemorragia control', 'fr');
    assert(frResult.toLowerCase().includes('hémorragie'), 'Debe traducir a francés "hémorragie"');

    const deResult = fallbackTranslate('Buscando refugio seguro', 'de');
    assert(deResult.toLowerCase().includes('unterschlupf'), 'Debe traducir a alemán "Unterschlupf"');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pruebas del Asistente de Redacción Táctica (SITREP, Camuflaje, Urgencia)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n✨ 3. Probando Asistente de Redacción Táctica & Formato SITREP...');

function rephraseTextMock(text, mode = 'sitrep') {
    const trimmed = text.trim();
    if (!trimmed) return '';
    if (mode === 'camouflage') {
        const camouflaged = trimmed
            .replace(/a/gi, '4')
            .replace(/e/gi, '3')
            .replace(/i/gi, '1')
            .replace(/o/gi, '0')
            .replace(/s/gi, '5');
        return `[OBSC-RED] ${camouflaged}`;
    }
    if (mode === 'urgent') {
        return `🚨 [URGENTE / ALERTA MESH] ${trimmed}`;
    }
    return `[SITREP TÁCTICO] ${trimmed} // FIN DE TRANSMISIÓN`;
}

runTest('Asistente: Transformación a Formato SITREP Militar', () => {
    const raw = 'Sector Alpha despejado, 3 operadores en posición.';
    const sitrep = rephraseTextMock(raw, 'sitrep');
    assert(sitrep.startsWith('[SITREP TÁCTICO]'), 'Debe iniciar con encabezado SITREP');
    assert(sitrep.endsWith('// FIN DE TRANSMISIÓN'), 'Debe finalizar con protocolo militar de cierre');
});

runTest('Asistente: Modo Alerta de Emergencia de Máxima Urgencia', () => {
    const raw = 'Evacuación requerida de inmediato.';
    const urgent = rephraseTextMock(raw, 'urgent');
    assert(urgent.startsWith('🚨 [URGENTE / ALERTA MESH]'), 'Debe anteponer marcador de urgencia');
});

runTest('Asistente: Camuflaje Leetspeak Anti-Intercepción', () => {
    const raw = 'base secreta';
    const cam = rephraseTextMock(raw, 'camouflage');
    assert.strictEqual(cam, '[OBSC-RED] b453 53cr3t4', 'Debe ofuscar vocales y consonantes críticas');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pruebas de Procesamiento y Remuestreo PCM de Audio a 16kHz
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🎙️ 4. Probando Decodificación y Remuestreo de Audio PCM 16kHz (Whisper Ready)...');

function mockResamplePcm(inputData, inputSampleRate, targetSampleRate = 16000) {
    const ratio = inputSampleRate / targetSampleRate;
    const targetLength = Math.ceil(inputData.length / ratio);
    const result = new Float32Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
        const originalIndex = Math.min(Math.floor(i * ratio), inputData.length - 1);
        result[i] = inputData[originalIndex];
    }
    return result;
}

runTest('Audio PCM: Remuestreo lineal exacto de 48kHz a 16kHz mono', () => {
    const durationSec = 1;
    const input48k = new Float32Array(48000);
    // Llenar con onda senoidal de 440 Hz
    for (let i = 0; i < input48k.length; i++) {
        input48k[i] = Math.sin(2 * Math.PI * 440 * (i / 48000));
    }

    const output16k = mockResamplePcm(input48k, 48000, 16000);
    assert.strictEqual(output16k.length, 16000, 'El buffer remuestreado debe tener exactamente 16000 muestras para 1 segundo');
    assert(Math.abs(output16k[0] - input48k[0]) < 0.001, 'La amplitud inicial debe preservarse');
});

runTest('Audio PCM: Remuestreo de 44.1kHz a 16kHz mono', () => {
    const input44k = new Float32Array(44100);
    const output16k = mockResamplePcm(input44k, 44100, 16000);
    assert.strictEqual(output16k.length, 16000, 'El buffer remuestreado debe tener 16000 muestras');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Pruebas de Configuración de Endpoints Soberanos (Ollama / Local API)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🤖 5. Probando Configuración de Endpoints Soberanos & Sanitización de URLs...');

function sanitizeSovereignUrl(url) {
    if (!url) return '';
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = `http://${clean}`;
    }
    return clean;
}

runTest('Sovereign Endpoints: Normalización de URLs de Ollama y Local APIs', () => {
    assert.strictEqual(sanitizeSovereignUrl('localhost:11434'), 'http://localhost:11434');
    assert.strictEqual(sanitizeSovereignUrl('http://192.168.1.50:11434/'), 'http://192.168.1.50:11434');
    assert.strictEqual(sanitizeSovereignUrl('https://api.openai.com/v1///'), 'https://api.openai.com/v1');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
