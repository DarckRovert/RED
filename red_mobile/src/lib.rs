#![allow(dead_code, unused_imports, missing_docs, unused_variables, deprecated, clippy::manual_strip, clippy::unnecessary_sort_by, clippy::needless_range_loop, clippy::manual_checked_ops, clippy::collapsible_if)]
use jni::JNIEnv;
use jni::objects::{JClass, JString};
use std::path::PathBuf;
use tracing::{info, error, warn};
use std::sync::Arc;
use tokio::sync::Mutex;
use ed25519_dalek::SigningKey;

mod api;
pub mod ai_copilot;
pub mod ai_summarizer;
pub mod ai_translator;
pub mod amber;
pub mod amber_authority;
pub mod battery;
pub mod channels;
pub mod discovery;
pub mod embeddings;
pub mod ephemeral;
pub mod guardian;
pub mod sanitizer;
pub mod sos;
pub mod voice;
pub mod weather;


// Nodos Semilla Mundiales — Bootstrap peers oficiales de libp2p/IPFS.
// Mantenidos por Protocol Labs. Proveen descubrimiento Kademlia global
// y actúan como relay para atravesar NAT 4G sin servidor central propio.
// Fuente: https://github.com/libp2p/go-libp2p/blob/master/config/config.go
const BOOTSTRAP_NODES: &[&str] = &[
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTKI8XwOSPNKZbPEmLkXNA5yRxklDDe",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXDDts6X9R2kS",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6yHzpnVgG9fB5UrD62gJLqDKtv",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
    "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
    "/ip4/104.131.131.82/udp/4001/quic-v1/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
];

static ONCE: std::sync::Once = std::sync::Once::new();
static NODE_STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static GLOBAL_API_STATE: std::sync::OnceLock<Arc<tokio::sync::Mutex<Option<api::ApiState>>>> = std::sync::OnceLock::new();
static GLOBAL_TOKIO_HANDLE: std::sync::OnceLock<tokio::runtime::Handle> = std::sync::OnceLock::new();

#[no_mangle]
pub extern "system" fn Java_f_red_app_RedNodePlugin_updateBatteryStatus(
    _env: JNIEnv,
    _class: JClass,
    level: jni::sys::jint,
) {
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        if let Some(state_arc) = GLOBAL_API_STATE.get() {
            if let Ok(s) = state_arc.try_lock() {
                if let Some(ref api_state) = *s {
                    api_state.battery_optimizer.update_battery(level as u8);
                    tracing::info!("JNI updated battery to {}%", level);
                }
            }
        }
    }));
}

#[no_mangle]
pub extern "system" fn Java_f_red_app_RedNodePlugin_injectBlePayload(
    env: JNIEnv,
    _class: JClass,
    payload_jbytes: jni::objects::JByteArray,
    _from_device_jstr: JString,
) {
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let payload_bytes = match env.convert_byte_array(&payload_jbytes) {
            Ok(b) => b,
            Err(e) => {
                error!("injectBlePayload: failed to convert byte array from JNI: {:?}", e);
                return;
            }
        };

        if payload_bytes.is_empty() {
            return;
        }

        if let Some(state_arc) = GLOBAL_API_STATE.get() {
            if let Some(handle) = GLOBAL_TOKIO_HANDLE.get() {
                let state_arc_clone = state_arc.clone();
                handle.spawn(async move {
                    let state_guard = state_arc_clone.lock().await;
                    if let Some(ref api_state) = *state_guard {
                        let node_arc = api_state.node.clone();
                        drop(state_guard);
                        let mut node = node_arc.lock().await;
                        if let Err(e) = node.inject_raw_payload(payload_bytes).await {
                            error!("injectBlePayload: failed to inject payload into node: {:?}", e);
                        } else {
                            tracing::debug!("injectBlePayload: successfully injected BLE payload into Rust node");
                        }
                    }
                });
            } else {
                warn!("injectBlePayload: Tokio runtime handle not yet initialized — skipping payload");
            }
        }
    }));
}

#[no_mangle]
pub extern "system" fn Java_f_red_app_RedNodePlugin_startNode(
    mut env: JNIEnv,
    _class: JClass,
    data_dir_jstr: JString,
    password_jstr: JString,
) {
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        ONCE.call_once(|| {
            android_logger::init_once(
                android_logger::Config::default()
                    .with_max_level(log::LevelFilter::Trace)
                    .with_tag("rust"),
            );
        });

        if NODE_STARTED.load(std::sync::atomic::Ordering::SeqCst) {
            warn!("startNode called but node is already running — ignoring");
            return;
        }

        let data_dir_str: String = match env.get_string(&data_dir_jstr) {
            Ok(s) => s.into(),
            Err(e) => {
                error!("Failed to get data_dir string from Java: {:?}", e);
                return;
            }
        };
            
        let password_str: String = match env.get_string(&password_jstr) {
            Ok(s) => s.into(),
            Err(e) => {
                error!("Failed to get password string from Java: {:?}", e);
                return;
            }
        };

        let data_dir = PathBuf::from(data_dir_str.clone());
        info!("Starting internal RED node at {:?}", data_dir);

        let panic_dir = data_dir.clone();
        std::panic::set_hook(Box::new(move |info| {
            let _ = std::fs::write(panic_dir.join("PANIC_DUMP.txt"), format!("{}", info));
        }));

        std::thread::spawn(move || {
            let rt = match tokio::runtime::Runtime::new() {
                Ok(r) => r,
                Err(e) => {
                    error!("Failed to create Tokio runtime for internal node: {:?}", e);
                    NODE_STARTED.store(false, std::sync::atomic::Ordering::SeqCst);
                    return;
                }
            };
            let _ = GLOBAL_TOKIO_HANDLE.set(rt.handle().clone());
            rt.block_on(async {
                match run_internal_node(data_dir.clone(), password_str).await {
                    Ok(_) => {
                        info!("Internal RED node exited cleanly");
                        let _ = std::fs::write(data_dir.join("CRASH_DUMP.txt"), "Exited cleanly");
                    }
                    Err(e) => {
                        error!("Internal node crashed: {:?}", e);
                        let _ = std::fs::write(data_dir.join("CRASH_DUMP.txt"), format!("CRASH:\n{:#?}", e));
                    }
                }
            });
            NODE_STARTED.store(false, std::sync::atomic::Ordering::SeqCst);
        });
        NODE_STARTED.store(true, std::sync::atomic::Ordering::SeqCst);
    }));
}

#[no_mangle]
pub extern "system" fn Java_f_red_app_RedNodePlugin_destroyNode(
    mut env: JNIEnv,
    _class: JClass,
    data_dir_jstr: JString,
) {
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let data_dir_str: String = match env.get_string(&data_dir_jstr) {
            Ok(s) => s.into(),
            Err(e) => {
                error!("destroyNode: failed to read data_dir from JNI: {:?}", e);
                return;
            }
        };

        let base_dir = PathBuf::from(&data_dir_str);
        error!("🔴 PANIC WIPE INITIATED — destroying all data at {:?}", base_dir);

        for dir in [base_dir.clone(), PathBuf::from(format!("{}_decoy", data_dir_str))] {
            if dir.exists() {
                if let Err(e) = std::fs::remove_dir_all(&dir) {
                    error!("Failed to remove {:?}: {:?}", dir, e);
                } else {
                    info!("Destroyed {:?}", dir);
                }
            }
        }

        NODE_STARTED.store(false, std::sync::atomic::Ordering::SeqCst);
        error!("🔴 PANIC WIPE COMPLETE");
    }));
}


/// Write a timestamped log line to DEBUG_TRACE.txt in the node data dir.
/// Android suppresses stdout from JNI libs, so this is our only way
/// to see what's happening at runtime on a real device.
fn append_log(data_dir: &std::path::Path, msg: &str) {
    let path = data_dir.join("DEBUG_TRACE.txt");
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let line = format!("[{}] {}\n", now, msg);
    // Use append mode so every boot accumulates its trace
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = f.write_all(line.as_bytes());
    }

    let level = if msg.contains("FATAL") || msg.contains("ERROR") || msg.contains("crashed") {
        "ERROR"
    } else if msg.contains("WARN") || msg.contains("panic") {
        "WARN"
    } else if msg.contains("P2P") || msg.contains("mDNS") || msg.contains("BLE") || msg.contains("Swarm") {
        "P2P"
    } else if msg.contains("storage") || msg.contains("key") || msg.contains("identity") || msg.contains("PoW") {
        "CRYPTO"
    } else if msg.contains("consensus") || msg.contains("blockchain") {
        "CONSENSUS"
    } else {
        "INFO"
    };

    api::record_log_sync(level, "red_mobile::boot", msg);
}

async fn run_internal_node(data_dir: PathBuf, password_str: String) -> anyhow::Result<()> {
    let build_ts = env!("CARGO_PKG_VERSION");
    append_log(&data_dir, "=== RED NODE BOOT START ===");
    append_log(&data_dir, &format!("Build Version (SemVer): {}", build_ts));
    append_log(&data_dir, &format!("Boot timestamp: {}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()));
    let _ = std::fs::create_dir_all(&data_dir);

    // Derive storage key (fast, pure CPU, ok on async thread)
    // SALT must match node/src/main.rs get_storage_key() exactly so that
    // a node initialized on desktop and opened on mobile uses the same key.
    append_log(&data_dir, "Deriving storage key...");
    let key = red_core::crypto::hashing::derive_symmetric_key(
        password_str.as_bytes(),
        b"red-storage-salt-v1",
        b"storage-key",
    ).map_err(|_| anyhow::anyhow!("Key derivation failure"))?;
    append_log(&data_dir, "Storage key derived OK");


    // ── ASYNC API BOOT ────────────────────────────────────────────────────────
    // Launch the API server FIRST with an empty state so the frontend can poll
    // /api/status immediately without getting ERR_CONNECTION_REFUSED.
    // ──────────────────────────────────────────────────────────────────────────
    let (msg_tx, _) = tokio::sync::broadcast::channel(100);
    let api_state = Arc::new(Mutex::new(None));
    let _ = GLOBAL_API_STATE.set(api_state.clone());
    
    let api_state_clone = api_state.clone();
    let msg_tx_clone = msg_tx.clone();
    let api_log_dir = data_dir.clone();

    tokio::spawn(async move {
        let http_addr = "127.0.0.1:7333";
        append_log(&api_log_dir, &format!("Binding Axum server on {} (Loopback Local Only)...", http_addr));
        let app = api::build_router_async(api_state_clone, msg_tx_clone);
        match tokio::net::TcpListener::bind(http_addr).await {
            Ok(listener) => {
                append_log(&api_log_dir, "Axum server BOUND and LISTENING on 127.0.0.1:7333 OK");
                if let Err(e) = axum::serve(listener, app).await {
                    let msg = format!("Axum serve error: {}", e);
                    append_log(&api_log_dir, &msg);
                }
            }
            Err(e) => {
                let msg = format!("FATAL: Failed to bind HTTP on {}: {:?}", http_addr, e);
                append_log(&api_log_dir, &msg);
                let _ = std::fs::write(api_log_dir.join("API_BIND_ERROR.txt"), &msg);
            }
        }
    });
    append_log(&data_dir, "Axum task spawned. Proceeding to storage init...");

    // ── BLOCKING I/O IN DEDICATED THREADS ────────────────────────────────────
    // Storage::open() and Identity::generate() are BLOCKING operations.
    // Calling them directly on the Tokio async thread starves the executor
    // and prevents the Axum server task above from being scheduled.
    // spawn_blocking sends them to a separate thread pool.
    // ──────────────────────────────────────────────────────────────────────────
    append_log(&data_dir, "Opening storage (spawn_blocking)...");
    let storage_data_dir = data_dir.join("storage");
    let storage_result = tokio::task::spawn_blocking(move || {
        let mut storage = red_core::storage::Storage::new(storage_data_dir, key);
        storage.open()?;
        Ok::<_, anyhow::Error>(storage)
    }).await.map_err(|e| anyhow::anyhow!("Storage thread panic: {:?}", e))??;
    append_log(&data_dir, "Storage opened OK");
    let storage_arc = Arc::new(Mutex::new(storage_result));

    append_log(&data_dir, "Loading or validating identity (spawn_blocking)...");
    let identity = {
        let s = storage_arc.lock().await;
        let has_saved_identity = s.has_raw_entry("identity", b"user_identity");
        if has_saved_identity {
            match s.try_get_identity() {
                Ok(Some(id)) => {
                    append_log(&data_dir, &format!("Existing identity authenticated & loaded: {}", id.identity_hash().short()));
                    id
                }
                Ok(None) => {
                    return Err(anyhow::anyhow!("Storage corruption: Identity entry exists but returned empty."));
                }
                Err(err) => {
                    let msg = format!("FATAL: Storage decryption failed ({:?}) — Incorrect PIN / Master Password.", err);
                    append_log(&data_dir, &msg);
                    return Err(anyhow::anyhow!(msg));
                }
            }
        } else {
            append_log(&data_dir, "No identity found — generating fresh identity via PoW (First Boot)...");
            drop(s); // Release lock before blocking
            let id = tokio::task::spawn_blocking(|| {
                red_core::identity::Identity::generate()
                    .map_err(|e| anyhow::anyhow!("Identity gen fail: {:?}", e))
            }).await.map_err(|e| anyhow::anyhow!("Identity thread panic: {:?}", e))??;
            append_log(&data_dir, "IDENTITY PoW COMPLETE OK");
            {
                let mut s2 = storage_arc.lock().await;
                let _ = s2.set_identity(id.clone());
            }
            append_log(&data_dir, &format!("New identity generated and saved: {}", id.identity_hash().short()));
            id
        }
    };

    append_log(&data_dir, "Initializing blockchain...");
    let blockchain_path = data_dir.join("blockchain");
    let chain = red_blockchain::chain::Chain::open(blockchain_path)?;
    let chain_arc = Arc::new(chain);
    append_log(&data_dir, "Blockchain OK");

    append_log(&data_dir, "Configuring P2P network...");
    let mut network_config = red_core::network::NetworkConfig::new(7331)
        .with_data_dir(data_dir.clone());
    for addr_str in BOOTSTRAP_NODES {
        if let Ok(addr) = addr_str.parse() {
            network_config = network_config.with_bootstrap_node(addr);
        }
    }

    let node = red_core::network::Node::new(identity.clone(), network_config, storage_arc.clone())?;
    let node_arc = Arc::new(Mutex::new(node));

    {
        let mut n = node_arc.lock().await;
        n.set_msg_notifier(msg_tx.clone());
    }

    append_log(&data_dir, "Initializing consensus...");
    let consensus = Arc::new(red_blockchain::consensus::Consensus::new());
    consensus.register_validator(*identity.public_key().as_bytes(), 1_000_000_000_000)?;

    let signing_key_bytes = identity.signing_key_bytes();
    let signing_key = SigningKey::from_bytes(&signing_key_bytes);
    let consensus_cb = consensus.clone();
    let chain_cb = chain_arc.clone();
    tokio::spawn(async move {
        consensus_cb.run_block_production(chain_cb, signing_key).await;
    });

    // ── Background Storage Maintenance Worker (Prunes expired records every 24h) ──
    let maint_storage = storage_arc.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(86400));
        loop {
            interval.tick().await;
            let s = maint_storage.lock().await;
            let _ = s.prune_expired_records(30 * 86400); // 30 days default retention policy
        }
    });

    // ── FINAL STATE READY — API now returns live data ─────────────────────────
    let api_key = {
        let mut hasher = blake3::Hasher::new();
        hasher.update(identity.identity_hash().as_bytes());
        hasher.update(b"red-api-v1-key-salt"); 
        let hash = hasher.finalize();
        *hash.as_bytes()
    };
    info!("API Key derived (persisted for this identity)");

    {
        let mut s = api_state.lock().await;
        *s = Some(api::ApiState {
            node: node_arc.clone(),
            msg_tx: msg_tx.clone(),
            chain: chain_arc.clone(),
            consensus: consensus.clone(),
            api_key,
            sos_store: sos::SosStore::new(),
            channel_store: channels::ChannelStore::new(),
            voice_store: voice::VoiceStore::new(),
            weather_store: weather::WeatherStore::new(),
            discovery_engine: discovery::DiscoveryEngine::new(),
            battery_optimizer: battery::BatteryOptimizer::new(),
            ephemeral_purge: ephemeral::EphemeralPurgeEngine::new(),
            ai_copilot: Arc::new(ai_copilot::AICopilotEngine::new()),
            ai_summarizer: Arc::new(ai_summarizer::AISummarizerEngine::new()),
            ai_translator: Arc::new(ai_translator::AITranslatorEngine::new()),
            amber_store: amber::AmberStore::new(),
            guardian_engine: Arc::new(guardian::GuardianEngine::from_env()),
            logs: api::get_or_init_global_logs(),
        });
    }

    append_log(&data_dir, "=== NODE FULLY INITIALIZED — API SERVING LIVE DATA ===");

    // Background Mesh Message Dispatcher (for Weather Reports, CAP alerts, etc.)
    let mut mesh_rx = msg_tx.subscribe();
    let api_state_mesh = api_state.clone();
    tokio::spawn(async move {
        while let Ok(msg) = mesh_rx.recv().await {
            if let red_core::protocol::MessageType::WeatherReport(payload) = &msg.content {
                if let Ok(report) = serde_json::from_slice::<crate::weather::WeatherReport>(payload) {
                    let state_guard = api_state_mesh.lock().await;
                    if let Some(state) = state_guard.as_ref() {
                        state.weather_store.add_report_raw(report);
                        info!("Received & stored incoming mesh Weather Report/CAP Alert");
                    }
                }
            }
        }
    });

    // Start P2P event loop
    let node_loop = node_arc.clone();
    let log_dir_loop = data_dir.clone();
    tokio::spawn(async move {
        append_log(&log_dir_loop, "Starting P2P Node Event Loop...");
        match red_core::network::Node::start(node_loop.clone()).await {
            Ok(_) => {
                append_log(&log_dir_loop, "P2P Node STARTED OK. Entering Event Loop...");
                red_core::network::Node::start_event_loop(node_loop).await;
            }
            Err(e) => {
                let msg = format!("FATAL ERROR: P2P node failed to start: {:?}", e);
                append_log(&log_dir_loop, &msg);
                error!("{}", msg);
            }
        }
    });

    // Keep runtime alive
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}


