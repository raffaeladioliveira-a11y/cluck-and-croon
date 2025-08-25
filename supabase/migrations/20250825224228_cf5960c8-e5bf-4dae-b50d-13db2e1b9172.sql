-- DEV ONLY: Políticas RLS permissivas para desenvolvimento local
-- Remove todas as políticas conflitantes e cria permissivas para anon/authenticated

-- Drop all existing policies for game tables
DROP POLICY IF EXISTS "Anyone can view game rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Anyone can create game rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Anyone can update game rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Anyone can delete game rooms" ON public.game_rooms;

DROP POLICY IF EXISTS "Room participants can view participants in their rooms" ON public.room_participants;
DROP POLICY IF EXISTS "Anyone can join rooms" ON public.room_participants;
DROP POLICY IF EXISTS "Anyone can update participation" ON public.room_participants;
DROP POLICY IF EXISTS "Anyone can leave rooms" ON public.room_participants;

DROP POLICY IF EXISTS "Room participants can view rounds" ON public.game_rounds;
DROP POLICY IF EXISTS "Room hosts can manage rounds" ON public.game_rounds;
DROP POLICY IF EXISTS "Room hosts can update rounds" ON public.game_rounds;

DROP POLICY IF EXISTS "Users can view their own answers" ON public.player_answers;
DROP POLICY IF EXISTS "Users can insert their own answers" ON public.player_answers;

-- Ensure RLS is enabled
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;

-- Create permissive DEV policies
CREATE POLICY "dev_all_select_game_rooms" ON public.game_rooms FOR SELECT USING (true);
CREATE POLICY "dev_all_modify_game_rooms" ON public.game_rooms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "dev_all_select_room_participants" ON public.room_participants FOR SELECT USING (true);
CREATE POLICY "dev_all_modify_room_participants" ON public.room_participants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "dev_all_select_game_rounds" ON public.game_rounds FOR SELECT USING (true);
CREATE POLICY "dev_all_modify_game_rounds" ON public.game_rounds FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "dev_all_select_player_answers" ON public.player_answers FOR SELECT USING (true);
CREATE POLICY "dev_all_modify_player_answers" ON public.player_answers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Add host_user_id column if it doesn't exist
ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS host_user_id TEXT;