-- Sample data for BlueskiesBase
-- This provides example data to test the application

-- =====================================================
-- SAMPLE VENUES
-- =====================================================
INSERT INTO public.venues (name, city, state_country, address) VALUES
('The Fillmore', 'San Francisco', 'CA', '1805 Geary Blvd'),
('Red Rocks Amphitheatre', 'Morrison', 'CO', '18300 W Alameda Pkwy'),
('Madison Square Garden', 'New York', 'NY', '4 Pennsylvania Plaza'),
('The Ryman Auditorium', 'Nashville', 'TN', '116 5th Ave N'),
('The Beacon Theatre', 'New York', 'NY', '2124 Broadway');

-- =====================================================
-- SAMPLE SONGS
-- =====================================================
INSERT INTO public.songs (title, original_artist, is_original, written_by) VALUES
-- Original songs
('Remedy', NULL, true, 'Chris Robinson, Rich Robinson'),
('Thorn In My Pride', NULL, true, 'Chris Robinson, Rich Robinson'),
('She Talks To Angels', NULL, true, 'Chris Robinson, Rich Robinson'),
('Hard To Handle', 'Otis Redding', false, 'Allen Jones, Alvertis Isbell, Otis Redding'),
('Jealous Again', NULL, true, 'Chris Robinson, Rich Robinson'),
('Wiser Time', NULL, true, 'Chris Robinson, Rich Robinson'),
('Good Friday', NULL, true, 'Chris Robinson, Rich Robinson'),
('Soul Singing', NULL, true, 'Chris Robinson, Rich Robinson'),
('Kickin'' My Heart Around', NULL, true, 'Chris Robinson, Rich Robinson'),
('Goodbye Daughters Of The Revolution', NULL, true, 'Chris Robinson, Rich Robinson'),
('Walk Believer Walk', NULL, true, 'Chris Robinson, Rich Robinson'),
('Cosmic Friend', NULL, true, 'Chris Robinson, Rich Robinson'),
('Appaloosa', NULL, true, 'Chris Robinson, Rich Robinson'),
('Torn And Frayed', 'The Rolling Stones', false, 'Mick Jagger, Keith Richards'),
('Stare It Cold', NULL, true, 'Chris Robinson, Rich Robinson'),
('Sometimes Salvation', NULL, true, 'Chris Robinson, Rich Robinson'),
('Hotel Illness', NULL, true, 'Chris Robinson, Rich Robinson'),
('Cursed Diamond', NULL, true, 'Chris Robinson, Rich Robinson'),
('Descending', NULL, true, 'Chris Robinson, Rich Robinson'),
('Bad Luck Blue Eyes Goodbye', NULL, true, 'Chris Robinson, Rich Robinson');

-- =====================================================
-- SAMPLE SHOWS
-- =====================================================
INSERT INTO public.shows (venue_id, show_date, artist_name, tour_name, source_types, has_images) VALUES
(
    (SELECT id FROM public.venues WHERE name = 'The Fillmore' LIMIT 1),
    '2024-03-15',
    'The Black Crowes',
    'Happiness Bastards Tour',
    ARRAY['AUD', 'SBD'],
    true
),
(
    (SELECT id FROM public.venues WHERE name = 'Red Rocks Amphitheatre' LIMIT 1),
    '2024-06-20',
    'The Black Crowes',
    'Happiness Bastards Tour',
    ARRAY['AUD', 'VIDEO'],
    true
),
(
    (SELECT id FROM public.venues WHERE name = 'Madison Square Garden' LIMIT 1),
    '2024-10-31',
    'The Black Crowes',
    'Shake Your Money Maker 30th Anniversary',
    ARRAY['SBD', 'VIDEO'],
    false
),
(
    (SELECT id FROM public.venues WHERE name = 'The Ryman Auditorium' LIMIT 1),
    '2023-11-15',
    'Chris Robinson Brotherhood',
    'Fall Tour 2023',
    ARRAY['AUD'],
    true
),
(
    (SELECT id FROM public.venues WHERE name = 'The Beacon Theatre' LIMIT 1),
    '2024-01-10',
    'The Black Crowes',
    'Winter Residency',
    ARRAY['AUD', 'SBD', 'VIDEO'],
    true
);

-- =====================================================
-- SAMPLE SETLISTS
-- =====================================================

-- Show 1: The Fillmore 2024-03-15
-- Set 1
INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore) VALUES
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Jealous Again' LIMIT 1),
    1, 1, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Remedy' LIMIT 1),
    1, 2, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Thorn In My Pride' LIMIT 1),
    1, 3, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'She Talks To Angels' LIMIT 1),
    1, 4, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Hotel Illness' LIMIT 1),
    1, 5, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Wiser Time' LIMIT 1),
    1, 6, false
);

-- Set 2
INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore) VALUES
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Good Friday' LIMIT 1),
    2, 1, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Soul Singing' LIMIT 1),
    2, 2, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Torn And Frayed' LIMIT 1),
    2, 3, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Kickin'' My Heart Around' LIMIT 1),
    2, 4, false
);

-- Encore
INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore) VALUES
(
    (SELECT id FROM public.shows WHERE show_date = '2024-03-15' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Hard To Handle' LIMIT 1),
    3, 1, true
);

-- Show 2: Red Rocks 2024-06-20
-- Set 1
INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore) VALUES
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Goodbye Daughters Of The Revolution' LIMIT 1),
    1, 1, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Walk Believer Walk' LIMIT 1),
    1, 2, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Cosmic Friend' LIMIT 1),
    1, 3, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Remedy' LIMIT 1),
    1, 4, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Appaloosa' LIMIT 1),
    1, 5, false
);

-- Set 2
INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore) VALUES
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Stare It Cold' LIMIT 1),
    2, 1, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Sometimes Salvation' LIMIT 1),
    2, 2, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Thorn In My Pride' LIMIT 1),
    2, 3, false
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Wiser Time' LIMIT 1),
    2, 4, false
);

-- Encore
INSERT INTO public.setlist_songs (show_id, song_id, set_number, song_order, is_encore) VALUES
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'She Talks To Angels' LIMIT 1),
    3, 1, true
),
(
    (SELECT id FROM public.shows WHERE show_date = '2024-06-20' LIMIT 1),
    (SELECT id FROM public.songs WHERE title = 'Hard To Handle' LIMIT 1),
    3, 2, true
);

-- =====================================================
-- NOTES
-- =====================================================
-- To use this seed data:
-- 1. First run schema.sql to create all tables
-- 2. Then run this file to populate sample data
-- 3. You can modify or add more shows/songs as needed

