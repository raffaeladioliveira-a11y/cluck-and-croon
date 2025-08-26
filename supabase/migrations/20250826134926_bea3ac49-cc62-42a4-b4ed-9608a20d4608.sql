-- Fix create_room_with_host function to use available random functions
DROP FUNCTION IF EXISTS public.create_room_with_host(text, text, text);

CREATE OR REPLACE FUNCTION public.create_room_with_host(
  p_display_name text,
  p_avatar text,
  p_client_id text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_code text;
  v_room_id uuid;
  v_host_participant_id uuid;
BEGIN
  LOOP
    -- Generate 6-character code using gen_random_uuid and extracting characters
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE code = v_code);
  END LOOP;

  INSERT INTO game_rooms(code, room_code, status, name, max_players, rounds_total, time_per_question, eggs_per_correct, speed_bonus)
  VALUES (v_code, v_code, 'lobby', 'Sala ' || v_code, 10, 10, 15, 10, 5)
  RETURNING id INTO v_room_id;

  INSERT INTO room_participants(room_id, display_name, avatar_emoji, client_id, is_host)
  VALUES (v_room_id, COALESCE(p_display_name,'Host'), COALESCE(p_avatar,'🐔'), p_client_id, true)
  RETURNING id INTO v_host_participant_id;

  UPDATE game_rooms SET host_participant_id = v_host_participant_id, host_user_id = v_host_participant_id::text
   WHERE id = v_room_id;

  RETURN v_code;
END $$;

GRANT EXECUTE ON FUNCTION public.create_room_with_host(text, text, text) TO anon;