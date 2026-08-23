import { StateCreator } from 'zustand';
import { RedStore } from '../types';

export const createSocialSlice: StateCreator<RedStore, [], [], Partial<RedStore>> = (set, get) => ({
    socialPosts: [],

    bookmarkedPosts: [],

    followingList: [],

    loadSocialFeed: async () => {
        try {
            const res = typeof window !== 'undefined' ? localStorage.getItem('red_social_posts') : null;
            if (res) set({ socialPosts: JSON.parse(res) });
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
