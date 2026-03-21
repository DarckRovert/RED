"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import * as THREE from "three";

export default function NodeMap() {
    const { status, goBack } = useRedStore();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [globeLoaded, setGlobeLoaded] = useState(false);

    useEffect(() => {
        let globeInstance: any = null;

        if (typeof window !== "undefined" && mapContainerRef.current) {
            import("globe.gl").then((GlobeModule) => {
                const Globe = GlobeModule.default;
                
                // Generate random mock nodes based on peer_count
                const N = status?.peer_count ? Math.max(status.peer_count * 3, 15) : 15;
                const arcsData = [...Array(N).keys()].map(() => ({
                    startLat: (Math.random() - 0.5) * 180,
                    startLng: (Math.random() - 0.5) * 360,
                    endLat: (Math.random() - 0.5) * 180,
                    endLng: (Math.random() - 0.5) * 360,
                    color: ['var(--primary)', 'var(--danger)', '#3498db'][Math.round(Math.random() * 2)]
                }));

                const ringsData = arcsData.map(d => ({ lat: d.startLat, lng: d.startLng }));

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
                
                // Spin animation
                globeInstance.controls().autoRotate = true;
                globeInstance.controls().autoRotateSpeed = 1.5;

                // Add ambient light
                const scene = globeInstance.scene();
                scene.add(new THREE.AmbientLight(0xffffff, 0.8));
                
                setGlobeLoaded(true);
            });
        }

        return () => {
            if (globeInstance) {
                // Destroy globe on unmount to prevent WebGL memory leaks
                globeInstance._destructor();
            }
        };
    }, [status]);

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#050914' }}>
            
            {/* Context Header */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '24px', zIndex: 10, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pointerEvents: 'none' }}>
                <div style={{ display: 'flex', gap: '16px', pointerEvents: 'auto' }}>
                    <button onClick={goBack} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', color: 'white', width: 48, height: 48, borderRadius: 24, fontSize: '1.5rem', border: '1px solid var(--solid-border)' }}>←</button>
                    <div>
                        <h1 style={{ color: 'white', margin: 0, fontSize: '1.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Geometría de Nodos</h1>
                        <p style={{ color: 'var(--primary)', margin: 0, fontWeight: 'bold' }}>RED P2P Tor Network</p>
                    </div>
                </div>
                
                <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', padding: '16px', borderRadius: '16px', border: '1px solid var(--primary)', pointerEvents: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="pulsing-dot" style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--success)' }} />
                        <span style={{ color: 'white', fontFamily: 'monospace' }}>Malla Global Activa</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>Enrutando mediante ChaCha20</p>
                </div>
            </div>

            {/* WebGL Mount Point */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', opacity: globeLoaded ? 1 : 0, transition: 'opacity 1s' }} />
            
            {!globeLoaded && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    Construyendo Malla Satelital...
                </div>
            )}
        </div>
    );
}
