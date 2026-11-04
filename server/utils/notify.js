const { supabaseAdmin } = require('../config/supabase');

// Every function here is non-fatal by design — a notification failing to
// write should never fail the request that triggered it (same precedent as
// the notification insert in server/routes/thanks.js).

/**
 * Attendee ids for a show, minus the actor — but only if the show is in the
 * past and not canceled. "Attended" vs "planning to attend" isn't a stored
 * flag anywhere in this codebase (see user_shows) — it's always derived by
 * comparing shows.show_date to today, the same UTC-date-string comparison
 * already used in server/routes/users.js (inherits that file's known
 * UTC-vs-local-midnight edge case; not worth fixing here since it's the
 * existing convention). A canceled show never happened, so nobody "attended"
 * it regardless of date — excluded up front rather than folded into the date
 * check below.
 */
async function getPastShowAttendeeIds(showId, excludeUserId) {
    const { data: show } = await supabaseAdmin
        .from('shows')
        .select('show_date, is_cancelled')
        .eq('id', showId)
        .maybeSingle();
    if (!show || show.is_cancelled) return [];

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
 * gets exactly one row. `showId` is null for content that isn't show-scoped
 * (e.g. a forum thread) — just another column value as far as this function
 * is concerned. `type` defaults to 'show_update' for the existing show-scoped
 * callers; notifyForumReply passes 'forum_reply'.
 */
async function upsertShowUpdateNotifications({ pairs, actorId, contentType, contentId, type = 'show_update' }) {
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
            .eq('type', type)
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
                type,
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
            .select('id, show_date, is_cancelled')
            .in('id', uniqueShowIds);
        const pastShowIds = (shows || []).filter(s => s.show_date <= todayStr && !s.is_cancelled).map(s => s.id);
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
 * Scans text for @handles, matches them against real usernames, and
 * notifies each (excluding the author) — skipping anyone already notified
 * for this exact piece of content, so re-saving an edit doesn't re-notify.
 * `contentType`/`contentId` identify what was mentioned-in (a show comment,
 * a forum thread, a forum reply, ...); `showId` is optional and only
 * meaningful for show-scoped content.
 */
async function notifyMentions({ text, showId = null, actorId, contentId, contentType = 'note' }) {
    try {
        const handles = [...new Set((text.match(/@([a-zA-Z0-9_]+)/g) || []).map(m => m.slice(1).toLowerCase()))];
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
            .eq('content_type', contentType)
            .eq('content_id', contentId)
            .in('user_id', candidates.map(c => c.id));
        const alreadyNotified = new Set((existing || []).map(e => e.user_id));

        const rows = candidates
            .filter(c => !alreadyNotified.has(c.id))
            .map(c => ({
                user_id: c.id,
                type: 'mention',
                actor_id: actorId,
                content_type: contentType,
                content_id: contentId,
                show_id: showId,
            }));
        if (rows.length === 0) return;

        const { error } = await supabaseAdmin.from('notifications').insert(rows);
        if (error) console.error('[notifyMentions] insert error:', error);
    } catch (err) {
        console.error('[notifyMentions] error:', err);
    }
}

/**
 * A logged-in user flagged a photo as inaccurate or inappropriate — same
 * staff audience and same "each one is its own distinct thing to review"
 * reasoning as notifyStaffOfSubmission. Unlike that function, this report has
 * no other durable record anywhere (no dedicated table) — the notification
 * row IS the report — so a write failure here is surfaced to the caller
 * rather than swallowed, letting the route return an error instead of
 * silently losing the report.
 */
async function notifyStaffOfPhotoReport({ photoId, showId, actorId, message }) {
    const { data: staff } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'editor']);

    const recipients = (staff || []).map(p => p.id).filter(id => id !== actorId);
    if (recipients.length === 0) return;

    const rows = recipients.map(userId => ({
        user_id: userId,
        type: 'photo_report',
        actor_id: actorId,
        content_type: 'photo',
        content_id: photoId,
        show_id: showId,
        message,
    }));
    const { error } = await supabaseAdmin.from('notifications').insert(rows);
    if (error) throw error;
}

/**
 * A reported photo got deleted (whether or not the deleting admin got there
 * via the report notification) — closes out every staff member's still-open
 * photo_report notification for it, the same dismissed_at a user sets on
 * their own notification (see PUT /:notificationId/dismiss in
 * server/routes/notifications.js), just applied across every recipient at
 * once so nobody goes looking for a photo that's already gone.
 */
async function dismissPhotoReportNotifications(photoId) {
    const { error } = await supabaseAdmin
        .from('notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('type', 'photo_report')
        .eq('content_type', 'photo')
        .eq('content_id', photoId)
        .is('dismissed_at', null);
    if (error) console.error('[dismissPhotoReportNotifications] error:', error);
}

/**
 * A new reply landed on a forum thread — notifies every subscriber of that
 * thread (forum_thread_subscriptions), minus the person who just replied.
 * Posting the thread or any reply auto-subscribes the poster
 * (server/routes/forum.js), so the default audience is still "the thread's
 * author plus everyone who's replied" — but an explicit unsubscribe now
 * sticks, which a live owner+repliers derivation couldn't support.
 * Coalesced per (user, thread) per calendar day via the same primitive
 * show_update notifications use — a thread that gets five replies in an
 * hour still produces one notification per participant, bumped and
 * resurfaced as unread rather than duplicated. No show_id (forum content
 * isn't show-scoped); upsertShowUpdateNotifications already treats showId
 * as just another column to write, so passing none through the pairs here
 * simply leaves it null.
 */
async function notifyForumReply({ threadId, actorId }) {
    try {
        const { data: subRows } = await supabaseAdmin
            .from('forum_thread_subscriptions')
            .select('user_id')
            .eq('thread_id', threadId);

        const participantIds = new Set((subRows || []).map(r => r.user_id));
        participantIds.delete(actorId);
        if (participantIds.size === 0) return;

        await upsertShowUpdateNotifications({
            pairs: [...participantIds].map(userId => ({ userId, showId: null })),
            actorId,
            contentType: 'forum_thread',
            contentId: threadId,
            type: 'forum_reply',
        });
    } catch (err) {
        console.error('[notifyForumReply] error:', err);
    }
}

/**
 * A logged-in user flagged a forum thread or reply — same staff audience and
 * "no dedicated report table, the notification row IS the report" shape as
 * notifyStaffOfPhotoReport, just generalized over contentType (forum_thread
 * vs forum_reply) since both are reportable.
 */
async function notifyStaffOfForumReport({ contentType, contentId, actorId, message }) {
    const { data: staff } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'editor']);

    const recipients = (staff || []).map(p => p.id).filter(id => id !== actorId);
    if (recipients.length === 0) return;

    const rows = recipients.map(userId => ({
        user_id: userId,
        type: 'forum_report',
        actor_id: actorId,
        content_type: contentType,
        content_id: contentId,
        message,
    }));
    const { error } = await supabaseAdmin.from('notifications').insert(rows);
    if (error) throw error;
}

/**
 * A reported thread or reply got deleted — closes out every staff member's
 * still-open forum_report notification for it, same dismissed_at pattern as
 * dismissPhotoReportNotifications.
 */
async function dismissForumReportNotifications(contentType, contentId) {
    const { error } = await supabaseAdmin
        .from('notifications')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('type', 'forum_report')
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .is('dismissed_at', null);
    if (error) console.error('[dismissForumReportNotifications] error:', error);
}

module.exports = {
    notifyShowAttendees,
    notifySetlistUpdated,
    notifyPosterLinkedToShows,
    notifyStaffOfSubmission,
    notifyMentions,
    notifyStaffOfPhotoReport,
    dismissPhotoReportNotifications,
    notifyForumReply,
    notifyStaffOfForumReport,
    dismissForumReportNotifications,
};
