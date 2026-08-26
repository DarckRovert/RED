//! Suite de Pruebas de Integración E2E para Red Malla (Mesh Resilience & Multi-Hop)
//!
//! Pruebas de integración de la red malla RED:
//! Simula escenarios de Gossipsub epidémico, deduplicación de paquetes,
//! retransmisión multi-salto y aislamiento/recuperación de nodos en RED v64.0.0.

use red_core::identity::Identity;
use red_core::network::gossip::{GossipMessage, GossipProtocol, ReceiveResult};

#[test]
fn test_two_node_direct_message_exchange() {
    let alice = Identity::generate().expect("Alice identity");

    let mut alice_gossip = GossipProtocol::with_defaults();
    let mut bob_gossip = GossipProtocol::with_defaults();

    // Alice origina un mensaje en la malla
    let payload = b"Tactical direct mesh ping from Alice".to_vec();
    let origin_hash = Some(*alice.identity_hash().as_bytes());

    let _msg_id = alice_gossip.broadcast(payload.clone(), origin_hash);
    let outbound_msg = alice_gossip.next_outbound().expect("Outbound message");

    // Bob recibe el paquete
    let receive_res = bob_gossip.receive(outbound_msg.clone());
    assert_eq!(receive_res, ReceiveResult::AcceptedAndForward, "Bob debe aceptar el mensaje como nuevo y listo para reenvío");
    assert_eq!(bob_gossip.stats().messages_received, 1);

    // Intento de reenvío duplicado (anti-replay)
    let dup_res = bob_gossip.receive(outbound_msg);
    assert_eq!(dup_res, ReceiveResult::Duplicate, "El protocolo debe descartar duplicados");
    assert_eq!(bob_gossip.stats().duplicates_filtered, 1);
}

#[test]
fn test_three_node_multi_hop_relay() {
    // Topología lineal: Alice (A) -> Relay Bob (B) -> Charlie (C)
    let alice = Identity::generate().unwrap();
    let mut alice_gossip = GossipProtocol::with_defaults();
    let mut relay_gossip = GossipProtocol::with_defaults();
    let mut charlie_gossip = GossipProtocol::with_defaults();

    let payload = b"Multi-hop tactical broadcast A->B->C".to_vec();
    let _msg_id = alice_gossip.broadcast(payload, Some(*alice.identity_hash().as_bytes()));
    let alice_msg = alice_gossip.next_outbound().unwrap();

    // 1. Relay Bob recibe el paquete de Alice y lo procesa
    let relay_res = relay_gossip.receive(alice_msg);
    assert_eq!(relay_res, ReceiveResult::AcceptedAndForward);

    // 2. Relay Bob obtiene el paquete reenviado con TTL decrementado
    let forwarded_msg = relay_gossip.next_outbound().expect("Forwarded message");
    assert!(forwarded_msg.ttl < 10);

    // 3. Charlie recibe finalmente el paquete retransmitido por Bob
    let charlie_res = charlie_gossip.receive(forwarded_msg);
    assert_eq!(charlie_res, ReceiveResult::AcceptedAndForward, "Charlie debe recibir el paquete a través del repetidor");
}

#[test]
fn test_ttl_zero_dropped_at_forwarding() {
    let mut gossip = GossipProtocol::with_defaults();
    let payload = b"Zero TTL test message".to_vec();

    // Crear mensaje con TTL = 0 directamente
    let dead_message = GossipMessage::new(payload, 0, None);
    assert!(dead_message.forward().is_none(), "Un mensaje con TTL = 0 no puede ser reenviado");

    let res = gossip.receive(dead_message);
    assert_eq!(res, ReceiveResult::Accepted, "Se entrega localmente pero no se reenvía");
    assert!(gossip.next_outbound().is_none(), "No debe haber mensaje en cola de retransmisión");
}

#[test]
fn test_network_partition_recovery_simulation() {
    let alice = Identity::generate().unwrap();
    let mut alice_gossip = GossipProtocol::with_defaults();
    let mut bob_gossip = GossipProtocol::with_defaults();

    // Mensaje 1 antes de partición
    alice_gossip.broadcast(b"Msg 1 before partition".to_vec(), Some(*alice.identity_hash().as_bytes()));
    let pkt1 = alice_gossip.next_outbound().unwrap();
    assert_eq!(bob_gossip.receive(pkt1), ReceiveResult::AcceptedAndForward);

    // Mensaje 2 encolado durante partición física
    alice_gossip.broadcast(b"Msg 2 queued during partition".to_vec(), Some(*alice.identity_hash().as_bytes()));
    let pkt2 = alice_gossip.next_outbound().unwrap();

    // Tras la reconexión de los nodos, Bob recibe el paquete acumulado
    assert_eq!(bob_gossip.receive(pkt2), ReceiveResult::AcceptedAndForward);
    assert_eq!(bob_gossip.stats().messages_received, 2);
}
