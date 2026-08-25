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
pub struct RegisterBleDeviceRequest {
    pub identity_hash: String,
    pub rssi_dbm: i32,
    pub distance_meters: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveHandshakeRequest {
    pub target_identity_hash: String,
    pub greeting_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeZone {
    pub name: String,
    pub lat: f64,
    pub lon: f64,
    pub radius_meters: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProximityFilterConfig {
    pub cooldown_seconds: u64,
    pub rssi_threshold_dbm: i32,
    pub stealth_mode: String,
    pub digest_enabled: bool,
    pub safe_zones: Vec<SafeZone>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProximityDigest {
    pub total_nodes_detected: usize,
    pub nodes_summary: Vec<String>,
    pub timestamp: i64,
    pub is_in_safe_zone: bool,
}

#[derive(Clone)]
pub struct DiscoveryEngine {
    nearby_nodes: Arc<RwLock<HashMap<String, ProximityNode>>>,
    last_notified: Arc<RwLock<HashMap<String, i64>>>,
    config: Arc<RwLock<ProximityFilterConfig>>,
}

impl Default for DiscoveryEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl DiscoveryEngine {
    pub fn new() -> Self {
        
        Self {
            nearby_nodes: Arc::new(RwLock::new(HashMap::new())),
            last_notified: Arc::new(RwLock::new(HashMap::new())),
            config: Arc::new(RwLock::new(ProximityFilterConfig {
                cooldown_seconds: 3600,
                rssi_threshold_dbm: -75,
                stealth_mode: "vibrate".to_string(),
                digest_enabled: true,
                safe_zones: vec![SafeZone {
                    name: "Base Táctica / Oficina".to_string(),
                    lat: -12.04637,
                    lon: -77.04279,
                    radius_meters: 150.0,
                }],
            })),
        }
    }

    pub fn report_node(&self, node: ProximityNode) {
        let mut map = self.nearby_nodes.write().unwrap();
        map.insert(node.identity_hash.clone(), node);
    }



    pub fn get_config(&self) -> ProximityFilterConfig {
        self.config.read().unwrap().clone()
    }

    pub fn set_config(&self, cfg: ProximityFilterConfig) {
        *self.config.write().unwrap() = cfg;
    }

    pub fn get_filtered_proximity_nodes(&self) -> Vec<ProximityNode> {
        let map = self.nearby_nodes.read().unwrap();
        let cfg = self.config.read().unwrap();
        let now = chrono::Utc::now().timestamp();
        let last_notified_map = self.last_notified.read().unwrap();

        map.values()
            .filter(|n| {
                if n.rssi_dbm < cfg.rssi_threshold_dbm {
                    return false;
                }
                if let Some(&last_t) = last_notified_map.get(&n.identity_hash) {
                    if (now - last_t) < (cfg.cooldown_seconds as i64) {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect()
    }

    pub fn get_digest(&self) -> ProximityDigest {
        let nodes = self.get_filtered_proximity_nodes();
        let names = nodes.iter().map(|n| n.display_name.clone()).collect();
        ProximityDigest {
            total_nodes_detected: nodes.len(),
            nodes_summary: names,
            timestamp: chrono::Utc::now().timestamp(),
            is_in_safe_zone: false,
        }
    }

    pub fn register_ble_device(&self, identity_hash: String, rssi_dbm: i32, distance_meters: f32) {
        let timestamp = chrono::Utc::now().timestamp();
        let node = ProximityNode {
            identity_hash: identity_hash.clone(),
            display_name: format!("Nodo {}", &identity_hash[..6.min(identity_hash.len())]),
            rssi_dbm,
            distance_meters,
            transport: "BLE".to_string(),
            last_seen: timestamp,
        };
        self.nearby_nodes.write().unwrap().insert(identity_hash, node);
    }

    pub fn trigger_wave(&self, req: WaveHandshakeRequest) -> ProximityNode {
        let timestamp = chrono::Utc::now().timestamp();
        self.last_notified
            .write()
            .unwrap()
            .insert(req.target_identity_hash.clone(), timestamp);

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
