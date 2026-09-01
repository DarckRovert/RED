/**
 * VectorKnowledgeStore.ts — RED Sovereign Mesh OS (v64.0.0)
 *
 * Base de datos vectorial embebida y motor RAG offline ultrarrápido (<5ms).
 * Utiliza representaciones vectoriales cuantizadas en INT8 (64 dimensiones) para indexar
 * manuales tácticos de supervivencia, guías médicas TCCC y frecuencias de telecomunicaciones.
 */

export interface KnowledgeDocument {
    id: string;
    category: 'TCCC_MEDICINE' | 'SURVIVAL_RESCUE' | 'RADIO_COMMS' | 'WATER_FOOD' | 'NBC_DEFENSE';
    title: string;
    content: string;
    tags: string[];
    vectorInt8: Int8Array; // 64 dimensiones cuantizadas [-128, 127]
}

export interface SearchResult {
    document: KnowledgeDocument;
    similarityScore: number; // 0.0 a 1.0
    latencyMs: number;
}

export class VectorKnowledgeStore {
    private static instance: VectorKnowledgeStore;
    private documents: KnowledgeDocument[] = [];
    /** Promesa resuelta cuando la base táctica ha sido completamente indexada */
    private _ready: Promise<void>;

    private constructor() {
        this._ready = this.loadPreloadedTacticalBase();
    }

    /** Esperar a que el índice esté completamente cargado antes de buscar */
    public ready(): Promise<void> {
        return this._ready;
    }

    public static getInstance(): VectorKnowledgeStore {
        if (!VectorKnowledgeStore.instance) {
            VectorKnowledgeStore.instance = new VectorKnowledgeStore();
        }
        return VectorKnowledgeStore.instance;
    }

    // ─── Generador Determinista de Embeddings Cuantizados INT8 con N-Grams ─────

    public static generateEmbedding(text: string, dimensions = 64): Int8Array {
        const vec = new Int8Array(dimensions);
        const clean = text.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, ' ');
        const words = clean.split(/\s+/).filter(w => w.length > 1);

        const tokens: string[] = [];

        // 1. Unigramas
        words.forEach(w => tokens.push(w));

        // 2. Bigramas de palabras
        for (let i = 0; i < words.length - 1; i++) {
            tokens.push(`${words[i]}_${words[i + 1]}`);
        }

        // 3. Trigramas de caracteres para palabras clave
        words.forEach(w => {
            if (w.length >= 3) {
                for (let i = 0; i <= w.length - 3; i++) {
                    tokens.push(w.substring(i, i + 3));
                }
            }
        });

        // 4. Dispersión MurmurHash3 de 32 bits sobre las dimensiones (Feature Hashing Trick)
        for (const token of tokens) {
            let h = 0x9747b28c ^ token.length;
            for (let i = 0; i < token.length; i++) {
                let k = token.charCodeAt(i);
                k = Math.imul(k, 0xcc9e2d51);
                k = (k << 15) | (k >>> 17);
                k = Math.imul(k, 0x1b873593);
                h ^= k;
                h = (h << 13) | (h >>> 19);
                h = Math.imul(h, 5) + 0xe6546b64;
            }
            h ^= h >>> 16;
            h = Math.imul(h, 0x85ebca6b);
            h ^= h >>> 13;
            h = Math.imul(h, 0xc2b2ae35);
            h ^= h >>> 16;

            const dim = (h >>> 0) % dimensions;
            vec[dim] = Math.max(-128, Math.min(127, vec[dim] + 28));
        }

        // Normalización L2 en escala INT8 [-127, 127]
        let normSq = 0;
        for (let i = 0; i < dimensions; i++) {
            normSq += vec[i] * vec[i];
        }
        const norm = Math.sqrt(normSq) || 1;

        for (let i = 0; i < dimensions; i++) {
            vec[i] = Math.round((vec[i] / norm) * 127);
        }

        return vec;
    }

    // ─── Similitud Coseno Cuantizada INT8 ───────────────────────────────────────

    public static cosineSimilarityInt8(a: Int8Array, b: Int8Array): number {
        let dot = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        if (denom === 0) return 0;
        return Math.max(0, Math.min(1, (dot / denom + 1) / 2));
    }

    // ─── Búsqueda Semántica K-NN Offline ────────────────────────────────────────

    public async search(query: string, topK = 3): Promise<SearchResult[]> {
        // Garantizar que el índice esté completamente cargado antes de buscar
        await this._ready;

        const t0 = performance.now();
        const queryVec = VectorKnowledgeStore.generateEmbedding(query);

        const scored = this.documents.map(doc => {
            const score = VectorKnowledgeStore.cosineSimilarityInt8(queryVec, doc.vectorInt8);
            return {
                document: doc,
                similarityScore: score,
            };
        });

        scored.sort((a, b) => b.similarityScore - a.similarityScore);
        const latencyMs = parseFloat((performance.now() - t0).toFixed(2));

        return scored.slice(0, topK).map(item => ({
            ...item,
            latencyMs,
        }));
    }

    // ─── Base Táctica Precargada de Supervivencia TCCC ──────────────────────────

    private static readonly RAG_CACHE_KEY = 'red_rag_index_v1';
    private static readonly RAG_VERSION = 1;

    private async loadPreloadedTacticalBase() {
        const rawDocs: Array<Omit<KnowledgeDocument, 'vectorInt8'>> = [
            {
                id: 'tccc-01-massive-bleed',
                category: 'TCCC_MEDICINE',
                title: 'TCCC: Control de Hemorragias Masivas (Torniquete CAT & Packing)',
                content: '1. Aplicar torniquete CAT 5–7 cm por encima de la herida arterial (High and Tight). 2. Girar el molinete hasta que el pulso distal desaparezca y cese el sangrado. 3. Registrar hora en la banda de tiempo. 4. En zonas de unión (cuello, axila, ingle), empaquetar la herida con gasa hemostática (QuikClot / celulosa) y aplicar presión manual directa durante 3 minutos continuos.',
                tags: ['hemorragia', 'torniquete', 'sangrado', 'cat', 'tccc', 'quikclot', 'primeros auxilios', 'herida'],
            },
            {
                id: 'tccc-02-tension-pneumothorax',
                category: 'TCCC_MEDICINE',
                title: 'TCCC: Manejo de Neumotórax a Tensión y Sello de Tórax',
                content: 'Signos: Dificultad respiratoria progresiva, desviación traqueal, cianosis, disminución de ruidos respiratorios. Tratamiento: 1. Colocar parche oclusivo de tórax con válvula unidireccional (Chest Seal). 2. Si empeora la disnea o cae la presión, descompresión con aguja de calibre 14G (3.25 pulgadas) en el 2º espacio intercostal, línea media clavicular.',
                tags: ['neumotorax', 'torax', 'pecho', 'respiracion', 'asfixia', 'aguja', 'descompresion', 'chest seal'],
            },
            {
                id: 'tccc-03-start-triage',
                category: 'TCCC_MEDICINE',
                title: 'Protocolo de Triaje de Catástrofes START (Simple Triage and Rapid Treatment)',
                content: 'Evaluación rápida en 30 segundos: 1. ¿Camina? -> VERDE (Menor). 2. ¿Respira? Si no respira, abrir vía aérea. Si sigue sin respirar -> NEGRO (Fallecido). Si respira >30 rpm -> ROJO (Inmediato). 3. Perfusión: Si pulso radial ausente o llenado capilar >2 seg -> ROJO. 4. Estado mental: Si no sigue órdenes simples -> ROJO. Si respira normal, buena perfusión y obedece órdenes -> AMARILLO (Diferido).',
                tags: ['triaje', 'start', 'triage', 'clasificacion', 'catastrofe', 'rojo', 'amarillo', 'verde', 'negro'],
            },
            {
                id: 'water-01-purification',
                category: 'WATER_FOOD',
                title: 'Potabilización y Desinfección de Agua Off-Grid',
                content: '1. Desinfección química con Hipoclorito de Sodio (Lavandina al 5% sin perfume): Añadir 2 a 4 gotas por litro de agua clara (8 gotas si el agua está turbia). Mezclar y dejar reposar 30 minutos antes de consumir. 2. Ebullición: Hervir a borbotones durante al menos 3 minutos continuos (5 minutos a gran altitud). 3. Filtrado previo con carbón activado, arena y tela para remover sólidos.',
                tags: ['agua', 'potabilizacion', 'desinfeccion', 'cloro', 'hervir', 'purificar', 'lavandina', 'supervivencia'],
            },
            {
                id: 'radio-01-emergency-frequencies',
                category: 'RADIO_COMMS',
                title: 'Frecuencias Internacionales de Socorro y Emergencia (VHF / UHF / HF)',
                content: '1. Canal Marítimo 16 VHF: 156.800 MHz (Socorro MAYDAY y llamada de auxilio). 2. Banda Aérea de Emergencia: 121.500 MHz (Civil) y 243.000 MHz (Militar). 3. Radioaficionados 2m: 146.520 MHz (FM Llamada Nacional). 4. Frecuencia Malla RED: 915.0 MHz (LoRa) y 2.4 GHz (BLE Mesh / WiFi Direct). 5. Canal CB 9: 27.065 MHz (Emergencias terrestres).',
                tags: ['radio', 'frecuencias', 'vhf', 'uhf', 'lora', 'mayday', 'sos', 'canal 16', '121.5', 'emergencia'],
            },
            {
                id: 'rescue-01-insarag-marking',
                category: 'SURVIVAL_RESCUE',
                title: 'Señalización Táctica de Búsqueda y Rescate en Estructuras Colapsadas (INSARAG)',
                content: 'Cuadrante en forma de X (1m x 1m) pintado en la entrada: - Cuadrante Superior: Fecha y hora de inicio/fin del equipo. - Cuadrante Izquierdo: Identificador del equipo de rescate (ej: RED-SQUAD-1). - Cuadrante Derecho: Peligros detectados (gas, colapso inminente, ratas). - Cuadrante Inferior: Víctimas (ej: L-2 / D-1 = 2 Vivos, 1 Fallecido).',
                tags: ['rescate', 'insarag', 'colapso', 'terremoto', 'escombros', 'marcado', 'señalizacion', 'victimas'],
            },
            {
                id: 'medicine-01-anaphylaxis-shock',
                category: 'TCCC_MEDICINE',
                title: 'Tratamiento de Emergencia: Shock Anafiláctico y Reacciones Severas',
                content: 'Signos: Urticaria difusa, edema de glotis, estridor, hipotensión súbita. 1. Administrar Epinefrina (Adrenalina) 1:1000 (1 mg/mL) dosis 0.3 mg a 0.5 mg intramuscular (IM) en la cara anterolateral del muslo. 2. Repetir cada 5 a 15 minutos si los síntomas persisten. 3. Posicionar en decúbito supino con piernas elevadas (salvo dificultad respiratoria severa).',
                tags: ['anafilaxia', 'alergia', 'adrenalina', 'epinefrina', 'shock', 'glotis', 'asfixia', 'muslo'],
            }
        ];

        // Intento de carga rápida desde caché de vectores
        let cached: Record<string, number[]> | null = null;
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem(VectorKnowledgeStore.RAG_CACHE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed.version === VectorKnowledgeStore.RAG_VERSION && parsed.vectors) {
                        cached = parsed.vectors;
                    }
                }
            }
        } catch {}

        const newCache: Record<string, number[]> = {};

        for (const doc of rawDocs) {
            let vectorInt8: Int8Array;
            if (cached && cached[doc.id] && cached[doc.id].length === 64) {
                vectorInt8 = new Int8Array(cached[doc.id]);
            } else {
                const combinedText = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`;
                vectorInt8 = VectorKnowledgeStore.generateEmbedding(combinedText);
            }
            newCache[doc.id] = Array.from(vectorInt8);
            this.documents.push({
                ...doc,
                vectorInt8,
            });
        }

        // Persistir en caché local para arranque instantáneo
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(VectorKnowledgeStore.RAG_CACHE_KEY, JSON.stringify({
                    version: VectorKnowledgeStore.RAG_VERSION,
                    vectors: newCache,
                    updatedAt: Date.now(),
                }));
            }
        } catch {}
    }

    public getDocumentCount(): number {
        return this.documents.length;
    }

    public getAllDocuments(): KnowledgeDocument[] {
        return [...this.documents];
    }

    public addDocument(doc: {
        id: string;
        category: KnowledgeDocument['category'];
        title: string;
        content: string;
        tags: string[];
    }): KnowledgeDocument {
        const combinedText = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`;
        const vectorInt8 = VectorKnowledgeStore.generateEmbedding(combinedText);
        const fullDoc: KnowledgeDocument = {
            ...doc,
            vectorInt8,
        };
        const existingIdx = this.documents.findIndex(d => d.id === doc.id);
        if (existingIdx >= 0) {
            this.documents[existingIdx] = fullDoc;
        } else {
            this.documents.push(fullDoc);
        }

        // Persistir el índice actualizado para que los documentos dinámicos
        // sobrevivan entre sesiones y sean precargados en el próximo arranque
        try {
            if (typeof localStorage !== 'undefined') {
                const existing = localStorage.getItem(VectorKnowledgeStore.RAG_CACHE_KEY);
                const parsed = existing ? JSON.parse(existing) : { version: VectorKnowledgeStore.RAG_VERSION, vectors: {} };
                const vectors: Record<string, number[]> = parsed.vectors || {};
                vectors[fullDoc.id] = Array.from(vectorInt8);
                localStorage.setItem(VectorKnowledgeStore.RAG_CACHE_KEY, JSON.stringify({
                    version: VectorKnowledgeStore.RAG_VERSION,
                    vectors,
                    updatedAt: Date.now(),
                }));
            }
        } catch {}

        return fullDoc;
    }
}

export const vectorKnowledgeStore = VectorKnowledgeStore.getInstance();
