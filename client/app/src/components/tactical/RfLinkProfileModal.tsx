"use client";

import React, { useState, useMemo } from "react";
import { rfPropagation, GeoPoint, RfLinkAnalysis } from "../../lib/tactical/RfPropagationEngine";

interface RfLinkProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    txNode?: { name: string; lat: number; lon: number; alt?: number };
    rxNode?: { name: string; lat: number; lon: number; alt?: number };
}

export const RfLinkProfileModal: React.FC<RfLinkProfileModalProps> = ({
    isOpen,
    onClose,
    txNode,
    rxNode
}) => {
    const [txAntennaHeight, setTxAntennaHeight] = useState<number>(3.0);
    const [rxAntennaHeight, setRxAntennaHeight] = useState<number>(3.0);
    const [freqMhz, setFreqMhz] = useState<number>(915.0);

    const hasValidCoordinates = useMemo(() => {
        const hasTx = txNode && typeof txNode.lat === 'number' && typeof txNode.lon === 'number' && (txNode.lat !== 0 || txNode.lon !== 0);
        const hasRx = rxNode && typeof rxNode.lat === 'number' && typeof rxNode.lon === 'number' && (rxNode.lat !== 0 || rxNode.lon !== 0);
        return Boolean(hasTx && hasRx);
    }, [txNode, rxNode]);

    const txGeo: GeoPoint = useMemo(() => ({
        lat: txNode?.lat ?? 0,
        lon: txNode?.lon ?? 0,
        altMeters: txNode?.alt ?? 0,
        antennaHeightMeters: txAntennaHeight
    }), [txNode, txAntennaHeight]);

    const rxGeo: GeoPoint = useMemo(() => ({
        lat: rxNode?.lat ?? 0,
        lon: rxNode?.lon ?? 0,
        altMeters: rxNode?.alt ?? 0,
        antennaHeightMeters: rxAntennaHeight
    }), [rxNode, rxAntennaHeight]);

    // Generate terrain profile (using synthetic profile based on start and end elevation)
    const terrain = useMemo(() => {
        return rfPropagation.generateSyntheticProfile(txGeo.altMeters, rxGeo.altMeters, 50, 25);
    }, [txGeo.altMeters, rxGeo.altMeters]);

    const analysis: RfLinkAnalysis = useMemo(() => {
        return rfPropagation.analyzeLink(txGeo, rxGeo, terrain, freqMhz);
    }, [txGeo, rxGeo, terrain, freqMhz]);

    if (!isOpen) return null;

    // SVG plotting parameters
    const svgWidth = 600;
    const svgHeight = 220;
    const padding = { top: 20, right: 30, bottom: 30, left: 45 };
    const plotWidth = svgWidth - padding.left - padding.right;
    const plotHeight = svgHeight - padding.top - padding.bottom;

    const minAlt = Math.min(...analysis.samples.map(s => s.terrainAltMeters), txGeo.altMeters, rxGeo.altMeters) - 10;
    const maxAlt = Math.max(...analysis.samples.map(s => s.losAltMeters + s.fresnelRadiusMeters), ...analysis.samples.map(s => s.totalObstacleAltMeters)) + 15;
    const altRange = Math.max(10, maxAlt - minAlt);

    const scaleX = (distKm: number) => padding.left + (distKm / (analysis.totalDistanceKm || 1)) * plotWidth;
    const scaleY = (alt: number) => padding.top + plotHeight - ((alt - minAlt) / altRange) * plotHeight;

    // Build SVG paths
    const terrainPath = analysis.samples.map((s, i) => {
        const x = scaleX(s.distanceKm);
        const y = scaleY(s.totalObstacleAltMeters);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ') + ` L ${scaleX(analysis.totalDistanceKm)} ${padding.top + plotHeight} L ${padding.left} ${padding.top + plotHeight} Z`;

    const losPath = `M ${scaleX(0)} ${scaleY(txGeo.altMeters + txAntennaHeight)} L ${scaleX(analysis.totalDistanceKm)} ${scaleY(rxGeo.altMeters + rxAntennaHeight)}`;

    const fresnelUpperPath = analysis.samples.map((s, i) => {
        const x = scaleX(s.distanceKm);
        const y = scaleY(s.losAltMeters + s.fresnelRadiusMeters);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const fresnelLowerPath = analysis.samples.map((s, i) => {
        const x = scaleX(s.distanceKm);
        const y = scaleY(s.losAltMeters - s.fresnelRadiusMeters);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const fresnelColor = analysis.status === 'CLEAR_LOS' ? '#00E676' : (analysis.status === 'PARTIAL_DIFFRACTION' ? '#FFD600' : '#FF1744');

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 0, 0, 0.88)",
                backdropFilter: "blur(14px)",
                padding: "12px"
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: "740px",
                    borderRadius: "16px",
                    backgroundColor: "#0d131a",
                    border: "1px solid rgba(0, 229, 255, 0.4)",
                    boxShadow: "0 0 40px rgba(0,229,255,0.2)",
                    color: "#FFFFFF",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: "92vh"
                }}
            >
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#00e5ff]/20 bg-[#121c26]">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📡</span>
                        <div>
                            <h2 className="text-lg font-bold tracking-wider text-[#00e5ff] uppercase">Perfil Táctico RF & Zonas de Fresnel</h2>
                            <p className="text-xs text-gray-400">Análisis de Línea de Vista (LoS), Curvatura Terrestre y Margen de Enlace LoRa</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-400 hover:text-white hover:bg-white/10 transition"
                    >
                        ✕
                    </button>
                </div>

                {!hasValidCoordinates ? (
                    <div className="p-10 text-center space-y-4 my-auto">
                        <div className="text-4xl">📡</div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Receptor / Objetivo Táctico No Seleccionado
                        </h3>
                        <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                            Para calcular el modelo de propagación electromagnética y la primera zona de Fresnel en 915 MHz, seleccione un nodo peer en la malla o fije un objetivo táctico en el mapa.
                        </p>
                        <button
                            onClick={onClose}
                            className="px-5 py-2 rounded-xl bg-[#00e5ff]/20 border border-[#00e5ff]/50 text-[#00e5ff] text-xs font-bold uppercase tracking-wider hover:bg-[#00e5ff]/30 transition"
                        >
                            Volver al Mapa
                        </button>
                    </div>
                ) : (
                    <div className="p-6 overflow-y-auto space-y-6">
                    {/* Status Badge & Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-[#16222f] border border-white/5">
                            <span className="text-xs text-gray-400 uppercase font-mono">Estado Enlace</span>
                            <div className="text-sm font-bold mt-1" style={{ color: fresnelColor }}>
                                {analysis.status === 'CLEAR_LOS' && '✅ LoS Despejado'}
                                {analysis.status === 'PARTIAL_DIFFRACTION' && '⚠️ Difracción Parcial'}
                                {analysis.status === 'OBSTRUCTED_NLOS' && '🚫 NLoS Obstruido'}
                            </div>
                        </div>
                        <div className="p-3 rounded-xl bg-[#16222f] border border-white/5">
                            <span className="text-xs text-gray-400 uppercase font-mono">Distancia</span>
                            <div className="text-sm font-bold text-white mt-1">{analysis.totalDistanceKm} km</div>
                        </div>
                        <div className="p-3 rounded-xl bg-[#16222f] border border-white/5">
                            <span className="text-xs text-gray-400 uppercase font-mono">Pérdida FSPL</span>
                            <div className="text-sm font-bold text-white mt-1">-{analysis.fsplDb} dB</div>
                        </div>
                        <div className="p-3 rounded-xl bg-[#16222f] border border-white/5">
                            <span className="text-xs text-gray-400 uppercase font-mono">Margen Señal</span>
                            <div className={`text-sm font-bold mt-1 ${analysis.fadeMarginDb > 15 ? 'text-[#00e676]' : (analysis.fadeMarginDb > 0 ? 'text-[#ffd600]' : 'text-[#ff1744]')}`}>
                                +{analysis.fadeMarginDb} dB
                            </div>
                        </div>
                    </div>

                    {/* SVG Profile Chart */}
                    <div className="relative rounded-xl bg-[#080d12] border border-white/10 p-2 overflow-x-auto">
                        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto select-none font-mono text-[10px]">
                            {/* Grid Lines */}
                            <line x1={padding.left} y1={padding.top} x2={padding.left + plotWidth} y2={padding.top} stroke="#ffffff10" />
                            <line x1={padding.left} y1={padding.top + plotHeight / 2} x2={padding.left + plotWidth} y2={padding.top + plotHeight / 2} stroke="#ffffff10" />
                            <line x1={padding.left} y1={padding.top + plotHeight} x2={padding.left + plotWidth} y2={padding.top + plotHeight} stroke="#ffffff20" />

                            {/* Axis Labels */}
                            <text x={padding.left - 5} y={padding.top + 10} fill="#888" textAnchor="end">{Math.round(maxAlt)}m</text>
                            <text x={padding.left - 5} y={padding.top + plotHeight} fill="#888" textAnchor="end">{Math.round(minAlt)}m</text>
                            <text x={padding.left} y={svgHeight - 8} fill="#888">0 km (TX)</text>
                            <text x={padding.left + plotWidth} y={svgHeight - 8} fill="#888" textAnchor="end">{analysis.totalDistanceKm} km (RX)</text>

                            {/* Fresnel Zone Ellipsoid */}
                            <path d={fresnelUpperPath} fill="none" stroke={fresnelColor} strokeWidth="1.5" strokeDasharray="3,3" opacity="0.8" />
                            <path d={fresnelLowerPath} fill="none" stroke={fresnelColor} strokeWidth="1.5" strokeDasharray="3,3" opacity="0.8" />

                            {/* Line of Sight Path */}
                            <path d={losPath} fill="none" stroke="#00e5ff" strokeWidth="2" />

                            {/* Terrain Polygon */}
                            <path d={terrainPath} fill="rgba(80, 50, 40, 0.45)" stroke="#8d6e63" strokeWidth="1.5" />

                            {/* Antennas */}
                            {/* TX Antenna Mast */}
                            <line
                                x1={scaleX(0)}
                                y1={scaleY(txGeo.altMeters)}
                                x2={scaleX(0)}
                                y2={scaleY(txGeo.altMeters + txAntennaHeight)}
                                stroke="#00e5ff"
                                strokeWidth="3"
                            />
                            <circle cx={scaleX(0)} cy={scaleY(txGeo.altMeters + txAntennaHeight)} r="4" fill="#00e5ff" />

                            {/* RX Antenna Mast */}
                            <line
                                x1={scaleX(analysis.totalDistanceKm)}
                                y1={scaleY(rxGeo.altMeters)}
                                x2={scaleX(analysis.totalDistanceKm)}
                                y2={scaleY(rxGeo.altMeters + rxAntennaHeight)}
                                stroke="#00e676"
                                strokeWidth="3"
                            />
                            <circle cx={scaleX(analysis.totalDistanceKm)} cy={scaleY(rxGeo.altMeters + rxAntennaHeight)} r="4" fill="#00e676" />
                        </svg>

                        {/* Legend */}
                        <div className="flex items-center justify-center gap-6 mt-2 text-xs font-mono text-gray-400">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#00e5ff] inline-block"></span> Línea de Vista (LoS)</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-b border-dashed inline-block" style={{ borderColor: fresnelColor }}></span> 1ª Zona Fresnel (60%)</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-[#8d6e63]/60 inline-block rounded-xs"></span> Terreno + Curvatura</span>
                        </div>
                    </div>

                    {/* Recommendation Card */}
                    <div className="p-4 rounded-xl bg-[#121c26] border border-[#00e5ff]/20">
                        <div className="text-xs font-bold text-[#00e5ff] uppercase tracking-wider mb-1">Recomendación Táctica</div>
                        <p className="text-xs text-gray-300">
                            {analysis.status === 'CLEAR_LOS' && (
                                <>El enlace LoRa dispone de más del 60% de la 1ª Zona de Fresnel libre. Margen de desvanecimiento suficiente para transmisiones a largo alcance (SF10-SF12).</>
                            )}
                            {analysis.status === 'PARTIAL_DIFFRACTION' && (
                                <>El enlace presenta difracción por obstáculo ({analysis.diffractionLossDb} dB atenuación). Elevar antena a <strong>{analysis.recommendedTxAntennaHeightMeters}m</strong> para alcanzar línea de vista limpia.</>
                            )}
                            {analysis.status === 'OBSTRUCTED_NLOS' && (
                                <>Bloqueo por relieve topográfico ({analysis.diffractionLossDb} dB atenuación severa). Se requiere elevar antena a <strong>{analysis.recommendedTxAntennaHeightMeters}m</strong> o emplear un nodo repetidor táctico intermedio.</>
                            )}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div>
                            <label className="text-xs font-mono text-gray-400 block mb-1">Altura Antena TX ({txAntennaHeight} m)</label>
                            <input
                                type="range"
                                min="1"
                                max="25"
                                step="0.5"
                                value={txAntennaHeight}
                                onChange={(e) => setTxAntennaHeight(parseFloat(e.target.value))}
                                className="w-full accent-[#00e5ff]"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-mono text-gray-400 block mb-1">Altura Antena RX ({rxAntennaHeight} m)</label>
                            <input
                                type="range"
                                min="1"
                                max="25"
                                step="0.5"
                                value={rxAntennaHeight}
                                onChange={(e) => setRxAntennaHeight(parseFloat(e.target.value))}
                                className="w-full accent-[#00e676]"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-mono text-gray-400 block mb-1">Frecuencia Portadora</label>
                            <select
                                value={freqMhz}
                                onChange={(e) => setFreqMhz(parseFloat(e.target.value))}
                                className="w-full bg-[#16222f] border border-white/10 rounded-lg p-2 text-xs text-white"
                            >
                                <option value="915.0">915 MHz (América / AS923)</option>
                                <option value="868.0">868 MHz (Europa / EU868)</option>
                                <option value="433.0">433 MHz (UHF VHF Táctico)</option>
                                <option value="2400.0">2.4 GHz (Alta Velocidad)</option>
                            </select>
                        </div>
                    </div>
                    </div>
                )}
            </div>
        </div>
    );
};
