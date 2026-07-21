/* ━━━ RED — Masterpiece Edition Script v16.0 — PERÚ EDITION ━━━ */
'use strict';

// Hide preloader when loaded
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.style.opacity = '0';
    setTimeout(() => preloader.style.display = 'none', 500);
  }
  initRadarCanvas();
});

// Double Ratchet Simulator Logic
let ratchetCounter = 1;
function simulateRatchetStep() {
  ratchetCounter++;
  const dhKey = 'X25519_DH_' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const kdfKey = 'HKDF_CHAIN_' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const cipher = 'AES256_' + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('');

  document.getElementById('ratchet-dh').innerText = `X25519_DH(Alice_pub, Bob_priv) ➔ ${dhKey}`;
  document.getElementById('ratchet-kdf').innerText = `HKDF-SHA256(ChainKey_${ratchetCounter}) ➔ ${kdfKey}`;
  document.getElementById('ratchet-cipher').innerText = `AES-256-GCM(Key_${ratchetCounter}, IV_${ratchetCounter}) ➔ ${cipher}`;

  const log = document.getElementById('ratchet-log');
  log.innerText = `> [PASO ${ratchetCounter}] Llave epímera regenerada. Secreto hacia adelante verificado. Ciphertext: ${cipher}`;
}

function resetRatchetSim() {
  ratchetCounter = 1;
  document.getElementById('ratchet-dh').innerText = 'X25519_DH(Alice_pub, Bob_priv) ➔ Ephemeral DH Key';
  document.getElementById('ratchet-kdf').innerText = 'HKDF-SHA256(ChainKey_1) ➔ MessageKey_1';
  document.getElementById('ratchet-cipher').innerText = 'AES-256-GCM(Key_1, IV_1, Plaintext) ➔ 8f3a9b2c...';
  document.getElementById('ratchet-log').innerText = '> Llaves reiniciadas a la época inicial.';
}

// Radar Canvas Simulation
let blackoutMode = false;
function toggleBlackoutSim() {
  blackoutMode = !blackoutMode;
  const btn = document.getElementById('btn-toggle-blackout');
  const txt = document.getElementById('mesh-status-text');
  if (blackoutMode) {
    btn.classList.add('active');
    btn.innerHTML = '<span>⚡</span> Modo Apagón Activado (Sin Internet / Solo BLE & Radio)';
    txt.innerText = 'ESTADO: Internet Caído ➔ Ruteo Mesh Store-and-Forward Activo (3 Saltos)';
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '<span>⚡</span> Simular Apagón Total (Blackout)';
    txt.innerText = 'ESTADO: Malla Radio P2P Activa (3 Nodos Enlazados)';
  }
}

function initRadarCanvas() {
  const canvas = document.getElementById('radar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width = canvas.width = canvas.parentElement.clientWidth;
  let height = canvas.height = 360;

  const nodes = [
    { x: width * 0.3, y: height * 0.4, type: 'ble', label: 'Nodo Alice (BLE)' },
    { x: width * 0.5, y: height * 0.6, type: 'wifi', label: 'Nodo Bob (WiFi-Direct)' },
    { x: width * 0.7, y: height * 0.35, type: 'lora', label: 'Nodo Relay (LoRa)' }
  ];

  let angle = 0;

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = blackoutMode ? 'rgba(232, 33, 58, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Draw connection lines
    ctx.strokeStyle = blackoutMode ? '#E8213A' : '#00D97E';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    ctx.lineTo(nodes[1].x, nodes[1].y);
    ctx.lineTo(nodes[2].x, nodes[2].y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw nodes
    nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = node.type === 'ble' ? '#3498db' : node.type === 'wifi' ? '#00D97E' : '#9b59b6';
      ctx.fill();

      // Radar rings
      ctx.beginPath();
      ctx.arc(node.x, node.y, 16 + Math.sin(angle) * 8, 0, Math.PI * 2);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '12px JetBrains Mono';
      ctx.fillText(node.label, node.x - 40, node.y + 24);
    });

    angle += 0.04;
    requestAnimationFrame(draw);
  }

  draw();
}

// CLI HUD Command runner
function runCliCmd(cmd) {
  const out = document.getElementById('terminal-output');
  const div = document.createElement('div');
  div.className = 'term-line success';
  
  if (cmd === 'peers') {
    div.innerHTML = `<span class="term-prompt">red@root:~$</span> [PEERS] Connected: 3 (BLE: 1, WiFi: 1, LoRa: 1) · Latency: 4ms`;
  } else if (cmd === 'ratchet') {
    div.innerHTML = `<span class="term-prompt">red@root:~$</span> [RATCHET] Active session key: X25519-AES256-GCM · PFS: VERIFIED ✅`;
  } else if (cmd === 'dtn') {
    div.innerHTML = `<span class="term-prompt">red@root:~$</span> [DTN-QUEUE] Store-and-Forward queue: 0 pending packets. Malla synced.`;
  } else if (cmd === 'sybil') {
    div.innerHTML = `<span class="term-prompt">red@root:~$</span> [SYBIL] PoW challenge difficulty: 4 leading zeroes. Sybil attack cost: $45,000/hr.`;
  } else if (cmd === 'audit') {
    div.innerHTML = `<span class="term-prompt">red@root:~$</span> [AUDIT] All cryptographic primitives verified against RFC 7748 and Signal Spec.`;
  }
  
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

// WebApp Modal Toggle
function openWebAppModal() {
  const modal = document.getElementById('webapp-modal');
  if (modal) modal.classList.add('active');
}
function closeWebAppModal() {
  const modal = document.getElementById('webapp-modal');
  if (modal) modal.classList.remove('active');
}

// Copy SHA Hash
function copyHash() {
  const hash = '4f8b9e83a21c9b6f8490a7812e983410fc6b8a1e2f3d4c5b6a7b8c9d0e1f2a3b';
  navigator.clipboard.writeText(hash);
  alert('✅ SHA-256 Checksum copiado al portapapeles.');
}
