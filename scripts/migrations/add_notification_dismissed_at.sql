-- Lets a user close a notification out of the header dropdown without losing
-- it from their history — a separate concept from read_at (read/unread).
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP;
