const assert = require('assert');

// 1. Simulate the exact BackHandlerRegistry class with our new implementation
class BackHandlerRegistry {
    static handlers = [];
    static isExecuting = false;

    static register(handler) {
        this.handlers.push(handler);
        return () => {
            const idx = this.handlers.lastIndexOf(handler);
            if (idx !== -1) {
                this.handlers.splice(idx, 1);
            }
        };
    }

    static executeTop() {
        if (this.isExecuting) {
            return false;
        }
        if (this.handlers.length === 0) return false;

        this.isExecuting = true;
        try {
            const topHandler = this.handlers[this.handlers.length - 1];
            return Boolean(topHandler());
        } catch (err) {
            console.warn("[BackHandlerRegistry] Error:", err);
            this.handlers.pop();
            return false;
        } finally {
            this.isExecuting = false;
        }
    }

    static hasInterceptors() {
        return this.handlers.length > 0;
    }

    static get count() {
        return this.handlers.length;
    }

    static clear() {
        this.handlers = [];
        this.isExecuting = false;
    }
}

// 2. Simulate uiSlice with our new goBack implementation
function createMockStore(initialState) {
    const state = {
        currentScreen: initialState.currentScreen || 'sidebar',
        activeConversationId: initialState.activeConversationId || null,
        activeTab: initialState.activeTab || 'chats',
        navigationHistory: initialState.navigationHistory || [],
        
        navigate(screen, contextId, options) {
            if (!options?.skipHistory && !options?.replace) {
                this.navigationHistory.push({
                    screen: this.currentScreen,
                    contextId: this.activeConversationId,
                    activeTab: this.activeTab
                });
            }
            this.currentScreen = screen;
            this.activeConversationId = contextId || null;
        },

        goBack(options) {
            const opts = (typeof options === 'object' && options !== null)
                ? options
                : {};

            if (!opts.skipInterceptors && BackHandlerRegistry.hasInterceptors()) {
                const handled = BackHandlerRegistry.executeTop();
                if (handled) return true;
            }

            const history = Array.isArray(this.navigationHistory) ? [...this.navigationHistory] : [];

            while (history.length > 0) {
                const prevEntry = history.pop();
                const isDistinct = prevEntry.screen !== this.currentScreen || 
                    (prevEntry.screen === 'chat' && prevEntry.contextId !== this.activeConversationId);
                
                if (isDistinct || history.length === 0) {
                    this.navigationHistory = history;
                    if (prevEntry.screen === 'chat' && prevEntry.contextId) {
                        this.navigate('chat', prevEntry.contextId, { skipHistory: true });
                    } else {
                        this.currentScreen = prevEntry.screen;
                        this.activeConversationId = prevEntry.contextId || null;
                        this.activeTab = prevEntry.activeTab || this.activeTab;
                    }
                    return true;
                }
            }
            this.navigationHistory = [];

            if (this.currentScreen === 'sidebar' && this.activeTab !== 'chats') {
                this.activeTab = 'chats';
                return true;
            }

            if (this.currentScreen !== 'sidebar') {
                this.currentScreen = 'sidebar';
                this.activeConversationId = null;
                return true;
            }

            return false;
        }
    };
    return state;
}

console.log("=== INICIANDO SUITE DE PRUEBAS DE RESILIENCIA DE NAVEGACIÓN ===\n");

// TEST 1: Reentrancia directa en modal (SettingsModal calling goBack)
{
    BackHandlerRegistry.clear();
    const store = createMockStore({ currentScreen: 'settings', navigationHistory: [{ screen: 'sidebar' }] });
    
    // Modal registers handler that calls goBack()
    const unreg = BackHandlerRegistry.register(() => {
        store.goBack();
        return true;
    });

    const handled = store.goBack();
    unreg(); // component unmounts

    assert.strictEqual(handled, true, "TEST 1 Failed: goBack should return true");
    assert.strictEqual(store.currentScreen, 'sidebar', "TEST 1 Failed: currentScreen should be sidebar");
    assert.strictEqual(store.navigationHistory.length, 0, "TEST 1 Failed: history should be empty");
    console.log("✅ TEST 1: Reentrancia directa en modal resuelta sin recursión.");
}

// TEST 2: Interceptor con sub-estado (BlockchainExplorer: selectedBlock -> tab -> goBack)
{
    BackHandlerRegistry.clear();
    const store = createMockStore({ currentScreen: 'explorer', navigationHistory: [{ screen: 'sidebar' }] });
    
    let selectedBlock = { hash: '0x123' };
    let tab = 'validators';

    const unreg = BackHandlerRegistry.register(() => {
        if (selectedBlock) {
            selectedBlock = null;
            return true;
        }
        if (tab !== 'blocks') {
            tab = 'blocks';
            return true;
        }
        store.goBack();
        return true;
    });

    // 1st press: closes block preview
    assert.strictEqual(store.goBack(), true);
    assert.strictEqual(selectedBlock, null);
    assert.strictEqual(store.currentScreen, 'explorer');

    // 2nd press: returns to 'blocks' tab
    assert.strictEqual(store.goBack(), true);
    assert.strictEqual(tab, 'blocks');
    assert.strictEqual(store.currentScreen, 'explorer');

    // 3rd press: pops explorer and returns to sidebar
    assert.strictEqual(store.goBack(), true);
    unreg();
    assert.strictEqual(store.currentScreen, 'sidebar');
    console.log("✅ TEST 2: Desenlace jerárquico LIFO de sub-estados completado con éxito.");
}

// TEST 3: Desapilado con entradas de historial duplicadas
{
    BackHandlerRegistry.clear();
    const store = createMockStore({
        currentScreen: 'network',
        navigationHistory: [
            { screen: 'sidebar' },
            { screen: 'network' }, // duplicate push
            { screen: 'network' }  // duplicate push
        ]
    });

    const handled = store.goBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(store.currentScreen, 'sidebar');
    console.log("✅ TEST 3: Historial con duplicados se desenrolla limpiamente a la pantalla previa.");
}

// TEST 4: Pantalla secundaria sin historial hace fallback a sidebar
{
    BackHandlerRegistry.clear();
    const store = createMockStore({ currentScreen: 'nodemap', navigationHistory: [] });
    
    const handled = store.goBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(store.currentScreen, 'sidebar');
    console.log("✅ TEST 4: Fallback seguro a sidebar cuando el historial está vacío.");
}

// TEST 5: Tab secundaria en sidebar ('status' -> 'chats')
{
    BackHandlerRegistry.clear();
    const store = createMockStore({ currentScreen: 'sidebar', activeTab: 'status', navigationHistory: [] });
    
    const handled = store.goBack();
    assert.strictEqual(handled, true);
    assert.strictEqual(store.activeTab, 'chats');

    // En chats con historial vacío, goBack retorna false (señal para Capacitor minimize/toast)
    const handledAtRoot = store.goBack();
    assert.strictEqual(handledAtRoot, false);
    console.log("✅ TEST 5: Retorno de pestaña secundaria a 'chats' y señal raíz a Capacitor verificado.");
}

// TEST 6: skipInterceptors directo
{
    BackHandlerRegistry.clear();
    const store = createMockStore({ currentScreen: 'settings', navigationHistory: [{ screen: 'sidebar' }] });
    
    let subModalOpen = true;
    BackHandlerRegistry.register(() => {
        if (subModalOpen) {
            subModalOpen = false;
            return true;
        }
        return false;
    });

    // Forced direct back skipping interceptors
    const handled = store.goBack({ skipInterceptors: true });
    assert.strictEqual(handled, true);
    assert.strictEqual(store.currentScreen, 'sidebar');
    console.log("✅ TEST 6: skipInterceptors evade interceptores y desapila directamente.");
}

console.log("\n>>> TODAS LAS PRUEBAS DE RESILIENCIA DE NAVEGACIÓN PASARON AL 100% <<<");
