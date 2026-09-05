"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { queryAICopilot, CopilotResponse, summarizeChannelAI, translateTextAI } from "../lib/api";
import { LocalAIEngine } from "../lib/localAiEngine";
import { ModelManager, LocalModelMetaData, DeviceMemoryBudget, SovereignEndpointConfig, SOVEREIGN_PRESETS } from "../lib/modelManager";
import { GlossaryLanguage, GlossaryEntry, EMERGENCY_GLOSSARY } from "../lib/emergencyGlossary";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { NeuralThoughtViewer, NeuralTelemetryData } from "./ai/NeuralThoughtViewer";
import { vectorKnowledgeStore } from "../lib/ai/VectorKnowledgeStore";

type CopilotTab = "chat" | "translator" | "summarizer" | "models";

interface ChatMessage {
    id: string;
    sender: "user" | "ai";
    text: string;
    modelTag?: string;
    timestamp: number;
    latencyMs?: number;
    thoughtChain?: NeuralTelemetryData;
}

const CHAT_HISTORY_KEY = "red_copilot_chat_history_v2";

function getGlossaryTerm(entry: GlossaryEntry, lang: GlossaryLanguage): string {
    switch (lang) {
        case 'en': return entry.termEn;
        case 'pt': return entry.termPt;
        case 'fr': return entry.termFr;
        case 'de': return entry.termDe;
        case 'qu': return entry.termQu;
        case 'es': default: return entry.termEs;
    }
}

export const AICopilotModal: React.FC = () => {
    const {
        conversations,
        activeConversationId,
        messages: allMessages,
        contacts,
        status,
        sendMessage,
        navigate,
        goBack
    } = useRedStore();

    const { t } = useTranslation();

    const tacticalPresets = [
        { icon: "🚨", label: t('copilot.preset_triage') || "Triage START", query: "Explica el protocolo de Triage START en combate y desastres paso a paso con códigos de color." },
        { icon: "🩹", label: t('copilot.preset_tourniquet') || "Torniquete & Hemorragias", query: "Protocolo de aplicación de torniquete táctico y control de hemorragia exanguinante en zona caliente." },
        { icon: "💧", label: t('copilot.preset_water') || "Purificar Agua", query: "¿Cómo potabilizar agua de río o estancada en situación de supervivencia extrema (filtrado, ebullición, cloro)?" },
        { icon: "📻", label: t('copilot.preset_morse') || "Morse SOS & Frecuencias", query: "Códigos Morse de auxilio SOS (... --- ...) y frecuencias de radio de emergencia internacional VHF/UHF." },
        { icon: "📡", label: t('copilot.preset_dtn') || "Diagnóstico Mesh P2P", query: "¿Cómo funciona el enrutamiento tolerante a retrasos DTN y los saltos Onion en la red RED?" },
        { icon: "⚡", label: t('copilot.preset_blackout') || "Apagón Eléctrico", query: "Protocolo de supervivencia inmediata ante un colapso de infraestructura eléctrica y comunicaciones." },
        { icon: "🛡️", label: t('copilot.preset_crypto') || "Cifrado Noise XK", query: "¿Cómo protegen las llaves efímeras Curve25519 y ChaCha20-Poly1305 los mensajes contra intercepción?" }
    ];

    const effectiveChannels = conversations.length > 0
        ? conversations.map(c => ({
            id: c.id,
            name: c.peer || (c.is_group ? `Grupo ${c.id.slice(0, 6)}` : `Canal ${c.id.slice(0, 6)}`)
        }))
        : [{ id: "general", name: "General" }];

    const [activeTab, setActiveTab] = useState<CopilotTab>("chat");
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [includeTacticalContext] = useState(true);
    const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // Chat History State
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem(CHAT_HISTORY_KEY);
                if (saved) return JSON.parse(saved);
            } catch (e) {
                console.error("[Copilot History Load Error]", e);
            }
        }
        return [
            {
                id: "initial_ai_msg",
                sender: "ai",
                text: "🤖 ¡Saludos, Operador! Soy el Copiloto IA de RED.\n\nEstoy completamente operativo en tu dispositivo, funcionando 100% desconectado de Internet. Puedo asistirte en tiempo real con protocolos de supervivencia, triage médico TCCC, radiocomunicaciones de emergencia, navegación táctica y ciberdefensa.\n\nAl enviar una consulta, la cadena de pensamiento (Chain-of-Thought) y la telemetría neuronal ONNX se computarán y visualizarán en vivo.",
                modelTag: "Local Neural Engine (100% Offline)",
                timestamp: Date.now()
            }
        ];
    });

    // Active Model & Memory Budget State
    const [activeModel, setActiveModel] = useState<LocalModelMetaData | null>(null);
    const [availableModels, setAvailableModels] = useState<LocalModelMetaData[]>([]);
    const [memoryBudget, setMemoryBudget] = useState<DeviceMemoryBudget>(() => ModelManager.getDeviceMemoryBudget());
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [downloadBytes, setDownloadBytes] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });
    const [isImportingModel, setIsImportingModel] = useState(false);
    const [importProgress, setImportProgress] = useState<number>(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Hardware Probe State
    const [isProbing, setIsProbing] = useState(false);
    const [hwProbe, setHwProbe] = useState<{ recommendedModelId: string; hasWebGpu: boolean; ramMb: number; cpuCores: number; reason: string } | null>(null);

    // Offline Translator & Emergency Glossary State
    const [targetLang, setTargetLang] = useState<GlossaryLanguage>("en");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [translatorInput, setTranslatorInput] = useState("");
    const [translatorOutput, setTranslatorOutput] = useState("");
    const [isTranslating, setIsTranslating] = useState(false);

    // Channel Summarizer State
    const [selectedChannelId, setSelectedChannelId] = useState(activeConversationId || "general");
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryResult, setSummaryResult] = useState<{
        bullets: string[];
        totalMessages: number;
        sentiment?: string;
    } | null>(null);

    // Sovereign Endpoint State
    const [sovereignConfig, setSovereignConfig] = useState<SovereignEndpointConfig | null>(() => ModelManager.getSovereignEndpoint());
    const [sovereignUrlInput, setSovereignUrlInput] = useState<string>(() => ModelManager.getSovereignEndpoint()?.url || "http://127.0.0.1:11434");
    const [sovereignModelInput, setSovereignModelInput] = useState<string>(() => ModelManager.getSovereignEndpoint()?.modelName || "qwen2.5:0.5b");
    const [sovereignApiKeyInput, setSovereignApiKeyInput] = useState<string>(() => ModelManager.getSovereignEndpoint()?.apiKey || "");
    const [sovereignTesting, setSovereignTesting] = useState<boolean>(false);
    const [sovereignTestStatus, setSovereignTestStatus] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null);

    const chatContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading, scrollToBottom]);

    useEffect(() => {
        try {
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
        } catch (e) {
            console.error("[Copilot History Save Error]", e);
        }
    }, [messages]);

    const refreshModels = useCallback(() => {
        const models = ModelManager.getModels();
        setAvailableModels(models);
        setActiveModel(ModelManager.getActiveModel());
        setMemoryBudget(ModelManager.getDeviceMemoryBudget());
        setSovereignConfig(ModelManager.getSovereignEndpoint());
    }, []);

    useEffect(() => {
        refreshModels();
        ModelManager.checkLocalModelsStatus().then(refreshModels).catch(() => {});
        const unsubscribe = ModelManager.subscribe(refreshModels);
        const interval = setInterval(refreshModels, 3000);
        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [refreshModels]);

    const handleProbeHardware = async () => {
        setIsProbing(true);
        try {
            const result = await ModelManager.probeHardwareCapabilities();
            setHwProbe(result);
            toast.success(`🔬 Hardware detectado: ${result.recommendedModelId} recomendado`);
        } catch (e: any) {
            toast.error(e?.message || 'Error al detectar hardware');
        } finally {
            setIsProbing(false);
        }
    };

    const handleTestSovereign = async () => {
        if (!sovereignUrlInput.trim()) return;
        setSovereignTesting(true);
        setSovereignTestStatus(null);
        try {
            const res = await ModelManager.testSovereignEndpoint(
                sovereignUrlInput.trim(),
                sovereignModelInput.trim() || 'default',
                sovereignApiKeyInput.trim() || undefined
            );
            setSovereignTestStatus(res);
            if (res.ok) {
                toast.success(`⚡ Conexión exitosa (${res.latencyMs}ms)`);
            } else {
                toast.error(`Fallo: ${res.message}`);
            }
        } catch (e: any) {
            setSovereignTestStatus({ ok: false, message: e.message || 'Error de conexión', latencyMs: 0 });
            toast.error("Error al conectar con endpoint");
        } finally {
            setSovereignTesting(false);
        }
    };

    const handleSaveSovereign = () => {
        if (!sovereignUrlInput.trim()) {
            toast.error("Ingresa la URL del host");
            return;
        }
        let clean = sovereignUrlInput.trim().replace(/\/+$/, '');
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
            clean = `http://${clean}`;
        }
        const cfg: SovereignEndpointConfig = {
            url: clean,
            modelName: sovereignModelInput.trim() || 'default',
            apiKey: sovereignApiKeyInput.trim() || undefined
        };
        ModelManager.setSovereignEndpoint(cfg);
        setSovereignUrlInput(clean);
        setSovereignConfig(cfg);
        toast.success(`🛰️ Endpoint Soberano activado (${cfg.modelName})`);
    };

    const handleClearSovereign = () => {
        ModelManager.setSovereignEndpoint(null);
        setSovereignConfig(null);
        setSovereignTestStatus(null);
        toast.info("⚪ Retornando a Inferencia Local WASM");
    };

    const handleApplyPreset = (preset: SovereignEndpointConfig) => {
        setSovereignUrlInput(preset.url);
        setSovereignModelInput(preset.modelName);
        if (preset.apiKey) setSovereignApiKeyInput(preset.apiKey);
        toast.info(`Preset seleccionado: ${preset.label || preset.url}`);
    };

    const copyToClipboard = (text: string, id: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedMsgId(id);
            toast.success(t('common.copied') || "Copiado al portapapeles");
            setTimeout(() => setCopiedMsgId(null), 2000);
        }
    };

    const shareToChannel = (text: string) => {
        sendMessage(`[Asistencia Copiloto IA RED]:\n${text}`);
        toast.success(`Enviado al canal`);
    };

    const [isSpeakingActive, setIsSpeakingActive] = useState(false);

    const speakText = async (text: string, lang: string = "es-ES") => {
        const { TacticalSpeechEngine } = await import("../lib/ai");
        if (TacticalSpeechEngine.isSpeaking()) {
            TacticalSpeechEngine.stopSpeaking();
            setIsSpeakingActive(false);
            toast.info("Lectura de voz pausada");
            return;
        }

        setIsSpeakingActive(true);
        TacticalSpeechEngine.speak(text, {
            lang,
            onStart: () => {
                setIsSpeakingActive(true);
                toast.info("🔊 Reproduciendo respuesta por voz...");
            },
            onEnd: () => {
                setIsSpeakingActive(false);
            },
            onError: () => {
                setIsSpeakingActive(false);
                toast.warning("Síntesis de voz no disponible o interrumpida");
            }
        });
    };

    const toggleVoiceInput = async () => {
        const { TacticalSpeechEngine } = await import("../lib/ai");
        if (!TacticalSpeechEngine.isSttSupported()) {
            toast.error(t('copilot.voice_unsupported') || "Reconocimiento de voz no soportado");
            return;
        }

        if (isListening) {
            TacticalSpeechEngine.stopListening();
            setIsListening(false);
            toast.info("Dictado pausado");
            return;
        }

        setIsListening(true);
        const ok = TacticalSpeechEngine.startListening({
            lang: "es-ES",
            onStart: () => {
                setIsListening(true);
                toast.info(t('copilot.listening') || "🎙️ Escuchando dictado...");
            },
            onResult: (transcript, isFinal) => {
                if (transcript) {
                    setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
                }
                if (isFinal) {
                    setIsListening(false);
                }
            },
            onError: (err) => {
                setIsListening(false);
                console.warn("[AICopilotModal] STT Error:", err);
            },
            onEnd: () => {
                setIsListening(false);
            }
        });

        if (!ok) {
            setIsListening(false);
        }
    };

    const handleSend = async (manualQuery?: string) => {
        const text = (manualQuery || input).trim();
        if (!text || loading) return;

        const userMsg: ChatMessage = {
            id: `msg_${Date.now()}_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`,
            sender: "user",
            text,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        if (!manualQuery) setInput("");
        setLoading(true);

        const startTime = performance.now();

        try {
            const ragResults = await vectorKnowledgeStore.search(text, 1);
            let ragSnippet = "";
            if (ragResults.length > 0 && ragResults[0].similarityScore >= 0.45) {
                const topDoc = ragResults[0].document;
                ragSnippet = `[RAG Táctico INT8: ${topDoc.title}]: ${topDoc.content}`;
            }

            let contextStr: string | undefined = undefined;
            if (includeTacticalContext || ragSnippet) {
                const nodeCount = status?.peer_count ?? contacts.length;
                const activeCh = effectiveChannels.find(c => c.id === activeConversationId)?.name || "General";
                const baseCtx = `Malla con ${nodeCount} nodos detectados. Canal activo: #${activeCh}. Modo: 100% Offline`;
                contextStr = ragSnippet ? `${baseCtx}\n${ragSnippet}` : baseCtx;
            }

            const res: CopilotResponse = await queryAICopilot(text, contextStr);
            const latency = Math.round(performance.now() - startTime);
            const tag = res.source || (activeModel ? `${activeModel.name} (ARM64 / WASM Local)` : "RAG Vectorial INT8 + Protocolos TCCC (100% Offline)");

            const aiMsg: ChatMessage = {
                id: `msg_${Date.now()}_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`,
                sender: "ai",
                text: res.answer,
                modelTag: tag,
                timestamp: Date.now(),
                latencyMs: latency,
                thoughtChain: res.thoughtChain || (res as any).thought_chain
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (e: any) {
            const errorMsg: ChatMessage = {
                id: "msg_err_" + Date.now().toString(36),
                sender: "ai",
                text: `⚠️ Error de inferencia local: ${e.message || "Fallo en motor de inferencia"}`,
                modelTag: "Motor RED Fallback",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectModel = (modelId: string) => {
        LocalAIEngine.disposePipelines();
        ModelManager.setActiveModel(modelId);
        const selected = ModelManager.getActiveModel();
        setActiveModel(selected);
        if (selected) {
            toast.success(`${t('copilot.model_switched') || "Motor activo"}: ${selected.name}`);
            const switchMsg: ChatMessage = {
                id: "msg_switch_" + Date.now().toString(36),
                sender: "ai",
                text: `🔄 Motor neural cambiado a: ${selected.name}.\nAsignación de memoria dinámica: ${selected.recommendedMinRamMb} MB recomendados.`,
                modelTag: selected.name,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, switchMsg]);
        }
    };

    const handleDownloadModel = async (modelId: string) => {
        setDownloadingId(modelId);
        setDownloadProgress(0);
        setDownloadBytes({ loaded: 0, total: 0 });
        try {
            const success = await ModelManager.downloadModel(modelId, (pct, loaded, total) => {
                setDownloadProgress(pct);
                setDownloadBytes({ loaded, total });
            });
            if (success) {
                LocalAIEngine.disposePipelines();
                ModelManager.setActiveModel(modelId);
                await ModelManager.checkLocalModelsStatus().catch(() => {});
                refreshModels();
                toast.success("Modelo descargado, verificado y activado");
            } else {
                toast.info("Descarga en pausa o cancelada. Se reanudará al presionar descargar.");
            }
        } catch (err: any) {
            toast.error(err.message || "Error al descargar modelo");
        } finally {
            setDownloadingId(null);
        }
    };

    const handleCancelDownload = (modelId: string) => {
        ModelManager.cancelDownload(modelId);
        setDownloadingId(null);
        toast.info(t('copilot.cancel_btn') || "Descarga cancelada");
    };

    const handleDeleteModel = async (modelId: string) => {
        LocalAIEngine.disposePipelines();
        const ok = await ModelManager.deleteModel(modelId);
        if (ok) {
            await ModelManager.checkLocalModelsStatus().catch(() => {});
            refreshModels();
            toast.success(t('copilot.delete_success') || "Modelo eliminado para liberar espacio");
        } else {
            toast.error("No se pudo eliminar el archivo");
        }
    };

    const handleImportGgufFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        setIsImportingModel(true);
        setImportProgress(0);
        try {
            toast.info(`Importando modelo local: ${file.name}...`);
            LocalAIEngine.disposePipelines();
            const imported = await ModelManager.importModelFromLocalFile(file, (progress) => {
                setImportProgress(progress);
            });
            await ModelManager.checkLocalModelsStatus().catch(() => {});
            refreshModels();
            handleSelectModel(imported.id);
            toast.success(`✅ Modelo ${imported.name} importado y activado`);
        } catch (err: any) {
            toast.error(err?.message || "Error al importar archivo GGUF");
        } finally {
            setIsImportingModel(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleExportModel = async (modelId: string) => {
        toast.info("Preparando paquete P2P...");
        const ok = await ModelManager.exportModel(modelId);
        if (ok) {
            toast.success(t('copilot.export_success') || "✅ Modelo compartido vía P2P / AirDrop");
        } else {
            toast.error("No se pudo iniciar la transferencia P2P");
        }
    };

    const handleTranslate = async (overrideText?: string) => {
        const textToTranslate = (overrideText || translatorInput).trim();
        if (!textToTranslate) return;

        setIsTranslating(true);
        try {
            const res = await translateTextAI(textToTranslate, targetLang);
            setTranslatorOutput(res.translated_text);
            toast.success("Traducción completada");
        } catch {
            toast.error("Error al procesar traducción");
        } finally {
            setIsTranslating(false);
        }
    };

    const handleSelectGlossaryEntry = (entry: GlossaryEntry) => {
        setTranslatorInput(entry.termEs);
        handleTranslate(entry.termEs);
    };

    const handleSummarizeChannel = async () => {
        const channelMsgs = allMessages.filter(m => !selectedChannelId || m.channel_id === selectedChannelId || (m as any).conversation_id === selectedChannelId || (selectedChannelId === "general" && !m.channel_id));
        const rawTexts = channelMsgs.map(m => m.content);

        if (rawTexts.length === 0) {
            toast.warning("No hay mensajes en el canal seleccionado para resumir");
            return;
        }

        setIsSummarizing(true);
        try {
            const res = await summarizeChannelAI(selectedChannelId, rawTexts);
            setSummaryResult({
                bullets: res.summary_bullets,
                totalMessages: res.total_messages_analyzed,
                sentiment: res.sentiment
            });
            toast.success("Resumen táctico generado con éxito");
        } catch {
            toast.error("Error al generar resumen del canal");
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleClearChat = () => {
        const initialMsg: ChatMessage = {
            id: "initial_ai_msg",
            sender: "ai",
            text: "🤖 Historial reiniciado. Copiloto Táctico RED listo para nuevas directivas.",
            modelTag: activeModel ? activeModel.name : "Copiloto Táctico RED (100% Offline)",
            timestamp: Date.now()
        };
        setMessages([initialMsg]);
        toast.info(t('copilot.history_cleared') || "Historial de chat vaciado");
    };

    const filteredGlossary = selectedCategory === "all"
        ? EMERGENCY_GLOSSARY
        : EMERGENCY_GLOSSARY.filter(e => e.category === selectedCategory);

    const totalStorageMb = ModelManager.getTotalStorageUsedMb();

    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "100%", width: "100%",
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace", overflow: "hidden"
        }}>
            {/* Header Táctico C4ISR */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1.5px solid rgba(0, 229, 255, 0.3)",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={goBack}
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#FFFFFF", cursor: "pointer", fontSize: "1.1rem", fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                        title="Regresar"
                    >
                        ‹
                    </button>
                    <div style={{
                        width: 36, height: 36, borderRadius: "10px",
                        background: "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(0, 150, 255, 0.15) 100%)",
                        border: "1px solid rgba(0, 229, 255, 0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem", boxShadow: "0 0 12px rgba(0, 229, 255, 0.25)"
                    }}>🤖</div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "0.92rem", fontWeight: 900, letterSpacing: "0.5px", color: "#FFFFFF" }}>
                                {t('copilot.title')?.toUpperCase() || "COPILOTO TÁCTICO RED"}
                            </span>
                            <span style={{
                                fontSize: "0.6rem", fontWeight: 900, padding: "1px 6px", borderRadius: "5px",
                                background: "rgba(0, 230, 118, 0.15)", color: "#00E676", border: "1px solid rgba(0, 230, 118, 0.4)"
                            }}>
                                100% OFFLINE
                            </span>
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
                            Motor: <span style={{ color: "var(--accent-cyan, #00E5FF)", fontWeight: 800 }}>{sovereignConfig ? `🛰️ ${sovereignConfig.modelName} (Soberano)` : (activeModel?.name || "🛡️ RAG Táctico Preinstalado INT8")}</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                        fontSize: "0.65rem", padding: "3px 8px", borderRadius: "6px",
                        background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.3)",
                        color: "var(--accent-cyan, #00E5FF)", fontWeight: 900
                    }}>
                        RAM: {(memoryBudget.totalDeviceRamMb / 1024).toFixed(1)} GB
                    </div>
                    {activeTab === "chat" && (
                        <button
                            onClick={handleClearChat}
                            style={{
                                padding: "4px 8px", fontSize: "0.8rem", borderRadius: "6px",
                                background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)",
                                color: "var(--text-secondary)", cursor: "pointer"
                            }}
                            title={t('copilot.clean_history') || "Limpiar"}
                        >
                            🗑️
                        </button>
                    )}
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex",
                background: "rgba(8, 10, 20, 0.95)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "6px 8px", gap: "6px", overflowX: "auto", flexShrink: 0
            }}>
                {([
                    { id: "chat", icon: "💬", label: t('copilot.tab_chat') || "Copiloto" },
                    { id: "translator", icon: "🌐", label: t('copilot.tab_translator') || "Traductor & Glosario" },
                    { id: "summarizer", icon: "📋", label: t('copilot.tab_summarizer') || "Resumidor" },
                    { id: "models", icon: "🧠", label: `${t('copilot.tab_models') || "Modelos"} ${totalStorageMb > 0 ? `(${totalStorageMb} MB)` : ""}` }
                ] as const).map(tab => {
                    const isSel = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as CopilotTab)}
                            style={{
                                flex: 1, padding: "8px 10px", fontSize: "0.76rem", fontWeight: isSel ? 900 : 700,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                whiteSpace: "nowrap", borderRadius: "10px", cursor: "pointer",
                                background: isSel ? "linear-gradient(135deg, rgba(0, 229, 255, 0.22) 0%, rgba(10, 25, 45, 0.85) 100%)" : "rgba(255, 255, 255, 0.03)",
                                border: isSel ? "1.5px solid var(--accent-cyan, #00E5FF)" : "1px solid rgba(255, 255, 255, 0.08)",
                                color: isSel ? "#00E5FF" : "var(--text-secondary)",
                                boxShadow: isSel ? "0 0 15px rgba(0, 229, 255, 0.25)" : "none",
                                transition: "all 0.15s ease"
                            }}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* PESTAÑA 1: CHAT CON IA NEURONAL */}
            {activeTab === "chat" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100% - 105px)", overflow: "hidden" }}>
                    {/* Barra de Presets Tácticos */}
                    <div style={{
                        display: "flex", gap: "6px", padding: "8px 12px",
                        overflowX: "auto", background: "rgba(0, 229, 255, 0.04)",
                        borderBottom: "1px solid rgba(0, 229, 255, 0.15)",
                        scrollbarWidth: "none", flexShrink: 0
                    }}>
                        {tacticalPresets.map((p, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSend(p.query)}
                                disabled={loading}
                                style={{
                                    padding: "5px 12px", fontSize: "0.72rem", fontWeight: 800,
                                    whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "5px",
                                    borderRadius: "14px", flexShrink: 0,
                                    background: "rgba(20, 28, 50, 0.8)",
                                    border: "1px solid rgba(0, 229, 255, 0.3)",
                                    color: "#FFFFFF", cursor: "pointer", transition: "all 0.15s ease"
                                }}
                            >
                                <span>{p.icon}</span>
                                <span>{p.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Mensajes de Chat */}
                    <div ref={chatContainerRef} className="scroll-container" style={{
                        flex: 1, padding: "14px",
                        display: "flex", flexDirection: "column", gap: "12px",
                        overflowY: "auto"
                    }}>
                        {(messages ?? []).map(msg => {
                            const isAI = msg.sender === "ai";
                            const isCopied = copiedMsgId === msg.id;

                            return (
                                <div
                                    key={msg.id}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: isAI ? "flex-start" : "flex-end",
                                        maxWidth: "88%",
                                        alignSelf: isAI ? "flex-start" : "flex-end"
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: "12px 16px",
                                            borderRadius: isAI ? "14px 14px 14px 2px" : "14px 14px 2px 14px",
                                            background: isAI ? "linear-gradient(135deg, rgba(16, 22, 44, 0.95) 0%, rgba(10, 14, 30, 0.98) 100%)" : "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                                            color: "#FFFFFF",
                                            border: isAI ? "1px solid rgba(0, 229, 255, 0.25)" : "none",
                                            boxShadow: isAI ? "0 4px 20px rgba(0, 0, 0, 0.6)" : "0 4px 20px rgba(255, 51, 85, 0.35)"
                                        }}
                                    >
                                        <div style={{
                                             fontSize: "0.86rem",
                                             lineHeight: 1.5,
                                             whiteSpace: "pre-wrap",
                                             wordBreak: "break-word",
                                             fontWeight: isAI ? 400 : 700
                                         }}>
                                            {msg.text}
                                        </div>

                                        {isAI && (
                                            (() => {
                                                const chips: { label: string; icon: string; screen: any }[] = [];
                                                const low = (msg.text || "").toLowerCase();
                                                if (low.includes("radar") || low.includes("proximidad") || low.includes("nodos en rango")) {
                                                    chips.push({ label: "Abrir Radar", icon: "📡", screen: "nearby" });
                                                }
                                                if (low.includes("mapa") || low.includes("topología") || low.includes("georrefer")) {
                                                    chips.push({ label: "Abrir Mapa", icon: "🗺️", screen: "nodemap" });
                                                }
                                                if (low.includes("brújula") || low.includes("brujula") || low.includes("azimut") || low.includes("navegación")) {
                                                    chips.push({ label: "Brújula Táctica", icon: "🧭", screen: "offGridCompass" });
                                                }
                                                if (low.includes("salud") || low.includes("batería") || low.includes("bateria") || low.includes("telemetría") || low.includes("diagnóstico")) {
                                                    chips.push({ label: "Diagnóstico", icon: "📊", screen: "systemHealth" });
                                                }
                                                if (low.includes("tccc") || low.includes("torniquete") || low.includes("triaje") || low.includes("herida") || low.includes("vital")) {
                                                    chips.push({ label: "Triaje Táctico", icon: "🩺", screen: "vitalScan" });
                                                }
                                                if (low.includes("walkie") || low.includes("voz en tiempo real")) {
                                                    chips.push({ label: "Walkie-Talkie", icon: "🎙️", screen: "walkie" });
                                                }
                                                if (low.includes("acústica") || low.includes("scrambler") || low.includes("ultrasonido")) {
                                                    chips.push({ label: "Guerra Acústica", icon: "🔇", screen: "acousticWarfare" });
                                                }
                                                if (low.includes("sonar") || low.includes("ecosonda") || low.includes("sismógrafo")) {
                                                    chips.push({ label: "Ecosonda Sonar", icon: "🦇", screen: "sonarSeismic" });
                                                }
                                                if (low.includes("espectro") || low.includes("radiofrecuencia") || low.includes("ble 2.4")) {
                                                    chips.push({ label: "Espectro RF", icon: "📻", screen: "rfSpectrum" });
                                                }
                                                if (low.includes("clima") || low.includes("barómetro") || low.includes("presión") || low.includes("meteorolog")) {
                                                    chips.push({ label: "Alertas Clima", icon: "⛈️", screen: "weather" });
                                                }
                                                if (low.includes("pago") || low.includes("pagar") || low.includes("voucher") || low.includes("saldo") || low.includes("dinero") || low.includes("transfer")) {
                                                    chips.push({ label: "Bóveda P2P Pay", icon: "💳", screen: "p2pPay" });
                                                }
                                                if (low.includes("sos") || low.includes("auxilio") || low.includes("rescate") || low.includes("baliza")) {
                                                    chips.push({ label: "Baliza SOS", icon: "🚨", screen: "sos" });
                                                }
                                                if (low.includes("visión") || low.includes("vision") || low.includes("dron") || low.includes("cámara") || low.includes("camara")) {
                                                    chips.push({ label: "Visión Táctica", icon: "👁️", screen: "tacticalVisionScan" });
                                                }
                                                if (low.includes("radar") || low.includes("malla") || low.includes("nodos cercanos") || low.includes("vecinos")) {
                                                    chips.push({ label: "Radar Mesh", icon: "📡", screen: "radar" });
                                                }
                                                if (low.includes("stego") || low.includes("esteganograf") || low.includes("cifrado") || low.includes("bóveda oculta")) {
                                                    chips.push({ label: "Bóveda Stego", icon: "🛡️", screen: "stegoVault" });
                                                }
                                                if (low.includes("ecomesh") || low.includes("ahorro") || low.includes("ciclo activo") || low.includes("duty cycle")) {
                                                    chips.push({ label: "Gestión EcoMesh", icon: "⚡", screen: "ecoMesh" });
                                                }

                                                if (chips.length === 0) return null;
                                                return (
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                                                        {chips.slice(0, 3).map((c, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => navigate(c.screen)}
                                                                style={{
                                                                    display: "flex", alignItems: "center", gap: "4px",
                                                                    padding: "3px 8px", borderRadius: "8px",
                                                                    background: "rgba(0, 229, 255, 0.12)",
                                                                    border: "1px solid rgba(0, 229, 255, 0.35)",
                                                                    color: "var(--accent-cyan, #00E5FF)",
                                                                    fontSize: "0.70rem", fontWeight: 700, cursor: "pointer",
                                                                    fontFamily: "JetBrains Mono, monospace"
                                                                }}
                                                                title={`Ir a ${c.label}`}
                                                            >
                                                                <span>{c.icon}</span>
                                                                <span>{c.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })()
                                        )}

                                        {isAI && (
                                            <div style={{
                                                marginTop: "8px", paddingTop: "6px",
                                                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                                fontSize: "0.68rem", color: "var(--text-secondary)"
                                            }}>
                                                <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan, #00E5FF)" }}>
                                                    {msg.modelTag} {msg.latencyMs ? `· ${msg.latencyMs}ms` : ""}
                                                </span>

                                                <div style={{ display: "flex", gap: "6px" }}>
                                                    <button
                                                        onClick={() => copyToClipboard(msg.text, msg.id)}
                                                        style={{ background: "none", border: "none", color: "#FFFFFF", cursor: "pointer", fontSize: "0.75rem" }}
                                                        title="Copiar"
                                                    >
                                                        {isCopied ? "✓" : "📋"}
                                                    </button>
                                                    <button
                                                        onClick={() => shareToChannel(msg.text)}
                                                        style={{ background: "none", border: "none", color: "var(--accent-cyan, #00E5FF)", cursor: "pointer", fontSize: "0.75rem" }}
                                                        title="Enviar a canal de chat activo"
                                                    >
                                                        🚀
                                                    </button>
                                                    <button
                                                        onClick={() => speakText(msg.text)}
                                                        style={{ background: "none", border: "none", color: "#FFFFFF", cursor: "pointer", fontSize: "0.75rem" }}
                                                        title="Escuchar audio"
                                                    >
                                                        🔊
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Chain of Thought */}
                                    {isAI && msg.thoughtChain && (
                                        <div style={{ width: "100%", marginTop: "4px" }}>
                                            <NeuralThoughtViewer telemetry={msg.thoughtChain} isGenerating={false} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {loading && (
                            <div style={{ width: "100%", maxWidth: "88%", alignSelf: "flex-start" }}>
                                <NeuralThoughtViewer telemetry={null} isGenerating={true} />
                            </div>
                        )}
                    </div>

                    {/* Input Bar con Dictado por Voz y Enviar */}
                    <div style={{
                        padding: "10px 14px",
                        background: "rgba(10, 14, 28, 0.98)",
                        borderTop: "1.5px solid rgba(0, 229, 255, 0.25)",
                        display: "flex", alignItems: "center", gap: "8px",
                        flexShrink: 0
                    }}>
                        <button
                            onClick={toggleVoiceInput}
                            style={{
                                width: 38, height: 38, borderRadius: "50%",
                                background: isListening ? "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" : "rgba(255, 255, 255, 0.08)",
                                border: isListening ? "none" : "1px solid rgba(0, 229, 255, 0.3)",
                                color: isListening ? "#FFFFFF" : "var(--accent-cyan, #00E5FF)",
                                cursor: "pointer", flexShrink: 0, fontSize: "1.1rem",
                                display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                            title={isListening ? "Detener grabación" : "Dictar por voz"}
                        >
                            {isListening ? "⏹️" : "🎙️"}
                        </button>

                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder={isListening ? (t('copilot.listening') || "Escuchando dictado...") : (t('copilot.input_placeholder') || "Formula una consulta de emergencia, medicina o táctica...")}
                            style={{
                                flex: 1, fontSize: "0.85rem", padding: "10px 14px",
                                background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(0, 229, 255, 0.25)",
                                borderRadius: "12px", color: "#FFFFFF", outline: "none",
                                fontFamily: "JetBrains Mono, monospace"
                            }}
                            disabled={loading}
                        />

                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || loading}
                            style={{
                                padding: "10px 18px", fontSize: "0.85rem", fontWeight: 900,
                                background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                border: "none", borderRadius: "12px", color: "#000000",
                                cursor: "pointer", opacity: (!input.trim() || loading) ? 0.5 : 1,
                                boxShadow: "0 0 15px rgba(0, 229, 255, 0.3)"
                            }}
                        >
                            {loading ? "..." : (t('copilot.send_btn') || "Enviar ➔")}
                        </button>
                    </div>
                </div>
            )}

            {/* PESTAÑA 2: TRADUCTOR TÁCTICO OFF-GRID */}
            {activeTab === "translator" && (
                <div className="scroll-container" style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
                    <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "20px", padding: "18px",
                            display: "flex", flexDirection: "column", gap: "12px"
                        }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFFFFF" }}>
                                {t('copilot.translator_title') || "Traductor Táctico & Glosario de Supervivencia"}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                Inferencia de traducción local en 12 idiomas sin conexión externa para asistencia a refugiados y rescate internacional.
                            </div>

                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-cyan, #00E5FF)" }}>IDIOMA DESTINO:</span>
                                <select
                                    value={targetLang}
                                    onChange={e => setTargetLang(e.target.value as GlossaryLanguage)}
                                    style={{
                                        background: "rgba(0, 0, 0, 0.6)", border: "1px solid rgba(0, 229, 255, 0.4)",
                                        color: "#FFFFFF", borderRadius: "8px", padding: "6px 10px", fontSize: "0.78rem",
                                        fontFamily: "JetBrains Mono, monospace"
                                    }}
                                >
                                    <option value="en">English (Inglés)</option>
                                    <option value="pt">Português (Portugués)</option>
                                    <option value="fr">Français (Francés)</option>
                                    <option value="de">Deutsch (Alemán)</option>
                                    <option value="ru">Русский (Ruso)</option>
                                    <option value="uk">Українська (Ucraniano)</option>
                                    <option value="zh">中文 (Mandarín)</option>
                                    <option value="qu">Runasimi (Quechua)</option>
                                    <option value="es">Español (Nativo)</option>
                                </select>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ position: "relative" }}>
                                    <textarea
                                        value={translatorInput}
                                        onChange={e => setTranslatorInput(e.target.value)}
                                        placeholder="Escribe, pega o dicta texto para traducir..."
                                        rows={3}
                                        style={{
                                            width: "100%", padding: "10px 42px 10px 10px", background: "rgba(0, 0, 0, 0.5)",
                                            border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                                            color: "#FFFFFF", fontSize: "0.82rem", outline: "none"
                                        }}
                                    />
                                    <button
                                        onClick={async () => {
                                            const { TacticalSpeechEngine } = await import("../lib/ai");
                                            if (TacticalSpeechEngine.isListening()) {
                                                TacticalSpeechEngine.stopListening();
                                                toast.info("Dictado finalizado");
                                            } else {
                                                TacticalSpeechEngine.startListening({
                                                    lang: "es-ES",
                                                    onStart: () => toast.info("🎙️ Escuchando dictado para traducción..."),
                                                    onResult: (transcript) => {
                                                        if (transcript) setTranslatorInput(transcript);
                                                    },
                                                    onError: () => toast.error("Error en dictado")
                                                });
                                            }
                                        }}
                                        style={{
                                            position: "absolute", right: "8px", top: "8px",
                                            background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                            borderRadius: "6px", width: "30px", height: "30px", display: "flex",
                                            alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.9rem"
                                        }}
                                        title="Dictar con micrófono"
                                    >
                                        🎙️
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleTranslate()}
                                    disabled={isTranslating || !translatorInput.trim()}
                                    style={{
                                        padding: "10px", background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                        color: "#000000", border: "none", borderRadius: "10px", fontWeight: 900,
                                        fontSize: "0.82rem", cursor: "pointer"
                                    }}
                                >
                                    {isTranslating ? "Traduciendo..." : "⚡ TRADUCIR EN TIEMPO REAL"}
                                </button>
                            </div>

                            {translatorOutput && (
                                <div style={{
                                    padding: "12px", background: "rgba(0, 230, 118, 0.1)",
                                    border: "1px solid rgba(0, 230, 118, 0.35)", borderRadius: "10px"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                                        <div style={{ fontSize: "0.68rem", fontWeight: 900, color: "#00E676" }}>
                                            TRADUCCIÓN RESULTANTE ({targetLang.toUpperCase()}):
                                        </div>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                onClick={async () => {
                                                    const { TacticalSpeechEngine } = await import("../lib/ai");
                                                    TacticalSpeechEngine.speak(translatorOutput, { lang: targetLang });
                                                }}
                                                style={{
                                                    background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)",
                                                    borderRadius: "6px", padding: "2px 8px", fontSize: "0.7rem", color: "#FFFFFF", cursor: "pointer"
                                                }}
                                                title="Escuchar pronunciación"
                                            >
                                                🔊 Escuchar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard?.writeText(translatorOutput);
                                                    toast.success("📋 Traducción copiada");
                                                }}
                                                style={{
                                                    background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)",
                                                    borderRadius: "6px", padding: "2px 8px", fontSize: "0.7rem", color: "#FFFFFF", cursor: "pointer"
                                                }}
                                                title="Copiar texto"
                                            >
                                                📋 Copiar
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#FFFFFF", lineHeight: 1.45 }}>
                                        {translatorOutput}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Glosario Rápido */}
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "20px", padding: "18px",
                            display: "flex", flexDirection: "column", gap: "10px"
                        }}>
                            <div style={{ fontSize: "0.88rem", fontWeight: 900, color: "#FFFFFF" }}>
                                FRASES RÁPIDAS DE RESCATE & EMERGENCIA
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
                                {filteredGlossary.slice(0, 12).map((entry, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectGlossaryEntry(entry)}
                                        style={{
                                            padding: "8px 10px", borderRadius: "8px",
                                            background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                            color: "#FFFFFF", textAlign: "left", fontSize: "0.75rem", cursor: "pointer"
                                        }}
                                    >
                                        <div style={{ fontWeight: 800 }}>{entry.termEs}</div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--accent-cyan, #00E5FF)" }}>{getGlossaryTerm(entry, targetLang)}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 3: RESUMIDOR DE CANALES */}
            {activeTab === "summarizer" && (
                <div className="scroll-container" style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
                    <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "20px", padding: "18px",
                            display: "flex", flexDirection: "column", gap: "12px"
                        }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFFFFF" }}>
                                {t('copilot.summarizer_title') || "Resumidor Táctico de Canales"}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                Condensa hilos extensos de radio y chat en viñetas clave de inteligencia táctica sin enviar datos fuera de tu dispositivo.
                            </div>

                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-cyan, #00E5FF)" }}>CANAL / CHAT:</span>
                                <select
                                    value={selectedChannelId}
                                    onChange={e => setSelectedChannelId(e.target.value)}
                                    style={{
                                        flex: 1, background: "rgba(0, 0, 0, 0.6)", border: "1px solid rgba(0, 229, 255, 0.4)",
                                        color: "#FFFFFF", borderRadius: "8px", padding: "6px 10px", fontSize: "0.78rem",
                                        fontFamily: "JetBrains Mono, monospace"
                                    }}
                                >
                                    {effectiveChannels.map(c => (
                                        <option key={c.id} value={c.id}>#{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleSummarizeChannel}
                                disabled={isSummarizing}
                                style={{
                                    padding: "12px", background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                    color: "#000000", border: "none", borderRadius: "10px", fontWeight: 900,
                                    fontSize: "0.82rem", cursor: "pointer"
                                }}
                            >
                                {isSummarizing ? "Generando resumen táctico..." : "⚡ GENERAR RESUMEN CON IA LOCAL"}
                            </button>

                            {summaryResult && (
                                <div style={{
                                    padding: "14px", background: "rgba(0, 229, 255, 0.08)",
                                    border: "1px solid rgba(0, 229, 255, 0.35)", borderRadius: "12px",
                                    display: "flex", flexDirection: "column", gap: "8px"
                                }}>
                                    <div style={{ fontSize: "0.72rem", fontWeight: 900, color: "#00E5FF" }}>
                                        MENSAJES ANALIZADOS: {summaryResult.totalMessages} · SENTIMIENTO: {summaryResult.sentiment || "NEUTRO"}
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.82rem", lineHeight: 1.5, color: "#FFFFFF" }}>
                                        {summaryResult.bullets.map((b, idx) => (
                                            <li key={idx}>{b}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 4: GESTOR DE MODELOS & HARDWARE */}
            {activeTab === "models" && (
                <div className="scroll-container" style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
                    <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
                        {/* Hardware Card */}
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 230, 118, 0.35)", borderRadius: "20px", padding: "18px",
                            display: "flex", flexDirection: "column", gap: "10px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E676" }}>
                                    📊 PRESUPUESTO DE MEMORIA & HARDWARE LOCAL
                                </div>
                                <button
                                    onClick={handleProbeHardware}
                                    disabled={isProbing}
                                    style={{
                                        padding: "5px 12px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 900,
                                        background: hwProbe ? "rgba(0, 230, 118, 0.15)" : "rgba(0, 229, 255, 0.12)",
                                        border: hwProbe ? "1px solid rgba(0, 230, 118, 0.5)" : "1px solid rgba(0, 229, 255, 0.4)",
                                        color: hwProbe ? "#00E676" : "var(--accent-cyan, #00E5FF)",
                                        cursor: isProbing ? "wait" : "pointer", whiteSpace: "nowrap"
                                    }}
                                >
                                    {isProbing ? "Analizando..." : hwProbe ? "✅ Detectado" : "🔬 Detectar Hardware"}
                                </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                                <div style={{ textAlign: "center", padding: "8px", background: "rgba(0,0,0,0.4)", borderRadius: "8px" }}>
                                    <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>RAM DISPOSITIVO</div>
                                    <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#FFFFFF" }}>{hwProbe ? `${(hwProbe.ramMb / 1024).toFixed(1)} GB` : `${(memoryBudget.totalDeviceRamMb / 1024).toFixed(1)} GB`}</div>
                                </div>
                                <div style={{ textAlign: "center", padding: "8px", background: "rgba(0,0,0,0.4)", borderRadius: "8px" }}>
                                    <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>MAX MODELO</div>
                                    <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E676" }}>{(memoryBudget.recommendedMaxModelMb / 1024).toFixed(1)} GB</div>
                                </div>
                                <div style={{ textAlign: "center", padding: "8px", background: hwProbe ? "rgba(0,229,255,0.1)" : "rgba(0,0,0,0.4)", borderRadius: "8px", border: hwProbe ? "1px solid rgba(0,229,255,0.3)" : "none" }}>
                                    <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>WebGPU</div>
                                    <div style={{ fontSize: "0.9rem", fontWeight: 900, color: hwProbe ? (hwProbe.hasWebGpu ? "#00E676" : "#FF6B6B") : "rgba(255,255,255,0.3)" }}>{hwProbe ? (hwProbe.hasWebGpu ? "✅ ACTIVO" : "❌ NO") : "—"}</div>
                                </div>
                            </div>
                            {hwProbe && (
                                <div style={{
                                    padding: "8px 12px", borderRadius: "10px", marginTop: "2px",
                                    background: "linear-gradient(135deg, rgba(0,229,255,0.08) 0%, rgba(0,230,118,0.08) 100%)",
                                    border: "1px solid rgba(0,229,255,0.25)",
                                    display: "flex", alignItems: "center", gap: "10px"
                                }}>
                                    <span style={{ fontSize: "1.3rem" }}>🤖</span>
                                    <div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>MODELO RECOMENDADO PARA ESTE DISPOSITIVO</div>
                                        <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "var(--accent-cyan, #00E5FF)" }}>{hwProbe.recommendedModelId}</div>
                                        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>{hwProbe.reason}</div>
                                    </div>
                                    <button
                                        onClick={() => handleSelectModel(hwProbe.recommendedModelId)}
                                        style={{
                                            marginLeft: "auto", padding: "5px 10px", borderRadius: "8px", fontSize: "0.68rem",
                                            fontWeight: 900, background: "rgba(0,229,255,0.2)", border: "1px solid var(--accent-cyan)",
                                            color: "var(--accent-cyan)", cursor: "pointer", whiteSpace: "nowrap"
                                        }}
                                    >
                                        Seleccionar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Sovereign Endpoint Card */}
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 22, 45, 0.95) 0%, rgba(8, 12, 28, 0.98) 100%)",
                            border: sovereignConfig ? "1.5px solid var(--accent-cyan, #00E5FF)" : "1.5px solid rgba(255, 255, 255, 0.15)",
                            borderRadius: "20px", padding: "18px",
                            display: "flex", flexDirection: "column", gap: "12px",
                            boxShadow: sovereignConfig ? "0 0 15px rgba(0, 229, 255, 0.15)" : "none"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "1.1rem" }}>🛰️</span>
                                    <div>
                                        <div style={{ fontSize: "0.92rem", fontWeight: 900, color: sovereignConfig ? "var(--accent-cyan, #00E5FF)" : "#FFFFFF" }}>
                                            ORQUESTADOR & ENDPOINT SOBERANO
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
                                            Conecta Ollama, LM Studio o el Nodo RED local para inferencia táctica ultrarrápida
                                        </div>
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: "0.65rem", fontWeight: 800, padding: "2px 8px", borderRadius: "10px",
                                    background: sovereignConfig ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.08)",
                                    color: sovereignConfig ? "#00E676" : "rgba(255, 255, 255, 0.5)",
                                    border: sovereignConfig ? "1px solid rgba(0, 230, 118, 0.4)" : "1px solid rgba(255, 255, 255, 0.15)"
                                }}>
                                    {sovereignConfig ? "🟢 ACTIVO" : "⚪ LOCAL WASM"}
                                </span>
                            </div>

                            {/* Presets rápidos */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {SOVEREIGN_PRESETS.map((p, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleApplyPreset(p)}
                                        style={{
                                            padding: "4px 10px", borderRadius: "8px",
                                            background: "rgba(255, 255, 255, 0.06)",
                                            border: sovereignUrlInput === p.url ? "1px solid var(--accent-cyan)" : "1px solid rgba(255, 255, 255, 0.12)",
                                            color: sovereignUrlInput === p.url ? "var(--accent-cyan)" : "rgba(255, 255, 255, 0.8)",
                                            fontSize: "0.68rem", fontWeight: 700, cursor: "pointer"
                                        }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            {/* Inputs */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                <div>
                                    <label style={{ fontSize: "0.62rem", color: "var(--text-secondary)", display: "block", marginBottom: "3px" }}>
                                        URL DEL HOST (REST / OLLAMA)
                                    </label>
                                    <input
                                        type="text"
                                        value={sovereignUrlInput}
                                        onChange={e => setSovereignUrlInput(e.target.value)}
                                        placeholder="http://127.0.0.1:11434"
                                        style={{
                                            width: "100%", padding: "7px 10px", borderRadius: "8px",
                                            background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.2)",
                                            color: "#FFFFFF", fontSize: "0.75rem", fontFamily: "monospace", boxSizing: "border-box"
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.62rem", color: "var(--text-secondary)", display: "block", marginBottom: "3px" }}>
                                        NOMBRE DEL MODELO
                                    </label>
                                    <input
                                        type="text"
                                        value={sovereignModelInput}
                                        onChange={e => setSovereignModelInput(e.target.value)}
                                        placeholder="qwen2.5:0.5b"
                                        style={{
                                            width: "100%", padding: "7px 10px", borderRadius: "8px",
                                            background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 255, 255, 0.2)",
                                            color: "#FFFFFF", fontSize: "0.75rem", fontFamily: "monospace", boxSizing: "border-box"
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Tip táctico de red local */}
                            <div style={{ fontSize: "0.64rem", color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.4, background: "rgba(0, 229, 255, 0.05)", padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(0, 229, 255, 0.15)" }}>
                                💡 <strong style={{ color: "var(--accent-cyan)" }}>Tip de Conexión:</strong> Si estás en un móvil o tablet y deseas usar la potencia de tu PC (LM Studio, Ollama o Nodo RED Desktop), ingresa la IP local de tu PC (ej. <span style={{ color: "#FFFFFF", fontFamily: "monospace" }}>http://192.168.1.50:1234/v1</span> o <span style={{ color: "#FFFFFF", fontFamily: "monospace" }}>:7333</span>). Si estás en la misma PC donde corre RED, usa <span style={{ color: "#FFFFFF", fontFamily: "monospace" }}>http://127.0.0.1:7333</span>.
                            </div>

                            {/* Status message */}
                            {sovereignTestStatus && (
                                <div style={{
                                    padding: "6px 10px", borderRadius: "8px",
                                    background: sovereignTestStatus.ok ? "rgba(0, 230, 118, 0.12)" : "rgba(255, 51, 85, 0.12)",
                                    border: sovereignTestStatus.ok ? "1px solid rgba(0, 230, 118, 0.35)" : "1px solid rgba(255, 51, 85, 0.35)",
                                    fontSize: "0.72rem",
                                    color: sovereignTestStatus.ok ? "#00E676" : "var(--primary-bright, #FF3355)"
                                }}>
                                    {sovereignTestStatus.ok ? "⚡ " : "⚠️ "}{sovereignTestStatus.message}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                <button
                                    onClick={handleTestSovereign}
                                    disabled={sovereignTesting}
                                    style={{
                                        padding: "6px 14px", borderRadius: "8px",
                                        background: "rgba(255, 255, 255, 0.1)",
                                        border: "1px solid rgba(255, 255, 255, 0.25)",
                                        color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer"
                                    }}
                                >
                                    {sovereignTesting ? "Probando..." : "⚡ Probar Conexión"}
                                </button>
                                {sovereignConfig ? (
                                    <button
                                        onClick={handleClearSovereign}
                                        style={{
                                            padding: "6px 14px", borderRadius: "8px",
                                            background: "rgba(255, 51, 85, 0.18)",
                                            border: "1px solid rgba(255, 51, 85, 0.4)",
                                            color: "#FF3355", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer"
                                        }}
                                    >
                                        Desconectar
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSaveSovereign}
                                        style={{
                                            padding: "6px 14px", borderRadius: "8px",
                                            background: "linear-gradient(135deg, rgba(0,229,255,0.3) 0%, rgba(0,230,118,0.3) 100%)",
                                            border: "1px solid var(--accent-cyan)",
                                            color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer"
                                        }}
                                    >
                                        Activar Endpoint
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Panel de IAs y Micro-Motores Embebidos Preinstalados de Fábrica */}
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 25, 45, 0.95) 0%, rgba(6, 14, 28, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "20px", padding: "18px",
                            display: "flex", flexDirection: "column", gap: "12px",
                            boxShadow: "0 0 20px rgba(0, 229, 255, 0.12)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--accent-cyan, #00E5FF)", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span>🛡️</span>
                                        <span>IAS Y MICRO-MOTORES EMBEBIDOS (PREINSTALADOS DE FÁBRICA)</span>
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "3px" }}>
                                        Operativos 100% desconectados y autónomos en RED OS (Latencia &lt; 10 ms). Cero descargas requeridas.
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: "0.62rem", fontWeight: 900, padding: "3px 8px", borderRadius: "8px",
                                    background: "rgba(0, 230, 118, 0.15)", color: "#00E676", border: "1px solid rgba(0, 230, 118, 0.4)"
                                }}>
                                    6/6 ACTIVOS
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "8px" }}>
                                {[
                                    { icon: "🛡️", name: "Guardián Semántico", role: "Moderación táctica, anti-jailbreak y detección de amenazas", state: "🟢 OPERATIVO" },
                                    { icon: "📚", name: "RAG Vectorial INT8 (64-D)", role: "15 Protocolos TCCC, supervivencia y triage en memoria", state: "🟢 OPERATIVO" },
                                    { icon: "📋", name: "Resumidor Táctico NLP", role: "Extracción léxica y análisis de sentimiento operacional", state: "🟢 OPERATIVO" },
                                    { icon: "🌐", name: "Traductor Táctico Offline", role: "Traducción directa multidireccional (ES, EN, Quechua)", state: "🟢 OPERATIVO" },
                                    { icon: "🎙️", name: "Motor de Voz Táctico", role: "STT Whisper y síntesis vocal TTS manos libres", state: "🟢 OPERATIVO" },
                                    { icon: "🩺", name: "Triaje START & Biometría", role: "Clasificación clínica de víctimas y pulso PPG por cámara", state: "🟢 OPERATIVO" },
                                ].map((sys, idx) => (
                                    <div key={idx} style={{
                                        padding: "10px 12px", borderRadius: "12px",
                                        background: "rgba(0, 0, 0, 0.35)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px"
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ fontSize: "1.1rem" }}>{sys.icon}</span>
                                            <div>
                                                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#FFFFFF" }}>{sys.name}</div>
                                                <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>{sys.role}</div>
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: "0.58rem", fontWeight: 900, padding: "2px 6px", borderRadius: "6px",
                                            background: "rgba(0, 230, 118, 0.12)", color: "#00E676", border: "1px solid rgba(0, 230, 118, 0.3)",
                                            whiteSpace: "nowrap"
                                        }}>
                                            {sys.state}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Import Button */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.88rem", fontWeight: 900, color: "#FFFFFF" }}>
                                    MODELOS NEURALES GGUF ADICIONALES (LLM CONVERSACIONAL)
                                </div>
                                <div style={{ fontSize: "0.64rem", color: "var(--text-secondary)" }}>
                                    Descarga opcional para diálogo extendido con modelos de lenguaje de última generación
                                </div>
                            </div>
                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImportGgufFile}
                                    style={{ display: "none" }}
                                    accept=".gguf,.onnx,.bin"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isImportingModel}
                                    style={{
                                        padding: "6px 12px", borderRadius: "8px",
                                        background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.4)",
                                        color: "var(--accent-cyan, #00E5FF)", fontSize: "0.72rem", fontWeight: 900,
                                        cursor: "pointer"
                                    }}
                                >
                                    {isImportingModel ? `Importando ${importProgress}%...` : "📁 IMPORTAR GGUF/ONNX"}
                                </button>
                            </div>
                        </div>

                        {/* Models List */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {availableModels.map(m => {
                                const isCurrent = Boolean(activeModel && activeModel.isDownloaded && activeModel.id === m.id);
                                const isDownloading = downloadingId === m.id;
                                const isRecommended = hwProbe?.recommendedModelId === m.id;
                                const size = m.fileSizeMb || m.size_mb || 0;

                                return (
                                    <div
                                        key={m.id}
                                        style={{
                                            padding: "16px", borderRadius: "16px",
                                            background: isCurrent ? "linear-gradient(135deg, rgba(0, 229, 255, 0.15) 0%, rgba(10, 25, 45, 0.8) 100%)" : isRecommended ? "linear-gradient(135deg, rgba(255, 200, 0, 0.06) 0%, rgba(10, 25, 45, 0.8) 100%)" : "rgba(255, 255, 255, 0.03)",
                                            border: isCurrent ? "1.5px solid #00E5FF" : isRecommended ? "1.5px solid rgba(255, 200, 0, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)",
                                            display: "flex", flexDirection: "column", gap: "8px",
                                            boxShadow: isCurrent ? "0 0 20px rgba(0, 229, 255, 0.2)" : isRecommended ? "0 0 14px rgba(255, 200, 0, 0.12)" : "none"
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <div>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#FFFFFF" }}>{m.name}</div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    Tamaño: {size} MB · RAM Min: {m.recommendedMinRamMb} MB · {m.parameterCount}
                                                </div>
                                            </div>
                                            {isCurrent && (
                                                <span style={{
                                                    fontSize: "0.6rem", fontWeight: 900, padding: "2px 8px", borderRadius: "6px",
                                                    background: "rgba(0, 230, 118, 0.15)", color: "#00E676", border: "1px solid rgba(0, 230, 118, 0.4)"
                                                }}>
                                                    ACTIVO
                                                </span>
                                            )}
                                            {isRecommended && !isCurrent && (
                                                <span style={{
                                                    fontSize: "0.6rem", fontWeight: 900, padding: "2px 8px", borderRadius: "6px",
                                                    background: "rgba(255, 200, 0, 0.15)", color: "#FFC800", border: "1px solid rgba(255, 200, 0, 0.4)"
                                                }}>
                                                    ★ RECOMENDADO
                                                </span>
                                            )}
                                        </div>

                                        <p style={{ margin: 0, fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                            {m.description}
                                        </p>

                                        {isDownloading && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                <div style={{ width: "100%", height: "6px", background: "rgba(0,0,0,0.5)", borderRadius: "3px", overflow: "hidden" }}>
                                                    <div style={{ width: `${downloadProgress}%`, height: "100%", background: "#00E5FF" }} />
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--accent-cyan, #00E5FF)" }}>
                                                    <span>
                                                        {downloadProgress >= 100 
                                                            ? "✅ Verificando firma mágica GGUF y activando..." 
                                                            : `Descargando: ${downloadProgress.toFixed(0)}%`}
                                                    </span>
                                                    <span>{(downloadBytes.loaded / 1024 / 1024).toFixed(1)} / {(downloadBytes.total / 1024 / 1024).toFixed(1)} MB</span>
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "6px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                                            {m.isDownloaded ? (
                                                <>
                                                    {!isCurrent && (
                                                        <button
                                                            onClick={() => handleSelectModel(m.id)}
                                                            style={{
                                                                padding: "6px 14px", borderRadius: "8px",
                                                                background: "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(0, 150, 255, 0.15) 100%)",
                                                                border: "1px solid #00E5FF", color: "#00E5FF",
                                                                fontWeight: 900, fontSize: "0.74rem", cursor: "pointer"
                                                            }}
                                                        >
                                                            ACTIVAR
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={async () => {
                                                            toast.info("Auditoría de integridad GGUF en curso...");
                                                            const audit = await ModelManager.verifyModelIntegrity(m.id);
                                                            if (audit.valid) {
                                                                toast.success(`✓ Integridad GGUF válida (${Math.round((audit.sizeBytes || 0)/1024/1024)} MB). Cabecera y pesos intactos.`);
                                                            } else {
                                                                toast.error(`⚠️ Integridad falló: ${audit.reason}`);
                                                            }
                                                        }}
                                                        style={{
                                                            padding: "6px 10px", borderRadius: "8px",
                                                            background: "rgba(0, 230, 118, 0.1)", border: "1px solid rgba(0, 230, 118, 0.3)",
                                                            color: "#00E676", fontSize: "0.74rem", fontWeight: 800, cursor: "pointer"
                                                        }}
                                                        title="Verificar firma mágica GGUF e integridad de pesos"
                                                    >
                                                        🛡️ AUDITAR
                                                    </button>
                                                    <button
                                                        onClick={() => handleExportModel(m.id)}
                                                        style={{
                                                            padding: "6px 12px", borderRadius: "8px",
                                                            background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)",
                                                            color: "#FFFFFF", fontSize: "0.74rem", cursor: "pointer"
                                                        }}
                                                        title="Compartir modelo P2P"
                                                    >
                                                        📤 COMPARTIR
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteModel(m.id)}
                                                        style={{
                                                            padding: "6px 12px", borderRadius: "8px",
                                                            background: "rgba(255, 51, 85, 0.1)", border: "1px solid rgba(255, 51, 85, 0.3)",
                                                            color: "#FF3355", fontSize: "0.74rem", cursor: "pointer"
                                                        }}
                                                    >
                                                        🗑️ ELIMINAR
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {isDownloading ? (
                                                        <button
                                                            onClick={() => handleCancelDownload(m.id)}
                                                            style={{
                                                                padding: "6px 14px", borderRadius: "8px",
                                                                background: "rgba(255, 51, 85, 0.15)", border: "1px solid rgba(255, 51, 85, 0.4)",
                                                                color: "#FF3355", fontWeight: 800, fontSize: "0.74rem", cursor: "pointer"
                                                            }}
                                                        >
                                                            CANCELAR
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleDownloadModel(m.id)}
                                                            style={{
                                                                padding: "6px 14px", borderRadius: "8px",
                                                                background: "linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(0, 180, 80, 0.15) 100%)",
                                                                border: "1px solid #00E676", color: "#00E676",
                                                                fontWeight: 900, fontSize: "0.74rem", cursor: "pointer"
                                                            }}
                                                        >
                                                            DESCARGAR ({size} MB)
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};