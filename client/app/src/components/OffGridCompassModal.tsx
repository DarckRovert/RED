"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { OffGridNavigationEngine, Landmark, Waypoint, TriangulatedPosition } from "../lib/OffGridNavigationEngine";

export function OffGridCompassModal() {
    const { navigate } = useRedStore();

    const [heading, setHeading] = useState<number>(0);
    const [solarAzimuth, setSolarAzimuth] = useState<{ azimuthDegrees: number; elevationDegrees: number; isNight: boolean }>({ azimuthDegrees: 0, elevationDegrees: 0, isNight: false });
    const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [utmString, setUtmString] = useState<string>("Buscando señal GPS...");
    
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
    const [newWpName, setNewWpName] = useState("");
    const [newWpDist, setNewWpDist] = useState("500");
    const [newWpBearing, setNewWpBearing] = useState("45");

    // Dynamic Radar Scale: 500m, 1000m (1km), 2000m (2km), 5000m (5km)
    const [radarMaxDist, setRadarMaxDist] = useState<number>(2000);

    // Resection Triangulation State
    const [landmark1, setLandmark1] = useState<Landmark>({ id: "1", name: "Pico Norte", lat: 4.6097, lon: -74.0817 });
    const [bearing1, setBearing1] = useState<string>("45");
    const [landmark2, setLandmark2] = useState<Landmark>({ id: "2", name: "Torre Este", lat: 4.6150, lon: -74.0720 });
    const [bearing2, setBearing2] = useState<string>("135");
    const [triangulatedPos, setTriangulatedPos] = useState<TriangulatedPosition | null>(null);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Vector Low-Pass Filter state for silky smooth compass without 0<->360 jumps
    const vecX = useRef<number>(0);
    const vecY = useRef<number>(0);

    useEffect(() => {
        // Load stored waypoints
        try {
            const saved = localStorage.getItem("red_offgrid_waypoints");
            if (saved) setWaypoints(JSON.parse(saved));
        } catch {}

        // Listen for device orientation with single listener registration & vector low-pass filter
        const handleOrientation = (e: DeviceOrientationEvent) => {
            let compass: number | null = null;
            const webkitHeading = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
            if (webkitHeading !== undefined && webkitHeading !== null) {
                compass = webkitHeading;
            } else if (e.alpha !== null && e.alpha !== undefined) {
                compass = (360 - e.alpha) % 360;
            }

            if (compass === null) return;

            // Vector Low-Pass Filter: Prevents 0 <-> 360 degree wraparound jumps
            const rad = (compass * Math.PI) / 180;
            const curSin = Math.sin(rad);
            const curCos = Math.cos(rad);

            if (vecX.current === 0 && vecY.current === 0) {
                vecX.current = curCos;
                vecY.current = curSin;
            } else {
                vecX.current = vecX.current * 0.82 + curCos * 0.18;
                vecY.current = vecY.current * 0.82 + curSin * 0.18;
            }

            let smoothDeg = Math.round((Math.atan2(vecY.current, vecX.current) * 180) / Math.PI);
            smoothDeg = ((smoothDeg % 360) + 360) % 360;

            setHeading(smoothDeg);
        };

        const eventName = ("ondeviceorientationabsolute" in window) ? "deviceorientationabsolute" : "deviceorientation";
        window.addEventListener(eventName, handleOrientation, true);

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
            window.removeEventListener(eventName, handleOrientation, true);
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
        const displayWidth = 260;
        const displayHeight = 260;

        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.scale(dpr, dpr);

        const cx = displayWidth / 2;
        const cy = displayHeight / 2;
        const radius = Math.min(cx, cy) - 22;

        ctx.clearRect(0, 0, displayWidth, displayHeight);

        // Draw Outer Bezel Ring
        ctx.strokeStyle = "rgba(0, 230, 118, 0.5)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw Fixed Top Lubber Line (Heading Pointer Triangle at 12 o'clock)
        ctx.fillStyle = "#E8213A";
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius - 2);
        ctx.lineTo(cx - 7, cy - radius - 14);
        ctx.lineTo(cx + 7, cy - radius - 14);
        ctx.closePath();
        ctx.fill();

        // Draw Concentric Radar Range Rings with distance labels
        const ringScales = [0.33, 0.66, 1.0];
        ringScales.forEach(scale => {
            const r = (radius - 12) * scale;
            ctx.strokeStyle = "rgba(0, 230, 118, 0.18)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Ring distance label
            const labelDist = Math.round((radarMaxDist * scale));
            ctx.fillStyle = "rgba(0, 230, 118, 0.4)";
            ctx.font = "9px monospace";
            ctx.textAlign = "left";
            ctx.fillText(`${labelDist}m`, cx + 4, cy - r + 10);
        });

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((-heading * Math.PI) / 180);

        // Draw Compass Degree Ticks (Every 30 degrees)
        for (let deg = 0; deg < 360; deg += 30) {
            const rad = (deg * Math.PI) / 180;
            const x1 = Math.sin(rad) * (radius - 2);
            const y1 = -Math.cos(rad) * (radius - 2);
            const x2 = Math.sin(rad) * (radius - 10);
            const y2 = -Math.cos(rad) * (radius - 10);

            ctx.strokeStyle = deg % 90 === 0 ? "#00E676" : "rgba(255,255,255,0.3)";
            ctx.lineWidth = deg % 90 === 0 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Draw Cardinal Points
        ctx.fillStyle = "#00E676";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText("N", 0, -radius + 16);
        ctx.fillStyle = "#888";
        ctx.fillText("E", radius - 16, 0);
        ctx.fillText("S", 0, radius - 16);
        ctx.fillText("W", -radius + 16, 0);

        // Draw Sun / Moon Azimuth Marker
        const sunRad = (solarAzimuth.azimuthDegrees * Math.PI) / 180;
        const sunX = Math.sin(sunRad) * (radius - 30);
        const sunY = -Math.cos(sunRad) * (radius - 30);
        ctx.fillStyle = solarAzimuth.isNight ? "#38BDF8" : "#FFB300";
        ctx.shadowColor = solarAzimuth.isNight ? "#38BDF8" : "#FFB300";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw Triangulation Landmarks if userCoords is set
        if (userCoords) {
            [landmark1, landmark2].forEach((lm, idx) => {
                if (lm.lat !== 0 && lm.lon !== 0) {
                    const rel = OffGridNavigationEngine.calculateDistanceAndBearing(userCoords.lat, userCoords.lon, lm.lat, lm.lon);
                    const lmRad = (rel.bearingDegrees * Math.PI) / 180;
                    const normDistRatio = Math.min(1.0, rel.distanceMeters / radarMaxDist);
                    const distPx = normDistRatio * (radius - 32);
                    const lx = Math.sin(lmRad) * distPx;
                    const ly = -Math.cos(lmRad) * distPx;

                    ctx.fillStyle = idx === 0 ? "#38BDF8" : "#A855F7";
                    ctx.beginPath();
                    ctx.moveTo(lx, ly - 6);
                    ctx.lineTo(lx - 5, ly + 5);
                    ctx.lineTo(lx + 5, ly + 5);
                    ctx.closePath();
                    ctx.fill();
                }
            });
        }

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
            const normDistRatio = Math.min(1.0, liveDist / radarMaxDist);
            const distPx = normDistRatio * (radius - 32);
            const wx = Math.sin(wpRad) * distPx;
            const wy = -Math.cos(wpRad) * distPx;

            ctx.fillStyle = "#00E676";
            ctx.shadowColor = "#00E676";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(wx, wy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        ctx.restore();

        // Draw Center Crosshair
        ctx.strokeStyle = "#E8213A";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx, cy + 12);
        ctx.moveTo(cx - 12, cy);
        ctx.lineTo(cx + 12, cy);
        ctx.stroke();
    }, [heading, solarAzimuth, waypoints, userCoords, radarMaxDist, landmark1, landmark2]);

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
            alert("No se pudo calcular intersección: los rumbos no intersectan hacia adelante o son paralelos.");
        }
    };

    const handleAdoptTriangulatedPos = () => {
        if (triangulatedPos) {
            const coords = { lat: triangulatedPos.lat, lon: triangulatedPos.lon };
            setUserCoords(coords);
            setUtmString(OffGridNavigationEngine.gpsToUtm(coords.lat, coords.lon));
            setSolarAzimuth(OffGridNavigationEngine.calculateSolarAzimuth(coords.lat, coords.lon));
            try { localStorage.setItem("red_last_known_gps", JSON.stringify(coords)); } catch {}
            alert(`✅ Ubicación fijada a la posición triangulada: Lat ${coords.lat} | Lon ${coords.lon}`);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(4,6,10,0.98)', color: '#fff',
            display: 'flex', flexDirection: 'column',
            padding: '14px 14px 90px 14px',
            overflowY: 'auto', overflowX: 'hidden',
            backdropFilter: 'blur(12px)', boxSizing: 'border-box'
        }}>
            <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '12px', background: 'linear-gradient(135deg, #00E676, #00A859)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🧭</div>
                        <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Radar Topográfico Off-Grid</div>
                            <div style={{ fontSize: '0.7rem', color: '#00E676' }}>Navegación Táctica Sin Conexión & Geodesia</div>
                        </div>
                    </div>
                    <button onClick={() => navigate('sidebar')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>✕ Cerrar</button>
                </div>

                {/* Compass Radar Canvas Card */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                    <canvas ref={canvasRef} style={{ width: 260, height: 260 }} />
                    
                    {/* Heading & Zoom Selector */}
                    <div style={{ marginTop: '10px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#00E676', fontFamily: 'monospace' }}>{heading}°</div>
                            <div style={{ fontSize: '0.68rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Rumbo Geomagnético Actual</div>
                        </div>

                        {/* Radar Range Scale Selector */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            {[500, 1000, 2000, 5000].map(dist => (
                                <button
                                    key={dist}
                                    onClick={() => setRadarMaxDist(dist)}
                                    style={{
                                        padding: '5px 10px', borderRadius: '6px',
                                        background: radarMaxDist === dist ? '#00E676' : 'rgba(255,255,255,0.06)',
                                        color: radarMaxDist === dist ? '#000' : '#AAA',
                                        border: 'none', fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer'
                                    }}
                                >
                                    {dist >= 1000 ? `${dist / 1000}km` : `${dist}m`}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tactical Stats & UTM Coordinate Box */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#38BDF8', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>📍 Cuadrícula Táctica UTM</div>
                    <div style={{ background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,230,118,0.3)', fontFamily: 'monospace', fontSize: '1rem', color: '#00E676', textAlign: 'center', fontWeight: 800, letterSpacing: '0.5px', overflowX: 'auto' }}>
                        {utmString}
                    </div>
                    {userCoords ? (
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem', color: '#AAA', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Lat: <strong style={{ color: '#fff' }}>{userCoords.lat.toFixed(5)}°</strong></span>
                            <span>Lon: <strong style={{ color: '#fff' }}>{userCoords.lon.toFixed(5)}°</strong></span>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.75rem', color: '#FFB300', fontStyle: 'italic' }}>⚠️ Obteniendo fijación de satélites GPS...</div>
                    )}

                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFB300', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{solarAzimuth.isNight ? "🌙 Reloj Nocturno" : "☀️ Reloj Solar"} (Norte Verdadero)</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem', color: '#DDD', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Azimut: <strong style={{ color: solarAzimuth.isNight ? '#38BDF8' : '#FFB300' }}>{solarAzimuth.azimuthDegrees}°</strong></span>
                        <span>Elevación: <strong style={{ color: solarAzimuth.isNight ? '#38BDF8' : '#FFB300' }}>{solarAzimuth.elevationDegrees}°</strong></span>
                    </div>
                </div>

                {/* Resection Triangulation Card */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                    <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38BDF8' }}>📐 Triangulación por Resección (2 Puntos)</div>
                        <div style={{ fontSize: '0.72rem', color: '#AAA', marginTop: '2px' }}>Alinea 2 puntos visibles de referencia para calcular tu posición sin GPS:</div>
                    </div>

                    {/* Landmark 1 Card */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#38BDF8' }}>📍 Punto 1 de Referencia</span>
                            {userCoords && (
                                <button
                                    onClick={() => setLandmark1({ ...landmark1, lat: userCoords.lat, lon: userCoords.lon })}
                                    style={{ background: 'transparent', border: 'none', color: '#00E676', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Usar GPS Actual
                                </button>
                            )}
                        </div>
                        <input value={landmark1.name} onChange={e => setLandmark1({ ...landmark1, name: e.target.value })} style={{ width: '100%', padding: '7px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', boxSizing: 'border-box' }} placeholder="Nombre (ej. Pico Norte)" />
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input value={landmark1.lat} onChange={e => setLandmark1({ ...landmark1, lat: parseFloat(e.target.value) || 0 })} style={{ flex: 1, minWidth: 0, padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Lat 1" />
                            <input value={landmark1.lon} onChange={e => setLandmark1({ ...landmark1, lon: parseFloat(e.target.value) || 0 })} style={{ flex: 1, minWidth: 0, padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Lon 1" />
                            <input value={bearing1} onChange={e => setBearing1(e.target.value)} style={{ width: '65px', padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Rumbo°" />
                        </div>
                    </div>

                    {/* Landmark 2 Card */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#A855F7' }}>📍 Punto 2 de Referencia</span>
                            {userCoords && (
                                <button
                                    onClick={() => setLandmark2({ ...landmark2, lat: userCoords.lat, lon: userCoords.lon })}
                                    style={{ background: 'transparent', border: 'none', color: '#00E676', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Usar GPS Actual
                                </button>
                            )}
                        </div>
                        <input value={landmark2.name} onChange={e => setLandmark2({ ...landmark2, name: e.target.value })} style={{ width: '100%', padding: '7px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', boxSizing: 'border-box' }} placeholder="Nombre (ej. Torre Este)" />
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input value={landmark2.lat} onChange={e => setLandmark2({ ...landmark2, lat: parseFloat(e.target.value) || 0 })} style={{ flex: 1, minWidth: 0, padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Lat 2" />
                            <input value={landmark2.lon} onChange={e => setLandmark2({ ...landmark2, lon: parseFloat(e.target.value) || 0 })} style={{ flex: 1, minWidth: 0, padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Lon 2" />
                            <input value={bearing2} onChange={e => setBearing2(e.target.value)} style={{ width: '65px', padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Rumbo°" />
                        </div>
                    </div>

                    <button onClick={handleCalculateTriangulation} style={{ width: '100%', padding: '10px', background: '#38BDF8', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', marginTop: '2px' }}>
                        ⚡ CALCULAR POSICIÓN TRIANGULADA
                    </button>

                    {triangulatedPos && (
                        <div style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', padding: '12px', borderRadius: '10px', color: '#00E676', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.82rem' }}>
                                🎯 Posición Triangulada: Lat {triangulatedPos.lat} | Lon {triangulatedPos.lon} (Precisión ~{triangulatedPos.accuracyMeters}m)
                            </div>
                            <button
                                onClick={handleAdoptTriangulatedPos}
                                style={{ padding: '6px 10px', background: '#00E676', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 800, fontSize: '0.74rem', cursor: 'pointer', alignSelf: 'flex-start' }}
                            >
                                🎯 Adoptar Posición como Ubicación Actual
                            </button>
                        </div>
                    )}
                </div>

                {/* Waypoints Management Card */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                    <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFF' }}>📌 Registrar Waypoint de Supervivencia</div>
                        <div style={{ fontSize: '0.72rem', color: '#AAA', marginTop: '2px' }}>Calcula la posición de destino por distancia y rumbo:</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input value={newWpName} onChange={e => setNewWpName(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.82rem', boxSizing: 'border-box' }} placeholder="Nombre (ej. Fuente de Agua)" />
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input value={newWpDist} onChange={e => setNewWpDist(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.82rem', boxSizing: 'border-box' }} placeholder="Distancia (m)" />
                            <input value={newWpBearing} onChange={e => setNewWpBearing(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.82rem', boxSizing: 'border-box' }} placeholder="Rumbo°" />
                            <button onClick={handleAddWaypoint} style={{ background: '#00E676', color: '#000', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem' }}>+ Agregar</button>
                        </div>
                    </div>

                    <div style={{ marginTop: '4px', maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {waypoints.length === 0 ? (
                            <div style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>No hay waypoints registrados aún.</div>
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
                                    <div key={wp.id} style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                                        <span>📍 <strong>{wp.name}</strong></span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ color: '#00E676', fontWeight: 700, fontFamily: 'monospace' }}>{liveBrg}° • {liveDst}m</span>
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
    );
}
