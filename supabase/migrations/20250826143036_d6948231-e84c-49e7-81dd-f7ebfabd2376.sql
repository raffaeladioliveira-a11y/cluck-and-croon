-- Fix create_room_with_host function to properly set host_id
DROP FUNCTION IF EXISTS public.create_room_with_host(text, text, text);

CREATE OR REPLACE FUNCTION public.create_room_with_host(p_display_name text, p_avatar text, p_client_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_room_id uuid;
  v_host_participant_id uuid;
  v_user_id uuid;
BEGIN
  -- Get current user ID if authenticated, otherwise use a placeholder UUID
  v_user_id := COALESCE(auth.uid(), gen_random_uuid());
  
  LOOP
    -- Generate 6-character code using gen_random_uuid and extracting characters
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE code = v_code);
  END LOOP;

  -- First create the room with host_id set to user_id
  INSERT INTO game_rooms(code, room_code, status, name, max_players, rounds_total, time_per_question, eggs_per_correct, speed_bonus, host_id, host_user_id)
  VALUES (v_code, v_code, 'lobby', 'Sala ' || v_code, 10, 10, 15, 10, 5, v_user_id, v_user_id::text)
  RETURNING id INTO v_room_id;

  -- Then create the host participant
  INSERT INTO room_participants(room_id, display_name, avatar_emoji, client_id, is_host, user_id)
  VALUES (v_room_id, COALESCE(p_display_name,'Host'), COALESCE(p_avatar,'🐔'), p_client_id, true, v_user_id::text)
  RETURNING id INTO v_host_participant_id;

  -- Update room with host_participant_id
  UPDATE game_rooms SET host_participant_id = v_host_participant_id WHERE id = v_room_id;

  RETURN v_code;
END $function$;

-- Also update join_room function to properly handle host detection
DROP FUNCTION IF EXISTS public.join_room(text, text, text, text);

CREATE OR REPLACE FUNCTION public.join_room(p_room_code text, p_display_name text, p_avatar text, p_client_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text := upper(p_room_code);
  v_room_id uuid;
  v_status text;
  v_participant_id uuid;
  v_user_id uuid;
  v_host_id uuid;
  v_is_existing_host boolean := false;
BEGIN
  -- Get current user ID if authenticated
  v_user_id := COALESCE(auth.uid(), gen_random_uuid());
  
  -- Get room info including host_id
  SELECT id, status, host_id INTO v_room_id, v_status, v_host_id
    FROM game_rooms WHERE code = v_code;

  IF v_room_id IS NULL OR v_status <> 'lobby' THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_LOBBY';
  END IF;

  -- Check if this user is the original host
  v_is_existing_host := (v_host_id = v_user_id);

  -- Insert or update participant
  INSERT INTO room_participants(room_id, display_name, avatar_emoji, client_id, is_host, user_id)
  VALUES (v_room_id, COALESCE(p_display_name,'Guest'), COALESCE(p_avatar,'🐔'), p_client_id, v_is_existing_host, v_user_id::text)
  ON CONFLICT (room_id, client_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        avatar_emoji = EXCLUDED.avatar_emoji,
        is_host = v_is_existing_host
  RETURNING id INTO v_participant_id;

  RETURN v_participant_id;
END $function$;

-- Enable realtime for room_participants table
ALTER TABLE room_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;

-- Enable realtime for game_rooms table
ALTER TABLE game_rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;