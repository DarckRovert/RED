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
use serde_json::json;
use tracing::warn;
use red_core::crypto::hashing::blake3_hash;

/// Extract the Bearer token from Authorization header
fn extract_bearer(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
}

/// Axum middleware for API key authentication.
///
/// The expected token is a BLAKE3 hash of the RED_PASSWORD env var,
/// hex-encoded. This way the password itself is never sent over the wire.
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
    ];

    if public_paths.iter().any(|p| path == *p) {
        return next.run(request).await;
    }

    // Get expected token from environment
    let password = match std::env::var("RED_PASSWORD").ok() {
        Some(p) if !p.is_empty() => p,
        _ => {
            // If no password is set, allow all access (dev mode)
            return next.run(request).await;
        }
    };

    // Derive the expected token: BLAKE3(password)
    let expected_token = hex::encode(blake3_hash(password.as_bytes()));

    // Check the provided token
    match extract_bearer(&headers) {
        Some(provided) if provided == expected_token => {
            next.run(request).await
        }
        Some(_) => {
            warn!("Auth failed: invalid token for {}", path);
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid API token"})),
            ).into_response()
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
