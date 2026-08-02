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
    nearby_nodes: Arc<RwLock<HashMap<String, ProximityNode>>>,
    last_notified: Arc<RwLock<HashMap<String, i64>>>,
    config: Arc<RwLock<ProximityFilterConfig>>,
}

impl DiscoveryEngine {
    pub fn new() -> Self {
        let engine = Self {
            nearby_nodes: Arc::new(RwLock::new(HashMap::new())),
            last_notified: Arc::new(RwLock::new(HashMap::new())),
            config: Arc::new(RwLock::new(ProximityFilterConfig {
                cooldown_seconds: 3600, // 1 hora cooldown anti-spam
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
        };
        engine.seed_demo_nodes();
        engine
    }

    fn seed_demo_nodes(&self) {
        let mut map = self.nearby_nodes.write().unwrap();
        let now = chrono::Utc::now().timestamp();
        map.insert(
            "node_nearby_alice".to_string(),
            ProximityNode {
                identity_hash: "3f7a8291c4e2".to_string(),
                display_name: "Alice (BLE Proximity)".to_string(),
                rssi_dbm: -58,
                distance_meters: 2.4,
                transport: "BLE".to_string(),
                last_seen: now,
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
                last_seen: now,
            },
        );
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
                // Filtro 1: RSSI mínimo aceptable
                if n.rssi_dbm < cfg.rssi_threshold_dbm {
                    return false;
                }
                // Filtro 2: Cooldown por nodo
                if let Some(&last_t) = last_notified_map.get(&n.identity_hash) {
                    if (now - last_t) < (cfg.cooldown_seconds as i64) {
                        // En cooldown -> No molestar
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

    pub fn trigger_wave(&self, req: WaveHandshakeRequest) -> ProximityNode {
        let timestamp = chrono::Utc::now().timestamp();
        // Marcar en mapa de cooldown
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
