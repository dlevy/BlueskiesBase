-- Migration: Add public profile fields to profiles table
-- Date: 2026-09-21
-- Description: Adds opt-in profile fields (display name, location, avatar, Facebook
--              link, Reddit link, bio) and a separate opt-in flag for sharing the
--              itemized attended-shows list. All new columns default to NULL/false so
--              existing users show nothing new until they visit Edit Profile and fill
--              something in. Aggregate stats (shows attended count, favorite venue,
--              etc.) stay public regardless of these flags — computed at query time,
--              not stored here.

-- Step 1: Opt-in identity/display fields (all nullable, blank by default)
ALTER TABLE public.profiles
ADD COLUMN display_name TEXT,
ADD COLUMN location TEXT,
ADD COLUMN avatar_url TEXT,
ADD COLUMN facebook_url TEXT,
ADD COLUMN reddit_url TEXT,
ADD COLUMN bio TEXT;

-- Step 2: Separate opt-in toggle for the itemized attended-shows list
-- (aggregate counts/stats are public regardless of this flag)
ALTER TABLE public.profiles
ADD COLUMN show_attendance_public BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 3: Light length guards so a UI text field can't blow out storage/layout
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_display_name_length CHECK (char_length(display_name) <= 80),
ADD CONSTRAINT profiles_location_length CHECK (char_length(location) <= 100),
ADD CONSTRAINT profiles_bio_length CHECK (char_length(bio) <= 500),
ADD CONSTRAINT profiles_facebook_url_length CHECK (char_length(facebook_url) <= 300),
ADD CONSTRAINT profiles_reddit_url_length CHECK (char_length(reddit_url) <= 300);

-- Step 4: Comments
COMMENT ON COLUMN public.profiles.display_name IS 'Opt-in display name shown on public profile; NULL = not shared, falls back to username';
COMMENT ON COLUMN public.profiles.location IS 'Opt-in freeform location text (no geocoding); NULL = not shared';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Public URL of avatar in the avatars storage bucket; NULL = default (initials) avatar shown';
COMMENT ON COLUMN public.profiles.facebook_url IS 'Opt-in link to Facebook profile/page; NULL = not shared';
COMMENT ON COLUMN public.profiles.reddit_url IS 'Opt-in link to Reddit profile; NULL = not shared';
COMMENT ON COLUMN public.profiles.bio IS 'Opt-in short bio text; NULL = not shown';
COMMENT ON COLUMN public.profiles.show_attendance_public IS 'If true, the itemized list of attended shows (dates/venues) is exposed on the public profile; aggregate counts are public regardless';

-- Verification query (optional - run separately to verify)
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'profiles' ORDER BY ordinal_position;
