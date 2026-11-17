"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { TacIcon } from "../ui/TacIcon";
import { toast } from "../Toast";
import { RED_CREDIT_PARITY_PEN, PEN_TO_USD_EXCHANGE_RATE } from "../../lib/network/TokenomicsEngine";
import {
    RaiStonesInfographic,
    PowVsPorInfographic,
    Web3BridgeHackInfographic,
    OfflineMerchantFlowInfographic,
    SurvivalParityMatrixInfographic,
} from "./infographics";

interface SovereignEconomyGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenWallet?: () => void;
    isStandalone?: boolean;
}

type GuideTab = "faith" | "pow_vs_por" | "hacks" | "calculator";

export const SovereignEconomyGuideModal: React.FC<SovereignEconomyGuideModalProps> = ({
    isOpen,
    onClose,
    onOpenWallet,
    isStandalone = false,
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<GuideTab>("faith");
    const [calcCredits, setCalcCredits] = useState<number>(10);

    // Registro LIFO del botón físico de Atrás en Android
    useEffect(() => {
        if (!isOpen) return;
        const unregister = BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            onClose();
            return true;
        });
        return unregister;
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleTabChange = (tab: GuideTab) => {
        TacticalAudioEngine.playTap();
        setActiveTab(tab);
    };

    // Paridades de materias primas de supervivencia (Orbitofrontal Engine)
    const penEquivalent = (calcCredits * RED_CREDIT_PARITY_PEN).toFixed(2);
    const usdEquivalent = (calcCredits * RED_CREDIT_PARITY_PEN * PEN_TO_USD_EXCHANGE_RATE).toFixed(2);
    const waterLiters = (calcCredits / 3.0).toFixed(1);
    const mreRations = (calcCredits / 10.0).toFixed(1);
    const antibioticDoses = (calcCredits / 15.0).toFixed(1);
    const batteryWh = ((calcCredits / 2.0) * 50).toFixed(0);
    const fuelLiters = (calcCredits / 5.0).toFixed(1);

    return (
        <div
            style={isStandalone ? {
                minHeight: "100vh",
                width: "100%",
                backgroundColor: "var(--bg-primary, #04060A)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "32px 16px",
            } : {
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                backgroundColor: "rgba(5, 8, 14, 0.88)",
                backdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "calc(12px + var(--safe-top, 0px)) 14px calc(14px + var(--safe-bottom, 0px))",
            }}
            onClick={isStandalone ? undefined : () => {
                TacticalAudioEngine.playTap();
                onClose();
            }}
        >
            <div
                style={{
                    backgroundColor: "#0D1117",
                    border: "1px solid rgba(0, 230, 118, 0.3)",
                    borderRadius: "14px",
                    width: "100%",
                    maxWidth: isStandalone ? "860px" : "580px",
                    maxHeight: isStandalone ? "none" : "90vh",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 230, 118, 0.15)",
                    overflow: "hidden",
                    animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabecera Elástica */}
                <div
                    style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "linear-gradient(180deg, rgba(0, 230, 118, 0.08) 0%, transparent 100%)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                        <div
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "8px",
                                background: "rgba(0, 230, 118, 0.15)",
                                border: "1px solid rgba(0, 230, 118, 0.4)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <span style={{ fontSize: "1.2rem" }}>⚖️</span>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                                style={{
                                    fontSize: "1.05rem",
                                    fontWeight: 800,
                                    color: "#E9EDEF",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    letterSpacing: "0.5px",
                                }}
                            >
                                Economía Soberana RED
                            </div>
                            <div
                                style={{
                                    fontSize: "0.74rem",
                                    color: "var(--accent-emerald, #00E676)",
                                    fontFamily: "JetBrains Mono, monospace",
                                }}
                            >
                                RESPALDO POR UTILIDAD & CONSENSO COMUNITARIO
                            </div>
                        </div>
                    </div>
                    {isStandalone ? (
                        <button
                            type="button"
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                if (typeof window !== "undefined") window.location.href = "./";
                            }}
                            style={{
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                color: "#FFF",
                                fontSize: "0.78rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                flexShrink: 0,
                            }}
                        >
                            ← Ir a la App
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                onClose();
                            }}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "#8696A0",
                                fontSize: "1.4rem",
                                cursor: "pointer",
                                padding: "4px 8px",
                                flexShrink: 0,
                                lineHeight: 1,
                            }}
                            aria-label="Cerrar modal"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Scroller de Pestañas Táctil */}
                <div
                    className="scroll-container"
                    style={{
                        display: "flex",
                        gap: "6px",
                        padding: "10px 16px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        backgroundColor: "#0A0D13",
                        overflowX: "auto",
                        whiteSpace: "nowrap",
                        WebkitOverflowScrolling: "touch",
                    }}
                >
                    {[
                        { id: "faith" as GuideTab, label: "🗿 El Salto de Fe", desc: "Consenso Social" },
                        { id: "pow_vs_por" as GuideTab, label: "⚡ ¿Por qué no PoW?", desc: "Prueba de Utilidad" },
                        { id: "hacks" as GuideTab, label: "🛡️ Inmunidad a Hacks", desc: "Soberanía Off-Grid" },
                        { id: "calculator" as GuideTab, label: "⚖️ Calculadora", desc: "Paridad Táctica" },
                    ].map((tab) => {
                        const isSelected = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                style={{
                                    padding: "8px 14px",
                                    borderRadius: "8px",
                                    border: isSelected
                                        ? "1px solid rgba(0, 230, 118, 0.6)"
                                        : "1px solid rgba(255, 255, 255, 0.06)",
                                    background: isSelected
                                        ? "rgba(0, 230, 118, 0.14)"
                                        : "rgba(255, 255, 255, 0.03)",
                                    color: isSelected ? "#00E676" : "#8696A0",
                                    fontSize: "0.80rem",
                                    fontWeight: isSelected ? 700 : 500,
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-start",
                                    gap: "2px",
                                }}
                            >
                                <span>{tab.label}</span>
                                <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>{tab.desc}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Cuerpo del Modal con Contenido Educativo */}
                <div
                    style={{
                        padding: "18px 20px",
                        overflowY: "auto",
                        flex: 1,
                        fontSize: "0.88rem",
                        lineHeight: 1.55,
                        color: "#C9D1D9",
                    }}
                >
                    {/* PESTAÑA 1: EL SALTO DE FE */}
                    {activeTab === "faith" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: "8px",
                                    background: "rgba(255, 179, 0, 0.08)",
                                    border: "1px solid rgba(255, 179, 0, 0.3)",
                                    color: "#FFB300",
                                    fontSize: "0.82rem",
                                    fontWeight: 600,
                                }}
                            >
                                💡 "El dinero jamás ha sido metal ni papel; es un pacto social colectivo: un salto de fe de que otro ser humano lo aceptará mañana."
                            </div>

                            <RaiStonesInfographic />

                            <div>
                                <h4 style={{ color: "#fff", margin: "0 0 6px 0", fontSize: "0.95rem" }}>
                                    1. Las Piedras Rai de la Isla de Yap (Micronesia)
                                </h4>
                                <p style={{ margin: 0, color: "#8B949E" }}>
                                    Durante siglos, los nativos de Yap usaron como dinero enormes discos de piedra caliza de hasta 4 toneladas. Nadie movía las piedras: la aldea recordaba colectivamente quién era el dueño. Una piedra cayó al fondo del océano en una tormenta; la tribu acordó que la piedra seguía existiendo y continuó comprando tierras durante generaciones.
                                </p>
                            </div>

                            <div>
                                <h4 style={{ color: "#fff", margin: "0 0 6px 0", fontSize: "0.95rem" }}>
                                    2. Argentina 2001 y el Club del Trueque
                                </h4>
                                <p style={{ margin: 0, color: "#8B949E" }}>
                                    Cuando los bancos colapsaron y se congeló el efectivo, 6 millones de personas sobrevivieron emitiendo sus propios "Créditos" en papel. El respaldo no era oro en una bóveda, sino el pan, las consultas médicas y la ropa que los vecinos producían.
                                </p>
                            </div>

                            <div
                                style={{
                                    padding: "12px",
                                    borderRadius: "8px",
                                    background: "rgba(0, 230, 118, 0.06)",
                                    border: "1px solid rgba(0, 230, 118, 0.2)",
                                }}
                            >
                                <strong style={{ color: "#00E676" }}>¿Cómo le das valor a RED?:</strong> Si tú y tus vecinos acuerdan que 1 Vale RED equivale a un pan, un litro de combustible o una recarga de batería, **el vale ES dinero**, protegido matemáticamente contra falsificaciones mediante firmas Ed25519 en tu propio teléfono.
                            </div>
                        </div>
                    )}

                    {/* PESTAÑA 2: ¿POR QUÉ NO MINAMOS CON GPUS? */}
                    {activeTab === "pow_vs_por" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: "8px",
                                    background: "rgba(232, 33, 58, 0.08)",
                                    border: "1px solid rgba(232, 33, 58, 0.3)",
                                    color: "#FF6B7D",
                                    fontSize: "0.82rem",
                                }}
                            >
                                ⚠️ <strong>La falacia del pozo:</strong> Cavar un pozo gigante en el desierto por $50,000 y volver a taparlo por otros $50,000 gasta combustible y calor, pero el pozo tapado <strong>vale $0</strong> porque no generó utilidad humana.
                            </div>

                            <PowVsPorInfographic />

                            <table
                                style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    fontSize: "0.80rem",
                                    marginTop: "6px",
                                }}
                            >
                                <thead>
                                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "left" }}>
                                        <th style={{ padding: "8px 6px", color: "#8696A0" }}>Característica</th>
                                        <th style={{ padding: "8px 6px", color: "#FF6B7D" }}>Minería PoW Tradicional</th>
                                        <th style={{ padding: "8px 6px", color: "#00E676" }}>Proof-of-Relay (RED)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                                        <td style={{ padding: "8px 6px", fontWeight: 600 }}>Gasto Energético</td>
                                        <td style={{ padding: "8px 6px", color: "#8B949E" }}>Gigavatios en granjas industriales</td>
                                        <td style={{ padding: "8px 6px", color: "#E9EDEF" }}>Miliamperios de batería o panel solar</td>
                                    </tr>
                                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                                        <td style={{ padding: "8px 6px", fontWeight: 600 }}>Utilidad del Trabajo</td>
                                        <td style={{ padding: "8px 6px", color: "#8B949E" }}>Sudokus vacíos descartables</td>
                                        <td style={{ padding: "8px 6px", color: "#00E676" }}>Retransmite alertas SOS y mensajes vitales</td>
                                    </tr>
                                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                                        <td style={{ padding: "8px 6px", fontWeight: 600 }}>Respaldo Tangible</td>
                                        <td style={{ padding: "8px 6px", color: "#8B949E" }}>Especulación en exchanges</td>
                                        <td style={{ padding: "8px 6px", color: "#00E676" }}>Infraestructura física de comunicaciones</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: "8px 6px", fontWeight: 600 }}>Tasa de Emisión</td>
                                        <td style={{ padding: "8px 6px", color: "#8B949E" }}>Privilegio de grandes granjas</td>
                                        <td style={{ padding: "8px 6px", color: "#00E676" }}>+0.05 RED por cada KB retransmitido</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div style={{ fontSize: "0.80rem", color: "#8696A0", fontStyle: "italic" }}>
                                Cada crédito forjado en RED es el salario justo por haber mantenido viva y conectada la antena comunitaria de tu comarca.
                            </div>
                        </div>
                    )}

                    {/* PESTAÑA 3: INMUNIDAD A HACKS CENTRALIZADOS */}
                    {activeTab === "hacks" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: "8px",
                                    background: "rgba(0, 168, 132, 0.08)",
                                    border: "1px solid rgba(0, 168, 132, 0.3)",
                                    color: "#00E676",
                                    fontSize: "0.82rem",
                                }}
                            >
                                🔒 <strong>Axioma de Ciberseguridad:</strong> Toda plataforma que concentre claves en servidores en la nube o use puentes ("bridges") inter-cadenas termina siendo saqueada.
                            </div>

                            <div>
                                <h4 style={{ color: "#fff", margin: "0 0 6px 0", fontSize: "0.95rem" }}>
                                    El Robo de $570M USD a Binance (Octubre 2022)
                                </h4>
                                <p style={{ margin: 0, color: "#8B949E" }}>
                                    Un hacker descubrió un error en el puente centralizado <em>BSC Token Hub</em> de Binance. Falsificó una prueba matemática de Merkle y acuñó <strong>2 millones de tokens BNB de la nada</strong>, obligando a Binance a congelar manualmente su red para no quebrar.
                                </p>
                            </div>

                            <Web3BridgeHackInfographic />

                            <div>
                                <h4 style={{ color: "#fff", margin: "0 0 6px 0", fontSize: "0.95rem" }}>
                                    FTX, Celsius y Mt. Gox: La Falsa Custodia
                                </h4>
                                <p style={{ margin: 0, color: "#8B949E" }}>
                                    Millones de usuarios perdieron sus ahorros porque una corporación controlaba sus fondos. Cuando no eres el dueño absoluto de tus llaves criptográficas en tu propio hardware, tu dinero es rehén de terceros.
                                </p>
                            </div>

                            <div
                                style={{
                                    padding: "12px",
                                    borderRadius: "8px",
                                    background: "rgba(255, 255, 255, 0.03)",
                                    border: "1px solid rgba(255, 255, 255, 0.08)",
                                }}
                            >
                                <strong style={{ color: "#E9EDEF" }}>Por qué RED es Inmune:</strong>
                                <ul style={{ margin: "6px 0 0 0", paddingLeft: "18px", color: "#8696A0" }}>
                                    <li><strong>100% Fuera de Línea:</strong> Opera sin internet, sin servidores centralizados y sin puentes remotos.</li>
                                    <li><strong>Bóveda Biométrica Local:</strong> Las claves Ed25519 están en tu procesador móvil. Nadie puede congelar tus fondos.</li>
                                    <li><strong>Nullifiers Anti-Doble Gasto:</strong> Imposible fotocopiar o reutilizar vales gracias a identificadores criptográficos únicos.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* PESTAÑA 4: CALCULADORA DE PARIDAD */}
                    {activeTab === "calculator" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <SurvivalParityMatrixInfographic />

                            <div>
                                <label style={{ display: "block", fontSize: "0.80rem", color: "#8696A0", marginBottom: "6px" }}>
                                    Ingresa una cantidad en Créditos RED:
                                </label>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10000"
                                        value={calcCredits}
                                        onChange={(e) => setCalcCredits(Math.max(1, parseFloat(e.target.value) || 1))}
                                        style={{
                                            flex: 1,
                                            padding: "10px 14px",
                                            borderRadius: "8px",
                                            background: "rgba(255, 255, 255, 0.05)",
                                            border: "1px solid rgba(0, 230, 118, 0.3)",
                                            color: "#fff",
                                            fontSize: "1.1rem",
                                            fontWeight: 700,
                                            fontFamily: "JetBrains Mono, monospace",
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            TacticalAudioEngine.playTap();
                                            setCalcCredits(10);
                                        }}
                                        style={{
                                            padding: "0 14px",
                                            borderRadius: "8px",
                                            border: "1px solid rgba(255, 255, 255, 0.1)",
                                            background: "rgba(255, 255, 255, 0.05)",
                                            color: "#8696A0",
                                            cursor: "pointer",
                                            fontSize: "0.8rem",
                                        }}
                                    >
                                        Reset (10)
                                    </button>
                                </div>
                            </div>

                            {/* Panel de Equivalencias Fiduciarias */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: "10px",
                                }}
                            >
                                <div
                                    style={{
                                        padding: "12px",
                                        borderRadius: "8px",
                                        background: "rgba(0, 230, 118, 0.08)",
                                        border: "1px solid rgba(0, 230, 118, 0.25)",
                                    }}
                                >
                                    <div style={{ fontSize: "0.72rem", color: "#8696A0" }}>Paridad en Soles (PEN)</div>
                                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#00E676" }}>
                                        S/. {penEquivalent}
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "#8696A0" }}>1 RED = S/. 1.00 PEN</div>
                                </div>

                                <div
                                    style={{
                                        padding: "12px",
                                        borderRadius: "8px",
                                        background: "rgba(56, 189, 248, 0.08)",
                                        border: "1px solid rgba(56, 189, 248, 0.25)",
                                    }}
                                >
                                    <div style={{ fontSize: "0.72rem", color: "#8696A0" }}>Paridad en Dólares (USD)</div>
                                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38BDF8" }}>
                                        $ {usdEquivalent}
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "#8696A0" }}>Tasa ref. ~0.27 USD</div>
                                </div>
                            </div>

                            {/* Panel de Equivalencias de Materias Primas de Supervivencia */}
                            <div>
                                <div style={{ fontSize: "0.80rem", fontWeight: 700, color: "#E9EDEF", marginBottom: "8px" }}>
                                    Anclaje a Bienes Reales (Modo Apagón / Black Sky):
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.82rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
                                        <span style={{ color: "#8696A0" }}>💧 Agua Potable (3.0 RED/L):</span>
                                        <strong style={{ color: "#38BDF8" }}>≈ {waterLiters} Litros</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
                                        <span style={{ color: "#8696A0" }}>🍞 Raciones de Combate (10.0 RED/u):</span>
                                        <strong style={{ color: "#FFB300" }}>≈ {mreRations} Raciones (2000 kcal)</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
                                        <span style={{ color: "#8696A0" }}>⚡ Energía Batería (2.0 RED/50Wh):</span>
                                        <strong style={{ color: "#00E676" }}>≈ {batteryWh} Watt-hora</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
                                        <span style={{ color: "#8696A0" }}>⛽ Combustible (5.0 RED/L):</span>
                                        <strong style={{ color: "#E8213A" }}>≈ {fuelLiters} Litros</strong>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
                                        <span style={{ color: "#8696A0" }}>💊 Antibiótico / TCCC (15.0 RED/dosis):</span>
                                        <strong style={{ color: "#B388FF" }}>≈ {antibioticDoses} Dosis</strong>
                                    </div>
                                </div>
                            </div>

                            <OfflineMerchantFlowInfographic />

                            {onOpenWallet && (
                                <button
                                    onClick={() => {
                                        TacticalAudioEngine.playTap();
                                        onClose();
                                        onOpenWallet();
                                    }}
                                    style={{
                                        marginTop: "6px",
                                        padding: "12px",
                                        borderRadius: "8px",
                                        border: "none",
                                        background: "linear-gradient(135deg, #00A884 0%, #00E676 100%)",
                                        color: "#05080E",
                                        fontSize: "0.90rem",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                        boxShadow: "0 4px 15px rgba(0, 230, 118, 0.3)",
                                    }}
                                >
                                    <span>Ir a la Billetera para Emitir Vale</span>
                                    <span>➔</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Pie del Modal con Enlace a Documentos Maestros */}
                <div
                    style={{
                        padding: "12px 20px",
                        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                        backgroundColor: "#070A0F",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.75rem",
                        color: "#8696A0",
                    }}
                >
                    <span style={{ fontFamily: "JetBrains Mono, monospace" }}>
                        RED v126.1.0 • SOVEREIGN MESH ECONOMY
                    </span>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            if (typeof window !== "undefined") {
                                window.open("./economy.html", "_blank");
                            }
                        }}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--accent-emerald, #00E676)",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            padding: "2px 4px",
                        }}
                    >
                        Ver Manifiesto ↗
                    </button>
                </div>
            </div>
        </div>
    );
};
