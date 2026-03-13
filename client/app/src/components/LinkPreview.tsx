"use client";

import React, { useEffect, useState } from "react";

interface LinkMeta {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
}

function extractUrl(text: string): string | null {
    const match = text.match(/(https?:\/\/[^\s]+)/);
    return match ? match[1] : null;
}

export default function LinkPreview({ text }: { text: string }) {
    const [meta, setMeta] = useState<LinkMeta | null>(null);
    const [loading, setLoading] = useState(false);
    const url = extractUrl(text);

    useEffect(() => {
        if (!url) return;
        setLoading(true);
        try {
            const domain = new URL(url).hostname.replace("www.", "");
            // Show the domain immediately — real metadata requires a server-side proxy
            // (direct fetch is blocked by CORS for most sites)
            setMeta({
                url,
                domain,
                title: undefined,   // Real title only available via server proxy
                description: undefined,
                image: undefined,
            });
        } catch {
            // invalid URL — don't render
        } finally {
            setLoading(false);
        }
    }, [url]);

    if (!url || !meta) return null;
    if (loading) return null;

    return (
        <a href={meta.url} target="_blank" rel="noopener noreferrer" className="link-preview glass" onClick={e => e.stopPropagation()}>
            <div className="link-preview-body">
                <span className="link-preview-domain">🔗 {meta.domain}</span>
                {meta.title && <span className="link-preview-title">{meta.title}</span>}
                <span className="link-preview-desc" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {meta.url.length > 50 ? meta.url.substring(0, 50) + "..." : meta.url}
                </span>
            </div>
        </a>
    );
}

export { extractUrl };
