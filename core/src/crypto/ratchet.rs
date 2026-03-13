//! Double Ratchet implementation for forward secrecy.
//!
//! Based on the Signal Protocol's Double Ratchet algorithm.

use serde::{Deserialize, Serialize};
use zeroize::ZeroizeOnDrop;

use super::{
    encryption::{decrypt, encrypt, EncryptedData},
    hashing::{derive_chain_keys, derive_symmetric_key},
    keys::{KeyPair, PublicKey},
    CryptoError, CryptoResult,
};

/// Maximum number of skipped message keys to store
const MAX_SKIP: usize = 1000;

/// State of the Double Ratchet
#[derive(Clone, ZeroizeOnDrop, Serialize, Deserialize)]
pub struct RatchetState {
    /// Our current ratchet key pair
    #[zeroize(skip)]
    dh_self: Option<KeyPair>,
    
    /// Their current ratchet public key
    #[zeroize(skip)]
    dh_remote: Option<PublicKey>,
    
    /// Root key
    root_key: [u8; 32],
    
    /// Sending chain key
    chain_key_send: Option<[u8; 32]>,
    
    /// Receiving chain key
    chain_key_recv: Option<[u8; 32]>,
    
    /// Sending message number
    n_send: u32,
    
    /// Receiving message number
    n_recv: u32,
    
    /// Previous sending chain length
    pn: u32,

    /// Skipped message keys (for out-of-order messages)
    #[zeroize(skip)]
    skipped_message_keys: std::collections::HashMap<(PublicKey, u32), [u8; 32]>,
}

impl RatchetState {
    /// Create a new ratchet state (for initiator)
    pub fn new_initiator(
        shared_secret: [u8; 32],
        their_public: PublicKey,
    ) -> CryptoResult<Self> {
        let dh_self = KeyPair::generate();
        let dh_output = dh_self.key_exchange(&their_public);
        
        // Derive root key and sending chain key
        let derived = derive_symmetric_key(
            &shared_secret,
            &dh_output,
            b"RED-ratchet-init",
        )?;
        
        let chain_key_send = derive_symmetric_key(
            &derived,
            b"",
            b"RED-chain-send",
        )?;

        Ok(Self {
            dh_self: Some(dh_self),
            dh_remote: Some(their_public),
            root_key: derived,
            chain_key_send: Some(chain_key_send),
            chain_key_recv: None,
            n_send: 0,
            n_recv: 0,
            pn: 0,
            skipped_message_keys: std::collections::HashMap::new(),
        })
    }

    /// Create a new ratchet state (for responder)
    pub fn new_responder(
        shared_secret: [u8; 32],
        our_keypair: KeyPair,
    ) -> CryptoResult<Self> {
        Ok(Self {
            dh_self: Some(our_keypair),
            dh_remote: None,
            root_key: shared_secret,
            chain_key_send: None,
            chain_key_recv: None,
            n_send: 0,
            n_recv: 0,
            pn: 0,
            skipped_message_keys: std::collections::HashMap::new(),
        })
    }
}

/// Double Ratchet for secure messaging
#[derive(Clone, Serialize, Deserialize)]
pub struct DoubleRatchet {
    state: RatchetState,
}

impl std::fmt::Debug for RatchetState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "RatchetState(<REDACTED>)")
    }
}

impl std::fmt::Debug for DoubleRatchet {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "DoubleRatchet(<REDACTED>)")
    }
}

/// Header for ratchet messages
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RatchetHeader {
    /// Sender's current ratchet public key
    pub dh_public: PublicKey,
    /// Previous chain message count
    pub pn: u32,
    /// Message number in current chain
    pub n: u32,
}

/// Encrypted message with ratchet header
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RatchetMessage {
    /// Message header
    pub header: RatchetHeader,
    /// Encrypted content
    pub ciphertext: EncryptedData,
}

impl DoubleRatchet {
    /// Create a new Double Ratchet as initiator
    pub fn new_initiator(
        shared_secret: [u8; 32],
        their_public: PublicKey,
    ) -> CryptoResult<Self> {
        let state = RatchetState::new_initiator(shared_secret, their_public)?;
        Ok(Self { state })
    }

    /// Create a new Double Ratchet as responder
    pub fn new_responder(
        shared_secret: [u8; 32],
        our_keypair: KeyPair,
    ) -> CryptoResult<Self> {
        let state = RatchetState::new_responder(shared_secret, our_keypair)?;
        Ok(Self { state })
    }

    /// Encrypt a message
    pub fn encrypt(&mut self, plaintext: &[u8]) -> CryptoResult<RatchetMessage> {
        let dh_self = self.state.dh_self.as_ref()
            .ok_or_else(|| CryptoError::EncryptionError("No DH key".to_string()))?;
        
        let chain_key = self.state.chain_key_send.as_ref()
            .ok_or_else(|| CryptoError::EncryptionError("No chain key".to_string()))?;

        // Derive message key and advance chain
        let (new_chain_key, message_key) = derive_chain_keys(chain_key)?;
        self.state.chain_key_send = Some(new_chain_key);

        // Create header
        let header = RatchetHeader {
            dh_public: dh_self.public.clone(),
            pn: self.state.pn,
            n: self.state.n_send,
        };

        // Encrypt message
        let ciphertext = encrypt(&message_key, plaintext)?;

        // Increment message counter
        self.state.n_send += 1;

        Ok(RatchetMessage { header, ciphertext })
    }

    /// Decrypt a message
    pub fn decrypt(&mut self, message: &RatchetMessage) -> CryptoResult<Vec<u8>> {
        // Check if we already have the skip key
        if let Some(key) = self.state.skipped_message_keys.remove(&(message.header.dh_public.clone(), message.header.n)) {
            return decrypt(&key, &message.ciphertext);
        }

        // Check if we need to perform a DH ratchet step
        let need_ratchet = match &self.state.dh_remote {
            Some(remote) => remote != &message.header.dh_public,
            None => true,
        };

        if need_ratchet {
            // Before ratcheting, store any remaining keys from current chain
            self.skip_message_keys(message.header.pn)?;
            self.dh_ratchet(&message.header.dh_public)?;
        }

        // Skip messages in current chain
        self.skip_message_keys(message.header.n)?;

        let chain_key = self.state.chain_key_recv.as_ref()
            .ok_or_else(|| CryptoError::DecryptionError("No chain key".to_string()))?;

        // Derive current message key and advance chain
        let (new_chain, message_key) = derive_chain_keys(chain_key)?;
        self.state.chain_key_recv = Some(new_chain);
        self.state.n_recv += 1;

        // Decrypt
        decrypt(&message_key, &message.ciphertext)
    }

    /// Store message keys for skipped messages
    fn skip_message_keys(&mut self, until: u32) -> CryptoResult<()> {
        if self.state.n_recv >= until {
            return Ok(());
        }

        if (until - self.state.n_recv) as usize + self.state.skipped_message_keys.len() > MAX_SKIP {
            return Err(CryptoError::DecryptionError("Too many skipped messages".to_string()));
        }

        if let (Some(chain_key), Some(remote_pub)) = (&self.state.chain_key_recv, &self.state.dh_remote) {
            let mut current_chain = *chain_key;
            let remote_pub = remote_pub.clone();

            while self.state.n_recv < until {
                let (new_chain, message_key) = derive_chain_keys(&current_chain)?;
                self.state.skipped_message_keys.insert((remote_pub.clone(), self.state.n_recv), message_key);
                current_chain = new_chain;
                self.state.n_recv += 1;
            }
            self.state.chain_key_recv = Some(current_chain);
        }

        Ok(())
    }

    /// Perform DH ratchet step
    fn dh_ratchet(&mut self, their_public: &PublicKey) -> CryptoResult<()> {
        self.state.pn = self.state.n_send;
        self.state.n_send = 0;
        self.state.n_recv = 0;
        self.state.dh_remote = Some(their_public.clone());

        // Derive receiving chain key
        if let Some(ref dh_self) = self.state.dh_self {
            let dh_output = dh_self.key_exchange(their_public);
            let recv_chain = derive_symmetric_key(
                &self.state.root_key,
                &dh_output,
                b"RED-chain-recv",
            )?;
            self.state.chain_key_recv = Some(recv_chain);

            // Update root key
            self.state.root_key = derive_symmetric_key(
                &self.state.root_key,
                &dh_output,
                b"RED-root-update",
            )?;
        }

        // Generate new DH key pair
        let new_dh = KeyPair::generate();
        
        // Derive sending chain key
        let dh_output = new_dh.key_exchange(their_public);
        let send_chain = derive_symmetric_key(
            &self.state.root_key,
            &dh_output,
            b"RED-chain-send",
        )?;
        self.state.chain_key_send = Some(send_chain);

        // Update root key again
        self.state.root_key = derive_symmetric_key(
            &self.state.root_key,
            &dh_output,
            b"RED-root-update",
        )?;

        self.state.dh_self = Some(new_dh);

        Ok(())
    }

    /// Get our current public key
    pub fn public_key(&self) -> Option<&PublicKey> {
        self.state.dh_self.as_ref().map(|kp| &kp.public)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_ratchets() -> (DoubleRatchet, DoubleRatchet) {
        // Simulate X3DH key agreement
        let shared_secret = [0x42u8; 32];
        
        // Bob generates his signed prekey
        let bob_prekey = KeyPair::generate();
        let bob_public = bob_prekey.public.clone();

        // Alice initiates
        let alice = DoubleRatchet::new_initiator(
            shared_secret,
            bob_public,
        ).unwrap();

        // Bob responds
        let bob = DoubleRatchet::new_responder(
            shared_secret,
            bob_prekey,
        ).unwrap();

        (alice, bob)
    }

    #[test]
    fn test_basic_exchange() {
        let (mut alice, mut bob) = setup_ratchets();

        // Alice sends to Bob
        let msg1 = alice.encrypt(b"Hello Bob!").unwrap();
        let decrypted1 = bob.decrypt(&msg1).unwrap();
        assert_eq!(decrypted1, b"Hello Bob!");

        // Bob sends to Alice
        let msg2 = bob.encrypt(b"Hello Alice!").unwrap();
        let decrypted2 = alice.decrypt(&msg2).unwrap();
        assert_eq!(decrypted2, b"Hello Alice!");
    }

    #[test]
    fn test_multiple_messages() {
        let (mut alice, mut bob) = setup_ratchets();

        for i in 0..10 {
            let plaintext = format!("Message {}", i);
            let msg = alice.encrypt(plaintext.as_bytes()).unwrap();
            let decrypted = bob.decrypt(&msg).unwrap();
            assert_eq!(decrypted, plaintext.as_bytes());
        }
    }

    #[test]
    fn test_alternating_messages() {
        let (mut alice, mut bob) = setup_ratchets();

        for i in 0..5 {
            // Alice -> Bob
            let msg_a = alice.encrypt(format!("A{}", i).as_bytes()).unwrap();
            let dec_a = bob.decrypt(&msg_a).unwrap();
            assert_eq!(dec_a, format!("A{}", i).as_bytes());

            // Bob -> Alice
            let msg_b = bob.encrypt(format!("B{}", i).as_bytes()).unwrap();
            let dec_b = alice.decrypt(&msg_b).unwrap();
            assert_eq!(dec_b, format!("B{}", i).as_bytes());
        }
    }
}
