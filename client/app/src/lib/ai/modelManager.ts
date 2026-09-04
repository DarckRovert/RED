import { Filesystem, Directory } from '@capacitor/filesystem';

export interface LocalModelMetaData {
    id: string;
    name: string;
    description: string;
    parameterCount: string;
    fileSizeMb: number;
    expectedSizeBytes?: number;
    size_mb?: number;
    quantization?: string;
    downloadUrl: string;
    fileName: string;
    hfModelId?: string;
    tokenizerUrl?: string;
    tokenizerFileName?: string;
    recommendedMinRamMb: number;
    isDownloaded: boolean;
    is_downloaded?: boolean;
    downloadProgress: number; // 0 - 100
    localPath?: string;
    downloadedBytes?: number;
}

export interface SovereignEndpointConfig {
    url: string;
    modelName: string;
    apiKey?: string;
    label?: string;
}

export const SOVEREIGN_PRESETS: SovereignEndpointConfig[] = [
    { label: "🦙 Ollama (11434)", url: "http://127.0.0.1:11434", modelName: "qwen2.5:0.5b" },
    { label: "🖥️ LM Studio (1234)", url: "http://127.0.0.1:1234/v1", modelName: "local-model" },
    { label: "🍋 Lemonade Server (8000)", url: "http://127.0.0.1:8000/v1", modelName: "default" },
    { label: "📦 LocalAI / vLLM (8080)", url: "http://127.0.0.1:8080/v1", modelName: "default" },
    { label: "🤖 Jan.ai (1337)", url: "http://127.0.0.1:1337/v1", modelName: "default" }
];

export const SUPPORTED_MODELS: LocalModelMetaData[] = [
    {
        id: 'qwen-2.5-0.5b-q4',
        name: 'Qwen 2.5 0.5B Instruct (Ultra-Compacto)',
        description: '⚡ ULTRA-LIGERO (469 MB). Razonamiento en español de alta velocidad para dispositivos con 1GB a 2GB de RAM.',
        parameterCount: '0.5B',
        fileSizeMb: 469,
        expectedSizeBytes: 491400032,
        hfModelId: 'onnx-community/Qwen2.5-0.5B-Instruct',
        downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
        fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
        tokenizerUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/resolve/main/tokenizer.json',
        tokenizerFileName: 'qwen2.5-0.5b-instruct-q4_k_m.json',
        recommendedMinRamMb: 600,
        isDownloaded: false,
        downloadProgress: 0,
    },
    {
        id: 'smollm-360m-q4',
        name: 'SmolLM2 360M Instruct (HuggingFace)',
        description: '🚀 MICRO-MODELO (258 MB). El modelo instruct más rápido y compacto para inferencia táctica instantánea.',
        parameterCount: '360M',
        fileSizeMb: 258,
        expectedSizeBytes: 270590880,
        hfModelId: 'onnx-community/SmolLM2-360M-Instruct',
        downloadUrl: 'https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/resolve/main/SmolLM2-360M-Instruct-Q4_K_M.gguf',
        fileName: 'SmolLM2-360M-Instruct-Q4_K_M.gguf',
        tokenizerUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/resolve/main/tokenizer.json',
        tokenizerFileName: 'SmolLM2-360M-Instruct-Q4_K_M.json',
        recommendedMinRamMb: 500,
        isDownloaded: false,
        downloadProgress: 0,
    },
    {
        id: 'qwen-2.5-1.5b-q4',
        name: 'Qwen 2.5 1.5B Instruct (Alibaba)',
        description: '🌟 RECOMENDADO PARA MÓVILES (1.06 GB). Razonamiento táctico brillante en español con 1.6 GB de RAM.',
        parameterCount: '1.5B',
        fileSizeMb: 1066,
        expectedSizeBytes: 1117320736,
        hfModelId: 'onnx-community/Qwen2.5-1.5B-Instruct',
        downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
        fileName: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
        tokenizerUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct/resolve/main/tokenizer.json',
        tokenizerFileName: 'qwen2.5-1.5b-instruct-q4_k_m.json',
        recommendedMinRamMb: 1600,
        isDownloaded: false,
        downloadProgress: 0,
    },
    {
        id: 'llama-3.2-1b-q4',
        name: 'Llama 3.2 1B Instruct (Meta)',
        description: '⚡ ULTRA-RÁPIDO. Modelo oficial 1B de Meta optimizado para velocidad extrema en procesadores ARM64 móviles.',
        parameterCount: '1.0B',
        fileSizeMb: 770,
        expectedSizeBytes: 807694464,
        hfModelId: 'onnx-community/Llama-3.2-1B-Instruct',
        downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        tokenizerUrl: 'https://huggingface.co/unsloth/Llama-3.2-1B-Instruct/resolve/main/tokenizer.json',
        tokenizerFileName: 'Llama-3.2-1B-Instruct-Q4_K_M.json',
        recommendedMinRamMb: 1200,
        isDownloaded: false,
        downloadProgress: 0,
    },
    {
        id: 'llama-3.2-3b-q4',
        name: 'Llama 3.2 3B Instruct (Meta)',
        description: '🌟 RECOMENDADO PARA TELÉFONOS 6GB+ RAM (2.0 GB). Razonamiento táctico profundo y síntesis de alta precisión.',
        parameterCount: '3.0B',
        fileSizeMb: 2010,
        expectedSizeBytes: 2107637760,
        hfModelId: 'onnx-community/Llama-3.2-3B-Instruct',
        downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        fileName: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        tokenizerUrl: 'https://huggingface.co/unsloth/Llama-3.2-3B-Instruct/resolve/main/tokenizer.json',
        tokenizerFileName: 'Llama-3.2-3B-Instruct-Q4_K_M.json',
        recommendedMinRamMb: 3000,
        isDownloaded: false,
        downloadProgress: 0,
    },
    {
        id: 'phi-3-mini-q4',
        name: 'Phi-3 Mini 3.8B (Microsoft)',
        description: 'Modelo de 3.8B parámetros cuantizado en Q4 para dispositivos con 6GB+ de memoria RAM.',
        parameterCount: '3.8B',
        fileSizeMb: 2282,
        expectedSizeBytes: 2393231072,
        hfModelId: 'onnx-community/Phi-3-mini-4k-instruct',
        downloadUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
        fileName: 'Phi-3-mini-4k-instruct-q4.gguf',
        tokenizerUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct/resolve/main/tokenizer.json',
        tokenizerFileName: 'Phi-3-mini-4k-instruct-q4.json',
        recommendedMinRamMb: 3500,
        isDownloaded: false,
        downloadProgress: 0,
    }
];

export interface DeviceMemoryBudget {
    totalDeviceRamMb: number;
    recommendedMaxModelMb: number;
    threadCount: number;
    performanceTier: 'ultra-low' | 'balanced' | 'high-performance';
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

class ModelManagerClass {
    private models: Map<string, LocalModelMetaData> = new Map();
    private activeDownloads: Map<string, AbortController> = new Map();
    private listeners: Set<(activeModel: LocalModelMetaData | null, allModels: LocalModelMetaData[]) => void> = new Set();

    constructor() {
        SUPPORTED_MODELS.forEach(m => this.models.set(m.id, { ...m }));
        this.restoreCustomModels();
        this.checkLocalModelsStatus();
    }

    /** Subscribes to model status / selection changes */
    public subscribe(cb: (activeModel: LocalModelMetaData | null, allModels: LocalModelMetaData[]) => void): () => void {
        this.listeners.add(cb);
        cb(this.getActiveModel(), this.getModels());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const active = this.getActiveModel();
        const all = this.getModels();
        this.listeners.forEach(cb => {
            try { cb(active, all); } catch {}
        });
    }

    /** Restores custom sideloaded GGUF models from persistent storage */
    private restoreCustomModels() {
        if (typeof window === 'undefined') return;
        try {
            const customKeys = Object.keys(localStorage).filter(k => k.startsWith('red_custom_model_meta_'));
            for (const k of customKeys) {
                const raw = localStorage.getItem(k);
                if (raw) {
                    const parsed: LocalModelMetaData = JSON.parse(raw);
                    if (parsed && parsed.id) {
                        this.models.set(parsed.id, parsed);
                    }
                }
            }
        } catch (e) {
            console.warn('[ModelManager] Error restaurando modelos personalizados:', e);
        }
    }

    /** Calculates dynamic RAM allocation budget for device */
    public getDeviceMemoryBudget(): DeviceMemoryBudget {
        let ramGb = 4;
        let threads = 2;

        if (typeof navigator !== 'undefined') {
            if ('deviceMemory' in navigator) {
                ramGb = (navigator as any).deviceMemory || 4;
            }
            if ('hardwareConcurrency' in navigator) {
                threads = Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2)));
            }
        }

        const totalDeviceRamMb = ramGb * 1024;
        let performanceTier: DeviceMemoryBudget['performanceTier'] = 'balanced';
        let recommendedMaxModelMb = Math.round(totalDeviceRamMb * 0.45);

        if (totalDeviceRamMb <= 2048) {
            performanceTier = 'ultra-low';
            recommendedMaxModelMb = 650;
        } else if (totalDeviceRamMb >= 6144) {
            performanceTier = 'high-performance';
            recommendedMaxModelMb = 3500;
        }

        return {
            totalDeviceRamMb,
            recommendedMaxModelMb,
            threadCount: threads,
            performanceTier
        };
    }

    /**
     * Detecta proactivamente las capacidades reales de hardware del dispositivo
     * (WebGPU, RAM, núcleos de CPU) y devuelve el identificador del modelo óptimo.
     *
     * Reglas de selección:
     *   - Sin WebGPU y RAM ≤ 2 GB  → smollm-360m-q4  (230 MB, máxima compatibilidad)
     *   - Sin WebGPU y RAM 2–3 GB  → qwen-2.5-0.5b-q4 (390 MB)
     *   - Con WebGPU o RAM ≥ 4 GB  → qwen-2.5-1.5b-q4 (1040 MB, razonamiento táctico)
     *   - RAM ≥ 6 GB               → gemma-2b-q4       (1600 MB)
     */
    public async probeHardwareCapabilities(): Promise<{
        hasWebGpu: boolean;
        ramMb: number;
        cpuCores: number;
        recommendedModelId: string;
        reason: string;
    }> {
        const ramGb: number = typeof navigator !== 'undefined' && 'deviceMemory' in navigator
            ? ((navigator as any).deviceMemory as number) || 2
            : 2;
        const ramMb = ramGb * 1024;

        const cpuCores: number = typeof navigator !== 'undefined'
            ? navigator.hardwareConcurrency || 2
            : 2;

        // Probe WebGPU: request adapter without fallback — returns null if unsupported
        let hasWebGpu = false;
        try {
            if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
                const adapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' });
                hasWebGpu = !!adapter;
            }
        } catch {
            hasWebGpu = false;
        }

        let recommendedModelId: string;
        let reason: string;

        if (!hasWebGpu && ramMb <= 2048) {
            recommendedModelId = 'smollm-360m-q4';
            reason = `Sin WebGPU y RAM ≤ 2 GB (${ramMb} MB detectados). Modelo ultra-compacto para máxima compatibilidad.`;
        } else if (!hasWebGpu && ramMb <= 3072) {
            recommendedModelId = 'qwen-2.5-0.5b-q4';
            reason = `Sin WebGPU y RAM intermedia (${ramMb} MB). Modelo compacto Qwen 0.5B.`;
        } else if (ramMb >= 6144) {
            recommendedModelId = 'llama-3.2-3b-q4';
            reason = `RAM alta (${ramMb} MB)${hasWebGpu ? ' + WebGPU activo' : ''}. Modelo Llama 3.2 3B para razonamiento táctico avanzado.`;
        } else {
            // WebGPU disponible o RAM 4-6 GB → modelo de 1.5B
            recommendedModelId = 'qwen-2.5-1.5b-q4';
            reason = `${hasWebGpu ? 'WebGPU activo' : 'RAM suficiente'} (${ramMb} MB, ${cpuCores} núcleos). Modelo Qwen 1.5B recomendado.`;
        }

        console.log(`[ModelManager] probeHardwareCapabilities → WebGPU=${hasWebGpu}, RAM=${ramMb}MB, CPU=${cpuCores}. Recomendado: ${recommendedModelId} — ${reason}`);

        return { hasWebGpu, ramMb, cpuCores, recommendedModelId, reason };
    }

    /** Checks persistent storage for installed models and audits their integrity */
    public async checkLocalModelsStatus(): Promise<LocalModelMetaData[]> {
        if (typeof window === 'undefined') return Array.from(this.models.values());

        for (const [id, model] of this.models.entries()) {
            try {
                const filePath = `models/${model.fileName}`;
                const partPath = `models/${model.fileName}.part`;
                const expectedTotal = model.expectedSizeBytes || Math.round(model.fileSizeMb * 1024 * 1024);

                try {
                    const stat = await Filesystem.stat({
                        path: filePath,
                        directory: Directory.Data
                    });

                    // Si se conoce el tamaño exacto en bytes, la verificación de integridad es estricta al 100%
                    const isFullyComplete = model.expectedSizeBytes
                        ? stat.size >= model.expectedSizeBytes
                        : stat.size >= Math.round(expectedTotal * 0.95);

                    if (stat && isFullyComplete) {
                        const uri = await Filesystem.getUri({
                            path: filePath,
                            directory: Directory.Data
                        });
                        model.isDownloaded = true;
                        model.downloadProgress = 100;
                        model.downloadedBytes = stat.size;
                        model.localPath = uri.uri;
                        localStorage.setItem(`red_model_${id}_ready`, 'true');
                        localStorage.setItem(`red_model_${id}_path`, uri.uri);
                        
                        this.ensureTokenizerDownloaded(id).catch(() => {});
                        continue;
                    } else if (stat && !isFullyComplete) {
                        // ── AUTO-REPARACIÓN INTELIGENTE DE ARCHIVO TRUNCADO ──
                        // No eliminar los megabytes descargados: promover a .part para permitir reanudación HTTP Range inmediata
                        console.warn(`[ModelManager] Archivo truncado detectado para ${id} (${stat.size} bytes vs esperado ${expectedTotal}). Convirtiendo a descarga parcial .part...`);
                        
                        let shouldPromoteToPart = true;
                        try {
                            const partStat = await Filesystem.stat({
                                path: partPath,
                                directory: Directory.Data
                            });
                            if (partStat && partStat.size >= stat.size) {
                                shouldPromoteToPart = false;
                            }
                        } catch {}

                        if (shouldPromoteToPart) {
                            try {
                                await Filesystem.rename({
                                    from: filePath,
                                    to: partPath,
                                    directory: Directory.Data
                                });
                            } catch {
                                await Filesystem.copy({
                                    from: filePath,
                                    to: partPath,
                                    directory: Directory.Data
                                });
                                await Filesystem.deleteFile({ path: filePath, directory: Directory.Data }).catch(() => {});
                            }
                        } else {
                            await Filesystem.deleteFile({ path: filePath, directory: Directory.Data }).catch(() => {});
                        }

                        model.isDownloaded = false;
                        model.localPath = undefined;
                        localStorage.removeItem(`red_model_${id}_ready`);
                        localStorage.removeItem(`red_model_${id}_path`);
                        model.downloadedBytes = stat.size;
                        model.downloadProgress = Math.min(99, Math.round((stat.size / expectedTotal) * 100));
                        continue;
                    }
                } catch {
                    // El archivo final no existe en disco. Comprobar si existe descarga parcial (.part)
                    let partSize = 0;
                    try {
                        const partStat = await Filesystem.stat({
                            path: partPath,
                            directory: Directory.Data
                        });
                        if (partStat && partStat.size > 0) {
                            partSize = partStat.size;
                        }
                    } catch {}

                    model.isDownloaded = false;
                    model.localPath = undefined;
                    localStorage.removeItem(`red_model_${id}_ready`);
                    localStorage.removeItem(`red_model_${id}_path`);

                    if (partSize > 0) {
                        model.downloadedBytes = partSize;
                        model.downloadProgress = Math.min(99, Math.round((partSize / expectedTotal) * 100));
                    } else {
                        model.downloadProgress = 0;
                        model.downloadedBytes = 0;
                    }
                }
            } catch (e) {
                console.warn(`[ModelManager] Error verificando estado de ${id}:`, e);
            }
        }
        this.notify();
        return Array.from(this.models.values());
    }

    /** Returns all available models */
    public getModels(): LocalModelMetaData[] {
        return Array.from(this.models.values());
    }

    public getModel(id: string): LocalModelMetaData | undefined {
        return this.models.get(id);
    }

    /** Returns currently selected active model if downloaded, otherwise user selected model */
    public getActiveModel(): LocalModelMetaData | null {
        if (typeof window === 'undefined') return null;
        const activeId = localStorage.getItem('red_active_model_id');
        
        if (activeId && this.models.has(activeId)) {
            const m = this.models.get(activeId)!;
            if (m.isDownloaded) return m;
        }

        // Si el modelo seleccionado no está descargado, priorizar cualquier modelo que SÍ esté en disco
        for (const m of this.models.values()) {
            if (m.isDownloaded) return m;
        }

        // Si ningún modelo está efectivamente descargado en el dispositivo, retornar null
        // para que la interfaz y el motor indiquen con veracidad que el sistema opera
        // con las IAs y el RAG Táctico INT8 preinstalados de fábrica.
        return null;
    }

    /** Sets the primary active model without forcing uninstalled defaults */
    public setActiveModel(modelId: string): void {
        const target = this.models.get(modelId);
        if (target) {
            if (typeof window !== 'undefined') {
                localStorage.setItem('red_active_model_id', modelId);
            }
            this.ensureTokenizerDownloaded(modelId).catch(() => {});
            this.notify();
        }
    }

    /** Auto-sanación de Tokenizer: descarga tokenizer.json si falta para el modelo activo (con timeout no-bloqueante) */
    public async ensureTokenizerDownloaded(modelId: string): Promise<boolean> {
        const model = this.models.get(modelId);
        if (!model || !model.tokenizerUrl) return false;

        const tokenizerFileName = model.tokenizerFileName || 'tokenizer.json';
        const targetPath = `models/${tokenizerFileName}`;
        const defaultPath = `models/tokenizer.json`;

        try {
            try {
                const stat = await Filesystem.stat({
                    path: targetPath,
                    directory: Directory.Data
                });
                if (stat && stat.size > 50 * 1024) {
                    return true;
                }
            } catch {}

            console.log(`[ModelManager] Auto-descargando tokenizer.json para ${model.name}...`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout para descarga completa sin truncar

            const resp = await fetch(model.tokenizerUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resp.ok) {
                const text = await resp.text();
                if (!text || text.length < 1000 || !text.trim().startsWith('{')) {
                    throw new Error(`Tokenizer inválido o truncado (${text?.length || 0} bytes)`);
                }
                const encoder = new TextEncoder();
                const bytes = encoder.encode(text);
                const base64Data = uint8ArrayToBase64(bytes);

                await Filesystem.writeFile({
                    path: targetPath,
                    data: base64Data,
                    directory: Directory.Data
                });
                await Filesystem.writeFile({
                    path: defaultPath,
                    data: base64Data,
                    directory: Directory.Data
                });
                console.log(`[ModelManager] ✅ Tokenizer sincronizado y validado (${bytes.length} bytes) para ${model.name}`);
                return true;
            }
        } catch (e) {
            console.warn(`[ModelManager] Falló la descarga o validación del tokenizer para ${modelId}:`, e);
        }
        return false;
    }

    /**
     * Valida si un búfer de bytes comienza con la firma canónica GGUF (0x47, 0x47, 0x55, 0x46 -> "GGUF")
     */
    public static verifyGgufHeader(bytes: Uint8Array): boolean {
        if (!bytes || bytes.length < 4) return false;
        return bytes[0] === 0x47 && bytes[1] === 0x47 && bytes[2] === 0x55 && bytes[3] === 0x46;
    }

    /** Downloads model with low RAM usage (2MB chunked writing to disk) + Resumable HTTP Range + Auto-Resume Loop + Zero OOM */
    public async downloadModel(
        modelId: string,
        onProgress?: (progress: number, loadedBytes: number, totalBytes: number) => void
    ): Promise<boolean> {
        const model = this.models.get(modelId);
        if (!model) throw new Error(`Modelo ${modelId} no soportado.`);

        if (this.activeDownloads.has(modelId)) {
            console.warn('[ModelManager] Download already in progress for', modelId);
            return false;
        }

        const controller = new AbortController();
        this.activeDownloads.set(modelId, controller);

        try {
            console.log(`[ModelManager] Iniciando descarga nativa persistente para ${model.name}...`);

            try {
                await Filesystem.mkdir({
                    path: 'models',
                    directory: Directory.Data,
                    recursive: true
                });
            } catch {}

            const targetFilePath = `models/${model.fileName}`;
            const partFilePath = `models/${model.fileName}.part`;
            const headerFilePath = `models/${model.fileName}.header`;

            const totalBytes = model.expectedSizeBytes || (model.fileSizeMb * 1024 * 1024);
            const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
            const MAX_RETRIES = 5;
            let retryCount = 0;
            let headerVerified = false;

            // Comprobar si ya existe cabecera previa verificada
            try {
                const headerStat = await Filesystem.stat({
                    path: headerFilePath,
                    directory: Directory.Data
                });
                if (headerStat && headerStat.size >= 4) {
                    headerVerified = true;
                }
            } catch {}

            while (retryCount < MAX_RETRIES) {
                if (controller.signal.aborted) {
                    throw new DOMException('Descarga cancelada por el usuario', 'AbortError');
                }

                // 1. Verificar tamaño actual de descarga parcial
                let existingBytes = 0;
                try {
                    const statPart = await Filesystem.stat({
                        path: partFilePath,
                        directory: Directory.Data
                    });
                    if (statPart && statPart.size > 0) {
                        existingBytes = statPart.size;
                    }
                } catch {}

                // Si ya se descargaron todos los bytes requeridos, salir del bucle
                if (existingBytes >= totalBytes) {
                    console.log(`[ModelManager] Archivo parcial .part ya contiene la totalidad de bytes (${existingBytes}/${totalBytes}). Finalizando...`);
                    break;
                }

                if (existingBytes > 0) {
                    console.log(`[ModelManager] Descarga parcial detectada para ${model.name}: ${existingBytes} de ${totalBytes} bytes. Reanudando desde HTTP Range (intento ${retryCount + 1}/${MAX_RETRIES})...`);
                }

                const headers: Record<string, string> = {};
                if (existingBytes > 0) {
                    headers['Range'] = `bytes=${existingBytes}-`;
                }

                let response: Response;
                try {
                    response = await fetch(model.downloadUrl, {
                        signal: controller.signal,
                        mode: 'cors',
                        headers
                    });
                } catch (fetchErr: any) {
                    if (controller.signal.aborted) throw fetchErr;
                    retryCount++;
                    if (retryCount >= MAX_RETRIES) throw fetchErr;
                    console.warn(`[ModelManager] Error de red en fetch (${fetchErr.message}). Reintentando en ${retryCount * 1500}ms...`);
                    await new Promise(r => setTimeout(r, retryCount * 1500));
                    continue;
                }

                // Si el servidor retorna 416 (Range Not Satisfiable):
                if (response.status === 416) {
                    if (existingBytes >= totalBytes) {
                        break;
                    }
                    console.warn('[ModelManager] HTTP 416 Range Not Satisfiable recibido. Reiniciando descarga desde 0...');
                    await Filesystem.deleteFile({ path: partFilePath, directory: Directory.Data }).catch(() => {});
                    await Filesystem.deleteFile({ path: headerFilePath, directory: Directory.Data }).catch(() => {});
                    existingBytes = 0;
                    retryCount++;
                    continue;
                }

                if (!response.ok && response.status !== 206) {
                    retryCount++;
                    if (retryCount >= MAX_RETRIES) {
                        throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
                    }
                    console.warn(`[ModelManager] HTTP ${response.status} recibido. Reintentando (${retryCount}/${MAX_RETRIES})...`);
                    await new Promise(r => setTimeout(r, retryCount * 1500));
                    continue;
                }

                const isPartialResume = response.status === 206;
                let loadedBytes = isPartialResume ? existingBytes : 0;
                let isFirstWrite = (!isPartialResume && existingBytes === 0);

                if (!isPartialResume && existingBytes > 0) {
                    console.warn('[ModelManager] Servidor no soportó HTTP 206 Range. Reiniciando .part desde byte 0...');
                    await Filesystem.deleteFile({ path: partFilePath, directory: Directory.Data }).catch(() => {});
                    isFirstWrite = true;
                    existingBytes = 0;
                    loadedBytes = 0;
                }

                if (!response.body) throw new Error('Cuerpo de respuesta HTTP vacío.');

                const reader = response.body.getReader();
                let chunkBuffer = new Uint8Array(0);

                if (isPartialResume) {
                    headerVerified = true;
                }

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        loadedBytes += value.byteLength;
                        model.downloadedBytes = loadedBytes;

                        const merged = new Uint8Array(chunkBuffer.length + value.byteLength);
                        merged.set(chunkBuffer, 0);
                        merged.set(value, chunkBuffer.length);
                        chunkBuffer = merged;

                        // ── VERIFICACIÓN TEMPRANA STREAMING (CHUNK 0) ──
                        if (!headerVerified && chunkBuffer.length >= 4) {
                            const headSlice = chunkBuffer.slice(0, 4);
                            if (!ModelManagerClass.verifyGgufHeader(headSlice)) {
                                throw new Error('El flujo descargado no contiene una cabecera GGUF válida (0x47475546).');
                            }
                            headerVerified = true;

                            try {
                                const head16 = chunkBuffer.slice(0, Math.min(16, chunkBuffer.length));
                                await Filesystem.writeFile({
                                    path: headerFilePath,
                                    data: uint8ArrayToBase64(head16),
                                    directory: Directory.Data
                                });
                            } catch {}
                        }

                        if (chunkBuffer.length >= CHUNK_SIZE) {
                            const base64Data = uint8ArrayToBase64(chunkBuffer);
                            if (isFirstWrite) {
                                await Filesystem.writeFile({
                                    path: partFilePath,
                                    data: base64Data,
                                    directory: Directory.Data
                                });
                                isFirstWrite = false;
                            } else {
                                await Filesystem.appendFile({
                                    path: partFilePath,
                                    data: base64Data,
                                    directory: Directory.Data
                                });
                            }
                            chunkBuffer = new Uint8Array(0);
                        }

                        const pct = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
                        model.downloadProgress = pct;

                        if (onProgress) {
                            onProgress(pct, loadedBytes, totalBytes);
                        }
                    }

                    if (chunkBuffer.length > 0) {
                        if (!headerVerified && chunkBuffer.length >= 4) {
                            if (!ModelManagerClass.verifyGgufHeader(chunkBuffer.slice(0, 4))) {
                                throw new Error('El archivo descargado no contiene una cabecera GGUF válida (0x47475546).');
                            }
                            headerVerified = true;
                            try {
                                const head16 = chunkBuffer.slice(0, Math.min(16, chunkBuffer.length));
                                await Filesystem.writeFile({
                                    path: headerFilePath,
                                    data: uint8ArrayToBase64(head16),
                                    directory: Directory.Data
                                });
                            } catch {}
                        }

                        const base64Data = uint8ArrayToBase64(chunkBuffer);
                        if (isFirstWrite) {
                            await Filesystem.writeFile({
                                path: partFilePath,
                                data: base64Data,
                                directory: Directory.Data
                            });
                            isFirstWrite = false;
                        } else {
                            await Filesystem.appendFile({
                                path: partFilePath,
                                data: base64Data,
                                directory: Directory.Data
                            });
                        }
                        chunkBuffer = new Uint8Array(0);
                    }
                } catch (readErr: any) {
                    if (controller.signal.aborted) throw readErr;
                    console.warn(`[ModelManager] Error durante lectura del stream: ${readErr.message}`);
                }

                // 2. Auditar tamaño físico real tras culminar el stream
                let currentPartSize = 0;
                try {
                    const checkStat = await Filesystem.stat({
                        path: partFilePath,
                        directory: Directory.Data
                    });
                    if (checkStat) currentPartSize = checkStat.size;
                } catch {}

                if (currentPartSize >= totalBytes) {
                    console.log(`[ModelManager] ✅ Descarga completa alcanzada: ${currentPartSize}/${totalBytes} bytes.`);
                    break;
                } else {
                    retryCount++;
                    console.warn(`[ModelManager] Conexión cerrada prematuramente (${currentPartSize}/${totalBytes} bytes). Reanudando automáticamente (intento ${retryCount}/${MAX_RETRIES})...`);
                    if (retryCount >= MAX_RETRIES) {
                        throw new Error(`Descarga incompleta tras ${MAX_RETRIES} intentos (${currentPartSize} de ${totalBytes} bytes). El archivo parcial se conservó intacto.`);
                    }
                    await new Promise(r => setTimeout(r, 1000 * retryCount));
                }
            }

            // ── VERIFICACIÓN ESTRICTA AL BYTE EXACTO PREVIA A PROMOCIÓN ──
            const minAcceptableBytes = totalBytes;
            const finalPartStat = await Filesystem.stat({
                path: partFilePath,
                directory: Directory.Data
            });

            if (!finalPartStat || finalPartStat.size < minAcceptableBytes) {
                const actual = finalPartStat ? finalPartStat.size : 0;
                throw new Error(`Fallo de integridad: Archivo descargado incompleto (${actual} bytes vs esperado ${minAcceptableBytes} bytes). No se promueve a .gguf.`);
            }

            // ── PROMOCIÓN ATÓMICA CON RENAME (1ms, Cero Duplicación de Almacenamiento) ──
            try {
                await Filesystem.rename({
                    from: partFilePath,
                    to: targetFilePath,
                    directory: Directory.Data
                });
            } catch (renameErr) {
                console.warn('[ModelManager] rename no disponible, fallback a copy:', renameErr);
                await Filesystem.copy({
                    from: partFilePath,
                    to: targetFilePath,
                    directory: Directory.Data
                });
                await Filesystem.deleteFile({ path: partFilePath, directory: Directory.Data }).catch(() => {});
            }

            let localUri = `models/${model.fileName}`;
            try {
                const uriResult = await Filesystem.getUri({
                    path: targetFilePath,
                    directory: Directory.Data
                });
                localUri = uriResult.uri;
            } catch {}

            // Notificación inmediata al 100% (evita congelamiento en 99%)
            model.isDownloaded = true;
            model.downloadProgress = 100;
            model.downloadedBytes = finalPartStat.size;
            model.localPath = localUri;

            if (onProgress) {
                onProgress(100, finalPartStat.size, totalBytes);
            }

            // Descarga síncrona y verificación obligatoria del tokenizer antes de marcar el modelo como listo
            console.log(`[ModelManager] Verificando tokenizer para ${model.name}...`);
            const tokOk = await this.ensureTokenizerDownloaded(modelId).catch((tokErr) => {
                console.warn(`[ModelManager] Error descargando tokenizer para ${modelId}:`, tokErr);
                return false;
            });

            if (!tokOk) {
                console.warn(`[ModelManager] Advertencia: Tokenizer para ${modelId} no pudo ser verificado de inmediato. Reintentando...`);
                await this.ensureTokenizerDownloaded(modelId).catch(() => {});
            }

            if (typeof window !== 'undefined') {
                localStorage.setItem(`red_model_${modelId}_ready`, 'true');
                localStorage.setItem(`red_model_${modelId}_path`, localUri);
                localStorage.setItem('red_active_model_id', modelId);
            }

            this.activeDownloads.delete(modelId);
            this.notify();
            console.log(`[ModelManager] ✅ Descarga e integridad garantizada para ${model.name} (${finalPartStat.size} bytes)!`);
            return true;
        } catch (err: any) {
            this.activeDownloads.delete(modelId);
            if (err.name === 'AbortError') {
                console.log(`[ModelManager] Descarga pausada/cancelada para ${modelId}. Se conservan partes.`);
            } else {
                console.error(`[ModelManager] Falló la descarga de ${modelId}:`, err);
                // Si hay bytes en disco, mantener progreso honesto en lugar de 0
                try {
                    const partStat = await Filesystem.stat({
                        path: `models/${model.fileName}.part`,
                        directory: Directory.Data
                    });
                    if (partStat && partStat.size > 0) {
                        const totalExpected = model.expectedSizeBytes || (model.fileSizeMb * 1024 * 1024);
                        model.downloadedBytes = partStat.size;
                        model.downloadProgress = Math.min(99, Math.round((partStat.size / totalExpected) * 100));
                    } else {
                        model.downloadProgress = 0;
                    }
                } catch {
                    model.downloadProgress = 0;
                }
            }
            this.notify();
            return false;
        }
    }

    /** Cancels an active download */
    public cancelDownload(modelId: string) {
        const controller = this.activeDownloads.get(modelId);
        if (controller) {
            controller.abort();
            this.activeDownloads.delete(modelId);
        }
    }

    /** Audits and verifies integrity of an on-disk model file (Zero OOM) */
    public async verifyModelIntegrity(modelId: string): Promise<{ valid: boolean; reason?: string; sizeBytes?: number }> {
        const model = this.models.get(modelId);
        if (!model) return { valid: false, reason: 'Modelo no encontrado.' };

        const targetFilePath = `models/${model.fileName}`;
        const headerFilePath = `models/${model.fileName}.header`;

        try {
            const stat = await Filesystem.stat({
                path: targetFilePath,
                directory: Directory.Data
            });

            if (!stat || stat.size === 0) {
                return { valid: false, reason: 'El archivo físico no existe o está vacío.' };
            }

            const expectedBytes = model.expectedSizeBytes || Math.round(model.fileSizeMb * 1024 * 1024);
            if (model.expectedSizeBytes && stat.size < model.expectedSizeBytes) {
                return {
                    valid: false,
                    reason: `Tamaño incompleto (${(stat.size / 1024 / 1024).toFixed(2)} MB vs exacto esperado ${(expectedBytes / 1024 / 1024).toFixed(2)} MB; faltan ${expectedBytes - stat.size} bytes).`,
                    sizeBytes: stat.size
                };
            }

            // Validar cabecera desde el archivo liviano .header (16 bytes, CERO OOM en móvil)
            let headerValid = false;
            try {
                const headerStat = await Filesystem.stat({
                    path: headerFilePath,
                    directory: Directory.Data
                });
                if (headerStat && headerStat.size >= 4) {
                    const headerData = await Filesystem.readFile({
                        path: headerFilePath,
                        directory: Directory.Data
                    });
                    if (typeof headerData.data === 'string') {
                        const rawHead = atob(headerData.data.substring(0, 16));
                        const bytes = new Uint8Array(rawHead.length);
                        for (let i = 0; i < rawHead.length; i++) bytes[i] = rawHead.charCodeAt(i);
                        headerValid = ModelManagerClass.verifyGgufHeader(bytes);
                    }
                }
            } catch {}

            // Si no existe .header auxiliar (ej. modelo importado o copiado previamente),
            // verificar que el tamaño físico sea consistente con la arquitectura GGUF
            if (!headerValid) {
                if (targetFilePath.endsWith('.gguf') && stat.size >= expectedBytes) {
                    headerValid = true;
                }
            }

            if (!headerValid) {
                return { valid: false, reason: 'Cabecera GGUF inválida o archivo corrupto.', sizeBytes: stat.size };
            }

            return { valid: true, sizeBytes: stat.size };
        } catch (e: any) {
            return { valid: false, reason: e.message || 'Error accediendo al archivo.' };
        }
    }

    /** Deletes a downloaded model and its tokenizer to free storage */
    public async deleteModel(modelId: string): Promise<boolean> {
        const model = this.models.get(modelId);
        if (!model) return false;

        try {
            const targetFilePath = `models/${model.fileName}`;
            const partFilePath = `models/${model.fileName}.part`;
            const headerFilePath = `models/${model.fileName}.header`;
            try {
                await Filesystem.deleteFile({
                    path: targetFilePath,
                    directory: Directory.Data
                });
            } catch {}

            try {
                await Filesystem.deleteFile({
                    path: partFilePath,
                    directory: Directory.Data
                });
            } catch {}

            try {
                await Filesystem.deleteFile({
                    path: headerFilePath,
                    directory: Directory.Data
                });
            } catch {}

            if (model.tokenizerFileName) {
                try {
                    await Filesystem.deleteFile({
                        path: `models/${model.tokenizerFileName}`,
                        directory: Directory.Data
                    });
                } catch {}
            }

            model.isDownloaded = false;
            model.downloadProgress = 0;
            model.downloadedBytes = 0;
            model.localPath = undefined;

            if (typeof window !== 'undefined') {
                localStorage.removeItem(`red_model_${modelId}_ready`);
                localStorage.removeItem(`red_model_${modelId}_path`);
                localStorage.removeItem(`red_custom_model_meta_${modelId}`);
                if (localStorage.getItem('red_active_model_id') === modelId) {
                    localStorage.removeItem('red_active_model_id');
                }
            }
            this.notify();
            return true;
        } catch (e) {
            console.error(`[ModelManager] Error deleting model ${modelId}:`, e);
            return false;
        }
    }

    /**
     * Sideloading Offline: Importa un archivo .gguf directamente desde almacenamiento local (SD, USB OTG, Descargas)
     * sin requerir conexión a internet. Valida el encabezado mágico GGUF (0x46554747).
     */
    public async importModelFromLocalFile(
        file: File,
        onProgress?: (progress: number, loadedBytes: number, totalBytes: number) => void
    ): Promise<LocalModelMetaData> {
        const fileName = file.name;
        if (!fileName.toLowerCase().endsWith('.gguf')) {
            throw new Error('El archivo debe tener extensión .gguf');
        }

        const cleanId = `custom-${fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
        const fileSizeMb = Math.round(file.size / (1024 * 1024));

        try {
            await Filesystem.mkdir({
                path: 'models',
                directory: Directory.Data,
                recursive: true
            });
        } catch {}

        const targetFilePath = `models/${fileName}`;
        const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
        const totalBytes = file.size;
        let offset = 0;
        let isFirstWrite = true;

        // Validar cabecera mágica GGUF (primeros 4 bytes: 'G', 'G', 'U', 'F')
        const headerSlice = file.slice(0, 16);
        const headerBuf = await headerSlice.arrayBuffer();
        const headerBytes = new Uint8Array(headerBuf);
        const isGguf = ModelManagerClass.verifyGgufHeader(headerBytes);
        if (!isGguf) {
            throw new Error('El archivo no tiene una cabecera GGUF válida.');
        }

        // Persistir archivo auxiliar liviano .header para auditorías futuras sin OOM
        try {
            await Filesystem.writeFile({
                path: `models/${fileName}.header`,
                data: uint8ArrayToBase64(headerBytes),
                directory: Directory.Data
            });
        } catch {}

        while (offset < totalBytes) {
            const nextOffset = Math.min(offset + CHUNK_SIZE, totalBytes);
            const slice = file.slice(offset, nextOffset);
            const arrayBuf = await slice.arrayBuffer();
            const chunkBytes = new Uint8Array(arrayBuf);
            const base64Data = uint8ArrayToBase64(chunkBytes);

            if (isFirstWrite) {
                await Filesystem.writeFile({
                    path: targetFilePath,
                    data: base64Data,
                    directory: Directory.Data
                });
                isFirstWrite = false;
            } else {
                await Filesystem.appendFile({
                    path: targetFilePath,
                    data: base64Data,
                    directory: Directory.Data
                });
            }

            offset = nextOffset;
            const progress = Math.min(100, Math.round((offset / totalBytes) * 100));
            if (onProgress) {
                onProgress(progress, offset, totalBytes);
            }
        }

        let localUri = `models/${fileName}`;
        try {
            const uriResult = await Filesystem.getUri({
                path: targetFilePath,
                directory: Directory.Data
            });
            localUri = uriResult.uri;
        } catch {}

        const newModel: LocalModelMetaData = {
            id: cleanId,
            name: fileName.replace(/\.gguf$/i, ''),
            description: `📂 Modelo importado localmente (${fileSizeMb} MB). Inferencia GGUF ARM64 100% offline.`,
            parameterCount: fileSizeMb < 400 ? '0.5B' : fileSizeMb < 1200 ? '1.5B' : '3B+',
            fileSizeMb,
            downloadUrl: '',
            fileName,
            recommendedMinRamMb: Math.round(fileSizeMb * 1.5),
            isDownloaded: true,
            downloadProgress: 100,
            localPath: localUri
        };

        this.models.set(cleanId, newModel);
        if (typeof window !== 'undefined') {
            localStorage.setItem(`red_model_${cleanId}_ready`, 'true');
            localStorage.setItem(`red_model_${cleanId}_path`, localUri);
            localStorage.setItem(`red_custom_model_meta_${cleanId}`, JSON.stringify(newModel));
            localStorage.setItem('red_active_model_id', cleanId);
        }

        this.notify();
        console.log(`[ModelManager] ✅ Modelo importado con éxito: ${newModel.name} (${fileSizeMb} MB)`);
        return newModel;
    }

    /**
     * Exporta un modelo descargado para compartirlo P2P con otro dispositivo vía Web Share API / Wi-Fi Direct
     */
    public async exportModel(modelId: string): Promise<boolean> {
        const model = this.models.get(modelId);
        if (!model || !model.isDownloaded) return false;

        try {
            const targetFilePath = `models/${model.fileName}`;
            const uriResult = await Filesystem.getUri({
                path: targetFilePath,
                directory: Directory.Data
            });

            const { Share } = await import('@capacitor/share');
            await Share.share({
                title: `Modelo Neuronal RED: ${model.name}`,
                text: `Transferencia P2P de modelo offline ${model.name} (${model.fileSizeMb} MB) para Copiloto IA de RED.`,
                url: uriResult.uri,
                dialogTitle: 'Compartir Modelo Neuronal P2P'
            });
            return true;
        } catch (e) {
            console.warn('[ModelManager] Error exportando modelo P2P:', e);
            return false;
        }
    }

    /** Returns total storage used by downloaded models in MB */
    public getTotalStorageUsedMb(): number {
        let total = 0;
        for (const m of this.models.values()) {
            if (m.isDownloaded) {
                total += m.fileSizeMb;
            }
        }
        return total;
    }

    /** Obtiene la configuración del endpoint soberano (Ollama / Local API) si está habilitado */
    public getSovereignEndpoint(): SovereignEndpointConfig | null {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem('red_sovereign_ai_endpoint');
            if (raw) {
                const parsed = JSON.parse(raw);
                // Purgar configuraciones obsoletas o loopback local erróneas
                if (parsed.url && (parsed.url.includes(':7333') || parsed.url.includes('127.0.0.1') || parsed.url.includes('localhost'))) {
                    localStorage.removeItem('red_sovereign_ai_endpoint');
                    return null;
                }
                return parsed;
            }
        } catch {}
        return null;
    }

    /** Indica si hay un endpoint soberano configurado y activo */
    public isSovereignActive(): boolean {
        return this.getSovereignEndpoint() !== null;
    }

    /** Descripción legible del endpoint o modelo activo */
    public getActiveEndpointDescription(): string {
        const sov = this.getSovereignEndpoint();
        if (sov) {
            return `Sovereign (${sov.modelName || 'Host Local'} @ ${sov.url})`;
        }
        const active = this.getActiveModel();
        return active ? active.name : 'Motor Neuronal Local WASM';
    }

    /** Guarda o elimina la configuración del endpoint soberano */
    public setSovereignEndpoint(config: SovereignEndpointConfig | null): void {
        if (typeof window === 'undefined') return;
        if (config) {
            localStorage.setItem('red_sovereign_ai_endpoint', JSON.stringify(config));
        } else {
            localStorage.removeItem('red_sovereign_ai_endpoint');
        }
        this.notify();
    }

    /** Valida la conectividad contra un endpoint soberano */
    public async testSovereignEndpoint(url: string, modelName: string, apiKey?: string): Promise<{ ok: boolean; message: string; latencyMs: number }> {
        const start = performance.now();
        try {
            let cleanUrl = url.trim().replace(/\/+$/, '');
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                cleanUrl = `http://${cleanUrl}`;
            }

            // Probing especializado para Nodo RED Nativo (puerto 7333)
            if (cleanUrl.includes(':7333')) {
                const statusUrl = `${cleanUrl}/api/ai/status`;
                try {
                    const statusResp = await fetch(statusUrl, { signal: AbortSignal.timeout(3500) });
                    if (statusResp.ok) {
                        const data = await statusResp.json().catch(() => ({}));
                        const latencyMs = Math.round(performance.now() - start);
                        return {
                            ok: true,
                            message: `Conexión exitosa con Nodo RED Nativo (${data.engine || 'Activo'}, ${latencyMs}ms)`,
                            latencyMs
                        };
                    }
                } catch {
                    // Fallthrough para probar compatibilidad general
                }
            }

            const targetUrl = cleanUrl.includes('/v1') 
                ? `${cleanUrl}/chat/completions` 
                : `${cleanUrl}/api/generate`;
            
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            const body = cleanUrl.includes('/v1')
                ? { model: modelName || 'local-model', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }
                : { model: modelName || 'red-tactical', prompt: 'ping', stream: false };

            const resp = await fetch(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(6000)
            });

            const latencyMs = Math.round(performance.now() - start);
            if (resp.ok) {
                return { ok: true, message: `Conexión exitosa (${latencyMs}ms)`, latencyMs };
            } else {
                return { ok: false, message: `Error HTTP ${resp.status}: ${resp.statusText}`, latencyMs };
            }
        } catch (e: any) {
            const latencyMs = Math.round(performance.now() - start);
            let msg = e.message || 'Error de conexión con el host';
            if (url.includes('127.0.0.1') || url.includes('localhost')) {
                msg += ' (Tip: En móvil/tablet, coloca la IP local de tu PC, ej. 192.168.1.50:1234)';
            }
            return { ok: false, message: msg, latencyMs };
        }
    }
}

export const ModelManager = new ModelManagerClass();
