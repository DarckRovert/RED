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
mod social;

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

    // Get identity (auto-generate sovereign identity if first run)
    let identity = {
        let mut s = storage.lock().await;
        match s.get_identity() {
            Some(id) => {
                info!("Loaded existing sovereign identity: did:red:{}", id.identity_hash().to_hex());
                id
            }
            None => {
                info!("No previous identity found. Generating new sovereign identity...");
                let new_id = Identity::generate().map_err(|e| anyhow::anyhow!("Failed to generate identity: {}", e))?;
                s.set_identity(new_id.clone())?;
                info!("Generated and saved new sovereign identity: did:red:{}", new_id.identity_hash().to_hex());
                new_id
            }
        }
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

    // Start DNS Tunnel (UDP 53, or fallback to 5353 if not root)
    let dns_tunnel = crate::dns_tunnel::DnsTunnelServer::new("red.mesh", node.clone());
    tokio::spawn(async move {
        // En Linux, el puerto 53 requiere root. En desarrollo usamos 5353
        let port = if std::env::var("RED_DNS_PORT").is_ok() {
            std::env::var("RED_DNS_PORT").unwrap().parse().unwrap_or(5353)
        } else {
            5353
        };
        dns_tunnel.start(port).await;
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

        let ai_copilot = std::sync::Arc::new(ai_copilot::AICopilotEngine::new());
        let guardian_engine = guardian::GuardianEngine::from_env(ai_copilot.clone());
        if guardian_engine.is_active() {
            info!(
                "🛡️  Guardian IA activo (100% Local Off-Grid Engine: RED-Guardian-Nano-v3, modo={})",
                guardian_engine.get_mode_str()
            );
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

        let shared_sled = std::sync::Arc::new(sled::open(data_dir_amber.join("sled_db")).unwrap());

        let sos_store = std::sync::Arc::new(sos::SosStore::new(Some(shared_sled.clone())));
        let channel_store = std::sync::Arc::new(channels::ChannelStore::new(Some(shared_sled.clone())));
        let chunker = std::sync::Arc::new(chunker::ChunkerEngine::new());
        let voice_store = std::sync::Arc::new(voice::VoiceStore::new());

        let discovery = std::sync::Arc::new(discovery::DiscoveryEngine::new(Some((*shared_sled).clone())));
        let ephemeral = std::sync::Arc::new(ephemeral::EphemeralPurgeEngine::new());
        let battery = std::sync::Arc::new(battery::BatteryOptimizer::new(Some((*shared_sled).clone())));
        let ai_summarizer = std::sync::Arc::new(ai_summarizer::AISummarizerEngine::new());
        let ai_translator = std::sync::Arc::new(ai_translator::AITranslatorEngine::new());

        let state = ApiState {
            node: http_node.clone(),
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
            weather_store: std::sync::Arc::new(weather::WeatherStore::new(Some((*shared_sled).clone()))),
            discovery,
            ephemeral,
            battery,
            ai_copilot,
            ai_summarizer,
            ai_translator,
            social_store: std::sync::Arc::new(social::SocialStore::new(Some(shared_sled.clone()))),
        };

        let my_identity_hash = {
            let n = state.node.lock().await;
            n.identity_hash().to_hex()
        };

        let mut msg_rx = state.msg_tx.subscribe();
        let social_store_clone = state.social_store.clone();
        let weather_store_clone = state.weather_store.clone();
        let state_for_loop = state.clone();
        tokio::spawn(async move {
            while let Ok(msg) = msg_rx.recv().await {
                if let red_core::protocol::MessageType::SocialPost(payload) = &msg.content {
                    if let Ok(post) = serde_json::from_slice::<social::SocialPost>(payload) {
                        // FIX: Remove 'is_following' restriction to allow global mesh discovery
                        social_store_clone.insert_post(post);
                    }
                } else if let red_core::protocol::MessageType::WeatherReport(payload) = &msg.content {
                    if let Ok(report) = serde_json::from_slice::<weather::WeatherReport>(payload) {
                        weather_store_clone.add_report_raw(report);
                    }
                } else if let red_core::protocol::MessageType::Text(text) = &msg.content {
                    // Escaneo asíncrono con Guardian IA para no congelar el event loop
                    let state_async = state_for_loop.clone();
                    let sender = msg.sender.clone();
                    let recipient = msg.recipient.clone();
                    let msg_id = msg.id.clone();
                    let text_clone = text.clone();
                    
                    tokio::spawn(async move {
                        let verdict = state_async.guardian.analyze_text(&text_clone).await;
                        if let guardian::GuardianVerdict::Block { reason, .. } = verdict {
                            // Find conversation ID and obfuscate
                            let mut n = state_async.node.lock().await;
                            let conv_id = red_core::protocol::ConversationId::from_participants(&sender, &recipient);
                            // Se asume 1 a 1 por ahora, o el frontend lo verá igual si mutamos.
                            let new_content = format!("[Bloqueado por Guardian IA: {}]", reason);
                            let _ = n.edit_message(&conv_id.to_hex(), &msg_id.to_hex(), new_content).await;
                            
                            // Re-emitir evento para que la UI re-renderice
                            let mut dummy_msg = msg.clone();
                            dummy_msg.content = red_core::protocol::MessageType::Text(format!("[Bloqueado por Guardian IA: {}]", reason));
                            let _ = state_async.msg_tx.send(dummy_msg);
                        }
                    });
                } else if let red_core::protocol::MessageType::ReadReceipt { ref message_ids } = msg.content {
                    // ── ReadReceipt entrante: actualizar status → Read en la BD ────────
                    let state_async = state_for_loop.clone();
                    let message_ids_clone = message_ids.clone();
                    let sender_clone = msg.sender.clone();
                    tokio::spawn(async move {
                        let n = state_async.node.lock().await;
                        let _ = n.mark_messages_read_by_peer(&sender_clone, &message_ids_clone).await;
                    });
                    // SSE handler re-emite como evento `read_receipt` al frontend
                } else if let red_core::protocol::MessageType::PresenceBeacon { .. } = msg.content {
                    // PresenceBeacon entrante: SSE handler ya lo emite como evento `presence`
                }
            }
        });

        // ── Presence Beacon Task: emitir Online cada 60s a peers conocidos ──
        {
            let state_beacon = state.clone();
            let my_hash_for_beacon = my_identity_hash.clone();
            tokio::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                loop {
                    let now_ms = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;
                    if let Ok(my_hash) = red_core::identity::IdentityHash::from_hex(&my_hash_for_beacon) {
                        let peers = {
                            let n = state_beacon.node.lock().await;
                            n.list_peers().await.unwrap_or_default()
                        };
                        for peer in peers {
                            // Use the identity_hash if known; skip anonymous peers
                            if let Some(peer_hash) = peer.identity_hash {
                                let beacon = red_core::protocol::Message {
                                    id: red_core::protocol::MessageId::generate(),
                                    sender: my_hash.clone(),
                                    recipient: peer_hash,
                                    content: red_core::protocol::MessageType::PresenceBeacon {
                                        last_seen: now_ms,
                                        online: true,
                                    },
                                    timestamp: now_ms,
                                    reply_to: None,
                                    status: red_core::protocol::MessageStatus::Sent,
                                    edited: false,
                                };
                                let _ = state_beacon.msg_tx.send(beacon);
                            }
                        }
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                }
            });
        }

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

        let http_addr = "127.0.0.1:7333";
        let listener = match tokio::net::TcpListener::bind(http_addr).await {
            Ok(l) => l,
            Err(e) => {
                error!("❌ Failed to bind HTTP API port 7333: {}. A previous instance may be running.", e);
                return;
            }
        };
        info!("Web UI + HTTP API listening locally on http://{}", http_addr);
        let _ = axum::serve(
            listener,
            router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
        )
        .await;
    });

    // We need a separate reference for the TCP API loop
    let node_api = node.clone();

    // Start local API server for client requests
    let api_addr = "0.0.0.0:7332";
    let listener = TcpListener::bind(api_addr).await?;
    info!("Local API server listening on {}", api_addr);

    info!("\n╔═════════════════════════════════════════════════════════════════════════╗");
    info!("║  🛡️  RED SOVEREIGN NODE v{:<44} ║", env!("CARGO_PKG_VERSION"));
    info!("║                                                                         ║");
    info!("║  Identidad:       did:red:{:<43} ║", identity.identity_hash().short());
    info!("║  Puerto P2P:      {:5} (Malla libp2p & Kademlia DHT)                  ║", port);
    info!("║  Puerto TCP API:  {:5} (Control de Daemon)                            ║", 7332);
    info!("║  Puerto Web/SSE:  {:5} (REST API & WebRTC Engine)                     ║", 7333);
    info!("║                                                                         ║");
    info!("║  🌐 Interfaz Web Soberana:                                              ║");
    info!("║     https://darckrovert.github.io/RED/                                  ║");
    info!("║                                                                         ║");
    info!("║  🔗 Dashboard Local:                                                    ║");
    info!("║     http://127.0.0.1:7333/api/status                                    ║");
    info!("║                                                                         ║");
    info!("║  Altura de Cadena: {:<5} bloques                                        ║", chain.height());
    info!("╚═════════════════════════════════════════════════════════════════════════╝");
    info!("💡 Nodo activo y operando. Presiona Ctrl+C para detener.");

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

    let storage_path = data_dir.join("storage");
    if storage_path.exists() {
        let mut storage = Storage::new(storage_path, get_storage_key());
        if storage.open().is_ok() {
            if let Some(id) = storage.get_identity() {
                info!("Status: Active Sovereign Identity Available");
                info!("Identity Hash: did:red:{}", id.identity_hash().to_hex());
                info!("Public Key:    {}", id.public_key().to_hex());
            } else {
                info!("Status: Initialized (No identity generated yet)");
            }
        } else {
            info!("Status: Storage database present (Active/Locked)");
        }
    } else {
        info!("Status: Not initialized (Storage directory not found)");
        info!("Tip: Run 'red-node start' or 'red-node init' to initialize automatically.");
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
