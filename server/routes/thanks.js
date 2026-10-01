const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');
const { resolveDisplayName } = require('../utils/privacy');

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

// Maps a thankable content_type to the real table that owns it, so the owner
// (and the show it belongs to, for the notification) is always resolved
// server-side from the actual record — never trusted from client input.
const CONTENT_TABLES = {
    photo: { table: 'user_photos', ownerCol: 'user_id', showCol: 'show_id' },
    poster: { table: 'user_posters', ownerCol: 'user_id', showCol: 'show_id' },
    note: { table: 'user_notes', ownerCol: 'user_id', showCol: 'show_id' },
    setlist_submission: { table: 'setlist_submissions', ownerCol: 'user_id', showCol: 'show_id' },
};

async function resolveContentOwner(contentType, contentId) {
    const cfg = CONTENT_TABLES[contentType];
    if (!cfg) return null;
    const { data, error } = await supabaseAdmin
        .from(cfg.table)
        .select(`${cfg.ownerCol}, ${cfg.showCol}`)
        .eq('id', contentId)
        .maybeSingle();
    if (error || !data) return null;
    return { ownerId: data[cfg.ownerCol], showId: data[cfg.showCol] };
}

/**
 * GET /api/thanks/show/:showId
 * Every thanks row relevant to a show's four content sections, in one
 * public (no auth) request. Resolves this show's content ids per type first
 * (posters via poster_show_links, since one poster can be linked to many
 * shows — see add_poster_show_links.sql — so a poster's relevance to a show
 * isn't a property storable on the thanks row itself), then queries `thanks`
 * by content id. The client groups these into per-item counts and "did I
 * thank this" locally, the same lightweight pattern already used for the
 * Posters gallery's poster_show_links grouping.
 * Response: { thanks: [{ contentType, contentId, thankedBy, thankedByName }] }
 */
router.get('/show/:showId', async (req, res) => {
    try {
        const { showId } = req.params;

        const [{ data: photos }, { data: posterLinks }, { data: notes }, { data: submissions }] = await Promise.all([
            supabaseAdmin.from('user_photos').select('id').eq('show_id', showId),
            supabaseAdmin.from('poster_show_links').select('poster_id').eq('show_id', showId),
            supabaseAdmin.from('user_notes').select('id').eq('show_id', showId),
            supabaseAdmin.from('setlist_submissions').select('id').eq('show_id', showId),
        ]);

        const idsByType = {
            photo: new Set((photos || []).map(p => p.id)),
            poster: new Set((posterLinks || []).map(l => l.poster_id)),
            note: new Set((notes || []).map(n => n.id)),
            setlist_submission: new Set((submissions || []).map(s => s.id)),
        };
        const allIds = Object.values(idsByType).flatMap(s => [...s]);

        if (allIds.length === 0) {
            return res.json({ thanks: [] });
        }

        const { data: rows, error } = await supabaseAdmin
            .from('thanks')
            .select('content_type, content_id, thanked_by, profiles:thanked_by(username, display_name, hide_from_directory)')
            .in('content_id', allIds);

        if (error) {
            console.error('Error fetching thanks:', error);
            return res.status(500).json({ error: 'Failed to fetch thanks' });
        }

        // Re-check type membership, not just id membership, as a guard
        // against a theoretical UUID collision across the four content tables.
        const relevant = (rows || [])
            .filter(r => idsByType[r.content_type]?.has(r.content_id))
            .map(r => ({
                contentType: r.content_type,
                contentId: r.content_id,
                thankedBy: r.thanked_by,
                thankedByName: resolveDisplayName(r.profiles),
            }));

        res.json({ thanks: relevant });
    } catch (error) {
        console.error('Error in GET /api/thanks/show/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/thanks
 * Thank a piece of content. Body: { contentType, contentId }. The owner and
 * show are resolved server-side (never trusted from the client) via
 * CONTENT_TABLES. Idempotent — thanking something you've already thanked is
 * a harmless no-op, not an error. Creates a notification for the recipient
 * only on a genuine first-time thanks.
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { contentType, contentId } = req.body;

        if (!CONTENT_TABLES[contentType] || !contentId) {
            return res.status(400).json({ error: 'contentType and contentId are required' });
        }

        const owner = await resolveContentOwner(contentType, contentId);
        if (!owner) {
            return res.status(404).json({ error: 'Content not found' });
        }
        if (owner.ownerId === req.user.id) {
            return res.status(400).json({ error: "You can't thank your own contribution" });
        }

        const { data: existing } = await supabaseAdmin
            .from('thanks')
            .select('id')
            .eq('content_type', contentType)
            .eq('content_id', contentId)
            .eq('thanked_by', req.user.id)
            .maybeSingle();

        if (existing) {
            return res.json({ thanked: true, alreadyThanked: true });
        }

        const { error: insertError } = await supabaseAdmin.from('thanks').insert({
            content_type: contentType,
            content_id: contentId,
            thanked_by: req.user.id,
            recipient_id: owner.ownerId,
        });

        if (insertError) {
            if (insertError.code === '23505') {
                // Unique-violation race (double-click/double-submit) — already thanked.
                return res.json({ thanked: true, alreadyThanked: true });
            }
            console.error('Error saving thanks:', insertError);
            return res.status(500).json({ error: 'Failed to save thanks' });
        }

        const { error: notifError } = await supabaseAdmin.from('notifications').insert({
            user_id: owner.ownerId,
            type: 'thanks',
            actor_id: req.user.id,
            content_type: contentType,
            content_id: contentId,
            show_id: owner.showId,
        });
        if (notifError) {
            // Non-fatal — the thanks itself already succeeded.
            console.error('Thanks saved but notification failed:', notifError);
        }

        res.json({ thanked: true, alreadyThanked: false });
    } catch (error) {
        console.error('Error in POST /api/thanks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/thanks/:contentType/:contentId
 * Un-thank a piece of content. Path params (not a JSON body), matching every
 * other DELETE route in this codebase. Also removes the matching
 * notification, so un-thanking fully undoes it rather than leaving a stale
 * notification behind.
 */
router.delete('/:contentType/:contentId', authenticate, async (req, res) => {
    try {
        const { contentType, contentId } = req.params;

        const { error } = await supabaseAdmin
            .from('thanks')
            .delete()
            .eq('content_type', contentType)
            .eq('content_id', contentId)
            .eq('thanked_by', req.user.id);

        if (error) {
            console.error('Error removing thanks:', error);
            return res.status(500).json({ error: 'Failed to remove thanks' });
        }

        const { error: notifError } = await supabaseAdmin
            .from('notifications')
            .delete()
            .eq('type', 'thanks')
            .eq('actor_id', req.user.id)
            .eq('content_type', contentType)
            .eq('content_id', contentId);
        if (notifError) {
            console.error('Thanks removed but notification cleanup failed:', notifError);
        }

        res.json({ thanked: false });
    } catch (error) {
        console.error('Error in DELETE /api/thanks/:contentType/:contentId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
