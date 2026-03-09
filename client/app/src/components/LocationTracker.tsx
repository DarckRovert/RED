import { useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { useRedStore, LiveLocation } from '../store/useRedStore';
import { RedAPI } from '../lib/api';

/**
 * Headless component that manages background/foreground location tracking
 * and broadcasting to peers when isSharingLocation is true.
 */
export default function LocationTracker() {
    const { isSharingLocation, startLocationSharing, updateMyLocation, currentConversationId, identity } = useRedStore();
    const watchIdRef = useRef<string | null>(null);

    useEffect(() => {
        let active = true;

        const startTracking = async () => {
            try {
                const hasPermissions = await Geolocation.checkPermissions();
                if (hasPermissions.location !== 'granted') {
                    const req = await Geolocation.requestPermissions();
                    if (req.location !== 'granted') {
                        console.warn('[RED] Location permission denied');
                        useRedStore.getState().stopLocationSharing();
                        return;
                    }
                }

                // Send initial location immediately
                const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
                const loc: LiveLocation = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    timestamp: pos.timestamp
                };
                if (active) updateMyLocation(loc);

                // Broadcast to current peer if we are in a chat
                if (currentConversationId && identity) {
                    RedAPI.sendMessage(currentConversationId, JSON.stringify({
                        type: 'LOC_UPDATE',
                        from: identity.identity_hash,
                        loc
                    })).catch(() => { });
                }

                // Start ongoing watch
                watchIdRef.current = await Geolocation.watchPosition({
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 5000
                }, (position, err) => {
                    if (err || !position || !active) return;

                    const newLoc: LiveLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };
                    updateMyLocation(newLoc);

                    if (currentConversationId && identity) {
                        RedAPI.sendMessage(currentConversationId, JSON.stringify({
                            type: 'LOC_UPDATE',
                            from: identity.identity_hash,
                            loc: newLoc
                        })).catch(() => { });
                    }
                });

            } catch (err) {
                console.error('[RED] Error starting geolocation', err);
            }
        };

        if (isSharingLocation) {
            startTracking();
        } else {
            if (watchIdRef.current) {
                Geolocation.clearWatch({ id: watchIdRef.current });
                watchIdRef.current = null;
            }
        }

        return () => {
            active = false;
            if (watchIdRef.current) {
                Geolocation.clearWatch({ id: watchIdRef.current });
            }
        };
    }, [isSharingLocation, currentConversationId, identity, updateMyLocation]);

    return null; // Headless service
}
