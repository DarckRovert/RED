/**
 * PersistentSynapticPlasticityEngine.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Motor de Plasticidad Sináptica Duradera STDP (Spike-Timing-Dependent Plasticity)
 * con modulación Hebbiana de 3 factores (Pre, Post y Neuromodulador PAM/PPL1).
 * 
 * Modela el aprendizaje asociativo entre las células de Kenyon (KC) y las neuronas
 * de salida del cuerpo pedunculado (MBONs: Mushroom Body Output Neurons) de Drosophila:
 * - Refuerzo apetitivo mediado por Dopamina (cluster PAM: glucosa/néctar).
 * - Refuerzo aversivo mediado por Octopamina/Dopamina (cluster PPL1: choque/colisión).
 * - Persistencia atómica local en Storage con checksum SHA-256 anti-corrupción.
 * - Cuantización a 8-bit para serialización en paquetes de malla LoRa/BLE < 96 bytes.
 */

export interface PlasticityTelemetry {
  activeKcCount: number;
  meanSynapticWeight: number;
  dopamineLevel: number;
  octopamineLevel: number;
  totalLtpEvents: number;
  totalLtdEvents: number;
  lastChecksum: string;
  isPersisted: boolean;
}

export class PersistentSynapticPlasticityEngine {
  public static readonly KC_COUNT = 64; // Canales discretos de Células de Kenyon
  public static readonly MBON_COUNT = 2; // [0]: Approach (Apetitivo), [1]: Avoid (Aversivo)
  private static readonly STORAGE_KEY = 'red_synaptic_matrix_v1';

  // Matriz de pesos W[kc][mbon] inicializada en 0.5 (neutral)
  private weights: Float32Array; // Longitud = KC_COUNT * MBON_COUNT = 128 flotantes
  private eligibilityTraces: Float32Array; // Huellas de elegibilidad por sinapsis

  // Niveles neuromoduladores transitorios [0.0 - 1.0]
  private dopamine: number = 0;   // Cluster PAM (premio)
  private octopamine: number = 0; // Cluster PPL1 (castigo)

  private totalLtp: number = 0;
  private totalLtd: number = 0;
  private lastHash: string = '';

  constructor() {
    this.weights = new Float32Array(PersistentSynapticPlasticityEngine.KC_COUNT * PersistentSynapticPlasticityEngine.MBON_COUNT);
    this.eligibilityTraces = new Float32Array(this.weights.length);

    // Inicializar pesos basales neutros (0.5)
    this.weights.fill(0.5);
  }

  /**
   * Dispara una recompensa dopaminérgica (ej. ingesta de glucosa).
   */
  public injectDopamine(intensity: number = 1.0): void {
    this.dopamine = Math.min(1.0, this.dopamine + Math.max(0, intensity));
  }

  /**
   * Dispara una señal aversiva/nociceptiva (ej. colisión con obstáculo o shock).
   */
  public injectOctopamine(intensity: number = 1.0): void {
    this.octopamine = Math.min(1.0, this.octopamine + Math.max(0, intensity));
  }

  /**
   * Activa un patrón de células de Kenyon representativas de un olor específico.
   * Modela la codificación dispersa del lóbulo antenal (~5-10% activas).
   */
  public activateKcPattern(kcIndices: number[]): void {
    for (const kc of kcIndices) {
      if (kc >= 0 && kc < PersistentSynapticPlasticityEngine.KC_COUNT) {
        // Establecer huella de elegibilidad para las sinapsis de esta KC
        const offset = kc * PersistentSynapticPlasticityEngine.MBON_COUNT;
        this.eligibilityTraces[offset] = 1.0;     // Hacia Approach
        this.eligibilityTraces[offset + 1] = 1.0; // Hacia Avoid
      }
    }
  }

  /**
   * Ejecuta un paso temporal dt actualizando las huellas de elegibilidad y aplicando STDP.
   */
  public step(dt: number): void {
    const traceDecayTau = 0.5; // Huella dura ~500 ms
    const decayFactor = Math.exp(-dt / traceDecayTau);

    const learningRate = 0.08;

    for (let i = 0; i < this.weights.length; i += PersistentSynapticPlasticityEngine.MBON_COUNT) {
      const traceApproach = this.eligibilityTraces[i];
      const traceAvoid = this.eligibilityTraces[i + 1];

      // 1. Refuerzo Apetitivo (Dopamina PAM): Potencia Approach, Deprime Avoid
      if (this.dopamine > 0.01 && traceApproach > 0.01) {
        const dW = learningRate * traceApproach * this.dopamine;
        this.weights[i] = Math.min(1.0, this.weights[i] + dW);
        this.weights[i + 1] = Math.max(0.0, this.weights[i + 1] - dW * 0.5);
        this.totalLtp++;
      }

      // 2. Refuerzo Aversivo (Octopamina PPL1): Potencia Avoid, Deprime Approach
      if (this.octopamine > 0.01 && traceAvoid > 0.01) {
        const dW = learningRate * traceAvoid * this.octopamine;
        this.weights[i + 1] = Math.min(1.0, this.weights[i + 1] + dW);
        this.weights[i] = Math.max(0.0, this.weights[i] - dW * 0.5);
        this.totalLtd++;
      }

      // Decaimiento de huellas de elegibilidad
      this.eligibilityTraces[i] *= decayFactor;
      this.eligibilityTraces[i + 1] *= decayFactor;
    }

    // Decaimiento natural de neuromoduladores
    this.dopamine *= Math.exp(-dt / 0.3);
    this.octopamine *= Math.exp(-dt / 0.3);
  }

  /**
   * Evalúa la respuesta conductual para un patrón de KCs activas.
   * Retorna una valencia neta [-1.0 (Aversión extrema) a +1.0 (Atracción máxima)].
   */
  public evaluateValence(kcIndices: number[]): number {
    if (kcIndices.length === 0) return 0.0;

    let approachSum = 0;
    let avoidSum = 0;

    for (const kc of kcIndices) {
      if (kc >= 0 && kc < PersistentSynapticPlasticityEngine.KC_COUNT) {
        const offset = kc * PersistentSynapticPlasticityEngine.MBON_COUNT;
        approachSum += this.weights[offset];
        avoidSum += this.weights[offset + 1];
      }
    }

    const total = approachSum + avoidSum;
    if (total <= 0.0001) return 0.0;

    return (approachSum - avoidSum) / kcIndices.length;
  }

  /**
   * Cuantiza los pesos sinápticos a un vector compacto Uint8Array de 64 bytes
   * (pesos Approach [0..255] normalizados), ideal para transporte en malla LoRa/BLE < 96 bytes.
   */
  public quantizeForMeshExport(): Uint8Array {
    const buffer = new Uint8Array(PersistentSynapticPlasticityEngine.KC_COUNT);
    for (let kc = 0; kc < PersistentSynapticPlasticityEngine.KC_COUNT; kc++) {
      const approachWeight = this.weights[kc * PersistentSynapticPlasticityEngine.MBON_COUNT];
      buffer[kc] = Math.floor(Math.max(0, Math.min(1, approachWeight)) * 255);
    }
    return buffer;
  }

  /**
   * Restaura la matriz a partir del vector cuantizado Uint8Array recibido por radio.
   */
  public restoreFromQuantizedMesh(buffer: Uint8Array): void {
    const len = Math.min(buffer.length, PersistentSynapticPlasticityEngine.KC_COUNT);
    for (let kc = 0; kc < len; kc++) {
      const normalizedApproach = buffer[kc] / 255.0;
      this.weights[kc * PersistentSynapticPlasticityEngine.MBON_COUNT] = normalizedApproach;
      this.weights[kc * PersistentSynapticPlasticityEngine.MBON_COUNT + 1] = 1.0 - normalizedApproach;
    }
  }

  /**
   * Herencia epigenética con mutación estocástica gaussiana (Selección Natural In-Silico).
   */
  public inheritFromParentWithMutation(parent: PersistentSynapticPlasticityEngine, mutationMagnitude: number = 0.05): void {
    const parentWeights = parent.getWeightsRaw();
    for (let i = 0; i < this.weights.length; i++) {
      const u1 = Math.max(1e-6, Math.random());
      const u2 = Math.random();
      const randNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const mutated = parentWeights[i] + randNormal * mutationMagnitude;
      this.weights[i] = Math.max(0.01, Math.min(0.99, mutated));
    }
  }

  public getWeightsRaw(): Float32Array {
    return this.weights;
  }

  /**
   * Guarda de forma atómica la matriz con hash SHA-256 en almacenamiento local.
   */
  public async saveToStorage(): Promise<boolean> {
    try {
      const array = Array.from(this.weights);
      const json = JSON.stringify(array);
      const hash = await this.computeHash(json);
      this.lastHash = hash;

      const payload = {
        weights: array,
        hash,
        timestamp: Date.now(),
      };

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PersistentSynapticPlasticityEngine.STORAGE_KEY, JSON.stringify(payload));
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Restaura la matriz desde almacenamiento validando integridad criptográfica.
   */
  public async loadFromStorage(): Promise<boolean> {
    try {
      if (typeof localStorage === 'undefined') return false;
      const raw = localStorage.getItem(PersistentSynapticPlasticityEngine.STORAGE_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      if (!parsed.weights || !parsed.hash) return false;

      const json = JSON.stringify(parsed.weights);
      const computed = await this.computeHash(json);
      if (computed !== parsed.hash) {
        console.warn('[PlasticityEngine] Corrupción de memoria biológica detectada (Hash mismatch).');
        return false;
      }

      for (let i = 0; i < Math.min(this.weights.length, parsed.weights.length); i++) {
        this.weights[i] = parsed.weights[i];
      }
      this.lastHash = computed;
      return true;
    } catch {
      return false;
    }
  }

  private async computeHash(data: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    // Fallback de hashing determinista simple para entornos sin WebCrypto
    let h = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) {
      h ^= data.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  }

  public getTelemetry(): PlasticityTelemetry {
    let sum = 0;
    for (let i = 0; i < this.weights.length; i++) {
      sum += this.weights[i];
    }
    return {
      activeKcCount: PersistentSynapticPlasticityEngine.KC_COUNT,
      meanSynapticWeight: sum / this.weights.length,
      dopamineLevel: this.dopamine,
      octopamineLevel: this.octopamine,
      totalLtpEvents: this.totalLtp,
      totalLtdEvents: this.totalLtd,
      lastChecksum: this.lastHash,
      isPersisted: this.lastHash.length > 0,
    };
  }
}
