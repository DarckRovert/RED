use criterion::{black_box, criterion_group, criterion_main, Criterion};
use red_core::identity::Identity;
use red_core::network::gossip::GossipProtocol;

fn bench_gossip_broadcast_packetization(c: &mut Criterion) {
    let alice = Identity::generate().unwrap();
    let origin_hash = Some(*alice.identity_hash().as_bytes());
    let mut protocol = GossipProtocol::with_defaults();
    let payload = b"Tactical packet benchmark payload 256 bytes".to_vec();

    c.bench_function("gossip_broadcast_packetize", |b| {
        b.iter(|| {
            protocol.broadcast(black_box(payload.clone()), black_box(origin_hash))
        });
    });
}

criterion_group!(
    mesh_benches,
    bench_gossip_broadcast_packetization
);
criterion_main!(mesh_benches);
