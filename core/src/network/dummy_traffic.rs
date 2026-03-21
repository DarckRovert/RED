//! Dummy Traffic Generator
//!
//! Implements traffic analysis resistance through dummy messages:
//! - Messages sent according to Poisson process with rate λ_dummy
//! - Real messages replace scheduled dummy messages
//! - Indistinguishable from real traffic

use std::time::{Duration, Instant};
use rand::Rng;
use rand_distr::{Distribution, Exp};

/// Default dummy traffic rate (messages per second)
pub const DEFAULT_LAMBDA: f64 = 1.0 / 30.0; // One message every 30 seconds

/// Dummy traffic generator
pub struct DummyTrafficGenerator {
    /// Poisson rate parameter
    lambda: f64,
    /// Exponential distribution for inter-arrival times
    exp_dist: Exp<f64>,
    /// Next scheduled send time
    next_send: Instant,
    /// Whether generator is active
    active: bool,
    /// Statistics
    stats: TrafficStats,
}

/// Traffic statistics
#[derive(Default, Clone, Debug)]
pub struct TrafficStats {
    /// Total dummy messages sent
    pub dummy_sent: u64,
    /// Total real messages sent
    pub real_sent: u64,
    /// Total messages (dummy + real)
    pub total_sent: u64,
}

impl DummyTrafficGenerator {
    /// Create a new dummy traffic generator
    pub fn new(lambda: f64) -> Self {
        let exp_dist = Exp::new(lambda).unwrap_or_else(|_| Exp::new(DEFAULT_LAMBDA).unwrap());
        let next_send = Instant::now() + Self::sample_delay(&exp_dist);

        Self {
            lambda,
            exp_dist,
            next_send,
            active: true,
            stats: TrafficStats::default(),
        }
    }

    /// Create with default rate
    pub fn with_default_rate() -> Self {
        Self::new(DEFAULT_LAMBDA)
    }

    /// Check if it's time to send a message
    pub fn should_send(&self) -> bool {
        self.active && Instant::now() >= self.next_send
    }

    /// Get time until next scheduled send
    pub fn time_until_next(&self) -> Duration {
        let now = Instant::now();
        if now >= self.next_send {
            Duration::ZERO
        } else {
            self.next_send - now
        }
    }

    /// Record that a dummy message was sent
    pub fn record_dummy_sent(&mut self) {
        self.stats.dummy_sent += 1;
        self.stats.total_sent += 1;
        self.schedule_next();
    }

    /// Record that a real message was sent (replaces dummy)
    pub fn record_real_sent(&mut self) {
        self.stats.real_sent += 1;
        self.stats.total_sent += 1;
        self.schedule_next();
    }

    /// Schedule the next send time
    fn schedule_next(&mut self) {
        self.next_send = Instant::now() + Self::sample_delay(&self.exp_dist);
    }

    /// Sample delay from exponential distribution
    fn sample_delay(exp_dist: &Exp<f64>) -> Duration {
        let mut rng = rand::thread_rng();
        let delay_secs = exp_dist.sample(&mut rng);
        Duration::from_secs_f64(delay_secs)
    }

    /// Start the generator
    pub fn start(&mut self) {
        self.active = true;
        self.schedule_next();
    }

    /// Stop the generator
    pub fn stop(&mut self) {
        self.active = false;
    }

    /// Check if generator is active
    pub fn is_active(&self) -> bool {
        self.active
    }

    /// Get current statistics
    pub fn stats(&self) -> &TrafficStats {
        &self.stats
    }

    /// Get the lambda (rate) parameter
    pub fn lambda(&self) -> f64 {
        self.lambda
    }

    /// Update the rate parameter
    pub fn set_lambda(&mut self, lambda: f64) {
        self.lambda = lambda;
        self.exp_dist = Exp::new(lambda).unwrap_or_else(|_| Exp::new(DEFAULT_LAMBDA).unwrap());
    }
}

/// Dummy message content generator
pub struct DummyMessageGenerator {
    /// Size of dummy messages (should match real message size)
    message_size: usize,
}

impl DummyMessageGenerator {
    /// Create a new dummy message generator
    pub fn new(message_size: usize) -> Self {
        Self { message_size }
    }

    /// Generate a random dummy message
    pub fn generate(&self) -> Vec<u8> {
        let mut rng = rand::thread_rng();
        let mut message = vec![0u8; self.message_size];
        rng.fill(&mut message[..]);
        message
    }

    /// Generate dummy message with specific pattern
    /// (for testing traffic analysis resistance)
    pub fn generate_patterned(&self, pattern: u8) -> Vec<u8> {
        vec![pattern; self.message_size]
    }
}

/// Traffic scheduler that manages both real and dummy traffic
pub struct TrafficScheduler {
    /// Dummy traffic generator
    dummy_gen: DummyTrafficGenerator,
    /// Message generator
    msg_gen: DummyMessageGenerator,
    /// Queue of real messages waiting to be sent
    real_queue: Vec<Vec<u8>>,
    /// Maximum queue size
    max_queue_size: usize,
}

impl TrafficScheduler {
    /// Create a new traffic scheduler
    pub fn new(lambda: f64, message_size: usize, max_queue_size: usize) -> Self {
        Self {
            dummy_gen: DummyTrafficGenerator::new(lambda),
            msg_gen: DummyMessageGenerator::new(message_size),
            real_queue: Vec::new(),
            max_queue_size,
        }
    }

    /// Queue a real message for sending
    pub fn queue_message(&mut self, message: Vec<u8>) -> Result<(), SchedulerError> {
        if self.real_queue.len() >= self.max_queue_size {
            return Err(SchedulerError::QueueFull);
        }
        self.real_queue.push(message);
        Ok(())
    }

    /// Get the next message to send (real or dummy)
    /// Returns None if it's not time to send yet
    pub fn next_message(&mut self) -> Option<(Vec<u8>, bool)> {
        if !self.dummy_gen.should_send() {
            return None;
        }

        // Prefer real messages over dummy
        if let Some(real_msg) = self.real_queue.pop() {
            self.dummy_gen.record_real_sent();
            Some((real_msg, true)) // true = real message
        } else {
            let dummy_msg = self.msg_gen.generate();
            self.dummy_gen.record_dummy_sent();
            Some((dummy_msg, false)) // false = dummy message
        }
    }

    /// Get time until next scheduled send
    pub fn time_until_next(&self) -> Duration {
        self.dummy_gen.time_until_next()
    }

    /// Get statistics
    pub fn stats(&self) -> &TrafficStats {
        self.dummy_gen.stats()
    }

    /// Get queue length
    pub fn queue_len(&self) -> usize {
        self.real_queue.len()
    }

    /// Start the scheduler
    pub fn start(&mut self) {
        self.dummy_gen.start();
    }

    /// Stop the scheduler
    pub fn stop(&mut self) {
        self.dummy_gen.stop();
    }
}

/// Scheduler errors
#[derive(Debug, Clone)]
pub enum SchedulerError {
    QueueFull,
}

impl std::fmt::Display for SchedulerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SchedulerError::QueueFull => write!(f, "Message queue is full"),
        }
    }
}

impl std::error::Error for SchedulerError {}

/// Phase 18: Decoy Vault Auto-Population
/// Injects organic-looking fake contacts and mundane conversation history into a fresh SQLite vault.
/// This ensures interrogators do not see a suspiciously empty app when the Duress PIN is entered.
pub fn populate_decoy_vault(storage: &mut crate::storage::Storage, my_id: &crate::identity::IdentityHash) {
    let fake_contacts = vec![
        ("Mamá", "Hola hijo, ¿vas a venir a cenar hoy?"),
        ("Suscripción de Streaming", "Su factura ha sido pagada. Su plan termina el 30."),
        ("Carlos Universidad", "¿Ya hiciste la tarea de finanzas? Está imposible hermano"),
    ];

    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();

    for (i, (name, first_msg)) in fake_contacts.iter().enumerate() {
        use crate::identity::IdentityBuilder;
        let fake_id = IdentityBuilder::new().build().unwrap();
        let fake_hash = fake_id.identity_hash().clone();
        
        let contact = crate::storage::Contact {
            identity_hash: fake_hash.clone(),
            display_name: name.to_string(),
            public_key: *fake_id.public_key().as_bytes(),
            added_at: now - (i as u64 * 3600),
            verified: false,
            blocked: false,
            notes: None,
        };
        let _ = storage.add_contact(contact);

        let msg = crate::protocol::Message {
            id: crate::protocol::MessageId::generate(),
            sender: fake_hash.clone(),
            recipient: my_id.clone(),
            timestamp: now - (i as u64 * 8000) - 600,
            content: crate::protocol::MessageType::Text(first_msg.to_string()),
            reply_to: None,
            status: crate::protocol::MessageStatus::Delivered,
        };
        let _ = storage.add_message(msg);
        
        let reply = crate::protocol::Message {
            id: crate::protocol::MessageId::generate(),
            sender: my_id.clone(),
            recipient: fake_hash.clone(),
            timestamp: now - (i as u64 * 8000),
            content: crate::protocol::MessageType::Text("Claro, todo bien.".to_string()),
            reply_to: None,
            status: crate::protocol::MessageStatus::Sent,
        };
        let _ = storage.add_message(reply);
    }
    
    let _ = storage.save_conversations();
    tracing::info!("Decoy Vault autonomously populated with mundane conversation history.");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;

    #[test]
    fn test_dummy_generator_timing() {
        // Use high rate for faster testing
        let mut gen = DummyTrafficGenerator::new(100.0); // 100 msgs/sec
        
        // Should eventually trigger
        let mut triggered = false;
        for _ in 0..100 {
            if gen.should_send() {
                triggered = true;
                gen.record_dummy_sent();
                break;
            }
            sleep(Duration::from_millis(10));
        }
        
        assert!(triggered);
    }

    #[test]
    fn test_traffic_scheduler() {
        let mut scheduler = TrafficScheduler::new(100.0, 64, 10);
        
        // Queue a real message
        let real_msg = vec![0x42u8; 64];
        scheduler.queue_message(real_msg.clone()).unwrap();
        
        // Wait for send time
        sleep(Duration::from_millis(50));
        
        // Should get the real message
        if let Some((msg, is_real)) = scheduler.next_message() {
            if is_real {
                assert_eq!(msg, real_msg);
            }
        }
    }

    #[test]
    fn test_dummy_message_generator() {
        let gen = DummyMessageGenerator::new(128);
        
        let msg1 = gen.generate();
        let msg2 = gen.generate();
        
        assert_eq!(msg1.len(), 128);
        assert_eq!(msg2.len(), 128);
        
        // Messages should be different (random)
        assert_ne!(msg1, msg2);
    }
}
