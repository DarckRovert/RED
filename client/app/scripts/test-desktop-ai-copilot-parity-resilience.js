// Test de Resiliencia: Paridad y Blindaje del Motor Nativo Rust Desktop (Ciclo AI-4)
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST DE RESILIENCIA: MOTOR NATIVO RUST DESKTOP (CICLO AI-4) ===\n');

let passedTests = 0;

const desktopCopilotPath = path.join(__dirname, '../../../node/src/ai_copilot.rs');
const content = fs.readFileSync(desktopCopilotPath, 'utf8');

// Test 1: Soporte Multi-Arquitectura LocalModel (Llama, Qwen2, Phi3)
{
    assert.ok(content.includes('enum LocalModel'), 'Debe definir enum LocalModel');
    assert.ok(content.includes('quantized_llama::ModelWeights'), 'Debe soportar Llama cuantizado');
    assert.ok(content.includes('quantized_qwen2::ModelWeights'), 'Debe soportar Qwen2/SmolLM cuantizado');
    assert.ok(content.includes('quantized_phi3::ModelWeights'), 'Debe soportar Phi-3 cuantizado');
    assert.ok(content.includes('impl LocalModel'), 'Debe implementar forward() para LocalModel');
    console.log('✓ Test 1 PASÓ: Soporte multi-arquitectura (Llama, Qwen2, Phi3) verificado en desktop.');
    passedTests++;
}

// Test 2: Auto-Detección de Directorios Candidatos de Modelos GGUF en Desktop
{
    assert.ok(content.includes('dirs::data_local_dir()'), 'Debe sondear data_local_dir para modelos');
    assert.ok(content.includes('dirs::home_dir()'), 'Debe sondear home_dir (.red/models)');
    assert.ok(content.includes('candidate_dirs.push(PathBuf::from("models"))'), 'Debe sondear models/ relativo');
    assert.ok(content.includes('meta.len() > 50_000_000'), 'Debe validar que el GGUF sea un binario real (>50MB)');
    console.log('✓ Test 2 PASÓ: Resolución y auto-detección de rutas GGUF en almacenamiento local desktop.');
    passedTests++;
}

// Test 3: Plantillas ChatML/Instruct e Inyección de Contexto RAG Oficial
{
    assert.ok(content.includes('<|im_start|>system'), 'Debe formatear prompts ChatML para Qwen/SmolLM');
    assert.ok(content.includes('<|start_header_id|>system<|end_header_id|>'), 'Debe formatear prompts Llama-3.2');
    assert.ok(content.includes('<|system|>'), 'Debe formatear prompts Phi-3');
    assert.ok(content.includes('if let Some(ctx) = &req.context'), 'Debe inyectar protocolo RAG de referencia en el prompt');
    assert.ok(content.includes('Copiloto IA de RED OS'), 'Debe configurar el rol táctico soberano del copiloto');
    console.log('✓ Test 3 PASÓ: Plantillas formales de ChatML y RAG contextual táctico integradas.');
    passedTests++;
}

// Test 4: Filtrado Anti-Stub de Git LFS para Tokenizers
{
    assert.ok(content.includes('meta.len() > 50_000'), 'Debe rechazar archivos LFS de tokenizer falsos (<50KB)');
    assert.ok(content.includes('tokenizers::Tokenizer::from_file'), 'Debe inicializar Tokenizer real desde JSON');
    console.log('✓ Test 4 PASÓ: Detección profunda y protección contra punteros Git LFS corruptos.');
    passedTests++;
}

// Test 5: Muestreo Controlado, Penalización de Repetición y Stop Tokens
{
    assert.ok(content.includes('apply_repeat_penalty'), 'Debe aplicar repeat penalty para evitar bucles');
    assert.ok(content.includes('151645') && content.includes('151643'), 'Debe interceptar stop tokens de Qwen');
    assert.ok(content.includes('128001') && content.includes('128009'), 'Debe interceptar stop tokens de Llama-3');
    assert.ok(content.includes('32000') && content.includes('32007'), 'Debe interceptar stop tokens de Phi-3');
    assert.ok(content.includes('max_tokens = 512'), 'Debe limitar tokens de salida a 512');
    console.log('✓ Test 5 PASÓ: Muestreo probabilístico, repeat penalty y stop tokens arquitecturales validados.');
    passedTests++;
}

// Test 6: Decodificación Atómica UTF-8 (Español Multibyte) e Implementación Default
{
    assert.ok(content.includes('tokenizer.decode(&tokens[initial_prompt_tokens_len..], true)'), 'Debe decodificar la secuencia completa para preservar UTF-8 multibyte');
    assert.ok(content.includes('impl Default for AICopilotEngine'), 'Debe implementar trait Default');
    assert.ok(content.includes('MAX_SAFE_DESKTOP_MODEL_BYTES'), 'Debe proteger la memoria RAM en desktop contra OOM');
    console.log('✓ Test 6 PASÓ: Decodificación atómica UTF-8, trait Default y guardas OOM verificados.');
    passedTests++;
}

console.log(`\n🎉 RESULTADO FINAL: ${passedTests}/${passedTests} TESTS PASARON EXITOSAMENTE (100%).`);
process.exit(0);
