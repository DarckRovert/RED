"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { MessageItem } from "../lib/api";
import CallScreen from "./CallScreen";
import LinkPreview, { extractUrl } from "./LinkPreview";
import { PollBubble, PollComposer } from "./PollComponents";
import dynamic from 'next/dynamic';

// Next.js dynamic import for Leaflet because it relies on `window` and breaks SSR
const LocationMapView = dynamic(() => import('./LocationMapView'), { ssr: false });

const EMOJI_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function relativeTime(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800) return ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][new Date(ts * 1000).getDay()];
  return new Date(ts * 1000).toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

function statusIcon(status?: string) {
  if (status === "sent") return <span className="tick-sent">✓</span>;
  if (status === "delivered") return <span className="tick-delivered">✓✓</span>;
  if (status === "read") return <span className="tick-read">✓✓</span>;
  return null;
}

interface MessageBubbleProps {
  msg: MessageItem;
  onReply: (msg: MessageItem) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onStar: (msg: MessageItem) => void;
  onForward: (msg: MessageItem) => void;
  isStarred: boolean;
}

function MessageBubble({ msg, onReply, onDelete, onReact, onStar, onForward, isStarred }: MessageBubbleProps) {
  const [showCtx, setShowCtx] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  if (msg.isDeleted) {
    return (
      <div className={`message-wrapper ${msg.is_mine ? "me" : "other"}`}>
        <div className="message-bubble deleted-bubble">
          <p className="message-deleted">🚫 Mensaje eliminado</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`message-wrapper ${msg.is_mine ? "me" : "other"}`}
      onContextMenu={(e) => { e.preventDefault(); setShowCtx(true); }}
    >
      <div className={`message-bubble ${msg.is_mine ? "primary-bubble" : "glass"}`} onClick={() => setShowCtx(false)}>

        {/* Reply preview */}
        {msg.replyTo && (
          <div className="reply-preview">
            <span className="reply-bar" />
            <div className="reply-content">
              <span className="reply-sender font-mono">{msg.replyTo.sender === "me" ? "Tú" : msg.replyTo.sender.substring(0, 8)}</span>
              <span className="reply-text">{msg.replyTo.content.substring(0, 60)}</span>
            </div>
          </div>
        )}

        {/* Media */}
        {msg.mediaUrl && msg.mediaType === "image" && (
          <img src={msg.mediaUrl} alt="img" className="media-image" />
        )}
        {msg.mediaUrl && msg.mediaType === "audio" && (
          <audio controls src={msg.mediaUrl} className="media-audio" />
        )}
        {msg.mediaUrl && msg.mediaType === "file" && (
          <div className="media-file glass">📄 {msg.content}</div>
        )}

        {/* Live Location Block */}
        {msg.content.includes("LOC_UPDATE") ? (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>📍 Transmisión de Ubicación GPS Activa</p>
            <LocationMapView peerId={msg.is_mine ? undefined : msg.sender} />
          </div>
        ) : (
          /* Text + Link Preview */
          (!msg.mediaUrl || msg.mediaType === "file") && (
            <>
              <p className="message-text">{msg.content}</p>
              {extractUrl(msg.content) && <LinkPreview text={msg.content} />}
            </>
          )
        )}

        {/* Footer */}
        <div className="message-footer">
          <span className="message-time">{relativeTime(msg.timestamp)}</span>
          {msg.editedAt && <span className="edited-tag">editado</span>}
          {msg.is_mine && <span className="message-status">{statusIcon(msg.status)}</span>}
        </div>

        {/* Reactions */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="reactions-bar">
            {msg.reactions.map(r => (
              <button key={r.emoji} className="reaction-pill" onClick={() => onReact(msg.id, r.emoji)}>
                {r.emoji} {r.senders.length > 1 && r.senders.length}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {showCtx && (
        <div className="ctx-menu glass animate-fade">
          <button onClick={() => { onReply(msg); setShowCtx(false); }}>↩️ Responder</button>
          <button onClick={() => { setShowEmoji(true); setShowCtx(false); }}>😊 Reaccionar</button>
          <button onClick={() => { onStar(msg); setShowCtx(false); }}>{isStarred ? "⭐ Quitar estrella" : "☆ Guardar"}</button>
          <button onClick={() => { onForward(msg); setShowCtx(false); }}>📨 Reenviar</button>
          {msg.is_mine && <button className="danger" onClick={() => { onDelete(msg.id); setShowCtx(false); }}>🗑️ Eliminar</button>}
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="emoji-picker glass animate-fade">
          {EMOJI_REACTIONS.map(e => (
            <button key={e} onClick={() => { onReact(msg.id, e); setShowEmoji(false); }}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatWindow() {
  const {
    messages,
    currentConversationId,
    conversations,
    groups,
    sendMessage,
    sendMedia,
    deleteMessage,
    reactToMessage,
    isLoading,
    isMobileChatActive,
    closeMobileChat,
    replyTarget,
    setReplyTarget,
    typingMap,
    broadcastTyping,
    starredMessages,
    toggleStarMessage,
    forwardMessage,
    conversations: allConvs,
    disappearingTimers,
    isSharingLocation,
    startLocationSharing,
    stopLocationSharing,
  } = useRedStore();

  const [inputText, setInputText] = useState("");
  const [callMode, setCallMode] = useState<null | "voice" | "video">(null);
  const [showPoll, setShowPoll] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<MessageItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === currentConversationId);
  const activeGroup = groups.find(g => g.id === currentConversationId);
  const isTyping = currentConversationId ? typingMap[currentConversationId] : false;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !currentConversationId) return;
    await sendMessage(inputText, replyTarget || undefined);
    setInputText("");
    // Simulate peer typing response after send (Phase 11)
    setTimeout(() => broadcastTyping(currentConversationId), 800);
  }, [inputText, currentConversationId, replyTarget, sendMessage, broadcastTyping]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sendMedia(file);
    e.target.value = "";
  };

  const handleMic = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert('Grabación de voz no disponible en este dispositivo.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        sendMedia(new File([blob], "nota_de_voz.webm", { type: "audio/webm" }));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 10000); // max 10s
    } catch (err) {
      console.warn('[Mic] Error:', err);
      alert('Permiso de micrófono denegado o no disponible.');
    }
  };

  if (!currentConversationId) {
    return (
      <section className={`chat-window empty ${isMobileChatActive ? "active-mobile" : ""}`}>
        <div className="empty-message animate-fade">
          <div className="logo-placeholder">RED</div>
          <h3>Selecciona una conversación</h3>
          <p>Tus mensajes están protegidos con cifrado P2P y deniabilidad perfecta.</p>
        </div>
      </section>
    );
  }

  const peerName = activeGroup ? activeGroup.name : (activeConv?.peer || "Desconocido");

  return (
    <section className={`chat-window ${isMobileChatActive ? "active-mobile" : ""}`}>
      {/* Call overlay (Phase 13) */}
      {callMode && (
        <CallScreen
          peer={peerName}
          mode={callMode}
          onHangup={() => setCallMode(null)}
        />
      )}

      {/* Header */}
      <header className="chat-header glass">
        <div className="recipient-info">
          <button className="back-btn" onClick={closeMobileChat}>←</button>
          <div className={`avatar-circle-small ${activeGroup ? "group" : ""} ${activeConv?.is_burner ? "burner-avatar" : ""}`}
            style={activeConv?.is_burner ? { border: '2px solid var(--primary)', color: 'var(--primary)', textShadow: '0 0 8px var(--primary-glow)' } : {}}
          >
            {activeGroup ? "#" : activeConv?.is_burner ? "🔥" : (activeConv?.peer?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="recipient-details">
            <span className="recipient-name font-mono" style={activeConv?.is_burner ? { color: 'var(--primary)' } : {}}>
              {activeGroup ? activeGroup.name : (activeConv?.peer || "Desconocido")}
              {activeConv?.is_burner && <span style={{ fontSize: '0.7rem', marginLeft: '6px', color: 'var(--primary)' }}>[VOLATILE]</span>}
            </span>
            <span className="recipient-status">
              {isTyping ? <span className="typing-indicator">escribiendo...</span> : "En línea"}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" title="Llamada de voz" onClick={() => setCallMode("voice")}>📞</button>
          <button className="icon-btn" title="Videollamada" onClick={() => setCallMode("video")}>📹</button>
          <button
            className="icon-btn"
            title={isSharingLocation ? "Detener Ubicación" : "Compartir Ubicación en Vivo"}
            onClick={() => isSharingLocation ? stopLocationSharing() : startLocationSharing(60)}
            style={{ color: isSharingLocation ? 'var(--primary)' : 'inherit' }}
          >
            📍
          </button>
        </div>
      </header>

      {/* Burner Warning Banner */}
      {activeConv?.is_burner && (
        <div style={{ background: 'rgba(255, 23, 68, 0.1)', borderBottom: '1px solid var(--primary)', padding: '0.5rem', textAlign: 'center' }}>
          <p className="font-mono" style={{ color: 'var(--primary)', fontSize: '0.75rem', margin: 0 }}>
            ⚠️ MODO BURNER: Los mensajes solo existen en la memoria RAM y se destruirán al cerrar el chat.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="messages-area scrollbar-hide">
        {isLoading && <div className="loading-spinner"><div className="loader" /></div>}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onReply={setReplyTarget}
            onDelete={deleteMessage}
            onReact={reactToMessage}
            onStar={toggleStarMessage}
            onForward={setForwardMsg}
            isStarred={starredMessages.some(s => s.id === msg.id)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply banner */}
      {replyTarget && (
        <div className="reply-banner glass animate-fade">
          <div className="reply-banner-content">
            <span className="reply-banner-name">{replyTarget.is_mine ? "Tú" : replyTarget.sender.substring(0, 12)}</span>
            <span className="reply-banner-text">{replyTarget.content.substring(0, 60)}</span>
          </div>
          <button className="reply-close" onClick={() => setReplyTarget(null)}>✕</button>
        </div>
      )}

      {/* Footer */}
      <footer className="chat-footer glass">
        <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*,audio/*,.pdf,.doc,.docx" onChange={handleFileSelect} />
        <div className="input-group">
          <button className="icon-btn action" onClick={() => fileInputRef.current?.click()} title="Adjuntar">📎</button>
          <textarea
            rows={1}
            placeholder="Escribe un mensaje..."
            className="message-input"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
          />
          <button className="icon-btn action" onClick={() => { fileInputRef.current?.setAttribute("accept", "image/*"); fileInputRef.current?.click(); }} title="Foto">📷</button>
        </div>

        {inputText.trim() ? (
          <button className="send-btn animate-fade" onClick={handleSend}>▶</button>
        ) : (
          <button className="mic-btn action animate-fade" onClick={handleMic} title="Nota de voz">🎤</button>
        )}
      </footer>
    </section>
  );
}
