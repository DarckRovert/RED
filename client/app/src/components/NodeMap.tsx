"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { localTransport } from "../lib/mesh/localTransport";
import { RedAPI } from "../lib/api";
import { meshRouter } from "../lib/mesh/meshRouter";
import { HiveMindEngine } from "../lib/hiveMindEngine";
import { toast } from "./Toast";
import { OffGridNavigationEngine, TacticalTarget } from "../lib/OffGridNavigationEngine";
import { offlineTileCacheEngine, TileDownloadProgress, TileCacheStats } from "../lib/storage/OfflineTileCacheEngine";
import { tacticalGeofence } from "../lib/sensors/TacticalGeofenceEngine";
import { deadDropVault } from "../lib/storage/DeadDropVaultEngine";
import { milStd2525 } from "../lib/tactical/MilStd2525Engine";
import { sitrepEngine, SitrepReport } from "../lib/tactical/SitrepEngine";
import { pedestrianDeadReckoning, PdrState } from "../lib/sensors/PedestrianDeadReckoningEngine";
import { TacticalLocationEngine, TacticalLocation } from "../lib/sensors/TacticalLocationEngine";
import { tacticalCompass } from "../lib/sensors/TacticalCompassEngine";
import { tacticalRdf } from "../lib/sensors/TacticalRdfEngine";
import { meshUavRelayEngine } from "../lib/mesh/MeshUavRelayEngine";
import { cbrnPlumeDispersionEngine, CbrnIncidentSource } from "../lib/tactical/CbrnPlumeDispersionEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { copyToClipboard } from "../lib/clipboard";
import { TacIcon } from "./ui/TacIcon";

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

function derivePeerPosition(myLat: number, myLng: number, peer: { id: string; lat?: number; lng?: number; rssi?: number }): { lat: number; lng: number; distMeters: number; isEstimated: boolean } {
    // 1. Si el nodo remoto transmitió sus coordenadas GPS reales por la malla
    if (typeof peer.lat === "number" && typeof peer.lng === "number" && peer.lat !== 0 && peer.lng !== 0) {
        const distMeters = getHaversineDistanceMeters(myLat, myLng, peer.lat, peer.lng);
        return { lat: peer.lat, lng: peer.lng, distMeters, isEstimated: false };
    }

    // 2. Modelo Físico Log-Distance Path Loss a partir de la potencia de señal real (RSSI)
    const rssi = peer.rssi ?? -85;
    const measuredPower = -59; // Potencia medida de referencia a 1 metro
    const n = 2.0; // Exponente de propagación en espacio libre / interiores
    const rawDist = Math.pow(10, (measuredPower - rssi) / (10 * n));
    const distMeters = Math.max(1, Math.min(150, Math.round(rawDist)));

    // Dispersión radial determinista basada en el identificador canónico del dispositivo
    let hash = 0;
    for (let i = 0; i < peer.id.length; i++) {
        hash = (hash * 31 + peer.id.charCodeAt(i)) >>> 0;
    }
    const angleRad = ((hash % 360) * Math.PI) / 180;
    
    const deltaLat = (distMeters * Math.cos(angleRad)) / 111000;
    const deltaLng = (distMeters * Math.sin(angleRad)) / (111000 * Math.cos((myLat * Math.PI) / 180));
    
    return {
        lat: myLat + deltaLat,
        lng: myLng + deltaLng,
        distMeters,
        isEstimated: true
    };
}

export interface CanonicalNode {
    id: string;
    canonicalId: string;
    name: string;
    transports: string[];
    primaryTransport: 'wifi' | 'ble' | 'lora' | string;
    rssi?: number;
    lastSeen: number;
    lat?: number;
    lng?: number;
    distMeters?: number;
    isEstimated?: boolean;
    isContact: boolean;
    batteryLevel?: number;
    activeModel?: string | null;
    cpuUsagePercent?: number;
    availableRamMb?: number;
    isCharging?: boolean;
}

export default function NodeMap() {
    const { status, contacts, identity, goBack, navigate, addContact } = useRedStore();
    const { t } = useTranslation();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<any>(null);
    const markersGroupRef = useRef<any>(null);
    
    const [peers, setPeers] = useState<CanonicalNode[]>([]);
    const [gpsData, setGpsData] = useState<{
        lat: number;
        lng: number;
        accuracy?: number;
        altitude?: number;
        speed?: number;
        heading?: number;
        timestamp: number;
    }>(() => {
        const last = TacticalLocationEngine.getLastKnownLocation();
        if (last && TacticalLocationEngine.isValidCoordinates(last.lat, last.lon)) {
            return {
                lat: last.lat!,
                lng: last.lon!,
                accuracy: last.accuracy,
                altitude: last.alt,
                speed: last.speed,
                heading: last.heading,
                timestamp: last.timestamp
            };
        }
        return { lat: 0, lng: 0, timestamp: Date.now() };
    });
    const [realGPS, setRealGPS] = useState(false);
    const [selectedPeer, setSelectedPeer] = useState<CanonicalNode | null>(null);
    const [showTelemetryDrawer, setShowTelemetryDrawer] = useState(false);
    const [showVaultModal, setShowVaultModal] = useState(false);
    const [vaultRadiusKm, setVaultRadiusKm] = useState(10);
    const [vaultStats, setVaultStats] = useState<TileCacheStats | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<TileDownloadProgress | null>(null);
    const [isDownloadingVault, setIsDownloadingVault] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const osmLayerRef = useRef<any>(null);

    // ── Modo de Cartografía Táctica: Oscuro Militar vs Rejilla Vectorial Pura
    const [mapMode, setMapMode] = useState<'tactical' | 'vectorGrid'>('tactical');

    // ── Menú Contextual de Marcación Táctica al tocar el mapa
    const [contextActionPoint, setContextActionPoint] = useState<{ lat: number; lng: number } | null>(null);

    // ── Reportes de Situación (SITREPs Tácticos de Escuadrón)
    const [sitreps, setSitreps] = useState<SitrepReport[]>(() => sitrepEngine.getSitreps());

    // ── Navegación Inercial Pedestrian Dead Reckoning (PDR) ───────────────
    const [pdrState, setPdrState] = useState<PdrState>(() => pedestrianDeadReckoning.getState());
    const [isPdrActive, setIsPdrActive] = useState(false);
    const pdrOriginRef = useRef<{ lat: number; lng: number }>({ lat: 0, lng: 0 });

    // ── Brújula Táctica 3D con Compensación de Inclinación y Filtro Circular ──
    const [compassHeading, setCompassHeading] = useState<number>(() => tacticalCompass.getTelemetry().headingDeg);

    useEffect(() => {
        let lastStateUpdate = 0;
        const unsub = tacticalCompass.subscribe((telemetry) => {
            // Rotación directa en DOM a 60fps sin re-renderizar React
            const coneEl = document.getElementById("tactical-self-cone");
            if (coneEl) {
                coneEl.style.transform = `rotate(${telemetry.headingDeg}deg)`;
            }
            // Limitar actualización de estado React a ~3Hz para evitar re-renderizado masivo
            const now = Date.now();
            if (now - lastStateUpdate > 350) {
                lastStateUpdate = now;
                setCompassHeading(telemetry.headingDeg);
            }
        });
        return unsub;
    }, []);

    const pdrOrGpsHeading = isPdrActive ? pdrState.currentHeadingDeg : (gpsData.heading || 0);
    const effectiveHeading = isPdrActive
        ? pdrState.currentHeadingDeg
        : (gpsData.heading !== undefined && (gpsData.speed || 0) > 1.2
            ? gpsData.heading
            : (compassHeading || pdrOrGpsHeading));

    // Interceptor Base LIFO para NodeMap (Cierre ordenado al pulsar Atrás)
    useEffect(() => {
        return BackHandlerRegistry.register(() => {
            goBack();
            return true;
        });
    }, [goBack]);

    // Register Back Interceptors for Map Overlays
    useEffect(() => {
        if (!contextActionPoint) return;
        return BackHandlerRegistry.register(() => {
            setContextActionPoint(null);
            return true;
        });
    }, [contextActionPoint]);

    useEffect(() => {
        if (!showVaultModal) return;
        return BackHandlerRegistry.register(() => {
            setShowVaultModal(false);
            return true;
        });
    }, [showVaultModal]);

    useEffect(() => {
        if (!showTelemetryDrawer) return;
        return BackHandlerRegistry.register(() => {
            setShowTelemetryDrawer(false);
            return true;
        });
    }, [showTelemetryDrawer]);

    useEffect(() => {
        if (!selectedPeer) return;
        return BackHandlerRegistry.register(() => {
            setSelectedPeer(null);
            return true;
        });
    }, [selectedPeer]);

    useEffect(() => {
        const unsubPdr = pedestrianDeadReckoning.subscribe((state) => {
            setPdrState(state);
        });
        const unsubSitrep = sitrepEngine.subscribe(() => {
            setSitreps(sitrepEngine.getSitreps());
        });
        return () => {
            unsubPdr();
            unsubSitrep();
        };
    }, []);

    const handleTogglePdr = () => {
        if (isPdrActive) {
            pedestrianDeadReckoning.stopTracking();
            setIsPdrActive(false);
            toast.info("Rastreo inercial PDR pausado");
        } else {
            const originLat = gpsData.lat !== 0 ? gpsData.lat : 19.4326;
            const originLng = gpsData.lng !== 0 ? gpsData.lng : -99.1332;
            pdrOriginRef.current = { lat: originLat, lng: originLng };
            pedestrianDeadReckoning.reset();
            pedestrianDeadReckoning.startTracking();
            setIsPdrActive(true);
            toast.success("🧭 Navegación inercial PDR activada (Sin GPS)");
        }
    };

    // Coordenadas efectivas: Si PDR está activo, avanza con el vector inercial; si no, usa GPS
    const effectiveLat = isPdrActive && pdrOriginRef.current.lat !== 0
        ? pdrOriginRef.current.lat + (pdrState.displacementNorthMeters / 111000)
        : gpsData.lat;
    const effectiveLng = isPdrActive && pdrOriginRef.current.lng !== 0
        ? pdrOriginRef.current.lng + (pdrState.displacementEastMeters / (111000 * Math.max(0.01, Math.cos((pdrOriginRef.current.lat * Math.PI) / 180))))
        : gpsData.lng;

    const loadVaultStats = async () => {
        const stats = await offlineTileCacheEngine.getCacheStats();
        setVaultStats(stats);
    };

    const handleStartVaultDownload = async () => {
        const centerLat = effectiveLat !== 0 ? effectiveLat : gpsData.lat;
        const centerLng = effectiveLng !== 0 ? effectiveLng : gpsData.lng;
        if (centerLat === 0 && centerLng === 0) {
            toast.warning("Esperando coordenadas GPS o PDR válidas para calcular el centro de la zona.");
            return;
        }

        setIsDownloadingVault(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            await offlineTileCacheEngine.downloadRegion(
                gpsData.lat,
                gpsData.lng,
                vaultRadiusKm,
                11,
                16,
                (progress) => {
                    setDownloadProgress(progress);
                },
                controller.signal
            );
            toast.success("¡Zona táctica descargada en la bóveda local!");
            loadVaultStats();
        } catch (e: any) {
            toast.info(e.message || "Descarga detenida.");
        } finally {
            setIsDownloadingVault(false);
            abortControllerRef.current = null;
        }
    };

    const handleCancelVaultDownload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsDownloadingVault(false);
    };

    const handleClearVault = async () => {
        await offlineTileCacheEngine.clearCache();
        loadVaultStats();
        toast.info("Bóveda de mapas offline vaciada");
    };

    // ── Tactical Target — consumido desde Zustand (v103.0.0) ─────────────────
    // Reemplaza el patrón localStorage + window.storage event que era inestable
    // en Capacitor/WebView. La suscripción reactiva de Zustand garantiza sincronía
    // inmediata con Radar, Foxhunt, Compass y demás módulos sin eventos DOM.
    const { tacticalTarget: target, setTacticalTarget, clearTacticalTarget } = useRedStore();

    const handleSetTarget = (lat: number, lon: number, name?: string) => {
        const newTarget = {
            lat: Math.round(lat * 100000) / 100000,
            lon: Math.round(lon * 100000) / 100000,
            name: name || "Punto Objetivo Táctico",
            createdAt: Date.now(),
        };
        setTacticalTarget(newTarget, 'NodeMap');

        if (gpsData.lat !== 0 && gpsData.lng !== 0) {
            const g = OffGridNavigationEngine.calculateTacticalGuidance(gpsData.lat, gpsData.lng, newTarget.lat, newTarget.lon, effectiveHeading);
            toast.success(`🎯 Objetivo Fijado: ${g.formattedDistance} | Rumbo ${g.bearingDegrees}° ${g.cardinal}`);
        } else {
            toast.success(`🎯 Objetivo Fijado: [${newTarget.lat.toFixed(5)}, ${newTarget.lon.toFixed(5)}]`);
        }
    };

    const handleClearTarget = () => {
        clearTacticalTarget();
        toast.info("Objetivo táctico cancelado");
    };

    const tacticalGuidance = (effectiveLat !== 0 && effectiveLng !== 0 && target)
        ? OffGridNavigationEngine.calculateTacticalGuidance(
            effectiveLat,
            effectiveLng,
            target.lat,
            target.lon,
            effectiveHeading
        )
        : null;

    // 1. Geolocalización en tiempo real continua de hardware y broadcast por la malla (SSOT vía TacticalLocationEngine)
    useEffect(() => {
        let mounted = true;

        const unsubLocation = TacticalLocationEngine.watchLocation((loc: TacticalLocation) => {
            if (!mounted) return;
            if (!TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) return;
            const newLat = loc.lat!;
            const newLng = loc.lon!;
            setGpsData({
                lat: newLat,
                lng: newLng,
                accuracy: loc.accuracy,
                altitude: loc.alt,
                speed: loc.speed,
                heading: loc.heading,
                timestamp: loc.timestamp
            });
            setRealGPS(!loc.isEstimated);

            if (leafletMapRef.current && !realGPS) {
                try {
                    leafletMapRef.current.setView([newLat, newLng], 17);
                } catch {}
            }

            // Retransmitir coordenadas reales a los demás nodos de la malla
            if (!loc.isEstimated) {
                meshRouter.broadcastLocation(newLat, newLng, loc.alt, loc.accuracy);
            }
        });

        return () => {
            mounted = false;
            unsubLocation();
        };
    }, [realGPS]);

    // 2. Extracción y Deduplicación Estricta de Telemetría de Malla
    useEffect(() => {
        const updatePeers = async () => {
            const rawLocal = localTransport.allPeers || [];
            let apiPeers: any[] = [];
            try {
                apiPeers = await RedAPI.getPeers();
            } catch {
                apiPeers = [];
            }

            const myHash = identity?.identity_hash || status?.identity_hash || "";
            const myNodeId = (status as any)?.node_id || "";
            const myNickname = (identity?.nickname || identity?.display_name || "").toLowerCase();
            const contactList = Array.isArray(contacts) ? contacts : [];

            // Registro canónico
            const canonicalMap = new Map<string, CanonicalNode>();

            const processEntry = (raw: any, defaultTransport: string) => {
                if (!raw || !raw.id) return;
                const rawId = String(raw.id).trim();

                // Filtrar auto-reflexión
                if (rawId === myHash || (myNodeId && rawId === myNodeId)) return;

                let displayName = (raw.name || "").trim();

                // Filtrar periféricos de terceros ajenos a RED
                const lowerName = displayName.toLowerCase();
                if (lowerName.includes("[tv]") || lowerName.includes("samsung") || lowerName.includes("darckpc") || lowerName.includes("desktop-")) return;

                // Filtrar auto-reflexión por apodo
                if (myNickname && (lowerName === myNickname || lowerName === `red-${myNickname}`)) return;

                // Resolver identificador canónico
                let canonicalKey = meshRouter.getCanonicalId(rawId) || raw.canonicalId || rawId;
                let isContact = false;

                const matchingContact = contactList.find((c: any) => 
                    c && (c.identity_hash === canonicalKey || c.identity_hash === rawId || (c.display_name && (displayName === c.display_name || displayName === `RED-${c.display_name}`)))
                );
                if (matchingContact) {
                    canonicalKey = matchingContact.identity_hash;
                    displayName = matchingContact.display_name;
                    isContact = true;
                }

                if (!displayName) {
                    displayName = `Nodo ${canonicalKey.substring(0, 8)}…`;
                }

                // Deduplicar si ya existe un nodo con la misma clave o nombre único no genérico
                let targetKey = canonicalKey;
                for (const [k, node] of canonicalMap.entries()) {
                    if (k === canonicalKey || (displayName && displayName !== "Dispositivo RED" && !displayName.startsWith("Nodo ") && node.name.toLowerCase() === displayName.toLowerCase())) {
                        targetKey = k;
                        break;
                    }
                }

                // Obtener telemetría de hardware de la colmena si existe
                const knownCaps = HiveMindEngine.getKnownCapabilities();
                const hiveCap = knownCaps.find(c => c.nodeId === targetKey || c.nodeId === canonicalKey);

                const transport = raw.transport || defaultTransport;
                const existing = canonicalMap.get(targetKey);

                if (existing) {
                    if (transport && !existing.transports.includes(transport)) {
                        existing.transports.push(transport);
                    }
                    if (raw.rssi != null && (existing.rssi == null || raw.rssi > existing.rssi)) {
                        existing.rssi = raw.rssi;
                    }
                    if (raw.lat && raw.lng) {
                        existing.lat = raw.lat;
                        existing.lng = raw.lng;
                    }
                    if (raw.lastSeen && raw.lastSeen > existing.lastSeen) {
                        existing.lastSeen = raw.lastSeen;
                    }
                    if (isContact) {
                        existing.isContact = true;
                        existing.name = displayName;
                    }
                    if (hiveCap) {
                        existing.batteryLevel = hiveCap.batteryLevel;
                        existing.cpuUsagePercent = hiveCap.cpuUsagePercent;
                        existing.availableRamMb = hiveCap.availableRamMb;
                        existing.isCharging = hiveCap.isCharging;
                        existing.activeModel = hiveCap.activeModel;
                    }
                } else {
                    canonicalMap.set(targetKey, {
                        id: targetKey,
                        canonicalId: targetKey,
                        name: displayName,
                        transports: raw.transports || (transport ? [transport] : ['ble']),
                        primaryTransport: transport || 'ble',
                        rssi: raw.rssi,
                        lastSeen: raw.lastSeen || Date.now(),
                        lat: raw.lat,
                        lng: raw.lng,
                        isContact,
                        batteryLevel: hiveCap?.batteryLevel,
                        cpuUsagePercent: hiveCap?.cpuUsagePercent,
                        availableRamMb: hiveCap?.availableRamMb,
                        isCharging: hiveCap?.isCharging,
                        activeModel: hiveCap?.activeModel
                    });
                }
            };

            rawLocal.forEach(p => processEntry(p, p.transport || 'ble'));
            apiPeers.forEach(p => processEntry(p, 'wifi'));

            // Calcular distancias
            const resolvedList = Array.from(canonicalMap.values()).map(p => {
                const pos = derivePeerPosition(gpsData.lat, gpsData.lng, p);
                return { ...p, distMeters: pos.distMeters };
            });

            setPeers(resolvedList);
        };

        updatePeers();
        const interval = setInterval(updatePeers, 2500);
        return () => clearInterval(interval);
    }, [identity, status, contacts, gpsData.lat, gpsData.lng]);

    // 3. Inicialización e Interacción del Mapa Leaflet Base (Instancia Única)
    useEffect(() => {
        if (!mapContainerRef.current) return;
        let isCancelled = false;

        const initMap = async () => {
            const L = (await import("leaflet")).default;
            if (!mapContainerRef.current || isCancelled) return;

            if (!leafletMapRef.current) {
                const mapInstance = L.map(mapContainerRef.current, {
                    center: [gpsData.lat || 19.4326, gpsData.lng || -99.1332],
                    zoom: 17,
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

                        if ((this as any).options.isVectorGrid) {
                            tile.src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256' fill='%23050812'%3E%3Crect width='256' height='256'/%3E%3Cpath d='M0 0h256v256H0z' stroke='%2300E5FF' stroke-width='0.4' stroke-opacity='0.25' fill='none'/%3E%3Ccircle cx='128' cy='128' r='1.5' fill='%2300E5FF' fill-opacity='0.45'/%3E%3C/svg%3E";
                            return tile;
                        }

                        const url = (this as any).getTileUrl(coords);
                        offlineTileCacheEngine.getOrFetchTile(coords.z, coords.x, coords.y, url)
                            .then((blob) => {
                                if (blob) {
                                    const blobUrl = URL.createObjectURL(blob);
                                    (tile as any)._blobUrl = blobUrl;
                                    tile.src = blobUrl;
                                } else {
                                    tile.src = (this as any).options.errorTileUrl;
                                }
                            })
                            .catch(() => {
                                tile.src = (this as any).options.errorTileUrl;
                            });

                        return tile;
                    },
                    _removeTile(key: string) {
                        const tile = (this as any)._tiles[key]?.el;
                        if (tile && (tile as any)._blobUrl) {
                            try { URL.revokeObjectURL((tile as any)._blobUrl); } catch {}
                        }
                        (L.TileLayer.prototype as any)._removeTile?.call(this, key);
                    }
                });

                const osmLayer = new OfflineTileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    maxZoom: 19,
                    className: "tactical-dark-tile",
                    isVectorGrid: mapMode === 'vectorGrid',
                    errorTileUrl: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256' fill='%23050812'%3E%3Crect width='256' height='256'/%3E%3Cpath d='M0 0h256v256H0z' stroke='%2300E5FF' stroke-width='0.4' stroke-opacity='0.2' fill='none'/%3E%3C/svg%3E"
                });

                osmLayer.addTo(mapInstance);
                osmLayerRef.current = osmLayer;

                // Listener táctico: abre menú contextual de marcación sin sobrescribir objetivo
                mapInstance.on("click", (e: any) => {
                    setContextActionPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
                });

                const markersGroup = L.layerGroup().addTo(mapInstance);
                markersGroupRef.current = markersGroup;
                leafletMapRef.current = mapInstance;

                // Recálculo dinámico de dimensiones (solo al montar)
                setTimeout(() => {
                    try {
                        mapInstance?.invalidateSize();
                    } catch {}
                }, 250);
            }
        };

        initMap();

        return () => {
            isCancelled = true;
            if (leafletMapRef.current) {
                try {
                    leafletMapRef.current.remove();
                } catch {}
                leafletMapRef.current = null;
                markersGroupRef.current = null;
                osmLayerRef.current = null;
            }
        };
    }, []);

    // 4. Actualización Reactiva de Marcadores Tácticos (Sin Recargar Mapa ni Teselas)
    useEffect(() => {
        if (!markersGroupRef.current || !leafletMapRef.current) return;
        let isCancelled = false;

        const updateMarkers = async () => {
            const L = (await import("leaflet")).default;
            if (isCancelled || !markersGroupRef.current) return;

            markersGroupRef.current.clearLayers();

                // Marcador de Ubicación Propia (GPS Real o PDR Inercial con Cono de Rumbo 3D)
                const selfIcon = L.divIcon({
                    className: "custom-self-marker",
                    html: isPdrActive ? (
                        `<div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
                            <div style="position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(255,145,0,0.25);animation:pulse 1.2s infinite;"></div>
                            <div id="tactical-self-cone" style="position:absolute;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:18px solid #FF9100;top:-2px;filter:drop-shadow(0 0 8px #FF9100);transform-origin:50% 19px;transform:rotate(${pdrState.currentHeadingDeg}deg);transition:transform 0.12s ease-out;"></div>
                            <div style="width:16px;height:16px;border-radius:50%;background:#FF9100;border:2px solid #fff;box-shadow:0 0 12px #FF9100;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#000;z-index:2;">🧭</div>
                        </div>`
                    ) : (
                        `<div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
                            <div style="position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(0,229,255,0.25);animation:pulse 1.5s infinite;"></div>
                            <div id="tactical-self-cone" style="position:absolute;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:18px solid #00E5FF;top:-2px;filter:drop-shadow(0 0 8px #00E5FF);transform-origin:50% 19px;transform:rotate(${effectiveHeading}deg);transition:transform 0.12s ease-out;"></div>
                            <div style="width:14px;height:14px;border-radius:50%;background:#00E5FF;border:2px solid #fff;box-shadow:0 0 12px #00E5FF;z-index:2;"></div>
                        </div>`
                    ),
                    iconSize: [34, 34],
                    iconAnchor: [17, 17]
                });
                L.marker([effectiveLat, effectiveLng], { icon: selfIcon }).addTo(markersGroupRef.current);

                // Anillos Concéntricos de Radar Táctico (25m, 50m, 100m)
                [25, 50, 100].forEach(radius => {
                    L.circle([effectiveLat, effectiveLng], {
                        radius,
                        color: radius === 100 ? "rgba(0,229,255,0.4)" : "rgba(0,229,255,0.18)",
                        weight: 1,
                        fillColor: "rgba(0,229,255,0.02)",
                        fillOpacity: 0.2,
                        dashArray: "3, 6"
                    }).addTo(markersGroupRef.current);
                });

                // Marcadores de Nodos de la Malla (MIL-STD-2525D Blue-Force Tracking)
                peers.forEach((p) => {
                    const pos = derivePeerPosition(gpsData.lat, gpsData.lng, p);
                    const isMulti = p.transports.length > 1;
                    const milSvg = milStd2525.generateSvg({
                        affiliation: 'FRIEND',
                        role: isMulti ? 'COMMAND_HQ' : 'INFANTRY',
                        size: 26
                    });
                    
                    const peerIcon = L.divIcon({
                        className: "custom-peer-marker",
                        html: `<div style="filter:drop-shadow(0 0 8px #00E5FF);cursor:pointer;">${milSvg}</div>`,
                        iconSize: [26, 26],
                        iconAnchor: [13, 13]
                    });

                    const m = L.marker([pos.lat, pos.lng], { icon: peerIcon }).addTo(markersGroupRef.current);
                    m.on("click", () => {
                        setSelectedPeer({ ...p, distMeters: pos.distMeters });
                    });
                });

                // Marcadores de Waypoints Tácticos (Guardados en Brújula Off-Grid)
                try {
                    const rawWps = localStorage.getItem("red_offgrid_waypoints");
                    if (rawWps) {
                        const waypoints = JSON.parse(rawWps);
                        waypoints.forEach((wp: any) => {
                            if (typeof wp.lat === "number" && typeof wp.lon === "number") {
                                const dist = getHaversineDistanceMeters(gpsData.lat, gpsData.lng, wp.lat, wp.lon);
                                const wpSvg = milStd2525.generateSvg({
                                    affiliation: 'NEUTRAL',
                                    role: 'SUPPLY_AMMO',
                                    size: 24
                                });
                                const wpIcon = L.divIcon({
                                    className: "custom-waypoint-marker",
                                    html: `<div style="filter:drop-shadow(0 0 8px #00E676);">${wpSvg}</div>`,
                                    iconSize: [24, 24],
                                    iconAnchor: [12, 12]
                                });
                                const wpMarker = L.marker([wp.lat, wp.lon], { icon: wpIcon }).addTo(markersGroupRef.current);
                                wpMarker.bindPopup(`
                                    <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#000;padding:2px;">
                                        <strong>🚩 ${wp.name || 'Waypoint'} (MIL-STD-2525D)</strong><br/>
                                        Distancia: ${dist}m<br/>
                                        Rumbo: ${wp.bearingDegrees || 0}°
                                    </div>
                                `);
                            }
                        });
                    }
                } catch {}

                // Marcador y Vector del Objetivo Táctico Activo (MIL-STD-2525D Hostile Threat)
                if (target) {
                    const targetSvg = milStd2525.generateSvg({
                        affiliation: 'HOSTILE',
                        role: 'RECON_DRONE',
                        size: 32
                    });
                    const targetIcon = L.divIcon({
                        className: "custom-target-marker",
                        html: `<div style="filter:drop-shadow(0 0 12px #FF3355);animation:pulse 1.2s infinite;">${targetSvg}</div>`,
                        iconSize: [32, 32],
                        iconAnchor: [16, 16]
                    });
                    const targetMarker = L.marker([target.lat, target.lon], { icon: targetIcon }).addTo(markersGroupRef.current);
                    
                    if (gpsData.lat !== 0 && gpsData.lng !== 0) {
                        const distM = getHaversineDistanceMeters(gpsData.lat, gpsData.lng, target.lat, target.lon);
                        targetMarker.bindPopup(`
                            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#000;padding:2px;">
                                <strong>🎯 ${target.name || 'Objetivo'}</strong><br/>
                                Distancia: ${distM}m<br/>
                                Coord: ${target.lat.toFixed(5)}, ${target.lon.toFixed(5)}
                            </div>
                        `);

                        // Vector Polilínea Táctica
                        L.polyline([[gpsData.lat, gpsData.lng], [target.lat, target.lon]], {
                            color: "#E8213A",
                            weight: 3.5,
                            dashArray: "8, 8",
                            opacity: 0.95
                        }).addTo(markersGroupRef.current);
                    }
                }

                // Marcadores de Geocercas Tácticas
                try {
                    const geofences = tacticalGeofence.getZones().filter(z => z.active);
                    geofences.forEach(zone => {
                        const colorMap: Record<string, string> = {
                            'EXCLUSION_ZONE': '#E8213A',
                            'RF_SILENCE': '#00E5FF',
                            'SAFE_HAVEN': '#00E676',
                            'DEFENSIVE_PERIMETER': '#FFB300'
                        };
                        const zoneColor = colorMap[zone.category] || '#00E5FF';

                        if (zone.geometryType === 'CIRCULAR' && zone.centerLat && zone.centerLon) {
                            L.circle([zone.centerLat, zone.centerLon], {
                                radius: zone.radiusMeters,
                                color: zoneColor,
                                weight: 2,
                                fillColor: zoneColor,
                                fillOpacity: 0.12,
                                dashArray: '4, 6'
                            }).bindPopup(`
                                <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#000;padding:2px;">
                                    <strong>🛡️ ${zone.name}</strong><br/>
                                    Tipo: ${zone.category}<br/>
                                    Radio: ${zone.radiusMeters}m
                                </div>
                            `).addTo(markersGroupRef.current);
                        }
                    });
                } catch {}

                // Marcadores de Geocachés Dead-Drop Cifrados
                try {
                    const deadDrops = deadDropVault.getDeadDrops();
                    deadDrops.forEach(drop => {
                        const hasGps = gpsData.lat !== 0 && gpsData.lng !== 0;
                        const dist = hasGps ? getHaversineDistanceMeters(gpsData.lat, gpsData.lng, drop.lat, drop.lon) : 999999;
                        const isNearby = hasGps && dist <= drop.unlockRadiusMeters;
                        const dropIcon = L.divIcon({
                            className: "custom-deaddrop-marker",
                            html: `<div style="width:24px;height:24px;border-radius:50%;background:${drop.isUnlocked ? '#00E676' : isNearby ? '#00E5FF' : '#B388FF'};border:2px solid #fff;box-shadow:0 0 16px ${drop.isUnlocked ? '#00E676' : '#B388FF'};display:flex;align-items:center;justify-content:center;font-size:12px;">${drop.isUnlocked ? '🔓' : isNearby ? '📦' : '🔒'}</div>`,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        });
                        const m = L.marker([drop.lat, drop.lon], { icon: dropIcon }).addTo(markersGroupRef.current);
                        m.bindPopup(`
                            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#000;padding:2px;">
                                <strong>📦 Dead-Drop: ${drop.title}</strong><br/>
                                Categoría: ${drop.category}<br/>
                                Distancia: ${hasGps ? `${dist}m` : 'Buscando GPS...'} (Radio: ${drop.unlockRadiusMeters}m)<br/>
                                Estado: <strong>${drop.isUnlocked ? 'DESBLOQUEADO' : isNearby ? 'LISTO PARA DESBLOQUEO' : 'FUERA DE RANGO'}</strong><br/>
                                ${drop.isUnlocked && drop.plaintextPayload ? `<div style="margin-top:4px;padding:4px;background:#eef;border-radius:4px;word-break:break-all;">${drop.plaintextPayload}</div>` : ''}
                            </div>
                        `);
                    });
                } catch {}

                // Marcadores de Repetidores Dron Aerotransportados (UAV Loiter Relays)
                try {
                    const uavRelays = meshUavRelayEngine.getActiveRelays();
                    uavRelays.forEach(uav => {
                        const uavSvg = milStd2525.generateSvg({
                            affiliation: 'FRIEND',
                            role: 'RECON_DRONE',
                            size: 28
                        });
                        const uavIcon = L.divIcon({
                            className: "custom-uav-marker",
                            html: `<div style="filter:drop-shadow(0 0 10px #FFB300);animation:pulse 2s infinite;">${uavSvg}</div>`,
                            iconSize: [28, 28],
                            iconAnchor: [14, 14]
                        });
                        const uavMarker = L.marker([uav.coords.lat, uav.coords.lon], { icon: uavIcon }).addTo(markersGroupRef.current);
                        uavMarker.bindPopup(`
                            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#000;padding:2px;">
                                <strong>🛸 ${uav.callsign} (UAV RELAY)</strong><br/>
                                Altitud AGL: ${uav.altitudeAglMeters}m<br/>
                                Modo: ${uav.loiterMode} · Batería: ${uav.batteryPct}%<br/>
                                Cobertura: ${uav.coverageRadiusKm} km radio<br/>
                                Clientes Malla Activos: ${uav.activeRelayClients}
                            </div>
                        `);

                        // Cono de Iluminación Radioeléctrica
                        L.circle([uav.coords.lat, uav.coords.lon], {
                            radius: uav.coverageRadiusKm * 1000,
                            color: "#FFB300",
                            weight: 1.5,
                            fillColor: "#FFB300",
                            fillOpacity: 0.05,
                            dashArray: "6, 8"
                        }).addTo(markersGroupRef.current);
                    });
                } catch {}

                // Superposición de Línea de Demora Foxhunting (RDF LOB)
                try {
                    const rdfState = tacticalRdf.getState();
                    if (rdfState.peakBearing && gpsData.lat !== 0 && gpsData.lng !== 0) {
                        const bearingRad = (rdfState.peakBearing.peakHeadingDeg * Math.PI) / 180;
                        const rayDistMeters = Math.min(500, rdfState.peakBearing.estimatedDistMeters || 300);
                        const endLat = gpsData.lat + (rayDistMeters * Math.cos(bearingRad)) / 111000;
                        const endLon = gpsData.lng + (rayDistMeters * Math.sin(bearingRad)) / (111000 * Math.cos(gpsData.lat * Math.PI / 180));
                        
                        L.polyline([[gpsData.lat, gpsData.lng], [endLat, endLon]], {
                            color: "#00E5FF",
                            weight: 2.5,
                            dashArray: "6, 6",
                            opacity: 0.85
                        }).addTo(markersGroupRef.current);
                    }
                } catch {}

                // Marcadores de Reportes de Situación Tácticos (SITREPs)
                try {
                    sitreps.forEach((rep: SitrepReport) => {
                        if (rep && rep.location && typeof rep.location.lat === 'number' && typeof rep.location.lon === 'number') {
                            const hasCasualties = rep.casualties && (
                                rep.casualties.t1ImmediateRed > 0 ||
                                rep.casualties.t2DelayedYellow > 0 ||
                                rep.casualties.t3MinimalGreen > 0 ||
                                rep.casualties.t4ExpectantBlack > 0
                            );
                            const sitrepAffiliation = rep.threatStatus === 'RED_CONTACT'
                                ? 'HOSTILE'
                                : rep.threatStatus === 'AMBER_SUSPICIOUS'
                                ? 'UNKNOWN'
                                : 'FRIEND';
                            const sitrepRole = hasCasualties ? 'MEDICAL' : 'COMMAND_HQ';
                            const sitrepSvg = milStd2525.generateSvg({
                                affiliation: sitrepAffiliation,
                                role: sitrepRole,
                                size: 28,
                                label: rep.unitCallsign || 'SITREP'
                            });
                            const sitrepIcon = L.divIcon({
                                className: "custom-sitrep-marker",
                                html: `<div style="filter:drop-shadow(0 0 10px ${rep.threatStatus === 'RED_CONTACT' ? '#FF3355' : rep.threatStatus === 'AMBER_SUSPICIOUS' ? '#FFB300' : '#00E676'});cursor:pointer;">${sitrepSvg}</div>`,
                                iconSize: [28, 28],
                                iconAnchor: [14, 14]
                            });
                            const m = L.marker([rep.location.lat, rep.location.lon], { icon: sitrepIcon }).addTo(markersGroupRef.current);
                            m.bindPopup(`
                                <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#000;padding:2px;min-width:180px;">
                                    <strong>📋 SITREP: ${rep.unitCallsign || 'Patrulla'}</strong><br/>
                                    Operador: ${rep.operatorName || 'Desconocido'}<br/>
                                    Amenaza: <span style="font-weight:bold;color:${rep.threatStatus === 'RED_CONTACT' ? '#D32F2F' : rep.threatStatus === 'AMBER_SUSPICIOUS' ? '#F57C00' : '#388E3C'}">${rep.threatStatus}</span><br/>
                                    ${hasCasualties ? `🚨 Bajas TCCC: T1:${rep.casualties.t1ImmediateRed} T2:${rep.casualties.t2DelayedYellow} T3:${rep.casualties.t3MinimalGreen} T4:${rep.casualties.t4ExpectantBlack}<br/>` : '🛡️ Sin bajas registradas<br/>'}
                                    Batería: ${rep.suppliesBatteryPct ?? 100}% · Munición: ${rep.suppliesAmmoPct ?? 100}%<br/>
                                    <em>"${rep.remarks || 'Sin observaciones'}"</em>
                                </div>
                            `);
                        }
                    });
                } catch {}

                // Superposición de Pluma de Dispersión QBRN (CBRN Dispersion Plume)
                try {
                    const rawCbrn = localStorage.getItem('red_active_cbrn_incident');
                    if (rawCbrn) {
                        const cbrnSource: CbrnIncidentSource = JSON.parse(rawCbrn);
                        if (cbrnSource && typeof cbrnSource.lat === 'number' && typeof cbrnSource.lon === 'number') {
                            const plume = cbrnPlumeDispersionEngine.calculatePlumeDispersion(cbrnSource, effectiveLat, effectiveLng);
                            
                            // Zona Caliente (Hot Zone)
                            L.circle([cbrnSource.lat, cbrnSource.lon], {
                                radius: plume.hotZoneRadiusMeters,
                                color: "#FF3355",
                                weight: 2,
                                fillColor: "#FF3355",
                                fillOpacity: 0.35
                            }).bindPopup(`<strong>☣️ ZONA CALIENTE QBRN (IDLH)</strong><br/>Agente: ${cbrnSource.hazardType}<br/>Radio: ${plume.hotZoneRadiusMeters}m`).addTo(markersGroupRef.current);

                            // Zona Tibia (Warm Zone)
                            const windDirRad = (cbrnSource.windDirectionDegrees * Math.PI) / 180;
                            const warmEndLat = cbrnSource.lat + (plume.warmZoneLengthMeters * Math.cos(windDirRad)) / 111000;
                            const warmEndLon = cbrnSource.lon + (plume.warmZoneLengthMeters * Math.sin(windDirRad)) / (111000 * Math.cos((cbrnSource.lat * Math.PI) / 180));
                            
                            L.polyline([[cbrnSource.lat, cbrnSource.lon], [warmEndLat, warmEndLon]], {
                                color: "#FFB300",
                                weight: 4,
                                dashArray: "6, 6",
                                opacity: 0.8
                            }).addTo(markersGroupRef.current);

                            // Vector de Escape Seguro en 90°
                            if (plume.escapeVector.isInDangerZone) {
                                const escapeRad = (plume.escapeVector.recommendedAzimuthDegrees * Math.PI) / 180;
                                const escLat = effectiveLat + (plume.escapeVector.distanceToSafetyMeters * Math.cos(escapeRad)) / 111000;
                                const escLon = effectiveLng + (plume.escapeVector.distanceToSafetyMeters * Math.sin(escapeRad)) / (111000 * Math.cos((effectiveLat * Math.PI) / 180));
                                
                                L.polyline([[effectiveLat, effectiveLng], [escLat, escLon]], {
                                    color: "#00E676",
                                    weight: 3.5,
                                    dashArray: "4, 4"
                                }).addTo(markersGroupRef.current);
                            }
                        }
                    }
                } catch {}
            };

        updateMarkers();

        return () => {
            isCancelled = true;
        };
    }, [effectiveLat, effectiveLng, peers, target, isPdrActive, sitreps]);

    const recenterMap = () => {
        if (leafletMapRef.current) {
            leafletMapRef.current.flyTo([effectiveLat, effectiveLng], 17, { duration: 1 });
            toast.info(isPdrActive ? "Centrado en posición PDR inercial" : "Centrado en ubicación GPS local");
        }
    };

    const focusOnPeer = (peer: CanonicalNode) => {
        const pos = derivePeerPosition(effectiveLat, effectiveLng, peer);
        if (leafletMapRef.current) {
            leafletMapRef.current.flyTo([pos.lat, pos.lng], 18, { duration: 1 });
        }
        setSelectedPeer(peer);
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico Responsive */}
            <header style={{
                padding: "10px 14px",
                minHeight: "56px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "8px",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.96) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 1000, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: "10px", flexShrink: 0,
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 4px 14px rgba(0,229,255,0.3)"
                    }}>
                        <TacIcon name="map" size={20} color="#000" />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: "0.92rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {t('map.title')}
                        </div>
                        <div style={{ fontSize: "0.62rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {realGPS ? `${t('map.gps_fixed')} (±${gpsData.accuracy ? gpsData.accuracy.toFixed(0) : "3"}m)` : t('map.gps_searching')}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px", flexShrink: 0, alignItems: "center" }}>
                    <button
                        onClick={async () => {
                            try {
                                const { cursorOnTarget } = await import('../lib/tactical/CursorOnTargetEngine');
                                const { useRedStore } = await import('../store/useRedStore');
                                const identity = useRedStore.getState().identity;
                                const nodeId = identity?.identity_hash ? `RED-${identity.identity_hash.slice(0, 8)}` : 'RED-MAP-NODE';
                                const callsign = identity?.nickname || 'TACTICAL-OP';
                                let batt = 100;
                                if (typeof window !== 'undefined' && typeof (window as any).__red_last_battery === 'number') {
                                    batt = (window as any).__red_last_battery;
                                }
                                const bftEvt = cursorOnTarget.createBftEvent(nodeId, callsign, gpsData.lat, gpsData.lng, 'COMMAND_HQ', batt);
                                const cotXml = cursorOnTarget.serializeToXml(bftEvt);
                                await copyToClipboard(cotXml);
                                try {
                                    meshRouter.broadcastLocation(gpsData.lat, gpsData.lng, gpsData.altitude, gpsData.accuracy);
                                } catch {}
                                toast.success("🎯 CoT BFT emitido por la malla y copiado al portapapeles");
                            } catch (e: any) {
                                toast.error("Error al exportar CoT: " + e.message);
                            }
                        }}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 9px", fontSize: "0.74rem", display: "flex", alignItems: "center", gap: "4px" }}
                        title="Exportar y Difundir Cursor-on-Target (ATAK/CivTAK XML)"
                    >
                        <TacIcon name="crosshair" size={13} color="var(--accent-cyan)" />
                        <span>CoT</span>
                    </button>
                    <button
                        onClick={handleTogglePdr}
                        className={isPdrActive ? "btn-tactical-primary" : "btn-tactical-secondary"}
                        style={{ padding: "6px 9px", fontSize: "0.74rem", background: isPdrActive ? "#FF9100" : undefined, borderColor: isPdrActive ? "#FFB74D" : undefined, display: "flex", alignItems: "center", gap: "4px" }}
                        title={isPdrActive ? "Desactivar PDR Inercial" : "Activar PDR Inercial (Sin GPS)"}
                    >
                        <TacIcon name="compass" size={13} color={isPdrActive ? "#000" : "var(--accent-amber)"} />
                        <span>{isPdrActive ? `${pdrState.totalSteps}p` : "PDR"}</span>
                    </button>
                    <button
                        onClick={() => { setShowVaultModal(true); loadVaultStats(); }}
                        className="btn-tactical-secondary"
                        style={{ width: 34, height: 34, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                        title="Bóveda de Mapas Offline"
                    >
                        <TacIcon name="download" size={15} color="var(--accent-cyan)" />
                    </button>
                    <button
                        onClick={() => setShowTelemetryDrawer(!showTelemetryDrawer)}
                        className={`btn-tactical-${showTelemetryDrawer ? "primary" : "secondary"}`}
                        style={{ padding: "6px 10px", fontSize: "0.74rem", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "5px" }}
                        title={t('map.telemetry_btn')}
                    >
                        <TacIcon name="database" size={13} />
                        <span className="tabular-telemetry">{peers.length}</span>
                    </button>
                    <button
                        onClick={recenterMap}
                        className="btn-tactical-secondary"
                        style={{ width: 34, height: 34, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                        title={t('map.recenter')}
                    >
                        <TacIcon name="crosshair" size={15} color="var(--accent-cyan)" />
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t('common.close')}
                        style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                        <TacIcon name="x" size={16} color="var(--text-muted)" />
                    </button>
                </div>
            </header>

            {/* HUD Flotante Superior Compacto y Unificado */}
            <div style={{
                position: "absolute", top: "66px", left: "10px", right: "10px",
                zIndex: 900, pointerEvents: "none",
            }}>
                <div className="card-tactical" style={{
                    padding: "7px 12px", pointerEvents: "auto",
                    background: "rgba(8,10,18,0.92)", backdropFilter: "blur(16px)",
                    border: "1px solid var(--glass-border)",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px"
                }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: "0.56rem", color: isPdrActive ? "#FF9100" : realGPS ? "var(--accent-cyan)" : "var(--accent-amber)", fontWeight: 700, letterSpacing: "0.5px" }}>
                            {isPdrActive 
                                ? `🧭 PDR INERCIAL ACTIVO (${pdrState.totalSteps} PASOS)` 
                                : realGPS ? "COORDENADAS GPS REALES" : "RECEPTOR GPS"}
                        </div>
                        {isPdrActive ? (
                            <div style={{ fontSize: "0.75rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace", color: "#FF9100", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {effectiveLat.toFixed(5)}, {effectiveLng.toFixed(5)}
                                <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginLeft: "6px" }}>
                                    {pdrState.distanceMeters.toFixed(1)}m · {pdrState.currentHeadingDeg}°
                                </span>
                            </div>
                        ) : realGPS ? (
                            <div style={{ fontSize: "0.75rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {gpsData.lat.toFixed(5)}, {gpsData.lng.toFixed(5)}
                                <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginLeft: "6px" }}>
                                    {gpsData.altitude != null ? `${gpsData.altitude.toFixed(0)}m` : ""} · {effectiveHeading}°
                                </span>
                            </div>
                        ) : (
                            <div style={{ fontSize: "0.70rem", fontWeight: 700, color: "var(--accent-amber)", animation: "pulse 1.5s infinite" }}>
                                🛰️ Adquiriendo efemérides GPS…
                            </div>
                        )}
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0, borderLeft: "1px solid var(--glass-border)", paddingLeft: "10px" }}>
                        <div style={{ fontSize: "0.56rem", color: "var(--text-muted)", letterSpacing: "0.5px" }}>MALLA SWARM</div>
                        <div style={{ fontSize: "0.74rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace", color: "var(--accent-emerald)" }}>
                            {peers.length} {peers.length === 1 ? "NODO" : "NODOS"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tarjeta Flotante de Navegación Táctica Activa */}
            {target && tacticalGuidance && (
                <div style={{
                    position: "absolute", top: "124px", left: "10px", right: "10px",
                    zIndex: 900, pointerEvents: "none", maxWidth: "460px", margin: "0 auto"
                }}>
                    <div className="card-tactical animate-pop" style={{
                        padding: "10px 14px", pointerEvents: "auto",
                        background: "rgba(232, 33, 58, 0.14)", backdropFilter: "blur(20px)",
                        border: "1px solid rgba(232, 33, 58, 0.5)",
                        boxShadow: "0 8px 32px rgba(232, 33, 58, 0.25)",
                        display: "flex", flexDirection: "column", gap: "8px"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <TacIcon name="crosshair" size={16} color="#FF6B81" />
                                <div>
                                    <div style={{ fontSize: "0.60rem", color: "#FF6B81", fontWeight: 800, letterSpacing: "0.5px" }}>
                                        VECTOR HACIA OBJETIVO
                                    </div>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "#FFF" }}>
                                        {target.name}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleClearTarget}
                                style={{
                                    background: "rgba(232, 33, 58, 0.25)",
                                    border: "1px solid rgba(232, 33, 58, 0.6)",
                                    color: "#FFF",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    fontSize: "0.70rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px"
                                }}
                            >
                                <TacIcon name="trash" size={12} color="#FFF" />
                                <span>Cancelar</span>
                            </button>
                        </div>

                        <div style={{
                            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px",
                            background: "rgba(0,0,0,0.35)", padding: "8px", borderRadius: "8px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: 700 }}>DISTANCIA</div>
                                <div className="tabular-telemetry" style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                    {tacticalGuidance.formattedDistance}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: 700 }}>RUMBO</div>
                                <div className="tabular-telemetry" style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFB300", fontFamily: "JetBrains Mono, monospace" }}>
                                    {tacticalGuidance.bearingDegrees}° {tacticalGuidance.cardinal}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", fontWeight: 700 }}>TIEMPO A PIE</div>
                                <div className="tabular-telemetry" style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                    {tacticalGuidance.estimatedWalkTimeFormatted}
                                </div>
                            </div>
                        </div>

                        <div style={{
                            fontSize: "0.68rem", fontWeight: 700, color: "#FFF",
                            background: "rgba(232, 33, 58, 0.2)", padding: "6px 8px", borderRadius: "6px",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                        }}>
                            <TacIcon name="compass" size={14} color="#FF6B81" />
                            <span>{tacticalGuidance.steeringInstruction}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Contenedor del Mapa Leaflet */}
            <div ref={mapContainerRef} style={{ flex: 1, width: "100%", height: "100%", background: "#04060A" }} />

            {/* Controles Tácticos Flotantes (Zoom In/Out & Modo Rejilla Vectorial) */}
            <div style={{
                position: "absolute", right: "12px", top: target ? "265px" : "125px",
                zIndex: 950, display: "flex", flexDirection: "column", gap: "6px"
            }}>
                <button
                    onClick={() => leafletMapRef.current?.zoomIn()}
                    className="btn-tactical-secondary"
                    style={{
                        width: "36px", height: "36px", padding: 0,
                        fontSize: "1.2rem", fontWeight: 900,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: "8px", background: "rgba(10, 14, 26, 0.92)",
                        border: "1px solid var(--glass-border)", color: "var(--accent-cyan)"
                    }}
                    title="Acercar mapa"
                >
                    +
                </button>
                <button
                    onClick={() => leafletMapRef.current?.zoomOut()}
                    className="btn-tactical-secondary"
                    style={{
                        width: "36px", height: "36px", padding: 0,
                        fontSize: "1.2rem", fontWeight: 900,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: "8px", background: "rgba(10, 14, 26, 0.92)",
                        border: "1px solid var(--glass-border)", color: "var(--accent-cyan)"
                    }}
                    title="Alejar mapa"
                >
                    −
                </button>
                <button
                    onClick={() => {
                        const next = mapMode === 'tactical' ? 'vectorGrid' : 'tactical';
                        setMapMode(next);
                        if (osmLayerRef.current) {
                            osmLayerRef.current.options.isVectorGrid = (next === 'vectorGrid');
                            osmLayerRef.current.redraw();
                        }
                        toast.info(next === 'vectorGrid' ? "Modo Rejilla Vectorial Pura (Sin Teselas / Bajo Consumo)" : "Modo Cartografía Táctica");
                    }}
                    className={mapMode === 'vectorGrid' ? "btn-tactical-primary" : "btn-tactical-secondary"}
                    style={{
                        width: "36px", height: "36px", padding: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: "8px", background: mapMode === 'vectorGrid' ? "#00E5FF" : "rgba(10, 14, 26, 0.92)",
                        border: "1px solid var(--glass-border)"
                    }}
                    title={mapMode === 'vectorGrid' ? "Conmutar a Mapa Táctico" : "Conmutar a Rejilla Vectorial Pura"}
                >
                    <TacIcon name={mapMode === 'vectorGrid' ? "globe" : "map"} size={16} color={mapMode === 'vectorGrid' ? "#000" : "var(--accent-cyan)"} />
                </button>
            </div>

            {/* Menú Contextual Táctico de Marcación al tocar el mapa */}
            {contextActionPoint && (
                <div style={{
                    position: "absolute", bottom: showTelemetryDrawer ? "265px" : "16px", left: "10px", right: "10px",
                    zIndex: 1050, maxWidth: "440px", margin: "0 auto"
                }}>
                    <div className="card-tactical animate-pop" style={{
                        padding: "14px 16px", background: "rgba(10, 14, 26, 0.96)",
                        backdropFilter: "blur(20px)", border: "1.5px solid var(--accent-cyan)",
                        borderRadius: "14px", display: "flex", flexDirection: "column", gap: "10px",
                        boxShadow: "0 12px 35px rgba(0,0,0,0.8), 0 0 20px rgba(0,229,255,0.2)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <TacIcon name="crosshair" size={16} color="var(--accent-cyan)" />
                                <div>
                                    <div style={{ fontSize: "0.62rem", color: "var(--accent-cyan)", fontWeight: 800 }}>PUNTO TÁCTICO SELECCIONADO</div>
                                    <div className="tabular-telemetry" style={{ fontSize: "0.78rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace" }}>
                                        {contextActionPoint.lat.toFixed(5)}, {contextActionPoint.lng.toFixed(5)}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setContextActionPoint(null)} className="btn-icon" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <TacIcon name="x" size={14} color="var(--text-muted)" />
                            </button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <button
                                onClick={() => {
                                    handleSetTarget(contextActionPoint.lat, contextActionPoint.lng);
                                    setContextActionPoint(null);
                                }}
                                className="btn-tactical-primary"
                                style={{ padding: "8px", fontSize: "0.74rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                            >
                                <TacIcon name="crosshair" size={14} />
                                <span>Fijar Objetivo</span>
                            </button>
                            <button
                                onClick={() => {
                                    try {
                                        const rawWps = localStorage.getItem("red_offgrid_waypoints");
                                        const wps = rawWps ? JSON.parse(rawWps) : [];
                                        const newWp = {
                                            id: `WP-${Date.now().toString(36).toUpperCase()}`,
                                            name: `Punto Táctico #${wps.length + 1}`,
                                            lat: contextActionPoint.lat,
                                            lon: contextActionPoint.lng,
                                            createdAt: Date.now()
                                        };
                                        wps.push(newWp);
                                        localStorage.setItem("red_offgrid_waypoints", JSON.stringify(wps));
                                        toast.success(`🚩 Waypoint guardado: ${newWp.name}`);
                                        setContextActionPoint(null);
                                        if (leafletMapRef.current) {
                                            leafletMapRef.current.invalidateSize();
                                        }
                                    } catch (e: any) {
                                        toast.error("Error al guardar waypoint: " + e.message);
                                    }
                                }}
                                className="btn-tactical-secondary"
                                style={{ padding: "8px", fontSize: "0.74rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                            >
                                <TacIcon name="pin" size={14} color="var(--accent-cyan)" />
                                <span>Añadir Waypoint</span>
                            </button>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                onClick={() => {
                                    try {
                                        sitrepEngine.createSitrep({
                                            unitCallsign: identity?.nickname || 'PATRULLA-1',
                                            operatorName: identity?.nickname || 'Operador',
                                            location: { lat: contextActionPoint.lat, lon: contextActionPoint.lng },
                                            threatStatus: 'GREEN_CLEAR',
                                            friendlyTroopsCount: 1,
                                            casualties: { t1ImmediateRed: 0, t2DelayedYellow: 0, t3MinimalGreen: 0, t4ExpectantBlack: 0 },
                                            suppliesAmmoPct: 100,
                                            suppliesMedicalPct: 100,
                                            suppliesBatteryPct: 100,
                                            remarks: 'Reporte de posición táctica segura'
                                        });
                                        toast.success("📋 SITREP registrado en la posición");
                                        setContextActionPoint(null);
                                    } catch (e: any) {
                                        toast.error("Error al registrar SITREP: " + e.message);
                                    }
                                }}
                                className="btn-tactical-secondary"
                                style={{ flex: 1, padding: "7px", fontSize: "0.72rem", color: "var(--accent-emerald)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                            >
                                <TacIcon name="clipboard" size={13} color="var(--accent-emerald)" />
                                <span>Marcar SITREP</span>
                            </button>
                            <button
                                onClick={() => setContextActionPoint(null)}
                                style={{
                                    padding: "7px 12px", background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px",
                                    color: "var(--text-muted)", fontSize: "0.72rem", cursor: "pointer"
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ficha Flotante de Nodo Seleccionado */}
            {selectedPeer && (
                <div className="card-tactical animate-pop" style={{
                    position: "absolute", bottom: showTelemetryDrawer ? "265px" : "16px", left: "10px", right: "10px",
                    zIndex: 1000, padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px",
                    background: "rgba(10,14,24,0.96)", backdropFilter: "blur(20px)", border: "1px solid var(--accent-cyan)",
                    maxWidth: "460px", margin: "0 auto", maxHeight: "40vh", overflowY: "auto"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {selectedPeer.name || `Nodo ${selectedPeer.id.substring(0, 10)}`}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
                                {selectedPeer.transports?.map((t: string) => (
                                    <span key={t} className={`mesh-badge mesh-badge-${t}`} style={{ fontSize: "0.62rem", padding: "1px 6px" }}>
                                        {t.toUpperCase()}
                                    </span>
                                ))}
                                {selectedPeer.rssi != null && (
                                    <span style={{ fontSize: "0.70rem", color: selectedPeer.rssi > -70 ? "var(--accent-emerald)" : selectedPeer.rssi > -85 ? "var(--accent-amber)" : "var(--accent-crimson)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                                        {selectedPeer.rssi} dBm
                                    </span>
                                )}
                                {selectedPeer.batteryLevel != null && (
                                    <span style={{ fontSize: "0.70rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                        🔋 {selectedPeer.batteryLevel}% {selectedPeer.isCharging ? "⚡" : ""}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: "0.70rem", color: selectedPeer.isEstimated ? "var(--text-muted)" : "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", marginTop: "4px", wordBreak: "break-word" }}>
                                {selectedPeer.isEstimated 
                                    ? `📡 Proximidad RF (BLE RSSI: ${selectedPeer.rssi ?? -85} dBm) · Est.: ~${selectedPeer.distMeters ?? 25}m`
                                    : `📍 GPS Remoto Real (${selectedPeer.lat?.toFixed(5)}, ${selectedPeer.lng?.toFixed(5)}) · Distancia: ${selectedPeer.distMeters ?? 0}m`}
                            </div>
                        </div>
                        <button onClick={() => setSelectedPeer(null)} className="btn-icon" style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <TacIcon name="x" size={14} color="var(--text-muted)" />
                        </button>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            onClick={async () => {
                                const targetId = selectedPeer.canonicalId || meshRouter.getCanonicalId(selectedPeer.id) || selectedPeer.id;
                                const peerRec = meshRouter.getPeerByAnyId(targetId) || meshRouter.getPeerByAnyId(selectedPeer.id);
                                const finalId = (peerRec?.canonicalId && peerRec.canonicalId.length === 64) ? peerRec.canonicalId : targetId;
                                const finalName = selectedPeer.name && !selectedPeer.name.startsWith("Nodo ") ? selectedPeer.name : (peerRec?.name || selectedPeer.name);
                                const resolvedHash = await addContact(finalId, finalName, peerRec?.publicKey);
                                navigate("chat", resolvedHash || finalId);
                            }}
                            className="btn-tactical-primary"
                            style={{ flex: 1, padding: "8px", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                            <TacIcon name="chats" size={14} />
                            <span>Chat Seguro</span>
                        </button>
                        <button
                            onClick={async () => {
                                const targetId = selectedPeer.canonicalId || meshRouter.getCanonicalId(selectedPeer.id) || selectedPeer.id;
                                const peerRec = meshRouter.getPeerByAnyId(targetId) || meshRouter.getPeerByAnyId(selectedPeer.id);
                                const finalId = (peerRec?.canonicalId && peerRec.canonicalId.length === 64) ? peerRec.canonicalId : targetId;
                                const finalName = selectedPeer.name && !selectedPeer.name.startsWith("Nodo ") ? selectedPeer.name : (peerRec?.name || selectedPeer.name);
                                await addContact(finalId, finalName, peerRec?.publicKey);
                                toast.success(`Contacto ${finalName} guardado`);
                            }}
                            className="btn-tactical-secondary"
                            style={{ padding: "8px 12px", fontSize: "0.78rem", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                            <TacIcon name="plus" size={13} />
                            <span>Guardar</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Panel / Drawer Desplegable de Telemetría Completa */}
            {showTelemetryDrawer && (
                <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    height: "250px", background: "rgba(8,10,18,0.98)",
                    borderTop: "1px solid var(--glass-border)",
                    backdropFilter: "blur(25px)", zIndex: 990,
                    display: "flex", flexDirection: "column",
                    padding: "12px 14px", overflow: "hidden"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.3px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <TacIcon name="radio" size={15} color="var(--accent-cyan)" />
                            <span>Nodos en el Espectro</span>
                            <span className="tabular-telemetry" style={{ color: "var(--accent-cyan)" }}>({peers.length})</span>
                        </div>
                        <button onClick={() => setShowTelemetryDrawer(false)} className="btn-icon" style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <TacIcon name="x" size={14} color="var(--text-muted)" />
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {peers.length === 0 ? (
                            <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.74rem", padding: "16px" }}>
                                Escaneando balizas BLE / WiFi Direct…
                            </div>
                        ) : (
                            peers.map(peer => (
                                <div
                                    key={peer.id}
                                    onClick={() => focusOnPeer(peer)}
                                    className="card-tactical-interactive"
                                    style={{
                                        padding: "8px 12px", display: "flex", justifyContent: "space-between",
                                        alignItems: "center", background: selectedPeer?.id === peer.id ? "rgba(0,229,255,0.12)" : "rgba(14,18,30,0.7)",
                                        gap: "8px"
                                    }}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: "0.80rem", fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {peer.name}
                                        </div>
                                        <div style={{ display: "flex", gap: "4px", alignItems: "center", marginTop: "2px", flexWrap: "wrap" }}>
                                            {peer.transports.map(t => (
                                                <span key={t} className={`mesh-badge mesh-badge-${t}`} style={{ fontSize: "0.58rem", padding: "1px 5px" }}>
                                                    {t.toUpperCase()}
                                                </span>
                                            ))}
                                            <span style={{ fontSize: "0.66rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                                ~{peer.distMeters}m
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                                        {peer.rssi != null && (() => {
                                            const lqs = Math.max(5, Math.min(100, Math.round(((Math.max(-100, Math.min(-40, peer.rssi)) + 100) / 60) * 100)));
                                            const lqsColor = lqs >= 75 ? "var(--accent-emerald, #00E676)" : lqs >= 45 ? "var(--accent-amber, #FFB300)" : "var(--accent-crimson, #FF3C5F)";
                                            return (
                                                <>
                                                    <div style={{
                                                        fontSize: "0.70rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace",
                                                        color: peer.rssi > -70 ? "var(--accent-emerald)" : peer.rssi > -85 ? "var(--accent-amber)" : "var(--accent-crimson)"
                                                    }}>
                                                        {peer.rssi} dBm
                                                    </div>
                                                    <div style={{
                                                        fontSize: "0.58rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace",
                                                        color: lqsColor, background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: "4px"
                                                    }}>
                                                        LQS {lqs}%
                                                    </div>
                                                </>
                                            );
                                        })()}
                                        {peer.batteryLevel != null && (
                                            <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                🔋 {peer.batteryLevel}%
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Modal Táctico: Bóveda de Mapas Offline */}
            {showVaultModal && (
                <div style={{
                    position: "absolute", inset: 0, zIndex: 1100,
                    background: "rgba(2, 4, 10, 0.85)", backdropFilter: "blur(20px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "16px"
                }}>
                    <div className="card-tactical animate-pop" style={{
                        width: "100%", maxWidth: "440px",
                        background: "rgba(10, 14, 26, 0.98)", border: "1.5px solid var(--accent-cyan)",
                        borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px",
                        boxShadow: "0 16px 40px rgba(0,0,0,0.8), 0 0 30px rgba(0,229,255,0.2)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <TacIcon name="download" size={20} color="var(--accent-cyan)" />
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--text-primary)" }}>
                                        Bóveda de Mapas Offline
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                        PERSISTENCIA LOCAL 100% OFF-GRID
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => { handleCancelVaultDownload(); setShowVaultModal(false); }}
                                className="btn-icon" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                                <TacIcon name="x" size={14} color="var(--text-muted)" />
                            </button>
                        </div>

                        {/* Telemetría actual de la bóveda */}
                        <div style={{
                            background: "rgba(0,0,0,0.4)", border: "1px solid var(--glass-border)",
                            borderRadius: "10px", padding: "10px 14px", display: "flex", justifyContent: "space-between"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontWeight: 700 }}>TESELAS EN BÓVEDA</div>
                                <div className="tabular-telemetry" style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                    {vaultStats ? vaultStats.totalTiles : "…"}
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontWeight: 700 }}>ESPACIO EN DISCO</div>
                                <div className="tabular-telemetry" style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                    {vaultStats ? vaultStats.formattedSize : "…"}
                                </div>
                            </div>
                        </div>

                        {/* Selector de Radio Táctico */}
                        <div>
                            <label style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 800, display: "block", marginBottom: "6px" }}>
                                RADIO DE DESCARGA DESDE POSICIÓN ACTUAL:
                            </label>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                                {[5, 10, 25, 50].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setVaultRadiusKm(r)}
                                        disabled={isDownloadingVault}
                                        style={{
                                            padding: "8px", borderRadius: "8px",
                                            background: vaultRadiusKm === r ? "var(--accent-cyan)" : "rgba(255,255,255,0.06)",
                                            color: vaultRadiusKm === r ? "#000" : "var(--text-primary)",
                                            fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer"
                                        }}
                                    >
                                        {r} km
                                    </button>
                                ))}
                            </div>
                            <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                Niveles de zoom: 11 (visión estratégica) a 16 (detalle topográfico táctico).
                            </div>
                        </div>

                        {/* Barra de progreso de descarga */}
                        {downloadProgress && isDownloadingVault && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace" }}>
                                    <span style={{ color: "var(--accent-cyan)" }}>Progreso: {downloadProgress.percent}%</span>
                                    <span style={{ color: "var(--text-muted)" }}>{downloadProgress.downloaded} / {downloadProgress.total} ({downloadProgress.formattedBytes})</span>
                                </div>
                                <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                                    <div style={{
                                        width: `${downloadProgress.percent}%`,
                                        height: "100%",
                                        background: "linear-gradient(90deg, #00E5FF, #00E676)",
                                        transition: "width 0.2s linear"
                                    }} />
                                </div>
                            </div>
                        )}

                        {/* Botones de acción */}
                        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                            {isDownloadingVault ? (
                                <button
                                    onClick={handleCancelVaultDownload}
                                    style={{
                                        flex: 1, padding: "10px", borderRadius: "8px",
                                        background: "rgba(255, 60, 95, 0.2)", border: "1px solid var(--accent-crimson)",
                                        color: "#FFF", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                                    }}
                                >
                                    <TacIcon name="x" size={14} color="#FFF" />
                                    <span>Detener Descarga</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleStartVaultDownload}
                                    className="btn-tactical-primary"
                                    style={{ flex: 1, padding: "10px", fontSize: "0.82rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                                >
                                    <TacIcon name="download" size={14} />
                                    <span>Descargar Zona ({vaultRadiusKm} km)</span>
                                </button>
                            )}

                            <button
                                onClick={handleClearVault}
                                disabled={isDownloadingVault}
                                style={{
                                    padding: "10px 14px", borderRadius: "8px",
                                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                                    color: "var(--text-muted)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center"
                                }}
                                title="Vaciar caché de mapas"
                            >
                                <TacIcon name="trash" size={14} color="var(--text-muted)" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}