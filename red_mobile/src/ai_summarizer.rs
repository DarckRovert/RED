use std::collections::{HashMap, HashSet};

pub use red_core::protocol::tactical::{ChannelSummaryResponse, SummarizeChannelRequest};

pub struct AISummarizerEngine;

impl Default for AISummarizerEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl AISummarizerEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn summarize(&self, req: SummarizeChannelRequest) -> ChannelSummaryResponse {
        let start = std::time::Instant::now();
        let total = req.messages.len();

        if total == 0 {
            return ChannelSummaryResponse {
                channel_id: req.channel_id,
                summary_bullets: vec!["No hay mensajes recientes en el canal para sintetizar.".to_string()],
                total_messages_analyzed: 0,
                sentiment: "Informativo / Operativo".to_string(),
                execution_time_ms: start.elapsed().as_millis() as u64,
            };
        }

        let stopwords: HashSet<&str> = vec![
            "de", "la", "que", "el", "en", "y", "a", "los", "del", "se", "las", "por", "un", "para", "con", "no", "una", "su", "al", "lo", "como", "más", "pero", "sus", "le", "ya", "o", "este", "sí", "porque", "esta", "entre", "cuando", "muy", "sin", "sobre", "también", "me", "hasta", "hay", "donde", "quien", "desde", "todo", "nos", "durante", "todos", "uno", "les", "ni", "contra", "otros", "ese", "eso", "ante", "ellos", "e", "esto", "mí", "antes", "algunos", "qué", "unos", "yo", "otro", "otras", "otra", "él", "tanto", "esa", "estos", "mucho", "quienes", "nada", "muchos", "cual", "poco", "ella", "estar", "estas", "algunas", "algo", "nosotros", "mi", "mis", "tú", "te", "ti", "tu", "tus", "ellas", "nosotras", "vosotros", "vosotras", "os", "mío", "mía", "míos", "mías", "tuyo", "tuya", "tuyos", "tuyas", "suyo", "suya", "suyos", "suyas", "nuestro", "nuestra", "nuestros", "nuestras", "vuestro", "vuestra", "vuestros", "vuestras", "es", "son"
        ].into_iter().collect();

        let alert_words = ["urgente", "peligro", "sos", "ayuda", "fuego", "herido", "inundacion", "terremoto", "emergencia"];
        let positive_words = ["operativo", "bien", "seguro", "estable", "tranquilo", "controlado", "despejado"];

        let mut word_freq = HashMap::new();
        let mut msg_scores = Vec::new();
        let mut alert_count = 0;
        let mut positive_count = 0;

        for (idx, msg) in req.messages.iter().enumerate() {
            let words: Vec<String> = msg.to_lowercase()
                .split(|c: char| !c.is_alphanumeric())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .collect();
            
            let mut unique_words = HashSet::new();
            for word in &words {
                if !stopwords.contains(word.as_str()) && word.len() > 3 {
                    *word_freq.entry(word.clone()).or_insert(0) += 1;
                    unique_words.insert(word.clone());
                }
                if alert_words.contains(&word.as_str()) { alert_count += 1; }
                if positive_words.contains(&word.as_str()) { positive_count += 1; }
            }
            msg_scores.push((idx, unique_words));
        }

        let mut scored_msgs: Vec<(usize, usize)> = msg_scores.into_iter().map(|(idx, unique_words)| {
            let score = unique_words.iter().map(|w| word_freq.get(w).unwrap_or(&1)).sum::<usize>();
            (idx, score)
        }).collect();

        scored_msgs.sort_by(|a, b| b.1.cmp(&a.1));

        let mut bullets = Vec::new();
        bullets.push(format!("Canal {}: {} mensajes analizados localmente.", req.channel_id, total));
        
        let top_n = std::cmp::min(3, scored_msgs.len());
        for i in 0..top_n {
            let msg_idx = scored_msgs[i].0;
            bullets.push(format!("- {}", req.messages[msg_idx].trim()));
        }

        let sentiment = if alert_count > 0 {
            "Alerta Activa".to_string()
        } else if positive_count > 0 {
            "Operativo".to_string()
        } else {
            "Informativo".to_string()
        };

        let execution_time_ms = start.elapsed().as_millis() as u64;

        ChannelSummaryResponse {
            channel_id: req.channel_id,
            summary_bullets: bullets,
            total_messages_analyzed: total,
            sentiment,
            execution_time_ms,
        }
    }
}
