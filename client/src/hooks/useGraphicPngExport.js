import { useState, useCallback } from 'react';
import { toPng } from 'html-to-image';

// Captures a forwardRef'd graphic node to a PNG via html-to-image, triggers a
// download, and keeps the result around (`generatedImageUrl`) so the caller
// can show an iOS Safari fallback (tapping "Download PNG" there does nothing
// visible — <a download> is silently a no-op — so showing the PNG in a real
// <img> lets a touch user long-press it and "Save Image" instead, which
// always works. Desktop browsers still get the instant auto-download).
// Shared by every graphic-export page (Instagram post, artwork).
//
// `backgroundImageDataUrl`, if given, is preloaded/decoded before capture —
// it's a CSS background-image in the graphic (not an <img>), so there's
// nothing in the DOM to call .decode() on directly; decoding an offscreen
// copy of the exact same data: URL achieves the same thing.
export default function useGraphicPngExport(graphicRef, backgroundImageDataUrl) {
    const [generating, setGenerating] = useState(false);
    const [generatedImageUrl, setGeneratedImageUrl] = useState(null);

    const download = useCallback(async (filename) => {
        if (!graphicRef.current) return;
        setGenerating(true);
        try {
            await document.fonts.ready;

            if (backgroundImageDataUrl) {
                const preload = new Image();
                preload.src = backgroundImageDataUrl;
                await preload.decode?.().catch(() => {});
            }

            // Wait a couple of paint frames so the now-decoded background has
            // actually been composited on screen, not just decoded in
            // memory, before html-to-image reads the DOM.
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            // html-to-image rasterizes the DOM by serializing it into an SVG
            // <foreignObject>, loading that SVG as a data: URL into an
            // offscreen <img>, and drawing that image onto a canvas once it
            // fires `onload`. On iOS/Safari, the very first time a given
            // WebKit process rasterizes a *new* SVG payload that embeds a
            // background image, `onload` can fire before the embedded raster
            // content is actually painted into the decoded image — so the
            // canvas draw captures a blank/background-less frame. Every
            // *subsequent* rasterization of that same kind of payload (even
            // with different embedded bytes) succeeds, which is exactly the
            // "fails once, then works every time after" symptom reported.
            // This is a known WebKit quirk with html2canvas/html-to-image
            // (not specific to our data-URL or decode handling above) — the
            // standard workaround is to render once and throw the result
            // away to "warm up" the pipeline, then render again for real.
            await toPng(graphicRef.current, { pixelRatio: 2, cacheBust: true }).catch(() => {});
            const dataUrl = await toPng(graphicRef.current, { pixelRatio: 2, cacheBust: true });

            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            link.click();
            setGeneratedImageUrl(dataUrl);
        } catch (err) {
            console.error('[useGraphicPngExport] Error generating image:', err);
            alert('Failed to generate image');
        } finally {
            setGenerating(false);
        }
    }, [graphicRef, backgroundImageDataUrl]);

    const clearGeneratedImage = useCallback(() => setGeneratedImageUrl(null), []);

    return { generating, generatedImageUrl, download, clearGeneratedImage };
}
