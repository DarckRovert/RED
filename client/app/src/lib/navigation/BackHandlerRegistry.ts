/**
 * RED Sovereign Mesh OS — BackHandlerRegistry
 * Unified LIFO (Last-In, First-Out) Registry for Hardware & UI Back Interceptors.
 *
 * Allows modal screens, floating viewers, drawers, and nested sheets to consume
 * the back gesture/button before the main navigation stack is popped.
 */

export type BackInterceptor = () => boolean;

export class BackHandlerRegistry {
    private static handlers: Array<BackInterceptor> = [];

    /**
     * Registers a back interceptor.
     * @param handler Function returning `true` if the back action was consumed, or `false` otherwise.
     * @returns Cleanup function to unregister the handler.
     */
    public static register(handler: BackInterceptor): () => void {
        this.handlers.push(handler);
        return () => {
            const idx = this.handlers.lastIndexOf(handler);
            if (idx !== -1) {
                this.handlers.splice(idx, 1);
            }
        };
    }

    /**
     * Executes the top-most (most recently registered) back interceptor.
     * @returns `true` if a handler consumed the back event, `false` otherwise.
     */
    public static executeTop(): boolean {
        if (this.handlers.length === 0) return false;
        // LIFO order: highest z-index / most recently opened modal has priority
        const topHandler = this.handlers[this.handlers.length - 1];
        try {
            return Boolean(topHandler());
        } catch (err) {
            console.warn("[BackHandlerRegistry] Error executing back interceptor:", err);
            // Remove failing handler to prevent permanent lock
            this.handlers.pop();
            return false;
        }
    }

    /**
     * Checks if there is at least one active interceptor registered.
     */
    public static hasInterceptors(): boolean {
        return this.handlers.length > 0;
    }

    /**
     * Returns the number of registered interceptors (useful for diagnostics & tests).
     */
    public static get count(): number {
        return this.handlers.length;
    }

    /**
     * Clears all registered interceptors (useful for testing & resets).
     */
    public static clear(): void {
        this.handlers = [];
    }
}
