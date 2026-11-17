const assert = require('assert');

// Test ContactProfileModal media categorisation and location parsing logic
function testContactProfileMedia() {
  console.log('[TEST] Testing ContactProfileModal Media & Location Logic...');

  const messages = [
    {
      id: 'm1',
      msg_type: 'image',
      content: 'red_vault://image/photo_01.jpg',
      timestamp: 1727392800
    },
    {
      id: 'm2',
      msg_type: 'video',
      content: 'red_vault://video/clip_01.mp4',
      timestamp: 1727392810
    },
    {
      id: 'm3',
      msg_type: 'voice',
      content: 'red_vault://audio/voice_01.ogg',
      timestamp: 1727392820
    },
    {
      id: 'm4',
      msg_type: 'document',
      content: 'red_vault://file/manual.pdf',
      file_name: 'manual_tactico.pdf',
      file_size: 1048576,
      timestamp: 1727392830
    },
    {
      id: 'm5',
      msg_type: 'location',
      content: JSON.stringify({ latitude: 19.4326, longitude: -99.1332 }),
      timestamp: 1727392840
    },
    {
      id: 'm6',
      msg_type: 'text',
      content: 'https://red-mesh.org/docs',
      timestamp: 1727392850
    }
  ];

  // 1. Photos & Videos filtering (must include vault images & videos)
  const photosAndVideos = messages.filter(
    (m) =>
      m.msg_type === 'image' ||
      m.msg_type === 'video' ||
      (m.media_data && (m.media_data.startsWith('data:image/') || m.media_data.startsWith('data:video/'))) ||
      (m.content && (m.content.startsWith('red_vault://image') || m.content.startsWith('red_vault://video') || m.content.startsWith('data:image/') || m.content.startsWith('data:video/')))
  );
  assert.strictEqual(photosAndVideos.length, 2);

  // 2. Documents filtering
  const documents = messages.filter(
    (m) =>
      m.msg_type === 'document' ||
      m.msg_type === 'file' ||
      (m.file_name && !m.media_data?.startsWith('data:image/')) ||
      (m.content && m.content.startsWith('red_vault://file'))
  );
  assert.strictEqual(documents.length, 1);

  // 3. Voice notes filtering
  const voiceNotes = messages.filter(
    (m) =>
      m.msg_type === 'voice' ||
      m.msg_type === 'audio' ||
      (m.media_data && m.media_data.startsWith('data:audio/')) ||
      (m.content && (m.content.startsWith('red_vault://audio') || m.content.startsWith('data:audio/')))
  );
  assert.strictEqual(voiceNotes.length, 1);

  // 4. Links and locations filtering
  const linksAndLocations = messages.filter((m) => {
    if (m.msg_type === 'location') return true;
    const c = m.content || '';
    if (typeof c === 'string' && (c.includes('http://') || c.includes('https://') || c.includes('geo:'))) return true;
    if (typeof c === 'string' && c.startsWith('{') && (c.includes('"lat"') || c.includes('"latitude"'))) return true;
    return false;
  });
  assert.strictEqual(linksAndLocations.length, 2);

  // 5. Location parser
  const parseLocationCoords = (m) => {
    if (typeof m.latitude === 'number' && typeof m.longitude === 'number') {
      return { lat: m.latitude, lon: m.longitude };
    }
    if (typeof m.lat === 'number' && typeof m.lon === 'number') {
      return { lat: m.lat, lon: m.lon };
    }
    if (typeof m.content === 'string') {
      if (m.content.startsWith('{')) {
        try {
          const parsed = JSON.parse(m.content);
          const lat = parsed.lat ?? parsed.latitude;
          const lon = parsed.lon ?? parsed.longitude ?? parsed.lng;
          if (typeof lat === 'number' && typeof lon === 'number') return { lat, lon };
        } catch {}
      }
      const match = m.content.match(/([-\d.]+)\s*,\s*([-\d.]+)/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        if (isFinite(lat) && isFinite(lon)) return { lat, lon };
      }
    }
    return null;
  };

  const parsedLoc = parseLocationCoords(messages[4]);
  assert(parsedLoc, 'Location must be parsed');
  assert.strictEqual(parsedLoc.lat, 19.4326);
  assert.strictEqual(parsedLoc.lon, -99.1332);

  const parsedTextLink = parseLocationCoords(messages[5]);
  assert.strictEqual(parsedTextLink, null);

  console.log('[SUCCESS] All ContactProfileModal media & location tests passed cleanly!');
}

testContactProfileMedia();
