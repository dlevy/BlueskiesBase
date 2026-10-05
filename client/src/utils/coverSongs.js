import { supabase } from '../services/supabase';

// A cover song belongs in a "covers" filter dropdown only if the band has
// actually performed it live at least once. A song whose only setlist_songs
// rows are performance_type 'dj' was only ever played over the speakers
// between/after sets — never covered live — so listing it alongside real
// covers would be misleading. Shared by SearchPage and admin/ShowsList,
// which both build this same dropdown from an already-fetched `songs` query.
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

    const liveIds = new Set(
        (performances || [])
            .filter(p => p.performance_type !== 'dj')
            .map(p => p.song_id)
    );

    return covers
        .filter(s => liveIds.has(s.id))
        .map(s => s.title)
        .sort((a, b) => a.localeCompare(b));
}
