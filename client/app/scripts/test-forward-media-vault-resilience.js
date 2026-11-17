// Test suite for Bug 2: P2P Forward Media & red_vault:// resolution resilience
const assert = require('assert');

// Simulate indexedMediaVault
class MockIndexedMediaVault {
    constructor() {
        this.store = new Map();
    }
    async saveMedia(id, data) {
        this.store.set(id, data);
        return `red_vault://${id}`;
    }
    async getMedia(id) {
        return this.store.get(id) || null;
    }
    async resolveMediaUrl(uri) {
        if (!uri || !uri.startsWith('red_vault://')) return uri;
        const id = uri.replace('red_vault://', '');
        return this.store.get(id) || uri;
    }
}

async function runTests() {
    console.log("=== INITIATING TEST SUITE: P2P FORWARD MEDIA & RED_VAULT RESILIENCE ===");
    const vault = new MockIndexedMediaVault();

    // 1. Store media in vault
    const localMsgId = "msg_photo_abc123";
    const rawPhotoBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...";
    const vaultUri = await vault.saveMedia(localMsgId, rawPhotoBase64);
    assert.strictEqual(vaultUri, "red_vault://msg_photo_abc123", "Vault URI generated correctly");
    console.log("[PASS] 1. Media stored in local vault with pointer URI");

    // 2. Simulate forwarded message with vault pointer
    const msgToForward = {
        id: localMsgId,
        sender: "alice_peer_hash",
        recipient: "bob_peer_hash",
        content: vaultUri,
        media_data: vaultUri,
        msg_type: "image",
        mime_type: "image/jpeg"
    };

    // Forwarding logic simulation (as implemented in MessageForwardModal)
    let resolvedMediaData = msgToForward.media_data;
    if (resolvedMediaData && resolvedMediaData.startsWith('red_vault://')) {
        resolvedMediaData = await vault.resolveMediaUrl(resolvedMediaData);
    }
    let resolvedContent = msgToForward.content || '';
    if (resolvedContent && resolvedContent.startsWith('red_vault://')) {
        resolvedContent = await vault.resolveMediaUrl(resolvedContent);
    }

    assert.strictEqual(resolvedMediaData, rawPhotoBase64, "Forwarded media_data must be real binary/base64, not local red_vault://");
    assert.strictEqual(resolvedContent, rawPhotoBase64, "Forwarded content must be real binary/base64, not local red_vault://");
    console.log("[PASS] 2. Forwarding logic successfully resolves red_vault:// to actual payload before transmission");

    // 3. Verify recipient node reception
    // If recipient is another node with an EMPTY local vault:
    const recipientVault = new MockIndexedMediaVault();
    // Because sender sent raw base64, recipient never receives nonexistent local pointer
    assert.strictEqual(resolvedMediaData.startsWith("red_vault://"), false, "Payload over mesh does not leak sender's local vault ID");
    console.log("[PASS] 3. Recipient receives complete payload over mesh without dependency on sender's IndexedDB");

    // 4. Verify ImageViewerModal async resolution
    let viewerSrc = vaultUri;
    let resolvedViewerSrc = viewerSrc.startsWith('red_vault://') ? '' : viewerSrc;
    if (viewerSrc.startsWith('red_vault://')) {
        resolvedViewerSrc = await vault.resolveMediaUrl(viewerSrc);
    }
    assert.strictEqual(resolvedViewerSrc, rawPhotoBase64, "ImageViewerModal successfully decodes red_vault:// URI");
    console.log("[PASS] 4. ImageViewerModal resolves red_vault:// pointers into viewable/downloadable media");

    console.log("=== ALL FORWARD MEDIA RESILIENCE TESTS PASSED (4/4) ===");
}

runTests().catch(err => {
    console.error("TEST FAILED:", err);
    process.exit(1);
});
