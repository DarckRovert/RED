//! Rate limiting middleware for RED node API.
//!
//! Implements a simple token-bucket rate limiter using in-memory state.
//! Limits requests per IP to prevent API abuse.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::{
    extract::{ConnectInfo, Request, State as AxumState},
    http::{StatusCode, HeaderMap},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::net::SocketAddr;
use tracing::warn;

/// Rate limiter state (token bucket per IP)
#[derive(Clone)]
pub struct RateLimiter {
    inner: Arc<Mutex<HashMap<String, BucketState>>>,
    /// Maximum requests per window
    max_requests: u32,
    /// Window duration
    window: Duration,
}

struct BucketState {
    count: u32,
    window_start: Instant,
}

impl RateLimiter {
    /// Create a new rate limiter
    /// - `max_requests`: max requests per `window`
    /// - `window`: duration of the window (e.g., 60 seconds)
    pub fn new(max_requests: u32, window: Duration) -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window,
        }
    }

    /// Check if the given key (IP) is within the rate limit.
    /// Returns `true` if allowed, `false` if rate-limited.
    pub fn check(&self, key: &str) -> bool {
        let mut map = self.inner.lock().unwrap();
        let now = Instant::now();

        let entry = map.entry(key.to_string()).or_insert(BucketState {
            count: 0,
            window_start: now,
        });

        // Reset window if expired
        if now.duration_since(entry.window_start) >= self.window {
            entry.count = 0;
            entry.window_start = now;
        }

        if entry.count < self.max_requests {
            entry.count += 1;
            true
        } else {
            false
        }
    }

    /// Periodically clean up old entries (call from a background task)
    pub fn cleanup(&self) {
        let mut map = self.inner.lock().unwrap();
        let now = Instant::now();
        map.retain(|_, v| now.duration_since(v.window_start) < self.window * 2);
    }
}

/// Axum middleware that enforces rate limiting.
/// - 200 req/minute for localhost (generous for the native app)
/// - 30 req/minute for any other origin (shouldn't happen, but just in case)
pub async fn rate_limit_middleware(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    AxumState(limiter): AxumState<RateLimiter>,
    request: Request,
    next: Next,
) -> Response {
    let ip = addr.ip().to_string();
    let limit = if addr.ip().is_loopback() { 200 } else { 30 };

    // We use a custom check with per-ip limit
    let allowed = {
        let mut map = limiter.inner.lock().unwrap();
        let now = Instant::now();
        let entry = map.entry(ip.clone()).or_insert(BucketState {
            count: 0,
            window_start: now,
        });
        if now.duration_since(entry.window_start) >= limiter.window {
            entry.count = 0;
            entry.window_start = now;
        }
        if entry.count < limit {
            entry.count += 1;
            true
        } else {
            false
        }
    };

    if allowed {
        next.run(request).await
    } else {
        warn!("Rate limit exceeded for IP: {}", ip);
        (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({"error": "Rate limit exceeded. Please slow down."})),
        ).into_response()
    }
}
