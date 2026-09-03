import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { MessageItem } from "../../lib/api";
import { useRedStore } from "../../store/useRedStore";
import { LocalAIEngine } from "../../lib/localAiEngine";
import { translateTextAI } from "../../api/ai";
import { toast } from "../Toast";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { TacticalEmojiPicker } from "./TacticalEmojiPicker";

export interface ChatInputProps {
    inputText?: string;
    setInputText?: (text: string) => void;
    handleSend?: () => void;
    onSendMessage?: (text: string, replyToMsg?: MessageItem | null) => Promise<void> | void;
    onSendVoice?: (blob?: Blob) => void;
    sendTyping?: () => void;
    attachOpen?: boolean;
    setAttachOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    replyTo?: MessageItem | null;
    setReplyTo?: (msg: MessageItem | null) => void;
    editingMsg?: MessageItem | null;
    setEditingMsg?: (msg: MessageItem | null) => void;
    peerName?: string;
    peerHash?: string;
    burnTimer?: number;
    isRecording?: boolean;
    recordSec?: number;
    startRecording?: () => void;
    stopRecording?: () => void;
    cancelRecording?: () => void;
    handleCamera?: () => void;
    handleGallery?: () => void;
    handleDocument?: () => void;
    handleLocation?: () => void;
    handlePay?: () => void;
    setShowPollModal?: (show: boolean) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputText, setInputText, handleSend, onSendMessage, onSendVoice, sendTyping,
    attachOpen, setAttachOpen, replyTo, setReplyTo, editingMsg, setEditingMsg, peerName, peerHash, burnTimer,
    isRecording = false, recordSec = 0,
    startRecording = () => {}, stopRecording = () => {}, cancelRecording = () => {},
    handleCamera = () => {}, handleGallery = () => {}, handleDocument = () => {},
    handleLocation = () => {}, handlePay = () => {}, setShowPollModal = () => {}
}) => {
    const { t } = useTranslation();
    const { contacts } = useRedStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [localText, setLocalText] = useState("");
    const [localAttachOpen, setLocalAttachOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [multiline, setMultiline] = useState(false);
    const [isHandsFree, setIsHandsFree] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const lastTypingSentRef = useRef<number>(0);
    const mentionStartPos = useRef<number>(-1);

    const triggerTyping = useCallback(() => {
        const now = Date.now();
        if (now - lastTypingSentRef.current >= 3000) {
            lastTypingSentRef.current = now;
            sendTyping?.();
        }
    }, [sendTyping]);

    // Derive mention suggestions from store contacts filtered by mentionQuery
    const mentionSuggestions = useMemo(() => {
        if (!mentionQuery && mentionQuery !== "") return [];
        const q = (mentionQuery || "").toLowerCase();
        return (contacts || [])
            .filter(c => {
                const name = (c.display_name || c.name || (c as any).nickname || c.identity_hash || "").toLowerCase();
                return name.startsWith(q) || name.includes(q);
            })
            .slice(0, 6);
    }, [mentionQuery, contacts]);

    const text = inputText !== undefined ? inputText : localText;
    const setText = setInputText || setLocalText;
    const textRef = useRef(text);
    textRef.current = text;

    const isAttachOpen = attachOpen !== undefined ? attachOpen : localAttachOpen;
    const setIsAttachOpen = setAttachOpen || setLocalAttachOpen;

    const [aiMenuOpen, setAiMenuOpen] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [isDictating, setIsDictating] = useState(false);
    const baseTextBeforeDictationRef = useRef<string>("");
    const finalAccumulatedRef = useRef<string>("");

    useEffect(() => {
        return () => {
            import("../../lib/ai").then(({ TacticalSpeechEngine }) => {
                if (TacticalSpeechEngine.isListening()) {
                    TacticalSpeechEngine.stopListening();
                }
            }).catch(() => {});
        };
    }, []);

    const toggleDictation = async () => {
        const { TacticalSpeechEngine } = await import("../../lib/ai");
        if (!TacticalSpeechEngine.isSttSupported()) {
            toast.warning("Dictado por voz no disponible en este dispositivo");
            return;
        }

        if (isDictating) {
            TacticalSpeechEngine.stopListening();
            setIsDictating(false);
            toast.info("Dictado finalizado");
        } else {
            baseTextBeforeDictationRef.current = (textRef.current || "").trim();
            finalAccumulatedRef.current = "";

            const ok = TacticalSpeechEngine.startListening({
                lang: "es-ES",
                onStart: () => {
                    setIsDictating(true);
                    toast.info("🎙️ Escuchando dictado en vivo...");
                },
                onResult: (transcript, isFinal) => {
                    if (!transcript) return;
                    const base = baseTextBeforeDictationRef.current;

                    if (isFinal) {
                        const prevFinal = finalAccumulatedRef.current;
                        finalAccumulatedRef.current = prevFinal ? `${prevFinal} ${transcript}` : transcript;
                        const full = base ? `${base} ${finalAccumulatedRef.current}` : finalAccumulatedRef.current;
                        setText(full);
                    } else {
                        const committed = finalAccumulatedRef.current;
                        const prefix = (base && committed) ? `${base} ${committed}` : (base || committed);
                        const full = prefix ? `${prefix} ${transcript}` : transcript;
                        setText(full);
                    }
                },
                onError: (err: any) => {
                    setIsDictating(false);
                    console.warn("[ChatInput] Dictation error:", err);
                },
                onEnd: () => {
                    setIsDictating(false);
                }
            });
            if (!ok) {
                setIsDictating(false);
            }
        }
    };

    const handleAiRephraseTactical = async () => {
        if (!text.trim()) return;
        setIsAiProcessing(true);
        try {
            const res = await LocalAIEngine.rephraseText(text.trim(), 'sitrep');
            setText(res.rephrasedText);
            setAiMenuOpen(false);
            toast.success("✨ Mensaje transformado a formato táctico");
        } catch {
            toast.error("Error al transformar formato");
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleAiTranslateEn = async () => {
        if (!text.trim()) return;
        setIsAiProcessing(true);
        try {
            const res = await translateTextAI(text.trim(), 'en');
            setText(res.translated_text);
            setAiMenuOpen(false);
            toast.success("🌐 Mensaje traducido al inglés con IA");
        } catch {
            toast.error("Error al traducir mensaje");
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleAiTranslateEs = async () => {
        if (!text.trim()) return;
        setIsAiProcessing(true);
        try {
            const res = await translateTextAI(text.trim(), 'es');
            setText(res.translated_text);
            setAiMenuOpen(false);
            toast.success("🌐 Mensaje traducido al español con IA");
        } catch {
            toast.error("Error al traducir mensaje");
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleAiUrgent = async () => {
        if (!text.trim()) return;
        setIsAiProcessing(true);
        try {
            const res = await LocalAIEngine.rephraseText(text.trim(), 'urgent');
            setText(res.rephrasedText);
            setAiMenuOpen(false);
            toast.success("🚨 Mensaje transformado a alerta urgente");
        } catch {
            toast.error("Error al transformar a urgente");
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleAiGrammar = async () => {
        if (!text.trim()) return;
        setIsAiProcessing(true);
        try {
            const res = await LocalAIEngine.rephraseText(text.trim(), 'grammar');
            setText(res.rephrasedText);
            setAiMenuOpen(false);
            toast.success("✏️ Corrección gramatical aplicada");
        } catch {
            toast.error("Error al corregir texto");
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleAiCamouflage = () => {
        if (!text.trim()) return;
        const camouflaged = text
            .replace(/a/gi, '4')
            .replace(/e/gi, '3')
            .replace(/i/gi, '1')
            .replace(/o/gi, '0')
            .replace(/s/gi, '5');
        setText(camouflaged);
        setAiMenuOpen(false);
        toast.success("🛡️ Mensaje ofuscado con camuflaje militar");
    };

    // insertMention declared AFTER setText so the dependency is satisfied
    const insertMention = useCallback((name: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const pos = mentionStartPos.current;
        const current = ta.value;
        const before = current.substring(0, pos);
        const after = current.substring(ta.selectionEnd);
        const newVal = `${before}@${name} ${after}`;
        setText(newVal);
        setMentionQuery(null);
        mentionStartPos.current = -1;
        setTimeout(() => {
            ta.focus();
            const cursor = before.length + name.length + 2; // @name<space>
            ta.setSelectionRange(cursor, cursor);
        }, 10);
    }, [setText]);

    // Draft Persistence: Load draft on mount / peerHash change
    const draftKey = peerHash ? `red_draft_${peerHash}` : null;

    useEffect(() => {
        if (!draftKey || typeof window === "undefined") return;
        try {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft && !editingMsg && !text) {
                setText(savedDraft);
            }
        } catch {}
    }, [draftKey]);

    // Save draft debounced on text change
    useEffect(() => {
        if (!draftKey || typeof window === "undefined" || editingMsg) return;
        const timer = setTimeout(() => {
            try {
                if (text && text.trim().length > 0) {
                    localStorage.setItem(draftKey, text);
                } else {
                    localStorage.removeItem(draftKey);
                }
            } catch {}
        }, 300);
        return () => clearTimeout(timer);
    }, [text, draftKey, editingMsg]);

    useEffect(() => {
        if (editingMsg) {
            setText(editingMsg.content || "");
            textareaRef.current?.focus();
        }
    }, [editingMsg, setText]);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        const maxH = 20 * 5 + 20;
        const newH = Math.min(ta.scrollHeight, maxH);
        ta.style.height = newH + "px";
        ta.style.overflowY = ta.scrollHeight > maxH ? "auto" : "hidden";
        setMultiline(newH > 40);
    }, [text]);

    const onSend = useCallback(() => {
        if (!text.trim()) return;
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            try { navigator.vibrate(12); } catch {}
        }
        if (onSendMessage) onSendMessage(text.trim(), replyTo);
        else if (handleSend) handleSend();
        setText("");
        setMultiline(false);
        if (draftKey && typeof window !== "undefined") {
            try { localStorage.removeItem(draftKey); } catch {}
        }
        if (setReplyTo) setReplyTo(null);
        if (setEditingMsg) setEditingMsg(null);
        const ta = textareaRef.current;
        if (ta) { ta.style.height = "auto"; ta.style.overflowY = "hidden"; }
    }, [text, onSendMessage, handleSend, setText, replyTo, setReplyTo, setEditingMsg, draftKey]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
    };

    const formatTimer = (s: number) => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min}:${sec < 10 ? "0" : ""}${sec}`;
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", background: "rgba(10,12,22,0.98)", borderTop: "1px solid var(--glass-border)", zIndex: 30 }}>
            {/* ── Reply Quote Banner Bar ── */}
            {replyTo && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 16px",
                    background: "rgba(0, 229, 255, 0.08)",
                    borderLeft: "4px solid var(--accent-cyan)",
                    borderBottom: "1px solid var(--glass-border)",
                    animation: "fadeIn 0.15s ease-out"
                }}>
                    <div style={{ overflow: "hidden", paddingRight: "10px" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                            ↩️ Respondiendo a {replyTo.is_mine ? "ti mismo" : (peerName || "Operador")}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {replyTo.content || `[${replyTo.msg_type || "Medio"}]`}
                        </div>
                    </div>
                    <button
                        onClick={() => setReplyTo?.(null)}
                        className="btn-icon"
                        style={{ width: 28, height: 28, fontSize: "0.85rem", flexShrink: 0 }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ── Editing Message Banner Bar ── */}
            {editingMsg && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 16px",
                    background: "rgba(255, 179, 0, 0.10)",
                    borderLeft: "4px solid var(--accent-amber)",
                    borderBottom: "1px solid var(--glass-border)",
                    animation: "fadeIn 0.15s ease-out"
                }}>
                    <div style={{ overflow: "hidden", paddingRight: "10px" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-amber)" }}>
                            ✏️ Editando mensaje
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {editingMsg.content}
                        </div>
                    </div>
                    <button
                        onClick={() => { setEditingMsg?.(null); setText(""); }}
                        className="btn-icon"
                        style={{ width: 28, height: 28, fontSize: "0.85rem", flexShrink: 0 }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ── Attachments Bar (WhatsApp-style Clean Primary Actions + Tactical Expander) ── */}
            {isAttachOpen && (
                <div style={{
                    display: "flex", flexDirection: "column", gap: "8px", padding: "12px 16px",
                    background: "rgba(14,16,28,0.98)", borderBottom: "1px solid var(--glass-border)",
                    flexShrink: 0
                }}>
                    {/* Primary Everyday Actions */}
                    <div style={{
                        display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "4px",
                        scrollbarWidth: "none"
                    }}>
                        {[
                            { icon: "📷", label: "Cámara", bg: "linear-gradient(135deg, #EC407A, #D81B60)", action: () => { setIsAttachOpen(false); handleCamera(); } },
                            { icon: "🖼️", label: "Galería", bg: "linear-gradient(135deg, #AB47BC, #8E24AA)", action: () => { setIsAttachOpen(false); handleGallery(); } },
                            { icon: "📄", label: "Documento", bg: "linear-gradient(135deg, #5C6BC0, #3949AB)", action: () => { setIsAttachOpen(false); handleDocument(); } },
                            { icon: "📍", label: "Ubicación", bg: "linear-gradient(135deg, #26A69A, #00897B)", action: () => { setIsAttachOpen(false); handleLocation(); } },
                            { icon: "📊", label: "Encuesta", bg: "linear-gradient(135deg, #FFA726, #FB8C00)", action: () => { setIsAttachOpen(false); setShowPollModal(true); } },
                            { icon: "💸", label: "Pagar RED", bg: "linear-gradient(135deg, #00E5FF, #00B0FF)", action: () => { setIsAttachOpen(false); handlePay(); } },
                            { icon: "🎛️", label: "Táctico", bg: "rgba(255,255,255,0.1)", action: () => { setAiMenuOpen(!aiMenuOpen); } },
                        ].map(a => (
                            <button
                                key={a.label}
                                onClick={a.action}
                                style={{
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: "5px",
                                    background: "transparent", border: "none", color: "#fff", cursor: "pointer",
                                    flexShrink: 0, minWidth: "56px"
                                }}
                            >
                                <div style={{
                                    width: 44, height: 44, borderRadius: "50%", background: a.bg,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "1.2rem", boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                                }}>
                                    {a.icon}
                                </div>
                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>{a.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Collapsible Tactical Tools Sub-row */}
                    {aiMenuOpen && (
                        <div style={{
                            display: "flex", gap: "8px", overflowX: "auto", paddingTop: "8px",
                            borderTop: "1px solid rgba(255,255,255,0.08)", scrollbarWidth: "none",
                            animation: "fadeIn 0.2s ease-out"
                        }}>
                            {[
                                { icon: "🤖", label: "Copiloto IA", action: () => { setIsAttachOpen(false); if (typeof window !== "undefined") { const store = require("../../store/useRedStore").useRedStore.getState(); store.navigate("aiCopilot"); } } },
                                { icon: "🫀", label: "Ficha VitalScan", action: () => { setIsAttachOpen(false); if (typeof window !== "undefined") { const store = require("../../store/useRedStore").useRedStore.getState(); store.navigate("vitalScan"); } } },
                                { icon: "🔊", label: "SoundMesh Audio", action: () => {
                                    setIsAttachOpen(false);
                                    if (text.trim()) {
                                        import("../../lib/audio/SoundMeshEngine").then(({ SoundMeshEngine }) => {
                                            SoundMeshEngine.transmit(text.trim());
                                            toast.success("🔊 Transmitiendo por SoundMesh FSK");
                                        });
                                    } else {
                                        toast.info("✍️ Escribe un mensaje primero para emitirlo");
                                    }
                                } },
                                { icon: "🎞️", label: "QR Air-Gap", action: () => { setIsAttachOpen(false); if (typeof window !== "undefined") { const store = require("../../store/useRedStore").useRedStore.getState(); store.navigate("airGapStego"); } } },
                                { icon: "🖼️", label: "Esteganografía LSB", action: () => { setIsAttachOpen(false); if (typeof window !== "undefined") { const store = require("../../store/useRedStore").useRedStore.getState(); store.navigate("stegoVault"); } } },
                            ].map(t => (
                                <button
                                    key={t.label}
                                    onClick={t.action}
                                    className="btn-tactical-secondary"
                                    style={{
                                        padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px",
                                        fontSize: "0.74rem", whiteSpace: "nowrap", flexShrink: 0
                                    }}
                                >
                                    <span>{t.icon}</span>
                                    <span>{t.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Main Input & Voice Recording Area ── */}
            <div style={{
                display: "flex", alignItems: "flex-end", gap: "8px",
                padding: "8px 12px", minHeight: "56px",
                position: "relative"
            }}>
                {isRecording ? (
                    /* Tactical Recording Mode with Hands-Free Lock */
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        flex: 1, height: "44px", padding: "0 14px",
                        background: "rgba(232,33,58,0.14)", border: "1.5px solid rgba(232,33,58,0.45)",
                        borderRadius: "24px", animation: "pulse 1.5s infinite"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF3355", boxShadow: "0 0 10px #FF3355" }} />
                            <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                {formatTimer(recordSec)}
                            </span>
                            {/* Visualizador de audio animado en vivo */}
                            <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "16px" }}>
                                {[7, 14, 9, 16, 8, 13, 15, 6].map((h, idx) => (
                                    <span
                                        key={idx}
                                        style={{
                                            width: "3px",
                                            height: `${h}px`,
                                            borderRadius: "2px",
                                            background: "#FF3355",
                                            display: "inline-block",
                                            animation: `pulse ${(0.35 + (idx % 4) * 0.15).toFixed(2)}s ease-in-out infinite alternate`,
                                            boxShadow: "0 0 4px rgba(255, 51, 85, 0.4)"
                                        }}
                                    />
                                ))}
                            </div>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                {isHandsFree ? "🔒 Manos libres activo" : "🎙️ Grabando audio P2P..."}
                            </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                                onClick={() => { setIsHandsFree(!isHandsFree); }}
                                className="btn-icon"
                                style={{ width: 32, height: 32, fontSize: "0.85rem", color: isHandsFree ? "var(--accent-cyan)" : "var(--text-muted)" }}
                                title="Modo manos libres"
                            >
                                {isHandsFree ? "🔓" : "🔒"}
                            </button>
                            <button
                                onClick={cancelRecording}
                                className="btn-icon"
                                style={{ width: 34, height: 34, fontSize: "0.90rem", color: "#FF5252" }}
                                title="Descartar grabación"
                            >
                                🗑️
                            </button>
                            <button
                                onClick={stopRecording}
                                className="btn-icon"
                                style={{ width: 36, height: 36, fontSize: "1rem", background: "var(--primary)", color: "#fff", boxShadow: "0 0 12px rgba(232,33,58,0.4)" }}
                                title="Enviar audio"
                            >
                                📤
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Standard Chat Input Mode */
                    <>
                        <button
                            onClick={() => setIsAttachOpen(!isAttachOpen)}
                            className={`btn-icon ${isAttachOpen ? "active" : ""}`}
                            style={{ width: 38, height: 38, fontSize: "1.15rem", flexShrink: 0 }}
                            title="Adjuntar multimedia"
                        >
                            📎
                        </button>

                        <button
                            onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                            className={`btn-icon ${emojiPickerOpen ? "active" : ""}`}
                            style={{
                                width: 38,
                                height: 38,
                                fontSize: "1.15rem",
                                flexShrink: 0,
                                color: emojiPickerOpen ? "var(--accent-cyan)" : "var(--text-secondary)",
                                background: emojiPickerOpen ? "rgba(0, 229, 255, 0.15)" : "transparent",
                                borderRadius: "50%",
                                transition: "all 0.15s ease",
                            }}
                            title="Símbolos & Emojis Tácticos"
                        >
                            😊
                        </button>

                        <div style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid var(--glass-border)",
                            borderRadius: multiline ? "16px" : "24px",
                            padding: "6px 14px",
                            minHeight: "40px",
                        }}>
                            <textarea
                                ref={textareaRef}
                                value={text}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setText(val);
                                    if (val.trim().length > 0) triggerTyping();

                                    // @ mention detection: find last '@' before cursor
                                    const cursor = e.target.selectionStart ?? val.length;
                                    const slice = val.substring(0, cursor);
                                    const atIdx = slice.lastIndexOf("@");
                                    if (atIdx !== -1) {
                                        const word = slice.substring(atIdx + 1);
                                        // Only trigger if no space between @ and cursor
                                        if (!/\s/.test(word)) {
                                            mentionStartPos.current = atIdx;
                                            setMentionQuery(word);
                                        } else {
                                            setMentionQuery(null);
                                        }
                                    } else {
                                        setMentionQuery(null);
                                    }
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={isDictating ? "🎙️ Escuchando dictado en vivo..." : (burnTimer ? `Burn message (${burnTimer}s)...` : t('chat.type_message'))}
                                rows={1}
                                style={{
                                    width: "100%",
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                    color: "#fff",
                                    fontSize: "0.90rem",
                                    resize: "none",
                                    maxHeight: "120px",
                                    fontFamily: "inherit",
                                    lineHeight: "1.4",
                                }}
                            />
                        </div>

                        {/* ── @Mention Autocomplete Popup ── */}
                        {mentionSuggestions.length > 0 && mentionQuery !== null && (
                            <div style={{
                                position: "absolute",
                                bottom: "calc(100% + 4px)",
                                left: 52,
                                right: 52,
                                background: "rgba(14,16,30,0.98)",
                                backdropFilter: "blur(16px)",
                                border: "1px solid rgba(0,229,255,0.25)",
                                borderRadius: "12px",
                                overflow: "hidden",
                                boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
                                zIndex: 200,
                                animation: "fadeIn 0.12s ease"
                            }}>
                                {mentionSuggestions.map((c: any) => {
                                    const name = c.display_name || c.name || c.nickname || (c.identity_hash ? c.identity_hash.substring(0, 8) : "Operador");
                                    return (
                                        <button
                                            key={c.identity_hash || c.id || name}
                                            onMouseDown={(e) => {
                                                e.preventDefault(); // keep focus in textarea
                                                insertMention(name);
                                            }}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "10px",
                                                width: "100%", padding: "10px 14px",
                                                background: "transparent", border: "none",
                                                color: "#fff", cursor: "pointer",
                                                fontSize: "0.85rem", fontWeight: 600,
                                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                                                textAlign: "left", transition: "background 0.1s"
                                            }}
                                            onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(0,229,255,0.1)")}
                                            onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                                        >
                                            <span style={{
                                                width: 28, height: 28, borderRadius: "50%",
                                                background: "rgba(232,33,58,0.25)",
                                                border: "1px solid rgba(232,33,58,0.4)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: "0.75rem", fontWeight: 900, color: "var(--accent-red, #E8213A)",
                                                flexShrink: 0
                                            }}>
                                                {name.charAt(0).toUpperCase()}
                                            </span>
                                            <span>@{name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── AI Assist Popover & Trigger Button ── */}
                        {text.trim().length > 0 && (
                            <div style={{ position: "relative" }}>
                                <button
                                    onClick={() => setAiMenuOpen(!aiMenuOpen)}
                                    className="btn-icon"
                                    style={{
                                        width: 38, height: 38, borderRadius: "50%",
                                        fontSize: "1rem", color: "var(--accent-cyan)",
                                        background: aiMenuOpen ? "rgba(0,229,255,0.2)" : "rgba(255,255,255,0.06)",
                                        flexShrink: 0, border: "1px solid rgba(0,229,255,0.3)",
                                        transition: "all 0.2s ease"
                                    }}
                                    title="Asistente de Redacción IA"
                                >
                                    ✨
                                </button>
                                {aiMenuOpen && (
                                    <>
                                        <div onClick={() => setAiMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 120 }} />
                                        <div style={{
                                            position: "absolute", bottom: "46px", right: 0, zIndex: 130,
                                            background: "rgba(14, 18, 34, 0.98)", backdropFilter: "blur(20px)",
                                            border: "1px solid rgba(0, 229, 255, 0.3)",
                                            borderRadius: "14px", padding: "6px", width: "220px",
                                            boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.7)",
                                            animation: "fadeIn 0.15s ease", display: "flex", flexDirection: "column", gap: "2px"
                                        }}>
                                            <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--accent-cyan)", padding: "4px 8px", fontFamily: "JetBrains Mono, monospace" }}>
                                                ✨ ASISTENTE IA DE REDACCIÓN
                                            </div>
                                            <button
                                                onClick={toggleDictation}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "8px",
                                                    padding: "8px 10px", borderRadius: "8px", background: isDictating ? "rgba(0,229,255,0.2)" : "transparent",
                                                    border: "none", color: "var(--accent-cyan)", fontSize: "0.80rem", fontWeight: 600,
                                                    cursor: "pointer", textAlign: "left"
                                                }}
                                                onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(0,229,255,0.1)")}
                                                onMouseLeave={ev => (ev.currentTarget.style.background = isDictating ? "rgba(0,229,255,0.2)" : "transparent")}
                                            >
                                                <span>🎙️</span>
                                                <span>{isDictating ? "Detener Dictado" : "Dictado por Voz"}</span>
                                            </button>
                                            <button
                                                onClick={handleAiRephraseTactical}
                                                disabled={isAiProcessing}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "8px",
                                                    padding: "8px 10px", borderRadius: "8px", background: "transparent",
                                                    border: "none", color: "#FFFFFF", fontSize: "0.80rem", fontWeight: 600,
                                                    cursor: "pointer", textAlign: "left"
                                                }}
                                                onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(0,229,255,0.1)")}
                                                onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                                            >
                                                <span>🎯</span>
                                                <span>{isAiProcessing ? "Procesando..." : "Formato Táctico Militar"}</span>
                                            </button>
                                            <button
                                                onClick={handleAiTranslateEn}
                                                disabled={isAiProcessing}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "8px",
                                                    padding: "8px 10px", borderRadius: "8px", background: "transparent",
                                                    border: "none", color: "#FFFFFF", fontSize: "0.80rem", fontWeight: 600,
                                                    cursor: "pointer", textAlign: "left"
                                                }}
                                                onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(0,229,255,0.1)")}
                                                onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                                            >
                                                <span>🇬🇧</span>
                                                <span>{isAiProcessing ? "Traduciendo..." : "Traducir a Inglés"}</span>
                                            </button>
                                            <button
                                                onClick={handleAiTranslateEs}
                                                disabled={isAiProcessing}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "8px",
                                                    padding: "8px 10px", borderRadius: "8px", background: "transparent",
                                                    border: "none", color: "#FFFFFF", fontSize: "0.80rem", fontWeight: 600,
                                                    cursor: "pointer", textAlign: "left"
                                                }}
                                                onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(0,229,255,0.1)")}
                                                onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                                            >
                                                <span>🇪🇸</span>
                                                <span>{isAiProcessing ? "Traduciendo..." : "Traducir a Español"}</span>
                                            </button>
                                            <button
                                                onClick={handleAiUrgent}
                                                disabled={isAiProcessing}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "8px",
                                                    padding: "8px 10px", borderRadius: "8px", background: "transparent",
                                                    border: "none", color: "#FFFFFF", fontSize: "0.80rem", fontWeight: 600,
                                                    cursor: "pointer", textAlign: "left"
                                                }}
                                                onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(255,51,85,0.12)")}
                                                onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                                            >
                                                <span>🚨</span>
                                                <span>Alerta de Máxima Urgencia</span>
                                            </button>
                                            <button
                                                onClick={handleAiGrammar}
                                                disabled={isAiProcessing}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "8px",
                                                    padding: "8px 10px", borderRadius: "8px", background: "transparent",
                                                    border: "none", color: "#FFFFFF", fontSize: "0.80rem", fontWeight: 600,
                                                    cursor: "pointer", textAlign: "left"
                                                }}
                                                onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(0,229,255,0.1)")}
                                                onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                                            >
                                                <span>✏️</span>
                                                <span>Corrección Gramatical</span>
                                            </button>
                                            <button
                                                onClick={handleAiCamouflage}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "8px",
                                                    padding: "8px 10px", borderRadius: "8px", background: "transparent",
                                                    border: "none", color: "var(--accent-amber)", fontSize: "0.80rem", fontWeight: 600,
                                                    cursor: "pointer", textAlign: "left"
                                                }}
                                                onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(255,179,0,0.1)")}
                                                onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                                            >
                                                <span>🛡️</span>
                                                <span>Camuflaje Leetspeak</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {text.trim() ? (
                            <button
                                onClick={onSend}
                                className="btn-tactical-primary"
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "1.1rem",
                                    padding: 0,
                                    flexShrink: 0,
                                }}
                                title="Enviar mensaje"
                            >
                                ➔
                            </button>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <button
                                    onClick={toggleDictation}
                                    className="btn-icon"
                                    style={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: "50%",
                                        fontSize: "1.1rem",
                                        background: isDictating ? "rgba(0, 229, 255, 0.25)" : "rgba(255,255,255,0.06)",
                                        border: isDictating ? "1px solid var(--accent-cyan)" : "1px solid rgba(255,255,255,0.1)",
                                        color: isDictating ? "var(--accent-cyan)" : "#FFFFFF",
                                        flexShrink: 0,
                                        animation: isDictating ? "pulse 1s infinite alternate" : "none"
                                    }}
                                    title={isDictating ? "Detener dictado por voz" : "Dictar mensaje por voz"}
                                >
                                    {isDictating ? "🔴" : "🗣️"}
                                </button>
                                <button
                                    onClick={startRecording}
                                    className="btn-icon"
                                    style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: "50%",
                                        fontSize: "1.2rem",
                                        background: "rgba(255,255,255,0.08)",
                                        flexShrink: 0,
                                    }}
                                    title="Grabar nota de voz"
                                >
                                    🎙️
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Tactical Emoji Picker Popover */}
            <TacticalEmojiPicker
                isOpen={emojiPickerOpen}
                onClose={() => setEmojiPickerOpen(false)}
                onSelectEmoji={(emoji) => {
                    const ta = textareaRef.current;
                    if (ta) {
                        const start = ta.selectionStart || text.length;
                        const end = ta.selectionEnd || text.length;
                        const updated = text.substring(0, start) + emoji + text.substring(end);
                        setText(updated);
                        setTimeout(() => {
                            ta.focus();
                            const newPos = start + emoji.length;
                            ta.setSelectionRange(newPos, newPos);
                        }, 10);
                    } else {
                        setText(text + emoji);
                    }
                }}
            />
        </div>
    );
};
