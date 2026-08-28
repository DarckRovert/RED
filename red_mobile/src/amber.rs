//! Sistema Alerta AMBER-RED — Mobile Edition
//!
//! Versión simplificada para mobile: usa HashMap en memoria con RwLock.
//! La persistencia sled se omite en favor de la ligereza en Android.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::amber_authority::is_authorized_authority;

pub use red_core::protocol::tactical::{
    AlertStatus, AmberAlert, AmberSighting, CreateAmberAlertRequest, ReportSightingRequest,
    ResolveAmberAlertRequest, AMBER_GOSSIP_TOPIC, DEFAULT_ALERT_TTL_SECS,
};

#[derive(Debug, thiserror::Error)]
pub enum AmberError {
    #[error("No autorizado: {0}")]
    Unauthorized(String),
    #[error("Datos inválidos: {0}")]
    InvalidData(String),
    #[error("Alerta no encontrada: {0}")]
    NotFound(String),
    #[error("Alerta no activa: {0}")]
    AlertNotActive(String),
}

/// In-memory amber store — thread-safe for Android
#[derive(Clone)]
pub struct AmberStore {
    alerts: Arc<RwLock<HashMap<String, AmberAlert>>>,
    sightings: Arc<RwLock<Vec<AmberSighting>>>,
}

impl Default for AmberStore {
    fn default() -> Self {
        Self::new()
    }
}

impl AmberStore {
    pub fn new() -> Self {
        Self {
            alerts: Arc::new(RwLock::new(HashMap::new())),
            sightings: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub fn create_alert(&self, req: CreateAmberAlertRequest) -> Result<AmberAlert, AmberError> {
        if !is_authorized_authority(&req.authority_node_id) {
            return Err(AmberError::Unauthorized(
                "El nodo no tiene autoridad AMBER para emitir alertas".to_string(),
            ));
        }

        if req.name.trim().is_empty() {
            return Err(AmberError::InvalidData("name es requerido".to_string()));
        }
        if req.description.trim().is_empty() {
            return Err(AmberError::InvalidData("description es requerido".to_string()));
        }
        if req.age > 150 {
            return Err(AmberError::InvalidData("age inválido".to_string()));
        }
        if let Some(ref photo) = req.photo_b64 {
            if photo.len() > 700_000 {
                return Err(AmberError::InvalidData(
                    "La foto excede el límite de 512KB".to_string(),
                ));
            }
        }

        let now = unix_now();
        let ttl = req.ttl_secs.unwrap_or(DEFAULT_ALERT_TTL_SECS);
        let id = format!("amber_{}", now);

        let alert = AmberAlert {
            id: id.clone(),
            name: req.name.trim().to_string(),
            age: req.age,
            description: req.description.trim().to_string(),
            photo_b64: req.photo_b64,
            last_seen_lat: req.last_seen_lat,
            last_seen_lon: req.last_seen_lon,
            last_seen_location: req.last_seen_location,
            issued_at: now,
            expires_at: now + ttl,
            authority_node_id: req.authority_node_id,
            authority_signature: req.authority_signature,
            status: AlertStatus::Active,
            resolution_notes: None,
            sighting_count: 0,
        };

        self.alerts.write().unwrap().insert(id, alert.clone());
        Ok(alert)
    }

    pub fn list_active_alerts(&self) -> Vec<AmberAlert> {
        self.alerts
            .read()
            .unwrap()
            .values()
            .filter(|a| a.is_active())
            .cloned()
            .collect()
    }

    pub fn list_all_alerts(&self) -> Vec<AmberAlert> {
        self.alerts.read().unwrap().values().cloned().collect()
    }

    pub fn get_alert(&self, id: &str) -> Option<AmberAlert> {
        self.alerts.read().unwrap().get(id).cloned()
    }

    pub fn resolve_alert(
        &self,
        alert_id: &str,
        authority_node_id: &str,
        resolution_notes: Option<String>,
    ) -> Result<AmberAlert, AmberError> {
        if !is_authorized_authority(authority_node_id) {
            return Err(AmberError::Unauthorized(
                "El nodo no tiene autoridad para resolver alertas".to_string(),
            ));
        }

        let mut alerts = self.alerts.write().unwrap();
        let alert = alerts
            .get_mut(alert_id)
            .ok_or_else(|| AmberError::NotFound(alert_id.to_string()))?;

        alert.status = AlertStatus::Resolved;
        alert.resolution_notes = resolution_notes;
        Ok(alert.clone())
    }

    pub fn report_sighting(
        &self,
        alert_id: &str,
        reporter_node_id: &str,
        lat: Option<f64>,
        lon: Option<f64>,
        notes: Option<String>,
    ) -> Result<AmberSighting, AmberError> {
        {
            let mut alerts = self.alerts.write().unwrap();
            let alert = alerts
                .get_mut(alert_id)
                .ok_or_else(|| AmberError::NotFound(alert_id.to_string()))?;

            if !alert.is_active() {
                return Err(AmberError::AlertNotActive(alert_id.to_string()));
            }
            alert.sighting_count += 1;
        }

        let sighting = AmberSighting {
            alert_id: alert_id.to_string(),
            reporter_node_id: reporter_node_id.to_string(),
            reported_at: unix_now(),
            lat,
            lon,
            notes,
        };

        self.sightings.write().unwrap().push(sighting.clone());
        Ok(sighting)
    }
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
