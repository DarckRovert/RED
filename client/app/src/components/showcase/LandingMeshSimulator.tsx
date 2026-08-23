import React, { useState } from 'react';

export const LandingMeshSimulator: React.FC = () => {
    const [simMessage, setSimMessage] = useState("COORD -12.045, -77.031 • PATRULLA EN POSICIÓN");
    const [isPacketInFlight, setIsPacketInFlight] = useState(false);
    const [transitPacketHex, setTransitPacketHex] = useState<string | null>(null);
    const [tabletInbox, setTabletInbox] = useState<Array<{ id: string; sender: string; text: string; time: string; pqcSig: string }>>([
        {
            id: "m-1",
            sender: "Moto G22 (did:red:7F3A...)",
            text: "Baliza táctica activa en sector 4. Enlace LoRa establecido a 915 MHz.",
            time: "14:22:01",
            pqcSig: "ML-KEM-768/0xA82F..."
        }
    ]);

    const transmitDualMeshPacket = () => {
        if (!simMessage.trim() || isPacketInFlight) return;
        setIsPacketInFlight(true);

        const randBuf = new Uint8Array(8);
        if (typeof window !== "undefined" && window.crypto) {
            window.crypto.getRandomValues(randBuf);
        }
        const hex = Array.from(randBuf, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        setTransitPacketHex(`0x${hex}A73C99F1`);

        setTimeout(() => {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

            setTabletInbox((prev) => [
                {
                    id: `m-${Date.now()}`,
                    sender: "Moto G22 (did:red:7F3A...)",
                    text: simMessage,
                    time: timeStr,
                    pqcSig: `ML-KEM-768/0x${hex}...`
                },
                ...prev
            ]);
            setIsPacketInFlight(false);
            setTransitPacketHex(null);
        }, 900);
    };

    return (
        <section id="live-mesh-demo" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(0, 240, 255, 0.15)",
                color: "#00F0FF",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              SIMULACIÓN DUAL EN TIEMPO REAL • ZERO-SERVER
            </span>
            <h2 style={{ fontSize: "36px", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px" }}>
              Prueba Interactiva: Moto G22 ↔ Tablet Lenovo
            </h2>
            <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
              Transmite un paquete cifrado desde el terminal emisor y observa la encapsulación cuántica, el salto de radio en la malla y la recepción instantánea en la tablet.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
              alignItems: "center",
              background: "rgba(15,23,42,0.8)",
              padding: "30px",
              borderRadius: "24px",
              border: "1px solid rgba(0, 240, 255, 0.3)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
            }}
          >
            {/* Device A: Motorola Moto G22 */}
            <div style={{ padding: "20px", borderRadius: "18px", background: "rgba(3,5,8,0.9)", border: "1px solid rgba(255, 42, 81, 0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>📱</span>
                  <div>
                    <div style={{ fontWeight: 800, color: "#FFF", fontSize: "14px" }}>Motorola Moto G22</div>
                    <div style={{ fontSize: "10px", color: "#FF2A51", fontFamily: "monospace" }}>NODO EMISOR (BLE 5.3 GATT)</div>
                  </div>
                </div>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF88", boxShadow: "0 0 8px #00FF88" }} />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "6px", display: "block" }}>Mensaje Táctico de Radio:</label>
                <input
                  type="text"
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "rgba(30,41,59,0.8)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#FFF",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <button
                onClick={transmitDualMeshPacket}
                disabled={isPacketInFlight}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "10px",
                  background: isPacketInFlight ? "#64748B" : "linear-gradient(90deg, #FF2A51 0%, #990014 100%)",
                  color: "#FFF",
                  fontWeight: 800,
                  fontSize: "13px",
                  border: "none",
                  cursor: isPacketInFlight ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 15px rgba(255, 42, 81, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {isPacketInFlight ? "📡 Transmitiendo por Salto BLE..." : "⚡ Transmitir Paquete Cifrado P2P"}
              </button>
            </div>

            {/* In-Flight Mesh Packet Animation */}
            <div style={{ textAlign: "center", padding: "10px" }}>
              <div style={{ fontSize: "11px", color: "#00F0FF", fontFamily: "monospace", fontWeight: 700, marginBottom: "8px" }}>
                {isPacketInFlight ? "⚡ PAQUETE EN TRÁNSITO POR LA MALLA" : "ENLACE LIBP2P LISTO"}
              </div>
              <div
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  background: "rgba(0,0,0,0.6)",
                  border: isPacketInFlight ? "1px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: isPacketInFlight ? "#00FF88" : "#64748B",
                  wordBreak: "break-all",
                }}
              >
                {transitPacketHex ? `PAYLOAD: ${transitPacketHex} (ML-KEM-768)` : "Esperando emisión..."}
              </div>
              <div style={{ fontSize: "10px", color: "#94A3B8", marginTop: "6px" }}>
                Latencia de Salto: <span style={{ color: "#00FF88", fontWeight: 700 }}>18 ms</span> | Cifrado: Double Ratchet
              </div>
            </div>

            {/* Device B: Lenovo Tab */}
            <div style={{ padding: "20px", borderRadius: "18px", background: "rgba(3,5,8,0.9)", border: "1px solid rgba(0, 255, 136, 0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>📟</span>
                  <div>
                    <div style={{ fontWeight: 800, color: "#FFF", fontSize: "14px" }}>Tablet Lenovo Tab</div>
                    <div style={{ fontSize: "10px", color: "#00FF88", fontFamily: "monospace" }}>NODO RECEPTOR (WiFi Direct)</div>
                  </div>
                </div>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF88", boxShadow: "0 0 8px #00FF88" }} />
              </div>

              <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {tabletInbox.map((msg) => (
                  <div key={msg.id} style={{ padding: "10px", borderRadius: "8px", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#94A3B8", marginBottom: "4px" }}>
                      <span style={{ color: "#00F0FF" }}>{msg.sender}</span>
                      <span>{msg.time}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#FFF", fontWeight: 600 }}>{msg.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
    );
};
