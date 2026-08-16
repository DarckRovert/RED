"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { createSocialPost, reactToPost, followUser, deleteSocialPost, SocialPost } from "../lib/api";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { toast } from "./Toast";

const AVATAR_COLORS = [
    ["#E8213A","#C0152A"], ["#FF7043","#E64A19"], ["#FFA726","#F57C00"],
    ["#26C6DA","#00ACC1"], ["#29B6F6","#0288D1"], ["#7E57C2","#5E35B1"],
    ["#26A69A","#00897B"], ["#EC407A","#C2185B"],
];

function getAvatarIdx(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return h % 8;
}

function avatarStyle(seed: string) {
    const [a, b] = AVATAR_COLORS[getAvatarIdx(seed)];
    return { background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: `0 2px 12px ${a}60` };
}

function shortHandle(hash: string): string {
    if (!hash || hash.length < 8) return hash;
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
        identity, contacts, addOptimisticReaction, deleteOptimisticPost, toggleBookmark, hydrateBookmarks, goBack 
    } = useRedStore();
    
    const [newPostContent, setNewPostContent] = useState("");
    const [mediaData, setMediaData] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState<"global" | "following" | "saved">("global");
    const [replyingTo, setReplyingTo] = useState<SocialPost | null>(null);
    const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
    const [viewProfile, setViewProfile] = useState<string | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const MAX_CHARS = 500;

    const filteredPosts = useMemo(() => {
        let basePosts = activeTab === "saved" ? bookmarkedPosts : socialPosts;
        
        return basePosts.filter(post => {
            if (viewProfile && post.author_hash !== viewProfile) return false;
            if (activeHashtag && !post.content.toLowerCase().includes(`#${activeHashtag.toLowerCase()}`)) return false;
            
            if (activeTab === "global" || activeTab === "saved") return true;
            return followingList.includes(post.author_hash) || post.author_hash === identity?.identity_hash;
        });
    }, [socialPosts, bookmarkedPosts, activeTab, followingList, identity, activeHashtag, viewProfile]);

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

    useEffect(() => {
        hydrateBookmarks();
        loadSocialFeed();
        const interval = setInterval(() => loadSocialFeed(), 30000);
        return () => clearInterval(interval);
    }, [loadSocialFeed]);

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
            // Cancelled
        }
    };

    const handlePublish = async () => {
        if (!newPostContent.trim() && !mediaData) return;
        if (newPostContent.length > MAX_CHARS) return;
        
        setIsPublishing(true);
        try {
            await createSocialPost({
                author_name: identity?.nickname || "Operador RED",
                content: newPostContent.trim(),
                media_data: mediaData || undefined,
                reply_to: replyingTo ? replyingTo.id : undefined
            });
            setNewPostContent("");
            setMediaData(null);
            setReplyingTo(null);
            toast.success("📡 Post emitido en la malla P2P");
            setTimeout(loadSocialFeed, 500);
        } catch {
            toast.error("Fallo al emitir post");
        } finally {
            setIsPublishing(false);
        }
    };

    const handleReact = async (postId: string, emoji: string) => {
        if (!identity) return;
        addOptimisticReaction(postId, emoji, identity.identity_hash);
        await reactToPost({
            post_id: postId,
            emoji,
            reactor_hash: identity.identity_hash
        }).catch(() => {});
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
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
                            Feed Social Soberano Off-Grid
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            GOSSIPSUB MICROBLOGGING · ED25519 VERIFIED
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
                        {isSyncing ? "..." : "🔄"}
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title="Cerrar Feed"
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("global")}
                    className={activeTab === "global" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                >
                    🌍 Global ({socialPosts.length})
                </button>
                <button
                    onClick={() => setActiveTab("following")}
                    className={activeTab === "following" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                >
                    👥 Siguiendo ({followingList.length})
                </button>
                <button
                    onClick={() => setActiveTab("saved")}
                    className={activeTab === "saved" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                >
                    🔖 Guardados ({bookmarkedPosts.length})
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Editor de Publicación Superior */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        {replyingTo && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(0,229,255,0.08)", borderRadius: "8px" }}>
                                <span style={{ fontSize: "0.74rem", color: "var(--accent-cyan)" }}>
                                    Respondiendo a: <strong>{replyingTo.author_name}</strong>
                                </span>
                                <button onClick={() => setReplyingTo(null)} className="btn-icon" style={{ width: 24, height: 24 }}>✕</button>
                            </div>
                        )}

                        <textarea
                            ref={textareaRef}
                            value={newPostContent}
                            onChange={e => setNewPostContent(e.target.value)}
                            placeholder="¿Qué ocurre en tu sector de la malla? (Usa #hashtags)..."
                            rows={3}
                            style={{ fontSize: "0.92rem" }}
                        />

                        {mediaData && (
                            <div style={{ position: "relative", width: "100px", height: "100px" }}>
                                <img src={mediaData} alt="Adjunto" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px", border: "1px solid var(--accent-cyan)" }} />
                                <button onClick={() => setMediaData(null)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#FF3355", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.70rem" }}>✕</button>
                            </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <button
                                onClick={handleTakePhoto}
                                className="btn-tactical-secondary"
                                style={{ padding: "8px 14px", fontSize: "0.78rem" }}
                            >
                                📷 Cámara / Foto
                            </button>

                            <button
                                onClick={handlePublish}
                                disabled={isPublishing || (!newPostContent.trim() && !mediaData)}
                                className="btn-tactical-primary"
                                style={{ padding: "8px 20px", fontSize: "0.85rem" }}
                            >
                                {isPublishing ? "Emitiendo..." : "⚡ EMITIR POST"}
                            </button>
                        </div>
                    </div>

                    {/* Feed de Publicaciones */}
                    {topLevel.length === 0 ? (
                        <div className="empty-state-tactical">
                            <div className="empty-state-icon">📡</div>
                            <div className="empty-state-title">Sin Publicaciones en la Malla</div>
                            <div className="empty-state-desc">
                                Sé el primero en emitir una actualización comunitaria o sincroniza tu nodo con otros pares.
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {topLevel.map(post => {
                                const replies = childrenMap[post.id] || [];
                                const isBookmarked = bookmarkedPosts.some(b => b.id === post.id);

                                return (
                                    <div key={post.id} className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                        {/* Post Header */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <div style={{
                                                    width: 38, height: 38, borderRadius: "50%",
                                                    ...avatarStyle(post.author_hash),
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontWeight: 900, color: "white", fontSize: "1rem"
                                                }}>
                                                    {post.author_name[0]?.toUpperCase() || "🔴"}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: "0.92rem", fontWeight: 800 }}>{post.author_name}</div>
                                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                        {shortHandle(post.author_hash)} · {formatRelativeTime(post.timestamp)}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => toggleBookmark(post)}
                                                className="btn-icon"
                                                style={{ width: 32, height: 32, color: isBookmarked ? "var(--accent-amber)" : "var(--text-muted)" }}
                                                title={isBookmarked ? "Quitar de guardados" : "Guardar post"}
                                            >
                                                {isBookmarked ? "★" : "☆"}
                                            </button>
                                        </div>

                                        {/* Post Content */}
                                        <div style={{ fontSize: "0.90rem", lineHeight: 1.5, color: "var(--text-primary)" }}>
                                            {post.content}
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

                                            <button
                                                onClick={() => setReplyingTo(post)}
                                                className="btn-tactical-secondary"
                                                style={{ padding: "4px 10px", fontSize: "0.74rem" }}
                                            >
                                                💬 Responder ({replies.length})
                                            </button>
                                        </div>

                                        {/* Hilos de Respuestas */}
                                        {replies.length > 0 && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderLeft: "2px solid var(--accent-cyan)", paddingLeft: "12px", marginTop: "6px" }}>
                                                {replies.map(r => (
                                                    <div key={r.id} style={{ fontSize: "0.80rem", color: "var(--text-secondary)" }}>
                                                        <strong style={{ color: "var(--accent-cyan)" }}>{r.author_name}:</strong> {r.content}
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
        </div>
    );
};