import { StateCreator } from 'zustand';
import { RedStore } from '../types';
import { getSocialPosts } from '../../api';

export const createSocialSlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    socialPosts: [],

    bookmarkedPosts: [],

    followingList: [],

    loadSocialFeed: async () => {
        try {
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
        set({ socialPosts: get().socialPosts.filter(p => p.id !== postId) });
    },

    toggleBookmark: (post: any) => {
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
});
