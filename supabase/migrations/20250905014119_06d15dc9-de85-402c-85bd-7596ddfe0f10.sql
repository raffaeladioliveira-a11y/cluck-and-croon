-- Add missing columns to existing tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS spotify_track_id text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS embed_url text;