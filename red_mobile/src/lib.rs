use jni::JNIEnv;
use jni::objects::{JClass, JString};
use std::path::PathBuf;
use tracing::{info, error, warn};
use std::sync::Arc;
use tokio::sync::Mutex;
use ed25519_dalek::SigningKey;

mod api;

// Bootstrap nodes for the RED network.
const BOOTSTRAP_NODES: &[&str] = &[
    "157.230.29.114:7331", // RED Bootstrap Seed #1 (Simulated)
];

static ONCE: std::sync::Once = std::sync::Once::new();
static NODE_STARTED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[no_mangle]
pub extern "system" fn Java_f_red_app_RedNodePlugin_startNode(
    mut env: JNIEnv,
    _class: JClass,
    data_dir_jstr: JString,
    password_jstr: JString,
) {
    ONCE.call_once(|| {
        tracing_subscriber::fmt()
            .with_max_level(tracing::Level::DEBUG)
            .without_time()
            .init();
    });

    if NODE_STARTED.load(std::sync::atomic::Ordering::SeqCst) {
        warn!("startNode called but node is already running — ignoring");
        return;
    }

    let data_dir_str: String = env.get_string(&data_dir_jstr)
        .expect("Couldn't get java string!")
        .into();
        
    let password_str: String = env.get_string(&password_jstr)
        .expect("Couldn't get password string!")
        .into();

    let data_dir = PathBuf::from(data_dir_str.clone());
    info!("Starting internal RED node at {:?}", data_dir);

    let panic_dir = data_dir.clone();
    std::panic::set_hook(Box::new(move |info| {
        let _ = std::fs::write(panic_dir.join("PANIC_DUMP.txt"), format!("{}", info));
    }));

    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
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
}

#[no_mangle]
pub extern "system" fn Java_f_red_app_RedNodePlugin_destroyNode(
    mut env: JNIEnv,
    _class: JClass,
    data_dir_jstr: JString,
) {
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
}

async fn run_internal_node(data_dir: PathBuf, password_str: String) -> anyhow::Result<()> {
    append_log(&data_dir, "=== RED NODE BOOT START ===");
    let _ = std::fs::create_dir_all(&data_dir);

    // Derive storage key (fast, pure CPU, ok on async thread)
    append_log(&data_dir, "Deriving storage key...");
    let key = red_core::crypto::hashing::derive_symmetric_key(
        password_str.as_bytes(),
        b"red-salt",
        b"storage-key",
    ).map_err(|_| anyhow::anyhow!("Key derivation failure"))?;
    append_log(&data_dir, "Storage key derived OK");

    // ── ASYNC API BOOT ────────────────────────────────────────────────────────
    // Launch the API server FIRST with an empty state so the frontend can poll
    // /api/status immediately without getting ERR_CONNECTION_REFUSED.
    // ──────────────────────────────────────────────────────────────────────────
    let (msg_tx, _) = tokio::sync::broadcast::channel(100);
    let api_state = Arc::new(Mutex::new(None));
    let api_state_clone = api_state.clone();
    let msg_tx_clone = msg_tx.clone();
    let api_log_dir = data_dir.clone();

    tokio::spawn(async move {
        let http_addr = "0.0.0.0:7333";
        append_log(&api_log_dir, &format!("Binding Axum server on {}...", http_addr));
        let app = api::build_router_async(api_state_clone, msg_tx_clone);
        match tokio::net::TcpListener::bind(http_addr).await {
            Ok(listener) => {
                append_log(&api_log_dir, "Axum server BOUND and LISTENING OK");
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

    append_log(&data_dir, "Loading or generating identity (spawn_blocking)...");
    let identity = {
        let mut s = storage_arc.lock().await;
        if let Some(id) = s.get_identity().cloned() {
            append_log(&data_dir, &format!("Existing identity loaded: {}", id.identity_hash().short()));
            id
        } else {
            append_log(&data_dir, "No identity found — generating via PoW (this takes time)...");
            drop(s); // Release lock before blocking
            let id = tokio::task::spawn_blocking(|| {
                red_core::identity::Identity::generate()
                    .map_err(|e| anyhow::anyhow!("Identity gen fail: {:?}", e))
            }).await.map_err(|e| anyhow::anyhow!("Identity thread panic: {:?}", e))??;
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
    let mut network_config = red_core::network::NetworkConfig::new(4556);
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

    // ── FINAL STATE READY — API now returns live data ─────────────────────────
    {
        let mut s = api_state.lock().await;
        *s = Some(api::ApiState {
            node: node_arc.clone(),
            msg_tx: msg_tx.clone(),
            chain: chain_arc.clone(),
            consensus: consensus.clone(),
        });
    }
    append_log(&data_dir, "=== NODE FULLY INITIALIZED — API SERVING LIVE DATA ===");

    // Start P2P event loop
    let node_loop = node_arc.clone();
    tokio::spawn(async move {
        match red_core::network::Node::start(node_loop.clone()).await {
            Ok(_) => red_core::network::Node::start_event_loop(node_loop).await,
            Err(e) => error!("P2P node failed to start: {:?}", e),
        }
    });

    // Keep runtime alive
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}


