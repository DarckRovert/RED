/**
 * MilStd2525Engine.ts — RED Tactical MIL-STD-2525D / NATO APP-6 Symbology Engine
 * 
 * Generates crisp vector SVG military standard symbols for Blue-Force Tracking (BFT),
 * Hostile Threat Marking, Medical Evacuation (MEDEVAC), and Tactical Command HQ overlays.
 */

export type TacticalAffiliation = 'FRIEND' | 'HOSTILE' | 'NEUTRAL' | 'UNKNOWN';
export type TacticalRole = 'INFANTRY' | 'MEDICAL' | 'COMMAND_HQ' | 'MEDEVAC' | 'SUPPLY_AMMO' | 'RECON_DRONE';

export interface MilitarySymbolConfig {
    affiliation: TacticalAffiliation;
    role: TacticalRole;
    label?: string;
    size?: number;
}

const AFFILIATION_COLORS: Record<TacticalAffiliation, { stroke: string; fill: string; bg: string }> = {
    FRIEND: { stroke: '#00E5FF', fill: 'rgba(0, 229, 255, 0.25)', bg: '#004D5A' },
    HOSTILE: { stroke: '#FF3355', fill: 'rgba(255, 51, 85, 0.25)', bg: '#5A0012' },
    NEUTRAL: { stroke: '#00E676', fill: 'rgba(0, 230, 118, 0.25)', bg: '#004D26' },
    UNKNOWN: { stroke: '#FFB300', fill: 'rgba(255, 179, 0, 0.25)', bg: '#5A3D00' },
};

export class MilStd2525Engine {
    private static instance: MilStd2525Engine | null = null;

    private constructor() {}

    public static getInstance(): MilStd2525Engine {
        if (!this.instance) {
            this.instance = new MilStd2525Engine();
        }
        return this.instance;
    }

    /**
     * Genera el SVG completo estándar MIL-STD-2525D
     */
    public generateSvg(config: MilitarySymbolConfig): string {
        const safeConfig = config || { affiliation: 'FRIEND', role: 'INFANTRY' };
        const rawSize = safeConfig.size;
        const size = (typeof rawSize === 'number' && isFinite(rawSize) && rawSize > 0)
            ? Math.max(16, Math.min(256, Math.round(rawSize)))
            : 36;
        const affiliation = (safeConfig.affiliation && AFFILIATION_COLORS[safeConfig.affiliation])
            ? safeConfig.affiliation
            : 'FRIEND';
        const color = AFFILIATION_COLORS[affiliation];
        const half = size / 2;

        let frameSvg = '';
        if (affiliation === 'FRIEND') {
            // Círculo / Rectángulo redondeado
            frameSvg = `<rect x="3" y="3" width="${size - 6}" height="${size - 6}" rx="6" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2.5" />`;
        } else if (affiliation === 'HOSTILE') {
            // Rombo 45 grados
            frameSvg = `<polygon points="${half},3 ${size - 3},${half} ${half},${size - 3} 3,${half}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2.5" />`;
        } else if (affiliation === 'NEUTRAL') {
            // Cuadrado recto
            frameSvg = `<rect x="3" y="3" width="${size - 6}" height="${size - 6}" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2.5" />`;
        } else {
            // Trébol / Nube desconocida
            frameSvg = `<rect x="4" y="4" width="${size - 8}" height="${size - 8}" rx="10" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2.5" stroke-dasharray="3,2" />`;
        }

        let roleSvg = '';
        const role = safeConfig.role || 'INFANTRY';
        switch (role) {
            case 'INFANTRY':
                // Clásica 'X' cruzada de infantería
                roleSvg = `<line x1="${half - 7}" y1="${half - 7}" x2="${half + 7}" y2="${half + 7}" stroke="${color.stroke}" stroke-width="2" stroke-linecap="round" />
                           <line x1="${half + 7}" y1="${half - 7}" x2="${half - 7}" y2="${half + 7}" stroke="${color.stroke}" stroke-width="2" stroke-linecap="round" />`;
                break;
            case 'MEDICAL':
                // Cruz médica griega centrada
                roleSvg = `<line x1="${half}" y1="${half - 8}" x2="${half}" y2="${half + 8}" stroke="${color.stroke}" stroke-width="3.5" stroke-linecap="round" />
                           <line x1="${half - 8}" y1="${half}" x2="${half + 8}" y2="${half}" stroke="${color.stroke}" stroke-width="3.5" stroke-linecap="round" />`;
                break;
            case 'COMMAND_HQ':
                // Mástil con bandera de puesto de mando
                roleSvg = `<line x1="${half - 5}" y1="${half - 8}" x2="${half - 5}" y2="${half + 8}" stroke="${color.stroke}" stroke-width="2.5" />
                           <polygon points="${half - 5},${half - 8} ${half + 7},${half - 4} ${half - 5},${half}" fill="${color.stroke}" />`;
                break;
            case 'MEDEVAC':
                // Símbolo 'H' de helipuerto con cruz médica
                roleSvg = `<text x="${half}" y="${half + 5}" font-family="JetBrains Mono, monospace" font-size="${size * 0.35}" font-weight="900" fill="${color.stroke}" text-anchor="middle">H</text>`;
                break;
            case 'SUPPLY_AMMO':
                // Caja / Depósito de suministros
                roleSvg = `<rect x="${half - 6}" y="${half - 5}" width="12" height="10" fill="none" stroke="${color.stroke}" stroke-width="1.8" />
                           <line x1="${half - 6}" y1="${half}" x2="${half + 6}" y2="${half}" stroke="${color.stroke}" stroke-width="1.2" />`;
                break;
            case 'RECON_DRONE':
                // Radar / Triángulo de reconocimiento
                roleSvg = `<polygon points="${half},${half - 7} ${half + 7},${half + 5} ${half - 7},${half + 5}" fill="none" stroke="${color.stroke}" stroke-width="2" />`;
                break;
            default:
                roleSvg = `<circle cx="${half}" cy="${half}" r="${Math.max(2, size * 0.15)}" fill="${color.stroke}" />`;
                break;
        }

        let labelSvg = '';
        if (safeConfig.label && typeof safeConfig.label === 'string') {
            const safeLabel = safeConfig.label.slice(0, 12).replace(/[<>&"]/g, '');
            labelSvg = `<text x="${half}" y="${size - 4}" font-family="JetBrains Mono, monospace" font-size="${Math.max(8, size * 0.22)}" font-weight="700" fill="${color.stroke}" text-anchor="middle">${safeLabel}</text>`;
        }

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                ${frameSvg}
                ${roleSvg}
                ${labelSvg}
            </svg>
        `.trim();
    }

    /**
     * Genera un Data URI del SVG para utilizar directamente en Leaflet L.icon
     */
    public generateDataUri(config: MilitarySymbolConfig): string {
        const svg = this.generateSvg(config);
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }

    public destroy(): void {
        MilStd2525Engine.instance = null;
    }
}

export const milStd2525 = MilStd2525Engine.getInstance();
