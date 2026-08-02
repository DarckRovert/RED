use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslateRequest {
    pub text: String,
    pub target_language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslateResponse {
    pub original_text: String,
    pub translated_text: String,
    pub target_language: String,
    pub execution_time_ms: u64,
}

pub struct AITranslatorEngine;

impl AITranslatorEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn translate(&self, req: TranslateRequest) -> TranslateResponse {
        let start = std::time::Instant::now();
        let text = req.text.trim();

        let translated_text = match req.target_language.to_lowercase().as_str() {
            "en" => format!("[AI Translated to EN]: {}", text),
            "qu" => format!("[AI Translated to Quechua]: Allinllachu - {}", text),
            _ => format!("[AI Translated to ES]: {}", text),
        };

        let execution_time_ms = start.elapsed().as_millis() as u64;

        TranslateResponse {
            original_text: req.text,
            translated_text,
            target_language: req.target_language,
            execution_time_ms,
        }
    }
}
