//! LoRa Plug & Play (PnP) — Auto-detección y clasificación de transceptores USB LoRa
//!
//! Soporta escaneo en caliente de adaptadores UART/USB estándar utilizados por
//! LilyGO T-Beam, Heltec LoRa 32 V2/V3, Espressif ESP32-S3 y transceptores industriales.

use serde::{Deserialize, Serialize};
use serialport::{SerialPortInfo, SerialPortType};
use std::time::{SystemTime, UNIX_EPOCH};

/// Información descriptiva de un dispositivo serial USB detectado en el host
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoraDeviceDescriptor {
    pub port_name: String,
    pub is_lora_transceiver: bool,
    pub chip_name: String,
    pub manufacturer: String,
    pub product: String,
    pub vid_hex: Option<String>,
    pub pid_hex: Option<String>,
    pub recommended_baud: u32,
    pub description: String,
}

/// Resultado completo de un escaneo PnP de puertos seriales
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoraPnpScanResult {
    pub primary_device: Option<LoraDeviceDescriptor>,
    pub devices: Vec<LoraDeviceDescriptor>,
    pub total_ports: usize,
    pub timestamp: u64,
}

/// Clasifica un puerto serial y determina si coincide con hardware de radio LoRa
pub fn classify_serial_port(info: &SerialPortInfo) -> LoraDeviceDescriptor {
    let port_name = info.port_name.clone();
    let is_lora_transceiver;
    let chip_name;
    let mut manufacturer = String::new();
    let mut product = String::new();
    let mut vid_hex = None;
    let mut pid_hex = None;
    let recommended_baud = 115_200;

    match &info.port_type {
        SerialPortType::UsbPort(usb) => {
            let vid = usb.vid;
            let pid = usb.pid;
            vid_hex = Some(format!("{:04x}", vid));
            pid_hex = Some(format!("{:04x}", pid));
            manufacturer = usb.manufacturer.clone().unwrap_or_default();
            product = usb.product.clone().unwrap_or_default();

            let prod_lower = product.to_lowercase();
            let mfg_lower = manufacturer.to_lowercase();

            // 1. Silicon Labs CP210x (LilyGO T-Beam, T-Echo, Heltec V2)
            if vid == 0x10c4 || prod_lower.contains("cp210") || mfg_lower.contains("silicon labs") {
                is_lora_transceiver = true;
                chip_name = "Silicon Labs CP2102/CP2104 (LilyGO T-Beam / Heltec)".to_string();
            }
            // 2. WCH CH340 / CH341 (Heltec LoRa 32 V3, DIY LoRa ESP32)
            else if vid == 0x1a86 || prod_lower.contains("ch340") || prod_lower.contains("ch341") {
                is_lora_transceiver = true;
                chip_name = "WCH CH340/CH341 UART (Heltec LoRa 32 V3 / ESP32)".to_string();
            }
            // 3. Espressif Systems ESP32-S2 / ESP32-S3 Native USB-JTAG/CDC
            else if vid == 0x303a || prod_lower.contains("esp32") || mfg_lower.contains("espressif") {
                is_lora_transceiver = true;
                chip_name = "Espressif USB-JTAG/CDC (ESP32-S3 LoRa SX1262)".to_string();
            }
            // 4. FTDI FT232 / FT2232 (Módems industriales Waveshare / Ebyte)
            else if vid == 0x0403 || prod_lower.contains("ft232") || mfg_lower.contains("ftdi") {
                is_lora_transceiver = true;
                chip_name = "FTDI USB-UART (Módem LoRa Industrial Waveshare)".to_string();
            }
            // 5. Raspberry Pi RP2040 (Waveshare Pico LoRa)
            else if vid == 0x2e8a || prod_lower.contains("rp2040") {
                is_lora_transceiver = true;
                chip_name = "Raspberry Pi RP2040 (Pico LoRa SX1262)".to_string();
            }
            // 6. Detección heurística por palabras clave
            else if prod_lower.contains("lora") || prod_lower.contains("t-beam") || prod_lower.contains("heltec") {
                is_lora_transceiver = true;
                chip_name = format!("Transceptor LoRa Compatible ({})", product);
            } else {
                is_lora_transceiver = false;
                chip_name = format!("Dispositivo USB Serial ({})", if product.is_empty() { "UART" } else { &product });
            }
        }
        SerialPortType::PciPort => {
            is_lora_transceiver = false;
            chip_name = "Puerto Serial PCI/PCIe".to_string();
        }
        SerialPortType::BluetoothPort => {
            is_lora_transceiver = false;
            chip_name = "Puerto Serial Bluetooth".to_string();
        }
        SerialPortType::Unknown => {
            is_lora_transceiver = false;
            chip_name = "Puerto Serial Desconocido".to_string();
        }
    }

    let description = if is_lora_transceiver {
        format!("{} en {}", chip_name, port_name)
    } else {
        format!("{} ({})", port_name, chip_name)
    };

    LoraDeviceDescriptor {
        port_name,
        is_lora_transceiver,
        chip_name,
        manufacturer,
        product,
        vid_hex,
        pid_hex,
        recommended_baud,
        description,
    }
}

/// Escanea todos los puertos del sistema y retorna el resultado estructurado
pub fn scan_lora_hardware() -> LoraPnpScanResult {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let ports = match serialport::available_ports() {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("[LoRa PnP] No se pudieron listar puertos seriales: {}", e);
            Vec::new()
        }
    };

    let total_ports = ports.len();
    let mut classified: Vec<LoraDeviceDescriptor> = ports
        .iter()
        .map(classify_serial_port)
        .collect();

    // Ordenar para que los transceptores LoRa aparezcan primero
    classified.sort_by(|a, b| b.is_lora_transceiver.cmp(&a.is_lora_transceiver));

    let primary_device = classified
        .iter()
        .find(|d| d.is_lora_transceiver)
        .cloned();

    LoraPnpScanResult {
        primary_device,
        devices: classified,
        total_ports,
        timestamp: now,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serialport::UsbPortInfo;

    #[test]
    fn test_classify_cp210x() {
        let info = SerialPortInfo {
            port_name: "COM3".to_string(),
            port_type: SerialPortType::UsbPort(UsbPortInfo {
                vid: 0x10c4,
                pid: 0xea60,
                serial_number: Some("0001".into()),
                manufacturer: Some("Silicon Labs".into()),
                product: Some("CP2102 USB to UART Bridge Controller".into()),
            }),
        };
        let desc = classify_serial_port(&info);
        assert!(desc.is_lora_transceiver);
        assert_eq!(desc.vid_hex, Some("10c4".to_string()));
        assert_eq!(desc.pid_hex, Some("ea60".to_string()));
        assert!(desc.chip_name.contains("CP2102"));
    }

    #[test]
    fn test_classify_ch340() {
        let info = SerialPortInfo {
            port_name: "COM5".to_string(),
            port_type: SerialPortType::UsbPort(UsbPortInfo {
                vid: 0x1a86,
                pid: 0x7523,
                serial_number: None,
                manufacturer: Some("wch.cn".into()),
                product: Some("USB-SERIAL CH340".into()),
            }),
        };
        let desc = classify_serial_port(&info);
        assert!(desc.is_lora_transceiver);
        assert_eq!(desc.vid_hex, Some("1a86".to_string()));
        assert_eq!(desc.pid_hex, Some("7523".to_string()));
        assert!(desc.chip_name.contains("CH340"));
    }

    #[test]
    fn test_classify_esp32_s3() {
        let info = SerialPortInfo {
            port_name: "COM7".to_string(),
            port_type: SerialPortType::UsbPort(UsbPortInfo {
                vid: 0x303a,
                pid: 0x1001,
                serial_number: Some("12345".into()),
                manufacturer: Some("Espressif".into()),
                product: Some("USB JTAG/serial debug unit".into()),
            }),
        };
        let desc = classify_serial_port(&info);
        assert!(desc.is_lora_transceiver);
        assert!(desc.chip_name.contains("ESP32-S3"));
    }

    #[test]
    fn test_classify_generic_unknown() {
        let info = SerialPortInfo {
            port_name: "COM1".to_string(),
            port_type: SerialPortType::Unknown,
        };
        let desc = classify_serial_port(&info);
        assert!(!desc.is_lora_transceiver);
    }

    #[test]
    fn test_scan_lora_hardware_runs_cleanly() {
        let res = scan_lora_hardware();
        assert!(res.timestamp > 0);
        // Debe ser consistente: total_ports == devices.len()
        assert_eq!(res.total_ports, res.devices.len());
    }
}

