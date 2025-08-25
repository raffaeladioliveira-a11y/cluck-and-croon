-- Sincronização de início do jogo (host-only)
-- Adiciona colunas necessárias e função RPC para controle centralizado

-- Add columns to existing tables
ALTER TABLE public.game_rooms 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'lobby',
ADD COLUMN IF NOT EXISTS game_session_id UUID;

ALTER TABLE public.room_participants 
ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Create game_sessions table
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  seed INTEGER NOT NULL DEFAULT floor(random()*1000000),
  tracks TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Create unique index for active sessions per room
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_session_per_room
  ON public.game_sessions(room_code)
  WHERE ended_at IS NULL;

-- Enable RLS for game_sessions
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for game_sessions
CREATE POLICY "dev_all_select_game_sessions" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "dev_all_modify_game_sessions" ON public.game_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- RPC function to start game atomically (host-only)
CREATE OR REPLACE FUNCTION public.start_game(p_room TEXT, p_client_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  sid UUID;
BEGIN
  -- Check if caller is host
  IF NOT EXISTS (
    SELECT 1 FROM public.room_participants 
    WHERE room_id = (SELECT id FROM public.game_rooms WHERE room_code = p_room)
    AND client_id = p_client_id 
    AND user_id = (SELECT host_user_id FROM public.game_rooms WHERE room_code = p_room)
  ) THEN
    RAISE EXCEPTION 'NOT_HOST';
  END IF;

  -- Ensure room exists and is in lobby
  IF NOT EXISTS (
    SELECT 1 FROM public.game_rooms 
    WHERE room_code = p_room AND (status IS NULL OR status = 'lobby' OR status = 'waiting')
  ) THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_LOBBY';
  END IF;

  -- Create unique game session (will fail if active session already exists)
  INSERT INTO public.game_sessions (room_code)
  VALUES (p_room)
  RETURNING id INTO sid;

  -- Update room status and link session
  UPDATE public.game_rooms
  SET status = 'in_progress',
      game_session_id = sid
  WHERE room_code = p_room;

  RETURN sid;
END $$;