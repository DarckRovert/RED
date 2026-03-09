//! Ejemplo de conexión a la red RED
//!
//! Este ejemplo muestra cómo:
//! 1. Configurar un nodo
//! 2. Conectarse a la red P2P
//! 3. Enviar mensajes a través de onion routing

use red_core::identity::Identity;
use red_core::network::{NetworkConfig, Node};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Inicializar logging
    tracing_subscriber::fmt::init();

    println!("=== RED Network Demo ===");
    println!();

    // 1. Generar identidad
    println!("Generando identidad...");
    let identity = Identity::generate()?;
    println!("ID: {}", hex::encode(&identity.identity_hash().as_bytes()[..8]));

    // 2. Configurar red
    let config = NetworkConfig {
        listen_port: 9000,
        bootstrap_nodes: vec![
            // Nodos de bootstrap (ejemplo)
            // "node1.red.network:9000".to_string(),
            // "node2.red.network:9000".to_string(),
        ],
        max_peers: 50,
        onion_hops: 3,
        enable_relay: true,
        dummy_traffic_interval: Duration::from_secs(30),
    };

    println!();
    println!("Configuración de red:");
    println!("  - Puerto: {}", config.listen_port);
    println!("  - Saltos onion: {}", config.onion_hops);
    println!("  - Máx peers: {}", config.max_peers);

    // 3. Crear nodo
    println!();
    println!("Creando nodo...");
    let mut node = Node::new(identity.clone(), config)?;

    // 4. Iniciar nodo
    println!("Iniciando nodo...");
    node.start().await?;
    println!("Nodo iniciado en puerto 9000");

    // 5. Esperar conexiones
    println!();
    println!("Esperando conexiones de peers...");
    println!("(En producción, se conectaría a nodos bootstrap)");

    // Simular espera
    tokio::time::sleep(Duration::from_secs(2)).await;

    // 6. Mostrar peers conectados
    let peers = node.peers();
    println!();
    println!("Peers conectados: {}", peers.len());
    for peer in &peers {
        println!("  - {}", hex::encode(&peer.identity_hash[..8]));
    }

    // 7. Enviar mensaje (ejemplo)
    println!();
    println!("=== Envío de Mensaje ===");
    println!("Para enviar un mensaje:");
    println!();
    println!("  let recipient_hash = [...]; // Hash de identidad del destinatario");
    println!("  let message = b\"Hola!\";");
    println!("  node.send_message(&recipient_hash, message).await?;");
    println!();
    println!("El mensaje será enrutado a través de {} nodos intermedios.", 3);

    // 8. Recibir mensajes
    println!();
    println!("=== Recepción de Mensajes ===");
    println!("Para recibir mensajes:");
    println!();
    println!("  let messages = node.receive_messages().await?;");
    println!("  for msg in messages {{");
    println!("      println!(\"Mensaje: {{}}\", msg);");
    println!("  }}");

    // 9. Detener nodo
    println!();
    println!("Deteniendo nodo...");
    node.stop().await?;
    println!("Nodo detenido.");

    println!();
    println!("=== Demo completada ===");

    Ok(())
}
