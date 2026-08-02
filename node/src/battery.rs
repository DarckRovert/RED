use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EcoMeshStatus {
    pub battery_level: u8,
    pub ble_scan_interval_ms: u32,
    pub lora_tx_power_dbm: i8,
    pub estimated_mesh_hours: f32,
    pub eco_mode_enabled: bool,
}

#[derive(Clone)]
pub struct BatteryOptimizer {
    status: Arc<RwLock<EcoMeshStatus>>,
}

impl BatteryOptimizer {
    pub fn new() -> Self {
        Self {
            status: Arc::new(RwLock::new(EcoMeshStatus {
                battery_level: 85,
                ble_scan_interval_ms: 2500,
                lora_tx_power_dbm: 14,
                estimated_mesh_hours: 48.5,
                eco_mode_enabled: true,
            })),
        }
    }

    pub fn get_status(&self) -> EcoMeshStatus {
        self.status.read().unwrap().clone()
    }

    pub fn update_battery(&self, level: u8) -> EcoMeshStatus {
        let mut st = self.status.write().unwrap();
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

        st.clone()
    }
}
