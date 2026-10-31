-- notes was a single free-text string per performance; now an array so a
-- performance can carry multiple notes (e.g. "with guest" + "acoustic
-- version"), each shown as its own bulleted line under the song. Existing
-- values are preserved as one-element arrays rather than dropped.
ALTER TABLE public.setlist_songs
    ALTER COLUMN notes TYPE TEXT[] USING CASE WHEN notes IS NULL THEN NULL ELSE ARRAY[notes] END;
