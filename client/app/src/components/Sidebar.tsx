"use client";

import React, { useState, useRef } from "react";
import { useRedStore, ScreenView } from "../store/useRedStore";
import { toast } from "./Toast";
// NOTE: @capacitor/clipboard is not used in this file — removed dead import (FIX 3.3)
import { GlobalSearchModal } from "./GlobalSearchModal";
import StoriesBar from "./stories/StoriesBar";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const AVATAR_COLORS = [
    ['#E8213A','#C0152A'], ['#FF7043','#E64A19'], ['#FFA726','#F57C00'],
    ['#26C6DA','#00ACC1'], ['#29B6F6','#0288D1'], ['#7E57C2','#5E35B1'],
    ['#26A69A','#00897B'], ['#EC407A','#C2185B'],
];

function getAvatarIdx(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return h % 8;
}

function avatarStyle(seed: string) {
    const [a, b] = AVATAR_COLORS[getAvatarIdx(seed)];
    return { background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: `0 2px 12px ${a}60` };
}

function formatTime(ts?: number): string {
    if (!ts) return '';
    const d = new Date(ts * 1000), now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff === 1) return 'Ayer';
    if (diff < 7)  return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export default function Sidebar() {
    const { 
        identity, conversations: rawConvs, contacts: rawConts, groups: rawGrps, nodeOnline, navigate, status, fetchData,
        pinnedChatIds: rawPinned, archivedChatIds: rawArchived, togglePinChat, toggleArchiveChat 
    } = useRedStore();

    const conversations = Array.isArray(rawConvs) ? rawConvs : [];
    const contacts = Array.isArray(rawConts) ? rawConts : [];
    const groups = Array.isArray(rawGrps) ? rawGrps : [];
    const pinnedChatIds = Array.isArray(rawPinned) ? rawPinned : [];
    const archivedChatIds = Array.isArray(rawArchived) ? rawArchived : [];

    function resolvePeerName(peerHash: string): string {
        if (!peerHash) return 'Contacto P2P';
        // Check groups first
        const g = groups.find((g: any) => g && g.id === peerHash);
        if (g) return g.name || `Grupo ${peerHash.substring(0, 6)}…`;
        const c = contacts.find((c: any) => c && c.identity_hash === peerHash);
        return c?.display_name || `${peerHash.substring(0, 8)}…`;
    }

    function isGroupPeer(peerHash: string): boolean {
        if (!peerHash) return false;
        return groups.some((g: any) => g && g.id === peerHash);
    }

    const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [pullRefreshing, setPullRefreshing] = useState(false);
    const [showEditNickModal, setShowEditNickModal] = useState(false);
    const [nickInput, setNickInput] = useState('');
    // Stories modal state (broadcaster/viewer opened from StoriesBar)
    const [storyModal, setStoryModal] = useState<'creator' | { type: 'contact'; hash: string } | { type: 'live'; id: string } | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const pullStartY = useRef<number>(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Pull-to-refresh handlers
    const onListTouchStart = (e: React.TouchEvent) => {
        pullStartY.current = e.touches[0].clientY;
    };
    const onListTouchEnd = (e: React.TouchEvent) => {
        const dy = e.changedTouches[0].clientY - pullStartY.current;
        const atTop = (listRef.current?.scrollTop || 0) === 0;
        if (dy > 60 && atTop && !pullRefreshing) {
            setPullRefreshing(true);
            fetchData().finally(() => setPullRefreshing(false));
        }
    };

    const filteredConvs = conversations.filter(c =>
        c && c.peer && !c.peer.startsWith('00000000') && resolvePeerName(c.peer || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredContacts = contacts.filter((c: any) =>
        c && ((c.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.identity_hash || '').toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const totalUnread = conversations.reduce((sum, c) => sum + (c?.unread_count || 0), 0);

    const quickActions = [
        { icon: '📺', label: 'LIVE TikTok', action: 'status',    color: '#FF0050' },
        { icon: '📢', label: 'Difusión',    action: 'broadcast', color: '#E8213A' },
        { icon: '🧭', label: 'Brújula',     action: 'compass',   color: '#38bdf8' },
        { icon: '📻', label: 'Canales',     action: 'channels',  color: '#c084fc' },
        { icon: '🛡️', label: 'Guardian',    action: 'guardian',  color: '#63b3ed' },
        { icon: '🟠', label: 'AMBER',       action: 'amber',     color: '#ff8c00' },
    ];

    const menuItems = [
        { icon: '👤', label: 'Nuevo contacto',      action: 'contacts'  },
        { icon: '🤖', label: 'Copiloto IA Offline',  action: 'aiCopilot' },
        { icon: '👋', label: 'Proximidad Zero-Touch', action: 'proximity' },
        { icon: '🎨', label: 'Canvas Táctico P2P',   action: 'canvas'   },
        { icon: '🔋', label: 'Batería Eco-Mesh',     action: 'ecoMesh'  },
        { icon: '🎙️', label: 'Walkie-Talkie Mesh',  action: 'walkie'    },
        { icon: '🌤️', label: 'Clima & Barómetro',   action: 'weather'   },
        { icon: '🪪', label: 'Bóveda de Identidad', action: 'idVault'   },
        { icon: '🧭', label: 'Brújula Táctica P2P', action: 'compass'   },
        { icon: '📻', label: 'Canales Mesh Locales', action: 'channels' },
        { icon: '🚨', label: 'Baliza SOS Auxilio',   action: 'sos'      },
        { icon: '📢', label: 'Difusión privada',     action: 'broadcast' },
        { icon: '🛡️', label: 'Guardian IA (Moderación)', action: 'guardian' },
        { icon: '🟠', label: 'Sistema Alerta AMBER', action: 'amber'     },
        { icon: '🔐', label: 'Bóveda Criptográfica', action: 'crypto'    },
        { icon: '🛰️', label: 'Estado de Red',        action: 'network'   },
        { icon: '⚡',  label: 'Explorador de Bloques', action: 'explorer' },
        { icon: '🗺️', label: 'Mapa de Nodos',        action: 'nodemap'   },
        { icon: '📡', label: 'Radar Hardware BLE/WiFi', action: 'nearby'  },
        { icon: '⚙️', label: 'Seguridad',            action: 'settings'  },
    ];


    return (
        <aside style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)', position: 'relative', overflow: 'hidden' }}>

            {/* Ambient background glow */}
            <div style={{
                position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
                width: 300, height: 200, borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(232,33,58,0.08) 0%, transparent 70%)',
                pointerEvents: 'none', zIndex: 0,
            }} />

            {/* ── Context Menu ─────────────────────────────────────────────────── */}
            {menuOpen && (
                <div
                    style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setMenuOpen(false)}
                >
                    <div
                        className="glass-panel-elevated animate-pop"
                        style={{
                            position: 'absolute', top: 68, right: 12, width: 260,
                            maxHeight: 'calc(100vh - 90px)', overflowY: 'auto',
                            borderRadius: 'var(--radius-lg)',
                            zIndex: 101, padding: '8px',
                            background: 'linear-gradient(145deg, rgba(15,15,28,0.98), rgba(8,8,18,0.99))',
                            border: '1px solid rgba(255,255,255,0.12)',
                            boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
                        }}

                        onClick={e => e.stopPropagation()}
                    >
                        {/* Menu header */}
                        <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 700 }}>
                                Módulos RED
                            </div>
                        </div>
                        {menuItems.map((item, i) => (
                            <button
                                key={item.action}
                                onClick={e => { e.preventDefault(); navigate(item.action as ScreenView); setMenuOpen(false); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                                    padding: '11px 14px', background: 'transparent', color: 'var(--text-primary)',
                                    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                    fontSize: '0.91rem', fontWeight: 500, textAlign: 'left',
                                    transition: 'background 0.15s ease',
                                    animationDelay: `${i * 30}ms`,
                                }}
                                onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <span style={{ fontSize: '1.15rem', width: 26, textAlign: 'center' }}>{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <header style={{
                padding: '0 16px',
                height: 'var(--header-h)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'linear-gradient(180deg, rgba(12,12,22,0.85) 0%, rgba(8,8,16,0.95) 100%)',
                backdropFilter: 'blur(16px)',
                zIndex: 10, flexShrink: 0, position: 'relative',
            }}>
                {searchOpen ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button className="btn-icon" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6"/>
                            </svg>
                        </button>
                        <input
                            ref={searchRef}
                            autoFocus
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar..."
                            style={{
                                flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(232,33,58,0.3)',
                                color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none',
                                boxShadow: '0 0 0 3px rgba(232,33,58,0.10)',
                            }}
                        />
                    </div>
                ) : (
                    <>
                        {/* Left: Logo + identity */}
                        {(() => {
                            const savedLocalNick = typeof window !== 'undefined' ? (localStorage.getItem('red_displayName') || localStorage.getItem('user_nickname')) : '';
                            const userNick = savedLocalNick || identity?.nickname || 'Operador RED';
                            const initialChar = (userNick.trim().charAt(0) || 'R').toUpperCase();
                            return (
                                <div 
                                    onClick={() => {
                                        setNickInput(userNick);
                                        setShowEditNickModal(true);
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                                    title="Haz clic para cambiar tu alias táctico P2P"
                                >
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: '14px',
                                            background: 'linear-gradient(145deg, #E8213A, #C0152A)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 900, fontSize: '1.2rem', color: 'white', letterSpacing: '-1px',
                                            boxShadow: '0 4px 18px rgba(232,33,58,0.5)',
                                            position: 'relative', overflow: 'hidden',
                                        }}>
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(145deg, rgba(255,255,255,0.2) 0%, transparent 60%)' }} />
                                            <span style={{ position: 'relative' }}>{initialChar}</span>
                                        </div>
                                        <div style={{
                                            position: 'absolute', bottom: -2, right: -2,
                                            width: 13, height: 13, borderRadius: '50%',
                                            background: nodeOnline ? '#00D97E' : '#555',
                                            border: '2.5px solid var(--bg-deep)',
                                            boxShadow: nodeOnline ? '0 0 7px #00D97E' : 'none',
                                            transition: 'all 0.4s ease',
                                        }} />
                                    </div>
                                    <div>
                                        <div 
                                            onClick={() => { setNickInput(userNick); setShowEditNickModal(true); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: 150, cursor: 'pointer' }}
                                            title="Toca para cambiar alias táctico"
                                        >
                                            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {userNick}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', opacity: 0.8, flexShrink: 0 }}>✏️</span>
                                        </div>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.5px',
                                            color: nodeOnline ? '#00D97E' : 'var(--text-muted)',
                                            fontFamily: 'JetBrains Mono, monospace',
                                            marginTop: '1px',
                                        }}>
                                            {nodeOnline ? (identity?.short_id || 'ONLINE') : 'OFFLINE'}
                                            {nodeOnline && identity?.identity_hash && (
                                                <button 
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        // FIX 3.3: Use dynamic import for Capacitor Clipboard
                                                        // to avoid referencing the browser's global Clipboard type.
                                                        try {
                                                            const { Clipboard: CapClipboard } = await import('@capacitor/clipboard');
                                                            await CapClipboard.write({ string: identity.identity_hash });
                                                            toast.success("✅ Hash de identidad copiado.");
                                                        } catch (err) {
                                                            try {
                                                                await navigator.clipboard.writeText(identity.identity_hash);
                                                                toast.success("✅ Hash copiado al portapapeles.");
                                                            } catch {
                                                                toast.error("❌ No se pudo copiar.");
                                                            }
                                                        }
                                                    }}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.06)', border: 'none',
                                                        borderRadius: '4px', padding: '1px 4px', cursor: 'pointer',
                                                        color: 'inherit', fontSize: '0.6rem'
                                                    }}
                                                    title="Copiar Hash"
                                                >
                                                    📋
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Right: Action buttons */}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <button
                                className="btn-primary"
                                onClick={() => navigate('radar')}
                                title="Mi Código QR e Identidad"
                                style={{
                                    padding: '6px 12px', borderRadius: '14px',
                                    fontSize: '0.78rem', fontWeight: 800,
                                    background: 'linear-gradient(135deg, #E8213A, #C0152A)',
                                    color: 'white', border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    boxShadow: '0 2px 10px rgba(232,33,58,0.4)'
                                }}
                            >
                                📷 Mi QR
                            </button>
                            <button className="btn-icon" title="Búsqueda Global" onClick={() => setGlobalSearchOpen(true)}>
                                <span style={{ fontSize: '1rem' }}>🔍</span>
                            </button>
                            <button className="btn-icon" title="Filtrar Lista" onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 80); }}>
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                </svg>
                            </button>
                            <button className="btn-icon" onClick={() => navigate('contacts')} style={{ position: 'relative' }}>
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                            </button>
                            <button
                                onClick={() => setMenuOpen(true)}
                                title="Abrir Menú de Módulos RED"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(232,33,58,0.25), rgba(99,179,237,0.2))',
                                    border: '1px solid rgba(232,33,58,0.45)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    padding: '6px 10px',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 12px rgba(232,33,58,0.3)',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                                onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                                ⚡ Módulos
                            </button>
                        </div>
                    </>
                )}
            </header>

            {/* ── Node status bar (shown when offline) ─────────────────────── */}
            {!nodeOnline && (
                <div style={{
                    padding: '7px 16px', fontSize: '0.75rem', fontWeight: 700,
                    background: 'linear-gradient(90deg, rgba(232,33,58,0.12), rgba(232,33,58,0.06))',
                    borderBottom: '1px solid rgba(232,33,58,0.2)',
                    color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px',
                    flexShrink: 0,
                }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block', animation: 'pulse-glow 1.2s infinite' }} />
                    Nodo criptográfico inaccesible — iniciando…
                </div>
            )}

            {/* ── Quick action strip ────────────────────────────────────────── */}
            <div style={{ padding: '14px 16px 6px', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {quickActions.map(a => (
                        <button
                            key={a.action}
                            onClick={e => { e.preventDefault(); navigate(a.action as any); }}
                            className="zenith-card"
                            style={{
                                flex: '1 0 62px', minWidth: 62, padding: '10px 4px', display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: '6px', borderRadius: '16px',
                                background: `linear-gradient(145deg, ${a.color}1a, rgba(14,14,26,0.8))`,
                                border: `1px solid ${a.color}40`,
                                cursor: 'pointer', color: 'white',
                            }}
                        >
                            <span style={{ fontSize: '1.2rem', lineHeight: 1, filter: `drop-shadow(0 2px 8px ${a.color}80)` }}>{a.icon}</span>
                            <span style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.3px', color: a.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{a.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Stories Bar ────────────────────────────────────────────────── */}
            <StoriesBar
                onMyStory={() => navigate('status')}
                onContactStory={(hash) => navigate('status')}
                onLiveStream={(id) => navigate('status')}
            />

            {/* ── Tab Bar ──────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', padding: '10px 16px 6px', gap: '6px', flexShrink: 0 }}>
                {[
                    { id: 'chats',    label: 'Mensajes', count: totalUnread },
                    { id: 'status',   label: '📺 LIVE',   count: 0 },
                    { id: 'contacts', label: 'Contactos', count: contacts.length },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={e => {
                            e.preventDefault();
                            if (tab.id === 'status') {
                                navigate('status');
                            } else {
                                setActiveTab(tab.id as any);
                            }
                        }}
                        className={activeTab === tab.id ? 'glow-pill-active' : 'zenith-card'}
                        style={{
                            flex: 1, padding: '10px 0', borderRadius: '16px',
                            fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.2px',
                            color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span style={{
                                fontSize: '0.68rem', minWidth: 20, height: 20, borderRadius: '10px',
                                background: activeTab === tab.id ? 'white' : '#FF3355',
                                color: activeTab === tab.id ? '#E8213A' : 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, padding: '0 6px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                            }}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── List ─────────────────────────────────────────────────────── */}
            <div ref={listRef} className="scroll-container" style={{ flex: 1, padding: '4px 12px calc(80px + var(--safe-bottom, 0px))', position: 'relative', zIndex: 1 }}
                onTouchStart={onListTouchStart}
                onTouchEnd={onListTouchEnd}
            >
                {/* Pull-to-refresh indicator */}
                {pullRefreshing && (
                    <div style={{
                        textAlign: 'center', padding: '8px 0', fontSize: '0.74rem',
                        color: 'var(--primary-bright)', fontWeight: 700,
                    }}>
                        ↻ Actualizando…
                    </div>
                )}


                {/* Contacts tab — Add button */}
                {activeTab === 'contacts' && (
                    <div style={{ marginBottom: '10px' }}>
                        <button
                            onClick={e => { e.preventDefault(); navigate('contacts'); }}
                            style={{
                                width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                                background: 'linear-gradient(135deg, rgba(232,33,58,0.15), rgba(200,20,45,0.08))',
                                border: '1px solid rgba(232,33,58,0.25)', color: 'var(--primary-bright)',
                                fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Agregar Contacto / Escanear QR
                        </button>
                    </div>
                )}

                {/* ── CHATS empty ── */}
                {activeTab === 'chats' && filteredConvs.length === 0 && (
                    <div style={{ padding: '48px 16px', textAlign: 'center' }} className="animate-fade">
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px',
                            background: 'linear-gradient(135deg, rgba(232,33,58,0.15), rgba(200,20,45,0.08))',
                            border: '1px solid rgba(232,33,58,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem',
                        }}>💬</div>
                        <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem' }}>
                            {searchQuery ? `Sin resultados para "${searchQuery}"` : 'Sin mensajes aún'}
                        </h3>
                        <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 20px' }}>
                            {searchQuery ? 'Intenta con otro término.' : 'Agrega un contacto para enviar tu primer mensaje cifrado.'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={e => { e.preventDefault(); navigate('contacts'); }}
                                style={{
                                    padding: '11px 24px', borderRadius: 'var(--radius-md)',
                                    background: 'linear-gradient(135deg, var(--primary), #C0152A)',
                                    color: 'white', fontWeight: 700, fontSize: '0.88rem',
                                    border: 'none', cursor: 'pointer',
                                    boxShadow: '0 4px 16px rgba(232,33,58,0.45)',
                                }}
                            >
                                Agregar contacto
                            </button>
                        )}
                    </div>
                )}

                {/* ── CHATS list ── */}
                {activeTab === 'chats' && [...filteredConvs]
                    .filter(c => !archivedChatIds.includes(c.id))
                    .sort((a, b) => {
                        const aPin = pinnedChatIds.includes(a.id) ? 1 : 0;
                        const bPin = pinnedChatIds.includes(b.id) ? 1 : 0;
                        return bPin - aPin;
                    })
                    .map((chat, i) => {
                        const name = resolvePeerName(chat.peer);
                        const isGroup = isGroupPeer(chat.peer);
                        const isPinned = pinnedChatIds.includes(chat.id);
                        const avStyle = isGroup
                            ? { background: 'linear-gradient(135deg, #7E57C2, #5E35B1)', boxShadow: '0 2px 12px rgba(126,87,194,0.6)' }
                            : avatarStyle(chat.peer);
                        const hasUnread = (chat.unread_count || 0) > 0;
                        return (
                            <div
                                key={chat.id}
                                onClick={e => { e.preventDefault(); navigate('chat', chat.id); }}
                                className="animate-enter zenith-card"
                                style={{
                                    display: 'flex', alignItems: 'center', padding: '12px 12px', gap: '14px',
                                    borderRadius: '20px', cursor: 'pointer',
                                    background: isPinned 
                                        ? 'linear-gradient(135deg, rgba(255,167,38,0.18), rgba(232,33,58,0.1))'
                                        : hasUnread ? 'linear-gradient(135deg, rgba(255,51,85,0.22), rgba(200,20,45,0.1))' : undefined,
                                    border: isPinned
                                        ? '1px solid rgba(255,167,38,0.4)'
                                        : hasUnread ? '1px solid rgba(255,51,85,0.45)' : undefined,
                                    marginBottom: '6px',
                                    animationDelay: `${i * 30}ms`,
                                }}
                            >
                            {/* Avatar */}
                            <div style={{
                                width: 48, height: 48, borderRadius: isGroup ? '14px' : '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: '1.1rem', color: 'white',
                                position: 'relative',
                                ...avStyle,
                            }}>
                                {isGroup ? '👥' : name.substring(0, 1).toUpperCase()}
                                {/* Online indicator */}
                                <div style={{
                                    position: 'absolute', bottom: 1, right: 1,
                                    width: 11, height: 11, borderRadius: '50%',
                                    background: hasUnread ? '#00D97E' : 'rgba(255,255,255,0.3)',
                                    border: '2px solid var(--bg-deep)',
                                    boxShadow: hasUnread ? '0 0 5px #00D97E' : 'none',
                                }} />
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                                    <span style={{
                                        fontWeight: hasUnread ? 700 : 500,
                                        color: hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontSize: '0.94rem',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65%',
                                    }}>
                                        {name}
                                    </span>
                                    <span style={{
                                        fontSize: '0.7rem', flexShrink: 0,
                                        color: hasUnread ? 'var(--primary-bright)' : 'var(--text-muted)',
                                        fontWeight: hasUnread ? 700 : 400,
                                    }}>
                                        {formatTime(chat.last_timestamp)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{
                                        fontSize: '0.82rem',
                                        color: hasUnread ? 'var(--text-secondary)' : 'var(--text-muted)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '65%',
                                        fontStyle: !chat.last_message ? 'italic' : 'normal',
                                    }}>
                                        {chat.last_message || '🔐 Canal E2E activo'}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                togglePinChat(chat.id);
                                                toast.success(isPinned ? "Chat desfijado" : "📌 Chat fijado al inicio");
                                            }}
                                            style={{
                                                background: isPinned ? 'rgba(255,167,38,0.15)' : 'transparent',
                                                border: `1px solid ${isPinned ? 'rgba(255,167,38,0.3)' : 'transparent'}`,
                                                borderRadius: '6px', cursor: 'pointer',
                                                fontSize: '0.75rem', padding: '2px 4px',
                                                transition: 'all 0.2s ease',
                                            }}
                                            title={isPinned ? "Desfijar chat" : "Fijar chat al inicio"}
                                        >
                                            📌
                                        </button>
                                        {hasUnread && (
                                            <span style={{
                                                minWidth: 20, height: 20, borderRadius: '10px', padding: '0 5px',
                                                background: 'var(--primary)', color: 'white',
                                                fontSize: '0.68rem', fontWeight: 800,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 2px 8px rgba(232,33,58,0.5)',
                                                flexShrink: 0,
                                            }}>
                                                {chat.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* ── CONTACTS empty ── */}
                {activeTab === 'contacts' && filteredContacts.length === 0 && (
                    <div style={{ padding: '40px 16px', textAlign: 'center' }} className="animate-fade">
                        <div style={{
                            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 18px',
                            background: 'rgba(41,182,246,0.1)', border: '1px solid rgba(41,182,246,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem',
                        }}>📇</div>
                        <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 700 }}>
                            {searchQuery ? `Sin resultados para "${searchQuery}"` : 'Sin contactos'}
                        </h3>
                        <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Agrega tu primer contacto usando su hash de identidad P2P.
                        </p>
                    </div>
                )}

                {/* ── CONTACTS list ── */}
                {activeTab === 'contacts' && filteredContacts.map((c: any, i: number) => {
                    const name = c.display_name || `${c.identity_hash?.substring(0, 8)}…`;
                    const avStyle = avatarStyle(c.display_name || c.identity_hash);
                    return (
                        <div
                            key={c.identity_hash}
                            className="animate-enter zenith-card"
                            onClick={e => { e.preventDefault(); navigate('chat', c.identity_hash); }}
                            style={{
                                display: 'flex', alignItems: 'center', padding: '12px 12px', gap: '14px',
                                borderRadius: '20px', cursor: 'pointer',
                                marginBottom: '6px',
                                animationDelay: `${i * 30}ms`,
                            }}
                        >
                            <div style={{
                                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: '1.1rem', color: 'white',
                                ...avStyle,
                            }}>
                                {name.substring(0, 1).toUpperCase()}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.94rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {name}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>
                                        {c.verified ? '☑️' : '🔵'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.3px' }}>
                                    {c.identity_hash?.substring(0, 22)}…
                                </div>
                            </div>

                            <button
                                onClick={e => { e.preventDefault(); e.stopPropagation(); navigate('chat', c.identity_hash); }}
                                style={{
                                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                    background: 'rgba(232,33,58,0.12)', border: '1px solid rgba(232,33,58,0.25)',
                                    color: 'var(--primary-bright)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseOver={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                                onMouseOut={e => { e.currentTarget.style.background = 'rgba(232,33,58,0.12)'; e.currentTarget.style.borderColor = 'rgba(232,33,58,0.25)'; }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                                </svg>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* ── Floating Action Button (New Message) ─────────────────────── */}
            <button
                onClick={e => { e.preventDefault(); navigate('contacts'); }}
                style={{
                    position: 'absolute', right: 18, bottom: 24,
                    width: 56, height: 56, borderRadius: '50%', zIndex: 20,
                    background: 'linear-gradient(135deg, #E8213A, #C0152A)',
                    border: 'none', color: 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 6px 24px rgba(232,33,58,0.55), 0 2px 8px rgba(0,0,0,0.4)',
                    transition: 'transform 0.2s var(--ease-spring), box-shadow 0.2s ease',
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(232,33,58,0.7), 0 2px 8px rgba(0,0,0,0.4)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(232,33,58,0.55), 0 2px 8px rgba(0,0,0,0.4)'; }}
                title="Nuevo mensaje"
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
            </button>

            {/* Global Search Modal */}
            {globalSearchOpen && (
                <GlobalSearchModal onClose={() => setGlobalSearchOpen(false)} />
            )}

            {/* Editable Nickname Modal */}
            {showEditNickModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ width: '100%', maxWidth: '380px', background: 'linear-gradient(180deg, #181826, #0e0e18)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px', padding: '24px', color: 'white', boxShadow: '0 12px 48px rgba(0,0,0,0.7)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '1.4rem' }}>✏️</span>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Alias Táctico P2P</h3>
                        </div>
                        <p style={{ margin: '0 0 18px', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Configura tu nombre o apodo visible en la red P2P RED. Este alias se comparte de forma cifrada con tus contactos.
                        </p>
                        <input
                            type="text"
                            value={nickInput}
                            onChange={e => setNickInput(e.target.value)}
                            placeholder="Escribe tu alias (ej. Darck, Alfa-1)"
                            style={{
                                width: '100%', padding: '14px 16px', borderRadius: '14px',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)',
                                color: 'white', fontSize: '1.05rem', outline: 'none', marginBottom: '22px'
                            }}
                            autoFocus
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter' && nickInput.trim()) {
                                    await useRedStore.getState().setProfile(nickInput.trim());
                                    toast.success("✅ Alias táctico actualizado");
                                    setShowEditNickModal(false);
                                }
                            }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowEditNickModal(false)}
                                style={{ padding: '11px 20px', borderRadius: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (nickInput.trim()) {
                                        await useRedStore.getState().setProfile(nickInput.trim());
                                        toast.success("✅ Alias táctico actualizado");
                                    }
                                    setShowEditNickModal(false);
                                }}
                                style={{ padding: '11px 22px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), #C0152A)', border: 'none', color: 'white', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(232,33,58,0.4)' }}
                            >
                                Guardar Alias
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
