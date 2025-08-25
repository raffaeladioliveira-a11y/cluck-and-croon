-- Remove foreign key constraints that require auth.users
-- This allows the demo to work without requiring actual user authentication

-- Check current constraints
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint 
WHERE contype = 'f' 
AND (conrelid::regclass::text = 'public.game_rooms' OR conrelid::regclass::text = 'public.room_participants');

-- Drop foreign key constraints that reference auth.users
ALTER TABLE public.game_rooms 
DROP CONSTRAINT IF EXISTS game_rooms_host_id_fkey;

ALTER TABLE public.room_participants 
DROP CONSTRAINT IF EXISTS room_participants_user_id_fkey;

-- Also remove foreign key constraint from profiles if it exists
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;