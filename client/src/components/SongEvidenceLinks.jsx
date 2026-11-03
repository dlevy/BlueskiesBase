import { useState } from 'react';
import { PText } from '@porsche-design-system/components-react';

// A single photo's full-screen overlay — not the multi-photo gallery lightbox
// used elsewhere (PhotosSection.jsx), since each evidence item is one
// standalone image, not a set to page through. Caption becomes a hyperlink
// (for photo credit) when caption_url is set, otherwise it's plain text.
function PhotoOverlay({ item, onClose }) {
    return (
        <div
            className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
                <img src={item.photo_url} alt={item.caption || item.label || 'Evidence photo'} className="w-full rounded-lg" />
                {item.caption && (
                    <div className="mt-2 text-center">
                        {item.caption_url ? (
                            <a href={item.caption_url} target="_blank" rel="noopener noreferrer"
                                className="text-sm underline" style={{ color: 'var(--p-color-contrast-high)' }}>
                                {item.caption}
                            </a>
                        ) : (
                            <PText size="small" color="contrast-high">{item.caption}</PText>
                        )}
                    </div>
                )}
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 mx-auto block text-xs underline"
                    style={{ color: 'var(--p-color-contrast-medium)' }}
                >
                    Close
                </button>
            </div>
        </div>
    );
}

// Small "proof" links below a confirmed-played-undated song — an external
// hyperlink opens directly; a photo opens in a full-screen overlay instead of
// navigating away. Shared by SongStatsWidget.jsx's Confirmed Played section
// and SongLyricsPage.jsx's Performance History callout.
export default function SongEvidenceLinks({ evidence }) {
    const [openPhoto, setOpenPhoto] = useState(null);
    const items = evidence?.filter(item => item.type === 'photo' ? item.photo_url : item.url) || [];
    if (items.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
            {items.map(item => item.type === 'photo' ? (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => setOpenPhoto(item)}
                    className="text-xs underline"
                    style={{ color: 'var(--p-color-info)' }}
                >
                    {item.label || 'Photo'}
                </button>
            ) : (
                <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                    style={{ color: 'var(--p-color-info)' }}
                >
                    {item.label || item.url}
                </a>
            ))}
            {openPhoto && <PhotoOverlay item={openPhoto} onClose={() => setOpenPhoto(null)} />}
        </div>
    );
}
