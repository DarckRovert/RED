/**
 * WaterPurificationEngine.ts — RED Tactical Water Purification & Biological Filtration Dosimetry Engine
 * 
 * Computes exact chemical disinfection dosages (Chlorine, Iodine, NaDCC Aquatabs),
 * calculates Solar UV SODIS exposure durations based on UV index and cloud cover,
 * and classifies potability via Total Dissolved Solids (TDS ppm) and turbidity metrics.
 */

export type WaterSourceType = 'CLEAR_RIVER' | 'TURBID_PUDDLE' | 'RAIN_WATER' | 'STAGNANT_SWAMP';
export type DisinfectionMethod = 'SODIUM_HYPOCHLORITE_5PCT' | 'IODINE_2PCT' | 'AQUATABS_NADCC' | 'BOILING' | 'SOLAR_UV_SODIS';

export interface PurificationDosageResult {
    liters: number;
    source: WaterSourceType;
    method: DisinfectionMethod;
    dosageText: string;
    contactTimeMinutes: number;
    instructions: string;
}

export class WaterPurificationEngine {
    private static instance: WaterPurificationEngine | null = null;

    private constructor() {}

    public static getInstance(): WaterPurificationEngine {
        if (!this.instance) {
            this.instance = new WaterPurificationEngine();
        }
        return this.instance;
    }

    public calculateDose(
        liters: number,
        source: WaterSourceType,
        method: DisinfectionMethod
    ): PurificationDosageResult {
        const safeLiters = Math.max(0.1, Math.min(1000, isFinite(liters) ? liters : 1));
        const isTurbid = source === 'TURBID_PUDDLE' || source === 'STAGNANT_SWAMP';

        if (method === 'SODIUM_HYPOCHLORITE_5PCT') {
            // Cloro doméstico estándar sin aromatizantes (5.25% - 6% NaOCl)
            // Agua clara: 2 gotas por litro (~0.1 ml/L, ~4 ppm Cloro libre)
            // Agua turbia: 4 gotas por litro (~0.2 ml/L)
            const dropsPerLiter = isTurbid ? 4 : 2;
            const totalDrops = Math.max(1, Math.round(safeLiters * dropsPerLiter));
            const totalMl = Math.max(0.1, Math.round((totalDrops / 20) * 10) / 10);

            return {
                liters: safeLiters,
                source,
                method,
                dosageText: `${totalDrops} gotas (${totalMl} ml) de Cloro 5%`,
                contactTimeMinutes: 30,
                instructions: isTurbid 
                    ? 'Filtrar previamente con tela o arena. Mezclar bien y dejar reposar 30 min. Si no huele levemente a cloro, repetir dosis.'
                    : 'Añadir al agua, agitar y esperar 30 minutos antes de consumir.',
            };
        }

        if (method === 'IODINE_2PCT') {
            // Tintura de Yodo 2%
            // Agua clara: 5 gotas por litro
            // Agua turbia: 10 gotas por litro
            const dropsPerLiter = isTurbid ? 10 : 5;
            const totalDrops = Math.max(1, Math.round(safeLiters * dropsPerLiter));

            return {
                liters: safeLiters,
                source,
                method,
                dosageText: `${totalDrops} gotas de Tintura de Yodo 2%`,
                contactTimeMinutes: 30,
                instructions: 'Eficaz contra bacterias y quistes de Giardia. No recomendado en embarazadas ni uso mayor a 3 semanas continuas.',
            };
        }

        if (method === 'AQUATABS_NADCC') {
            // Pastillas NaDCC 8.5mg / 17mg
            const tabs = Math.max(1, Math.ceil(safeLiters / (isTurbid ? 1 : 2)));
            return {
                liters: safeLiters,
                source,
                method,
                dosageText: `${tabs} pastilla(s) Aquatabs NaDCC`,
                contactTimeMinutes: 30,
                instructions: 'Disolver pastilla en el recipiente. Esperar 30 minutos. Eficacia del 99.9999% contra patógenos.',
            };
        }

        if (method === 'BOILING') {
            return {
                liters: safeLiters,
                source,
                method,
                dosageText: 'Hervor a ebullición franca',
                contactTimeMinutes: 3,
                instructions: 'Hervir vigorosamente durante 1 minuto a nivel del mar o 3 minutos a altitudes superiores a 2,000m.',
            };
        }

        // SODIS
        return {
            liters: safeLiters,
            source,
            method,
            dosageText: 'Exposición Solar UV en botella PET transparente',
            contactTimeMinutes: isTurbid ? 48 * 60 : 6 * 60,
            instructions: 'Llenar botella PET limpia hasta 3/4, agitar 20s para oxigenar, llenar por completo y exponer al sol sobre superficie reflectante.',
        };
    }

    public classifyTds(tdsPpm: number): { status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNSAFE'; advice: string } {
        if (!isFinite(tdsPpm) || tdsPpm < 0) {
            return { status: 'UNSAFE', advice: '⚠️ Sensor TDS no calibrado, desconectado o valor erróneo. Verifique electrodos antes de beber.' };
        } else if (tdsPpm < 150) {
            return { status: 'EXCELLENT', advice: 'Agua pura de manantial / filtrada. Ideal para hidratación.' };
        } else if (tdsPpm <= 300) {
            return { status: 'GOOD', advice: 'Mineralización óptima y balance electrolítico seguro.' };
        } else if (tdsPpm <= 600) {
            return { status: 'FAIR', advice: 'Aceptable para consumo en supervivencia. Minerales moderados.' };
        } else if (tdsPpm <= 900) {
            return { status: 'POOR', advice: 'Calidad marginal. Se recomienda filtración por carbón activado o destilación.' };
        } else {
            return { status: 'UNSAFE', advice: '⚠️ No potable / Salobre / Contaminación pesada. Riesgo de intoxicación.' };
        }
    }

    public calculateSodisHours(uvIndex: number, cloudCoverPct: number): { exposureHours: number; instructions: string } {
        const safeUv = Math.max(0, isFinite(uvIndex) ? uvIndex : 0);
        const safeCloud = Math.max(0, Math.min(100, isFinite(cloudCoverPct) ? cloudCoverPct : 50));

        let hours = 6;
        if (safeUv < 3 || safeCloud > 70) {
            hours = 48; // Dos días consecutivos si está nublado
        } else if (safeUv < 6 || safeCloud > 30) {
            hours = 12; // Día completo
        }

        return {
            exposureHours: hours,
            instructions: hours >= 48 
                ? 'Nubosidad alta / UV bajo: Requiere 2 días completos de exposición solar (48 horas).' 
                : `UV adecuado: Requiere ${hours} horas continuas de sol directo.`,
        };
    }
}

export const waterPurification = WaterPurificationEngine.getInstance();
