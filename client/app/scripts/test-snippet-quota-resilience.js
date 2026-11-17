// Test suite for Bug 3: Conversation Snippet Sanitization & LocalStorage Quota Resilience
const assert = require('assert');

function computeSnippetChatSlice(optimisticMsg, content, options) {
    const msgType = optimisticMsg.msg_type;
    return msgType === 'image' ? (options?.caption ? `📷 ${options.caption}` : '📷 Foto') :
           msgType === 'voice' || msgType === 'audio' ? '🎤 Nota de voz' :
           msgType === 'video' ? (options?.caption ? `📹 ${options.caption}` : '📹 Video') :
           msgType === 'document' || msgType === 'file' ? (options?.file_name ? `📄 ${options.file_name}` : '📄 Documento') :
           msgType === 'location' ? '📍 Ubicación' :
           msgType === 'contact' ? '👤 Contacto' :
           msgType === 'poll' ? '📊 Encuesta' :
           msgType === 'p2p_payment' ? '🪙 Pago RED P2P' :
           msgType === 'p2p_voucher' ? '🪙 Vale RED P2P' :
           msgType === 'vital_sign' ? '🩺 Signos vitales' :
           (content?.startsWith('data:image') ? (options?.caption ? `📷 ${options.caption}` : '📷 Foto') :
            content?.startsWith('data:audio') ? '🎤 Nota de voz' :
            content?.startsWith('data:video') ? (options?.caption ? `📹 ${options.caption}` : '📹 Video') :
            content?.startsWith('data:') ? (options?.file_name ? `📄 ${options.file_name}` : '📄 Archivo adjunto') :
            content?.startsWith('red_vault://') ? '📷 Adjunto' :
            (typeof content === 'string' && content.length > 80 ? `${content.slice(0, 77)}...` : (content || 'Mensaje P2P')));
}

function runTests() {
    console.log("=== INITIATING TEST SUITE: CONVERSATION SNIPPET & QUOTA RESILIENCE ===");

    // Test 1: Heavy document (PDF/ZIP Base64 dataUrl)
    const largePdfDataUrl = "data:application/pdf;base64," + "A".repeat(5 * 1024 * 1024); // 5 MB string
    const docSnippet = computeSnippetChatSlice(
        { msg_type: 'document' },
        largePdfDataUrl,
        { file_name: 'Manual_Operaciones.pdf' }
    );
    assert.strictEqual(docSnippet, '📄 Manual_Operaciones.pdf', 'Document must have clean icon and filename');
    assert.ok(docSnippet.length < 100, 'Snippet must not store mega-byte Base64 strings');
    console.log("[PASS] 1. Heavy document produces lightweight 📄 snippet, preventing QuotaExceededError");

    // Test 2: Unnamed document
    const unnamedDocSnippet = computeSnippetChatSlice(
        { msg_type: 'document' },
        largePdfDataUrl,
        {}
    );
    assert.strictEqual(unnamedDocSnippet, '📄 Documento', 'Unnamed document must fall back to 📄 Documento');
    console.log("[PASS] 2. Unnamed document falls back cleanly without leaking dataUrl");

    // Test 3: Offloaded media pointer red_vault://
    const vaultUri = "red_vault://msg_987654321_secret";
    const vaultSnippet = computeSnippetChatSlice(
        { msg_type: 'text' },
        vaultUri,
        {}
    );
    assert.strictEqual(vaultSnippet, '📷 Adjunto', 'red_vault:// URI must never be leaked to conversation preview');
    console.log("[PASS] 3. red_vault:// internal pointer masked to 📷 Adjunto");

    // Test 4: Long text message safety truncation
    const longText = "M".repeat(200);
    const textSnippet = computeSnippetChatSlice(
        { msg_type: 'text' },
        longText,
        {}
    );
    assert.strictEqual(textSnippet.length, 80, 'Long text must be capped at 80 characters with ellipsis');
    assert.ok(textSnippet.endsWith('...'), 'Long text ends with ellipsis');
    console.log("[PASS] 4. Excessively long text messages safely truncated for storage stability");

    // Test 5: P2P payment & voucher
    const paySnippet = computeSnippetChatSlice({ msg_type: 'p2p_payment' }, '{"amount":100}', {});
    assert.strictEqual(paySnippet, '🪙 Pago RED P2P');
    const voucherSnippet = computeSnippetChatSlice({ msg_type: 'p2p_voucher' }, '{"amount":50}', {});
    assert.strictEqual(voucherSnippet, '🪙 Vale RED P2P');
    console.log("[PASS] 5. P2P Payments & Vouchers display clear monetary badges");

    console.log("=== ALL SNIPPET QUOTA RESILIENCE TESTS PASSED (5/5) ===");
}

runTests();
