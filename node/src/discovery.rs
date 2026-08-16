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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafeZone {
    pub name: String,
    pub lat: f64,
    pub lon: f64,
    pub radius_meters: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProximityFilterConfig {
    pub cooldown_seconds: u64, // ej. 3600 = 1 hora sin repetir alerta para el mismo nodo
    pub rssi_threshold_dbm: i32, // ej. -70 dBm (descarta señales débiles)
    pub stealth_mode: String,  // "silent" | "vibrate" | "discreet_sound"
    pub digest_enabled: bool,  // Resumen agrupado por lote
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
    db: Option<sled::Db>,
}

impl DiscoveryEngine {
    pub fn new(db: Option<sled::Db>) -> Self {
        Self { db }
    }

    fn nodes_tree(&self) -> Option<sled::Tree> {
        self.db.as_ref().and_then(|db| db.open_tree("discovery_nodes").ok())
    }

    fn config_tree(&self) -> Option<sled::Tree> {
        self.db.as_ref().and_then(|db| db.open_tree("discovery_config").ok())
    }

    fn last_notified_tree(&self) -> Option<sled::Tree> {
        self.db.as_ref().and_then(|db| db.open_tree("discovery_last_notified").ok())
    }

    pub fn register_discovered_node(&self, node: ProximityNode) {
        if let Some(tree) = self.nodes_tree() {
            if let Ok(bytes) = bincode::serialize(&node) {
                let _ = tree.insert(node.identity_hash.as_bytes(), bytes);
            }
        }
    }

    pub fn get_config(&self) -> ProximityFilterConfig {
        if let Some(tree) = self.config_tree() {
            if let Ok(Some(bytes)) = tree.get("config") {
                if let Ok(cfg) = bincode::deserialize::<ProximityFilterConfig>(&bytes) {
                    return cfg;
                }
            }
        }
        
        ProximityFilterConfig {
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
        }
    }

    pub fn set_config(&self, cfg: ProximityFilterConfig) {
        if let Some(tree) = self.config_tree() {
            if let Ok(bytes) = bincode::serialize(&cfg) {
                let _ = tree.insert("config", bytes);
            }
        }
    }

    pub fn get_filtered_proximity_nodes(&self) -> Vec<ProximityNode> {
        let mut nodes = Vec::new();
        let cfg = self.get_config();
        let now = chrono::Utc::now().timestamp();
        
        if let Some(tree) = self.nodes_tree() {
            for item in tree.iter() {
                if let Ok((_, v)) = item {
                    if let Ok(n) = bincode::deserialize::<ProximityNode>(&v) {
                        // Filtro 1: RSSI
                        if n.rssi_dbm >= cfg.rssi_threshold_dbm {
                            // Filtro 2: Cooldown
                            let mut allow = true;
                            if let Some(ln_tree) = self.last_notified_tree() {
                                if let Ok(Some(last_t_bytes)) = ln_tree.get(n.identity_hash.as_bytes()) {
                                    if let Ok(last_t) = bincode::deserialize::<i64>(&last_t_bytes) {
                                        if (now - last_t) < (cfg.cooldown_seconds as i64) {
                                            allow = false;
                                        }
                                    }
                                }
                            }
                            if allow {
                                nodes.push(n);
                            }
                        }
                    }
                }
            }
        }
        nodes
    }

    pub fn get_digest(&self) -> ProximityDigest {
        let nodes = self.get_filtered_proximity_nodes();
        let names = nodes.iter().map(|n| n.display_name.clone()).collect();
        ProximityDigest {
            total_nodes_detected: nodes.len(),
            nodes_summary: names,
            timestamp: chrono::Utc::now().timestamp(),
            is_in_safe_zone: false, // Could compute against get_config().safe_zones
        }
    }

    pub fn trigger_wave(&self, req: WaveHandshakeRequest) -> ProximityNode {
        let timestamp = chrono::Utc::now().timestamp();
        
        if let Some(tree) = self.last_notified_tree() {
            if let Ok(bytes) = bincode::serialize(&timestamp) {
                let _ = tree.insert(req.target_identity_hash.as_bytes(), bytes);
            }
        }

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
