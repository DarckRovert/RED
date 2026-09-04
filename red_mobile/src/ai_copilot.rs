//! AI Copilot Engine — Native Rust Off-Grid Inference Coordinator
//!
//! Executes local tactical AI inference over GGUF models directly on the ARM64 processor 
//! without third-party web cloud dependencies.

use std::sync::{Arc, Mutex};
use std::path::{Path, PathBuf};

pub use red_core::protocol::tactical::{CopilotQueryRequest, CopilotResponse};

/// Modelos soportados cuantizados en CPU
pub enum LocalModel {
    Llama(candle_transformers::models::quantized_llama::ModelWeights),
    Qwen2(candle_transformers::models::quantized_qwen2::ModelWeights),
    Phi3(candle_transformers::models::quantized_phi3::ModelWeights),
}

impl LocalModel {
    pub fn forward(&mut self, input: &candle_core::Tensor, start_pos: usize) -> candle_core::Result<candle_core::Tensor> {
        match self {
            LocalModel::Llama(m) => m.forward(input, start_pos),
            LocalModel::Qwen2(m) => m.forward(input, start_pos),
            LocalModel::Phi3(m) => m.forward(input, start_pos),
        }
    }
}

/// Estado interno del Motor (Caché en RAM para reutilizar el modelo sin reabrir 390 MB de flash)
pub struct AICopilotState {
    pub is_loaded: bool,
    pub active_model_path: String,
    pub cached_model: Option<LocalModel>,
    pub cached_tokenizer: Option<tokenizers::Tokenizer>,
}

pub struct AICopilotEngine {
    state: Arc<Mutex<AICopilotState>>,
}

impl Default for AICopilotEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl AICopilotEngine {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(AICopilotState {
                is_loaded: false,
                active_model_path: String::new(),
                cached_model: None,
                cached_tokenizer: None,
            })),
        }
    }

    /// Proveedor global seguro para early-boot sin requerir ApiState completo
    pub fn global() -> Arc<Self> {
        static ENGINE: std::sync::OnceLock<Arc<AICopilotEngine>> = std::sync::OnceLock::new();
        ENGINE.get_or_init(|| Arc::new(AICopilotEngine::new())).clone()
    }

    /// Método asíncrono para que no bloquee el event loop de Tokio (P2P Mesh Network)
    pub async fn query_async(&self, req: CopilotQueryRequest) -> CopilotResponse {
        let state_clone = self.state.clone();
        
        // Delegamos la inferencia pesada a un hilo de CPU dedicado (spawn_blocking)
        // para asegurar que los pings de la red Mesh P2P no hagan timeout.
        let result = tokio::task::spawn_blocking(move || {
            Self::execute_inference(state_clone, req)
        }).await;

        match result {
            Ok(resp) => resp,
            Err(_) => CopilotResponse {
                answer: "⚠️ [Error Crítico]: El hilo de inferencia neuronal colapsó (Thread Panic).".to_string(),
                topic_category: "Error Interno".to_string(),
                source: "Motor Rust Fallback".to_string(),
                model_used: "Ninguno".to_string(),
                execution_time_ms: 0,
            }
        }
    }

    /// Método síncrono de compatibilidad (evitar usar directamente en el hilo principal)
    pub fn query(&self, req: CopilotQueryRequest) -> CopilotResponse {
        Self::execute_inference(self.state.clone(), req)
    }

    /// Ejecuta la inferencia real utilizando Candle
    fn execute_inference(state: Arc<Mutex<AICopilotState>>, req: CopilotQueryRequest) -> CopilotResponse {
        let start = std::time::Instant::now();
        let prompt = req.prompt.trim();
        let model_name = req.model_id.unwrap_or_else(|| "Desconocido".to_string());
        let model_path = req.model_path.unwrap_or_default();
        
        let clean_path = if model_path.starts_with("file://") {
            &model_path[7..]
        } else {
            &model_path
        };
        
        // Resolución del archivo GGUF: si la ruta no existe o viene vacía, autodetectar cualquier GGUF en disco
        let path_buf = if !clean_path.is_empty() && Path::new(clean_path).exists() {
            PathBuf::from(clean_path)
        } else {
            let candidate_dirs = [
                PathBuf::from("/data/user/0/f.red.app/files/models"),
                PathBuf::from("files/models"),
                PathBuf::from("models"),
            ];
            let mut found = None;
            for dir in &candidate_dirs {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("gguf") {
                            if let Ok(meta) = p.metadata() {
                                if meta.len() > 50_000_000 {
                                    found = Some(p);
                                    break;
                                }
                            }
                        }
                    }
                }
                if found.is_some() { break; }
            }
            match found {
                Some(p) => p,
                None => {
                    return CopilotResponse {
                        answer: "ℹ️ [Nodo RED]: No se detectó ningún archivo de modelo neural GGUF en el almacenamiento del dispositivo. Por favor ingresa a la pestaña 'Modelos Locales' y pulsa 'Descargar' para activar la inferencia offline en tu hardware.".to_string(),
                        topic_category: "Configuración de Modelo".to_string(),
                        source: "RED Sovereign Node (Rust)".to_string(),
                        model_used: if model_name.is_empty() || model_name == "Desconocido" { "red-tactical".to_string() } else { model_name },
                        execution_time_ms: start.elapsed().as_millis() as u64,
                    };
                }
            }
        };
        let path = path_buf.as_path();

        // --- Guarda de Memoria OOM: Previene que Android LMK mate el proceso ---
        if let Ok(meta) = std::fs::metadata(path) {
            const MAX_SAFE_MOBILE_MODEL_BYTES: u64 = 2_200_000_000; // ~2.2 GB límite de seguridad móvil
            if meta.len() > MAX_SAFE_MOBILE_MODEL_BYTES {
                return CopilotResponse {
                    answer: format!(
                        "⚠️ [Protección de Memoria OOM]: El modelo GGUF ({:.2} GB) supera el umbral seguro en terminales móviles (2.2 GB). Utiliza un modelo cuantizado ligero (ej. Qwen2.5-0.5B-Q4_K_M o SmolLM-135M) para garantizar estabilidad total sin consumir la RAM del sistema operativo.",
                        meta.len() as f64 / (1024.0 * 1024.0 * 1024.0)
                    ),
                    topic_category: "Protección OOM".to_string(),
                    source: "Candle Memory Guard".to_string(),
                    model_used: model_name,
                    execution_time_ms: start.elapsed().as_millis() as u64,
                };
            }
        }

        // --- Inicio de Integración con Caché en Memoria RAM ---
        let path_str = path.to_string_lossy().to_string();

        // 1. Intentar reutilizar modelo y tokenizer en RAM si ya están cargados para esta misma ruta
        let cached_opt = {
            let mut st = state.lock().unwrap_or_else(|e| e.into_inner());
            if st.active_model_path == path_str && st.cached_model.is_some() && st.cached_tokenizer.is_some() {
                let m = st.cached_model.take().unwrap();
                let t = st.cached_tokenizer.clone().unwrap();
                Some((m, t))
            } else {
                // Si la ruta cambió, liberar la memoria anterior para evitar sobreconsumo
                st.cached_model = None;
                st.cached_tokenizer = None;
                st.is_loaded = false;
                None
            }
        };

        let device = candle_core::Device::Cpu;

        let (mut model, tokenizer) = match cached_opt {
            Some(cached) => cached,
            None => {
                // --- Carga en frío desde almacenamiento local ---
                let mut file = match std::fs::File::open(path) {
                    Ok(f) => f,
                    Err(e) => {
                        return CopilotResponse {
                            answer: format!("⚠️ [Error]: No se pudo abrir GGUF: {}", e),
                            topic_category: "Error Interno".to_string(),
                            source: "Candle Engine".to_string(),
                            model_used: model_name,
                            execution_time_ms: start.elapsed().as_millis() as u64,
                        }
                    }
                };

                let content = match candle_core::quantized::gguf_file::Content::read(&mut file) {
                    Ok(c) => c,
                    Err(e) => {
                        return CopilotResponse {
                            answer: format!("⚠️ [Error]: Archivo GGUF corrupto o inválido: {}", e),
                            topic_category: "Error Interno".to_string(),
                            source: "Candle Engine".to_string(),
                            model_used: model_name,
                            execution_time_ms: start.elapsed().as_millis() as u64,
                        }
                    }
                };

                let model_name_lower = model_name.to_lowercase();
                let gguf_arch = content.metadata.get("general.architecture")
                    .and_then(|v| match v {
                        candle_core::quantized::gguf_file::Value::String(s) => Some(s.to_lowercase()),
                        _ => None,
                    })
                    .unwrap_or_default();
                let path_str_lower = path_str.to_lowercase();

                let is_qwen = gguf_arch.contains("qwen") || model_name_lower.contains("qwen") || path_str_lower.contains("qwen");
                let is_phi = gguf_arch.contains("phi") || model_name_lower.contains("phi") || path_str_lower.contains("phi");

                let loaded_model = if is_qwen {
                    match candle_transformers::models::quantized_qwen2::ModelWeights::from_gguf(content, &mut file, &device) {
                        Ok(m) => LocalModel::Qwen2(m),
                        Err(e) => {
                            return CopilotResponse {
                                answer: format!("⚠️ [Error]: Fallo al cargar pesos (posible OOM o arquitectura Qwen no válida): {}", e),
                                topic_category: "Error de Memoria/Arquitectura".to_string(),
                                source: "Candle Engine".to_string(),
                                model_used: model_name,
                                execution_time_ms: start.elapsed().as_millis() as u64,
                            }
                        }
                    }
                } else if is_phi {
                    match candle_transformers::models::quantized_phi3::ModelWeights::from_gguf(false, content, &mut file, &device) {
                        Ok(m) => LocalModel::Phi3(m),
                        Err(e) => {
                            return CopilotResponse {
                                answer: format!("⚠️ [Error]: Fallo al cargar pesos (posible OOM o arquitectura Phi3 no válida): {}", e),
                                topic_category: "Error de Memoria/Arquitectura".to_string(),
                                source: "Candle Engine".to_string(),
                                model_used: model_name,
                                execution_time_ms: start.elapsed().as_millis() as u64,
                            }
                        }
                    }
                } else if model_name_lower.contains("gemma") {
                    return CopilotResponse {
                        answer: "⚠️ [Advertencia]: La arquitectura Gemma cuantizada no está soportada por el motor nativo actual. Por favor selecciona Qwen, Llama o Phi-3.".to_string(),
                        topic_category: "Arquitectura No Soportada".to_string(),
                        source: "Candle Engine".to_string(),
                        model_used: model_name,
                        execution_time_ms: start.elapsed().as_millis() as u64,
                    }
                } else {
                    match candle_transformers::models::quantized_llama::ModelWeights::from_gguf(content, &mut file, &device) {
                        Ok(m) => LocalModel::Llama(m),
                        Err(e) => {
                            return CopilotResponse {
                                answer: format!("⚠️ [Error]: Fallo al cargar pesos (posible OOM o arquitectura no-Llama): {}", e),
                                topic_category: "Error de Memoria/Arquitectura".to_string(),
                                source: "Candle Engine".to_string(),
                                model_used: model_name,
                                execution_time_ms: start.elapsed().as_millis() as u64,
                            }
                        }
                    }
                };

                // Buscamos un tokenizer adjunto con resolución profunda de candidatos
                let parent_dir = path.parent().unwrap_or_else(|| std::path::Path::new("."));
                let mut candidates = vec![
                    path.with_extension("").with_extension("json"),
                    path.with_extension("json"),
                    parent_dir.join("tokenizer.json"),
                    parent_dir.join("qwen2.5-0.5b-instruct-q4_k_m.json"),
                    parent_dir.join("SmolLM2-360M-Instruct-Q4_K_M.json"),
                    parent_dir.join("qwen2.5-1.5b-instruct-q4_k_m.json"),
                    parent_dir.join("Llama-3.2-1B-Instruct-Q4_K_M.json"),
                    parent_dir.join("gemma-2-2b-it-Q4_K_M.json"),
                    parent_dir.join("Phi-3-mini-4k-instruct-q4.json"),
                ];

                if let Ok(entries) = std::fs::read_dir(parent_dir) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("json") {
                            if !candidates.contains(&p) {
                                candidates.push(p);
                            }
                        }
                    }
                }

                let mut tokenizer_opt = None;
                for c in &candidates {
                    if c.exists() {
                        if let Ok(meta) = std::fs::metadata(c) {
                            if meta.len() > 50_000 {
                                if let Ok(t) = tokenizers::Tokenizer::from_file(c) {
                                    tokenizer_opt = Some(t);
                                    break;
                                }
                            }
                        }
                    }
                }

                let loaded_tokenizer = match tokenizer_opt {
                    Some(t) => t,
                    None => {
                        return CopilotResponse {
                            answer: "⚠️ [Error de Tokenizer]: No se encontró un archivo tokenizer.json válido para el modelo en el almacenamiento local. Reintenta la descarga del modelo en la pestaña Modelos.".to_string(),
                            topic_category: "Error Interno".to_string(),
                            source: "Tokenizers".to_string(),
                            model_used: model_name,
                            execution_time_ms: start.elapsed().as_millis() as u64,
                        }
                    }
                };

                (loaded_model, loaded_tokenizer)
            }
        };

        let model_name_lower = model_name.to_lowercase();

        // Formateo de ChatML / Instruct formal según la arquitectura
        let formatted_prompt = if model_name_lower.contains("qwen") || model_name_lower.contains("smollm") {
            if let Some(ctx) = &req.context {
                format!(
                    "<|im_start|>system\nEres el Copiloto IA de RED OS, un asistente inteligente, empático y conversacional que opera 100% en el dispositivo sin internet. Conversa con fluidez, amabilidad y precisión en español sobre cualquier tema que plantee el operador. Si el siguiente protocolo oficial es relevante a la consulta, intégralo de forma natural: {}\nResponde de manera clara, amena y estructurada.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                    ctx, prompt
                )
            } else {
                format!(
                    "<|im_start|>system\nEres el Copiloto IA de RED OS, un asistente inteligente, empático y conversacional que opera 100% en el dispositivo sin internet. Conversa con fluidez, amabilidad y precisión en español sobre cualquier tema o consulta general que plantee el operador de manera clara y amena.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                    prompt
                )
            }
        } else if model_name_lower.contains("llama") {
            if let Some(ctx) = &req.context {
                format!(
                    "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nEres el Copiloto IA de RED OS, un asistente inteligente, empático y conversacional que opera 100% en el dispositivo sin internet. Conversa con fluidez y amabilidad en español sobre cualquier consulta. Protocolo de referencia: {}\nResponde de forma clara y amena.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
                    ctx, prompt
                )
            } else {
                format!(
                    "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nEres el Copiloto IA de RED OS, un asistente inteligente, empático y conversacional que opera 100% en el dispositivo sin internet. Conversa con fluidez, amabilidad y precisión en español de forma clara y amena.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
                    prompt
                )
            }
        } else if model_name_lower.contains("phi") {
            if let Some(ctx) = &req.context {
                format!(
                    "<|system|>\nEres el Copiloto IA de RED OS, un asistente inteligente y conversacional que opera 100% en el dispositivo. Conversa con fluidez y amabilidad en español. Protocolo táctico: {}\nResponde de forma clara y amena.<|end|>\n<|user|>\n{}<|end|>\n<|assistant|>\n",
                    ctx, prompt
                )
            } else {
                format!(
                    "<|system|>\nEres el Copiloto IA de RED OS, un asistente inteligente y conversacional que opera 100% en el dispositivo. Conversa con fluidez, amabilidad y precisión en español de forma amena.<|end|>\n<|user|>\n{}<|end|>\n<|assistant|>\n",
                    prompt
                )
            }
        } else {
            if let Some(ctx) = &req.context {
                format!(
                    "<|im_start|>system\nEres el Copiloto IA de RED OS, un asistente inteligente, empático y conversacional. Conversa con fluidez y amabilidad en español. Protocolo de apoyo: {}\nResponde de forma clara y amena.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                    ctx, prompt
                )
            } else {
                format!(
                    "<|im_start|>system\nEres el Copiloto IA de RED OS, un asistente inteligente, empático y conversacional que opera 100% en el dispositivo sin internet. Conversa con fluidez y amabilidad en español.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                    prompt
                )
            }
        };

        let mut tokens = match tokenizer.encode(formatted_prompt, true) {
            Ok(t) => t.get_ids().to_vec(),
            Err(e) => {
                return CopilotResponse {
                    answer: format!("⚠️ [Error]: Fallo al tokenizar el prompt: {}", e),
                    topic_category: "Error Interno".to_string(),
                    source: "Tokenizers".to_string(),
                    model_used: model_name,
                    execution_time_ms: start.elapsed().as_millis() as u64,
                }
            }
        };

        let initial_prompt_tokens_len = tokens.len();
        let mut logits_processor = candle_transformers::generation::LogitsProcessor::new(299792458, Some(0.7), Some(0.9));
        let mut generated_text = String::new();
        let max_tokens = 128; // Optimizado para respuestas tácticas ágiles en procesadores móviles ARM64 (4 a 8s)

        for index in 0..max_tokens {
            let context_size = if index > 0 { 1 } else { tokens.len() };
            let start_pos = tokens.len().saturating_sub(context_size);
            // SAFETY: Tensor ops can fail on malformed GGUF or OOM — never unwrap() at JNI boundary.
            let input = match candle_core::Tensor::new(&tokens[start_pos..], &device)
                .and_then(|t| t.unsqueeze(0))
            {
                Ok(t) => t,
                Err(e) => {
                    generated_text = format!("🔴 [Error de Tensor]: Fallo al construir el tensor de entrada: {}. Posible modelo GGUF corrupto o memoria insuficiente.", e);
                    break;
                }
            };

            let logits = match model.forward(&input, start_pos) {
                Ok(l) => l,
                Err(_) => break,
            };
            // SAFETY: squeeze() puede fallar si la forma del tensor es inesperada.
            let mut logits = match logits.squeeze(0).and_then(|l| l.squeeze(0)) {
                Ok(l) => l,
                Err(e) => {
                    generated_text = format!("🔴 [Error de Logits]: Fallo al extraer logits: {}.", e);
                    break;
                }
            };
            
            // Penalización de repetición ligera en los últimos 32 tokens
            if tokens.len() > 1 {
                let recent_tokens = &tokens[tokens.len().saturating_sub(32)..];
                logits = match candle_transformers::utils::apply_repeat_penalty(&logits, 1.15, recent_tokens) {
                    Ok(l) => l,
                    Err(_) => logits,
                };
            }

            let next_token = match logits_processor.sample(&logits) {
                Ok(t) => t,
                Err(_) => break,
            };

            // Interceptar Stop Tokens precisos según la arquitectura
            let is_stop = if model_name_lower.contains("qwen") || model_name_lower.contains("smollm") {
                next_token == 151645 || next_token == 151643
            } else if model_name_lower.contains("phi") {
                next_token == 32000 || next_token == 32001 || next_token == 32007
            } else {
                next_token == 128001 || next_token == 128009
            };

            if is_stop {
                break;
            }

            tokens.push(next_token);
            
            if let Ok(text) = tokenizer.decode(&[next_token], true) {
                generated_text.push_str(&text);
                if generated_text.contains("<|im_end|>") 
                    || generated_text.contains("<|endoftext|>") 
                    || generated_text.contains("</s>") 
                    || generated_text.contains("<|end|>") 
                    || generated_text.contains("<|eot_id|>") {
                    break;
                }
            }
        }

        // Decodificación atómica de la secuencia completa para preservar caracteres UTF-8 multibyte en español (tildes, ñ)
        let raw_answer = if let Ok(full_decoded) = tokenizer.decode(&tokens[initial_prompt_tokens_len..], true) {
            full_decoded
        } else {
            generated_text
        };

        let clean_answer = raw_answer
            .replace("<|im_end|>", "")
            .replace("<|endoftext|>", "")
            .replace("</s>", "")
            .replace("<|end|>", "")
            .replace("<|eot_id|>", "")
            .trim()
            .to_string();

        // Preservar la instancia en memoria RAM para inferencias instantáneas (0 ms I/O) en las siguientes consultas
        {
            let mut st = state.lock().unwrap_or_else(|e| e.into_inner());
            st.cached_model = Some(model);
            st.cached_tokenizer = Some(tokenizer);
            st.active_model_path = path_str;
            st.is_loaded = true;
        }

        CopilotResponse {
            answer: if clean_answer.is_empty() { "Inferencia completada sin texto.".to_string() } else { clean_answer },
            topic_category: "Inferencia Local GGUF".to_string(),
            source: "RED Motor Neural Rust (Candle)".to_string(),
            model_used: model_name,
            execution_time_ms: start.elapsed().as_millis() as u64,
        }
    }
}
