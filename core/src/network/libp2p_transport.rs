//! Real P2P transport implementation using libp2p.

use async_trait::async_trait;
use libp2p::{
    futures::StreamExt,
    gossipsub, identify, kad, mdns, noise, swarm::{NetworkBehaviour, SwarmEvent}, tcp, yamux, Multiaddr,
    autonat, dcutr, relay
};
use std::collections::HashSet;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{info, warn, error, debug};

use super::{NetworkError, NetworkResult, PeerId, transport::{Transport, TransportMessage}};

/// Behaviour for our libp2p stack
#[derive(NetworkBehaviour)]
pub struct RedBehaviour {
    pub gossipsub: gossipsub::Behaviour,
    pub identify: identify::Behaviour,
    pub kademlia: kad::Behaviour<kad::store::MemoryStore>,
    pub autonat: autonat::Behaviour,
    pub dcutr: dcutr::Behaviour,
    pub relay_client: relay::client::Behaviour,
    /// BUG B FIX: mDNS for automatic local peer discovery (same WiFi/hotspot)
    pub mdns: mdns::tokio::Behaviour,
}

/// Libp2p based transport implementation
pub struct Libp2pTransport {
    /// Channel for sending messages to the transport task
    cmd_tx: mpsc::Sender<TransportCommand>,
    /// Channel for receiving messages from the transport task
    msg_rx: Arc<tokio::sync::Mutex<mpsc::Receiver<(PeerId, TransportMessage)>>>,
    /// Known peers (cached for routing)
    known_peers: Arc<Mutex<Vec<crate::network::PeerInfo>>>,
    /// Currently connected peer IDs (GAP-1/GAP-6 FIX)
    connected_peers: Arc<Mutex<HashSet<Vec<u8>>>>,
    /// Root directory for persistent logs (telemetry)
    data_dir: Option<std::path::PathBuf>,
    /// Blackout mode flag shared with Node
    blackout_mode: Arc<std::sync::atomic::AtomicBool>,
    /// Counter for blocked WAN connections shared with Node
    blocked_wan_peers: Arc<std::sync::atomic::AtomicUsize>,
}

enum TransportCommand {
    /// Tell the swarm to listen on this multiaddr
    Listen(Multiaddr),
    Connect(Multiaddr),
    SendMessage(PeerId, TransportMessage),
    Disconnect(PeerId),
    /// GAP-2 FIX: channel to await the real DHT result
    Resolve(crate::identity::IdentityHash, mpsc::Sender<NetworkResult<PeerId>>),
    GetKnownPeers(mpsc::Sender<Vec<crate::network::PeerInfo>>),
    StartProviding,
    DisconnectWanPeers,
}

/// TD-3 FIX: Robustly extract a SocketAddr from a libp2p Multiaddr.
/// Handles formats like /ip4/1.2.3.4/tcp/1234
fn multiaddr_to_socketaddr(addr: &Multiaddr) -> Option<SocketAddr> {
    use libp2p::multiaddr::Protocol;
    let mut iter = addr.iter();
    let ip = match iter.next()? {
        Protocol::Ip4(ip) => std::net::IpAddr::V4(ip),
        Protocol::Ip6(ip) => std::net::IpAddr::V6(ip),
        _ => return None,
    };
    let port = match iter.next()? {
        Protocol::Tcp(p) => p,
        _ => return None,
    };
    Some(SocketAddr::new(ip, port))
}

impl Libp2pTransport {
    /// Create a new libp2p transport
    pub fn new(
        secret_key_bytes: [u8; 32], 
        data_dir: Option<std::path::PathBuf>, 
        bootstrap_nodes: Vec<Multiaddr>,
        blackout_mode: Arc<std::sync::atomic::AtomicBool>,
        blocked_wan_peers: Arc<std::sync::atomic::AtomicUsize>
    ) -> NetworkResult<Self> {
        let local_key = libp2p::identity::Keypair::ed25519_from_bytes(secret_key_bytes)
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;
        let peer_id = local_key.public().to_peer_id();
        
        if let Some(ref dir) = data_dir {
            crate::network::append_log(dir, &format!("[libp2p] Initializing transport with PeerId: {}", peer_id));
        }

        let mut yamux_config = yamux::Config::default();
        yamux_config.set_receive_window_size(4 * 1024 * 1024);
        let yamux_relay = yamux_config.clone();

        #[cfg(not(target_os = "android"))]
        let swarm_builder = libp2p::SwarmBuilder::with_existing_identity(local_key.clone())
            .with_tokio()
            .with_tcp(
                tcp::Config::default(),
                noise::Config::new,
                move || yamux_config.clone(),
            ).map_err(|e| NetworkError::TransportError(e.to_string()))?
            .with_dns().map_err(|e| NetworkError::TransportError(e.to_string()))?
            .with_relay_client(noise::Config::new, move || yamux_relay.clone()).map_err(|e| NetworkError::TransportError(e.to_string()))?;

        #[cfg(target_os = "android")]
        let mut swarm_builder = libp2p::SwarmBuilder::with_existing_identity(local_key.clone())
            .with_tokio()
            .with_tcp(
                tcp::Config::default(),
                noise::Config::new,
                move || yamux_config.clone(),
            ).map_err(|e| NetworkError::TransportError(e.to_string()))?
            .with_relay_client(noise::Config::new, move || yamux_relay.clone()).map_err(|e| NetworkError::TransportError(e.to_string()))?;

        let mut swarm = swarm_builder
            .with_behaviour(|key, relay_client| {
                // v40.2.0: Expanded max_transmit_size to 4 MB to support voice notes & media payloads
                let gossipsub_config = gossipsub::ConfigBuilder::default()
                    .heartbeat_interval(Duration::from_secs(10))
                    .validation_mode(gossipsub::ValidationMode::Strict)
                    .max_transmit_size(4 * 1024 * 1024)
                    .build()
                    .map_err(std::io::Error::other)?;

                let kad_store = kad::store::MemoryStore::new(key.public().to_peer_id());
                let mut kademlia = kad::Behaviour::new(key.public().to_peer_id(), kad_store);
                kademlia.set_mode(Some(kad::Mode::Client));
                let identify = identify::Behaviour::new(
                    identify::Config::new("/red/1.0.0".to_string(), key.public())
                        .with_agent_version(format!("RED-Node/{}", env!("CARGO_PKG_VERSION")))
                );

                let autonat = autonat::Behaviour::new(
                    key.public().to_peer_id(),
                    autonat::Config::default()
                );

                let dcutr = dcutr::Behaviour::new(key.public().to_peer_id());

                Ok(RedBehaviour {
                    gossipsub: gossipsub::Behaviour::new(
                        gossipsub::MessageAuthenticity::Signed(key.clone()),
                        gossipsub_config,
                    )?,
                    identify,
                    kademlia,
                    autonat,
                    dcutr,
                    relay_client,
                    // GAP-18 FIX: mDNS config optimized for mobile mesh (Android 14)
                    // We use a shorter query interval to speed up discovery when nodes come online.
                    mdns: mdns::tokio::Behaviour::new(
                        mdns::Config {
                            query_interval: Duration::from_secs(5), 
                            ttl: Duration::from_secs(60),
                            ..Default::default()
                        },
                        key.public().to_peer_id(),
                    ).map_err(std::io::Error::other)?,
                })
            }).map_err(|e| NetworkError::TransportError(e.to_string()))?
            .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
            .build();

        // Configure Kademlia and Dial Bootstraps
        for addr in &bootstrap_nodes {
            if let Some(libp2p::multiaddr::Protocol::P2p(peer_id)) = addr.iter().last() {
                swarm.behaviour_mut().kademlia.add_address(&peer_id, addr.clone());
                if let Err(e) = swarm.dial(addr.clone()) {
                    warn!("[libp2p] Failed to dial bootstrap node {}: {:?}", addr, e);
                } else {
                    info!("[libp2p] Dialed bootstrap node: {}", addr);
                }
            }
        }
        if !bootstrap_nodes.is_empty() {
            if let Err(e) = swarm.behaviour_mut().kademlia.bootstrap() {
                warn!("[libp2p] Failed to bootstrap Kademlia DHT: {:?}", e);
            } else {
                info!("[libp2p] Kademlia DHT bootstrap initiated");
            }
        }

        // Subscribe to messages topic and routing topic
        let topic = gossipsub::IdentTopic::new("red-messages");
        swarm.behaviour_mut().gossipsub.subscribe(&topic)
            .map_err(|e: libp2p::gossipsub::SubscriptionError| NetworkError::TransportError(e.to_string()))?;
        
        // GAP-3 FIX: Also subscribe to routing topic for onion packets
        let routing_topic = gossipsub::IdentTopic::new("red-routing");
        swarm.behaviour_mut().gossipsub.subscribe(&routing_topic)
            .map_err(|e: libp2p::gossipsub::SubscriptionError| NetworkError::TransportError(e.to_string()))?;

        // Handshake topic for exchanging node keys and identities
        let handshake_topic = gossipsub::IdentTopic::new("red-handshake");
        swarm.behaviour_mut().gossipsub.subscribe(&handshake_topic)
            .map_err(|e: libp2p::gossipsub::SubscriptionError| NetworkError::TransportError(e.to_string()))?;

        let (cmd_tx, mut cmd_rx) = mpsc::channel(100);
        let (msg_tx, msg_rx) = mpsc::channel(100);
        let known_peers: Arc<Mutex<Vec<crate::network::PeerInfo>>> = Arc::new(Mutex::new(Vec::new()));
        let connected_peers_set: Arc<Mutex<HashSet<Vec<u8>>>> = Arc::new(Mutex::new(HashSet::new()));
        
        let known_peers_clone = known_peers.clone();
        let connected_clone = connected_peers_set.clone();
        let log_dir = data_dir.clone();
        let cmd_tx_loop = cmd_tx.clone();
        let connected_count = connected_peers_set.clone();
        let log_dir_scan = data_dir.clone();

        // GAP-41 FIX: Aggressive Neighbor Scanning (Spray-Dial)
        // If discovery is zero, we manually probe neighbors (+1, -1) in the subnet.
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(45)).await;
                let count = connected_count.lock().unwrap().len();
                if count == 0 {
                    if let Ok(IpAddr::V4(ipv4)) = get_local_ip() {
                        let octets = ipv4.octets();
                        for i in (octets[3].saturating_sub(5))..=(octets[3].saturating_add(5)) {
                            if i == octets[3] { continue; }
                            let target_ip = Ipv4Addr::new(octets[0], octets[1], octets[2], i);
                            
                            // GAP-42 FIX: Try both current (7331) and legacy (4556) ports for cross-version compatibility
                            for port in [7331, 4556] {
                                let target_ma: Multiaddr = format!("/ip4/{}/tcp/{}", target_ip, port).parse().unwrap();
                                let _ = cmd_tx_loop.send(TransportCommand::Connect(target_ma)).await;
                            }
                        }
                    }
                }
            }
        });

        let blackout_mode_loop = blackout_mode.clone();
        let blocked_wan_peers_loop = blocked_wan_peers.clone();

        // Spawn the swarm event loop
        tokio::spawn(async move {
            let mut pending_resolves: std::collections::HashMap<kad::QueryId, (PeerId, mpsc::Sender<NetworkResult<PeerId>>)> = std::collections::HashMap::new();
            
            // Heartbeat to keep provider record alive
            let mut provider_interval = tokio::time::interval(Duration::from_secs(300));
            
            loop {
                tokio::select! {
                    _ = provider_interval.tick() => {
                        let _ = swarm.behaviour_mut().kademlia.start_providing(kad::RecordKey::new(&peer_id.to_bytes()));
                    }
                    event = swarm.select_next_some() => {
                        match event {
                            SwarmEvent::Behaviour(RedBehaviourEvent::Identify(identify::Event::Received { peer_id, info, .. })) => {
                                let real_pub_bytes: [u8; 32] = info.public_key
                                    .try_into_ed25519()
                                    .map(|k| k.to_bytes())
                                    .unwrap_or([0u8; 32]);

                                for addr in info.listen_addrs {
                                    debug!("[libp2p] Identify: peer {} at {}", peer_id, addr);
                                    swarm.behaviour_mut().kademlia.add_address(&peer_id, addr.clone());
                                    
                                    // GAP-1 FIX: Insert the full PeerId bytes (usually ~38 bytes)
                                    connected_clone.lock().unwrap().insert(peer_id.to_bytes());
                                    
                                    let mut kp = known_peers_clone.lock().unwrap();
                                    let target_id_bytes = {
                                        let b = peer_id.to_bytes();
                                        let mut arr = [0u8; 32];
                                        let len = b.len().min(32);
                                        arr[..len].copy_from_slice(&b[..len]);
                                        arr
                                    };
                                    if let Some(existing) = kp.iter_mut().find(|p| p.id.as_bytes() == target_id_bytes.as_slice()) {
                                        if existing.public_key.as_bytes() == &[0u8; 32] && real_pub_bytes != [0u8; 32] {
                                            existing.public_key = crate::crypto::keys::PublicKey::from_bytes(real_pub_bytes);
                                        }
                                    } else {
                                        if let Some(socket_addr) = multiaddr_to_socketaddr(&addr) {
                                            kp.push(crate::network::PeerInfo {
                                                id: PeerId::from_bytes(target_id_bytes),
                                                addresses: vec![socket_addr],
                                                public_key: crate::crypto::keys::PublicKey::from_bytes(real_pub_bytes),
                                                identity_hash: None,
                                                protocol_version: 1,
                                                user_agent: info.agent_version.clone(),
                                            });
                                        }
                                    }
                                }
                            }
                            // GAP-1 FIX: Track ConnectionClosed to keep the set accurate
                            SwarmEvent::ConnectionClosed { peer_id, .. } => {
                                debug!("Peer disconnected: {}", peer_id);
                                connected_clone.lock().unwrap().remove(&peer_id.to_bytes());
                                let target_id_bytes = {
                                    let b = peer_id.to_bytes();
                                    let mut arr = [0u8; 32];
                                    let len = b.len().min(32);
                                    arr[..len].copy_from_slice(&b[..len]);
                                    arr
                                };
                                known_peers_clone.lock().unwrap().retain(|p| p.id.as_bytes() != target_id_bytes.as_slice());
                            }
                            SwarmEvent::Behaviour(RedBehaviourEvent::Kademlia(kad::Event::OutboundQueryProgressed { id, result, .. })) => {
                                match result {
                                    kad::QueryResult::GetProviders(Ok(kad::GetProvidersOk::FoundProviders { providers, .. })) => {
                                        if let Some((target_peer_id, tx)) = pending_resolves.remove(&id) {
                                            if let Ok(target_libp2p) = libp2p::PeerId::from_bytes(&target_peer_id.as_bytes()[..]) {
                                                for provider in providers {
                                                    if provider == target_libp2p {
                                                        // Dial the provider so they get added to known_peers when connected
                                                        let _ = swarm.dial(provider);
                                                    }
                                                }
                                            }
                                            let _ = tx.send(Ok(target_peer_id)).await;
                                        }
                                    }
                                    kad::QueryResult::GetProviders(Err(_e)) => {
                                        if let Some((_, tx)) = pending_resolves.remove(&id) {
                                            let _ = tx.send(Err(NetworkError::RoutingFailed("Could not find provider on Kademlia DHT".to_string()))).await;
                                        }
                                    }
                                    kad::QueryResult::StartProviding(Ok(kad::AddProviderOk { key })) => {
                                        info!("[libp2p] Successfully announced presence to Kademlia DHT for {:?}", key);
                                    }
                                    kad::QueryResult::StartProviding(Err(e)) => {
                                        warn!("[libp2p] Failed to announce presence to Kademlia DHT: {:?}", e);
                                    }
                                    _ => {}
                                }
                            }
                            SwarmEvent::Behaviour(RedBehaviourEvent::Gossipsub(gossipsub::Event::Message {
                                propagation_source: peer_id,
                                message_id: _,
                                message,
                            })) => {
                                let peer_bytes = peer_id.to_bytes();
                                let mut arr = [0u8; 32];
                                let len = peer_bytes.len().min(32);
                                arr[..len].copy_from_slice(&peer_bytes[..len]);
                                let peer = PeerId::from_bytes(arr);

                                // Topic-based routing
                                if message.topic.as_str() == "red-handshake" {
                                    if let Ok(handshake) = serde_json::from_slice::<serde_json::Value>(&message.data) {
                                        if let (Some(hash_str), Some(pk_str)) = (
                                            handshake.get("identity_hash").and_then(|v| v.as_str()),
                                            handshake.get("public_key").and_then(|v| v.as_str())
                                        ) {
                                            if let Ok(identity_hash) = crate::identity::IdentityHash::from_hex(hash_str) {
                                                if let Ok(pk_bytes) = hex::decode(pk_str) {
                                                    if pk_bytes.len() == 32 {
                                                        let mut kp = known_peers_clone.lock().unwrap();
                                                        let target_id_bytes = {
                                                            let b = peer_id.to_bytes();
                                                            let mut arr = [0u8; 32];
                                                            let len = b.len().min(32);
                                                            arr[..len].copy_from_slice(&b[..len]);
                                                            arr
                                                        };
                                                        let mut pk_array = [0u8; 32];
                                                        pk_array.copy_from_slice(&pk_bytes);
                                                        let public_key = crate::crypto::keys::PublicKey::from_bytes(pk_array);

                                                        if let Some(existing) = kp.iter_mut().find(|p| p.id.as_bytes() == target_id_bytes.as_slice()) {
                                                            existing.identity_hash = Some(identity_hash);
                                                            existing.public_key = public_key;
                                                            debug!("Handshake received: updated peer {} with identity hash {}", peer_id, hash_str);
                                                        } else {
                                                            let custom_peer_id = PeerId::from_bytes(target_id_bytes);
                                                            kp.push(crate::network::PeerInfo {
                                                                id: custom_peer_id,
                                                                public_key,
                                                                identity_hash: Some(identity_hash),
                                                                protocol_version: 1,
                                                                user_agent: "red-node".to_string(),
                                                                addresses: vec![],
                                                            });
                                                            debug!("Handshake received: added new peer {} with identity hash {}", peer_id, hash_str);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else if message.topic.as_str() == "red-routing" {
                                    if let Ok(packet) = bincode::deserialize::<crate::network::routing::OnionPacket>(&message.data) {
                                        let _ = msg_tx.send((peer, TransportMessage::Onion(packet))).await;
                                    }
                                } else {
                                    let _ = msg_tx.send((peer, TransportMessage::Data { payload: message.data })).await;
                                }
                            }
                            SwarmEvent::NewListenAddr { address, .. } => {
                                info!("Local node is listening on {}", address);
                                if let Some(ref dir) = log_dir {
                                    crate::network::append_log(dir, &format!("[libp2p] LISTENING on {}", address));
                                }
                            }
                            SwarmEvent::IncomingConnection { local_addr, send_back_addr, .. } => {
                                info!("[libp2p] Incoming connection trial: from {} to {}", send_back_addr, local_addr);
                                if let Some(ref dir) = log_dir {
                                    crate::network::append_log(dir, &format!("[libp2p] INCOMING trial from {}", send_back_addr));
                                }
                            }
                            SwarmEvent::ConnectionEstablished { peer_id, endpoint, .. } => {
                                let remote_addr = endpoint.get_remote_address();
                                if blackout_mode_loop.load(std::sync::atomic::Ordering::SeqCst) {
                                    if let Some(socket_addr) = multiaddr_to_socketaddr(remote_addr) {
                                        let is_wan = match socket_addr.ip() {
                                            IpAddr::V4(ipv4) => !ipv4.is_private() && !ipv4.is_loopback() && !ipv4.is_link_local(),
                                            IpAddr::V6(ipv6) => !ipv6.is_loopback(),
                                        };
                                        if is_wan {
                                            let _ = swarm.disconnect_peer_id(peer_id);
                                            blocked_wan_peers_loop.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                                            info!("[libp2p] BLACKOUT: Dropped connection from WAN peer {}", peer_id);
                                            continue;
                                        }
                                    }
                                }
                                info!("[libp2p] Connection ESTABLISHED: peer {} via {:?}", peer_id, remote_addr);
                                if let Some(ref dir) = log_dir {
                                    crate::network::append_log(dir, &format!("[libp2p] CONNECTED to {}", peer_id));
                                }
                            }
                            // BUG B FIX: Handle mDNS discovery events
                             SwarmEvent::Behaviour(RedBehaviourEvent::Mdns(mdns::Event::Discovered(list))) => {
                                if let Some(ref dir) = log_dir {
                                    crate::network::append_log(dir, &format!("[libp2p] mDNS DISCOVERED {} peers", list.len()));
                                }
                                for (peer_id, addr) in list {
                                    if let Some(ref dir) = log_dir {
                                        crate::network::append_log(dir, &format!("[libp2p] mDNS: Found {} at {}", peer_id, addr));
                                    }
                                    let _ = swarm.dial(addr.clone());
                                    info!("[mDNS] Peer discovered: {} at {}", peer_id, addr);
                                    swarm.behaviour_mut().kademlia.add_address(&peer_id, addr.clone());
                                    swarm.behaviour_mut().gossipsub.add_explicit_peer(&peer_id);
                                    
                                    // Robust entry into connected set
                                    connected_clone.lock().unwrap().insert(peer_id.to_bytes());
                                    let mut kp = known_peers_clone.lock().unwrap();
                                    if !kp.iter().any(|p| p.id.as_bytes() == peer_id.to_bytes().as_slice()) {
                                        if let Some(socket) = multiaddr_to_socketaddr(&addr) {
                                            kp.push(crate::network::PeerInfo {
                                                id: PeerId::from_bytes({
                                                    let b = peer_id.to_bytes();
                                                    let mut arr = [0u8; 32];
                                                    arr[..b.len().min(32)].copy_from_slice(&b[..b.len().min(32)]);
                                                    arr
                                                }),
                                                addresses: vec![socket],
                                                public_key: crate::crypto::keys::PublicKey::from_bytes([0u8; 32]),
                                                identity_hash: None,
                                                protocol_version: 1,
                                                user_agent: "red-mdns".to_string(),
                                            });
                                        }
                                    }
                                    // Dial the peer to establish a connection for gossipsub
                                    let _ = swarm.dial(addr);
                                }
                            }
                            SwarmEvent::Behaviour(RedBehaviourEvent::Mdns(mdns::Event::Expired(list))) => {
                                for (peer_id, _addr) in list {
                                    debug!("mDNS peer expired: {}", peer_id);
                                    swarm.behaviour_mut().gossipsub.remove_explicit_peer(&peer_id);
                                    connected_clone.lock().unwrap().remove(&peer_id.to_bytes());
                                    known_peers_clone.lock().unwrap().retain(|p| p.id.as_bytes() != peer_id.to_bytes().as_slice());
                                }
                            }
                            _ => {}
                        }
                    }
                    cmd = cmd_rx.recv() => {
                        if let Some(command) = cmd {
                            match command {
                                TransportCommand::Listen(addr) => {
                                    // FIX: Actually bind the swarm to the given listen address
                                    match swarm.listen_on(addr.clone()) {
                                        Ok(id) => info!("Swarm now listening on {:?} (listener_id={:?})", addr, id),
                                        Err(e) => error!("Failed to listen on {:?}: {:?}", addr, e),
                                    }
                                }
                                TransportCommand::Connect(addr) => {
                                    let _ = swarm.dial(addr);
                                }
                                TransportCommand::SendMessage(peer, msg) => {
                                    match msg {
                                        TransportMessage::Data { payload } => {
                                            let topic = gossipsub::IdentTopic::new("red-messages");
                                            if let Err(e) = swarm.behaviour_mut().gossipsub.publish(topic, payload) {
                                                error!("Failed to publish message: {:?}", e);
                                            }
                                        }
                                        TransportMessage::Onion(packet) => {
                                            // Real Phase 4: Send onion packet to first hop
                                            if let Ok(_p) = libp2p::PeerId::from_bytes(&peer.as_bytes()[..]) {
                                                let data = bincode::serialize(&packet).unwrap();
                                                let routing_topic = gossipsub::IdentTopic::new("red-routing");
                                                let _ = swarm.behaviour_mut().gossipsub.publish(routing_topic, data);
                                            }
                                        }
                                        TransportMessage::IdentityBroadcast { hash, pk } => {
                                            let payload = serde_json::json!({
                                                "identity_hash": hash,
                                                "public_key": pk
                                            }).to_string().into_bytes();
                                            let topic = gossipsub::IdentTopic::new("red-handshake");
                                            let _ = swarm.behaviour_mut().gossipsub.publish(topic, payload);
                                        }
                                        _ => {}
                                    }
                                }
                                TransportCommand::Disconnect(peer) => {
                                    if let Ok(p) = libp2p::PeerId::from_bytes(&peer.as_bytes()[..]) {
                                        let _ = swarm.disconnect_peer_id(p);
                                    }
                                }
                                TransportCommand::Resolve(hash, tx) => {
                                    let peer_id = PeerId::from_bytes(*hash.as_bytes());
                                    // To query Kademlia, we need libp2p::PeerId. 
                                    // Our custom PeerId holds the raw bytes, so we can convert it:
                                    if let Ok(libp2p_peer_id) = libp2p::PeerId::from_bytes(&peer_id.as_bytes()[..]) {
                                        let query_id = swarm.behaviour_mut().kademlia.get_providers(kad::RecordKey::new(&libp2p_peer_id.to_bytes()));
                                        pending_resolves.insert(query_id, (peer_id, tx));
                                    } else {
                                        let _ = tx.send(Err(NetworkError::RoutingFailed("Invalid peer ID for Kademlia".to_string()))).await;
                                    }
                                }
                                TransportCommand::StartProviding => {
                                    let _ = swarm.behaviour_mut().kademlia.start_providing(kad::RecordKey::new(&peer_id.to_bytes()));
                                }
                                TransportCommand::GetKnownPeers(tx) => {
                                    let peers = known_peers_clone.lock().unwrap().clone();
                                    let _ = tx.send(peers).await;
                                }
                                TransportCommand::DisconnectWanPeers => {
                                    let peers: Vec<_> = swarm.connected_peers().copied().collect();
                                    for p in peers {
                                        let _ = swarm.disconnect_peer_id(p);
                                    }
                                    info!("[libp2p] BLACKOUT: Disconnected all active peers to enforce WAN drop. Local peers will auto-reconnect.");
                                }
                            }
                        }
                    }
                }
            }
        });

        Ok(Self {
            cmd_tx,
            msg_rx: Arc::new(tokio::sync::Mutex::new(msg_rx)),
            known_peers,
            connected_peers: connected_peers_set,
            data_dir,
            blackout_mode,
            blocked_wan_peers,
        })
    }
}

// Note: Swarm cannot be easily shared between tasks if used in a trait like this.
// A real implementation would use a Proxy or handle the loop differently.
// For the purpose of RED Phase 2 foundations, we keep the trait but adapt it.

#[async_trait]
impl Transport for Libp2pTransport {
    async fn listen(&self, addr: SocketAddr) -> NetworkResult<()> {
        let multiaddr: Multiaddr = format!("/ip4/{}/tcp/{}", addr.ip(), addr.port())
            .parse()
            .map_err(|e: libp2p::multiaddr::Error| NetworkError::TransportError(e.to_string()))?;
        
        // GAP-19 FIX: In addition to the requested IP (often 0.0.0.0), we attempt to 
        // find and announce the REAL external IP of the device to the swarm.
        // This ensures other devices on the WiFi see a routable address in mDNS packets.
        if addr.ip().is_unspecified() {
            if let Ok(local_ip) = get_local_ip() {
                let external_ma: Multiaddr = format!("/ip4/{}/tcp/{}", local_ip, addr.port()).parse().unwrap();
                let _ = self.cmd_tx.send(TransportCommand::Listen(external_ma)).await;
                info!("[libp2p] Also listening on external IP for mDNS: {}", local_ip);
            }
        }

        let _ = self.cmd_tx.send(TransportCommand::Listen(multiaddr)).await;
        info!("libp2p listen command sent for {:?}", addr);
        Ok(())
    }

    async fn connect(&self, addr: SocketAddr) -> NetworkResult<PeerId> {
        let multiaddr: Multiaddr = format!("/ip4/{}/tcp/{}", addr.ip(), addr.port()).parse().unwrap();
        let _ = self.cmd_tx.send(TransportCommand::Connect(multiaddr)).await;
        // Mocking PeerId for now as connect returns immediately in this async model
        Ok(PeerId::from_bytes([0u8; 32]))
    }

    async fn connect_multiaddr(&self, addr: Multiaddr) -> NetworkResult<()> {
        self.cmd_tx.send(TransportCommand::Connect(addr)).await
            .map_err(|e| NetworkError::TransportError(e.to_string()))
    }

    async fn disconnect_wan_peers(&self) -> NetworkResult<()> {
        let _ = self.cmd_tx.send(TransportCommand::DisconnectWanPeers).await;
        Ok(())
    }

    async fn disconnect(&self, peer_id: &PeerId) -> NetworkResult<()> {
        let _ = self.cmd_tx.send(TransportCommand::Disconnect(peer_id.clone())).await;
        Ok(())
    }

    async fn send(&self, peer_id: &PeerId, message: TransportMessage) -> NetworkResult<()> {
        let _ = self.cmd_tx.send(TransportCommand::SendMessage(peer_id.clone(), message)).await;
        Ok(())
    }

    async fn receive(&self) -> NetworkResult<(PeerId, TransportMessage)> {
        let mut rx: tokio::sync::MutexGuard<'_, mpsc::Receiver<(PeerId, TransportMessage)>> = self.msg_rx.lock().await;
        match rx.recv().await {
            Some(msg) => Ok(msg),
            None => Err(NetworkError::NotInitialized),
        }
    }

    fn connected_peers(&self) -> Vec<PeerId> {
        // GAP-1 FIX: libp2p PeerIds are multihash-encoded and are 38+ bytes, NOT 32.
        // We use prefix-based matching and storage to avoid exclusion.
        self.connected_peers.lock().unwrap()
            .iter()
            .filter(|bytes| !bytes.is_empty())
            .map(|bytes| {
                let mut arr = [0u8; 32];
                let copy_len = bytes.len().min(32);
                arr[..copy_len].copy_from_slice(&bytes[..copy_len]);
                PeerId::from_bytes(arr)
            })
            .collect()
    }

    fn known_peers(&self) -> Vec<crate::network::PeerInfo> {
        self.known_peers.lock().unwrap().clone()
    }

    fn is_connected(&self, peer_id: &PeerId) -> bool {
        // FIX: Use prefix matching since libp2p PeerIds are longer than our 32-byte PeerId wrapper.
        let target = peer_id.as_bytes();
        self.connected_peers.lock().unwrap()
            .iter()
            .any(|bytes| bytes.starts_with(target) || target.starts_with(bytes.as_slice()))
    }

    async fn resolve(&self, id: &crate::identity::IdentityHash) -> NetworkResult<PeerId> {
        let (tx, mut rx): (mpsc::Sender<NetworkResult<PeerId>>, mpsc::Receiver<NetworkResult<PeerId>>) = mpsc::channel(1);
        let _ = self.cmd_tx.send(TransportCommand::Resolve(id.clone(), tx)).await;
        
        // Wait up to 10 seconds for DHT result
        match tokio::time::timeout(Duration::from_secs(10), rx.recv()).await {
            Ok(Some(result)) => result,
            Ok(None) => Err(NetworkError::PeerNotFound(id.to_hex())),
            Err(_timeout) => {
                warn!("DHT resolve timed out for {}", id.to_hex());
                // Fallback: use the hash directly as a peer ID (best-effort)
                Ok(PeerId::from_bytes(*id.as_bytes()))
            }
        }
    }
}

/// Helper to find the primary IPv4 address of this machine.
/// Used to force libp2p to announce a routable address on Android.
fn get_local_ip() -> std::io::Result<IpAddr> {
    use std::net::UdpSocket;
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    // We don't actually send anything; we just connect to trigger the OS 
    // to choose the appropriate local interface for the "internet" routing.
    socket.connect("8.8.8.8:80")?;
    Ok(socket.local_addr()?.ip())
}
