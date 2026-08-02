use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceBurst {
    pub id: String,
    pub sender_did: String,
    pub sender_name: String,
    pub duration_seconds: f32,
    pub audio_opus_b64: String,
    pub timestamp: i64,
    pub sample_rate: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendVoiceBurstRequest {
    pub sender_name: String,
    pub duration_seconds: f32,
    pub audio_opus_b64: String,
    pub sample_rate: Option<u32>,
}

#[derive(Clone)]
pub struct VoiceStore {
    bursts: Arc<RwLock<HashMap<String, Vec<VoiceBurst>>>>,
}

impl VoiceStore {
    pub fn new() -> Self {
        Self {
            bursts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn add_burst(&self, sender_did: String, req: SendVoiceBurstRequest) -> VoiceBurst {
        let timestamp = Utc::now().timestamp();
        let id = format!(
            "voice_{}_{}",
            timestamp,
            &sender_did[..8.min(sender_did.len())]
        );

        let burst = VoiceBurst {
            id,
            sender_did: sender_did.clone(),
            sender_name: req.sender_name,
            duration_seconds: req.duration_seconds,
            audio_opus_b64: req.audio_opus_b64,
            timestamp,
            sample_rate: req.sample_rate.unwrap_or(16000),
        };

        let mut map = self.bursts.write().unwrap();
        map.entry(sender_did).or_default().push(burst.clone());

        burst
    }

    pub fn get_recent_bursts(&self, limit: usize) -> Vec<VoiceBurst> {
        let map = self.bursts.read().unwrap();
        let mut all: Vec<VoiceBurst> = map.values().flatten().cloned().collect();
        all.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        all.into_iter().take(limit).collect()
    }
}
