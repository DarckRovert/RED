//! Guardian IA — Motor de Moderación de Contenido para RED
//!
//! Analiza contenido en el nodo EMISOR, antes de cifrado E2E.
//! Usa meta-llama/llama-guard-4-12b (Groq) para texto y pHash
//! perceptual local para imágenes.
//!
//! Audit: llama-guard-3-8b está DEPRECADO. Se usa llama-guard-4-12b.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

/// Modelo de moderación actual (auditado 2026-08-01: llama-guard-3-8b DEPRECADO)
const GUARDIAN_MODEL: &str = "meta-llama/llama-guard-4-12b";
const GROQ_API_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
const CACHE_TTL_SECS: u64 = 300; // 5 minutos
const MAX_CACHE_ENTRIES: usize = 1000;

// ─── Tipos públicos ────────────────────────────────────────────────────────────

/// Resultado del análisis de Guardian
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GuardianVerdict {
    /// Contenido permitido — continúa flujo normal
    Allow,
    /// Contenido bloqueado — incluye categoría y razón
    Block { category: String, reason: String },
    /// Contenido flaggeado para revisión (modo warn)
    FlagForReview { category: String, reason: String },
}

/// Modo de operación del Guardian
#[derive(Debug, Clone, PartialEq)]
pub enum GuardianMode {
    /// Bloqueo total de contenido peligroso
    Strict,
    /// Solo advertencia, no bloquea
    Warn,
    /// Apagado — no analiza nada (no recomendado)
    Off,
}

impl GuardianMode {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "warn" => GuardianMode::Warn,
            "off" => GuardianMode::Off,
            _ => GuardianMode::Strict, // Default: strict
        }
    }
}

/// Estadísticas del Guardian
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GuardianStats {
    pub messages_analyzed: u64,
    pub messages_blocked: u64,
    pub messages_flagged: u64,
    pub images_analyzed: u64,
    pub images_blocked: u64,
    pub api_calls_made: u64,
    pub api_errors: u64,
    pub cache_hits: u64,
}

/// Entrada de caché con TTL
#[derive(Clone)]
struct CacheEntry {
    verdict: GuardianVerdict,
    created_at: Instant,
}

// ─── Guardian Engine ───────────────────────────────────────────────────────────

/// Motor principal de moderación.
/// Thread-safe via Arc — se comparte entre handlers de Axum.
pub struct GuardianEngine {
    api_key: Option<String>,
    mode: GuardianMode,
    client: reqwest::Client,
    /// Caché de verdicts por hash de contenido (SHA-256 hex)
    cache: Arc<Mutex<HashMap<String, CacheEntry>>>,
    /// Estadísticas acumuladas
    stats: Arc<Mutex<GuardianStats>>,
}

impl GuardianEngine {
    /// Crea un nuevo GuardianEngine.
    /// Si `api_key` es None, opera en modo degradado (solo pHash para imágenes).
    pub fn new(api_key: Option<String>, mode: GuardianMode) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to build HTTP client for Guardian");

        if api_key.is_none() {
            warn!("Guardian: No GROQ_API_KEY — text analysis disabled, image pHash only");
        }

        info!(
            "Guardian initialized: mode={:?}, model={}",
            mode, GUARDIAN_MODEL
        );

        GuardianEngine {
            api_key,
            mode,
            client,
            cache: Arc::new(Mutex::new(HashMap::new())),
            stats: Arc::new(Mutex::new(GuardianStats::default())),
        }
    }

    /// Crea desde variables de entorno.
    pub fn from_env() -> Self {
        let api_key = std::env::var("GROQ_API_KEY").ok().filter(|k| !k.is_empty());
        let mode_str = std::env::var("GUARDIAN_MODE").unwrap_or_else(|_| "strict".to_string());
        let mode = GuardianMode::from_str(&mode_str);
        Self::new(api_key, mode)
    }

    /// Analiza texto simple (wrapper hacia la ventana de contexto).
    pub async fn analyze_text(&self, content: &str) -> GuardianVerdict {
        self.analyze_conversation_context(&[], content).await
    }

    /// Analiza el mensaje actual junto con la ventana de contexto reciente de la conversación.
    /// Opera en 2 capas: Capa 1 Off-Grid (Local) -> Capa 2 Groq Cloud (Si hay red).
    pub async fn analyze_conversation_context(
        &self,
        context: &[String],
        current_msg: &str,
    ) -> GuardianVerdict {
        if self.mode == GuardianMode::Off {
            return GuardianVerdict::Allow;
        }

        if current_msg.trim().len() < 3 && context.is_empty() {
            return GuardianVerdict::Allow;
        }

        // ── Capa 1: Evaluador Local Off-Grid (<1ms, sin red) ──────────────────────
        if let Some(local_verdict) = self.local_engine_eval(context, current_msg) {
            match &local_verdict {
                GuardianVerdict::Block { .. } => self.increment_blocked(),
                GuardianVerdict::FlagForReview { .. } => self.increment_flagged(),
                _ => {}
            }
            if self.mode == GuardianMode::Warn {
                if let GuardianVerdict::Block { category, reason } = local_verdict {
                    return GuardianVerdict::FlagForReview { category, reason };
                }
            }
            return local_verdict;
        }

        // ── Capa 2: Auditoría Groq / LlamaGuard-4 (Opcional, si hay API Key) ─────
        let cache_key = self.hash_content(&format!("{:?}:{}", context, current_msg));
        if let Some(cached) = self.get_from_cache(&cache_key) {
            self.increment_cache_hits();
            return cached;
        }

        self.increment_analyzed();

        let api_key = match &self.api_key {
            Some(k) => k.clone(),
            None => {
                // Sin API Key: el resultado del filtro local fue Allow, así que permitimos.
                return GuardianVerdict::Allow;
            }
        };

        // Formatear la ventana de contexto para LlamaGuard
        let full_payload = if context.is_empty() {
            current_msg.to_string()
        } else {
            format!(
                "Historial reciente:\n{}\nMensaje actual:\n{}",
                context.join("\n"),
                current_msg
            )
        };

        // Llamar a LlamaGuard 4
        match self.call_llama_guard(&api_key, &full_payload).await {
            Ok(verdict) => {
                self.cache_verdict(cache_key, verdict.clone());
                match &verdict {
                    GuardianVerdict::Block { .. } => self.increment_blocked(),
                    GuardianVerdict::FlagForReview { .. } => self.increment_flagged(),
                    _ => {}
                }
                if self.mode == GuardianMode::Warn {
                    if let GuardianVerdict::Block { category, reason } = verdict {
                        return GuardianVerdict::FlagForReview { category, reason };
                    }
                }
                verdict
            }
            Err(e) => {
                error!("Guardian API error: {}", e);
                self.increment_api_error();
                GuardianVerdict::Allow
            }
        }
    }

    /// Evaluador heurístico local off-grid (Capa 1).
    /// Detecta patrones críticos sin salir a la red.
    fn local_engine_eval(&self, context: &[String], current_msg: &str) -> Option<GuardianVerdict> {
        let msg_lower = current_msg.to_lowercase();

        // 1. Detección de patrones de explotación o abuso severo (S4 / CSAM / Tráfico)
        let csam_direct_patterns = [
            "porno infantil",
            "pornografia infantil",
            "pornografía infantil",
            "cp_link",
            "pedof",
            "grooming",
            "abuso infantil",
            "explotacion infantil",
            "explotación infantil",
            "child abuse",
            "csam",
            "child porn",
        ];
        for pat in csam_direct_patterns {
            if msg_lower.contains(pat) {
                return Some(GuardianVerdict::Block {
                    category: "child_exploitation_local".to_string(),
                    reason: "Contenido bloqueado por el filtro local de protección infantil"
                        .to_string(),
                });
            }
        }

        // 2. Detección de secuencias de grooming acumuladas en la ventana de contexto
        if !context.is_empty() {
            let context_combined = context.join(" ").to_lowercase();
            let grooming_triggers = [
                "no le digas a nadie",
                "es un secreto",
                "mandame foto",
                "no le cuentes a tus papas",
            ];
            for trigger in grooming_triggers {
                if (context_combined.contains(trigger) || msg_lower.contains(trigger))
                    && (msg_lower.contains("camara")
                        || msg_lower.contains("foto")
                        || msg_lower.contains("dirección"))
                {
                    return Some(GuardianVerdict::Block {
                        category: "grooming_pattern_local".to_string(),
                        reason:
                            "Patrón de acoso/grooming detectado en el contexto de la conversación"
                                .to_string(),
                    });
                }
            }
        }

        None
    }

    /// Analiza una imagen codificada en base64.
    /// Usa pHash perceptual local — no envía imagen a servicios externos.
    pub fn analyze_image_hash(&self, b64_data: &str) -> GuardianVerdict {
        if self.mode == GuardianMode::Off {
            return GuardianVerdict::Allow;
        }

        // Decodificar base64
        let bytes = match base64_decode(b64_data) {
            Ok(b) => b,
            Err(_) => {
                // No se puede decodificar — bloquear por precaución
                return GuardianVerdict::Block {
                    category: "invalid_media".to_string(),
                    reason: "No se puede decodificar el contenido multimedia".to_string(),
                };
            }
        };

        if let Some(verdict) = self.get_from_cache(&self.hash_content(b64_data)) {
            self.increment_cache_hits();
            return verdict;
        }

        // Calcular pHash perceptual
        // En esta implementación usamos el hash SHA-256 del contenido como placeholder
        // para el pHash real (img_hash crate). La integración real se conecta aquí.
        let phash = compute_perceptual_hash(&bytes);

        // Verificar contra lista de hashes bloqueados (NCMEC / base local)
        if is_hash_blocked(&phash) {
            let verdict = GuardianVerdict::Block {
                category: "csam_or_prohibited_media".to_string(),
                reason: "Contenido multimedia identificado como prohibido".to_string(),
            };
            self.cache_verdict(self.hash_content(b64_data), verdict.clone());
            self.increment_images_blocked();
            return verdict;
        }

        self.increment_images_analyzed();
        GuardianVerdict::Allow
    }

    /// Retorna estadísticas actuales (para el endpoint /api/guardian/status)
    pub fn get_stats(&self) -> GuardianStats {
        self.stats.lock().unwrap().clone()
    }

    /// Indica si el Guardian está activo y configurado
    pub fn is_active(&self) -> bool {
        self.mode != GuardianMode::Off
    }

    pub fn get_mode_str(&self) -> &str {
        match self.mode {
            GuardianMode::Strict => "strict",
            GuardianMode::Warn => "warn",
            GuardianMode::Off => "off",
        }
    }

    pub fn has_api_key(&self) -> bool {
        self.api_key.is_some()
    }

    // ─── Privadas ──────────────────────────────────────────────────────────────

    async fn call_llama_guard(
        &self,
        api_key: &str,
        content: &str,
    ) -> Result<GuardianVerdict, String> {
        // LlamaGuard 4 requiere el formato correcto de conversación (role-based)
        // https://huggingface.co/meta-llama/Llama-Guard-4-12B
        // El modelo está entrenado para clasificar mensajes user/agent en pares de roles.
        // Enviamos como mensaje de usuario para clasificar la intent del emisor.
        #[derive(Serialize)]
        struct ChatRequest {
            model: &'static str,
            messages: Vec<ChatMessage>,
            max_tokens: u32,
            temperature: f32,
        }

        #[derive(Serialize)]
        struct ChatMessage {
            role: &'static str,
            content: String,
        }

        #[derive(Deserialize)]
        struct ChatResponse {
            choices: Vec<Choice>,
        }

        #[derive(Deserialize)]
        struct Choice {
            message: ResponseMessage,
        }

        #[derive(Deserialize)]
        struct ResponseMessage {
            content: String,
        }

        // Formato correcto según la especificación de Meta para LlamaGuard:
        // El contenido va como turno de usuario. El modelo responde "safe" o "unsafe\nS<N>".
        // Nota: via Groq API no podemos usar apply_chat_template directamente,
        // pero Groq aplica el template internamente cuando detecta el modelo llama-guard.
        let request_body = ChatRequest {
            model: GUARDIAN_MODEL,
            messages: vec![ChatMessage {
                role: "user",
                // Estructura el contenido en el formato esperado por LlamaGuard:
                // Provee contexto de qué estamos clasificando
                content: format!(
                    "<|start_header_id|>user<|end_header_id|>\n\n{content}<|eot_id|>",
                    content = content
                ),
            }],
            max_tokens: 20,   // LlamaGuard solo necesita "safe" o "unsafe\nS<N>"
            temperature: 0.0, // Determinista — clasificación no necesita creatividad
        };

        let response = self
            .client
            .post(GROQ_API_URL)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("HTTP error: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let err_text = response.text().await.unwrap_or_default();
            return Err(format!("API returned {}: {}", status, err_text));
        }

        let chat_resp: ChatResponse = response
            .json()
            .await
            .map_err(|e| format!("JSON parse error: {}", e))?;

        let raw_output = chat_resp
            .choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .unwrap_or_default()
            .trim()
            .to_lowercase();

        // LlamaGuard retorna "safe" o "unsafe\nS<número_categoría>"
        self.parse_llama_guard_output(&raw_output)
    }

    /// Parsea la respuesta cruda de LlamaGuard
    fn parse_llama_guard_output(&self, raw: &str) -> Result<GuardianVerdict, String> {
        if raw.starts_with("safe") {
            return Ok(GuardianVerdict::Allow);
        }

        if raw.starts_with("unsafe") {
            // Extraer categoría (ej: "S1", "S2", etc.)
            let lines: Vec<&str> = raw.lines().collect();
            let category_code = lines.get(1).map(|s| s.trim()).unwrap_or("S_UNKNOWN");
            let category_label = llama_guard_category_to_label(category_code);

            return Ok(GuardianVerdict::Block {
                category: category_label,
                reason: format!(
                    "LlamaGuard-4 detectó contenido de categoría {}",
                    category_code
                ),
            });
        }

        // Respuesta ambigua — permitir con log
        warn!("Guardian: respuesta ambigua de LlamaGuard: '{}'", raw);
        Ok(GuardianVerdict::Allow)
    }

    fn hash_content(&self, content: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        format!("{:016x}", hasher.finish())
    }

    fn get_from_cache(&self, key: &str) -> Option<GuardianVerdict> {
        let cache = self.cache.lock().unwrap();
        if let Some(entry) = cache.get(key) {
            if entry.created_at.elapsed().as_secs() < CACHE_TTL_SECS {
                return Some(entry.verdict.clone());
            }
        }
        None
    }

    fn cache_verdict(&self, key: String, verdict: GuardianVerdict) {
        let mut cache = self.cache.lock().unwrap();
        // Evict oldest if at capacity
        if cache.len() >= MAX_CACHE_ENTRIES {
            let oldest_key = cache
                .iter()
                .min_by_key(|(_, e)| e.created_at)
                .map(|(k, _)| k.clone());
            if let Some(k) = oldest_key {
                cache.remove(&k);
            }
        }
        cache.insert(
            key,
            CacheEntry {
                verdict,
                created_at: Instant::now(),
            },
        );
    }

    fn increment_analyzed(&self) {
        let mut s = self.stats.lock().unwrap();
        s.messages_analyzed += 1;
        s.api_calls_made += 1;
    }

    fn increment_blocked(&self) {
        self.stats.lock().unwrap().messages_blocked += 1;
    }

    fn increment_flagged(&self) {
        self.stats.lock().unwrap().messages_flagged += 1;
    }

    fn increment_images_analyzed(&self) {
        self.stats.lock().unwrap().images_analyzed += 1;
    }

    fn increment_images_blocked(&self) {
        self.stats.lock().unwrap().images_blocked += 1;
    }

    fn increment_api_error(&self) {
        self.stats.lock().unwrap().api_errors += 1;
    }

    fn increment_cache_hits(&self) {
        self.stats.lock().unwrap().cache_hits += 1;
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Mapea el código de categoría de LlamaGuard 4 a etiqueta legible
fn llama_guard_category_to_label(code: &str) -> String {
    match code.to_uppercase().as_str() {
        "S1" => "violent_crimes".to_string(),
        "S2" => "non_violent_crimes".to_string(),
        "S3" => "sex_related_crimes".to_string(),
        "S4" => "child_sexual_exploitation".to_string(),
        "S5" => "defamation".to_string(),
        "S6" => "specialized_advice".to_string(),
        "S7" => "privacy_violations".to_string(),
        "S8" => "intellectual_property".to_string(),
        "S9" => "indiscriminate_weapons".to_string(),
        "S10" => "hate_speech".to_string(),
        "S11" => "suicide_or_self_harm".to_string(),
        "S12" => "sexual_content".to_string(),
        "S13" => "elections".to_string(),
        "S14" => "code_interpreter_abuse".to_string(),
        _ => format!("prohibited_content_{}", code),
    }
}

/// Decodifica base64 usando el crate `base64` ya declarado en Cargo.toml.
/// Soporta data URLs ("data:image/png;base64,...") y base64 crudo.
fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    // Remover prefijo data URL si existe (data:image/...;base64,...)
    let clean = if let Some(idx) = input.find(',') {
        &input[idx + 1..]
    } else {
        input
    };

    // Limpiar whitespace (saltos de línea que algunos encoders incluyen)
    let clean_no_ws: String = clean.chars().filter(|c| !c.is_whitespace()).collect();

    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD
        .decode(&clean_no_ws)
        .map_err(|e| format!("base64 decode error: {}", e))
}

/// Calcula un hash perceptual simple de los bytes de la imagen.
/// En producción se reemplaza por img_hash::HashAlg::PHash del crate img_hash.
fn compute_perceptual_hash(bytes: &[u8]) -> String {
    // Usamos SHA-256 reducido a 64 bits como placeholder de pHash
    // El crate img_hash requiere decodificación de imagen completa
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    // Samplear los primeros 4KB para representatividad sin overhead total
    let sample = &bytes[..bytes.len().min(4096)];
    sample.hash(&mut hasher);
    format!("phash:{:016x}", hasher.finish())
}

/// Verifica si el hash perceptual está en la lista de bloqueo.
/// En producción: conecta con NCMEC PhotoDNA hash database vía API segura.
fn is_hash_blocked(phash: &str) -> bool {
    // Lista local de hashes bloqueados conocidos (vacía por defecto — se alimenta en producción)
    // En un despliegue real, esta lista se actualiza desde NCMEC CyberTipline API.
    let blocked_hashes: &[&str] = &[
        // Hashes de ejemplo — en producción vendrán de NCMEC API
        // "phash:XXXXXXXXXXXXXXXX",
    ];
    blocked_hashes.contains(&phash)
}
