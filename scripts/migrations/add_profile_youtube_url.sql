-- Migration: Add youtube_url to profiles table
-- Description: Opt-in YouTube channel link, same pattern as facebook_url/reddit_url/instagram_url.

ALTER TABLE public.profiles
ADD COLUMN youtube_url TEXT;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_youtube_url_length CHECK (char_length(youtube_url) <= 300);

COMMENT ON COLUMN public.profiles.youtube_url IS 'Opt-in link to YouTube channel; NULL = not shared. Members with this set are listed in the "Member Channels" section of the public Links page.';
