-- Flags songs written & originally performed by Sturgill's pre-solo band,
-- Sunday Valley. is_original stays TRUE for these (they're still his own
-- songs) — this is an additional tag, not a replacement for is_original.
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS is_sunday_valley BOOLEAN NOT NULL DEFAULT false;

UPDATE public.songs
SET is_original = true, is_sunday_valley = true, original_artist = NULL
WHERE id IN (
    '2e4441f6-225c-4345-895e-77c4a45ae5ef', -- I Don't Mind
    '9fb652d5-8456-4e51-8a98-ff109e287937', -- Sometimes Wine
    'bdaa9332-b146-4210-bbb6-cb0378730b8f', -- All the Pretty Colors
    '069fe68b-86a1-4cc7-9b2f-965b3f3c52e7', -- I Wonder
    'f7971ad0-392c-49c7-8afc-cbf47a4df383'  -- Jesus Boogie
);
