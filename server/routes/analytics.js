const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAdmin, loadRequesterOptional } = require('../middleware/requireRole');

const VALID_EVENT_TYPES = ['pageview', 'feature'];

// Shared by /summary and /events. `last24h=true` is a genuinely precise
// rolling 24-hour window (now minus 24h) — distinct from the day-bucketed
// from/to range the 7/30/90-day buttons use, where from/to are calendar
// dates in the VIEWER's own timezone (not UTC — tzOffsetMinutes is
// `Date.prototype.getTimezoneOffset()` from the browser, e.g. +420 for
// PDT), so "today" boundaries line up with the viewer's own midnight
// instead of flipping over a few hours early/late depending where they are
// relative to UTC. That rounding is harmless at 7+ day granularity, but
// reusing it for a "last 24 hours" option would silently span up to 48
// hours depending on time of day, so that mode stays a precise instant
// window instead.
function resolveRange(req) {
    const tzOffsetMinutes = parseInt(req.query.tzOffsetMinutes, 10) || 0;

    if (req.query.last24h === 'true') {
        const toExclusive = new Date();
        const fromInclusive = new Date(toExclusive.getTime() - 24 * 60 * 60 * 1000);
        return {
            from: fromInclusive.toISOString(),
            to: toExclusive.toISOString(),
            fromInclusive: fromInclusive.toISOString(),
            toExclusive: toExclusive.toISOString(),
            granularity: 'hour',
            tzOffsetMinutes: 0,
        };
    }

    // These query-param from/to values represent the viewer's local calendar
    // dates (computed via getLocalDateString client-side), not UTC ones.
    const localToday = new Date(Date.now() - tzOffsetMinutes * 60 * 1000).toISOString().slice(0, 10);
    const localThirtyAgo = new Date(Date.now() - tzOffsetMinutes * 60 * 1000 - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = req.query.to || localToday;
    const from = req.query.from || localThirtyAgo;
    // Range end is exclusive of the next day so `to` itself is fully included
    // regardless of time-of-day the events were logged at — "the next day"
    // meaning the viewer's own local midnight, shifted back into UTC by
    // tzOffsetMinutes (local midnight = UTC midnight + tzOffsetMinutes).
    const toExclusive = new Date(new Date(to + 'T00:00:00Z').getTime() + 24 * 60 * 60 * 1000 + tzOffsetMinutes * 60 * 1000).toISOString();
    const fromInclusive = new Date(new Date(from + 'T00:00:00Z').getTime() + tzOffsetMinutes * 60 * 1000).toISOString();
    return { from, to, fromInclusive, toExclusive, granularity: 'day', tzOffsetMinutes };
}

/**
 * POST /api/analytics/event
 * Public — logs one pageview or feature-usage event. Never rejects on a
 * missing/invalid auth token (see loadRequesterOptional) — the event still
 * gets logged, just as a guest, since a flaky token shouldn't lose data.
 * Body: { eventType, eventName, path, sessionId, referrer?, metadata? }
 */
router.post('/event', async (req, res) => {
    try {
        const { eventType, eventName, path, sessionId, referrer, metadata } = req.body;

        if (!VALID_EVENT_TYPES.includes(eventType)) {
            return res.status(400).json({ error: `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}` });
        }
        if (!eventName || typeof eventName !== 'string') {
            return res.status(400).json({ error: 'eventName is required' });
        }
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ error: 'sessionId is required' });
        }

        const { user, role } = await loadRequesterOptional(req);

        const { error } = await supabase.from('analytics_events').insert({
            event_type: eventType,
            event_name: eventName,
            path: path || null,
            user_id: user?.id || null,
            user_role: role || null,
            session_id: sessionId,
            referrer: referrer || null,
            metadata: typeof metadata === 'string' ? metadata.slice(0, 500) : null,
        });

        if (error) {
            console.error('[POST /analytics/event] Error:', error);
            return res.status(500).json({ error: 'Failed to log event' });
        }

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error in POST /analytics/event:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/analytics/summary
 * Admin only. Query params:
 *   from, to          — YYYY-MM-DD, inclusive date range (defaults to the last 30 days)
 *   last24h           — 'true' for a precise rolling 24-hour window instead (overrides from/to)
 *   includeStaff      — 'true' to include admin/editor-tagged rows (default: excluded)
 */
router.get('/summary', requireAdmin, async (req, res) => {
    try {
        const includeStaff = req.query.includeStaff === 'true';
        const { from, to, fromInclusive, toExclusive, granularity, tzOffsetMinutes } = resolveRange(req);

        let query = supabase
            .from('analytics_events')
            .select('event_type, event_name, path, session_id, user_role, created_at')
            .gte('created_at', fromInclusive)
            .lt('created_at', toExclusive);

        if (!includeStaff) {
            query = query.or('user_role.is.null,user_role.eq.member');
        }

        // Paginated fetch — same batching pattern used throughout this app
        // (e.g. server/utils/songStats.js) since a popular date range can
        // exceed PostgREST's 1000-row default.
        let rows = [];
        for (let rangeStart = 0; ;) {
            const { data: page, error } = await query.range(rangeStart, rangeStart + 999);
            if (error) {
                console.error('[GET /analytics/summary] Error:', error);
                return res.status(500).json({ error: 'Failed to load analytics' });
            }
            rows = rows.concat(page || []);
            if (!page || page.length < 1000) break;
            rangeStart += 1000;
        }

        const pageviews = rows.filter(r => r.event_type === 'pageview');
        const features = rows.filter(r => r.event_type === 'feature');

        const uniqueSessions = new Set(rows.map(r => r.session_id)).size;

        // Hour buckets for the 24-hour view (a day-bucketed chart would be
        // just 1-2 bars; an hour bucket is an unambiguous UTC instant anyway,
        // relabeled to the viewer's local hour client-side for display), day
        // buckets otherwise — shifted by tzOffsetMinutes so a page view in
        // the viewer's own evening doesn't land on "tomorrow" just because
        // it's already past midnight UTC.
        const dailyCounts = {};
        pageviews.forEach(r => {
            const bucket = granularity === 'hour'
                ? r.created_at.slice(0, 13) + ':00:00Z'
                : new Date(new Date(r.created_at).getTime() - tzOffsetMinutes * 60 * 1000).toISOString().slice(0, 10);
            dailyCounts[bucket] = (dailyCounts[bucket] || 0) + 1;
        });
        const dailyPageviews = Object.entries(dailyCounts)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const rank = (list, keyFn) => {
            const counts = {};
            list.forEach(r => { const k = keyFn(r); if (k) counts[k] = (counts[k] || 0) + 1; });
            return Object.entries(counts)
                .map(([key, count]) => ({ key, count }))
                .sort((a, b) => b.count - a.count);
        };

        const pageRanking = rank(pageviews, r => r.path);

        res.json({
            range: { from, to },
            granularity,
            totalPageviews: pageviews.length,
            uniqueSessions,
            dailyPageviews,
            topPages: pageRanking.slice(0, 15),
            leastViewedPages: [...pageRanking].reverse().slice(0, 15),
            topFeatures: rank(features, r => r.event_name).slice(0, 15),
        });
    } catch (error) {
        console.error('Error in GET /analytics/summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/analytics/events
 * Admin only (stricter than /summary — this names real people, not just
 * aggregate counts). A paginated, reverse-chronological audit log of raw
 * events, each resolved to the user who triggered it.
 * Query params:
 *   from, to          — YYYY-MM-DD, inclusive date range (defaults to the last 30 days)
 *   last24h           — 'true' for a precise rolling 24-hour window instead (overrides from/to)
 *   includeStaff      — 'true' to include admin/editor-tagged rows alongside
 *                        member/guest ones (default: excluded). Ignored when
 *                        role=staff is also set.
 *   role              — 'staff' to show ONLY admin/editor-tagged rows
 *                        (default: no role restriction beyond includeStaff)
 *   eventType         — 'pageview' | 'feature' (default: both)
 *   user              — free-text match against the triggering user's
 *                        username/display name (default: no filter)
 *   page, limit        — pagination (limit capped at 200, default 50)
 */
router.get('/events', requireAdmin, async (req, res) => {
    try {
        const includeStaff = req.query.includeStaff === 'true';
        const staffOnly = req.query.role === 'staff';
        const { fromInclusive, toExclusive } = resolveRange(req);

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const offset = (page - 1) * limit;

        // Resolved up front rather than filtering on the embedded profiles(...)
        // relation directly — PostgREST can't filter an outer query by an
        // embedded resource's columns, so this needs its own lookup first.
        // Comma is PostgREST's .or() condition separator, so strip it from the
        // search term rather than let it corrupt the filter expression below.
        const userSearch = (req.query.user || '').trim().replace(/,/g, '');
        let matchingUserIds = null;
        if (userSearch) {
            const { data: matches, error: matchError } = await supabase
                .from('profiles')
                .select('id')
                .or(`username.ilike.%${userSearch}%,display_name.ilike.%${userSearch}%`);
            if (matchError) {
                console.error('[GET /analytics/events] Error resolving user search:', matchError);
                return res.status(500).json({ error: 'Failed to load events' });
            }
            matchingUserIds = (matches || []).map(p => p.id);
            if (matchingUserIds.length === 0) {
                return res.json({ events: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
        }

        let query = supabase
            .from('analytics_events')
            // user_id references profiles directly, so PostgREST can embed it
            // without the two-query workaround other routes need for tables
            // that reference auth.users instead.
            .select('id, event_type, event_name, path, user_role, session_id, created_at, metadata, profiles(username, display_name)', { count: 'exact' })
            .gte('created_at', fromInclusive)
            .lt('created_at', toExclusive)
            .order('created_at', { ascending: false });

        if (VALID_EVENT_TYPES.includes(req.query.eventType)) {
            query = query.eq('event_type', req.query.eventType);
        }
        if (staffOnly) {
            query = query.in('user_role', ['admin', 'editor']);
        } else if (!includeStaff) {
            query = query.or('user_role.is.null,user_role.eq.member');
        }
        if (matchingUserIds) {
            query = query.in('user_id', matchingUserIds);
        }

        const { data, error, count } = await query.range(offset, offset + limit - 1);
        if (error) {
            console.error('[GET /analytics/events] Error:', error);
            return res.status(500).json({ error: 'Failed to load events' });
        }

        res.json({
            events: (data || []).map(r => ({
                id: r.id,
                eventType: r.event_type,
                eventName: r.event_name,
                path: r.path,
                userRole: r.user_role,
                // Admins see the real name here regardless of hide_from_directory
                // — that flag controls what's shown publicly, not to admins
                // reviewing their own site's activity.
                userName: r.profiles?.display_name || r.profiles?.username || null,
                sessionId: r.session_id,
                createdAt: r.created_at,
                metadata: r.metadata,
            })),
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        });
    } catch (error) {
        console.error('Error in GET /analytics/events:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
