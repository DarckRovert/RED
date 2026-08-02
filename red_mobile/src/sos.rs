use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SosBeacon {
    pub id: String,
    pub sender_did: String,
    pub sender_name: String,
    pub lat: f64,
    pub lon: f64,
    pub altitude: Option<f64>,
    pub timestamp: i64,
    pub battery_level: u8,
    pub note: String,
    pub is_active: bool,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SosReportRequest {
    pub sender_name: String,
    pub lat: f64,
    pub lon: f64,
    pub altitude: Option<f64>,
    pub battery_level: u8,
    pub note: String,
}

#[derive(Clone)]
pub struct SosStore {
    beacons: Arc<RwLock<HashMap<String, SosBeacon>>>,
}

impl SosStore {
    pub fn new() -> Self {
        Self {
            beacons: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn emit_sos(&self, sender_did: String, req: SosReportRequest) -> SosBeacon {
        let id = format!(
            "sos_{}_{}",
            Utc::now().timestamp_millis(),
            &sender_did[..8.min(sender_did.len())]
        );
        let beacon = SosBeacon {
            id: id.clone(),
            sender_did,
            sender_name: req.sender_name,
            lat: req.lat,
            lon: req.lon,
            altitude: req.altitude,
            timestamp: Utc::now().timestamp(),
            battery_level: req.battery_level,
            note: req.note,
            is_active: true,
            signature: format!("sig_sos_ed25519_{}", Utc::now().timestamp_subsec_nanos()),
        };

        self.beacons.write().unwrap().insert(id, beacon.clone());
        beacon
    }

    pub fn resolve_sos(&self, sos_id: &str) -> bool {
        let mut map = self.beacons.write().unwrap();
        if let Some(beacon) = map.get_mut(sos_id) {
            beacon.is_active = false;
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
