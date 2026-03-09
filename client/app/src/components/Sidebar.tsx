"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRedStore } from "../store/useRedStore";
import Logo from "./Logo";
import MessageSearch from "./MessageSearch";

type Tab = "chats" | "groups" | "contacts";

export default function Sidebar() {
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
      await addContact(inputValue, "Nuevo Contacto");
    } else {
      await createGroup(inputValue);
    }
    setInputValue("");
    setShowAddModal(false);
  };

  const openModal = (type: "contact" | "group") => {
    setModalType(type);
    setShowAddModal(true);
  };

  return (
    <aside className={`sidebar glass ${isMobileChatActive ? 'mobile-hidden' : ''}`}>
      {/* Phase 25 — Search overlay */}
      {showSearch && <MessageSearch onClose={() => setShowSearch(false)} />}

      <header className="sidebar-header">
        <div className="user-profile">
          <Logo size={32} />
          <div className="user-info">
            <span className="username">Mi Identidad</span>
            <span className="status font-mono">{identity?.short_id || "Conectando..."}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" title="Buscar" onClick={() => setShowSearch(true)}>🔍</button>
          <button className="icon-btn" onClick={() => openModal(activeTab === "groups" ? "group" : "contact")}>➕</button>
          <Link
            href="/offline"
            id="sidebar-offline-btn"
            className="icon-btn"
            title={localPeers.filter(p => p.connected).length > 0
              ? `${localPeers.filter(p => p.connected).length} peer(s) local(es) conectado(s)`
              : "Modo sin conexión (BLE / WiFi)"}
            style={{ position: "relative" }}
          >
            📡
            {localPeers.filter(p => p.connected).length > 0 && (
              <span style={{
                position: "absolute",
                top: "2px",
                right: "2px",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 6px #22c55e",
                display: "block",
              }} />
            )}
          </Link>
          <Link href="/settings" className="icon-btn">⚙️</Link>
        </div>
      </header>

      <nav className="sidebar-tabs">
        <button className={activeTab === "chats" ? "active" : ""} onClick={() => setActiveTab("chats")}>CHATS</button>
        <button className={activeTab === "groups" ? "active" : ""} onClick={() => setActiveTab("groups")}>GRUPOS</button>
        <button className={activeTab === "contacts" ? "active" : ""} onClick={() => setActiveTab("contacts")}>CONTACTOS</button>
        <Link href="/broadcast" className={`tab-link-btn`} title="Difusión">📢</Link>
      </nav>

      <div className="search-container">
        <input
          type="text"
          placeholder={`Buscar en ${activeTab}...`}
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="list-area scrollbar-hide">
        {activeTab === "chats" && (
          <div className="chat-list">
            {filteredConversations.length === 0 && <div className="empty-state">No se encontraron chats.</div>}
            {[...filteredConversations].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)).map((chat) => (
              <div
                key={chat.id}
                className={`item ${currentConversationId === chat.id ? 'active' : ''}`}
                onClick={() => selectConversation(chat.id)}
              >
                <div className={`avatar-circle ${chat.is_burner ? 'burner-avatar' : ''}`}
                  style={chat.is_burner ? { border: '2px solid var(--primary)', color: 'var(--primary)', textShadow: '0 0 8px var(--primary-glow)' } : {}}
                >
                  {chat.is_burner ? '🔥' : (chat.peer?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="item-info">
                  <div className="item-top">
                    <span className="item-name" style={chat.is_burner ? { color: 'var(--primary)' } : {}}>
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
                  <span className="item-msg">{chat.last_message || "Sin mensajes"}</span>
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
                <div className="avatar-circle group">#</div>
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
                <div className="avatar-circle contact">👤</div>
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
          <div className="modal-overlay">
            <div className="modal glass animate-fade">
              <h3>{modalType === "contact" ? "Añadir Contacto" : "Crear Grupo"}</h3>
              <p>{modalType === "contact" ? "Introduce el DID del contacto:" : "Nombre del grupo descentralizado:"}</p>
              <input
                type="text"
                className="modal-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={modalType === "contact" ? "f3a2..." : "RED Core Team"}
              />
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleAddAction}>Confirmar</button>
              </div>
            </div>
          </div>
        )
      }
    </aside >
  );
}
