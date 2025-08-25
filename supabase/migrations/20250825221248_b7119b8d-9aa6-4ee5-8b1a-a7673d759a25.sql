-- Add next_genre_id column to game_rooms for winner genre selection
ALTER TABLE public.game_rooms
ADD COLUMN IF NOT EXISTS next_genre_id uuid REFERENCES public.genres(id);

-- Add set_number to track sets within a room
ALTER TABLE public.game_rooms
ADD COLUMN IF NOT EXISTS current_set integer DEFAULT 1;