"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { localTransport } from "../lib/mesh/localTransport";

/** Derive a deterministic lat/lng from a peer ID string (no Math.random). */
function peerToCoords(peerId: string): { lat: number; lng: number } {
    // Use char codes of peer ID bytes to seed lat/lng deterministically
    let hash1 = 0, hash2 = 0;
    for (let i = 0; i < peerId.length; i++) {
        const c = peerId.charCodeAt(i);
        if (i % 2 === 0) hash1 = (hash1 * 31 + c) & 0xFFFFFF;
        else             hash2 = (hash2 * 31 + c) & 0xFFFFFF;
    }
    const lat = ((hash1 % 180000) / 1000) - 90;   // -90 .. +90
    const lng = ((hash2 % 360000) / 1000) - 180;  // -180 .. +180
    return { lat, lng };
}

const TRANSPORT_COLOR: Record<string, string> = {
    wifi:    '#00D97E',
    ble:     '#3498db',
    lorawan: '#9b59b6',
};

export default function NodeMap() {
    const { status, goBack } = useRedStore();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [globeLoaded, setGlobeLoaded] = useState(false);
    const [peers, setPeers] = useState(localTransport.allPeers);
    const [myPos, setMyPos] = useState<{lat: number, lng: number}>({ lat: 0, lng: 0 });
    const [realGPS, setRealGPS] = useState(false);

    // Conectar a GPS Nativo en Background/Foreground
    useEffect(() => {
        let mounted = true;
        const fetchGeo = async () => {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                const permission = await Geolocation.checkPermissions();
                if (permission.location !== 'granted') await Geolocation.requestPermissions();
                
                const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
                if (mounted) {
                    setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setRealGPS(true);
                }
            } catch (e) {
                console.warn("GPS no disponible, usando centro criptográfico.", e);
            }
        };
        fetchGeo();
        return () => { mounted = false; };
    }, []);

    // Refresh peer list every 4s
    useEffect(() => {
        const t = setInterval(() => setPeers([...localTransport.allPeers]), 4000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        let globeInstance: any = null;

        if (typeof window !== "undefined" && mapContainerRef.current) {
            import("globe.gl").then((GlobeModule) => {
                const Globe = GlobeModule.default;

                // Build arc data from REAL peers to our REAL GPS
                const arcsData = peers.map(peer => {
                    const { lat, lng } = peerToCoords(peer.id);
                    return {
                        startLat: myPos.lat,
                        startLng: myPos.lng,
                        endLat: lat,
                        endLng: lng,
                        color: TRANSPORT_COLOR[peer.transport] || '#e8213a',
                        peerId: peer.id,
                    };
                });

                const ringsData = arcsData.map(d => ({ lat: d.endLat, lng: d.endLng }));

                // @ts-ignore
                globeInstance = Globe()(mapContainerRef.current!)
                    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
                    .backgroundColor('#050914')
                    .arcsData(arcsData)
                    .arcColor('color')
                    .arcDashLength(0.4)
                    .arcDashGap(0.2)
                    .arcDashAnimateTime(1500)
                    .ringsData(ringsData)
                    .ringColor(() => '#e74c3c')
                    .ringMaxRadius(5)
                    .ringPropagationSpeed(3)
                    .ringRepeatPeriod(700);

                globeInstance.controls().autoRotate = true;
                globeInstance.controls().autoRotateSpeed = 1.2;

                setGlobeLoaded(true);
            }).catch(() => {
                // globe.gl not available (e.g. SSR or no WebGL) — show fallback
                setGlobeLoaded(false);
            });
        }

        return () => {
            if (globeInstance && globeInstance._destructor) {
                globeInstance._destructor();
            }
        };
    }, [peers]);

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#050914' }}>

            {/* Context Header */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 'calc(24px + var(--safe-top, 0px)) 24px 24px 24px', zIndex: 10, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pointerEvents: 'none' }}>
                <div style={{ display: 'flex', gap: '16px', pointerEvents: 'auto' }}>
                    <button onClick={goBack} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', color: 'white', width: 48, height: 48, borderRadius: 24, fontSize: '1.5rem', border: '1px solid var(--solid-border)', cursor: 'pointer' }}>←</button>
                    <div>
                        <h1 style={{ color: 'white', margin: 0, fontSize: '1.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Geometría de Nodos</h1>
                        <p style={{ color: 'var(--primary)', margin: 0, fontWeight: 'bold', fontSize: '0.85rem' }}>
                            {peers.length} nodo{peers.length !== 1 ? 's' : ''} en malla — RED P2P
                        </p>
                    </div>
                </div>

                <div style={{ background: 'linear-gradient(135deg, rgba(13,13,22,0.85), rgba(8,8,16,0.95))', backdropFilter: 'blur(16px)', padding: '16px 20px', borderRadius: '20px', border: '1px solid rgba(232,33,58,0.3)', pointerEvents: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 12 }}>
                        <div className="pulsing-dot" style={{ width: 10, height: 10, borderRadius: 5, background: peers.length > 0 ? 'var(--primary-bright)' : 'var(--text-muted)' }} />
                        <span style={{ color: 'white', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 800, letterSpacing: 1 }}>
                            {peers.length > 0 ? 'MALLA ACTIVA' : 'MALLA OFFLINE'}
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '4px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 700 }}>Origen:</span>
                        <span style={{ fontFamily: 'monospace', color: realGPS ? 'var(--success)' : 'var(--text-secondary)' }}>
                            {realGPS ? `${myPos.lat.toFixed(4)}, ${myPos.lng.toFixed(4)}` : 'Ofuscado'}
                        </span>
                        <span style={{ fontWeight: 700 }}>Chain:</span>
                        <span style={{ fontFamily: 'monospace' }}>#{status?.chain_height ?? '0'}</span>
                    </div>
                </div>
            </div>

            {/* WebGL Mount Point */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', opacity: globeLoaded ? 1 : 0, transition: 'opacity 1s' }} />

            {!globeLoaded && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: 'var(--primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
                        Construyendo Malla Satelital...
                    </span>
                </div>
            )}
        </div>
    );
}
