-- Site analytics: page views + feature-usage events, with enough context to
-- exclude admin/editor traffic from the aggregate numbers. All reads/writes
-- go through server/routes/analytics.js using the service-role client, so
-- there are deliberately no RLS policies granting anon/authenticated access.
CREATE TABLE public.analytics_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_type TEXT NOT NULL,              -- 'pageview' | 'feature'
    event_name TEXT NOT NULL,              -- pathname for pageviews; a short slug for features (e.g. 'artwork_download')
    path TEXT,                             -- pathname + search, always populated
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Snapshot of profiles.role at write time (NOT a live join) — keeps staff
    -- exclusion a plain WHERE with no join, fast as the table grows, and
    -- accurate to what the person's role actually was at that moment.
    user_role TEXT,
    session_id TEXT NOT NULL,              -- anonymous client-generated id (localStorage), for rough unique-visitor counts
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT analytics_events_event_type_check CHECK (event_type IN ('pageview', 'feature'))
);

CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX idx_analytics_events_event_name ON public.analytics_events(event_name);
CREATE INDEX idx_analytics_events_user_role ON public.analytics_events(user_role);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role client (server/routes/analytics.js) can
-- read or write this table, matching how the rest of the app's admin-only
-- data is protected.
