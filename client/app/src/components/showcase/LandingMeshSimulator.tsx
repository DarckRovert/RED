'use client';

import React, { useState } from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';

export const LandingMeshSimulator: React.FC = () => {
    const { t } = useTranslation();
    const [simMessage, setSimMessage] = useState("🚨 COORD -12.045, -77.031 • CUADRILLA DE RESCATE EN POSICIÓN");
    const [selectedBand, setSelectedBand] = useState<"ble" | "lora" | "sound">("lora");
    const [isPacketInFlight, setIsPacketInFlight] = useState(false);
    const [transitPacketHex, setTransitPacketHex] = useState<string | null>(null);
    const [packetStep, setPacketStep] = useState<number>(0);
    const [tabletInbox, setTabletInbox] = useState<Array<{ id: string; sender: string; text: string; time: string; pqcSig: string; band: string; latency: string }>>([
        {
            id: "m-1",
            sender: "Moto G22 (did:red:7F3A91BC...)",
            text: "Baliza táctica activa en sector 4. Enlace LoRa establecido a 915 MHz.",
            time: "14:22:01",
            pqcSig: "ML-KEM-768/0xA82F991C",
            band: "LoRa 915 MHz",
            latency: "24 ms"
        }
    ]);

    const presets = [
        { label: "🚨 Evacuación Sismo", text: "ALERTA SÍSMICA GRADO 8.1 • EVACUAR A ZONA SEGURA N° 4" },
        { label: "⛏️ Derrumbe Socavón", text: "DERRUMBE NIVEL -420 • CUADRILLA ACTIVANDO BALIZAS OFF-GRID" },
        { label: "🫀 Triaje Rojo", text: "TRIAJE START: 3 VÍCTIMAS ROJAS • REQUIERE OXÍGENO URGENTE" },
        { label: "📍 Coordenadas GPS", text: "PUESTO DE MANDO AVANZADO FIJADO EN -11.9842, -76.8831" }
    ];

    const transmitDualMeshPacket = () => {
        if (!simMessage.trim() || isPacketInFlight) return;
        setIsPacketInFlight(true);
        setPacketStep(1);

        const randBuf = new Uint8Array(12);
        if (typeof window !== "undefined" && window.crypto) {
            window.crypto.getRandomValues(randBuf);
        }
        const hex = Array.from(randBuf, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        setTransitPacketHex(`0x${hex}`);

        // Step 1: Encapsulation (0ms -> 300ms)
        setTimeout(() => setPacketStep(2), 300);

        // Step 2: RF Air Hop (300ms -> 600ms)
        setTimeout(() => setPacketStep(3), 600);

        // Step 3: Delivery to Tablet (900ms)
        setTimeout(() => {
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
            const latencyStr = selectedBand === "ble" ? "14 ms" : selectedBand === "lora" ? "32 ms" : "410 ms";

            setTabletInbox((prev) => [
                {
                    id: `m-${Date.now()}`,
                    sender: "Moto G22 (did:red:7F3A91BC...)",
                    text: simMessage,
                    time: timeStr,
                    pqcSig: `ML-KEM-768/0x${hex.slice(0, 10)}...`,
                    band: selectedBand === "ble" ? "BLE 5.3 GATT" : selectedBand === "lora" ? "LoRa 915 MHz" : "SoundMesh Acústico",
                    latency: latencyStr
                },
                ...prev
            ]);
            setIsPacketInFlight(false);
            setPacketStep(0);
            setTransitPacketHex(null);
        }, 950);
    };

    return (
        <section id="live-mesh-demo" style={{ padding: "70px 0 80px", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "5px 14px",
                borderRadius: "20px",
                background: "rgba(0, 240, 255, 0.12)",
                color: "#00F0FF",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 800,
                letterSpacing: "1px"
              }}
            >
              BANCO DE PRUEBAS TÁCTICO • DEMO EN VIVO
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#FFF", marginTop: "14px", marginBottom: "12px", letterSpacing: "-0.5px" }}>
              Simulador de Enlace P2P entre Dispositivos Reales
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "820px", margin: "0 auto", lineHeight: 1.6 }}>
              Experimenta el viaje de una trama cifrada desde un smartphone emisor hasta una tablet receptora. Observa el salto físico de radiofrecuencia sin intermediarios ni conexión a Internet.
            </p>
          </div>

          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px" }}>
            {/* Quick Template Chips */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginBottom: "24px" }}>
                <span style={{ fontSize: "12px", color: "#64748B", alignSelf: "center", fontFamily: "JetBrains Mono, monospace" }}>Plantillas de Emergencia:</span>
                {presets.map((p, idx) => (
                    <button
                        key={idx}
                        onClick={() => setSimMessage(p.text)}
                        style={{
                            padding: "6px 14px", borderRadius: "10px",
                            background: "rgba(14, 18, 34, 0.7)", border: "1px solid rgba(255,255,255,0.1)",
                            color: "#CBD5E1", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                            transition: "all 0.2s ease"
                        }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Main Interactive Dual-Device Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 0.8fr 1.1fr",
                gap: "20px",
                alignItems: "stretch",
              }}
              className="mesh-sim-grid"
            >
              {/* Device A: Motorola Moto G22 (Emisor) */}
              <div style={{
                  padding: "26px", borderRadius: "20px",
                  background: "linear-gradient(180deg, rgba(14, 18, 34, 0.95) 0%, rgba(8, 10, 20, 0.98) 100%)",
                  border: "1.5px solid rgba(255, 51, 85, 0.4)",
                  boxShadow: "0 15px 40px rgba(0,0,0,0.7), 0 0 30px rgba(255,51,85,0.1)",
                  display: "flex", flexDirection: "column", justifyContent: "space-between"
              }}>
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "10px", background: "rgba(255,51,85,0.15)", border: "1px solid rgba(255,51,85,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                          📱
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, color: "#FFF", fontSize: "14px" }}>Motorola Moto G22</div>
                          <div style={{ fontSize: "10px", color: "#FF3355", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>NODO EMISOR SOBERANO</div>
                        </div>
                      </div>
                      <span style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "8px", background: "rgba(0, 230, 118, 0.15)", color: "#00E676", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                        RSSI: -58 dBm
                      </span>
                    </div>

                    {/* Radio Carrier Selector */}
                    <div style={{ marginBottom: "14px" }}>
                        <label style={{ fontSize: "11px", color: "#94A3B8", display: "block", marginBottom: "6px", fontFamily: "JetBrains Mono, monospace" }}>MEDIO FÍSICO DE TRANSMISIÓN:</label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                            {[
                                { id: "lora", label: "📡 LoRa 915M", sub: "15–25 km" },
                                { id: "ble", label: "📶 BLE 5.3", sub: "100 m" },
                                { id: "sound", label: "🔊 SoundMesh", sub: "20 m Acústico" },
                            ].map(b => (
                                <button
                                    key={b.id}
                                    onClick={() => setSelectedBand(b.id as any)}
                                    style={{
                                        padding: "8px 4px", borderRadius: "8px",
                                        background: selectedBand === b.id ? "rgba(0, 229, 255, 0.2)" : "rgba(0,0,0,0.4)",
                                        border: selectedBand === b.id ? "1.5px solid #00E5FF" : "1px solid rgba(255,255,255,0.08)",
                                        color: selectedBand === b.id ? "#FFF" : "#94A3B8",
                                        fontSize: "11px", fontWeight: 800, cursor: "pointer", textAlign: "center"
                                    }}
                                >
                                    <div>{b.label}</div>
                                    <div style={{ fontSize: "9px", color: selectedBand === b.id ? "#00E5FF" : "#64748B" }}>{b.sub}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "6px", display: "block", fontFamily: "JetBrains Mono, monospace" }}>PAYLOAD TÁCTICO DE TEXTO:</label>
                      <textarea
                        value={simMessage}
                        onChange={(e) => setSimMessage(e.target.value)}
                        rows={3}
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: "12px",
                          background: "rgba(0,0,0,0.6)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#FFF",
                          fontSize: "13px",
                          outline: "none",
                          resize: "none",
                          fontFamily: "inherit"
                        }}
                      />
                    </div>
                </div>

                <button
                  onClick={transmitDualMeshPacket}
                  disabled={isPacketInFlight}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    background: isPacketInFlight ? "rgba(100,116,139,0.5)" : "linear-gradient(135deg, #FF3355 0%, #C41230 100%)",
                    color: "#FFF",
                    fontWeight: 900,
                    fontSize: "13px",
                    border: "none",
                    cursor: isPacketInFlight ? "not-allowed" : "pointer",
                    boxShadow: isPacketInFlight ? "none" : "0 4px 20px rgba(255, 51, 85, 0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {isPacketInFlight ? "📡 Transmitiendo por Salto de Radio..." : "⚡ Transmitir Trama Cifrada P2P"}
                </button>
              </div>

              {/* Center Column: Air Hop & Frame Inspector */}
              <div style={{
                  padding: "20px", borderRadius: "20px",
                  background: "rgba(4, 7, 14, 0.95)",
                  border: "1.5px solid rgba(0, 229, 255, 0.3)",
                  boxShadow: "0 15px 40px rgba(0,0,0,0.8)",
                  display: "flex", flexDirection: "column",
                  justifyContent: "space-between", gap: "14px",
                  textAlign: "center"
              }}>
                <div style={{ fontSize: "11px", color: "#00E5FF", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                  CANAL AÉREO RF • MULTI-HOP
                </div>

                {/* Animated Packet Flight Indicator */}
                <div style={{
                    padding: "16px 12px", borderRadius: "14px",
                    background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", flexDirection: "column", gap: "8px"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>
                        <span>EMISIÓN</span>
                        <span>SALTO EN MALLA</span>
                        <span>RECEPCIÓN</span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: "6px", width: "100%", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{
                            height: "100%",
                            width: packetStep === 1 ? "33%" : packetStep === 2 ? "66%" : packetStep === 3 ? "100%" : "0%",
                            background: "linear-gradient(90deg, #FF3355 0%, #00E5FF 50%, #00E676 100%)",
                            transition: "width 0.3s ease"
                        }} />
                    </div>

                    <div style={{ fontSize: "11px", color: isPacketInFlight ? "#00FF88" : "#94A3B8", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                        {packetStep === 1 && "🔐 Encapsulando ML-KEM-768..."}
                        {packetStep === 2 && `📡 Retransmisión por ${selectedBand.toUpperCase()}...`}
                        {packetStep === 3 && "✅ Descifrado en Destino"}
                        {packetStep === 0 && "● Canal Libre a la Espera"}
                    </div>
                </div>

                {/* Packet Hex Dump */}
                <div style={{
                    padding: "12px", borderRadius: "12px",
                    background: "rgba(0,0,0,0.8)", border: "1px solid rgba(0, 229, 255, 0.2)",
                    textAlign: "left"
                }}>
                    <div style={{ fontSize: "9px", color: "#64748B", fontFamily: "JetBrains Mono, monospace", marginBottom: "4px" }}>
                        TRAMA BINARIA EN EL AIRE:
                    </div>
                    <div style={{ fontSize: "10px", color: isPacketInFlight ? "#00E5FF" : "#475569", fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all", lineHeight: 1.4 }}>
                        {transitPacketHex ? `${transitPacketHex} (ML-KEM-768 + AES-GCM + Poly1305)` : "0x0000000000000000 (SILENCIO DE RADIO)"}
                    </div>
                </div>

                <div style={{ fontSize: "11px", color: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }}>
                    Cero Intermediarios Cloud • Cero Rastro
                </div>
              </div>

              {/* Device B: Lenovo Tab (Receptor) */}
              <div style={{
                  padding: "26px", borderRadius: "20px",
                  background: "linear-gradient(180deg, rgba(14, 18, 34, 0.95) 0%, rgba(8, 10, 20, 0.98) 100%)",
                  border: "1.5px solid rgba(0, 230, 118, 0.4)",
                  boxShadow: "0 15px 40px rgba(0,0,0,0.7), 0 0 30px rgba(0,230,118,0.1)",
                  display: "flex", flexDirection: "column", justifyContent: "space-between"
              }}>
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "10px", background: "rgba(0,230,118,0.15)", border: "1px solid rgba(0,230,118,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                          📟
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, color: "#FFF", fontSize: "14px" }}>Tablet Lenovo Tab</div>
                          <div style={{ fontSize: "10px", color: "#00E676", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>NODO RECEPTOR & BASE DE MANDO</div>
                        </div>
                      </div>
                      <span style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "8px", background: "rgba(0, 230, 118, 0.15)", color: "#00E676", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                        ● SINCRONIZADO
                      </span>
                    </div>

                    <div style={{ fontSize: "11px", color: "#94A3B8", marginBottom: "8px", fontFamily: "JetBrains Mono, monospace" }}>
                        BANDEJA DE RECEPCIÓN LOCAL (MEMORIA RAM):
                    </div>

                    <div style={{ maxHeight: "210px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {tabletInbox.map((msg) => (
                        <div key={msg.id} style={{
                            padding: "12px", borderRadius: "12px",
                            background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)",
                            display: "flex", flexDirection: "column", gap: "6px"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>
                            <span style={{ color: "#00E5FF", fontWeight: 700 }}>{msg.sender}</span>
                            <span>{msg.time} ({msg.latency})</span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#FFF", fontWeight: 700, lineHeight: 1.4 }}>{msg.text}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", fontFamily: "JetBrains Mono, monospace", color: "#00E676" }}>
                            <span>✓ {msg.pqcSig}</span>
                            <span style={{ color: "#FFB300" }}>{msg.band}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                </div>

                <div style={{
                    marginTop: "14px", padding: "8px 12px", borderRadius: "10px",
                    background: "rgba(0,230,118,0.1)", border: "1px solid rgba(0,230,118,0.25)",
                    fontSize: "11px", color: "#00E676", fontFamily: "JetBrains Mono, monospace", textAlign: "center"
                }}>
                    🔒 Integridad Criptográfica Verificada: Cero Falsificación
                </div>
              </div>
            </div>
          </div>
        </section>
    );
};
