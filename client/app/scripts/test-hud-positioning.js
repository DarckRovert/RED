/**
 * Test TacticalQuickActionHUD visibility and positioning logic
 */
const assert = require('assert');

function computeHudVisibilityAndPosition({ uiMode, isTablet, currentScreen, activeConversationId, isKeyboardOpen }) {
  const isFamiliar = (uiMode || 'familiar') === 'familiar';

  // 1. Familiar mode: strictly null
  if (isFamiliar) {
    return { visible: false, position: null };
  }

  // 2. Keyboard open on mobile: hidden
  if (isKeyboardOpen && !isTablet) {
    return { visible: false, position: null };
  }

  // 3. Call screen: hidden
  if (currentScreen === 'call') {
    return { visible: false, position: null };
  }

  // 4. Position computation
  const isInsideChat = currentScreen === 'chat' || !!activeConversationId;
  const isSidebarWithoutChat = currentScreen === 'sidebar' && !activeConversationId;

  const bottomPosition = isTablet
    ? '24px'
    : isSidebarWithoutChat
      ? 'calc(144px + env(safe-area-inset-bottom, 0px))'
      : isInsideChat
        ? 'calc(84px + env(safe-area-inset-bottom, 0px))'
        : 'calc(16px + env(safe-area-inset-bottom, 0px))';

  return { visible: true, position: bottomPosition };
}

function runTests() {
  console.log('[TEST] Testing TacticalQuickActionHUD Logic...');

  // Test 1: Familiar mode inside chat (Moto G22 / Note 14)
  const t1 = computeHudVisibilityAndPosition({
    uiMode: 'familiar',
    isTablet: false,
    currentScreen: 'chat',
    activeConversationId: 'contact_alice',
    isKeyboardOpen: false
  });
  assert.strictEqual(t1.visible, false, 'HUD must never appear in Familiar chat mode');

  // Test 2: Familiar mode on sidebar (Moto G22 / Note 14)
  const t2 = computeHudVisibilityAndPosition({
    uiMode: 'familiar',
    isTablet: false,
    currentScreen: 'sidebar',
    activeConversationId: null,
    isKeyboardOpen: false
  });
  assert.strictEqual(t2.visible, false, 'HUD must never appear in Familiar sidebar mode');

  // Test 3: Tactical mode inside chat on mobile (Moto G22 / Note 14)
  const t3 = computeHudVisibilityAndPosition({
    uiMode: 'tactical',
    isTablet: false,
    currentScreen: 'chat',
    activeConversationId: 'contact_bob',
    isKeyboardOpen: false
  });
  assert.strictEqual(t3.visible, true);
  assert.strictEqual(t3.position, 'calc(84px + env(safe-area-inset-bottom, 0px))', 'Must float above ChatInput (84px)');

  // Test 4: Tactical mode on sidebar mobile (Moto G22 / Note 14)
  const t4 = computeHudVisibilityAndPosition({
    uiMode: 'tactical',
    isTablet: false,
    currentScreen: 'sidebar',
    activeConversationId: null,
    isKeyboardOpen: false
  });
  assert.strictEqual(t4.visible, true);
  assert.strictEqual(t4.position, 'calc(144px + env(safe-area-inset-bottom, 0px))', 'Must float above FAB (144px)');

  // Test 5: Tactical mode on Tablet
  const t5 = computeHudVisibilityAndPosition({
    uiMode: 'tactical',
    isTablet: true,
    currentScreen: 'nodemap',
    activeConversationId: null,
    isKeyboardOpen: false
  });
  assert.strictEqual(t5.visible, true);
  assert.strictEqual(t5.position, '24px', 'Tablet must use 24px');

  // Test 6: Tactical mode with keyboard open on mobile
  const t6 = computeHudVisibilityAndPosition({
    uiMode: 'tactical',
    isTablet: false,
    currentScreen: 'chat',
    activeConversationId: 'contact_bob',
    isKeyboardOpen: true
  });
  assert.strictEqual(t6.visible, false, 'Must hide when soft keyboard is open on mobile');

  console.log('[SUCCESS] All 6 HUD positioning and isolation tests passed!');
}

runTests();
