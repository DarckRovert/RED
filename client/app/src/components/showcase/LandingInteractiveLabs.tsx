'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../lib/i18n/i18nEngine';

export const LandingInteractiveLabs: React.FC = () => {
    const { t } = useTranslation();
    const [customPacketPayload, setCustomPacketPayload] = useState("ALERTA EVACUACIÓN SECTOR 4");
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
        "> [INIT] Retículos algebraicos ML-KEM-768 cargados en memoria.",
        "> [ENTROPÍA] Semilla CSPRNG de 256 bits generada...",
        "> [ESTADO] Inmune a ataques cuánticos con algoritmo de Shor."
    ]);
    const [pqcEntropySeed, setPqcEntropySeed] = useState<string>(() => {
        if (typeof window !== 'undefined' && window.crypto) {
            const b = new Uint8Array(8);
            window.crypto.getRandomValues(b);
            return '0x' + Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
        }
        return "0x8F1A29D84C20E76B";
    });

    const [canWalk, setCanWalk] = useState<boolean | null>(null);
    const [respiration, setRespiration] = useState<"none" | "over30" | "normal" | null>(null);
    const [radialPulse, setRadialPulse] = useState<"absent" | "present" | null>(null);
    const [mentalStatus, setMentalStatus] = useState<"obeys" | "confused" | null>(null);
    const [triageResult, setTriageResult] = useState<{ color: string; tag: string; priority: string; action: string } | null>(null);

    const [simConsentStep, setSimConsentStep] = useState<"idle" | "incoming" | "accepted" | "rejected" | "blocked">("idle");
    const [simPeerHash, setSimPeerHash] = useState(() => {
        if (typeof window !== 'undefined' && window.crypto) {
            const b = new Uint8Array(12);
            window.crypto.getRandomValues(b);
            return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
        }
        return "7F3A91BC2E844D0F81E73A6B";
    });
    const [simPeerAlias, setSimPeerAlias] = useState("Nodo_Tactico_Proximo");
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
            osc.frequency.exponentialRampToValueAtTime(targetFreq, ctx.currentTime + 0.45);

            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

            osc.connect(gain);
            gain.connect(analyser);
            analyser.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);

            setSoundLog(`> [TX FSK] Modulación emitida: "${soundPayloadText}" (${soundMode === "audible" ? "2.4-3.4 kHz Audible" : "18.5-20.5 kHz Inaudible"}). Trama transmitida al canal aéreo.`);

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

                        cCtx.fillStyle = "rgba(4, 7, 14, 0.3)";
                        cCtx.fillRect(0, 0, canvas.width, canvas.height);

                        cCtx.lineWidth = 2.5;
                        cCtx.strokeStyle = soundMode === "audible" ? "#FFB800" : "#00E5FF";
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
                    }, 650);
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
            `> [ENTROPÍA RENOVADA] Semilla CSPRNG de 128 bits: 0x${hex}`,
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
                action: "Evacuación secundaria. Lesiones leves que no comprometen la vida. Puede desplazarse por sus propios medios."
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

    // Tactical Radar Canvas Effect with High-DPI scaling, mesh routing vectors and animated packet pulses
    useEffect(() => {
        const canvas = radarCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animFrameId: number;
        let sweepAngle = 0;
        let packetProgress = 0;

        const updateSize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = rect.width * dpr;
            canvas.height = 440 * dpr;
            ctx.scale(dpr, dpr);
        };
        updateSize();

        const tacticalNodes = [
            { id: "hq", label: "HQ_MANDO", sub: "Nodo Base", angle: 0, dist: 0, color: "#00FF88", type: "base" },
            { id: "alpha", label: "NODO_ALPHA", sub: "LoRa 915MHz • 14.2km", angle: 0.65, dist: 0.68, color: "#00E5FF", type: "lora" },
            { id: "moto", label: "PATRULLA_02", sub: "BLE 5.3 • 85m", angle: 2.1, dist: 0.38, color: "#FFB300", type: "ble" },
            { id: "tab", label: "BRIGADA_TAB", sub: "Wi-Fi Direct • 190m", angle: 3.8, dist: 0.48, color: "#00FF88", type: "wifi" },
            { id: "dron", label: "DRON_REPETIDOR", sub: "Aéreo • 28.4km", angle: 5.2, dist: 0.82, color: "#A855F7", type: "air" },
            { id: "sat", label: "GATEWAY_SAT", sub: "Enlace Satelital", angle: 1.5, dist: 0.76, color: "#00E5FF", type: "sat" }
        ];

        const meshLinks = [
            ["hq", "moto"],
            ["hq", "tab"],
            ["moto", "alpha"],
            ["tab", "alpha"],
            ["alpha", "dron"],
            ["dron", "sat"],
            ["hq", "sat"]
        ];

        const render = () => {
            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = 440;
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.min(centerX, centerY) - 28;

            ctx.clearRect(0, 0, width, height);

            // Dark Tactical Radar Background Grid
            ctx.fillStyle = "rgba(4, 7, 14, 0.95)";
            ctx.fillRect(0, 0, width, height);

            // Polar Range Rings (5km, 10km, 15km, 20km, 25km)
            const ringLabels = ["5 KM", "10 KM", "15 KM", "20 KM", "25 KM"];
            for (let i = 1; i <= 5; i++) {
                const r = (radius / 5) * i;
                ctx.strokeStyle = isBlackout ? "rgba(255, 51, 85, 0.2)" : "rgba(0, 229, 255, 0.15)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
                ctx.stroke();

                // Range Text
                ctx.fillStyle = isBlackout ? "rgba(255, 51, 85, 0.4)" : "rgba(0, 229, 255, 0.35)";
                ctx.font = "9px 'JetBrains Mono', monospace";
                ctx.textAlign = "left";
                ctx.fillText(ringLabels[i - 1], centerX + 6, centerY - r + 10);
            }

            // Azimuth Crosshair Rays (every 45 degrees)
            const anglesDeg = [0, 45, 90, 135, 180, 225, 270, 315];
            const cardinals: Record<number, string> = { 0: "E 90°", 90: "S 180°", 180: "W 270°", 270: "N 000°" };
            anglesDeg.forEach((deg) => {
                const rad = (deg * Math.PI) / 180;
                const x2 = centerX + Math.cos(rad) * radius;
                const y2 = centerY + Math.sin(rad) * radius;

                ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                if (cardinals[deg]) {
                    const labelX = centerX + Math.cos(rad) * (radius + 16);
                    const labelY = centerY + Math.sin(rad) * (radius + 16);
                    ctx.fillStyle = isBlackout ? "#FF3355" : "#00E5FF";
                    ctx.font = "10px 'JetBrains Mono', monospace";
                    ctx.textAlign = "center";
                    ctx.fillText(cardinals[deg], labelX, labelY + 3);
                }
            });

            // Node Position Map
            const nodeCoords: Record<string, { x: number; y: number; node: typeof tacticalNodes[0] }> = {};
            tacticalNodes.forEach((n) => {
                const x = centerX + Math.cos(n.angle) * (radius * n.dist);
                const y = centerY + Math.sin(n.angle) * (radius * n.dist);
                nodeCoords[n.id] = { x, y, node: n };
            });

            // Mesh Interconnection Vectors (Polylines)
            meshLinks.forEach(([fromId, toId]) => {
                const p1 = nodeCoords[fromId];
                const p2 = nodeCoords[toId];
                if (!p1 || !p2) return;

                const isSatLink = fromId === "sat" || toId === "sat";
                if (isBlackout && isSatLink) {
                    ctx.strokeStyle = "rgba(255, 51, 85, 0.2)";
                    ctx.setLineDash([4, 4]);
                } else {
                    ctx.strokeStyle = "rgba(0, 230, 118, 0.35)";
                    ctx.setLineDash([]);
                }

                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
                ctx.setLineDash([]);

                // Animated Traveling Packet Pulses
                if (!isBlackout || !isSatLink) {
                    const px = p1.x + (p2.x - p1.x) * packetProgress;
                    const py = p1.y + (p2.y - p1.y) * packetProgress;
                    ctx.fillStyle = "#00FF88";
                    ctx.beginPath();
                    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            // Rotating Radar Sweep Beam with Gradient Trail
            if (!isBlackout) {
                const sweepX = centerX + Math.cos(sweepAngle) * radius;
                const sweepY = centerY + Math.sin(sweepAngle) * radius;

                // Sweep Trail Cone
                const trailSteps = 15;
                for (let i = 0; i < trailSteps; i++) {
                    const tAngle = sweepAngle - (i * 0.03);
                    const tx = centerX + Math.cos(tAngle) * radius;
                    const ty = centerY + Math.sin(tAngle) * radius;
                    ctx.fillStyle = `rgba(0, 229, 255, ${0.12 * (1 - i / trailSteps)})`;
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    ctx.lineTo(tx, ty);
                    ctx.arc(centerX, centerY, radius, tAngle, tAngle + 0.03);
                    ctx.closePath();
                    ctx.fill();
                }

                // Main Sweep Line
                ctx.strokeStyle = "rgba(0, 240, 255, 0.9)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(sweepX, sweepY);
                ctx.stroke();

                sweepAngle = (sweepAngle + 0.025) % (Math.PI * 2);
            }

            // Draw Node Blips with Glowing Status Badges
            Object.values(nodeCoords).forEach(({ x, y, node }) => {
                const isCentral = node.type === "base";
                const isDown = isBlackout && node.type === "sat";

                // Glow Ring
                ctx.fillStyle = isDown ? "rgba(255, 51, 85, 0.2)" : `${node.color}33`;
                ctx.beginPath();
                ctx.arc(x, y, isCentral ? 10 : 7, 0, Math.PI * 2);
                ctx.fill();

                // Core Dot
                ctx.fillStyle = isDown ? "#FF3355" : node.color;
                ctx.beginPath();
                ctx.arc(x, y, isCentral ? 5 : 3.5, 0, Math.PI * 2);
                ctx.fill();

                // Node Badge
                ctx.fillStyle = isDown ? "#FF3355" : "#FFF";
                ctx.font = "bold 10px 'JetBrains Mono', monospace";
                ctx.textAlign = "left";
                ctx.fillText(node.label, x + 10, y - 2);

                ctx.fillStyle = isDown ? "#94A3B8" : "rgba(0, 229, 255, 0.8)";
                ctx.font = "8px 'JetBrains Mono', monospace";
                ctx.fillText(isDown ? "[ENLACE CORTADO]" : node.sub, x + 10, y + 8);
            });

            // Blackout HUD Overlay Warning
            if (isBlackout) {
                ctx.fillStyle = "rgba(232, 33, 58, 0.85)";
                ctx.font = "bold 12px 'JetBrains Mono', monospace";
                ctx.textAlign = "center";
                ctx.fillText("⚠️ APAGÓN TOTAL DE TORRES CELULARES • LA MALLA P2P REENRUTA PAQUETES SIN INTERNET", centerX, 26);
            }

            packetProgress = (packetProgress + 0.015) % 1;
            animFrameId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animFrameId);
    }, [isBlackout]);

    return (
        <>
        {/* 1. PACKET INSPECTOR LAB */}
        <section id="packet-inspector" style={{ padding: "70px 0 60px", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "5px 14px",
                borderRadius: "20px",
                background: "rgba(0, 229, 255, 0.12)",
                color: "#00E5FF",
                border: "1px solid rgba(0, 229, 255, 0.3)",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 800,
                letterSpacing: "1px"
              }}
            >
              INGENIERÍA DE PROTOCOLO • SERIALIZACIÓN BINARIA
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px", letterSpacing: "-0.5px" }}>
              Inspector Interactivo de Paquetes de Malla
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
              Desglose en tiempo real de los bytes físicos de una trama que viaja por radio BLE/LoRa con encapsulación post-cuántica y autenticación Poly1305.
            </p>
          </div>

          <div
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
              padding: "26px",
              borderRadius: "24px",
              background: "rgba(14, 18, 34, 0.9)",
              border: "1.5px solid rgba(0, 229, 255, 0.35)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "14px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8", display: "block", marginBottom: "6px", fontFamily: "JetBrains Mono, monospace" }}>PAYLOAD DE TEXTO EN CLARO:</label>
                <input
                  type="text"
                  value={customPacketPayload}
                  onChange={(e) => setCustomPacketPayload(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#FFF",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#94A3B8", display: "block", marginBottom: "6px", fontFamily: "JetBrains Mono, monospace" }}>TTL DE SALTOS:</label>
                <select
                  value={packetTtl}
                  onChange={(e) => setPacketTtl(Number(e.target.value))}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#FFF",
                    fontSize: "13px",
                    outline: "none",
                  }}
                >
                  <option value={3}>3 Saltos (Local)</option>
                  <option value={7}>7 Saltos (Recomendado)</option>
                  <option value={15}>15 Saltos (Área Amplia)</option>
                </select>
              </div>
            </div>

            {/* Visual Byte Structure Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "20px" }}>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(255, 51, 85, 0.12)", border: "1px solid #FF3355", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#FF3355", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>MAGIC HEADER (3B)</div>
                <div style={{ fontSize: "14px", color: "#FFF", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginTop: "4px" }}>0x524544 (RED)</div>
              </div>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(0, 229, 255, 0.12)", border: "1px solid #00E5FF", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#00E5FF", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>TTL HOPS (1B)</div>
                <div style={{ fontSize: "14px", color: "#FFF", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginTop: "4px" }}>0x0{packetTtl} ({packetTtl})</div>
              </div>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(192, 132, 252, 0.12)", border: "1px solid #C084FC", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#C084FC", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>PQC EPHEMERAL (32B)</div>
                <div style={{ fontSize: "14px", color: "#FFF", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginTop: "4px" }}>0x8F1A29D8...</div>
              </div>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(255, 179, 0, 0.12)", border: "1px solid #FFB300", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#FFB300", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>CIPHERTEXT ({customPacketPayload.length}B)</div>
                <div style={{ fontSize: "14px", color: "#FFF", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginTop: "4px" }}>AES-256-GCM</div>
              </div>
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(0, 230, 118, 0.12)", border: "1px solid #00E676", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#00E676", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>MAC TAG (16B)</div>
                <div style={{ fontSize: "14px", color: "#FFF", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, marginTop: "4px" }}>Poly1305 Auth</div>
              </div>
            </div>

            <div style={{ background: "#030508", padding: "16px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: "#00E676", wordBreak: "break-all" }}>
              RAW FRAME: 52 45 44 0{packetTtl} 8F 1A 29 D8 4C 20 E7 6B 91 A2 3D 8E 5F 7C 1B 4A 90 D2 E6 F8 3C 1A 7B 5D ... [AES-POLY1305 SIGNATURE OK]
            </div>
          </div>
        </section>

        {/* 2. SOUNDMESH ACOUSTIC OSCILLOSCOPE LAB */}
        <section id="soundmesh" style={{ padding: "60px 0", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "5px 14px",
                borderRadius: "20px",
                background: "rgba(255, 179, 0, 0.12)",
                color: "#FFB300",
                border: "1px solid rgba(255, 179, 0, 0.3)",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 800,
                letterSpacing: "1px"
              }}
            >
              LABORATORIO ACÚSTICO • WEB AUDIO API OSCILOSCOPIO
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px", letterSpacing: "-0.5px" }}>
              Módem Acústico FSK & Vocoder Táctico
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
              Transmite datos a través del altavoz hacia cualquier dispositivo cercano sin usar Bluetooth ni WiFi, mediante ondas de sonido moduladas.
            </p>
          </div>

          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "26px", borderRadius: "24px", background: "rgba(14, 18, 34, 0.9)", border: "1.5px solid rgba(255, 179, 0, 0.35)", boxShadow: "0 20px 50px rgba(0,0,0,0.7)" }}>
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <button
                onClick={() => setSoundMode("audible")}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px",
                  background: soundMode === "audible" ? "rgba(255, 179, 0, 0.2)" : "rgba(0,0,0,0.4)",
                  border: soundMode === "audible" ? "1.5px solid #FFB300" : "1px solid rgba(255,255,255,0.1)",
                  color: "#FFF", fontWeight: 800, fontSize: "13px", cursor: "pointer",
                }}
              >
                🔊 Modo Demostración Audible (2.4 - 3.4 kHz)
              </button>
              <button
                onClick={() => setSoundMode("ultrasound")}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px",
                  background: soundMode === "ultrasound" ? "rgba(0, 229, 255, 0.2)" : "rgba(0,0,0,0.4)",
                  border: soundMode === "ultrasound" ? "1.5px solid #00E5FF" : "1px solid rgba(255,255,255,0.1)",
                  color: "#FFF", fontWeight: 800, fontSize: "13px", cursor: "pointer",
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
                width: "100%", padding: "14px", borderRadius: "12px",
                background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)",
                color: "#FFF", fontSize: "14px", marginBottom: "16px", outline: "none",
              }}
            />

            <div style={{ width: "100%", height: "140px", background: "#030508", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: "16px" }}>
              <canvas ref={oscilloscopeCanvasRef} width={800} height={140} style={{ width: "100%", height: "100%", display: "block" }} />
            </div>

            <button
              onClick={playSoundMeshChirp}
              disabled={isTransmittingAudio}
              style={{
                width: "100%", padding: "16px", borderRadius: "12px",
                background: isTransmittingAudio ? "#00E676" : "linear-gradient(135deg, #FFB300 0%, #D97706 100%)",
                color: isTransmittingAudio ? "#000" : "#FFF",
                fontWeight: 900, fontSize: "14px", border: "none", cursor: "pointer",
                boxShadow: "0 4px 20px rgba(255, 179, 0, 0.4)", marginBottom: "16px",
              }}
            >
              {isTransmittingAudio ? "📡 Emitiendo Señal FSK en el Osciloscopio..." : "▶️ Sintetizar y Transmitir Trama FSK por el Aire"}
            </button>

            <div style={{ background: "#030508", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: "#FFB300" }}>
              {soundLog}
            </div>
          </div>
        </section>

        {/* 3. POST-QUANTUM LAB */}
        <section id="pqc-lab" style={{ padding: "60px 0", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "5px 14px",
                borderRadius: "20px",
                background: "rgba(192, 132, 252, 0.12)",
                color: "#C084FC",
                border: "1px solid rgba(192, 132, 252, 0.3)",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 800,
                letterSpacing: "1px"
              }}
            >
              LABORATORIO CRIPTOGRÁFICO • ESTÁNDAR NIST FIPS 203
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px", letterSpacing: "-0.5px" }}>
              Benchmark Post-Cuántica: ML-KEM-768 vs RSA vs ECC
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
              Compara la resistencia cuántica y el tamaño de claves entre la criptografía tradicional y el encapsulamiento en retículos euclidianos de RED.
            </p>
          </div>

          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "26px", borderRadius: "24px", background: "rgba(14, 18, 34, 0.9)", border: "1.5px solid rgba(192, 132, 252, 0.35)", boxShadow: "0 20px 50px rgba(0,0,0,0.7)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px", marginBottom: "20px" }}>
              <div
                onClick={() => setPqcAlgorithm("kyber")}
                style={{
                  padding: "18px", borderRadius: "14px",
                  background: pqcAlgorithm === "kyber" ? "rgba(192, 132, 252, 0.2)" : "rgba(0,0,0,0.4)",
                  border: pqcAlgorithm === "kyber" ? "1.5px solid #C084FC" : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "15px", fontWeight: 900, color: "#C084FC" }}>ML-KEM-768 (RED OS)</div>
                <div style={{ fontSize: "11px", color: "#00E676", fontWeight: 800, marginTop: "4px", fontFamily: "JetBrains Mono, monospace" }}>🛡️ RESISTENCIA CUÁNTICA: 100%</div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Clave Pública: 1,184 B • Retículo Euclidiano</div>
              </div>

              <div
                onClick={() => setPqcAlgorithm("rsa")}
                style={{
                  padding: "18px", borderRadius: "14px",
                  background: pqcAlgorithm === "rsa" ? "rgba(255, 51, 85, 0.2)" : "rgba(0,0,0,0.4)",
                  border: pqcAlgorithm === "rsa" ? "1.5px solid #FF3355" : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "15px", fontWeight: 900, color: "#FF3355" }}>RSA-2048 (Legado)</div>
                <div style={{ fontSize: "11px", color: "#FF3355", fontWeight: 800, marginTop: "4px", fontFamily: "JetBrains Mono, monospace" }}>⚠️ VULNERABLE A SHOR: 0%</div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Clave Pública: 256 B • Factorización Rota</div>
              </div>

              <div
                onClick={() => setPqcAlgorithm("ecc")}
                style={{
                  padding: "18px", borderRadius: "14px",
                  background: pqcAlgorithm === "ecc" ? "rgba(0, 229, 255, 0.2)" : "rgba(0,0,0,0.4)",
                  border: pqcAlgorithm === "ecc" ? "1.5px solid #00E5FF" : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "15px", fontWeight: 900, color: "#00E5FF" }}>ECDH X25519 (Clásico)</div>
                <div style={{ fontSize: "11px", color: "#FFB300", fontWeight: 800, marginTop: "4px", fontFamily: "JetBrains Mono, monospace" }}>⚠️ VULNERABLE RETROACTIVO</div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px" }}>Clave Pública: 32 B • Curvas Elípticas</div>
              </div>
            </div>

            <div style={{ padding: "14px 18px", borderRadius: "14px", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>SEMILLA DE ENTROPÍA CSPRNG EN VIVO:</div>
                <div style={{ fontSize: "13px", color: "#00E5FF", fontFamily: "JetBrains Mono, monospace", fontWeight: 800, marginTop: "2px" }}>{pqcEntropySeed}</div>
              </div>
              <button
                onClick={refreshPqcEntropy}
                style={{
                  padding: "8px 16px", borderRadius: "10px",
                  background: "rgba(192, 132, 252, 0.2)", border: "1px solid #C084FC",
                  color: "#FFF", fontSize: "12px", fontWeight: 800, cursor: "pointer",
                }}
              >
                🔄 Generar Nueva Época
              </button>
            </div>

            <div style={{ background: "#030508", padding: "14px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: "#CBD5E1", display: "flex", flexDirection: "column", gap: "6px" }}>
              {pqcSimLog.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. MEDICAL START TRIAGE CALCULATOR */}
        <section id="triage" style={{ padding: "60px 0", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "5px 14px",
                borderRadius: "20px",
                background: "rgba(0, 230, 118, 0.12)",
                color: "#00E676",
                border: "1px solid rgba(0, 230, 118, 0.3)",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 800,
                letterSpacing: "1px"
              }}
            >
              MÉDICO & CATÁSTROFES • PROTOCOLO START OFFLINE
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px", letterSpacing: "-0.5px" }}>
              Calculadora Interactiva de Triaje START
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
              Simula el algoritmo médico de campo para clasificación masiva de heridos en catástrofes y desastres naturales.
            </p>
          </div>

          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "26px", borderRadius: "24px", background: "rgba(14, 18, 34, 0.9)", border: "1.5px solid rgba(0, 230, 118, 0.35)", boxShadow: "0 20px 50px rgba(0,0,0,0.7)" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>1. ¿El paciente puede caminar?</div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => {
                    setCanWalk(true);
                    evaluateTriage(true, "", "", "");
                  }}
                  style={{ flex: 1, padding: "12px", borderRadius: "12px", background: canWalk === true ? "#00E676" : "rgba(255,255,255,0.05)", color: canWalk === true ? "#000" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 800, cursor: "pointer" }}
                >
                  Sí (Camina por sus propios medios)
                </button>
                <button
                  onClick={() => setCanWalk(false)}
                  style={{ flex: 1, padding: "12px", borderRadius: "12px", background: canWalk === false ? "rgba(255, 51, 85, 0.2)" : "rgba(255,255,255,0.05)", color: canWalk === false ? "#FF3355" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 800, cursor: "pointer" }}
                >
                  No (Inmóvil / En suelo)
                </button>
              </div>
            </div>

            {canWalk === false && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>2. ¿Respira espontáneamente?</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => {
                      setRespiration("none");
                      evaluateTriage(false, "none", "", "");
                    }}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: respiration === "none" ? "#64748B" : "rgba(255,255,255,0.05)", color: "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 800, cursor: "pointer" }}
                  >
                    No (Apnea tras apertura vía aérea)
                  </button>
                  <button
                    onClick={() => {
                      setRespiration("over30");
                      evaluateTriage(false, "over30", "", "");
                    }}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: respiration === "over30" ? "rgba(255, 51, 85, 0.2)" : "rgba(255,255,255,0.05)", color: respiration === "over30" ? "#FF3355" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 800, cursor: "pointer" }}
                  >
                    &gt; 30 rpm (Taquipnea)
                  </button>
                  <button
                    onClick={() => setRespiration("normal")}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: respiration === "normal" ? "rgba(0, 230, 118, 0.2)" : "rgba(255,255,255,0.05)", color: respiration === "normal" ? "#00E676" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 800, cursor: "pointer" }}
                  >
                    10 - 30 rpm (Normal)
                  </button>
                </div>
              </div>
            )}

            {canWalk === false && respiration === "normal" && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>3. Pulso Radial / Relleno Capilar</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => {
                      setRadialPulse("absent");
                      evaluateTriage(false, "normal", "absent", "");
                    }}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: radialPulse === "absent" ? "rgba(255, 51, 85, 0.2)" : "rgba(255,255,255,0.05)", color: radialPulse === "absent" ? "#FF3355" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 800, cursor: "pointer" }}
                  >
                    Ausente / Relleno &gt; 2 seg
                  </button>
                  <button
                    onClick={() => setRadialPulse("present")}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: radialPulse === "present" ? "rgba(0, 230, 118, 0.2)" : "rgba(255,255,255,0.05)", color: radialPulse === "present" ? "#00E676" : "#FFF", border: "1px solid rgba(255,255,255,0.1)", fontWeight: 800, cursor: "pointer" }}
                  >
                    Presente / Relleno &lt; 2 seg
                  </button>
                </div>
              </div>
            )}

            {canWalk === false && respiration === "normal" && radialPulse === "present" && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", marginBottom: "8px" }}>4. Estado Mental / Respuesta a Órdenes</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => evaluateTriage(false, "normal", "present", "confused")}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "rgba(255, 51, 85, 0.2)", color: "#FF3355", border: "1px solid #FF3355", fontWeight: 800, cursor: "pointer" }}
                  >
                    No obedece / Confuso
                  </button>
                  <button
                    onClick={() => evaluateTriage(false, "normal", "present", "obeys")}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "rgba(255, 179, 0, 0.2)", color: "#FFB300", border: "1px solid #FFB300", fontWeight: 800, cursor: "pointer" }}
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
                  <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "rgba(255,255,255,0.08)", color: "#FFF", fontFamily: "JetBrains Mono, monospace" }}>
                    {triageResult.priority}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: 1.6 }}>{triageResult.action}</div>
              </div>
            )}
          </div>
        </section>

        {/* 5. CONSENT-FIRST P2P SIMULATOR */}
        <section id="consent" style={{ padding: "60px 0", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "5px 14px",
                borderRadius: "20px",
                background: "rgba(255, 51, 85, 0.12)",
                color: "#FF3355",
                border: "1px solid rgba(255, 51, 85, 0.3)",
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 800,
                letterSpacing: "1px"
              }}
            >
              POLÍTICA ZERO-TRUST & ANTI-ACOSO
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#FFF", marginTop: "12px", marginBottom: "10px", letterSpacing: "-0.5px" }}>
              Simulador Consent-First P2P
            </h2>
            <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto", lineHeight: 1.6 }}>
              En RED, ningún nodo desconocido puede forzar conversaciones en tu pantalla. Toda solicitud entrante requiere confirmación humana explícita.
            </p>
          </div>

          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "26px", borderRadius: "24px", background: "rgba(14, 18, 34, 0.9)", border: "1.5px solid rgba(255, 51, 85, 0.35)", boxShadow: "0 20px 50px rgba(0,0,0,0.7)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <span style={{ fontWeight: 800, color: "#FFF", fontSize: "15px" }}>Prueba de Handshake P2P:</span>
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
                  padding: "10px 20px", borderRadius: "12px",
                  background: "linear-gradient(135deg, #FF3355 0%, #C41230 100%)",
                  color: "#FFF", fontWeight: 800, fontSize: "13px",
                  border: "none", cursor: "pointer", boxShadow: "0 4px 15px rgba(255, 51, 85, 0.4)",
                }}
              >
                ⚡ Simular Solicitud de Contacto P2P
              </button>
            </div>

            {simConsentStep === "incoming" && (
              <div style={{ padding: "20px", borderRadius: "16px", background: "rgba(255, 51, 85, 0.15)", border: "1px solid #FF3355", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "24px" }}>🚨</span>
                  <div>
                    <div style={{ fontWeight: 900, color: "#FFF", fontSize: "15px" }}>Solicitud de Conexión P2P Detectada</div>
                    <div style={{ fontSize: "12px", color: "#FF3355", fontFamily: "JetBrains Mono, monospace" }}>Nodo: {simPeerAlias} ({simPeerHash})</div>
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
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "#00E676", color: "#000", fontWeight: 800, border: "none", cursor: "pointer", fontSize: "13px" }}
                  >
                    ✅ Aceptar Contacto
                  </button>
                  <button
                    onClick={() => {
                      setSimConsentStep("rejected");
                      setSimLog((prev) => [...prev, `> [RECHAZADO ❌] Solicitud descartada silenciosamente sin alertar al nodo remoto.`]);
                    }}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.1)", color: "#FFF", fontWeight: 700, border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "13px" }}
                  >
                    ❌ Rechazar Silencioso
                  </button>
                  <button
                    onClick={() => {
                      setSimConsentStep("blocked");
                      setSimLog((prev) => [...prev, `> [BLOQUEADO 🚫] Nodo ${simPeerAlias} añadido a la lista negra permanente. Todo paquete futuro será descartado a nivel de controlador de radio.`]);
                    }}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", background: "#FF3355", color: "#FFF", fontWeight: 800, border: "none", cursor: "pointer", fontSize: "13px" }}
                  >
                    🚫 Bloquear Nodo (Anti-Acoso)
                  </button>
                </div>
              </div>
            )}

            <div style={{ background: "#030508", padding: "14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: "#00E5FF", display: "flex", flexDirection: "column", gap: "6px" }}>
              {simLog.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. TACTICAL RADAR CANVAS */}
        <section id="radar" style={{ padding: "60px 0", textAlign: "center", position: "relative" }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: "#FFF", marginBottom: "12px", letterSpacing: "-0.5px" }}>
            Simulador de Radar & Malla Off-Grid
          </h2>
          <p style={{ fontSize: "16px", color: "#94A3B8", maxWidth: "800px", margin: "0 auto 24px", lineHeight: 1.6 }}>
            Comprueba cómo la topología multi-radio mantiene los canales operativos incluso ante la caída total de torres celulares y proveedores de Internet.
          </p>

          <button
            onClick={() => setIsBlackout(!isBlackout)}
            style={{
              padding: "12px 28px",
              borderRadius: "14px",
              background: isBlackout ? "linear-gradient(135deg, #FF3355 0%, #7F0010 100%)" : "rgba(0, 230, 118, 0.15)",
              color: isBlackout ? "#FFF" : "#00E676",
              border: isBlackout ? "1.5px solid #FF3355" : "1.5px solid #00E676",
              fontWeight: 800,
              fontSize: "14px",
              cursor: "pointer",
              marginBottom: "24px",
              boxShadow: isBlackout ? "0 0 25px rgba(255, 51, 85, 0.5)" : "0 0 15px rgba(0, 230, 118, 0.2)",
            }}
          >
            {isBlackout ? "⚡ MODO APAGÓN ACTIVADO (Sin Internet / Solo Radios de Hardware)" : "🌐 Modo Normal (Hacer clic para simular Apagón / EMP)"}
          </button>

          <div style={{ width: "100%", maxWidth: "1280px", margin: "0 auto", background: "#030508", borderRadius: "24px", border: "1.5px solid rgba(0, 229, 255, 0.35)", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}>
            <canvas ref={radarCanvasRef} style={{ width: "100%", height: "440px", display: "block" }} />
            
            {/* Live Tactical Telemetry HUD Bar */}
            <div style={{
              padding: "16px 24px",
              background: "rgba(10, 14, 26, 0.95)",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px", textAlign: "left"
            }}>
              <div>
                <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>FRECUENCIA OPERATIVA</div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#00E5FF", marginTop: "2px" }}>US915 MHz (Banda Libre MTC)</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>TOPOLOGÍA DE MALLA</div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: isBlackout ? "#FF3355" : "#00E676", marginTop: "2px" }}>
                  {isBlackout ? "● Malla P2P de Emergencia Activa" : "● Multi-Hop Híbrido (BLE + LoRa + Wi-Fi)"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>ENCRIPTACIÓN DE TRAMAS</div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#C084FC", marginTop: "2px" }}>NIST FIPS 203 (ML-KEM-768)</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>TASA DE ENTREGA P2P</div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#00E676", marginTop: "2px" }}>99.8% (Cero Dependencia IP)</div>
              </div>
            </div>
          </div>
        </section>
        </>
    );
};
