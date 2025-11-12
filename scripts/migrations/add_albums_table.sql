-- Migration: Add albums table and album_id to songs table
-- Date: 2025-11-12
-- Description: Associate original songs with albums for album breakdown stats

-- Create albums table
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL UNIQUE,
    artist_name TEXT DEFAULT 'Johnny Blue Skies',
    release_date DATE,
    album_art_url TEXT,
    album_type TEXT DEFAULT 'studio', -- 'studio', 'live', 'compilation', 'ep', 'single'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add album_id column to songs table (nullable - covers won't have albums)
ALTER TABLE songs ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES albums(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_songs_album_id ON songs(album_id);

-- Insert Johnny Blue Skies / Sturgill Simpson albums
INSERT INTO albums (title, artist_name, release_date, album_type) VALUES
    ('High Top Mountain', 'Sturgill Simpson', '2013-06-04', 'studio'),
    ('Metamodern Sounds in Country Music', 'Sturgill Simpson', '2014-05-13', 'studio'),
    ('A Sailor''s Guide to Earth', 'Sturgill Simpson', '2016-04-15', 'studio'),
    ('Sound & Fury', 'Sturgill Simpson', '2019-09-27', 'studio'),
    ('Cuttin'' Grass Vol. 1 - The Butcher Shoppe Sessions', 'Sturgill Simpson', '2020-10-16', 'live'),
    ('Cuttin'' Grass Vol. 2 - The Cowboy Arms Sessions', 'Sturgill Simpson', '2020-12-11', 'live'),
    ('The Ballad of Dood & Juanita', 'Sturgill Simpson', '2021-08-20', 'studio'),
    ('Passage Du Desir', 'Johnny Blue Skies', '2024-07-12', 'studio')
ON CONFLICT (title) DO NOTHING;

-- Add RLS policies for albums table
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

-- Allow public read access to albums
CREATE POLICY "Allow public read access to albums"
    ON albums FOR SELECT
    TO public
    USING (true);

-- Allow authenticated users with admin role to manage albums
CREATE POLICY "Allow admin users to insert albums"
    ON albums FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Allow admin users to update albums"
    ON albums FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Allow admin users to delete albums"
    ON albums FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Add comment
COMMENT ON TABLE albums IS 'Albums for associating original songs with their studio/live releases';
COMMENT ON COLUMN songs.album_id IS 'Foreign key to albums table - only populated for original songs';

