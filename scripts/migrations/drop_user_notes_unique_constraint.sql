-- Comments feature: users may now post multiple comments per show, so the
-- old "one note per user per show" constraint needs to go. The app-level
-- upsert logic that depended on it has already been replaced with a plain
-- insert in server/routes/notes.js.
ALTER TABLE public.user_notes DROP CONSTRAINT IF EXISTS user_notes_user_id_show_id_key;
