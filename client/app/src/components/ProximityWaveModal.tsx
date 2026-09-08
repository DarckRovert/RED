"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { getProximityNodes, triggerWaveHandshake, ProximityNode, getDiscoveryConfig } from "../lib/api";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { SoundMeshEngine, SoundMeshPacket } from "../lib/audio/SoundMeshEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";

export const ProximityWaveModal: React.FC = () => {
    const { navigate, goBack, addContact, identity } = useRedStore();
    const { t } = useTranslation();

    const [rfNodes, setRfNodes] = useState<ProximityNode[]>([]);
    const [acousticNodes, setAcousticNodes] = useState<Map<string, ProximityNode>>(new Map());
    const [wavingId, setWavingId] = useState<string | null>(null);
    const [config, setConfig] = useState<any>(null);
    const [transportFilter, setTransportFilter] = useState<'ALL' | 'RF' | 'ULTRASONIC'>('ALL');
    const [isTransmittingWave, setIsTransmittingWave] = useState(false);
    const [isUltrasonicListening, setIsUltrasonicListening] = useState(false);

    // 1. Intercepción LIFO de botón Atrás (Android) y Escape (Web)
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (wavingId) {
                TacticalAudioEngine.playTap();
                setWavingId(null);
                return true;
            }
            if (isTransmittingWave) {
                TacticalAudioEngine.playTap();
                setIsTransmittingWave(false);
                return true;
            }
            TacticalAudioEngine.playTap();
            goBack();
            return true;
        });
        return () => unregister();
    }, [wavingId, isTransmittingWave, goBack]);

    // 2. Cargar configuración de descubrimiento táctico
    useEffect(() => {
        getDiscoveryConfig().then(setConfig).catch(() => {});
    }, []);

    // 3. Cargar nodos detectados por RF (BLE / Malla P2P)
    const loadProximity = useCallback(async () => {
        try {
            const list = await getProximityNodes();
            setRfNodes(Array.isArray(list) ? list : []);
        } catch {
            setRfNodes([]);
        }
    }, []);

    useEffect(() => {
        loadProximity();
        const interval = setInterval(loadProximity, 3000);
        return () => clearInterval(interval);
    }, [loadProximity]);

    // 4. Manejador de recepción de paquetes acústicos SoundMesh (18.5 - 20.5 kHz FSK)
    const handleAcousticPacket = useCallback((pkt: SoundMeshPacket) => {
        const myHash = identity?.identity_hash || 'did:red:local';
        
        // Supresión estricta de eco acústico local (el micrófono capta el altavoz del mismo dispositivo)
        if (pkt.senderId === myHash || (pkt.rawText && pkt.rawText.includes(myHash))) {
            return;
        }

        let remoteHash = pkt.senderId;
        let remoteName = 'Nodo Acústico RED';

        if (pkt.payload && pkt.payload.startsWith('WAVE:')) {
            remoteName = pkt.payload.substring(5).trim() || remoteName;
        } else if (pkt.rawText && pkt.rawText.startsWith('WAVE:')) {
            const sub = pkt.rawText.split(':');
            if (sub.length >= 3) {
                remoteHash = sub[1];
                remoteName = sub[2];
            }
        }

        if (remoteHash === myHash) return;

        const acousticNode: ProximityNode = {
            identity_hash: remoteHash,
            node_hash: remoteHash,
            display_name: remoteName,
            nickname: remoteName,
            rssi_dbm: pkt.rssiDb,
            distance_meters: null,
            transport: 'SoundMesh Ultrasónico (18-20 kHz)',
            last_seen: pkt.timestamp || Date.now(),
        };

        setAcousticNodes(prev => {
            const next = new Map(prev);
            next.set(remoteHash, acousticNode);
            return next;
        });

        TacticalAudioEngine.playSonarPing();
        toast.info(`📡 Detección acústica ultrasónica: ${remoteName}`);
    }, [identity]);

    // Referencia mutable para evitar cierres obsoletos en el listener acústico
    const handleAcousticPacketRef = useRef(handleAcousticPacket);
    useEffect(() => {
        handleAcousticPacketRef.current = handleAcousticPacket;
    }, [handleAcousticPacket]);

    // 5. Transmisión de Ola Ultrasónica (18.5 - 20.5 kHz) en Silencio de Radio
    const handleEmitUltrasonicWave = async () => {
        if (isTransmittingWave) return;
        setIsTransmittingWave(true);
        TacticalAudioEngine.playTap();
        try {
            const myHash = identity?.identity_hash || 'did:red:local';
            const myName = identity?.nickname || identity?.display_name || 'Operador RED';
            const payload = `${myHash}:WAVE:${myName}`;

            toast.info("🔊 Emitiendo Ola de Proximidad Ultrasónica (18.5-20.5 kHz)...");
            const ok = await SoundMeshEngine.transmitPayload(payload);
            if (ok) {
                TacticalAudioEngine.playRogerBeep();
                toast.success("✅ Ola ultrasónica transmitida en silencio de radio");
            } else {
                TacticalAudioEngine.playWarning();
                toast.error("Error al modular la señal ultrasónica");
            }
        } catch (e: any) {
            TacticalAudioEngine.playWarning();
            toast.error(`Fallo en transmisión ultrasónica: ${e?.message || e}`);
        } finally {
            setIsTransmittingWave(false);
        }
    };

    // 6. Conmutador de Escucha Ultrasónica Continua
    const toggleUltrasonicListening = async () => {
        if (isUltrasonicListening) {
            SoundMeshEngine.stopListening();
            setIsUltrasonicListening(false);
            toast.info("🛑 Escucha acústica ultrasónica desactivada");
        } else {
            toast.info("🎙️ Activando receptor acústico ultrasónico...");
            const success = await SoundMeshEngine.startListening((pkt) => handleAcousticPacketRef.current(pkt));
            if (success) {
                setIsUltrasonicListening(true);
                toast.success("🎯 Receptor ultrasónico activo (18.5-20.5 kHz)");
            } else {
                setIsUltrasonicListening(false);
                toast.error("No se pudo iniciar el receptor acústico (comprueba permisos de micrófono)");
            }
        }
    };

    // 7. Limpieza absoluta de hardware de audio en unmount (evita fugas de batería)
    useEffect(() => {
        return () => {
            SoundMeshEngine.stopListening();
        };
    }, []);

    // 8. Fusión y filtrado de nodos detectados
    const nodes = useMemo(() => {
        const map = new Map<string, ProximityNode>();

        // Incorporar nodos de radiofrecuencia (BLE / Malla)
        rfNodes.forEach(n => {
            const hash = n.identity_hash || n.node_hash;
            if (hash) map.set(hash, n);
        });

        // Fusionar nodos ultrasónicos detectados
        acousticNodes.forEach((an, hash) => {
            if (map.has(hash)) {
                const existing = map.get(hash)!;
                map.set(hash, {
                    ...existing,
                    transport: `${existing.transport} + SoundMesh`,
                    last_seen: Math.max(existing.last_seen, an.last_seen),
                    rssi_dbm: existing.rssi_dbm ?? an.rssi_dbm,
                });
            } else {
                map.set(hash, an);
            }
        });

        let list = Array.from(map.values());

        // Aplicar filtros de sigilo y umbral de señal
        if (config) {
            if (config.stealth_mode === "contacts_only") {
                const storeContacts = useRedStore.getState().contacts || [];
                list = list.filter(n => {
                    const hash = n.identity_hash || n.node_hash;
                    return storeContacts.some((c: any) => c.identity_hash === hash || hash?.startsWith(c.identity_hash));
                });
            }
            if (config.rssi_threshold != null) {
                list = list.filter(n => {
                    const realRssi = n.rssi ?? n.rssi_dbm;
                    if (realRssi == null) return true;
                    return realRssi >= config.rssi_threshold!;
                });
            }
        }

        // Aplicar filtro de transporte seleccionado
        if (transportFilter === 'RF') {
            list = list.filter(n => !(n.transport || '').includes("Ultrasónico") && !(n.transport || '').includes("SoundMesh"));
        } else if (transportFilter === 'ULTRASONIC') {
            list = list.filter(n => (n.transport || '').includes("Ultrasónico") || (n.transport || '').includes("SoundMesh"));
        }

        return list.sort((a, b) => b.last_seen - a.last_seen);
    }, [rfNodes, acousticNodes, config, transportFilter]);

    // 9. Ejecución de saludo táctico
    const handleWave = async (node: ProximityNode) => {
        const targetHash = node.identity_hash || node.node_hash || "node";
        setWavingId(targetHash);
        TacticalAudioEngine.playTap();
        try {
            const isAcoustic = (node.transport || '').includes("Ultrasónico") || (node.transport || '').includes("SoundMesh");
            if (isAcoustic) {
                const myHash = identity?.identity_hash || 'did:red:local';
                const myName = identity?.nickname || identity?.display_name || 'Operador RED';
                await SoundMeshEngine.transmitPayload(`${myHash}:WAVE:${myName}`);
            } else {
                await triggerWaveHandshake(targetHash);
            }
            await addContact(targetHash, node.nickname || node.display_name || targetHash.substring(0, 8));
            TacticalAudioEngine.playRogerBeep();
            toast.success("👋 ¡Saludo táctico emitido! Enlace establecido.");
            navigate("chat", targetHash);
        } catch (e: any) {
            TacticalAudioEngine.playWarning();
            toast.error(`Error al saludar: ${e.message}`);
        } finally {
            setWavingId(null);
        }
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            <style>{`
                @keyframes pulse-wave {
                    0% { transform: scale(0.6); opacity: 0.9; }
                    50% { opacity: 0.4; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
                .anim-pulse-wave {
                    animation: pulse-wave 2.2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
                }
            `}</style>

            {/* Header Táctico C4ISR */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.3rem", boxShadow: "0 4px 16px rgba(0,229,255,0.4)"
                    }}>👋</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px", display: "flex", alignItems: "center", gap: "8px" }}>
                            {t.proximity_module?.title || "Proximidad Zero-Touch & Ultrasónica"}
                            {isUltrasonicListening && (
                                <span style={{
                                    fontSize: "0.62rem", padding: "2px 6px", borderRadius: "6px",
                                    background: "rgba(0, 230, 118, 0.2)", color: "var(--accent-green)",
                                    border: "1px solid rgba(0, 230, 118, 0.4)", fontWeight: 700
                                }}>
                                    EMCON ULTRASONIC RX
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t.proximity_module?.subtitle || "BLE PROXIMITY WAVE · SOUNDMESH 18-20 kHz FSK"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            navigate("proximity_settings");
                        }}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                    >
                        ⚙️ Filtros
                    </button>
                    <button
                        onClick={() => {
                            if (!BackHandlerRegistry.executeTop()) {
                                TacticalAudioEngine.playTap();
                                goBack();
                            }
                        }}
                        className="btn-icon"
                        title={t.common?.close || "Cerrar"}
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Radar / Banner de Disparo de Ola Táctica */}
                    <div className="card-tactical" style={{
                        padding: "20px 16px",
                        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
                        position: "relative", overflow: "hidden",
                        border: "1px solid rgba(0, 229, 255, 0.3)",
                        background: "radial-gradient(circle at center, rgba(0, 229, 255, 0.08) 0%, rgba(10, 15, 30, 0.95) 75%)"
                    }}>
                        {/* Círculo Emisor con Onda de Pulso */}
                        <div style={{ position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                            <div className="anim-pulse-wave" style={{
                                position: "absolute", width: "100%", height: "100%", borderRadius: "50%",
                                border: "2px solid var(--accent-cyan)", pointerEvents: "none"
                            }} />
                            <div style={{
                                width: 56, height: 56, borderRadius: "50%",
                                background: isTransmittingWave
                                    ? "linear-gradient(135deg, #FF9100 0%, #FF3D00 100%)"
                                    : "linear-gradient(135deg, #00E5FF 0%, #0077B6 100%)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.5rem", boxShadow: "0 0 20px rgba(0, 229, 255, 0.5)",
                                transition: "all 0.3s ease", zIndex: 2
                            }}>
                                {isTransmittingWave ? "🔊" : "📡"}
                            </div>
                        </div>

                        <div style={{ fontSize: "1.02rem", fontWeight: 800, marginBottom: 4 }}>
                            {isTransmittingWave ? "Modulando Ráfaga Ultrasónica FSK..." : "Ola de Descubrimiento Activa"}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", maxWidth: 440, marginBottom: 16 }}>
                            Emite un pulso audible o ultrasónico (18.5 - 20.5 kHz) para intercambiar credenciales P2P con operadores cercanos bajo silencio de radio.
                        </div>

                        {/* Controles Tácticos de Emisión y Escucha */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", width: "100%" }}>
                            <button
                                onClick={handleEmitUltrasonicWave}
                                disabled={isTransmittingWave}
                                className="btn-tactical-primary"
                                style={{
                                    padding: "10px 18px", fontSize: "0.82rem",
                                    background: isTransmittingWave ? "var(--accent-orange)" : undefined
                                }}
                            >
                                {isTransmittingWave ? "⏳ Emitiendo Ola..." : "🔊 Emitir Ola Ultrasónica"}
                            </button>

                            <button
                                onClick={toggleUltrasonicListening}
                                className="btn-tactical-secondary"
                                style={{
                                    padding: "10px 18px", fontSize: "0.82rem",
                                    borderColor: isUltrasonicListening ? "var(--accent-green)" : undefined,
                                    color: isUltrasonicListening ? "var(--accent-green)" : undefined
                                }}
                            >
                                {isUltrasonicListening ? "🛑 Detener Receptor (RX)" : "🎙️ Escucha Ultrasónica"}
                            </button>
                        </div>
                    </div>

                    {/* Selector de Filtro de Transporte */}
                    <div style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "10px", border: "1px solid var(--glass-border)" }}>
                        {(['ALL', 'RF', 'ULTRASONIC'] as const).map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTransportFilter(tf)}
                                style={{
                                    flex: 1, padding: "8px 10px", borderRadius: "8px", border: "none",
                                    fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                                    background: transportFilter === tf ? "var(--accent-cyan)" : "transparent",
                                    color: transportFilter === tf ? "#000" : "var(--text-muted)",
                                    transition: "all 0.2s ease"
                                }}
                            >
                                {tf === 'ALL' ? '🌐 TODOS' : tf === 'RF' ? '📶 BLE / MALLA' : '🔊 ULTRASÓNICO'}
                            </button>
                        ))}
                    </div>

                    {/* Lista de Nodos Detectados */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                                NODOS DETECTADOS ({nodes.length})
                            </div>
                            <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                {config?.stealth_mode === "contacts_only" ? "🔒 MODO SIGILO: SOLO CONTACTOS" : "🔓 DESCUBRIMIENTO ABIERTO"}
                            </div>
                        </div>

                        {nodes.length === 0 ? (
                            <div className="empty-state-tactical" style={{ padding: "32px 16px" }}>
                                <div className="empty-state-icon" style={{ fontSize: "2rem" }}>📡</div>
                                <div className="empty-state-title" style={{ fontSize: "0.92rem", marginTop: 8 }}>Escaneando Proximidad...</div>
                                <div className="empty-state-desc" style={{ fontSize: "0.76rem" }}>
                                    Acércate a otro operador RED o pulsa "Emitir Ola Ultrasónica" para establecer un handshake acústico en silencio de radio.
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {nodes.map(n => {
                                    const hash = n.node_hash || n.identity_hash || "node";
                                    const isAcoustic = n.transport?.includes("Ultrasónico") || n.transport?.includes("SoundMesh");

                                    return (
                                        <div
                                            key={hash}
                                            className="card-tactical"
                                            style={{
                                                padding: "14px 16px",
                                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                                borderLeft: isAcoustic ? "3px solid var(--accent-green)" : "3px solid var(--accent-cyan)",
                                                background: "rgba(255,255,255,0.02)"
                                            }}
                                        >
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ fontSize: "0.92rem", fontWeight: 800 }}>
                                                        {n.nickname || n.display_name || hash.substring(0, 8)}
                                                    </span>
                                                    <span style={{
                                                        fontSize: "0.62rem", padding: "2px 6px", borderRadius: "4px",
                                                        background: isAcoustic ? "rgba(0, 230, 118, 0.15)" : "rgba(0, 229, 255, 0.15)",
                                                        color: isAcoustic ? "var(--accent-green)" : "var(--accent-cyan)",
                                                        fontWeight: 700, fontFamily: "JetBrains Mono, monospace"
                                                    }}>
                                                        {isAcoustic ? "🔊 SOUNDMESH" : "📶 BLE / MESH"}
                                                    </span>
                                                </div>

                                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {n.distance_meters ? `~${n.distance_meters.toFixed(1)}m distancia` : "Rango Inmediato"}
                                                    {(n.rssi != null || n.rssi_dbm != null)
                                                        ? ` · ${isAcoustic ? 'SNR' : 'RSSI'}: ${n.rssi ?? n.rssi_dbm} dB${isAcoustic ? '' : 'm'}`
                                                        : " · [Sin telemetría de señal]"}
                                                    {` · Visto hace ${Math.max(0, Math.round((Date.now() - n.last_seen) / 1000))}s`}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleWave(n)}
                                                disabled={wavingId === hash}
                                                className="btn-tactical-primary"
                                                style={{ padding: "8px 16px", fontSize: "0.80rem" }}
                                            >
                                                {wavingId === hash ? "Enlazando..." : "Saludar 👋"}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Telemetría y Especificaciones del Protocolo */}
                    <div style={{
                        padding: "12px 14px", borderRadius: "10px",
                        background: "rgba(0, 229, 255, 0.04)", border: "1px solid rgba(0, 229, 255, 0.15)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace"
                    }}>
                        <div>CANAL ACÚSTICO: 18.5 - 20.5 kHz FSK</div>
                        <div>VELOCIDAD: 25 BPS · CRC-16 CCITT</div>
                        <div>EMCON: COMPATIBLE SILENCIO RF</div>
                    </div>

                </div>
            </div>
        </div>
    );
};