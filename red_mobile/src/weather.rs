use chrono::Utc;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

pub use red_core::protocol::tactical::{WeatherReport, PostWeatherReportRequest};

#[derive(Clone)]
pub struct WeatherStore {
    reports: Arc<RwLock<HashMap<String, WeatherReport>>>,
}

impl Default for WeatherStore {
    fn default() -> Self {
        Self::new()
    }
}

impl WeatherStore {
    pub fn new() -> Self {
        Self {
            reports: Arc::new(RwLock::new(HashMap::new())),
        }
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

        self.reports.write().unwrap().insert(id, report.clone());
        report
    }

    pub fn add_report_raw(&self, report: WeatherReport) {
        self.reports.write().unwrap().insert(report.id.clone(), report);
    }

    pub fn list_reports(&self, limit: usize) -> Vec<WeatherReport> {
        let map = self.reports.read().unwrap();
        let mut list: Vec<WeatherReport> = map.values().cloned().collect();
        list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        list.into_iter().take(limit).collect()
    }
}
