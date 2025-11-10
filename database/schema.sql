-- BlueskiesBase Database Schema
-- This schema is designed for Supabase (PostgreSQL)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE (extends Supabase auth.users)
-- =====================================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username TEXT UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- =====================================================
-- VENUES TABLE
-- =====================================================
CREATE TABLE public.venues (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    state_country TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Venues are viewable by everyone"
    ON public.venues FOR SELECT
    USING (true);

CREATE POLICY "Only admins can insert venues"
    ON public.venues FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Only admins can update venues"
    ON public.venues FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- SHOWS TABLE
-- =====================================================
CREATE TABLE public.shows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
    show_date DATE NOT NULL,
    artist_name TEXT NOT NULL,
    tour_name TEXT,
    notes TEXT,
    has_images BOOLEAN DEFAULT FALSE,
    source_types TEXT[], -- Array of source types: AUD, SBD, VIDEO, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster date searches
CREATE INDEX idx_shows_date ON public.shows(show_date DESC);
CREATE INDEX idx_shows_artist ON public.shows(artist_name);
CREATE INDEX idx_shows_venue ON public.shows(venue_id);

ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shows are viewable by everyone"
    ON public.shows FOR SELECT
    USING (true);

CREATE POLICY "Only admins can insert shows"
    ON public.shows FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Only admins can update shows"
    ON public.shows FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- SONGS TABLE
-- =====================================================
CREATE TABLE public.songs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    original_artist TEXT,
    is_original BOOLEAN DEFAULT TRUE,
    written_by TEXT,
    lyrics TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for song title searches
CREATE INDEX idx_songs_title ON public.songs(title);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Songs are viewable by everyone"
    ON public.songs FOR SELECT
    USING (true);

CREATE POLICY "Only admins can insert songs"
    ON public.songs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Only admins can update songs"
    ON public.songs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- SETLIST_SONGS TABLE (Junction table)
-- =====================================================
CREATE TABLE public.setlist_songs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
    set_number INTEGER NOT NULL, -- 1, 2, 3 for different sets
    song_order INTEGER NOT NULL, -- Order within the set
    notes TEXT, -- Special notes for this performance
    is_encore BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_setlist_show ON public.setlist_songs(show_id);
CREATE INDEX idx_setlist_song ON public.setlist_songs(song_id);

ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Setlist songs are viewable by everyone"
    ON public.setlist_songs FOR SELECT
    USING (true);

CREATE POLICY "Only admins can insert setlist songs"
    ON public.setlist_songs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Only admins can update setlist songs"
    ON public.setlist_songs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Only admins can delete setlist songs"
    ON public.setlist_songs FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =====================================================
-- USER_SHOWS TABLE (Shows user attended)
-- =====================================================
CREATE TABLE public.user_shows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, show_id)
);

CREATE INDEX idx_user_shows_user ON public.user_shows(user_id);
CREATE INDEX idx_user_shows_show ON public.user_shows(show_id);

ALTER TABLE public.user_shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attended shows"
    ON public.user_shows FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can mark shows attended"
    ON public.user_shows FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmark shows attended"
    ON public.user_shows FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- USER_RECORDINGS TABLE (Recordings user owns)
-- =====================================================
CREATE TABLE public.user_recordings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE NOT NULL,
    recording_type TEXT, -- AUD, SBD, VIDEO, etc.
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, show_id, recording_type)
);

CREATE INDEX idx_user_recordings_user ON public.user_recordings(user_id);
CREATE INDEX idx_user_recordings_show ON public.user_recordings(show_id);

ALTER TABLE public.user_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recordings"
    ON public.user_recordings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can mark recordings owned"
    ON public.user_recordings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmark recordings owned"
    ON public.user_recordings FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON public.venues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shows_updated_at BEFORE UPDATE ON public.shows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON public.songs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

