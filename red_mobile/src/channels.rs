use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelMessage {
    pub id: String,
    pub channel_id: String,
    pub sender_did: String,
    pub sender_name: String,
    pub content: String,
    pub timestamp: i64,
    pub hash: String,
    pub is_moderated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostChannelMessageRequest {
    pub channel_id: String,
    pub sender_name: String,
    pub content: String,
}

#[derive(Clone)]
pub struct ChannelStore {
    messages: Arc<RwLock<HashMap<String, Vec<ChannelMessage>>>>,
}

impl ChannelStore {
    pub fn new() -> Self {
        Self {
            messages: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn post_message(
        &self,
        sender_did: String,
        req: PostChannelMessageRequest,
    ) -> ChannelMessage {
        let timestamp = Utc::now().timestamp();
        let hash_input = format!(
            "{}:{}:{}:{}",
            req.channel_id, sender_did, req.content, timestamp
        );
        let hash = blake3::hash(hash_input.as_bytes()).to_hex().to_string();
        let id = format!("msg_{}", &hash[..12]);

        let msg = ChannelMessage {
            id,
            channel_id: req.channel_id.clone(),
            sender_did,
            sender_name: req.sender_name,
            content: req.content,
            timestamp,
            hash,
            is_moderated: true,
        };

        let mut map = self.messages.write().unwrap();
        map.entry(req.channel_id).or_default().push(msg.clone());
        msg
    }

    pub fn get_channel_messages(&self, channel_id: &str, limit: usize) -> Vec<ChannelMessage> {
        let map = self.messages.read().unwrap();
        if let Some(list) = map.get(channel_id) {
            let mut sorted = list.clone();
            sorted.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
            sorted.into_iter().take(limit).collect()
        } else {
            Vec::new()
        }
    }

    pub fn list_active_channels(&self) -> Vec<String> {
        let map = self.messages.read().unwrap();
        let mut keys: Vec<String> = map.keys().cloned().collect();
        if !keys.contains(&"red-local-general".to_string()) {
            keys.push("red-local-general".to_string());
        }
        if !keys.contains(&"red-emergency-lima".to_string()) {
            keys.push("red-emergency-lima".to_string());
        }
        keys
    }
}
