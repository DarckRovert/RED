"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { createSocialPost, reactToPost, deleteSocialPost, SocialPost } from "../lib/api";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { OfflineQrEngine } from "../lib/qr/OfflineQrEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { meshRouter } from "../lib/mesh/meshRouter";

const AVATAR_COLORS = [
    ["#E8213A","#C0152A"], ["#FF7043","#E64A19"], ["#FFA726","#F57C00"],
    ["#26C6DA","#00ACC1"], ["#29B6F6","#0288D1"], ["#7E57C2","#5E35B1"],
    ["#26A69A","#00897B"], ["#EC407A","#C2185B"],
];

const QUICK_HASHTAGS = ["#SITREP", "#ALERTA", "#LOGISTICA", "#SOS", "#P2P", "#SECTOR"];

function getAvatarIdx(seed: string): number {
    let h = 0;
    const s = seed || "did:red:default";
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 8;
}

function avatarStyle(seed: string) {
    const [a, b] = AVATAR_COLORS[getAvatarIdx(seed)];
    return { background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: `0 2px 12px ${a}60` };
}

function shortHandle(hash?: string): string {
    if (!hash || hash.length < 8) return hash || "@par";
    return `@${hash.slice(0, 4)}...${hash.slice(-4)}`;
}

function formatRelativeTime(tsSeconds: number) {
    const timestamp = tsSeconds > 1e10 ? tsSeconds : tsSeconds * 1000;
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return `${Math.max(1, diff)}s`;
    if (diff < 3600) return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
    return `${Math.floor(diff/86400)}d`;
}

export const SocialFeedPanel: React.FC = () => {
    const { 
        socialPosts, bookmarkedPosts, followingList, loadSocialFeed, 
        identity, addOptimisticReaction, deleteOptimisticPost, toggleBookmark, 
        hydrateBookmarks, toggleFollow, hydrateFollowing, goBack 
    } = useRedStore();
    const { t } = useTranslation();
    
    const [newPostContent, setNewPostContent] = useState("");
    const [mediaData, setMediaData] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState<"global" | "following" | "saved">("global");
    const [replyingTo, setReplyingTo] = useState<SocialPost | null>(null);
    const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
    const [viewProfile, setViewProfile] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPostForQr, setSelectedPostForQr] = useState<SocialPost | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [postToDelete, setPostToDelete] = useState<string | null>(null);
    const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const MAX_CHARS = 500;

    // ── LIFO Hardware / UI Back Button Interceptor ────────────────────────────
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (selectedPostForQr) {
                setSelectedPostForQr(null);
                setQrDataUrl(null);
                return true;
            }
            if (postToDelete) {
                setPostToDelete(null);
                return true;
            }
            if (replyingTo) {
                setReplyingTo(null);
                return true;
            }
            if (viewProfile) {
                setViewProfile(null);
                return true;
            }
            if (activeHashtag) {
                setActiveHashtag(null);
                return true;
            }
            if (searchQuery.trim()) {
                setSearchQuery("");
                return true;
            }
            goBack();
            return true;
        });
        return () => unregister();
    }, [selectedPostForQr, postToDelete, replyingTo, viewProfile, activeHashtag, searchQuery, goBack]);

    // ── Feed Ingestion & Sync Interval ────────────────────────────────────────
    useEffect(() => {
        hydrateBookmarks();
        hydrateFollowing();
        loadSocialFeed();
        const interval = setInterval(() => loadSocialFeed(), 30000);
        return () => clearInterval(interval);
    }, [hydrateBookmarks, hydrateFollowing, loadSocialFeed]);

    const myHash = identity?.identity_hash || "did:red:local";

    const filteredPosts = useMemo(() => {
        const basePosts = activeTab === "saved" ? bookmarkedPosts : socialPosts;
        const query = searchQuery.trim().toLowerCase();
        
        return basePosts.filter(post => {
            const author = post.author_hash || post.author_did || "";
            if (viewProfile && author !== viewProfile) return false;
            if (activeHashtag && !post.content.toLowerCase().includes(`#${activeHashtag.toLowerCase()}`)) return false;
            if (query) {
                const matchContent = post.content.toLowerCase().includes(query);
                const matchAuthor = (post.author_name || "").toLowerCase().includes(query);
                const matchHash = author.toLowerCase().includes(query);
                if (!matchContent && !matchAuthor && !matchHash) return false;
            }
            
            if (activeTab === "global" || activeTab === "saved") return true;
            return (followingList || []).includes(author) || author === myHash;
        });
    }, [socialPosts, bookmarkedPosts, activeTab, followingList, myHash, activeHashtag, viewProfile, searchQuery]);

    const { topLevel, childrenMap } = useMemo(() => {
        const topLevel = filteredPosts.filter(p => !p.reply_to);
        const childrenMap: Record<string, SocialPost[]> = {};
        filteredPosts.forEach(p => {
            if (p.reply_to) {
                if (!childrenMap[p.reply_to]) childrenMap[p.reply_to] = [];
                childrenMap[p.reply_to].push(p);
            }
        });
        Object.values(childrenMap).forEach(arr => arr.sort((a,b) => a.timestamp - b.timestamp));
        return { topLevel, childrenMap };
    }, [filteredPosts]);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await loadSocialFeed();
            toast.success("Radar Mesh sincronizado");
        } catch {
            toast.error("Error al sincronizar malla");
        } finally {
            setTimeout(() => setIsSyncing(false), 500);
        }
    };

    const handleTakePhoto = async () => {
        try {
            const photo = await Camera.getPhoto({
                quality: 85,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Prompt
            });
            if (photo.base64String) {
                setMediaData(`data:image/${photo.format};base64,${photo.base64String}`);
                toast.success("Foto adjuntada al post");
            }
        } catch {
            // Fallback a selector nativo de archivo si el plugin de cámara no está disponible
            fileInputRef.current?.click();
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error("La imagen excede el límite táctico de 2MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                setMediaData(reader.result);
                toast.success("Imagen adjuntada al post");
            }
        };
        reader.readAsDataURL(file);
    };

    const handlePublish = async () => {
        if (!newPostContent.trim() && !mediaData) return;
        if (newPostContent.length > MAX_CHARS) return;
        
        setIsPublishing(true);
        try {
            await createSocialPost({
                author_name: identity?.nickname || identity?.display_name || 'Operador RED',
                content: newPostContent.trim(),
                media_data: mediaData || undefined,
                reply_to: replyingTo ? replyingTo.id : undefined
            });

            // Difusión P2P del post por la malla (off-grid)
            const postPayload = new TextEncoder().encode(JSON.stringify({
                id: `social_post_${Date.now()}`,
                msg_type: 'SOCIAL_POST_BROADCAST',
                author_hash: identity?.identity_hash || 'did:red:local',
                author_name: identity?.nickname || identity?.display_name || 'Operador RED',
                content: newPostContent.trim(),
                reply_to: replyingTo?.id || null,
                timestamp: Date.now()
            }));
            meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', postPayload).catch(() => {});

            setNewPostContent('');
            setMediaData(null);
            setReplyingTo(null);
            toast.success('📡 Post emitido y re-radiado en la malla P2P');
            setTimeout(loadSocialFeed, 500);
        } catch {
            toast.error('Fallo al emitir post en la malla');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleReact = async (postId: string, emoji: string) => {
        addOptimisticReaction(postId, emoji, myHash);
        await reactToPost({
            post_id: postId,
            emoji,
            reactor_hash: myHash
        }).catch(() => {});
    };

    const handleDeletePost = async (postId: string) => {
        deleteOptimisticPost(postId);
        setPostToDelete(null);
        try {
            await deleteSocialPost(postId);
            toast.success("🗑️ Publicación purgada de la red local y malla");
        } catch {
            toast.error("Error al purgar publicación");
        }
    };

    const handleShowQr = async (post: SocialPost) => {
        try {
            setSelectedPostForQr(post);
            const payload = JSON.stringify({
                type: "red_social_post",
                id: post.id,
                author_name: post.author_name,
                author_hash: post.author_hash || post.author_did || "",
                content: post.content,
                timestamp: post.timestamp,
                signature: post.signature || "",
            });
            const url = await OfflineQrEngine.generateDataUrl(payload, {
                width: 280,
                darkColor: "#00E5FF",
                lightColor: "#0A0A14",
            });
            setQrDataUrl(url);
        } catch {
            toast.error("Error al generar código QR off-grid");
        }
    };

    const insertHashtag = (tag: string) => {
        setNewPostContent(prev => {
            const trimmed = prev.trim();
            if (trimmed.includes(tag)) return prev;
            return trimmed ? `${trimmed} ${tag} ` : `${tag} `;
        });
        textareaRef.current?.focus();
    };

    const toggleThread = (postId: string) => {
        setExpandedReplies(prev => ({
            ...prev,
            [postId]: !prev[postId]
        }));
    };

    const renderPostContent = (content: string) => {
        const parts = content.split(/(#[a-zA-Z0-9_\u00C0-\u017F]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith("#")) {
                const tag = part.slice(1);
                return (
                    <span
                        key={i}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveHashtag(tag);
                        }}
                        style={{
                            color: "var(--accent-cyan)",
                            cursor: "pointer",
                            fontWeight: 700,
                            textDecoration: "underline",
                            textUnderlineOffset: "3px"
                        }}
                        title={`Filtrar por #${tag}`}
                    >
                        {part}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Input oculto para carga de fotos en Web/Escritorio */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileInput}
            />

            {/* Header Táctico */}
            <header style={{
                padding: "14px 20px",
                minHeight: "var(--header-h, 60px)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,229,255,0.4)"
                    }}>🌐</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.social_module?.title || "Feed Social Soberano Off-Grid"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t.social_module?.subtitle || "GOSSIPSUB MICROBLOGGING · ED25519 VERIFIED"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="btn-icon"
                        title="Sincronizar Feed"
                        style={{ width: 38, height: 38 }}
                    >
                        {isSyncing ? "⏳" : "🔄"}
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t.common?.close || "Cerrar Feed"}
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* HUD Telemetría Táctica */}
            <div style={{
                padding: "8px 16px",
                background: "rgba(6, 9, 18, 0.95)",
                borderBottom: "1px solid var(--glass-border)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "8px",
                flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.72rem" }}>
                    <span style={{ color: "var(--accent-emerald)" }}>●</span>
                    <span style={{ color: "var(--text-muted)" }}>Malla:</span>
                    <strong style={{ color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                        GOSSIPSUB ACTIVE
                    </strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.72rem" }}>
                    <span>📝</span>
                    <span style={{ color: "var(--text-muted)" }}>Posts Nodo:</span>
                    <strong style={{ color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
                        {socialPosts.length}
                    </strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.72rem" }}>
                    <span>👥</span>
                    <span style={{ color: "var(--text-muted)" }}>Siguiendo:</span>
                    <strong style={{ color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                        {followingList.length} pares
                    </strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.72rem" }}>
                    <span>🔒</span>
                    <span style={{ color: "var(--text-muted)" }}>Firma:</span>
                    <strong style={{ color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                        Ed25519 ACTIVA
                    </strong>
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div style={{
                padding: "8px 16px",
                display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center",
                background: "rgba(10, 10, 20, 0.90)",
                borderBottom: "1px solid var(--glass-border)",
                flexShrink: 0
            }}>
                {/* Selector de Pestañas Segmentadas */}
                <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
                    <button
                        onClick={() => setActiveTab("global")}
                        className={activeTab === "global" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 14px", fontSize: "0.78rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                    >
                        🌍 {t.social_module?.filter_all || "Global"} ({socialPosts.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("following")}
                        className={activeTab === "following" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 14px", fontSize: "0.78rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                    >
                        👥 Siguiendo ({followingList.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("saved")}
                        className={activeTab === "saved" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 14px", fontSize: "0.78rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                    >
                        🔖 Guardados ({bookmarkedPosts.length})
                    </button>
                </div>

                {/* Buscador de Palabras Clave / Autores */}
                <div style={{ flex: 1, minWidth: "160px", display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "4px 8px", border: "1px solid var(--glass-border)" }}>
                    <span style={{ fontSize: "0.75rem", marginRight: "6px" }}>🔍</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar posts, operadores, DIDs..."
                        style={{
                            width: "100%", background: "transparent", border: "none",
                            color: "var(--text-primary)", fontSize: "0.78rem", outline: "none"
                        }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="btn-icon" style={{ width: 18, height: 18, fontSize: "0.7rem" }}>✕</button>
                    )}
                </div>
            </div>

            {/* Chips de Filtro Activo (Hashtags o Perfiles) */}
            {(activeHashtag || viewProfile) && (
                <div style={{
                    padding: "6px 16px",
                    display: "flex", gap: "8px", alignItems: "center",
                    background: "rgba(0, 229, 255, 0.08)",
                    borderBottom: "1px solid var(--glass-border)",
                    flexShrink: 0
                }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", fontWeight: 700 }}>Filtro Activo:</span>
                    {activeHashtag && (
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: "6px",
                            padding: "2px 8px", background: "rgba(0,229,255,0.2)",
                            borderRadius: "12px", fontSize: "0.74rem", color: "var(--accent-cyan)", fontWeight: 700
                        }}>
                            <span>#{activeHashtag}</span>
                            <button onClick={() => setActiveHashtag(null)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "0.7rem" }}>✕</button>
                        </div>
                    )}
                    {viewProfile && (
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: "6px",
                            padding: "2px 8px", background: "rgba(232,33,58,0.2)",
                            borderRadius: "12px", fontSize: "0.74rem", color: "var(--accent-crimson)", fontWeight: 700
                        }}>
                            <span>Operador: {shortHandle(viewProfile)}</span>
                            <button onClick={() => setViewProfile(null)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "0.7rem" }}>✕</button>
                        </div>
                    )}
                </div>
            )}

            {/* Contenido Principal con Scroll */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Editor de Publicación Superior */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        {replyingTo && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(0,229,255,0.08)", borderRadius: "8px" }}>
                                <span style={{ fontSize: "0.74rem", color: "var(--accent-cyan)" }}>
                                    Respondiendo a: <strong>{replyingTo.author_name}</strong> ({shortHandle(replyingTo.author_hash || replyingTo.author_did)})
                                </span>
                                <button onClick={() => setReplyingTo(null)} className="btn-icon" style={{ width: 24, height: 24 }}>✕</button>
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            placeholder={replyingTo ? `Respondiendo a @${(replyingTo.author_hash || replyingTo.author_did || "par").slice(0, 6)}...` : (t.social_module?.composer_placeholder || "¿Qué está ocurriendo en tu sector táctico? Publica un reporte...")}
                            rows={3}
                            maxLength={MAX_CHARS}
                            style={{
                                width: "100%", background: "transparent",
                                border: "none", color: "var(--text-primary)",
                                fontSize: "0.92rem", resize: "none", outline: "none",
                                lineHeight: "1.5"
                            }}
                        />

                        {/* Chips de Inserción Rápida de Hashtags */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {QUICK_HASHTAGS.map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => insertHashtag(tag)}
                                    className="btn-ghost"
                                    style={{ padding: "2px 8px", fontSize: "0.68rem", borderRadius: "6px", color: "var(--accent-cyan)" }}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>

                        {mediaData && (
                            <div style={{ position: "relative", width: "fit-content", marginBottom: "8px" }}>
                                <img
                                    src={mediaData}
                                    alt="Adjunto"
                                    style={{ maxHeight: "160px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}
                                />
                                <button
                                    onClick={() => setMediaData(null)}
                                    className="btn-icon"
                                    style={{
                                        position: "absolute", top: 4, right: 4,
                                        background: "rgba(0,0,0,0.8)", width: 24, height: 24, fontSize: "0.75rem"
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        <div style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            borderTop: "1px solid var(--glass-border)", paddingTop: "10px", marginTop: "4px"
                        }}>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <button
                                    onClick={handleTakePhoto}
                                    className="btn-ghost"
                                    title="Adjuntar Fotografía / Sensor"
                                    style={{ padding: "6px 10px", fontSize: "0.82rem", color: "var(--accent-cyan)" }}
                                >
                                    📷 Foto / Archivo
                                </button>
                                <span style={{ fontSize: "0.70rem", color: newPostContent.length > MAX_CHARS - 50 ? "var(--accent-crimson)" : "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                    {newPostContent.length}/{MAX_CHARS}
                                </span>
                            </div>

                            <button
                                onClick={handlePublish}
                                disabled={isPublishing || (!newPostContent.trim() && !mediaData)}
                                className="btn-tactical-primary"
                                style={{ padding: "8px 20px", fontSize: "0.85rem" }}
                            >
                                {isPublishing ? (t.common?.loading || "Emitiendo...") : (t.stories_module?.publish_btn || "⚡ EMITIR POST")}
                            </button>
                        </div>
                    </div>

                    {/* Feed de Publicaciones */}
                    {topLevel.length === 0 ? (
                        <div className="empty-state-tactical">
                            <div className="empty-state-icon">📡</div>
                            <div className="empty-state-title">
                                {searchQuery ? "Sin resultados para la búsqueda" : (t.stories_module?.no_stories || "Sin Publicaciones en la Malla")}
                            </div>
                            <div className="empty-state-desc">
                                {searchQuery ? "Intenta modificar el término de búsqueda o limpia los filtros activos." : (t.sidebar?.no_contacts_desc || "Sé el primero en emitir una actualización comunitaria o sincroniza tu nodo con otros pares.")}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {topLevel.map(post => {
                                const authorHash = post.author_hash || post.author_did || "did:red:anon";
                                const isMine = authorHash === myHash;
                                const isFollowing = (followingList || []).includes(authorHash);
                                const isBookmarked = bookmarkedPosts.some(b => b.id === post.id);
                                const replies = childrenMap[post.id] || [];
                                const isRepliesExpanded = !!expandedReplies[post.id];

                                return (
                                    <div key={post.id} className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                        {/* Post Header */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <div 
                                                    onClick={() => setViewProfile(authorHash)}
                                                    style={{
                                                        width: 38, height: 38, borderRadius: "50%",
                                                        ...avatarStyle(authorHash),
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        fontWeight: 900, color: "white", fontSize: "1rem",
                                                        cursor: "pointer"
                                                    }}
                                                    title={`Ver posts de ${post.author_name}`}
                                                >
                                                    {post.author_name[0]?.toUpperCase() || "🔴"}
                                                </div>
                                                <div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <span 
                                                            onClick={() => setViewProfile(authorHash)}
                                                            style={{ fontSize: "0.92rem", fontWeight: 800, cursor: "pointer" }}
                                                        >
                                                            {post.author_name}
                                                        </span>
                                                        {isMine ? (
                                                            <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: "4px", background: "rgba(232,33,58,0.2)", color: "var(--accent-crimson)", fontWeight: 700 }}>
                                                                TÚ
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => toggleFollow(authorHash)}
                                                                className="btn-ghost"
                                                                style={{
                                                                    padding: "2px 8px", fontSize: "0.68rem", borderRadius: "10px",
                                                                    color: isFollowing ? "var(--accent-emerald)" : "var(--accent-cyan)",
                                                                    border: `1px solid ${isFollowing ? "rgba(0,230,118,0.3)" : "rgba(0,229,255,0.3)"}`
                                                                }}
                                                            >
                                                                {isFollowing ? "✓ Siguiendo" : "+ Seguir"}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", display: "flex", alignItems: "center", gap: "6px" }}>
                                                        <span>{shortHandle(authorHash)}</span>
                                                        <span>·</span>
                                                        <span>{formatRelativeTime(post.timestamp)}</span>
                                                        {post.signature && (
                                                            <span style={{ color: "var(--accent-emerald)" }} title={`Firma Ed25519: ${post.signature.slice(0, 16)}...`}>
                                                                🔒 Ed25519
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Acciones de Post Header */}
                                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                                <button
                                                    onClick={() => handleShowQr(post)}
                                                    className="btn-icon"
                                                    style={{ width: 30, height: 30 }}
                                                    title="Compartir post vía QR fuera de red"
                                                >
                                                    📲
                                                </button>
                                                <button
                                                    onClick={() => toggleBookmark(post)}
                                                    className="btn-icon"
                                                    style={{ width: 30, height: 30, color: isBookmarked ? "var(--accent-amber)" : "var(--text-muted)" }}
                                                    title={isBookmarked ? "Quitar de guardados" : "Guardar post"}
                                                >
                                                    {isBookmarked ? "★" : "☆"}
                                                </button>
                                                {isMine && (
                                                    <button
                                                        onClick={() => setPostToDelete(post.id)}
                                                        className="btn-icon"
                                                        style={{ width: 30, height: 30, color: "var(--accent-crimson)" }}
                                                        title="Eliminar publicación"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Post Content */}
                                        <div style={{ fontSize: "0.90rem", lineHeight: 1.5, color: "var(--text-primary)" }}>
                                            {renderPostContent(post.content)}
                                        </div>

                                        {/* Post Image */}
                                        {post.media_data && (
                                            <img
                                                src={post.media_data}
                                                alt="Media"
                                                style={{ width: "100%", maxHeight: "280px", objectFit: "cover", borderRadius: "12px", border: "1px solid var(--glass-border)" }}
                                            />
                                        )}

                                        {/* Interacciones */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--glass-border)", paddingTop: "10px" }}>
                                            <div style={{ display: "flex", gap: "6px" }}>
                                                {["❤️", "🔥", "👍", "⚡"].map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => handleReact(post.id, emoji)}
                                                        className="btn-ghost"
                                                        style={{ padding: "4px 8px", fontSize: "0.82rem", borderRadius: "8px" }}
                                                    >
                                                        {emoji} {post.reactions?.[emoji]?.length || ""}
                                                    </button>
                                                ))}
                                            </div>

                                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                                {replies.length > 0 && (
                                                    <button
                                                        onClick={() => toggleThread(post.id)}
                                                        className="btn-ghost"
                                                        style={{ padding: "4px 8px", fontSize: "0.74rem", color: "var(--accent-cyan)" }}
                                                    >
                                                        {isRepliesExpanded ? "Ocultar respuestas" : `Ver respuestas (${replies.length})`}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setReplyingTo(post)}
                                                    className="btn-tactical-secondary"
                                                    style={{ padding: "4px 10px", fontSize: "0.74rem" }}
                                                >
                                                    💬 Responder
                                                </button>
                                            </div>
                                        </div>

                                        {/* Hilos de Respuestas Colapsables */}
                                        {replies.length > 0 && isRepliesExpanded && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderLeft: "2px solid var(--accent-cyan)", paddingLeft: "12px", marginTop: "6px" }}>
                                                {replies.map(r => (
                                                    <div key={r.id} style={{ fontSize: "0.82rem", background: "rgba(255,255,255,0.02)", padding: "8px", borderRadius: "8px" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                                            <strong style={{ color: "var(--accent-cyan)" }}>{r.author_name}</strong>
                                                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                                {formatRelativeTime(r.timestamp)}
                                                            </span>
                                                        </div>
                                                        <div style={{ color: "var(--text-secondary)" }}>
                                                            {renderPostContent(r.content)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Compartición de Código QR Off-Grid */}
            {selectedPostForQr && qrDataUrl && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 100, padding: "20px"
                }}>
                    <div className="card-tactical animate-scale" style={{
                        maxWidth: "340px", width: "100%", padding: "24px",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
                        textAlign: "center"
                    }}>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>📲 Código QR de Difusión Malla</div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                            Cualquier operador puede escanear este código con su cámara RED para incorporar este reporte táctico a su nodo sin conexión de red.
                        </div>
                        <div style={{
                            padding: "12px", background: "#0A0A14", borderRadius: "12px",
                            border: "1px solid var(--accent-cyan)", boxShadow: "0 0 20px rgba(0,229,255,0.2)"
                        }}>
                            <img src={qrDataUrl} alt="QR Táctico" style={{ width: "240px", height: "240px", display: "block" }} />
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                            POST ID: {selectedPostForQr.id}
                        </div>
                        <button
                            onClick={() => { setSelectedPostForQr(null); setQrDataUrl(null); }}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "10px" }}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Borrado */}
            {postToDelete && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 100, padding: "20px"
                }}>
                    <div className="card-tactical animate-scale" style={{
                        maxWidth: "340px", width: "100%", padding: "24px",
                        display: "flex", flexDirection: "column", gap: "16px",
                        textAlign: "center"
                    }}>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--accent-crimson)" }}>
                            ⚠️ Purgar Publicación
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                            ¿Estás seguro de que deseas eliminar este post? Se purgará de tu nodo y se emitirá una orden de borrado distribuida hacia los pares conectados.
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                onClick={() => setPostToDelete(null)}
                                className="btn-ghost"
                                style={{ flex: 1, padding: "10px" }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDeletePost(postToDelete)}
                                className="btn-tactical-danger"
                                style={{ flex: 1, padding: "10px" }}
                            >
                                Confirmar Purgado
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};