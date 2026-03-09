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
      <Sidebar />
      <section className="contacts-content animate-fade">
        <header className="mobile-settings-header glass">
          <Link href="/chat" className="back-btn">←</Link>
          <h2>Contactos</h2>
        </header>
        <header className="contacts-header">
          <div className="title-row">
            <h1>Libreta de Contactos</h1>
            <button className="btn-primary">Añadir Contacto</button>
          </div>
          <p>Tus contactos están cifrados y solo tú puedes ver esta lista.</p>

          <div className="search-bar glass">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar por nombre o DID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        <div className="contacts-grid">
          {filteredContacts.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">👤</span>
              <h3>No se encontraron contactos</h3>
              <p>Añade a alguien usando su Identity Hash para empezar.</p>
            </div>
          ) : (
            filteredContacts.map(contact => (
              <div key={contact.id} className="contact-card glass" onClick={() => selectConversation(contact.identity_hash)}>
                <div className="contact-avatar">
                  {contact.displayName[0].toUpperCase()}
                </div>
                <div className="contact-info">
                  <h3>{contact.displayName}</h3>
                  <code>did:red:{contact.identity_hash.substring(0, 12)}...</code>
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
