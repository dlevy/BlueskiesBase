-- Community setlist submissions.
--
-- Logged-in users can submit what they remember of a show's setlist, even if
-- it's just a few songs. Submissions are separate from the official
-- setlist_songs table — they show up immediately, attributed to the
-- submitter, but never silently become part of the canonical setlist (which
-- feeds JSON-LD, tour-rarity stats, and the sitemap). An admin reviews and
-- merges individual songs into the official setlist via
-- PUT /api/shows/:id/setlist-submissions/:submissionId/merge.
--
-- One submission per user per show (like user_notes) — resubmitting updates
-- it rather than piling up duplicates. The song list itself lives in a child
-- table, structured like setlist_songs but deliberately simpler (no
-- set_number/is_encore/jams_into/performance_type): a fan's partial memory
-- rarely comes with that level of precision, so this is just their best
-- guess at which songs, in what order.

CREATE TABLE public.setlist_submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    note TEXT, -- optional context, e.g. "pretty sure I'm missing a couple from the encore"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(show_id, user_id)
);

CREATE INDEX idx_setlist_submissions_show ON public.setlist_submissions(show_id);
CREATE INDEX idx_setlist_submissions_user ON public.setlist_submissions(user_id);

ALTER TABLE public.setlist_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Setlist submissions are viewable by everyone"
    ON public.setlist_submissions FOR SELECT
    USING (true);

CREATE POLICY "Users can submit their own setlist submission"
    ON public.setlist_submissions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own setlist submission"
    ON public.setlist_submissions FOR UPDATE
    USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Users can delete their own setlist submission, admins any"
    ON public.setlist_submissions FOR DELETE
    USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE TABLE public.setlist_submission_songs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    submission_id UUID REFERENCES public.setlist_submissions(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
    song_order INTEGER NOT NULL,
    notes TEXT, -- e.g. "not sure of exact order", "acoustic"
    merged_into_setlist BOOLEAN DEFAULT FALSE, -- an admin has pulled this song into the official setlist
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_setlist_submission_songs_submission ON public.setlist_submission_songs(submission_id);
CREATE INDEX idx_setlist_submission_songs_song ON public.setlist_submission_songs(song_id);

ALTER TABLE public.setlist_submission_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Setlist submission songs are viewable by everyone"
    ON public.setlist_submission_songs FOR SELECT
    USING (true);

CREATE POLICY "Users can add songs to their own submission"
    ON public.setlist_submission_songs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.setlist_submissions
            WHERE id = submission_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can remove songs from their own submission, admins any"
    ON public.setlist_submission_songs FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.setlist_submissions
            WHERE id = submission_id AND user_id = auth.uid()
        )
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Only admins flip merged_into_setlist (the "pull this into the official setlist" action).
CREATE POLICY "Only admins can update setlist submission songs"
    ON public.setlist_submission_songs FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );
