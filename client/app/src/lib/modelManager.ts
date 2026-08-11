import { Filesystem, Directory } from '@capacitor/filesystem';

export interface LocalModelMetaData {
    id: string;
    name: string;
    description: string;
    parameterCount: string;
    fileSizeMb: number;
    downloadUrl: string;
    fileName: string;
    recommendedMinRamMb: number;
    isDownloaded: boolean;
    downloadProgress: number; // 0 - 100
    localPath?: string;
    downloadedBytes?: number;
}

export const SUPPORTED_MODELS: LocalModelMetaData[] = [
    {
        id: 'qwen-2.5-1.5b-q4',
        name: 'Qwen 2.5 1.5B Instruct (Alibaba)',
        description: '🌟 RECOMENDADO PARA MÓVILES. El modelo sub-2B más inteligente del mundo. Razonamiento táctico brillante en español con solo 1.6 GB de RAM.',
        parameterCount: '1.5B',
        fileSizeMb: 1040,
        downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
        fileName: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
        recommendedMinRamMb: 1600,
        isDownloaded: false,
        downloadProgress: 0,
    },
    {
        id: 'llama-3.2-1b-q4',
        name: 'Llama 3.2 1B Instruct (Meta)',
        description: '⚡ ULTRA-RÁPIDO. Modelo oficial 1B de Meta optimizado para velocidad extrema en procesadores ARM64 móviles (1.2 GB RAM).',
        parameterCount: '1.0B',
        fileSizeMb: 770,
        downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
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
        recommendedMinRamMb: 3500,
        isDownloaded: false,
        downloadProgress: 0,
    }
];

// Helper to convert Uint8Array chunk to base64 string safely
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

    constructor() {
        SUPPORTED_MODELS.forEach(m => this.models.set(m.id, { ...m }));
        this.checkLocalModelsStatus();
    }

    /** Checks persistent storage for installed models */
    public async checkLocalModelsStatus(): Promise<LocalModelMetaData[]> {
        if (typeof window === 'undefined') return Array.from(this.models.values());

        for (const [id, model] of this.models.entries()) {
            try {
                // Check physical file via Capacitor Filesystem
                try {
                    const filePath = `models/${model.fileName}`;
                    const stat = await Filesystem.stat({
                        path: filePath,
                        directory: Directory.Data
                    });

                    if (stat && stat.size > 10 * 1024 * 1024) { // Valid GGUF file > 10MB
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
                        continue;
                    }
                } catch {
                    // Fallback to localStorage flag if Filesystem plugin is not ready
                    const isCached = localStorage.getItem(`red_model_${id}_ready`) === 'true';
                    if (isCached) {
                        model.isDownloaded = true;
                        model.downloadProgress = 100;
                        model.localPath = localStorage.getItem(`red_model_${id}_path`) || `models/${model.fileName}`;
                    }
                }
            } catch (e) {
                console.warn('[ModelManager] Cache check failed for', id, e);
            }
        }
        return Array.from(this.models.values());
    }

    /** Returns all available models */
    public getModels(): LocalModelMetaData[] {
        return Array.from(this.models.values());
    }

    /** Returns metadata of active high-capacity model (only if downloaded) */
    public getActiveModel(): LocalModelMetaData | null {
        if (typeof window !== 'undefined') {
            const activeId = localStorage.getItem('red_active_model_id');
            if (activeId && this.models.has(activeId)) {
                const m = this.models.get(activeId)!;
                if (m.isDownloaded) return m;
            }
        }
        for (const m of this.models.values()) {
            if (m.isDownloaded) return m;
        }
        return null;
    }

    /** Sets the primary active model */
    public setActiveModel(modelId: string): void {
        const target = this.models.get(modelId);
        if (target) {
            target.isDownloaded = true;
            if (typeof window !== 'undefined') {
                localStorage.setItem(`red_model_${modelId}_ready`, 'true');
                localStorage.setItem('red_active_model_id', modelId);
            }
        }
    }

    /** Downloads model with low RAM usage (2MB chunked writing to disk) */
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

            // Ensure models directory exists
            try {
                await Filesystem.mkdir({
                    path: 'models',
                    directory: Directory.Data,
                    recursive: true
                });
            } catch {}

            const targetFilePath = `models/${model.fileName}`;

            // 1. Intentar descarga nativa multihilo mediante Filesystem.downloadFile (Bypasses CORS en Android)
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

            // 2. Si es entorno Web SPA, utilizar streaming real por Fetch (sin simulaciones)
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

                    // High-performance typed buffer concatenation
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
                    await Filesystem.appendFile({
                        path: targetFilePath,
                        data: base64Data,
                        directory: Directory.Data
                    });
                }
            }

            // Confirmación de ruta URI física final en disco
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
}

export const ModelManager = new ModelManagerClass();
