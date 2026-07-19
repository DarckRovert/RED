//! LoRaWAN / Sub-1GHz Radio Bridge API
//! 
//! Provides the abstraction layer to route encrypted OnionPackets across physical 
//! LoRa boundaries when cellular networks are subjected to state-level blackouts.

use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, error, info};

use crate::network::Node;

/// Hardware abstraction for an external LoRa Serial/Bluetooth module
pub struct LoraBridge {
    node_ref: Arc<Mutex<Node>>,
    port: String,
    baud_rate: u32,
    is_active: bool,
    /// BUG 10 FIX: mpsc sender to the write-half of the serial stream
    tx: Option<tokio::sync::mpsc::Sender<Vec<u8>>>,
}

impl LoraBridge {
    /// Initialize a new bridge to a physical radio modem
    pub fn new(node_ref: Arc<Mutex<Node>>, port: String, baud_rate: u32) -> Self {
        Self {
            node_ref,
            port,
            baud_rate,
            is_active: false,
            tx: None,
        }
    }

    /// Spin up the serial listener loop
    pub async fn start(&mut self) -> Result<(), String> {
        self.is_active = true;
        info!("LoRa Bridge initialized on {} @ {} bps", self.port, self.baud_rate);
        
        let node_ptr = self.node_ref.clone();
        let port_path = self.port.clone();
        let baud = self.baud_rate;

        // BUG 10 FIX: Create mpsc channel so transmit() can send bytes to the write-half
        let (tx, mut rx) = tokio::sync::mpsc::channel::<Vec<u8>>(64);
        self.tx = Some(tx);

        tokio::spawn(async move {
            use tokio_serial::SerialPortBuilderExt;
            use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

            let builder = tokio_serial::new(&port_path, baud);
            match builder.open_native_async() {
                Ok(serial) => {
                    info!("Successfully opened LoRa serial port");
                    // Split into read and write halves
                    let (read_half, mut write_half) = tokio::io::split(serial);
                    let mut reader = BufReader::new(read_half).lines();

                    // Spawn writer task
                    tokio::spawn(async move {
                        while let Some(data) = rx.recv().await {
                            if let Err(e) = write_half.write_all(&data).await {
                                error!("LoRa serial write error: {}", e);
                            }
                        }
                    });

                    // Reader loop — inject received bytes into the Rust node
                    while let Ok(Some(line)) = reader.next_line().await {
                        if let Ok(bytes) = hex::decode(line.trim()) {
                            let mut n = node_ptr.lock().await;
                            debug!("Injected LoRa payload: {} bytes", bytes.len());
                            let _ = n.inject_raw_payload(bytes).await;
                        }
                    }
                }
                Err(e) => error!("Failed to open LoRa serial port: {}", e),
            }
        });

        Ok(())
    }

    /// Transmit a packet via long-range radio
    pub async fn transmit(&self, payload: &[u8]) -> Result<(), String> {
        if !self.is_active {
            return Err("LoRa Radio module offline or disconnected".to_string());
        }
        // BUG 10 FIX: Actually send bytes through the mpsc channel to the write-half
        let hex_payload = format!("{}\n", hex::encode(payload));
        if let Some(tx) = &self.tx {
            tx.send(hex_payload.into_bytes())
                .await
                .map_err(|e| format!("LoRa send channel error: {}", e))?;
            debug!("Dispatched {} bytes over LoRa interface", payload.len());
            Ok(())
        } else {
            Err("LoRa bridge not started — call start() first".to_string())
        }
    }
}
