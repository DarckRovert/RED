use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChunk {
    pub file_id: String,
    pub chunk_index: usize,
    pub total_chunks: usize,
    pub chunk_hash: String,
    pub data_base64: String,
    pub chunk_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkManifest {
    pub file_id: String,
    pub filename: String,
    pub total_size: usize,
    pub total_chunks: usize,
    pub root_hash: String,
    pub chunk_hashes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitFileRequest {
    pub filename: String,
    pub data_base64: String,
}

#[derive(Clone)]
pub struct ChunkerEngine {
    manifests: Arc<RwLock<HashMap<String, ChunkManifest>>>,
    chunks: Arc<RwLock<HashMap<String, Vec<FileChunk>>>>,
}

impl ChunkerEngine {
    pub fn new() -> Self {
        Self {
            manifests: Arc::new(RwLock::new(HashMap::new())),
            chunks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn split_file(&self, req: SplitFileRequest) -> Result<ChunkManifest, String> {
        let raw_bytes =
            base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &req.data_base64)
                .map_err(|e| format!("Base64 decode error: {}", e))?;

        let total_size = raw_bytes.len();
        let chunk_size = 64 * 1024; // 64 KB per chunk
        let total_chunks = (total_size + chunk_size - 1) / chunk_size;

        let root_hash = format!("{:x}", blake3::hash(&raw_bytes));
        let file_id = format!("file_{}_{}", &root_hash[..10], total_chunks);

        let mut chunk_hashes = Vec::with_capacity(total_chunks);
        let mut file_chunks = Vec::with_capacity(total_chunks);

        for (idx, slice) in raw_bytes.chunks(chunk_size).enumerate() {
            let chk_hash = format!("{:x}", blake3::hash(slice));
            chunk_hashes.push(chk_hash.clone());

            let b64_chunk =
                base64::Engine::encode(&base64::engine::general_purpose::STANDARD, slice);

            file_chunks.push(FileChunk {
                file_id: file_id.clone(),
                chunk_index: idx,
                total_chunks,
                chunk_hash: chk_hash,
                data_base64: b64_chunk,
                chunk_size: slice.len(),
            });
        }

        let manifest = ChunkManifest {
            file_id: file_id.clone(),
            filename: req.filename,
            total_size,
            total_chunks,
            root_hash,
            chunk_hashes,
        };

        self.manifests
            .write()
            .unwrap()
            .insert(file_id.clone(), manifest.clone());
        self.chunks.write().unwrap().insert(file_id, file_chunks);

        Ok(manifest)
    }

    pub fn get_manifest(&self, file_id: &str) -> Option<ChunkManifest> {
        self.manifests.read().unwrap().get(file_id).cloned()
    }

    pub fn get_chunk(&self, file_id: &str, index: usize) -> Option<FileChunk> {
        let map = self.chunks.read().unwrap();
        if let Some(list) = map.get(file_id) {
            list.get(index).cloned()
        } else {
            None
        }
    }
}
