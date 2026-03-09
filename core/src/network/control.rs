//! Control protocol for Client-Node communication.

use serde::{Deserialize, Serialize};
use crate::protocol::{Message, MessageId, Group, GroupId, GroupMessage, GroupMember, Conversation};
use crate::identity::{IdentityHash, AuthorizedDevice, DeviceId};

/// Commands from the client to the node
#[derive(Debug, Serialize, Deserialize)]
pub enum ClientCommand {
    /// Send a message to the network
    SendMessage(Message),
    /// Get node status
    GetStatus,
    /// Subscribe to incoming messages
    Subscribe,
    /// Create a new group
    CreateGroup { name: String },
    /// Add a member to a group
    AddMember { group_id: GroupId, member: GroupMember },
    /// Send a group message
    SendGroupMessage(GroupMessage),
    /// List all groups
    ListGroups,
    /// Generate a pairing code for a new device
    GeneratePairingCode { name: String },
    /// Authorize a new device using a pairing code
    AuthorizeDevice { name: String, code: String },
    /// List authorized devices
    ListDevices,
    /// Sync data with other devices
    SyncData,
}

/// Responses from the node to the client
#[derive(Debug, Serialize, Deserialize)]
pub enum NodeResponse {
    /// Command successful
    Ok,
    /// Command failed
    Error(String),
    /// Node status information
    Status {
        peer_count: usize,
        is_running: bool,
        identity_hash: IdentityHash,
    },
    /// A new incoming message
    NewMessage(Message),
    /// Group information
    GroupInfo(Group),
    /// List of groups
    GroupList(Vec<Group>),
    /// A pairing code for device authorization
    PairingCode(String),
    /// List of authorized devices
    DeviceList(Vec<AuthorizedDevice>),
    /// Data for synchronization
    SyncPayload {
        contacts: Vec<crate::storage::Contact>,
        groups: Vec<Group>,
        conversations: Vec<Conversation>,
    },
}
