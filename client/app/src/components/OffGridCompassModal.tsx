"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { OffGridNavigationEngine, Landmark, Waypoint, TriangulatedPosition } from "../lib/OffGridNavigationEngine";

export function OffGridCompassModal() {
    const { navigate } = useRedStore();

    const [heading, setHeading] = useState<number>(0);
    const [solarAzimuth, setSolarAzimuth] = useState<{ azimuthDegrees: number; elevationDegrees: number }>({ azimuthDegrees: 0, elevationDegrees: 0 });
    const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [utmString, setUtmString] = useState<string>("Buscando GPS en espacio abierto...");
    
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
    const [newWpName, setNewWpName] = useState("");
    const [newWpDist, setNewWpDist] = useState("500");
    const [newWpBearing, setNewWpBearing] = useState("45");

    // Resection Triangulation State
    const [landmark1, setLandmark1] = useState<Landmark>({ id: "1", name: "Pico Norte", lat: 4.6097, lon: -74.0817 });
    const [bearing1, setBearing1] = useState<string>("45");
    const [landmark2, setLandmark2] = useState<Landmark>({ id: "2", name: "Torre Este", lat: 4.6150, lon: -74.0720 });
    const [bearing2, setBearing2] = useState<string>("135");
    const [triangulatedPos, setTriangulatedPos] = useState<TriangulatedPosition | null>(null);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        // Load stored waypoints
        try {
            const saved = localStorage.getItem("red_offgrid_waypoints");
            if (saved) setWaypoints(JSON.parse(saved));
        } catch {}

        // Listen for device orientation for geomagnetic compass with exponential low-pass filter
        const handleOrientation = (e: DeviceOrientationEvent) => {
            let compass = e.alpha || 0;
            const webkitHeading = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
            if (webkitHeading !== undefined) {
                compass = webkitHeading;
            } else if (e.alpha !== null) {
                compass = 360 - e.alpha;
            }
            const rawHeading = Math.round(compass % 360);
            setHeading(prev => {
                const diff = (rawHeading - prev + 540) % 360 - 180;
                return Math.round((prev + diff * 0.35 + 360) % 360);
            });
        };

        window.addEventListener("deviceorientationabsolute", handleOrientation, true);
        window.addEventListener("deviceorientation", handleOrientation, true);

        // Restore last known GPS coordinates if available
        try {
            const cachedGps = localStorage.getItem("red_last_known_gps");
            if (cachedGps) {
                const parsed = JSON.parse(cachedGps);
                setUserCoords(parsed);
                setUtmString(OffGridNavigationEngine.gpsToUtm(parsed.lat, parsed.lon));
                setSolarAzimuth(OffGridNavigationEngine.calculateSolarAzimuth(parsed.lat, parsed.lon));
            }
        } catch {}

        // Continuous real-time GPS tracking via watchPosition
        let watchId: number | null = null;
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    const coords = { lat, lon };
                    setUserCoords(coords);
                    setUtmString(OffGridNavigationEngine.gpsToUtm(lat, lon));
                    setSolarAzimuth(OffGridNavigationEngine.calculateSolarAzimuth(lat, lon));
                    try { localStorage.setItem("red_last_known_gps", JSON.stringify(coords)); } catch {}
                },
                (err) => {
                    console.warn("[OffGridCompass] GPS watch warning:", err.message);
                },
                { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
            );
        }

        return () => {
            window.removeEventListener("deviceorientationabsolute", handleOrientation);
            window.removeEventListener("deviceorientation", handleOrientation);
            if (watchId !== null && navigator.geolocation) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, []);

    // Draw High-DPI 2D Canvas Compass Radar HUD
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const displayWidth = 280;
        const displayHeight = 280;

        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.scale(dpr, dpr);

        const cx = displayWidth / 2;
        const cy = displayHeight / 2;
        const radius = Math.min(cx, cy) - 22;

        ctx.clearRect(0, 0, displayWidth, displayHeight);

        // Draw Outer Glow Ring
        ctx.strokeStyle = "rgba(0, 230, 118, 0.5)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw Concentric Radar Range Rings (500m, 1000m, 1500m)
        [0.35, 0.65, 0.95].forEach(scale => {
            ctx.strokeStyle = "rgba(0, 230, 118, 0.15)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((-heading * Math.PI) / 180);

        // Draw Compass Degree Ticks (Every 30 degrees)
        for (let deg = 0; deg < 360; deg += 30) {
            const rad = (deg * Math.PI) / 180;
            const x1 = Math.sin(rad) * (radius - 4);
            const y1 = -Math.cos(rad) * (radius - 4);
            const x2 = Math.sin(rad) * (radius - 12);
            const y2 = -Math.cos(rad) * (radius - 12);

            ctx.strokeStyle = deg % 90 === 0 ? "#00E676" : "rgba(255,255,255,0.3)";
            ctx.lineWidth = deg % 90 === 0 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Draw Cardinal Points
        ctx.fillStyle = "#00E676";
        ctx.font = "bold 15px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText("N", 0, -radius + 18);
        ctx.fillStyle = "#888";
        ctx.fillText("E", radius - 18, 0);
        ctx.fillText("S", 0, radius - 18);
        ctx.fillText("W", -radius + 18, 0);

        // Draw Sun Azimuth Marker
        const sunRad = (solarAzimuth.azimuthDegrees * Math.PI) / 180;
        const sunX = Math.sin(sunRad) * (radius - 32);
        const sunY = -Math.cos(sunRad) * (radius - 32);
        ctx.fillStyle = "#FFB300";
        ctx.shadowColor = "#FFB300";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw Waypoints on Compass Radar with live distance and bearing relative to current GPS
        waypoints.forEach(wp => {
            let liveBearing = wp.bearingDegrees;
            let liveDist = wp.distanceMeters;

            if (userCoords && (wp.lat !== 0 || wp.lon !== 0)) {
                const rel = OffGridNavigationEngine.calculateDistanceAndBearing(userCoords.lat, userCoords.lon, wp.lat, wp.lon);
                liveBearing = rel.bearingDegrees;
                liveDist = rel.distanceMeters;
            }

            const wpRad = (liveBearing * Math.PI) / 180;
            const distPx = Math.min(radius - 35, (liveDist / 2000) * (radius - 35));
            const wx = Math.sin(wpRad) * distPx;
            const wy = -Math.cos(wpRad) * distPx;

            ctx.fillStyle = "#38BDF8";
            ctx.shadowColor = "#38BDF8";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(wx, wy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        ctx.restore();

        // Draw Center Sight Crosshair
        ctx.strokeStyle = "#E8213A";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx, cy + 14);
        ctx.moveTo(cx - 14, cy);
        ctx.lineTo(cx + 14, cy);
        ctx.stroke();
    }, [heading, solarAzimuth, waypoints, userCoords]);

    const handleAddWaypoint = () => {
        if (!newWpName.trim()) return;
        const dist = parseFloat(newWpDist) || 100;
        const brg = parseFloat(newWpBearing) || 0;
        
        const startLat = userCoords ? userCoords.lat : 4.6097;
        const startLon = userCoords ? userCoords.lon : -74.0817;
        const target = OffGridNavigationEngine.calculateDestinationPoint(startLat, startLon, dist, brg);

        const wp: Waypoint = {
            id: Date.now().toString(),
            name: newWpName.trim(),
            lat: target.lat,
            lon: target.lon,
            bearingDegrees: brg,
            distanceMeters: dist,
            createdAt: Date.now()
        };

        const updated = [...waypoints, wp];
        setWaypoints(updated);
        try { localStorage.setItem("red_offgrid_waypoints", JSON.stringify(updated)); } catch {}
        setNewWpName("");
    };

    const handleDeleteWaypoint = (id: string) => {
        const updated = waypoints.filter(w => w.id !== id);
        setWaypoints(updated);
        try { localStorage.setItem("red_offgrid_waypoints", JSON.stringify(updated)); } catch {}
    };

    const handleCalculateTriangulation = () => {
        const b1 = parseFloat(bearing1);
        const b2 = parseFloat(bearing2);
        const res = OffGridNavigationEngine.calculateResection(landmark1, b1, landmark2, b2);
        if (res) {
            setTriangulatedPos(res);
        } else {
            alert("No se pudo calcular intersección: las líneas de rumbo son paralelas.");
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(4,6,10,0.96)', color: '#fff',
            display: 'flex', flexDirection: 'column', padding: '16px',
            overflowY: 'auto', backdropFilter: 'blur(12px)'
        }}>
            <div style={{ maxWidth: '960px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'linear-gradient(135deg, #00E676, #00A859)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>🧭</div>
                        <div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>Radar Topográfico Off-Grid</div>
                            <div style={{ fontSize: '0.72rem', color: '#00E676' }}>Navegación Táctica Sin Conexión & Geodesia</div>
                        </div>
                    </div>
                    <button onClick={() => navigate('sidebar')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}>✕ Cerrar</button>
                </div>

                {/* Main HUD: Radar Canvas + Tactical Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {/* Compass Canvas Box */}
                    <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <canvas ref={canvasRef} style={{ width: 280, height: 280 }} />
                        <div style={{ marginTop: '14px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#00E676', fontFamily: 'monospace' }}>{heading}°</div>
                            <div style={{ fontSize: '0.72rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Rumbo Geomagnético Actual</div>
                        </div>
                    </div>

                    {/* Tactical Stats & UTM Coordinate Box */}
                    <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38BDF8', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>📍 Cuadrícula Táctica UTM</div>
                        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(0,230,118,0.3)', fontFamily: 'monospace', fontSize: '1.05rem', color: '#00E676', textAlign: 'center', fontWeight: 800, letterSpacing: '0.5px' }}>
                            {utmString}
                        </div>
                        {userCoords ? (
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', color: '#AAA', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Lat: <strong style={{ color: '#fff' }}>{userCoords.lat.toFixed(5)}°</strong></span>
                                <span>Lon: <strong style={{ color: '#fff' }}>{userCoords.lon.toFixed(5)}°</strong></span>
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.75rem', color: '#FFB300', fontStyle: 'italic' }}>⚠️ Obteniendo fijación de satélites GPS...</div>
                        )}

                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#FFB300', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginTop: '4px' }}>☀️ Azimut Solar (Norte Verdadero)</div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', color: '#DDD', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Azimut Solar: <strong style={{ color: '#FFB300' }}>{solarAzimuth.azimuthDegrees}°</strong></span>
                            <span>Elevación: <strong style={{ color: '#FFB300' }}>{solarAzimuth.elevationDegrees}°</strong></span>
                        </div>
                    </div>
                </div>

                {/* Triangulation & Waypoints Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px' }}>
                    {/* Resection Triangulation */}
                    <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38BDF8' }}>📐 Triangulación por Resección (2 Puntos)</div>
                            <div style={{ fontSize: '0.74rem', color: '#AAA', marginTop: '2px' }}>Alinea 2 puntos visibles de referencia para calcular tu posición sin GPS:</div>
                        </div>

                        {/* Landmark 1 Card */}
                        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#38BDF8' }}>📍 Punto 1 de Referencia</div>
                            <input value={landmark1.name} onChange={e => setLandmark1({ ...landmark1, name: e.target.value })} style={{ width: '100%', padding: '7px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="Nombre (ej. Pico Norte)" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                                <input value={landmark1.lat} onChange={e => setLandmark1({ ...landmark1, lat: parseFloat(e.target.value) || 0 })} style={{ padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem' }} placeholder="Lat 1" />
                                <input value={landmark1.lon} onChange={e => setLandmark1({ ...landmark1, lon: parseFloat(e.target.value) || 0 })} style={{ padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem' }} placeholder="Lon 1" />
                                <input value={bearing1} onChange={e => setBearing1(e.target.value)} style={{ padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem' }} placeholder="Rumbo°" />
                            </div>
                        </div>

                        {/* Landmark 2 Card */}
                        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#38BDF8' }}>📍 Punto 2 de Referencia</div>
                            <input value={landmark2.name} onChange={e => setLandmark2({ ...landmark2, name: e.target.value })} style={{ width: '100%', padding: '7px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem' }} placeholder="Nombre (ej. Torre Este)" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                                <input value={landmark2.lat} onChange={e => setLandmark2({ ...landmark2, lat: parseFloat(e.target.value) || 0 })} style={{ padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem' }} placeholder="Lat 2" />
                                <input value={landmark2.lon} onChange={e => setLandmark2({ ...landmark2, lon: parseFloat(e.target.value) || 0 })} style={{ padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem' }} placeholder="Lon 2" />
                                <input value={bearing2} onChange={e => setBearing2(e.target.value)} style={{ padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem' }} placeholder="Rumbo°" />
                            </div>
                        </div>

                        <button onClick={handleCalculateTriangulation} style={{ padding: '10px', background: '#38BDF8', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', marginTop: '2px' }}>
                            ⚡ CALCULAR POSICIÓN TRIANGULADA
                        </button>

                        {triangulatedPos && (
                            <div style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', padding: '12px', borderRadius: '10px', color: '#00E676', fontWeight: 700, fontSize: '0.82rem' }}>
                                🎯 Posición Triangulada: Lat {triangulatedPos.lat} | Lon {triangulatedPos.lon} (Precisión ~{triangulatedPos.accuracyMeters}m)
                            </div>
                        )}
                    </div>

                    {/* Waypoints Management */}
                    <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFF' }}>📌 Registrar Waypoint de Supervivencia</div>
                            <div style={{ fontSize: '0.74rem', color: '#AAA', marginTop: '2px' }}>Calcula la posición de destino por distancia y rumbo:</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input value={newWpName} onChange={e => setNewWpName(e.target.value)} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.82rem' }} placeholder="Nombre (ej. Fuente de Agua)" />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px' }}>
                                <input value={newWpDist} onChange={e => setNewWpDist(e.target.value)} style={{ padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.82rem' }} placeholder="Distancia (m)" />
                                <input value={newWpBearing} onChange={e => setNewWpBearing(e.target.value)} style={{ padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.82rem' }} placeholder="Rumbo°" />
                                <button onClick={handleAddWaypoint} style={{ background: '#00E676', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem' }}>+ Agregar</button>
                            </div>
                        </div>

                        <div style={{ marginTop: '6px', maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {waypoints.length === 0 ? (
                                <div style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>No hay waypoints registrados aún.</div>
                            ) : (
                                waypoints.map(wp => {
                                    let liveBrg = wp.bearingDegrees;
                                    let liveDst = wp.distanceMeters;

                                    if (userCoords && (wp.lat !== 0 || wp.lon !== 0)) {
                                        const rel = OffGridNavigationEngine.calculateDistanceAndBearing(userCoords.lat, userCoords.lon, wp.lat, wp.lon);
                                        liveBrg = rel.bearingDegrees;
                                        liveDst = rel.distanceMeters;
                                    }

                                    return (
                                        <div key={wp.id} style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                            <span>📍 <strong>{wp.name}</strong></span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ color: '#38BDF8', fontWeight: 700, fontFamily: 'monospace' }}>{liveBrg}° • {liveDst}m</span>
                                                <button onClick={() => handleDeleteWaypoint(wp.id)} style={{ background: 'transparent', border: 'none', color: '#E8213A', cursor: 'pointer', fontSize: '0.95rem' }}>🗑️</button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
