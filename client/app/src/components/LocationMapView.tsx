import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRedStore, LiveLocation } from '../store/useRedStore';

// Fix typical Leaflet icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface LocationMapViewProps {
    peerId?: string;
}

export default function LocationMapView({ peerId }: LocationMapViewProps) {
    const { myLocation, peerLocations, isSharingLocation } = useRedStore();

    // Determine whose location to focus on
    const targetLocation = peerId ? peerLocations[peerId] : myLocation;

    if (!targetLocation) {
        return (
            <div style={{ height: '300px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius)' }}>
                <p className="font-mono text-muted text-sm" style={{ color: 'var(--text-muted)' }}>
                    {isSharingLocation ? 'Adquiriendo GPS...' : 'Ubicación no disponible'}
                </p>
            </div>
        );
    }

    const position: [number, number] = [targetLocation.lat, targetLocation.lng];

    // Custom dark-mode compatible icon for peers
    const peerIcon = L.divIcon({
        className: 'custom-peer-marker',
        html: `<div style="background-color: var(--primary); width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px var(--primary-glow);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    return (
        <div style={{ height: '300px', width: '100%', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
            <MapContainer
                center={position}
                zoom={16}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%', background: 'var(--bg-2)' }}
                attributionControl={false}
            >
                {/* Dark themed map tiles (CARTO Dark Matter) */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                <Marker position={position} icon={peerIcon}>
                    <Popup className="custom-popup font-mono">
                        {peerId ? `Sujeto: ${peerId.substring(0, 8)}` : 'Tú (Transmitiendo)'}
                    </Popup>
                </Marker>

                {/* Accuracy Radius */}
                <Circle
                    center={position}
                    radius={targetLocation.accuracy}
                    pathOptions={{ fillColor: 'var(--primary)', fillOpacity: 0.1, color: 'var(--primary)', weight: 1 }}
                />
            </MapContainer>
        </div>
    );
}
