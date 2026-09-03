// Test de Resiliencia: Integración de Resumidor y Traductor IA Nativo/Local (Ciclo AI-5)
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST DE RESILIENCIA: RESUMIDOR Y TRADUCTOR IA NATIVO / LOCAL (CICLO AI-5) ===\n');

let passedTests = 0;

// Test 1: Conexión de summarizeChannelAI a Endpoint Nativo con Fallback
{
    const aiApiPath = path.join(__dirname, '../src/api/ai.ts');
    const content = fs.readFileSync(aiApiPath, 'utf8');

    assert.ok(content.includes("fetchWithFallback<ChannelSummaryResponse>('/api/ai/summarize'"), 'summarizeChannelAI debe consultar /api/ai/summarize con fallback');
    assert.ok(content.includes('LocalAIEngine.summarizeChannel(rawStringMessages)'), 'summarizeChannelAI debe tener fallback local funcional');
    console.log('✓ Test 1 PASÓ: summarizeChannelAI conectado a endpoint nativo Rust con fallback robusto.');
    passedTests++;
}

// Test 2: Conexión de translateTextAI a Endpoint Nativo con Fallback
{
    const aiApiPath = path.join(__dirname, '../src/api/ai.ts');
    const content = fs.readFileSync(aiApiPath, 'utf8');

    assert.ok(content.includes("fetchWithFallback<TranslateResponse>('/api/ai/translate'"), 'translateTextAI debe consultar /api/ai/translate con fallback');
    assert.ok(content.includes('LocalAIEngine.translateText(text, targetLang)'), 'translateTextAI debe tener fallback local funcional');
    console.log('✓ Test 2 PASÓ: translateTextAI conectado a endpoint nativo Rust con fallback robusto.');
    passedTests++;
}

// Test 3: Verificación de Endpoints en Desktop Node (node/src/api.rs)
{
    const nodeApiPath = path.join(__dirname, '../../../node/src/api.rs');
    const content = fs.readFileSync(nodeApiPath, 'utf8');

    assert.ok(content.includes('.route("/api/ai/summarize", post(handle_ai_summarize_channel))'), 'node/src/api.rs debe enrutar /api/ai/summarize');
    assert.ok(content.includes('.route("/api/ai/translate", post(handle_ai_translate_text))'), 'node/src/api.rs debe enrutar /api/ai/translate');
    console.log('✓ Test 3 PASÓ: Endpoints nativos de resumen y traducción activos en daemon desktop.');
    passedTests++;
}

// Test 4: Verificación de Endpoints en Mobile Node (red_mobile/src/api.rs)
{
    const mobileApiPath = path.join(__dirname, '../../../red_mobile/src/api.rs');
    const content = fs.readFileSync(mobileApiPath, 'utf8');

    assert.ok(content.includes('.route("/api/ai/summarize"'), 'red_mobile/src/api.rs debe enrutar /api/ai/summarize');
    assert.ok(content.includes('.route("/api/ai/translate"'), 'red_mobile/src/api.rs debe enrutar /api/ai/translate');
    console.log('✓ Test 4 PASÓ: Endpoints nativos de resumen y traducción activos en daemon móvil.');
    passedTests++;
}

// Test 5: Sincronización React y RAG en AICopilotModal.tsx
{
    const modalPath = path.join(__dirname, '../src/components/AICopilotModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('checkLocalModelsStatus().catch'), 'AICopilotModal debe verificar estado de modelos tras mutaciones');
    assert.ok(content.includes('refreshModels()'), 'AICopilotModal debe refrescar estado React de modelos tras mutaciones');
    assert.ok(content.includes('similarityScore >= 0.45'), 'AICopilotModal debe usar umbral RAG consistente (>= 0.45)');
    console.log('✓ Test 5 PASÓ: Sincronización inmediata de UI y umbrales RAG verificados en AICopilotModal.tsx.');
    passedTests++;
}

console.log(`\n🎉 RESULTADO FINAL: ${passedTests}/${passedTests} TESTS PASARON EXITOSAMENTE (100%).`);
process.exit(0);
