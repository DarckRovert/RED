// RED Web UI — Single Page Application
// Connects to the local node REST API on http://localhost:7333

const API = '';  // Same origin (served by the node)
let currentView = 'conversations';
let currentConv  = null;
let myIdentity   = null;
let eventSource  = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    await loadIdentity();
    await loadStatus();
    connectSSE();
    await refreshCurrentView();
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  } catch (err) {
    document.querySelector('.loading-sub').textContent = '⚠ No se pudo conectar al nodo. ¿Está ejecutándose?';
    document.querySelector('.loading-spinner').style.borderTopColor = '#ff2a2a';
    console.error('Init failed:', err);
  }
}

// ─── Identity ────────────────────────────────────────────────────────────────

async function loadIdentity() {
  const res = await fetch(`${API}/api/identity`);
  if (!res.ok) throw new Error('identity failed');
  const data = await res.json();
  myIdentity = data.identity_hash;
  document.getElementById('identity-hash').textContent = data.identity_hash;
  document.getElementById('identity-short').textContent = `ID corta: ${data.short_id}`;
}

function copyIdentity() {
  if (!myIdentity) return;
  navigator.clipboard.writeText(myIdentity).then(() => toast('Identity hash copiado', 'success'));
}

// ─── Status ──────────────────────────────────────────────────────────────────

async function loadStatus() {
  const res = await fetch(`${API}/api/status`);
  if (!res.ok) return;
  const data = await res.json();
  const dot = document.getElementById('status-dot');
  dot.classList.toggle('offline', !data.is_running);
  dot.title = data.is_running ? 'Nodo activo' : 'Nodo inactivo';
  // Update status view if visible
  const run = document.getElementById('st-running');
  if (run) {
    run.textContent = data.is_running ? '✓ Activo' : '✗ Inactivo';
    document.getElementById('st-peers').textContent   = data.peer_count;
    document.getElementById('st-version').textContent = data.version;
  }
}

// ─── SSE ─────────────────────────────────────────────────────────────────────

function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`${API}/api/events`);

  eventSource.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      // If we are in the conversation with this sender, append immediately
      if (currentConv && currentConv.includes(msg.from)) {
        appendBubble(msg.content, false, msg.timestamp);
      }
      // Always refresh the conversation list badge
      if (currentView === 'conversations') loadConversationsList();
      toast(`Mensaje de ${msg.from}`, 'success');
    } catch {}
  });

  eventSource.onerror = () => {
    console.warn('SSE disconnected, retrying in 3s...');
    setTimeout(connectSSE, 3000);
  };
}

// ─── View Switching ──────────────────────────────────────────────────────────

function setView(view) {
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-${view === 'conversations' ? 'conversations' : view}`).classList.add('active');

  const listHeader = document.getElementById('list-header');
  const addBtn     = document.getElementById('add-btn');

  if (view === 'conversations') {
    listHeader.querySelector('span').textContent = 'Mensajes';
    addBtn.onclick = showNewConversation;
    addBtn.style.display = '';
    showMainView('chat');
    loadConversationsList();
  } else if (view === 'contacts') {
    listHeader.querySelector('span').textContent = 'Contactos';
    addBtn.style.display = 'none';
    showMainView('contacts');
    loadContactsView();
    loadContactsList();
  } else if (view === 'groups') {
    listHeader.querySelector('span').textContent = 'Grupos';
    addBtn.onclick = () => { document.getElementById('new-group-name').focus(); };
    addBtn.style.display = '';
    showMainView('groups');
    loadGroupsView();
    loadGroupsList();
  } else if (view === 'status') {
    listHeader.querySelector('span').textContent = 'Estado';
    addBtn.style.display = 'none';
    showMainView('status');
    loadStatus();
    // Refresh every 5s while visible
    clearInterval(window._statusTimer);
    window._statusTimer = setInterval(() => { if (currentView === 'status') loadStatus(); }, 5000);
  }
}

function showMainView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`view-${name}`);
  if (el) el.classList.add('active');
}

async function refreshCurrentView() {
  setView(currentView);
}

// ─── Conversations ────────────────────────────────────────────────────────────

async function loadConversationsList() {
  const res = await fetch(`${API}/api/conversations`);
  const list = document.getElementById('list-items');
  if (!res.ok) { list.innerHTML = '<div class="empty-state">Error cargando conversaciones</div>'; return; }
  const convs = await res.json();
  if (!convs.length) { list.innerHTML = '<div class="empty-state">Sin conversaciones todavía.<br>Presiona + para empezar.</div>'; return; }

  list.innerHTML = convs.map(c => `
    <div class="item-card ${currentConv === c.id ? 'active' : ''}" onclick="openConversation('${c.id}', '${c.peer}')">
      <div class="item-avatar">💬</div>
      <div class="item-info">
        <div class="item-name">${c.peer.slice(0, 16)}…</div>
        <div class="item-sub">${c.last_message ? escapeHtml(c.last_message.slice(0, 40)) : 'Sin mensajes'}</div>
      </div>
    </div>
  `).join('');
}

async function openConversation(id, peer) {
  currentConv = id;
  document.querySelectorAll('.item-card').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');

  const header = document.getElementById('chat-header');
  header.className = 'chat-header has-chat';
  header.innerHTML = `
    <div class="item-avatar" style="font-size:14px;background:rgba(255,42,42,0.15);">💬</div>
    <div>
      <div class="chat-peer-name">${peer.slice(0, 16)}…</div>
      <div class="chat-peer-hash">${peer}</div>
    </div>
  `;

  document.getElementById('input-area').style.display = 'flex';
  document.getElementById('messages-area').innerHTML = '<div class="empty-state">Cargando mensajes…</div>';

  const res = await fetch(`${API}/api/conversations/${id}/messages`);
  if (!res.ok) {
    document.getElementById('messages-area').innerHTML = '<div class="empty-state">Error cargando mensajes</div>';
    return;
  }
  const msgs = await res.json();
  const area = document.getElementById('messages-area');
  area.innerHTML = '';
  msgs.forEach(m => appendBubble(m.content, m.is_mine, m.timestamp));
  area.scrollTop = area.scrollHeight;

  // Store peer for sending
  document.getElementById('msg-input').dataset.peer = peer;
  document.getElementById('msg-input').focus();
  document.getElementById('msg-input').onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const content = input.value.trim();
  const peer    = input.dataset.peer;
  if (!content || !peer) return;

  input.value = '';

  const res = await fetch(`${API}/api/messages/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: peer, content }),
  });

  if (res.ok) {
    appendBubble(content, true, Date.now() / 1000);
    const area = document.getElementById('messages-area');
    area.scrollTop = area.scrollHeight;
  } else {
    const err = await res.json();
    toast(`Error: ${err.error}`, 'error');
  }
}

function appendBubble(content, isMine, timestamp) {
  const area = document.getElementById('messages-area');
  const time = new Date(timestamp * 1000).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = `msg-bubble ${isMine ? 'mine' : 'theirs'}`;
  div.innerHTML = `${escapeHtml(content)}<div class="msg-meta">${time}</div>`;
  area.appendChild(div);
}

// ─── New Conversation Modal ───────────────────────────────────────────────────

function showNewConversation() {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-recipient').focus();
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-recipient').value = '';
  document.getElementById('modal-first-msg').value = '';
}

async function startConversation() {
  const recipient = document.getElementById('modal-recipient').value.trim();
  const firstMsg  = document.getElementById('modal-first-msg').value.trim();
  if (!recipient || !firstMsg) { toast('Rellena todos los campos', 'error'); return; }

  const res = await fetch(`${API}/api/messages/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, content: firstMsg }),
  });

  if (res.ok) {
    closeModal();
    toast('Mensaje enviado', 'success');
    await loadConversationsList();
  } else {
    const err = await res.json();
    toast(`Error: ${err.error}`, 'error');
  }
}

// ─── Contacts ────────────────────────────────────────────────────────────────

async function loadContactsView() {
  const res = await fetch(`${API}/api/contacts`);
  const list = document.getElementById('contacts-list');
  if (!res.ok) { list.innerHTML = '<div class="empty-state">Error cargando contactos</div>'; return; }
  const contacts = await res.json();
  if (!contacts.length) { list.innerHTML = '<div class="empty-state">Sin contactos todavía</div>'; return; }

  list.innerHTML = contacts.map(c => `
    <div class="contact-card">
      <div class="item-avatar">👤</div>
      <div class="item-info">
        <div class="item-name">${escapeHtml(c.display_name)}</div>
        <div class="item-sub">${c.identity_hash.slice(0, 32)}…</div>
      </div>
      <div class="contact-actions">
        <button class="chat-with-btn" onclick="startChatWith('${c.identity_hash}')">💬 Chat</button>
      </div>
    </div>
  `).join('');
}

async function loadContactsList() {
  const res = await fetch(`${API}/api/contacts`);
  const list = document.getElementById('list-items');
  if (!res.ok) { list.innerHTML = '<div class="empty-state">Error</div>'; return; }
  const contacts = await res.json();
  if (!contacts.length) { list.innerHTML = '<div class="empty-state">Sin contactos</div>'; return; }

  list.innerHTML = contacts.map(c => `
    <div class="item-card" onclick="startChatWith('${c.identity_hash}')">
      <div class="item-avatar">👤</div>
      <div class="item-info">
        <div class="item-name">${escapeHtml(c.display_name)}</div>
        <div class="item-sub">${c.identity_hash.slice(0, 20)}…</div>
      </div>
    </div>
  `).join('');
}

async function addContact() {
  const hash = document.getElementById('new-contact-hash').value.trim();
  const name = document.getElementById('new-contact-name').value.trim();
  if (!hash || !name) { toast('Rellena todos los campos', 'error'); return; }

  const res = await fetch(`${API}/api/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity_hash: hash, display_name: name }),
  });

  if (res.ok) {
    document.getElementById('new-contact-hash').value = '';
    document.getElementById('new-contact-name').value = '';
    toast('Contacto añadido', 'success');
    loadContactsView();
  } else {
    const err = await res.json();
    toast(`Error: ${err.error}`, 'error');
  }
}

function startChatWith(hash) {
  setView('conversations');
  showNewConversation();
  document.getElementById('modal-recipient').value = hash;
}

// ─── Groups ──────────────────────────────────────────────────────────────────

async function loadGroupsView() {
  const res = await fetch(`${API}/api/groups`);
  const list = document.getElementById('groups-list');
  if (!res.ok) { list.innerHTML = '<div class="empty-state">Error cargando grupos</div>'; return; }
  const groups = await res.json();
  if (!groups.length) { list.innerHTML = '<div class="empty-state">Sin grupos todavía</div>'; return; }

  list.innerHTML = groups.map(g => `
    <div class="group-card">
      <div class="item-avatar">🔒</div>
      <div class="item-info">
        <div class="item-name">${escapeHtml(g.name)}</div>
        <div class="item-sub">${g.member_count} miembro${g.member_count !== 1 ? 's' : ''}</div>
      </div>
    </div>
  `).join('');
}

async function loadGroupsList() {
  const res = await fetch(`${API}/api/groups`);
  const list = document.getElementById('list-items');
  if (!res.ok) { list.innerHTML = '<div class="empty-state">Error</div>'; return; }
  const groups = await res.json();
  if (!groups.length) { list.innerHTML = '<div class="empty-state">Sin grupos</div>'; return; }

  list.innerHTML = groups.map(g => `
    <div class="item-card">
      <div class="item-avatar">🔒</div>
      <div class="item-info">
        <div class="item-name">${escapeHtml(g.name)}</div>
        <div class="item-sub">${g.member_count} miembros</div>
      </div>
    </div>
  `).join('');
}

async function createGroup() {
  const name = document.getElementById('new-group-name').value.trim();
  if (!name) { toast('Escribe un nombre', 'error'); return; }

  const res = await fetch(`${API}/api/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (res.ok) {
    document.getElementById('new-group-name').value = '';
    toast('Grupo creado', 'success');
    loadGroupsView();
    loadGroupsList();
  } else {
    const err = await res.json();
    toast(`Error: ${err.error}`, 'error');
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

let _toastTimer = null;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', init);
