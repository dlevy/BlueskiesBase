const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { optimizeFullImage, generateThumbnail } = require('../utils/imageProcessing');
const { requireEditorOrAdmin } = require('../middleware/requireRole');
const { notifyShowAttendees, notifyPosterLinkedToShows } = require('../utils/notify');
const { redactProfile, resolveDisplayName } = require('../utils/privacy');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

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

// ============================================
// USER POSTERS ENDPOINTS
// ============================================

/**
 * GET /api/posters
 * One tile per poster, for the public Posters gallery page. Public, no auth
 * required (same as GET /show/:showId). A poster linked to more than one show
 * (poster_show_links — e.g. a single poster used for a whole tour leg) shows
 * up exactly once here: `shows` is its earliest linked show (kept as the
 * link/display target, same shape single-show posters always had), and
 * `linkedShows`/`showCount` carry the full set so the client can render a
 * date range instead of one date.
 * Sorted newest (last linked show) first in JS rather than via PostgREST's
 * foreignTable ordering — the poster count is small (a few dozen) so there's
 * no real cost to it, and it avoids depending on ordering-by-embedded-column
 * syntax this route doesn't otherwise need.
 */
router.get('/', async (req, res) => {
    try {
        const { data: rows, error } = await supabaseAdmin
            .from('poster_show_links')
            .select(`
                poster_id,
                user_posters (
                    id,
                    poster_url,
                    thumbnail_url,
                    caption,
                    is_foil,
                    poster_artist_name,
                    poster_artist_url,
                    drop_at,
                    drop_url,
                    drop_sold_out,
                    created_at
                ),
                shows (
                    id,
                    show_date,
                    artist_name,
                    tour_name,
                    venues ( name, city, state_country )
                )
            `);

        if (error) {
            console.error('Error fetching posters:', error);
            return res.status(500).json({ error: 'Failed to fetch posters' });
        }

        // A link whose poster or show has since been deleted embeds null —
        // skip it rather than ship a gallery tile with nothing to show/link to.
        const byPoster = new Map();
        (rows || []).forEach(row => {
            if (!row.user_posters || !row.shows) return;
            if (!byPoster.has(row.poster_id)) {
                byPoster.set(row.poster_id, { poster: row.user_posters, shows: [] });
            }
            byPoster.get(row.poster_id).shows.push(row.shows);
        });

        // Who owns each poster — count + display names for the gallery's
        // hover tooltip. user_poster_collection.user_id references auth.users,
        // not public.profiles, so it can't be embedded via a single select
        // (same reason GET /for-trade below resolves it as a second query).
        const { data: collectionRows } = await supabaseAdmin
            .from('user_poster_collection')
            .select('poster_id, user_id');

        const ownerIds = [...new Set((collectionRows || []).map(r => r.user_id))];
        const { data: ownerProfiles } = await supabaseAdmin
            .from('profiles')
            .select('id, username, display_name, hide_from_directory')
            .in('id', ownerIds.length > 0 ? ownerIds : ['00000000-0000-0000-0000-000000000000']);
        const profileById = {};
        (ownerProfiles || []).forEach(p => { profileById[p.id] = p; });

        const ownersByPoster = new Map();
        (collectionRows || []).forEach(row => {
            if (!ownersByPoster.has(row.poster_id)) ownersByPoster.set(row.poster_id, []);
            ownersByPoster.get(row.poster_id).push(resolveDisplayName(profileById[row.user_id]));
        });

        const withShow = Array.from(byPoster.entries()).map(([posterId, { poster, shows }]) => {
            shows.sort((a, b) => a.show_date.localeCompare(b.show_date));
            const names = ownersByPoster.get(posterId) || [];
            return {
                ...poster,
                shows: shows[0],
                linkedShows: shows,
                showCount: shows.length,
                owners: { count: names.length, names },
            };
        });

        withShow.sort((a, b) => {
            const dateCompare = b.shows.show_date.localeCompare(a.shows.show_date);
            if (dateCompare !== 0) return dateCompare;
            if (a.shows.id !== b.shows.id) return String(a.shows.id).localeCompare(String(b.shows.id));
            // Same show: regular poster always before its foil variant.
            return (a.is_foil ? 1 : 0) - (b.is_foil ? 1 : 0);
        });

        res.json({ posters: withShow });
    } catch (error) {
        console.error('Error in GET /api/posters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/posters/show/:showId
 * Both poster variants for a specific show (regular and/or foil — either, both,
 * or neither may exist). Resolved through poster_show_links rather than
 * user_posters.show_id directly, so a poster linked to this show as part of a
 * multi-show tour-leg poster (see POST /:posterId/link-range) shows up here
 * exactly the same as a poster uploaded just for this one show.
 * Response: { posters: [...] }, at most one entry per is_foil value.
 */
router.get('/show/:showId', async (req, res) => {
    try {
        const { showId } = req.params;

        const { data: links, error } = await supabaseAdmin
            .from('poster_show_links')
            .select(`
                user_posters (
                    *,
                    profiles:user_id (
                        id,
                        username,
                        display_name
                    )
                )
            `)
            .eq('show_id', showId);

        if (error) {
            console.error('Error fetching posters:', error);
            return res.status(500).json({ error: 'Failed to fetch posters' });
        }

        const posters = (links || [])
            .map(l => l.user_posters)
            .filter(Boolean)
            .sort((a, b) => (a.is_foil ? 1 : 0) - (b.is_foil ? 1 : 0));

        res.json({ posters });
    } catch (error) {
        console.error('Error in GET /api/posters/show/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/posters/upload
 * Upload a poster for a show. Body/form field is_foil ('true'/'false', default
 * false) picks which of the show's two primary variants this upload is for —
 * a show has one primary regular and one primary foil poster, uploaded/
 * replaced independently. Body field `additional` ('true'/'false', default
 * false) instead ALWAYS creates a brand-new poster rather than replacing a
 * primary slot — for the rare case of a show having more than 2 posters
 * (e.g. a special afterparty printing). Additional posters are still either
 * foil or not, just unconstrained in count.
 */
router.post('/upload', authenticate, upload.single('poster'), async (req, res) => {
    try {
        const { show_id, caption } = req.body;
        const isFoil = req.body.is_foil === 'true' || req.body.is_foil === true;
        const isAdditional = req.body.additional === 'true' || req.body.additional === true;
        const isPrimary = !isAdditional;
        const userId = req.user.id;
        const file = req.file;

        if (!show_id) {
            return res.status(400).json({ error: 'show_id is required' });
        }

        if (!file) {
            return res.status(400).json({ error: 'No poster file provided' });
        }

        // Artist credit stays editor/admin-only to set, same as it was when it
        // lived on the admin Show form — a plain member can still upload a
        // poster, just not attach/alter its credit. For a non-editor, the
        // field is left out of the insert/update entirely (rather than
        // written as null) so replacing an image never wipes out credit an
        // editor already set; the client never sends these fields for a
        // non-editor anyway, so this is just the server-side backstop.
        const { data: requesterProfile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        const isEditorOrAdmin = requesterProfile?.role === 'admin' || requesterProfile?.role === 'editor';
        const artistCreditFields = isEditorOrAdmin
            ? { poster_artist_name: req.body.poster_artist_name || null, poster_artist_url: req.body.poster_artist_url || null }
            : {};

        // Check if a PRIMARY poster of this same variant already exists for
        // this show — the regular and foil editions are replaced
        // independently. An additional-poster upload skips this lookup
        // entirely (existingPoster stays null), since it always creates a
        // new poster rather than replacing anything. Resolved through
        // poster_show_links rather than user_posters.show_id directly, so
        // this also finds a shared tour-leg poster (see POST
        // /:posterId/link-range) covering this show but anchored elsewhere.
        let existingPoster = null;
        if (isPrimary) {
            const { data: existingLink } = await supabaseAdmin
                .from('poster_show_links')
                .select('user_posters ( id, poster_url, thumbnail_url, user_id )')
                .eq('show_id', show_id)
                .eq('is_foil', isFoil)
                .eq('is_primary', true)
                .maybeSingle();
            existingPoster = existingLink?.user_posters || null;
        }

        // Replacing a poster that's shared across multiple shows would
        // silently change the image everywhere it's linked, not just here —
        // surprising and easy to do by accident. Require an explicit
        // confirmation flag rather than treating it the same as an ordinary
        // single-show replace.
        if (existingPoster) {
            const { count: linkedShowCount } = await supabaseAdmin
                .from('poster_show_links')
                .select('id', { count: 'exact', head: true })
                .eq('poster_id', existingPoster.id);

            const confirmedSharedReplace = req.body.confirm_shared_replace === 'true' || req.body.confirm_shared_replace === true;
            if ((linkedShowCount || 0) > 1 && !confirmedSharedReplace) {
                return res.status(409).json({
                    error: `This poster is also used by ${linkedShowCount - 1} other show(s) — replacing it here will replace it everywhere it's linked.`,
                    sharedWithShowCount: linkedShowCount - 1,
                    requiresConfirmation: true,
                });
            }
        }

        // If poster exists and user is not the owner, check if user is admin
        if (existingPoster && existingPoster.user_id !== userId) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('is_admin')
                .eq('id', userId)
                .single();

            if (!profile?.is_admin) {
                return res.status(403).json({ error: 'A poster already exists for this show. Only admins can replace it.' });
            }
        }

        // Re-encode for storage (strips metadata, caps dimensions, re-compresses
        // without visible quality loss) and derive a small gallery-grid thumbnail
        // from the original bytes.
        const optimized = await optimizeFullImage(file.buffer, file.mimetype);
        const thumbnail = await generateThumbnail(file.buffer);

        const base = `${userId}/${show_id}/${Date.now()}`;
        const fileName = `${base}.${optimized.ext}`;
        const thumbFileName = `${base}_thumb.${thumbnail.ext}`;

        // Upload full image + thumbnail to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from('show-posters')
            .upload(fileName, optimized.buffer, {
                contentType: optimized.contentType,
                upsert: false
            });

        if (uploadError) {
            console.error('Error uploading poster:', uploadError);
            return res.status(500).json({ error: 'Failed to upload poster' });
        }

        const { error: thumbUploadError } = await supabaseAdmin.storage
            .from('show-posters')
            .upload(thumbFileName, thumbnail.buffer, {
                contentType: thumbnail.contentType,
                upsert: false
            });
        if (thumbUploadError) {
            // Non-fatal — the full image is what matters; the gallery just falls
            // back to it when thumbnail_url is null.
            console.error('Error uploading poster thumbnail:', thumbUploadError);
        }

        // Get public URLs
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('show-posters')
            .getPublicUrl(fileName);
        const thumbnailUrl = thumbUploadError ? null : supabaseAdmin.storage
            .from('show-posters')
            .getPublicUrl(thumbFileName).data.publicUrl;

        // If poster exists, delete old file(s) and update record
        if (existingPoster) {
            // Extract old file paths from their URLs
            const oldFileName = existingPoster.poster_url.split('/show-posters/')[1];
            const oldThumbFileName = existingPoster.thumbnail_url?.split('/show-posters/')[1];
            const toRemove = [oldFileName, oldThumbFileName].filter(Boolean);
            if (toRemove.length > 0) {
                await supabaseAdmin.storage.from('show-posters').remove(toRemove);
            }

            // Update existing poster record
            const { data: poster, error: dbError } = await supabaseAdmin
                .from('user_posters')
                .update({
                    user_id: userId,
                    poster_url: publicUrl,
                    thumbnail_url: thumbnailUrl,
                    caption: caption || null,
                    updated_at: new Date().toISOString(),
                    ...artistCreditFields
                })
                .eq('id', existingPoster.id)
                .select(`
                    *,
                    profiles:user_id (
                        id,
                        username,
                        display_name
                    )
                `)
                .single();

            if (dbError) {
                console.error('Error updating poster record:', dbError);
                await supabaseAdmin.storage.from('show-posters').remove([fileName, thumbFileName]);
                return res.status(500).json({ error: 'Failed to update poster record' });
            }

            return res.json({ poster });
        }

        // Create new poster record
        const { data: poster, error: dbError } = await supabaseAdmin
            .from('user_posters')
            .insert({
                user_id: userId,
                show_id,
                poster_url: publicUrl,
                thumbnail_url: thumbnailUrl,
                caption: caption || null,
                is_foil: isFoil,
                is_primary: isPrimary,
                ...artistCreditFields
            })
            .select(`
                *,
                profiles:user_id (
                    id,
                    username,
                    display_name
                )
            `)
            .single();

        if (dbError) {
            console.error('Error saving poster record:', dbError);
            // Try to delete the uploaded files
            await supabaseAdmin.storage.from('show-posters').remove([fileName, thumbFileName]);
            return res.status(500).json({ error: 'Failed to save poster record' });
        }

        // Anchor the new poster to this show — every poster needs at least
        // one link row (see GET /show/:showId, GET / and POST /:posterId/link-range).
        // If this fails on the partial unique index (a concurrent request
        // won the race for this exact primary slot), the cleanup below
        // deletes the just-created user_posters row and storage files —
        // same as any other link-insert failure.
        const { error: linkError } = await supabaseAdmin
            .from('poster_show_links')
            .insert({ poster_id: poster.id, show_id, is_foil: isFoil, is_primary: isPrimary });
        if (linkError) {
            console.error('Error linking new poster to its show:', linkError);
            await supabaseAdmin.from('user_posters').delete().eq('id', poster.id);
            await supabaseAdmin.storage.from('show-posters').remove([fileName, thumbFileName]);
            return res.status(500).json({ error: 'Failed to save poster record' });
        }

        await notifyShowAttendees({ showId: show_id, actorId: userId, contentType: 'poster', contentId: poster.id });

        res.json({ poster });
    } catch (error) {
        console.error('Error in POST /api/posters/upload:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/posters/:posterId/shows
 * Every show currently linked to this poster, for an admin "manage links"
 * panel. A poster uploaded for just one show has exactly one entry here;
 * a tour-leg poster (see POST /:posterId/link-range) has one per show it
 * covers. Editor/admin only.
 */
router.get('/:posterId/shows', requireEditorOrAdmin, async (req, res) => {
    try {
        const { posterId } = req.params;

        const { data: links, error } = await supabaseAdmin
            .from('poster_show_links')
            .select('id, shows ( id, show_date, artist_name, venues ( name, city, state_country ) )')
            .eq('poster_id', posterId);

        if (error) {
            console.error('Error fetching poster shows:', error);
            return res.status(500).json({ error: 'Failed to fetch linked shows' });
        }

        const shows = (links || [])
            .filter(l => l.shows)
            .map(l => ({ linkId: l.id, ...l.shows }))
            .sort((a, b) => a.show_date.localeCompare(b.show_date));

        res.json({ shows });
    } catch (error) {
        console.error('Error in GET /api/posters/:posterId/shows:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/posters/:posterId/link-range
 * Link this poster to every show by the same artist within [startDate,
 * endDate] (inclusive) that doesn't already have a *different* poster of the
 * same variant — e.g. one poster used for a whole tour leg. "Same variant"
 * means matching both is_foil AND is_primary, so a primary poster's range
 * never conflicts with an unrelated additional poster at the same show, and
 * vice versa. Shows already linked to a different poster of this variant are
 * reported as skipped, not overwritten, so the admin can resolve any
 * conflict manually. Safe to re-run: shows already linked to *this* poster
 * are reported separately and left alone.
 * Body: { startDate, endDate } (YYYY-MM-DD, inclusive). Editor/admin only.
 */
router.post('/:posterId/link-range', requireEditorOrAdmin, async (req, res) => {
    try {
        const { posterId } = req.params;
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        if (startDate > endDate) {
            return res.status(400).json({ error: 'startDate must be on or before endDate' });
        }

        const { data: poster, error: posterError } = await supabaseAdmin
            .from('user_posters')
            .select('id, is_foil, is_primary, shows ( artist_name )')
            .eq('id', posterId)
            .single();
        if (posterError || !poster) {
            return res.status(404).json({ error: 'Poster not found' });
        }

        const { data: candidateShows, error: showsError } = await supabaseAdmin
            .from('shows')
            .select('id, show_date, artist_name, venues ( name, city, state_country )')
            .eq('artist_name', poster.shows.artist_name)
            .gte('show_date', startDate)
            .lte('show_date', endDate)
            .order('show_date');

        if (showsError) {
            console.error('Error fetching candidate shows:', showsError);
            return res.status(500).json({ error: 'Failed to look up shows in range' });
        }

        if (!candidateShows || candidateShows.length === 0) {
            return res.json({ linked: [], alreadyLinked: [], skipped: [] });
        }

        const showIds = candidateShows.map(s => s.id);
        const { data: existingLinks, error: linksError } = await supabaseAdmin
            .from('poster_show_links')
            .select('show_id, poster_id')
            .eq('is_foil', poster.is_foil)
            .eq('is_primary', poster.is_primary)
            .in('show_id', showIds);

        if (linksError) {
            console.error('Error checking existing poster links:', linksError);
            return res.status(500).json({ error: 'Failed to check existing poster links' });
        }

        const posterIdByShowId = new Map((existingLinks || []).map(l => [l.show_id, l.poster_id]));

        const toLink = [];
        const alreadyLinked = [];
        const skipped = [];
        candidateShows.forEach(show => {
            const linkedPosterId = posterIdByShowId.get(show.id);
            if (linkedPosterId === poster.id) alreadyLinked.push(show);
            else if (linkedPosterId) skipped.push(show);
            else toLink.push(show);
        });

        if (toLink.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('poster_show_links')
                .insert(toLink.map(show => ({ poster_id: poster.id, show_id: show.id, is_foil: poster.is_foil, is_primary: poster.is_primary })));

            if (insertError) {
                console.error('Error linking poster to range:', insertError);
                return res.status(500).json({ error: 'Failed to link poster to shows' });
            }

            await notifyPosterLinkedToShows({ showIds: toLink.map(s => s.id), actorId: req.user.id, posterId });
        }

        res.json({ linked: toLink, alreadyLinked, skipped });
    } catch (error) {
        console.error('Error in POST /api/posters/:posterId/link-range:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/posters/:posterId/shows/:showId
 * Unlink one show from a poster without deleting the poster itself (it may
 * still be linked to other shows). Refuses to remove a poster's last
 * remaining link — delete the poster instead if that's the goal, so it
 * doesn't silently vanish from every page while still taking up storage.
 * Editor/admin only.
 */
router.delete('/:posterId/shows/:showId', requireEditorOrAdmin, async (req, res) => {
    try {
        const { posterId, showId } = req.params;

        const { count, error: countError } = await supabaseAdmin
            .from('poster_show_links')
            .select('id', { count: 'exact', head: true })
            .eq('poster_id', posterId);

        if (countError) {
            console.error('Error counting poster links:', countError);
            return res.status(500).json({ error: 'Failed to unlink show' });
        }
        if ((count || 0) <= 1) {
            return res.status(400).json({ error: "Can't unlink a poster's last remaining show — delete the poster instead." });
        }

        const { error } = await supabaseAdmin
            .from('poster_show_links')
            .delete()
            .eq('poster_id', posterId)
            .eq('show_id', showId);

        if (error) {
            console.error('Error unlinking show:', error);
            return res.status(500).json({ error: 'Failed to unlink show' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/posters/:posterId/shows/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// POSTER COLLECTION ENDPOINTS
// (which show posters a user owns — foil vs. regular is a property of which
// poster they picked, via user_posters.is_foil, not tracked separately here)
// ============================================

/**
 * GET /api/posters/collection
 * The logged-in user's own poster collection, each entry joined with the poster
 * (and its show) it refers to. Requires authentication.
 */
router.get('/collection', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_poster_collection')
            .select(`
                id,
                created_at,
                for_trade,
                trade_comment,
                edition_type,
                user_posters (
                    id,
                    poster_url,
                    is_foil,
                    shows (
                        id,
                        show_date,
                        artist_name,
                        tour_name,
                        venues ( name, city, state_country )
                    )
                )
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching poster collection:', error);
            return res.status(500).json({ error: 'Failed to fetch poster collection' });
        }

        res.json({ collection: data || [] });
    } catch (error) {
        console.error('Error in GET /api/posters/collection:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/posters/collection
 * Add a poster to the logged-in user's collection. Body: { posterId }.
 * Requires authentication.
 */
router.post('/collection', authenticate, async (req, res) => {
    try {
        const { posterId } = req.body;
        if (!posterId) {
            return res.status(400).json({ error: 'posterId is required' });
        }

        const { data: poster, error: posterError } = await supabaseAdmin
            .from('user_posters')
            .select('id')
            .eq('id', posterId)
            .single();
        if (posterError || !poster) {
            return res.status(404).json({ error: 'Poster not found' });
        }

        const { data, error } = await supabaseAdmin
            .from('user_poster_collection')
            .upsert(
                { user_id: req.user.id, poster_id: posterId },
                { onConflict: 'user_id,poster_id' }
            )
            .select()
            .single();

        if (error) {
            console.error('Error adding to poster collection:', error);
            return res.status(500).json({ error: 'Failed to add poster to collection' });
        }

        res.status(201).json(data);
    } catch (error) {
        console.error('Error in POST /api/posters/collection:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/posters/collection/:id
 * Remove a poster from the logged-in user's collection.
 */
router.delete('/collection/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('user_poster_collection')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) {
            console.error('Error removing from poster collection:', error);
            return res.status(500).json({ error: 'Failed to remove poster from collection' });
        }

        res.json({ message: 'Removed from collection' });
    } catch (error) {
        console.error('Error in DELETE /api/posters/collection/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/posters/collection/:id
 * List (or un-list) an owned poster as available for sale/trade, with an
 * optional comment, and/or mark it an original print vs an AP (Artist's
 * Proof). Owner only.
 * Body: { forTrade?: boolean, tradeComment?: string|null, editionType?: 'original'|'ap' }
 */
router.put('/collection/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { forTrade, tradeComment, editionType } = req.body;

        if (editionType !== undefined && !['original', 'ap'].includes(editionType)) {
            return res.status(400).json({ error: "editionType must be 'original' or 'ap'" });
        }

        const { data: row, error: fetchError } = await supabaseAdmin
            .from('user_poster_collection')
            .select('user_id')
            .eq('id', id)
            .maybeSingle();
        if (fetchError || !row) {
            return res.status(404).json({ error: 'Collection entry not found' });
        }
        if (row.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to edit this collection entry' });
        }

        const update = {};
        if (typeof forTrade === 'boolean') update.for_trade = forTrade;
        if (tradeComment !== undefined) update.trade_comment = tradeComment ? String(tradeComment).trim() || null : null;
        if (editionType !== undefined) update.edition_type = editionType;

        const { data, error } = await supabaseAdmin
            .from('user_poster_collection')
            .update(update)
            .eq('id', id)
            .select('id, for_trade, trade_comment, edition_type')
            .single();
        if (error) {
            console.error('Error updating collection trade status:', error);
            return res.status(500).json({ error: 'Failed to update' });
        }

        res.json(data);
    } catch (error) {
        console.error('Error in PUT /api/posters/collection/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/posters/for-trade
 * Every poster currently listed for sale/trade, across all members — public.
 * A hidden (hide_from_directory) owner's listing still appears, just with
 * their identity redacted to "Private", same as the directory/notes/thanks.
 */
router.get('/for-trade', async (req, res) => {
    try {
        // user_poster_collection.user_id references auth.users, not
        // public.profiles, so PostgREST can't auto-embed a profiles join here
        // (unlike tables such as user_notes/user_photos, which reference
        // profiles directly) — resolved as a second query instead.
        const { data, error } = await supabaseAdmin
            .from('user_poster_collection')
            .select(`
                id,
                user_id,
                trade_comment,
                created_at,
                user_posters (
                    id,
                    poster_url,
                    thumbnail_url,
                    is_foil,
                    shows (
                        id,
                        show_date,
                        artist_name,
                        tour_name,
                        venues ( name, city, state_country )
                    )
                )
            `)
            .eq('for_trade', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching for-trade posters:', error);
            return res.status(500).json({ error: 'Failed to fetch for-trade posters' });
        }

        const filtered = (data || []).filter(row => row.user_posters?.shows);

        const ownerIds = [...new Set(filtered.map(row => row.user_id))];
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, username, display_name, avatar_url, hide_from_directory')
            .in('id', ownerIds.length > 0 ? ownerIds : ['00000000-0000-0000-0000-000000000000']);
        const profileById = {};
        (profiles || []).forEach(p => { profileById[p.id] = p; });

        const listings = filtered.map(row => ({
            id: row.id,
            tradeComment: row.trade_comment,
            posterUrl: row.user_posters.poster_url,
            thumbnailUrl: row.user_posters.thumbnail_url,
            hasFoil: row.user_posters.is_foil,
            show: row.user_posters.shows,
            owner: redactProfile(profileById[row.user_id]),
        }));

        res.json({ listings });
    } catch (error) {
        console.error('Error in GET /api/posters/for-trade:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/posters/collection/:id/interest
 * Express interest in (or reply about) a for-trade listing — delivered as a
 * notification, not a real messaging system. Body: { message, replyToUserId? }.
 *
 * - Non-owner, no replyToUserId: the normal "Interested" case. Recipient is
 *   the listing owner. Requires the listing to currently be for_trade,
 *   UNLESS these two people already have prior correspondence on this exact
 *   listing (so a seller toggling for_trade off mid-conversation doesn't cut
 *   off a buyer they're already talking to).
 * - Owner, with replyToUserId: a reply. Only allowed if replyToUserId has a
 *   prior inbound message on this listing — the owner can't cold-open a
 *   conversation with a stranger, only answer someone who already reached out.
 * - Repeated "Interested" clicks before any reply bump the existing
 *   notification instead of creating duplicates.
 */
router.post('/collection/:id/interest', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { message, replyToUserId } = req.body;

        if (!message || !String(message).trim()) {
            return res.status(400).json({ error: 'message is required' });
        }
        const trimmedMessage = String(message).trim();

        const { data: collection, error: fetchError } = await supabaseAdmin
            .from('user_poster_collection')
            .select('id, user_id, for_trade, user_posters ( show_id )')
            .eq('id', id)
            .maybeSingle();
        if (fetchError || !collection) {
            return res.status(404).json({ error: 'Collection entry not found' });
        }

        const ownerId = collection.user_id;
        const isOwner = req.user.id === ownerId;

        let recipientId;
        if (isOwner) {
            if (!replyToUserId) {
                return res.status(400).json({ error: 'replyToUserId is required when replying as the listing owner' });
            }
            recipientId = replyToUserId;
        } else {
            recipientId = ownerId;
        }

        // Prior correspondence between these exact two people on this listing, either direction.
        const { data: priorRows } = await supabaseAdmin
            .from('notifications')
            .select('id, user_id, actor_id, created_at')
            .eq('type', 'poster_interest')
            .eq('content_type', 'poster_collection')
            .eq('content_id', id)
            .in('user_id', [req.user.id, recipientId])
            .in('actor_id', [req.user.id, recipientId]);
        const hasPriorCorrespondence = (priorRows || []).length > 0;

        if (!hasPriorCorrespondence) {
            if (isOwner) {
                return res.status(400).json({ error: "You can only reply to someone who has already contacted you about this listing" });
            }
            if (!collection.for_trade) {
                return res.status(400).json({ error: "This poster isn't listed for sale/trade" });
            }
        } else if (isOwner && !(priorRows || []).some(r => r.user_id === ownerId && r.actor_id === replyToUserId)) {
            // Owner must be replying to someone who actually messaged them, not
            // someone the owner themselves already messaged with no reply yet.
            return res.status(403).json({ error: 'Not authorized to message this user about this listing' });
        }

        // Dedup: only bump an existing message FROM this sender TO this
        // recipient if it's still the most recent thing between them (i.e.
        // the recipient hasn't replied since) — a repeat "Interested" click
        // with nothing new in between, not a genuine new message in an
        // ongoing back-and-forth.
        const fromMe = (priorRows || [])
            .filter(r => r.user_id === recipientId && r.actor_id === req.user.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        const fromThem = (priorRows || [])
            .filter(r => r.user_id === req.user.id && r.actor_id === recipientId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        const existing = fromMe && (!fromThem || new Date(fromMe.created_at) > new Date(fromThem.created_at)) ? fromMe : null;

        const showId = collection.user_posters?.show_id || null;

        if (existing) {
            const { error: updateError } = await supabaseAdmin
                .from('notifications')
                .update({ message: trimmedMessage, created_at: new Date().toISOString(), read_at: null })
                .eq('id', existing.id);
            if (updateError) {
                console.error('Error updating poster interest notification:', updateError);
                return res.status(500).json({ error: 'Failed to send message' });
            }
        } else {
            const { error: insertError } = await supabaseAdmin
                .from('notifications')
                .insert({
                    user_id: recipientId,
                    type: 'poster_interest',
                    actor_id: req.user.id,
                    content_type: 'poster_collection',
                    content_id: id,
                    show_id: showId,
                    message: trimmedMessage,
                });
            if (insertError) {
                console.error('Error inserting poster interest notification:', insertError);
                return res.status(500).json({ error: 'Failed to send message' });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in POST /api/posters/collection/:id/interest:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// POSTER WANTS ENDPOINTS
// (shows a user is looking to acquire a poster for — a wishlist, independent
// of anything they already own in user_poster_collection)
// ============================================

/**
 * GET /api/posters/wants
 * The logged-in user's own wanted-posters list, each entry joined with its
 * show. Requires authentication.
 */
router.get('/wants', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_poster_wants')
            .select(`
                id,
                variant,
                created_at,
                shows (
                    id,
                    show_date,
                    artist_name,
                    tour_name,
                    venues ( name, city, state_country )
                )
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching poster wants:', error);
            return res.status(500).json({ error: 'Failed to fetch poster wants' });
        }

        res.json({ wants: data || [] });
    } catch (error) {
        console.error('Error in GET /api/posters/wants:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/posters/wants
 * Add a show to the logged-in user's wanted-posters list.
 * Body: { showId, variant } — variant is 'any' | 'regular' | 'foil', defaults to 'any'.
 */
router.post('/wants', authenticate, async (req, res) => {
    try {
        const { showId, variant } = req.body;
        if (!showId) {
            return res.status(400).json({ error: 'showId is required' });
        }
        const validVariants = ['any', 'regular', 'foil'];
        if (variant && !validVariants.includes(variant)) {
            return res.status(400).json({ error: `variant must be one of: ${validVariants.join(', ')}` });
        }

        const { data: show, error: showError } = await supabaseAdmin
            .from('shows')
            .select('id')
            .eq('id', showId)
            .single();
        if (showError || !show) {
            return res.status(404).json({ error: 'Show not found' });
        }

        const { data, error } = await supabaseAdmin
            .from('user_poster_wants')
            .upsert(
                { user_id: req.user.id, show_id: showId, variant: variant || 'any' },
                { onConflict: 'user_id,show_id' }
            )
            .select()
            .single();

        if (error) {
            console.error('Error adding poster want:', error);
            return res.status(500).json({ error: 'Failed to add to wanted list' });
        }

        res.status(201).json(data);
    } catch (error) {
        console.error('Error in POST /api/posters/wants:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/posters/wants/:id
 * Remove a show from the logged-in user's wanted-posters list.
 */
router.delete('/wants/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('user_poster_wants')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) {
            console.error('Error removing poster want:', error);
            return res.status(500).json({ error: 'Failed to remove from wanted list' });
        }

        res.json({ message: 'Removed from wanted list' });
    } catch (error) {
        console.error('Error in DELETE /api/posters/wants/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/posters/:posterId
 * Update poster caption (owner or admin) and/or artist credit (editor/admin
 * only — see POST /upload for why credit stays at that higher bar). Lets an
 * editor fix/add credit without re-uploading the image.
 */
router.put('/:posterId', authenticate, async (req, res) => {
    try {
        const { posterId } = req.params;
        const { caption, posterArtistName, posterArtistUrl, dropAt, dropUrl, dropSoldOut } = req.body;
        const userId = req.user.id;

        // Check if user is admin/editor
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('is_admin, role')
            .eq('id', userId)
            .single();

        const isAdmin = profile?.is_admin || false;
        const isEditorOrAdmin = profile?.role === 'admin' || profile?.role === 'editor';

        // Get the poster to check ownership
        const { data: poster } = await supabaseAdmin
            .from('user_posters')
            .select('user_id')
            .eq('id', posterId)
            .single();

        if (!poster) {
            return res.status(404).json({ error: 'Poster not found' });
        }

        // Check if user owns the poster or is admin
        if (poster.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to update this poster' });
        }

        const update = { caption };
        if (isEditorOrAdmin) {
            if (posterArtistName !== undefined) update.poster_artist_name = posterArtistName || null;
            if (posterArtistUrl !== undefined) update.poster_artist_url = posterArtistUrl || null;

            if (dropAt !== undefined) {
                if (dropAt) {
                    const parsed = new Date(dropAt);
                    if (isNaN(parsed.getTime())) {
                        return res.status(400).json({ error: 'Drop date/time must be a valid date' });
                    }
                    update.drop_at = parsed.toISOString();
                } else {
                    update.drop_at = null;
                }
            }
            if (dropUrl !== undefined) {
                if (dropUrl) {
                    if (dropUrl.length > 500) {
                        return res.status(400).json({ error: 'Drop URL must be 500 characters or fewer' });
                    }
                    try {
                        new URL(dropUrl);
                    } catch {
                        return res.status(400).json({ error: `"${dropUrl}" is not a valid URL` });
                    }
                    update.drop_url = dropUrl;
                } else {
                    update.drop_url = null;
                }
            }
            if (dropSoldOut !== undefined) update.drop_sold_out = Boolean(dropSoldOut);
        }

        const { data: updatedPoster, error } = await supabaseAdmin
            .from('user_posters')
            .update(update)
            .eq('id', posterId)
            .select(`
                *,
                profiles:user_id (
                    id,
                    username,
                    display_name
                )
            `)
            .single();

        if (error) {
            console.error('Error updating poster:', error);
            return res.status(500).json({ error: 'Failed to update poster' });
        }

        res.json({ poster: updatedPoster });
    } catch (error) {
        console.error('Error in PUT /api/posters/:posterId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/posters/:posterId
 * Delete a poster (owner or admin only)
 */
router.delete('/:posterId', authenticate, async (req, res) => {
    try {
        const { posterId } = req.params;
        const userId = req.user.id;

        // Check if user is an admin or editor — both can delete any poster,
        // not just their own (editors help moderate a show's media alongside
        // admins; they still can't delete other users' accounts or the
        // catalog entities themselves — see server/middleware/requireRole.js).
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role, is_admin')
            .eq('id', userId)
            .single();

        const canModerate = profile?.is_admin || profile?.role === 'editor' || false;

        // Get the poster to check ownership and get file path
        const { data: poster } = await supabaseAdmin
            .from('user_posters')
            .select('user_id, poster_url, thumbnail_url')
            .eq('id', posterId)
            .single();

        if (!poster) {
            return res.status(404).json({ error: 'Poster not found' });
        }

        // Check if user owns the poster or can moderate
        if (poster.user_id !== userId && !canModerate) {
            return res.status(403).json({ error: 'Not authorized to delete this poster' });
        }

        // Delete from database
        const { error: dbError } = await supabaseAdmin
            .from('user_posters')
            .delete()
            .eq('id', posterId);

        if (dbError) {
            console.error('Error deleting poster from database:', dbError);
            return res.status(500).json({ error: 'Failed to delete poster' });
        }

        // Delete file(s) from storage
        const fileName = poster.poster_url.split('/show-posters/')[1];
        const thumbFileName = poster.thumbnail_url?.split('/show-posters/')[1];
        const toRemove = [fileName, thumbFileName].filter(Boolean);
        if (toRemove.length > 0) {
            const { error: storageError } = await supabaseAdmin.storage
                .from('show-posters')
                .remove(toRemove);

            if (storageError) {
                console.error('Error deleting poster file:', storageError);
                // Don't fail the request if file deletion fails
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/posters/:posterId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

