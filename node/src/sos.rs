use chrono::Utc;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

pub use red_core::protocol::tactical::{SosBeacon, SosReportRequest};

#[derive(Clone)]
pub struct SosStore {
    beacons: Arc<RwLock<HashMap<String, SosBeacon>>>,
    db: Option<Arc<sled::Db>>,
}

impl SosStore {
    pub fn new(db: Option<Arc<sled::Db>>) -> Self {
        let store = Self {
            beacons: Arc::new(RwLock::new(HashMap::new())),
            db,
        };
        store.load_from_db();
        store
    }

    fn load_from_db(&self) {
        if let Some(db) = &self.db {
            if let Ok(tree) = db.open_tree("sos_beacons") {
                let mut map = self.beacons.write().unwrap();
                for item in tree.iter().flatten() {
                    if let Ok(beacon) = serde_json::from_slice::<SosBeacon>(&item.1) {
                        map.insert(beacon.id.clone(), beacon);
                    }
                }
            }
        }
    }

    pub fn emit_sos(&self, identity: &red_core::identity::Identity, req: SosReportRequest) -> SosBeacon {
        let sender_did = identity.identity_hash().to_hex();
        let id = format!(
            "sos_{}_{}",
            Utc::now().timestamp_millis(),
            &sender_did[..8.min(sender_did.len())]
        );
        let timestamp = Utc::now().timestamp();
        
        let payload = format!("{}{}{}{}{}", sender_did, req.lat, req.lon, req.battery_level, req.note);
        let signature_bytes = identity.sign(payload.as_bytes());
        let signature = hex::encode(signature_bytes);

        let beacon = SosBeacon {
            id: id.clone(),
            sender_did,
            sender_name: req.sender_name,
            lat: req.lat,
            lon: req.lon,
            altitude: req.altitude,
            timestamp,
            battery_level: req.battery_level,
            note: req.note,
            is_active: true,
            signature,
        };

        let mut map = self.beacons.write().unwrap();
        map.insert(id.clone(), beacon.clone());

        if let Some(db) = &self.db {
            if let Ok(tree) = db.open_tree("sos_beacons") {
                if let Ok(bytes) = serde_json::to_vec(&beacon) {
                    let _ = tree.insert(id.as_bytes(), bytes);
                }
            }
        }

        beacon
    }

    pub fn resolve_sos(&self, sos_id: &str) -> bool {
        let mut map = self.beacons.write().unwrap();
        if let Some(beacon) = map.get_mut(sos_id) {
            beacon.is_active = false;
            if let Some(db) = &self.db {
                if let Ok(tree) = db.open_tree("sos_beacons") {
                    if let Ok(bytes) = serde_json::to_vec(&beacon) {
                        let _ = tree.insert(sos_id.as_bytes(), bytes);
                    }
                }
            }
            true
        } else {
            false
        }
    }

    pub fn get_active_beacons(&self) -> Vec<SosBeacon> {
        let map = self.beacons.read().unwrap();
        map.values().filter(|b| b.is_active).cloned().collect()
    }

    pub fn list_all(&self) -> Vec<SosBeacon> {
        let map = self.beacons.read().unwrap();
        let mut list: Vec<SosBeacon> = map.values().cloned().collect();
        list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        list
    }
}
