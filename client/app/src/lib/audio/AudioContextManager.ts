/**
 * RED 2.0 — Tactical AudioContext Manager & Hardware Pool
 * 
 * Centraliza la asignación y ciclo de vida de instancias de Web Audio API
 * para prevenir el agotamiento del límite de hardware en Android WebView
 * (kMaxConcurrentAudioContexts = 6 en Chromium móvil).
 * 
 * Arquitectura:
 * 1. Contexto Compartido (Shared AudioContext):
 *    - Singleton para reproducción de tonos, clics de UI, sirenas, telegrafía Morse,
 *      decodificación de vocoder y análisis de voz.
 *    - Reanudación automática ante suspensión y auto-recuperación si se cierra.
 * 2. Pool de Contextos Dedicados (Dedicated Context Pool):
 *    - Cota dura: MAX_DEDICATED_CONTEXTS = 3 (Total en el sistema <= 4, holgadamente bajo el límite de 6).
 *    - Asignación por ID con desalojo LRU (Least Recently Used) ante sobrecupo.
 * 3. Desbloqueo Táctico por Gesto de Usuario (User Gesture Unlock):
 *    - Escucha pasiva de touchstart/click/keydown para desbloquear el audio y evitar auto-play muting.
 */

export interface AudioContextTelemetry {
    sharedContextState: string;
    activeDedicatedContexts: number;
    totalHardwareContexts: number;
    maxAllowedContexts: number;
}

export class AudioContextManager {
    private static sharedCtx: AudioContext | null = null;
    private static dedicatedPool: Map<string, { ctx: AudioContext; lastUsed: number }> = new Map();
    private static readonly MAX_DEDICATED_CONTEXTS = 3;
    private static hasRegisteredGestureUnlock = false;

    /**
     * Retorna la clase nativa AudioContext del entorno (o webkitAudioContext).
     */
    private static getNativeAudioContextClass(): typeof AudioContext | null {
        if (typeof window === 'undefined') return null;
        return window.AudioContext || (window as any).webkitAudioContext || null;
    }

    /**
     * Registra un desbloqueador pasivo global en el primer gesto del usuario.
     */
    public static setupUserGestureUnlock(): void {
        if (typeof window === 'undefined' || this.hasRegisteredGestureUnlock) return;
        this.hasRegisteredGestureUnlock = true;

        const unlockHandler = () => {
            if (this.sharedCtx && this.sharedCtx.state === 'suspended') {
                this.sharedCtx.resume().catch(() => {});
            }
            this.dedicatedPool.forEach(({ ctx }) => {
                if (ctx && ctx.state === 'suspended') {
                    ctx.resume().catch(() => {});
                }
            });
        };

        const eventOptions = { capture: true, passive: true, once: true };
        ['touchstart', 'touchend', 'click', 'keydown'].forEach((evt) => {
            window.addEventListener(evt, unlockHandler, eventOptions);
        });
    }

    /**
     * Obtiene o inicializa el AudioContext compartido del sistema.
     * Ideal para efectos de sonido, alertas, alarmas, ringtones y decodificación de audio.
     */
    public static getSharedContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        this.setupUserGestureUnlock();

        try {
            if (!this.sharedCtx || this.sharedCtx.state === 'closed') {
                const AudioCtxClass = this.getNativeAudioContextClass();
                if (!AudioCtxClass) return null;
                this.sharedCtx = new AudioCtxClass();
            }

            if (this.sharedCtx && this.sharedCtx.state === 'suspended') {
                this.sharedCtx.resume().catch(() => {});
            }

            return this.sharedCtx;
        } catch (e) {
            console.warn('[AudioContextManager] Error inicializando Shared AudioContext:', e);
            return null;
        }
    }

    /**
     * Cierra el contexto compartido (usado en teardown de tests o shutdown de la app).
     */
    public static async closeSharedContext(): Promise<void> {
        if (this.sharedCtx) {
            try {
                if (this.sharedCtx.state !== 'closed') {
                    await this.sharedCtx.close();
                }
            } catch {}
            this.sharedCtx = null;
        }
    }

    /**
     * Adquiere un AudioContext dedicado para flujos de hardware continuo (VAD, visualizadores en vivo).
     * Aplica desalojo LRU si el pool supera el cupo de MAX_DEDICATED_CONTEXTS (3).
     */
    public static acquireDedicatedContext(requesterId: string): AudioContext | null {
        if (typeof window === 'undefined') return null;
        this.setupUserGestureUnlock();

        const now = Date.now();

        // 1. Si el peticionario ya tiene un contexto activo y no cerrado, reutilizarlo
        const existing = this.dedicatedPool.get(requesterId);
        if (existing && existing.ctx && existing.ctx.state !== 'closed') {
            existing.lastUsed = now;
            if (existing.ctx.state === 'suspended') {
                existing.ctx.resume().catch(() => {});
            }
            return existing.ctx;
        }

        // 2. Si el pool está en su capacidad máxima, desalojar el contexto más antiguo (LRU)
        if (this.dedicatedPool.size >= this.MAX_DEDICATED_CONTEXTS) {
            let oldestKey: string | null = null;
            let oldestTime = Infinity;

            for (const [key, item] of this.dedicatedPool.entries()) {
                if (item.lastUsed < oldestTime) {
                    oldestTime = item.lastUsed;
                    oldestKey = key;
                }
            }

            if (oldestKey) {
                const evicted = this.dedicatedPool.get(oldestKey);
                if (evicted && evicted.ctx && evicted.ctx.state !== 'closed') {
                    try {
                        evicted.ctx.close().catch(() => {});
                    } catch {}
                }
                this.dedicatedPool.delete(oldestKey);
                console.warn(`[AudioContextManager] LRU Eviction: cerrado contexto de '${oldestKey}' para dar paso a '${requesterId}'`);
            }
        }

        // 3. Crear el nuevo contexto dedicado
        try {
            const AudioCtxClass = this.getNativeAudioContextClass();
            if (!AudioCtxClass) return null;

            const ctx = new AudioCtxClass();
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }

            this.dedicatedPool.set(requesterId, { ctx, lastUsed: now });
            return ctx;
        } catch (e) {
            console.warn(`[AudioContextManager] Error creando contexto dedicado para '${requesterId}':`, e);
            // Fallback seguro al contexto compartido si el sistema rechaza una nueva instancia
            return this.getSharedContext();
        }
    }

    /**
     * Libera y cierra formalmente un contexto dedicado.
     */
    public static async releaseDedicatedContext(requesterId: string): Promise<void> {
        const item = this.dedicatedPool.get(requesterId);
        if (item) {
            this.dedicatedPool.delete(requesterId);
            try {
                if (item.ctx && item.ctx.state !== 'closed') {
                    await item.ctx.close();
                }
            } catch {}
        }
    }

    /**
     * Cierra todas las instancias de audio activas (compartidas y dedicadas).
     */
    public static async closeAll(): Promise<void> {
        await this.closeSharedContext();
        const promises: Promise<void>[] = [];
        this.dedicatedPool.forEach((item) => {
            if (item.ctx && item.ctx.state !== 'closed') {
                promises.push(item.ctx.close().catch(() => {}));
            }
        });
        this.dedicatedPool.clear();
        await Promise.all(promises);
    }

    /**
     * Retorna telemetría sobre el uso de recursos de audio del hardware.
     */
    public static getTelemetry(): AudioContextTelemetry {
        const sharedState = this.sharedCtx ? this.sharedCtx.state : 'none';
        let activeDedicated = 0;
        this.dedicatedPool.forEach(({ ctx }) => {
            if (ctx && ctx.state !== 'closed') activeDedicated++;
        });

        const totalHardware = (this.sharedCtx && this.sharedCtx.state !== 'closed' ? 1 : 0) + activeDedicated;

        return {
            sharedContextState: sharedState,
            activeDedicatedContexts: activeDedicated,
            totalHardwareContexts: totalHardware,
            maxAllowedContexts: this.MAX_DEDICATED_CONTEXTS + 1, // 4 contextos máximo
        };
    }
}
