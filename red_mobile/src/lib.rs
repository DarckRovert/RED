use jni::JNIEnv;
use jni::objects::{JClass, JString};
use std::path::PathBuf;
use tracing::{info, error, warn};

use red_core::storage::Storage;
use red_core::identity::Identity;
use red_core::network::{Node, NetworkConfig};
use std::sync::Arc;
use tokio::sync::Mutex;
use ed25519_dalek::SigningKey;

mod api;

// Bootstrap nodes for the RED network.
// These are well-known peers that help new nodes discover the network.
// UPDATE these with real bootstrap node addresses when deploying to production.
const BOOTSTRAP_NODES: &[&str] = &[
    // Add real bootstrap node addresses here:
    // "1.2.3.4:7331",
    // "5.6.7.8:7331",
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
            // Use a simple format suitable for Android logcat
            .without_time()
            .init();
    });

    // Prevent double-start if the JNI method is called again
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

    // Set panic hook to write to a visible file for debugging silent android crashes
    let panic_dir = data_dir.clone();
    std::panic::set_hook(Box::new(move |info| {
        let _ = std::fs::write(panic_dir.join("PANIC_DUMP.txt"), format!("{}", info));
    }));

    // Start background node thread
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

async fn run_internal_node(data_dir: PathBuf, password_str: String) -> anyhow::Result<()> {
    info!("Checking Android internal storage...");
    let _ = std::fs::create_dir_all(&data_dir);

    // Initialize storage
    let key = red_core::crypto::hashing::derive_symmetric_key(
        password_str.as_bytes(),
        b"red-salt",
        b"storage-key",
    ).unwrap();
    let mut storage = Storage::new(data_dir.join("storage"), key);
    storage.open()?;
    let storage_arc = Arc::new(Mutex::new(storage));

    // Get or Create Identity
    let identity = {
        let mut s = storage_arc.lock().await;
        if let Some(id) = s.get_identity().cloned() {
            id
        } else {
            let id = Identity::generate().unwrap();
            let _ = s.set_identity(id.clone());
            id
        }
    };

    // Initialize blockchain
    info!("Initializing blockchain...");
    let blockchain_path = data_dir.join("blockchain");
    let chain = red_blockchain::chain::Chain::open(blockchain_path)?;
    info!("Blockchain initialized at height {}", chain.height());

    let mut network_config = NetworkConfig::new(4556);
    for addr_str in BOOTSTRAP_NODES {
        if let Ok(addr) = addr_str.parse() {
            network_config = network_config.with_bootstrap_node(addr);
        }
    }

    let node = Node::new(identity.clone(), network_config, storage_arc.clone())?;
    let node = Arc::new(Mutex::new(node));

    let consensus = Arc::new(red_blockchain::consensus::Consensus::new());
    consensus.register_validator(*identity.public_key().as_bytes(), 1_000_000_000_000)?;
    let chain = Arc::new(chain);

    let signing_key_bytes = identity.signing_key_bytes();
    let signing_key = SigningKey::from_bytes(&signing_key_bytes);
    let consensus_clone = consensus.clone();
    let chain_clone = chain.clone();
    tokio::spawn(async move {
        consensus_clone.run_block_production(chain_clone, signing_key).await;
    });

    let (msg_tx, _) = tokio::sync::broadcast::channel(100);
    let msg_tx_api = msg_tx.clone();

    {
        let mut n = node.lock().await;
        n.set_msg_notifier(msg_tx);
    }

    // ── CRITICAL FIX ──────────────────────────────────────────────────────────
    // Launch the HTTP API IMMEDIATELY on a separate task so the UI can reach
    // /api/status as soon as the app opens — without waiting for the P2P layers.
    // The node's `is_running` flag will be false initially, but the API is alive.
    // ──────────────────────────────────────────────────────────────────────────
    let api_node = node.clone();
    let api_msg_tx = msg_tx_api.clone();
    tokio::spawn(async move {
        let state = api::ApiState {
            node: api_node,
            msg_tx: api_msg_tx,
        };
        let router = api::build_router(state);
        let http_addr = "127.0.0.1:4555";
        match tokio::net::TcpListener::bind(http_addr).await {
            Ok(listener) => {
                info!("Android Axum REST API listening on {}", http_addr);
                if let Err(e) = axum::serve(listener, router).await {
                    error!("Axum HTTP server error: {:?}", e);
                }
            }
            Err(e) => error!("Failed to bind HTTP API on {}: {:?}", http_addr, e),
        }
    });

    // Start P2P node on a background thread (non-blocking for the API)
    let node_for_event = node.clone();
    tokio::spawn(async move {
        match Node::start(node_for_event.clone()).await {
            Ok(_) => {
                info!("P2P node started, running event loop");
                Node::start_event_loop(node_for_event).await;
            }
            Err(e) => error!("P2P node failed to start: {:?}", e),
        }
    });

    // Keep the runtime alive indefinitely as long as the service is running
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}

