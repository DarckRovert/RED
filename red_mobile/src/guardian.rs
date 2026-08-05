//! Guardian IA — Motor de Moderación de Contenido (Mobile Edition)
//!
//! Opera en 2 capas:
//!   Capa 1: Evaluador local off-grid (<1ms, sin red) — heurísticas críticas
//!   Capa 2: Sin API externa en mobile — fallback Allow si capa 1 no bloquea.
//!
//! Modelo de referencia: meta-llama/llama-guard-4-12b (Groq, si API key disponible)

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GuardianVerdict {
    Allow,
    Block { category: String, reason: String },
    FlagForReview { category: String, reason: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GuardianMode {
    Strict,
    Warn,
    Off,
}

impl GuardianMode {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "warn" => GuardianMode::Warn,
            "off" => GuardianMode::Off,
            _ => GuardianMode::Strict,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GuardianStats {
    pub messages_analyzed: u64,
    pub messages_blocked: u64,
    pub messages_flagged: u64,
    pub images_analyzed: u64,
    pub images_blocked: u64,
    pub api_calls_made: u64,
    pub api_errors: u64,
    pub cache_hits: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardianAnalyzeRequest {
    pub content: String,
    pub context_messages: Option<Vec<String>>,
}

pub struct GuardianEngine {
    pub mode: GuardianMode,
    pub stats: Arc<Mutex<GuardianStats>>,
}

impl GuardianEngine {
    pub fn new(mode: GuardianMode) -> Self {
        Self {
            mode,
            stats: Arc::new(Mutex::new(GuardianStats::default())),
        }
    }

    pub fn from_env() -> Self {
        let mode_str = std::env::var("GUARDIAN_MODE").unwrap_or_else(|_| "strict".to_string());
        Self::new(GuardianMode::from_str(&mode_str))
    }

    /// Capa 1: evaluación local off-grid — heurísticas de patrones críticos
    pub fn analyze_text(&self, content: &str) -> GuardianVerdict {
        if self.mode == GuardianMode::Off {
            return GuardianVerdict::Allow;
        }

        if let Some(mut st) = self.stats.lock().ok() {
            st.messages_analyzed += 1;
        }

        let msg_lower = content.to_lowercase();

        // Detección CSAM / explotación infantil / pornografía infantil
        let csam_direct_patterns = [
            "porno infantil",
            "pornografia infantil",
            "pornografía infantil",
            "cp_link",
            "pedof",
            "grooming",
            "abuso infantil",
            "explotacion infantil",
            "explotación infantil",
            "child abuse",
            "csam",
            "child porn",
        ];
        for pat in csam_direct_patterns {
            if msg_lower.contains(pat) {
                if let Some(mut st) = self.stats.lock().ok() {
                    st.messages_blocked += 1;
                }
                let verdict = GuardianVerdict::Block {
                    category: "child_exploitation_local".to_string(),
                    reason: "Contenido bloqueado por el filtro local de protección infantil"
                        .to_string(),
                };
                return if self.mode == GuardianMode::Warn {
                    GuardianVerdict::FlagForReview {
                        category: "child_exploitation_local".to_string(),
                        reason: "Flagged for review (warn mode)".to_string(),
                    }
                } else {
                    verdict
                };
            }
        }

        GuardianVerdict::Allow
    }

    pub fn get_stats(&self) -> GuardianStats {
        self.stats.lock().ok().map(|s| s.clone()).unwrap_or_default()
    }
}
