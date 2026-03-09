# RED API Reference

## Overview

RED provides a secure, decentralized messaging API with the following core modules:

- **Identity**: User identity management with rotation
- **Crypto**: Cryptographic primitives (encryption, signing, hashing)
- **Protocol**: Message protocol with Double Ratchet
- **Network**: P2P networking with onion routing
- **Storage**: Encrypted local storage
- **Blockchain**: Identity registration and verification

---

## Rust API

### Identity Module

```rust
use red_core::identity::{Identity, IdentityHash};

// Generate new identity
let identity = Identity::generate()?;

// Get public key (shareable)
let public_key: [u8; 32] = identity.public_key();

// Get identity hash (anonymous identifier)
let id_hash: IdentityHash = identity.identity_hash();

// Rotate identity (creates unlinkable new identity)
let new_identity = identity.rotate()?;

// Export identity (encrypted backup)
let backup = identity.export(password)?;

// Import identity from backup
let restored = Identity::import(backup, password)?;
```

### Crypto Module

```rust
use red_core::crypto::{encrypt, decrypt, sign, verify, hash};
use red_core::crypto::ratchet::DoubleRatchet;

// Symmetric encryption (ChaCha20-Poly1305)
let key: [u8; 32] = /* ... */;
let plaintext = b"Hello, World!";
let encrypted = encrypt(&key, plaintext)?;
let decrypted = decrypt(&key, &encrypted)?;

// Hashing (BLAKE3)
let data = b"data to hash";
let hash: [u8; 32] = hash(data);

// Digital signatures (Ed25519)
let keypair = SigningKeyPair::generate();
let message = b"message to sign";
let signature = sign(&keypair.secret, message);
let valid = verify(&keypair.public, message, &signature)?;

// Double Ratchet session
let mut alice_ratchet = DoubleRatchet::init_sender(shared_secret, bob_public_key)?;
let mut bob_ratchet = DoubleRatchet::init_receiver(shared_secret, alice_public_key)?;

// Alice sends
let (header, ciphertext) = alice_ratchet.encrypt(b"Hello Bob!")?;

// Bob receives
let plaintext = bob_ratchet.decrypt(&header, &ciphertext)?;
```

### Protocol Module

```rust
use red_core::protocol::{Message, Conversation, MessageType};

// Create a message
let message = Message::new(
    sender_id,
    recipient_id,
    MessageType::Text,
    b"Hello!".to_vec(),
)?;

// Create a conversation
let mut conversation = Conversation::new(local_identity, remote_public_key)?;

// Send message
let encrypted = conversation.send(b"Hello!")?;

// Receive message
let plaintext = conversation.receive(&encrypted)?;

// Get conversation history
let messages = conversation.messages();
```

### Network Module

```rust
use red_core::network::{NetworkConfig, Node, Peer};

// Configure network
let config = NetworkConfig {
    listen_port: 9000,
    bootstrap_nodes: vec!["node1.red.network:9000".to_string()],
    max_peers: 50,
    onion_hops: 3,
};

// Create and start node
let mut node = Node::new(identity, config)?;
node.start().await?;

// Send message through onion routing
node.send_message(recipient_hash, encrypted_message).await?;

// Receive messages
let messages = node.receive_messages().await?;

// Get connected peers
let peers: Vec<Peer> = node.peers();

// Stop node
node.stop().await?;
```

### Storage Module

```rust
use red_core::storage::{Storage, Contact, Profile};

// Open storage
let mut storage = Storage::new(path, encryption_key);
storage.open()?;

// Add contact
let contact = Contact {
    identity_hash: peer_hash,
    display_name: "Alice".to_string(),
    public_key: peer_public_key,
    verified: false,
    blocked: false,
    ..Default::default()
};
storage.add_contact(contact)?;

// Get contacts
let contacts = storage.get_contacts();

// Set profile
let profile = Profile {
    display_name: "Bob".to_string(),
    status: Some("Available".to_string()),
    avatar: None,
};
storage.set_profile(profile)?;

// Close storage
storage.close()?;
```

### Blockchain Module

```rust
use red_blockchain::{Chain, Block, Transaction, TransactionType};

// Create blockchain
let mut chain = Chain::new();

// Register identity
let tx = Transaction::new(
    TransactionType::RegisterIdentity,
    public_key,
    zk_proof,
);

// Add to pending transactions
chain.add_transaction(tx)?;

// Create new block (validators only)
let block = chain.create_block(validator_key)?;

// Verify block
let valid = chain.verify_block(&block)?;

// Add block to chain
chain.add_block(block)?;

// Query identity
let exists = chain.identity_exists(&public_key)?;
```

---

## Python API

```python
from red_py import Identity, Session, Network, hash_data

# Generate identity
identity = Identity.generate()

# Get public key
public_key = identity.public_key  # bytes, 32 bytes

# Rotate identity
new_identity = identity.rotate()

# Create session
session = Session(identity, peer_public_key)

# Send message
ciphertext = session.send(b"Hello!")

# Receive message
plaintext = session.receive(ciphertext)

# Connect to network
network = Network(identity, bootstrap_nodes=["node1.red.network:9000"])
network.connect()

# Send through network
network.send_message(recipient_hash, ciphertext)

# Receive from network
messages = network.receive_messages()

# Hash data
digest = hash_data(b"data")  # 32 bytes
```

---

## JavaScript/TypeScript API

```typescript
import {
    generateIdentity,
    rotateIdentity,
    createSession,
    ratchetSend,
    ratchetReceive,
    NetworkClient,
    hash
} from 'red-messaging';

// Generate identity
const identity = await generateIdentity();

// Rotate identity
const newIdentity = await rotateIdentity(identity);

// Create session
const session = await createSession(identity, peerPublicKey);

// Send message
const { ciphertext, newState } = await ratchetSend(session, plaintext);

// Receive message
const { plaintext, newState } = await ratchetReceive(session, ciphertext);

// Network client
const client = new NetworkClient(identity);
await client.connect(['node1.red.network:9000']);

// Send message
await client.sendMessage(recipientHash, ciphertext);

// Receive messages
const messages = await client.receiveMessages();

// Hash data
const digest = await hash(data);  // Uint8Array, 32 bytes
```

---

## Error Handling

### Rust Errors

```rust
use red_core::error::RedError;

match result {
    Ok(value) => { /* success */ },
    Err(RedError::CryptoError(e)) => { /* cryptographic error */ },
    Err(RedError::NetworkError(e)) => { /* network error */ },
    Err(RedError::StorageError(e)) => { /* storage error */ },
    Err(RedError::IdentityError(e)) => { /* identity error */ },
    Err(RedError::ProtocolError(e)) => { /* protocol error */ },
}
```

### Python Exceptions

```python
from red_py import RedError, CryptoError, NetworkError

try:
    result = session.send(message)
except CryptoError as e:
    print(f"Crypto error: {e}")
except NetworkError as e:
    print(f"Network error: {e}")
except RedError as e:
    print(f"General error: {e}")
```

### JavaScript Errors

```typescript
try {
    const result = await client.sendMessage(recipient, message);
} catch (error) {
    if (error instanceof CryptoError) {
        console.error('Crypto error:', error.message);
    } else if (error instanceof NetworkError) {
        console.error('Network error:', error.message);
    }
}
```

---

## Configuration

### Network Configuration

```rust
let config = NetworkConfig {
    // Port to listen on
    listen_port: 9000,
    
    // Bootstrap nodes for initial connection
    bootstrap_nodes: vec![
        "node1.red.network:9000".to_string(),
        "node2.red.network:9000".to_string(),
    ],
    
    // Maximum number of peer connections
    max_peers: 50,
    
    // Number of onion routing hops
    onion_hops: 3,
    
    // Interval for dummy message generation (seconds)
    dummy_interval: 30,
    
    // Enable/disable relay mode
    relay_enabled: true,
};
```

### Storage Configuration

```rust
let config = StorageConfig {
    // Path to storage directory
    path: PathBuf::from("~/.red/storage"),
    
    // Maximum message retention (seconds)
    max_retention: 30 * 24 * 60 * 60,  // 30 days
    
    // Enable automatic cleanup
    auto_cleanup: true,
    
    // Cleanup interval (seconds)
    cleanup_interval: 3600,  // 1 hour
};
```

---

## Security Considerations

1. **Key Management**: Never expose secret keys. Use secure storage.
2. **Identity Rotation**: Rotate identities regularly for maximum privacy.
3. **Backup**: Export and securely store identity backups.
4. **Verification**: Verify contacts out-of-band when possible.
5. **Updates**: Keep the library updated for security patches.

---

## Examples

See the `/examples` directory for complete working examples:

- `basic_messaging.rs` - Simple message exchange
- `group_chat.rs` - Group messaging
- `file_transfer.rs` - Encrypted file sharing
- `cli_client.rs` - Command-line client
