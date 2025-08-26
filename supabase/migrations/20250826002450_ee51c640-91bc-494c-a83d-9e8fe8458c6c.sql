-- Fix UUID type issues in database functions
DROP FUNCTION IF EXISTS public.create_room_with_host(text, text, text);
DROP FUNCTION IF EXISTS public.join_room_with_identity(text, text, text, text);
DROP FUNCTION IF EXISTS public.start_game(text, text);

-- Recreate create_room_with_host with proper UUID handling
CREATE OR REPLACE FUNCTION public.create_room_with_host(p_display_name text, p_avatar text, p_client_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code TEXT;
  v_room_id UUID;
  v_user_id UUID;
BEGIN
  -- Gera código único usando random() + MD5 (método seguro)
  LOOP
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE room_code = v_code);
  END LOOP;

  -- Gera user_id único como UUID
  v_user_id := gen_random_uuid();

  -- Cria a sala
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
    v_user_id, 
    v_user_id::text, 
    'lobby',
    10,
    10,
    15,
    10,
    5
  ) RETURNING id INTO v_room_id;

  -- Insere o host
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
    v_user_id, 
    p_client_id, 
    COALESCE(p_display_name, 'Host'), 
    COALESCE(p_display_name, 'Host'),
    COALESCE(p_avatar, '🐔'), 
    COALESCE(p_avatar, '🐔'),
    true
  );

  RETURN v_code;
END $function$;

-- Recreate join_room_with_identity with proper UUID handling
CREATE OR REPLACE FUNCTION public.join_room_with_identity(p_room_code text, p_display_name text, p_avatar text, p_client_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_room_code TEXT := upper(p_room_code);
  v_room_id UUID;
  v_user_id UUID;
  v_participant_id UUID;
BEGIN
  -- Valida sala
  SELECT id INTO v_room_id 
  FROM game_rooms 
  WHERE room_code = v_room_code AND (status IS NULL OR status = 'lobby' OR status = 'waiting');
  
  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_LOBBY';
  END IF;

  -- Verifica se já existe
  SELECT user_id INTO v_user_id
  FROM room_participants 
  WHERE room_id = v_room_id AND client_id = p_client_id;
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
  END IF;

  -- Upsert participante
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
    v_user_id, 
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
END $function$;

-- Recreate start_game with proper UUID handling
CREATE OR REPLACE FUNCTION public.start_game(p_room text, p_client_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_room TEXT := upper(p_room);
  sid UUID;
BEGIN
  -- Verifica se é host
  IF NOT EXISTS (
    SELECT 1 FROM room_participants 
    WHERE room_id = (SELECT id FROM game_rooms WHERE room_code = v_room)
    AND client_id = p_client_id 
    AND user_id::text = (SELECT host_user_id FROM game_rooms WHERE room_code = v_room)
  ) THEN
    RAISE EXCEPTION 'NOT_HOST';
  END IF;

  -- Verifica sala
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms 
    WHERE room_code = v_room AND (status IS NULL OR status = 'lobby' OR status = 'waiting')
  ) THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_LOBBY';
  END IF;

  -- Cria sessão
  INSERT INTO game_sessions (room_code)
  VALUES (v_room)
  RETURNING id INTO sid;

  -- Atualiza sala
  UPDATE game_rooms
  SET status = 'in_progress',
      game_session_id = sid
  WHERE room_code = v_room;

  RETURN sid;
END $function$;