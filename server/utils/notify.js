const { supabaseAdmin } = require('../config/supabase');

// Every function here is non-fatal by design — a notification failing to
// write should never fail the request that triggered it (same precedent as
// the notification insert in server/routes/thanks.js).

/**
 * Attendee ids for a show, minus the actor — but only if the show is in the
 * past. "Attended" vs "planning to attend" isn't a stored flag anywhere in
 * this codebase (see user_shows) — it's always derived by comparing
 * shows.show_date to today, the same UTC-date-string comparison already used
 * in server/routes/users.js (inherits that file's known UTC-vs-local-midnight
 * edge case; not worth fixing here since it's the existing convention).
 */
async function getPastShowAttendeeIds(showId, excludeUserId) {
    const { data: show } = await supabaseAdmin
        .from('shows')
        .select('show_date')
        .eq('id', showId)
        .maybeSingle();
    if (!show) return [];

    const todayStr = new Date().toISOString().slice(0, 10);
    if (show.show_date > todayStr) return [];

    const { data: rows } = await supabaseAdmin
        .from('user_shows')
        .select('user_id')
        .eq('show_id', showId);

    return [...new Set((rows || []).map(r => r.user_id))].filter(id => id !== excludeUserId);
}

/**
 * Plain insert, one row per past attendee. For content where each new item
 * is genuinely distinct and independently worth its own notification (a
 * second photo is different news from the first) — not coalesced.
 */
async function notifyShowAttendees({ showId, actorId, contentType, contentId }) {
    try {
        const recipients = await getPastShowAttendeeIds(showId, actorId);
        if (recipients.length === 0) return;

        const rows = recipients.map(userId => ({
            user_id: userId,
            type: 'show_update',
            actor_id: actorId,
            content_type: contentType,
            content_id: contentId,
            show_id: showId,
        }));
        const { error } = await supabaseAdmin.from('notifications').insert(rows);
        if (error) console.error('[notifyShowAttendees] insert error:', error);
    } catch (err) {
        console.error('[notifyShowAttendees] error:', err);
    }
}

/**
 * Shared coalescing primitive: one logical action can fire this many times
 * (repeated setlist edits, a poster linked to many shows) but a recipient
 * should see at most one notification per (content_type, content_id) per
 * calendar day — bumped and resurfaced as unread, not duplicated. A
 * correction the next day starts a fresh one. Not race-safe under
 * concurrent edits, but edits to one show's setlist (or one poster's
 * link-range call) are effectively serialized through the admin UI.
 *
 * `pairs`: [{ userId, showId }] — deduped to one showId per userId (first
 * wins), so one person appearing via multiple shows in the same batch still
 * gets exactly one row.
 */
async function upsertShowUpdateNotifications({ pairs, actorId, contentType, contentId }) {
    try {
        const showIdByUser = new Map();
        for (const { userId, showId } of pairs) {
            if (!showIdByUser.has(userId)) showIdByUser.set(userId, showId);
        }
        const userIds = [...showIdByUser.keys()];
        if (userIds.length === 0) return;

        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);

        const { data: existing } = await supabaseAdmin
            .from('notifications')
            .select('id, user_id')
            .eq('type', 'show_update')
            .eq('content_type', contentType)
            .eq('content_id', contentId)
            .is('dismissed_at', null)
            .gte('created_at', startOfToday.toISOString())
            .in('user_id', userIds);

        const existingIdByUser = new Map((existing || []).map(n => [n.user_id, n.id]));
        const now = new Date().toISOString();

        const idsToBump = [...existingIdByUser.values()];
        if (idsToBump.length > 0) {
            const { error: updateError } = await supabaseAdmin
                .from('notifications')
                .update({ created_at: now, actor_id: actorId, read_at: null })
                .in('id', idsToBump);
            if (updateError) console.error('[upsertShowUpdateNotifications] bump error:', updateError);
        }

        const freshRows = userIds
            .filter(userId => !existingIdByUser.has(userId))
            .map(userId => ({
                user_id: userId,
                type: 'show_update',
                actor_id: actorId,
                content_type: contentType,
                content_id: contentId,
                show_id: showIdByUser.get(userId),
            }));
        if (freshRows.length > 0) {
            const { error: insertError } = await supabaseAdmin.from('notifications').insert(freshRows);
            if (insertError) console.error('[upsertShowUpdateNotifications] insert error:', insertError);
        }
    } catch (err) {
        console.error('[upsertShowUpdateNotifications] error:', err);
    }
}

/**
 * The official setlist for a show changed (direct edit, or an accepted
 * community correction) — content_id is the show's own id, since a bulk
 * setlist edit has no single row to point at.
 */
async function notifySetlistUpdated({ showId, actorId }) {
    try {
        const recipients = await getPastShowAttendeeIds(showId, actorId);
        if (recipients.length === 0) return;
        await upsertShowUpdateNotifications({
            pairs: recipients.map(userId => ({ userId, showId })),
            actorId,
            contentType: 'setlist',
            contentId: showId,
        });
    } catch (err) {
        console.error('[notifySetlistUpdated] error:', err);
    }
}

/**
 * A poster got linked to a batch of (possibly many) shows in one call —
 * batched across all of them (one shows query, one user_shows query) rather
 * than looped per show, and coalesced so one attendee of several newly
 * linked shows still gets just one notification.
 */
async function notifyPosterLinkedToShows({ showIds, actorId, posterId }) {
    try {
        const uniqueShowIds = [...new Set(showIds)];
        if (uniqueShowIds.length === 0) return;

        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: shows } = await supabaseAdmin
            .from('shows')
            .select('id, show_date')
            .in('id', uniqueShowIds);
        const pastShowIds = (shows || []).filter(s => s.show_date <= todayStr).map(s => s.id);
        if (pastShowIds.length === 0) return;

        const { data: attendeeRows } = await supabaseAdmin
            .from('user_shows')
            .select('user_id, show_id')
            .in('show_id', pastShowIds);

        const pairs = (attendeeRows || [])
            .filter(r => r.user_id !== actorId)
            .map(r => ({ userId: r.user_id, showId: r.show_id }));
        if (pairs.length === 0) return;

        await upsertShowUpdateNotifications({
            pairs,
            actorId,
            contentType: 'poster',
            contentId: posterId,
        });
    } catch (err) {
        console.error('[notifyPosterLinkedToShows] error:', err);
    }
}

/**
 * A brand-new community setlist submission needs staff review — a different
 * audience (admins/editors) and a different reason (moderation queue) than
 * the attendee-facing notifications above, so not coalesced: each new
 * submission is its own distinct thing to review.
 */
async function notifyStaffOfSubmission({ showId, actorId, contentId }) {
    try {
        const { data: staff } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .in('role', ['admin', 'editor']);

        const recipients = (staff || []).map(p => p.id).filter(id => id !== actorId);
        if (recipients.length === 0) return;

        const rows = recipients.map(userId => ({
            user_id: userId,
            type: 'submission',
            actor_id: actorId,
            content_type: 'setlist_submission',
            content_id: contentId,
            show_id: showId,
        }));
        const { error } = await supabaseAdmin.from('notifications').insert(rows);
        if (error) console.error('[notifyStaffOfSubmission] insert error:', error);
    } catch (err) {
        console.error('[notifyStaffOfSubmission] error:', err);
    }
}

/**
 * Scans comment text for @handles, matches them against real usernames, and
 * notifies each (excluding the author) — skipping anyone already notified
 * for this exact comment, so re-saving an edit doesn't re-notify.
 */
async function notifyMentions({ noteText, showId, actorId, commentId }) {
    try {
        const handles = [...new Set((noteText.match(/@([a-zA-Z0-9_]+)/g) || []).map(m => m.slice(1).toLowerCase()))];
        if (handles.length === 0) return;

        const { data: mentioned } = await supabaseAdmin
            .from('profiles')
            .select('id, username')
            .in('username', handles);
        const candidates = (mentioned || []).filter(p => p.id !== actorId);
        if (candidates.length === 0) return;

        const { data: existing } = await supabaseAdmin
            .from('notifications')
            .select('user_id')
            .eq('type', 'mention')
            .eq('content_type', 'note')
            .eq('content_id', commentId)
            .in('user_id', candidates.map(c => c.id));
        const alreadyNotified = new Set((existing || []).map(e => e.user_id));

        const rows = candidates
            .filter(c => !alreadyNotified.has(c.id))
            .map(c => ({
                user_id: c.id,
                type: 'mention',
                actor_id: actorId,
                content_type: 'note',
                content_id: commentId,
                show_id: showId,
            }));
        if (rows.length === 0) return;

        const { error } = await supabaseAdmin.from('notifications').insert(rows);
        if (error) console.error('[notifyMentions] insert error:', error);
    } catch (err) {
        console.error('[notifyMentions] error:', err);
    }
}

module.exports = {
    notifyShowAttendees,
    notifySetlistUpdated,
    notifyPosterLinkedToShows,
    notifyStaffOfSubmission,
    notifyMentions,
};
