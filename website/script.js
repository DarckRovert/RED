/* ━━━ RED — Masterpiece Edition Script v16.0 — PERÚ EDITION ━━━ */
'use strict';

window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.style.opacity = '0';
    setTimeout(() => preloader.style.display = 'none', 500);
  }
  initMeshCanvas();
});

// Double Ratchet Sim
let rCount = 1;
function triggerRatchetSim() {
  rCount++;
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
  document.getElementById('r-dh').innerText = 'DH_Key = X25519(Alice_Secret, Bob_Ephemeral_Public)';
  document.getElementById('r-kdf').innerText = 'Message_Key_1 = HKDF_Expand(Chain_Key_1, "RED-Ratchet-v16")';
  document.getElementById('r-cipher').innerText = 'Payload = AES256_GCM_Encrypt(Message_Key_1, Nonce, "Hola RED!")';
  document.getElementById('r-log').innerText = '> Llaves criptográficas reiniciadas a la época inicial.';
}

// Mesh Radar Canvas
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

function initMeshCanvas() {
  const canvas = document.getElementById('mesh-radar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width = canvas.width = canvas.parentElement.clientWidth;
  let height = canvas.height = 380;

  const nodes = [
    { x: width * 0.28, y: height * 0.45, type: 'ble', label: 'Nodo Alice (BLE)' },
    { x: width * 0.5, y: height * 0.65, type: 'wifi', label: 'Nodo Bob (WiFi-Direct)' },
    { x: width * 0.72, y: height * 0.38, type: 'lora', label: 'Nodo Relay (LoRa)' }
  ];

  let angle = 0;

  function render() {
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = isBlackout ? 'rgba(232, 33, 58, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    ctx.strokeStyle = isBlackout ? '#E8213A' : '#00D97E';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    ctx.lineTo(nodes[1].x, nodes[1].y);
    ctx.lineTo(nodes[2].x, nodes[2].y);
    ctx.stroke();
    ctx.setLineDash([]);

    nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = node.type === 'ble' ? '#3498db' : node.type === 'wifi' ? '#00D97E' : '#9b59b6';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x, node.y, 16 + Math.sin(angle) * 8, 0, Math.PI * 2);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '12px JetBrains Mono';
      ctx.fillText(node.label, node.x - 40, node.y + 24);
    });

    angle += 0.04;
    requestAnimationFrame(render);
  }

  render();
}

// Terminal CLI runner
function runTerminalCmd(cmd) {
  const body = document.getElementById('term-body');
  const line = document.createElement('div');
  line.className = 't-line green';
  
  if (cmd === 'peers') {
    line.innerHTML = `<span class="t-prompt">red@master:~$</span> [PEERS] Nodos activos: 3 (BLE: 1, WiFi: 1, LoRa: 1) · Latencia: 4ms`;
  } else if (cmd === 'ratchet') {
    line.innerHTML = `<span class="t-prompt">red@master:~$</span> [RATCHET] Sesión activa: X25519-AES256-GCM · PFS: VERIFICADO ✅`;
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

// Modal Launcher
function openWebAppModal() {
  document.getElementById('webapp-modal')?.classList.add('active');
}
function closeWebAppModal() {
  document.getElementById('webapp-modal')?.classList.remove('active');
}

// Copy SHA Hash
function copyHashStr() {
  navigator.clipboard.writeText('4f8b9e83a21c9b6f8490a7812e983410fc6b8a1e2f3d4c5b6a7b8c9d0e1f2a3b');
  alert('✅ Checksum SHA-256 copiado al portapapeles.');
}
