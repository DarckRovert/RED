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

    // 1. Si no hay modelo descargado en disco, responder instantáneamente (<10 ms)
    // con el RAG Táctico INT8 preinstalado y la síntesis conversacional local.
    if (!activeModel || !activeModel.isDownloaded) {
        const res = await LocalAIEngine.generateCopilotResponse(prompt, categoryContext);
        return {
            answer: res.answer,
            topic_category: res.topicCategory,
            source: res.modelInfo || '🛡️ RAG Táctico Preinstalado INT8',
            execution_time_ms: res.executionTimeMs,
            thoughtChain: res.thoughtChain,
            thought_chain: res.thoughtChain,
        };
    }

    // 2. Si el usuario descargó un modelo GGUF, ejecutar inferencia nativa en Rust Candle (ARM64)
    try {
        const cleanLocalPath = activeModel.localPath ? activeModel.localPath.replace(/^file:\/\//, '') : undefined;
        const modelId = activeModel.id;

        const nativeResp = await fetchWithFallback<CopilotResponse>('/api/ai/copilot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                context: categoryContext,
                model_id: modelId,
                model_path: cleanLocalPath,
            }),
            timeoutMs: 60000,
            maxRetries: 1
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

        const isFailure = !nativeResp || !nativeResp.answer ||
            nativeResp.answer.includes("No se detectó ningún archivo de modelo neural GGUF") ||
            nativeResp.answer.startsWith("⚠️ [Error") ||
            nativeResp.answer.startsWith("⚠️ [Advertencia");

        if (!isFailure) {
            return nativeResp;
        } else {
            console.warn('[queryAICopilot] Native inference returned warning/error, activating clean LocalAIEngine fallback:', nativeResp?.answer);
        }
    } catch (err) {
        console.warn('[queryAICopilot] Native inference fallback to LocalAIEngine:', err);
    }

    // 3. Inferencia en WebAssembly / ONNX Runtime (con Sovereign Endpoint como Fase 1 interna)
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

/** Resumir Canal Mesh con IA (Híbrido: Daemon Nativo Rust / NLP Local) */
export async function summarizeChannelAI(channelId: string, messages: any[]): Promise<ChannelSummaryResponse> {
    const rawStringMessages = messages.map(m => typeof m === 'string' ? m : (m?.content || String(m)));
    return fetchWithFallback<ChannelSummaryResponse>('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            channel_id: channelId,
            messages: rawStringMessages,
        }),
    }, async () => {
        const res = await LocalAIEngine.summarizeChannel(rawStringMessages);
        return {
            channel_id: channelId,
            summary_bullets: res.summaryBullets,
            total_messages_analyzed: res.totalMessages,
            sentiment: res.sentiment,
            execution_time_ms: res.executionTimeMs,
        };
    });
}

/** Traducir texto P2P multilingüe con IA (Híbrido: Daemon Nativo Rust / Glosario Táctico) */
export async function translateTextAI(text: string, targetLang: string): Promise<TranslateResponse> {
    return fetchWithFallback<TranslateResponse>('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            target_language: targetLang,
        }),
    }, async () => {
        const res = await LocalAIEngine.translateText(text, targetLang);
        return {
            original_text: res.originalText,
            translated_text: res.translatedText,
            target_language: res.targetLang,
            execution_time_ms: res.executionTimeMs,
        };
    });
}
