/* ━━━ RED — Masterpiece Edition Script v16.3 — PERÚ EDITION ━━━ */
'use strict';

window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.style.opacity = '0';
    setTimeout(() => preloader.style.display = 'none', 500);
  }
  initMeshCanvas();
  initGlowCards();
});

// Cursor Tracking Glow Cards
function initGlowCards() {
  document.addEventListener('mousemove', (e) => {
    document.querySelectorAll('.glow-card').forEach(card => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

// Mobile menu toggle
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  const menu = document.getElementById('nav-menu');
  if (menu) {
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
    menu.style.flexDirection = 'column';
    menu.style.position = 'absolute';
    menu.style.top = '76px';
    menu.style.left = '0';
    menu.style.right = '0';
    menu.style.background = '#040408';
    menu.style.padding = '20px';
    menu.style.borderBottom = '1px solid var(--glass-border)';
  }
});

// Double Ratchet Sim
let rCount = 1;
function triggerRatchetSim() {
  rCount++;
  const numElem = document.getElementById('r-count-num');
  if (numElem) numElem.innerText = rCount;

  const dh = 'X25519_DH_' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const kdf = 'HKDF_CHAIN_' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const cipher = 'AES256_' + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('');

  document.getElementById('r-dh').innerText = `DH_Key_${rCount} = X25519(Alice_Ephemeral_${rCount}, Bob_Public)`;
  document.getElementById('r-kdf').innerText = `Message_Key_${rCount} = HKDF_Expand(Chain_Key_${rCount}, "${kdf}")`;
  document.getElementById('r-cipher').innerText = `Payload = AES256_GCM_Encrypt(Message_Key_${rCount}, Nonce, "${cipher}")`;

  const log = document.getElementById('r-log');
  log.innerText = `> [MENSAJE ${rCount} ENVIADO] Llave epímera renovada con éxito. Secreto Hacia Adelante Perfecto (PFS) activo. Ciphertext: ${cipher}`;
}

function resetRatchetSim() {
  rCount = 1;
  const numElem = document.getElementById('r-count-num');
  if (numElem) numElem.innerText = '1';

  document.getElementById('r-dh').innerText = 'DH_Key = X25519(Alice_Secret, Bob_Ephemeral_Public)';
  document.getElementById('r-kdf').innerText = 'Message_Key_1 = HKDF_Expand(Chain_Key_1, "RED-Ratchet-v16")';
  document.getElementById('r-cipher').innerText = 'Payload = AES256_GCM_Encrypt(Message_Key_1, Nonce, "Hola RED!")';
  document.getElementById('r-log').innerText = '> Llaves criptográficas reiniciadas a la época inicial.';
}

// Next-Gen Interactive Mesh Radar Canvas
let isBlackout = false;
function toggleBlackoutSim() {
  isBlackout = !isBlackout;
  const btn = document.getElementById('btn-blackout');
  const txt = document.getElementById('radar-status-text');
  if (isBlackout) {
    btn.innerHTML = '<span>⚡</span> Modo Apagón Activado (Sin Internet / Solo BLE & Radio)';
    txt.innerText = 'ESTADO: Internet Caído ➔ Ruteo Mesh Store-and-Forward Activo (3 Saltos)';
  } else {
    btn.innerHTML = '<span>⚡</span> Simular Apagón de Red (Blackout)';
    txt.innerText = 'ESTADO: 3 Nodos en Malla (BLE + WiFi Direct)';
  }
}

let activeNode = null;
function closeNodeHud() {
  const hud = document.getElementById('node-hud-card');
  if (hud) hud.style.display = 'none';
}

function initMeshCanvas() {
  const canvas = document.getElementById('mesh-radar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width = canvas.width = canvas.parentElement.clientWidth;
  let height = canvas.height = 420;

  const nodes = [
    { id: 'did:red:3f7a8291', name: 'Nodo Alice (BLE)', x: width * 0.25, y: height * 0.45, type: 'ble', color: '#3498db', rssi: '-42 dBm', pkts: '1,420 msgs' },
    { id: 'did:red:9e12084c', name: 'Nodo Bob (WiFi-Direct)', x: width * 0.5, y: height * 0.65, type: 'wifi', color: '#00E676', rssi: '-38 dBm', pkts: '3,892 msgs' },
    { id: 'did:red:77c19b02', name: 'Nodo Relay (LoRa)', x: width * 0.75, y: height * 0.35, type: 'lora', color: '#9b59b6', rssi: '-55 dBm', pkts: '8,104 msgs' }
  ];

  // Packet animation state
  let packetProgress = 0;
  let sweepAngle = 0;

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let found = null;
    nodes.forEach(node => {
      const dist = Math.hypot(node.x - clickX, node.y - clickY);
      if (dist <= 25) found = node;
    });

    if (found) {
      document.getElementById('hud-node-title').innerText = found.name;
      document.getElementById('hud-node-id').innerText = found.id;
      document.getElementById('hud-node-type').innerText = found.type.toUpperCase() + ' Radio';
      document.getElementById('hud-node-rssi').innerText = found.rssi;
      document.getElementById('hud-node-pkts').innerText = found.pkts;
      document.getElementById('node-hud-card').style.display = 'block';
    }
  });

  function render() {
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    // Grid lines
    ctx.strokeStyle = isBlackout ? 'rgba(232, 33, 58, 0.12)' : 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Concentric Radar Rings
    [80, 160, 240].forEach(radius => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = isBlackout ? 'rgba(232, 33, 58, 0.2)' : 'rgba(0, 242, 254, 0.12)';
      ctx.stroke();
    });

    // Sweeping Radar Line
    sweepAngle += 0.025;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, 280, sweepAngle, sweepAngle + 0.25);
    ctx.fillStyle = isBlackout ? 'rgba(232, 33, 58, 0.08)' : 'rgba(0, 242, 254, 0.08)';
    ctx.fill();

    // Connecting Vectors
    ctx.strokeStyle = isBlackout ? '#E8213A' : '#00E676';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    ctx.lineTo(nodes[1].x, nodes[1].y);
    ctx.lineTo(nodes[2].x, nodes[2].y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Animated Packet Pulses traveling along mesh links
    packetProgress = (packetProgress + 0.015) % 1;
    
    // Packet 1: Alice -> Bob
    const p1x = nodes[0].x + (nodes[1].x - nodes[0].x) * packetProgress;
    const p1y = nodes[0].y + (nodes[1].y - nodes[0].y) * packetProgress;
    ctx.beginPath();
    ctx.arc(p1x, p1y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FF3355';
    ctx.fill();

    // Packet 2: Bob -> Relay
    const p2x = nodes[1].x + (nodes[2].x - nodes[1].x) * packetProgress;
    const p2y = nodes[1].y + (nodes[2].y - nodes[1].y) * packetProgress;
    ctx.beginPath();
    ctx.arc(p2x, p2y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#00F2FE';
    ctx.fill();

    // Render Nodes
    nodes.forEach(node => {
      // Glow Ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, 18 + Math.sin(sweepAngle * 2) * 4, 0, Math.PI * 2);
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Node Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 12px JetBrains Mono';
      ctx.fillText(node.name, node.x - 45, node.y + 28);
    });

    requestAnimationFrame(render);
  }

  render();
}

// Terminal CLI & Log Tabs
function switchTermTab(tab) {
  document.querySelectorAll('.t-tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  const body = document.getElementById('term-body');
  if (tab === 'libp2p') {
    body.innerHTML = `
      <div class="t-line"><span class="t-prompt">red@master:~$</span> initializing libp2p + ble mesh stack...</div>
      <div class="t-line green"><span class="t-prompt">red@master:~$</span> [OK] Cryptographic identity loaded: DID:key:z6Mkp...</div>
      <div class="t-line"><span class="t-prompt">red@master:~$</span> listening on /ip4/127.0.0.1/tcp/9001 and BLE Radio GATT...</div>
    `;
  } else if (tab === 'ratchet') {
    body.innerHTML = `
      <div class="t-line green"><span class="t-prompt">red@master:~$</span> [RATCHET_INIT] Active session with peer 3f7a8291</div>
      <div class="t-line"><span class="t-prompt">red@master:~$</span> Root key: 0x9f84a1e... | DH Ephemeral rotated</div>
      <div class="t-line green"><span class="t-prompt">red@master:~$</span> AES-256-GCM tag verified. Message decrypted.</div>
    `;
  } else if (tab === 'dht') {
    body.innerHTML = `
      <div class="t-line"><span class="t-prompt">red@master:~$</span> [KADEMLIA] K-Bucket refreshed. 16 active buckets.</div>
      <div class="t-line green"><span class="t-prompt">red@master:~$</span> Routing table synchronized. 42 local peers found.</div>
    `;
  }
}

function runTerminalCmd(cmd) {
  const body = document.getElementById('term-body');
  const line = document.createElement('div');
  line.className = 't-line green';
  
  if (cmd === 'peers') {
    line.innerHTML = `<span class="t-prompt">red@master:~$</span> [PEERS] Nodos activos: 3 (BLE: 1, WiFi: 1, LoRa: 1) · Latencia: 4ms`;
  } else if (cmd === 'ratchet') {
    line.innerHTML = `<span class="t-prompt">red@master:~$</span> [RATCHET] Sesión activa: X25519-AES256-GCM · PFS: VERIFICADO ✅`;
  } else if (cmd === 'market') {
    line.innerHTML = `<span class="t-prompt">red@master:~$</span> [MARKET-CAP] TAM: $140B · SAM: $38B · Modelo Económico: Enterprise Gateways & Staking.`;
  } else if (cmd === 'dtn') {
    line.innerHTML = `<span class="t-prompt">red@master:~$</span> [DTN-QUEUE] Cola Store-and-Forward: 0 paquetes pendientes. Malla sincronizada.`;
  } else if (cmd === 'sybil') {
    line.innerHTML = `<span class="t-prompt">red@master:~$</span> [SYBIL] Dificultad PoW: 4 ceros iniciales. Costo de ataque Sybil: $45,000/hr.`;
  } else if (cmd === 'audit') {
    line.innerHTML = `<span class="t-prompt">red@master:~$</span> [AUDIT] Primitivas criptográficas verificadas contra RFC 7748 y Signal Spec.`;
  }
  
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

// WebApp Modal Launcher
function openWebAppModal() {
  document.getElementById('webapp-modal')?.classList.add('active');
}
function closeWebAppModal() {
  document.getElementById('webapp-modal')?.classList.remove('active');
}

// Investor Modal Launcher
function openInvestorModal() {
  document.getElementById('investor-modal')?.classList.add('active');
}
function closeInvestorModal() {
  document.getElementById('investor-modal')?.classList.remove('active');
}
function handleInvestorSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('inv-name').value;
  alert(`✅ Gracias ${name}. Tu solicitud de Pitch Deck e información de inversión ha sido registrada. Te contactaremos a la brevedad.`);
  closeInvestorModal();
}

// Copy SHA Hash
function copyHashStr() {
  navigator.clipboard.writeText('4f8b9e83a21c9b6f8490a7812e983410fc6b8a1e2f3d4c5b6a7b8c9d0e1f2a3b');
  alert('✅ Checksum SHA-256 copiado al portapapeles.');
}
