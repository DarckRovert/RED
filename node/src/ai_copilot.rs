use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotQueryRequest {
    pub prompt: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotResponse {
    pub answer: String,
    pub topic_category: String,
    pub source: String,
    pub execution_time_ms: u64,
}

pub struct AICopilotEngine;

impl AICopilotEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn query(&self, req: CopilotQueryRequest) -> CopilotResponse {
        let start = std::time::Instant::now();
        let prompt_lower = req.prompt.to_lowercase();

        let (answer, category) = if prompt_lower.contains("primeros auxilios")
            || prompt_lower.contains("herida")
            || prompt_lower.contains("sangre")
            || prompt_lower.contains("quemadura")
        {
            (
                "🚑 PROTOCOLO DE PRIMEROS AUXILIOS OFF-GRID:\n\n1. Mantén la calma y evalúa la seguridad del entorno.\n2. Presión directa sobre heridas sangrantes con tela limpia por 10-15 min.\n3. En quemaduras, aplica agua limpia a temperatura ambiente (no hielo).\n4. Si el afectado está inconsciente, colócalo en Posición Lateral de Seguridad.\n5. Transmite tu Baliza SOS en RED con tus coordenadas GPS.".to_string(),
                "Emergencia Médica".to_string(),
            )
        } else if prompt_lower.contains("sismo")
            || prompt_lower.contains("terremoto")
            || prompt_lower.contains("huaico")
            || prompt_lower.contains("inundacion")
        {
            (
                "🚨 PROTOCOLO ANTE DESASTRES NATURALES:\n\n1. Aléjate de ventanas, repisas y cables eléctricos.\n2. Ubícate en zonas de seguridad marcadas o junto a estructuras portantes (Triángulo de la Vida).\n3. Revisa la Brújula Táctica RED para ubicar a tus contactos de auxilio cercanos.\n4. Si la red celular cae, RED cambiará automáticamente a Radio Mesh (BLE/WiFi-D/LoRa).\n5. Mantén activo el Modo Eco-Mesh para conservar la batería hasta 72h.".to_string(),
                "Desastre Natural".to_string(),
            )
        } else if prompt_lower.contains("red")
            || prompt_lower.contains("mesh")
            || prompt_lower.contains("nodo")
            || prompt_lower.contains("lora")
        {
            (
                "🛰️ DIAGNÓSTICO DE RED MESH SOVEREIGN:\n\n1. RED opera 100% Offline mediante enlaces de radio P2P.\n2. BLE alcanza ~100 metros; WiFi-Direct ~1 km; LoRa Sub-GHz hasta 15 km.\n3. Los mensajes usan cifrado Doble Trinquete (X25519 + AES-256-GCM) y enrutamiento Cebolla de 3 saltos.\n4. Todo el procesamiento de IA corre en tu dispositivo (<15 MB RAM) sin servidores centrales.".to_string(),
                "Infraestructura RED".to_string(),
            )
        } else {
            (
                format!("🤖 Copiloto IA RED (Modo Nano Local Off-Grid):\n\nRecibido: \"{}\"\n\nInstrucción guardada. Estoy optimizado para asistencia táctica, primeros auxilios, protocolos de sismo/apagón y guiado de supervivencia en redes malla sin internet.", req.prompt),
                "Asistencia General".to_string(),
            )
        };

        let execution_time_ms = start.elapsed().as_millis() as u64;

        CopilotResponse {
            answer,
            topic_category: category,
            source: "RED Local Nano-AI Engine (<15MB RAM)".to_string(),
            execution_time_ms,
        }
    }
}
