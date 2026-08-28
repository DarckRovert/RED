use std::sync::{Arc, RwLock};

pub use red_core::protocol::tactical::EcoMeshStatus;

#[derive(Clone)]
pub struct BatteryOptimizer {
    db: Option<sled::Db>,
}

impl BatteryOptimizer {
    pub fn new(db: Option<sled::Db>) -> Self {
        Self { db }
    }

    fn tree(&self) -> Option<sled::Tree> {
        self.db.as_ref().and_then(|db| db.open_tree("battery_status").ok())
    }

    pub fn get_status(&self) -> EcoMeshStatus {
        if let Some(tree) = self.tree() {
            if let Ok(Some(bytes)) = tree.get("status") {
                if let Ok(status) = bincode::deserialize::<EcoMeshStatus>(&bytes) {
                    return status;
                }
            }
        }
        EcoMeshStatus {
            battery_level: 100, // Starts at 100% until frontend pushes real value
            ble_scan_interval_ms: 2500,
            lora_tx_power_dbm: 14,
            estimated_mesh_hours: 120.0,
            eco_mode_enabled: false,
        }
    }

    pub fn update_battery(&self, level: u8) -> EcoMeshStatus {
        let mut st = self.get_status();
        st.battery_level = level;

        if level <= 20 {
            st.ble_scan_interval_ms = 8000;
            st.lora_tx_power_dbm = 10;
            st.estimated_mesh_hours = (level as f32) * 2.5;
            st.eco_mode_enabled = true;
        } else if level <= 50 {
            st.ble_scan_interval_ms = 4000;
            st.lora_tx_power_dbm = 12;
            st.estimated_mesh_hours = (level as f32) * 1.8;
            st.eco_mode_enabled = true;
        } else {
            st.ble_scan_interval_ms = 2500;
            st.lora_tx_power_dbm = 14;
            st.estimated_mesh_hours = (level as f32) * 1.2;
            st.eco_mode_enabled = false;
        }

        if let Some(tree) = self.tree() {
            if let Ok(bytes) = bincode::serialize(&st) {
                let _ = tree.insert("status", bytes);
            }
        }

        st
    }
}
