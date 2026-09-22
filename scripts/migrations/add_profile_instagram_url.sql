-- Migration: Add instagram_url to profiles table
-- Description: Opt-in Instagram profile link, same pattern as facebook_url/reddit_url.

ALTER TABLE public.profiles
ADD COLUMN instagram_url TEXT;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_instagram_url_length CHECK (char_length(instagram_url) <= 300);

COMMENT ON COLUMN public.profiles.instagram_url IS 'Opt-in link to Instagram profile; NULL = not shared';
