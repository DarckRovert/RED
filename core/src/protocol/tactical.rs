//! Modelos canónicos de datos tácticos y contratos de difusión P2P para RED.
//!
//! Este módulo actúa como Single Source of Truth (SSOT) para:
//! - Sistema de Alertas AMBER descentralizado
//! - Balizas de Emergencia SOS
//! - Telemetría Barométrica y Clima (OASIS CAP v1.2)
//! - Canales Públicos de Difusión Local
//! - Publicaciones de Feed Social P2P
//! - Veredictos de Moderación y Firewall Guardian IA

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── 1. SISTEMA ALERTA AMBER-RED ─────────────────────────────────────────────

pub const AMBER_GOSSIP_TOPIC: &str = "amber-red-v1";
pub const DEFAULT_ALERT_TTL_SECS: u64 = 72 * 3600;

/// Estado de una alerta AMBER en la red mesh
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlertStatus {
    /// Alerta activa — persona aún no encontrada
    Active,
    /// Persona encontrada — alerta resuelta
    Resolved,
    /// Alerta expirada por TTL (72h)
    Expired,
    /// Alerta cancelada por la autoridad emisora
    Cancelled,
}

/// Alerta AMBER-RED — estructura principal
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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
    /// Firma Ed25519 del contenido (hex)
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
    /// Verifica si la alerta está vigente (activa y no expirada por TTL)
    pub fn is_active(&self) -> bool {
        if self.status != AlertStatus::Active {
            return false;
        }
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        now < self.expires_at
    }

    /// Genera el resumen textual para difusión en la red P2P
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAmberAlertRequest {
    pub name: String,
    pub age: u32,
    pub description: String,
    pub photo_b64: Option<String>,
    pub last_seen_lat: Option<f64>,
    pub last_seen_lon: Option<f64>,
    pub last_seen_location: Option<String>,
    pub ttl_secs: Option<u64>,
    pub authority_signature: String,
    pub authority_node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportSightingRequest {
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveAmberAlertRequest {
    pub authority_node_id: String,
    pub resolution_notes: Option<String>,
    pub authority_signature: String,
}

// ─── 2. BALIZAS DE EMERGENCIA SOS ───────────────────────────────────────────

/// Baliza de socorro SOS transmitida por radio/mesh
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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

// ─── 3. CLIMA Y BARÓMETRO TÁCTICO (OASIS CAP v1.2) ──────────────────────────

/// Reporte barométrico y de condiciones meteorológicas
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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

// ─── 4. CANALES PÚBLICOS DE DIFUSIÓN ────────────────────────────────────────

/// Mensaje en un canal público de la malla local
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChannelMessage {
    pub id: String,
    pub channel_id: String,
    pub sender_did: String,
    pub sender_name: String,
    pub content: String,
    pub timestamp: i64,
    pub hash: String,
    pub is_moderated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostChannelMessageRequest {
    pub channel_id: String,
    pub sender_name: String,
    pub content: String,
}

// ─── 5. FEED SOCIAL P2P ─────────────────────────────────────────────────────

pub const MAX_LOCAL_POSTS: usize = 500;

/// Publicación en el feed social descentralizado
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SocialPost {
    pub id: String,
    pub author_hash: String,
    pub author_name: String,
    pub content: String,
    pub media_data: Option<String>,
    pub timestamp: i64,
    pub reactions: HashMap<String, Vec<String>>,
    #[serde(default)]
    pub reply_to: Option<String>,
    #[serde(default)]
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostRequest {
    pub author_name: String,
    pub content: String,
    pub media_data: Option<String>,
}

// ─── 6. GUARDIAN SECURITY FIREWALL ──────────────────────────────────────────

/// Resultado del análisis de seguridad de Guardian IA
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GuardianVerdict {
    /// Contenido permitido — continúa flujo normal
    Allow,
    /// Contenido bloqueado — incluye categoría y razón
    Block { category: String, reason: String },
    /// Contenido flaggeado para revisión (modo advertencia)
    FlagForReview { category: String, reason: String },
}

/// Modo de operación del Firewall Guardian
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GuardianMode {
    /// Bloqueo total de contenido peligroso
    Strict,
    /// Solo advertencia, no bloquea
    Warn,
    /// Apagado — no analiza nada
    Off,
}

impl GuardianMode {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "warn" => GuardianMode::Warn,
            "off" => GuardianMode::Off,
            _ => GuardianMode::Strict,
        }
    }

    pub fn parse_mode(s: &str) -> Self {
        Self::from_str(s)
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            GuardianMode::Strict => "strict",
            GuardianMode::Warn => "warn",
            GuardianMode::Off => "off",
        }
    }
}

// ─── 7. AUDIO Y NOTAS DE VOZ (VOICE BURSTS) ─────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VoiceBurst {
    pub id: String,
    pub sender_did: String,
    pub sender_name: String,
    pub duration_seconds: f32,
    pub audio_opus_b64: String,
    pub timestamp: i64,
    pub sample_rate: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendVoiceBurstRequest {
    pub sender_name: String,
    pub duration_seconds: f32,
    pub audio_opus_b64: String,
    pub sample_rate: Option<u32>,
}

// ─── 8. MENSAJES EFÍMEROS & AUTO-DESTRUCCIÓN ────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EphemeralConfig {
    pub conversation_id: String,
    pub self_destruct_seconds: u32,
    pub burn_on_read: bool,
}

// ─── 9. DESCUBRIMIENTO DE PROXIMIDAD Y ZONAS SEGURAS ────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProximityNode {
    pub identity_hash: String,
    pub display_name: String,
    pub rssi_dbm: i32,
    pub distance_meters: f32,
    pub transport: String,
    pub last_seen: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterBleDeviceRequest {
    pub identity_hash: String,
    pub rssi_dbm: i32,
    pub distance_meters: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveHandshakeRequest {
    pub target_identity_hash: String,
    pub greeting_message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SafeZone {
    pub name: String,
    pub lat: f64,
    pub lon: f64,
    pub radius_meters: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProximityFilterConfig {
    pub cooldown_seconds: u64,
    pub rssi_threshold_dbm: i32,
    pub stealth_mode: String,
    pub digest_enabled: bool,
    pub safe_zones: Vec<SafeZone>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProximityDigest {
    pub total_nodes_detected: usize,
    pub nodes_summary: Vec<String>,
    pub timestamp: i64,
    pub is_in_safe_zone: bool,
}

// ─── 10. TELEMETRÍA DE BATERÍA Y MODO ECO-MESH ──────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EcoMeshStatus {
    pub battery_level: u8,
    pub ble_scan_interval_ms: u32,
    pub lora_tx_power_dbm: i8,
    pub estimated_mesh_hours: f32,
    pub eco_mode_enabled: bool,
}

// ─── 11. HIGIENE DIGITAL Y SANITIZACIÓN DE METADATOS ────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanImageRequest {
    pub image_b64: String,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanImageResponse {
    pub ok: bool,
    pub cleaned_b64: String,
    pub bytes_stripped: usize,
    pub metadata_removed: Vec<String>,
}

// ─── 12. FRAGMENTACIÓN Y REENSAMBLAJE DE ARCHIVOS (CHUNKER) ─────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileChunk {
    pub file_id: String,
    pub chunk_index: usize,
    pub total_chunks: usize,
    pub chunk_hash: String,
    pub data_base64: String,
    pub chunk_size: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChunkManifest {
    pub file_id: String,
    pub filename: String,
    pub total_size: usize,
    pub total_chunks: usize,
    pub root_hash: String,
    pub chunk_hashes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitFileRequest {
    pub filename: String,
    pub data_base64: String,
}

// ─── 13. INTELIGENCIA ARTIFICIAL TÁCTICA LOCAL OFF-GRID (CANDLE / GGUF) ─────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotQueryRequest {
    pub prompt: String,
    pub context: Option<String>,
    pub model_path: Option<String>,
    pub model_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CopilotResponse {
    pub answer: String,
    pub topic_category: String,
    pub source: String,
    pub model_used: String,
    pub execution_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummarizeChannelRequest {
    pub channel_id: String,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChannelSummaryResponse {
    pub channel_id: String,
    pub summary_bullets: Vec<String>,
    pub total_messages_analyzed: usize,
    pub sentiment: String,
    pub execution_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslateRequest {
    pub text: String,
    pub target_language: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TranslateResponse {
    pub original_text: String,
    pub translated_text: String,
    pub target_language: String,
    pub execution_time_ms: u64,
    pub source: String,
}


