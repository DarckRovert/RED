//! RED Network Node
//!
//! A full node for the RED decentralized messaging network.

mod api;

use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::{info, error, debug, warn, Level};
use tracing_subscriber::FmtSubscriber;
use red_core::storage::{Storage, Profile};
use red_core::identity::Identity;
use red_core::crypto::hashing::derive_symmetric_key;
use red_core::network::{Node, NetworkConfig};
use red_core::network::control::{ClientCommand, NodeResponse};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use api::{ApiState, build_router};
use axum;

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
    let log_level = if cli.verbose { Level::DEBUG } else { Level::INFO };
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
        s.get_identity().cloned().ok_or_else(|| {
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
    consensus.register_validator(identity.public_key_bytes(), 1000_000_000_000)?;
    
    let chain = Arc::new(chain);
    
    // Start block production in background
    let consensus_clone = consensus.clone();
    let chain_clone = chain.clone();
    
    // Need ed25519_dalek::SigningKey from our Identity
    let signing_key_bytes = identity.signing_key_bytes();
    let signing_key = ed25519_dalek::SigningKey::from_bytes(&signing_key_bytes);
    
    tokio::spawn(async move {
        consensus_clone.run_block_production(chain_clone, signing_key).await;
    });

    // Message broadcast channel for API subscriptions
    let (msg_tx, _) = tokio::sync::broadcast::channel(100);
    let msg_tx_api = msg_tx.clone();

    {
        let mut n = node.lock().await;
        n.set_msg_notifier(msg_tx);
        n.start().await?;
    }

    // Start the network event loop
    let node_event_loop = node.clone();
    tokio::spawn(async move {
        Node::start_event_loop(node_event_loop).await;
    });

    // ── HTTP REST API (port 7333, serves Web UI + REST endpoints) ──────────
    let http_node = node.clone();
    let http_msg_tx = msg_tx_api.clone();
    tokio::spawn(async move {
        let state = ApiState {
            node: http_node,
            msg_tx: http_msg_tx,
        };
        let router = build_router(state);
        let http_addr = "127.0.0.1:7333";
        let listener = tokio::net::TcpListener::bind(http_addr).await
            .expect("Failed to bind HTTP API port 7333");
        info!("Web UI + HTTP API listening on http://{}", http_addr);
        axum::serve(listener, router).await
            .expect("HTTP server error");
    });

    // We need a separate reference for the TCP API loop
    let node_api = node.clone();

    // Start local API server for client requests
    let api_addr = "127.0.0.1:7332";
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
    info!("║  Chain height: {:5}                          ║", chain.height());
    info!("╚════════════════════════════════════════════════╝");
    info!("Presiona Ctrl+C para parar.");

    // Simple API loop
    loop {
        let (mut socket, addr) = listener.accept().await?;
        debug!("New client connection from: {}", addr);
        
        let node_ref = node_api.clone();
        
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
                                info!("Received message from client: {} -> {}", msg.sender.short(), msg.recipient.short());
                                
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
                                        let resp = bincode::serialize(&NodeResponse::Error(format!("{:?}", e))).unwrap();
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
                                }).unwrap();
                                let _ = socket.write_all(&resp).await;
                            }
                            ClientCommand::Subscribe => {
                                info!("New subscription from client");
                                let mut receiver = msg_tx_api.subscribe();
                                
                                loop {
                                    tokio::select! {
                                        msg = receiver.recv() => {
                                            match msg {
                                                Ok(message) => {
                                                    let resp = bincode::serialize(&NodeResponse::MessageReceived(message)).unwrap();
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
                                        let resp = bincode::serialize(&NodeResponse::GroupInfo(group)).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        let resp = bincode::serialize(&NodeResponse::Error(format!("{:?}", e))).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                            ClientCommand::AddMember { group_id, member } => {
                                let mut n = node_ref.lock().await;
                                match n.add_group_member(group_id, member).await {
                                    Ok(_) => {
                                        let resp = bincode::serialize(&NodeResponse::Ok).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        let resp = bincode::serialize(&NodeResponse::Error(format!("{:?}", e))).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                            ClientCommand::SendGroupMessage(msg) => {
                                // For now, we simulate group send as a single handover
                                info!("Received group message for group {:?}", msg.group_id);
                                let resp = bincode::serialize(&NodeResponse::Ok).unwrap();
                                let _ = socket.write_all(&resp).await;
                            }
                            ClientCommand::ListGroups => {
                                let n = node_ref.lock().await;
                                match n.list_groups().await {
                                    Ok(groups) => {
                                        let resp = bincode::serialize(&NodeResponse::GroupList(groups)).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        let resp = bincode::serialize(&NodeResponse::Error(format!("{:?}", e))).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                            ClientCommand::GeneratePairingCode { name } => {
                                let n = node_ref.lock().await;
                                match n.generate_pairing_code(name).await {
                                    Ok(code) => {
                                        let resp = bincode::serialize(&NodeResponse::PairingCode(code)).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        let resp = bincode::serialize(&NodeResponse::Error(format!("{:?}", e))).unwrap();
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
                                        let resp = bincode::serialize(&NodeResponse::Error(format!("{:?}", e))).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                            ClientCommand::ListDevices => {
                                let n = node_ref.lock().await;
                                match n.list_devices().await {
                                    Ok(devices) => {
                                        let resp = bincode::serialize(&NodeResponse::DeviceList(devices)).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        let resp = bincode::serialize(&NodeResponse::Error(format!("{:?}", e))).unwrap();
                                        let _ = socket.write_all(&resp).await;
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
                                        }).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                    Err(e) => {
                                        let resp = bincode::serialize(&NodeResponse::Error(format!("{:?}", e))).unwrap();
                                        let _ = socket.write_all(&resp).await;
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to deserialize command from client: {:?}", e);
                        let resp = bincode::serialize(&NodeResponse::Error("Invalid command format".to_string())).unwrap();
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
    info!("Generated node identity: {}", identity.identity_hash().short());

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
    storage.set_identity(identity)?;
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

/// Get storage encryption key by prompting the user for their password.
/// The key is derived from the password using HKDF so the password never
/// touches disk.
fn get_storage_key() -> [u8; 32] {
    // In interactive terminals, prompt for the password.
    // Fall back to the environment variable RED_PASSWORD if set (for automation).
    if let Ok(pw) = std::env::var("RED_PASSWORD") {
        return derive_symmetric_key(pw.as_bytes(), b"red-salt", b"storage-key")
            .expect("Key derivation failed");
    }
    let password = rpassword::prompt_password("🔐 RED storage password: ")
        .unwrap_or_else(|_| "default".to_string());
    derive_symmetric_key(password.as_bytes(), b"red-salt", b"storage-key")
        .expect("Key derivation failed")
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
                let serialized = bincode::serialize(identity)?;
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
