use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProximityNode {
    pub identity_hash: String,
    pub display_name: String,
    pub rssi_dbm: i32,
    pub distance_meters: f32,
    pub transport: String,
    pub last_seen: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveHandshakeRequest {
    pub target_identity_hash: String,
    pub greeting_message: Option<String>,
}

#[derive(Clone)]
pub struct DiscoveryEngine {
    nearby_nodes: Arc<RwLock<HashMap<String, ProximityNode>>>,
}

impl DiscoveryEngine {
    pub fn new() -> Self {
        let engine = Self {
            nearby_nodes: Arc::new(RwLock::new(HashMap::new())),
        };
        engine.seed_demo_nodes();
        engine
    }

    fn seed_demo_nodes(&self) {
        let mut map = self.nearby_nodes.write().unwrap();
        map.insert(
            "node_nearby_alice".to_string(),
            ProximityNode {
                identity_hash: "3f7a8291c4e2".to_string(),
                display_name: "Alice (BLE Proximity)".to_string(),
                rssi_dbm: -58,
                distance_meters: 2.4,
                transport: "BLE".to_string(),
                last_seen: chrono::Utc::now().timestamp(),
            },
        );
        map.insert(
            "node_nearby_bob".to_string(),
            ProximityNode {
                identity_hash: "9b12c3e4a5f6".to_string(),
                display_name: "Bob (WiFi Direct)".to_string(),
                rssi_dbm: -64,
                distance_meters: 4.1,
                transport: "WiFi-Direct".to_string(),
                last_seen: chrono::Utc::now().timestamp(),
            },
        );
    }

    pub fn get_proximity_nodes(&self) -> Vec<ProximityNode> {
        let map = self.nearby_nodes.read().unwrap();
        map.values().cloned().collect()
    }

    pub fn trigger_wave(&self, req: WaveHandshakeRequest) -> ProximityNode {
        let timestamp = chrono::Utc::now().timestamp();
        ProximityNode {
            identity_hash: req.target_identity_hash.clone(),
            display_name: format!(
                "Nodo {}",
                &req.target_identity_hash[..6.min(req.target_identity_hash.len())]
            ),
            rssi_dbm: -55,
            distance_meters: 1.8,
            transport: "BLE-Wave".to_string(),
            last_seen: timestamp,
        }
    }
}
