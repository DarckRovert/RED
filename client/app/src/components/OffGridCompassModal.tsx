"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import { useRedStore } from "../store/useRedStore";
import { OffGridNavigationEngine, Landmark, Waypoint, TacticalTarget, TriangulatedPosition } from "../lib/OffGridNavigationEngine";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { offlineTileCacheEngine } from "../lib/storage/OfflineTileCacheEngine";
import { magneticDetector, MagneticTelemetry } from "../lib/sensors/MagneticAnomalyDetectorEngine";
import { CelestialNavigationEngine, CelestialEphemeris } from "../lib/sensors/CelestialNavigationEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { pedestrianDeadReckoning, PdrState } from "../lib/sensors/PedestrianDeadReckoningEngine";
import { TacticalLocationEngine, TacticalLocation } from "../lib/sensors/TacticalLocationEngine";
import { tacticalCompass, CompassTelemetry } from "../lib/sensors/TacticalCompassEngine";
import { meshRouter } from "../lib/mesh/meshRouter";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { TacIcon } from "./ui/TacIcon";

export function OffGridCompassModal() {
    const { navigate, identity } = useRedStore();
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<"radar" | "map" | "resection" | "waypoints">("radar");

    // Intercepción LIFO de hardware Android y tecla Escape
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (activeTab !== "radar") {
                setActiveTab("radar");
                return true;
            }
            navigate('sidebar');
            return true;
        });
        return () => unregister();
    }, [activeTab, navigate]);

    // Magnetic Anomaly State
    const [magTelemetry, setMagTelemetry] = useState<MagneticTelemetry>(() => magneticDetector.getTelemetry());

    useEffect(() => {
        magneticDetector.startListening();
        const unsub = magneticDetector.subscribe(setMagTelemetry);
        return () => {
            unsub();
            magneticDetector.stopListening();
        };
    }, []);

    // Posición y Geodesia Base
    const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [utmString, setUtmString] = useState<string>("Buscando señal GPS...");

    // Odometría y Navegación Inercial PDR
    const [pdrState, setPdrState] = useState<PdrState>(() => pedestrianDeadReckoning.getState());
    const pdrOriginRef = useRef<{ lat: number; lon: number } | null>(null);

    useEffect(() => {
        const unsub = pedestrianDeadReckoning.subscribe((state) => {
            setPdrState(state);
        });
        return () => unsub();
    }, []);

    const togglePdrTracking = useCallback(() => {
        if (pdrState.isTracking) {
            pedestrianDeadReckoning.stopTracking();
            pdrOriginRef.current = null;
            toast.info("Rastreo inercial PDR detenido");
        } else {
            let baseLat = userCoords?.lat;
            let baseLon = userCoords?.lon;
            if (baseLat === undefined || baseLon === undefined) {
                const last = TacticalLocationEngine.getLastKnownLocation();
                if (last && TacticalLocationEngine.isValidCoordinates(last.lat, last.lon)) {
                    baseLat = last.lat!;
                    baseLon = last.lon!;
                } else {
                    try {
                        const cached = localStorage.getItem("red_last_known_gps");
                        if (cached) {
                            const parsed = JSON.parse(cached);
                            baseLat = parsed.lat;
                            baseLon = parsed.lon ?? parsed.lng;
                        }
                    } catch {}
                }
            }
            if (typeof baseLat === "number" && typeof baseLon === "number" && isFinite(baseLat) && isFinite(baseLon)) {
                pdrOriginRef.current = { lat: baseLat, lon: baseLon };
            }
            pedestrianDeadReckoning.reset();
            pedestrianDeadReckoning.startTracking();
            toast.success("Rastreo inercial PDR iniciado (Acelerómetro & Giroscopio activos)");
        }
    }, [pdrState.isTracking, userCoords]);

    const handleResetPdr = useCallback(() => {
        pedestrianDeadReckoning.reset();
        if (userCoords) {
            pdrOriginRef.current = { lat: userCoords.lat, lon: userCoords.lon };
        }
        toast.info("Odometría inercial puesta a cero");
    }, [userCoords]);

    const [compassTelemetry, setCompassTelemetry] = useState<CompassTelemetry>(() => tacticalCompass.getTelemetry());
    const heading = compassTelemetry.headingDeg;

    useEffect(() => {
        const unsub = tacticalCompass.subscribe(setCompassTelemetry);
        return () => unsub();
    }, []);

    const [solarAzimuth, setSolarAzimuth] = useState<{ azimuthDegrees: number; elevationDegrees: number; isNight: boolean }>({ azimuthDegrees: 0, elevationDegrees: 0, isNight: false });

    // Tactical Target Navigation State (Persisted in memory & localStorage)
    const [target, setTarget] = useState<TacticalTarget | null>(null);
    
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
    const [newWpName, setNewWpName] = useState("");
    const [newWpDist, setNewWpDist] = useState("500");
    const [newWpBearing, setNewWpBearing] = useState("45");

    // Dynamic Radar Scale: 500m, 1000m (1km), 2000m (2km), 5000m (5km)
    const [radarMaxDist, setRadarMaxDist] = useState<number>(2000);

    // Resection Triangulation State with Permanent Storage & Dynamic Location Defaults
    const [landmark1, setLandmark1] = useState<Landmark>({ id: "1", name: "Punto Referencia A", lat: 0, lon: 0 });
    const [bearing1, setBearing1] = useState<string>("45");
    const [landmark2, setLandmark2] = useState<Landmark>({ id: "2", name: "Punto Referencia B", lat: 0, lon: 0 });
    const [bearing2, setBearing2] = useState<string>("135");
    const [triangulatedPos, setTriangulatedPos] = useState<TriangulatedPosition | null>(null);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const leafletMapRef = useRef<any>(null);
    const markersGroupRef = useRef<any>(null);

    // One-time initialization guard to prevent GPS watch ticks from overwriting user typing input
    const hasInitializedLandmarks = useRef<boolean>(false);
    const ephemCacheRef = useRef<{ data: any; ts: number; lat: number; lon: number } | null>(null);

    // Load initial stored values from localStorage
    useEffect(() => {
        let hasStoredLm1 = false;
        let hasStoredLm2 = false;

        try {
            const savedTarget = localStorage.getItem("red_tactical_target_point") || localStorage.getItem("red_active_target");
            if (savedTarget) {
                const parsed = JSON.parse(savedTarget);
                const targetLat = typeof parsed.lat === "number" ? parsed.lat : undefined;
                const targetLon = typeof parsed.lon === "number" ? parsed.lon : (typeof parsed.lng === "number" ? parsed.lng : undefined);
                if (targetLat !== undefined && targetLon !== undefined) {
                    setTarget({
                        lat: targetLat,
                        lon: targetLon,
                        name: parsed.name || "Blanco Táctico Activo",
                        createdAt: parsed.createdAt || Date.now()
                    });
                }
            }

            const savedWps = localStorage.getItem("red_offgrid_waypoints");
            if (savedWps) setWaypoints(JSON.parse(savedWps));

            const savedLm1 = localStorage.getItem("red_offgrid_landmark1");
            if (savedLm1) {
                setLandmark1(JSON.parse(savedLm1));
                hasStoredLm1 = true;
            }

            const savedLm2 = localStorage.getItem("red_offgrid_landmark2");
            if (savedLm2) {
                setLandmark2(JSON.parse(savedLm2));
                hasStoredLm2 = true;
            }

            const savedB1 = localStorage.getItem("red_offgrid_bearing1");
            if (savedB1) setBearing1(savedB1);

            const savedB2 = localStorage.getItem("red_offgrid_bearing2");
            if (savedB2) setBearing2(savedB2);
        } catch {}

        // Restore last known GPS coordinates via TacticalLocationEngine & cache
        const lastKnown = TacticalLocationEngine.getLastKnownLocation();
        if (lastKnown && TacticalLocationEngine.isValidCoordinates(lastKnown.lat, lastKnown.lon)) {
            const coords = { lat: lastKnown.lat!, lon: lastKnown.lon! };
            setUserCoords(coords);
            setUtmString(OffGridNavigationEngine.gpsToUtm(coords.lat, coords.lon));
            setSolarAzimuth(OffGridNavigationEngine.calculateSolarAzimuth(coords.lat, coords.lon));
        } else {
            try {
                const cachedGps = localStorage.getItem("red_last_known_gps");
                if (cachedGps) {
                    const parsed = JSON.parse(cachedGps);
                    const coords = { lat: parsed.lat, lon: parsed.lon ?? parsed.lng };
                    setUserCoords(coords);
                    setUtmString(OffGridNavigationEngine.gpsToUtm(coords.lat, coords.lon));
                    setSolarAzimuth(OffGridNavigationEngine.calculateSolarAzimuth(coords.lat, coords.lon));
                }
            } catch {}
        }

        // Continuous real-time GPS tracking via TacticalLocationEngine
        const unsubGps = TacticalLocationEngine.watchLocation((loc) => {
            if (!TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) return;
            const lat = loc.lat!;
            const lon = loc.lon!;
            const coords = { lat, lon };
            setUserCoords(coords);
            setUtmString(OffGridNavigationEngine.gpsToUtm(lat, lon));
            setSolarAzimuth(OffGridNavigationEngine.calculateSolarAzimuth(lat, lon));
            try { localStorage.setItem("red_last_known_gps", JSON.stringify({ lat, lng: lon, lon, timestamp: Date.now() })); } catch {}

            // Dynamically set landmark defaults ONCE on first GPS fix to avoid overwriting user typing input
            if (!hasInitializedLandmarks.current) {
                hasInitializedLandmarks.current = true;
                setLandmark1(prev => {
                    if (prev.lat === 0 && prev.lon === 0 && !hasStoredLm1) {
                        return { ...prev, lat: Math.round((lat + 0.003) * 100000) / 100000, lon: Math.round((lon + 0.003) * 100000) / 100000 };
                    }
                    return prev;
                });
                setLandmark2(prev => {
                    if (prev.lat === 0 && prev.lon === 0 && !hasStoredLm2) {
                        return { ...prev, lat: Math.round((lat - 0.003) * 100000) / 100000, lon: Math.round((lon + 0.005) * 100000) / 100000 };
                    }
                    return prev;
                });
            }
        });

        return () => {
            if (unsubGps) unsubGps();
        };
    }, []);

    // Posición táctica efectiva: Si PDR está activo y se tiene un punto de anclaje geodésico, proyectar vector inercial; si no, usar GPS directo
    const activeCoords: { lat: number; lon: number } | null = (pdrState.isTracking && pdrOriginRef.current)
        ? {
            lat: Math.round((pdrOriginRef.current.lat + (pdrState.displacementNorthMeters / 111139)) * 100000) / 100000,
            lon: Math.round((pdrOriginRef.current.lon + (pdrState.displacementEastMeters / (111139 * Math.max(0.01, Math.cos((pdrOriginRef.current.lat * Math.PI) / 180))))) * 100000) / 100000
        }
        : userCoords;

    // Sincronizar pdrOrigin si PDR ya estaba activo al montar o cuando llega un fix geodésico
    useEffect(() => {
        if (pdrState.isTracking && !pdrOriginRef.current) {
            let baseLat = userCoords?.lat;
            let baseLon = userCoords?.lon;
            if (baseLat === undefined || baseLon === undefined) {
                const last = TacticalLocationEngine.getLastKnownLocation();
                if (last && TacticalLocationEngine.isValidCoordinates(last.lat, last.lon)) {
                    baseLat = last.lat!;
                    baseLon = last.lon!;
                }
            }
            if (typeof baseLat === "number" && typeof baseLon === "number" && isFinite(baseLat) && isFinite(baseLon)) {
                pdrOriginRef.current = { lat: baseLat, lon: baseLon };
            }
        }
    }, [pdrState.isTracking, userCoords]);

    // Mantener UTM y posición astronómica sincronizados con la posición activa (GPS o PDR inercial)
    useEffect(() => {
        if (activeCoords) {
            setUtmString(OffGridNavigationEngine.gpsToUtm(activeCoords.lat, activeCoords.lon));
            setSolarAzimuth(OffGridNavigationEngine.calculateSolarAzimuth(activeCoords.lat, activeCoords.lon));
        }
    }, [activeCoords?.lat, activeCoords?.lon]);

    // Guidance computed in real-time if activeCoords and target exist
    const tacticalGuidance = (activeCoords && target)
        ? OffGridNavigationEngine.calculateTacticalGuidance(activeCoords.lat, activeCoords.lon, target.lat, target.lon, heading)
        : null;

    // Set or update tactical target point (synchronized across all navigation modals)
    const handleSetTarget = useCallback((lat: number, lon: number, name?: string) => {
        const newTarget: TacticalTarget = {
            lat: Math.round(lat * 100000) / 100000,
            lon: Math.round(lon * 100000) / 100000,
            name: name || "Punto Objetivo Táctico",
            createdAt: Date.now()
        };
        setTarget(newTarget);
        try {
            localStorage.setItem("red_tactical_target_point", JSON.stringify(newTarget));
            localStorage.setItem("red_active_target", JSON.stringify(newTarget));
        } catch {}

        if (activeCoords) {
            const g = OffGridNavigationEngine.calculateTacticalGuidance(activeCoords.lat, activeCoords.lon, newTarget.lat, newTarget.lon, heading);
            toast.success(`🎯 Objetivo Fijado: ${g.formattedDistance} | Rumbo ${g.bearingDegrees}° ${g.cardinal}`);
        } else {
            toast.success(`🎯 Objetivo Fijado: [${newTarget.lat.toFixed(5)}, ${newTarget.lon.toFixed(5)}]`);
        }
    }, [activeCoords, heading]);

    // Clear tactical target point
    const handleClearTarget = useCallback(() => {
        setTarget(null);
        try {
            localStorage.removeItem("red_tactical_target_point");
            localStorage.removeItem("red_active_target");
        } catch {}
        toast.info("Objetivo táctico cancelado");
    }, []);

    // Proyectar posición estimada PDR (Dead Reckoning) hacia el sistema de coordenadas
    const handleAdoptPdrCoords = useCallback(() => {
        let baseLat = pdrOriginRef.current?.lat ?? userCoords?.lat;
        let baseLon = pdrOriginRef.current?.lon ?? userCoords?.lon;

        if (baseLat === undefined || baseLon === undefined) {
            try {
                const cached = localStorage.getItem("red_last_known_gps");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    baseLat = parsed.lat;
                    baseLon = parsed.lon ?? parsed.lng;
                }
            } catch {}
        }

        if (typeof baseLat !== "number" || typeof baseLon !== "number" || !isFinite(baseLat) || !isFinite(baseLon)) {
            toast.warning("Se requiere una posición inicial de referencia GPS para proyectar el vector inercial PDR");
            return;
        }

        // Proyección geodésica ortogonal: 1 grado lat ~ 111139 m
        const dLat = pdrState.displacementNorthMeters / 111139;
        const latRad = (baseLat * Math.PI) / 180;
        const metersPerDegLon = 111139 * Math.cos(latRad);
        const dLon = metersPerDegLon > 0 ? (pdrState.displacementEastMeters / metersPerDegLon) : 0;

        const estimatedLat = Math.round((baseLat + dLat) * 100000) / 100000;
        const estimatedLon = Math.round((baseLon + dLon) * 100000) / 100000;

        const coords = { lat: estimatedLat, lon: estimatedLon };
        setUserCoords(coords);
        pdrOriginRef.current = coords;
        setUtmString(OffGridNavigationEngine.gpsToUtm(coords.lat, coords.lon));
        setSolarAzimuth(OffGridNavigationEngine.calculateSolarAzimuth(coords.lat, coords.lon));
        try {
            localStorage.setItem("red_last_known_gps", JSON.stringify({ ...coords, lng: coords.lon, timestamp: Date.now(), source: "PDR_INERTIAL" }));
        } catch {}
        toast.success(`📍 Posición PDR inyectada al sistema: [${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}]`);
    }, [userCoords, pdrState]);

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

        // Draw Sun & Moon Celestial Markers (Jean Meeus Astronomical Equations con Caché de 10s)
        try {
            const curLat = activeCoords?.lat || 0;
            const curLon = activeCoords?.lon || 0;
            const now = Date.now();
            let ephem = ephemCacheRef.current?.data;

            if (
                !ephem ||
                !ephemCacheRef.current ||
                (now - ephemCacheRef.current.ts > 10000) ||
                Math.abs(curLat - ephemCacheRef.current.lat) > 0.001 ||
                Math.abs(curLon - ephemCacheRef.current.lon) > 0.001
            ) {
                ephem = CelestialNavigationEngine.getInstance().calculateEphemeris(curLat, curLon, new Date());
                ephemCacheRef.current = { data: ephem, ts: now, lat: curLat, lon: curLon };
            }

            // Sun Marker (☀️ Amber)
            const sunRad = (ephem.sun.azimuthDeg * Math.PI) / 180;
            const sunX = Math.sin(sunRad) * (radius - 30);
            const sunY = -Math.cos(sunRad) * (radius - 30);
            ctx.fillStyle = ephem.isDaylight ? "#FFB300" : "rgba(255, 179, 0, 0.4)";
            ctx.shadowColor = "#FFB300";
            ctx.shadowBlur = ephem.isDaylight ? 10 : 2;
            ctx.beginPath();
            ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
            ctx.fill();

            // Moon Marker (🌙 Cyan/Silver)
            const moonRad = (ephem.moon.azimuthDeg * Math.PI) / 180;
            const moonX = Math.sin(moonRad) * (radius - 30);
            const moonY = -Math.cos(moonRad) * (radius - 30);
            ctx.fillStyle = "#38BDF8";
            ctx.shadowColor = "#38BDF8";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(moonX, moonY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } catch {
            const sunRad = (solarAzimuth.azimuthDegrees * Math.PI) / 180;
            const sunX = Math.sin(sunRad) * (radius - 30);
            const sunY = -Math.cos(sunRad) * (radius - 30);
            ctx.fillStyle = solarAzimuth.isNight ? "#38BDF8" : "#FFB300";
            ctx.beginPath();
            ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw Active Tactical Target Vector Ray & Marker on Radar Canvas
        if (activeCoords && target) {
            const rel = OffGridNavigationEngine.calculateDistanceAndBearing(activeCoords.lat, activeCoords.lon, target.lat, target.lon);
            const targetRad = (rel.bearingDegrees * Math.PI) / 180;
            const isBeyondRange = rel.distanceMeters > radarMaxDist;
            const normDistRatio = isBeyondRange ? 1.0 : (rel.distanceMeters / radarMaxDist);
            const distPx = normDistRatio * (radius - 28);
            const tx = Math.sin(targetRad) * distPx;
            const ty = -Math.cos(targetRad) * distPx;

            // Draw vector line from center to target
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(tx, ty);
            ctx.strokeStyle = "#E8213A";
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw target reticle / marker
            ctx.shadowColor = "#E8213A";
            ctx.shadowBlur = 12;
            ctx.fillStyle = "#E8213A";
            ctx.beginPath();
            ctx.arc(tx, ty, 7, 0, Math.PI * 2);
            ctx.fill();

            // Inner crosshair
            ctx.strokeStyle = "#FFF";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(tx, ty, 4, 0, Math.PI * 2);
            ctx.moveTo(tx - 9, ty);
            ctx.lineTo(tx + 9, ty);
            ctx.moveTo(tx, ty - 9);
            ctx.lineTo(tx, ty + 9);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Distance Tag
            ctx.fillStyle = "#FFF";
            ctx.font = "bold 9px monospace";
            ctx.fillText(`${rel.distanceMeters}m`, tx, ty - 12);
        }

        // Draw Triangulation Landmarks with Range Scaling
        if (activeCoords) {
            [landmark1, landmark2].forEach((lm, idx) => {
                if (lm.lat !== 0 && lm.lon !== 0) {
                    const rel = OffGridNavigationEngine.calculateDistanceAndBearing(activeCoords.lat, activeCoords.lon, lm.lat, lm.lon);
                    const lmRad = (rel.bearingDegrees * Math.PI) / 180;
                    const isBeyondRange = rel.distanceMeters > radarMaxDist;
                    const normDistRatio = isBeyondRange ? 1.0 : (rel.distanceMeters / radarMaxDist);
                    const distPx = normDistRatio * (radius - 32);
                    const lx = Math.sin(lmRad) * distPx;
                    const ly = -Math.cos(lmRad) * distPx;

                    const color = idx === 0 ? "#38BDF8" : "#A855F7";
                    ctx.strokeStyle = color;
                    ctx.fillStyle = color;
                    ctx.lineWidth = 1.5;

                    ctx.beginPath();
                    ctx.moveTo(lx, ly - 6);
                    ctx.lineTo(lx - 5, ly + 5);
                    ctx.lineTo(lx + 5, ly + 5);
                    ctx.closePath();

                    if (isBeyondRange) {
                        ctx.stroke();
                    } else {
                        ctx.fill();
                    }
                }
            });
        }

        // Draw Geofence Perimeter Polygon on Radar Canvas if >= 3 valid waypoints exist
        const validGeofenceWps = waypoints.filter(w => w.lat !== 0 && w.lon !== 0);
        if (validGeofenceWps.length >= 3) {
            ctx.beginPath();
            validGeofenceWps.forEach((wp, idx) => {
                let liveBearing = wp.bearingDegrees;
                let liveDist = wp.distanceMeters;
                if (activeCoords) {
                    const rel = OffGridNavigationEngine.calculateDistanceAndBearing(activeCoords.lat, activeCoords.lon, wp.lat, wp.lon);
                    liveBearing = rel.bearingDegrees;
                    liveDist = rel.distanceMeters;
                }
                const wpRad = (liveBearing * Math.PI) / 180;
                const normDistRatio = liveDist > radarMaxDist ? 1.0 : (liveDist / radarMaxDist);
                const distPx = normDistRatio * (radius - 32);
                const wx = Math.sin(wpRad) * distPx;
                const wy = -Math.cos(wpRad) * distPx;

                if (idx === 0) ctx.moveTo(wx, wy);
                else ctx.lineTo(wx, wy);
            });
            ctx.closePath();
            ctx.strokeStyle = "rgba(232, 33, 58, 0.55)";
            ctx.fillStyle = "rgba(232, 33, 58, 0.08)";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.fill();
            ctx.setLineDash([]);
        }

        // Draw Waypoints on Compass Radar with Range Scaling
        waypoints.forEach(wp => {
            let liveBearing = wp.bearingDegrees;
            let liveDist = wp.distanceMeters;

            if (activeCoords && (wp.lat !== 0 || wp.lon !== 0)) {
                const rel = OffGridNavigationEngine.calculateDistanceAndBearing(activeCoords.lat, activeCoords.lon, wp.lat, wp.lon);
                liveBearing = rel.bearingDegrees;
                liveDist = rel.distanceMeters;
            }

            const wpRad = (liveBearing * Math.PI) / 180;
            const isBeyondRange = liveDist > radarMaxDist;
            const normDistRatio = isBeyondRange ? 1.0 : (liveDist / radarMaxDist);
            const distPx = normDistRatio * (radius - 32);
            const wx = Math.sin(wpRad) * distPx;
            const wy = -Math.cos(wpRad) * distPx;

            ctx.strokeStyle = "#00E676";
            ctx.fillStyle = "#00E676";
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.arc(wx, wy, 5, 0, Math.PI * 2);

            if (isBeyondRange) {
                ctx.stroke();
            } else {
                ctx.shadowColor = "#00E676";
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
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
    }, [heading, solarAzimuth, waypoints, activeCoords, radarMaxDist, landmark1, landmark2, target]);

    // Leaflet Interactive Tactical Vector Map Effect
    useEffect(() => {
        if (activeTab !== "map" || !mapContainerRef.current) return;
        let mapInstance: any = null;

        const initLeafletMap = async () => {
            const L = (await import("leaflet")).default;
            if (!mapContainerRef.current) return;

            const initialLat = activeCoords?.lat || 0;
            const initialLon = activeCoords?.lon || 0;

            if (leafletMapRef.current) {
                try {
                    if (leafletMapRef.current.getContainer() !== mapContainerRef.current) {
                        leafletMapRef.current.remove();
                        leafletMapRef.current = null;
                        markersGroupRef.current = null;
                    }
                } catch {
                    leafletMapRef.current = null;
                    markersGroupRef.current = null;
                }
            }

            if (!leafletMapRef.current) {
                mapInstance = L.map(mapContainerRef.current, {
                    center: [initialLat, initialLon],
                    zoom: 16,
                    zoomControl: false,
                    attributionControl: false
                });

                // Capa de Teselas Tácticas con prioridad de Bóveda Offline (IndexedDB)
                const OfflineTileLayer = (L.TileLayer as any).extend({
                    createTile(coords: any, done: any) {
                        const tile = document.createElement('img');
                        L.DomEvent.on(tile, 'load', L.Util.bind((this as any)._tileOnLoad, this, done, tile));
                        L.DomEvent.on(tile, 'error', L.Util.bind((this as any)._tileOnError, this, done, tile));

                        if ((this as any).options.crossOrigin || (this as any).options.crossOrigin === '') {
                            tile.crossOrigin = (this as any).options.crossOrigin === true ? '' : (this as any).options.crossOrigin;
                        }

                        tile.alt = '';
                        tile.setAttribute('role', 'presentation');

                        offlineTileCacheEngine.getTile(coords.z, coords.x, coords.y).then((cachedBlob) => {
                            if (cachedBlob) {
                                tile.src = URL.createObjectURL(cachedBlob);
                            } else {
                                const url = (this as any).getTileUrl(coords);
                                tile.src = url;
                                fetch(url).then(res => res.ok ? res.blob() : null).then(blob => {
                                    if (blob) offlineTileCacheEngine.saveTile(coords.z, coords.x, coords.y, blob);
                                }).catch(() => {});
                            }
                        }).catch(() => {
                            tile.src = (this as any).getTileUrl(coords);
                        });

                        return tile;
                    }
                });

                const osmLayer = new OfflineTileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    maxZoom: 19,
                    className: "tactical-dark-tile",
                    errorTileUrl: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256' fill='%23050812'%3E%3Crect width='256' height='256'/%3E%3Cpath d='M0 0h256v256H0z' stroke='%2300E5FF' stroke-width='0.4' stroke-opacity='0.2' fill='none'/%3E%3C/svg%3E"
                });

                // Fallback a Esri World Dark Gray Base si OSM experimenta latencia o desconexión
                osmLayer.on("tileerror", () => {
                    if (!mapInstance) return;
                    try {
                        const fallbackLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
                            maxZoom: 16,
                            className: "tactical-dark-tile"
                        });
                        fallbackLayer.addTo(mapInstance);
                    } catch {}
                });

                osmLayer.addTo(mapInstance);

                // Tap/Click anywhere on the map to set tactical target point
                mapInstance.on("click", (e: any) => {
                    handleSetTarget(e.latlng.lat, e.latlng.lng);
                });

                const markersGroup = L.layerGroup().addTo(mapInstance);
                markersGroupRef.current = markersGroup;
                leafletMapRef.current = mapInstance;
            } else {
                mapInstance = leafletMapRef.current;
            }

            // Invalidate size on tab switch
            setTimeout(() => {
                try {
                    mapInstance?.invalidateSize();
                } catch {}
            }, 200);

            // Re-render map layers
            if (markersGroupRef.current) {
                markersGroupRef.current.clearLayers();

                // 1. User Position Marker
                if (activeCoords) {
                    const selfIcon = L.divIcon({
                        className: "custom-self-marker",
                        html: `<div style="width:24px;height:24px;border-radius:50%;background:${pdrState.isTracking ? '#00E676' : '#00E5FF'};border:3px solid #fff;box-shadow:0 0 20px ${pdrState.isTracking ? '#00E676' : '#00E5FF'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#000;">${pdrState.isTracking ? '🧭' : '📍'}</div>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });
                    L.marker([activeCoords.lat, activeCoords.lon], { icon: selfIcon })
                        .bindPopup(`<div style="font-family:monospace;font-size:11px;color:#000;"><strong>${pdrState.isTracking ? '🧭 Mi Posición (PDR Inercial)' : '📍 Mi Posición GPS'}</strong><br/>${activeCoords.lat.toFixed(5)}, ${activeCoords.lon.toFixed(5)}</div>`)
                        .addTo(markersGroupRef.current);

                    // User Tactical Range Ring (50m, 100m)
                    L.circle([activeCoords.lat, activeCoords.lon], {
                        radius: 50,
                        color: pdrState.isTracking ? "rgba(0,230,118,0.3)" : "rgba(0,229,255,0.3)",
                        weight: 1,
                        fillColor: pdrState.isTracking ? "rgba(0,230,118,0.03)" : "rgba(0,229,255,0.03)",
                        dashArray: "4, 6"
                    }).addTo(markersGroupRef.current);
                }

                // 2. Tactical Target Marker & Tactical Polyline Vector
                if (target) {
                    const targetIcon = L.divIcon({
                        className: "custom-target-marker",
                        html: `<div style="width:30px;height:30px;border-radius:50%;background:#E8213A;border:3px solid #FFF;box-shadow:0 0 24px #E8213A;display:flex;align-items:center;justify-content:center;font-size:14px;animation:pulse 1.2s infinite;color:#FFF;">🎯</div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });

                    const targetMarker = L.marker([target.lat, target.lon], { icon: targetIcon }).addTo(markersGroupRef.current);
                    
                    const distText = activeCoords 
                        ? OffGridNavigationEngine.calculateTacticalGuidance(activeCoords.lat, activeCoords.lon, target.lat, target.lon, heading).formattedDistance
                        : "Calculando...";

                    targetMarker.bindPopup(`
                        <div style="font-family:monospace;font-size:11px;color:#000;padding:2px;">
                            <strong style="color:#E8213A;">🎯 OBJETIVO TÁCTICO</strong><br/>
                            <strong>Distancia:</strong> ${distText}<br/>
                            <strong>Coords:</strong> ${target.lat.toFixed(5)}, ${target.lon.toFixed(5)}
                        </div>
                    `);

                    // Draw connecting Tactical Vector Line
                    if (activeCoords) {
                        L.polyline([[activeCoords.lat, activeCoords.lon], [target.lat, target.lon]], {
                            color: "#E8213A",
                            weight: 3.5,
                            dashArray: "8, 8",
                            opacity: 0.95
                        }).addTo(markersGroupRef.current);

                        // Midpoint marker with distance label
                        const midLat = (activeCoords.lat + target.lat) / 2;
                        const midLon = (activeCoords.lon + target.lon) / 2;
                        const labelIcon = L.divIcon({
                            className: "custom-vector-label",
                            html: `<div style="background:rgba(14,14,26,0.9);border:1px solid #E8213A;padding:2px 8px;border-radius:6px;color:#00E676;font-family:monospace;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.6);">${distText}</div>`,
                            iconSize: [60, 20],
                            iconAnchor: [30, 10]
                        });
                        L.marker([midLat, midLon], { icon: labelIcon }).addTo(markersGroupRef.current);
                    }
                }

                // 3. Registered Waypoints
                waypoints.forEach(wp => {
                    if (wp.lat !== 0 && wp.lon !== 0) {
                        const wpIcon = L.divIcon({
                            className: "custom-wp-marker",
                            html: `<div style="width:20px;height:20px;border-radius:50%;background:#00E676;border:2px solid #FFF;display:flex;align-items:center;justify-content:center;font-size:10px;color:#000;font-weight:900;">🚩</div>`,
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        });
                        L.marker([wp.lat, wp.lon], { icon: wpIcon })
                            .bindPopup(`<div style="font-family:monospace;font-size:11px;color:#000;"><strong>🚩 ${wp.name}</strong><br/>${wp.lat.toFixed(5)}, ${wp.lon.toFixed(5)}</div>`)
                            .addTo(markersGroupRef.current);
                    }
                });
            }
        };

        initLeafletMap();

        return () => {
            if (leafletMapRef.current) {
                try {
                    leafletMapRef.current.remove();
                } catch {}
                leafletMapRef.current = null;
                markersGroupRef.current = null;
            }
        };
    }, [activeTab, activeCoords, target, waypoints, heading, handleSetTarget, pdrState.isTracking]);

    const recenterMapOnUser = () => {
        if (leafletMapRef.current && activeCoords) {
            leafletMapRef.current.flyTo([activeCoords.lat, activeCoords.lon], 17, { duration: 0.8 });
            toast.info(pdrState.isTracking ? "Mapa centrado en posición PDR inercial" : "Mapa centrado en posición GPS");
        }
    };

    const recenterMapOnTarget = () => {
        if (leafletMapRef.current && target) {
            leafletMapRef.current.flyTo([target.lat, target.lon], 17, { duration: 0.8 });
            toast.info("Mapa centrado en el objetivo táctico");
        }
    };

    const updateLandmark1 = (newLm: Landmark) => {
        setLandmark1(newLm);
        try { localStorage.setItem("red_offgrid_landmark1", JSON.stringify(newLm)); } catch {}
    };

    const updateLandmark2 = (newLm: Landmark) => {
        setLandmark2(newLm);
        try { localStorage.setItem("red_offgrid_landmark2", JSON.stringify(newLm)); } catch {}
    };

    const updateBearing1 = (val: string) => {
        setBearing1(val);
        try { localStorage.setItem("red_offgrid_bearing1", val); } catch {}
    };

    const updateBearing2 = (val: string) => {
        setBearing2(val);
        try { localStorage.setItem("red_offgrid_bearing2", val); } catch {}
    };

    const handleAddWaypoint = () => {
        if (!newWpName.trim()) {
            toast.warning("Ingresa un nombre para el waypoint");
            return;
        }

        if (!activeCoords) {
            toast.warning("Esperando señal GPS o PDR para determinar la posición base del waypoint");
            return;
        }

        const dist = parseFloat(newWpDist);
        const brg = parseFloat(newWpBearing);

        if (isNaN(dist) || dist <= 0) {
            toast.warning("Ingresa una distancia válida mayor a 0 metros");
            return;
        }

        if (isNaN(brg) || brg < 0 || brg >= 360) {
            toast.warning("Ingresa un rumbo válido entre 0° y 360°");
            return;
        }
        
        const destination = OffGridNavigationEngine.calculateDestinationPoint(activeCoords.lat, activeCoords.lon, dist, brg);

        const wp: Waypoint = {
            id: Date.now().toString(),
            name: newWpName.trim(),
            lat: destination.lat,
            lon: destination.lon,
            bearingDegrees: brg,
            distanceMeters: dist,
            createdAt: Date.now()
        };

        const updated = [...waypoints, wp];
        setWaypoints(updated);
        try { localStorage.setItem("red_offgrid_waypoints", JSON.stringify(updated)); } catch {}
        setNewWpName("");
        toast.success(`Waypoint "${wp.name}" añadido`);
    };

    const handleDeleteWaypoint = (id: string) => {
        const updated = waypoints.filter(w => w.id !== id);
        setWaypoints(updated);
        try { localStorage.setItem("red_offgrid_waypoints", JSON.stringify(updated)); } catch {}
        toast.info("Waypoint eliminado");
    };

    const handleBroadcastWaypoint = async (wp: Waypoint) => {
        try {
            TacticalAudioEngine.playTap();
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: `wp_${wp.id}`,
                msg_type: 'TACTICAL_WAYPOINT_DISPATCH',
                waypoint: wp,
                sender: (identity?.nickname || 'Operador RED'),
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payloadBytes);
            TacticalAudioEngine.playMessageSent();
            toast.success(`📡 Waypoint "${wp.name}" transmitido a la malla P2P`);
        } catch {
            TacticalAudioEngine.playWarning();
            toast.error("Error al transmitir waypoint a la malla");
        }
    };

    const handleCalculateTriangulation = () => {
        if (landmark1.lat === 0 || landmark1.lon === 0 || landmark2.lat === 0 || landmark2.lon === 0) {
            toast.warning("Ingresa las coordenadas reales del Punto 1 y Punto 2");
            return;
        }

        const b1 = parseFloat(bearing1);
        const b2 = parseFloat(bearing2);

        if (isNaN(b1) || b1 < 0 || b1 >= 360 || isNaN(b2) || b2 < 0 || b2 >= 360) {
            toast.warning("Ingresa rumbos numéricos válidos entre 0° y 360° para ambos puntos");
            return;
        }

        const res = OffGridNavigationEngine.calculateResection(landmark1, b1, landmark2, b2);
        if (res) {
            setTriangulatedPos(res);
            toast.success("Triangulación calculada con éxito");
        } else {
            toast.error("No se pudo calcular intersección: los rumbos no intersectan hacia adelante o son paralelos");
        }
    };

    const handleAdoptTriangulatedPos = () => {
        if (triangulatedPos) {
            const coords = { lat: triangulatedPos.lat, lon: triangulatedPos.lon };
            setUserCoords(coords);
            setUtmString(OffGridNavigationEngine.gpsToUtm(coords.lat, coords.lon));
            setSolarAzimuth(OffGridNavigationEngine.calculateSolarAzimuth(coords.lat, coords.lon));
            try { localStorage.setItem("red_last_known_gps", JSON.stringify(coords)); } catch {}
            toast.success(`Ubicación fijada a posición triangulada (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`);
        }
    };

    return (
        <div style={{
            width: '100%', height: '100%',
            position: 'relative',
            background: 'var(--bg-void, rgba(4,6,10,0.98))', color: '#fff',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxSizing: 'border-box'
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "14px 18px",
                height: "var(--header-h, 64px)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border, rgba(255,255,255,0.1))",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '12px', background: 'linear-gradient(135deg, #00E676, #00A859)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(0,230,118,0.3)' }}>
                        <TacIcon name="compass" size={20} color="#000" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>{t.modules?.off_grid_compass || "Radar Topográfico Off-Grid"}</div>
                        <div style={{ fontSize: '0.68rem', color: '#00E676', fontFamily: 'monospace', fontWeight: 700 }}>
                            {target ? `● GUIADO ACTIVO: ${target.lat.toFixed(4)}, ${target.lon.toFixed(4)}` : "NAVEGACIÓN TÁCTICA 100% OFFLINE"}
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => navigate('sidebar')}
                    style={{
                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fff', padding: '8px 14px', borderRadius: '10px',
                        cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                >
                    <TacIcon name="x" size={14} />
                    <span>{t.common?.close || "Cerrar"}</span>
                </button>
            </header>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "8px 14px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.9)",
                borderBottom: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
                overflowX: "auto", flexShrink: 0, zIndex: 9
            }}>
                <button
                    onClick={() => setActiveTab("radar")}
                    style={{
                        padding: "8px 14px", fontSize: "0.8rem", fontWeight: 800, borderRadius: "20px",
                        background: activeTab === "radar" ? "#00E676" : "rgba(255,255,255,0.06)",
                        color: activeTab === "radar" ? "#000" : "#AAA",
                        border: "none", cursor: "pointer", whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: "6px"
                    }}
                >
                    <TacIcon name="compass" size={14} />
                    <span>Radar & Rosa HUD</span>
                </button>
                <button
                    onClick={() => setActiveTab("map")}
                    style={{
                        padding: "8px 14px", fontSize: "0.8rem", fontWeight: 800, borderRadius: "20px",
                        background: activeTab === "map" ? "#E8213A" : (target ? "rgba(232,33,58,0.25)" : "rgba(255,255,255,0.06)"),
                        color: activeTab === "map" ? "#FFF" : (target ? "#FF3355" : "#AAA"),
                        border: target ? "1px solid rgba(232,33,58,0.5)" : "none",
                        cursor: "pointer", whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: "6px"
                    }}
                >
                    <TacIcon name="map" size={14} />
                    <span>Mapa Táctico Vectorial</span>
                    {target && <TacIcon name="crosshair" size={12} color="#FFF" />}
                </button>
                <button
                    onClick={() => setActiveTab("resection")}
                    style={{
                        padding: "8px 14px", fontSize: "0.8rem", fontWeight: 800, borderRadius: "20px",
                        background: activeTab === "resection" ? "#38BDF8" : "rgba(255,255,255,0.06)",
                        color: activeTab === "resection" ? "#000" : "#AAA",
                        border: "none", cursor: "pointer", whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: "6px"
                    }}
                >
                    <TacIcon name="crosshair" size={14} />
                    <span>Resección (2 Puntos)</span>
                </button>
                <button
                    onClick={() => setActiveTab("waypoints")}
                    style={{
                        padding: "8px 14px", fontSize: "0.8rem", fontWeight: 800, borderRadius: "20px",
                        background: activeTab === "waypoints" ? "#FFB300" : "rgba(255,255,255,0.06)",
                        color: activeTab === "waypoints" ? "#000" : "#AAA",
                        border: "none", cursor: "pointer", whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: "6px"
                    }}
                >
                    <TacIcon name="pin" size={14} />
                    <span>Waypoints ({waypoints.length})</span>
                </button>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════
                PESTAÑA 1: RADAR & ROSA HUD
               ══════════════════════════════════════════════════════════════════════ */}
            {activeTab === "radar" && (
                <div style={{
                    flex: 1, overflowY: 'auto', overflowX: 'hidden',
                    padding: '14px 14px 90px 14px', boxSizing: 'border-box'
                }}>
                    <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        
                        {/* Tactical Target Active Guidance HUD (Si hay objetivo activo) */}
                        {target && (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(232,33,58,0.18) 0%, rgba(20,20,35,0.95) 100%)',
                                border: '1.5px solid #E8213A',
                                borderRadius: '16px', padding: '14px 16px',
                                display: 'flex', flexDirection: 'column', gap: '10px',
                                boxShadow: '0 0 24px rgba(232,33,58,0.25)',
                                boxSizing: 'border-box'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <TacIcon name="crosshair" size={20} color="#E8213A" style={{ animation: 'pulse 1.2s infinite' }} />
                                        <div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#FFF' }}>OBJETIVO TÁCTICO FIJADO</div>
                                            <div className="tabular-telemetry" style={{ fontSize: '0.68rem', color: '#AAA', fontFamily: 'monospace' }}>{target.lat.toFixed(5)}°, {target.lon.toFixed(5)}°</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleClearTarget}
                                        style={{
                                            background: 'rgba(232,33,58,0.25)', border: '1px solid #E8213A',
                                            color: '#FFF', padding: '6px 12px', borderRadius: '8px',
                                            cursor: 'pointer', fontWeight: 800, fontSize: '0.74rem',
                                            display: 'flex', alignItems: 'center', gap: '6px'
                                        }}
                                    >
                                        <TacIcon name="trash" size={12} />
                                        <span>Borrar Objetivo</span>
                                    </button>
                                </div>

                                {tacticalGuidance ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <div style={{ fontSize: '0.65rem', color: '#AAA', textTransform: 'uppercase' }}>Distancia al Objetivo</div>
                                            <div className="tabular-telemetry" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#00E676', fontFamily: 'monospace' }}>
                                                {tacticalGuidance.formattedDistance}
                                            </div>
                                            <div className="tabular-telemetry" style={{ fontSize: '0.68rem', color: '#38BDF8', marginTop: '2px' }}>{tacticalGuidance.estimatedWalkTimeFormatted}</div>
                                        </div>
                                        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <div style={{ fontSize: '0.65rem', color: '#AAA', textTransform: 'uppercase' }}>Rumbo / Azimut Requerido</div>
                                            <div className="tabular-telemetry" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#E8213A', fontFamily: 'monospace' }}>
                                                {tacticalGuidance.bearingDegrees}° {tacticalGuidance.cardinal}
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: '#FFB300', marginTop: '2px', fontWeight: 700 }}>
                                                {tacticalGuidance.steeringInstruction}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#FFB300', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <TacIcon name="hazard" size={14} color="#FFB300" />
                                        <span>Esperando coordenadas GPS actuales para calcular distancia y rumbo vectoriales.</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Compass Radar Canvas Card */}
                        <div style={{
                            background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(0,230,118,0.3)',
                            borderRadius: '16px', padding: '16px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            boxSizing: 'border-box'
                        }}>
                            <canvas ref={canvasRef} style={{ width: 260, height: 260 }} />
                            
                            {/* Heading & Zoom Selector */}
                            <div style={{ marginTop: '10px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#00E676', fontFamily: 'monospace' }}>
                                        {heading}° {compassTelemetry.cardinal}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '2px' }}>
                                        {compassTelemetry.source === 'magnetometer' && (
                                            <span style={{ fontSize: '0.68rem', color: '#00E676', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <TacIcon name="compass" size={12} /> Magnetómetro Fusión 3D
                                            </span>
                                        )}
                                        {compassTelemetry.source === 'gps_cog' && (
                                            <span style={{ fontSize: '0.68rem', color: '#00E5FF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <TacIcon name="satellite" size={12} /> Rumbo GPS Cinemático (COG)
                                            </span>
                                        )}
                                        {compassTelemetry.source === 'solar' && (
                                            <span style={{ fontSize: '0.68rem', color: '#FFB300', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <TacIcon name="sun" size={12} /> Brújula Solar Calibrada
                                            </span>
                                        )}
                                        {compassTelemetry.source === 'manual' && (
                                            <span style={{ fontSize: '0.68rem', color: '#FF9100', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <TacIcon name="crosshair" size={12} /> Rumbo Manual (Sin Magnetómetro)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Controles Tácticos de Calibración cuando no hay magnetómetro de hardware */}
                                {compassTelemetry.source !== 'magnetometer' && (
                                    <div style={{
                                        display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.08)', marginTop: '4px'
                                    }}>
                                        <button
                                            onClick={() => tacticalCompass.setManualHeading((heading - 15 + 360) % 360)}
                                            style={{
                                                padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)',
                                                color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '0.70rem', fontWeight: 800,
                                                display: 'flex', alignItems: 'center', gap: '4px'
                                            }}
                                            title="Girar 15° a babor"
                                        >
                                            <TacIcon name="chevron-left" size={10} />
                                            <span>-15°</span>
                                        </button>
                                        <button
                                            onClick={() => tacticalCompass.setManualHeading((heading + 15) % 360)}
                                            style={{
                                                padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)',
                                                color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '0.70rem', fontWeight: 800,
                                                display: 'flex', alignItems: 'center', gap: '4px'
                                            }}
                                            title="Girar 15° a estribor"
                                        >
                                            <span>+15°</span>
                                            <TacIcon name="chevron-right" size={10} />
                                        </button>
                                        {solarAzimuth && !solarAzimuth.isNight && (
                                            <button
                                                onClick={() => {
                                                    tacticalCompass.calibrateWithSolarAzimuth(solarAzimuth.azimuthDegrees);
                                                    toast.success(`Brújula orientada con el Sol: ${solarAzimuth.azimuthDegrees}°`);
                                                }}
                                                style={{
                                                    padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,179,0,0.18)',
                                                    color: '#FFB300', border: '1px solid #FFB300', cursor: 'pointer', fontSize: '0.70rem', fontWeight: 800,
                                                    display: 'flex', alignItems: 'center', gap: '4px'
                                                }}
                                                title="Alinear rumbo con el acimut solar actual"
                                            >
                                                <TacIcon name="sun" size={12} />
                                                <span>Alinear Sol ({solarAzimuth.azimuthDegrees}°)</span>
                                            </button>
                                        )}
                                    </div>
                                )}

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

                        {/* Ferromagnetic Anomaly & Calibration HUD Card */}
                        <div style={{
                            background: 'linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)',
                            border: `1.5px solid ${magTelemetry.isAnomalyDetected ? '#FF3355' : 'rgba(0, 229, 255, 0.35)'}`,
                            borderRadius: '16px', padding: '16px',
                            display: 'flex', flexDirection: 'column', gap: '12px',
                            boxShadow: magTelemetry.isAnomalyDetected ? '0 0 20px rgba(255,51,85,0.25)' : 'none',
                            boxSizing: 'border-box'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TacIcon name="radio" size={18} color="#00E5FF" />
                                    <div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#FFF' }}>
                                            DETECTOR DE ANOMALÍAS MAGNÉTICAS
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: magTelemetry.isSensorOnline ? '#00E676' : '#FFB300' }}>
                                            {magTelemetry.isSensorOnline ? '● Magnetómetro en línea' : '○ Modo simulación / brújula virtual'}
                                        </div>
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: '0.72rem', fontWeight: 900, padding: '3px 8px', borderRadius: '6px',
                                    background: magTelemetry.anomalySeverity === 'EXTREME' ? '#FF1744' :
                                                magTelemetry.anomalySeverity === 'HIGH' ? '#FF5252' :
                                                magTelemetry.anomalySeverity === 'ELEVATED' ? '#FFB300' : 'rgba(0,230,118,0.15)',
                                    color: magTelemetry.anomalySeverity === 'NORMAL' ? '#00E676' : '#FFF',
                                    border: `1px solid ${magTelemetry.anomalySeverity === 'NORMAL' ? '#00E676' : 'transparent'}`
                                }}>
                                    {magTelemetry.anomalySeverity}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ fontSize: '0.62rem', color: '#AAA' }}>CAMPO ACTUAL</div>
                                    <div className="tabular-telemetry" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#00E5FF', fontFamily: 'monospace' }}>
                                        {magTelemetry.magnitudeMicroteslas} <span style={{ fontSize: '0.7rem' }}>µT</span>
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ fontSize: '0.62rem', color: '#AAA' }}>LÍNEA BASE (CERO)</div>
                                    <div className="tabular-telemetry" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#AAA', fontFamily: 'monospace' }}>
                                        {magTelemetry.baselineMicroteslas} <span style={{ fontSize: '0.7rem' }}>µT</span>
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ fontSize: '0.62rem', color: '#AAA' }}>DESVIACIÓN (Δ)</div>
                                    <div className="tabular-telemetry" style={{ fontSize: '1.15rem', fontWeight: 900, color: magTelemetry.isAnomalyDetected ? '#FF3355' : '#00E676', fontFamily: 'monospace' }}>
                                        {magTelemetry.deltaFromBaselineMicroteslas > 0 ? `+${magTelemetry.deltaFromBaselineMicroteslas}` : magTelemetry.deltaFromBaselineMicroteslas} <span style={{ fontSize: '0.7rem' }}>µT</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => {
                                        magneticDetector.calibrateBaseline();
                                        toast.success(`Cero magnético calibrado a ${magTelemetry.magnitudeMicroteslas} µT`);
                                    }}
                                    style={{
                                        flex: 1, padding: '8px', borderRadius: '8px',
                                        background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)',
                                        color: '#00E5FF', fontWeight: 800, fontSize: '0.76rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                    }}
                                >
                                    <TacIcon name="crosshair" size={14} />
                                    <span>Calibrar Cero Táctico</span>
                                </button>
                                <button
                                    onClick={() => {
                                        const active = magneticDetector.toggleAudioBeeps();
                                        toast.info(active ? "Audio Geiger Activado" : "Audio Geiger Silenciado");
                                    }}
                                    style={{
                                        padding: '8px 14px', borderRadius: '8px',
                                        background: magTelemetry.isAudioBeepActive ? 'rgba(255,179,0,0.25)' : 'rgba(255,255,255,0.06)',
                                        border: `1px solid ${magTelemetry.isAudioBeepActive ? '#FFB300' : 'rgba(255,255,255,0.15)'}`,
                                        color: magTelemetry.isAudioBeepActive ? '#FFB300' : '#AAA',
                                        fontWeight: 800, fontSize: '0.76rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                >
                                    <TacIcon name={magTelemetry.isAudioBeepActive ? "volume" : "volume-x"} size={14} />
                                    <span>{magTelemetry.isAudioBeepActive ? 'Geiger ON' : 'Geiger OFF'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Tactical Stats & UTM Coordinate Box */}
                        <div style={{
                            background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px', padding: '16px',
                            display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box'
                        }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#38BDF8', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <TacIcon name="crosshair" size={14} color="#38BDF8" />
                                <span>Cuadrícula Táctica UTM</span>
                            </div>
                            <div className="tabular-telemetry" style={{ background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,230,118,0.3)', fontFamily: 'monospace', fontSize: '1.05rem', color: '#00E676', textAlign: 'center', fontWeight: 800, letterSpacing: '0.5px', overflowX: 'auto' }}>
                                {utmString}
                            </div>
                            {activeCoords ? (
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem', color: '#AAA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Lat: <strong className="tabular-telemetry" style={{ color: '#fff' }}>{activeCoords.lat.toFixed(5)}°</strong></span>
                                    <span>Lon: <strong className="tabular-telemetry" style={{ color: '#fff' }}>{activeCoords.lon.toFixed(5)}°</strong></span>
                                    {pdrState.isTracking && (
                                        <span style={{ color: '#00E676', fontSize: '0.7rem', fontWeight: 800, background: 'rgba(0,230,118,0.15)', padding: '2px 6px', borderRadius: '4px' }}>PDR</span>
                                    )}
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.75rem', color: '#FFB300', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TacIcon name="hazard" size={14} color="#FFB300" />
                                    <span>Obteniendo fijación de satélites GPS...</span>
                                </div>
                            )}

                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFB300', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TacIcon name={solarAzimuth.isNight ? "moon" : "sun"} size={14} color={solarAzimuth.isNight ? "#38BDF8" : "#FFB300"} />
                                    <span>{solarAzimuth.isNight ? "Reloj Nocturno" : "Reloj Solar"} (Norte Verdadero)</span>
                                </span>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem', color: '#DDD', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Azimut: <strong className="tabular-telemetry" style={{ color: solarAzimuth.isNight ? '#38BDF8' : '#FFB300' }}>{solarAzimuth.azimuthDegrees}°</strong></span>
                                <span>Elevación: <strong className="tabular-telemetry" style={{ color: solarAzimuth.isNight ? '#38BDF8' : '#FFB300' }}>{solarAzimuth.elevationDegrees}°</strong></span>
                            </div>
                        </div>

                        {/* Navegación Inercial Táctica PDR (Pedestrian Dead Reckoning / Rumbo Muerto) */}
                        <div style={{
                            background: 'linear-gradient(180deg, rgba(14, 26, 38, 0.95) 0%, rgba(6, 12, 20, 0.98) 100%)',
                            border: `1.5px solid ${pdrState.isTracking ? '#00E676' : 'rgba(56, 189, 248, 0.35)'}`,
                            borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
                            boxShadow: pdrState.isTracking ? '0 0 20px rgba(0,230,118,0.2)' : 'none',
                            boxSizing: 'border-box'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TacIcon name="activity" size={18} color="#00E676" />
                                    <div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#FFF' }}>
                                            NAVEGACIÓN INERCIAL PDR (RUMBO MUERTO)
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: pdrState.isTracking ? '#00E676' : '#FFB300' }}>
                                            {pdrState.isTracking ? '● Acelerómetro & Giroscopio en línea' : '○ Navegación inercial detenida'}
                                        </div>
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                                    background: pdrState.isTracking ? 'rgba(0,230,118,0.18)' : 'rgba(255,255,255,0.08)',
                                    color: pdrState.isTracking ? '#00E676' : '#AAA',
                                    border: `1px solid ${pdrState.isTracking ? '#00E676' : 'rgba(255,255,255,0.15)'}`
                                }}>
                                    {pdrState.isTracking ? 'IMU ACTIVO' : 'PAUSADO'}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.62rem', color: '#AAA' }}>PASOS</div>
                                    <div className="tabular-telemetry" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#00E5FF', fontFamily: 'monospace' }}>
                                        {pdrState.totalSteps}
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.62rem', color: '#AAA' }}>DISTANCIA</div>
                                    <div className="tabular-telemetry" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#00E676', fontFamily: 'monospace' }}>
                                        {pdrState.distanceMeters >= 1000 ? `${(pdrState.distanceMeters / 1000).toFixed(2)}km` : `${pdrState.distanceMeters}m`}
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.62rem', color: '#AAA' }}>VELOCIDAD</div>
                                    <div className="tabular-telemetry" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#FFB300', fontFamily: 'monospace' }}>
                                        {(pdrState.averageSpeedMps * 3.6).toFixed(1)} <span style={{ fontSize: '0.65rem' }}>km/h</span>
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.62rem', color: '#AAA' }}>CADENCIA</div>
                                    <div className="tabular-telemetry" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#A855F7', fontFamily: 'monospace' }}>
                                        {pdrState.stepFrequencyHz} <span style={{ fontSize: '0.65rem' }}>Hz</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#AAA', fontFamily: 'monospace' }}>
                                <span>Vector Norte (ΔN): <strong className="tabular-telemetry" style={{ color: pdrState.displacementNorthMeters >= 0 ? '#00E676' : '#FF3355' }}>{pdrState.displacementNorthMeters > 0 ? `+${pdrState.displacementNorthMeters}` : pdrState.displacementNorthMeters}m</strong></span>
                                <span>Vector Este (ΔE): <strong className="tabular-telemetry" style={{ color: pdrState.displacementEastMeters >= 0 ? '#00E676' : '#FF3355' }}>{pdrState.displacementEastMeters > 0 ? `+${pdrState.displacementEastMeters}` : pdrState.displacementEastMeters}m</strong></span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={togglePdrTracking}
                                    style={{
                                        flex: 1, minWidth: '120px', padding: '9px', borderRadius: '8px',
                                        background: pdrState.isTracking ? 'rgba(232,33,58,0.2)' : 'rgba(0,230,118,0.2)',
                                        border: `1px solid ${pdrState.isTracking ? '#E8213A' : '#00E676'}`,
                                        color: pdrState.isTracking ? '#FF5252' : '#00E676',
                                        fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                    }}
                                >
                                    <TacIcon name={pdrState.isTracking ? "pause" : "play"} size={12} />
                                    <span>{pdrState.isTracking ? 'Detener PDR' : 'Iniciar PDR Inercial'}</span>
                                </button>
                                <button
                                    onClick={handleResetPdr}
                                    style={{
                                        padding: '9px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.15)', color: '#AAA', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                    title="Poner a cero odometría inercial"
                                >
                                    <TacIcon name="refresh" size={12} />
                                    <span>Poner a Cero</span>
                                </button>
                                <button
                                    onClick={handleAdoptPdrCoords}
                                    style={{
                                        padding: '9px 12px', borderRadius: '8px',
                                        background: 'rgba(56,189,248,0.2)', border: '1px solid #38BDF8',
                                        color: '#38BDF8', fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                    title="Proyectar coordenadas estimadas a la navegación general del sistema"
                                >
                                    <TacIcon name="crosshair" size={12} />
                                    <span>Proyectar a GPS</span>
                                </button>
                            </div>
                        </div>

                        {/* Tactical Geofence Status */}
                        {(() => {
                            const validWps = waypoints.filter(w => w.lat !== 0 && w.lon !== 0);
                            if (validWps.length < 3 || !activeCoords) return null;
                            const polygon = validWps.map(w => ({ lat: w.lat, lon: w.lon }));
                            const isInside = OffGridNavigationEngine.isPointInGeofence(activeCoords, polygon);
                            return (
                                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(232,33,58,0.3)', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#E8213A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <TacIcon name="shield" size={16} color="#E8213A" />
                                            <span>Perímetro Geofence Defensivo</span>
                                        </div>
                                        <span className="tabular-telemetry" style={{ fontSize: '0.7rem', color: '#AAA' }}>{validWps.length} Vértices</span>
                                    </div>
                                    <div style={{
                                        padding: '10px 14px', borderRadius: '10px',
                                        background: isInside ? 'rgba(0,230,118,0.12)' : 'rgba(232,33,58,0.15)',
                                        border: `1px solid ${isInside ? 'rgba(0,230,118,0.4)' : 'rgba(232,33,58,0.5)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                    }}>
                                        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: isInside ? '#00E676' : '#FF5252', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <TacIcon name="shield" size={14} color={isInside ? '#00E676' : '#FF5252'} />
                                            <span>{isInside ? 'DENTRO DEL PERÍMETRO' : 'FUERA DEL PERÍMETRO'}</span>
                                        </div>
                                        <span style={{ fontSize: '0.68rem', color: '#FFF', fontFamily: 'monospace' }}>Ray-Casting</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                PESTAÑA 2: MAPA TÁCTICO VECTORIAL (Click para fijar objetivo)
               ══════════════════════════════════════════════════════════════════════ */}
            {activeTab === "map" && (
                <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                    {/* Contenedor del Mapa Leaflet */}
                    <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#06060c' }} />

                    {/* HUD Flotante Superior: Instrucción de Tap y Estado */}
                    <div style={{
                        position: 'absolute', top: 12, left: 12, right: 12,
                        zIndex: 1000, pointerEvents: 'none',
                        display: 'flex', flexDirection: 'column', gap: '8px'
                    }}>
                        <div style={{
                            background: 'rgba(10,12,22,0.92)', border: '1px solid rgba(0,229,255,0.35)',
                            borderRadius: '12px', padding: '10px 14px',
                            backdropFilter: 'blur(16px)', pointerEvents: 'auto',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <TacIcon name="crosshair" size={16} color="var(--accent-cyan, #00E5FF)" />
                                <div style={{ fontSize: '0.74rem', color: 'var(--accent-cyan, #00E5FF)', fontWeight: 700 }}>
                                    Toca en cualquier punto del mapa para fijar un objetivo táctico y calcular vector de rumbo.
                                </div>
                            </div>
                            {userCoords && (
                                <button
                                    onClick={recenterMapOnUser}
                                    style={{
                                        background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)',
                                        color: '#00E5FF', padding: '5px 10px', borderRadius: '8px',
                                        fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                                        display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                >
                                    <TacIcon name="compass" size={12} />
                                    <span>Mi Posición</span>
                                </button>
                            )}
                        </div>

                        {/* Tarjeta de Telemetría Vectorial Activa */}
                        {target && (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(232,33,58,0.25) 0%, rgba(14,14,28,0.96) 100%)',
                                border: '1.5px solid #E8213A',
                                borderRadius: '14px', padding: '12px 14px',
                                backdropFilter: 'blur(16px)', pointerEvents: 'auto',
                                boxShadow: '0 6px 24px rgba(232,33,58,0.3)',
                                display: 'flex', flexDirection: 'column', gap: '8px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <TacIcon name="crosshair" size={18} color="#E8213A" />
                                        <div>
                                            <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#FFF' }}>OBJETIVO VECTORIAL FIJADO</div>
                                            <div className="tabular-telemetry" style={{ fontSize: '0.66rem', color: '#AAA', fontFamily: 'monospace' }}>
                                                {target.lat.toFixed(5)}°, {target.lon.toFixed(5)}°
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={recenterMapOnTarget}
                                            style={{
                                                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                                color: '#FFF', padding: '5px 10px', borderRadius: '8px',
                                                fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '4px'
                                            }}
                                        >
                                            <TacIcon name="crosshair" size={12} />
                                            <span>Centrar</span>
                                        </button>
                                        <button
                                            onClick={handleClearTarget}
                                            style={{
                                                background: '#E8213A', border: 'none',
                                                color: '#FFF', padding: '5px 10px', borderRadius: '8px',
                                                fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer',
                                                boxShadow: '0 0 12px rgba(232,33,58,0.4)',
                                                display: 'flex', alignItems: 'center', gap: '4px'
                                            }}
                                        >
                                            <TacIcon name="trash" size={12} />
                                            <span>Borrar</span>
                                        </button>
                                    </div>
                                </div>

                                {tacticalGuidance ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div>
                                            <div style={{ fontSize: '0.62rem', color: '#AAA', textTransform: 'uppercase' }}>Distancia en Metros</div>
                                            <div className="tabular-telemetry" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#00E676', fontFamily: 'monospace' }}>
                                                {tacticalGuidance.formattedDistance}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.62rem', color: '#AAA', textTransform: 'uppercase' }}>Rumbo Requerido</div>
                                            <div className="tabular-telemetry" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#E8213A', fontFamily: 'monospace' }}>
                                                {tacticalGuidance.bearingDegrees}° {tacticalGuidance.cardinal}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.62rem', color: '#AAA', textTransform: 'uppercase' }}>Instrucción</div>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#FFB300' }}>
                                                {tacticalGuidance.steeringInstruction}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.72rem', color: '#FFB300', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <TacIcon name="hazard" size={14} color="#FFB300" />
                                        <span>Esperando señal GPS para trazar vector en vivo...</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                PESTAÑA 3: RESECCIÓN (2 Puntos de Referencia)
               ══════════════════════════════════════════════════════════════════════ */}
            {activeTab === "resection" && (
                <div style={{
                    flex: 1, overflowY: 'auto', overflowX: 'hidden',
                    padding: '14px 14px 90px 14px', boxSizing: 'border-box'
                }}>
                    <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                            <div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TacIcon name="crosshair" size={16} color="#38BDF8" />
                                    <span>Triangulación por Resección (2 Puntos)</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#AAA', marginTop: '2px' }}>Alinea 2 puntos visibles de referencia para calcular tu posición sin GPS:</div>
                            </div>

                            {/* Landmark 1 Card */}
                            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <TacIcon name="pin" size={12} color="#38BDF8" />
                                        <span>Punto 1 de Referencia</span>
                                    </span>
                                    {activeCoords && (
                                        <button
                                            onClick={() => updateLandmark1({ ...landmark1, lat: activeCoords.lat, lon: activeCoords.lon })}
                                            style={{ background: 'transparent', border: 'none', color: '#00E676', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            {pdrState.isTracking ? 'Usar PDR Actual' : 'Usar GPS Actual'}
                                        </button>
                                    )}
                                </div>
                                <input value={landmark1.name} onChange={e => updateLandmark1({ ...landmark1, name: e.target.value })} style={{ width: '100%', padding: '7px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', boxSizing: 'border-box' }} placeholder="Nombre (ej. Punto A)" />
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input value={landmark1.lat || ''} onChange={e => updateLandmark1({ ...landmark1, lat: parseFloat(e.target.value) || 0 })} style={{ flex: 1, minWidth: 0, padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Lat 1" />
                                    <input value={landmark1.lon || ''} onChange={e => updateLandmark1({ ...landmark1, lon: parseFloat(e.target.value) || 0 })} style={{ flex: 1, minWidth: 0, padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Lon 1" />
                                    <input value={bearing1} onChange={e => updateBearing1(e.target.value)} style={{ width: '65px', padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Rumbo°" />
                                </div>
                            </div>

                            {/* Landmark 2 Card */}
                            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#A855F7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <TacIcon name="pin" size={12} color="#A855F7" />
                                        <span>Punto 2 de Referencia</span>
                                    </span>
                                    {activeCoords && (
                                        <button
                                            onClick={() => updateLandmark2({ ...landmark2, lat: activeCoords.lat, lon: activeCoords.lon })}
                                            style={{ background: 'transparent', border: 'none', color: '#00E676', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            {pdrState.isTracking ? 'Usar PDR Actual' : 'Usar GPS Actual'}
                                        </button>
                                    )}
                                </div>
                                <input value={landmark2.name} onChange={e => updateLandmark2({ ...landmark2, name: e.target.value })} style={{ width: '100%', padding: '7px 10px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', boxSizing: 'border-box' }} placeholder="Nombre (ej. Punto B)" />
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input value={landmark2.lat || ''} onChange={e => updateLandmark2({ ...landmark2, lat: parseFloat(e.target.value) || 0 })} style={{ flex: 1, minWidth: 0, padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Lat 2" />
                                    <input value={landmark2.lon || ''} onChange={e => updateLandmark2({ ...landmark2, lon: parseFloat(e.target.value) || 0 })} style={{ flex: 1, minWidth: 0, padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Lon 2" />
                                    <input value={bearing2} onChange={e => updateBearing2(e.target.value)} style={{ width: '65px', padding: '6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem', boxSizing: 'border-box' }} placeholder="Rumbo°" />
                                </div>
                            </div>

                            <button onClick={handleCalculateTriangulation} style={{ width: '100%', padding: '10px', background: '#38BDF8', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <TacIcon name="zap" size={14} color="#000" />
                                <span>CALCULAR POSICIÓN TRIANGULADA</span>
                            </button>

                            {triangulatedPos && (
                                <div style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', padding: '12px', borderRadius: '10px', color: '#00E676', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <TacIcon name="crosshair" size={14} color="#00E676" />
                                        <span className="tabular-telemetry">Posición Triangulada: Lat {triangulatedPos.lat} | Lon {triangulatedPos.lon} (Precisión Geométrica ~{triangulatedPos.accuracyMeters}m)</span>
                                    </div>
                                    <button
                                        onClick={handleAdoptTriangulatedPos}
                                        style={{ padding: '6px 10px', background: '#00E676', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 800, fontSize: '0.74rem', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <TacIcon name="crosshair" size={12} color="#000" />
                                        <span>Adoptar Posición como Ubicación Actual</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                PESTAÑA 4: WAYPOINTS DE SUPERVIVENCIA
               ══════════════════════════════════════════════════════════════════════ */}
            {activeTab === "waypoints" && (
                <div style={{
                    flex: 1, overflowY: 'auto', overflowX: 'hidden',
                    padding: '14px 14px 90px 14px', boxSizing: 'border-box'
                }}>
                    <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                            <div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TacIcon name="pin" size={16} color="#FFB300" />
                                    <span>Registrar Waypoint de Supervivencia</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#AAA', marginTop: '2px' }}>Calcula la posición de destino por distancia y rumbo:</div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <input value={newWpName} onChange={e => setNewWpName(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.82rem', boxSizing: 'border-box' }} placeholder="Nombre (ej. Fuente de Agua)" />
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input value={newWpDist} onChange={e => setNewWpDist(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.82rem', boxSizing: 'border-box' }} placeholder="Distancia (m)" />
                                    <input value={newWpBearing} onChange={e => setNewWpBearing(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.82rem', boxSizing: 'border-box' }} placeholder="Rumbo°" />
                                    <button onClick={handleAddWaypoint} style={{ background: '#00E676', color: '#000', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <TacIcon name="plus" size={14} color="#000" />
                                        <span>Agregar</span>
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginTop: '4px', maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {waypoints.length === 0 ? (
                                    <div style={{ fontSize: '0.75rem', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>No hay waypoints registrados aún.</div>
                                ) : (
                                    waypoints.map(wp => {
                                        let liveBrg = wp.bearingDegrees;
                                        let liveDst = wp.distanceMeters;

                                        if (activeCoords && (wp.lat !== 0 || wp.lon !== 0)) {
                                            const rel = OffGridNavigationEngine.calculateDistanceAndBearing(activeCoords.lat, activeCoords.lon, wp.lat, wp.lon);
                                            liveBrg = rel.bearingDegrees;
                                            liveDst = rel.distanceMeters;
                                        }

                                        return (
                                            <div key={wp.id} style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <TacIcon name="pin" size={14} color="#00E676" />
                                                        <strong>{wp.name}</strong>
                                                    </div>
                                                    {liveDst > 0 && (
                                                        <div className="tabular-telemetry" style={{ fontSize: '0.68rem', color: '#38BDF8', marginTop: '2px' }}>
                                                            📡 Fresnel 915MHz: r₁ = {OffGridNavigationEngine.calculateFresnelZone(liveDst, 915).maxRadiusMeters}m
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="tabular-telemetry" style={{ color: '#00E676', fontWeight: 700, fontFamily: 'monospace' }}>{liveBrg}° • {liveDst}m</span>
                                                    <button
                                                        onClick={() => {
                                                            handleSetTarget(wp.lat, wp.lon, wp.name);
                                                            setActiveTab("map");
                                                        }}
                                                        style={{ background: 'rgba(232,33,58,0.2)', border: '1px solid #E8213A', color: '#FFF', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        title="Navegar hacia este waypoint"
                                                    >
                                                        <TacIcon name="crosshair" size={12} />
                                                        <span>Guiar</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleBroadcastWaypoint(wp)}
                                                        style={{ background: 'rgba(0,229,255,0.2)', border: '1px solid #00E5FF', color: '#00E5FF', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        title="Transmitir waypoint a la malla del escuadrón"
                                                    >
                                                        <TacIcon name="radio" size={12} />
                                                        <span>Malla</span>
                                                    </button>
                                                    <button onClick={() => handleDeleteWaypoint(wp.id)} style={{ background: 'transparent', border: 'none', color: '#E8213A', cursor: 'pointer', padding: '4px' }} title="Eliminar waypoint">
                                                        <TacIcon name="trash" size={14} color="#E8213A" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

