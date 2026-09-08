/**
 * RED Sovereign Mesh OS — Resilient Tactical Clipboard Utility
 * 
 * Provides guaranteed clipboard copy across modern Secure Contexts (HTTPS/localhost)
 * and legacy/insecure contexts (Android WebViews, local IP LAN nodes, HTTP mesh portals)
 * using an invisible textarea fallback.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // 1. Try modern Async Clipboard API if available and context is secure
    if (navigator.clipboard && (window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall through to legacy DOM copy
        }
    }

    // 2. Resilient fallback using DOM textarea selection
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        return successful;
    } catch {
        return false;
    }
}
