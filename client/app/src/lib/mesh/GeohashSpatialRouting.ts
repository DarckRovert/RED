/**
 * GeohashSpatialRouting.ts — RED Sovereign Mesh OS
 * 
 * Motor Canónico de Enrutamiento Geográfico y Poda Espacial (Spatial Pruning) para DTN.
 * Implementa codificación Base32 de Geohash con entrelazado de bits para delimitar
 * cuadrantes territoriales y prevenir la saturación transcontinental de satélites LEO
 * y mulas de datos físicas.
 * 
 * Escalas de Precisión:
 * - 1 carácter: ~5,000 km (Cuadrante continental)
 * - 2 caracteres: ~1,250 km (Sub-continente / País extenso)
 * - 3 caracteres: ~156 km (Región / Área metropolitana grande)
 * - 4 caracteres: ~39 km x 19.5 km (Ciudad / Valle / Zona táctica inter-malla)
 * - 5 caracteres: ~4.9 km x 4.9 km (Distrito / Barrio / Malla local)
 * - 6 caracteres: ~1.2 km x 0.6 km (Complejo / Posición táctica precisa)
 */

export interface GeohashBox {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
}

export interface DecodedGeohash {
    lat: number;
    lon: number;
    error: {
        lat: number;
        lon: number;
    };
    box: GeohashBox;
}

export class GeohashSpatialRouting {
    public static readonly BASE32_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';
    private static readonly BASE32_MAP: { [char: string]: number } = (() => {
        const map: { [char: string]: number } = {};
        for (let i = 0; i < GeohashSpatialRouting.BASE32_CHARS.length; i++) {
            map[GeohashSpatialRouting.BASE32_CHARS[i]] = i;
        }
        return map;
    })();

    /**
     * Codifica coordenadas de latitud y longitud en un string Geohash con la precisión indicada.
     */
    public static encode(lat: number, lon: number, precision = 4): string {
        if (!isFinite(lat) || !isFinite(lon)) return '';
        
        // Clamping geográfico seguro
        const safeLat = Math.max(-90, Math.min(90, lat));
        const safeLon = Math.max(-180, Math.min(180, lon));
        const safePrecision = Math.max(1, Math.min(12, Math.round(precision)));

        let minLat = -90.0, maxLat = 90.0;
        let minLon = -180.0, maxLon = 180.0;
        let isEven = true;
        let bit = 0;
        let ch = 0;
        let geohash = '';

        while (geohash.length < safePrecision) {
            if (isEven) {
                const mid = (minLon + maxLon) / 2;
                if (safeLon >= mid) {
                    ch |= (1 << (4 - bit));
                    minLon = mid;
                } else {
                    maxLon = mid;
                }
            } else {
                const mid = (minLat + maxLat) / 2;
                if (safeLat >= mid) {
                    ch |= (1 << (4 - bit));
                    minLat = mid;
                } else {
                    maxLat = mid;
                }
            }

            isEven = !isEven;
            if (bit < 4) {
                bit++;
            } else {
                geohash += this.BASE32_CHARS[ch];
                bit = 0;
                ch = 0;
            }
        }

        return geohash;
    }

    /**
     * Decodifica un Geohash y retorna el centro geodésico, el margen de error y la caja delimitadora.
     */
    public static decode(geohash: string): DecodedGeohash | null {
        if (!geohash || typeof geohash !== 'string') return null;
        const cleanHash = geohash.toLowerCase().trim();
        if (cleanHash.length === 0) return null;

        let minLat = -90.0, maxLat = 90.0;
        let minLon = -180.0, maxLon = 180.0;
        let isEven = true;

        for (let i = 0; i < cleanHash.length; i++) {
            const c = cleanHash[i];
            const cd = this.BASE32_MAP[c];
            if (cd === undefined) return null; // Carácter inválido para Base32 Geohash

            for (let mask = 16; mask > 0; mask >>= 1) {
                if (isEven) {
                    const mid = (minLon + maxLon) / 2;
                    if ((cd & mask) !== 0) {
                        minLon = mid;
                    } else {
                        maxLon = mid;
                    }
                } else {
                    const mid = (minLat + maxLat) / 2;
                    if ((cd & mask) !== 0) {
                        minLat = mid;
                    } else {
                        maxLat = mid;
                    }
                }
                isEven = !isEven;
            }
        }

        const lat = (minLat + maxLat) / 2;
        const lon = (minLon + maxLon) / 2;
        const errorLat = (maxLat - minLat) / 2;
        const errorLon = (maxLon - minLon) / 2;

        return {
            lat,
            lon,
            error: { lat: errorLat, lon: errorLon },
            box: { minLat, maxLat, minLon, maxLon }
        };
    }

    /**
     * Calcula la distancia geodésica ortodrómica (Haversine) en kilómetros entre dos coordenadas
     */
    public static distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radio medio de la Tierra en km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
        return R * c;
    }

    /**
     * Determina si un Geohash destino cae dentro del radio de alcance (en km) de un observador/satélite
     */
    public static isWithinSpatialRadius(
        targetGeohash: string,
        observerLat: number,
        observerLon: number,
        radiusKm: number
    ): boolean {
        const decoded = this.decode(targetGeohash);
        if (!decoded) return true; // Si el hash es ilegible, no podar para evitar pérdidas accidentales

        const dist = this.distanceKm(observerLat, observerLon, decoded.lat, decoded.lon);
        // Margen de tolerancia: distancia menos el semidiámetro de la caja Geohash
        const toleranceKm = Math.max(decoded.error.lat * 111, decoded.error.lon * 111);
        return dist <= (radiusKm + toleranceKm);
    }

    /**
     * Motor de Poda Espacial para Mulas de Datos y Pasarelas:
     * Evalúa si un nodo transportador con una lista de Geohashes conocidos en su trayectoria
     * debe aceptar o rechazar un paquete DTN en custodia.
     */
    public static shouldCarrierAcceptPacket(
        carrierRouteGeohashes: string[],
        targetGeohash?: string,
        maxDeviationKm = 250
    ): boolean {
        // 1. Paquetes sin etiqueta geográfica (globales/emergencias irrestrictas) siempre se aceptan
        if (!targetGeohash || targetGeohash.trim().length === 0) {
            return true;
        }

        // 2. Si el transportador no tiene ruta definida, acepta por defecto
        if (!carrierRouteGeohashes || carrierRouteGeohashes.length === 0) {
            return true;
        }

        const cleanTarget = targetGeohash.toLowerCase().trim();
        const targetDecoded = this.decode(cleanTarget);

        for (const routeHash of carrierRouteGeohashes) {
            const cleanRoute = routeHash.toLowerCase().trim();

            // Coincidencia directa de prefijo (ej. ambos bajo 'ez' para Península Ibérica o 'dr' para Nueva York)
            const minLen = Math.min(cleanTarget.length, cleanRoute.length);
            if (minLen >= 2 && cleanTarget.slice(0, minLen) === cleanRoute.slice(0, minLen)) {
                return true;
            }

            // Verificación por proximidad métrica si se pudo decodificar el objetivo
            if (targetDecoded) {
                const routeDecoded = this.decode(cleanRoute);
                if (routeDecoded) {
                    const dist = this.distanceKm(
                        routeDecoded.lat, routeDecoded.lon,
                        targetDecoded.lat, targetDecoded.lon
                    );
                    if (dist <= maxDeviationKm) {
                        return true;
                    }
                }
            }
        }

        // Fuera de la ruta geográfica del transportador -> Poda espacial activa (Rechazar paquete)
        return false;
    }
}
