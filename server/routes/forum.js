const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAdmin, requireEditorOrAdmin } = require('../middleware/requireRole');
const { notifyForumReply, notifyMentions, notifyStaffOfForumReport, dismissForumReportNotifications } = require('../utils/notify');
const { redactProfile } = require('../utils/privacy');
const { formatVenueLocation } = require('../utils/venueLabel');

const TITLE_MAX_LENGTH = 200;
const BODY_MAX_LENGTH = 5000;
const REPORT_REASONS = ['spam', 'inappropriate'];
const REPORT_NOTE_MAX_LENGTH = 280;

const AUTHOR_SELECT = 'profiles:user_id ( id, username, display_name, hide_from_directory )';
const SHOW_SELECT = 'shows ( id, show_date, artist_name, is_cancelled, venues ( name, city, state, country, state_country ) )';

/**
 * Middleware to verify authentication — same shape as every other route
 * file's own local copy (notes.js, photos.js); not yet unified into
 * middleware/requireRole.js.
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

function validateTitleAndBody({ title, body }) {
    if (!title || !title.trim()) return 'Title is required';
    if (title.trim().length > TITLE_MAX_LENGTH) return `Title must be ${TITLE_MAX_LENGTH} characters or fewer`;
    if (!body || !body.trim()) return 'Body is required';
    if (body.trim().length > BODY_MAX_LENGTH) return `Body must be ${BODY_MAX_LENGTH} characters or fewer`;
    return null;
}

/**
 * Subscribes a user to a thread's reply notifications, idempotently.
 * Called whenever someone posts a thread or a reply, so the default
 * notified audience stays "the thread's author plus everyone who's
 * replied" — same as before subscriptions existed — while still letting an
 * explicit unsubscribe (DELETE /threads/:id/subscription) stick until they
 * post again. Awaited and logged like every other mutation in this file,
 * not swallowed as non-fatal the way notify.js's own notification sends are
 * — a user should reliably end up subscribed after posting.
 */
async function ensureSubscribed(threadId, userId) {
    const { error } = await supabase
        .from('forum_thread_subscriptions')
        .upsert({ thread_id: threadId, user_id: userId }, { onConflict: 'thread_id,user_id', ignoreDuplicates: true });
    if (error) console.error('[ensureSubscribed] error:', error);
}

// ============================================
// CATEGORIES
// Declared before the generic /threads/:id routes below, same ordering
// links.js uses for its /categories sub-resource vs. /:id.
// ============================================

/**
 * GET /api/forum/categories
 * All categories in admin-defined display order, each with a thread_count —
 * including a synthetic "Other" entry (id: null) when any thread has had its
 * category deleted out from under it, same fallback the Links page uses.
 */
router.get('/categories', async (req, res) => {
    try {
        const { data: categories, error } = await supabase
            .from('forum_categories')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error fetching forum categories:', error);
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }

        const { data: threadCategoryIds, error: countError } = await supabase
            .from('forum_threads')
            .select('category_id');

        if (countError) {
            console.error('Error fetching forum thread counts:', countError);
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }

        const counts = {};
        let otherCount = 0;
        (threadCategoryIds || []).forEach(({ category_id }) => {
            if (category_id) counts[category_id] = (counts[category_id] || 0) + 1;
            else otherCount++;
        });

        const result = (categories || []).map(c => ({ ...c, thread_count: counts[c.id] || 0 }));
        if (otherCount > 0) {
            result.push({ id: null, name: 'Other', description: null, sort_order: Number.MAX_SAFE_INTEGER, thread_count: otherCount });
        }

        res.json({ categories: result });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/forum/categories
 * Create a new category (admin only — matches links.js's actual category
 * CRUD guard, not its own comment, which says editor-or-admin).
 */
router.post('/categories', requireAdmin, async (req, res) => {
    try {
        const { name, description, is_show_discussion_category } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const { data: existing } = await supabase
            .from('forum_categories')
            .select('sort_order')
            .order('sort_order', { ascending: false })
            .limit(1);
        const nextSortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;

        // At most one category ever carries this flag — clear it from
        // whichever one currently has it before (maybe) setting it here.
        if (is_show_discussion_category) {
            await supabase.from('forum_categories').update({ is_show_discussion_category: false }).eq('is_show_discussion_category', true);
        }

        const { data: category, error } = await supabase
            .from('forum_categories')
            .insert([{ name: name.trim(), description: description?.trim() || null, sort_order: nextSortOrder, is_show_discussion_category: !!is_show_discussion_category }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'A category with this name already exists' });
            console.error('Error creating forum category:', error);
            return res.status(500).json({ error: 'Failed to create category' });
        }

        res.status(201).json({ category });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/forum/categories/:id
 * Update a category's name/description/sort_order (admin only).
 */
router.put('/categories/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, sort_order, is_show_discussion_category } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (description !== undefined) updates.description = description?.trim() || null;
        if (sort_order !== undefined) updates.sort_order = sort_order;
        if (is_show_discussion_category !== undefined) updates.is_show_discussion_category = !!is_show_discussion_category;
        updates.updated_at = new Date().toISOString();

        // Same "only one category ever has this" clearing as POST above —
        // skipped when explicitly unsetting it on this category, since
        // there's nothing to clear elsewhere in that case.
        if (is_show_discussion_category) {
            await supabase.from('forum_categories').update({ is_show_discussion_category: false }).eq('is_show_discussion_category', true).neq('id', id);
        }

        const { data: category, error } = await supabase
            .from('forum_categories')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'A category with this name already exists' });
            console.error('Error updating forum category:', error);
            return res.status(500).json({ error: 'Failed to update category' });
        }

        res.json({ category });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/forum/categories/:id
 * Delete a category (admin only). Threads in this category fall back to
 * null (rendered under "Other" on the public page) via ON DELETE SET NULL.
 */
router.delete('/categories/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('forum_categories').delete().eq('id', id);
        if (error) {
            console.error('Error deleting forum category:', error);
            return res.status(500).json({ error: 'Failed to delete category' });
        }
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// MODERATION QUEUE
// Declared before /threads/:id so "reports" is never swallowed as an :id.
// ============================================

/**
 * GET /api/forum/reports
 * Every open (non-dismissed) forum_report notification, deduped to one entry
 * per actual report (each fans out to one notification row per staff
 * recipient) — resolved back to its parent thread (for a reply report, via
 * one extra lookup) so the client can link straight to it.
 */
router.get('/reports', requireEditorOrAdmin, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('notifications')
            .select(`
                content_type, content_id, actor_id, message, created_at,
                profiles:actor_id ( username, display_name )
            `)
            .eq('type', 'forum_report')
            .is('dismissed_at', null)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching forum reports:', error);
            return res.status(500).json({ error: 'Failed to fetch forum reports' });
        }

        const seen = new Set();
        const deduped = [];
        for (const row of rows || []) {
            const key = `${row.content_type}:${row.content_id}:${row.actor_id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(row);
        }

        const replyIds = deduped.filter(r => r.content_type === 'forum_reply').map(r => r.content_id);
        let replyThreadById = {};
        if (replyIds.length > 0) {
            const { data: replies } = await supabase
                .from('forum_replies')
                .select('id, thread_id, body, forum_threads ( title )')
                .in('id', replyIds);
            (replies || []).forEach(r => { replyThreadById[r.id] = { threadId: r.thread_id, threadTitle: r.forum_threads?.title, excerpt: r.body }; });
        }

        const threadIds = deduped.filter(r => r.content_type === 'forum_thread').map(r => r.content_id);
        let threadById = {};
        if (threadIds.length > 0) {
            const { data: threads } = await supabase.from('forum_threads').select('id, title').in('id', threadIds);
            (threads || []).forEach(t => { threadById[t.id] = t.title; });
        }

        const reports = deduped.map(row => {
            const isReply = row.content_type === 'forum_reply';
            const threadId = isReply ? replyThreadById[row.content_id]?.threadId : row.content_id;
            const threadTitle = isReply ? replyThreadById[row.content_id]?.threadTitle : threadById[row.content_id];
            return {
                contentType: row.content_type,
                contentId: row.content_id,
                threadId,
                threadTitle: threadTitle || null,
                excerpt: isReply ? replyThreadById[row.content_id]?.excerpt : null,
                reporter: row.profiles,
                message: row.message,
                createdAt: row.created_at,
            };
        });

        res.json({ reports });
    } catch (error) {
        console.error('Error in GET /api/forum/reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/forum/reports/resolve
 * Staff clears open report(s) for a thread or reply without deleting it.
 * Body: { contentType: 'forum_thread'|'forum_reply', contentId }
 */
router.post('/reports/resolve', requireEditorOrAdmin, async (req, res) => {
    try {
        const { contentType, contentId } = req.body;
        if (!['forum_thread', 'forum_reply'].includes(contentType) || !contentId) {
            return res.status(400).json({ error: 'contentType and contentId are required' });
        }
        await dismissForumReportNotifications(contentType, contentId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error in POST /api/forum/reports/resolve:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// THREADS
// ============================================

/**
 * GET /api/forum/threads?category=<id|other>
 * Every thread in a category (or every thread with no category, for
 * category=other), pinned first then by most recent activity. Unpaginated —
 * same posture as notes.js's per-show comment list, appropriate while this
 * is a small community forum.
 */
router.get('/threads', async (req, res) => {
    try {
        const { category } = req.query;
        let query = supabase
            .from('forum_threads')
            .select(`*, ${AUTHOR_SELECT}, forum_categories ( id, name )`)
            .order('is_pinned', { ascending: false })
            .order('last_activity_at', { ascending: false });

        if (category === 'other') {
            query = query.is('category_id', null);
        } else if (category) {
            query = query.eq('category_id', category);
        }

        const { data: threads, error } = await query;
        if (error) {
            console.error('Error fetching forum threads:', error);
            return res.status(500).json({ error: 'Failed to fetch threads' });
        }

        // Reply counts, batched in one query rather than one per thread.
        const threadIds = (threads || []).map(t => t.id);
        let replyCounts = {};
        if (threadIds.length > 0) {
            const { data: replyRows } = await supabase.from('forum_replies').select('thread_id').in('thread_id', threadIds);
            (replyRows || []).forEach(r => { replyCounts[r.thread_id] = (replyCounts[r.thread_id] || 0) + 1; });
        }

        const result = (threads || []).map(t => ({ ...t, profiles: redactProfile(t.profiles), reply_count: replyCounts[t.id] || 0 }));
        res.json({ threads: result });
    } catch (error) {
        console.error('Error in GET /api/forum/threads:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/forum/search?q=&limit=&category=
 * Finds threads by title, thread body, or any reply's body underneath them
 * — so a buried reply's content is findable too. Same fetch-all-then-
 * filter-in-memory posture as GET /shows-without-discussion (small forum,
 * simplicity over scalability; no full-text search/tsvector exists anywhere
 * in this codebase). `q` is required — this isn't a browse endpoint, that's
 * what GET /threads is for. limit defaults 20, capped 50. `category`
 * optionally scopes results to one category ('other' for uncategorized,
 * matching GET /threads's convention) — used when searching from within a
 * category page rather than the forum-wide search on the main forum page.
 *
 * Each result carries matched_in: 'title' | 'body' | 'reply' so the client
 * can show *why* it matched. When matched_in is 'reply', matching_reply is
 * also included (the earliest-matching reply under that thread) so the
 * result row can show a snippet of it — a thread matching both its own
 * text and a reply reports 'title'/'body' (the more prominent match).
 */
router.get('/search', async (req, res) => {
    try {
        const q = (req.query.q || '').trim().toLowerCase();
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
        const { category } = req.query;
        if (!q) return res.json({ results: [] });

        async function fetchAll(table, select) {
            let rows = [];
            for (let rangeStart = 0; ; ) {
                const { data: page, error } = await supabase.from(table).select(select).range(rangeStart, rangeStart + 999);
                if (error) throw error;
                rows = rows.concat(page || []);
                if (!page || page.length < 1000) break;
                rangeStart += 1000;
            }
            return rows;
        }

        const [threads, replies] = await Promise.all([
            fetchAll('forum_threads', `id, title, body, category_id, created_at, last_activity_at, is_pinned, is_locked, ${AUTHOR_SELECT}, forum_categories ( id, name )`),
            fetchAll('forum_replies', `id, thread_id, body, created_at, ${AUTHOR_SELECT}`),
        ]);

        const matchingReplyByThread = new Map();
        for (const r of replies) {
            if (matchingReplyByThread.has(r.thread_id)) continue;
            if (r.body.toLowerCase().includes(q)) matchingReplyByThread.set(r.thread_id, r);
        }

        const replyCounts = {};
        replies.forEach(r => { replyCounts[r.thread_id] = (replyCounts[r.thread_id] || 0) + 1; });

        const scopedThreads = category === 'other'
            ? threads.filter(t => !t.category_id)
            : category
                ? threads.filter(t => t.category_id === category)
                : threads;

        const results = [];
        for (const t of scopedThreads) {
            const titleMatch = t.title.toLowerCase().includes(q);
            const bodyMatch = t.body.toLowerCase().includes(q);
            const matchingReply = matchingReplyByThread.get(t.id);
            if (!titleMatch && !bodyMatch && !matchingReply) continue;

            results.push({
                ...t,
                profiles: redactProfile(t.profiles),
                reply_count: replyCounts[t.id] || 0,
                matched_in: titleMatch ? 'title' : bodyMatch ? 'body' : 'reply',
                matching_reply: (!titleMatch && !bodyMatch && matchingReply) ? {
                    id: matchingReply.id,
                    body: matchingReply.body,
                    profiles: redactProfile(matchingReply.profiles),
                    created_at: matchingReply.created_at,
                } : null,
            });
        }

        results.sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at));
        res.json({ results: results.slice(0, limit) });
    } catch (error) {
        console.error('Error in GET /api/forum/search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/forum/threads/by-show/:showId
 * The show-discussion thread for a show, if one's been started yet (null
 * otherwise) — the show page uses this to show "Start Discussion" or
 * "View Discussion". Declared before /threads/:id purely for readability;
 * the extra path segment already makes the two unambiguous to Express.
 */
router.get('/threads/by-show/:showId', async (req, res) => {
    try {
        const { data: thread, error } = await supabase
            .from('forum_threads')
            .select('id, title')
            .eq('show_id', req.params.showId)
            .maybeSingle();
        if (error) {
            console.error('Error fetching show discussion thread:', error);
            return res.status(500).json({ error: 'Failed to fetch discussion thread' });
        }
        res.json({ thread: thread || null });
    } catch (error) {
        console.error('Error in GET /api/forum/threads/by-show/:showId:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/forum/shows-without-discussion?q=&limit=
 * Shows that don't have a discussion thread yet — backs the show picker
 * shown in place of the normal "New Thread" form on the show-discussion
 * category's page (that category only ever gets threads via POST
 * /threads/for-show, one per show). `q` matches artist name, venue name,
 * city, or the raw YYYY-MM-DD date string; newest shows first, capped at
 * `limit` (default 20, max 50) since this backs a live-typing picker, not a
 * full browse list.
 */
router.get('/shows-without-discussion', async (req, res) => {
    try {
        const q = (req.query.q || '').trim().toLowerCase();
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

        const { data: linkedRows } = await supabase.from('forum_threads').select('show_id').not('show_id', 'is', null);
        const linkedIds = new Set((linkedRows || []).map(r => r.show_id));

        // Paginated fetch (shows can exceed PostgREST's 1000-row default) —
        // the resulting set is small enough to filter in memory, same
        // posture as several other show listings in this codebase.
        let shows = [];
        for (let rangeStart = 0; ; ) {
            const { data: page, error } = await supabase
                .from('shows')
                .select('id, show_date, artist_name, venues ( name, city, state, country, state_country )')
                .order('show_date', { ascending: false })
                .order('day_order', { ascending: false })
                .range(rangeStart, rangeStart + 999);
            if (error) {
                console.error('Error fetching shows for discussion picker:', error);
                return res.status(500).json({ error: 'Failed to fetch shows' });
            }
            shows = shows.concat(page || []);
            if (!page || page.length < 1000) break;
            rangeStart += 1000;
        }

        let candidates = shows.filter(s => !linkedIds.has(s.id));
        if (q) {
            candidates = candidates.filter(s =>
                s.artist_name.toLowerCase().includes(q) ||
                s.venues?.name?.toLowerCase().includes(q) ||
                s.venues?.city?.toLowerCase().includes(q) ||
                s.show_date.includes(q)
            );
        }

        res.json({ shows: candidates.slice(0, limit) });
    } catch (error) {
        console.error('Error in GET /api/forum/shows-without-discussion:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/forum/shows-search?q=&limit=
 * Same shape and matching rules as GET /shows-without-discussion, but over
 * every show rather than only ones lacking a discussion — backs the compose
 * toolbar's "insert a setlist link / insert a setlist" show picker, which
 * needs to find any show, discussed or not.
 */
router.get('/shows-search', async (req, res) => {
    try {
        const q = (req.query.q || '').trim().toLowerCase();
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

        let shows = [];
        for (let rangeStart = 0; ; ) {
            const { data: page, error } = await supabase
                .from('shows')
                .select('id, show_date, artist_name, venues ( name, city, state, country, state_country )')
                .order('show_date', { ascending: false })
                .order('day_order', { ascending: false })
                .range(rangeStart, rangeStart + 999);
            if (error) {
                console.error('Error fetching shows for compose-toolbar picker:', error);
                return res.status(500).json({ error: 'Failed to fetch shows' });
            }
            shows = shows.concat(page || []);
            if (!page || page.length < 1000) break;
            rangeStart += 1000;
        }

        let candidates = shows;
        if (q) {
            candidates = candidates.filter(s =>
                s.artist_name.toLowerCase().includes(q) ||
                s.venues?.name?.toLowerCase().includes(q) ||
                s.venues?.city?.toLowerCase().includes(q) ||
                s.show_date.includes(q)
            );
        }

        res.json({ shows: candidates.slice(0, limit) });
    } catch (error) {
        console.error('Error in GET /api/forum/shows-search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/forum/threads/for-show
 * Lazily starts (or finds) the one discussion thread for a show — never
 * automatic, only ever in response to a member clicking "Start Discussion"
 * on the show page. Body: { show_id }. Title/body are auto-generated (same
 * "{artist} at {venue} – {date}" convention as the show page's own SEO
 * title); filed under whichever category has is_show_discussion_category
 * set, or left uncategorized ("Other") if no admin has set one yet — the
 * feature still works, just without a home category until configured.
 * Race-safe: two members clicking at once both reach the unique index on
 * show_id; the loser's insert fails with 23505 and gets handed back the
 * winner's thread instead of an error, so there's still only ever one.
 */
router.post('/threads/for-show', authenticate, async (req, res) => {
    try {
        const { show_id } = req.body;
        if (!show_id) return res.status(400).json({ error: 'show_id is required' });

        const { data: existingThread } = await supabase.from('forum_threads').select('id').eq('show_id', show_id).maybeSingle();
        if (existingThread) return res.json({ thread: existingThread, alreadyExisted: true });

        const { data: show, error: showError } = await supabase
            .from('shows')
            .select('artist_name, show_date, venues ( name, city, state, country, state_country )')
            .eq('id', show_id)
            .maybeSingle();
        if (showError || !show) return res.status(404).json({ error: 'Show not found' });

        const { data: discussionCategory } = await supabase
            .from('forum_categories')
            .select('id')
            .eq('is_show_discussion_category', true)
            .maybeSingle();

        const [y, m, d] = show.show_date.split('-');
        const longDate = new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const venueLabel = show.venues
            ? `${show.venues.name}, ${formatVenueLocation(show.venues)}`
            : null;
        const title = (venueLabel ? `${show.artist_name} at ${venueLabel} – ${longDate}` : `${show.artist_name} – ${longDate}`).slice(0, TITLE_MAX_LENGTH);
        const body = "Share your thoughts on this show — setlist, performance, sound, whatever's on your mind.";

        const { data: thread, error } = await supabase
            .from('forum_threads')
            .insert([{ category_id: discussionCategory?.id || null, show_id, user_id: req.user.id, title, body }])
            .select(`*, ${AUTHOR_SELECT}, forum_categories ( id, name ), ${SHOW_SELECT}`)
            .single();

        if (error) {
            if (error.code === '23505') {
                // Lost the race — someone else's thread for this show landed first.
                const { data: winner } = await supabase.from('forum_threads').select('id').eq('show_id', show_id).maybeSingle();
                if (winner) return res.json({ thread: winner, alreadyExisted: true });
            }
            console.error('Error creating show discussion thread:', error);
            return res.status(500).json({ error: 'Failed to start discussion' });
        }

        await ensureSubscribed(thread.id, req.user.id);
        await notifyMentions({ text: body, actorId: req.user.id, contentId: thread.id, contentType: 'forum_thread' });

        res.status(201).json({ thread: { ...thread, profiles: redactProfile(thread.profiles) }, alreadyExisted: false });
    } catch (error) {
        console.error('Error in POST /api/forum/threads/for-show:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/forum/threads/:id
 * A single thread plus every reply, oldest first.
 */
router.get('/threads/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: thread, error: threadError } = await supabase
            .from('forum_threads')
            .select(`*, ${AUTHOR_SELECT}, forum_categories ( id, name ), ${SHOW_SELECT}`)
            .eq('id', id)
            .maybeSingle();

        if (threadError) {
            console.error('Error fetching forum thread:', threadError);
            return res.status(500).json({ error: 'Failed to fetch thread' });
        }
        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        const { data: replies, error: repliesError } = await supabase
            .from('forum_replies')
            .select(`*, ${AUTHOR_SELECT}`)
            .eq('thread_id', id)
            .order('created_at', { ascending: true });

        if (repliesError) {
            console.error('Error fetching forum replies:', repliesError);
            return res.status(500).json({ error: 'Failed to fetch replies' });
        }

        res.json({
            thread: { ...thread, profiles: redactProfile(thread.profiles) },
            replies: (replies || []).map(r => ({ ...r, profiles: redactProfile(r.profiles) })),
        });
    } catch (error) {
        console.error('Error in GET /api/forum/threads/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/forum/threads
 * Start a new thread (any authenticated member). Body: { category_id, title, body }
 */
router.post('/threads', authenticate, async (req, res) => {
    try {
        const { category_id, title, body } = req.body;
        const validationError = validateTitleAndBody({ title, body });
        if (validationError) return res.status(400).json({ error: validationError });

        // The show-discussion category only ever gets threads via POST
        // /threads/for-show (one per show, auto-titled) — never a freeform
        // one, so every thread filed there is guaranteed to carry a show_id.
        if (category_id) {
            const { data: category } = await supabase.from('forum_categories').select('is_show_discussion_category').eq('id', category_id).maybeSingle();
            if (category?.is_show_discussion_category) {
                return res.status(400).json({ error: 'This category is reserved for show discussions — start one from a show page instead.' });
            }
        }

        const { data: thread, error } = await supabase
            .from('forum_threads')
            .insert([{
                category_id: category_id || null,
                user_id: req.user.id,
                title: title.trim(),
                body: body.trim(),
            }])
            .select(`*, ${AUTHOR_SELECT}, forum_categories ( id, name )`)
            .single();

        if (error) {
            console.error('Error creating forum thread:', error);
            return res.status(500).json({ error: 'Failed to create thread' });
        }

        await ensureSubscribed(thread.id, req.user.id);
        await notifyMentions({ text: body, actorId: req.user.id, contentId: thread.id, contentType: 'forum_thread' });

        res.status(201).json({ thread: { ...thread, profiles: redactProfile(thread.profiles) } });
    } catch (error) {
        console.error('Error in POST /api/forum/threads:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/forum/threads/:id
 * Edit your own thread's title/body. Not admin-overridable — same posture
 * as notes.js's comment edit (staff can delete, not rewrite, someone else's
 * post). Category/pin/lock are separate staff-only routes below.
 */
router.put('/threads/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, body } = req.body;
        const validationError = validateTitleAndBody({ title, body });
        if (validationError) return res.status(400).json({ error: validationError });

        const { data: existing, error: fetchError } = await supabase
            .from('forum_threads')
            .select('user_id')
            .eq('id', id)
            .maybeSingle();
        if (fetchError || !existing) return res.status(404).json({ error: 'Thread not found' });
        if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to edit this thread' });

        const { data: thread, error } = await supabase
            .from('forum_threads')
            .update({ title: title.trim(), body: body.trim(), updated_at: new Date().toISOString(), edited_at: new Date().toISOString() })
            .eq('id', id)
            .select(`*, ${AUTHOR_SELECT}, forum_categories ( id, name )`)
            .single();

        if (error) {
            console.error('Error updating forum thread:', error);
            return res.status(500).json({ error: 'Failed to update thread' });
        }

        await notifyMentions({ text: body, actorId: req.user.id, contentId: id, contentType: 'forum_thread' });

        res.json({ thread: { ...thread, profiles: redactProfile(thread.profiles) } });
    } catch (error) {
        console.error('Error in PUT /api/forum/threads/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/forum/threads/:id/moderate
 * Pin and/or lock a thread (editor or admin). Body: { is_pinned?, is_locked? }
 */
router.patch('/threads/:id/moderate', requireEditorOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_pinned, is_locked } = req.body;

        const updates = { updated_at: new Date().toISOString() };
        if (is_pinned !== undefined) updates.is_pinned = Boolean(is_pinned);
        if (is_locked !== undefined) updates.is_locked = Boolean(is_locked);

        const { data: thread, error } = await supabase
            .from('forum_threads')
            .update(updates)
            .eq('id', id)
            .select(`*, ${AUTHOR_SELECT}, forum_categories ( id, name )`)
            .single();

        if (error) {
            console.error('Error moderating forum thread:', error);
            return res.status(500).json({ error: 'Failed to update thread' });
        }

        res.json({ thread: { ...thread, profiles: redactProfile(thread.profiles) } });
    } catch (error) {
        console.error('Error in PATCH /api/forum/threads/:id/moderate:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/forum/threads/:id
 * Delete a thread (owner, or editor/admin moderating). Replies cascade at
 * the DB level; any open report notifications for the thread or any of its
 * replies are explicitly cleaned up here since notifications.content_id has
 * no real FK (nothing would otherwise stop them from lingering, pointed at
 * a thread that no longer exists).
 */
router.delete('/threads/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: thread, error: fetchError } = await supabase
            .from('forum_threads')
            .select('user_id')
            .eq('id', id)
            .maybeSingle();
        if (fetchError || !thread) return res.status(404).json({ error: 'Thread not found' });

        const { data: profile } = await supabase.from('profiles').select('role, is_admin').eq('id', req.user.id).single();
        const canModerate = profile?.is_admin || profile?.role === 'editor' || false;
        if (thread.user_id !== req.user.id && !canModerate) {
            return res.status(403).json({ error: 'Not authorized to delete this thread' });
        }

        const { data: replyRows } = await supabase.from('forum_replies').select('id').eq('thread_id', id);
        const replyIds = (replyRows || []).map(r => r.id);

        // Owners can only self-delete a thread no one else has replied to yet —
        // once there are replies, deleting it would erase other people's
        // contributions with no recovery. Editors/admins can still moderate it.
        if (!canModerate && replyIds.length > 0) {
            return res.status(403).json({ error: 'This thread has replies and can no longer be deleted — ask a moderator if it needs to come down.' });
        }

        const { error: deleteError } = await supabase.from('forum_threads').delete().eq('id', id);
        if (deleteError) {
            console.error('Error deleting forum thread:', deleteError);
            return res.status(500).json({ error: 'Failed to delete thread' });
        }

        await supabase.from('notifications').delete().eq('content_type', 'forum_thread').eq('content_id', id);
        if (replyIds.length > 0) {
            await supabase.from('notifications').delete().eq('content_type', 'forum_reply').in('content_id', replyIds);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/forum/threads/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/forum/threads/:id/report
 * Flag a thread as spam or inappropriate. No dedicated report table — fires
 * a 'forum_report' notification to every admin/editor, same shape as the
 * photo-report feature. Dedup: one open report per (reporter, thread).
 */
router.post('/threads/:id/report', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const reason = req.body.reason;
        const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, REPORT_NOTE_MAX_LENGTH) : '';

        if (!REPORT_REASONS.includes(reason)) {
            return res.status(400).json({ error: `reason must be one of: ${REPORT_REASONS.join(', ')}` });
        }

        const { data: thread, error: fetchError } = await supabase.from('forum_threads').select('user_id').eq('id', id).maybeSingle();
        if (fetchError || !thread) return res.status(404).json({ error: 'Thread not found' });
        if (thread.user_id === req.user.id) return res.status(400).json({ error: "You can't report your own thread" });

        const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('type', 'forum_report')
            .eq('content_type', 'forum_thread')
            .eq('content_id', id)
            .eq('actor_id', req.user.id)
            .is('dismissed_at', null)
            .limit(1);
        if (existing && existing.length > 0) return res.status(409).json({ error: "You've already reported this thread" });

        const message = note ? `${reason}: ${note}` : reason;
        await notifyStaffOfForumReport({ contentType: 'forum_thread', contentId: id, actorId: req.user.id, message });

        res.json({ success: true });
    } catch (error) {
        console.error('Error in POST /api/forum/threads/:id/report:', error);
        res.status(500).json({ error: 'Failed to report thread' });
    }
});

// ============================================
// SUBSCRIPTIONS
// ============================================

/**
 * GET /api/forum/threads/:id/subscription
 * Current user's "notify me on new replies" state for a thread. Requires
 * auth (there's no notion of checking anyone else's state) — this is why
 * the client fetches it as a separate call rather than folding it into the
 * public, unauthenticated GET /threads/:id.
 */
router.get('/threads/:id/subscription', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('forum_thread_subscriptions')
            .select('id')
            .eq('thread_id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();
        if (error) {
            console.error('Error fetching subscription state:', error);
            return res.status(500).json({ error: 'Failed to fetch subscription state' });
        }
        res.json({ subscribed: !!data });
    } catch (error) {
        console.error('Error in GET /api/forum/threads/:id/subscription:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/forum/threads/:id/subscription
 * Subscribe to a thread. Idempotent.
 */
router.post('/threads/:id/subscription', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { data: thread } = await supabase.from('forum_threads').select('id').eq('id', id).maybeSingle();
        if (!thread) return res.status(404).json({ error: 'Thread not found' });

        await ensureSubscribed(id, req.user.id);
        res.json({ subscribed: true });
    } catch (error) {
        console.error('Error in POST /api/forum/threads/:id/subscription:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/forum/threads/:id/subscription
 * Unsubscribe from a thread. Sticks until the user posts again — only
 * POST /threads, POST /threads/for-show, and POST .../replies re-subscribe.
 */
router.delete('/threads/:id/subscription', authenticate, async (req, res) => {
    try {
        const { error } = await supabase
            .from('forum_thread_subscriptions')
            .delete()
            .eq('thread_id', req.params.id)
            .eq('user_id', req.user.id);
        if (error) {
            console.error('Error unsubscribing from thread:', error);
            return res.status(500).json({ error: 'Failed to unsubscribe' });
        }
        res.json({ subscribed: false });
    } catch (error) {
        console.error('Error in DELETE /api/forum/threads/:id/subscription:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// REPLIES
// ============================================

/**
 * POST /api/forum/threads/:id/replies
 * Reply to a thread (any authenticated member; rejected if the thread is
 * locked). Bumps the thread's last_activity_at and notifies every other
 * participant.
 */
router.post('/threads/:id/replies', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { body } = req.body;
        if (!body || !body.trim()) return res.status(400).json({ error: 'Reply text is required' });
        if (body.trim().length > BODY_MAX_LENGTH) return res.status(400).json({ error: `Reply must be ${BODY_MAX_LENGTH} characters or fewer` });

        const { data: thread, error: threadError } = await supabase.from('forum_threads').select('is_locked').eq('id', id).maybeSingle();
        if (threadError || !thread) return res.status(404).json({ error: 'Thread not found' });
        if (thread.is_locked) return res.status(403).json({ error: 'This thread is locked' });

        const { data: reply, error } = await supabase
            .from('forum_replies')
            .insert([{ thread_id: id, user_id: req.user.id, body: body.trim() }])
            .select(`*, ${AUTHOR_SELECT}`)
            .single();

        if (error) {
            console.error('Error creating forum reply:', error);
            return res.status(500).json({ error: 'Failed to post reply' });
        }

        await supabase.from('forum_threads').update({ last_activity_at: new Date().toISOString() }).eq('id', id);
        await ensureSubscribed(id, req.user.id);
        await notifyForumReply({ threadId: id, actorId: req.user.id });
        // Mentions point at the thread (not this reply) so notificationLink()
        // can always resolve a link with no extra lookup — every forum
        // notification type does this. Trade-off: notifyMentions' dedup is
        // keyed on (type, content_type, content_id, user), so once someone's
        // been mentioned anywhere in a thread, a later mention of them in a
        // *different* reply in the same thread won't notify again. Accepted
        // for now rather than giving replies their own content_id, which
        // would need a reply->thread lookup to link back from the bell.
        await notifyMentions({ text: body, actorId: req.user.id, contentId: id, contentType: 'forum_thread' });

        res.status(201).json({ reply: { ...reply, profiles: redactProfile(reply.profiles) } });
    } catch (error) {
        console.error('Error in POST /api/forum/threads/:id/replies:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/forum/replies/:id
 * Edit your own reply. Owner-only, same posture as thread edits.
 */
router.put('/replies/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { body } = req.body;
        if (!body || !body.trim()) return res.status(400).json({ error: 'Reply text is required' });
        if (body.trim().length > BODY_MAX_LENGTH) return res.status(400).json({ error: `Reply must be ${BODY_MAX_LENGTH} characters or fewer` });

        const { data: existing, error: fetchError } = await supabase.from('forum_replies').select('user_id, thread_id').eq('id', id).maybeSingle();
        if (fetchError || !existing) return res.status(404).json({ error: 'Reply not found' });
        if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to edit this reply' });

        const { data: reply, error } = await supabase
            .from('forum_replies')
            .update({ body: body.trim(), updated_at: new Date().toISOString(), edited_at: new Date().toISOString() })
            .eq('id', id)
            .select(`*, ${AUTHOR_SELECT}`)
            .single();

        if (error) {
            console.error('Error updating forum reply:', error);
            return res.status(500).json({ error: 'Failed to update reply' });
        }

        await notifyMentions({ text: body, actorId: req.user.id, contentId: existing.thread_id, contentType: 'forum_thread' });

        res.json({ reply: { ...reply, profiles: redactProfile(reply.profiles) } });
    } catch (error) {
        console.error('Error in PUT /api/forum/replies/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/forum/replies/:id
 * Delete a reply (owner, or editor/admin moderating). Cleans up any open
 * report notifications for it, same reasoning as thread deletion above.
 */
router.delete('/replies/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: reply, error: fetchError } = await supabase.from('forum_replies').select('user_id').eq('id', id).maybeSingle();
        if (fetchError || !reply) return res.status(404).json({ error: 'Reply not found' });

        const { data: profile } = await supabase.from('profiles').select('role, is_admin').eq('id', req.user.id).single();
        const canModerate = profile?.is_admin || profile?.role === 'editor' || false;
        if (reply.user_id !== req.user.id && !canModerate) {
            return res.status(403).json({ error: 'Not authorized to delete this reply' });
        }

        const { error: deleteError } = await supabase.from('forum_replies').delete().eq('id', id);
        if (deleteError) {
            console.error('Error deleting forum reply:', deleteError);
            return res.status(500).json({ error: 'Failed to delete reply' });
        }

        await supabase.from('notifications').delete().eq('content_type', 'forum_reply').eq('content_id', id);

        res.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/forum/replies/:id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/forum/replies/:id/report
 * Flag a reply as spam or inappropriate — same shape as the thread report
 * route above.
 */
router.post('/replies/:id/report', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const reason = req.body.reason;
        const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, REPORT_NOTE_MAX_LENGTH) : '';

        if (!REPORT_REASONS.includes(reason)) {
            return res.status(400).json({ error: `reason must be one of: ${REPORT_REASONS.join(', ')}` });
        }

        const { data: reply, error: fetchError } = await supabase.from('forum_replies').select('user_id').eq('id', id).maybeSingle();
        if (fetchError || !reply) return res.status(404).json({ error: 'Reply not found' });
        if (reply.user_id === req.user.id) return res.status(400).json({ error: "You can't report your own reply" });

        const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('type', 'forum_report')
            .eq('content_type', 'forum_reply')
            .eq('content_id', id)
            .eq('actor_id', req.user.id)
            .is('dismissed_at', null)
            .limit(1);
        if (existing && existing.length > 0) return res.status(409).json({ error: "You've already reported this reply" });

        const message = note ? `${reason}: ${note}` : reason;
        await notifyStaffOfForumReport({ contentType: 'forum_reply', contentId: id, actorId: req.user.id, message });

        res.json({ success: true });
    } catch (error) {
        console.error('Error in POST /api/forum/replies/:id/report:', error);
        res.status(500).json({ error: 'Failed to report reply' });
    }
});

module.exports = router;
