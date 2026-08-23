import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';

export const LandingInteractiveLabs: React.FC = () => {
    const { t } = useTranslation();
    const [customPacketPayload, setCustomPacketPayload] = useState("ALERTA EVACUACIÓN ZONA NORTE");
    const [packetTtl, setPacketTtl] = useState(7);

    const [soundMode, setSoundMode] = useState<"audible" | "ultrasound">("audible");
    const [soundPayloadText, setSoundPayloadText] = useState("SOS COORD -12.045, -77.031");
    const [isTransmittingAudio, setIsTransmittingAudio] = useState(false);
    const [soundLog, setSoundLog] = useState<string>("> Módem acústico listo. Presiona 'Transmitir Trama FSK' para iniciar oscilador.");
    const oscilloscopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    const [pqcAlgorithm, setPqcAlgorithm] = useState<"kyber" | "rsa" | "ecc">("kyber");
    const [pqcSimLog, setPqcSimLog] = useState<string[]>([
        "> [INIT] Inicializando retículos algebraicos ML-KEM-768...",
        "> [ENTROPÍA] Semilla CSPRNG cargada (32 bytes)...",
        "> [ESTADO] Listo para derivación de claves post-cuánticas."
    ]);
    const [pqcEntropySeed, setPqcEntropySeed] = useState<string>("0x8F1A29D84C20E76B");

    const [canWalk, setCanWalk] = useState<boolean | null>(null);
    const [respiration, setRespiration] = useState<"none" | "over30" | "normal" | null>(null);
    const [radialPulse, setRadialPulse] = useState<"absent" | "present" | null>(null);
    const [mentalStatus, setMentalStatus] = useState<"obeys" | "confused" | null>(null);
    const [triageResult, setTriageResult] = useState<{ color: string; tag: string; priority: string; action: string } | null>(null);

    const [simConsentStep, setSimConsentStep] = useState<"idle" | "incoming" | "accepted" | "rejected" | "blocked">("idle");
    const [simPeerHash, setSimPeerHash] = useState("7F3A91BC2E844D0F81E73A6B");
    const [simPeerAlias, setSimPeerAlias] = useState("Operador_Patrulla_07");
    const [simLog, setSimLog] = useState<string[]>([
        "> [SISTEMA] Motor de consentimiento Zero-Trust activo.",
        "> [POLÍTICA] Todo contacto entrante requiere firma explícita del usuario.",
        "> [ESTADO] Esperando solicitudes de emparejamiento..."
    ]);

    const [isBlackout, setIsBlackout] = useState(false);
    const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const playSoundMeshChirp = () => {
        if (typeof window === "undefined") return;
        try {
            setIsTransmittingAudio(true);
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            const baseFreq = soundMode === "audible" ? 2400 : 18500;
            const targetFreq = soundMode === "audible" ? 3400 : 20500;

            osc.type = "sine";
            osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(targetFreq, ctx.currentTime + 0.4);

            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

            osc.connect(gain);
            gain.connect(analyser);
            analyser.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.45);

            setSoundLog(`> [TX] Modulación FSK enviada: "${soundPayloadText}" (${soundMode === "audible" ? "2.4-3.4 kHz" : "18.5-20.5 kHz"}). Trama acústica emitida al canal aéreo.`);

            const canvas = oscilloscopeCanvasRef.current;
            if (canvas) {
                const cCtx = canvas.getContext("2d");
                if (cCtx) {
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);

                    let animId: number;
                    const draw = () => {
                        animId = requestAnimationFrame(draw);
                        analyser.getByteTimeDomainData(dataArray);

                        cCtx.fillStyle = "rgba(5, 7, 13, 0.3)";
                        cCtx.fillRect(0, 0, canvas.width, canvas.height);

                        cCtx.lineWidth = 2;
                        cCtx.strokeStyle = soundMode === "audible" ? "#FFB800" : "#00F0FF";
                        cCtx.beginPath();

                        const sliceWidth = (canvas.width * 1.0) / bufferLength;
                        let x = 0;

                        for (let i = 0; i < bufferLength; i++) {
                            const v = dataArray[i] / 128.0;
                            const y = (v * canvas.height) / 2;

                            if (i === 0) {
                                cCtx.moveTo(x, y);
                            } else {
                                cCtx.lineTo(x, y);
                            }
                            x += sliceWidth;
                        }

                        cCtx.lineTo(canvas.width, canvas.height / 2);
                        cCtx.stroke();
                    };
                    draw();

                    setTimeout(() => {
                        cancelAnimationFrame(animId);
                        setIsTransmittingAudio(false);
                    }, 600);
                }
            }
        } catch (err: any) {
            setIsTransmittingAudio(false);
            setSoundLog(`> Error Web Audio API: ${err?.message || "No disponible"}`);
        }
    };

    const refreshPqcEntropy = () => {
        const randBuf = new Uint8Array(16);
        if (typeof window !== "undefined" && window.crypto) {
            window.crypto.getRandomValues(randBuf);
        }
        const hex = Array.from(randBuf, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        setPqcEntropySeed(`0x${hex}`);
        setPqcSimLog([
            `> [ENTROPÍA RENOVADA] Semilla CSPRNG de 128 bits generada: 0x${hex}`,
            `> [ML-KEM-768] Encapsulando secreto compartido en retículo euclidiano de dimensión 768...`,
            `> [ÉPOCA SEGURA] Secreto derivado con HKDF-SHA256 (32 bytes). Inmune a ataques cuánticos retroactivos.`
        ]);
    };

    const evaluateTriage = (walk: boolean | null, resp: string | null, pulse: string | null, mental: string | null) => {
        if (walk === true) {
            setTriageResult({
                color: "#00E676",
                tag: "VERDE (LEVE)",
                priority: "Prioridad 3",
                action: "Evacuación secundaria. Lesiones que no comprometen la vida. Puede desplazarse por sus propios medios."
            });
            return;
        }
        if (resp === "none") {
            setTriageResult({
                color: "#9E9E9E",
                tag: "NEGRO (FALLECIDO/NO SALVABLE)",
                priority: "Sin prioridad",
                action: "Vía aérea abierta sin respuesta respiratoria espontánea. Recursos destinados a víctimas salvables."
            });
            return;
        }
        if (resp === "over30" || pulse === "absent" || mental === "confused") {
            setTriageResult({
                color: "#FF1744",
                tag: "ROJO (INMEDIATO)",
                priority: "Prioridad 1 — RIESGO VITAL",
                action: "Atención médica urgente en menos de 15 minutos. Hemostasia, manejo avanzado de vía aérea o descompresión torácica."
            });
            return;
        }
        if (walk === false && resp === "normal" && pulse === "present" && mental === "obeys") {
            setTriageResult({
                color: "#FFB800",
                tag: "AMARILLO (URGENTE)",
                priority: "Prioridad 2",
                action: "Atención médica en 1-2 horas. Monitoreo constante de signos vitales. No puede caminar pero responde comandos."
            });
            return;
        }
        setTriageResult(null);
    };

    // Radar Canvas Effect
    useEffect(() => {
        const canvas = radarCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animFrameId: number;
        let angle = 0;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;

        const blips = [
            { angle: 0.8, dist: 0.6, label: "MOTO-G22", active: true },
            { angle: 2.3, dist: 0.85, label: "TAB-LENOVO", active: true },
            { angle: 4.1, dist: 0.4, label: "RELAY-04", active: true },
            { angle: 5.4, dist: 0.7, label: "LORA-GATEWAY", active: true }
        ];

        const render = () => {
            ctx.fillStyle = "rgba(5, 7, 13, 0.15)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Anillos concéntricos
            ctx.strokeStyle = isBlackout ? "rgba(255, 23, 68, 0.3)" : "rgba(0, 240, 255, 0.25)";
            ctx.lineWidth = 1;

            for (let r = radius * 0.25; r <= radius; r += radius * 0.25) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Ejes
            ctx.beginPath();
            ctx.moveTo(centerX - radius, centerY);
            ctx.lineTo(centerX + radius, centerY);
            ctx.moveTo(centerX, centerY - radius);
            ctx.lineTo(centerX, centerY + radius);
            ctx.stroke();

            // Haz de barrido
            if (!isBlackout) {
                const sweepX = centerX + Math.cos(angle) * radius;
                const sweepY = centerY + Math.sin(angle) * radius;

                ctx.strokeStyle = "rgba(0, 240, 255, 0.8)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(sweepX, sweepY);
                ctx.stroke();

                // Blips de nodos detectados
                blips.forEach((blip) => {
                    const bx = centerX + Math.cos(blip.angle) * (radius * blip.dist);
                    const by = centerY + Math.sin(blip.angle) * (radius * blip.dist);

                    const diff = Math.abs(angle - blip.angle);
                    const isLit = diff < 0.2 || diff > Math.PI * 2 - 0.2;

                    ctx.fillStyle = isLit ? "#00F0FF" : "rgba(0, 240, 255, 0.4)";
                    ctx.beginPath();
                    ctx.arc(bx, by, isLit ? 4 : 2.5, 0, Math.PI * 2);
                    ctx.fill();

                    if (isLit) {
                        ctx.fillStyle = "#00F0FF";
                        ctx.font = "9px monospace";
                        ctx.fillText(blip.label, bx + 6, by - 4);
                    }
                });

                angle = (angle + 0.03) % (Math.PI * 2);
            } else {
                ctx.fillStyle = "#FF1744";
                ctx.font = "12px monospace";
                ctx.textAlign = "center";
                ctx.fillText("RADIO SILENCE / STEALTH", centerX, centerY);
            }

            animFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animFrameId);
    }, [isBlackout]);

    return (
        <>
        <section id="packet-inspector" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
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
              INGENIERÍA DE PROTOCOLO • SERIALIZACIÓN BINARIA
            </span>
            <h2 style={{ fontSize: "36px", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px" }}>
              Inspector Interactivo de Paquetes de Malla
            </h2>
            <p style={{ fontSize: "15px", color: "#94A3B8", maxWidth: "780px", margin: "0 auto", lineHeight: 1.6 }}>
              Desglose byte a byte de una trama física que viaja por radio BLE/LoRa con autenticación Poly1305.
            </p>
          </div>

          <div
            style={{
              maxWidth: "920px",
              margin: "0 auto",
              padding: "26px",
              borderRadius: "24px",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(0, 240, 255, 0.35)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8", display: "block", marginBottom: "4px" }}>Payload de Texto:</label>
                <input
                  type="text"
                  value={customPacketPayload}
                  onChange={(e) => setCustomPacketPayload(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: "rgba(30,41,59,0.8)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#FFF",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8", display: "block", marginBottom: "4px" }}>TTL Saltos:</label>
                <select
                  value={packetTtl}
                  onChange={(e) => setPacketTtl(Number(e.target.value))}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: "rgba(30,41,59,0.8)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#FFF",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  <option value={3}>3 Saltos</option>
                  <option value={7}>7 Saltos (Recomendado)</option>
                  <option value={15}>15 Saltos (Área Amplia)</option>
                </select>
              </div>
            </div>

            {/* Visual Byte Structure Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "20px" }}>
              <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(255, 42, 81, 0.15)", border: "1px solid #FF2A51", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#FF2A51", fontFamily: "monospace", fontWeight: 700 }}>MAGIC HEADER (3B)</div>
                <div style={{ fontSize: "13px", color: "#FFF", fontFamily: "monospace", marginTop: "4px" }}>0x524544 (RED)</div>
              </div>
              <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(0, 240, 255, 0.15)", border: "1px solid #00F0FF", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#00F0FF", fontFamily: "monospace", fontWeight: 700 }}>TTL HOPS (1B)</div>
                <div style={{ fontSize: "13px", color: "#FFF", fontFamily: "monospace", marginTop: "4px" }}>0x0{packetTtl}</div>
              </div>
              <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(176, 38, 255, 0.15)", border: "1px solid #B026FF", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#B026FF", fontFamily: "monospace", fontWeight: 700 }}>PQC EPHEMERAL (32B)</div>
                <div style={{ fontSize: "13px", color: "#FFF", fontFamily: "monospace", marginTop: "4px" }}>0x8F1A29D8...</div>
              </div>
              <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(255, 184, 0, 0.15)", border: "1px solid #FFB800", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#FFB800", fontFamily: "monospace", fontWeight: 700 }}>CIPHERTEXT ({customPacketPayload.length}B)</div>
                <div style={{ fontSize: "13px", color: "#FFF", fontFamily: "monospace", marginTop: "4px" }}>ChaCha20 AEAD</div>
              </div>
              <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(0, 255, 136, 0.15)", border: "1px solid #00FF88", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#00FF88", fontFamily: "monospace", fontWeight: 700 }}>MAC TAG (16B)</div>
                <div style={{ fontSize: "13px", color: "#FFF", fontFamily: "monospace", marginTop: "4px" }}>Poly1305 Auth</div>
              </div>
            </div>

            <div style={{ background: "#030508", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: "12px", color: "#00FF88", wordBreak: "break-all" }}>
              RAW FRAME: 52 45 44 0{packetTtl} 8F 1A 29 D8 4C 20 E7 6B 91 A2 3D 8E 5F 7C 1B 4A 90 D2 E6 F8 3C 1A 7B 5D ... [AES-POLY1305 SIGNATURE OK]
            </div>
          </div>
        </section>

        {/* 7. SOUNDMESH ACOUSTIC OSCILLOSCOPE LAB */}
        <section id="soundmesh" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(255, 184, 0, 0.15)",
                color: "#FFB800",
                border: "1px solid rgba(255, 184, 0, 0.3)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              LABORATORIO ACÚSTICO • WEB AUDIO API OSCILOSCOPIO
            </span>
            <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", marginTop: "10px", marginBottom: "8px" }}>
              Módem Ultrasónico SoundMesh & Vocoder DSP
            </h2>
            <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
              Transmite tramas de datos por el aire a través del altavoz a frecuencias inaudibles con visualización espectral en tiempo real.
            </p>
          </div>

          <div style={{ maxWidth: "860px", margin: "0 auto", padding: "24px", borderRadius: "20px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255, 184, 0, 0.35)" }}>
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <button
                onClick={() => setSoundMode("audible")}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "12px",
                  background: soundMode === "audible" ? "rgba(255, 184, 0, 0.2)" : "rgba(30,41,59,0.5)",
                  border: soundMode === "audible" ? "1px solid #FFB800" : "1px solid rgba(255,255,255,0.1)",
                  color: "#FFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                🔊 Modo Demostración Audible (2.4 - 3.4 kHz)
              </button>
              <button
                onClick={() => setSoundMode("ultrasound")}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "12px",
                  background: soundMode === "ultrasound" ? "rgba(0, 240, 255, 0.2)" : "rgba(30,41,59,0.5)",
                  border: soundMode === "ultrasound" ? "1px solid #00F0FF" : "1px solid rgba(255,255,255,0.1)",
                  color: "#FFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                🦇 Modo Ultrasónico Inaudible (18.5 - 20.5 kHz)
              </button>
            </div>

            <input
              type="text"
              placeholder="Escribe la trama de texto a codificar en señal sonora..."
              value={soundPayloadText}
              onChange={(e) => setSoundPayloadText(e.target.value)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                background: "rgba(30,41,59,0.8)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#FFF",
                fontSize: "14px",
                marginBottom: "16px",
                outline: "none",
              }}
            />

            <div style={{ width: "100%", height: "140px", background: "#030508", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: "16px" }}>
              <canvas ref={oscilloscopeCanvasRef} width={800} height={140} style={{ width: "100%", height: "100%", display: "block" }} />
            </div>

            <button
              onClick={playSoundMeshChirp}
              disabled={isTransmittingAudio}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                background: isTransmittingAudio ? "#00FF88" : "linear-gradient(90deg, #FFB800 0%, #D97706 100%)",
                color: isTransmittingAudio ? "#000" : "#FFF",
                fontWeight: 900,
                fontSize: "14px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(255, 184, 0, 0.4)",
                marginBottom: "16px",
              }}
            >
              {isTransmittingAudio ? "📡 Emitiendo Señal FSK en el Osciloscopio..." : "▶️ Sintetizar y Transmitir Trama FSK por el Aire"}
            </button>

            <div style={{ background: "#030508", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: "12px", color: "#FFB800" }}>
              {soundLog}
            </div>
          </div>
        </section>

        {/* 8. POST-QUANTUM LAB */}
        <section id="pqc-lab" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(176, 38, 255, 0.15)",
                color: "#B026FF",
                border: "1px solid rgba(176, 38, 255, 0.3)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              LABORATORIO CRIPTOGRÁFICO • ESTÁNDAR FIPS 203
            </span>
            <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", marginTop: "10px", marginBottom: "8px" }}>
              Benchmark Post-Cuántica: ML-KEM-768 vs RSA vs ECC
            </h2>
            <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
              Compara la resistencia cuántica y el tamaño de claves entre la criptografía tradicional y el encapsulamiento en retículos euclidianos de RED.
            </p>
          </div>

          <div style={{ maxWidth: "860px", margin: "0 auto", padding: "24px", borderRadius: "20px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(176, 38, 255, 0.35)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "20px" }}>
              <div
                onClick={() => setPqcAlgorithm("kyber")}
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  background: pqcAlgorithm === "kyber" ? "rgba(176, 38, 255, 0.2)" : "rgba(255,255,255,0.03)",
                  border: pqcAlgorithm === "kyber" ? "1px solid #B026FF" : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#B026FF" }}>ML-KEM-768 (RED OS)</div>
                <div style={{ fontSize: "11px", color: "#00FF88", fontWeight: 700, marginTop: "4px" }}>🛡️ RESISTENCIA CUÁNTICA: 100%</div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Clave Pública: 1,184 B | Ciphertext: 1,088 B</div>
              </div>

              <div
                onClick={() => setPqcAlgorithm("rsa")}
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  background: pqcAlgorithm === "rsa" ? "rgba(255, 42, 81, 0.2)" : "rgba(255,255,255,0.03)",
                  border: pqcAlgorithm === "rsa" ? "1px solid #FF2A51" : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#FF2A51" }}>RSA-2048 (Legado)</div>
                <div style={{ fontSize: "11px", color: "#FF2A51", fontWeight: 700, marginTop: "4px" }}>⚠️ VULNERABLE A SHOR: 0%</div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Clave Pública: 256 B | Vulnerable a cuántica</div>
              </div>

              <div
                onClick={() => setPqcAlgorithm("ecc")}
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  background: pqcAlgorithm === "ecc" ? "rgba(0, 240, 255, 0.2)" : "rgba(255,255,255,0.03)",
                  border: pqcAlgorithm === "ecc" ? "1px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#00F0FF" }}>ECDH X25519 (Clásico)</div>
                <div style={{ fontSize: "11px", color: "#FFB800", fontWeight: 700, marginTop: "4px" }}>⚠️ VULNERABLE RETROACTIVO</div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Clave Pública: 32 B | Rápido pero vulnerable</div>
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#64748B", fontFamily: "monospace" }}>SEMILLA DE ENTROPÍA CSPRNG EN VIVO:</div>
                <div style={{ fontSize: "13px", color: "#00F0FF", fontFamily: "monospace", fontWeight: 700, marginTop: "2px" }}>{pqcEntropySeed}</div>
              </div>
              <button
                onClick={refreshPqcEntropy}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "rgba(176, 38, 255, 0.2)",
                  border: "1px solid #B026FF",
                  color: "#FFF",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🔄 Generar Nueva Época
              </button>
            </div>

            <div style={{ background: "#030508", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: "12px", color: "#CBD5E1", display: "flex", flexDirection: "column", gap: "6px" }}>
              {pqcSimLog.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. MEDICAL START TRIAGE CALCULATOR */}
        <section id="triage" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(0, 255, 136, 0.15)",
                color: "#00FF88",
                border: "1px solid rgba(0, 255, 136, 0.3)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              MÉDICO & CATÁSTROFES • PROTOCOLO START OFFLINE
            </span>
            <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", marginTop: "10px", marginBottom: "8px" }}>
              Calculadora Interactiva de Triaje START
            </h2>
            <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
              Simula el algoritmo médico de campo para clasificación masiva de heridos en catástrofes y desastres naturales.
            </p>
          </div>

          <div style={{ maxWidth: "860px", margin: "0 auto", padding: "24px", borderRadius: "20px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(0, 255, 136, 0.35)" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>1. ¿El paciente puede caminar?</div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => {
                    setCanWalk(true);
                    evaluateTriage(true, "", "", "");
                  }}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", background: canWalk === true ? "#00FF88" : "rgba(255,255,255,0.05)", color: canWalk === true ? "#000" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                >
                  Sí (Camina)
                </button>
                <button
                  onClick={() => setCanWalk(false)}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", background: canWalk === false ? "rgba(255, 42, 81, 0.2)" : "rgba(255,255,255,0.05)", color: canWalk === false ? "#FF2A51" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                >
                  No (Inmóvil)
                </button>
              </div>
            </div>

            {canWalk === false && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>2. Frecuencia Respiratoria:</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => {
                      setRespiration("none");
                      evaluateTriage(false, "none", "", "");
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", background: respiration === "none" ? "#64748B" : "rgba(255,255,255,0.05)", color: "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                  >
                    Ausente (No respira)
                  </button>
                  <button
                    onClick={() => {
                      setRespiration("over30");
                      evaluateTriage(false, "over30", "", "");
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", background: respiration === "over30" ? "#FF2A51" : "rgba(255,255,255,0.05)", color: respiration === "over30" ? "#FFF" : "#FF2A51", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                  >
                    &gt; 30 / minuto (Rápida)
                  </button>
                  <button
                    onClick={() => setRespiration("normal")}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", background: respiration === "normal" ? "#00F0FF" : "rgba(255,255,255,0.05)", color: respiration === "normal" ? "#000" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                  >
                    10 - 30 / min (Normal)
                  </button>
                </div>
              </div>
            )}

            {canWalk === false && respiration === "normal" && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>3. Pulso Radial / Relleno Capilar:</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => {
                      setRadialPulse("absent");
                      evaluateTriage(false, "normal", "absent", "");
                    }}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", background: radialPulse === "absent" ? "#FF2A51" : "rgba(255,255,255,0.05)", color: "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                  >
                    Ausente / Capilar &gt; 2s
                  </button>
                  <button
                    onClick={() => setRadialPulse("present")}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", background: radialPulse === "present" ? "#00FF88" : "rgba(255,255,255,0.05)", color: radialPulse === "present" ? "#000" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 700, cursor: "pointer" }}
                  >
                    Presente (&lt; 2s)
                  </button>
                </div>
              </div>
            )}

            {canWalk === false && respiration === "normal" && radialPulse === "present" && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>4. Estado Mental (Obedece órdenes sencillas):</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => evaluateTriage(false, "normal", "present", "confused")}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "rgba(255, 42, 81, 0.2)", color: "#FF2A51", border: "1px solid #FF2A51", fontWeight: 700, cursor: "pointer" }}
                  >
                    No obedece / Confuso
                  </button>
                  <button
                    onClick={() => evaluateTriage(false, "normal", "present", "obeys")}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "rgba(255, 184, 0, 0.2)", color: "#FFB800", border: "1px solid #FFB800", fontWeight: 700, cursor: "pointer" }}
                  >
                    Obedece órdenes
                  </button>
                </div>
              </div>
            )}

            {triageResult && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "16px",
                  background: "rgba(3,5,8,0.9)",
                  border: `2px solid ${triageResult.color}`,
                  marginTop: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ fontSize: "18px", fontWeight: 900, color: triageResult.color }}>{triageResult.tag}</div>
                  <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "rgba(255,255,255,0.08)", color: "#FFF", fontFamily: "monospace" }}>
                    {triageResult.priority}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>{triageResult.action}</div>
              </div>
            )}
          </div>
        </section>

        {/* 10. CONSENT-FIRST P2P SIMULATOR */}
        <section id="consent" style={{ padding: "60px 0" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(255, 42, 81, 0.15)",
                color: "#FF2A51",
                border: "1px solid rgba(255, 42, 81, 0.3)",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              POLÍTICA ZERO-TRUST & ANTI-ACOSÓ
            </span>
            <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", marginTop: "10px", marginBottom: "8px" }}>
              Simulador Consent-First P2P
            </h2>
            <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6 }}>
              En RED, ningún nodo desconocido puede forzar conversaciones en tu pantalla. Toda solicitud entrante requiere confirmación humana explícita.
            </p>
          </div>

          <div style={{ maxWidth: "860px", margin: "0 auto", padding: "24px", borderRadius: "20px", background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255, 42, 81, 0.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontWeight: 800, color: "#FFF", fontSize: "15px" }}>Prueba de Handshake:</span>
              <button
                onClick={() => {
                  const randBuf = new Uint8Array(4);
                  if (typeof window !== "undefined" && window.crypto) {
                    window.crypto.getRandomValues(randBuf);
                  }
                  const hex = Array.from(randBuf, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
                  setSimPeerHash(`did:red:${hex}`);
                  setSimPeerAlias(`Operador_${hex.slice(0, 4)}`);
                  setSimConsentStep("incoming");
                  setSimLog((prev) => [
                    `> [ALERTA ACÚSTICA 🚨] Handshake entrante desde did:red:${hex}`,
                    `> [CUARENTENA ZERO-TRUST] Mensajes retenidos. Esperando autorización del usuario.`
                  ]);
                }}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  background: "linear-gradient(90deg, #FF2A51 0%, #990014 100%)",
                  color: "#FFF",
                  fontWeight: 800,
                  fontSize: "13px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ⚡ Simular Solicitud de Contacto P2P
              </button>
            </div>

            {simConsentStep === "incoming" && (
              <div style={{ padding: "20px", borderRadius: "16px", background: "rgba(255, 42, 81, 0.15)", border: "1px solid #FF2A51", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "24px" }}>🚨</span>
                  <div>
                    <div style={{ fontWeight: 800, color: "#FFF", fontSize: "15px" }}>Solicitud de Conexión P2P Detectada</div>
                    <div style={{ fontSize: "12px", color: "#FF2A51", fontFamily: "monospace" }}>Nodo: {simPeerAlias} ({simPeerHash})</div>
                  </div>
                </div>
                <div style={{ fontSize: "13px", color: "#CBD5E1", marginBottom: "16px" }}>
                  Este nodo solicita iniciar un canal de mensajería cifrado Double Ratchet. Selecciona cómo deseas responder:
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      setSimConsentStep("accepted");
                      setSimLog((prev) => [...prev, `> [AUTORIZADO ✅] Nodo ${simPeerAlias} aceptado. Se añade a la lista de contactos autorizados.`]);
                    }}
                    style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#00FF88", color: "#000", fontWeight: 800, border: "none", cursor: "pointer", fontSize: "13px" }}
                  >
                    ✅ Aceptar Contacto
                  </button>
                  <button
                    onClick={() => {
                      setSimConsentStep("rejected");
                      setSimLog((prev) => [...prev, `> [RECHAZADO ❌] Solicitud descartada silenciosamente sin alertar al nodo remoto.`]);
                    }}
                    style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.1)", color: "#FFF", fontWeight: 700, border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "13px" }}
                  >
                    ❌ Rechazar Silencioso
                  </button>
                  <button
                    onClick={() => {
                      setSimConsentStep("blocked");
                      setSimLog((prev) => [...prev, `> [BLOQUEADO 🚫] Nodo ${simPeerAlias} añadido a la lista negra permanente. Todo paquete futuro será descartado a nivel de controlador de radio.`]);
                    }}
                    style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#FF2A51", color: "#FFF", fontWeight: 800, border: "none", cursor: "pointer", fontSize: "13px" }}
                  >
                    🚫 Bloquear Nodo (Anti-Acoso)
                  </button>
                </div>
              </div>
            )}

            <div style={{ background: "#030508", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: "12px", color: "#00F0FF", display: "flex", flexDirection: "column", gap: "6px" }}>
              {simLog.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </section>

        {/* 11. RADAR CANVAS */}
        <section id="radar" style={{ padding: "60px 0", textAlign: "center" }}>
          <h2 style={{ fontSize: "32px", fontWeight: 900, color: "#FFF", marginBottom: "10px" }}>
            Simulador de Radar & Malla Off-Grid
          </h2>
          <p style={{ fontSize: "14px", color: "#94A3B8", marginBottom: "20px" }}>
            Comprueba cómo la topología multi-radio mantiene los canales operativos incluso ante la caída total de torres celulares y proveedores de Internet.
          </p>

          <button
            onClick={() => setIsBlackout(!isBlackout)}
            style={{
              padding: "12px 24px",
              borderRadius: "14px",
              background: isBlackout ? "linear-gradient(90deg, #FF2A51 0%, #7F0010 100%)" : "rgba(0, 255, 136, 0.15)",
              color: isBlackout ? "#FFF" : "#00FF88",
              border: isBlackout ? "1px solid #FF2A51" : "1px solid #00FF88",
              fontWeight: 800,
              cursor: "pointer",
              marginBottom: "20px",
              boxShadow: isBlackout ? "0 0 20px rgba(255, 42, 81, 0.5)" : "none",
            }}
          >
            {isBlackout ? "⚡ MODO APAGÓN ACTIVADO (Sin Internet / Solo Radios de Hardware)" : "🌐 Modo Normal (Hacer clic para simular Apagón / EMP)"}
          </button>

          <div style={{ width: "100%", maxWidth: "800px", margin: "0 auto", background: "#030508", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <canvas ref={radarCanvasRef} style={{ width: "100%", height: "440px", display: "block" }} />
          </div>
        </section>
        </>
    );
};
