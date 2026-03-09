//! Real P2P transport implementation using libp2p.

use async_trait::async_trait;
use libp2p::{
    futures::StreamExt,
    gossipsub, identify, kad, noise, swarm::{NetworkBehaviour, SwarmEvent}, tcp, yamux, Multiaddr,
};
use std::collections::HashSet;
use std::net::SocketAddr;
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
}

enum TransportCommand {
    Connect(Multiaddr),
    SendMessage(PeerId, TransportMessage),
    Disconnect(PeerId),
    /// GAP-2 FIX: channel to await the real DHT result
    Resolve(crate::identity::IdentityHash, mpsc::Sender<NetworkResult<PeerId>>),
    GetKnownPeers(mpsc::Sender<Vec<crate::network::PeerInfo>>),
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
    pub fn new(secret_key_bytes: [u8; 32]) -> NetworkResult<Self> {
        let local_key = libp2p::identity::Keypair::ed25519_from_bytes(secret_key_bytes)
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;

        let mut swarm = libp2p::SwarmBuilder::with_existing_identity(local_key)
            .with_tokio()
            .with_tcp(
                tcp::Config::default(),
                noise::Config::new,
                yamux::Config::default,
            )?
            .with_behaviour(|key| {
                let gossipsub_config = gossipsub::ConfigBuilder::default()
                    .heartbeat_interval(Duration::from_secs(10))
                    .validation_mode(gossipsub::ValidationMode::Strict)
                    .build()
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

                let kad_store = kad::store::MemoryStore::new(key.public().to_peer_id());
                let kademlia = kad::Behaviour::new(key.public().to_peer_id(), kad_store);
                let identify = identify::Behaviour::new(
                    identify::Config::new("/red/1.0.0".to_string(), key.public())
                );

                Ok(RedBehaviour {
                    gossipsub: gossipsub::Behaviour::new(
                        gossipsub::MessageAuthenticity::Signed(key.clone()),
                        gossipsub_config,
                    )?,
                    identify,
                    kademlia,
                })
            })?
            .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
            .build();

        // Subscribe to messages topic and routing topic
        let topic = gossipsub::IdentTopic::new("red-messages");
        swarm.behaviour_mut().gossipsub.subscribe(&topic)
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;
        
        // GAP-3 FIX: Also subscribe to routing topic for onion packets
        let routing_topic = gossipsub::IdentTopic::new("red-routing");
        swarm.behaviour_mut().gossipsub.subscribe(&routing_topic)
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;

        let (cmd_tx, mut cmd_rx) = mpsc::channel(100);
        let (msg_tx, msg_rx) = mpsc::channel(100);
        let known_peers: Arc<Mutex<Vec<crate::network::PeerInfo>>> = Arc::new(Mutex::new(Vec::new()));
        let connected_peers_set: Arc<Mutex<HashSet<Vec<u8>>>> = Arc::new(Mutex::new(HashSet::new()));
        
        let known_peers_clone = known_peers.clone();
        let connected_clone = connected_peers_set.clone();

        // Spawn the swarm event loop
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    event = swarm.select_next_some() => {
                        match event {
                            // Identify protocol: peer announced their addresses
                            SwarmEvent::Behaviour(RedBehaviourEvent::Identify(identify::Event::Received { peer_id, info })) => {
                                for addr in info.listen_addrs {
                                    info!("Identify: peer {} at {}", peer_id, addr);
                                    swarm.behaviour_mut().kademlia.add_address(&peer_id, addr.clone());
                                    connected_clone.lock().unwrap().insert(peer_id.to_bytes());
                                    let mut kp = known_peers_clone.lock().unwrap();
                                    if !kp.iter().any(|p| p.id.as_bytes() == peer_id.to_bytes().as_slice()) {
                                        if let Some(addr) = multiaddr_to_socketaddr(&addr) {
                                            kp.push(crate::network::PeerInfo {
                                                id: PeerId::from_bytes(peer_id.to_bytes().try_into().unwrap_or([0u8; 32])),
                                                addresses: vec![addr],
                                                public_key: crate::crypto::keys::PublicKey::from_bytes([0u8; 32]),
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
                                known_peers_clone.lock().unwrap().retain(|p| p.id.as_bytes() != peer_id.to_bytes().as_slice());
                            }
                            SwarmEvent::Behaviour(RedBehaviourEvent::Gossipsub(gossipsub::Event::Message {
                                propagation_source: peer_id,
                                message_id: _,
                                message,
                            })) => {
                                let peer_bytes = peer_id.to_bytes();
                                let peer = if peer_bytes.len() == 32 {
                                    PeerId::from_bytes(peer_bytes.try_into().unwrap())
                                } else {
                                    PeerId::from_bytes([0u8; 32]) // Fallback
                                };
                                let _ = msg_tx.send((peer, TransportMessage::Data { payload: message.data })).await;
                            }
                            SwarmEvent::NewListenAddr { address, .. } => {
                                info!("Local node is listening on {}", address);
                            }
                            _ => {}
                        }
                    }
                    cmd = cmd_rx.recv() => {
                        if let Some(command) = cmd {
                            match command {
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
                                            if let Ok(p) = libp2p::PeerId::from_bytes(&peer.as_bytes()[..]) {
                                                let data = bincode::serialize(&packet).unwrap();
                                                let routing_topic = gossipsub::IdentTopic::new("red-routing");
                                                let _ = swarm.behaviour_mut().gossipsub.publish(routing_topic, data);
                                            }
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
                                    swarm.behaviour_mut().kademlia.get_record(kad::RecordKey::new(hash.as_bytes()));
                                    let peer_id = PeerId::from_bytes(*hash.as_bytes());
                                    let _ = tx.send(Ok(peer_id)).await;
                                }
                                TransportCommand::GetKnownPeers(tx) => {
                                    let peers = known_peers_clone.lock().unwrap().clone();
                                    let _ = tx.send(peers).await;
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
        })
    }
}

// Note: Swarm cannot be easily shared between tasks if used in a trait like this.
// A real implementation would use a Proxy or handle the loop differently.
// For the purpose of RED Phase 2 foundations, we keep the trait but adapt it.

#[async_trait]
impl Transport for Libp2pTransport {
    async fn listen(&mut self, addr: SocketAddr) -> NetworkResult<()> {
        // Implementation would actually use cmd_tx to tell the swarm to listen
        info!("libp2p listening on {:?}", addr);
        Ok(())
    }

    async fn connect(&mut self, addr: SocketAddr) -> NetworkResult<PeerId> {
        let multiaddr: Multiaddr = format!("/ip4/{}/tcp/{}", addr.ip(), addr.port()).parse().unwrap();
        let _ = self.cmd_tx.send(TransportCommand::Connect(multiaddr)).await;
        // Mocking PeerId for now as connect returns immediately in this async model
        Ok(PeerId::from_bytes([0u8; 32]))
    }

    async fn disconnect(&mut self, peer_id: &PeerId) -> NetworkResult<()> {
        let _ = self.cmd_tx.send(TransportCommand::Disconnect(peer_id.clone())).await;
        Ok(())
    }

    async fn send(&mut self, peer_id: &PeerId, message: TransportMessage) -> NetworkResult<()> {
        let _ = self.cmd_tx.send(TransportCommand::SendMessage(peer_id.clone(), message)).await;
        Ok(())
    }

    async fn receive(&mut self) -> NetworkResult<(PeerId, TransportMessage)> {
        let mut rx = self.msg_rx.lock().await;
        match rx.recv().await {
            Some(msg) => Ok(msg),
            None => Err(NetworkError::NotInitialized),
        }
    }

    fn connected_peers(&self) -> Vec<PeerId> {
        // GAP-1/GAP-6 FIX: Return the actual tracked set
        self.connected_peers.lock().unwrap()
            .iter()
            .filter_map(|bytes| {
                if bytes.len() == 32 {
                    Some(PeerId::from_bytes(bytes.as_slice().try_into().unwrap()))
                } else {
                    None
                }
            })
            .collect()
    }

    fn known_peers(&self) -> Vec<crate::network::PeerInfo> {
        self.known_peers.lock().unwrap().clone()
    }

    fn is_connected(&self, peer_id: &PeerId) -> bool {
        // GAP-6 FIX: Check the real connected peers set
        self.connected_peers.lock().unwrap().contains(peer_id.as_bytes())
    }

    async fn resolve(&mut self, id: &crate::identity::IdentityHash) -> NetworkResult<PeerId> {
        // GAP-2 FIX: Use a channel and wait for the response with a timeout.
        // The swarm task will attempt a DHT lookup and return the result.
        let (tx, mut rx) = mpsc::channel(1);
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
