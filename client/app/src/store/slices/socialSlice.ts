import { StateCreator } from 'zustand';
import { RedStore } from '../types';
import { getSocialPosts, followUser, unfollowUser, getFollowingList, SocialPost } from '../../api';

export const createSocialSlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    socialPosts: [],

    bookmarkedPosts: [],

    followingList: [],

    loadSocialFeed: async () => {
        try {
            // Sincronizar listas asociadas
            get().hydrateFollowing();
            get().hydrateBookmarks();

            // 1. Cargar caché inmediata de almacenamiento
            const cached = typeof window !== 'undefined' ? localStorage.getItem('red_social_posts') : null;
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    set({ socialPosts: parsed });
                }
            }

            // 2. Consultar canal de posts de la malla
            const remotePosts = await getSocialPosts();
            if (Array.isArray(remotePosts) && remotePosts.length > 0) {
                set({ socialPosts: remotePosts });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('red_social_posts', JSON.stringify(remotePosts));
                }
            }
        } catch {}
    },

    addOptimisticReaction: (postId: string, emoji: string, reactorHash: string) => {
        const posts = [...get().socialPosts];
        const idx = posts.findIndex(p => p.id === postId);
        if (idx !== -1) {
            posts[idx].reactions = posts[idx].reactions || {};
            posts[idx].reactions[emoji] = posts[idx].reactions[emoji] || [];
            if (!posts[idx].reactions[emoji].includes(reactorHash)) {
                posts[idx].reactions[emoji].push(reactorHash);
            }
            set({ socialPosts: posts });
        }
    },

    deleteOptimisticPost: (postId: string) => {
        const remaining = get().socialPosts.filter(p => p.id !== postId);
        set({ socialPosts: remaining });
        if (typeof window !== 'undefined') {
            localStorage.setItem('red_social_posts', JSON.stringify(remaining));
        }
    },

    toggleBookmark: (post: SocialPost) => {
        const bookmarks = [...get().bookmarkedPosts];
        const idx = bookmarks.findIndex(p => p.id === post.id);
        const next = idx === -1 ? [post, ...bookmarks] : bookmarks.filter(p => p.id !== post.id);
        set({ bookmarkedPosts: next });
        if (typeof window !== 'undefined') localStorage.setItem('red_bookmarked_posts', JSON.stringify(next));
    },

    hydrateBookmarks: () => {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem('red_bookmarked_posts') : null;
            if (raw) set({ bookmarkedPosts: JSON.parse(raw) });
        } catch {}
    },

    toggleFollow: async (authorHash: string) => {
        if (!authorHash) return;
        const current = get().followingList || [];
        const isFollowing = current.includes(authorHash);
        const next = isFollowing
            ? current.filter(h => h !== authorHash)
            : [...current, authorHash];

        set({ followingList: next });
        if (typeof window !== 'undefined') {
            localStorage.setItem('red_social_following', JSON.stringify(next));
        }

        try {
            if (isFollowing) {
                await unfollowUser(authorHash);
            } else {
                await followUser(authorHash);
            }
        } catch {}
    },

    hydrateFollowing: () => {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem('red_social_following') : null;
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    set({ followingList: parsed });
                }
            }
            getFollowingList().then(remote => {
                if (Array.isArray(remote) && remote.length > 0) {
                    const current = get().followingList || [];
                    const merged = Array.from(new Set([...current, ...remote]));
                    set({ followingList: merged });
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('red_social_following', JSON.stringify(merged));
                    }
                }
            }).catch(() => {});
        } catch {}
    },
});
