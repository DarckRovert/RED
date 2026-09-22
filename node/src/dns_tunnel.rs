// RED v64.0.0 — Native Rust DNS Tunneling Server Module
// Engine for encoding/decoding Noise XK frames into UDP 53 DNS Queries for Zero-Balance cellular bypass.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::UdpSocket;
use tokio::sync::Mutex;
use tracing::{error, info};

use red_core::network::Node;

struct ShardAssembly {
    chunks: HashMap<usize, String>,
    total: usize,
    created_at: Instant,
}

pub struct DnsTunnelServer {
    pub is_active: bool,
    pub domain_zone: String,
    pub packets_processed: std::sync::atomic::AtomicU64,
    pub node: Arc<Mutex<Node>>,
    assemblies: Arc<Mutex<HashMap<String, ShardAssembly>>>,
}

impl DnsTunnelServer {
    pub fn new(domain_zone: &str, node: Arc<Mutex<Node>>) -> Arc<Self> {
        Arc::new(Self {
            is_active: true,
            domain_zone: domain_zone.to_string(),
            packets_processed: std::sync::atomic::AtomicU64::new(0),
            node,
            assemblies: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub async fn start(self: Arc<Self>, port: u16) {
        let addr = format!("0.0.0.0:{}", port);
        let (socket, bound_addr) = match UdpSocket::bind(&addr).await {
            Ok(s) => (s, addr.clone()),
            Err(_) => {
                let fallback_port = if port == 5353 { 5354 } else { port + 100 };
                let fallback_addr = format!("0.0.0.0:{}", fallback_port);
                match UdpSocket::bind(&fallback_addr).await {
                    Ok(s) => (s, fallback_addr),
                    Err(e) => {
                        error!(
                            "Failed to bind DNS tunnel to {} (fallback {}): {}",
                            addr, fallback_addr, e
                        );
                        return;
                    }
                }
            }
        };
        info!("🔴 DNS Tunnel listening on UDP {}", bound_addr);

        let mut buf = [0u8; 1024];
        loop {
            match socket.recv_from(&mut buf).await {
                Ok((len, src)) => {
                    if !self.is_active {
                        continue;
                    }
                    let query = &buf[..len];
                    if let Ok(response) = self.process_dns_query_async(query).await {
                        let _ = socket.send_to(&response, src).await;
                    }
                }
                Err(e) => {
                    error!("DNS tunnel socket error: {}", e);
                }
            }
        }
    }

    /// Process raw UDP 53 DNS Packet Payload and extract base32 subdomains
    pub async fn process_dns_query_async(&self, query_bytes: &[u8]) -> Result<Vec<u8>, String> {
        self.packets_processed
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        if query_bytes.len() < 12 {
            return Err("DNS query too short".to_string());
        }

        let id = &query_bytes[0..2];
        let qdcount = u16::from_be_bytes([query_bytes[4], query_bytes[5]]);
        if qdcount == 0 {
            return Err("No questions in DNS query".to_string());
        }

        let mut idx = 12;
        let mut qname = Vec::new();
        while idx < query_bytes.len() {
            let len = query_bytes[idx] as usize;
            if len == 0 {
                idx += 1;
                break;
            }
            if idx + 1 + len > query_bytes.len() {
                return Err("Invalid QNAME format".to_string());
            }
            if !qname.is_empty() {
                qname.push(b'.');
            }
            qname.extend_from_slice(&query_bytes[idx + 1..idx + 1 + len]);
            idx += 1 + len;
        }

        if idx + 4 > query_bytes.len() {
            return Err("Invalid DNS query format after QNAME".to_string());
        }
        let qname_end = idx;

        // 3. Decode payload: parse session metadata labels, reassemble multipart buffers,
        //    then decode Base32 into native binary message.
        let qname_str = String::from_utf8_lossy(&qname).to_string();
        let normalized = qname_str.to_uppercase();
        let zone_stripped = normalized
            .trim_end_matches(".DNS.REDMESH.NET")
            .trim_end_matches(".RED.MESH")
            .to_string();

        let labels: Vec<&str> = zone_stripped.split('.').filter(|l| !l.is_empty()).collect();

        let mut chunk_data = String::new();
        let mut session_id = String::new();
        let mut part_idx = 1usize;
        let mut total_parts = 1usize;

        for label in &labels {
            if label.starts_with('S') && label.len() >= 4 && label[1..].chars().all(|c| c.is_alphanumeric()) {
                session_id = label.to_string();
            } else if label.starts_with('P') && label.contains("OF") {
                let parts: Vec<&str> = label[1..].split("OF").collect();
                if parts.len() == 2 {
                    if let (Ok(p), Ok(tot)) = (parts[0].parse::<usize>(), parts[1].parse::<usize>()) {
                        part_idx = p;
                        total_parts = tot;
                    }
                }
            } else {
                chunk_data.push_str(label);
            }
        }

        let full_payload_opt = if total_parts <= 1 || session_id.is_empty() {
            Some(chunk_data)
        } else {
            let mut assemblies = self.assemblies.lock().await;
            // Purga de sesiones expiradas (> 30s)
            let now = Instant::now();
            assemblies.retain(|_, v| now.duration_since(v.created_at) < Duration::from_secs(30));

            let entry = assemblies.entry(session_id.clone()).or_insert_with(|| ShardAssembly {
                chunks: HashMap::new(),
                total: total_parts,
                created_at: now,
            });

            entry.chunks.insert(part_idx, chunk_data);

            if entry.chunks.len() >= entry.total {
                let mut assembled = String::new();
                for i in 1..=entry.total {
                    if let Some(c) = entry.chunks.get(&i) {
                        assembled.push_str(c);
                    }
                }
                assemblies.remove(&session_id);
                Some(assembled)
            } else {
                None
            }
        };

        if let Some(payload_str) = full_payload_opt {
            let decoded = data_encoding::BASE32_NOPAD
                .decode(payload_str.as_bytes())
                .unwrap_or_default();

            if !decoded.is_empty() {
                info!(
                    "[DNS Tunnel] Recibido payload Base32 reensamblado, bytes: {}",
                    decoded.len()
                );

                // Soporte dual: bincode directo o hex-decodificado
                let target_bytes = if let Ok(hex_str) = std::str::from_utf8(&decoded) {
                    if hex_str.len() % 2 == 0 && hex_str.chars().all(|c| c.is_ascii_hexdigit()) {
                        hex::decode(hex_str.trim()).unwrap_or(decoded)
                    } else {
                        decoded
                    }
                } else {
                    decoded
                };

                if let Ok(msg) = bincode::deserialize::<red_core::protocol::Message>(&target_bytes) {
                    let mut node = self.node.lock().await;
                    info!("[DNS Tunnel] Inyectando mensaje de {}", msg.sender.to_hex());
                    node.handle_incoming_message(msg).await;
                } else {
                    let mut node = self.node.lock().await;
                    info!("[DNS Tunnel] Inyectando frame crudo de {} bytes", target_bytes.len());
                    let _ = node.inject_raw_payload(target_bytes).await;
                }
            }
        }

        // 4. Construct DNS Response (TXT)
        let mut response = Vec::new();
        response.extend_from_slice(id); // ID

        let mut resp_flags = [0u8; 2];
        resp_flags[0] = 0x84; // QR=1, AA=1, TC=0, RD=0
        resp_flags[1] = 0x00; // RA=0, Z=0, RCODE=0 (NOERROR)
        response.extend_from_slice(&resp_flags);

        response.extend_from_slice(&[0, 1]); // QDCOUNT = 1
        response.extend_from_slice(&[0, 1]); // ANCOUNT = 1
        response.extend_from_slice(&[0, 0]); // NSCOUNT = 0
        response.extend_from_slice(&[0, 0]); // ARCOUNT = 0

        // Question section (copy from query)
        response.extend_from_slice(&query_bytes[12..qname_end + 4]);

        // Answer section
        // Name (Pointer to Question QNAME)
        response.extend_from_slice(&[0xC0, 0x0C]);
        // Type (TXT = 16)
        response.extend_from_slice(&[0x00, 0x10]);
        // Class (IN = 1)
        response.extend_from_slice(&[0x00, 0x01]);
        // TTL (0)
        response.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]);

        // Instead of hardcoded RED_DNS_ACK_OK_v30, we return a base64 encoded TXT ACK
        // In a fully bidirectional tunnel, here we would pull pending messages from `node`
        let txt_data = b"ACK_PROCESSED";
        let rdlength = (txt_data.len() + 1) as u16; // 1 byte for length prefix in TXT
        response.extend_from_slice(&rdlength.to_be_bytes());

        // TXT data format: length byte followed by string
        response.push(txt_data.len() as u8);
        response.extend_from_slice(txt_data);

        Ok(response)
    }
}
