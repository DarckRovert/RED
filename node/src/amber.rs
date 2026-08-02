//! Sistema Alerta AMBER-RED
//!
//! Difunde alertas de personas desaparecidas sobre la red P2P de RED
//! usando el topic GossipSub "amber-red-v1". Las alertas están firmadas
//! con Ed25519 y solo pueden ser emitidas por nodos con autoridad AMBER.
//!
//! Flujo:
//!   Autoridad AMBER → POST /api/amber/alert
//!     → Validar firma
//!     → Persistir en sled DB
//!     → Difundir vía GossipSub
//!     → Notificar vía SSE a todos los clientes conectados

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, Mutex};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::amber_authority::is_authorized_authority;

/// Topic GossipSub para alertas AMBER
pub const AMBER_GOSSIP_TOPIC: &str = "amber-red-v1";

/// Tiempo de vida por defecto de una alerta: 72 horas
const DEFAULT_ALERT_TTL_SECS: u64 = 72 * 3600;

// ─── Tipos de datos ────────────────────────────────────────────────────────────

/// Estado de una alerta AMBER
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AlertStatus {
    /// Alerta activa — persona aún no encontrada
    Active,
    /// Persona encontrada — alerta resuelta
    Resolved,
    /// Alerta expirada por TTL
    Expired,
    /// Cancelada por la autoridad emisora
    Cancelled,
}

/// Alerta AMBER-RED — estructura principal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmberAlert {
    /// ID único de la alerta
    pub id: String,
    /// Nombre de la persona desaparecida
    pub name: String,
    /// Edad (en años)
    pub age: u32,
    /// Descripción física y circunstancias
    pub description: String,
    /// Foto de la persona (base64, JPEG/PNG — máx 512KB)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub photo_b64: Option<String>,
    /// Latitud del último avistamiento conocido
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_lat: Option<f64>,
    /// Longitud del último avistamiento conocido
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_lon: Option<f64>,
    /// Descripción textual de la ubicación del último avistamiento
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_location: Option<String>,
    /// Timestamp Unix de emisión de la alerta
    pub issued_at: u64,
    /// Timestamp Unix de expiración
    pub expires_at: u64,
    /// Identity hash del nodo autoridad que emitió la alerta
    pub authority_node_id: String,
    /// Firma Ed25519 del contenido (hex). Firmado sobre SHA-256(id+name+age+issued_at)
    pub authority_signature: String,
    /// Estado actual de la alerta
    pub status: AlertStatus,
    /// Notas de resolución (cuando status == Resolved)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolution_notes: Option<String>,
    /// Número de avistamientos reportados
    pub sighting_count: u32,
}

impl AmberAlert {
    /// Verifica si la alerta está vigente (no expirada)
    pub fn is_active(&self) -> bool {
        if self.status != AlertStatus::Active {
            return false;
        }
        let now = unix_now();
        now < self.expires_at
    }

    /// Genera el mensaje de texto resumido de la alerta (para GossipSub)
    pub fn summary_text(&self) -> String {
        format!(
            "🟠 ALERTA AMBER-RED | {} | {} años | {} | Reportar: /api/amber/alerts/{}/sighting",
            self.name,
            self.age,
            self.description.chars().take(100).collect::<String>(),
            self.id
        )
    }
}

/// Reporte de avistamiento de una persona con alerta activa
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmberSighting {
    pub alert_id: String,
    pub reporter_node_id: String,
    pub reported_at: u64,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub notes: Option<String>,
}

// ─── Request/Response types ────────────────────────────────────────────────────

/// Payload para crear una nueva alerta AMBER
#[derive(Debug, Deserialize)]
pub struct CreateAmberAlertRequest {
    pub name: String,
    pub age: u32,
    pub description: String,
    /// Foto en base64 (opcional — máx ~512KB recomendado)
    pub photo_b64: Option<String>,
    pub last_seen_lat: Option<f64>,
    pub last_seen_lon: Option<f64>,
    pub last_seen_location: Option<String>,
    /// TTL en segundos (opcional — por defecto 72h)
    pub ttl_secs: Option<u64>,
    /// Firma Ed25519 hex del emisor sobre SHA-256(name+age+description)
    pub authority_signature: String,
    /// Identity hash del nodo emisor
    pub authority_node_id: String,
}

/// Payload para resolver una alerta
#[derive(Debug, Deserialize)]
pub struct ResolveAmberAlertRequest {
    /// Identity hash del nodo autoridad que resuelve la alerta
    pub authority_node_id: String,
    pub resolution_notes: Option<String>,
    pub authority_signature: String,
}

/// Payload para reportar un avistamiento
#[derive(Debug, Deserialize)]
pub struct ReportSightingRequest {
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub notes: Option<String>,
}

// ─── AmberStore ────────────────────────────────────────────────────────────────

/// Almacén persistente de alertas AMBER sobre sled DB.
/// Bucket: "amber_alerts" → key: alert_id, value: bincode(AmberAlert)
pub struct AmberStore {
    db: sled::Db,
    /// Canal de broadcast para notificar nuevas alertas a clientes SSE
    pub alert_tx: broadcast::Sender<AmberAlert>,
}

impl AmberStore {
    /// Abre o crea el store en la ruta dada
    pub fn open(data_dir: &std::path::Path) -> Result<Self, sled::Error> {
        let db_path = data_dir.join("amber_alerts.sled");
        let db = sled::open(&db_path)?;
        let (alert_tx, _) = broadcast::channel(64);
        info!("AmberStore abierto en: {:?}", db_path);
        Ok(AmberStore { db, alert_tx })
    }

    /// Crea una nueva alerta validando la autoridad
    pub fn create_alert(&self, req: CreateAmberAlertRequest) -> Result<AmberAlert, AmberError> {
        // Validar autoridad
        if !is_authorized_authority(&req.authority_node_id) {
            return Err(AmberError::Unauthorized(
                "El nodo no tiene autoridad AMBER para emitir alertas".to_string(),
            ));
        }

        // Validar campos mínimos
        if req.name.trim().is_empty() {
            return Err(AmberError::InvalidData("name es requerido".to_string()));
        }
        if req.description.trim().is_empty() {
            return Err(AmberError::InvalidData(
                "description es requerido".to_string(),
            ));
        }
        if req.age > 150 {
            return Err(AmberError::InvalidData("age inválido".to_string()));
        }

        // Validar tamaño de foto si se incluye
        if let Some(ref photo) = req.photo_b64 {
            // ~512KB en base64 ≈ 699KB de texto. Limitamos a 700_000 chars
            if photo.len() > 700_000 {
                return Err(AmberError::InvalidData(
                    "La foto excede el límite de 512KB".to_string(),
                ));
            }
        }

        let now = unix_now();
        let ttl = req.ttl_secs.unwrap_or(DEFAULT_ALERT_TTL_SECS);

        let alert = AmberAlert {
            id: Uuid::new_v4().to_string(),
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

        // Persistir en sled
        self.persist_alert(&alert)?;

        // Notificar a SSE subscribers
        let _ = self.alert_tx.send(alert.clone());

        info!(
            "Alerta AMBER creada: id={} nombre='{}' edad={}",
            alert.id, alert.name, alert.age
        );

        Ok(alert)
    }

    /// Lista alertas activas (filtra expiradas)
    pub fn list_active_alerts(&self) -> Vec<AmberAlert> {
        self.db
            .iter()
            .filter_map(|item| {
                let (_, v) = item.ok()?;
                bincode::deserialize::<AmberAlert>(&v).ok()
            })
            .filter(|a| a.is_active())
            .collect()
    }

    /// Lista todas las alertas (incluye resueltas/expiradas)
    pub fn list_all_alerts(&self) -> Vec<AmberAlert> {
        self.db
            .iter()
            .filter_map(|item| {
                let (_, v) = item.ok()?;
                bincode::deserialize::<AmberAlert>(&v).ok()
            })
            .collect()
    }

    /// Obtiene una alerta por ID
    pub fn get_alert(&self, id: &str) -> Option<AmberAlert> {
        let bytes = self.db.get(id.as_bytes()).ok()??;
        bincode::deserialize::<AmberAlert>(&bytes).ok()
    }

    /// Resuelve una alerta (persona encontrada)
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

        let mut alert = self
            .get_alert(alert_id)
            .ok_or_else(|| AmberError::NotFound(alert_id.to_string()))?;

        alert.status = AlertStatus::Resolved;
        alert.resolution_notes = resolution_notes;

        self.persist_alert(&alert)?;

        info!(
            "Alerta AMBER resuelta: id={} nombre='{}'",
            alert.id, alert.name
        );

        // Notificar resolución a todos los clientes SSE
        let _ = self.alert_tx.send(alert.clone());

        Ok(alert)
    }

    /// Registra un avistamiento
    pub fn report_sighting(
        &self,
        alert_id: &str,
        reporter_node_id: &str,
        lat: Option<f64>,
        lon: Option<f64>,
        notes: Option<String>,
    ) -> Result<AmberSighting, AmberError> {
        let mut alert = self
            .get_alert(alert_id)
            .ok_or_else(|| AmberError::NotFound(alert_id.to_string()))?;

        if !alert.is_active() {
            return Err(AmberError::AlertNotActive(alert_id.to_string()));
        }

        alert.sighting_count += 1;
        self.persist_alert(&alert)?;

        let sighting = AmberSighting {
            alert_id: alert_id.to_string(),
            reporter_node_id: reporter_node_id.to_string(),
            reported_at: unix_now(),
            lat,
            lon,
            notes,
        };

        // Persistir avistamiento en sub-tree
        let sighting_key = format!("sighting:{}:{}", alert_id, sighting.reported_at);
        let encoded =
            bincode::serialize(&sighting).map_err(|e| AmberError::StorageError(e.to_string()))?;
        self.db
            .insert(sighting_key.as_bytes(), encoded)
            .map_err(|e| AmberError::StorageError(e.to_string()))?;

        info!(
            "Avistamiento reportado: alerta={} reporter={}",
            alert_id, reporter_node_id
        );

        Ok(sighting)
    }

    /// Serializa la alerta a bytes para broadcast GossipSub
    pub fn alert_to_gossip_bytes(alert: &AmberAlert) -> Result<Vec<u8>, AmberError> {
        // Para GossipSub enviamos versión sin foto (para reducir payload)
        let mut gossip_alert = alert.clone();
        // La foto la omitimos del gossip — los nodos que la necesiten la solicitan via /api/amber/alerts/:id
        gossip_alert.photo_b64 = if alert.photo_b64.is_some() {
            Some("[PHOTO_AVAILABLE]".to_string())
        } else {
            None
        };

        bincode::serialize(&gossip_alert).map_err(|e| AmberError::StorageError(e.to_string()))
    }

    /// Ingresa una alerta recibida via GossipSub (de otro nodo)
    pub fn ingest_gossip_alert(&self, bytes: &[u8]) -> Result<(), AmberError> {
        let alert: AmberAlert = bincode::deserialize(bytes)
            .map_err(|e| AmberError::StorageError(format!("Deserialización fallida: {}", e)))?;

        // No persistir si ya existe o si está expirada
        if self.get_alert(&alert.id).is_some() {
            return Ok(()); // Ya la tenemos
        }
        if !alert.is_active() {
            return Ok(()); // Expirada — descartar
        }

        self.persist_alert(&alert)?;
        let _ = self.alert_tx.send(alert.clone());
        info!("Alerta AMBER recibida via mesh: id={}", alert.id);
        Ok(())
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    fn persist_alert(&self, alert: &AmberAlert) -> Result<(), AmberError> {
        let encoded =
            bincode::serialize(alert).map_err(|e| AmberError::StorageError(e.to_string()))?;
        self.db
            .insert(alert.id.as_bytes(), encoded)
            .map_err(|e| AmberError::StorageError(e.to_string()))?;
        self.db
            .flush()
            .map_err(|e| AmberError::StorageError(e.to_string()))?;
        Ok(())
    }
}

// ─── Errores ──────────────────────────────────────────────────────────────────

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
    #[error("Error de almacenamiento: {0}")]
    StorageError(String),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
