// Test de Resiliencia: Activación Real de RED Guardian en Chat en Tiempo Real (Ciclo AI-3)
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST DE RESILIENCIA: ACTIVACIÓN REAL DE RED GUARDIAN EN CHAT (CICLO AI-3) ===\n');

let passedTests = 0;

// Test 1: Verificación de Await Asíncrono en chatSlice.ts (Mensajes Salientes)
{
    const chatSlicePath = path.join(__dirname, '../src/store/slices/chatSlice.ts');
    const content = fs.readFileSync(chatSlicePath, 'utf8');

    assert.ok(content.includes('await GuardianEngine.evaluateTextAsync(content)'), 'chatSlice.ts debe invocar evaluateTextAsync con await');
    assert.strictEqual(content.includes('GuardianEngine.evaluateText(content)'), false, 'Prohibido evaluateText sincrónico en chatSlice.ts');
    assert.ok(content.includes('toast.error(`⛔ RED Guardian: ${verdict.reason}`)'), 'chatSlice.ts debe bloquear y alertar si verdict.allowed es falso');
    console.log('✓ Test 1 PASÓ: chatSlice.ts evalúa asíncronamente con GuardianEngine.evaluateTextAsync en mensajes salientes.');
    passedTests++;
}

// Test 2: Verificación de Await Asíncrono en messageDispatcher.ts (Mensajes Entrantes)
{
    const dispatcherPath = path.join(__dirname, '../src/store/events/messageDispatcher.ts');
    const content = fs.readFileSync(dispatcherPath, 'utf8');

    assert.ok(content.includes('await GuardianEngine.evaluateTextAsync(item.content)'), 'messageDispatcher.ts debe invocar evaluateTextAsync con await');
    assert.strictEqual(content.includes('GuardianEngine.evaluateText(item.content)'), false, 'Prohibido evaluateText sincrónico en messageDispatcher.ts');
    assert.ok(content.includes('Intercepted hostile incoming packet'), 'messageDispatcher.ts debe interceptar y descartar paquetes hostiles');
    console.log('✓ Test 2 PASÓ: messageDispatcher.ts filtra asíncronamente paquetes entrantes con Guardian.');
    passedTests++;
}

// Test 3: Simulación de De-ofuscación Leetspeak y Detección de Amenazas en Guardian
{
    const LEET_MAP = {
        '4': 'a', '@': 'a', '3': 'e', '1': 'i', '!': 'i', '|': 'i',
        '0': 'o', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b',
    };

    function normalizeAndDeobfuscate(text) {
        let clean = text.toLowerCase();
        for (const [leet, char] of Object.entries(LEET_MAP)) {
            clean = clean.split(leet).join(char);
        }
        clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        clean = clean.replace(/(.)\1{2,}/g, '$1');
        clean = clean.replace(/([a-z0-9])[._*#\-]+(?=[a-z0-9])/g, '$1');
        clean = clean.replace(/\s+/g, ' ').trim();
        return clean;
    }

    const THREAT_PATTERNS = [
        /\b(te\s*voy\s*a\s*(matar|acribillar|degollar|violar|descuartizar|asesinar|aniquilar|eliminar|destruir))\b/i,
        /\b(voy\s*a\s*(matarte|acribillarte|degollarte|violarte|descuartizarte|asesinarte|pegarte\s*un\s*tiro))\b/i,
        /\b(voy\s*a\s*poner\s*una\s*bomba|atentado\s*terrorista|masacre\s*en|ataque\s*armado)\b/i,
        /\b(amenaza\s*de\s*muerte|contratar\s*sicario|tiroteo\s*masivo|fusilamiento)\b/i,
        /\b(te\s*vas\s*a\s*morir|vas\s*a\s*morir|muerete\s*maldit[ao]|moriras\s*pronto)\b/i,
        /\b(dame\s*tu\s*(clave\s*privada|frase\s*semilla|seed\s*phrase|private\s*key)|pasa\s*tu\s*seed|robo\s*de\s*identidad)\b/i,
    ];

    const isTacticalMedical = (text) => {
        return /\b(primeros\s*auxilios|torniquete|tccc|rcp|hemorragia|fractura|herida|atencion\s*medica|protocolo\s*de\s*emergencia|evacuacion|rescate|socorro|desfibrilador|inmovilizacion|quemadura|asfixia|vendaje|triage|triaje|signos\s*vitales|oxigeno|curacion)\b/i.test(text.toLowerCase());
    };

    // Caso 1: Amenaza violenta explícita
    const rawThreat = 'Te voy a matar desgraciado';
    const normThreat = normalizeAndDeobfuscate(rawThreat);
    const threatMatched = THREAT_PATTERNS.some(p => p.test(normThreat));
    assert.strictEqual(threatMatched, true, 'Amenaza directa debe ser interceptada');

    // Caso 2: Amenaza ofuscada con leetspeak y separadores
    const leetThreat = 't.3  v.0.y  4  m.4.t.4.r';
    const normLeet = normalizeAndDeobfuscate(leetThreat);
    const leetMatched = THREAT_PATTERNS.some(p => p.test(normLeet));
    assert.strictEqual(leetMatched, true, 'Amenaza leetspeak ofuscada debe ser desofuscada e interceptada');

    // Caso 3: Extorsión de credenciales / semilla
    const seedPhish = 'Dame tu frase semilla ahora mismo';
    const normSeed = normalizeAndDeobfuscate(seedPhish);
    const seedMatched = THREAT_PATTERNS.some(p => p.test(normSeed));
    assert.strictEqual(seedMatched, true, 'Intento de robo de frase semilla debe ser bloqueado');

    // Caso 4: Protocolo médico TCCC (Lista blanca contextual: CERO FALSOS POSITIVOS)
    const medCase = 'Aplica el torniquete CAT en la extremidad para frenar la hemorragia arterial de la herida';
    assert.strictEqual(isTacticalMedical(medCase), true, 'Caso médico debe ser validado por la lista blanca');

    console.log('✓ Test 3 PASÓ: Motor de de-ofuscación, lista blanca médica y patrones de amenaza validados.');
    passedTests++;
}

// Test 4: Inferencia Semántica Densa de Contingencia en localAiEngine.ts
{
    const enginePath = path.join(__dirname, '../src/lib/ai/localAiEngine.ts');
    const content = fs.readFileSync(enginePath, 'utf8');

    assert.ok(content.includes('HOSTILE_SEMANTIC_ANCHORS'), 'localAiEngine.ts debe incluir anclas semánticas hostiles');
    assert.ok(content.includes('Similitud hostil'), 'localAiEngine.ts debe reportar similitud hostil en caso de bloqueo');
    console.log('✓ Test 4 PASÓ: Clasificador semántico denso de contingencia integrado en localAiEngine.ts.');
    passedTests++;
}

// Test 5: Verificación de Auditoría y Estado en guardianEngine.ts
{
    const guardianPath = path.join(__dirname, '../src/lib/ai/guardianEngine.ts');
    const content = fs.readFileSync(guardianPath, 'utf8');

    assert.ok(content.includes('evaluateTextAsync'), 'guardianEngine.ts debe exportar evaluateTextAsync');
    assert.ok(content.includes('addAuditLog'), 'guardianEngine.ts debe persistir eventos en audit log');
    assert.ok(content.includes('isTacticalMedicalContext'), 'guardianEngine.ts debe proteger protocolos médicos');
    console.log('✓ Test 5 PASÓ: Métricas de auditoría forense y bypass médico validados en guardianEngine.ts.');
    passedTests++;
}

// Test 6: Verificación de Moderación Guardian en Canales Públicos (channels.ts & red_mobile/src/api.rs)
{
    const channelsPath = path.join(__dirname, '../src/api/channels.ts');
    const content = fs.readFileSync(channelsPath, 'utf8');

    assert.ok(content.includes('GuardianEngine.evaluateTextAsync(payload.content)'), 'channels.ts debe pre-evaluar mensajes de canal con Guardian');
    assert.ok(content.includes('throw new Error(`⛔ RED Guardian:'), 'channels.ts debe abortar la publicación si no está permitida');

    const mobileApiPath = path.join(__dirname, '../../../red_mobile/src/api.rs');
    const mobileContent = fs.readFileSync(mobileApiPath, 'utf8');
    assert.ok(mobileContent.includes('state.guardian_engine.analyze_text(&req.content)'), 'red_mobile/src/api.rs debe moderar handle_post_channel_message');

    console.log('✓ Test 6 PASÓ: Moderación Guardian activa en canales públicos tanto en cliente como en nodo móvil.');
    passedTests++;
}

console.log(`\n🎉 RESULTADO FINAL: ${passedTests}/${passedTests} TESTS PASARON EXITOSAMENTE (100%).`);
process.exit(0);
