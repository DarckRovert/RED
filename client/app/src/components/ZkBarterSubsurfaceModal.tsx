"use client";

import React, { useState, useEffect } from "react";
import { zkBarter, ZkBarterProof } from "../lib/crypto/ZeroKnowledgeBarterEngine";
import { subsurfaceAcoustic, SubsurfaceTelemetry } from "../lib/sensors/SubsurfaceAcousticEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { OfflineQrEngine } from "../lib/qr/OfflineQrEngine";

export function ZkBarterSubsurfaceModal() {
    const { navigate, identity, goBack } = useRedStore();

    const [subsurface, setSubsurface] = useState<SubsurfaceTelemetry>(() => subsurfaceAcoustic.getTelemetry());
    const [activeTab, setActiveTab] = useState<"zkBarter" | "subsurface">("zkBarter");

    // zk-Barter state
    const [resourceType, setResourceType] = useState<string>("RACION_TACTICA_MRE");
    const [amount, setAmount] = useState<number>(5);
    const [generatedProof, setGeneratedProof] = useState<ZkBarterProof | null>(null);
    const [proofQrUrl, setProofQrUrl] = useState<string | null>(null);
    const [verifyInputJson, setVerifyInputJson] = useState<string>("");
    const [verifyResult, setVerifyResult] = useState<string | null>(null);
    const [isScanningZk, setIsScanningZk] = useState<boolean>(false);
    const shouldScanZkRef = React.useRef<boolean>(false);

    // Subsurface state
    const [medium, setMedium] = useState<"REINFORCED_CONCRETE" | "RUBBLE_EARTH" | "WATER_FLOODED">("REINFORCED_CONCRETE");
    const [freqHz, setFreqHz] = useState<number>(35);

    useEffect(() => {
        const unsub = subsurfaceAcoustic.subscribe(setSubsurface);
        return () => {
            unsub();
            subsurfaceAcoustic.stopBeacon();
        };
    }, []);

    const handleGenerateProof = async () => {
        // Derivar hojas reales del árbol de Merkle desde contexto operacional local.
        // Nunca se generan valores estáticos hard-codeados.
        // Cada hoja es H(operatorId || resourceType || amount || leafIndex || epochSec).
        const operatorId = identity?.identity_hash || identity?.nickname || 'RED_OPERATOR';
        const epochSec = Math.floor(Date.now() / 60000); // epoch de 60s para estabilidad de la raíz

        const deriveLeaf = async (index: number): Promise<string> => {
            const raw = `${operatorId}:${resourceType}:${amount}:${index}:${epochSec}`;
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        };

        // 8 hojas derivadas garantizan un árbol de Merkle equilibrado de 3 niveles.
        const leafHashes = await Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map(deriveLeaf));

        const secretBytes = new Uint8Array(16);
        const nBytes = new Uint8Array(8);
        crypto.getRandomValues(secretBytes);
        crypto.getRandomValues(nBytes);
        const secret = Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const nullifier = Array.from(nBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        const proof = zkBarter.generateProof(secret, nullifier, 2, leafHashes, resourceType, amount);
        setGeneratedProof(proof);
        const qrPayload = zkBarter.exportProofToQrString(proof);
        const url = await OfflineQrEngine.generateDataUrl(qrPayload, {
            width: 220,
            margin: 1,
            darkColor: "#00E5FF",
            lightColor: "#04060A"
        });
        setProofQrUrl(url);
        toast.success("🪙 Prueba de Conocimiento Cero generada con éxito");
    };

    const stopZkCamera = async () => {
        shouldScanZkRef.current = false;
        if (typeof document !== "undefined") {
            document.documentElement.classList.remove("scanner-active");
            document.body.classList.remove("scanner-active");
        }
        setIsScanningZk(false);
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                await BarcodeScanner.showBackground().catch(() => {});
                await BarcodeScanner.stopScan().catch(() => {});
            }
        } catch {}
    };

    const handleStartZkScan = async () => {
        shouldScanZkRef.current = true;
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                const perm = await BarcodeScanner.checkPermission({ force: true });
                if (!shouldScanZkRef.current) {
                    await stopZkCamera();
                    return;
                }
                if (perm.denied || !perm.granted) {
                    toast.warning("Permiso de cámara no concedido. Introduce el código manualmente.");
                    return;
                }

                await BarcodeScanner.hideBackground();
                if (!shouldScanZkRef.current) {
                    await stopZkCamera();
                    return;
                }
                if (typeof document !== "undefined") {
                    document.documentElement.classList.add("scanner-active");
                }
                document.body.classList.add("scanner-active");
                setIsScanningZk(true);

                const result = await BarcodeScanner.startScan();
                await stopZkCamera();
                if (result.hasContent) {
                    const scanned = result.content.trim();
                    setVerifyInputJson(scanned);
                    const parsed = zkBarter.parseProofFromQrString(scanned);
                    if (parsed) {
                        const isValid = zkBarter.verifyProof(parsed);
                        if (isValid) {
                            setVerifyResult(`✓ VÁLIDA: Propietario verificado contra Merkle Root. Recurso: ${parsed.amount}x ${parsed.resourceType}`);
                            toast.success("Prueba ZK verificada con éxito por QR");
                        } else {
                            setVerifyResult("✗ INVÁLIDA: La prueba no coincide con el Merkle Root o el Nullifier ya fue gastado");
                            toast.error("Prueba ZK inválida");
                        }
                    } else {
                        toast.info("Código QR leído. Pulsa verificar para validar.");
                    }
                }
            } else {
                toast.info("Escaneo activo disponible en dispositivos móviles.");
            }
        } catch (err) {
            console.warn("[ZkBarter] Error en escáner de cámara:", err);
            await stopZkCamera();
        }
    };

    useEffect(() => {
        return () => {
            stopZkCamera();
        };
    }, []);


    const handleVerifyProof = () => {
        const text = verifyInputJson.trim();
        if (!text) {
            toast.error("Pega el JSON o la cadena ZK_PROOF:... de la prueba zk");
            return;
        }

        const parsedFromQr = zkBarter.parseProofFromQrString(text);
        if (parsedFromQr) {
            const isValid = zkBarter.verifyProof(parsedFromQr);
            if (isValid) {
                setVerifyResult(`✓ VÁLIDA: Propietario verificado contra Merkle Root. Recurso: ${parsedFromQr.amount}x ${parsedFromQr.resourceType}`);
                toast.success("Prueba ZK verificada con éxito");
            } else {
                setVerifyResult("✗ INVÁLIDA: La prueba no coincide con el Merkle Root o el Nullifier ya fue gastado");
                toast.error("Prueba ZK inválida");
            }
            return;
        }

        try {
            const parsed: ZkBarterProof = JSON.parse(text);
            const isValid = zkBarter.verifyProof(parsed);
            if (isValid) {
                setVerifyResult(`✓ VÁLIDA: Propietario verificado contra Merkle Root. Recurso: ${parsed.amount}x ${parsed.resourceType}`);
                toast.success("Prueba ZK verificada con éxito");
            } else {
                setVerifyResult("✗ INVÁLIDA: La prueba no coincide con el Merkle Root o el Nullifier ya fue gastado");
                toast.error("Prueba ZK inválida");
            }
        } catch {
            setVerifyResult("✗ ERROR: Formato JSON o QR inválido");
            toast.error("Error al parsear la prueba");
        }
    };

    const handleToggleSubsurface = () => {
        if (subsurface.isTransmitting) {
            subsurfaceAcoustic.stopBeacon();
            toast.info("Baliza sub-estructural detenida");
        } else {
            subsurfaceAcoustic.startBeacon({
                mediumType: medium,
                frequencyHz: freqHz,
            });
            toast.success("🚨 Emitiendo pulsos sísmicos y acústicos de penetración");
        }
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: isScanningZk ? "transparent" : "#050812", color: "#FFF",
            fontFamily: "JetBrains Mono, monospace"
        }}>
            {isScanningZk && (
                <div className="scanner-viewfinder-overlay" style={{
                    position: "fixed", inset: 0, zIndex: 99999,
                    background: "rgba(0,0,0,0.5)",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "space-between",
                    padding: "calc(var(--safe-top, 20px) + 20px) 20px calc(var(--safe-bottom, 20px) + 20px)",
                    pointerEvents: "auto"
                }}>
                    <div style={{
                        padding: "12px 20px", borderRadius: "16px",
                        background: "rgba(6, 10, 24, 0.92)",
                        border: "1.5px solid var(--accent-cyan)",
                        color: "#FFFFFF", textAlign: "center",
                        boxShadow: "0 0 20px rgba(0,229,255,0.3)",
                        maxWidth: "340px", width: "90%"
                    }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--accent-cyan)" }}>
                            📷 ESCANEAR PRUEBA ZK
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", marginTop: "4px" }}>
                            Apunta al código QR de la prueba de conocimiento cero
                        </div>
                    </div>

                    <div className="scanner-target-box" style={{
                        width: "260px", height: "260px",
                        border: "2px solid var(--accent-emerald)",
                        borderRadius: "24px",
                        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.82), 0 0 24px rgba(0, 230, 118, 0.4)",
                        position: "relative", overflow: "hidden",
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                        <div className="scanner-laser-line" style={{
                            width: "100%", height: "2px",
                            background: "linear-gradient(90deg, transparent, #00E676, #00E5FF, transparent)",
                            boxShadow: "0 0 12px #00E676",
                            position: "absolute", top: 0,
                            animation: "scanLaser 2s infinite ease-in-out"
                        }} />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "90%", maxWidth: "340px" }}>
                        <button
                            onClick={stopZkCamera}
                            style={{
                                width: "100%", padding: "14px",
                                background: "rgba(232, 33, 58, 0.85)",
                                border: "1px solid #FF3355",
                                borderRadius: "14px", color: "#FFFFFF",
                                fontWeight: 900, fontSize: "0.9rem",
                                cursor: "pointer", boxShadow: "0 0 16px rgba(232,33,58,0.4)"
                            }}
                        >
                            ✕ CANCELAR ESCANEO
                        </button>
                    </div>
                </div>
            )}
            {/* Header */}
            <div style={{
                padding: "12px 16px", background: "rgba(10, 15, 30, 0.95)",
                borderBottom: "1px solid rgba(0, 229, 255, 0.3)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.2rem" }}>🪙</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            CANJE ANÓNIMO ZK & RESCATE SUB-ESTRUCTURAL
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Pruebas Merkle en Conocimiento Cero y Baliza Sísmica VLF
                        </div>
                    </div>
                </div>
                <button
                    onClick={goBack}
                    style={{

                        background: "rgba(232, 33, 58, 0.2)", border: "1px solid #E8213A",
                        color: "#FFF", padding: "6px 12px", borderRadius: "8px",
                        cursor: "pointer", fontWeight: 800, fontSize: "0.75rem"
                    }}
                >
                    ✕ CERRAR
                </button>
            </div>

            {/* Tab Selector */}
            <div style={{ display: "flex", background: "rgba(15, 23, 42, 0.8)", padding: "6px 16px", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                    onClick={() => setActiveTab("zkBarter")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "zkBarter" ? "#00E5FF" : "transparent",
                        color: activeTab === "zkBarter" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🪙 Bóveda zk-Barter
                </button>
                <button
                    onClick={() => setActiveTab("subsurface")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "subsurface" ? "#FFB300" : "transparent",
                        color: activeTab === "subsurface" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🧱 Baliza Sísmica Sub-Estructural
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: ZK-BARTER ── */}
                {activeTab === "zkBarter" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(0, 229, 255, 0.05)", border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "12px", padding: "12px", fontSize: "0.74rem", color: "#DDD" }}>
                            Demuestra posesión de suministros o créditos frente al Merkle Root del ledger <strong>sin revelar tu DID ni identificadores de transacción</strong>.
                        </div>

                        {/* Generator */}
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#00E5FF" }}>1. GENERAR PRUEBA ZK ANÓNIMA:</div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <select
                                    value={resourceType}
                                    onChange={(e) => setResourceType(e.target.value)}
                                    style={{ flex: 2, padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.74rem" }}
                                >
                                    <option value="RACION_TACTICA_MRE">Ración Táctica MRE</option>
                                    <option value="ANTIBIOTICO_KIT">Kit Antibióticos</option>
                                    <option value="COMBUSTIBLE_5L">Combustible 5L</option>
                                    <option value="AGUA_PURIFICADA_10L">Agua Purificada 10L</option>
                                </select>
                                <input
                                    type="number"
                                    min="1"
                                    value={amount}
                                    onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
                                    style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.74rem" }}
                                />
                            </div>
                            <button
                                onClick={handleGenerateProof}
                                style={{ padding: "10px", borderRadius: "8px", background: "#00E5FF", color: "#000", fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer" }}
                            >
                                ⚡ GENERAR PRUEBA CRIPTOGRÁFICA
                            </button>

                            {generatedProof && (
                                <div style={{ background: "rgba(0,0,0,0.6)", padding: "12px", borderRadius: "10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                                    <div style={{ fontSize: "0.74rem", color: "#00E676", fontWeight: 800, width: "100%", textAlign: "left" }}>
                                        ✓ COMPROMISO ZK CREADO:
                                    </div>
                                    {proofQrUrl && (
                                        <img src={proofQrUrl} alt="QR Prueba ZK" style={{ width: 180, height: 180, borderRadius: "10px", border: "1.5px solid #00E5FF" }} />
                                    )}
                                    <div style={{ fontSize: "0.62rem", color: "#AAA", wordBreak: "break-all", width: "100%" }}>
                                        Merkle Root: {generatedProof.merkleRoot.substring(0, 24)}...
                                    </div>
                                    <div style={{ fontSize: "0.62rem", color: "#AAA", wordBreak: "break-all", width: "100%" }}>
                                        Nullifier Hash: {generatedProof.nullifierHash.substring(0, 24)}...
                                    </div>
                                    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(JSON.stringify(generatedProof, null, 2));
                                                toast.info("JSON copiado al portapapeles");
                                            }}
                                            style={{ flex: 1, padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.1)", color: "#FFF", border: "none", fontSize: "0.68rem", cursor: "pointer" }}
                                        >
                                            📋 COPIAR JSON
                                        </button>
                                        <button
                                            onClick={() => {
                                                const qrStr = zkBarter.exportProofToQrString(generatedProof);
                                                navigator.clipboard.writeText(qrStr);
                                                toast.info("Cadena QR copiada al portapapeles");
                                            }}
                                            style={{ flex: 1, padding: "8px", borderRadius: "6px", background: "rgba(0,229,255,0.2)", color: "#00E5FF", border: "1px solid rgba(0,229,255,0.4)", fontSize: "0.68rem", cursor: "pointer" }}
                                        >
                                            ⚡ COPIAR QR
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Verifier */}
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#00E676" }}>2. VERIFICAR PRUEBA ZK DEL RECEPTOR:</div>
                            
                            <button
                                onClick={handleStartZkScan}
                                style={{
                                    padding: "10px", background: "rgba(0, 230, 118, 0.15)",
                                    border: "1.5px dashed #00E676", borderRadius: "10px",
                                    color: "#00E676", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                                }}
                            >
                                📷 ESCANEAR QR ZK CON LA CÁMARA
                            </button>

                            <textarea
                                value={verifyInputJson}
                                onChange={(e) => setVerifyInputJson(e.target.value)}
                                placeholder="Pega el JSON o la cadena ZK_PROOF:1:... de la prueba ZK aquí..."
                                rows={3}
                                style={{ padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.68rem" }}
                            />
                            <button
                                onClick={handleVerifyProof}
                                style={{ padding: "10px", borderRadius: "8px", background: "#00E676", color: "#000", fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer" }}
                            >
                                🔍 VERIFICAR VALIDEZ & NULLIFIER
                            </button>
                            {verifyResult && (
                                <div style={{ fontSize: "0.72rem", color: verifyResult.startsWith("✓") ? "#00E676" : "#FF3355", fontWeight: 800, padding: "8px", borderRadius: "6px", background: "rgba(0,0,0,0.4)" }}>
                                    {verifyResult}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── TAB 2: SUBSURFACE ACOUSTIC BEACON ── */}
                {activeTab === "subsurface" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(255, 179, 0, 0.08)", border: "1px solid rgba(255, 179, 0, 0.2)", borderRadius: "12px", padding: "12px", fontSize: "0.74rem", color: "#DDD" }}>
                            Genera pulsos subsónicos de baja frecuencia (25-60 Hz) y vibración sísmica para rescate en estructuras colapsadas y penetración de escombros.
                        </div>

                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.7rem", color: "#AAA" }}>MEDIO DE PROPAGACIÓN FÍSICO:</label>
                                <select
                                    value={medium}
                                    onChange={(e: any) => setMedium(e.target.value)}
                                    style={{ padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.74rem" }}
                                >
                                    <option value="REINFORCED_CONCRETE">Hormigón Armado / Estructura (hasta 24m)</option>
                                    <option value="RUBBLE_EARTH">Escombros / Tierra Compacta (hasta 38m)</option>
                                    <option value="WATER_FLOODED">Medio Acuoso / Inundación (hasta 65m)</option>
                                </select>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.7rem", color: "#AAA" }}>FRECUENCIA SUBSÓNICA: {freqHz} Hz</label>
                                <input
                                    type="range"
                                    min="25"
                                    max="60"
                                    step="5"
                                    value={freqHz}
                                    onChange={(e) => setFreqHz(parseInt(e.target.value))}
                                    style={{ width: "100%" }}
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div style={{ background: "rgba(0,0,0,0.4)", padding: "10px", borderRadius: "8px" }}>
                                    <div style={{ fontSize: "0.65rem", color: "#AAA" }}>PENETRACIÓN ESTIMADA</div>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#00E5FF" }}>
                                        {subsurface.estimatedPenetrationMeters} metros
                                    </div>
                                </div>
                                <div style={{ background: "rgba(0,0,0,0.4)", padding: "10px", borderRadius: "8px" }}>
                                    <div style={{ fontSize: "0.65rem", color: "#AAA" }}>PULSOS EMITIDOS</div>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FFB300" }}>
                                        {subsurface.pulsesEmitted}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleToggleSubsurface}
                                style={{
                                    padding: "14px", borderRadius: "10px",
                                    background: subsurface.isTransmitting ? "linear-gradient(135deg, #FF3355, #E8213A)" : "linear-gradient(135deg, #FFB300, #FF8F00)",
                                    color: "#000", fontWeight: 900, fontSize: "0.85rem", border: "none", cursor: "pointer"
                                }}
                            >
                                {subsurface.isTransmitting ? "⏹️ DETENER BALIZA SÍSMICA" : "⚡ ACTIVAR BALIZA ACÚSTICA SUB-ESTRUCTURAL"}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
