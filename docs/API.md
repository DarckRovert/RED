# RED API Reference (v31.0.0 Sovereign Master)

## Overview

RED provides a secure, decentralized messaging API with core modules across Rust native (`core`, `red_mobile`) and JavaScript client (`useRedStore`, `RedAPI`):

- **Identity**: Sovereign identity management with DID (`did:red:<hash>:<pk>`)
- **Crypto**: Cryptographic primitives (Noise XK, ChaCha20-Poly1305, Ed25519, X25519, Kyber-1024)
- **Protocol**: Protocol Ω envelope with Controlled Flood routing
- **Network**: P2P networking with BLE GATT Server, WiFi Direct, LoRa Radio and SoundMesh
- **Axum Local Server (`127.0.0.1:7333`)**: HTTP REST API and Real-Time SSE Event streams (`/api/events`)
- **Native Hardware Actuators**: Android Camera2 API Torch, Morse SOS thread, environmental sensors and zero-trust wipe
- **Storage**: Encrypted local Sled embedded key-value database

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

---

## HTTP REST API Reference

The local node exposes an HTTP REST API on `http://localhost:7333` for UI communication.

### Contacts Management

#### 1. Add Contact
* **Endpoint:** `POST /api/contacts`
* **Request Body:**
  ```json
  {
    "identity_hash": "hex_string",
    "display_name": "string",
    "public_key": "hex_string_optional"
  }
  ```

#### 2. Block Contact
* **Endpoint:** `POST /api/contacts/:hash/block`
* **Description:** Prevents the node from processing incoming messages from this contact and discards them at the network layer.

#### 3. Unblock Contact
* **Endpoint:** `POST /api/contacts/:hash/unblock`

#### 4. Toggle Verify Contact
* **Endpoint:** `POST /api/contacts/:hash/verify`
* **Response Body:**
  ```json
  {
    "ok": true,
    "verified": true
  }
  ```

### Messaging

#### 1. Send Message
* **Endpoint:** `POST /api/messages/send`
* **Request Body:**
  ```json
  {
    "recipient": "hex_identity_hash",
    "content": "string_content"
  }
  ```
* **Description:** Attempts to deliver the message. If the recipient is offline, it is saved in the `pending_deliveries` Sled tree and retried every 15 seconds.

#### 2. Get Messages
* **Endpoint:** `GET /api/conversations/:id/messages`

#### 3. Mark Conversation as Read
* **Endpoint:** `POST /api/conversations/:id/read`

---

### v19.0 AMBER Alert System API

#### 1. Emit AMBER Alert
* **Endpoint:** `POST /api/amber/alert`
* **Request Body:**
  ```json
  {
    "name": "Nombre de la Persona",
    "age": 12,
    "description": "Descripción física y circunstancias",
    "photo_b64": "base64_string_opcional",
    "last_seen_lat": 19.4326,
    "last_seen_lon": -99.1332,
    "last_seen_location": "Ubicación textual",
    "ttl_secs": 259200,
    "authority_signature": "firma_ed25519",
    "authority_node_id": "hex_identity_hash_autoridad"
  }
  ```

#### 2. List Active AMBER Alerts
* **Endpoint:** `GET /api/amber/alerts`

#### 3. Get Specific AMBER Alert (with photo)
* **Endpoint:** `GET /api/amber/alerts/:id`

#### 4. Mark AMBER Alert as Resolved
* **Endpoint:** `POST /api/amber/alerts/:id/resolve`
* **Request Body:**
  ```json
  {
    "authority_node_id": "hex_identity_hash_autoridad",
    "authority_signature": "firma_ed25519",
    "resolution_notes": "Persona encontrada de forma segura"
  }
  ```

#### 5. Report Sighting
* **Endpoint:** `POST /api/amber/alerts/:id/sighting`
* **Request Body:**
  ```json
  {
    "lat": 19.4326,
    "lon": -99.1332,
    "notes": "Descripción del lugar y circunstancia del avistamiento"
  }
  ```

---

### v19.0 Guardian IA Moderation API

#### 1. Get Guardian Status & Statistics
* **Endpoint:** `GET /api/guardian/status`
* **Response:**
  ```json
  {
    "active": true,
    "mode": "strict",
    "has_api_key": true,
    "model": "meta-llama/llama-guard-4-12b",
    "stats": {
      "messages_analyzed": 142,
      "messages_blocked": 3,
      "messages_flagged": 0,
      "images_analyzed": 12,
      "images_blocked": 1,
      "api_calls_made": 142,
      "api_errors": 0,
      "cache_hits": 45
    },
    "authorities": ["node_hash_1"]
  }
  ```

#### 2. Manual Content Report
* **Endpoint:** `POST /api/guardian/report`
* **Request Body:**
  ```json
  {
    "conversation_id": "opt_hex",
    "message_id": "opt_hex",
    "reason": "csam | violence | hate_speech | trafficking | drugs | spam | other",
    "description": "Detalles adicionales del reporte"
  }
  ```

---

### v20.0 SOS Beacons, Public Channels & Chunker API

#### 1. Broadcast SOS Emergency Beacon
* **Endpoint:** `POST /api/sos/broadcast`
* **Request Body:**
  ```json
  {
    "sender_name": "Nombre Operador",
    "lat": -12.04637,
    "lon": -77.04279,
    "altitude": 154.2,
    "battery_level": 85,
    "note": "Emergencia médica / Auxilio táctico"
  }
  ```

#### 2. Get Active SOS Beacons
* **Endpoint:** `GET /api/sos/active`
* **Response:**
  ```json
  {
    "active_beacons": [
      {
        "id": "sos_1775084920_a4f89b12",
        "sender_did": "a4f89b12c3e4...",
        "sender_name": "Usuario RED",
        "lat": -12.04637,
        "lon": -77.04279,
        "is_active": true,
        "signature": "sig_sos_ed25519_..."
      }
    ]
  }
  ```

#### 3. Get Public Local Channel Messages
* **Endpoint:** `GET /api/channels/messages?channel=red-local-general&limit=50`
* **Response:**
  ```json
  {
    "channel_id": "red-local-general",
    "channels": ["red-local-general", "red-emergency-lima"],
    "messages": [
      {
        "id": "msg_f49b12c3e4a5",
        "channel_id": "red-local-general",
        "sender_name": "Radio Vecinal",
        "content": "Boletín de tráfico: Vía de acceso despejada en zona central.",
        "timestamp": 1775085000,
        "hash": "b8a9c1e2f3d4...",
        "is_moderated": true
      }
    ]
  }
  ```

#### 4. Split File into Torrent-Mesh Chunks
* **Endpoint:** `POST /api/chunker/split`
* **Request Body:**
  ```json
  {
    "filename": "evidencia_tactica.mp4",
    "data_base64": "AAAA...base64..."
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "manifest": {
      "file_id": "file_8f9e12c34a_12",
      "filename": "evidencia_tactica.mp4",
      "total_size": 786432,
      "total_chunks": 12,
      "root_hash": "4f8b9e83a21c...",
      "chunk_hashes": ["chunk_hash_1", "chunk_hash_2"]
    }
  }
  ```

---

### v21.0 Walkie-Talkie PTT, EXIF Sanitizer & Weather API

#### 1. Send Walkie-Talkie Voice Burst (Opus P2P)
* **Endpoint:** `POST /api/voice/send`
* **Request Body:**
  ```json
  {
    "sender_name": "Operador Walkie",
    "duration_seconds": 3.5,
    "audio_opus_b64": "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRHzY4A..."
  }
  ```

#### 2. Sanitize EXIF & GPS Metadata from Image
* **Endpoint:** `POST /api/sanitizer/clean`
* **Request Body:**
  ```json
  {
    "image_b64": "/9j/4AAQSkZJRgABAQAAAQABAAD..."
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "cleaned_b64": "/9j/4AAQSkZJRg...",
    "bytes_stripped": 4120,
    "metadata_removed": ["GPS Coordinates", "Camera Model", "DateTime Original"]
  }
  ```

#### 3. Post Off-Grid Weather Bulletin
* **Endpoint:** `POST /api/weather/report`
* **Request Body:**
  ```json
  {
    "sender_name": "Estación Barométrica",
    "pressure_hpa": 1013.25,
    "temperature_c": 21.5,
    "humidity_percent": 68.0,
    "condition_summary": "Despejado — Presión Estable",
    "is_disaster_alert": false
  }
  ```

---

### v22.0 Proximity Discovery, Ephemeral Timers & Battery API

#### 1. Get Nearby Proximity Nodes (<5m)
* **Endpoint:** `GET /api/discovery/proximity`
* **Response:**
  ```json
  {
    "proximity_nodes": [
      {
        "identity_hash": "3f7a8291c4e2",
        "display_name": "Alice (BLE Proximity)",
        "rssi_dbm": -58,
        "distance_meters": 2.4,
        "transport": "BLE",
        "last_seen": 1775085000
      }
    ]
  }
  ```

#### 2. Trigger Proximity Wave Handshake
* **Endpoint:** `POST /api/discovery/wave`
* **Request Body:**
  ```json
  {
    "target_identity_hash": "3f7a8291c4e2",
    "greeting_message": "¡Hola en proximidad zero-touch!"
  }
  ```

#### 3. Set Ephemeral Self-Destruct Timer
* **Endpoint:** `POST /api/ephemeral/set_timer`
* **Request Body:**
  ```json
  {
    "conversation_id": "conv_9b12c3e4",
    "self_destruct_seconds": 60,
    "burn_on_read": true
  }
  ```

---

### v31.0 Real-Time Unified SSE & Native Hardware Actuators API

#### 1. Real-Time Unified Event Stream (SSE)
* **Endpoint:** `GET /api/events`
* **Protocol:** Server-Sent Events (`text/event-stream`)
* **Event Types Dispatched:**
  - `connected`: Handshake event with local node status and server timestamp.
  - `message`: Incoming E2E encrypted message or packet from peer.
  - `emergency_beacon`: SOS beacon broadcast across the mesh.
  - `weather_report`: Real-time CAP weather bulletin from barometric nodes.
  - `node_log`: Real-time diagnostic and libp2p log stream.
* **Format:**
  ```json
  {
    "event_type": "emergency_beacon",
    "timestamp": 1775123456,
    "payload": {
      "beacon_id": "sos_8b91a2",
      "sender_hash": "3f7a8291c4e2",
      "distress_type": "SOS_GENERAL",
      "lat": 19.4326,
      "lon": -99.1332,
      "battery_level": 82
    }
  }
  ```

#### 2. Native Hardware Actuators API (`RedNodePlugin`)
Available on Android via `@capacitor/core` (`registerPlugin('RedNode')`):

* **`toggleMorseSosTorch({ active: boolean })`**:
  - Spawns/terminates a dedicated background thread modulating the rear camera Flash LED (`CameraManager.setTorchMode`) in international Morse code (`... --- ...`).
* **`setTorch({ enabled: boolean })`**:
  - Turns on/off continuous rear camera LED torch (used by `VitalScanEngine.ts` for PPG vital sign measurements).
* **`isTorchAvailable()`**:
  - Queries `CameraCharacteristics.FLASH_INFO_AVAILABLE` on the device's rear camera.
* **`getBarometerSensor()`**:
  - Returns current atmospheric pressure in hPa from `Sensor.TYPE_PRESSURE`.
* **`getThermometerSensor()`**:
  - Returns ambient temperature in °C from `Sensor.TYPE_AMBIENT_TEMPERATURE`.
* **`getHygrometerSensor()`**:
  - Returns relative humidity % from `Sensor.TYPE_RELATIVE_HUMIDITY`.
* **`getCompassSensor()`**:
  - Returns absolute azimuth angle from `Sensor.TYPE_ROTATION_VECTOR`.
* **`destroy()`**:
  - Immediately purges Sled database trees, private keys from Android Keystore and halts the native background service.





