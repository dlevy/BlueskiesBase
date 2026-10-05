import { supabase } from '../services/supabase';

// A cover song is excluded from the "covers" filter dropdown only if every
// one of its setlist_songs rows is performance_type 'dj' — played over the
// speakers between/after sets, never covered live, so listing it alongside
// real covers would be misleading. A cover that's never been performed at
// all (no setlist_songs rows yet) still belongs in the list, same as before
// this filtering existed — it just has no DJ rows to exclude it either.
// Shared by SearchPage and admin/ShowsList, which both build this same
// dropdown from an already-fetched `songs` query.
export async function getLiveCoverTitles(songsData) {
    const covers = (songsData || []).filter(s => s.is_original === false);
    if (covers.length === 0) return [];

    const coverIds = covers.map(s => s.id);
    const { data: performances, error } = await supabase
        .from('setlist_songs')
        .select('song_id, performance_type')
        .in('song_id', coverIds);

    if (error) {
        console.error('[getLiveCoverTitles] Error fetching performance types:', error);
        // Fail open — show all covers rather than silently hiding the filter.
        return covers.map(s => s.title).sort((a, b) => a.localeCompare(b));
    }

    const typesBySong = new Map();
    (performances || []).forEach(p => {
        if (!typesBySong.has(p.song_id)) typesBySong.set(p.song_id, new Set());
        typesBySong.get(p.song_id).add(p.performance_type);
    });

    const djOnlyIds = new Set(
        [...typesBySong.entries()]
            .filter(([, types]) => types.size === 1 && types.has('dj'))
            .map(([songId]) => songId)
    );

    return covers
        .filter(s => !djOnlyIds.has(s.id))
        .map(s => s.title)
        .sort((a, b) => a.localeCompare(b));
}
