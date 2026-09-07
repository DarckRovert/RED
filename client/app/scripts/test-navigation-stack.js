/**
 * RED Sovereign Mesh OS — Test Suite: Navigation Stack & Resilient Back Handling
 * Validates NavigationEntry stack, BackHandlerRegistry LIFO order, activeTab SSOT,
 * and double-tap exit mechanics.
 */

const assert = require("assert");

console.log("\n========================================================");
console.log("🧭 RED OS — SUITE DE PRUEBAS: NAVEGACIÓN Y PILA HISTORIAL");
console.log("========================================================\n");

let passed = 0;
let total = 0;

function it(desc, fn) {
    total++;
    try {
        fn();
        console.log(`  ✅ [PASS] ${desc}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${desc}`);
        console.error(err);
        process.exit(1);
    }
}

// 1. Simulación de BackHandlerRegistry
class BackHandlerRegistry {
    static handlers = [];

    static register(handler) {
        this.handlers.push(handler);
        return () => {
            const idx = this.handlers.lastIndexOf(handler);
            if (idx !== -1) this.handlers.splice(idx, 1);
        };
    }

    static executeTop() {
        if (this.handlers.length === 0) return false;
        const top = this.handlers[this.handlers.length - 1];
        try {
            return Boolean(top());
        } catch (err) {
            this.handlers.pop();
            return false;
        }
    }

    static hasInterceptors() {
        return this.handlers.length > 0;
    }

    static clear() {
        this.handlers = [];
    }
}

// 2. Simulación del Store de Navegación (Zustand uiSlice logic)
const MAX_HISTORY = 30;

class MockRedStore {
    constructor() {
        this.currentScreen = 'sidebar';
        this.activeTab = 'chats';
        this.activeConversationId = null;
        this.navigationHistory = [];
    }

    setActiveTab(tab) {
        if (this.activeTab !== tab) {
            this.activeTab = tab;
        }
    }

    navigate(screen, contextId, options) {
        const prevScreen = this.currentScreen;
        const prevContext = this.activeConversationId;
        const prevTab = this.activeTab;

        const isSame = prevScreen === screen && (contextId !== undefined ? prevContext === contextId : true);
        if (!options?.skipHistory && !options?.replace && !isSame) {
            const entry = {
                screen: prevScreen,
                contextId: prevContext,
                activeTab: prevTab,
                timestamp: Date.now()
            };
            this.navigationHistory.push(entry);
            if (this.navigationHistory.length > MAX_HISTORY) {
                this.navigationHistory.shift();
            }
        }

        this.currentScreen = screen;
        this.activeConversationId = contextId || null;
    }

    goBack() {
        // 1. Check LIFO interceptors first
        if (BackHandlerRegistry.hasInterceptors()) {
            const handled = BackHandlerRegistry.executeTop();
            if (handled) return true;
        }

        // 2. Pop navigation stack
        if (this.navigationHistory.length > 0) {
            const prev = this.navigationHistory.pop();
            this.currentScreen = prev.screen;
            this.activeConversationId = prev.contextId || null;
            this.activeTab = prev.activeTab || this.activeTab;
            return true;
        }

        // 3. If in secondary tab on sidebar, return to chats
        if (this.currentScreen === 'sidebar' && this.activeTab !== 'chats') {
            this.activeTab = 'chats';
            return true;
        }

        // 4. Fallback if screen != sidebar
        if (this.currentScreen !== 'sidebar') {
            this.currentScreen = 'sidebar';
            this.activeConversationId = null;
            return true;
        }

        // 5. At root
        return false;
    }
}

// ── EJECUCIÓN DE PRUEBAS ──────────────────────────────────────────

it("1. BackHandlerRegistry ejecuta interceptores en orden LIFO estricto", () => {
    BackHandlerRegistry.clear();
    const calls = [];

    const unreg1 = BackHandlerRegistry.register(() => {
        calls.push("primer_modal");
        return true;
    });

    const unreg2 = BackHandlerRegistry.register(() => {
        calls.push("segundo_modal_superior");
        return true;
    });

    // Debe ejecutar primero el segundo modal
    const res1 = BackHandlerRegistry.executeTop();
    assert.strictEqual(res1, true);
    assert.deepStrictEqual(calls, ["segundo_modal_superior"]);

    unreg2();

    // Ahora debe ejecutar el primer modal
    const res2 = BackHandlerRegistry.executeTop();
    assert.strictEqual(res2, true);
    assert.deepStrictEqual(calls, ["segundo_modal_superior", "primer_modal"]);

    unreg1();
    assert.strictEqual(BackHandlerRegistry.hasInterceptors(), false);
});

it("2. BackHandlerRegistry maneja excepciones sin bloquear el sistema", () => {
    BackHandlerRegistry.clear();
    BackHandlerRegistry.register(() => {
        throw new Error("Simulated DOM crash in modal");
    });

    const res = BackHandlerRegistry.executeTop();
    assert.strictEqual(res, false);
    // El handler defectuoso debió removerse
    assert.strictEqual(BackHandlerRegistry.hasInterceptors(), false);
});

it("3. Navegación multinivel preserva la pila y restaura contextId y activeTab", () => {
    BackHandlerRegistry.clear();
    const store = new MockRedStore();

    // Inicio en Chats
    assert.strictEqual(store.currentScreen, 'sidebar');
    assert.strictEqual(store.activeTab, 'chats');

    // Cambiar a Herramientas
    store.setActiveTab('tools');
    assert.strictEqual(store.activeTab, 'tools');

    // Abrir Radar desde Herramientas
    store.navigate('radar');
    assert.strictEqual(store.currentScreen, 'radar');
    assert.strictEqual(store.navigationHistory.length, 1);
    assert.strictEqual(store.navigationHistory[0].activeTab, 'tools');

    // Desde Radar, abrir Chat con un nodo descubierto
    store.navigate('chat', 'peer_alpha_123');
    assert.strictEqual(store.currentScreen, 'chat');
    assert.strictEqual(store.activeConversationId, 'peer_alpha_123');
    assert.strictEqual(store.navigationHistory.length, 2);

    // Primer Atrás: Debe volver a Radar
    const back1 = store.goBack();
    assert.strictEqual(back1, true);
    assert.strictEqual(store.currentScreen, 'radar');
    assert.strictEqual(store.activeConversationId, null);

    // Segundo Atrás: Debe volver a Herramientas (sidebar con activeTab = 'tools')
    const back2 = store.goBack();
    assert.strictEqual(back2, true);
    assert.strictEqual(store.currentScreen, 'sidebar');
    assert.strictEqual(store.activeTab, 'tools');

    // Tercer Atrás: Estando en Herramientas sin historial, debe volver a Chats
    const back3 = store.goBack();
    assert.strictEqual(back3, true);
    assert.strictEqual(store.currentScreen, 'sidebar');
    assert.strictEqual(store.activeTab, 'chats');

    // Cuarto Atrás: En Chats sin historial, debe retornar false (disparar doble tap)
    const back4 = store.goBack();
    assert.strictEqual(back4, false);
});

it("4. Interceptor de Modal consume retroceso sin afectar la pila de navegación", () => {
    BackHandlerRegistry.clear();
    const store = new MockRedStore();

    store.setActiveTab('tools');
    store.navigate('network');

    let modalOpen = true;
    const unreg = BackHandlerRegistry.register(() => {
        modalOpen = false;
        return true;
    });

    // Presionar Atrás mientras el modal está abierto
    const back1 = store.goBack();
    assert.strictEqual(back1, true);
    assert.strictEqual(modalOpen, false); // El modal se cerró
    assert.strictEqual(store.currentScreen, 'network'); // La pantalla sigue en Red!
    assert.strictEqual(store.navigationHistory.length, 1); // La pila no se alteró

    unreg();

    // Presionar Atrás de nuevo: Ahora sí debe volver a Herramientas
    const back2 = store.goBack();
    assert.strictEqual(back2, true);
    assert.strictEqual(store.currentScreen, 'sidebar');
    assert.strictEqual(store.activeTab, 'tools');
});

it("5. Límite máximo de historial (FIFO 30) previene fugas de memoria", () => {
    BackHandlerRegistry.clear();
    const store = new MockRedStore();

    for (let i = 0; i < 50; i++) {
        store.navigate(`screen_${i}`);
    }

    assert.strictEqual(store.navigationHistory.length, 30);
    // El más antiguo en la pila debe ser screen_19 (descartó 0..18)
    assert.strictEqual(store.navigationHistory[0].screen, 'screen_19');
});

it("6. Deduplicación de estados idénticos consecutivos", () => {
    BackHandlerRegistry.clear();
    const store = new MockRedStore();

    store.navigate('radar');
    store.navigate('radar'); // Re-navegación accidental al mismo estado
    store.navigate('radar');

    assert.strictEqual(store.navigationHistory.length, 1);
});

console.log("\n========================================================");
console.log(`🏁 RESULTADO: ${passed}/${total} PRUEBAS COMPLETADAS CON ÉXITO (100% PASS)`);
console.log("========================================================\n");
