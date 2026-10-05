const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireEditorOrAdmin, loadRequesterOptional } = require('../middleware/requireRole');

const VALID_EVENT_TYPES = ['pageview', 'feature'];

/**
 * POST /api/analytics/event
 * Public — logs one pageview or feature-usage event. Never rejects on a
 * missing/invalid auth token (see loadRequesterOptional) — the event still
 * gets logged, just as a guest, since a flaky token shouldn't lose data.
 * Body: { eventType, eventName, path, sessionId, referrer? }
 */
router.post('/event', async (req, res) => {
    try {
        const { eventType, eventName, path, sessionId, referrer } = req.body;

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
 * Editor/admin only. Query params:
 *   from, to          — YYYY-MM-DD, inclusive date range (defaults to the last 30 days)
 *   includeStaff      — 'true' to include admin/editor-tagged rows (default: excluded)
 */
router.get('/summary', requireEditorOrAdmin, async (req, res) => {
    try {
        const includeStaff = req.query.includeStaff === 'true';
        const to = req.query.to || new Date().toISOString().slice(0, 10);
        const from = req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        // Range end is exclusive of the next day so `to` itself is fully included
        // regardless of time-of-day the events were logged at.
        const toExclusive = new Date(new Date(to + 'T00:00:00Z').getTime() + 24 * 60 * 60 * 1000).toISOString();
        const fromInclusive = new Date(from + 'T00:00:00Z').toISOString();

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

        const dailyCounts = {};
        pageviews.forEach(r => {
            const day = r.created_at.slice(0, 10);
            dailyCounts[day] = (dailyCounts[day] || 0) + 1;
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

module.exports = router;
