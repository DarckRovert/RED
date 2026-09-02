/**
 * CursorOnTargetEngine.ts — RED Tactical Cursor-on-Target (CoT) Protocol Suite (v2.0)
 * 
 * Implements MIL-STD-2525 / NATO APP-6 and DoD Cursor-on-Target (CoT) XML event
 * generation, parsing, and real-time mesh dissemination for seamless interoperability
 * with ATAK (Android Tactical Assault Kit), CivTAK, WinTAK, and Raptor servers.
 */

import { TacticalAffiliation, TacticalRole } from './MilStd2525Engine';

export interface CotPoint {
    lat: number;
    lon: number;
    hae?: number; // Height above ellipsoid (meters)
    ce?: number;  // Circular error (meters)
    le?: number;  // Linear error (meters)
}

export interface CotContact {
    callsign: string;
    endpoint?: string;
    phone?: string;
}

export interface CotEvent {
    version: string; // usually "2.0"
    uid: string;
    type: string;    // e.g. "a-f-G-U-C-I" (Atom-Friendly-Ground-Unit-Combat-Infantry)
    time: string;    // ISO 8601 UTC
    start: string;   // ISO 8601 UTC
    stale: string;   // ISO 8601 UTC
    how: string;     // e.g. "m-g" (machine-gps) or "h-e" (human-estimated)
    point: CotPoint;
    detail?: {
        contact?: CotContact;
        remarks?: string;
        group?: { name: string; role: string };
        status?: { battery?: number; readiness?: string };
        color?: string;
    };
}

export class CursorOnTargetEngine {
    private static instance: CursorOnTargetEngine | null = null;

    private constructor() {}

    public static getInstance(): CursorOnTargetEngine {
        if (!this.instance) {
            this.instance = new CursorOnTargetEngine();
        }
        return this.instance;
    }

    /**
     * Maps RED Tactical Affiliation & Role to standard 2525/CoT type string (e.g. "a-f-G-U-C-I")
     */
    public toCotType(affiliation: TacticalAffiliation, role: TacticalRole): string {
        let affChar = 'u';
        switch (affiliation) {
            case 'FRIEND': affChar = 'f'; break;
            case 'HOSTILE': affChar = 'h'; break;
            case 'NEUTRAL': affChar = 'n'; break;
            case 'UNKNOWN': affChar = 'u'; break;
        }

        let roleSuffix = 'G-U-C'; // Ground unit combat
        switch (role) {
            case 'INFANTRY': roleSuffix = 'G-U-C-I'; break;
            case 'MEDICAL': roleSuffix = 'G-U-C-M'; break;
            case 'COMMAND_HQ': roleSuffix = 'G-U-C-HQ'; break;
            case 'MEDEVAC': roleSuffix = 'b-m-p-s-m'; break; // 9-line MEDEVAC
            case 'SUPPLY_AMMO': roleSuffix = 'G-I-A'; break; // Ammo installation
            case 'RECON_DRONE': roleSuffix = 'A-M-F-Q-r'; break; // Air military fixed drone recon
        }

        if (roleSuffix.startsWith('b-')) {
            return roleSuffix;
        }
        return `a-${affChar}-${roleSuffix}`;
    }

    /**
     * Parses standard CoT type string back into RED Affiliation and Role
     */
    public parseCotType(cotType: string): { affiliation: TacticalAffiliation; role: TacticalRole } {
        const parts = cotType.toLowerCase().split('-');
        let affiliation: TacticalAffiliation = 'UNKNOWN';
        if (parts[1] === 'f') affiliation = 'FRIEND';
        else if (parts[1] === 'h') affiliation = 'HOSTILE';
        else if (parts[1] === 'n') affiliation = 'NEUTRAL';

        let role: TacticalRole = 'INFANTRY';
        if (cotType.includes('medevac') || cotType.includes('b-m-p-s-m')) {
            role = 'MEDEVAC';
            affiliation = 'FRIEND';
        } else if (cotType.includes('c-m') || cotType.includes('medical')) {
            role = 'MEDICAL';
        } else if (cotType.includes('hq') || cotType.includes('command')) {
            role = 'COMMAND_HQ';
        } else if (cotType.includes('ammo') || cotType.includes('supply')) {
            role = 'SUPPLY_AMMO';
        } else if (cotType.includes('drone') || cotType.includes('a-m-f-q')) {
            role = 'RECON_DRONE';
        }

        return { affiliation, role };
    }

    /**
     * Serializes a CotEvent into standard ATAK XML format
     */
    public serializeToXml(event: CotEvent): string {
        const lat = (typeof event.point?.lat === 'number' && isFinite(event.point.lat))
            ? Math.max(-90, Math.min(90, event.point.lat))
            : 0.0;
        const lon = (typeof event.point?.lon === 'number' && isFinite(event.point.lon))
            ? Math.max(-180, Math.min(180, event.point.lon))
            : 0.0;
        const hae = (typeof event.point?.hae === 'number' && isFinite(event.point.hae))
            ? event.point.hae
            : 0.0;
        const ce = (typeof event.point?.ce === 'number' && isFinite(event.point.ce) && event.point.ce >= 0)
            ? event.point.ce
            : 9999999.0;
        const le = (typeof event.point?.le === 'number' && isFinite(event.point.le) && event.point.le >= 0)
            ? event.point.le
            : 9999999.0;

        let detailXml = '<detail>';
        if (event.detail?.contact) {
            const callsign = this.escapeXml(event.detail.contact.callsign);
            const endpoint = event.detail.contact.endpoint ? ` endpoint="${this.escapeXml(event.detail.contact.endpoint)}"` : '';
            detailXml += `<contact callsign="${callsign}"${endpoint}/>`;
        }
        if (event.detail?.remarks) {
            detailXml += `<remarks>${this.escapeXml(event.detail.remarks)}</remarks>`;
        }
        if (event.detail?.group) {
            detailXml += `<__group name="${this.escapeXml(event.detail.group.name)}" role="${this.escapeXml(event.detail.group.role)}"/>`;
        }
        if (event.detail?.status?.battery !== undefined && isFinite(event.detail.status.battery)) {
            const safeBat = Math.max(0, Math.min(100, Math.round(event.detail.status.battery)));
            detailXml += `<status battery="${safeBat}"/>`;
        }
        detailXml += '</detail>';

        return `<?xml version="1.0" encoding="UTF-8"?>
<event version="${this.escapeXml(event.version || '2.0')}" uid="${this.escapeXml(event.uid || 'UID-UNKNOWN')}" type="${this.escapeXml(event.type || 'a-u-G')}" time="${event.time || new Date().toISOString()}" start="${event.start || event.time || new Date().toISOString()}" stale="${event.stale || new Date(Date.now() + 180000).toISOString()}" how="${this.escapeXml(event.how || 'm-g')}">
  <point lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}" hae="${hae.toFixed(1)}" ce="${ce.toFixed(1)}" le="${le.toFixed(1)}"/>
  ${detailXml}
</event>`.trim();
    }

    /**
     * Parses standard ATAK CoT XML string into a structured CotEvent
     */
    public parseFromXml(xmlStr: string): CotEvent | null {
        try {
            const getAttr = (tag: string, attr: string): string => {
                const regex = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["']`, 'i');
                const match = xmlStr.match(regex);
                return match ? match[1] : '';
            };

            const uid = getAttr('event', 'uid');
            const type = getAttr('event', 'type');
            if (!uid || !type) return null;

            const time = getAttr('event', 'time') || new Date().toISOString();
            const start = getAttr('event', 'start') || time;
            const stale = getAttr('event', 'stale') || new Date(Date.now() + 300000).toISOString();
            const how = getAttr('event', 'how') || 'm-g';

            const latStr = getAttr('point', 'lat');
            const lonStr = getAttr('point', 'lon');
            if (!latStr || !lonStr) return null;

            const lat = parseFloat(latStr);
            const lon = parseFloat(lonStr);
            if (!isFinite(lat) || !isFinite(lon)) return null;

            const safeLat = Math.max(-90, Math.min(90, lat));
            const safeLon = Math.max(-180, Math.min(180, lon));

            const rawHae = parseFloat(getAttr('point', 'hae') || '0');
            const rawCe = parseFloat(getAttr('point', 'ce') || '10');
            const rawLe = parseFloat(getAttr('point', 'le') || '10');
            const hae = isFinite(rawHae) ? rawHae : 0;
            const ce = (isFinite(rawCe) && rawCe >= 0) ? rawCe : 10;
            const le = (isFinite(rawLe) && rawLe >= 0) ? rawLe : 10;

            const callsign = getAttr('contact', 'callsign') || uid;
            
            // Remarks extraction
            let remarks = '';
            const remarksMatch = xmlStr.match(/<remarks>([\s\S]*?)<\/remarks>/i);
            if (remarksMatch) {
                remarks = remarksMatch[1].trim();
            }

            return {
                version: '2.0',
                uid,
                type,
                time,
                start,
                stale,
                how,
                point: { lat: safeLat, lon: safeLon, hae, ce, le },
                detail: {
                    contact: { callsign },
                    remarks: remarks || undefined
                }
            };
        } catch {
            return null;
        }
    }

    /**
     * Creates an instant Blue-Force Tracking (BFT) CotEvent for the local RED operator
     */
    public createBftEvent(
        operatorDid: string,
        callsign: string,
        lat: number,
        lon: number,
        role: TacticalRole = 'INFANTRY',
        batteryPct?: number
    ): CotEvent {
        const now = new Date();
        const stale = new Date(now.getTime() + 180000); // 3 minutes validity
        const safeDid = operatorDid ? operatorDid.slice(0, 12) : 'ANON';
        const safeCallsign = callsign ? callsign.trim() : `OP-${safeDid.toUpperCase()}`;
        const safeLat = (typeof lat === 'number' && isFinite(lat)) ? Math.max(-90, Math.min(90, lat)) : 0;
        const safeLon = (typeof lon === 'number' && isFinite(lon)) ? Math.max(-180, Math.min(180, lon)) : 0;

        return {
            version: '2.0',
            uid: `RED-${safeDid}`,
            type: this.toCotType('FRIEND', role),
            time: now.toISOString(),
            start: now.toISOString(),
            stale: stale.toISOString(),
            how: 'm-g',
            point: {
                lat: safeLat,
                lon: safeLon,
                hae: 0,
                ce: 5.0,
                le: 5.0
            },
            detail: {
                contact: { callsign: safeCallsign },
                remarks: 'Transmitted via RED Sovereign Mesh OS (P2P Mesh / PQC Secured)',
                status: (batteryPct !== undefined && isFinite(batteryPct))
                    ? { battery: Math.max(0, Math.min(100, Math.round(batteryPct))) }
                    : undefined
            }
        };
    }

    private escapeXml(unsafe: any): string {
        const str = typeof unsafe === 'string' ? unsafe : String(unsafe || '');
        return str.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    public destroy(): void {
        CursorOnTargetEngine.instance = null;
    }
}

export const cursorOnTarget = CursorOnTargetEngine.getInstance();
