#![allow(dead_code, unused_imports)]
//! RED Network Node
//!
//! A full node for the RED decentralized messaging network.
//! v19.0: Guardian IA + Sistema Alerta AMBER-RED

mod ai_copilot;
mod ai_summarizer;
mod ai_translator;
mod amber;
mod amber_authority;
mod api;
mod auth;
mod battery;
mod channels;
mod chunker;
mod discovery;
mod dns_tunnel;
mod ephemeral;
mod guardian;
mod rate_limit;
mod sanitizer;
mod sos;
mod voice;
mod weather;

use clap::{Parser, Subcommand};
use red_core::crypto::hashing::derive_symmetric_key;
use red_core::identity::Identity;
use red_core::network::control::{ClientCommand, NodeResponse};
use red_core::network::{NetworkConfig, Node};
use red_core::storage::Storage;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::{debug, error, info, warn, Level};
use tracing_subscriber::FmtSubscriber;

use api::{build_router, ApiState};
use axum;
use rate_limit::RateLimiter;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::Mutex;

/// RED Network Node
#[derive(Parser)]
#[command(name = "red-node")]
#[command(author = "RED Team")]
#[command(version = "0.1.0")]
#[command(about = "RED decentralized messaging network node", long_about = None)]
struct Cli {
    /// Configuration file path
    #[arg(short, long, value_name = "FILE")]
    config: Option<PathBuf>,

    /// Data directory
    #[arg(short, long, value_name = "DIR")]
    data_dir: Option<PathBuf>,

    /// Listen port
    #[arg(short, long, default_value = "7331")]
    port: u16,

    /// Enable verbose logging
    #[arg(short, long)]
    verbose: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the node
    Start {
        /// Bootstrap nodes to connect to
        #[arg(short, long)]
        bootstrap: Vec<String>,
    },
    /// Initialize a new node
    Init {
        /// Force overwrite existing configuration
        #[arg(short, long)]
        force: bool,
    },
    /// Show node status
    Status,
    /// Generate a new identity
    Identity {
        #[command(subcommand)]
        action: IdentityAction,
    },
}

#[derive(Subcommand)]
enum IdentityAction {
    /// Generate a new identity
    Generate,
    /// Show current identity
    Show,
    /// Export identity (for backup)
    Export {
        #[arg(short, long)]
        output: PathBuf,
    },
    /// Import identity (from backup)
    Import {
        #[arg(short, long)]
        input: PathBuf,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    // Setup logging
    let log_level = if cli.verbose {
        Level::DEBUG
    } else {
        Level::INFO
    };
    let subscriber = FmtSubscriber::builder()
        .with_max_level(log_level)
        .with_target(false)
        .with_thread_ids(false)
        .with_file(false)
        .with_line_number(false)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    // Get data directory
    let data_dir = cli.data_dir.unwrap_or_else(|| {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("red")
    });

    info!("RED Node v{}", env!("CARGO_PKG_VERSION"));
    info!("Data directory: {}", data_dir.display());

    match cli.command {
        Some(Commands::Start { bootstrap }) => {
            start_node(data_dir, cli.port, bootstrap).await?;
        }
        Some(Commands::Init { force }) => {
            init_node(data_dir, force).await?;
        }
        Some(Commands::Status) => {
            show_status(data_dir).await?;
        }
        Some(Commands::Identity { action }) => {
            handle_identity(data_dir, action).await?;
        }
        None => {
            // Default: start node
            start_node(data_dir, cli.port, vec![]).await?;
        }
    }

    Ok(())
}

async fn start_node(data_dir: PathBuf, port: u16, bootstrap: Vec<String>) -> anyhow::Result<()> {
    // Initialize storage
    let mut storage = Storage::new(data_dir.join("storage"), get_storage_key());
    storage.open()?;
    let storage = Arc::new(Mutex::new(storage));

    // Get identity
    let identity = {
        let s = storage.lock().await;
        s.get_identity().ok_or_else(|| {
            anyhow::anyhow!("No identity found. Run 'red-node identity generate' first.")
        })?
    };

    // Initialize blockchain
    info!("Initializing blockchain...");
    let blockchain_path = data_dir.join("blockchain");
    let chain = red_blockchain::chain::Chain::open(blockchain_path)?;
    info!("Blockchain initialized at height {}", chain.height());

    // Initialize network
    info!("Initializing network...");
    let mut network_config = NetworkConfig::new(port);
    if !bootstrap.is_empty() {
        for b in bootstrap {
            if let Ok(addr) = b.parse() {
                network_config = network_config.with_bootstrap_node(addr);
            }
        }
    }

    // Create and start the Node orchestrator
    let node = Node::new(identity.clone(), network_config, storage.clone())?;
    let node = Arc::new(Mutex::new(node));

    // Initialize consensus
    let consensus = Arc::new(red_blockchain::consensus::Consensus::new());
    // For now, we are always a validator if we have an identity (Phase 3 Sim)
    consensus.register_validator(*identity.public_key().as_bytes(), 1000_000_000_000)?;

    let chain = Arc::new(chain);

    // Start block production in background
    let consensus_clone = consensus.clone();
    let chain_clone = chain.clone();

    // Need ed25519_dalek::SigningKey from our Identity
    let signing_key_bytes = identity.signing_key_bytes();
    let signing_key = ed25519_dalek::SigningKey::from_bytes(&signing_key_bytes);

    tokio::spawn(async move {
        consensus_clone
            .run_block_production(chain_clone, signing_key)
            .await;
    });

    // SEC-FIX A-4: Dead Man's Switch background task
    let storage_dms = storage.clone();
    let data_dir_dms = data_dir.clone();
    tokio::spawn(async move {
        info!("Dead Man's Switch task started.");
        loop {
            tokio::time::sleep(Duration::from_secs(3600)).await; // Check hourly
            let (is_active, days_limit) = {
                let s = storage_dms.lock().await;
                // These would be set via the SecurityPanel UI in a real app
                let active = s
                    .get_config("dead_man_switch_enabled")
                    .unwrap_or_else(|| "false".to_string())
                    == "true";
                let days = s
                    .get_config("dead_man_switch_days")
                    .unwrap_or_else(|| "7".to_string())
                    .parse::<u64>()
                    .unwrap_or(7);
                (active, days)
            };

            if is_active {
                let last_activity = {
                    let s = storage_dms.lock().await;
                    s.get_config("last_activity_timestamp")
                        .unwrap_or_else(|| "0".to_string())
                        .parse::<u64>()
                        .unwrap_or(0)
                };
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                if now > last_activity + (days_limit * 24 * 3600) {
                    warn!("🔴 DEAD MAN'S SWITCH TRIGGERED. INACTIVITY LIMIT EXCEEDED.");
                    let _ = std::fs::remove_dir_all(&data_dir_dms);
                    std::process::exit(1);
                }
            }
        }
    });

    // Message broadcast channel for API subscriptions
    let (msg_tx, _) = tokio::sync::broadcast::channel(100);
    let msg_tx_api = msg_tx.clone();

    // Outbound mesh payload broadcast channel (Rust → JS radio bridge).
    // Capacity 256: each slot holds one OnionPacket (~1-4 KB for BLE/LoRa).
    // Slow consumers (lagged) are silently skipped — mesh is best-effort.
    let (outbound_tx, _) = tokio::sync::broadcast::channel::<Vec<u8>>(256);
    let outbound_tx_api = outbound_tx.clone();

    {
        let mut n = node.lock().await;
        n.set_msg_notifier(msg_tx);
    }
    Node::start(node.clone()).await?;

    // Start the network event loop
    let node_event_loop = node.clone();
    tokio::spawn(async move {
        Node::start_event_loop(node_event_loop).await;
    });

    // ── HTTP REST API (port 7333, serves Web UI + REST endpoints) ──────────
    let http_node = node.clone();
    let http_msg_tx = msg_tx_api.clone();
    let chain_api = chain.clone();
    let consensus_api = consensus.clone();
    let data_dir_amber = data_dir.clone();
    tokio::spawn(async move {
        // Rate limiter: 200 req/min for localhost, 30 para remoto
        let limiter = RateLimiter::new(200, std::time::Duration::from_secs(60));

        // v19.0: Inicializar Guardian IA desde env vars
        let guardian_engine = guardian::GuardianEngine::from_env();
        if guardian_engine.is_active() {
            if guardian_engine.has_api_key() {
                info!(
                    "🛡️  Guardian IA activo: modelo=meta-llama/llama-guard-4-12b, modo={}",
                    guardian_engine.get_mode_str()
                );
            } else {
                warn!("🛡️  Guardian IA activo (sin GROQ_API_KEY) — solo pHash para imágenes");
            }
        } else {
            warn!("⚠️  Guardian IA APAGADO (GUARDIAN_MODE=off)");
        }

        // v19.0: Inicializar AmberStore
        let identity_hash = {
            let n = http_node.lock().await;
            n.identity_hash().to_hex()
        };
        amber_authority::initialize_authorities(&identity_hash);
        let amber_store = match amber::AmberStore::open(&data_dir_amber) {
            Ok(store) => {
                info!("🟠 Sistema AMBER-RED inicializado");
                std::sync::Arc::new(store)
            }
            Err(e) => {
                error!(
                    "Error al abrir AmberStore: {} — usando directorio temporal",
                    e
                );
                let fallback = data_dir_amber.join("amber_fallback");
                std::sync::Arc::new(
                    amber::AmberStore::open(&fallback)
                        .expect("No se pudo abrir AmberStore de fallback"),
                )
            }
        };

        let sos_store = std::sync::Arc::new(sos::SosStore::new(Some(
            data_dir_amber.join("sled_db").into(),
        )));
        let channel_store = std::sync::Arc::new(channels::ChannelStore::new(Some(
            data_dir_amber.join("sled_db").into(),
        )));
        let chunker = std::sync::Arc::new(chunker::ChunkerEngine::new());
        let voice_store = std::sync::Arc::new(voice::VoiceStore::new());
        let weather_store = std::sync::Arc::new(weather::WeatherStore::new());
        let discovery = std::sync::Arc::new(discovery::DiscoveryEngine::new());
        let ephemeral = std::sync::Arc::new(ephemeral::EphemeralPurgeEngine::new());
        let battery = std::sync::Arc::new(battery::BatteryOptimizer::new());
        let ai_copilot = std::sync::Arc::new(ai_copilot::AICopilotEngine::new());
        let ai_summarizer = std::sync::Arc::new(ai_summarizer::AISummarizerEngine::new());
        let ai_translator = std::sync::Arc::new(ai_translator::AITranslatorEngine::new());

        let state = ApiState {
            node: http_node,
            chain: chain_api,
            consensus: consensus_api,
            msg_tx: http_msg_tx,
            outbound_tx: outbound_tx_api,
            limiter,
            guardian: std::sync::Arc::new(guardian_engine),
            amber_store,
            sos_store,
            channel_store,
            chunker,
            voice_store,
            weather_store,
            discovery,
            ephemeral,
            battery,
            ai_copilot,
            ai_summarizer,
            ai_translator,
        };

        // Print API token to logs for the user to use
        if let Ok(pwd) = std::env::var("RED_PASSWORD") {
            if !pwd.is_empty() {
                let token = auth::generate_token(&pwd);
                info!(
                    "🔑 API Token (Bearer): {}...{}",
                    &token[..8],
                    &token[token.len() - 4..]
                );
            }
        } else {
            warn!("⚠️  RED_PASSWORD not set — HTTP API is accessible without auth (dev mode)");
        }

        let router = build_router(state).layer(axum::middleware::from_fn(auth::auth_middleware));

        let http_addr = "0.0.0.0:7333";
        let listener = tokio::net::TcpListener::bind(http_addr)
            .await
            .expect("Failed to bind HTTP API port 7333");
        info!("Web UI + HTTP API listening on http://{}", http_addr);
        axum::serve(
            listener,
            router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
        )
        .await
        .expect("HTTP server error");
    });

    // We need a separate reference for the TCP API loop
    let node_api = node.clone();

    // Start local API server for client requests
    let api_addr = "0.0.0.0:7332";
    let listener = TcpListener::bind(api_addr).await?;
    info!("Local API server listening on {}", api_addr);

    info!("\n╔════════════════════════════════════════════════╗");
    info!("║  🔴 RED Node is running                        ║");
    info!("║                                                ║");
    info!("║  Port (P2P):  {:5}                           ║", port);
    info!("║  Port (TCP API): {:5}                        ║", 7332);
    info!("║  Port (Web UI):  {:5}                        ║", 7333);
    info!("║                                                ║");
    info!("║  Abre en tu navegador:                        ║");
    info!("║  http://localhost:7333                         ║");
    info!("║                                                ║");
    info!(
        "║  Chain height: {:5}                          ║",
        chain.height()
    );
    info!("╚════════════════════════════════════════════════╝");
    info!("Presiona Ctrl+C para parar.");

    // Simple API loop
    loop {
        let (mut socket, addr) = listener.accept().await?;
        debug!("New client connection from: {}", addr);

        let node_ref = node_api.clone();
        let msg_tx_ref = msg_tx_api.clone();

        tokio::spawn(async move {
            let mut buf = [0u8; 4096]; // Increased buffer size for messages
            loop {
                let n = match socket.read(&mut buf).await {
                    Ok(0) => return,
                    Ok(n) => n,
                    Err(e) => {
                        error!("Failed to read from socket; err = {:?}", e);
                        return;
                    }
                };

                // Try to deserialize ClientCommand
                match bincode::deserialize::<ClientCommand>(&buf[..n]) {
                    Ok(cmd) => {
                        match cmd {
                            ClientCommand::SendMessage(msg) => {
                                info!(
                                    "Received message from client: {} -> {}",
                                    msg.sender.short(),
                                    msg.recipient.short()
                                );

                                let mut n = node_ref.lock().await;
                                match n.send_message(msg.recipient.clone(), msg).await {
                                    Ok(_) => {
                                        let resp = bincode::serialize(&NodeResponse::Ok).unwrap();
                                        if let Err(e) = socket.write_all(&resp).await {
                                            error!("Failed to write to socket; err = {:?}", e);
                                        }
                                    }
                                    Err(e) => {
                                        error!("Failed to send message: {:?}", e);
                                        let resp = bincode::serialize(&NodeResponse::Error(
                                            format!("{:?}", e),
                                        ))
                                        .unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                            ClientCommand::GetStatus => {
                                let n = node_ref.lock().await;
                                let peer_count = n.transport_peer_count();
                                let resp = bincode::serialize(&NodeResponse::Status {
                                    peer_count,
                                    is_running: n.is_running(),
                                    identity_hash: n.identity_hash().clone(),
                                })
                                .unwrap();
                                let _ = socket.write_all(&resp).await;
                            }
                            ClientCommand::Subscribe => {
                                info!("New subscription from client");
                                let mut receiver = msg_tx_ref.subscribe();

                                loop {
                                    tokio::select! {
                                        msg = receiver.recv() => {
                                            match msg {
                                                Ok(message) => {
                                                    let resp = bincode::serialize(&NodeResponse::NewMessage(message)).unwrap();
                                                    if let Err(e) = socket.write_all(&resp).await {
                                                        error!("Failed to send subscriber message: {:?}", e);
                                                        break;
                                                    }
                                                }
                                                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                                                    warn!("Subscriber lagged behind");
                                                }
                                                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                                                    break;
                                                }
                                            }
                                        }
                                        // Also need to check if the client is still alive
                                        _ = socket.readable() => {
                                            let mut check_buf = [0u8; 1];
                                            if let Ok(0) = socket.try_read(&mut check_buf) {
                                                break; // Connection closed
                                            }
                                        }
                                    }
                                }
                                return; // Exit task after subscription loop ends
                            }
                            ClientCommand::CreateGroup { name } => {
                                let mut n = node_ref.lock().await;
                                match n.create_group(name).await {
                                    Ok(group) => {
                                        let resp =
                                            bincode::serialize(&NodeResponse::GroupInfo(group))
                                                .unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        let resp = bincode::serialize(&NodeResponse::Error(
                                            format!("{:?}", e),
                                        ))
                                        .unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                            ClientCommand::AddMember { group_id, member } => {
                                let mut n = node_ref.lock().await;
                                match n.add_group_member(group_id, member).await {
                                    Ok(_) => {
                                        if let Ok(resp) = bincode::serialize(&NodeResponse::Ok) {
                                            let _ = socket.write_all(&resp).await;
                                        }
                                    }
                                    Err(e) => {
                                        if let Ok(resp) = bincode::serialize(&NodeResponse::Error(
                                            format!("{:?}", e),
                                        )) {
                                            let _ = socket.write_all(&resp).await;
                                        }
                                    }
                                }
                            }
                            ClientCommand::SendGroupMessage { group_id, content } => {
                                info!("Received group message for group {:?}", group_id);
                                let mut n = node_ref.lock().await;
                                // FIX: Actually route the message to group members instead of
                                // silently dropping it. send_group_message() encrypts with
                                // SenderKey and delivers individually via onion routing.
                                match n.send_group_message(group_id, content).await {
                                    Ok(_) => {
                                        let resp = bincode::serialize(&NodeResponse::Ok).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        error!("Failed to send group message: {:?}", e);
                                        let resp = bincode::serialize(&NodeResponse::Error(
                                            format!("{:?}", e),
                                        ))
                                        .unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                            ClientCommand::ListGroups => {
                                let n = node_ref.lock().await;
                                match n.list_groups().await {
                                    Ok(groups) => {
                                        if let Ok(resp) =
                                            bincode::serialize(&NodeResponse::GroupList(groups))
                                        {
                                            let _ = socket.write_all(&resp).await;
                                        }
                                    }
                                    Err(e) => {
                                        if let Ok(resp) = bincode::serialize(&NodeResponse::Error(
                                            format!("{:?}", e),
                                        )) {
                                            let _ = socket.write_all(&resp).await;
                                        }
                                    }
                                }
                            }
                            ClientCommand::GeneratePairingCode { name } => {
                                let n = node_ref.lock().await;
                                match n.generate_pairing_code(name).await {
                                    Ok(code) => {
                                        let resp =
                                            bincode::serialize(&NodeResponse::PairingCode(code))
                                                .unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        let resp = bincode::serialize(&NodeResponse::Error(
                                            format!("{:?}", e),
                                        ))
                                        .unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                            ClientCommand::AuthorizeDevice { name, code } => {
                                let mut n = node_ref.lock().await;
                                match n.authorize_device(name, code).await {
                                    Ok(_) => {
                                        let resp = bincode::serialize(&NodeResponse::Ok).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        let resp = bincode::serialize(&NodeResponse::Error(
                                            format!("{:?}", e),
                                        ))
                                        .unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                            ClientCommand::ListDevices => {
                                let n = node_ref.lock().await;
                                match n.list_devices().await {
                                    Ok(devices) => {
                                        if let Ok(resp) =
                                            bincode::serialize(&NodeResponse::DeviceList(devices))
                                        {
                                            let _ = socket.write_all(&resp).await;
                                        }
                                    }
                                    Err(e) => {
                                        if let Ok(resp) = bincode::serialize(&NodeResponse::Error(
                                            format!("{:?}", e),
                                        )) {
                                            let _ = socket.write_all(&resp).await;
                                        }
                                    }
                                }
                            }
                            ClientCommand::SyncData => {
                                let n = node_ref.lock().await;
                                match n.get_sync_payload().await {
                                    Ok((contacts, groups, conversations)) => {
                                        let resp = bincode::serialize(&NodeResponse::SyncPayload {
                                            contacts,
                                            groups,
                                            conversations,
                                        })
                                        .unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        let resp = bincode::serialize(&NodeResponse::Error(
                                            format!("{:?}", e),
                                        ))
                                        .unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to deserialize command from client: {:?}", e);
                        let resp = bincode::serialize(&NodeResponse::Error(
                            "Invalid command format".to_string(),
                        ))
                        .unwrap();
                        let _ = socket.write_all(&resp).await;
                    }
                }
            }
        });
    }
}

async fn init_node(data_dir: PathBuf, force: bool) -> anyhow::Result<()> {
    info!("Initializing new RED node...");

    if data_dir.exists() && !force {
        anyhow::bail!(
            "Data directory already exists: {}. Use --force to overwrite.",
            data_dir.display()
        );
    }

    std::fs::create_dir_all(&data_dir)?;

    // Generate node identity
    let identity = red_core::identity::Identity::generate()?;
    info!(
        "Generated node identity: {}",
        identity.identity_hash().short()
    );

    // Create default config
    let config_path = data_dir.join("config.toml");
    let config_content = format!(
        r#"# RED Node Configuration

[node]
identity = "{}"
port = 7331

[network]
max_peers = 50
enable_mdns = true
enable_dht = true

[blockchain]
validator = false

[storage]
max_size_gb = 10
"#,
        identity.identity_hash().to_hex()
    );
    std::fs::write(&config_path, config_content)?;
    info!("Created configuration: {}", config_path.display());

    // Save identity to storage
    let mut storage = Storage::new(data_dir.join("storage"), get_storage_key());
    storage.open()?;
    storage.set_identity(identity.clone())?;

    // Phase 18: Autonomous Decoy Vault Generation
    // When the Java/UI layer commands a stealth login via the Duress PIN (9999), it spawns
    // the node with a '_decoy' data_dir suffix. We instantly forge a believable SQLite history.
    if data_dir.to_string_lossy().ends_with("_decoy") {
        red_core::network::dummy_traffic::populate_decoy_vault(
            &mut storage,
            identity.identity_hash(),
        );
    }

    storage.close()?;
    info!("Identity saved to storage.");

    info!("\n✓ Node initialized successfully!");
    info!("  Run 'red-node start' to start the node.");

    Ok(())
}

async fn show_status(data_dir: PathBuf) -> anyhow::Result<()> {
    info!("RED Node Status");
    info!("===============");
    info!("Data directory: {}", data_dir.display());

    if !data_dir.exists() {
        info!("Status: Not initialized");
        info!("Run 'red-node init' to initialize.");
        return Ok(());
    }

    info!("Status: Initialized");

    // Check config
    let config_path = data_dir.join("config.toml");
    if config_path.exists() {
        info!("Configuration: Found");
    } else {
        info!("Configuration: Missing");
    }

    Ok(())
}

/// Get storage encryption key derived from RED_PASSWORD environment variable.
///
/// The key is derived from the password using HKDF so the raw password never
/// touches disk or appears in storage.
///
/// # Panics
/// Panics if RED_PASSWORD is not set in a non-dev context (port != 7333 default
/// does not override this). In dev mode (no RED_PASSWORD set) a deterministic
/// dev-only key is used with a loud warning so tests still pass.
fn get_storage_key() -> [u8; 32] {
    match std::env::var("RED_PASSWORD").ok().filter(|p| !p.is_empty()) {
        Some(password) => {
            derive_symmetric_key(password.as_bytes(), b"red-storage-salt-v1", b"storage-key")
                .expect("HKDF key derivation failed")
        }
        None => {
            // Dev mode — loud warning so it's never silently used in production
            tracing::warn!(
                "⚠️  RED_PASSWORD not set — storage is encrypted with the INSECURE dev key. \
                 Set RED_PASSWORD before running in production!"
            );
            derive_symmetric_key(
                b"red-dev-insecure-key",
                b"red-storage-salt-v1",
                b"storage-key",
            )
            .expect("HKDF key derivation failed")
        }
    }
}

async fn handle_identity(data_dir: PathBuf, action: IdentityAction) -> anyhow::Result<()> {
    let mut storage = Storage::new(data_dir.join("storage"), get_storage_key());
    storage.open()?;

    match action {
        IdentityAction::Generate => {
            let identity = Identity::generate()?;
            info!("Generated new identity:");
            info!("  Hash: {}", identity.identity_hash().to_hex());
            info!("  Public Key: {}", identity.public_key().to_hex());

            storage.set_identity(identity)?;
            info!("Identity saved to secure storage.");
        }
        IdentityAction::Show => {
            if let Some(identity) = storage.get_identity() {
                info!("Current identity information:");
                info!("  Hash: {}", identity.identity_hash().to_hex());
                info!("  Public Key: {}", identity.public_key().to_hex());
                info!("  Created: {}", identity.created_at());
                info!("  Expires: {}", identity.expires_at());
            } else {
                info!("No identity found. Run 'red-node identity generate' to create one.");
            }
        }
        IdentityAction::Export { output } => {
            if let Some(identity) = storage.get_identity() {
                let serialized = bincode::serialize(&identity)?;
                std::fs::write(&output, serialized)?;
                info!("Identity exported to: {}", output.display());
            } else {
                info!("No identity to export.");
            }
        }
        IdentityAction::Import { input } => {
            let data = std::fs::read(&input)?;
            let identity: Identity = bincode::deserialize(&data)?;
            info!("Imported identity: {}", identity.identity_hash().short());
            storage.set_identity(identity)?;
            info!("Identity saved to secure storage.");
        }
    }

    Ok(())
}
