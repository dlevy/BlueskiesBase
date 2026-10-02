-- Lets a member mark a poster in their collection as available for sale or
-- trade, with a free-text comment (price, condition, what they'd trade for).
ALTER TABLE public.user_poster_collection ADD COLUMN IF NOT EXISTS for_trade BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_poster_collection ADD COLUMN IF NOT EXISTS trade_comment TEXT;
