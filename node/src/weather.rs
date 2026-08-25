use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherReport {
    pub id: String,
    pub sender_did: String,
    pub sender_name: String,
    pub pressure_hpa: f32,
    pub temperature_c: Option<f32>,
    pub humidity_percent: Option<f32>,
    pub wind_speed_kmh: Option<f32>,
    pub wind_direction_deg: Option<f32>,
    pub condition_summary: String,
    pub is_disaster_alert: bool,
    // OASIS CAP v1.2 fields
    pub cap_event: Option<String>,
    pub cap_urgency: Option<String>,
    pub cap_severity: Option<String>,
    pub cap_certainty: Option<String>,
    pub cap_headline: Option<String>,
    pub cap_instruction: Option<String>,
    pub cap_area_desc: Option<String>,
    pub cap_expires_at: Option<i64>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostWeatherReportRequest {
    pub sender_name: String,
    pub pressure_hpa: f32,
    pub temperature_c: Option<f32>,
    pub humidity_percent: Option<f32>,
    pub wind_speed_kmh: Option<f32>,
    pub wind_direction_deg: Option<f32>,
    pub condition_summary: String,
    pub is_disaster_alert: bool,
    // OASIS CAP v1.2 fields
    pub cap_event: Option<String>,
    pub cap_urgency: Option<String>,
    pub cap_severity: Option<String>,
    pub cap_certainty: Option<String>,
    pub cap_headline: Option<String>,
    pub cap_instruction: Option<String>,
    pub cap_area_desc: Option<String>,
    pub cap_expires_at: Option<i64>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Clone)]
pub struct WeatherStore {
    db: Option<sled::Db>,
}

impl WeatherStore {
    pub fn new(db: Option<sled::Db>) -> Self {
        Self { db }
    }

    pub fn add_report(&self, sender_did: String, req: PostWeatherReportRequest) -> WeatherReport {
        let timestamp = Utc::now().timestamp();
        let id = format!(
            "weather_{}_{}",
            timestamp,
            &sender_did[..8.min(sender_did.len())]
        );

        let report = WeatherReport {
            id: id.clone(),
            sender_did,
            sender_name: req.sender_name,
            pressure_hpa: req.pressure_hpa,
            temperature_c: req.temperature_c,
            humidity_percent: req.humidity_percent,
            wind_speed_kmh: req.wind_speed_kmh,
            wind_direction_deg: req.wind_direction_deg,
            condition_summary: req.condition_summary,
            is_disaster_alert: req.is_disaster_alert,
            cap_event: req.cap_event,
            cap_urgency: req.cap_urgency,
            cap_severity: req.cap_severity,
            cap_certainty: req.cap_certainty,
            cap_headline: req.cap_headline,
            cap_instruction: req.cap_instruction,
            cap_area_desc: req.cap_area_desc,
            cap_expires_at: req.cap_expires_at,
            latitude: req.latitude,
            longitude: req.longitude,
            timestamp,
        };

        if let Some(db) = &self.db {
            if let Ok(tree) = db.open_tree("weather_reports") {
                if let Ok(bytes) = bincode::serialize(&report) {
                    let _ = tree.insert(id.as_bytes(), bytes);
                }
            }
        }

        report
    }

    pub fn list_reports(&self, limit: usize) -> Vec<WeatherReport> {
        let mut list = Vec::new();
        if let Some(db) = &self.db {
            if let Ok(tree) = db.open_tree("weather_reports") {
                for (_, v) in tree.iter().flatten() {
                    if let Ok(r) = bincode::deserialize::<WeatherReport>(&v) {
                        list.push(r);
                    }
                }
            }
        }
        list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        list.into_iter().take(limit).collect()
    }

    pub fn add_report_raw(&self, report: WeatherReport) {
        if let Some(db) = &self.db {
            if let Ok(tree) = db.open_tree("weather_reports") {
                if let Ok(bytes) = bincode::serialize(&report) {
                    let _ = tree.insert(report.id.as_bytes(), bytes);
                }
            }
        }
    }
}
