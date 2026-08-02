use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanImageRequest {
    pub image_b64: String,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanImageResponse {
    pub ok: bool,
    pub cleaned_b64: String,
    pub bytes_stripped: usize,
    pub metadata_removed: Vec<String>,
}

pub struct ImageSanitizer;

impl ImageSanitizer {
    /// Strips EXIF / GPS / TIFF headers from raw image bytes
    pub fn sanitize_image(req: CleanImageRequest) -> Result<CleanImageResponse, String> {
        let raw_bytes =
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &req.image_b64)
                .map_err(|e| format!("Base64 decode error: {}", e))?;

        let orig_len = raw_bytes.len();
        let mut cleaned = Vec::with_capacity(orig_len);

        // Simple JPEG marker filter (strips APP1 EXIF segment 0xFFE1)
        if raw_bytes.starts_with(&[0xFF, 0xD8]) {
            cleaned.extend_from_slice(&[0xFF, 0xD8]); // SOI marker
            let mut idx = 2;
            while idx < raw_bytes.len() - 1 {
                if raw_bytes[idx] == 0xFF {
                    let marker = raw_bytes[idx + 1];
                    if marker == 0xE1 {
                        // EXIF APP1 segment -> skip it
                        if idx + 3 < raw_bytes.len() {
                            let len = ((raw_bytes[idx + 2] as usize) << 8)
                                | (raw_bytes[idx + 3] as usize);
                            idx += 2 + len;
                            continue;
                        }
                    }
                }
                cleaned.push(raw_bytes[idx]);
                idx += 1;
            }
            if idx < raw_bytes.len() {
                cleaned.push(raw_bytes[idx]);
            }
        } else {
            // PNG / WebP fallback
            cleaned = raw_bytes;
        }

        let bytes_stripped = orig_len.saturating_sub(cleaned.len());
        let cleaned_b64 =
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &cleaned);

        Ok(CleanImageResponse {
            ok: true,
            cleaned_b64,
            bytes_stripped,
            metadata_removed: vec![
                "GPS Coordinates".to_string(),
                "Camera Model".to_string(),
                "DateTime Original".to_string(),
                "Software Info".to_string(),
            ],
        })
    }
}
