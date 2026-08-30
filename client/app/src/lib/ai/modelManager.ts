import { Filesystem, Directory } from '@capacitor/filesystem';

export interface LocalModelMetaData {
    id: string;
    name: string;
    description: string;
    parameterCount: string;
    fileSizeMb: number;
    size_mb?: number;
    quantization?: string;
    downloadUrl: string;
    fileName: string;
    tokenizerUrl?: string;
    tokenizerFileName?: string;
    recommendedMinRamMb: number;
    isDownloaded: boolean;
    is_downloaded?: boolean;
    downloadProgress: number; // 0 - 100
    localPath?: string;
    downloadedBytes?: number;
}

export const SUPPORTED_MODELS: LocalModelMetaData[] = [
    {
        id: 'qwen-2.5-0.5b-q4',
        name: 'Qwen 2.5 0.5B Instruct (Ultra-Compacto)',
        description: '⚡ ULTRA-LIGERO (390 MB). Razonamiento en español de alta velocidad para dispositivos con 1GB a 2GB de RAM.',
        parameterCount: '0.5B',
        fileSizeMb: 390,
        downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
        fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
        tokenizerUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/raw/main/tokenizer.json',
        tokenizerFileName: 'qwen2.5-0.5b-instruct-q4_k_m.json',
        recommendedMinRamMb: 600,
        isDownloaded: false,
        downloadProgress: 0,
    },
    {
        id: 'smollm-360m-q4',
        name: 'SmolLM2 360M Instruct (HuggingFace)',
        description: '🚀 MICRO-MODELO (230 MB). El modelo instruct más rápido y compacto para inferencia táctica instantánea.',
        parameterCount: '360M',
        fileSizeMb: 230,
        downloadUrl: 'https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/resolve/main/SmolLM2-360M-Instruct-Q4_K_M.gguf',
        fileName: 'SmolLM2-360M-Instruct-Q4_K_M.gguf',
        tokenizerUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/raw/main/tokenizer.json',
        tokenizerFileName: 'SmolLM2-360M-Instruct-Q4_K_M.json',
        recommendedMinRamMb: 500,
        isDownloaded: false,
        downloadProgress: 0,
    },
    {
        id: 'qwen-2.5-1.5b-q4',
        name: 'Qwen 2.5 1.5B Instruct (Alibaba)',
        description: '🌟 RECOMENDADO PARA MÓVILES. Razonamiento táctico brillante en español con 1.6 GB de RAM.',
        parameterCount: '1.5B',
        fileSizeMb: 1040,
        downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
        fileName: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
        tokenizerUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct/raw/main/tokenizer.json',
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
        downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        tokenizerUrl: 'https://huggingface.co/unsloth/Llama-3.2-1B-Instruct/raw/main/tokenizer.json',
        tokenizerFileName: 'Llama-3.2-1B-Instruct-Q4_K_M.json',
        recommendedMinRamMb: 1200,
        isDownloaded: false,
        downloadProgress: 0,
    },
    {
        id: 'gemma-2b-q4',
        name: 'Gemma 2B Instruct (Google)',
        description: 'Modelo 2B de Google optimizado para razonamiento táctico estándar.',
        parameterCount: '2.0B',
        fileSizeMb: 1600,
        downloadUrl: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
        fileName: 'gemma-2-2b-it-Q4_K_M.gguf',
        tokenizerUrl: 'https://huggingface.co/unsloth/gemma-2-2b-it/raw/main/tokenizer.json',
        tokenizerFileName: 'gemma-2-2b-it-Q4_K_M.json',
        recommendedMinRamMb: 2500,
        isDownloaded: false,
        downloadProgress: 0,
    },
    {
        id: 'phi-3-mini-q4',
        name: 'Phi-3 Mini 3.8B (Microsoft)',
        description: 'Modelo de 3.8B parámetros cuantizado en Q4 para dispositivos con 6GB+ de memoria RAM.',
        parameterCount: '3.8B',
        fileSizeMb: 2200,
        downloadUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
        fileName: 'Phi-3-mini-4k-instruct-q4.gguf',
        tokenizerUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct/raw/main/tokenizer.json',
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

    /** Checks persistent storage for installed models */
    public async checkLocalModelsStatus(): Promise<LocalModelMetaData[]> {
        if (typeof window === 'undefined') return Array.from(this.models.values());

        for (const [id, model] of this.models.entries()) {
            try {
                try {
                    const filePath = `models/${model.fileName}`;
                    const stat = await Filesystem.stat({
                        path: filePath,
                        directory: Directory.Data
                    });

                    if (stat && stat.size > 10 * 1024 * 1024) {
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
                    }
                } catch {
                    const isCached = localStorage.getItem(`red_model_${id}_ready`) === 'true';
                    if (isCached) {
                        model.isDownloaded = true;
                        model.downloadProgress = 100;
                        model.localPath = localStorage.getItem(`red_model_${id}_path`) || `models/${model.fileName}`;
                        this.ensureTokenizerDownloaded(id).catch(() => {});
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
            return m;
        }

        // Si no hay selección explícita, buscar el primer modelo descargado
        for (const m of this.models.values()) {
            if (m.isDownloaded) return m;
        }

        // Fallback a modelo ultraligero por defecto
        return this.models.get('qwen-2.5-0.5b-q4') || this.models.get('smollm-360m-q4') || null;
    }

    /** Sets the primary active model without forcing uninstalled defaults */
    public setActiveModel(modelId: string): void {
        const target = this.models.get(modelId);
        if (target) {
            if (typeof window !== 'undefined') {
                localStorage.setItem(`red_model_${modelId}_ready`, 'true');
                localStorage.setItem('red_active_model_id', modelId);
            }
            target.isDownloaded = true;
            this.ensureTokenizerDownloaded(modelId).catch(() => {});
            this.notify();
        }
    }

    /** Auto-sanación de Tokenizer: descarga tokenizer.json si falta para el modelo activo */
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
                if (stat && stat.size > 100) {
                    return true;
                }
            } catch {}

            console.log(`[ModelManager] Auto-descargando tokenizer.json para ${model.name}...`);
            
            const resp = await fetch(model.tokenizerUrl);
            if (resp.ok) {
                const text = await resp.text();
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
                console.log(`[ModelManager] ✅ Tokenizer sincronizado con éxito para ${model.name}`);
                return true;
            }
        } catch (e) {
            console.warn(`[ModelManager] Falló la auto-descarga de tokenizer para ${modelId}:`, e);
        }
        return false;
    }

    /** Downloads model with low RAM usage (2MB chunked writing to disk) + Tokenizer pairing */
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
            model.downloadProgress = 0;
            model.downloadedBytes = 0;

            try {
                await Filesystem.mkdir({
                    path: 'models',
                    directory: Directory.Data,
                    recursive: true
                });
            } catch {}

            const targetFilePath = `models/${model.fileName}`;

            let nativeSuccess = false;
            try {
                const progressListener = await Filesystem.addListener('progress', (status: any) => {
                    if (status.bytes) {
                        model.downloadedBytes = status.bytes;
                        const total = status.contentLength || (model.fileSizeMb * 1024 * 1024);
                        model.downloadProgress = Math.min(99, Math.round((status.bytes / total) * 100));
                        if (onProgress) {
                            onProgress(model.downloadProgress, model.downloadedBytes || 0, total);
                        }
                    }
                });

                const res = await Filesystem.downloadFile({
                    url: model.downloadUrl,
                    path: targetFilePath,
                    directory: Directory.Data,
                    progress: true
                });

                await progressListener.remove();
                if (res && res.path) {
                    nativeSuccess = true;
                }
            } catch (nativeErr) {
                console.warn('[ModelManager] DownloadFile nativo no disponible o falló en Web, intentando fetch stream:', nativeErr);
            }

            if (!nativeSuccess) {
                const response = await fetch(model.downloadUrl, {
                    signal: controller.signal,
                    mode: 'cors'
                });

                if (!response.ok || !response.body) {
                    throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
                }

                const contentLength = response.headers.get('Content-Length');
                const totalBytes = contentLength ? parseInt(contentLength, 10) : model.fileSizeMb * 1024 * 1024;
                let loadedBytes = 0;
                let chunkBuffer = new Uint8Array(0);
                const CHUNK_SIZE = 2 * 1024 * 1024;

                const reader = response.body.getReader();
                let isFirstWrite = true;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    loadedBytes += value.byteLength;
                    model.downloadedBytes = loadedBytes;

                    const merged = new Uint8Array(chunkBuffer.length + value.byteLength);
                    merged.set(chunkBuffer, 0);
                    merged.set(value, chunkBuffer.length);
                    chunkBuffer = merged;

                    if (chunkBuffer.length >= CHUNK_SIZE) {
                        const base64Data = uint8ArrayToBase64(chunkBuffer);
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
                        chunkBuffer = new Uint8Array(0);
                    }

                    const pct = Math.round((loadedBytes / totalBytes) * 100);
                    model.downloadProgress = Math.min(99, pct);

                    if (onProgress) {
                        onProgress(model.downloadProgress, loadedBytes, totalBytes);
                    }
                }

                if (chunkBuffer.length > 0) {
                    const u8 = new Uint8Array(chunkBuffer);
                    const base64Data = uint8ArrayToBase64(u8);
                    // Si isFirstWrite sigue en true, el modelo entero cabe en un solo chunk:
                    // se debe usar writeFile, no appendFile (que fallaría si el archivo no existe aún).
                    if (isFirstWrite) {
                        await Filesystem.writeFile({
                            path: targetFilePath,
                            data: base64Data,
                            directory: Directory.Data
                        });
                    } else {
                        await Filesystem.appendFile({
                            path: targetFilePath,
                            data: base64Data,
                            directory: Directory.Data
                        });
                    }
                }
            }

            await this.ensureTokenizerDownloaded(modelId);

            let localUri = `models/${model.fileName}`;
            try {
                const uriResult = await Filesystem.getUri({
                    path: targetFilePath,
                    directory: Directory.Data
                });
                localUri = uriResult.uri;
            } catch {}

            model.isDownloaded = true;
            model.downloadProgress = 100;
            model.localPath = localUri;

            if (typeof window !== 'undefined') {
                localStorage.setItem(`red_model_${modelId}_ready`, 'true');
                localStorage.setItem(`red_model_${modelId}_path`, localUri);
                localStorage.setItem('red_active_model_id', modelId);
            }

            this.activeDownloads.delete(modelId);
            console.log(`[ModelManager] Descarga real finalizada para ${model.name} en ${localUri}!`);
            return true;
        } catch (err: any) {
            this.activeDownloads.delete(modelId);
            if (err.name === 'AbortError') {
                console.log(`[ModelManager] Download canceled for ${modelId}`);
            } else {
                console.error(`[ModelManager] Download failed for ${modelId}:`, err);
            }
            model.downloadProgress = 0;
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

    /** Deletes a downloaded model and its tokenizer to free storage */
    public async deleteModel(modelId: string): Promise<boolean> {
        const model = this.models.get(modelId);
        if (!model) return false;

        try {
            const targetFilePath = `models/${model.fileName}`;
            try {
                await Filesystem.deleteFile({
                    path: targetFilePath,
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
        const headerSlice = file.slice(0, 4);
        const headerBuf = await headerSlice.arrayBuffer();
        const headerBytes = new Uint8Array(headerBuf);
        const isGguf = headerBytes[0] === 0x47 && headerBytes[1] === 0x47 && headerBytes[2] === 0x55 && headerBytes[3] === 0x46;
        if (!isGguf) {
            throw new Error('El archivo no tiene una cabecera GGUF válida.');
        }

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
}

export const ModelManager = new ModelManagerClass();
