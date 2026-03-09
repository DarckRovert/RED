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
    const url = extractUrl(text);

    useEffect(() => {
        if (!url) return;
        // Extract domain for display
        try {
            const domain = new URL(url).hostname.replace("www.", "");
            // Simulate metadata (in production, fetch from a server-side endpoint)
            setMeta({
                url,
                domain,
                title: `Contenido de ${domain}`,
                description: "Vista previa del enlace cifrada y sin trackeo.",
                image: undefined,
            });
        } catch {
            // invalid URL
        }
    }, [url]);

    if (!url || !meta) return null;

    return (
        <a href={meta.url} target="_blank" rel="noopener noreferrer" className="link-preview glass" onClick={e => e.stopPropagation()}>
            {meta.image && <img src={meta.image} alt="" className="link-preview-img" />}
            <div className="link-preview-body">
                <span className="link-preview-domain">🔗 {meta.domain}</span>
                <span className="link-preview-title">{meta.title}</span>
                <span className="link-preview-desc">{meta.description}</span>
            </div>
        </a>
    );
}

export { extractUrl };
