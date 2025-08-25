-- Fix "Sala não disponível" - tornar RPCs SECURITY DEFINER e normalizar UPPERCASE
-- Atualizar funções existentes para usar SECURITY DEFINER e normalizar códigos

-- Atualizar create_room_with_host para UPPERCASE e SECURITY DEFINER
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
  v_user_id TEXT;
BEGIN
  -- Gera código único em UPPERCASE (A-Z/0-9)
  LOOP
    v_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE room_code = v_code);
  END LOOP;

  -- Gera user_id único para esta sessão
  v_user_id := 'user_' || replace(gen_random_uuid()::text, '-', '');

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
    v_user_id, 
    'lobby',
    10,
    10,
    15,
    10,
    5
  ) RETURNING id INTO v_room_id;

  -- Insere o host como participante
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
END $$;

-- Atualizar join_room_with_identity para UPPERCASE e SECURITY DEFINER
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
  v_user_id TEXT;
  v_participant_id UUID;
BEGIN
  -- Valida se a sala existe e está aberta
  SELECT id INTO v_room_id 
  FROM game_rooms 
  WHERE room_code = v_room_code AND (status IS NULL OR status = 'lobby' OR status = 'waiting');
  
  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_LOBBY';
  END IF;

  -- Gera user_id único para esta sessão se não existir
  SELECT user_id INTO v_user_id
  FROM room_participants 
  WHERE room_id = v_room_id AND client_id = p_client_id;
  
  IF v_user_id IS NULL THEN
    v_user_id := 'user_' || replace(gen_random_uuid()::text, '-', '');
  END IF;

  -- Upsert participante (preserva identidade escolhida)
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
END $$;

-- Atualizar start_game para UPPERCASE e SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.start_game(p_room text, p_client_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_room TEXT := upper(p_room);
  sid UUID;
BEGIN
  -- Check if caller is host
  IF NOT EXISTS (
    SELECT 1 FROM room_participants 
    WHERE room_id = (SELECT id FROM game_rooms WHERE room_code = v_room)
    AND client_id = p_client_id 
    AND user_id = (SELECT host_user_id FROM game_rooms WHERE room_code = v_room)
  ) THEN
    RAISE EXCEPTION 'NOT_HOST';
  END IF;

  -- Ensure room exists and is in lobby
  IF NOT EXISTS (
    SELECT 1 FROM game_rooms 
    WHERE room_code = v_room AND (status IS NULL OR status = 'lobby' OR status = 'waiting')
  ) THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_LOBBY';
  END IF;

  -- Create unique game session (will fail if active session already exists)
  INSERT INTO game_sessions (room_code)
  VALUES (v_room)
  RETURNING id INTO sid;

  -- Update room status and link session
  UPDATE game_rooms
  SET status = 'in_progress',
      game_session_id = sid
  WHERE room_code = v_room;

  RETURN sid;
END $$;

-- Grant execute permissions to anon for all functions
GRANT EXECUTE ON FUNCTION public.create_room_with_host(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.join_room_with_identity(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.start_game(TEXT, TEXT) TO anon;