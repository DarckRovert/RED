// Test script to verify BackHandlerRegistry reentrancy behavior
class BackHandlerRegistry {
    static handlers = [];
    static isExecuting = false;

    static register(handler) {
        this.handlers.push(handler);
        return () => {
            const idx = this.handlers.lastIndexOf(handler);
            if (idx !== -1) this.handlers.splice(idx, 1);
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
            console.error("Error in handler:", err);
            this.handlers.pop();
            return false;
        } finally {
            this.isExecuting = false;
        }
    }

    static hasInterceptors() {
        return this.handlers.length > 0;
    }
}

// Mock UI Store
const store = {
    currentScreen: 'settings',
    history: [{ screen: 'sidebar' }],
    goBack() {
        if (BackHandlerRegistry.hasInterceptors()) {
            const handled = BackHandlerRegistry.executeTop();
            if (handled) return true;
        }
        if (this.history.length > 0) {
            const prev = this.history.pop();
            this.currentScreen = prev.screen;
            return true;
        }
        return false;
    }
};

// Simulate SettingsModal mounting
const unregister = BackHandlerRegistry.register(() => {
    // Interceptor calls handleClose -> store.goBack()
    store.goBack();
    return true;
});

console.log("Before Back press:");
console.log("Current screen:", store.currentScreen);
console.log("History:", store.history);
console.log("Interceptors count:", BackHandlerRegistry.handlers.length);

// User presses Android Back button
console.log("\nSimulating Android hardware back press...");
const result = store.goBack();

// Modal unmounts in response to screen change
unregister();

console.log("\nAfter Back press:");
console.log("Handled by goBack:", result);
console.log("Current screen:", store.currentScreen);
console.log("History:", store.history);
console.log("Interceptors count:", BackHandlerRegistry.handlers.length);

if (store.currentScreen === 'sidebar' && result === true) {
    console.log("\n>>> TEST PASSED: No recursion, screen popped to sidebar, event marked handled! <<<");
} else {
    console.error("\n>>> TEST FAILED <<<");
    process.exit(1);
}
