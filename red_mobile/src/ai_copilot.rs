use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotQueryRequest {
    pub prompt: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotResponse {
    pub answer: String,
    pub topic_category: String,
    pub source: String,
    pub execution_time_ms: u64,
}

pub struct AICopilotEngine;

impl AICopilotEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn query(&self, req: CopilotQueryRequest) -> CopilotResponse {
        let start = std::time::Instant::now();
        let answer = format!(
            "🤖 MOTOR NATIVO RED RUST (ONNX WASM Delegate)\n\n\
            Consulta recibida: \"{}\"\n\n\
            La inferencia neuronal completa se ejecuta en vivo mediante el motor cliente WASM ONNX LaMini-Flan-T5 preinstalado en el dispositivo sin conexion a internet.",
            req.prompt
        );
        let category = "Inferencia Neuronal Rust Native".to_string();
        let execution_time_ms = start.elapsed().as_millis() as u64;

        CopilotResponse {
            answer,
            topic_category: category,
            source: "RED Rust Native WASM Engine".to_string(),
            execution_time_ms,
        }
    }
}
