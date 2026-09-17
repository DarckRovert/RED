// ─── RED SOVEREIGN BASE STATION — TACTICAL CLIENT ENGINE (v106.0.0) ─────────
const API = ''; // Mismo origen loopback/LAN servido por red-node.exe
let currentView = 'qr-pairing';
let currentConv = null;
let myIdentity = null;
let eventSource = null;
let detectedLanIp = '127.0.0.1';
let currentRelayUrl = 'ws://127.0.0.1:7331/relay/ws';

// ─── INICIALIZACIÓN ──────────────────────────────────────────────────────────
async function init() {
  try {
    await loadIdentity();
    await refreshLanEndpoints();
    await loadStatus();
    await loadRelayStats();
    await loadLoraStatus();
    connectSSE();

    // Iniciar temporizador de telemetría periódica (cada 4 segundos)
    setInterval(() => {
      loadStatus();
      loadRelayStats();
      if (currentView === 'lora') {
        loadLoraStatus();
      }
    }, 4000);

    // Ocultar pantalla de carga
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    appendLog('[INIT] Consola Táctica de Estación Base inicializada con éxito.', 'sys');
  } catch (err) {
    console.error('[INIT] Error al inicializar:', err);
    document.querySelector('.loading-sub').textContent = '⚠️ Error al enlazar con el nodo. Verifique si red-node.exe está en ejecución.';
    appendLog(`[ERROR] Inicialización fallida: ${err.message}`, 'err');
  }
}

// ─── IDENTIDAD SOBERANA ──────────────────────────────────────────────────────
async function loadIdentity() {
  try {
    const res = await fetch(`${API}/api/identity`);
    if (!res.ok) throw new Error('No se pudo obtener la identidad');
    const data = await res.json();
    myIdentity = data.identity_hash;
    document.getElementById('identity-hash').textContent = `did:red:${data.identity_hash}`;
    document.getElementById('identity-short').textContent = `ID Corta: ${data.short_id || data.identity_hash.slice(0, 16)}`;
  } catch (e) {
    document.getElementById('identity-hash').textContent = 'Identidad local no disponible';
  }
}

function copyIdentity() {
  if (!myIdentity) return;
  navigator.clipboard.writeText(`did:red:${myIdentity}`).then(() => {
    toast('✅ DID Soberano copiado al portapapeles');
  });
}

// ─── DETECCIÓN LAN & CÓDIGO QR ──────────────────────────────────────────────
async function refreshLanEndpoints() {
  try {
    const res = await fetch(`${API}/api/network/lan-endpoints`);
    if (res.ok) {
      const data = await res.json();
      detectedLanIp = data.primary_lan_ip || window.location.hostname || '127.0.0.1';
      currentRelayUrl = data.relay_ws_url || `ws://${detectedLanIp}:7331/relay/ws`;
      
      document.getElementById('input-relay-url').value = currentRelayUrl;
      document.getElementById('input-web-url').value = data.web_dashboard_url || `http://${detectedLanIp}:7333`;
      document.getElementById('sb-lan-ip').textContent = detectedLanIp;
      
      appendLog(`[LAN] IP local detectada: ${detectedLanIp} (Relé: :7331, Web: :7333)`, 'sys');
    }
  } catch (e) {
    // Si la API LAN falla, inferir del host actual
    const host = window.location.hostname || '127.0.0.1';
    detectedLanIp = host;
    currentRelayUrl = `ws://${host}:7331/relay/ws`;
    document.getElementById('input-relay-url').value = currentRelayUrl;
    document.getElementById('input-web-url').value = `http://${host}:7333`;
    document.getElementById('sb-lan-ip').textContent = host;
  }

  // Renderizar el código QR para el teléfono
  renderQrCode(currentRelayUrl);
}

function renderQrCode(text) {
  const canvas = document.getElementById('qr-code-canvas');
  if (!canvas) return;

  if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
    window.QRCode.toCanvas(canvas, text, {
      width: 220,
      margin: 2,
      color: {
        dark: '#080b11',
        light: '#ffffff'
      }
    }, (err) => {
      if (err) {
        console.error('[QR] Error renderizando canvas:', err);
        fallbackDrawQr(canvas, text);
      }
    });
  } else {
    fallbackDrawQr(canvas, text);
  }
}

function fallbackDrawQr(canvas, text) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#080b11';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RED SOVEREIGN QR', canvas.width / 2, 40);
  ctx.font = '10px monospace';
  ctx.fillText(text.slice(0, 24), canvas.width / 2, canvas.height / 2);
  ctx.fillText(text.slice(24), canvas.width / 2, canvas.height / 2 + 18);
  ctx.fillText('Escanea en App Móvil', canvas.width / 2, canvas.height - 30);
}

function copyInput(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => {
    toast('📋 URL copiada al portapapeles');
  });
}

// ─── TELEMETRÍA Y ESTADO ────────────────────────────────────────────────────
async function loadStatus() {
  try {
    const res = await fetch(`${API}/api/status`);
    if (!res.ok) return;
    const data = await res.json();

    const pill = document.getElementById('global-status-pill');
    const txt = document.getElementById('global-status-text');
    if (data.is_running) {
      pill.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      pill.style.color = '#10b981';
      txt.textContent = 'ONLINE';
    } else {
      pill.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      pill.style.color = '#ef4444';
      txt.textContent = 'OFFLINE';
    }

    if (document.getElementById('stat-peers')) {
      document.getElementById('stat-peers').textContent = data.peer_count || 0;
    }
  } catch (e) {}
}

async function loadRelayStats() {
  try {
    const res = await fetch(`${API}/relay/stats`);
    if (res.ok) {
      const stats = await res.json();
      if (document.getElementById('stat-routed')) {
        document.getElementById('stat-routed').textContent = stats.total_messages_routed || 0;
      }
      if (document.getElementById('stat-uptime')) {
        const s = stats.uptime_seconds || 0;
        const mins = Math.floor(s / 60);
        const hrs = Math.floor(mins / 60);
        document.getElementById('stat-uptime').textContent = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m ${s % 60}s`;
      }
    }
  } catch (e) {}
}

// ─── CONEXIÓN STREAM SSE ────────────────────────────────────────────────────
function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`${API}/api/events`);

  eventSource.addEventListener('open', () => {
    appendLog('[SSE] Canal de eventos en tiempo real establecido (/api/events)', 'sys');
  });

  eventSource.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      appendLog(`[MSG RX] De: ${msg.from?.slice(0, 12)}... | Tipo: ${msg.content_type || 'Text'}`, 'relay');
      
      // Si estamos en la conversación activa, añadir burbuja
      if (currentConv && (currentConv === msg.from || currentConv === msg.sender)) {
        appendBubble(msg.content, false, msg.timestamp);
      }
    } catch (err) {
      appendLog(`[EVENT] ${e.data}`, 'sys');
    }
  });

  eventSource.onerror = () => {
    appendLog('[SSE] Desconexión temporal del bus. Reconectando en 4s...', 'warn');
    setTimeout(connectSSE, 4000);
  };
}

// ─── LOGS Y TERMINAL ────────────────────────────────────────────────────────
function appendLog(text, type = 'sys') {
  const terminal = document.getElementById('terminal-logs');
  if (!terminal) return;
  const now = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${now}] ${text}`;
  terminal.appendChild(entry);
  terminal.scrollTop = terminal.scrollHeight;
}

function clearLogs() {
  const terminal = document.getElementById('terminal-logs');
  if (terminal) terminal.innerHTML = '';
}

// ─── CAMBIO DE VISTAS ───────────────────────────────────────────────────────
function setView(view) {
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-${view}`);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
  const activeSec = document.getElementById(`view-${view}`);
  if (activeSec) activeSec.classList.add('active');

  const listPanel = document.getElementById('list-panel');
  if (view === 'conversations') {
    listPanel.classList.remove('hidden');
    loadConversationsList();
  } else {
    listPanel.classList.add('hidden');
  }

  if (view === 'qr-pairing') {
    refreshLanEndpoints();
  }
  if (view === 'lora') {
    loadLoraStatus();
  }
}

// ─── MENSAJERÍA Y CHAT ──────────────────────────────────────────────────────
async function loadConversationsList() {
  const container = document.getElementById('list-items');
  try {
    const res = await fetch(`${API}/api/conversations`);
    if (!res.ok) return;
    const convs = await res.json();
    if (!Array.isArray(convs) || convs.length === 0) {
      container.innerHTML = '<div class="empty-state">Sin conversaciones registradas</div>';
      return;
    }
    container.innerHTML = convs.map(c => `
      <div class="conv-item ${currentConv === c.peer_id ? 'active' : ''}" onclick="selectConversation('${c.peer_id}')">
        <div class="conv-title">${c.peer_name || c.peer_id.slice(0, 16)}...</div>
        <div class="conv-last">${c.last_message || 'Canal seguro establecido'}</div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state">No se pudieron cargar conversaciones</div>';
  }
}

function selectConversation(peerId) {
  currentConv = peerId;
  document.getElementById('chat-title').textContent = `did:red:${peerId.slice(0, 16)}...`;
  document.getElementById('chat-subtitle').textContent = 'Canal E2EE Doble Trinquete activo';
  loadMessages(peerId);
}

async function loadMessages(peerId) {
  const area = document.getElementById('messages-area');
  try {
    const res = await fetch(`${API}/api/conversations/${peerId}/messages`);
    if (res.ok) {
      const msgs = await res.json();
      area.innerHTML = '';
      if (Array.isArray(msgs)) {
        msgs.forEach(m => appendBubble(m.content, m.is_mine !== undefined ? m.is_mine : (m.sender === myIdentity), m.timestamp));
      }
    }
  } catch (e) {}
}

function appendBubble(content, isMine, timestamp) {
  const area = document.getElementById('messages-area');
  const bubble = document.createElement('div');
  bubble.style.maxWidth = '70%';
  bubble.style.alignSelf = isMine ? 'flex-end' : 'flex-start';
  bubble.style.padding = '10px 14px';
  bubble.style.borderRadius = '10px';
  bubble.style.fontSize = '0.82rem';
  bubble.style.lineHeight = '1.4';
  bubble.style.background = isMine ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)';
  bubble.style.border = isMine ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)';
  bubble.style.color = '#fff';
  bubble.textContent = typeof content === 'string' ? content : JSON.stringify(content);
  area.appendChild(bubble);
  area.scrollTop = area.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  if (!currentConv) {
    toast('⚠️ Selecciona o inicia una conversación primero');
    return;
  }

  try {
    const res = await fetch(`${API}/api/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: currentConv,
        content: text
      })
    });
    if (res.ok) {
      appendBubble(text, true, Date.now());
      input.value = '';
    } else {
      toast('❌ Error al enviar mensaje');
    }
  } catch (e) {
    toast('❌ Fallo de conexión');
  }
}

// ─── MODAL NUEVA CONVERSACIÓN ───────────────────────────────────────────────
function showNewConversation() {
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

async function startConversation() {
  const recipient = document.getElementById('modal-recipient').value.trim();
  const firstMsg = document.getElementById('modal-first-msg').value.trim();
  if (!recipient) {
    toast('⚠️ Ingresa el DID del destinatario');
    return;
  }

  currentConv = recipient.replace(/^did:red:/i, '');
  closeModal();
  setView('conversations');
  selectConversation(currentConv);

  if (firstMsg) {
    document.getElementById('msg-input').value = firstMsg;
    sendMessage();
  }
}

// ─── TOAST NOTIFICATION ─────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}

// ─── LORA PLUG & PLAY HARDWARE ───────────────────────────────────────────────
async function loadLoraStatus(showToast = false) {
  try {
    const res = await fetch(`${API}/api/hardware/lora/ports`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const badge = document.getElementById('lora-status-badge');
    const portEl = document.getElementById('lora-port');
    const chipEl = document.getElementById('lora-chip');
    const baudEl = document.getElementById('lora-baud');
    const vidPidEl = document.getElementById('lora-vid-pid');
    const totalEl = document.getElementById('lora-total-ports');
    const listEl = document.getElementById('lora-ports-list');

    if (totalEl) totalEl.textContent = data.total_ports || 0;

    if (data.primary_device && data.primary_device.is_lora_transceiver) {
      const dev = data.primary_device;
      if (badge) {
        badge.className = 'badge-green';
        badge.textContent = `🟢 ENLACE ACTIVO: ${dev.port_name}`;
        badge.style.background = 'rgba(16, 185, 129, 0.2)';
        badge.style.color = '#10b981';
        badge.style.border = '1px solid rgba(16, 185, 129, 0.5)';
      }
      if (portEl) portEl.textContent = dev.port_name;
      if (chipEl) chipEl.textContent = dev.chip_name;
      if (baudEl) baudEl.textContent = `${dev.recommended_baud.toLocaleString()} bps`;
      if (vidPidEl) {
        vidPidEl.textContent = dev.vid_hex && dev.pid_hex ? `${dev.vid_hex}:${dev.pid_hex}` : 'USB Nativo';
      }
    } else {
      if (badge) {
        badge.className = 'badge-amber';
        badge.textContent = '🟡 STANDBY (Esperando transceptor USB)';
        badge.style.background = 'rgba(245, 158, 11, 0.15)';
        badge.style.color = '#f59e0b';
        badge.style.border = '1px solid rgba(245, 158, 11, 0.4)';
      }
      if (portEl) portEl.textContent = 'No conectado';
      if (chipEl) chipEl.textContent = 'Ningún módem LoRa detectado';
      if (vidPidEl) vidPidEl.textContent = '--';
    }

    // Renderizar lista de puertos detectados
    if (listEl) {
      if (!data.devices || data.devices.length === 0) {
        listEl.innerHTML = `
          <div style="padding: 10px 14px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; color: var(--text-dim); font-size: 0.8rem;">
            No se detectaron puertos seriales USB conectados al host. Conecta tu LilyGO T-Beam o Heltec LoRa 32 por cable de datos.
          </div>`;
      } else {
        listEl.innerHTML = data.devices.map(d => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: ${d.is_lora_transceiver ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${d.is_lora_transceiver ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 8px; font-size: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 700; color: ${d.is_lora_transceiver ? '#10b981' : 'var(--text-main)'}; font-family: monospace;">${d.port_name}</span>
              <span style="color: var(--text-dim); font-size: 0.75rem;">${d.chip_name}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${d.vid_hex ? `${d.vid_hex}:${d.pid_hex}` : 'N/A'}</span>
              <span style="padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; ${d.is_lora_transceiver ? 'background: rgba(16,185,129,0.2); color: #10b981;' : 'background: rgba(255,255,255,0.06); color: var(--text-muted);'}">
                ${d.is_lora_transceiver ? 'LORA IDENTIFICADO' : 'GENÉRICO'}
              </span>
            </div>
          </div>
        `).join('');
      }
    }

    if (showToast) {
      if (data.primary_device && data.primary_device.is_lora_transceiver) {
        toast(`📻 LoRa detectado en ${data.primary_device.port_name}: ${data.primary_device.chip_name}`);
      } else {
        toast(`🔍 Escaneo completado: ${data.total_ports} puerto(s) hallado(s)`);
      }
    }
  } catch (err) {
    console.error('[LORA PnP] Error escaneando hardware:', err);
    if (showToast) toast('⚠️ Error al consultar puertos LoRa USB');
  }
}

async function scanLoraHardware() {
  appendLog('[LORA] Ejecutando escaneo manual de transceptores USB...', 'sys');
  await loadLoraStatus(true);
}

window.loadLoraStatus = loadLoraStatus;
window.scanLoraHardware = scanLoraHardware;

// ─── MODAL LEGAL, PRIVACIDAD & LICENCIA ─────────────────────────────────────
function openLegalModal(tab = 'privacy') {
  const overlay = document.getElementById('legal-modal-overlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    switchLegalTab(tab);
  }
}

function closeLegalModal() {
  const overlay = document.getElementById('legal-modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

function switchLegalTab(tabName) {
  const tabs = ['privacy', 'terms', 'license'];
  tabs.forEach(t => {
    const btn = document.getElementById(`legal-tab-btn-${t}`);
    const pane = document.getElementById(`legal-pane-${t}`);
    if (btn) btn.classList.toggle('active', t === tabName);
    if (pane) pane.classList.toggle('hidden', t !== tabName);
  });
}

window.openLegalModal = openLegalModal;
window.closeLegalModal = closeLegalModal;
window.switchLegalTab = switchLegalTab;

// ─── ARRANQUE AL CARGAR DOM ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
