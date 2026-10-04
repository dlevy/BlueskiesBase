import { useState, useEffect } from 'react';

// Fetches `url` and inlines it as a data: URL, rather than handing a remote
// Supabase URL straight to a graphic that will later be captured via
// html-to-image. Safari/WebKit's cross-origin canvas rules are notoriously
// unreliable for that export specifically — even once the live on-screen
// <img>/background renders fine, the export's own SVG->canvas rasterization
// step can still come back with the image missing. A data: URL has no
// cross-origin/canvas-taint question at all, for the preview or the export,
// on any browser. Shared by every graphic-export page (Instagram post, promo
// graphic) that lets the user pick a remote image as a background.
export default function useBackgroundImageDataUrl(url) {
    const [dataUrl, setDataUrl] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!url) {
            setDataUrl(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const inlined = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                });
                if (!cancelled) setDataUrl(inlined);
            } catch (err) {
                console.error('[useBackgroundImageDataUrl] Failed to inline background image, falling back to remote URL:', err);
                if (!cancelled) setDataUrl(url);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [url]);

    return { dataUrl, loading };
}
