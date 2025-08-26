-- PARTE A - Banco: Corrigir lobby sem login (usar client_id, não user_id)

-- 1. Soltar user_id (sem apagar a coluna)
ALTER TABLE public.room_participants
  DROP CONSTRAINT IF EXISTS room_participants_user_id_fkey;
ALTER TABLE public.room_participants
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN user_id DROP DEFAULT;

-- 2. Garantir colunas e índices mínimos (ajuste para os nomes que já existem)
-- game_rooms (usar room_code se code não existir)
ALTER TABLE public.game_rooms
  ADD COLUMN IF NOT EXISTS host_participant_id UUID;

-- Criar índice único no room_code se não existir
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_rooms_code_unique
  ON public.game_rooms(room_code);

-- room_participants - garantir colunas necessárias
ALTER TABLE public.room_participants
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now();

-- Criar índice único para room_id + client_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='uniq_participant_room_client'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uniq_participant_room_client
             ON public.room_participants(room_id, client_id)
             WHERE client_id IS NOT NULL';
  END IF;
END $$;

-- 3. RPCs corretas (não tocam em user_id)

-- CRIAR SALA + HOST (usa client_id, NÃO usa user_id)
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
    v_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE room_code = v_code);
  END LOOP;

  INSERT INTO game_rooms(room_code, status, name, max_players, rounds_total, time_per_question, eggs_per_correct, speed_bonus)
  VALUES (v_code, 'lobby', 'Sala ' || v_code, 10, 10, 15, 10, 5)
  RETURNING id INTO v_room_id;

  INSERT INTO room_participants(room_id, display_name, avatar_emoji, client_id, is_host)
  VALUES (v_room_id, COALESCE(p_display_name,'Host'), COALESCE(p_avatar,'🐔'), p_client_id, true)
  RETURNING id INTO v_host_participant_id;

  UPDATE game_rooms SET host_id = v_host_participant_id, host_user_id = v_host_participant_id::text
   WHERE id = v_room_id;

  RETURN v_code;
END $$;

-- ENTRAR NA SALA (upsert por room_id + client_id)
DROP FUNCTION IF EXISTS public.join_room(text, text, text, text);
CREATE OR REPLACE FUNCTION public.join_room(
  p_room_code text,
  p_display_name text,
  p_avatar text,
  p_client_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_code text := upper(p_room_code);
  v_room_id uuid;
  v_status text;
  v_participant_id uuid;
BEGIN
  SELECT id, status INTO v_room_id, v_status
    FROM game_rooms WHERE room_code = v_code;

  IF v_room_id IS NULL OR v_status <> 'lobby' THEN
    RAISE EXCEPTION 'ROOM_NOT_IN_LOBBY';
  END IF;

  INSERT INTO room_participants(room_id, display_name, avatar_emoji, client_id, is_host)
  VALUES (v_room_id, COALESCE(p_display_name,'Guest'), COALESCE(p_avatar,'🐔'), p_client_id, false)
  ON CONFLICT (room_id, client_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        avatar_emoji = EXCLUDED.avatar_emoji
  RETURNING id INTO v_participant_id;

  RETURN v_participant_id;
END $$;

-- INICIAR JOGO (apenas host) -> marca status
DROP FUNCTION IF EXISTS public.start_game(text, text);
CREATE OR REPLACE FUNCTION public.start_game(
  p_room_code text,
  p_client_id text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_code text := upper(p_room_code);
  v_room_id uuid;
  v_is_host boolean;
  v_session_id uuid;
BEGIN
  SELECT id INTO v_room_id FROM game_rooms WHERE room_code = v_code;
  IF v_room_id IS NULL THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM room_participants
     WHERE room_id = v_room_id AND client_id = p_client_id AND is_host = true
  ) INTO v_is_host;

  IF NOT v_is_host THEN RAISE EXCEPTION 'NOT_HOST'; END IF;

  -- Criar sessão de jogo
  INSERT INTO game_sessions (room_code)
  VALUES (v_code)
  RETURNING id INTO v_session_id;

  UPDATE game_rooms SET status = 'in_progress', game_session_id = v_session_id WHERE id = v_room_id;

  RETURN v_session_id;
END $$;

-- Compatibilidade (se algum lugar ainda chama join_room_with_identity)
CREATE OR REPLACE FUNCTION public.join_room_with_identity(
  p_room_code text, p_display_name text, p_avatar text, p_client_id text
) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT public.join_room(p_room_code, p_display_name, p_avatar, p_client_id);
$$;

-- Desabilitar RLS para MVP sem login
ALTER TABLE public.game_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants DISABLE ROW LEVEL SECURITY;