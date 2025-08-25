-- Fix security linter issues from the previous migration
-- Fix function search path issues for security

-- Fix start_game function with proper search path
CREATE OR REPLACE FUNCTION public.start_game(p_room TEXT, p_client_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  sid UUID;
BEGIN
  -- Check if caller is host
  IF NOT EXISTS (
    SELECT 1 FROM room_participants 
    WHERE room_id = (SELECT id FROM game_rooms WHERE room_code = p_room)
    AND client_id = p_client_id 
    AND user_id = (SELECT host_user_id FROM game_rooms WHERE room_code = p_room)
  ) THEN
    RAISE EXCEPTION 'NOT_HOST';
  END IF;

  -- Ensure room exists and is in lobby
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms 
    WHERE room_code = p_room AND (status IS NULL OR status = 'lobby' OR status = 'waiting')
  ) THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_LOBBY';
  END IF;

  -- Create unique game session (will fail if active session already exists)
  INSERT INTO game_sessions (room_code)
  VALUES (p_room)
  RETURNING id INTO sid;

  -- Update room status and link session
  UPDATE game_rooms
  SET status = 'in_progress',
      game_session_id = sid
  WHERE room_code = p_room;

  RETURN sid;
END $$;