-- =====================================================
-- USER POSTERS MIGRATION
-- =====================================================
-- This migration creates the user_posters table and storage bucket
-- for users to upload show poster images
-- Similar to user_photos but specifically for show posters

-- =====================================================
-- 1. CREATE USER_POSTERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_posters (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE NOT NULL,
    poster_url TEXT NOT NULL, -- URL to poster in Supabase Storage
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Only one poster per show (any user can upload, but only one poster per show)
    UNIQUE(show_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_posters_user ON public.user_posters(user_id);
CREATE INDEX IF NOT EXISTS idx_user_posters_show ON public.user_posters(show_id);
CREATE INDEX IF NOT EXISTS idx_user_posters_created ON public.user_posters(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_posters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_posters
CREATE POLICY "User posters are viewable by everyone"
    ON public.user_posters FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can upload posters"
    ON public.user_posters FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own posters"
    ON public.user_posters FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posters"
    ON public.user_posters FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any poster"
    ON public.user_posters FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- 2. CREATE STORAGE BUCKET FOR POSTERS
-- =====================================================
-- Create a storage bucket for show posters
INSERT INTO storage.buckets (id, name, public)
VALUES ('show-posters', 'show-posters', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for show-posters bucket
CREATE POLICY "Anyone can view show posters"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'show-posters');

CREATE POLICY "Authenticated users can upload show posters"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'show-posters' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can update their own posters"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'show-posters' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own posters"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'show-posters' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Admins can delete any poster"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'show-posters'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- 3. CREATE TRIGGER FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_user_posters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_posters_updated_at
    BEFORE UPDATE ON public.user_posters
    FOR EACH ROW
    EXECUTE FUNCTION update_user_posters_updated_at();

-- =====================================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE public.user_posters IS 'User-uploaded show poster images (one per show)';
COMMENT ON COLUMN public.user_posters.poster_url IS 'URL to poster in Supabase Storage (show-posters bucket)';
COMMENT ON COLUMN public.user_posters.caption IS 'Optional caption for the poster';

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Created table:';
    RAISE NOTICE '  - user_posters (with RLS policies)';
    RAISE NOTICE 'Created storage bucket:';
    RAISE NOTICE '  - show-posters (public, with storage policies)';
    RAISE NOTICE 'Created trigger:';
    RAISE NOTICE '  - update_user_posters_updated_at';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Verify storage bucket exists in Supabase Dashboard > Storage';
    RAISE NOTICE '  2. Create backend API endpoints for posters';
    RAISE NOTICE '  3. Create frontend component for poster upload/display';
END $$;

