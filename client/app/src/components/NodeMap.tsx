"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { localTransport } from "../lib/mesh/localTransport";
import { RedAPI } from "../lib/api";

const TRANSPORT_COLOR: Record<string, string> = {
    wifi:    '#00D97E',
    ble:     '#38bdf8',
    lorawan: '#9b59b6',
};

function getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

/** Calculate relative lat/lng offset based on real GPS or node index & hash for realistic tactical positioning */
function derivePeerPosition(myLat: number, myLng: number, peer: { id: string; lat?: number; lng?: number }, index: number): { lat: number; lng: number; distMeters: number } {
    if (typeof peer.lat === 'number' && typeof peer.lng === 'number' && peer.lat !== 0 && peer.lng !== 0) {
        const distMeters = getHaversineDistanceMeters(myLat, myLng, peer.lat, peer.lng);
        return { lat: peer.lat, lng: peer.lng, distMeters };
    }

    let hash = 0;
    for (let i = 0; i < peer.id.length; i++) {
        hash = (hash * 31 + peer.id.charCodeAt(i)) & 0xFFFFFF;
    }
    // Radius between 15 meters and 120 meters for local mesh simulation
    const angleRad = ((hash % 360) * Math.PI) / 180;
    const distMeters = 15 + ((hash % 90) + (index * 20));
    
    // 1 degree lat ~ 111,000 meters
    const deltaLat = (distMeters * Math.cos(angleRad)) / 111000;
    const deltaLng = (distMeters * Math.sin(angleRad)) / (111000 * Math.cos((myLat * Math.PI) / 180));
    
    return {
        lat: myLat + deltaLat,
        lng: myLng + deltaLng,
        distMeters: Math.round(distMeters)
    };
}

export default function NodeMap() {
    const { status, goBack, navigate, addContact } = useRedStore();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<any>(null);
    const markersGroupRef = useRef<any>(null);
    
    const [mapMode, setMapMode] = useState<'tactical' | 'satellite' | 'globe'>('tactical');
    const [peers, setPeers] = useState<Array<{ id: string; transport: string; name?: string; rssi?: number }>>([]);
    const [myPos, setMyPos] = useState<{ lat: number; lng: number }>({ lat: -12.1383, lng: -76.9828 });
    const [realGPS, setRealGPS] = useState(false);
    const [selectedPeer, setSelectedPeer] = useState<any>(null);
    const [globeLoaded, setGlobeLoaded] = useState(false);
    const globeInstanceRef = useRef<any>(null);

    // 1. Fetch Real Native GPS Position with Continuous Watcher
    useEffect(() => {
        let mounted = true;
        let watchId: string | null = null;

        const initGeoWatch = async () => {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                const permission = await Geolocation.checkPermissions().catch(() => null);
                if (permission?.location !== 'granted') {
                    await Geolocation.requestPermissions().catch(() => null);
                }
                
                // Get immediate position first
                const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true }).catch(() => null);
                if (mounted && pos?.coords) {
                    setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setRealGPS(true);
                }

                // Continuous real-time movement watcher
                watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position) => {
                    if (mounted && position?.coords) {
                        setMyPos({ lat: position.coords.latitude, lng: position.coords.longitude });
                        setRealGPS(true);
                    }
                });
            } catch (e) {
                console.warn("[NodeMap] GPS fallback:", e);
            }
        };

        initGeoWatch();

        return () => {
            mounted = false;
            if (watchId) {
                import('@capacitor/geolocation').then(({ Geolocation }) => {
                    Geolocation.clearWatch({ id: watchId! }).catch(() => {});
                });
            }
        };
    }, []);

    // 2. Poll Active Peers (RedAPI + localTransport)
    useEffect(() => {
        const updatePeers = async () => {
            try {
                const apiPeers = await RedAPI.getPeers().catch(() => []);
                const localPeers = localTransport.allPeers;
                
                const map = new Map<string, { id: string; transport: string; name?: string; rssi?: number }>();
                for (const p of localPeers) {
                    map.set(p.id, { id: p.id, transport: p.transport, name: p.id.slice(0, 10), rssi: p.rssi || -65 });
                }
                for (const p of apiPeers) {
                    if (!map.has(p.id)) {
                        map.set(p.id, { id: p.id, transport: p.transport || 'wifi', name: p.id.slice(0, 10), rssi: -70 });
                    }
                }
                setPeers(Array.from(map.values()));
            } catch {
                setPeers([...localTransport.allPeers]);
            }
        };

        updatePeers();
        const t = setInterval(updatePeers, 3000);
        return () => clearInterval(t);
    }, []);

    // 3. Inject Leaflet CSS dynamically
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const cssId = 'leaflet-css-cdn';
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
    }, []);

    // 4. Initialize & Update 2D Tactical Leaflet Map
    useEffect(() => {
        if (mapMode === 'globe') return;
        if (typeof window === 'undefined' || !mapContainerRef.current) return;

        let map = leafletMapRef.current;

        const initLeaflet = async () => {
            const L = (await import('leaflet')).default;

            if (!map) {
                // Create map centered on user GPS
                map = L.map(mapContainerRef.current!, {
                    center: [myPos.lat, myPos.lng],
                    zoom: 17,
                    zoomControl: false,
                    attributionControl: false,
                });
                leafletMapRef.current = map;
                markersGroupRef.current = L.layerGroup().addTo(map);

                // Re-center button action
                L.control.zoom({ position: 'bottomright' }).addTo(map);
            }

            // Remove existing tile layers
            map.eachLayer((layer: any) => {
                if (layer instanceof L.TileLayer) map.removeLayer(layer);
            });

            // Select Tile Layer based on mode
            const tileUrl = mapMode === 'satellite'
                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

            const tileLayer = L.tileLayer(tileUrl, {
                maxZoom: 19,
                subdomains: 'abcd',
            });

            // Graceful offline tile error handling (no broken tile icons when offline)
            tileLayer.on('tileerror', (e: any) => {
                if (e.tile) e.tile.style.display = 'none';
            });

            tileLayer.addTo(map);

            // Clear old markers & polylines
            markersGroupRef.current.clearLayers();

            // Custom User Icon (Glowing Red Operator Beacon)
            const userIcon = L.divIcon({
                className: 'custom-user-icon',
                html: `
                    <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
                        <div style="position:absolute; inset:0; border-radius:50%; background:rgba(232,33,58,0.25); border:2px solid #E8213A; animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
                        <div style="width:16px; height:16px; border-radius:50%; background:#E8213A; border:2px solid white; box-shadow:0 0 12px #E8213A;"></div>
                    </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 18],
            });

            // User GPS Marker
            const userMarker = L.marker([myPos.lat, myPos.lng], { icon: userIcon })
                .bindPopup(`
                    <div style="background:#0b0f19; color:white; padding:10px; border-radius:10px; font-family:sans-serif;">
                        <strong style="color:#E8213A;">📍 TU POSICIÓN</strong><br/>
                        <span style="font-size:0.75rem; color:#aaa;">GPS: ${myPos.lat.toFixed(5)}, ${myPos.lng.toFixed(5)}</span>
                    </div>
                `);
            markersGroupRef.current.addLayer(userMarker);

            // User Accuracy Pulse Circle
            const userCircle = L.circle([myPos.lat, myPos.lng], {
                radius: 25,
                color: '#E8213A',
                fillColor: '#E8213A',
                fillOpacity: 0.08,
                weight: 1,
            });
            markersGroupRef.current.addLayer(userCircle);

            // Render Peer Markers & Vectors
            peers.forEach((peer, idx) => {
                const pos = derivePeerPosition(myPos.lat, myPos.lng, peer, idx);
                const color = TRANSPORT_COLOR[peer.transport] || '#38bdf8';

                // Vector line linking user to peer
                const polyline = L.polyline([
                    [myPos.lat, myPos.lng],
                    [pos.lat, pos.lng]
                ], {
                    color: color,
                    weight: 2,
                    dashArray: '6, 8',
                    opacity: 0.85
                });
                markersGroupRef.current.addLayer(polyline);

                // Peer Marker Icon
                const peerIcon = L.divIcon({
                    className: 'custom-peer-icon',
                    html: `
                        <div style="position:relative; width:30px; height:30px; display:flex; align-items:center; justify-content:center;">
                            <div style="width:14px; height:14px; border-radius:50%; background:${color}; border:2px solid white; box-shadow:0 0 10px ${color};"></div>
                            <span style="position:absolute; top:-18px; white-space:nowrap; background:rgba(0,0,0,0.85); color:white; padding:2px 6px; border-radius:6px; font-size:10px; font-weight:800; border:1px solid ${color}; font-family:monospace;">
                                ${peer.id.slice(0, 8)} (${pos.distMeters}m)
                            </span>
                        </div>
                    `,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                });

                const marker = L.marker([pos.lat, pos.lng], { icon: peerIcon });
                marker.on('click', () => {
                    setSelectedPeer({ ...peer, ...pos });
                });
                markersGroupRef.current.addLayer(marker);
            });

            // Smooth pan to user location
            map.panTo([myPos.lat, myPos.lng], { animate: true });
        };

        initLeaflet();
    }, [mapMode, myPos, peers]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#050914', overflow: 'hidden' }}>

            {/* Header Controls */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                padding: 'calc(16px + var(--safe-top, 0px)) 16px 12px 16px',
                zIndex: 1000, display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', pointerEvents: 'none'
            }}>
                <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto', alignItems: 'center' }}>
                    <button
                        onClick={goBack}
                        style={{
                            background: 'rgba(10,15,28,0.9)', backdropFilter: 'blur(12px)',
                            color: 'white', width: 44, height: 44, borderRadius: 14,
                            fontSize: '1.2rem', border: '1px solid rgba(255,255,255,0.15)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        ←
                    </button>
                    <div>
                        <h1 style={{ color: 'white', margin: 0, fontSize: '1.2rem', fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                            MAPA TÁCTICO P2P
                        </h1>
                        <p style={{ color: '#00D97E', margin: 0, fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D97E', display: 'inline-block', boxShadow: '0 0 6px #00D97E' }} />
                            {peers.length} nodo{peers.length !== 1 ? 's' : ''} en rango · GPS Nativo
                        </p>
                    </div>
                </div>

                {/* Mode Selector (Tactical / Satellite) */}
                <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto', background: 'rgba(10,15,28,0.9)', backdropFilter: 'blur(12px)', padding: 4, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}>
                    <button
                        onClick={() => setMapMode('tactical')}
                        style={{
                            padding: '6px 12px', borderRadius: 10, border: 'none',
                            background: mapMode === 'tactical' ? 'var(--primary)' : 'transparent',
                            color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
                        }}
                    >
                        🗺️ Táctico
                    </button>
                    <button
                        onClick={() => setMapMode('satellite')}
                        style={{
                            padding: '6px 12px', borderRadius: 10, border: 'none',
                            background: mapMode === 'satellite' ? 'var(--primary)' : 'transparent',
                            color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
                        }}
                    >
                        🛰️ Satélite
                    </button>
                </div>
            </div>

            {/* Tactical Info Badge */}
            <div style={{
                position: 'absolute', bottom: '24px', left: '16px', zIndex: 1000,
                background: 'linear-gradient(135deg, rgba(13,13,22,0.92), rgba(8,8,16,0.96))',
                backdropFilter: 'blur(16px)', padding: '12px 16px', borderRadius: '16px',
                border: '1px solid rgba(56,189,248,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                maxWidth: 280
            }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                    Coordenadas GPS de Operador
                </div>
                <div style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
                    {myPos.lat.toFixed(5)}, {myPos.lng.toFixed(5)}
                </div>
                <div style={{ fontSize: '0.68rem', color: realGPS ? '#00D97E' : '#f59e0b', marginTop: 4, fontWeight: 700 }}>
                    {realGPS ? '✓ GPS NATIVO ALTA PRECISIÓN' : '⚠️ GPS EN MODO ESTIMADO'}
                </div>
            </div>

            {/* Selected Peer Tactical Card */}
            {selectedPeer && (
                <div style={{
                    position: 'absolute', bottom: '24px', right: '16px', left: '16px', zIndex: 1001,
                    margin: '0 auto', maxWidth: 360,
                    background: 'linear-gradient(145deg, #0f172a, #0b0f19)',
                    border: '1px solid rgba(56,189,248,0.4)', borderRadius: 20,
                    padding: 18, boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
                    animation: 'slideUp 0.25s ease-out'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontWeight: 800, color: 'white', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: TRANSPORT_COLOR[selectedPeer.transport] || '#38bdf8' }} />
                            Nodo {selectedPeer.id.slice(0, 12)}…
                        </div>
                        <button onClick={() => setSelectedPeer(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.78rem', color: '#94a3b8', marginBottom: 14 }}>
                        <div style={{ background: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 8 }}>
                            <span style={{ color: '#fff', fontWeight: 700 }}>Distancia:</span> ~{selectedPeer.distMeters} m
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 8 }}>
                            <span style={{ color: '#fff', fontWeight: 700 }}>Transporte:</span> {selectedPeer.transport.toUpperCase()}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            onClick={async () => {
                                await addContact(selectedPeer.id, `Nodo ${selectedPeer.id.slice(0, 8)}`);
                                setSelectedPeer(null);
                                navigate('chat', selectedPeer.id);
                            }}
                            className="btn-primary"
                            style={{ flex: 1, padding: 10, fontSize: '0.82rem', borderRadius: 12 }}
                        >
                            💬 Abrir Chat P2P
                        </button>
                    </div>
                </div>
            )}

            {/* 2D Leaflet Map Container */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

            <style jsx global>{`
                .leaflet-container {
                    background: #050914 !important;
                }
                .leaflet-popup-content-wrapper {
                    background: #0b0f19 !important;
                    color: white !important;
                    border: 1px solid rgba(255,255,255,0.15) !important;
                    border-radius: 12px !important;
                }
                .leaflet-popup-tip {
                    background: #0b0f19 !important;
                }
                @keyframes ping {
                    75%, 100% {
                        transform: scale(2.2);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    );
}
