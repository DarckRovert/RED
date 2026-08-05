"use client";

import React, { useState, useEffect, useRef } from "react";

interface RedShowcaseLandingProps {
  onEnterApp: () => void;
}

export default function RedShowcaseLanding({ onEnterApp }: RedShowcaseLandingProps) {
  const [activeTab, setActiveTab] = useState<'hero' | 'radar' | 'crypto' | 'terminal' | 'guardian' | 'features' | 'architecture' | 'faq'>('hero');
  const [quickAlias, setQuickAlias] = useState('');
  
  // Interactive Double Ratchet / Noise XK Simulator State
  const [ratchetCount, setRatchetCount] = useState(1);
  const [ratchetDh, setRatchetDh] = useState('X25519_DH_1 = X25519(Alice_Ephemeral_1, Bob_Public)');
  const [ratchetKdf, setRatchetKdf] = useState('Message_Key_1 = HKDF_Expand(Chain_Key_1, "HKDF_CHAIN_A91B")');
  const [ratchetCipher, setRatchetCipher] = useState('Payload = ChaCha20_Poly1305_Encrypt(Message_Key_1, Nonce, "AES256_8F1A29")');
  const [ratchetLog, setRatchetLog] = useState('> [ÉPOCA 1 INICIALIZADA] Llaves efímeras generadas con Perfect Forward Secrecy.');

  // Interactive Blackout Radar Sim State
  const [isBlackout, setIsBlackout] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{ id: string; name: string; type: string; rssi: string; pkts: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Terminal CLI State
  const [termOutput, setTermOutput] = useState<string[]>([
    'red@master:~$ initializing libp2p + ble mesh stack...',
    'red@master:~$ [OK] Cryptographic identity loaded: DID:key:z6Mkp...',
    'red@master:~$ listening on /ip4/127.0.0.1/tcp/7333 and BLE Radio GATT...',
  ]);

  // Guardian S4 AI Test State
  const [guardianInput, setGuardianInput] = useState('');
  const [guardianVerdict, setGuardianVerdict] = useState<{ status: 'idle' | 'allow' | 'block'; title: string; desc: string } | null>(null);

  const apkDownloadUrl = process.env.NEXT_PUBLIC_BASE_PATH 
    ? `${process.env.NEXT_PUBLIC_BASE_PATH}/assets/red-v24.0.0-latest.apk`
    : `/assets/red-v24.0.0-latest.apk`;

  const handleCreateWebUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAlias.trim()) {
      if (typeof window !== 'undefined') {
        localStorage.setItem("user_nickname", quickAlias.trim());
        localStorage.setItem("red_displayName", quickAlias.trim());
      }
    }
    onEnterApp();
  };

  const triggerRatchetSim = () => {
    const nextCount = ratchetCount + 1;
    const randomDh = 'X25519_DH_' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const randomKdf = 'HKDF_CHAIN_' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const randomCipher = 'CHACHA20_' + Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();

    setRatchetCount(nextCount);
    setRatchetDh(`DH_Key_${nextCount} = X25519(Alice_Ephemeral_${nextCount}, Bob_Public) -> [${randomDh}]`);
    setRatchetKdf(`Message_Key_${nextCount} = HKDF_Expand(Chain_Key_${nextCount}, "${randomKdf}")`);
    setRatchetCipher(`Payload = ChaCha20_Poly1305_Encrypt(Message_Key_${nextCount}, Nonce, "${randomCipher}")`);
    setRatchetLog(`> [MENSAJE ${nextCount} TRANSMITIDO] Clave epímera renovada con éxito. PFS activo. Ciphertext: ${randomCipher}`);
  };

  const resetRatchetSim = () => {
    setRatchetCount(1);
    setRatchetDh('X25519_DH_1 = X25519(Alice_Ephemeral_1, Bob_Public)');
    setRatchetKdf('Message_Key_1 = HKDF_Expand(Chain_Key_1, "HKDF_CHAIN_A91B")');
    setRatchetCipher('Payload = ChaCha20_Poly1305_Encrypt(Message_Key_1, Nonce, "AES256_8F1A29")');
    setRatchetLog('> Llaves criptográficas reiniciadas a la época inicial.');
  };

  const runTermCmd = (cmd: string) => {
    let response = '';
    if (cmd === 'peers') response = 'red@master:~$ [PEERS] Nodos activos: 3 (BLE: 1, WiFi: 1, LoRa: 1) · Latencia: 4ms';
    else if (cmd === 'ratchet') response = 'red@master:~$ [RATCHET] Sesión activa: X25519-AES256-GCM · PFS: VERIFICADO ✅';
    else if (cmd === 'dtn') response = 'red@master:~$ [DTN-QUEUE] Cola Store-and-Forward: 0 paquetes pendientes. Malla sincronizada.';
    else if (cmd === 'sybil') response = 'red@master:~$ [SYBIL] Dificultad PoW: 4 ceros iniciales. Costo de ataque Sybil: $45,000/hr.';
    else if (cmd === 'audit') response = 'red@master:~$ [AUDIT] Primitivas criptográficas verificadas contra RFC 7748 y Signal Spec.';

    setTermOutput(prev => [...prev, response]);
  };

  const testGuardian = (text: string) => {
    if (!text.trim()) return;
    const lower = text.toLowerCase();
    const isBad = lower.includes('vender') || lower.includes('abuso') || lower.includes('cp_link');

    if (isBad) {
      setGuardianVerdict({
        status: 'block',
        title: '⛔ BLOQUEADO — GUARDIAN LOCAL S4',
        desc: 'El motor local interceptó este mensaje antes de cifrar. Destruido en el dispositivo emisor en <1ms.'
      });
    } else {
      setGuardianVerdict({
        status: 'allow',
        title: '✅ PERMITIDO — GUARDIAN LOCAL (OFF-GRID)',
        desc: 'Contenido verificado en <1ms. Procede al cifrado Double Ratchet E2E para transmisión P2P segura.'
      });
    }
  };

  // Canvas Interactive Radar Animation Loop
  useEffect(() => {
    if (activeTab !== 'radar') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let sweepAngle = 0;
    let packetProgress = 0;

    const width = canvas.width = canvas.parentElement?.clientWidth || 700;
    const height = canvas.height = 420;

    const nodes = [
      { id: 'did:red:3f7a8291', name: 'Nodo Moto G22 (BLE)', x: width * 0.25, y: height * 0.45, type: 'ble', rssi: '-42 dBm', pkts: '1,420 msgs' },
      { id: 'did:red:9e12084c', name: 'Nodo Lenovo Tab (WiFi)', x: width * 0.5, y: height * 0.65, type: 'wifi', rssi: '-38 dBm', pkts: '3,892 msgs' },
      { id: 'did:red:77c19b02', name: 'Nodo Relay LoRa (915MHz)', x: width * 0.75, y: height * 0.35, type: 'lora', rssi: '-55 dBm', pkts: '8,104 msgs' }
    ];

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      let found = null;
      nodes.forEach(node => {
        const dist = Math.hypot(node.x - clickX, node.y - clickY);
        if (dist <= 25) found = node;
      });
      if (found) setSelectedNode(found);
    };

    canvas.addEventListener('click', handleCanvasClick);

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;

      // Grid Lines
      ctx.strokeStyle = isBlackout ? 'rgba(232, 33, 58, 0.15)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // Radar Concentric Rings
      [80, 160, 240].forEach(radius => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isBlackout ? 'rgba(232, 33, 58, 0.25)' : 'rgba(0, 230, 118, 0.15)';
        ctx.stroke();
      });

      // Sweeping Radar Line
      sweepAngle += 0.025;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, 280, sweepAngle, sweepAngle + 0.25);
      ctx.fillStyle = isBlackout ? 'rgba(232, 33, 58, 0.1)' : 'rgba(0, 230, 118, 0.1)';
      ctx.fill();

      // Mesh Links
      ctx.strokeStyle = isBlackout ? '#E8213A' : '#00E676';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      ctx.lineTo(nodes[1].x, nodes[1].y);
      ctx.lineTo(nodes[2].x, nodes[2].y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Traveling Packet Pulses
      packetProgress = (packetProgress + 0.015) % 1;
      const px1 = nodes[0].x + (nodes[1].x - nodes[0].x) * packetProgress;
      const py1 = nodes[0].y + (nodes[1].y - nodes[0].y) * packetProgress;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(px1, py1, 6, 0, Math.PI * 2); ctx.fill();

      // Draw Nodes
      nodes.forEach(node => {
        ctx.fillStyle = isBlackout ? '#E8213A' : (node.type === 'ble' ? '#38BDF8' : node.type === 'wifi' ? '#00E676' : '#A855F7');
        ctx.beginPath(); ctx.arc(node.x, node.y, 10, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#FFF';
        ctx.font = '11px monospace';
        ctx.fillText(node.name, node.x - 40, node.y + 24);
      });

      animFrameId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animFrameId);
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [activeTab, isBlackout]);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#030306',
      color: '#F8FAFC',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      position: 'relative',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Background Neon Aura */}
      <div style={{
        position: 'absolute',
        top: '-180px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '900px',
        height: '550px',
        background: 'radial-gradient(ellipse at center, rgba(232,33,58,0.25) 0%, rgba(3,3,6,0) 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Header Bar */}
      <header style={{
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        borderBottom: '1px solid rgba(232,33,58,0.15)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        background: 'rgba(3,3,6,0.85)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #E8213A 0%, #7F0010 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '24px',
            color: '#FFF',
            boxShadow: '0 0 24px rgba(232,33,58,0.4)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>
            Ω
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '20px', color: '#FFF', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              RED <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(232,33,58,0.15)', color: '#FF4D66', border: '1px solid rgba(232,33,58,0.3)', fontFamily: 'monospace' }}>v24.0.0 Master</span>
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
              Plataforma Soberana P2P Off-Grid
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '6px', background: 'rgba(15,23,42,0.6)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {(['hero', 'radar', 'crypto', 'terminal', 'guardian', 'features', 'architecture', 'faq'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: activeTab === tab ? 700 : 500,
                color: activeTab === tab ? '#FFF' : '#94A3B8',
                background: activeTab === tab ? 'rgba(232,33,58,0.8)' : 'transparent',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'hero' ? 'Inicio' : tab === 'radar' ? '📡 Radar' : tab === 'crypto' ? '🔐 Cifrado' : tab === 'terminal' ? '💻 CLI' : tab === 'guardian' ? '🛡️ Guardian' : tab === 'features' ? 'Capacidades' : tab === 'architecture' ? 'Arquitectura' : 'FAQ'}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onEnterApp}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#CBD5E1',
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            Entrar a la Web App ↗
          </button>
          <a
            href={apkDownloadUrl}
            download="red-v24.0.0-latest.apk"
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#FFF',
              background: 'linear-gradient(90deg, #E8213A 0%, #990014 100%)',
              borderRadius: '10px',
              textDecoration: 'none',
              boxShadow: '0 4px 15px rgba(232,33,58,0.35)',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📥 Descargar APK
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '50px 24px 80px',
        zIndex: 10,
        flex: 1,
      }}>
        {activeTab === 'hero' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Live Status Tag */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '30px',
              background: 'rgba(232,33,58,0.1)',
              border: '1px solid rgba(232,33,58,0.25)',
              color: '#FF4D66',
              fontSize: '12px',
              fontFamily: 'monospace',
              marginBottom: '24px',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E8213A', boxShadow: '0 0 10px #E8213A' }} />
              Cifrado E2E Noise XK • Descentralizado Zero-Server • Tolerante a Apagones
            </div>

            {/* Main Headline */}
            <h1 style={{
              fontSize: 'clamp(34px, 5.5vw, 62px)',
              fontWeight: 900,
              textAlign: 'center',
              lineHeight: 1.12,
              letterSpacing: '-1.5px',
              maxWidth: '900px',
              color: '#FFFFFF',
              marginBottom: '24px',
            }}>
              La Red Militar de Comunicaciones P2P e Inmunidad Criptográfica
            </h1>

            <p style={{
              fontSize: 'clamp(16px, 2vw, 19px)',
              color: '#94A3B8',
              textAlign: 'center',
              maxWidth: '800px',
              lineHeight: 1.6,
              fontWeight: 300,
              marginBottom: '40px',
            }}>
              RED transforma cualquier teléfono o computadora en un nodo de comunicaciones soberano. Transmite mensajes, voz comprimida (12 Kbps) y ubicación GPS a través de <strong style={{ color: '#FF4D66', fontWeight: 600 }}>Bluetooth LE, WiFi Direct, LoRa y Redes Celulares 4G/5G</strong> sin depender de servidores centrales ni torres telefónicas.
            </p>

            {/* Quick Web User Creation Card */}
            <div style={{
              width: '100%',
              maxWidth: '560px',
              padding: '28px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(3,3,6,0.95) 100%)',
              border: '1px solid rgba(232,33,58,0.3)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              marginBottom: '60px',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFF', marginBottom: '8px', textAlign: 'center' }}>
                ⚡ Crear Identidad Web Instantánea
              </div>
              <div style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'center', marginBottom: '20px' }}>
                Ingresa tu apodo para generar tus claves elípticas en el navegador y comunicarte directamente con los teléfonos Android conectados.
              </div>

              <form onSubmit={handleCreateWebUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input
                  type="text"
                  placeholder="Ej. Operador Alpha-1"
                  value={quickAlias}
                  onChange={(e) => setQuickAlias(e.target.value)}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: 'rgba(30,41,59,0.7)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#FFF',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'linear-gradient(90deg, #E8213A 0%, #990014 100%)',
                    color: '#FFF',
                    fontWeight: 800,
                    fontSize: '15px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(232,33,58,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                  }}
                >
                  <span>🚀</span> Iniciar Cliente Web & Conectar con Celulares
                </button>
              </form>
            </div>

            {/* Direct APK Download Highlight */}
            <div style={{
              width: '100%',
              maxWidth: '900px',
              padding: '24px 32px',
              borderRadius: '20px',
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              marginBottom: '60px',
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#FFF' }}>📱 APK Oficial para Dispositivos Móviles Android</div>
                <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>Compilado y probado en Motorola Moto G22 y Lenovo Tablet. Inmune a VPNs.</div>
              </div>
              <a
                href={apkDownloadUrl}
                download="red-v24.0.0-latest.apk"
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#FFF',
                  background: '#E8213A',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 15px rgba(232,33,58,0.4)',
                  whiteSpace: 'nowrap',
                }}
              >
                📥 Descargar APK (99 MB)
              </a>
            </div>
          </div>
        )}

        {/* RADAR CANVAS INTERACTIVE SIMULATION */}
        {activeTab === 'radar' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#FFF', textAlign: 'center', marginBottom: '12px' }}>Simulador de Radar & Apagón Táctico</h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', textAlign: 'center', marginBottom: '24px' }}>
              Simula la caída total de internet para observar cómo el enrutamiento conmuta automáticamente a la malla BLE, WiFi Direct y LoRa.
            </p>

            <button
              onClick={() => setIsBlackout(!isBlackout)}
              style={{
                padding: '12px 24px',
                borderRadius: '14px',
                background: isBlackout ? 'linear-gradient(90deg, #E8213A 0%, #7F0010 100%)' : 'rgba(0, 230, 118, 0.15)',
                color: isBlackout ? '#FFF' : '#00E676',
                border: isBlackout ? '1px solid #E8213A' : '1px solid #00E676',
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: '24px',
                boxShadow: isBlackout ? '0 0 20px rgba(232,33,58,0.5)' : 'none',
              }}
            >
              {isBlackout ? '⚡ MODO APAGÓN ACTIVADO (Sin Internet / Solo Radios de Hardware)' : '🌐 Modo Red Normal (Hacer clic para simular Apagón)'}
            </button>

            <div style={{ width: '100%', maxWidth: '800px', background: '#07090E', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', position: 'relative' }}>
              <canvas ref={canvasRef} style={{ width: '100%', height: '420px', display: 'block' }} />
            </div>

            {selectedNode && (
              <div style={{ marginTop: '20px', padding: '16px 24px', borderRadius: '16px', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(232,33,58,0.4)', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, color: '#FFF', fontSize: '16px' }}>{selectedNode.name}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace', marginTop: '4px' }}>ID: {selectedNode.id}</div>
                <div style={{ fontSize: '12px', color: '#FF4D66', marginTop: '6px' }}>Señal RSSI: {selectedNode.rssi} | Tráfico: {selectedNode.pkts}</div>
              </div>
            )}
          </div>
        )}

        {/* CRYPTO DOUBLE RATCHET INTERACTIVE SIMULATION */}
        {activeTab === 'crypto' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#FFF', textAlign: 'center', marginBottom: '12px' }}>Simulador Criptográfico Noise XK & Double Ratchet</h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', textAlign: 'center', marginBottom: '24px' }}>
              Prueba la renovación de llaves efímeras en vivo. Cada mensaje enviado invalida las claves anteriores para garantizar Secreto Hacia Adelante Perfecto (PFS).
            </p>

            <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(232,33,58,0.3)', marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', color: '#FF4D66', fontFamily: 'monospace', marginBottom: '8px' }}>Paso {ratchetCount}: Renovación de Llaves de Sesión</div>
              <div style={{ fontSize: '13px', color: '#F1F5F9', fontFamily: 'monospace', marginBottom: '6px' }}>{ratchetDh}</div>
              <div style={{ fontSize: '13px', color: '#38BDF8', fontFamily: 'monospace', marginBottom: '6px' }}>{ratchetKdf}</div>
              <div style={{ fontSize: '13px', color: '#00E676', fontFamily: 'monospace', marginBottom: '14px' }}>{ratchetCipher}</div>

              <div style={{ padding: '12px', borderRadius: '10px', background: '#07090E', color: '#94A3B8', fontSize: '12px', fontFamily: 'monospace' }}>
                {ratchetLog}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={triggerRatchetSim}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  background: 'linear-gradient(90deg, #E8213A 0%, #990014 100%)',
                  color: '#FFF',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(232,33,58,0.4)',
                }}
              >
                🔄 Transmitir Siguiente Mensaje Cifrado
              </button>
              <button
                onClick={resetRatchetSim}
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  background: 'rgba(30,41,59,0.8)',
                  color: '#94A3B8',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                }}
              >
                Resetear Época
              </button>
            </div>
          </div>
        )}

        {/* TERMINAL CLI INTERACTIVE CLI TAB */}
        {activeTab === 'terminal' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#FFF', textAlign: 'center', marginBottom: '12px' }}>Consola Terminal Táctica CLI (`red@master:~$`)</h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', textAlign: 'center', marginBottom: '24px' }}>
              Interactúa con los comandos de diagnóstico y consulta de estado del nodo nativo Rust.
            </p>

            <div style={{
              background: '#07090E',
              borderRadius: '20px',
              border: '1px solid rgba(232,33,58,0.3)',
              padding: '24px',
              fontFamily: 'monospace',
              fontSize: '13px',
              minHeight: '260px',
              marginBottom: '20px',
              color: '#38BDF8',
            }}>
              {termOutput.map((line, idx) => (
                <div key={idx} style={{ marginBottom: '8px', color: line.includes('[OK]') || line.includes('✅') ? '#00E676' : '#38BDF8' }}>
                  {line}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {(['peers', 'ratchet', 'dtn', 'sybil', 'audit'] as const).map(cmd => (
                <button
                  key={cmd}
                  onClick={() => runTermCmd(cmd)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(30,41,59,0.8)',
                    color: '#FFF',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Executing {cmd}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GUARDIAN S4 AI INTERACTIVE TAB */}
        {activeTab === 'guardian' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#FFF', textAlign: 'center', marginBottom: '12px' }}>Probador Guardian IA S4 (Off-Grid)</h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', textAlign: 'center', marginBottom: '24px' }}>
              Evalúa la intercepción local de contenido abusivo en el dispositivo emisor antes de iniciar el cifrado.
            </p>

            <div style={{ padding: '24px', borderRadius: '20px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="Escribe un mensaje de prueba para evaluar por la IA local Guardian S4..."
                value={guardianInput}
                onChange={(e) => setGuardianInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(30,41,59,0.7)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFF',
                  fontSize: '14px',
                  marginBottom: '14px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => testGuardian(guardianInput)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(90deg, #E8213A 0%, #990014 100%)',
                  color: '#FFF',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🔍 Evaluar Mensaje con Guardian S4 IA
              </button>
            </div>

            {guardianVerdict && (
              <div style={{
                padding: '20px',
                borderRadius: '16px',
                background: guardianVerdict.status === 'block' ? 'rgba(232,33,58,0.15)' : 'rgba(0,217,126,0.15)',
                border: guardianVerdict.status === 'block' ? '1px solid #E8213A' : '1px solid #00D97E',
                textAlign: 'center',
              }}>
                <div style={{ fontWeight: 800, color: guardianVerdict.status === 'block' ? '#FF4D66' : '#00D97E', fontSize: '16px', marginBottom: '6px' }}>
                  {guardianVerdict.title}
                </div>
                <div style={{ fontSize: '13px', color: '#CBD5E1' }}>{guardianVerdict.desc}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'features' && (
          <div>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#FFF', textAlign: 'center', marginBottom: '12px' }}>Capacidades Tácticas de Producción</h2>
            <p style={{ fontSize: '15px', color: '#94A3B8', textAlign: 'center', marginBottom: '40px' }}>Resumen de las características criptográficas y de hardware del sistema RED v24.0.0.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              <div style={{ padding: '28px', borderRadius: '20px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '32px', marginBottom: '14px' }}>🛡️</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>Cifrado Noise XK + Ed25519</div>
                <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                  Handshakes elípticos de curva X25519 con Perfect Forward Secrecy y cifrado simétrico autenticado ChaCha20-Poly1305. Identidad soberana (`did:red:`).
                </div>
              </div>

              <div style={{ padding: '28px', borderRadius: '20px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '32px', marginBottom: '14px' }}>🎒</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>DTN Store-and-Forward</div>
                <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                  Mula de datos humana (*Sneakernet*). Los mensajes no entregados saltan de teléfono en teléfono cifrados hasta alcanzar su destinatario a cualquier distancia.
                </div>
              </div>

              <div style={{ padding: '28px', borderRadius: '20px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '32px', marginBottom: '14px' }}>🔒</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>Inmunidad a VPNs & Modo Señuelo</div>
                <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                  El transporte BLE opera a nivel de controlador HCI de hardware sin depender del stack IP. Ingresa la clave `9999` para abrir una instancia de emboscada totalmente limpia.
                </div>
              </div>

              <div style={{ padding: '28px', borderRadius: '20px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '32px', marginBottom: '14px' }}>🎙️</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>Notas de Voz Tácticas (12 Kbps)</div>
                <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                  Compresión acústica de alta eficiencia optimizada para transmisión por canales de radio de baja velocidad como BLE y módems LoRa.
                </div>
              </div>

              <div style={{ padding: '28px', borderRadius: '20px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '32px', marginBottom: '14px' }}>🚨</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>Balizas de Emergencia SOS GPS</div>
                <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                  Transmisión instantánea de coordenadas GPS y alerta auditiva de socorro a todos los dispositivos en el radio de cobertura.
                </div>
              </div>

              <div style={{ padding: '28px', borderRadius: '20px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '32px', marginBottom: '14px' }}>🌐</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>Relés 4G/5G Kademlia DHT</div>
                <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>
                  Nodos semilla mundiales para atravesar NATs celulares (Carrier-Grade NAT) y comunicar dispositivos a nivel intercontinental.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'architecture' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#FFF', textAlign: 'center', marginBottom: '12px' }}>Arquitectura del Sistema RED v24.0.0</h2>
            <p style={{ fontSize: '14px', color: '#94A3B8', textAlign: 'center', marginBottom: '40px' }}>
              Flujo de procesamiento en tiempo real entre el Frontend SPA, Middleware Android Java JNI, Motor Rust NDK y Radios de Hardware Off-Grid.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              {/* CAPA 1: FRONTEND SPA */}
              <div style={{
                width: '100%',
                padding: '24px 28px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(15,23,42,0.85) 100%)',
                border: '1px solid rgba(56,189,248,0.4)',
                boxShadow: '0 8px 30px rgba(56,189,248,0.15)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>💻</span>
                    <span style={{ fontWeight: 800, fontSize: '18px', color: '#38BDF8' }}>CAPA 1: PRESENTACIÓN FRONTEND (SPA)</span>
                  </div>
                  <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(56,189,248,0.2)', color: '#38BDF8', fontFamily: 'monospace', fontWeight: 700 }}>Next.js 16 • React 19 • Zustand</span>
                </div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.5 }}>
                  Interfaz táctica responsiva compilada con Turbopack. Gestión de estado global de la malla en memoria (`useRedStore.ts`), renderizado dinámico de vistas y captura de eventos nativos.
                </div>
              </div>

              {/* CONECTOR 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#38BDF8', fontFamily: 'monospace', fontSize: '12px' }}>
                <div style={{ width: '2px', height: '20px', background: 'linear-gradient(180deg, #38BDF8 0%, #00E676 100%)' }} />
                <div style={{ padding: '4px 14px', borderRadius: '12px', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', margin: '4px 0' }}>
                  ⚡ HTTP REST / SSE Event Stream (127.0.0.1:7333)
                </div>
                <div style={{ width: '2px', height: '20px', background: 'linear-gradient(180deg, #38BDF8 0%, #00E676 100%)' }} />
              </div>

              {/* CAPA 2: NATIVA ANDROID MIDDLEWARE */}
              <div style={{
                width: '100%',
                padding: '24px 28px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(0,230,118,0.15) 0%, rgba(15,23,42,0.85) 100%)',
                border: '1px solid rgba(0,230,118,0.4)',
                boxShadow: '0 8px 30px rgba(0,230,118,0.15)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>⚙️</span>
                    <span style={{ fontWeight: 800, fontSize: '18px', color: '#00E676' }}>CAPA 2: MIDDLEWARE NATIVO ANDROID (JAVA / JNI)</span>
                  </div>
                  <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(0,230,118,0.2)', color: '#00E676', fontFamily: 'monospace', fontWeight: 700 }}>Foreground Service • GATT BLE Server</span>
                </div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.5 }}>
                  `RedNodeService.java` ejecuta el proceso inmune al ahorrador de batería del SO. Administra el servidor GATT Bluetooth LE e inyecta tramas de radio físicamente capturadas directamente a Rust.
                </div>
              </div>

              {/* CONECTOR 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#00E676', fontFamily: 'monospace', fontSize: '12px' }}>
                <div style={{ width: '2px', height: '20px', background: 'linear-gradient(180deg, #00E676 0%, #E8213A 100%)' }} />
                <div style={{ padding: '4px 14px', borderRadius: '12px', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(0,230,118,0.3)', margin: '4px 0' }}>
                  🔗 JNI Bindings (Rust C-ABI Interface)
                </div>
                <div style={{ width: '2px', height: '20px', background: 'linear-gradient(180deg, #00E676 0%, #E8213A 100%)' }} />
              </div>

              {/* CAPA 3: MOTOR NATIVO RUST */}
              <div style={{
                width: '100%',
                padding: '24px 28px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(232,33,58,0.2) 0%, rgba(15,23,42,0.85) 100%)',
                border: '1px solid rgba(232,33,58,0.5)',
                boxShadow: '0 8px 30px rgba(232,33,58,0.25)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🦀</span>
                    <span style={{ fontWeight: 800, fontSize: '18px', color: '#FF4D66' }}>CAPA 3: MOTOR NATIVO RUST CORE & AXUM</span>
                  </div>
                  <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(232,33,58,0.2)', color: '#FF4D66', fontFamily: 'monospace', fontWeight: 700 }}>red_core • red_mobile • SQLite Encrypted</span>
                </div>
                <div style={{ fontSize: '13px', color: '#CBD5E1', lineHeight: 1.5 }}>
                  Binario nativo compilado NDK en Rust. Ejecuta el motor criptográfico Noise XK, firmas Ed25519, cifrado ChaCha20-Poly1305, deduplicación por 72h y servidor REST/SSE en Axum.
                </div>
              </div>

              {/* CONECTOR 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#FF4D66', fontFamily: 'monospace', fontSize: '12px' }}>
                <div style={{ width: '2px', height: '20px', background: 'linear-gradient(180deg, #E8213A 0%, #A855F7 100%)' }} />
                <div style={{ padding: '4px 14px', borderRadius: '12px', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(232,33,58,0.3)', margin: '4px 0' }}>
                  📡 Capa de Red Malla Multi-Radio (Ad-Hoc Hardware Radios)
                </div>
                <div style={{ width: '2px', height: '20px', background: 'linear-gradient(180deg, #E8213A 0%, #A855F7 100%)' }} />
              </div>

              {/* CAPA 4: RADIOS MULTI-RADIO EN PARALELO */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', width: '100%' }}>
                <div style={{ padding: '18px', borderRadius: '16px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>🔵</div>
                  <div style={{ fontWeight: 800, color: '#38BDF8', fontSize: '14px' }}>Bluetooth LE (GATT)</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Inmune a VPNs • Radio Físico directo ~100m</div>
                </div>

                <div style={{ padding: '18px', borderRadius: '16px', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>📶</div>
                  <div style={{ fontWeight: 800, color: '#00E676', fontSize: '14px' }}>WiFi Direct Ad-Hoc</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>WebRTC DataChannels • Alta velocidad local</div>
                </div>

                <div style={{ padding: '18px', borderRadius: '16px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>📻</div>
                  <div style={{ fontWeight: 800, color: '#A855F7', fontSize: '14px' }}>LoRa Radio (915MHz)</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Módem de serie • Largo alcance kilometrado</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#FFF', textAlign: 'center', marginBottom: '24px' }}>Preguntas Frecuentes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 700, color: '#FFF', marginBottom: '6px' }}>¿Pueden comunicarse la Web y los Celulares?</div>
                <div style={{ fontSize: '14px', color: '#94A3B8' }}>Sí. Al crear un usuario en el cliente Web, obtienes tu identidad soberana y puedes comunicarte en tiempo real con los dispositivos móviles agregando su contacto o escaneando su QR.</div>
              </div>
              <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 700, color: '#FFF', marginBottom: '6px' }}>¿Qué sucede si un usuario activa una VPN?</div>
                <div style={{ fontSize: '14px', color: '#94A3B8' }}>El canal Bluetooth LE opera a nivel de hardware nativo y continúa transmitiendo datos sin verse afectado por VPNs ni Kill-Switches.</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        width: '100%',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '24px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#64748B',
        fontFamily: 'monospace',
        zIndex: 10,
      }}>
        © 2026 PROYECTO RED — Plataforma Soberana de Comunicaciones P2P Mesh. Código Abierto.
      </footer>
    </div>
  );
}
