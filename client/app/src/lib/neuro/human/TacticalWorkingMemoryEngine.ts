/**
 * TacticalWorkingMemoryEngine.ts — RED Sovereign Mesh OS
 * 
 * Emulación Bio-Neuromórfica de la Corteza Prefrontal Dorsolateral Humana (DLPFC)
 * (Áreas 9 y 46 de Brodmann — Memoria de Trabajo Ejecutiva).
 * 
 * Función Táctica Fundamental (Autómata Ejecutivo Multietapa Inmune a Estrés):
 * 1. Bajo bombardeo, shock acústico o fatiga extrema, el flujo de catecolaminas apaga
 *    la memoria de trabajo biológica del operador (amnesia disociativa de combate).
 * 2. Este motor mantiene una pila de tareas secuenciales ejecutivas:
 *    - Paso 1: "Desplazarse al Punto Alfa (Geofence 25m)"
 *    - Paso 2: "Conmutar canal LoRa a TÁCTICO-SECUNDARIO"
 *    - Paso 3: "Entregar raciones médicas / Verificar pulso herido"
 *    - Paso 4: "Emitir feromona de Rastro Seguro (TRAIL) y evacuar"
 * 3. Transición Automatizada por Sensores Físicos:
 *    Audita continuamente las coordenadas inerciales (PDR), el canal de radio y los sensores.
 *    Al detectar el cumplimiento físico del objetivo, tacha el paso automáticamente,
 *    despacha feedback sonoro/háptico y presenta la siguiente directiva sin requerir clics.
 */

import { TacticalAudioEngine } from '../../audio/TacticalAudioEngine';

export type TaskTriggerType = 'PROXIMITY_COORDS' | 'RADIO_CHANNEL' | 'TIME_ELAPSED' | 'MANUAL_TOUCH';

export interface TacticalTaskItem {
  id: string;
  order: number;
  title: string;
  instructions: string;
  isCompleted: boolean;
  triggerType: TaskTriggerType;
  targetCoords?: { lat: number; lon: number; radiusMeters: number };
  targetChannel?: string;
  targetDurationSeconds?: number;
  completedAt?: number;
}

export interface WorkingMemoryTelemetry {
  totalTasks: number;
  completedTasksCount: number;
  activeTask: TacticalTaskItem | null;
  overallProgressPct: number;
  isMissionAccomplished: boolean;
  lastCompletedTaskTitle?: string;
}

export class TacticalWorkingMemoryEngine {
  private static instance: TacticalWorkingMemoryEngine | null = null;
  private static readonly STORAGE_KEY = 'red_working_memory_tasks_v1';

  private tasks: TacticalTaskItem[] = [];
  private listeners: Set<(telemetry: WorkingMemoryTelemetry) => void> = new Set();
  private lastCompletedTitle?: string;

  private constructor() {
    this.hydrateFromStorage();
  }

  private hydrateFromStorage(): void {
    if (typeof window === 'undefined') {
      this.hydrateDefaultEmergencyPlan();
      return;
    }
    try {
      const raw = localStorage.getItem(TacticalWorkingMemoryEngine.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.tasks = parsed;
          return;
        }
      }
    } catch {}
    this.hydrateDefaultEmergencyPlan();
  }

  private persistToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TacticalWorkingMemoryEngine.STORAGE_KEY, JSON.stringify(this.tasks));
    } catch {}
  }

  public static getInstance(): TacticalWorkingMemoryEngine {
    if (!TacticalWorkingMemoryEngine.instance) {
      TacticalWorkingMemoryEngine.instance = new TacticalWorkingMemoryEngine();
    }
    return TacticalWorkingMemoryEngine.instance;
  }

  private hydrateDefaultEmergencyPlan(): void {
    // Protocolo estándar de dispersión y supervivencia
    this.tasks = [
      {
        id: 'TASK-1',
        order: 1,
        title: 'Buscar Cobertura Inmediata',
        instructions: 'Romper línea de visión hostil y descender silueta a cubierto.',
        isCompleted: false,
        triggerType: 'MANUAL_TOUCH',
      },
      {
        id: 'TASK-2',
        order: 2,
        title: 'Comprobar Enlace de Malla',
        instructions: 'Verificar presencia de repetidor o nodos aliados en radio LoRa.',
        isCompleted: false,
        triggerType: 'RADIO_CHANNEL',
        targetChannel: '#general',
      },
      {
        id: 'TASK-3',
        order: 3,
        title: 'Reportar Estado de Situación',
        instructions: 'Emitir SITREP o feromona según presencia o ausencia de amenazas.',
        isCompleted: false,
        triggerType: 'MANUAL_TOUCH',
      },
    ];
  }

  public setTasks(tasks: TacticalTaskItem[]): void {
    this.tasks = [...tasks].sort((a, b) => a.order - b.order);
    this.notifyListeners();
  }

  public getTasks(): TacticalTaskItem[] {
    return [...this.tasks];
  }

  /**
   * Evalúa la posición actual (PDR/GNSS) para avanzar tareas de proximidad automáticamente.
   */
  public evaluateSensoryTriggers(currentLoc: { lat: number; lon: number }): boolean {
    if (Math.abs(currentLoc.lat) <= 0.0001 && Math.abs(currentLoc.lon) <= 0.0001) {
      return false;
    }
    const active = this.getActiveTask();
    if (!active || active.triggerType !== 'PROXIMITY_COORDS' || !active.targetCoords) {
      return false;
    }

    const distMeters = this.getHaversineDistance(
      currentLoc.lat,
      currentLoc.lon,
      active.targetCoords.lat,
      active.targetCoords.lon
    );

    if (distMeters <= active.targetCoords.radiusMeters) {
      this.completeTask(active.id);
      return true;
    }

    return false;
  }

  /**
   * Completa una tarea manualmente o por sensor y avanza la pila de memoria de trabajo.
   */
  public completeTask(taskId: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || task.isCompleted) return;

    task.isCompleted = true;
    task.completedAt = Date.now();
    this.lastCompletedTitle = task.title;

    TacticalAudioEngine.playRogerBeep();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 50, 80]); // Confirmación háptica ejecutiva
    }

    this.persistToStorage();
    this.notifyListeners();
  }

  public resetAllTasks(): void {
    this.tasks.forEach(t => {
      t.isCompleted = false;
      t.completedAt = undefined;
    });
    this.lastCompletedTitle = undefined;
    this.persistToStorage();
    this.notifyListeners();
  }

  public getActiveTask(): TacticalTaskItem | null {
    return this.tasks.find(t => !t.isCompleted) || null;
  }

  public addTask(
    title: string,
    instructions: string,
    triggerType: TaskTriggerType = 'MANUAL_TOUCH',
    options?: {
      targetCoords?: { lat: number; lon: number; radiusMeters: number };
      targetChannel?: string;
      targetDurationSeconds?: number;
    }
  ): TacticalTaskItem {
    const newTask: TacticalTaskItem = {
      id: `TASK-${Date.now()}-${this.tasks.length + 1}`,
      order: this.tasks.length + 1,
      title,
      instructions,
      isCompleted: false,
      triggerType,
      targetCoords: options?.targetCoords,
      targetChannel: options?.targetChannel,
      targetDurationSeconds: options?.targetDurationSeconds
    };
    this.tasks.push(newTask);
    this.persistToStorage();
    this.notifyListeners();
    return newTask;
  }

  private getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public getTelemetry(): WorkingMemoryTelemetry {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.isCompleted).length;
    const active = this.getActiveTask();
    const progress = total > 0 ? Math.round((completed / total) * 100) : 100;

    return {
      totalTasks: total,
      completedTasksCount: completed,
      activeTask: active,
      overallProgressPct: progress,
      isMissionAccomplished: total > 0 && completed === total,
      lastCompletedTaskTitle: this.lastCompletedTitle,
    };
  }

  public subscribe(callback: (telemetry: WorkingMemoryTelemetry) => void): () => void {
    this.listeners.add(callback);
    callback(this.getTelemetry());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const telem = this.getTelemetry();
    for (const cb of this.listeners) {
      try { cb(telem); } catch {}
    }
  }

  public destroy(): void {
    this.tasks = [];
    this.listeners.clear();
    TacticalWorkingMemoryEngine.instance = null;
  }
}

export const tacticalWorkingMemory = TacticalWorkingMemoryEngine.getInstance();
