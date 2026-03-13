//! Gossip Protocol for Message Propagation
//!
//! Implements epidemic-style message propagation:
//! - Probabilistic broadcast to peers
//! - Deduplication of messages
//! - TTL-based message expiration
//! - Adaptive fanout based on network size

use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};

use crate::crypto::hashing::blake3_hash;

/// Default gossip fanout (number of peers to forward to)
pub const DEFAULT_FANOUT: usize = 8;

/// Default message TTL (number of hops)
pub const DEFAULT_TTL: u8 = 10;

/// Default cache duration for seen messages
pub const DEFAULT_CACHE_DURATION: Duration = Duration::from_secs(300); // 5 minutes

/// Maximum cache size
pub const MAX_CACHE_SIZE: usize = 10000;

/// Gossip message identifier
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct MessageId([u8; 32]);

impl MessageId {
    /// Create from message content
    pub fn from_content(content: &[u8]) -> Self {
        Self(blake3_hash(content))
    }

    /// Create from bytes
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Get as bytes
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

/// Gossip message wrapper
#[derive(Clone, Debug)]
pub struct GossipMessage {
    /// Unique message identifier
    pub id: MessageId,
    /// Message payload
    pub payload: Vec<u8>,
    /// Time-to-live (remaining hops)
    pub ttl: u8,
    /// Original sender (may be anonymous)
    pub origin: Option<[u8; 32]>,
    /// Timestamp
    pub timestamp: u64,
}

impl GossipMessage {
    /// Create a new gossip message
    pub fn new(payload: Vec<u8>, ttl: u8, origin: Option<[u8; 32]>) -> Self {
        let id = MessageId::from_content(&payload);
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            id,
            payload,
            ttl,
            origin,
            timestamp,
        }
    }

    /// Decrement TTL and return new message
    pub fn forward(&self) -> Option<Self> {
        if self.ttl == 0 {
            return None;
        }

        Some(Self {
            id: self.id.clone(),
            payload: self.payload.clone(),
            ttl: self.ttl - 1,
            origin: self.origin,
            timestamp: self.timestamp,
        })
    }

    /// Check if message has expired
    pub fn is_expired(&self, max_age_secs: u64) -> bool {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        now.saturating_sub(self.timestamp) > max_age_secs
    }
}

/// Cache entry for seen messages
struct CacheEntry {
    /// When the message was first seen
    first_seen: Instant,
    /// Number of times received
    receive_count: u32,
}

/// Gossip protocol state
pub struct GossipProtocol {
    /// Fanout (number of peers to forward to)
    fanout: usize,
    /// Default TTL for new messages
    default_ttl: u8,
    /// Cache of seen message IDs
    seen_cache: HashMap<MessageId, CacheEntry>,
    /// Cache duration
    cache_duration: Duration,
    /// Pending messages to send
    outbound_queue: VecDeque<GossipMessage>,
    /// Received messages
    inbound_queue: VecDeque<GossipMessage>,
    /// Statistics
    stats: GossipStats,
}

/// Gossip statistics
#[derive(Default, Clone, Debug)]
pub struct GossipStats {
    /// Messages originated by us
    pub messages_originated: u64,
    /// Messages forwarded
    pub messages_forwarded: u64,
    /// Messages received (unique)
    pub messages_received: u64,
    /// Duplicate messages filtered
    pub duplicates_filtered: u64,
    /// Messages expired
    pub messages_expired: u64,
}

impl GossipProtocol {
    /// Create a new gossip protocol instance
    pub fn new(fanout: usize, default_ttl: u8) -> Self {
        Self {
            fanout,
            default_ttl,
            seen_cache: HashMap::new(),
            cache_duration: DEFAULT_CACHE_DURATION,
            outbound_queue: VecDeque::new(),
            inbound_queue: VecDeque::new(),
            stats: GossipStats::default(),
        }
    }

    /// Create with default settings
    pub fn with_defaults() -> Self {
        Self::new(DEFAULT_FANOUT, DEFAULT_TTL)
    }

    /// Broadcast a new message
    pub fn broadcast(&mut self, payload: Vec<u8>, origin: Option<[u8; 32]>) -> MessageId {
        let message = GossipMessage::new(payload, self.default_ttl, origin);
        let id = message.id.clone();

        // Mark as seen
        self.mark_seen(&id);

        // Queue for sending
        self.outbound_queue.push_back(message);
        self.stats.messages_originated += 1;

        id
    }

    /// Handle a received message
    pub fn receive(&mut self, message: GossipMessage) -> ReceiveResult {
        // Check if already seen
        if self.is_seen(&message.id) {
            self.stats.duplicates_filtered += 1;
            if let Some(entry) = self.seen_cache.get_mut(&message.id) {
                entry.receive_count += 1;
            }
            return ReceiveResult::Duplicate;
        }

        // Check if expired
        if message.is_expired(300) {
            self.stats.messages_expired += 1;
            return ReceiveResult::Expired;
        }

        // Mark as seen
        self.mark_seen(&message.id);
        self.stats.messages_received += 1;

        // Queue for delivery
        self.inbound_queue.push_back(message.clone());

        // Forward if TTL > 0
        if let Some(forwarded) = message.forward() {
            self.outbound_queue.push_back(forwarded);
            self.stats.messages_forwarded += 1;
            ReceiveResult::AcceptedAndForward
        } else {
            ReceiveResult::Accepted
        }
    }

    /// Get next message to send
    pub fn next_outbound(&mut self) -> Option<GossipMessage> {
        self.outbound_queue.pop_front()
    }

    /// Get next received message
    pub fn next_inbound(&mut self) -> Option<GossipMessage> {
        self.inbound_queue.pop_front()
    }

    /// Check if a message has been seen
    pub fn is_seen(&self, id: &MessageId) -> bool {
        if let Some(entry) = self.seen_cache.get(id) {
            entry.first_seen.elapsed() < self.cache_duration
        } else {
            false
        }
    }

    /// Mark a message as seen
    fn mark_seen(&mut self, id: &MessageId) {
        // Cleanup old entries if cache is too large
        if self.seen_cache.len() >= MAX_CACHE_SIZE {
            self.cleanup_cache();
        }

        self.seen_cache.insert(id.clone(), CacheEntry {
            first_seen: Instant::now(),
            receive_count: 1,
        });
    }

    /// Cleanup expired cache entries
    pub fn cleanup_cache(&mut self) {
        let duration = self.cache_duration;
        self.seen_cache.retain(|_, entry| {
            entry.first_seen.elapsed() < duration
        });
    }

    /// Get current statistics
    pub fn stats(&self) -> &GossipStats {
        &self.stats
    }

    /// Get fanout value
    pub fn fanout(&self) -> usize {
        self.fanout
    }

    /// Set fanout value
    pub fn set_fanout(&mut self, fanout: usize) {
        self.fanout = fanout;
    }

    /// Get cache size
    pub fn cache_size(&self) -> usize {
        self.seen_cache.len()
    }

    /// Get outbound queue size
    pub fn outbound_queue_size(&self) -> usize {
        self.outbound_queue.len()
    }

    /// Get inbound queue size
    pub fn inbound_queue_size(&self) -> usize {
        self.inbound_queue.len()
    }
}

/// Result of receiving a message
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReceiveResult {
    /// Message accepted and will be forwarded
    AcceptedAndForward,
    /// Message accepted but TTL expired
    Accepted,
    /// Message was a duplicate
    Duplicate,
    /// Message was expired
    Expired,
}

/// Peer selection for gossip
pub mod peer_selection {
    use rand::seq::SliceRandom;
    use rand::thread_rng;

    /// Select random peers for gossip
    pub fn select_random_peers<T: Clone>(
        peers: &[T],
        count: usize,
        exclude: Option<&T>,
    ) -> Vec<T>
    where
        T: PartialEq,
    {
        let mut available: Vec<_> = peers.iter()
            .filter(|p| exclude.map(|e| *p != e).unwrap_or(true))
            .cloned()
            .collect();

        let mut rng = thread_rng();
        available.shuffle(&mut rng);
        available.truncate(count);
        available
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_broadcast() {
        let mut gossip = GossipProtocol::with_defaults();
        
        let id = gossip.broadcast(b"Hello, World!".to_vec(), None);
        
        assert!(gossip.is_seen(&id));
        assert_eq!(gossip.outbound_queue_size(), 1);
    }

    #[test]
    fn test_receive_new_message() {
        let mut gossip = GossipProtocol::with_defaults();
        
        let message = GossipMessage::new(b"Test".to_vec(), 5, None);
        let result = gossip.receive(message);
        
        assert_eq!(result, ReceiveResult::AcceptedAndForward);
        assert_eq!(gossip.inbound_queue_size(), 1);
    }

    #[test]
    fn test_duplicate_filtering() {
        let mut gossip = GossipProtocol::with_defaults();
        
        let message = GossipMessage::new(b"Test".to_vec(), 5, None);
        
        let result1 = gossip.receive(message.clone());
        let result2 = gossip.receive(message);
        
        assert_eq!(result1, ReceiveResult::AcceptedAndForward);
        assert_eq!(result2, ReceiveResult::Duplicate);
        assert_eq!(gossip.stats().duplicates_filtered, 1);
    }

    #[test]
    fn test_ttl_expiration() {
        let mut gossip = GossipProtocol::with_defaults();
        
        let message = GossipMessage::new(b"Test".to_vec(), 0, None);
        let result = gossip.receive(message);
        
        // TTL 0 means accepted but not forwarded
        assert_eq!(result, ReceiveResult::Accepted);
    }
}
