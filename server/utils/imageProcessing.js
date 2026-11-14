const sharp = require('sharp');

// Longest edge a "full size" stored image is allowed to keep. Phone cameras
// routinely produce 3000-4000px originals that are never displayed anywhere
// near that size (lightbox included) — downscaling this far is invisible on
// screen but cuts bytes substantially.
const MAX_FULL_DIMENSION = 2400;
const FULL_JPEG_QUALITY = 85; // visually lossless for photographic content
const THUMBNAIL_MAX_DIMENSION = 600;
const THUMBNAIL_WEBP_QUALITY = 80; // fine at thumbnail scale, never used at full size
// Mid-size copy for the show page's poster slot and main photo viewer, which
// display at roughly 330-450 CSS px — 1200px covers that on a 2-3x phone
// screen. Lossy is invisible at that scale; the full-size original is still
// what the lightbox opens.
const DISPLAY_MAX_DIMENSION = 1200;
const DISPLAY_WEBP_QUALITY = 82;

const PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/heic', 'image/heif']);

/**
 * Re-encode an uploaded image for storage without visible quality loss.
 * - Photos (JPEG/HEIC): re-encoded as mozjpeg JPEG at a visually-lossless
 *   quality. This also fixes HEIC uploads (iPhone default) rendering broken
 *   in every non-Safari browser today, since HEIC has near-zero <img> support.
 * - Everything else (PNG, WebP, graphics/posters with flat color or text):
 *   re-encoded as lossless WebP — guaranteed pixel-identical, just smaller
 *   than PNG for the same content.
 * Both branches cap the longest edge at MAX_FULL_DIMENSION and strip EXIF/
 * metadata (after applying any orientation tag, so images don't end up
 * sideways).
 */
async function optimizeFullImage(buffer, mimetype) {
    const oriented = sharp(buffer, { failOn: 'none' }).rotate();
    const resized = oriented.resize({
        width: MAX_FULL_DIMENSION,
        height: MAX_FULL_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
    });

    if (PHOTO_MIME_TYPES.has(mimetype)) {
        const outBuffer = await resized.jpeg({ quality: FULL_JPEG_QUALITY, mozjpeg: true }).toBuffer();
        return { buffer: outBuffer, contentType: 'image/jpeg', ext: 'jpg' };
    }

    const outBuffer = await resized.webp({ lossless: true, effort: 6 }).toBuffer();
    return { buffer: outBuffer, contentType: 'image/webp', ext: 'webp' };
}

/**
 * Small derived image for gallery grid tiles (Posters/Photos pages, the photo
 * strip on a show's Photos section). Lossy is fine here — it's never shown
 * larger than a few hundred px, so no visible artifact risk.
 */
async function generateThumbnail(buffer) {
    const outBuffer = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize({ width: THUMBNAIL_MAX_DIMENSION, height: THUMBNAIL_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: THUMBNAIL_WEBP_QUALITY })
        .toBuffer();
    return { buffer: outBuffer, contentType: 'image/webp', ext: 'webp' };
}

/**
 * Mid-size derived image (see DISPLAY_MAX_DIMENSION) for in-page display
 * where the thumbnail is too small and the full-size original far too heavy.
 */
async function generateDisplayImage(buffer) {
    const outBuffer = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize({ width: DISPLAY_MAX_DIMENSION, height: DISPLAY_MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: DISPLAY_WEBP_QUALITY })
        .toBuffer();
    return { buffer: outBuffer, contentType: 'image/webp', ext: 'webp' };
}

module.exports = { optimizeFullImage, generateThumbnail, generateDisplayImage, MAX_FULL_DIMENSION, THUMBNAIL_MAX_DIMENSION, DISPLAY_MAX_DIMENSION };
