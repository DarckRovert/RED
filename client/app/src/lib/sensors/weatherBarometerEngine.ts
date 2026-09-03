/**
 * RED Tactical Atmospheric & Barometric Intelligence Engine
 * 
 * Provides:
 * 1. Offline Barometric Trend Analysis (Delta P / 3h).
 * 2. Zambretti Forecaster Algorithm (Off-grid empirical weather forecasting).
 * 3. Dew Point & Heat Index / Wind Chill Calculations.
 * 4. Automated CAP (Common Alerting Protocol OASIS v1.2) Threat Detection.
 */

export interface BaroSample {
  timestamp: number; // ms
  pressureHpa: number;
  temperatureC?: number;
  humidityPercent?: number;
}

export type BaroTrend = 
  | 'RISING_RAPIDLY' 
  | 'RISING_SLOWLY' 
  | 'STEADY' 
  | 'FALLING_SLOWLY' 
  | 'FALLING_RAPIDLY';

export interface BaroAnalysis {
  currentHpa: number;
  deltaP3h: number; // hPa change over ~3h
  trend: BaroTrend;
  trendLabel: string;
  trendIcon: string;
  trendDescription: string;
  isStormWarning: boolean;
  zambrettiCode: string;
  zambrettiForecast: string;
  dewPointC: number | null;
  heatIndexC: number | null;
  cloudBaseEstimatedMeters: number | null;
  suggestedCapSeverity: 'None' | 'Moderate' | 'Severe' | 'Extreme';
}

const BARO_HISTORY_KEY = 'red_baro_telemetry_history';
const MAX_HISTORY_SAMPLES = 100;

/**
 * Persists a barometric sample in localStorage for trend calculation.
 */
export function recordBaroSample(sample: BaroSample): BaroSample[] {
  if (typeof window === 'undefined' || !sample) return [];
  // Reject uncalibrated or absurd pressure readings outside terrestrial range (600 - 1150 hPa)
  if (!isFinite(sample.pressureHpa) || sample.pressureHpa < 600 || sample.pressureHpa > 1150) {
    return getBaroHistory();
  }
  const safeTimestamp = (sample.timestamp && isFinite(sample.timestamp) && sample.timestamp > 0)
    ? sample.timestamp
    : Date.now();

  const validatedSample: BaroSample = {
    ...sample,
    timestamp: safeTimestamp,
    pressureHpa: Math.round(sample.pressureHpa * 10) / 10,
  };

  try {
    const existing = getBaroHistory();
    const updated = [...existing, validatedSample].filter(
      // Keep last 48 hours and purge corrupted / out-of-range samples
      (s) => isFinite(s.pressureHpa) && s.pressureHpa >= 600 && s.pressureHpa <= 1150 && (Date.now() - s.timestamp < 48 * 60 * 60 * 1000)
    );
    // Sort chronological
    updated.sort((a, b) => a.timestamp - b.timestamp);
    const trimmed = updated.slice(-MAX_HISTORY_SAMPLES);
    localStorage.setItem(BARO_HISTORY_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch {
    return [];
  }
}

/**
 * Retrieves recorded history.
 */
export function getBaroHistory(): BaroSample[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BARO_HISTORY_KEY);
    if (!raw) return [];
    const parsed: BaroSample[] = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(s => s && isFinite(s.pressureHpa) && s.pressureHpa >= 600 && s.pressureHpa <= 1150)
      : [];
  } catch {
    return [];
  }
}

/**
 * Calculates Dew Point using Magnus-Tetens formula.
 */
export function calculateDewPoint(tempC: number, rhPercent: number): number | null {
  if (!isFinite(tempC) || !isFinite(rhPercent)) return null;
  const a = 17.27;
  const b = 237.7;
  if (tempC <= -b) return null;
  const clampedRh = Math.max(1, Math.min(100, rhPercent));
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(clampedRh / 100.0);
  if (Math.abs(a - alpha) < 0.0001) return null;
  const dp = (b * alpha) / (a - alpha);
  if (!isFinite(dp)) return null;
  return Math.round(dp * 10) / 10;
}

/**
 * Calculates Heat Index (sensación térmica) in Celsius for warm environments.
 */
export function calculateHeatIndex(tempC: number, rhPercent: number): number | null {
  if (tempC < 20 || !isFinite(tempC) || !isFinite(rhPercent)) return null; // Heat index only relevant above 20°C
  const tF = (tempC * 9/5) + 32;
  const rh = Math.max(0, Math.min(100, rhPercent));
  
  // Rothfusz regression equation
  let hiF = -42.379 + 2.04901523*tF + 10.14333127*rh - 0.22475541*tF*rh 
    - 6.83783e-3*tF*tF - 5.481717e-2*rh*rh + 1.22874e-3*tF*tF*rh 
    + 8.5282e-4*tF*rh*rh - 1.99e-6*tF*tF*rh*rh;
    
  const hiC = (hiF - 32) * 5/9;
  return Math.round(hiC * 10) / 10;
}

/**
 * Estimates Cumulus Cloud Base Altitude (LCL - Lifting Condensation Level) in meters AGL.
 * Formula: ((Temp - DewPoint) / 2.5) * 1000 feet -> converted to meters
 */
export function estimateCloudBaseMeters(tempC: number, dewPointC: number | null): number | null {
  if (!isFinite(tempC) || dewPointC === null || !isFinite(dewPointC)) return null;
  const spreadC = Math.max(0, tempC - dewPointC);
  const baseFeet = (spreadC / 2.5) * 1000;
  return Math.round(baseFeet * 0.3048);
}

/**
 * Analyzes barometric state, trend, and produces tactical forecast.
 */
export function analyzeAtmosphere(
  currentHpa: number,
  currentTempC?: number,
  currentHumidity?: number,
  samples?: BaroSample[]
): BaroAnalysis {
  const isValidHpa = isFinite(currentHpa) && currentHpa >= 600 && currentHpa <= 1150;

  if (!isValidHpa) {
    return {
      currentHpa: 0,
      deltaP3h: 0,
      trend: 'STEADY',
      trendLabel: 'Sin Calibrar',
      trendIcon: '🧭',
      trendDescription: 'Lectura de presión no calibrada o fuera del rango terrestre (600 - 1150 hPa).',
      isStormWarning: false,
      zambrettiCode: 'OFF-GRID',
      zambrettiForecast: 'A la espera de lectura barométrica válida para proyectar pronóstico.',
      dewPointC: null,
      heatIndexC: null,
      cloudBaseEstimatedMeters: null,
      suggestedCapSeverity: 'None',
    };
  }

  const history = (samples || getBaroHistory()).filter(
    s => isFinite(s.pressureHpa) && s.pressureHpa >= 600 && s.pressureHpa <= 1150
  );
  const now = Date.now();
  
  // Look for sample ~3 hours ago (between 2h and 4.5h ago)
  const threeHoursAgo = now - 3 * 60 * 60 * 1000;
  let targetSample: BaroSample | null = null;
  let minDiff = Infinity;

  for (const s of history) {
    const diff = Math.abs(s.timestamp - threeHoursAgo);
    if (diff < minDiff && (now - s.timestamp) >= 1.5 * 60 * 60 * 1000) {
      minDiff = diff;
      targetSample = s;
    }
  }

  // If no 3h history, use earliest recorded sample older than 15 mins
  if (!targetSample && history.length > 1) {
    const candidate = history[0];
    if (now - candidate.timestamp >= 15 * 60 * 1000) {
      targetSample = candidate;
    }
  }

  const deltaP3h = targetSample 
    ? Math.round((currentHpa - targetSample.pressureHpa) * 10) / 10 
    : 0.0;

  // Trend categorization
  let trend: BaroTrend = 'STEADY';
  let trendLabel = 'Estable (±0.5 hPa)';
  let trendIcon = '➡️';
  let trendDescription = 'Presión equilibrada. Sin cambios bruscos previstos en las próximas horas.';
  let isStormWarning = false;
  let suggestedCapSeverity: 'None' | 'Moderate' | 'Severe' | 'Extreme' = 'None';

  if (deltaP3h <= -3.0) {
    trend = 'FALLING_RAPIDLY';
    trendLabel = `Descenso Abrupto (${deltaP3h} hPa/3h)`;
    trendIcon = '⚡📉';
    trendDescription = 'ALERTA TÁCTICA: Caída violenta de presión. Frente de tormenta severa o ciclogénesis inminente (6-12h).';
    isStormWarning = true;
    suggestedCapSeverity = 'Extreme';
  } else if (deltaP3h <= -1.5) {
    trend = 'FALLING_SLOWLY';
    trendLabel = `Descenso Moderado (${deltaP3h} hPa/3h)`;
    trendIcon = '🌧️↘️';
    trendDescription = 'Deterioro de condiciones atmosféricas. Alta probabilidad de precipitaciones y vientos en aumento.';
    isStormWarning = true;
    suggestedCapSeverity = 'Severe';
  } else if (deltaP3h >= 2.0) {
    trend = 'RISING_RAPIDLY';
    trendLabel = `Ascenso Rápido (+${deltaP3h} hPa/3h)`;
    trendIcon = '☀️↗️';
    trendDescription = 'Entrada rápida de cuña anticiclónica. Mejoría temporal, vientos secos.';
    suggestedCapSeverity = 'None';
  } else if (deltaP3h >= 0.6) {
    trend = 'RISING_SLOWLY';
    trendLabel = `Ascenso Gradual (+${deltaP3h} hPa/3h)`;
    trendIcon = '🌤️↗️';
    trendDescription = 'Tendencia a estabilización y cielo despejado.';
    suggestedCapSeverity = 'None';
  }

  // Zambretti Forecaster heuristic calculation
  const zambretti = calculateZambretti(currentHpa, deltaP3h);

  // Derived metrics
  let dewPointC: number | null = null;
  let heatIndexC: number | null = null;
  let cloudBaseEstimatedMeters: number | null = null;

  if (currentTempC !== undefined && currentHumidity !== undefined) {
    dewPointC = calculateDewPoint(currentTempC, currentHumidity);
    heatIndexC = calculateHeatIndex(currentTempC, currentHumidity);
    cloudBaseEstimatedMeters = estimateCloudBaseMeters(currentTempC, dewPointC);
    
    // Check extreme heat index for CAP
    if (heatIndexC && heatIndexC >= 42) {
      suggestedCapSeverity = 'Extreme';
    } else if (heatIndexC && heatIndexC >= 36 && suggestedCapSeverity === 'None') {
      suggestedCapSeverity = 'Moderate';
    }
  }

  return {
    currentHpa,
    deltaP3h,
    trend,
    trendLabel,
    trendIcon,
    trendDescription,
    isStormWarning,
    zambrettiCode: zambretti.code,
    zambrettiForecast: zambretti.text,
    dewPointC,
    heatIndexC,
    cloudBaseEstimatedMeters,
    suggestedCapSeverity,
  };
}

/**
 * Zambretti Algorithm implementation adapted for off-grid barometric observation.
 */
function calculateZambretti(hpa: number, deltaP: number): { code: string; text: string } {
  // Pressure scale ranges typically between 960 (extreme low) and 1040 (extreme high)
  if (deltaP <= -2.0) {
    // Falling rapidly
    if (hpa < 990) return { code: 'Z-F1', text: 'Temporal severo muy probable. Lluvias torrenciales y vendaval.' };
    if (hpa < 1005) return { code: 'Z-F2', text: 'Lluvia intensa y vientos arrachados en aproximación rápida.' };
    if (hpa < 1018) return { code: 'Z-F3', text: 'Deterioro generalizado: Chubascos frecuentes y tormentas dispersas.' };
    return { code: 'Z-F4', text: 'Fin de buen tiempo: Aumento de nubosidad y desmejoramiento progresivo.' };
  } else if (deltaP <= -0.6) {
    // Falling slowly
    if (hpa < 995) return { code: 'Z-F5', text: 'Lluvias continuas, tiempo inestable y húmedo.' };
    if (hpa < 1012) return { code: 'Z-F6', text: 'Lluvias probables con intervalos de viento moderado.' };
    if (hpa < 1022) return { code: 'Z-F7', text: 'Tiempo variable con chubascos ocasionales.' };
    return { code: 'Z-F8', text: 'Tiempo mayormente bueno con incremento paulatino de nubosidad.' };
  } else if (deltaP >= 2.0) {
    // Rising rapidly
    if (hpa > 1020) return { code: 'Z-R1', text: 'Tiempo muy seco y despejado. Alta presión dominante.' };
    if (hpa > 1010) return { code: 'Z-R2', text: 'Mejora rápida y marcada. Cese de precipitaciones.' };
    return { code: 'Z-R3', text: 'Mejora temporal de condiciones, vientos frescos.' };
  } else if (deltaP >= 0.6) {
    // Rising slowly
    if (hpa > 1018) return { code: 'Z-R4', text: 'Tiempo estable y soleado, condiciones óptimas.' };
    if (hpa > 1008) return { code: 'Z-R5', text: 'Mejoría gradual, disminución paulatina de nubosidad.' };
    return { code: 'Z-R6', text: 'Tiempo variable con tendencia a mejorar.' };
  } else {
    // Steady
    if (hpa > 1022) return { code: 'Z-S1', text: 'Tiempo despejado y seco continuo.' };
    if (hpa > 1013) return { code: 'Z-S2', text: 'Buen tiempo sostenido, vientos suaves.' };
    if (hpa > 1000) return { code: 'Z-S3', text: 'Condiciones variables moderadas sin cambios significativos.' };
    return { code: 'Z-S4', text: 'Tiempo inestable estacionario con nubosidad baja.' };
  }
}

/**
 * Calibrates barometric pressure to standard Sea-Level (QNH datum)
 * using the ICAO standard atmosphere barometric hypsometric formula.
 */
export function calculateQnhSeaLevelPressure(
  stationPressureHpa: number,
  elevationMeters: number,
  temperatureC: number = 15
): number {
  if (!isFinite(stationPressureHpa) || stationPressureHpa < 500 || stationPressureHpa > 1150) {
    return 1013.25;
  }
  if (!isFinite(elevationMeters) || elevationMeters < -500 || elevationMeters > 9000) {
    return Math.round(stationPressureHpa * 10) / 10;
  }
  const safeTemp = (typeof temperatureC === 'number' && isFinite(temperatureC)) ? temperatureC : 15;
  const lapseRate = 0.0065; // K/m
  const tKelvin = safeTemp + 273.15;
  const factor = 1 - (lapseRate * elevationMeters) / (tKelvin + lapseRate * elevationMeters);
  if (factor <= 0) return Math.round(stationPressureHpa * 10) / 10;
  const seaLevel = stationPressureHpa * Math.pow(factor, -5.257);
  return Math.round((isFinite(seaLevel) ? seaLevel : stationPressureHpa) * 10) / 10;
}
