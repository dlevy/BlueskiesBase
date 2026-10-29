import { useState, useEffect } from 'react';

// Same inlining useBackgroundImageDataUrl does for a single background
// image, batched for the Tour Mosaic — one poster per tile, up to several
// dozen distinct URLs captured in a single export. Dedupes by URL (a poster
// covering a whole tour leg backs several shows) so each one is only
// fetched once no matter how many tiles use it.
export default function useBackgroundImageDataUrls(urls) {
    const [dataUrlByUrl, setDataUrlByUrl] = useState({});
    const [loading, setLoading] = useState(false);

    const distinctKey = [...new Set((urls || []).filter(Boolean))].sort().join('|');

    useEffect(() => {
        const distinct = distinctKey ? distinctKey.split('|') : [];
        if (distinct.length === 0) {
            setDataUrlByUrl({});
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        Promise.all(distinct.map(async (url) => {
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
                return [url, inlined];
            } catch (err) {
                console.error('[useBackgroundImageDataUrls] Failed to inline background image, falling back to remote URL:', url, err);
                return [url, url];
            }
        })).then(entries => {
            if (!cancelled) setDataUrlByUrl(Object.fromEntries(entries));
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => { cancelled = true; };
    }, [distinctKey]);

    return { dataUrlByUrl, loading };
}
