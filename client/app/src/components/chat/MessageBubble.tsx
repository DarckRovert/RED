import React, { useRef, memo } from "react";
import { MessageItem } from "../../lib/api";
import { useRedStore } from "../../store/useRedStore";
import { VoiceMessage } from "./VoiceMessage";
import { PollMessage } from "./PollMessage";
import { ImageViewerModal } from "./ImageViewerModal";

interface MessageBubbleProps {
    msg: MessageItem;
    isMine: boolean;
    isFirst: boolean;
    isLast: boolean;
    showDate: boolean;
    peerName: string;
    starredMessages: string[];
    searchQuery: string;
    isSearchHighlight: boolean;
    isSwiping: boolean;
    onTouchStart: (e: React.TouchEvent, msg: MessageItem) => void;
    onTouchMove: (e: React.TouchEvent, msg: MessageItem) => void;
    onTouchEnd: () => void;
    onLongPress: (e: React.TouchEvent | React.MouseEvent, msg: MessageItem) => void;
    onCancelLongPress: () => void;
    onReaction: (msgId: string, emoji: string) => void;
    onVote: (msgId: string, optIdx: number) => void;
}

const sameDay = (a: number, b: number) => {
    const da = new Date(a * 1000), db = new Date(b * 1000);
    return da.getFullYear() === db.getFullYear() &&
           da.getMonth() === db.getMonth() &&
           da.getDate() === db.getDate();
};

function datePill(ts: number): string {
    const d = new Date(ts * 1000), now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    if (diff < 7)  return d.toLocaleDateString('es', { weekday: 'long' });
    return d.toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
}

function timeStr(ts: number) {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const MessageBubble = memo(({
    msg, isMine, isFirst, isLast, showDate, peerName, starredMessages,
    searchQuery, isSearchHighlight, isSwiping, onTouchStart, onTouchMove, onTouchEnd,
    onLongPress, onCancelLongPress, onReaction, onVote
}: MessageBubbleProps) => {
    const [viewingImageSrc, setViewingImageSrc] = React.useState<string | null>(null);

    const tl = isMine ? (isFirst ? 18 : 4) : 18;
    const tr = isMine ? 18 : (isFirst ? 18 : 4);
    const br = isMine ? (isLast ? 4 : 18) : (isLast ? 18 : 4);
    const bl = isMine ? 4 : (isLast ? 4 : 18);

    const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;
    const isSystem     = msg.msg_type === 'system';

    if (isSystem) {
        return (
            <div className="system-msg">
                🔐 {msg.content}
            </div>
        );
    }

    return (
        <React.Fragment>
            {showDate && (
                <div className="chat-date-pill">
                    <span>{datePill(msg.timestamp)}</span>
                </div>
            )}

            <div style={{
                display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: '6px',
                marginTop: isFirst ? '10px' : '2px',
                transform: isSwiping ? (isMine ? 'translateX(-12px)' : 'translateX(12px)') : 'none',
                transition: 'transform 0.2s ease',
            }}>
                {/* Swipe-to-reply icon */}
                <div className={`swipe-reply-icon ${isSwiping ? 'visible' : ''}`}
                    style={{ fontSize: '1rem', flexShrink: 0 }}>
                    ↩
                </div>

                {/* Bubble */}
                <div
                    data-msgid={msg.id}
                    className="msg-bubble"
                    style={{
                        maxWidth: '80%',
                        padding: msg.msg_type === 'image' ? '3px' : '10px 13px',
                        borderRadius: `${tl}px ${tr}px ${br}px ${bl}px`,
                        background: isMine
                            ? 'linear-gradient(135deg, rgba(232,33,58,0.22), rgba(200,20,45,0.14))'
                            : 'rgba(20,20,34,0.9)',
                        border: `1px solid ${isMine ? 'rgba(232,33,58,0.28)' : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: isMine
                            ? '0 2px 14px rgba(232,33,58,0.14), inset 0 1px 0 rgba(255,255,255,0.07)'
                            : '0 2px 8px rgba(0,0,0,0.3)',
                        display: 'flex', flexDirection: 'column',
                        position: 'relative',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                    }}
                    onMouseDown={e => onLongPress(e, msg)}
                    onMouseUp={onCancelLongPress}
                    onMouseLeave={onCancelLongPress}
                    onTouchStart={e => onTouchStart(e, msg)}
                    onTouchMove={e => onTouchMove(e, msg)}
                    onTouchEnd={onTouchEnd}
                >
                    {/* Reply quote */}
                    {msg.reply_to && (
                        <div className={`msg-reply-quote ${isMine ? 'mine' : ''}`}>
                            <div className="msg-reply-quote-name">
                                {msg.reply_to.sender === 'me' ? 'Tú' : peerName}
                            </div>
                            <div className="msg-reply-quote-text">
                                {msg.reply_to.msg_type === 'image' ? '📷 Foto' :
                                 msg.reply_to.msg_type === 'voice' ? '🎤 Voz' :
                                 msg.reply_to.content}
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    {msg.msg_type === 'contact_card' ? (() => {
                        let cardData: any = {};
                        try { cardData = JSON.parse(msg.media_data || '{}'); } catch {}
                        const { identity_hash: ih, display_name: dn } = cardData;
                        return (
                            <div style={{ minWidth: 200, padding: 4 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                                    <div style={{ width:42, height:42, borderRadius:'50%', background:'linear-gradient(135deg,#7E57C2,#5E35B1)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'white', fontSize:'1.1rem' }}>
                                        {(dn||'?')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight:700, fontSize:'0.95rem' }}>{dn || 'Contacto'}</div>
                                        <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{(ih||'').substring(0,16)}…</div>
                                    </div>
                                </div>
                                {ih && (
                                    <button onClick={() => useRedStore.getState().addContact(ih, dn || ih.substring(0,8))}
                                        style={{ width:'100%', padding:'8px', borderRadius:10, background:'rgba(232,33,58,0.12)', border:'1px solid rgba(232,33,58,0.25)', color:'var(--primary-bright)', fontSize:'0.8rem', fontWeight:700, cursor:'pointer' }}>
                                        + Añadir contacto
                                    </button>
                                )}
                            </div>
                        );
                    })() : msg.msg_type === 'file' ? (() => {
                        const name = (msg as any).media_name || msg.content.replace('📎 ', '') || 'Archivo';
                        const handleOpen = () => {
                            if (!msg.media_data) return;
                            const mime = msg.mime_type || 'application/octet-stream';
                            const blob = new Blob([Uint8Array.from(atob(msg.media_data), c => c.charCodeAt(0))], { type: mime });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = name; a.click();
                            setTimeout(() => URL.revokeObjectURL(url), 5000);
                        };
                        return (
                            <div onClick={handleOpen} style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', minWidth:180 }}>
                                <div style={{ width:42, height:42, borderRadius:10, background:'rgba(232,33,58,0.12)', border:'1px solid rgba(232,33,58,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', flexShrink:0 }}>📄</div>
                                <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontWeight:700, fontSize:'0.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
                                    <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>Toca para abrir</div>
                                </div>
                            </div>
                        );
                    })() : msg.msg_type === 'image' && msg.media_data ? (() => {
                        const imgSrc = msg.media_data.startsWith('data:')
                            ? msg.media_data
                            : `data:${msg.mime_type || 'image/jpeg'};base64,${msg.media_data}`;
                        return (
                            <div>
                                <img 
                                    src={imgSrc} 
                                    alt="Imagen cifrada"
                                    onClick={() => setViewingImageSrc(imgSrc)}
                                    style={{ width: '100%', maxWidth: 280, borderRadius: 14, display: 'block', maxHeight: 300, objectFit: 'cover', cursor: 'pointer' }} 
                                />
                                {msg.content && msg.content !== '📷 Foto cifrada' && msg.content !== '[Image]' && msg.content !== '🖼️ Imagen cifrada' && (
                                    <span style={{ display: 'block', padding: '7px 8px 0', fontSize: '0.93rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                                        {msg.content}
                                    </span>
                                )}
                            </div>
                        );
                    })() : msg.msg_type === 'media_chunk' ? (
                        <div style={{ color: 'var(--info)', fontSize: '0.8rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid var(--info)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                            Recibiendo fragmento pesado vía P2P...
                        </div>
                    ) : msg.msg_type === 'voice' ? (
                        <VoiceMessage msg={msg} isMine={isMine} />
                    ) : msg.msg_type === 'location' && msg.latitude && msg.longitude ? (
                        <div style={{ minWidth: 220 }}>
                            <div style={{
                                width: '100%', height: 140, borderRadius: 12, marginBottom: 8,
                                overflow: 'hidden', position: 'relative',
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}>
                                <img
                                    src={`https://staticmap.openstreetmap.de/staticmap.php?center=${msg.latitude},${msg.longitude}&zoom=15&size=280x140&maptype=mapnik&markers=${msg.latitude},${msg.longitude},red`}
                                    alt="Mapa"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: 'radial-gradient(circle at 50% 50%, rgba(232,33,58,0.1), transparent 70%)',
                                    pointerEvents: 'none',
                                }} />
                                <div style={{
                                    position: 'absolute', top: '50%', left: '50%',
                                    transform: 'translate(-50%,-50%)',
                                    fontSize: '1.5rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
                                    pointerEvents: 'none',
                                }}>📍</div>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 3 }}>Ubicación GPS</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                {msg.latitude.toFixed(5)}, {msg.longitude.toFixed(5)}
                                {msg.accuracy ? ` · ±${Math.round(msg.accuracy)}m` : ''}
                            </div>
                            <button onClick={() => window.open(`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`, '_blank')}
                                style={{
                                    width: '100%', padding: '7px', borderRadius: 8,
                                    background: 'rgba(232,33,58,0.12)', border: '1px solid rgba(232,33,58,0.25)',
                                    color: 'var(--primary-bright)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                }}>
                                Abrir en mapa →
                            </button>
                        </div>
                    ) : msg.msg_type === 'poll' ? (
                        <PollMessage msg={msg} onVote={(i) => onVote(msg.id, i)} />
                    ) : (
                        <span style={{ wordBreak: 'break-word', fontSize: '0.96rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                            {msg.content}
                        </span>
                    )}

                    {/* Timestamp + Transport Badge + tick + star */}
                    <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:4, marginTop:5 }}>
                        {/* Atomic Transport Badge */}
                        {((msg as any).transport || (isMine ? 'wan' : null)) && (
                            <span 
                                title={`Transporte de entrega: ${((msg as any).transport || 'wan').toUpperCase()}`}
                                style={{ 
                                    fontSize: '0.62rem', 
                                    padding: '1px 4px', 
                                    borderRadius: '4px',
                                    background: ((msg as any).transport === 'ble' ? 'rgba(155,89,182,0.2)' :
                                                 (msg as any).transport === 'wifi' ? 'rgba(52,152,219,0.2)' :
                                                 (msg as any).transport === 'lora' ? 'rgba(230,126,34,0.2)' :
                                                 'rgba(0,217,126,0.12)'),
                                    color: ((msg as any).transport === 'ble' ? '#ba68c8' :
                                            (msg as any).transport === 'wifi' ? '#3498db' :
                                            (msg as any).transport === 'lora' ? '#e67e22' :
                                            '#00D97E'),
                                    border: `1px solid ${((msg as any).transport === 'ble' ? 'rgba(155,89,182,0.3)' :
                                                        (msg as any).transport === 'wifi' ? 'rgba(52,152,219,0.3)' :
                                                        (msg as any).transport === 'lora' ? 'rgba(230,126,34,0.3)' :
                                                        'rgba(0,217,126,0.25)')}`,
                                    fontWeight: 700,
                                    fontFamily: 'JetBrains Mono, monospace',
                                    letterSpacing: '0.2px'
                                }}
                            >
                                {(msg as any).transport === 'ble' ? '📡 BLE' :
                                 (msg as any).transport === 'wifi' ? '📶 WiFi' :
                                 (msg as any).transport === 'lora' ? '📻 LoRa' :
                                 '🌐 WAN'}
                            </span>
                        )}
                        {starredMessages.includes(msg.id) && (
                            <span style={{ fontSize:'0.7rem' }}>⭐</span>
                        )}
                        {(msg as any).edited && (
                            <span style={{ fontSize:'0.66rem', color:'var(--text-muted)', fontStyle:'italic' }}>editado</span>
                        )}
                        <span style={{ fontSize:'0.66rem', color: isMine ? 'rgba(255,255,255,0.35)' : 'var(--text-muted)' }}>
                            {timeStr(msg.timestamp)}
                        </span>
                        {isMine && (
                            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                                <path d="M1 5L3.5 7.5L8 2" stroke={
                                    msg.status === 'Delivered' ? '#4FC3F7' :
                                    msg.status === 'Sent' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'
                                } strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                                {msg.status !== 'Pending' && (
                                    <path d="M5 5L7.5 7.5L12 2" stroke={
                                        msg.status === 'Delivered' ? '#4FC3F7' : 'rgba(255,255,255,0.5)'
                                    } strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                                )}
                            </svg>
                        )}
                    </div>

                    {/* Search highlight indicator */}
                    {isSearchHighlight && (
                        <div style={{ position:'absolute', inset:0, borderRadius:'inherit',
                            border:'2px solid rgba(255,210,0,0.8)', pointerEvents:'none',
                            boxShadow:'0 0 12px rgba(255,210,0,0.3)' }} />
                    )}

                    {/* Reactions */}
                    {hasReactions && (
                        <div className="msg-reactions">
                            {Object.entries(msg.reactions!).map(([em, ids]) => (
                                <button key={em}
                                    className={`msg-reaction-badge ${ids.includes('me') ? 'mine' : ''}`}
                                    onClick={() => onReaction(msg.id, em)}>
                                    {em}
                                    {ids.length > 1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{ids.length}</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Fullscreen Image Viewer Modal */}
            {viewingImageSrc && (
                <ImageViewerModal 
                    src={viewingImageSrc} 
                    onClose={() => setViewingImageSrc(null)} 
                />
            )}
        </React.Fragment>
    );
});

MessageBubble.displayName = "MessageBubble";
