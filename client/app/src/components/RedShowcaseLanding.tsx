"use client";

import React from "react";

interface RedShowcaseLandingProps {
  onEnterApp: () => void;
}

export default function RedShowcaseLanding({ onEnterApp }: RedShowcaseLandingProps) {
  const apkDownloadUrl = process.env.NEXT_PUBLIC_BASE_PATH 
    ? `${process.env.NEXT_PUBLIC_BASE_PATH}/assets/red-v24.0.0-latest.apk`
    : `/assets/red-v24.0.0-latest.apk`;

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
        top: '-150px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '800px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(232,33,58,0.22) 0%, rgba(3,3,6,0) 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Header Bar */}
      <header style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        borderBottom: '1px solid rgba(232,33,58,0.15)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #E8213A 0%, #7F0010 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '22px',
            color: '#FFF',
            boxShadow: '0 0 20px rgba(232,33,58,0.4)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>
            Ω
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '20px', color: '#FFF', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              RED <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(232,33,58,0.15)', color: '#FF4D66', border: '1px solid rgba(232,33,58,0.3)', fontFamily: 'monospace' }}>v24.0.0</span>
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
              Red Táctica P2P Off-Grid
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              transition: 'all 0.2s',
            }}
          >
            Abrir Web App ↗
          </button>
          <a
            href={apkDownloadUrl}
            download="red-v24.0.0-latest.apk"
            style={{
              padding: '10px 20px',
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

      {/* Hero Body */}
      <main style={{
        width: '100%',
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '60px 24px 80px',
        zIndex: 10,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Badge */}
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
          marginBottom: '28px',
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E8213A', boxShadow: '0 0 10px #E8213A' }} />
          Soberanía Criptográfica & Comunicaciones Indestructibles
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 56px)',
          fontWeight: 900,
          textAlign: 'center',
          lineHeight: 1.15,
          letterSpacing: '-1px',
          maxWidth: '850px',
          color: '#FFFFFF',
          marginBottom: '24px',
        }}>
          Mensajería Militar P2P Sin Internet Ni Servidores
        </h1>

        {/* Description */}
        <p style={{
          fontSize: ' clamp(15px, 2vw, 18px)',
          color: '#94A3B8',
          textAlign: 'center',
          maxWidth: '750px',
          lineHeight: 1.6,
          fontWeight: 300,
          marginBottom: '40px',
        }}>
          Diseñado para escenarios de emergencia extrema, desastres y censura estatal. RED convierte tu teléfono en un nodo de malla soberano que transmite por <strong style={{ color: '#FF4D66', fontWeight: 600 }}>Bluetooth LE, WiFi Direct, LoRa y Red Celular 4G/5G</strong> sin pasar por ningún servidor en la nube.
        </p>

        {/* Action CTA Buttons */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'center',
          marginBottom: '70px',
          width: '100%',
        }}>
          <a
            href={apkDownloadUrl}
            download="red-v24.0.0-latest.apk"
            style={{
              padding: '16px 36px',
              fontSize: '16px',
              fontWeight: 800,
              color: '#FFF',
              background: 'linear-gradient(90deg, #E8213A 0%, #B30018 100%)',
              borderRadius: '16px',
              textDecoration: 'none',
              boxShadow: '0 10px 30px rgba(232,33,58,0.4)',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '22px' }}>📥</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ lineHeight: 1 }}>Descargar APK Android</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '4px', fontFamily: 'monospace', fontWeight: 400 }}>
                red-v24.0.0-latest.apk • 99 MB
              </div>
            </div>
          </a>

          <button
            onClick={onEnterApp}
            style={{
              padding: '16px 32px',
              fontSize: '16px',
              fontWeight: 700,
              color: '#F1F5F9',
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '16px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span>💻</span> Probar Web App en Vivo
          </button>
        </div>

        {/* Technical Feature Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          width: '100%',
        }}>
          <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🛡️</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>Cifrado Noise XK + Ed25519</div>
            <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.5 }}>
              Handshake elíptico X25519 y cifrado autenticado ChaCha20-Poly1305. Identidad soberana (`did:red:`).
            </div>
          </div>

          <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🎒</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>DTN Store-and-Forward</div>
            <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.5 }}>
              Mula de datos humana (*Sneakernet*). Los mensajes saltan de teléfono en teléfono cifrados hasta llegar a su destino.
            </div>
          </div>

          <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔒</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>Inmunidad a VPNs & Modo Señuelo</div>
            <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.5 }}>
              El radio BLE funciona a nivel de hardware nativo. Ingresa la clave `9999` para activar el perfil de emboscada.
            </div>
          </div>

          <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🎙️</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>Notas de Voz Tácticas (12 Kbps)</div>
            <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.5 }}>
              Compresión de audio optimizada para transmisión ultra-rápida por Bluetooth BLE y módems LoRa.
            </div>
          </div>

          <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🚨</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>Baliza SOS GPS Real</div>
            <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.5 }}>
              Emisión inmediata de ubicación de socorro de máxima prioridad a todos los nodos P2P en el área.
            </div>
          </div>

          <div style={{ padding: '24px', borderRadius: '18px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🌐</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>Relés Celulares 4G/5G</div>
            <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.5 }}>
              Nodos semilla Kademlia DHT para atravesar NATs celulares y comunicar teléfonos a distancia intercontinental.
            </div>
          </div>
        </div>

        {/* Documentation Section */}
        <div style={{
          marginTop: '60px',
          width: '100%',
          padding: '30px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(232,33,58,0.12) 0%, rgba(15,23,42,0.6) 100%)',
          border: '1px solid rgba(232,33,58,0.25)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFF', marginBottom: '6px' }}>Repositorio & Documentación Técnica</div>
            <div style={{ fontSize: '13px', color: '#94A3B8' }}>Consulta las especificaciones del Protocolo Ω, manuales y arquitectura del proyecto.</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href="https://github.com/DarckRovert/RED"
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#FFF',
                background: 'rgba(30,41,59,0.9)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                textDecoration: 'none',
              }}
            >
              GitHub Repository ↗
            </a>
            <a
              href="https://github.com/DarckRovert/RED/blob/main/USER_MANUAL.md"
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#FFF',
                background: 'rgba(30,41,59,0.9)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                textDecoration: 'none',
              }}
            >
              Manual de Usuario 📘
            </a>
          </div>
        </div>
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
