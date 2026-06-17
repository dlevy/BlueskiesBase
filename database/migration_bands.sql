-- Migration: Add bands table and support act columns to shows
-- Run this in the Supabase SQL editor at:
--   https://supabase.com/dashboard/project/ttujxwbgegyfxwdftwir/sql

CREATE TABLE IF NOT EXISTS bands (
  id   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  CONSTRAINT bands_name_unique UNIQUE (name)
);

ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS opened_for_id  UUID REFERENCES bands(id),
  ADD COLUMN IF NOT EXISTS opening_act_id UUID REFERENCES bands(id);
