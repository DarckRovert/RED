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
    handleAudio?: () => void;
    handleDocument?: () => void;
    handleLocation?: () => void;
    handleShareContact?: () => void;
    handlePay?: () => void;
    setShowPollModal?: (show: boolean) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputText, setInputText, handleSend, onSendMessage, onSendVoice, sendTyping,
    attachOpen, setAttachOpen, replyTo, setReplyTo, editingMsg, setEditingMsg, peerName, peerHash, burnTimer,
    isRecording = false, recordSec = 0,
    startRecording = () => {}, stopRecording = () => {}, cancelRecording = () => {},
    handleCamera = () => {}, handleGallery = () => {}, handleAudio = () => {}, handleDocument = () => {},
    handleLocation = () => {}, handleShareContact = () => {}, handlePay = () => {}, setShowPollModal = () => {}
}) => {
    const { t } = useTranslation();
    const { contacts, preferences } = useRedStore();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') !== 'tactical';
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
        if (e.key === "Enter" && !e.shiftKey) {
            if (preferences?.enterIsSend !== false) {
                e.preventDefault();
                onSend();
            }
        }
    };

    const formatTimer = (s: number) => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min}:${sec < 10 ? "0" : ""}${sec}`;
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            background: isFamiliar ? "#202C33" : "rgba(10,12,22,0.98)",
            borderTop: isFamiliar ? "1px solid rgba(255,255,255,0.06)" : "1px solid var(--glass-border)",
            zIndex: 100,
            position: "relative"
        }}>
            {/* ── Reply Quote Banner Bar ── */}
            {replyTo && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 16px",
                    background: isFamiliar ? "#182229" : "rgba(0, 229, 255, 0.08)",
                    borderLeft: `4px solid ${isFamiliar ? "#00A884" : "var(--accent-cyan)"}`,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    animation: "fadeIn 0.15s ease-out"
                }}>
                    <div style={{ overflow: "hidden", paddingRight: "10px" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: isFamiliar ? "#00A884" : "var(--accent-cyan)" }}>
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

            {/* ── Attachments Floating Popover Card ── */}
            {isAttachOpen && (
                <>
                    <div
                        onClick={() => setIsAttachOpen(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 110 }}
                    />
                    <div
                        className="animate-fade-scale"
                        style={{
                            position: "absolute",
                            bottom: "calc(100% + 8px)",
                            left: "12px",
                            maxWidth: "380px",
                            width: "calc(100% - 24px)",
                            background: isFamiliar ? "#233138" : "rgba(14,18,34,0.98)",
                            backdropFilter: "blur(24px)",
                            WebkitBackdropFilter: "blur(24px)",
                            borderRadius: "20px",
                            padding: "16px",
                            border: isFamiliar ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--glass-border)",
                            boxShadow: isFamiliar
                                ? "0 16px 48px rgba(0,0,0,0.65)"
                                : "0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,229,255,0.06)",
                            zIndex: 115,
                            transformOrigin: "bottom left",
                            display: "flex",
                            flexDirection: "column",
                            gap: "14px"
                        }}
                    >
                        {/* Primary Everyday Actions Grid (4 columns WhatsApp style) */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: "14px 6px",
                            justifyItems: "center"
                        }}>
                            {[
                                { icon: "📄", label: "Documento", bg: "linear-gradient(135deg, #5F66CD, #5157C4)", shadow: "rgba(95,102,205,0.5)", action: () => { setIsAttachOpen(false); handleDocument(); } },
                                { icon: "📷", label: "Cámara", bg: "linear-gradient(135deg, #D3396D, #BE2D5E)", shadow: "rgba(211,57,109,0.5)", action: () => { setIsAttachOpen(false); handleCamera(); } },
                                { icon: "🖼️", label: "Galería", bg: "linear-gradient(135deg, #AC44CF, #9732B8)", shadow: "rgba(172,68,207,0.5)", action: () => { setIsAttachOpen(false); handleGallery(); } },
                                { icon: "🎵", label: "Audio", bg: "linear-gradient(135deg, #F07F26, #E06615)", shadow: "rgba(240,127,38,0.5)", action: () => { setIsAttachOpen(false); handleAudio(); } },
                                { icon: "📍", label: "Ubicación", bg: "linear-gradient(135deg, #069F7B, #008767)", shadow: "rgba(6,159,123,0.5)", action: () => { setIsAttachOpen(false); handleLocation(); } },
                                { icon: "👤", label: "Contacto", bg: "linear-gradient(135deg, #029AD4, #0280B3)", shadow: "rgba(2,154,212,0.5)", action: () => { setIsAttachOpen(false); handleShareContact(); } },
                                { icon: "📊", label: "Encuesta", bg: "linear-gradient(135deg, #00A389, #008F79)", shadow: "rgba(0,163,137,0.5)", action: () => { setIsAttachOpen(false); setShowPollModal(true); } },
                                { icon: "💸", label: "Pagar RED", bg: "linear-gradient(135deg, #00B0FF, #0091EA)", shadow: "rgba(0,176,255,0.5)", action: () => { setIsAttachOpen(false); handlePay(); } },
                            ].map((a, i) => (
                                <button
                                    key={a.label}
                                    onClick={a.action}
                                    className="attach-action-btn"
                                    style={{
                                        display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                                        background: "transparent", border: "none", color: "#fff", cursor: "pointer",
                                        width: "70px",
                                        animation: `contact-item-enter 0.25s ease both`,
                                        animationDelay: `${i * 30}ms`,
                                        touchAction: "manipulation",
                                        pointerEvents: "auto"
                                    }}
                                >
                                    <div style={{
                                        width: 48, height: 48, borderRadius: "50%", background: a.bg,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "1.25rem",
                                        boxShadow: `0 4px 16px ${a.shadow}`,
                                        transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease",
                                    }}
                                        onMouseEnter={ev => { (ev.currentTarget as HTMLDivElement).style.transform = "scale(1.12)"; (ev.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${a.shadow}`; }}
                                        onMouseLeave={ev => { (ev.currentTarget as HTMLDivElement).style.transform = "scale(1)"; (ev.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px ${a.shadow}`; }}
                                    >
                                        {a.icon}
                                    </div>
                                    <span style={{ fontSize: "0.72rem", color: isFamiliar ? "#D1D7DB" : "var(--text-muted)", fontWeight: 500, textAlign: "center" }}>
                                        {a.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Collapsible Tactical Tools Sub-row */}
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "10px" }}>
                            <button
                                onClick={() => setAiMenuOpen(!aiMenuOpen)}
                                style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    width: "100%", padding: "6px 10px", background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px",
                                    color: isFamiliar ? "#00A884" : "var(--accent-cyan)", fontSize: "0.78rem", fontWeight: 700,
                                    cursor: "pointer", transition: "background 0.15s ease"
                                }}
                                onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                                onMouseLeave={ev => (ev.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                            >
                                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    🎛️ Herramientas Tácticas Malla
                                </span>
                                <span style={{ transition: "transform 0.2s", display: "inline-block", transform: aiMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                            </button>

                            {aiMenuOpen && (
                                <div className="animate-fade-scale" style={{
                                    display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "10px",
                                    transformOrigin: "top center"
                                }}>
                                    {[
                                        { icon: "🤖", label: "Copiloto IA", action: () => { setIsAttachOpen(false); if (typeof window !== "undefined") { const store = require("../../store/useRedStore").useRedStore.getState(); store.navigate("aiCopilot"); } } },
                                        { icon: "🫀", label: "VitalScan", action: () => { setIsAttachOpen(false); if (typeof window !== "undefined") { const store = require("../../store/useRedStore").useRedStore.getState(); store.navigate("vitalScan"); } } },
                                        { icon: "🔊", label: "SoundMesh", action: () => {
                                            setIsAttachOpen(false);
                                            if (text.trim()) {
                                                import("../../lib/audio/SoundMeshEngine").then(({ SoundMeshEngine }) => {
                                                    SoundMeshEngine.transmit(text.trim());
                                                    toast.success("🔊 Transmitiendo por SoundMesh FSK");
                                                });
                                            } else {
                                                toast.info("✍️ Escribe un mensaje primero");
                                            }
                                        } },
                                        { icon: "🎞️", label: "QR Air-Gap", action: () => { setIsAttachOpen(false); if (typeof window !== "undefined") { const store = require("../../store/useRedStore").useRedStore.getState(); store.navigate("airGapStego"); } } },
                                        { icon: "🖼️", label: "Esteganografía", action: () => { setIsAttachOpen(false); if (typeof window !== "undefined") { const store = require("../../store/useRedStore").useRedStore.getState(); store.navigate("stegoVault"); } } },
                                    ].map(tt => (
                                        <button
                                            key={tt.label}
                                            onClick={tt.action}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "8px",
                                                padding: "8px 10px", background: "rgba(255,255,255,0.05)",
                                                border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px",
                                                color: "#FFF", fontSize: "0.75rem", cursor: "pointer",
                                                textAlign: "left", transition: "background 0.15s ease"
                                            }}
                                            onMouseEnter={ev => (ev.currentTarget.style.background = "rgba(255,255,255,0.10)")}
                                            onMouseLeave={ev => (ev.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                                        >
                                            <span style={{ fontSize: "1rem" }}>{tt.icon}</span>
                                            <span style={{ fontWeight: 600 }}>{tt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ── Main Input & Voice Recording Area ── */}
            <div style={{
                display: "flex", alignItems: "flex-end", gap: "8px",
                padding: "8px 12px", minHeight: "56px",
                position: "relative"
            }}>
                {isRecording ? (
                    /* Tactical Recording Mode with Hands-Free Lock */
                    <div
                        className="animate-fade-scale"
                        style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            flex: 1, height: "48px", padding: "0 14px",
                            background: isHandsFree
                                ? "rgba(0,229,255,0.08)"
                                : "rgba(232,33,58,0.12)",
                            border: isHandsFree
                                ? "1.5px solid rgba(0,229,255,0.5)"
                                : "1.5px solid rgba(232,33,58,0.45)",
                            borderRadius: "24px",
                            boxShadow: isHandsFree
                                ? "0 0 16px rgba(0,229,255,0.15), inset 0 0 8px rgba(0,229,255,0.05)"
                                : "0 0 16px rgba(232,33,58,0.15)",
                            animation: "pulse 1.5s ease-in-out infinite",
                            transition: "border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease"
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            {/* REC dot with lock indicator */}
                            <div style={{ position: "relative", flexShrink: 0 }}>
                                <span style={{
                                    width: 10, height: 10, borderRadius: "50%",
                                    background: isHandsFree ? "var(--accent-cyan)" : "#FF3355",
                                    boxShadow: isHandsFree ? "0 0 10px var(--accent-cyan)" : "0 0 10px #FF3355",
                                    display: "block"
                                }} />
                                {isHandsFree && (
                                    <span style={{
                                        position: "absolute", top: -6, right: -6,
                                        fontSize: "0.55rem", lineHeight: 1,
                                        background: "var(--accent-cyan)", color: "#000",
                                        borderRadius: "3px", padding: "1px 2px", fontWeight: 900
                                    }}>🔒</span>
                                )}
                            </div>
                            <span style={{
                                fontSize: "0.88rem", fontWeight: 800, color: "#fff",
                                fontFamily: "JetBrains Mono, monospace",
                                letterSpacing: "0.04em"
                            }}>
                                {formatTimer(recordSec)}
                            </span>
                            {/* Visualizador de audio animado en vivo */}
                            <div aria-label="Visualizador de audio animado en vivo" style={{ display: "flex", alignItems: "center", gap: "3px", height: "18px" }}>
                                {[7, 14, 9, 16, 8, 13, 15, 6, 11].map((h, idx) => (
                                    <span
                                        key={idx}
                                        style={{
                                            width: "2.5px",
                                            height: `${h}px`,
                                            borderRadius: "2px",
                                            background: isHandsFree ? "var(--accent-cyan)" : "#FF3355",
                                            display: "inline-block",
                                            animation: `pulse ${(0.30 + (idx % 5) * 0.12).toFixed(2)}s ease-in-out infinite alternate`,
                                            boxShadow: isHandsFree
                                                ? "0 0 4px rgba(0,229,255,0.5)"
                                                : "0 0 4px rgba(255, 51, 85, 0.4)"
                                        }}
                                    />
                                ))}
                            </div>
                            <span style={{
                                fontSize: "0.70rem",
                                color: isHandsFree ? "var(--accent-cyan)" : "var(--text-muted)",
                                fontWeight: isHandsFree ? 700 : 400
                            }}>
                                {isHandsFree ? "LOCK — Manos libres" : "🎙️ Grabando P2P..."}
                            </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                                onClick={() => { setIsHandsFree(!isHandsFree); }}
                                className="btn-icon"
                                style={{
                                    width: 32, height: 32, fontSize: "0.85rem",
                                    color: isHandsFree ? "var(--accent-cyan)" : "var(--text-muted)",
                                    background: isHandsFree ? "rgba(0,229,255,0.12)" : "transparent",
                                    borderRadius: "50%", border: "none",
                                    transition: "background 0.2s ease, color 0.2s ease"
                                }}
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
                                style={{
                                    width: 38, height: 38, fontSize: "1rem",
                                    background: isFamiliar ? "#00A884" : "var(--primary)",
                                    color: "#fff",
                                    boxShadow: isFamiliar ? "0 0 14px rgba(0,168,132,0.5)" : "0 0 14px rgba(232,33,58,0.5)",
                                    borderRadius: "50%", border: "none",
                                    transition: "transform 0.15s ease"
                                }}
                                title="Enviar audio"
                                onMouseEnter={ev => (ev.currentTarget.style.transform = "scale(1.1)")}
                                onMouseLeave={ev => (ev.currentTarget.style.transform = "scale(1)")}
                            >
                                📤
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Standard Chat Input Mode */
                    <>
                        {/* Input Capsule (WhatsApp style pill) */}
                        <div style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            background: isFamiliar ? "#2A3942" : "rgba(255,255,255,0.06)",
                            border: isFamiliar ? "none" : "1px solid var(--glass-border)",
                            borderRadius: multiline ? "18px" : "24px",
                            padding: "6px 10px 6px 12px",
                            minHeight: "44px",
                            gap: "8px",
                        }}>
                            {/* Emoji Button */}
                            <button
                                onClick={() => {
                                    setEmojiPickerOpen(prev => {
                                        if (!prev) setIsAttachOpen(false);
                                        return !prev;
                                    });
                                }}
                                style={{
                                    background: "transparent", border: "none",
                                    color: emojiPickerOpen ? (isFamiliar ? "#00A884" : "var(--accent-cyan)") : (isFamiliar ? "#8696A0" : "var(--text-secondary)"),
                                    cursor: "pointer", padding: "4px", fontSize: "1.2rem",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0
                                }}
                                title="Emojis & Símbolos"
                            >
                                😊
                            </button>

                            {/* Text Area */}
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
                                placeholder={isDictating ? "🎙️ Escuchando dictado en vivo..." : (burnTimer ? `Mensaje efímero (${burnTimer}s)...` : (t('chat.type_message') || "Mensaje"))}
                                rows={1}
                                style={{
                                    flex: 1,
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                    color: "#fff",
                                    fontSize: "0.95rem",
                                    resize: "none",
                                    maxHeight: "120px",
                                    fontFamily: "inherit",
                                    lineHeight: "1.4",
                                }}
                            />

                            {/* Attachment Clip Button */}
                            <button
                                onClick={() => {
                                    setIsAttachOpen(prev => {
                                        if (!prev) setEmojiPickerOpen(false);
                                        return !prev;
                                    });
                                }}
                                style={{
                                    background: "transparent", border: "none",
                                    color: isAttachOpen ? (isFamiliar ? "#00A884" : "var(--accent-cyan)") : (isFamiliar ? "#8696A0" : "var(--text-secondary)"),
                                    cursor: "pointer", padding: "4px", fontSize: "1.2rem",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0
                                }}
                                title="Adjuntar multimedia"
                            >
                                📎
                            </button>

                            {/* AI Writing Assist Trigger (only when text is entered) */}
                            {text.trim().length > 0 && (
                                <button
                                    onClick={() => setAiMenuOpen(!aiMenuOpen)}
                                    style={{
                                        background: "transparent", border: "none",
                                        color: isFamiliar ? "#00A884" : "var(--accent-cyan)",
                                        cursor: "pointer", padding: "4px", fontSize: "1.1rem",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        flexShrink: 0
                                    }}
                                    title="Asistente de Redacción IA"
                                >
                                    ✨
                                </button>
                            )}
                        </div>

                        {/* ── @Mention Autocomplete Popup ── */}
                        {mentionSuggestions.length > 0 && mentionQuery !== null && (
                            <div style={{
                                position: "absolute",
                                bottom: "calc(100% + 4px)",
                                left: 16,
                                right: 60,
                                background: isFamiliar ? "#233138" : "rgba(14,16,30,0.98)",
                                backdropFilter: "blur(16px)",
                                border: isFamiliar ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,229,255,0.25)",
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
                                                e.preventDefault();
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
                                            onMouseEnter={ev => (ev.currentTarget.style.background = isFamiliar ? "rgba(0,168,132,0.15)" : "rgba(0,229,255,0.1)")}
                                            onMouseLeave={ev => (ev.currentTarget.style.background = "transparent")}
                                        >
                                            <span style={{
                                                width: 28, height: 28, borderRadius: "50%",
                                                background: isFamiliar ? "#00A884" : "rgba(232,33,58,0.25)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: "0.75rem", fontWeight: 900, color: "#FFFFFF",
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

                        {/* ── Unified Circular Action Button (WhatsApp Send / Mic) ── */}
                        {text.trim() ? (
                            <button
                                onClick={onSend}
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: "50%",
                                    background: isFamiliar ? "#00A884" : "var(--primary)",
                                    border: "none",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    color: "#FFFFFF",
                                    boxShadow: isFamiliar ? "0 2px 10px rgba(0, 168, 132, 0.4)" : "0 0 12px rgba(232,33,58,0.4)",
                                    flexShrink: 0,
                                    transition: "all 0.15s ease",
                                }}
                                title="Enviar mensaje"
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                                </svg>
                            </button>
                        ) : (
                            <button
                                onClick={startRecording}
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: "50%",
                                    background: isFamiliar ? "#00A884" : "rgba(255,255,255,0.08)",
                                    border: "none",
                                    color: "#FFFFFF",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    boxShadow: isFamiliar ? "0 2px 10px rgba(0, 168, 132, 0.4)" : "none",
                                    flexShrink: 0,
                                    transition: "all 0.15s ease",
                                }}
                                title="Grabar nota de voz"
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                                </svg>
                            </button>
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
