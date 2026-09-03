// Test de Resiliencia: Unificación Omnicanal de Inferencia Táctica y Blindaje AudioContext (Ciclo AI-6)
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST DE RESILIENCIA: OMNICANALIDAD DE IA Y BLINDAJE AUDIOCONTEXT (CICLO AI-6) ===\n');

let passedTests = 0;

// Test 1: ChatInput.tsx utiliza translateTextAI unificado
{
    const filePath = path.join(__dirname, '../src/components/chat/ChatInput.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('import { translateTextAI } from "../../api/ai";'), 'ChatInput debe importar translateTextAI');
    assert.ok(content.includes("await translateTextAI(text.trim(), 'en')"), 'ChatInput debe traducir al inglés con translateTextAI');
    assert.ok(content.includes("await translateTextAI(text.trim(), 'es')"), 'ChatInput debe traducir al español con translateTextAI');
    console.log('✓ Test 1 PASÓ: ChatInput.tsx canaliza traducciones salientes por translateTextAI.');
    passedTests++;
}

// Test 2: MessageBubble.tsx utiliza translateTextAI unificado
{
    const filePath = path.join(__dirname, '../src/components/chat/MessageBubble.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('import { translateTextAI } from "../../api/ai";'), 'MessageBubble debe importar translateTextAI');
    assert.ok(content.includes('await translateTextAI(msg.content, targetLang)'), 'MessageBubble debe traducir mensajes entrantes con translateTextAI');
    console.log('✓ Test 2 PASÓ: MessageBubble.tsx canaliza traducciones entrantes por translateTextAI.');
    passedTests++;
}

// Test 3: BlockchainExplorer.tsx utiliza queryAICopilot unificado
{
    const filePath = path.join(__dirname, '../src/components/BlockchainExplorer.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('import { queryAICopilot } from "../api/ai";'), 'BlockchainExplorer debe importar queryAICopilot');
    assert.ok(content.includes('await queryAICopilot(prompt)'), 'BlockchainExplorer debe evaluar la cadena con queryAICopilot');
    console.log('✓ Test 3 PASÓ: BlockchainExplorer.tsx canaliza auditoría de bloques por queryAICopilot.');
    passedTests++;
}

// Test 4: CryptoPanel.tsx utiliza queryAICopilot unificado
{
    const filePath = path.join(__dirname, '../src/components/CryptoPanel.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('import { queryAICopilot } from "../api/ai";'), 'CryptoPanel debe importar queryAICopilot');
    assert.ok(content.includes('await queryAICopilot(prompt)'), 'CryptoPanel debe evaluar la salud criptográfica con queryAICopilot');
    console.log('✓ Test 4 PASÓ: CryptoPanel.tsx canaliza auditoría criptográfica por queryAICopilot.');
    passedTests++;
}

// Test 5: NetworkPanel.tsx utiliza queryAICopilot unificado
{
    const filePath = path.join(__dirname, '../src/components/NetworkPanel.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('import { queryAICopilot } from "../api/ai";'), 'NetworkPanel debe importar queryAICopilot');
    assert.ok(content.includes('await queryAICopilot(prompt)'), 'NetworkPanel debe diagnosticar la red P2P con queryAICopilot');
    console.log('✓ Test 5 PASÓ: NetworkPanel.tsx canaliza diagnóstico de topología por queryAICopilot.');
    passedTests++;
}

// Test 6: RedSDKBridge.ts utiliza queryAICopilot en ai.prompt
{
    const filePath = path.join(__dirname, '../src/lib/miniapp/RedSDKBridge.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("import { queryAICopilot } from '../../api/ai';"), 'RedSDKBridge debe importar queryAICopilot');
    assert.ok(content.includes('await queryAICopilot(query, this.manifest.name)'), 'RedSDKBridge debe resolver ai.prompt con queryAICopilot');
    console.log('✓ Test 6 PASÓ: RedSDKBridge.ts atiende MiniApps con queryAICopilot y aceleración nativa.');
    passedTests++;
}

// Test 7: localAiEngine.ts utiliza AudioContextManager.getSharedContext()
{
    const filePath = path.join(__dirname, '../src/lib/ai/localAiEngine.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("import { AudioContextManager } from '../audio/AudioContextManager';"), 'localAiEngine debe importar AudioContextManager');
    assert.ok(content.includes('AudioContextManager.getSharedContext()'), 'decodeAudioTo16kHzPcm debe usar AudioContextManager.getSharedContext()');
    assert.ok(!content.includes('const audioCtx = new AudioCtx();'), 'localAiEngine no debe crear AudioContexts no gestionados');
    console.log('✓ Test 7 PASÓ: localAiEngine.ts blindado contra saturación de hardware con AudioContextManager.');
    passedTests++;
}

// Test 8: AICopilotModal.tsx utiliza translateTextAI en pestaña traductor
{
    const filePath = path.join(__dirname, '../src/components/AICopilotModal.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('translateTextAI'), 'AICopilotModal debe importar translateTextAI');
    assert.ok(content.includes('await translateTextAI(textToTranslate, targetLang)'), 'AICopilotModal debe traducir con translateTextAI');
    console.log('✓ Test 8 PASÓ: AICopilotModal.tsx canaliza traducciones de la pestaña Traductor por translateTextAI.');
    passedTests++;
}

// Test 9: hiveMindEngine.ts utiliza queryAICopilot para inferencia remota en la malla
{
    const filePath = path.join(__dirname, '../src/lib/network/hiveMindEngine.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("import { queryAICopilot } from '../../api/ai';"), 'hiveMindEngine debe importar queryAICopilot');
    assert.ok(content.includes('await queryAICopilot(req.prompt)'), 'hiveMindEngine debe responder inferencias remotas con queryAICopilot');
    console.log('✓ Test 9 PASÓ: hiveMindEngine.ts canaliza inferencia distribuida por queryAICopilot.');
    passedTests++;
}

console.log(`\n🎉 RESULTADO FINAL: ${passedTests}/${passedTests} TESTS PASARON EXITOSAMENTE (100%).`);
process.exit(0);
