"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { OffGridNavigationEngine, Landmark, Waypoint, TriangulatedPosition } from "../lib/OffGridNavigationEngine";

export function OffGridCompassModal() {
    const { navigate } = useRedStore();

    const [heading, setHeading] = useState<number>(0);
    const [solarAzimuth, setSolarAzimuth] = useState<{ azimuthDegrees: number; elevationDegrees: number }>({ azimuthDegrees: 0, elevationDegrees: 0 });
    const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [utmString, setUtmString] = useState<string>("Buscando GPS...");
    
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
                    console.warn("[OffGridCompass] GPS watch error:", err.message);
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

    // Draw 2D Canvas Compass HUD
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(cx, cy) - 20;

        ctx.clearRect(0, 0, width, height);

        // Draw Outer Ring
        ctx.strokeStyle = "rgba(0, 230, 118, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((-heading * Math.PI) / 180);

        // Draw Cardinal Points
        ctx.fillStyle = "#00E676";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText("N", 0, -radius + 15);
        ctx.fillStyle = "#888";
        ctx.fillText("E", radius - 15, 0);
        ctx.fillText("S", 0, radius - 15);
        ctx.fillText("W", -radius + 15, 0);

        // Draw Sun Azimuth Marker
        const sunRad = (solarAzimuth.azimuthDegrees * Math.PI) / 180;
        const sunX = Math.sin(sunRad) * (radius - 30);
        const sunY = -Math.cos(sunRad) * (radius - 30);
        ctx.fillStyle = "#FFB300";
        ctx.beginPath();
        ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
        ctx.fill();

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
            ctx.beginPath();
            ctx.arc(wx, wy, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();

        // Draw Center Sight
        ctx.strokeStyle = "#E8213A";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx, cy + 12);
        ctx.moveTo(cx - 12, cy);
        ctx.lineTo(cx + 12, cy);
        ctx.stroke();
    }, [heading, solarAzimuth, waypoints, userCoords]);

    const handleAddWaypoint = () => {
        if (!newWpName.trim()) return;
        const dist = parseFloat(newWpDist) || 100;
        const brg = parseFloat(newWpBearing) || 0;
        
        // Calculate true geodesic target lat/lon using direct geodesic formula
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
            display: 'flex', flexDirection: 'column', padding: '20px',
            overflowY: 'auto', backdropFilter: 'blur(12px)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #00E676, #00A859)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🧭</div>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Radar Topográfico Off-Grid</div>
                        <div style={{ fontSize: '0.72rem', color: '#00E676' }}>Navegación Táctica Sin Conexión & Triangulación</div>
                    </div>
                </div>
                <button onClick={() => navigate('sidebar')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>✕ Cerrar</button>
            </div>

            {/* Main HUD */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Compass Canvas Box */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <canvas ref={canvasRef} width={260} height={260} style={{ width: 260, height: 260 }} />
                    <div style={{ marginTop: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 900, color: '#00E676', fontFamily: 'monospace' }}>{heading}°</div>
                        <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Azimut Geomagnético Actual</div>
                    </div>
                </div>

                {/* Tactical Stats & UTM Coordinate Box */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38BDF8', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>📍 Coordenadas Tácticas UTM</div>
                    <div style={{ background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '10px', fontFamily: 'monospace', fontSize: '1rem', color: '#00E676', textAlign: 'center', fontWeight: 800 }}>
                        {utmString}
                    </div>
                    {userCoords && (
                        <div style={{ fontSize: '0.78rem', color: '#AAA', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Lat: {userCoords.lat.toFixed(5)}°</span>
                            <span>Lon: {userCoords.lon.toFixed(5)}°</span>
                        </div>
                    )}

                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFB300', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginTop: '6px' }}>☀️ Reloj Solar (Norte Verdadero)</div>
                    <div style={{ fontSize: '0.8rem', color: '#DDD', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Azimut Solar: <strong>{solarAzimuth.azimuthDegrees}°</strong></span>
                        <span>Elevación: <strong>{solarAzimuth.elevationDegrees}°</strong></span>
                    </div>
                </div>
            </div>

            {/* Triangulation & Waypoints Section */}
            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {/* Resection Triangulation */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '16px', padding: '16px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38BDF8', marginBottom: '10px' }}>📐 Triangulación por Resección (2 Puntos)</div>
                    <div style={{ fontSize: '0.75rem', color: '#AAA', marginBottom: '12px' }}>Alinea 2 puntos visibles de referencia para calcular tu posición sin GPS:</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                        {/* Landmark 1 Inputs */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <input value={landmark1.name} onChange={e => setLandmark1({ ...landmark1, name: e.target.value })} style={{ flex: 1, minWidth: '90px', padding: '6px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} placeholder="Punto 1" />
                            <input value={landmark1.lat} onChange={e => setLandmark1({ ...landmark1, lat: parseFloat(e.target.value) || 0 })} style={{ width: '75px', padding: '6px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} placeholder="Lat 1" />
                            <input value={landmark1.lon} onChange={e => setLandmark1({ ...landmark1, lon: parseFloat(e.target.value) || 0 })} style={{ width: '75px', padding: '6px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} placeholder="Lon 1" />
                            <input value={bearing1} onChange={e => setBearing1(e.target.value)} style={{ width: '60px', padding: '6px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} placeholder="Rumbo°" />
                        </div>
                        {/* Landmark 2 Inputs */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <input value={landmark2.name} onChange={e => setLandmark2({ ...landmark2, name: e.target.value })} style={{ flex: 1, minWidth: '90px', padding: '6px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} placeholder="Punto 2" />
                            <input value={landmark2.lat} onChange={e => setLandmark2({ ...landmark2, lat: parseFloat(e.target.value) || 0 })} style={{ width: '75px', padding: '6px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} placeholder="Lat 2" />
                            <input value={landmark2.lon} onChange={e => setLandmark2({ ...landmark2, lon: parseFloat(e.target.value) || 0 })} style={{ width: '75px', padding: '6px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} placeholder="Lon 2" />
                            <input value={bearing2} onChange={e => setBearing2(e.target.value)} style={{ width: '60px', padding: '6px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} placeholder="Rumbo°" />
                        </div>

                        <button onClick={handleCalculateTriangulation} style={{ padding: '8px 12px', background: '#38BDF8', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', marginTop: '4px' }}>
                            ⚡ CALCULAR POSICIÓN TRIANGULADA
                        </button>

                        {triangulatedPos && (
                            <div style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', padding: '10px', borderRadius: '8px', color: '#00E676', fontWeight: 700 }}>
                                🎯 Posición Triangulada: Lat {triangulatedPos.lat} | Lon {triangulatedPos.lon} (Precisión ~{triangulatedPos.accuracyMeters}m)
                            </div>
                        )}
                    </div>
                </div>

                {/* Waypoints Management */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFF', marginBottom: '10px' }}>📌 Registrar Waypoint de Supervivencia</div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input value={newWpName} onChange={e => setNewWpName(e.target.value)} style={{ flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} placeholder="Nombre (ej. Fuente Agua)" />
                        <input value={newWpDist} onChange={e => setNewWpDist(e.target.value)} style={{ width: '70px', padding: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} placeholder="Dist (m)" />
                        <input value={newWpBearing} onChange={e => setNewWpBearing(e.target.value)} style={{ width: '60px', padding: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} placeholder="Rumbo°" />
                        <button onClick={handleAddWaypoint} style={{ background: '#00E676', color: '#000', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>+</button>
                    </div>

                    <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {waypoints.map(wp => {
                            let liveBrg = wp.bearingDegrees;
                            let liveDst = wp.distanceMeters;

                            if (userCoords && (wp.lat !== 0 || wp.lon !== 0)) {
                                const rel = OffGridNavigationEngine.calculateDistanceAndBearing(userCoords.lat, userCoords.lon, wp.lat, wp.lon);
                                liveBrg = rel.bearingDegrees;
                                liveDst = rel.distanceMeters;
                            }

                            return (
                                <div key={wp.id} style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                                    <span>📍 <strong>{wp.name}</strong></span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: '#38BDF8' }}>{liveBrg}° • {liveDst}m</span>
                                        <button onClick={() => handleDeleteWaypoint(wp.id)} style={{ background: 'transparent', border: 'none', color: '#E8213A', cursor: 'pointer', fontSize: '0.9rem' }}>🗑️</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
