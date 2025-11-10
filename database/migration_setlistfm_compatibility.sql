-- =====================================================
-- MIGRATION: Add setlist.fm API Compatibility
-- =====================================================
-- This migration adds fields to make BlueskiesBase compatible
-- with the setlist.fm API for data import and synchronization
--
-- Run this in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. FIX CRITICAL MISSING FIELDS IN setlist_songs
-- =====================================================
-- These fields are already used in your code but missing from schema!

ALTER TABLE public.setlist_songs 
ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_artist TEXT;

COMMENT ON COLUMN public.setlist_songs.is_cover IS 'Whether this song is a cover (not original to the artist)';
COMMENT ON COLUMN public.setlist_songs.original_artist IS 'Original artist name if this is a cover';

-- =====================================================
-- 2. ENHANCE VENUES TABLE
-- =====================================================
-- Add setlist.fm venue data and geographic coordinates

ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS setlistfm_id TEXT,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS country_name TEXT,
ADD COLUMN IF NOT EXISTS state_code TEXT,
ADD COLUMN IF NOT EXISTS setlistfm_url TEXT;

-- Add unique constraint for setlistfm_id (if not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_setlistfm_id_unique 
ON public.venues(setlistfm_id) 
WHERE setlistfm_id IS NOT NULL;

-- Add index for geographic searches
CREATE INDEX IF NOT EXISTS idx_venues_coordinates 
ON public.venues(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add index for country searches
CREATE INDEX IF NOT EXISTS idx_venues_country 
ON public.venues(country_code);

COMMENT ON COLUMN public.venues.setlistfm_id IS 'setlist.fm venue ID for API synchronization';
COMMENT ON COLUMN public.venues.latitude IS 'Venue latitude for mapping';
COMMENT ON COLUMN public.venues.longitude IS 'Venue longitude for mapping';
COMMENT ON COLUMN public.venues.country_code IS 'ISO country code (e.g., US, GB, CA)';
COMMENT ON COLUMN public.venues.country_name IS 'Full country name';
COMMENT ON COLUMN public.venues.state_code IS 'State/province code';
COMMENT ON COLUMN public.venues.setlistfm_url IS 'URL to venue page on setlist.fm';

-- =====================================================
-- 3. ENHANCE SHOWS TABLE
-- =====================================================
-- Add setlist.fm show data and metadata

ALTER TABLE public.shows
ADD COLUMN IF NOT EXISTS setlistfm_id TEXT,
ADD COLUMN IF NOT EXISTS setlistfm_version_id TEXT,
ADD COLUMN IF NOT EXISTS setlistfm_url TEXT,
ADD COLUMN IF NOT EXISTS setlistfm_last_updated TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS info TEXT;

-- Add unique constraint for setlistfm_id (if not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shows_setlistfm_id_unique 
ON public.shows(setlistfm_id) 
WHERE setlistfm_id IS NOT NULL;

-- Add index for sync tracking
CREATE INDEX IF NOT EXISTS idx_shows_setlistfm_updated 
ON public.shows(setlistfm_last_updated) 
WHERE setlistfm_last_updated IS NOT NULL;

COMMENT ON COLUMN public.shows.setlistfm_id IS 'setlist.fm setlist ID for API synchronization';
COMMENT ON COLUMN public.shows.setlistfm_version_id IS 'setlist.fm version ID for tracking updates';
COMMENT ON COLUMN public.shows.setlistfm_url IS 'URL to setlist page on setlist.fm';
COMMENT ON COLUMN public.shows.setlistfm_last_updated IS 'Last update timestamp from setlist.fm';
COMMENT ON COLUMN public.shows.info IS 'General show information and notes from setlist.fm';

-- =====================================================
-- 4. ENHANCE SONGS TABLE
-- =====================================================
-- Add MusicBrainz ID and setlist.fm URL

ALTER TABLE public.songs
ADD COLUMN IF NOT EXISTS musicbrainz_id TEXT,
ADD COLUMN IF NOT EXISTS setlistfm_url TEXT;

-- Add unique constraint for musicbrainz_id (if not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_musicbrainz_id_unique 
ON public.songs(musicbrainz_id) 
WHERE musicbrainz_id IS NOT NULL;

COMMENT ON COLUMN public.songs.musicbrainz_id IS 'MusicBrainz ID (mbid) for song identification';
COMMENT ON COLUMN public.songs.setlistfm_url IS 'URL to song page on setlist.fm';

-- =====================================================
-- 5. CREATE ARTISTS TABLE (OPTIONAL BUT RECOMMENDED)
-- =====================================================
-- Separate artists from shows for better normalization

CREATE TABLE IF NOT EXISTS public.artists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sort_name TEXT,
    musicbrainz_id TEXT,
    disambiguation TEXT,
    setlistfm_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint for musicbrainz_id (if not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_musicbrainz_id_unique 
ON public.artists(musicbrainz_id) 
WHERE musicbrainz_id IS NOT NULL;

-- Add index for name searches
CREATE INDEX IF NOT EXISTS idx_artists_name 
ON public.artists(name);

-- Add index for sort name
CREATE INDEX IF NOT EXISTS idx_artists_sort_name 
ON public.artists(sort_name);

COMMENT ON TABLE public.artists IS 'Artists/bands that perform shows';
COMMENT ON COLUMN public.artists.name IS 'Artist display name';
COMMENT ON COLUMN public.artists.sort_name IS 'Artist name for sorting (e.g., "Black Crowes, The")';
COMMENT ON COLUMN public.artists.musicbrainz_id IS 'MusicBrainz artist ID (mbid)';
COMMENT ON COLUMN public.artists.disambiguation IS 'Disambiguation text for artists with same name';
COMMENT ON COLUMN public.artists.setlistfm_url IS 'URL to artist page on setlist.fm';

-- Enable Row Level Security
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to make migration idempotent)
DROP POLICY IF EXISTS "Artists are viewable by everyone" ON public.artists;
DROP POLICY IF EXISTS "Only admins can insert artists" ON public.artists;
DROP POLICY IF EXISTS "Only admins can update artists" ON public.artists;
DROP POLICY IF EXISTS "Only admins can delete artists" ON public.artists;

-- Policies for artists
CREATE POLICY "Artists are viewable by everyone"
    ON public.artists FOR SELECT
    USING (true);

CREATE POLICY "Only admins can insert artists"
    ON public.artists FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Only admins can update artists"
    ON public.artists FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Only admins can delete artists"
    ON public.artists FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- 6. ADD ARTIST REFERENCE TO SHOWS (OPTIONAL)
-- =====================================================
-- Link shows to artists table while keeping artist_name for backward compatibility

ALTER TABLE public.shows
ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shows_artist_id 
ON public.shows(artist_id);

COMMENT ON COLUMN public.shows.artist_id IS 'Reference to artists table (optional, artist_name still used)';

-- =====================================================
-- 7. CREATE HELPER FUNCTION FOR FINDING/CREATING ARTISTS
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_or_create_artist(
    p_name TEXT,
    p_musicbrainz_id TEXT DEFAULT NULL,
    p_sort_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_artist_id UUID;
BEGIN
    -- Try to find existing artist by MusicBrainz ID
    IF p_musicbrainz_id IS NOT NULL THEN
        SELECT id INTO v_artist_id
        FROM public.artists
        WHERE musicbrainz_id = p_musicbrainz_id
        LIMIT 1;
        
        IF v_artist_id IS NOT NULL THEN
            RETURN v_artist_id;
        END IF;
    END IF;
    
    -- Try to find existing artist by name
    SELECT id INTO v_artist_id
    FROM public.artists
    WHERE name = p_name
    LIMIT 1;
    
    IF v_artist_id IS NOT NULL THEN
        RETURN v_artist_id;
    END IF;
    
    -- Create new artist
    INSERT INTO public.artists (name, musicbrainz_id, sort_name)
    VALUES (p_name, p_musicbrainz_id, p_sort_name)
    RETURNING id INTO v_artist_id;
    
    RETURN v_artist_id;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_artist IS 'Find existing artist or create new one by name or MusicBrainz ID';

-- =====================================================
-- 8. CREATE HELPER FUNCTION FOR FINDING/CREATING VENUES
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_or_create_venue(
    p_name TEXT,
    p_city TEXT,
    p_state_country TEXT,
    p_setlistfm_id TEXT DEFAULT NULL,
    p_latitude DECIMAL DEFAULT NULL,
    p_longitude DECIMAL DEFAULT NULL,
    p_country_code TEXT DEFAULT NULL,
    p_country_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_venue_id UUID;
BEGIN
    -- Try to find existing venue by setlist.fm ID
    IF p_setlistfm_id IS NOT NULL THEN
        SELECT id INTO v_venue_id
        FROM public.venues
        WHERE setlistfm_id = p_setlistfm_id
        LIMIT 1;
        
        IF v_venue_id IS NOT NULL THEN
            RETURN v_venue_id;
        END IF;
    END IF;
    
    -- Try to find existing venue by name and city
    SELECT id INTO v_venue_id
    FROM public.venues
    WHERE name = p_name AND city = p_city
    LIMIT 1;
    
    IF v_venue_id IS NOT NULL THEN
        RETURN v_venue_id;
    END IF;
    
    -- Create new venue
    INSERT INTO public.venues (
        name, city, state_country, setlistfm_id, 
        latitude, longitude, country_code, country_name
    )
    VALUES (
        p_name, p_city, p_state_country, p_setlistfm_id,
        p_latitude, p_longitude, p_country_code, p_country_name
    )
    RETURNING id INTO v_venue_id;
    
    RETURN v_venue_id;
END;
$$;

COMMENT ON FUNCTION public.get_or_create_venue IS 'Find existing venue or create new one by setlist.fm ID or name/city';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Added setlist.fm compatibility fields to:';
    RAISE NOTICE '  - venues (setlistfm_id, coordinates, country info)';
    RAISE NOTICE '  - shows (setlistfm_id, version_id, url, info)';
    RAISE NOTICE '  - songs (musicbrainz_id, setlistfm_url)';
    RAISE NOTICE '  - setlist_songs (is_cover, original_artist) - CRITICAL FIX';
    RAISE NOTICE 'Created artists table with RLS policies';
    RAISE NOTICE 'Created helper functions for data import';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Get setlist.fm API key';
    RAISE NOTICE '  2. Run the Python import script';
    RAISE NOTICE '  3. Test the imported data';
END $$;

