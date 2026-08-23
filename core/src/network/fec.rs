//! Forward Error Correction (FEC) for Low-Bandwidth / High-Noise Radio Mesh
//!
//! Implements an MDS Erasure Coding over GF(256) (Cauchy generator matrix)
//! allowing loss of up to M packets out of (K + M) packets without requiring retransmissions.
//! Specifically optimized for ML-KEM-768 Post-Quantum public keys (1,184 bytes) over BLE / LoRa.

use serde::{Deserialize, Serialize};

/// GF(256) arithmetic with primitive polynomial 0x11d (x^8 + x^4 + x^3 + x^2 + 1)
const GF_POLY: u16 = 0x11d;

/// Precomputed exp and log tables for GF(256)
struct GF256 {
    exp: [u8; 512],
    log: [u8; 256],
}

impl GF256 {
    const fn new() -> Self {
        let mut exp = [0u8; 512];
        let mut log = [0u8; 256];
        let mut x: u16 = 1;
        let mut i = 0;
        while i < 255 {
            exp[i] = x as u8;
            exp[i + 255] = x as u8;
            log[x as usize] = i as u8;
            x <<= 1;
            if x & 0x100 != 0 {
                x ^= GF_POLY;
            }
            i += 1;
        }
        exp[510] = exp[0];
        exp[511] = exp[1];
        Self { exp, log }
    }

    #[inline(always)]
    fn mul(&self, a: u8, b: u8) -> u8 {
        if a == 0 || b == 0 {
            0
        } else {
            let idx = self.log[a as usize] as usize + self.log[b as usize] as usize;
            self.exp[idx]
        }
    }

    #[inline(always)]
    fn inv(&self, a: u8) -> u8 {
        if a == 0 {
            panic!("Zero has no inverse in GF(256)");
        }
        self.exp[255 - self.log[a as usize] as usize]
    }
}

static GF: GF256 = GF256::new();

/// A single FEC chunk with header
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FecChunk {
    /// Unique stream / transfer identifier
    pub stream_id: u32,
    /// Total original data chunks (K)
    pub total_data_chunks: u8,
    /// Total chunks sent (K + M)
    pub total_chunks: u8,
    /// Chunk index (0..K-1 are data, K..K+M-1 are parity)
    pub chunk_index: u8,
    /// Original payload length in bytes
    pub original_len: u32,
    /// Chunk payload data
    pub data: Vec<u8>,
}

/// Systematic FEC Encoder
pub struct FecEncoder {
    k: usize,
    m: usize,
}

impl FecEncoder {
    /// Create an encoder with K data chunks and M parity chunks
    pub fn new(k: usize, m: usize) -> Self {
        assert!(k > 0 && m > 0 && k <= 128 && m <= 128, "Invalid FEC parameters (K <= 128, M <= 128)");
        Self { k, m }
    }

    /// Encode a payload into K + M FecChunks
    pub fn encode(&self, stream_id: u32, payload: &[u8]) -> Vec<FecChunk> {
        let original_len = payload.len() as u32;
        let chunk_size = (payload.len() + self.k - 1) / self.k;
        let chunk_size = if chunk_size == 0 { 1 } else { chunk_size };

        // 1. Prepare K data chunks (padded with zeros if necessary)
        let mut data_chunks = Vec::with_capacity(self.k);
        for i in 0..self.k {
            let mut chunk = vec![0u8; chunk_size];
            let start = i * chunk_size;
            if start < payload.len() {
                let end = (start + chunk_size).min(payload.len());
                chunk[..(end - start)].copy_from_slice(&payload[start..end]);
            }
            data_chunks.push(chunk);
        }

        // 2. Generate M parity chunks using Cauchy matrix coefficients
        // x_i = i (0..127), y_j = 128 + j (128..255) -> x_i ^ y_j >= 128 > 0 always
        let mut parity_chunks = Vec::with_capacity(self.m);
        for j in 0..self.m {
            let mut parity = vec![0u8; chunk_size];
            let y_j = (128 + j) as u8;
            for i in 0..self.k {
                let x_i = i as u8;
                let coeff = GF.inv(x_i ^ y_j);
                for byte_idx in 0..chunk_size {
                    parity[byte_idx] ^= GF.mul(coeff, data_chunks[i][byte_idx]);
                }
            }
            parity_chunks.push(parity);
        }

        // 3. Assemble full chunk vector
        let total_chunks = (self.k + self.m) as u8;
        let mut result = Vec::with_capacity(self.k + self.m);

        for (i, chunk) in data_chunks.into_iter().enumerate() {
            result.push(FecChunk {
                stream_id,
                total_data_chunks: self.k as u8,
                total_chunks,
                chunk_index: i as u8,
                original_len,
                data: chunk,
            });
        }

        for (j, chunk) in parity_chunks.into_iter().enumerate() {
            result.push(FecChunk {
                stream_id,
                total_data_chunks: self.k as u8,
                total_chunks,
                chunk_index: (self.k + j) as u8,
                original_len,
                data: chunk,
            });
        }

        result
    }
}

/// Systematic FEC Decoder (Gaussian Elimination over GF(256))
pub struct FecDecoder {
    received_chunks: Vec<FecChunk>,
    k: usize,
    original_len: usize,
    stream_id: u32,
}

impl FecDecoder {
    pub fn new() -> Self {
        Self {
            received_chunks: Vec::new(),
            k: 0,
            original_len: 0,
            stream_id: 0,
        }
    }

    /// Add a received chunk. Returns true if enough chunks are available for decoding.
    pub fn add_chunk(&mut self, chunk: FecChunk) -> bool {
        if self.received_chunks.is_empty() {
            self.k = chunk.total_data_chunks as usize;
            self.original_len = chunk.original_len as usize;
            self.stream_id = chunk.stream_id;
        } else if self.stream_id != chunk.stream_id {
            return false;
        }

        // Avoid duplicate chunk indices
        if !self.received_chunks.iter().any(|c| c.chunk_index == chunk.chunk_index) {
            self.received_chunks.push(chunk);
        }

        self.received_chunks.len() >= self.k
    }

    /// Decode the original payload if at least K chunks are received
    pub fn decode(&self) -> Option<Vec<u8>> {
        if self.received_chunks.len() < self.k || self.k == 0 {
            return None;
        }

        // If we have all K systematic data chunks (indices 0..K-1), simple concat
        let mut has_all_data = true;
        for i in 0..self.k {
            if !self.received_chunks.iter().any(|c| c.chunk_index == i as u8) {
                has_all_data = false;
                break;
            }
        }

        let chunk_size = self.received_chunks[0].data.len();

        if has_all_data {
            let mut payload = Vec::with_capacity(self.k * chunk_size);
            for i in 0..self.k {
                let chunk = self.received_chunks.iter().find(|c| c.chunk_index == i as u8).unwrap();
                payload.extend_from_slice(&chunk.data);
            }
            payload.truncate(self.original_len);
            return Some(payload);
        }

        // Otherwise: Gaussian elimination over GF(256) on K received chunks
        let chunks_to_use = &self.received_chunks[0..self.k];
        let mut matrix = vec![vec![0u8; self.k]; self.k];
        let mut data = vec![vec![0u8; chunk_size]; self.k];

        for (row, chunk) in chunks_to_use.iter().enumerate() {
            data[row].copy_from_slice(&chunk.data);
            let idx = chunk.chunk_index as usize;
            if idx < self.k {
                matrix[row][idx] = 1;
            } else {
                let j = idx - self.k;
                let y_j = (128 + j) as u8;
                for col in 0..self.k {
                    let x_i = col as u8;
                    matrix[row][col] = GF.inv(x_i ^ y_j);
                }
            }
        }

        // Forward elimination (Gauss-Jordan)
        for col in 0..self.k {
            // Find pivot
            let mut pivot_row = col;
            while pivot_row < self.k && matrix[pivot_row][col] == 0 {
                pivot_row += 1;
            }
            if pivot_row == self.k {
                return None; // Singular matrix (should never occur with Cauchy generator)
            }

            if pivot_row != col {
                matrix.swap(col, pivot_row);
                data.swap(col, pivot_row);
            }

            // Normalize pivot row
            let inv_pivot = GF.inv(matrix[col][col]);
            for c in 0..self.k {
                matrix[col][c] = GF.mul(matrix[col][c], inv_pivot);
            }
            for b in 0..chunk_size {
                data[col][b] = GF.mul(data[col][b], inv_pivot);
            }

            // Eliminate other rows
            for r in 0..self.k {
                if r != col && matrix[r][col] != 0 {
                    let factor = matrix[r][col];
                    for c in 0..self.k {
                        matrix[r][c] ^= GF.mul(factor, matrix[col][c]);
                    }
                    for b in 0..chunk_size {
                        data[r][b] ^= GF.mul(factor, data[col][b]);
                    }
                }
            }
        }

        // Assemble reconstructed payload
        let mut payload = Vec::with_capacity(self.k * chunk_size);
        for row in 0..self.k {
            payload.extend_from_slice(&data[row]);
        }
        payload.truncate(self.original_len);
        Some(payload)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fec_encode_decode_no_loss() {
        let encoder = FecEncoder::new(8, 4); // 8 data, 4 parity = 12 total
        let payload = b"RED-POST-QUANTUM-ML-KEM-768-KEY-MATERIAL-TACTICAL-PAYLOAD-VERIFIED";
        let chunks = encoder.encode(1001, payload);
        assert_eq!(chunks.len(), 12);

        let mut decoder = FecDecoder::new();
        for chunk in &chunks[0..8] {
            decoder.add_chunk(chunk.clone());
        }

        let reconstructed = decoder.decode().expect("Failed to decode without loss");
        assert_eq!(reconstructed, payload);
    }

    #[test]
    fn test_fec_encode_decode_with_25_percent_loss() {
        let encoder = FecEncoder::new(12, 4); // 12 data, 4 parity (25% redundancy)
        let payload = vec![0x42u8; 1184]; // 1,184 bytes = ML-KEM-768 Public Key size
        let chunks = encoder.encode(2002, &payload);
        assert_eq!(chunks.len(), 16);

        // Simulate dropping 4 arbitrary chunks (e.g. chunks 0, 3, 7, 11 lost in radio noise)
        let mut decoder = FecDecoder::new();
        for (i, chunk) in chunks.iter().enumerate() {
            if i != 0 && i != 3 && i != 7 && i != 11 {
                decoder.add_chunk(chunk.clone());
            }
        }

        let reconstructed = decoder.decode().expect("Failed to decode with 25% packet loss");
        assert_eq!(reconstructed, payload);
    }
}
