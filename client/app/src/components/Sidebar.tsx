"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRedStore } from "../store/useRedStore";
import Logo from "./Logo";
import MessageSearch from "./MessageSearch";

type Tab = "chats" | "groups" | "contacts";

export default function Sidebar() {
  const router = useRouter();
  const {
    conversations,
    contacts,
    groups,
    selectConversation,
    currentConversationId,
    identity,
    addContact,
    createGroup,
    isMobileChatActive,
    searchQuery,
    setSearchQuery,
    localPeers,
  } = useRedStore();

  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<"contact" | "group">("contact");
  const [inputValue, setInputValue] = useState("");
  const [aliasValue, setAliasValue] = useState(""); // FIX M10: alias input
  const [showSearch, setShowSearch] = useState(false);

  // init() is called in layout.tsx — do not call it again here to prevent double-initialization

  const filteredConversations = conversations.filter(c =>
    c.peer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.last_message && c.last_message.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddAction = async () => {
    if (!inputValue.trim()) return;
    if (modalType === "contact") {
      // FIX M10: Use aliasValue or default
      await addContact(inputValue.trim(), aliasValue.trim() || "Contacto");
    } else {
      await createGroup(inputValue.trim());
    }
    closeModal();
  };

  const openModal = (type: "contact" | "group") => {
    setModalType(type);
    setShowAddModal(true);
  };

  // FIX L8: explicitly clear inputs when closing
  const closeModal = () => {
    setShowAddModal(false);
    setInputValue("");
    setAliasValue("");
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#00a884', '#53bdeb', '#f5a623', '#d500f9', '#ef5350', '#8e24aa', '#3949ab', '#e0004f', '#009688'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <aside className={`sidebar glass ${isMobileChatActive ? 'mobile-hidden' : ''}`} style={{ borderRight: '1px solid var(--glass-border-highlight)' }}>
      {/* Phase 25 — Search overlay */}
      {showSearch && <MessageSearch onClose={() => setShowSearch(false)} />}

      <header className="sidebar-header" style={{
        padding: '20px',
        borderBottom: '1px solid var(--glass-border)',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)'
      }}>
        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <Logo size={42} />
          <div className="user-info" style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="username" style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Mi Identidad</span>
            <span className="status font-mono" style={{ fontSize: '0.75rem', color: 'var(--primary)', textShadow: '0 0 8px var(--primary-glow)' }}>
              {identity?.short_id || "Conectando..."}
            </span>
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
          <button className="icon-btn glass" style={{ width: '42px', height: '42px', borderRadius: '12px' }} title="Buscar" onClick={() => setShowSearch(true)}>🔍</button>
          <button className="icon-btn glass" style={{ width: '42px', height: '42px', borderRadius: '12px' }} onClick={() => openModal(activeTab === "groups" ? "group" : "contact")}>➕</button>
          <button
            onClick={() => router.push('/offline')}
            id="sidebar-offline-btn"
            className="icon-btn glass"
            title={localPeers.filter(p => p.connected).length > 0
              ? `${localPeers.filter(p => p.connected).length} peer(s) local(es) conectado(s)`
              : "Modo sin conexión (BLE / WiFi)"}
            style={{ position: "relative", width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            📡
            {localPeers.filter(p => p.connected).length > 0 && (
              <span style={{
                position: "absolute",
                top: "-2px",
                right: "-2px",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "var(--green)",
                boxShadow: "0 0 10px var(--green)",
                border: "2px solid var(--surface-2)",
                display: "block",
              }} />
            )}
          </button>
          <button onClick={() => router.push('/settings')} className="icon-btn glass" style={{ width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
        </div>
      </header>

      <nav className="sidebar-tabs" style={{ padding: '0 20px', marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button className={`tab-btn ${activeTab === "chats" ? "active" : ""}`} onClick={() => setActiveTab("chats")} style={activeTab === 'chats' ? { background: 'var(--surface-hover)', borderRadius: 'var(--radius-pill)', padding: '6px 16px', color: '#fff', fontSize: '0.85rem', fontWeight: 600 } : { padding: '6px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Chats</button>
        <button className={`tab-btn ${activeTab === "groups" ? "active" : ""}`} onClick={() => setActiveTab("groups")} style={activeTab === 'groups' ? { background: 'var(--surface-hover)', borderRadius: 'var(--radius-pill)', padding: '6px 16px', color: '#fff', fontSize: '0.85rem', fontWeight: 600 } : { padding: '6px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Grupos</button>
        <button className={`tab-btn ${activeTab === "contacts" ? "active" : ""}`} onClick={() => setActiveTab("contacts")} style={activeTab === 'contacts' ? { background: 'var(--surface-hover)', borderRadius: 'var(--radius-pill)', padding: '6px 16px', color: '#fff', fontSize: '0.85rem', fontWeight: 600 } : { padding: '6px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contactos</button>
        <div style={{ flex: 1 }} />
        <Link href="/broadcast" className="icon-btn glass" style={{ width: '32px', height: '32px', borderRadius: '50%', fontSize: '0.9rem' }} title="Difusión">📢</Link>
      </nav>

      <div className="search-container" style={{ padding: '12px 20px 4px 20px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder={`Buscar en ${activeTab}...`}
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-pill)',
              paddingLeft: '38px',
              border: '1px solid var(--glass-border-highlight)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
            }}
          />
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.9rem' }}>🔍</span>
        </div>
      </div>

      <div className="list-area scrollbar-hide" style={{ padding: '8px', paddingTop: '12px' }}>
        {activeTab === "chats" && (
          <div className="chat-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredConversations.length === 0 && <div className="empty-state">No se encontraron chats.</div>}
            {[...filteredConversations].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)).map((chat) => (
              <div
                key={chat.id}
                className={`item ${currentConversationId === chat.id ? 'active' : ''}`}
                onClick={() => selectConversation(chat.id)}
              >
                <div className={`avatar-circle ${chat.is_burner ? 'burner-avatar' : ''}`}
                  style={{
                    background: chat.is_burner ? 'rgba(255, 23, 68, 0.1)' : getAvatarColor(chat.peer || '?'),
                    border: chat.is_burner ? '1px solid var(--primary)' : 'none',
                    color: chat.is_burner ? 'var(--primary)' : '#fff',
                  }}
                >
                  {chat.is_burner ? '🔥' : (chat.peer?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="item-info" style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="item-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span className="item-name" style={{
                      color: chat.is_burner ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: (chat.unread_count && chat.unread_count > 0) ? 700 : 600,
                      fontSize: (chat.unread_count && chat.unread_count > 0) ? '0.98rem' : '0.95rem'
                    }}>
                      {chat.is_pinned && <span className="pin-icon">📌 </span>}
                      {chat.peer} {chat.is_burner && <span style={{ fontSize: '0.6rem' }}>[RAM]</span>}
                    </span>
                    <span className="item-meta">
                      <span className="item-time-rel">
                        {chat.last_timestamp ? (() => {
                          const diff = Date.now() / 1000 - chat.last_timestamp;
                          if (diff < 60) return "ahora";
                          if (diff < 3600) return `${Math.floor(diff / 60)}m`;
                          if (diff < 86400) return new Date(chat.last_timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(chat.last_timestamp * 1000).getDay()];
                        })() : ''}
                      </span>
                      {chat.unread_count && chat.unread_count > 0 ? (
                        <span className="unread-badge">{chat.unread_count}</span>
                      ) : null}
                    </span>
                  </div>
                  <span className="item-msg" style={{
                    fontSize: '0.86rem',
                    color: (chat.unread_count && chat.unread_count > 0) ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: (chat.unread_count && chat.unread_count > 0) ? 500 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block'
                  }}>
                    {chat.last_message || "Sin mensajes"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "groups" && (
          <div className="group-list">
            {filteredGroups.length === 0 && <div className="empty-state">No se encontraron grupos.</div>}
            {filteredGroups.map((group) => (
              <div key={group.id} className="item">
                <div className="avatar-circle" style={{ background: getAvatarColor(group.name || '?') }}>{group.name[0]?.toUpperCase() || '#'}</div>
                <div className="item-info">
                  <span className="item-name">{group.name}</span>
                  <span className="item-msg">{group.members.length} miembros</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="contact-list">
            {contacts.length === 0 && <div className="empty-state">No tienes contactos guardados.</div>}
            {contacts.filter(c => c.displayName.toLowerCase().includes(searchQuery.toLowerCase())).map((contact) => (
              <div key={contact.id} className="item" onClick={() => selectConversation(contact.identity_hash)}>
                <div className="avatar-circle" style={{ background: getAvatarColor(contact.displayName || '?') }}>{contact.displayName[0]?.toUpperCase() || '👤'}</div>
                <div className="item-info">
                  <span className="item-name">{contact.displayName}</span>
                  <span className="item-msg font-mono">did:red:{contact.identity_hash.substring(0, 8)}...</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {
        showAddModal && (
          <div className="modal-overlay" onClick={(e) => { if(e.target === e.currentTarget) closeModal(); }}>
            <div className="modal glass animate-fade">
              <h3>{modalType === "contact" ? "Añadir Contacto" : "Crear Grupo"}</h3>
              {modalType === "contact" && (
                <>
                  <p>Introduce el DID del contacto:</p>
                  <input
                    type="text"
                    className="modal-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="f3a2..."
                  />
                  <p style={{ marginTop: '10px' }}>Alias (tu nombre para este contacto):</p>
                  <input
                    type="text"
                    className="modal-input"
                    value={aliasValue}
                    onChange={(e) => setAliasValue(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                  />
                </>
              )}
              {modalType === "group" && (
                <>
                  <p>Nombre del grupo descentralizado:</p>
                  <input
                    type="text"
                    className="modal-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="RED Core Team"
                  />
                </>
              )}
              <div className="modal-actions" style={{ marginTop: '16px' }}>
                <button className="btn-secondary" onClick={closeModal}>Cancelar</button>
                <button className="btn-primary" onClick={handleAddAction}>Confirmar</button>
              </div>
            </div>
          </div>
        )
      }
    </aside >
  );
}
