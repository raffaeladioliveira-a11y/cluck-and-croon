-- Fix create_room_with_host to use proper UUIDs and align schema
-- Also ensure start_game host check compares correct types

-- Ensure game_rooms has host_user_id TEXT (already added in prior migrations)
-- and keep host_id as UUID default gen_random_uuid()

-- Drop and recreate functions with consistent types
DROP FUNCTION IF EXISTS public.create_room_with_host(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.join_room_with_identity(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.start_game(TEXT, TEXT);

-- Recreate create_room_with_host
CREATE OR REPLACE FUNCTION public.create_room_with_host(
  p_display_name TEXT,
  p_avatar TEXT,
  p_client_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_code TEXT;
  v_room_id UUID;
  v_user_uuid UUID;
BEGIN
  -- Generate unique uppercase code A-Z0-9
  LOOP
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE room_code = v_code);
  END LOOP;

  -- Create a synthetic user UUID (no auth dependency)
  v_user_uuid := gen_random_uuid();

  -- Create room
  INSERT INTO game_rooms (
    room_code,
    name,
    host_id,
    host_user_id,
    status,
    max_players,
    rounds_total,
    time_per_question,
    eggs_per_correct,
    speed_bonus
  ) VALUES (
    v_code,
    'Sala ' || v_code,
    v_user_uuid,
    (v_user_uuid::text),
    'lobby',
    10,
    10,
    15,
    10,
    5
  ) RETURNING id INTO v_room_id;

  -- Insert host as participant
  INSERT INTO room_participants (
    room_id,
    user_id,
    client_id,
    display_name,
    display_name_user,
    avatar_emoji,
    avatar_user,
    is_host
  ) VALUES (
    v_room_id,
    v_user_uuid,
    p_client_id,
    COALESCE(p_display_name, 'Host'),
    COALESCE(p_display_name, 'Host'),
    COALESCE(p_avatar, '🐔'),
    COALESCE(p_avatar, '🐔'),
    true
  );

  RETURN v_code;
END $$;

-- Recreate join_room_with_identity
CREATE OR REPLACE FUNCTION public.join_room_with_identity(
  p_room_code TEXT,
  p_display_name TEXT,
  p_avatar TEXT,
  p_client_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_room_code TEXT := upper(p_room_code);
  v_room_id UUID;
  v_user_uuid UUID;
  v_participant_id UUID;
BEGIN
  SELECT id INTO v_room_id
  FROM game_rooms
  WHERE room_code = v_room_code AND (status IS NULL OR status = 'lobby' OR status = 'waiting');

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_LOBBY';
  END IF;

  -- Try to reuse existing synthetic user id by client
  SELECT user_id INTO v_user_uuid
  FROM room_participants
  WHERE room_id = v_room_id AND client_id = p_client_id;

  IF v_user_uuid IS NULL THEN
    v_user_uuid := gen_random_uuid();
  END IF;

  INSERT INTO room_participants (
    room_id,
    user_id,
    client_id,
    display_name,
    display_name_user,
    avatar_emoji,
    avatar_user,
    is_host
  ) VALUES (
    v_room_id,
    v_user_uuid,
    p_client_id,
    COALESCE(p_display_name, 'Guest'),
    COALESCE(p_display_name, 'Guest'),
    COALESCE(p_avatar, '🐔'),
    COALESCE(p_avatar, '🐔'),
    false
  )
  ON CONFLICT (room_id, client_id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, room_participants.display_name),
    display_name_user = COALESCE(EXCLUDED.display_name_user, room_participants.display_name_user),
    avatar_emoji = COALESCE(EXCLUDED.avatar_emoji, room_participants.avatar_emoji),
    avatar_user = COALESCE(EXCLUDED.avatar_user, room_participants.avatar_user)
  RETURNING id INTO v_participant_id;

  RETURN v_participant_id;
END $$;

-- Recreate start_game with proper host check using host_user_id TEXT
CREATE OR REPLACE FUNCTION public.start_game(p_room TEXT, p_client_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_room TEXT := upper(p_room);
  sid UUID;
BEGIN
  -- Check if caller is host by matching client_id and host synthetic user
  IF NOT EXISTS (
    SELECT 1 FROM room_participants rp
    WHERE rp.room_id = (SELECT id FROM game_rooms WHERE room_code = v_room)
      AND rp.client_id = p_client_id
      AND rp.user_id = ((SELECT host_user_id FROM game_rooms WHERE room_code = v_room)::uuid)
  ) THEN
    RAISE EXCEPTION 'NOT_HOST';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM game_rooms 
    WHERE room_code = v_room AND (status IS NULL OR status = 'lobby' OR status = 'waiting')
  ) THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_LOBBY';
  END IF;

  INSERT INTO game_sessions (room_code)
  VALUES (v_room)
  RETURNING id INTO sid;

  UPDATE game_rooms
  SET status = 'in_progress',
      game_session_id = sid
  WHERE room_code = v_room;

  RETURN sid;
END $$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.create_room_with_host(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.join_room_with_identity(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.start_game(TEXT, TEXT) TO anon;