-- Migration: Add a role tier between "regular member" and "full admin"
-- Description: profiles.is_admin is a single boolean today — a user is either
--              a regular member or a full admin with unrestricted power
--              (including deleting shows/songs/albums and other users'
--              accounts). This adds a `role` column so a new "editor" tier
--              can create/edit catalog data and use the Instagram post tool
--              without being able to delete shows, songs, albums, or users.
--
--              `is_admin` keeps its exact current meaning everywhere it's
--              already read (full admin) — this migration only backfills it
--              to stay consistent with the new column, it does not change
--              its semantics.

ALTER TABLE public.profiles
ADD COLUMN role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('member', 'editor', 'admin'));

-- Backfill from the existing boolean so current admins keep full access.
UPDATE public.profiles
SET role = 'admin'
WHERE is_admin = true;
