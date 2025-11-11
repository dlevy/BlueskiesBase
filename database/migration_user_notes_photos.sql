-- =====================================================
-- MIGRATION: Add User Notes and Photos for Shows
-- =====================================================
-- This migration adds tables for users to add notes and photos to setlists
-- Run this in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. CREATE USER_NOTES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE NOT NULL,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, show_id) -- One note per user per show
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_notes_user ON public.user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_show ON public.user_notes(show_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_created ON public.user_notes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_notes
CREATE POLICY "User notes are viewable by everyone"
    ON public.user_notes FOR SELECT
    USING (true);

CREATE POLICY "Users can create their own notes"
    ON public.user_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
    ON public.user_notes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
    ON public.user_notes FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any note"
    ON public.user_notes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Admins can delete any note"
    ON public.user_notes FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- 2. CREATE USER_PHOTOS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_photos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE NOT NULL,
    photo_url TEXT NOT NULL, -- URL to photo in Supabase Storage
    caption TEXT,
    display_order INTEGER DEFAULT 0, -- Order to display photos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_photos_user ON public.user_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_photos_show ON public.user_photos(show_id);
CREATE INDEX IF NOT EXISTS idx_user_photos_created ON public.user_photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_photos_order ON public.user_photos(show_id, display_order);

-- Enable Row Level Security
ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_photos
CREATE POLICY "User photos are viewable by everyone"
    ON public.user_photos FOR SELECT
    USING (true);

CREATE POLICY "Users can upload their own photos"
    ON public.user_photos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own photos"
    ON public.user_photos FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos"
    ON public.user_photos FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any photo"
    ON public.user_photos FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Admins can delete any photo"
    ON public.user_photos FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- 3. CREATE STORAGE BUCKET FOR PHOTOS
-- =====================================================
-- Note: This needs to be run in Supabase Dashboard > Storage
-- Or you can create it manually in the UI

-- Create a storage bucket for show photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('show-photos', 'show-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for show-photos bucket
CREATE POLICY "Anyone can view show photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'show-photos');

CREATE POLICY "Authenticated users can upload show photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'show-photos' 
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can update their own photos"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'show-photos' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own photos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'show-photos' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Admins can delete any photo"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'show-photos'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- 4. CREATE TRIGGER FOR UPDATED_AT
-- =====================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_notes
DROP TRIGGER IF EXISTS update_user_notes_updated_at ON public.user_notes;
CREATE TRIGGER update_user_notes_updated_at
    BEFORE UPDATE ON public.user_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_photos
DROP TRIGGER IF EXISTS update_user_photos_updated_at ON public.user_photos;
CREATE TRIGGER update_user_photos_updated_at
    BEFORE UPDATE ON public.user_photos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE public.user_notes IS 'User-submitted notes for shows they attended';
COMMENT ON TABLE public.user_photos IS 'User-uploaded photos from shows';

COMMENT ON COLUMN public.user_notes.note_text IS 'User''s personal notes about the show';
COMMENT ON COLUMN public.user_photos.photo_url IS 'URL to photo in Supabase Storage (show-photos bucket)';
COMMENT ON COLUMN public.user_photos.caption IS 'Optional caption for the photo';
COMMENT ON COLUMN public.user_photos.display_order IS 'Order to display photos (0 = first)';

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '  - user_notes (with RLS policies)';
    RAISE NOTICE '  - user_photos (with RLS policies)';
    RAISE NOTICE 'Created storage bucket:';
    RAISE NOTICE '  - show-photos (public, with storage policies)';
    RAISE NOTICE 'Created triggers:';
    RAISE NOTICE '  - update_user_notes_updated_at';
    RAISE NOTICE '  - update_user_photos_updated_at';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Verify storage bucket exists in Supabase Dashboard > Storage';
    RAISE NOTICE '  2. Create backend API endpoints for notes and photos';
    RAISE NOTICE '  3. Build frontend UI components';
END $$;

