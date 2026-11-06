import { useState, useEffect, useCallback, useRef } from 'react';
import { PSpinner, PText, PHeading } from '@porsche-design-system/components-react';
import { searchShowsForForum, getShowById } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import { formatVenueLocation } from '../utils/geography';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500";
const btnSecondary = "inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-medium border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

// show_date is a plain DATE string (YYYY-MM-DD) — parsed via its parts
// directly, same reasoning as ForumCategoryPage's formatShowDate.
function formatShowDate(dateString) {
    const [y, m, d] = dateString.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function venueLabel(venues) {
    if (!venues) return '';
    return `${venues.name} — ${formatVenueLocation(venues)}`;
}

function showLabel(show) {
    const parts = [show.artist_name];
    if (show.venues) parts.push(`at ${show.venues.name}, ${formatVenueLocation(show.venues)}`);
    parts.push(`– ${formatShowDate(show.show_date)}`);
    return parts.join(' ');
}

// Each set becomes a "Set N:" line followed by one "- Song" line per song —
// renderForumBody (utils/forumMarkup.jsx) turns consecutive "- " lines into
// an actual bulleted list rather than a single comma-separated paragraph.
function buildSetlistText(show) {
    const setKeys = [['set1', 'Set 1'], ['set2', 'Set 2'], ['set3', 'Set 3'], ['encore', 'Encore']];
    const lines = [`**${showLabel(show)}**`];
    for (const [key, label] of setKeys) {
        const songs = show.setlist?.[key];
        if (songs && songs.length > 0) {
            lines.push('', `${label}:`);
            songs.forEach(s => lines.push(`- ${s.title}`));
        }
    }
    lines.push('', `[View full show](${buildShowPath(show)})`);
    return lines.join('\n');
}

/**
 * Modal show picker for the compose toolbar's "Setlist Link" / "Insert
 * Setlist" buttons — same debounced-search-as-you-type shape as
 * ForumCategoryPage's ShowDiscussionPicker, but searches every show (not
 * just ones lacking a discussion) via GET /forum/shows-search.
 *
 * mode 'link' calls onInsert with a single [label](/show/...) line.
 * mode 'setlist' fetches the full show (for its setlist) and calls onInsert
 * with a formatted multi-line block — a plain-text paste the member can
 * still edit afterward, not a live embed.
 */
export default function ShowLinkPicker({ mode, onInsert, onCancel }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pickingId, setPickingId] = useState(null);
    const [error, setError] = useState(null);
    const debounceRef = useRef(null);

    const search = useCallback((q) => {
        setLoading(true);
        searchShowsForForum(q)
            .then(data => setResults(data.shows || []))
            .catch(err => {
                console.error('[ShowLinkPicker] Error searching shows:', err);
                setError('Failed to load shows');
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { search(''); }, [search]);

    const handleQueryChange = (value) => {
        setQuery(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(value), 300);
    };

    const handlePick = async (show) => {
        try {
            setPickingId(show.id);
            setError(null);
            if (mode === 'link') {
                onInsert(`[${showLabel(show)}](${buildShowPath(show)})`);
                return;
            }
            const full = await getShowById(show.id);
            onInsert(buildSetlistText(full));
        } catch (err) {
            console.error('[ShowLinkPicker] Error inserting show:', err);
            setError(err.message || 'Failed to insert show');
            setPickingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-20" onClick={onCancel}>
            <div
                className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-3"
                onClick={e => e.stopPropagation()}
            >
                <PHeading size="sm" tag="h2">{mode === 'link' ? 'Insert a Setlist Link' : 'Insert a Setlist'}</PHeading>
                <PText size="xs" color="contrast-medium">
                    {mode === 'link' ? 'Pick a show to link to.' : "Pick a show — its setlist pastes in as text you can still edit."}
                </PText>
                {error && <PText size="xs" style={{ color: 'var(--p-color-error)' }}>{error}</PText>}
                <input
                    type="text"
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    placeholder="Search by artist, venue, city, or date…"
                    className={inputClass}
                    autoFocus
                />
                <div className="max-h-80 overflow-y-auto space-y-1.5">
                    {loading ? (
                        <div className="flex justify-center py-6"><PSpinner size="small" aria={{ 'aria-label': 'Searching shows' }} /></div>
                    ) : results.length === 0 ? (
                        <PText size="sm" color="contrast-medium" align="center" className="py-4 block">No matching shows.</PText>
                    ) : (
                        results.map(show => (
                            <button
                                key={show.id}
                                type="button"
                                disabled={pickingId !== null}
                                onClick={() => handlePick(show)}
                                className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 hover:border-amber-500/20 hover:bg-white/10 transition-all px-3 py-2 disabled:opacity-50"
                            >
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium truncate" style={{ color: 'var(--p-color-primary)' }}>{show.artist_name}</span>
                                    <span className="block text-xs truncate" style={{ color: 'var(--p-color-contrast-medium)' }}>{venueLabel(show.venues)}</span>
                                </span>
                                <span className="shrink-0 text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                    {pickingId === show.id ? 'Inserting…' : formatShowDate(show.show_date)}
                                </span>
                            </button>
                        ))
                    )}
                </div>
                <button className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} disabled={pickingId !== null} onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </div>
    );
}
