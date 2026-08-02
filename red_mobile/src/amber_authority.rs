//! Autoridades AMBER-RED — Gestión de nodos autorizados para emitir alertas
//! En modo dev: auto-incluye el nodo local para poder testear.

use std::sync::OnceLock;

static AUTHORIZED_AUTHORITIES: OnceLock<Vec<String>> = OnceLock::new();

pub fn initialize_authorities(local_node_id: &str) {
    let _ = AUTHORIZED_AUTHORITIES.get_or_init(|| {
        let mut list: Vec<String> = Vec::new();

        if let Ok(env_ids) = std::env::var("AMBER_AUTHORITY_NODE_IDS") {
            for id in env_ids.split(',') {
                let trimmed = id.trim().to_string();
                if !trimmed.is_empty() {
                    list.push(trimmed);
                }
            }
        }

        // Dev mode: siempre incluir el nodo local como autoridad
        let dev_mode = std::env::var("AMBER_DEV_MODE")
            .map(|v| v == "1" || v.to_lowercase() == "true")
            .unwrap_or(true);

        if dev_mode && !list.contains(&local_node_id.to_string()) {
            list.push(local_node_id.to_string());
        }

        if list.is_empty() {
            list.push(local_node_id.to_string());
        }

        list
    });
}

pub fn is_authorized_authority(node_id: &str) -> bool {
    match AUTHORIZED_AUTHORITIES.get() {
        Some(list) => list.iter().any(|id| id == node_id),
        None => true, // Mobile: sin init, permitir en dev mode
    }
}

pub fn list_authorities() -> Vec<String> {
    AUTHORIZED_AUTHORITIES.get().cloned().unwrap_or_default()
}
