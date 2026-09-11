const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Middleware to verify authentication
 */
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
};

/**
 * Middleware to check if user is admin — must run after authenticate.
 */
const checkAdmin = async (req, res, next) => {
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', req.user.id)
        .single();

    if (error || !profile || !profile.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    req.isAdmin = true;
    next();
};

const SET_TO_NUMBER = { set1: 1, set2: 2, set3: 3, encore: 1 };
const VALID_SETS = Object.keys(SET_TO_NUMBER);

// ============================================
// COMMUNITY SETLIST SUBMISSIONS
//
// A logged-in user's best recollection of a show's setlist, even partial.
// Kept separate from the official setlist_songs table — visible immediately,
// attributed to the submitter, but never silently merged into the canonical
// setlist that feeds JSON-LD/tour-rarity/the sitemap. An admin pulls
// individual songs into the official setlist via the /merge endpoint below.
// ============================================

/**
 * GET /api/setlist-submissions/show/:showId
 * All community submissions for a show, with submitter usernames and songs.
 */
router.get('/show/:showId', async (req, res) => {
    try {
        const { showId } = req.params;

        const { data: submissions, error } = await supabaseAdmin
            .from('setlist_submissions')
            .select(`
                id,
                note,
                created_at,
                updated_at,
                profiles:user_id ( id, username ),
                setlist_submission_songs (
                    id,
                    song_id,
                    song_order,
                    notes,
                    merged_into_setlist,
                    songs ( id, title, original_artist, is_original )
                )
            `)
            .eq('show_id', showId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[GET /setlist-submissions/show/:showId] Error:', error);
            return res.status(500).json({ error: 'Failed to fetch setlist submissions' });
        }

        const withSortedSongs = (submissions || []).map(sub => ({
            ...sub,
            setlist_submission_songs: [...(sub.setlist_submission_songs || [])].sort((a, b) => a.song_order - b.song_order),
        }));

        res.json({ submissions: withSortedSongs });
    } catch (error) {
        console.error('Error in GET /setlist-submissions/show/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/setlist-submissions/user/:showId
 * The authenticated user's own submission for a show (to pre-fill the edit form).
 */
router.get('/user/:showId', authenticate, async (req, res) => {
    try {
        const { showId } = req.params;

        const { data: submission, error } = await supabaseAdmin
            .from('setlist_submissions')
            .select(`
                id,
                note,
                setlist_submission_songs (
                    id, song_id, song_order, notes, merged_into_setlist,
                    songs ( id, title, original_artist, is_original )
                )
            `)
            .eq('show_id', showId)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (error) {
            console.error('[GET /setlist-submissions/user/:showId] Error:', error);
            return res.status(500).json({ error: 'Failed to fetch your setlist submission' });
        }

        if (submission) {
            submission.setlist_submission_songs = [...submission.setlist_submission_songs].sort((a, b) => a.song_order - b.song_order);
        }

        res.json({ submission });
    } catch (error) {
        console.error('Error in GET /setlist-submissions/user/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/setlist-submissions
 * Create or update the authenticated user's submission for a show (one per
 * user per show — resubmitting replaces the song list).
 * Body: { show_id, note?, songs: [{ song_id, notes? }] } — order is the
 * array order. Requires at least one song; use DELETE to remove a submission
 * entirely.
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { show_id, note, songs } = req.body;
        const userId = req.user.id;

        if (!show_id) {
            return res.status(400).json({ error: 'show_id is required' });
        }
        if (!Array.isArray(songs) || songs.length === 0) {
            return res.status(400).json({ error: 'At least one song is required' });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const [index, item] of songs.entries()) {
            if (!item.song_id || !uuidRegex.test(item.song_id)) {
                return res.status(400).json({ error: `Entry ${index + 1}: song_id is missing or invalid` });
            }
        }

        const { data: show, error: showError } = await supabaseAdmin
            .from('shows')
            .select('id')
            .eq('id', show_id)
            .single();
        if (showError || !show) {
            return res.status(404).json({ error: 'Show not found' });
        }

        const songIds = [...new Set(songs.map(s => s.song_id))];
        const { data: existingSongs, error: songCheckError } = await supabaseAdmin
            .from('songs')
            .select('id')
            .in('id', songIds);
        if (songCheckError) {
            return res.status(500).json({ error: 'Failed to validate songs' });
        }
        const existingSongIds = new Set(existingSongs.map(s => s.id));
        const missing = songIds.filter(id => !existingSongIds.has(id));
        if (missing.length > 0) {
            return res.status(400).json({ error: 'Some songs do not exist', missingSongIds: missing });
        }

        // Upsert the parent submission row.
        const { data: existingSubmission } = await supabaseAdmin
            .from('setlist_submissions')
            .select('id')
            .eq('show_id', show_id)
            .eq('user_id', userId)
            .maybeSingle();

        let submissionId;
        if (existingSubmission) {
            submissionId = existingSubmission.id;
            const { error: updateError } = await supabaseAdmin
                .from('setlist_submissions')
                .update({ note: note || null, updated_at: new Date().toISOString() })
                .eq('id', submissionId);
            if (updateError) {
                console.error('[POST /setlist-submissions] Error updating submission:', updateError);
                return res.status(500).json({ error: 'Failed to save submission' });
            }
            // Replace the song list wholesale — simplest way to honor reordering/removal
            // in one request, same approach the admin setlist editor uses.
            const { error: deleteError } = await supabaseAdmin
                .from('setlist_submission_songs')
                .delete()
                .eq('submission_id', submissionId);
            if (deleteError) {
                console.error('[POST /setlist-submissions] Error clearing old songs:', deleteError);
                return res.status(500).json({ error: 'Failed to save submission' });
            }
        } else {
            const { data: newSubmission, error: insertError } = await supabaseAdmin
                .from('setlist_submissions')
                .insert({ show_id, user_id: userId, note: note || null })
                .select('id')
                .single();
            if (insertError) {
                console.error('[POST /setlist-submissions] Error creating submission:', insertError);
                return res.status(500).json({ error: 'Failed to save submission' });
            }
            submissionId = newSubmission.id;
        }

        const songRows = songs.map((s, index) => ({
            submission_id: submissionId,
            song_id: s.song_id,
            song_order: index + 1,
            notes: s.notes || null,
        }));
        const { error: songsInsertError } = await supabaseAdmin
            .from('setlist_submission_songs')
            .insert(songRows);
        if (songsInsertError) {
            console.error('[POST /setlist-submissions] Error inserting songs:', songsInsertError);
            return res.status(500).json({ error: 'Failed to save submission songs' });
        }

        const { data: full, error: fetchError } = await supabaseAdmin
            .from('setlist_submissions')
            .select(`
                id, note, created_at, updated_at,
                profiles:user_id ( id, username ),
                setlist_submission_songs (
                    id, song_id, song_order, notes, merged_into_setlist,
                    songs ( id, title, original_artist, is_original )
                )
            `)
            .eq('id', submissionId)
            .single();
        if (fetchError) {
            console.error('[POST /setlist-submissions] Error re-fetching submission:', fetchError);
            return res.status(500).json({ error: 'Saved, but failed to load the result' });
        }
        full.setlist_submission_songs = [...full.setlist_submission_songs].sort((a, b) => a.song_order - b.song_order);

        res.json({ submission: full });
    } catch (error) {
        console.error('Error in POST /setlist-submissions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/setlist-submissions/:submissionId
 * Delete a submission (owner or admin). Cascades to its songs.
 */
router.delete('/:submissionId', authenticate, async (req, res) => {
    try {
        const { submissionId } = req.params;

        const { data: submission, error: fetchError } = await supabaseAdmin
            .from('setlist_submissions')
            .select('user_id')
            .eq('id', submissionId)
            .single();
        if (fetchError || !submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('is_admin')
            .eq('id', req.user.id)
            .single();
        const isAdmin = profile?.is_admin || false;

        if (submission.user_id !== req.user.id && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this submission' });
        }

        const { error: deleteError } = await supabaseAdmin
            .from('setlist_submissions')
            .delete()
            .eq('id', submissionId);
        if (deleteError) {
            console.error('[DELETE /setlist-submissions/:submissionId] Error:', deleteError);
            return res.status(500).json({ error: 'Failed to delete submission' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /setlist-submissions/:submissionId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/setlist-submissions/songs/:songRowId/merge
 * Admin only. Copies one submitted song into the official setlist_songs
 * table (appended to the end of the chosen set) and flags it merged.
 * Body: { target_set: 'set1' | 'set2' | 'set3' | 'encore' }
 */
router.post('/songs/:songRowId/merge', authenticate, checkAdmin, async (req, res) => {
    try {
        const { songRowId } = req.params;
        const { target_set } = req.body;

        if (!VALID_SETS.includes(target_set)) {
            return res.status(400).json({ error: `target_set must be one of: ${VALID_SETS.join(', ')}` });
        }

        const { data: songRow, error: songRowError } = await supabaseAdmin
            .from('setlist_submission_songs')
            .select('id, song_id, notes, merged_into_setlist, setlist_submissions ( show_id )')
            .eq('id', songRowId)
            .single();
        if (songRowError || !songRow) {
            return res.status(404).json({ error: 'Submitted song not found' });
        }
        if (songRow.merged_into_setlist) {
            return res.status(409).json({ error: 'This song has already been merged' });
        }

        const showId = songRow.setlist_submissions.show_id;
        const setNumber = SET_TO_NUMBER[target_set];
        const isEncore = target_set === 'encore';

        const { data: existingInSet } = await supabaseAdmin
            .from('setlist_songs')
            .select('song_order')
            .eq('show_id', showId)
            .eq('set_number', setNumber)
            .eq('is_encore', isEncore)
            .order('song_order', { ascending: false })
            .limit(1);
        const nextOrder = (existingInSet?.[0]?.song_order || 0) + 1;

        const { data: inserted, error: insertError } = await supabaseAdmin
            .from('setlist_songs')
            .insert({
                show_id: showId,
                song_id: songRow.song_id,
                set_number: setNumber,
                song_order: nextOrder,
                is_encore: isEncore,
                notes: songRow.notes,
                performance_type: 'full',
            })
            .select(`
                id, song_id, set_number, song_order, is_encore, notes, jams_into, performance_type,
                songs ( id, title, original_artist, is_original, written_by )
            `)
            .single();
        if (insertError) {
            console.error('[POST /setlist-submissions/songs/:songRowId/merge] Error inserting into setlist_songs:', insertError);
            return res.status(500).json({ error: 'Failed to add song to the official setlist' });
        }

        const { error: flagError } = await supabaseAdmin
            .from('setlist_submission_songs')
            .update({ merged_into_setlist: true })
            .eq('id', songRowId);
        if (flagError) {
            console.error('[POST /setlist-submissions/songs/:songRowId/merge] Error flagging merged:', flagError);
            // The song made it into the official setlist; failing to flag it is non-fatal
            // (worst case it can be merged again, creating a duplicate the admin can remove).
        }

        res.json({ setlist_song: inserted });
    } catch (error) {
        console.error('Error in POST /setlist-submissions/songs/:songRowId/merge:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
