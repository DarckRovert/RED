/**
 * TacticalPowerGovernorEngine.ts — RED Tactical Power Governor & Field Battery Autonomy Engine
 * 
 * Models power consumption profiles (Ultra-Stealth, Active Mesh, Heavy C2 Vision),
 * calculates remaining battery life in hours, and estimates solar photovoltaic recharge times.
 */

export type MissionPowerProfile = 'SURVIVAL_STANDBY' | 'ULTRA_STEALTH' | 'ACTIVE_MESH' | 'HEAVY_C2';

export interface PowerProfileInfo {
    name: string;
    powerMilliwatts: number;
    description: string;
}

export class TacticalPowerGovernorEngine {
    private static instance: TacticalPowerGovernorEngine | null = null;

    public static readonly PROFILES: Record<MissionPowerProfile, PowerProfileInfo> = {
        'SURVIVAL_STANDBY': {
            name: 'Standby de Supervivencia',
            powerMilliwatts: 25,
            description: 'Pantalla apagada, CPU en Deep Sleep, escucha periódica de malla cada 30s.',
        },
        'ULTRA_STEALTH': {
            name: 'Sigilo RF / Pantalla Mínima',
            powerMilliwatts: 50,
            description: 'Sin emisiones RF, brillo 10%, sensores inerciales y compás activo.',
        },
        'ACTIVE_MESH': {
            name: 'Enjambre Malla Operativo',
            powerMilliwatts: 180,
            description: 'BLE Mesh continuo, LoRa activo, enrutamiento multi-salto e intercambio DTN.',
        },
        'HEAVY_C2': {
            name: 'C4ISR / Visión AI / Li-Fi',
            powerMilliwatts: 1950,
            description: 'Cámara térmica, redes neuronales Edge AI, Flash Li-Fi y radio máxima.',
        }
    };

    private constructor() {}

    public static getInstance(): TacticalPowerGovernorEngine {
        if (!this.instance) {
            this.instance = new TacticalPowerGovernorEngine();
        }
        return this.instance;
    }

    /**
     * Calcula la autonomía restante en horas
     */
    public estimateAutonomy(
        batteryPct: number,
        batteryCapacityMah: number = 5000, // 5000 mAh estándar (Moto G22)
        nominalVoltage: number = 3.85,
        profileKey: MissionPowerProfile = 'ACTIVE_MESH'
    ): { remainingHours: number; remainingEnergyWh: number; powerMw: number } {
        const totalEnergyWh = (batteryCapacityMah / 1000) * nominalVoltage;
        const currentEnergyWh = totalEnergyWh * (Math.max(1, batteryPct) / 100);
        const profile = TacticalPowerGovernorEngine.PROFILES[profileKey];
        const powerW = profile.powerMilliwatts / 1000;

        const remainingHours = Math.round((currentEnergyWh / powerW) * 10) / 10;

        // Auto-throttle mesh bearer if critical
        if (batteryPct <= 15) {
            import("../mesh/DynamicBearerGovernor").then(({ dynamicBearerGovernor }) => {
                dynamicBearerGovernor.applyPowerBudgetThrottle(batteryPct);
            });
        }

        return {
            remainingHours,
            remainingEnergyWh: Math.round(currentEnergyWh * 100) / 100,
            powerMw: profile.powerMilliwatts,
        };
    }

    /**
     * Estima el tiempo de recarga con panel solar portátil
     */
    public estimateSolarChargeTime(
        panelWatts: number = 15,
        batteryCapacityMah: number = 5000,
        currentPct: number = 20,
        targetPct: number = 100,
        solarEfficiencyPct: number = 75 // Pérdidas térmicas y ángulo solar
    ): { chargeTimeHours: number; effectiveSolarWatts: number } {
        const nominalVoltage = 3.85;
        const totalEnergyWh = (batteryCapacityMah / 1000) * nominalVoltage;
        const energyNeededWh = totalEnergyWh * ((targetPct - currentPct) / 100);

        const effectiveWatts = panelWatts * (solarEfficiencyPct / 100);
        const chargeTimeHours = Math.round((energyNeededWh / Math.max(0.5, effectiveWatts)) * 10) / 10;

        return {
            chargeTimeHours,
            effectiveSolarWatts: Math.round(effectiveWatts * 10) / 10,
        };
    }
}

export const tacticalPowerGovernor = TacticalPowerGovernorEngine.getInstance();
