//! AI Copilot Engine — Native Rust Off-Grid Inference Coordinator
//!
//! Executes local tactical AI inference over GGUF models directly on the ARM64 processor 
//! without third-party web cloud dependencies.

use std::sync::{Arc, Mutex};
use std::path::Path;

pub use red_core::protocol::tactical::{CopilotQueryRequest, CopilotResponse};

/// Estado interno del Motor (Singleton para evitar recargar el GGUF)
pub struct AICopilotState {
    pub is_loaded: bool,
    pub active_model_path: String,
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
            })),
        }
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
        
        if model_path.is_empty() {
            return CopilotResponse {
                answer: "⚠️ [Error de Sistema de Archivos]: No se proporcionó la ruta del modelo GGUF. Por favor descarga los pesos del modelo en los ajustes de configuración de Gravity AI para iniciar la inferencia local.".to_string(),
                topic_category: "Error de Configuración".to_string(),
                source: "Rust Backend".to_string(),
                model_used: "None".to_string(),
                execution_time_ms: start.elapsed().as_millis() as u64,
            };
        }

        let path = Path::new(&model_path);
        if !path.exists() {
            let msg = format!("⚠️ [Error de Sistema de Archivos]: No se encontró el archivo GGUF en la ruta local: {}", model_path);
            return CopilotResponse {
                answer: msg,
                topic_category: "Error de I/O".to_string(),
                source: "Sistema de Archivos Rust".to_string(),
                model_used: model_name,
                execution_time_ms: start.elapsed().as_millis() as u64,
            };
        }

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

        // --- Inicio de Integración Real con Candle GGUF ---
        let mut st = state.lock().unwrap_or_else(|e| e.into_inner());
        if !st.is_loaded || st.active_model_path != model_path {
            st.is_loaded = true;
            st.active_model_path = model_path.clone();
        }
        
        // Liberamos el Mutex para no bloquear durante la inferencia larga
        drop(st);

        // Cargamos el modelo real
        let device = candle_core::Device::Cpu;
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

        enum LocalModel {
            Llama(candle_transformers::models::quantized_llama::ModelWeights),
            Qwen2(candle_transformers::models::quantized_qwen2::ModelWeights),
            Phi3(candle_transformers::models::quantized_phi3::ModelWeights),
        }

        impl LocalModel {
            fn forward(&mut self, input: &candle_core::Tensor, start_pos: usize) -> candle_core::Result<candle_core::Tensor> {
                match self {
                    LocalModel::Llama(m) => m.forward(input, start_pos),
                    LocalModel::Qwen2(m) => m.forward(input, start_pos),
                    LocalModel::Phi3(m) => m.forward(input, start_pos),
                }
            }
        }

        let model_name_lower = model_name.to_lowercase();
        let mut model = if model_name_lower.contains("qwen") {
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
        } else if model_name_lower.contains("phi") {
            // Phi-3 from_gguf requires an additional boolean argument, typically for `use_flash_attn` or `alibi` which we default to false.
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

        // Formateo de ChatML / Instruct formal según la arquitectura
        let formatted_prompt = if model_name_lower.contains("qwen") || model_name_lower.contains("smollm") {
            if let Some(ctx) = &req.context {
                format!(
                    "<|im_start|>system\nEres el Copiloto IA Soberano de RED, un asistente táctico de emergencia 100% offline. Utiliza el siguiente protocolo oficial cuando sea relevante: {}\nResponde en español de forma precisa, concisa y útil.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                    ctx, prompt
                )
            } else {
                format!(
                    "<|im_start|>system\nEres el Copiloto IA Soberano de RED, un asistente táctico de emergencia 100% offline. Responde en español de forma precisa, concisa y útil.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                    prompt
                )
            }
        } else if model_name_lower.contains("llama") {
            if let Some(ctx) = &req.context {
                format!(
                    "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nEres el Copiloto IA Soberano de RED. Protocolo táctico: {}\nResponde en español de forma directa.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
                    ctx, prompt
                )
            } else {
                format!(
                    "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nEres el Copiloto IA Soberano de RED. Responde en español de forma directa y concisa.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
                    prompt
                )
            }
        } else if model_name_lower.contains("phi") {
            if let Some(ctx) = &req.context {
                format!(
                    "<|system|>\nEres el Copiloto IA de RED. Protocolo táctico: {}\nResponde en español de forma concisa.<|end|>\n<|user|>\n{}<|end|>\n<|assistant|>\n",
                    ctx, prompt
                )
            } else {
                format!(
                    "<|system|>\nEres el Copiloto IA de RED. Responde en español de forma concisa.<|end|>\n<|user|>\n{}<|end|>\n<|assistant|>\n",
                    prompt
                )
            }
        } else {
            if let Some(ctx) = &req.context {
                format!(
                    "<|im_start|>system\nEres el Copiloto IA de RED. Protocolo: {}\nResponde en español.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                    ctx, prompt
                )
            } else {
                format!(
                    "<|im_start|>system\nEres el Copiloto IA de RED. Responde en español.<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                    prompt
                )
            }
        };

        // Buscamos un tokenizer adjunto
        let tokenizer_path = path.with_extension("").with_extension("json");
        let tokenizer_path_alt = path.parent().unwrap_or_else(|| std::path::Path::new(".")).join("tokenizer.json");
        
        let tokenizer_file = if tokenizer_path.exists() {
            Some(tokenizer_path)
        } else if tokenizer_path_alt.exists() {
            Some(tokenizer_path_alt)
        } else {
            None
        };

        let tokenizer = match tokenizer_file {
            Some(p) => match tokenizers::Tokenizer::from_file(p) {
                Ok(t) => t,
                Err(_) => return CopilotResponse {
                    answer: "⚠️ [Error]: tokenizer.json no válido.".to_string(),
                    topic_category: "Error Interno".to_string(),
                    source: "Tokenizers".to_string(),
                    model_used: model_name,
                    execution_time_ms: start.elapsed().as_millis() as u64,
                }
            },
            None => {
                return CopilotResponse {
                    answer: "⚠️ [Advertencia]: Falta el archivo tokenizer.json en el mismo directorio del modelo.".to_string(),
                    topic_category: "Error Interno".to_string(),
                    source: "Tokenizers".to_string(),
                    model_used: model_name,
                    execution_time_ms: start.elapsed().as_millis() as u64,
                }
            }
        };

        let mut tokens = match tokenizer.encode(formatted_prompt, true) {
            Ok(t) => t.get_ids().to_vec(),
            Err(e) => {
                return CopilotResponse {
                    answer: format!("⚠️ [Error]: Fallo al tokenizar: {}", e),
                    topic_category: "Error Interno".to_string(),
                    source: "Tokenizers".to_string(),
                    model_used: model_name,
                    execution_time_ms: start.elapsed().as_millis() as u64,
                }
            }
        };

        let mut logits_processor = candle_transformers::generation::LogitsProcessor::new(299792458, Some(0.7), Some(0.9));
        let mut generated_text = String::new();
        let max_tokens = 512; // Límite para respuestas completas

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

        let clean_answer = generated_text
            .replace("<|im_end|>", "")
            .replace("<|endoftext|>", "")
            .replace("</s>", "")
            .replace("<|end|>", "")
            .replace("<|eot_id|>", "")
            .trim()
            .to_string();

        CopilotResponse {
            answer: if clean_answer.is_empty() { "Inferencia completada sin texto.".to_string() } else { clean_answer },
            topic_category: "Inferencia Local GGUF".to_string(),
            source: "RED Motor Neural Rust (Candle)".to_string(),
            model_used: model_name,
            execution_time_ms: start.elapsed().as_millis() as u64,
        }
    }
}
