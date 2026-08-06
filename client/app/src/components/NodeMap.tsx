"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { localTransport } from "../lib/mesh/localTransport";
import { RedAPI } from "../lib/api";

/** Derive deterministic lat/lng from peer ID if no GPS provided. */
function peerToCoords(peerId: string): { lat: number; lng: number } {
    let hash1 = 0, hash2 = 0;
    for (let i = 0; i < peerId.length; i++) {
        const c = peerId.charCodeAt(i);
        if (i % 2 === 0) hash1 = (hash1 * 31 + c) & 0xFFFFFF;
        else             hash2 = (hash2 * 31 + c) & 0xFFFFFF;
    }
    const lat = ((hash1 % 140000) / 1000) - 70;   // -70 .. +70
    const lng = ((hash2 % 360000) / 1000) - 180;  // -180 .. +180
    return { lat, lng };
}

const TRANSPORT_COLOR: Record<string, string> = {
    wifi:    '#00D97E',
    ble:     '#38bdf8',
    lorawan: '#9b59b6',
};

/** Generate local offline canvas texture for 3D Globe */
function createLocalGlobeTexture(): string {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#040814');
        grad.addColorStop(0.5, '#0b162c');
        grad.addColorStop(1, '#040814');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 256);

        // Tactical grid lines
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= 512; x += 32) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
        }
        for (let y = 0; y <= 256; y += 32) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
        }
    }
    return canvas.toDataURL();
}

export default function NodeMap() {
    const { status, goBack } = useRedStore();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const globeInstanceRef = useRef<any>(null);
    const [globeLoaded, setGlobeLoaded] = useState(false);
    const [peers, setPeers] = useState<Array<{ id: string; transport: string }>>([]);
    const [myPos, setMyPos] = useState<{ lat: number; lng: number }>({ lat: -12.1383, lng: -76.9828 });
    const [realGPS, setRealGPS] = useState(false);

    // 1. Fetch real GPS position
    useEffect(() => {
        let mounted = true;
        const fetchGeo = async () => {
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                const permission = await Geolocation.checkPermissions().catch(() => null);
                if (permission?.location !== 'granted') {
                    await Geolocation.requestPermissions().catch(() => null);
                }
                
                const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
                if (mounted && pos?.coords) {
                    setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setRealGPS(true);
                }
            } catch (e) {
                console.warn("[NodeMap] GPS fallback to active center:", e);
            }
        };
        fetchGeo();
        return () => { mounted = false; };
    }, []);

    // 2. Poll active peers
    useEffect(() => {
        const updatePeers = async () => {
            try {
                const apiPeers = await RedAPI.getPeers().catch(() => []);
                const localPeers = localTransport.allPeers;
                
                const map = new Map<string, { id: string; transport: string }>();
                for (const p of localPeers) {
                    map.set(p.id, { id: p.id, transport: p.transport });
                }
                for (const p of apiPeers) {
                    if (!map.has(p.id)) {
                        map.set(p.id, { id: p.id, transport: p.transport || 'wifi' });
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

    // 3. Initialize Globe ONCE on mount
    useEffect(() => {
        if (typeof window === "undefined" || !mapContainerRef.current) return;
        let isSubscribed = true;

        import("globe.gl").then((GlobeModule) => {
            if (!isSubscribed || !mapContainerRef.current) return;
            const Globe = GlobeModule.default;
            const localImg = createLocalGlobeTexture();

            // Initialize Three.js Globe once
            // @ts-ignore
            const globe = Globe()(mapContainerRef.current)
                .globeImageUrl(localImg)
                .backgroundColor('#050914')
                .arcColor('color')
                .arcDashLength(0.4)
                .arcDashGap(0.2)
                .arcDashAnimateTime(1500)
                .ringColor(() => '#e74c3c')
                .ringMaxRadius(6)
                .ringPropagationSpeed(3)
                .ringRepeatPeriod(700);

            globe.controls().autoRotate = true;
            globe.controls().autoRotateSpeed = 1.0;

            globeInstanceRef.current = globe;
            setGlobeLoaded(true);
        }).catch(err => {
            console.warn('[NodeMap] Globe WebGL init fallback:', err);
            setGlobeLoaded(false);
        });

        return () => {
            isSubscribed = false;
            if (globeInstanceRef.current && typeof globeInstanceRef.current._destructor === 'function') {
                globeInstanceRef.current._destructor();
                globeInstanceRef.current = null;
            }
        };
    }, []);

    // 4. Update data on existing Globe instance WITHOUT destroying WebGL context
    useEffect(() => {
        if (!globeInstanceRef.current) return;

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

        const ringsData = [
            { lat: myPos.lat, lng: myPos.lng },
            ...arcsData.map(d => ({ lat: d.endLat, lng: d.endLng }))
        ];

        globeInstanceRef.current
            .arcsData(arcsData)
            .ringsData(ringsData);

        if (realGPS) {
            globeInstanceRef.current.pointOfView({ lat: myPos.lat, lng: myPos.lng, altitude: 2.2 }, 1000);
        }
    }, [peers, myPos, realGPS]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#050914', overflow: 'hidden' }}>

            {/* Context Header */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                padding: 'calc(16px + var(--safe-top, 0px)) 16px 16px 16px',
                zIndex: 10, display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', pointerEvents: 'none'
            }}>
                <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto', alignItems: 'center' }}>
                    <button
                        onClick={goBack}
                        style={{
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
                            color: 'white', width: 44, height: 44, borderRadius: 22,
                            fontSize: '1.3rem', border: '1px solid rgba(255,255,255,0.15)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        ←
                    </button>
                    <div>
                        <h1 style={{ color: 'white', margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>Geometría de Nodos</h1>
                        <p style={{ color: 'var(--primary-bright)', margin: 0, fontWeight: 700, fontSize: '0.8rem' }}>
                            {peers.length} nodo{peers.length !== 1 ? 's' : ''} en malla — RED P2P
                        </p>
                    </div>
                </div>

                <div style={{
                    background: 'linear-gradient(135deg, rgba(13,13,22,0.9), rgba(8,8,16,0.95))',
                    backdropFilter: 'blur(16px)', padding: '12px 16px', borderRadius: '16px',
                    border: '1px solid rgba(232,33,58,0.3)', pointerEvents: 'auto',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 8 }}>
                        <div className="pulsing-dot" style={{ width: 10, height: 10, borderRadius: 5, background: peers.length > 0 ? '#00D97E' : '#E8213A' }} />
                        <span style={{ color: 'white', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', fontWeight: 800, letterSpacing: 1 }}>
                            {peers.length > 0 ? 'MALLA ACTIVA' : 'MALLA OFFLINE'}
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '4px 10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 700 }}>Origen:</span>
                        <span style={{ fontFamily: 'monospace', color: realGPS ? '#00D97E' : '#E8213A', fontWeight: 700 }}>
                            {myPos.lat.toFixed(4)}, {myPos.lng.toFixed(4)}
                        </span>
                        <span style={{ fontWeight: 700 }}>Chain:</span>
                        <span style={{ fontFamily: 'monospace' }}>#{status?.chain_height ?? '0'}</span>
                    </div>
                </div>
            </div>

            {/* WebGL Mount Point */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', opacity: globeLoaded ? 1 : 0, transition: 'opacity 0.5s' }} />

            {!globeLoaded && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#050914' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: 'var(--primary-bright)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 700 }}>
                        Construyendo Malla Satelital P2P…
                    </span>
                </div>
            )}
        </div>
    );
}
