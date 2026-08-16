//! AI Copilot Engine — Native Rust Off-Grid Inference Coordinator (Node)
//!
//! Executes local tactical AI inference over GGUF models directly on the ARM64/x86_64 processor 
//! without third-party web cloud dependencies.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::path::Path;

use anyhow::{Result, Context as _};
use candle_core::{Device, Tensor};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotQueryRequest {
    pub prompt: String,
    pub context: Option<String>,
    pub model_path: Option<String>,
    pub model_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotResponse {
    pub answer: String,
    pub topic_category: String,
    pub source: String,
    pub model_used: String,
    pub execution_time_ms: u64,
}

/// Estado interno del Motor (Singleton para evitar recargar el GGUF)
pub struct AICopilotState {
    pub is_loaded: bool,
    pub active_model_path: String,
}

pub struct AICopilotEngine {
    state: Arc<Mutex<AICopilotState>>,
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

        // --- Inicio de Integración Real con Candle GGUF ---
        let mut st = state.lock().unwrap();
        if !st.is_loaded || st.active_model_path != model_path {
            st.is_loaded = true;
            st.active_model_path = model_path.clone();
        }
        
        // Liberamos el Mutex para no bloquear durante la inferencia larga
        drop(st);

        // Cargamos el modelo real
        let device = Device::Cpu;
        let mut file = match std::fs::File::open(&path) {
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

        let mut model = match candle_transformers::models::quantized_llama::ModelWeights::from_gguf(content, &mut file, &device) {
            Ok(m) => m,
            Err(e) => {
                return CopilotResponse {
                    answer: format!("⚠️ [Error]: Fallo al cargar pesos (posible OOM o arquitectura no-Llama): {}", e),
                    topic_category: "Error de Memoria/Arquitectura".to_string(),
                    source: "Candle Engine".to_string(),
                    model_used: model_name,
                    execution_time_ms: start.elapsed().as_millis() as u64,
                }
            }
        };

        // Buscamos un tokenizer adjunto con resolución profunda de candidatos
        let parent_dir = path.parent().unwrap_or(Path::new("."));
        let mut candidates = vec![
            path.with_extension("").with_extension("json"), // Llama-3.2-1B-Instruct-Q4_K_M.json
            path.with_extension("json"),                    // Llama-3.2-1B-Instruct-Q4_K_M.gguf.json
            parent_dir.join("tokenizer.json"),              // models/tokenizer.json
            parent_dir.join("Llama-3.2-1B-Instruct-Q4_K_M.json"),
            parent_dir.join("qwen2.5-1.5b-instruct-q4_k_m.json"),
            parent_dir.join("gemma-2-2b-it-Q4_K_M.json"),
            parent_dir.join("Phi-3-mini-4k-instruct-q4.json"),
        ];

        // Si existe algún .json en el directorio que cargue como Tokenizer, agregarlo como fallback
        if let Ok(entries) = std::fs::read_dir(parent_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.extension().and_then(|e| e.to_str()) == Some("json") && !candidates.contains(&p) {
                    candidates.push(p);
                }
            }
        }

        let mut loaded_tokenizer = None;
        for cand in candidates {
            if cand.exists() {
                if let Ok(tok) = tokenizers::Tokenizer::from_file(&cand) {
                    loaded_tokenizer = Some(tok);
                    break;
                }
            }
        }

        let tokenizer = match loaded_tokenizer {
            Some(t) => t,
            None => {
                return CopilotResponse {
                    answer: "⚠️ [Advertencia]: Falta el archivo tokenizer.json en el mismo directorio del modelo.".to_string(),
                    topic_category: "Tokenizer No Encontrado".to_string(),
                    source: "Tokenizers".to_string(),
                    model_used: model_name,
                    execution_time_ms: start.elapsed().as_millis() as u64,
                };
            }
        };

        let mut tokens = match tokenizer.encode(prompt.to_string(), true) {
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

        let mut logits_processor = candle_transformers::generation::LogitsProcessor::new(299792458, None, None);
        let mut generated_text = String::new();
        let max_tokens = 256; // Límite seguro para móvil

        for index in 0..max_tokens {
            let context_size = if index > 0 { 1 } else { tokens.len() };
            let start_pos = tokens.len().saturating_sub(context_size);
            let input = Tensor::new(&tokens[start_pos..], &device).unwrap().unsqueeze(0).unwrap();
            
            let logits = match model.forward(&input, start_pos) {
                Ok(l) => l,
                Err(_) => break, // Fallo de inferencia, detenemos
            };
            let logits = logits.squeeze(0).unwrap().squeeze(0).unwrap();
            
            let next_token = logits_processor.sample(&logits).unwrap();
            tokens.push(next_token);
            
            if let Some(text) = tokenizer.decode(&[next_token], true).ok() {
                generated_text.push_str(&text);
            }
        }

        CopilotResponse {
            answer: generated_text.trim().to_string(),
            topic_category: "Inferencia Local GGUF".to_string(),
            source: "RED Motor Neural Rust (Candle)".to_string(),
            model_used: model_name,
            execution_time_ms: start.elapsed().as_millis() as u64,
        }
    }
}
