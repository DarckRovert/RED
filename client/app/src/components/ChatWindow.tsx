"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { MessageItem } from "../lib/api";

export default function ChatWindow() {
    const { 
        activeConversationId, 
        conversations, 
        messages, 
        sendMessage, 
        goBack 
    } = useRedStore();

    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeConv = conversations.find(c => c.id === activeConversationId);
    const peerName = activeConv ? activeConv.peer : "Desconocido";
    const avatarLetter = peerName.substring(0, 1).toUpperCase();

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const [isRecording, setIsRecording] = useState(false);
    const [recordDuration, setRecordDuration] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startRecording = async () => {
        try {
            const { VoiceRecorder } = await import('capacitor-voice-recorder');
            const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
            if (!hasPermission.value) {
                const request = await VoiceRecorder.requestAudioRecordingPermission();
                if (!request.value) return;
            }
            
            await VoiceRecorder.startRecording();
            setIsRecording(true);
            setRecordDuration(0);
            timerRef.current = setInterval(() => {
                setRecordDuration(prev => prev + 1);
            }, 1000);
        } catch (e) {
            console.error("Failed to start recording:", e);
        }
    };

    const stopRecording = async () => {
        try {
            if (timerRef.current) clearInterval(timerRef.current);
            setIsRecording(false);
            
            const { VoiceRecorder } = await import('capacitor-voice-recorder');
            const result = await VoiceRecorder.stopRecording();
            
            if (result.value && result.value.recordDataBase64) {
                sendMessage("🎤 Nota de Voz", {
                    msg_type: "voice",
                    media_data: `data:${result.value.mimeType};base64,${result.value.recordDataBase64}`,
                    mime_type: result.value.mimeType,
                    duration_ms: result.value.msDuration
                });
            }
        } catch (e) {
            console.error("Failed to stop recording:", e);
        }
    };

    const handleLocation = async () => {
        try {
            const { Geolocation } = await import('@capacitor/geolocation');
            const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
            
            sendMessage("📍 Ubicación GPS", {
                msg_type: "location",
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            });
        } catch (e) {
            console.error("[RED] Geolocation failed", e);
        }
    };

    const handleSend = () => {
        if (!inputText.trim()) return;
        sendMessage(inputText.trim());
        setInputText("");
    };

    const handleCamera = async () => {
        try {
            const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Prompt,
                width: 1280
            });
            
            if (image.base64String) {
                const mimeType = `image/${image.format || 'jpeg'}`;
                sendMessage("📷 Foto Cifrada", {
                    msg_type: "image",
                    media_data: `data:${mimeType};base64,${image.base64String}`,
                    mime_type: mimeType
                });
            }
        } catch (e) {
            console.error("[RED] Camera cancelled/failed", e);
        }
    };
    const handlePoll = () => {
        const question = prompt("Pregunta de la Encuesta:");
        if (!question) return;
        const opt1 = prompt("Opción 1:");
        const opt2 = prompt("Opción 2:");
        if (!opt1 || !opt2) return;
        
        sendMessage("📊 Encuesta", {
            msg_type: "poll",
            poll_data: { question, options: [opt1, opt2], votes: [] }
        });
    };

    const toggleStar = (msgId: string) => {
        const el = document.getElementById(`msg-${msgId}-star`);
        if (el) el.style.color = el.style.color === 'var(--warning)' ? 'transparent' : 'var(--warning)';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)' }}>
            
            {/* Header (Solid UI) */}
            <header style={{ 
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '16px', 
                background: 'var(--solid-bg)', borderBottom: '1px solid var(--solid-border)', zIndex: 10 
            }}>
                <button 
                    onClick={goBack}
                    style={{ background: 'transparent', color: 'var(--primary)', fontSize: '1.4rem', padding: '4px 8px 4px 0' }}
                >
                    ←
                </button>
                
                <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--solid-highlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>
                    {avatarLetter}
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', margin: 0 }}>
                        {peerName}
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: '#4CAF50', margin: 0, fontWeight: 500 }}>en línea a través de P2P</p>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => useRedStore.getState().navigate('call')} style={{ background: 'transparent', color: 'var(--text-primary)', padding: '8px', fontSize: '1.2rem' }}>📞</button>
                    <button style={{ background: 'transparent', color: 'var(--text-primary)', padding: '8px', fontSize: '1.2rem' }}>⋮</button>
                </div>
            </header>

            {/* Message List */}
            <div className="no-scrollbar" style={{ 
                flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23162029\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")'
            }}>
                {messages.length === 0 && (
                    <div style={{ 
                        margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', 
                        background: 'var(--solid-highlight)', padding: '12px 20px', borderRadius: 12, 
                        fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' 
                    }}>
                        🔐 <strong>Cifrado P2P Completo</strong><br/>
                        Ningún servidor guarda esta conversación.
                    </div>
                )}
                
                {messages.map((msg, index) => {
                    const isMine = msg.is_mine;
                    // Detect if previous message is from same sender to group tails
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const isFirstInGroup = prevMsg ? prevMsg.is_mine !== isMine : true;
                    
                    return (
                        <div key={msg.id} style={{
                            display: 'flex', 
                            justifyContent: isMine ? 'flex-end' : 'flex-start',
                            width: '100%',
                            marginTop: isFirstInGroup ? '6px' : '0px'
                        }}>
                            <div style={{
                                maxWidth: '85%',
                                padding: '8px 12px',
                                borderRadius: '16px',
                                // Advanced Directional Tails
                                borderTopRightRadius: (isMine && isFirstInGroup) ? '16px' : (isMine ? '4px' : '16px'),
                                borderTopLeftRadius: (!isMine && isFirstInGroup) ? '16px' : (!isMine ? '4px' : '16px'),
                                borderBottomRightRadius: isMine ? '0px' : '16px',
                                borderBottomLeftRadius: !isMine ? '0px' : '16px',
                                
                                background: isMine ? '#0b5345' : 'var(--solid-highlight)', // True Solid Deep Green / Grey
                                color: 'var(--text-primary)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {msg.msg_type === 'image' && msg.media_data ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <img src={msg.media_data} alt="Adjunto Cifrado" style={{ width: '100%', borderRadius: '8px', objectFit: 'contain', maxHeight: '300px' }} />
                                        {msg.content !== "📷 Foto Cifrada" && <span style={{ wordBreak: 'break-word', fontSize: '1rem', lineHeight: '1.4' }}>{msg.content}</span>}
                                    </div>
                                ) : msg.msg_type === 'voice' && msg.media_data ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>🎤 Nota de Voz</span>
                                        <audio controls src={msg.media_data} style={{ width: '100%', height: '36px' }} />
                                    </div>
                                ) : msg.msg_type === 'location' && msg.latitude && msg.longitude ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '1.5rem' }}>📍</span>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Ubicación Cifrada</span>
                                                <span style={{ fontSize: '0.75rem', color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)' }}>
                                                    ±{Math.round(msg.accuracy || 0)}m de precisión
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => window.open(`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`, '_blank')}
                                            style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', color: '#3498db', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                                        >
                                            Ver Ubicación
                                        </button>
                                    </div>
                                ) : msg.msg_type === 'poll' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '220px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                            <span style={{ fontSize: '1.5rem' }}>📊</span>
                                            <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>{(msg as any).poll_data?.question || 'Encuesta P2P'}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {(msg as any).poll_data?.options?.map((opt: string, i: number) => (
                                                <button key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: 'inherit', textAlign: 'left', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                                                    <span>{opt}</span>
                                                    <span>0%</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <span style={{ wordBreak: 'break-word', fontSize: '1rem', lineHeight: '1.4' }}>{msg.content}</span>
                                )}
                                
                                <div style={{ 
                                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px',
                                    marginTop: '2px', fontSize: '0.7rem', color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' 
                                }}>
                                    <span id={`msg-${msg.id}-star`} style={{ color: 'transparent', transition: 'color 0.2s', marginRight: '4px', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => toggleStar(msg.id)}>⭐</span>
                                    {new Date(msg.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                    {isMine && (
                                        <span style={{ color: '#3498db', fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: '-2px' }}>
                                            ✓✓
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Capsular Area */}
            <footer style={{ 
                padding: '10px 14px', display: 'flex', gap: '8px', alignItems: 'flex-end', 
                background: 'var(--solid-bg)' 
            }}>
                {/* Replaces standard input mapping with Capsular Input */}
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-lifted)',
                    borderRadius: '24px', padding: '4px 6px', minHeight: '48px', overflow: 'hidden'
                }}>
                    <button style={{ padding: '8px 12px', color: 'var(--text-muted)', background: 'transparent', fontSize: '1.2rem' }}>😊</button>
                    
                    {isRecording ? (
                        <div style={{ flex: 1, color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
                            <span style={{ animation: 'pulse 1s infinite', marginRight: '8px' }}>🔴</span> Grabando... {Math.floor(recordDuration / 60)}:{(recordDuration % 60).toString().padStart(2, '0')}
                        </div>
                    ) : (
                        <input 
                            type="text" 
                            placeholder="Mensaje" 
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            style={{
                                flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)',
                                fontSize: '1.05rem', padding: '8px 4px', outline: 'none'
                            }} 
                        />
                    )}
                    
                    {!isRecording && (
                        <>
                            <button onClick={handlePoll} style={{ padding: '8px', color: 'var(--text-muted)', background: 'transparent', fontSize: '1.2rem' }}>📊</button>
                            <button onClick={handleLocation} style={{ padding: '8px', color: 'var(--text-muted)', background: 'transparent', fontSize: '1.2rem' }}>📍</button>
                            {inputText.length === 0 && (
                                <button onClick={handleCamera} style={{ padding: '8px 12px 8px 8px', color: 'var(--text-muted)', background: 'transparent', fontSize: '1.2rem' }}>📷</button>
                            )}
                        </>
                    )}
                </div>
                
                <button 
                    className={inputText.trim() ? "btn-primary animate-enter" : "animate-enter"}
                    onClick={inputText.trim() ? handleSend : (isRecording ? stopRecording : startRecording)}
                    style={{ 
                        width: 48, height: 48, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        background: inputText.trim() ? 'var(--primary)' : (isRecording ? 'var(--danger)' : 'var(--solid-highlight)'), 
                        color: 'white', fontSize: '1.2rem', flexShrink: 0,
                        transition: 'background 0.2s', border: 'none'
                    }}
                >
                    {inputText.trim() ? '➤' : (isRecording ? '⏹' : '🎤')}
                </button>
            </footer>
        </div>
    );
}
