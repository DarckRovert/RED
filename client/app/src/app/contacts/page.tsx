"use client";

import React from "react";
import Sidebar from "../../components/Sidebar";
import { useRedStore } from "../../store/useRedStore";

import Link from "next/link";

export default function ContactsPage() {
  const { contacts, selectConversation, searchQuery, setSearchQuery } = useRedStore();

  const filteredContacts = contacts.filter(c =>
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.identity_hash.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="main-layout">
      <div className="settings-sidebar-wrapper">
        <style>{`
          @media (max-width: 768px) {
            .settings-sidebar-wrapper { display: none !important; }
          }
        `}</style>
        <Sidebar />
      </div>
      <section className="contacts-content animate-fade">
        <header className="mobile-settings-header glass">
          <Link href="/chat" className="back-btn">←</Link>
          <h2>Contactos</h2>
        </header>
        <header className="contacts-header" style={{ paddingBottom: "1rem", borderBottom: "1px solid var(--glass-border)" }}>
          <div className="title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Mis Contactos</h1>
            <Link href="/contactqr">
              <button className="btn-primary-small" style={{ fontSize: '0.8rem', padding: '8px 16px' }}>+ Añadir</button>
            </Link>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Libreta cifrada peer-to-peer.
          </p>

          <div className="search-bar glass" style={{ borderRadius: 'var(--radius-pill)', padding: '4px 12px' }}>
            <span className="search-icon" style={{ opacity: 0.5 }}>🔍</span>
            <input
              type="text"
              placeholder="Buscar por nombre o Hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', marginLeft: '8px', fontSize: '0.9rem', width: '100%', outline: 'none', color: 'var(--text-primary)' }}
            />
          </div>
        </header>

        <div className="contacts-grid" style={{ marginTop: '1.5rem' }}>
          {filteredContacts.length === 0 ? (
            <div className="empty-state-full glass" style={{ gridColumn: '1 / -1', borderRadius: 'var(--radius-lg)' }}>
              <span style={{ fontSize: '3rem', opacity: 0.2 }}>👤</span>
              <h3>Libreta vacía</h3>
              <p>Escanea un código QR o ingresa un DID para chatear.</p>
              <Link href="/contactsync">
                <button className="btn-secondary" style={{ marginTop: '1rem' }}>Buscar Dispositivos</button>
              </Link>
            </div>
          ) : (
            filteredContacts.map(contact => (
              <div key={contact.id} className="contact-card" onClick={() => selectConversation(contact.identity_hash)}>
                <div className="contact-avatar">
                  {contact.displayName[0].toUpperCase()}
                </div>
                <div className="contact-info">
                  <h3>{contact.displayName}</h3>
                  <code>{contact.identity_hash.substring(0, 16)}...</code>
                </div>
                <button className="chat-action">Chat</button>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
