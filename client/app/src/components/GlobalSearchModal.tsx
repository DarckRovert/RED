"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { MessageItem } from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { EmptyState } from "./ui/EmptyState";

export interface GlobalSearchModalProps {
    onClose?: () => void;
}

interface TacticalSearchResult {
    id: string;
    icon: string;
    label: string;
    desc: string;
    action: any;
    keywords: string[];
}

const TACTICAL_SEARCHABLE_TOOLS: TacticalSearchResult[] = [
    { id: "channels", icon: "📻", label: "Canales Malla (#)", desc: "Subcanales temáticos de difusión pública por radio y Bluetooth", action: "channels", keywords: ["canales", "radio", "broadcast", "mensajes", "chat"] },
    { id: "walkie", icon: "🎙️", label: "Walkie-Talkie Push-To-Talk", desc: "Voz en tiempo real códec militar LPC 1.2kbps", action: "walkie", keywords: ["walkie", "talkie", "ptt", "voz", "audio", "radio"] },
    { id: "groups", icon: "👥", label: "Escuadrones P2P", desc: "Salas tácticas cerradas con cifrado SenderKeys", action: "groups", keywords: ["grupos", "escuadrones", "squads", "chat"] },
    { id: "socialFeed", icon: "🌍", label: "Feed Social Táctico", desc: "Microblogging y muro descentralizado P2P", action: "socialFeed", keywords: ["feed", "social", "muro", "publicaciones", "dtn"] },
    { id: "canvas", icon: "🎨", label: "Pizarra Táctica Colaborativa", desc: "Lienzo vectorial sincronizado en tiempo real", action: "canvas", keywords: ["pizarra", "canvas", "mapa", "dibujo", "tactico"] },
    { id: "liveStream", icon: "📺", label: "Transmisión en Vivo", desc: "Video streaming multicast P2P", action: "liveStream", keywords: ["video", "stream", "live", "camara"] },
    { id: "broadcast", icon: "📢", label: "Difusión de Alertas Masivas", desc: "Anuncios de alta prioridad en toda la malla", action: "broadcast", keywords: ["difusion", "alerta", "anuncio", "broadcast"] },
    { id: "loraTransceiver", icon: "📻", label: "Transceptor LoRa RF 25km", desc: "Enlace Semtech SX1262 / Meshtastic 915MHz", action: "loraTransceiver", keywords: ["lora", "meshtastic", "sx1262", "radio", "antena", "rf"] },
    { id: "radar", icon: "📡", label: "Radar Swarm BLE/WiFi", desc: "Descubrimiento táctico de nodos en 360°", action: "radar", keywords: ["radar", "ble", "wifi", "proximidad", "nodos"] },
    { id: "nodemap", icon: "🗺️", label: "Mapa GPS Offline", desc: "Cartografía vectorial táctica sin conexión", action: "nodemap", keywords: ["mapa", "gps", "coordenadas", "gis", "topografia"] },
    { id: "offGridCompass", icon: "🧭", label: "Brújula Topográfica & PDR", desc: "Azimut magnético y navegación inercial", action: "offGridCompass", keywords: ["brujula", "pdr", "azimut", "orientacion", "inercial"] },
    { id: "p2pCompass", icon: "🎯", label: "Brújula P2P (Tracking)", desc: "Rastreo direccional hacia nodos aliados", action: "p2pCompass", keywords: ["tracking", "rastreo", "pares", "aliados"] },
    { id: "celestialPdr", icon: "✨", label: "Navegación Celeste J2000 & PDR", desc: "Orientación astronómica por efemérides solares", action: "celestialPdr", keywords: ["celeste", "astronomia", "sol", "estrellas", "j2000"] },
    { id: "sonarSeismic", icon: "🦇", label: "Ecosonda ToF & Sismógrafo", desc: "Sondeo acústico de cavidades y detección sísmica", action: "sonarSeismic", keywords: ["sonar", "sismografo", "terremoto", "cavidades", "tdoa"] },
    { id: "tacticalFoxhunt", icon: "🦊", label: "Radiogoniometría RDF Foxhunt", desc: "Localización y caza de emisores de radio", action: "tacticalFoxhunt", keywords: ["foxhunt", "rdf", "radiogoniometria", "senales"] },
    { id: "shakePair", icon: "📳", label: "Shake & Pair (Acelerómetro)", desc: "Emparejamiento cinético agitando el dispositivo", action: "shakePair", keywords: ["shake", "pair", "agitar", "acelerometro", "vincular"] },
    { id: "proximityWave", icon: "🌊", label: "Ola Proximidad Ultrasónica", desc: "Descubrimiento por audio en 18-20 kHz", action: "proximityWave", keywords: ["ultrasonido", "ola", "audio", "sonar"] },
    { id: "rfSpectrum", icon: "🛡️", label: "Analizador de Espectro RF", desc: "Monitoreo de densidad espectral 2.4/5GHz", action: "rfSpectrum", keywords: ["espectro", "rf", "frecuencias", "interferencia"] },
    { id: "acousticWarfare", icon: "🔊", label: "Guerra Acústica & Scrambler", desc: "Contramedidas ultrasónicas perimetrales", action: "acousticWarfare", keywords: ["acustica", "scrambler", "interferencia", "binaural"] },
    { id: "aiCopilot", icon: "🧠", label: "Copiloto IA Táctico Offline", desc: "Inferencia local WASM con RAG de supervivencia", action: "aiCopilot", keywords: ["ia", "ai", "copiloto", "rag", "qwen", "inteligencia"] },
    { id: "tacticalVisionScan", icon: "👁️", label: "Visión Táctica Edge AI & UAV", desc: "Detección visual de drones, siluetas térmicas y fuego", action: "tacticalVisionScan", keywords: ["vision", "camara", "dron", "uav", "fuego", "termico"] },
    { id: "c4isrEmpDrill", icon: "⚡", label: "Matriz C4ISR & Drill EMP", desc: "Simulación de pulso electromagnético", action: "c4isrEmpDrill", keywords: ["c4isr", "emp", "drill", "simulacion", "matriz"] },
    { id: "guardian", icon: "🛡️", label: "Guardián IA Firewall", desc: "Protección heurística contra ataques de inyección", action: "guardian", keywords: ["guardian", "firewall", "seguridad", "filtro"] },
    { id: "idVault", icon: "🪪", label: "Bóveda de Identidad & Claves", desc: "Gestor de credenciales soberanas DID y BIP-39", action: "idVault", keywords: ["identidad", "did", "claves", "perfil", "boveda"] },
    { id: "crypto", icon: "🔐", label: "Criptografía Post-Cuántica (PQC)", desc: "Cifrado NIST ML-KEM-768 y firmas ML-DSA-65", action: "crypto", keywords: ["crypto", "pqc", "cuantica", "kyber", "dilithium", "cifrado"] },
    { id: "p2pPay", icon: "💳", label: "RED Pay (Vales P2P)", desc: "Transferencias de crédito seguras entre pares", action: "p2pPay", keywords: ["pay", "pagos", "vales", "credito", "dinero"] },
    { id: "zkBarterSubsurface", icon: "⚖️", label: "Trueque ZK & Rescate", desc: "Intercambio en conocimiento cero y rescate sub-estructural", action: "zkBarterSubsurface", keywords: ["trueque", "zk", "barter", "rescate", "atrapados"] },
    { id: "commercialHub", icon: "⚡", label: "Hub Comercial & Recompensas", desc: "Mercado offline y programas de fidelidad", action: "commercialHub", keywords: ["comercial", "hub", "mercado", "recompensas"] },
    { id: "web3Vault", icon: "🦊", label: "Bóveda Web3 & MetaMask", desc: "Gestión de claves EVM (Polygon, Ethereum)", action: "web3Vault", keywords: ["web3", "metamask", "ethereum", "polygon", "evm", "wallet"] },
    { id: "explorer", icon: "⛓️", label: "Explorador Blockchain PoS", desc: "Trazabilidad de bloques y libro mayor", action: "explorer", keywords: ["blockchain", "explorer", "bloques", "ledger", "transacciones"] },
    { id: "stegoVault", icon: "🖼️", label: "Bóveda Esteganográfica LSB", desc: "Ocultación de archivos dentro de imágenes", action: "stegoVault", keywords: ["stego", "esteganografia", "imagen", "oculto", "lsb"] },
    { id: "airGapStego", icon: "📷", label: "Esteganografía Air-Gap QR", desc: "Transferencia óptica animada sin radio", action: "airGapStego", keywords: ["airgap", "qr", "optico", "camara"] },
    { id: "shamirRecovery", icon: "🔑", label: "Respaldo Shamir SSS (3-de-5)", desc: "División criptográfica del secreto entre aliados", action: "shamirRecovery", keywords: ["shamir", "sss", "respaldo", "recuperacion", "secreto"] },
    { id: "globalShield", icon: "🛡️", label: "Escudo Global DEFCON", desc: "Monitoreo perimetral y niveles DEFCON 1-5", action: "globalShield", keywords: ["defcon", "escudo", "shield", "perimetro", "ataque"] },
    { id: "cbrnSatellite", icon: "☢️", label: "Detector Radiológico & Satélite", desc: "Detección nuclear en CMOS y pasarela Iridium", action: "cbrnSatellite", keywords: ["cbrn", "nuclear", "radiacion", "satelite", "iridium", "gamma"] },
    { id: "blackout", icon: "⚡", label: "Simulador de Apagón", desc: "Pruebas de estrés y corte de red", action: "blackout", keywords: ["apagon", "blackout", "estres", "chaos"] },
    { id: "dms", icon: "💀", label: "Hombre Muerto (DMS)", desc: "Protocolo de contingencia y borrado seguro", action: "dms", keywords: ["dms", "muerto", "panico", "borrado", "deadman"] },
    { id: "calculator", icon: "🧮", label: "Calculadora Señuelo", desc: "Camuflaje de coacción con PIN señuelo", action: "calculator", keywords: ["calculadora", "camuflaje", "senuelo", "coaccion"] },
    { id: "vitalScan", icon: "🫀", label: "Signos Vitales & Triage START", desc: "Fotopletismografía rPPG y clasificación USAR", action: "vitalScan", keywords: ["vital", "pulso", "triage", "start", "medico", "salud"] },
    { id: "tcccBallistics", icon: "🎯", label: "Triage TCCC & Balística 4-DOF", desc: "Protocolo MARCH-PAWS y física de tiro balístico", action: "tcccBallistics", keywords: ["tccc", "balistica", "tiro", "march", "heridos"] },
    { id: "survivalBeacon", icon: "🚨", label: "Baliza SOS Multimodal", desc: "Emisión acústica, lumínica y de radio SOS", action: "survivalBeacon", keywords: ["sos", "baliza", "emergencia", "socorro", "morse"] },
    { id: "amber", icon: "🟠", label: "Alerta AMBER P2P", desc: "Búsqueda comunitaria descentralizada", action: "amber", keywords: ["amber", "busqueda", "desaparecidos", "alerta"] },
    { id: "weather", icon: "🌤️", label: "Barómetro & Alertas CAP", desc: "Pronóstico meteorológico por sensor barométrico", action: "weather", keywords: ["clima", "barometro", "tormenta", "tiempo", "temperatura"] },
    { id: "atmosphericSafety", icon: "💨", label: "Seguridad Atmosférica AQI", desc: "Calidad de aire y detección de polución", action: "atmosphericSafety", keywords: ["atmosfera", "aire", "aqi", "polucion", "gas"] },
    { id: "vitalResources", icon: "💧", label: "Recursos Vitales H2O & Batería", desc: "Control de reservas de agua y energía", action: "vitalResources", keywords: ["agua", "recursos", "bateria", "energia", "raciones"] },
    { id: "appStore", icon: "🛒", label: "App Store P2P (Mini-Apps)", desc: "Catálogo de micro-aplicaciones aisladas", action: "appStore", keywords: ["store", "apps", "miniapps", "bazaar", "juegos"] },
    { id: "hyperBrowser", icon: "🌐", label: "RED Hyper-Browser Mesh", desc: "Navegación web descentralizada por saltos", action: "hyperBrowser", keywords: ["browser", "navegador", "web", "http", "proxy"] },
    { id: "commandCenter", icon: "⚡", label: "Centro de Comando C4ISR", desc: "Matriz operacional completa de todos los módulos", action: "commandCenter", keywords: ["c4isr", "comando", "centro", "matriz", "modulos"] },
    { id: "health", icon: "📊", label: "Diagnóstico de Salud", desc: "Métricas de CPU, memoria, red y batería", action: "health", keywords: ["salud", "diagnostico", "cpu", "memoria", "sistema"] },
    { id: "nodeLogs", icon: "📋", label: "Logs del Nodo Rust SSE", desc: "Registro en tiempo real de eventos nativos", action: "nodeLogs", keywords: ["logs", "nodo", "rust", "eventos", "sse"] },
    { id: "webCompanionLink", icon: "💻", label: "Vincular con PC (Web Companion)", desc: "Sincronización de sesión con escritorio", action: "webCompanionLink", keywords: ["companion", "pc", "escritorio", "vincular", "link"] },
    { id: "settings", icon: "⚙️", label: "Ajustes del Sistema", desc: "Preferencias de interfaz, temas y red", action: "settings", keywords: ["ajustes", "configuracion", "settings", "tema", "idioma"] },
    { id: "updater", icon: "🚀", label: "Actualizador OTA", desc: "Actualización de software firmada por P2P", action: "updater", keywords: ["actualizador", "ota", "update", "version"] },
];

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const { messages, contacts, groups, navigate } = useRedStore();
    const [query, setQuery] = useState("");

    const resolvePeerName = (hash: string) => {
        const g = groups.find((g: any) => g.id === hash);
        if (g) return g.name || "Grupo";
        const c = contacts.find((c: any) => c.identity_hash === hash);
        return c?.display_name || hash.substring(0, 8);
    };

    const qLower = query.trim().toLowerCase();

    const matchedTools = qLower.length >= 2
        ? TACTICAL_SEARCHABLE_TOOLS.filter(tool =>
            tool.label.toLowerCase().includes(qLower) ||
            tool.desc.toLowerCase().includes(qLower) ||
            tool.keywords.some(k => k.toLowerCase().includes(qLower))
        )
        : [];

    const messageResults: MessageItem[] = qLower.length >= 2
        ? messages.filter(m => m.content && m.content.toLowerCase().includes(qLower))
        : [];

    const hasResults = matchedTools.length > 0 || messageResults.length > 0;

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 10000,
                background: "rgba(4, 6, 12, 0.85)", backdropFilter: "blur(16px)",
                display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px 20px"
            }}
            onClick={onClose}
        >
            <div
                className="card-tactical animate-enter modal-card-scrollable"
                style={{
                    width: "100%", maxWidth: "560px", padding: "20px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                    maxHeight: "calc(100dvh - 60px)",
                    display: "flex", flexDirection: "column"
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexShrink: 0 }}>
                    <div style={{ fontSize: "1.05rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>🔍</span> {t.sidebar?.search_placeholder ? t.sidebar.search_placeholder.split("...")[0] : "Búsqueda Global C4ISR"}
                    </div>
                    <button onClick={onClose} className="btn-icon" style={{ width: 34, height: 34 }} title={t.common?.close || "Cerrar"}>✕</button>
                </div>

                <input
                    autoFocus
                    type="text"
                    placeholder={t.sidebar?.search_placeholder || "Buscar módulos (brújula, LoRa, satélite, PQC...) o mensajes..."}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{
                        width: "100%", padding: "12px 16px", borderRadius: "var(--radius-md)",
                        background: "var(--bg-card)", color: "#fff",
                        border: "1px solid var(--glass-border)", outline: "none",
                        fontSize: "0.95rem", marginBottom: "14px", boxSizing: "border-box",
                        flexShrink: 0
                    }}
                />

                <div className="scroll-container" style={{ flex: 1, maxHeight: "min(460px, 60vh)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {qLower.length >= 2 && !hasResults && (
                        <EmptyState 
                            title={t.sidebar?.no_contacts || "Sin coincidencias"} 
                            description={`No se encontraron módulos ni mensajes para "${query}"`} 
                            icon="🔍" 
                        />
                    )}

                    {/* Módulos y Herramientas Tácticas Coincidentes */}
                    {matchedTools.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--accent-cyan)", letterSpacing: "1px", textTransform: "uppercase", paddingLeft: "4px" }}>
                                ⚡ Módulos & Herramientas Tácticas ({matchedTools.length})
                            </div>
                            {matchedTools.map(tool => (
                                <div
                                    key={tool.id}
                                    onClick={() => {
                                        navigate(tool.action);
                                        onClose?.();
                                    }}
                                    className="card-tactical-interactive"
                                    style={{
                                        padding: "10px 14px", display: "flex", alignItems: "center", gap: "12px",
                                        background: "rgba(14, 18, 38, 0.9)", border: "1px solid rgba(0, 229, 255, 0.25)"
                                    }}
                                >
                                    <span style={{ fontSize: "1.4rem" }}>{tool.icon}</span>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                                        <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#FFF" }}>{tool.label}</div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.3 }}>{tool.desc}</div>
                                    </div>
                                    <span style={{ fontSize: "0.68rem", padding: "3px 8px", borderRadius: "8px", background: "rgba(0, 229, 255, 0.15)", color: "var(--accent-cyan)", fontWeight: 800 }}>
                                        ABRIR ➔
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Mensajes Coincidentes */}
                    {messageResults.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "1px", textTransform: "uppercase", paddingLeft: "4px" }}>
                                💬 Mensajes de la Malla ({messageResults.length})
                            </div>
                            {messageResults.map(msg => {
                                const targetConvId = msg.conversation_id || ((msg as any).recipient || msg.sender);
                                const peerName = resolvePeerName(targetConvId);
                                return (
                                    <div
                                        key={msg.id}
                                        onClick={() => {
                                            navigate("chat", targetConvId);
                                            onClose?.();
                                        }}
                                        className="card-tactical-interactive"
                                        style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--accent-cyan)" }}>{peerName}</span>
                                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                {new Date((msg.timestamp > 1e10 ? msg.timestamp : msg.timestamp * 1000)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                            {msg.content}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};