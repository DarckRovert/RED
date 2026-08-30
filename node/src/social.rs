use chrono::Utc;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};

pub use red_core::protocol::tactical::{SocialPost, PostRequest, MAX_LOCAL_POSTS};

#[derive(Clone)]
pub struct SocialStore {
    // Memoria caché para acceso rápido (Feed)
    feed: Arc<RwLock<Vec<SocialPost>>>,
    // Set de identidades que el usuario sigue
    following: Arc<RwLock<HashSet<String>>>,
    db: Option<Arc<sled::Db>>,
}

impl SocialStore {
    pub fn new(db: Option<Arc<sled::Db>>) -> Self {
        let store = Self {
            feed: Arc::new(RwLock::new(Vec::new())),
            following: Arc::new(RwLock::new(HashSet::new())),
            db,
        };
        store.load_from_db();
        store
    }

    fn load_from_db(&self) {
        if let Some(db) = &self.db {
            // Cargar 'following'
            if let Ok(tree) = db.open_tree("social_following") {
                let mut follows = self.following.write().unwrap_or_else(|e| e.into_inner());
                for item in tree.iter().flatten() {
                    if let Ok(key) = String::from_utf8(item.0.to_vec()) {
                        follows.insert(key);
                    }
                }
            }

            // Cargar 'feed'
            if let Ok(tree) = db.open_tree("social_feed") {
                let mut feed_list = self.feed.write().unwrap_or_else(|e| e.into_inner());
                for item in tree.iter().flatten() {
                    if let Ok(post) = serde_json::from_slice::<SocialPost>(&item.1) {
                        feed_list.push(post);
                    }
                }
                // Ordenar del más reciente al más antiguo
                feed_list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
            }
        }
    }

    pub fn is_following(&self, author_hash: &str) -> bool {
        let follows = self.following.read().unwrap_or_else(|e| e.into_inner());
        follows.contains(author_hash)
    }

    pub fn follow(&self, author_hash: &str) {
        let mut follows = self.following.write().unwrap_or_else(|e| e.into_inner());
        follows.insert(author_hash.to_string());
        
        if let Some(db) = &self.db {
            if let Ok(tree) = db.open_tree("social_following") {
                let _ = tree.insert(author_hash.as_bytes(), &[]);
            }
        }
    }

    pub fn unfollow(&self, author_hash: &str) {
        let mut follows = self.following.write().unwrap_or_else(|e| e.into_inner());
        follows.remove(author_hash);
        
        if let Some(db) = &self.db {
            if let Ok(tree) = db.open_tree("social_following") {
                let _ = tree.remove(author_hash.as_bytes());
            }
        }
    }

    pub fn get_following(&self) -> Vec<String> {
        self.following.read().unwrap_or_else(|e| e.into_inner()).iter().cloned().collect()
    }

    pub fn create_post(&self, author_hash: String, req: PostRequest) -> SocialPost {
        let timestamp = Utc::now().timestamp();
        let hash_input = format!(
            "{}:{}:{}:{}",
            author_hash, req.content, timestamp, req.media_data.as_deref().unwrap_or("")
        );
        let hash = blake3::hash(hash_input.as_bytes()).to_hex().to_string();
        let id = format!("post_{}", &hash[..12]);

        let post = SocialPost {
            id,
            author_hash,
            author_name: req.author_name,
            content: req.content,
            media_data: req.media_data,
            timestamp,
            reactions: HashMap::new(),
            reply_to: None,
            signature: String::new(),
        };

        self.insert_post(post.clone());
        post
    }

    /// Creates and cryptographically signs a tactical social post using the author's Ed25519 identity.
    pub fn create_signed_post(&self, identity: &red_core::identity::Identity, req: PostRequest) -> SocialPost {
        let author_hash = identity.identity_hash().to_hex();
        let timestamp = Utc::now().timestamp();
        let hash_input = format!(
            "{}:{}:{}:{}",
            author_hash, req.content, timestamp, req.media_data.as_deref().unwrap_or("")
        );
        let hash = blake3::hash(hash_input.as_bytes()).to_hex().to_string();
        let id = format!("post_{}", &hash[..12]);
        let signature_bytes = identity.sign(hash.as_bytes());
        let signature = hex::encode(signature_bytes);

        let post = SocialPost {
            id,
            author_hash,
            author_name: req.author_name,
            content: req.content,
            media_data: req.media_data,
            timestamp,
            reactions: HashMap::new(),
            reply_to: None,
            signature,
        };

        self.insert_post(post.clone());
        post
    }

    pub fn insert_post(&self, post: SocialPost) {
        // Evitar duplicados pero fusionar reacciones si el post ya existe
        let mut feed_list = self.feed.write().unwrap_or_else(|e| e.into_inner());
        if let Some(existing_idx) = feed_list.iter().position(|p| p.id == post.id) {
            // Fusionar reacciones (Merge)
            let mut existing = feed_list[existing_idx].clone();
            for (emoji, hashes) in post.reactions {
                let entry = existing.reactions.entry(emoji).or_default();
                for hash in hashes {
                    if !entry.contains(&hash) {
                        entry.push(hash);
                    }
                }
            }
            feed_list[existing_idx] = existing.clone();
            
            // Actualizar DB
            if let Some(db) = &self.db {
                if let Ok(tree) = db.open_tree("social_feed") {
                    if let Ok(bytes) = serde_json::to_vec(&existing) {
                        let _ = tree.insert(existing.id.as_bytes(), bytes);
                    }
                }
            }
            return;
        }

        feed_list.push(post.clone());
        feed_list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        let mut dropped_ids = Vec::new();
        if feed_list.len() > MAX_LOCAL_POSTS {
            let dropped = feed_list.split_off(MAX_LOCAL_POSTS);
            for d in dropped {
                dropped_ids.push(d.id.clone());
            }
        }

        if let Some(db) = &self.db {
            if let Ok(tree) = db.open_tree("social_feed") {
                if let Ok(bytes) = serde_json::to_vec(&post) {
                    let _ = tree.insert(post.id.as_bytes(), bytes);
                }
                
                // Eliminar del Sled los posts más antiguos que fueron expulsados de la caché
                for id in dropped_ids {
                    let _ = tree.remove(id.as_bytes());
                }
            }
        }
    }

    pub fn get_feed(&self, limit: usize) -> Vec<SocialPost> {
        let feed = self.feed.read().unwrap_or_else(|e| e.into_inner());
        feed.iter().take(limit).cloned().collect()
    }
    
    pub fn add_reaction(&self, post_id: &str, emoji: &str, reactor_hash: &str) -> Option<SocialPost> {
        let mut feed_list = self.feed.write().unwrap_or_else(|e| e.into_inner());
        if let Some(post) = feed_list.iter_mut().find(|p| p.id == post_id) {
            let entry = post.reactions.entry(emoji.to_string()).or_insert_with(Vec::new);
            if !entry.contains(&reactor_hash.to_string()) {
                entry.push(reactor_hash.to_string());
            }
            
            let updated = post.clone();
            
            if let Some(db) = &self.db {
                if let Ok(tree) = db.open_tree("social_feed") {
                    if let Ok(bytes) = serde_json::to_vec(&updated) {
                        let _ = tree.insert(updated.id.as_bytes(), bytes);
                    }
                }
            }
            Some(updated)
        } else {
            None
        }
    }
}
