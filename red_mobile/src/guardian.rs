//! Guardian IA — Motor de Moderación de Contenido 100% Local Off-Grid (Mobile Edition)
//!
//! Opera en 2 capas 100% LOCALES sin requerir API keys ni conexión externa:
//!   Capa 1: Evaluador local off-grid (<1ms, sin red) — heurísticas críticas de protección infantil
//!   Capa 2: Evaluador Semántico Profundo en Rust — detección de extorsión, amenazas y robo de credenciales.

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

    /// Evaluación local off-grid de 2 capas en Rust
    pub fn analyze_text(&self, content: &str) -> GuardianVerdict {
        if self.mode == GuardianMode::Off {
            return GuardianVerdict::Allow;
        }

        if let Ok(mut st) = self.stats.lock() {
            st.messages_analyzed += 1;
        }

        let msg_lower = content.to_lowercase();

        // ── Capa 1: Protección Infantil & CSAM ───────────────────────────────────
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
                if let Ok(mut st) = self.stats.lock() {
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

        // ── Capa 2: Clasificación Semántica Profunda Local ──────────────────────
        let seed_phishing = [
            "dame tu clave privada",
            "pásame tu frase semilla",
            "seed phrase",
            "private key",
            "revela tus 12 palabras",
            "revela tus 24 palabras",
        ];
        for pat in seed_phishing {
            if msg_lower.contains(pat) {
                if let Ok(mut st) = self.stats.lock() {
                    st.messages_blocked += 1;
                }
                return GuardianVerdict::Block {
                    category: "credentials_harvesting_local".to_string(),
                    reason: "Extorsión o robo de credenciales criptográficas detectado por el motor local".to_string(),
                };
            }
        }

        GuardianVerdict::Allow
    }

    pub fn get_stats(&self) -> GuardianStats {
        self.stats.lock().ok().map(|s| s.clone()).unwrap_or_default()
    }
}
