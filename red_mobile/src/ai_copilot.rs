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
        let answer = format!("Consulta procesada por el motor de red RED: \"{}\"", req.prompt);
        let category = "Delegado Cliente IA".to_string();
        let execution_time_ms = start.elapsed().as_millis() as u64;

        CopilotResponse {
            answer,
            topic_category: category,
            source: "RED Rust Native Node".to_string(),
            execution_time_ms,
        }
    }
}
