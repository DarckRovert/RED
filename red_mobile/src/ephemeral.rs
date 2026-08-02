use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EphemeralConfig {
    pub conversation_id: String,
    pub self_destruct_seconds: u32,
    pub burn_on_read: bool,
}

#[derive(Clone)]
pub struct EphemeralPurgeEngine {
    configs: Arc<RwLock<HashMap<String, EphemeralConfig>>>,
}

impl EphemeralPurgeEngine {
    pub fn new() -> Self {
        Self {
            configs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn set_config(&self, cfg: EphemeralConfig) {
        self.configs
            .write()
            .unwrap()
            .insert(cfg.conversation_id.clone(), cfg);
    }

    pub fn get_config(&self, conv_id: &str) -> Option<EphemeralConfig> {
        self.configs.read().unwrap().get(conv_id).cloned()
    }
}
