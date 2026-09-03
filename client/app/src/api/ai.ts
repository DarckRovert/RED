// RED AI Copilot, Guardian Moderation & Summarizer API

import { GuardianStatus, GuardianStats, CopilotResponse, ChannelSummaryResponse, TranslateResponse } from './types';
import { fetchWithFallback, getStored, setStored, STORAGE_KEYS } from './core';
import { RedAPI } from './client';
import { GuardianEngine, LocalAIEngine } from '../lib/ai';
import { ModelManager } from '../lib/ai/modelManager';

/** Estado actual del motor Guardian IA */
export async function getGuardianStatus(): Promise<GuardianStatus> {
    const stats = GuardianEngine.getStats();
    const identity = await RedAPI.getIdentity().catch(() => null);
    return {
        active: true,
        mode: 'strict',
        has_api_key: true,
        model: 'RED-Guardian-Local-S4 (Off-Grid Engine)',
        stats,
        authorities: [
            identity ? `did:red:${identity.short_id || identity.identity_hash.slice(0, 10)}` : 'did:red:local_node'
        ]
    };
}

/** Reportar contenido o incidente a los Guardianes de la Red */
export async function reportContent(report: {
    message_id?: string;
    target_did: string;
    reason: string;
    category: 'nsfw' | 'threat' | 'spam' | 'pii' | 'general';
    sample_text?: string;
    evidence_b64?: string;
}): Promise<{ ok: boolean; report_id: string }> {
    return fetchWithFallback('/api/guardian/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
    }, () => {
        const reports = getStored<any[]>(STORAGE_KEYS.GUARDIAN_REPORTS, []);
        const reportId = `rep_${Date.now()}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`;
        reports.unshift({ id: reportId, timestamp: Date.now(), ...report });
        setStored(STORAGE_KEYS.GUARDIAN_REPORTS, reports);
        return { ok: true, report_id: reportId };
    });
}

/** Consultar Copiloto IA de Emergencia y Diálogo (Híbrido: Rust Candle GGUF nativo / ONNX WASM en Web) */
export async function queryAICopilot(prompt: string, categoryContext?: string): Promise<CopilotResponse> {
    const activeModel = ModelManager.getActiveModel();
    let isNative = false;
    if (typeof window !== 'undefined') {
        try {
            const { Capacitor } = await import('@capacitor/core');
            isNative = Capacitor.isNativePlatform();
        } catch {}
    }

    // 1. PRIORIDAD ABSOLUTA: Si el modelo descargado tiene ruta local GGUF (Android nativo o Daemon Rust local)
    if (activeModel && activeModel.isDownloaded && activeModel.localPath) {
        try {
            const systemContext = `Eres el Copiloto IA de RED OS, un asistente inteligente, empático y experto que opera 100% en el dispositivo del usuario sin conexión a internet. Conversa con fluidez y precisión en español sobre cualquier tema militar, técnico o de emergencia.${categoryContext ? ` Contexto táctico: ${categoryContext}` : ''}`;
            const formattedGgufPrompt = `<|im_start|>system\n${systemContext}<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;
            const cleanLocalPath = activeModel.localPath.replace(/^file:\/\//, '');

            const nativeResp = await fetchWithFallback<CopilotResponse>('/api/ai/copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: formattedGgufPrompt,
                    context: categoryContext,
                    model_id: activeModel.id,
                    model_path: cleanLocalPath,
                })
            }, async () => {
                const res = await LocalAIEngine.generateCopilotResponse(prompt, categoryContext);
                return {
                    answer: res.answer,
                    topic_category: res.topicCategory,
                    source: res.modelInfo,
                    execution_time_ms: res.executionTimeMs,
                    thoughtChain: res.thoughtChain,
                    thought_chain: res.thoughtChain,
                };
            });

            if (nativeResp && nativeResp.answer) {
                return nativeResp;
            }
        } catch (err) {
            console.warn('[queryAICopilot] Native inference fallback to WASM:', err);
        }
    }

    // 2. Si no hay modelo local descargado, consultar Endpoint Soberano externo (LM Studio / Ollama en PC remota)
    const sovereign = ModelManager.getSovereignEndpoint();
    if (sovereign && sovereign.url) {
        const res = await LocalAIEngine.generateCopilotResponse(prompt, categoryContext);
        return {
            answer: res.answer,
            topic_category: res.topicCategory,
            source: res.modelInfo,
            execution_time_ms: res.executionTimeMs,
            thoughtChain: res.thoughtChain,
            thought_chain: res.thoughtChain,
        };
    }

    // 2. Inferencia en WebAssembly / ONNX Runtime
    const res = await LocalAIEngine.generateCopilotResponse(prompt, categoryContext);
    return {
        answer: res.answer,
        topic_category: res.topicCategory,
        source: res.modelInfo,
        execution_time_ms: res.executionTimeMs,
        thoughtChain: res.thoughtChain,
        thought_chain: res.thoughtChain,
    };
}

/** Resumir Canal Mesh con IA */
export async function summarizeChannelAI(channelId: string, messages: any[]): Promise<ChannelSummaryResponse> {
    const res = await LocalAIEngine.summarizeChannel(messages);
    return {
        channel_id: channelId,
        summary_bullets: res.summaryBullets,
        total_messages_analyzed: res.totalMessages,
        sentiment: res.sentiment,
        execution_time_ms: res.executionTimeMs,
    };
}

/** Traducir texto P2P multilingüe con IA */
export async function translateTextAI(text: string, targetLang: string): Promise<TranslateResponse> {
    const res = await LocalAIEngine.translateText(text, targetLang);
    return {
        original_text: res.originalText,
        translated_text: res.translatedText,
        target_language: res.targetLang,
        execution_time_ms: res.executionTimeMs,
    };
}
