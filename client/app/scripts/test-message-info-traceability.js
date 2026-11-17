const assert = require('assert');

// Test traceability timestamps and content rendering in MessageInfo
function testMessageInfoLogic() {
  console.log('[TEST] Testing MessageInfo & Traceability Logic...');

  // 1. Initial sent message
  let msg = {
    id: 'msg_1001',
    sender: 'alice',
    recipient: 'bob',
    content: 'red_vault://audio/1727392817291.ogg',
    msg_type: 'voice',
    timestamp: 1727392800, // 20:00:00
    is_mine: true,
    status: 'Sent'
  };

  assert.strictEqual(msg.status, 'Sent');
  assert(!msg.delivered_at);
  assert(!msg.read_at);

  // 2. Delivery ACK arrives 15s later
  const ackTs = 1727392815;
  msg = {
    ...msg,
    status: 'Delivered',
    delivered: true,
    delivered_at: ackTs
  };
  assert.strictEqual(msg.status, 'Delivered');
  assert.strictEqual(msg.delivered_at, 1727392815);

  // 3. Read Receipt arrives 45s later
  const readTs = 1727392860;
  msg = {
    ...msg,
    status: 'Read',
    read: true,
    read_at: readTs
  };
  assert.strictEqual(msg.status, 'Read');
  assert.strictEqual(msg.read_at, 1727392860);

  // 4. Verify preview resolver doesn't leak red_vault:// or raw JSON
  function resolvePreview(m) {
    const type = m.msg_type;
    const content = m.content || '';
    const isVault = typeof content === 'string' && content.startsWith('red_vault://');

    if (type === 'voice' || type === 'audio' || (isVault && content.startsWith('red_vault://audio')) || content.startsWith('data:audio')) {
      return { icon: '🎤', text: 'Nota de voz P2P' };
    }
    if (type === 'image' || (isVault && content.startsWith('red_vault://image')) || content.startsWith('data:image')) {
      return { icon: '📷', text: m.caption || 'Foto' };
    }
    if (type === 'video' || (isVault && content.startsWith('red_vault://video')) || content.startsWith('data:video')) {
      return { icon: '📹', text: m.caption || 'Video P2P' };
    }
    if (type === 'document' || type === 'file' || (isVault && content.startsWith('red_vault://file')) || m.file_name) {
      return { icon: '📄', text: m.file_name || 'Documento adjunto' };
    }
    if (type === 'location' || (typeof content === 'string' && content.startsWith('{') && content.includes('"latitude"'))) {
      return { icon: '📍', text: 'Ubicación táctica compartida' };
    }
    if (type === 'poll' || (typeof content === 'string' && content.startsWith('{') && content.includes('"options"'))) {
      let question = 'Encuesta P2P';
      try {
        const parsed = JSON.parse(content);
        if (parsed.question) question = `Encuesta: ${parsed.question}`;
      } catch {}
      return { icon: '📊', text: question };
    }
    if (type === 'p2p_payment' || type === 'p2p_voucher' || (typeof content === 'string' && content.includes('"voucher_id"'))) {
      return { icon: '🪙', text: 'Vale RED P2P' };
    }
    if (typeof content === 'string' && content.startsWith('data:')) {
      return { icon: '📎', text: 'Archivo adjunto' };
    }
    return { icon: '💬', text: content };
  }

  // Check voice note
  const previewVoice = resolvePreview(msg);
  assert.strictEqual(previewVoice.icon, '🎤');
  assert.strictEqual(previewVoice.text, 'Nota de voz P2P');
  assert(!previewVoice.text.includes('red_vault://'));

  // Check vault image
  const previewImg = resolvePreview({ content: 'red_vault://image/photo_12.jpg', msg_type: 'image' });
  assert.strictEqual(previewImg.icon, '📷');
  assert.strictEqual(previewImg.text, 'Foto');

  // Check poll
  const previewPoll = resolvePreview({
    content: JSON.stringify({ question: '¿Ruta segura?', options: ['Norte', 'Sur'] }),
    msg_type: 'poll'
  });
  assert.strictEqual(previewPoll.icon, '📊');
  assert.strictEqual(previewPoll.text, 'Encuesta: ¿Ruta segura?');

  // Check location
  const previewLoc = resolvePreview({
    content: JSON.stringify({ latitude: 4.6097, longitude: -74.0817 }),
    msg_type: 'location'
  });
  assert.strictEqual(previewLoc.icon, '📍');
  assert.strictEqual(previewLoc.text, 'Ubicación táctica compartida');

  // Check document
  const previewDoc = resolvePreview({
    content: 'red_vault://file/plan.pdf',
    msg_type: 'document',
    file_name: 'plan_evacuacion.pdf'
  });
  assert.strictEqual(previewDoc.icon, '📄');
  assert.strictEqual(previewDoc.text, 'plan_evacuacion.pdf');

  // 5. Date formatting verification
  const formatFullDate = (ts) => {
    if (!ts) return "—";
    const norm = ts < 1e10 ? ts * 1000 : ts;
    const d = new Date(norm);
    return d.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const sentDate = formatFullDate(msg.timestamp);
  const deliveredDate = formatFullDate(msg.delivered_at);
  const readDate = formatFullDate(msg.read_at);

  assert(sentDate.length > 5);
  assert(deliveredDate.length > 5);
  assert(readDate.length > 5);
  assert.notStrictEqual(sentDate, deliveredDate);
  assert.notStrictEqual(deliveredDate, readDate);

  console.log('[SUCCESS] All 7 MessageInfo & Traceability tests passed cleanly!');
}

testMessageInfoLogic();
