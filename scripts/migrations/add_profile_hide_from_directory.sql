-- Lets an admin hide an account (e.g. test/editor test accounts) from the
-- public member directory without affecting anything else about it.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_from_directory BOOLEAN NOT NULL DEFAULT false;
