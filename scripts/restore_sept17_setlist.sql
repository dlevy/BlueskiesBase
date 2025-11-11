-- =====================================================
-- RESTORE SETLIST: September 17, 2025 - Red Rocks
-- =====================================================
-- This script restores the setlist that was accidentally deleted
-- when trying to save with missing database columns
--
-- Run this AFTER running migration_add_jams_into.sql
-- =====================================================

-- Show ID: d3b365b4-e1e0-4b40-a414-d5a29d360526
-- Red Rocks Amphitheatre, Morrison, CO
-- September 17, 2025

-- First, delete any existing setlist entries (in case there are partial entries)
DELETE FROM public.setlist_songs WHERE show_id = 'd3b365b4-e1e0-4b40-a414-d5a29d360526';

-- Insert the full setlist
-- Note: You'll need to replace the song_id values with the actual UUIDs from your songs table
-- This is a template - you'll need to run a query to get the song IDs first

-- SET 1
INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    1,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Ronin';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    2,
    false,
    NULL,
    true,
    'Johnny Blue Skies',
    false
FROM public.songs WHERE title = 'If the Sun Never Rises Again';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    3,
    false,
    NULL,
    true,
    'Little Feat',
    true
FROM public.songs WHERE title = 'Spanish Moon';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    4,
    false,
    NULL,
    true,
    'Moore & Napier',
    true
FROM public.songs WHERE title = 'Pinball Blues';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    5,
    false,
    NULL,
    true,
    'Moore & Napier',
    false
FROM public.songs WHERE title = 'Long White Line';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    6,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Sitting Here Without You';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    7,
    false,
    NULL,
    true,
    'Neil Diamond',
    false
FROM public.songs WHERE title = 'Red Red Wine';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    8,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'The Storm';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    9,
    false,
    'SpongeBob Weir Square Dance',
    true,
    'Alan Menken',
    false
FROM public.songs WHERE title = 'Under the Sea';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    10,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Juanita';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    11,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Sing Along';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    12,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'All Around You';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    13,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'A Little Light';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    14,
    false,
    NULL,
    true,
    'Johnny Blue Skies',
    false
FROM public.songs WHERE title = 'One for the Road';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    15,
    false,
    NULL,
    true,
    'Prince',
    false
FROM public.songs WHERE title = 'Purple Rain';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    16,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'It Ain''t All Flowers';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    17,
    false,
    NULL,
    true,
    'Eddie Murphy',
    false
FROM public.songs WHERE title = 'Party All the Time';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    18,
    false,
    'Reprise',
    false,
    NULL,
    false
FROM public.songs WHERE title = 'It Ain''t All Flowers';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    19,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Water in a Well';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    20,
    false,
    NULL,
    true,
    'Sunday Valley',
    false
FROM public.songs WHERE title = 'Sometimes Wine';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    21,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Voices';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT 
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    22,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Welcome to Earth (Pollywog)';

-- Note: "Best Clockmaker on Mars" has special notes about extended intro and reprise
INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    23,
    false,
    'extended intro / SpongeBob Weir Square Dance reprise outro',
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Best Clockmaker on Mars';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    24,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Breakers Roar';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    25,
    false,
    NULL,
    true,
    'Nirvana',
    false
FROM public.songs WHERE title = 'In Bloom';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    26,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'A Good Look';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    27,
    false,
    NULL,
    true,
    'ZZ Top',
    true
FROM public.songs WHERE title = 'La Grange';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    28,
    false,
    NULL,
    true,
    'Led Zeppelin',
    true
FROM public.songs WHERE title = 'Living Loving Maid (She''s Just a Woman)';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    29,
    false,
    'Reprise',
    false,
    NULL,
    false
FROM public.songs WHERE title = 'A Good Look';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    30,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'You Can Have the Crown';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    31,
    false,
    NULL,
    true,
    'Sunday Valley',
    false
FROM public.songs WHERE title = 'I Wonder';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    32,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'All the Pretty Colors';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    33,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Turtles All the Way Down';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    34,
    false,
    NULL,
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Fastest Horse in Town';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    35,
    false,
    'China Cat Sunflower Interpolation',
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Brace for Impact (Live a Little)';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    36,
    false,
    'intro',
    false,
    NULL,
    true
FROM public.songs WHERE title = 'Call to Arms';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    37,
    false,
    NULL,
    true,
    'Joe Walsh',
    true
FROM public.songs WHERE title = 'Rocky Mountain Way';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    38,
    false,
    NULL,
    false,
    NULL,
    true
FROM public.songs WHERE title = 'Call to Arms';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    39,
    false,
    NULL,
    true,
    'Wings',
    true
FROM public.songs WHERE title = 'Band on the Run';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    40,
    false,
    NULL,
    true,
    'Jimi Hendrix',
    true
FROM public.songs WHERE title = 'Machine Gun';

INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore, notes, is_cover, original_artist, jams_into)
SELECT
    'd3b365b4-e1e0-4b40-a414-d5a29d360526',
    id,
    1,
    41,
    false,
    'outro',
    false,
    NULL,
    false
FROM public.songs WHERE title = 'Call to Arms';

