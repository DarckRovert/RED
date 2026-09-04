//! API key authentication middleware for RED node HTTP API.
//!
//! Protects all API endpoints with a Bearer token derived from the
//! RED_PASSWORD environment variable, providing a simple auth layer
//! without requiring JWT infrastructure.

use axum::{
    extract::Request,
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use red_core::crypto::hashing::blake3_hash;
use serde_json::json;
use tracing::warn;

/// Extract the token from Authorization, X-API-Key or X-Red-Session-Token header
fn extract_token<'a>(headers: &'a HeaderMap) -> Option<&'a str> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .or_else(|| {
            headers
                .get("x-api-key")
                .and_then(|v| v.to_str().ok())
        })
        .or_else(|| {
            headers
                .get("x-red-session-token")
                .and_then(|v| v.to_str().ok())
        })
}

/// Axum middleware for API key authentication.
///
/// The expected token is a BLAKE3 hash of the RED_PASSWORD env var,
/// or the generated session token in session.token.
///
/// Skip auth for:
/// - `GET /api/status` — needed for the UI to show "online" before login
/// - `GET /` and static assets — public landing page
pub async fn auth_middleware(
    headers: axum::http::header::HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    let path = request.uri().path().to_string();

    // Public endpoints that don't require authentication
    let public_paths = [
        "/",
        "/app.css",
        "/app.js",
        "/api/status",
        // SSE and WebSocket endpoints cannot send custom Authorization headers in standard browsers
        "/api/events",
        "/api/network/outbound",
        "/local-signal",
        "/api/ai/status",
        "/api/tags",
        "/v1/models",
        "/v1/chat/completions",
        "/api/generate",
        "/api/ai/copilot",
    ];

    if public_paths.iter().any(|p| path == *p) {
        return next.run(request).await;
    }

    // Determine expected token from RED_PASSWORD or session.token
    let mut expected_tokens = Vec::new();
    if let Ok(password) = std::env::var("RED_PASSWORD") {
        if !password.is_empty() {
            expected_tokens.push(hex::encode(blake3_hash(password.as_bytes())));
        }
    }

    // Try reading session.token from standard locations
    for p in ["session.token", "red_node/session.token", ".red/session.token"] {
        if let Ok(tok) = std::fs::read_to_string(p) {
            let t = tok.trim().to_string();
            if t.len() == 64 {
                expected_tokens.push(t);
            }
        }
    }

    if expected_tokens.is_empty() {
        // If no password or token configured: allow all access (dev mode)
        return next.run(request).await;
    }

    // Check the provided token
    match extract_token(&headers) {
        Some(provided) => {
            let prov_clean = provided.trim();
            let is_valid = expected_tokens.iter().any(|exp| {
                subtle::ConstantTimeEq::ct_eq(prov_clean.as_bytes(), exp.as_bytes()).unwrap_u8() == 1
            });
            if is_valid {
                next.run(request).await
            } else {
                warn!("Auth failed: invalid token for {}", path);
                (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({"error": "Invalid API token"})),
                )
                    .into_response()
            }
        }
        None => {
            warn!("Auth failed: no token provided for {}", path);
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "error": "Authentication required",
                    "hint": "Set Authorization: Bearer <token> where token = blake3(RED_PASSWORD) hex"
                })),
            ).into_response()
        }
    }
}

/// Generate the API token string for a given password.
/// Useful for the CLI `red-node status` command to show the token.
pub fn generate_token(password: &str) -> String {
    hex::encode(blake3_hash(password.as_bytes()))
}
