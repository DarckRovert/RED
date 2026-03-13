//! Ejemplo básico de mensajería con RED
//!
//! Este ejemplo muestra cómo:
//! 1. Generar identidades
//! 2. Establecer una sesión segura
//! 3. Intercambiar mensajes cifrados

use red_core::identity::Identity;
use red_core::protocol::Conversation;
use red_core::crypto::ratchet::DoubleRatchet;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== RED Messaging Example ===");
    println!();

    // 1. Alice genera su identidad
    println!("[Alice] Generando identidad...");
    let alice_identity = Identity::generate()?;
    println!("[Alice] ID: {:?}", hex::encode(&alice_identity.identity_hash().as_bytes()[..8]));

    // 2. Bob genera su identidad
    println!("[Bob] Generando identidad...");
    let bob_identity = Identity::generate()?;
    println!("[Bob] ID: {:?}", hex::encode(&bob_identity.identity_hash().as_bytes()[..8]));

    // 3. Intercambio de claves públicas (fuera de banda)
    println!();
    println!("--- Intercambio de claves públicas ---");
    let alice_pk = alice_identity.public_key();
    let bob_pk = bob_identity.public_key();

    // 4. Alice inicia conversación con Bob
    println!();
    println!("[Alice] Iniciando conversación con Bob...");
    let mut alice_conv = Conversation::new(
        alice_identity.clone(),
        bob_pk,
    )?;

    // 5. Bob acepta conversación de Alice
    println!("[Bob] Aceptando conversación de Alice...");
    let mut bob_conv = Conversation::new(
        bob_identity.clone(),
        alice_pk,
    )?;

    // 6. Alice envía mensaje
    println!();
    println!("[Alice] Enviando: 'Hola Bob! ¿Cómo estás?'");
    let msg1 = b"Hola Bob! Como estas?";
    let encrypted1 = alice_conv.send(msg1)?;
    println!("[Alice] Mensaje cifrado: {} bytes", encrypted1.len());

    // 7. Bob recibe y descifra
    let decrypted1 = bob_conv.receive(&encrypted1)?;
    println!("[Bob] Mensaje recibido: '{}'", String::from_utf8_lossy(&decrypted1));

    // 8. Bob responde
    println!();
    println!("[Bob] Enviando: 'Hola Alice! Muy bien, gracias!'");
    let msg2 = b"Hola Alice! Muy bien, gracias!";
    let encrypted2 = bob_conv.send(msg2)?;
    println!("[Bob] Mensaje cifrado: {} bytes", encrypted2.len());

    // 9. Alice recibe respuesta
    let decrypted2 = alice_conv.receive(&encrypted2)?;
    println!("[Alice] Mensaje recibido: '{}'", String::from_utf8_lossy(&decrypted2));

    // 10. Demostrar forward secrecy
    println!();
    println!("=== Forward Secrecy ===");
    println!("Cada mensaje usa una clave única derivada del ratchet.");
    println!("Comprometer una clave no afecta mensajes anteriores.");

    // 11. Rotación de identidad
    println!();
    println!("=== Rotación de Identidad ===");
    let alice_new = alice_identity.rotate()?;
    println!("[Alice] Nueva identidad: {:?}", hex::encode(&alice_new.identity_hash().as_bytes()[..8]));
    println!("[Alice] La nueva identidad no está vinculada a la anterior.");

    println!();
    println!("=== Ejemplo completado ===");

    Ok(())
}
