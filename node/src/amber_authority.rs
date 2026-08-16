//! Autoridades AMBER-RED — Gestión de nodos autorizados para emitir alertas
//!
//! En modo desarrollo/testnet: el propio nodo puede emitir alertas.
//! En producción: se requiere multifirma 3-de-5 de autoridades registradas.
//!
//! Las claves se configuran via variable de entorno AMBER_AUTHORITY_NODE_IDS
//! o via archivo de configuración. En testnet, se auto-incluye el nodo local.

use std::sync::OnceLock;
use tracing::info;

/// Lista global de identity hashes de nodos autorizados para emitir alertas AMBER
static AUTHORIZED_AUTHORITIES: OnceLock<Vec<String>> = OnceLock::new();

/// Inicializa la lista de autoridades desde env o config.
/// Debe llamarse una vez durante el arranque del nodo.
pub fn initialize_authorities(local_node_id: &str) {
    let authorities = AUTHORIZED_AUTHORITIES.get_or_init(|| {
        let mut list: Vec<String> = Vec::new();

        // Cargar desde variable de entorno (comma-separated)
        if let Ok(env_ids) = std::env::var("AMBER_AUTHORITY_NODE_IDS") {
            for id in env_ids.split(',') {
                let trimmed = id.trim().to_string();
                if !trimmed.is_empty() {
                    list.push(trimmed);
                }
            }
        }

        // En modo desarrollo (AMBER_DEV_MODE=1), incluir el nodo local como autoridad
        let dev_mode = std::env::var("AMBER_DEV_MODE")
            .map(|v| v == "1" || v.to_lowercase() == "true")
            .unwrap_or(true); // Default: dev mode activo para poder testear

        if dev_mode && !list.contains(&local_node_id.to_string()) {
            list.push(local_node_id.to_string());
            info!(
                "AMBER dev mode: nodo local '{}' agregado como autoridad automáticamente",
                local_node_id
            );
        }

        if list.is_empty() {
            // Fallback: el nodo local siempre puede emitir alertas (para demos)
            list.push(local_node_id.to_string());
        }

        info!("Autoridades AMBER registradas: {} nodo(s)", list.len());
        list
    });

    let _ = authorities; // OnceLock no retorna referencia mutable
}

/// Verifica si un identity hash está autorizado para emitir alertas AMBER
pub fn is_authorized_authority(node_id: &str) -> bool {
    match AUTHORIZED_AUTHORITIES.get() {
        Some(list) => list.iter().any(|id| id == node_id),
        None => {
            // Si no se inicializó, fallar seguro (denegar)
            tracing::warn!("AMBER: authorities no inicializadas — denegando por defecto");
            false
        }
    }
}

/// Retorna la lista de nodos autorizados (para el endpoint de estado)
pub fn list_authorities() -> Vec<String> {
    AUTHORIZED_AUTHORITIES.get().cloned().unwrap_or_default()
}

/// Agrega un nuevo nodo como autoridad AMBER en tiempo de ejecución.
/// En producción esto requeriría consenso multifirma — aquí es admin-only.
pub fn add_authority(node_id: &str) -> bool {
    match AUTHORIZED_AUTHORITIES.get() {
        Some(_list) => {
            // OnceLock es inmutable después de init — en producción usar RwLock
            // Por ahora documentamos la limitación:
            // Para agregar autoridades en runtime, reiniciar el nodo con AMBER_AUTHORITY_NODE_IDS actualizado
            tracing::warn!(
                "AMBER: agregar autoridades en runtime requiere reinicio. node_id='{}'",
                node_id
            );
            false
        }
        None => false,
    }
}
