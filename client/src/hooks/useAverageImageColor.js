import { useState, useEffect } from 'react';

// Samples a small downscaled copy of `dataUrl` via an offscreen canvas and
// returns its average RGB color as a CSS rgb(...) string — used to pick a
// border color that roughly matches whatever poster/artwork is in use,
// rather than a fixed color that wouldn't suit every image. Expects a
// data: URL specifically (not a remote one) so getImageData never throws on
// a cross-origin-tainted canvas — the caller already has one on hand via
// useBackgroundImageDataUrl for the html-to-image export, so this reuses it
// rather than fetching the image a second time.
const SAMPLE_SIZE = 32;

export default function useAverageImageColor(dataUrl) {
    const [color, setColor] = useState(null);

    useEffect(() => {
        if (!dataUrl) { setColor(null); return; }
        let cancelled = false;

        const img = new Image();
        img.onload = () => {
            if (cancelled) return;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = SAMPLE_SIZE;
                canvas.height = SAMPLE_SIZE;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
                const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 4) {
                    r += data[i]; g += data[i + 1]; b += data[i + 2];
                    count++;
                }
                if (!cancelled) {
                    setColor(`rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`);
                }
            } catch (err) {
                console.error('[useAverageImageColor] Failed to sample image color:', err);
                if (!cancelled) setColor(null);
            }
        };
        img.onerror = () => { if (!cancelled) setColor(null); };
        img.src = dataUrl;

        return () => { cancelled = true; };
    }, [dataUrl]);

    return color;
}
