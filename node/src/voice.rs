use chrono::Utc;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

pub use red_core::protocol::tactical::{SendVoiceBurstRequest, VoiceBurst};

#[derive(Clone)]
pub struct VoiceStore {
    bursts: Arc<RwLock<HashMap<String, Vec<VoiceBurst>>>>,
    db: Option<Arc<sled::Db>>,
}

impl VoiceStore {
    pub fn new(db: Option<Arc<sled::Db>>) -> Self {
        let store = Self {
            bursts: Arc::new(RwLock::new(HashMap::new())),
            db,
        };
        store.load_from_db();
        store
    }

    fn load_from_db(&self) {
        if let Some(db) = &self.db {
            if let Ok(tree) = db.open_tree("voice_bursts") {
                let mut map = self.bursts.write().unwrap_or_else(|e| e.into_inner());
                for item in tree.iter().flatten() {
                    if let Ok(burst) = serde_json::from_slice::<VoiceBurst>(&item.1) {
                        map.entry(burst.sender_did.clone()).or_default().push(burst);
                    }
                }
            }
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

        self.insert_raw_burst(burst.clone());
        burst
    }

    pub fn insert_raw_burst(&self, burst: VoiceBurst) {
        let sender_did = burst.sender_did.clone();
        let mut map = self.bursts.write().unwrap_or_else(|e| e.into_inner());
        let list = map.entry(sender_did).or_default();
        if !list.iter().any(|b| b.id == burst.id) {
            list.push(burst.clone());
            if list.len() > 100 {
                list.drain(0..list.len() - 100);
            }
            if let Some(db) = &self.db {
                if let Ok(tree) = db.open_tree("voice_bursts") {
                    if let Ok(bytes) = serde_json::to_vec(&burst) {
                        let _ = tree.insert(burst.id.as_bytes(), bytes);
                        let _ = db.flush();
                    }
                }
            }
        }
    }

    pub fn delete_burst(&self, id: &str) -> bool {
        let mut map = self.bursts.write().unwrap_or_else(|e| e.into_inner());
        let mut found = false;
        for list in map.values_mut() {
            if let Some(pos) = list.iter().position(|b| b.id == id) {
                list.remove(pos);
                found = true;
            }
        }
        if let Some(db) = &self.db {
            if let Ok(tree) = db.open_tree("voice_bursts") {
                let _ = tree.remove(id.as_bytes());
                let _ = db.flush();
            }
        }
        found
    }

    pub fn get_recent_bursts(&self, limit: usize) -> Vec<VoiceBurst> {
        let map = self.bursts.read().unwrap_or_else(|e| e.into_inner());
        let mut all: Vec<VoiceBurst> = map.values().flatten().cloned().collect();
        all.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        all.into_iter().take(limit).collect()
    }
}
