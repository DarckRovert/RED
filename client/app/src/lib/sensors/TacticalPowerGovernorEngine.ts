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
        const safeCapacity = Math.max(100, isFinite(batteryCapacityMah) ? batteryCapacityMah : 5000);
        const safeVoltage = Math.max(1.0, isFinite(nominalVoltage) ? nominalVoltage : 3.85);
        const safeBatteryPct = Math.max(0, Math.min(100, isFinite(batteryPct) ? batteryPct : 0));

        const totalEnergyWh = (safeCapacity / 1000) * safeVoltage;
        const currentEnergyWh = totalEnergyWh * (safeBatteryPct / 100);
        const profile = TacticalPowerGovernorEngine.PROFILES[profileKey] || TacticalPowerGovernorEngine.PROFILES['ACTIVE_MESH'];
        const powerW = profile.powerMilliwatts / 1000;

        const remainingHours = safeBatteryPct === 0 
            ? 0.0 
            : Math.round((currentEnergyWh / powerW) * 10) / 10;

        // Auto-throttle mesh bearer if critical
        if (safeBatteryPct <= 15 && safeBatteryPct > 0) {
            import("../mesh/DynamicBearerGovernor").then(({ dynamicBearerGovernor }) => {
                dynamicBearerGovernor.applyPowerBudgetThrottle(safeBatteryPct);
            }).catch(() => {});
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
        const safeCapacity = Math.max(100, isFinite(batteryCapacityMah) ? batteryCapacityMah : 5000);
        const safePanelWatts = Math.max(0.1, isFinite(panelWatts) ? panelWatts : 15);
        const safeCurrentPct = Math.max(0, Math.min(100, isFinite(currentPct) ? currentPct : 0));
        const safeTargetPct = Math.max(0, Math.min(100, isFinite(targetPct) ? targetPct : 100));
        const safeEfficiency = Math.max(10, Math.min(100, isFinite(solarEfficiencyPct) ? solarEfficiencyPct : 75));

        const nominalVoltage = 3.85;
        const totalEnergyWh = (safeCapacity / 1000) * nominalVoltage;
        const deltaPct = Math.max(0, safeTargetPct - safeCurrentPct);
        const energyNeededWh = totalEnergyWh * (deltaPct / 100);

        const effectiveWatts = safePanelWatts * (safeEfficiency / 100);
        const chargeTimeHours = deltaPct === 0
            ? 0.0
            : Math.round((energyNeededWh / Math.max(0.5, effectiveWatts)) * 10) / 10;

        return {
            chargeTimeHours,
            effectiveSolarWatts: Math.round(effectiveWatts * 10) / 10,
        };
    }
}

export const tacticalPowerGovernor = TacticalPowerGovernorEngine.getInstance();
