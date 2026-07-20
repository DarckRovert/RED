import React, { useRef, useState } from "react";
import { MessageItem } from "../../lib/api";
import { VoiceWave } from "./VoiceMessage";

interface ChatInputProps {
    inputText: string;
    setInputText: (text: string) => void;
    handleSend: () => void;
    sendTyping: () => void;
    attachOpen: boolean;
    setAttachOpen: React.Dispatch<React.SetStateAction<boolean>>;
    replyTo: MessageItem | null;
    setReplyTo: (msg: MessageItem | null) => void;
    peerName: string;
    isRecording: boolean;
    recordSec: number;
    startRecording: () => void;
    stopRecording: () => void;
    handleCamera: () => void;
    handleGallery: () => void;
    handleLocation: () => void;
    setShowPollModal: (show: boolean) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputText,
    setInputText,
    handleSend,
    sendTyping,
    attachOpen,
    setAttachOpen,
    replyTo,
    setReplyTo,
    peerName,
    isRecording,
    recordSec,
    startRecording,
    stopRecording,
    handleCamera,
    handleGallery,
    handleLocation,
    setShowPollModal
}) => {
    const [inputFocused, setInputFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <React.Fragment>
            {/* Attachment Menu */}
            {attachOpen && (
                <div className="attach-menu" style={{ flexShrink: 0, background: 'rgba(8,8,16,0.98)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {[
                        { icon: '📷', label: 'Cámara', color: '#E8213A', action: handleCamera },
                        { icon: '🖼️', label: 'Galería', color: '#FF7043', action: handleGallery },
                        { icon: '📍', label: 'Ubicación', color: '#29B6F6', action: handleLocation },
                        { icon: '📊', label: 'Encuesta', color: '#9b59b6', action: () => { setAttachOpen(false); setShowPollModal(true); } },
                    ].map(a => (
                        <button key={a.label} className="attach-btn" onClick={a.action}
                            style={{ color: a.color, background: `${a.color}0d` }}>
                            <div className="attach-btn-icon" style={{ background: `${a.color}18` }}>
                                {a.icon}
                            </div>
                            <span className="attach-btn-label">{a.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Reply Preview Bar */}
            {replyTo && (
                <div className="reply-bar" style={{ flexShrink: 0 }}>
                    <div className="reply-bar-content">
                        <div className="reply-bar-name">
                            {replyTo.is_mine ? 'Tú' : peerName}
                        </div>
                        <div className="reply-bar-text">
                            {replyTo.msg_type === 'image' ? '📷 Foto' :
                             replyTo.msg_type === 'voice' ? '🎤 Nota de voz' :
                             replyTo.msg_type === 'location' ? '📍 Ubicación' :
                             replyTo.content}
                        </div>
                    </div>
                    <button onClick={() => setReplyTo(null)} style={{
                        background: 'transparent', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '1.2rem', padding: '4px', lineHeight: 1,
                    }}>×</button>
                </div>
            )}

            {/* Input Footer */}
            <footer style={{
                padding: '8px 12px calc(8px + env(safe-area-inset-bottom, 0px)) 12px',
                display: 'flex', gap: '8px', alignItems: 'flex-end',
                background: 'linear-gradient(180deg, rgba(10,10,18,0.97) 0%, rgba(6,6,12,0.99) 100%)',
                borderTop: '1px solid rgba(255,255,255,0.06)', zIndex: 10, flexShrink: 0,
            }}>
                {/* Attach Toggle */}
                <button onClick={() => setAttachOpen(a => !a)} style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: attachOpen ? 'rgba(232,33,58,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${attachOpen ? 'rgba(232,33,58,0.35)' : 'rgba(255,255,255,0.09)'}`,
                    color: attachOpen ? 'var(--primary-bright)' : 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s var(--ease-spring)',
                    transform: attachOpen ? 'rotate(45deg)' : 'none',
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                </button>

                {/* Main Input Textfield / Voice Indicator */}
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center',
                    background: 'rgba(20,20,32,0.9)',
                    border: `1px solid ${inputFocused ? 'rgba(232,33,58,0.4)' : 'rgba(255,255,255,0.09)'}`,
                    borderRadius: 24, padding: '4px 8px 4px 14px',
                    minHeight: 46, transition: 'all 0.2s ease',
                    boxShadow: inputFocused ? '0 0 0 3px rgba(232,33,58,0.10)' : 'none',
                }}>
                    {isRecording ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)', fontWeight: 600, fontSize: '0.9rem' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)', animation: 'pulse-glow 1s infinite' }} />
                            Grabando {Math.floor(recordSec / 60)}:{(recordSec % 60).toString().padStart(2, '0')}
                            <VoiceWave playing color="rgba(232,33,58,0.8)" />
                        </div>
                    ) : (
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Mensaje…"
                            value={inputText}
                            onChange={e => {
                                setInputText(e.target.value);
                                sendTyping();
                            }}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            onFocus={() => { setInputFocused(true); setAttachOpen(false); }}
                            onBlur={() => setInputFocused(false)}
                            style={{
                                flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)',
                                fontSize: '0.97rem', outline: 'none', padding: '6px 0',
                            }}
                        />
                    )}
                </div>

                {/* Send / Mic Action Button */}
                <button
                    onClick={inputText.trim() ? handleSend : (isRecording ? stopRecording : startRecording)}
                    style={{
                        width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: inputText.trim()
                            ? 'linear-gradient(135deg, #E8213A, #FF3355)'
                            : isRecording ? 'var(--danger)' : 'rgba(255,255,255,0.07)',
                        border: `1px solid ${inputText.trim() || isRecording ? 'transparent' : 'rgba(255,255,255,0.09)'}`,
                        boxShadow: inputText.trim() ? '0 4px 20px rgba(232,33,58,0.5)' : isRecording ? '0 0 16px rgba(232,33,58,0.4)' : 'none',
                        color: inputText.trim() || isRecording ? 'white' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.2s var(--ease-spring)',
                        transform: inputText.trim() ? 'scale(1.06)' : 'scale(1)',
                    }}
                >
                    {inputText.trim() ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                    ) : isRecording ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <rect x="3" y="3" width="18" height="18" rx="3"/>
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                            <line x1="12" y1="19" x2="12" y2="23"/>
                        </svg>
                    )}
                </button>
            </footer>
        </React.Fragment>
    );
};
