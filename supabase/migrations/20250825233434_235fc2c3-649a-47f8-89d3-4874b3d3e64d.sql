-- Corrigir função create_room_with_host para usar método correto de geração de código
-- O erro era: function gen_random_bytes(integer) does not exist

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
  -- Gera código único em UPPERCASE usando md5 + random (método que funciona)
  LOOP
    v_code := upper(substr(md5(random()::text), 1, 6));
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