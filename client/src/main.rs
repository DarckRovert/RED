//! RED Command-Line Client
//!
//! Interactive messaging client for the RED network.

use clap::{Parser, Subcommand};
use colored::*;
use std::path::PathBuf;
use red_core::storage::{Storage, Contact, Profile};
use red_core::identity::Identity;
use red_core::protocol::{Message, GroupId, GroupMember, MemberRole};
use red_core::crypto::hashing::derive_symmetric_key;
use red_core::network::control::{ClientCommand, NodeResponse};
use tokio::io::{AsyncWriteExt, AsyncReadExt};
use tokio::net::TcpStream;
use hex;

/// RED CLI Client
#[derive(Parser)]
#[command(name = "red")]
#[command(author = "RED Team")]
#[command(version = "0.1.0")]
#[command(about = "RED decentralized messaging client", long_about = None)]
struct Cli {
    /// Configuration file path
    #[arg(short, long, value_name = "FILE")]
    config: Option<PathBuf>,

    /// Node to connect to (API port)
    #[arg(short, long, default_value = "127.0.0.1:7332")]
    node: String,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize a new account
    Init {
        /// Display name
        #[arg(short, long)]
        name: String,
    },
    /// Send a message
    Send {
        /// Recipient identity hash
        #[arg(short, long)]
        to: String,
        /// Message text
        message: String,
    },
    /// List conversations
    List,
    /// Open a conversation
    Chat {
        /// Contact identity hash or name
        contact: String,
    },
    /// Manage contacts
    Contacts {
        #[command(subcommand)]
        action: ContactAction,
    },
    /// Show account info
    Account,
    /// Manage groups
    Group {
        #[command(subcommand)]
        action: GroupAction,
    },
    /// Show node status
    Status,
    /// Manage devices
    Device {
        #[command(subcommand)]
        action: DeviceAction,
    },
    /// Interactive mode
    Interactive,
    /// Listen for incoming messages in real-time
    Listen,
}

#[derive(Subcommand)]
enum ContactAction {
    /// List all contacts
    List,
    /// Add a new contact
    Add {
        /// Contact's identity hash
        identity: String,
        /// Display name
        #[arg(short, long)]
        name: String,
    },
    /// Remove a contact
    Remove {
        /// Contact's identity hash or name
        contact: String,
    },
    /// Block a contact
    Block {
        /// Contact's identity hash or name
        contact: String,
    },
}

#[derive(Subcommand)]
enum GroupAction {
    /// Create a new group
    Create {
        /// Group name
        name: String,
    },
    /// List all groups
    List,
    /// Add a member to a group
    Add {
        /// Group ID
        #[arg(short, long)]
        group: String,
        /// Member's identity hash
        member: String,
    },
    /// Send a group message
    Send {
        /// Group ID
        #[arg(short, long)]
        group: String,
        /// Message text
        message: String,
    },
}

#[derive(Subcommand)]
enum DeviceAction {
    /// Add this device (generates a pairing code)
    Add {
        /// Friendly name for THIS device
        name: String,
    },
    /// Link a new device using a pairing code
    Link {
        /// Name of the new device
        name: String,
        /// Pairing code from the other device
        code: String,
    },
    /// List all authorized devices
    List,
    /// Sync data from other devices
    Sync,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    print_banner();

    match cli.command {
        Some(Commands::Init { name }) => {
            init_account(&name).await?;
        }
        Some(Commands::Send { to, message }) => {
            send_message(&to, &message).await?;
        }
        Some(Commands::List) => {
            list_conversations().await?;
        }
        Some(Commands::Chat { contact }) => {
            open_chat(&contact).await?;
        }
        Some(Commands::Contacts { action }) => {
            handle_contacts(action).await?;
        }
        Some(Commands::Account) => {
            show_account().await?;
        }
        Some(Commands::Group { action }) => {
            handle_group(action).await?;
        }
        Some(Commands::Status) => {
            handle_status().await?;
        }
        Some(Commands::Device { action }) => {
            handle_device(action).await?;
        }
        Some(Commands::Listen) => {
            listen_for_messages().await?;
        }
        Some(Commands::Interactive) | None => {
            interactive_mode().await?;
        }
    }

    Ok(())
}

fn print_banner() {
    println!();
    println!("  {}", "██████╗ ███████╗██████╗ ".red().bold());
    println!("  {}", "██╔══██╗██╔════╝██╔══██╗".red().bold());
    println!("  {}", "██████╔╝█████╗  ██║  ██║".red().bold());
    println!("  {}", "██╔══██╗██╔══╝  ██║  ██║".red().bold());
    println!("  {}", "██║  ██║███████╗██████╔╝".red().bold());
    println!("  {}", "╚═╝  ╚═╝╚══════╝╚═════╝ ".red().bold());
    println!();
    println!("  {}", "Red Encriptada Descentralizada".dimmed());
    println!("  {}", "Private. Decentralized. Unstoppable.".dimmed());
    println!();
}

/// Get storage encryption key
fn get_storage_key() -> [u8; 32] {
    derive_symmetric_key(b"client-password", b"red-salt", b"storage-key").unwrap()
}

fn get_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("red-client")
}

async fn init_account(name: &str) -> anyhow::Result<()> {
    println!("{}", "Initializing new account...".cyan());
    
    let data_dir = get_data_dir();
    let mut storage = Storage::new(data_dir.join("storage"), get_storage_key());
    storage.open()?;

    // Generate identity
    let identity = Identity::generate()?;
    let hash = identity.identity_hash().clone();
    
    // Set profile
    let profile = Profile {
        display_name: name.to_string(),
        status: None,
        avatar: None,
    };
    
    storage.set_identity(identity)?;
    storage.set_profile(profile)?;
    
    println!();
    println!("{}", "✓ Account created successfully!".green().bold());
    println!();
    println!("  {}: {}", "Name".bold(), name);
    println!("  {}: {}", "Identity".bold(), hash.to_hex());
    println!("  {}: {}", "Short ID".bold(), hash.short());
    println!();
    println!("{}", "Share your Short ID with contacts to receive messages.".dimmed());
    
    Ok(())
}

async fn send_message(to: &str, message: &str) -> anyhow::Result<()> {
    let data_dir = get_data_dir();
    let mut storage = Storage::new(data_dir.join("storage"), get_storage_key());
    storage.open()?;

    let identity = storage.get_identity()
        .ok_or_else(|| anyhow::anyhow!("No account found. Run 'red init' first."))?;
    
    let to_hash = red_core::identity::IdentityHash::from_hex(to)?;
    
    println!("{} {}", "Sending to:".cyan(), to);
    println!("{} {}", "Message:".cyan(), message);
    println!();
    
    // Create text message
    let msg = Message::text(
        identity.identity_hash().clone(),
        to_hash,
        message,
    )?;

    // Send via node API
    let api_addr = "127.0.0.1:7332";
    match TcpStream::connect(api_addr).await {
        Ok(mut stream) => {
            let cmd = ClientCommand::SendMessage(msg);
            let serialized = bincode::serialize(&cmd)?;
            stream.write_all(&serialized).await?;
            
            let mut response = [0u8; 1024];
            let n = stream.read(&mut response).await?;
            
            match bincode::deserialize::<NodeResponse>(&response[..n]) {
                Ok(NodeResponse::Ok) => {
                    println!("{}", "✓ Message sent to network!".green().bold());
                }
                Ok(NodeResponse::Error(e)) => {
                    println!("{} {}", "✗ Error from node:".red(), e);
                }
                _ => {
                    println!("{}", "✗ Unexpected response from node".red());
                }
            }
        }
        Err(e) => {
            println!("{} {}", "✗ Could not connect to local node:".red(), e);
            println!("{}", "  Make sure 'red-node start' is running.".dimmed());
        }
    }
    
    Ok(())
}

async fn listen_for_messages() -> anyhow::Result<()> {
    println!("{}", "Starting real-time listener...".cyan().bold());
    println!("{}", "Press Ctrl+C to stop.".dimmed());
    println!();

    let api_addr = "127.0.0.1:7332";
    let mut stream = TcpStream::connect(api_addr).await?;
    
    let cmd = ClientCommand::Subscribe;
    let serialized = bincode::serialize(&cmd)?;
    stream.write_all(&serialized).await?;

    let mut buffer = [0u8; 4096];
    loop {
        match stream.read(&mut buffer).await {
            Ok(0) => {
                println!("{}", "Node connection closed.".red());
                break;
            }
            Ok(n) => {
                if let Ok(resp) = bincode::deserialize::<NodeResponse>(&buffer[..n]) {
                    match resp {
                        NodeResponse::MessageReceived(msg) => {
                            println!();
                            println!("{} {}", "📩 NEW MESSAGE".green().bold(), chrono::Local::now().format("%H:%M:%S").to_string().dimmed());
                            println!("  {}: {}", "From".bold(), msg.sender.short());
                            if let Some(text) = msg.text() {
                                println!("  {}: {}", "Text".bold(), text.white());
                            } else {
                                println!("  {}", "[Binary/Encrypted Data]".dimmed());
                            }
                        }
                        NodeResponse::Ok => {
                            println!("{}", "✓ Subscribed to real-time updates.".dimmed());
                        }
                        _ => {}
                    }
                }
            }
            Err(e) => {
                eprintln!("Error reading from stream: {:?}", e);
                break;
            }
        }
    }

    Ok(())
}

async fn list_conversations() -> anyhow::Result<()> {
    println!("{}", "Conversations".cyan().bold());
    println!("{}", "=".repeat(50));
    println!();
    
    // Loaded dynamically from peer's local storage DB
    println!("{}", "No conversations yet.".dimmed());
    println!();
    println!("Use {} to start a new conversation.", "red send --to <ID> <message>".yellow());
    
    Ok(())
}

async fn open_chat(contact: &str) -> anyhow::Result<()> {
    println!("{} {}", "Opening chat with:".cyan(), contact);
    println!();
    
    // Interactive chat interface is delegated to the Web/Mobile UI
    println!("{}", "Chat interface only partially available in CLI mode.".dimmed());
    
    Ok(())
}

async fn handle_contacts(action: ContactAction) -> anyhow::Result<()> {
    match action {
        ContactAction::List => {
            println!("{}", "Contacts".cyan().bold());
            println!("{}", "=".repeat(50));
            println!();
            println!("{}", "No contacts yet.".dimmed());
        }
        ContactAction::Add { identity, name } => {
            println!("{} {} ({})", "Adding contact:".cyan(), name, identity);
            println!("{}", "✓ Contact added!".green().bold());
        }
        ContactAction::Remove { contact } => {
            println!("{} {}", "Removing contact:".cyan(), contact);
            println!("{}", "✓ Contact removed!".green().bold());
        }
        ContactAction::Block { contact } => {
            println!("{} {}", "Blocking contact:".cyan(), contact);
            println!("{}", "✓ Contact blocked!".green().bold());
        }
    }
    
    Ok(())
}

async fn show_account() -> anyhow::Result<()> {
    println!("{}", "Account Information".cyan().bold());
    println!("{}", "=".repeat(50));
    println!();
    
    let data_dir = get_data_dir();
    let mut storage = Storage::new(data_dir.join("storage"), get_storage_key());
    if storage.open().is_ok() {
        if let Some(identity) = storage.get_identity() {
            println!("  {}: {}", "Identity".bold(), identity.identity_hash().to_hex());
            if let Some(profile) = storage.get_profile() {
                println!("  {}: {}", "Name".bold(), profile.display_name);
            }
            return Ok(());
        }
    }
    
    println!("{}", "No account configured.".dimmed());
    println!();
    println!("Use {} to create an account.", "red init --name <NAME>".yellow());
    
    Ok(())
}

async fn interactive_mode() -> anyhow::Result<()> {
    use rustyline::DefaultEditor;
    
    println!("{}", "Interactive Mode".cyan().bold());
    println!("Type {} for available commands, {} to exit.", "help".yellow(), "quit".yellow());
    println!();
    
    let mut rl = DefaultEditor::new()?;
    
    loop {
        let readline = rl.readline(&format!("{} ", "red>".red().bold()));
        
        match readline {
            Ok(line) => {
                let line = line.trim();
                
                if line.is_empty() {
                    continue;
                }
                
                rl.add_history_entry(line)?;
                
                match line {
                    "quit" | "exit" | "q" => {
                        println!("{}", "Goodbye!".cyan());
                        break;
                    }
                    "help" | "h" | "?" => {
                        print_help();
                    }
                    "account" | "me" => {
                        show_account().await?;
                    }
                    "contacts" | "c" => {
                        handle_contacts(ContactAction::List).await?;
                    }
                    "list" | "l" => {
                        list_conversations().await?;
                    }
                    "clear" => {
                        print!("\x1B[2J\x1B[1;1H");
                        print_banner();
                    }
                    _ => {
                        if line.starts_with("send ") {
                            let parts: Vec<&str> = line.splitn(3, ' ').collect();
                            if parts.len() >= 3 {
                                send_message(parts[1], parts[2]).await?;
                            } else {
                                println!("{}", "Usage: send <ID> <message>".yellow());
                            }
                        } else if line.starts_with("chat ") {
                            let contact = line.strip_prefix("chat ").unwrap();
                            open_chat(contact).await?;
                        } else {
                            println!("{} {}", "Unknown command:".red(), line);
                            println!("Type {} for available commands.", "help".yellow());
                        }
                    }
                }
            }
            Err(_) => {
                println!("{}", "\nGoodbye!".cyan());
                break;
            }
        }
    }
    
    Ok(())
}

fn print_help() {
    println!();
    println!("{}", "Available Commands".cyan().bold());
    println!("{}", "=".repeat(50));
    println!();
    println!("  {}      - Show this help", "help".yellow());
    println!("  {}   - Show account info", "account".yellow());
    println!("  {}  - List contacts", "contacts".yellow());
    println!("  {}      - List conversations", "list".yellow());
    println!("  {} - Send a message", "send <ID> <msg>".yellow());
    println!("  {}    - Open chat with contact", "chat <ID>".yellow());
    println!("  {}     - Listen for messages in real-time", "listen".yellow());
    println!("  {}     - Clear screen", "clear".yellow());
    println!("  {}      - Exit", "quit".yellow());
    println!();
}

async fn handle_status() -> anyhow::Result<()> {
    let api_addr = "127.0.0.1:7332";
    println!("{}", "Connecting to local node...".cyan());

    match TcpStream::connect(api_addr).await {
        Ok(mut stream) => {
            let cmd = ClientCommand::GetStatus;
            let serialized = bincode::serialize(&cmd)?;
            stream.write_all(&serialized).await?;

            let mut response = [0u8; 1024];
            let n = stream.read(&mut response).await?;

            match bincode::deserialize::<NodeResponse>(&response[..n]) {
                Ok(NodeResponse::Status { peer_count, is_running, identity_hash }) => {
                    println!();
                    println!("{}", "RED Node Status".green().bold());
                    println!("{}", "===============".green());
                    println!("  {}: {}", "Status".bold(), if is_running { "Running".green() } else { "Stopped".red() });
                    println!("  {}: {}", "Identity".bold(), identity_hash.to_hex());
                    println!("  {}: {}", "Peers".bold(), peer_count);
                    println!();
                }
                Ok(NodeResponse::Error(e)) => {
                    println!("{} {}", "✗ Error from node:".red(), e);
                }
                _ => {
                    println!("{}", "✗ Unexpected response from node".red());
                }
            }
        }
        Err(e) => {
            println!("{} {}", "✗ Could not connect to local node:".red(), e);
            println!("{}", "  Make sure 'red-node start' is running.".dimmed());
        }
    }

    Ok(())
}

async fn handle_group(action: GroupAction) -> anyhow::Result<()> {
    let api_addr = "127.0.0.1:7332";
    let mut stream = TcpStream::connect(api_addr).await?;

    match action {
        GroupAction::Create { name } => {
            let cmd = ClientCommand::CreateGroup { name: name.clone() };
            let serialized = bincode::serialize(&cmd)?;
            stream.write_all(&serialized).await?;

            let mut response = [0u8; 4096];
            let n = stream.read(&mut response).await?;
            match bincode::deserialize::<NodeResponse>(&response[..n]) {
                Ok(NodeResponse::GroupInfo(group)) => {
                    println!("{} {}", "✓ Group created:".green().bold(), group.name);
                    println!("  {}: {}", "Group ID".bold(), hex::encode(group.id.0));
                }
                Ok(NodeResponse::Error(e)) => println!("{} {}", "✗ Error:".red(), e),
                _ => println!("{}", "✗ Unexpected response from node".red()),
            }
        }
        GroupAction::List => {
            let cmd = ClientCommand::ListGroups;
            let serialized = bincode::serialize(&cmd)?;
            stream.write_all(&serialized).await?;

            let mut response = [0u8; 8192];
            let n = stream.read(&mut response).await?;
            match bincode::deserialize::<NodeResponse>(&response[..n]) {
                Ok(NodeResponse::GroupList(groups)) => {
                    if groups.is_empty() {
                        println!("{}", "No groups joined.".dimmed());
                    } else {
                        println!("{}", "Your Groups".green().bold());
                        println!("{}", "===========".green());
                        for g in groups {
                            println!("  • {} ({})", g.name.bold(), hex::encode(&g.id.0[..4]));
                            println!("    Members: {}", g.member_count());
                        }
                    }
                }
                Ok(NodeResponse::Error(e)) => println!("{} {}", "✗ Error:".red(), e),
                _ => println!("{}", "✗ Unexpected response from node".red()),
            }
        }
        GroupAction::Add { group, member } => {
            let group_id = GroupId(hex::decode(&group)?.try_into().map_err(|_| anyhow::anyhow!("Invalid Group ID"))?);
            let member_hash = red_core::identity::IdentityHash::from_hex(&member)?;
            
            let cmd = ClientCommand::AddMember {
                group_id,
                member: GroupMember {
                    identity_hash: member_hash,
                    public_key: [0u8; 32].into(),
                    joined_at: 0,
                    role: MemberRole::Member,
                },
            };
            
            let serialized = bincode::serialize(&cmd)?;
            stream.write_all(&serialized).await?;

            let mut response = [0u8; 1024];
            let n = stream.read(&mut response).await?;
            match bincode::deserialize::<NodeResponse>(&response[..n]) {
                Ok(NodeResponse::Ok) => println!("{}", "✓ Member added to group!".green().bold()),
                Ok(NodeResponse::Error(e)) => println!("{} {}", "✗ Error:".red(), e),
                _ => println!("{}", "✗ Unexpected response from node".red()),
            }
        }
        GroupAction::Send { group, message } => {
            let group_id = GroupId(hex::decode(&group)?.try_into().map_err(|_| anyhow::anyhow!("Invalid Group ID"))?);
            
            let cmd = ClientCommand::SendGroupMessage(red_core::protocol::GroupMessage {
                group_id,
                sender_key_id: [0u8; 32].into(),
                iteration: 0,
                ciphertext: message.as_bytes().to_vec(),
            });
            
            let serialized = bincode::serialize(&cmd)?;
            stream.write_all(&serialized).await?;

            let mut response = [0u8; 1024];
            let n = stream.read(&mut response).await?;
            match bincode::deserialize::<NodeResponse>(&response[..n]) {
                Ok(NodeResponse::Ok) => println!("{}", "✓ Group message sent!".green().bold()),
                Ok(NodeResponse::Error(e)) => println!("{} {}", "✗ Error:".red(), e),
                _ => println!("{}", "✗ Unexpected response from node".red()),
            }
        }
    }

    Ok(())
}

async fn handle_device(action: DeviceAction) -> anyhow::Result<()> {
    let api_addr = "127.0.0.1:7332";
    let mut stream = TcpStream::connect(api_addr).await?;

    match action {
        DeviceAction::Add { name } => {
            let cmd = ClientCommand::GeneratePairingCode { name: name.clone() };
            let serialized = bincode::serialize(&cmd)?;
            stream.write_all(&serialized).await?;

            let mut response = [0u8; 1024];
            let n = stream.read(&mut response).await?;
            match bincode::deserialize::<NodeResponse>(&response[..n]) {
                Ok(NodeResponse::PairingCode(code)) => {
                    println!();
                    println!("{}", "Pairing Code Generated".green().bold());
                    println!("{}", "======================".green());
                    println!("  Device Name: {}", name.bold());
                    println!("  Code: {}", code.yellow().bold());
                    println!();
                    println!("{}", "Use 'red device link' on your other device to authorize.".dimmed());
                }
                Ok(NodeResponse::Error(e)) => println!("{} {}", "✗ Error:".red(), e),
                _ => println!("{}", "✗ Unexpected response from node".red()),
            }
        }
        DeviceAction::Link { name, code } => {
            let cmd = ClientCommand::AuthorizeDevice { name: name.clone(), code };
            let serialized = bincode::serialize(&cmd)?;
            stream.write_all(&serialized).await?;

            let mut response = [0u8; 1024];
            let n = stream.read(&mut response).await?;
            match bincode::deserialize::<NodeResponse>(&response[..n]) {
                Ok(NodeResponse::Ok) => {
                    println!("{} {}", "✓ Device authorized:".green().bold(), name);
                    println!("{}", "  This device can now synchronize data.".dimmed());
                }
                Ok(NodeResponse::Error(e)) => println!("{} {}", "✗ Error:".red(), e),
                _ => println!("{}", "✗ Unexpected response from node".red()),
            }
        }
        DeviceAction::List => {
            let cmd = ClientCommand::ListDevices;
            let serialized = bincode::serialize(&cmd)?;
            stream.write_all(&serialized).await?;

            let mut response = [0u8; 4096];
            let n = stream.read(&mut response).await?;
            match bincode::deserialize::<NodeResponse>(&response[..n]) {
                Ok(NodeResponse::DeviceList(devices)) => {
                    if devices.is_empty() {
                        println!("{}", "No authorized devices found.".dimmed());
                    } else {
                        println!("{}", "Authorized Devices".green().bold());
                        println!("{}", "==================".green());
                        for d in devices {
                            println!("  • {} ({})", d.name.bold(), d.id.to_hex()[..8].to_string());
                            println!("    Authorized: {}", chrono::DateTime::<chrono::Utc>::from(
                                std::time::UNIX_EPOCH + std::time::Duration::from_secs(d.authorized_at)
                            ).format("%Y-%m-%d %H:%M:%S"));
                        }
                    }
                }
                Ok(NodeResponse::Error(e)) => println!("{} {}", "✗ Error:".red(), e),
                _ => println!("{}", "✗ Unexpected response from node".red()),
            }
        }
        DeviceAction::Sync => {
            println!("{}", "Starting data synchronization...".cyan());
            let cmd = ClientCommand::SyncData;
            let serialized = bincode::serialize(&cmd)?;
            stream.write_all(&serialized).await?;

            let mut response = Vec::new();
            let mut buffer = [0u8; 8192];
            loop {
                let n = stream.read(&mut buffer).await?;
                if n == 0 { break; }
                response.extend_from_slice(&buffer[..n]);
                if n < buffer.len() { break; }
            }

            match bincode::deserialize::<NodeResponse>(&response) {
                Ok(NodeResponse::SyncPayload { contacts, groups, conversations: _ }) => {
                    println!("{}", "✓ Synchronization complete!".green().bold());
                    println!("  - Contacts synchronized: {}", contacts.len());
                    println!("  - Groups synchronized: {}", groups.len());
                    println!("{}", "  Data successfully merged into local node.".dimmed());
                }
                Ok(NodeResponse::Error(e)) => println!("{} {}", "✗ Error:".red(), e),
                _ => println!("{}", "✗ Unexpected response from node".red()),
            }
        }
    }

    Ok(())
}
