-- Corrigir problemas de segurança - apenas o que não existe ainda

-- Verificar e adicionar políticas faltantes para songs
DO $$
BEGIN
    -- Verificar se política para INSERT em songs não existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'songs' 
        AND cmd = 'INSERT'
    ) THEN
        EXECUTE 'CREATE POLICY "Authenticated users can insert songs" ON public.songs FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
    END IF;

    -- Verificar se política para UPDATE em songs não existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'songs' 
        AND cmd = 'UPDATE'
    ) THEN
        EXECUTE 'CREATE POLICY "Authenticated users can update songs" ON public.songs FOR UPDATE USING (auth.role() = ''authenticated'')';
    END IF;

    -- Verificar se política para DELETE em songs não existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'songs' 
        AND cmd = 'DELETE'
    ) THEN
        EXECUTE 'CREATE POLICY "Authenticated users can delete songs" ON public.songs FOR DELETE USING (auth.role() = ''authenticated'')';
    END IF;

    -- Verificar se política para INSERT em genres não existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'genres' 
        AND cmd = 'INSERT'
    ) THEN
        EXECUTE 'CREATE POLICY "Authenticated users can insert genres" ON public.genres FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
    END IF;

    -- Verificar se política para UPDATE em genres não existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'genres' 
        AND cmd = 'UPDATE'
    ) THEN
        EXECUTE 'CREATE POLICY "Authenticated users can update genres" ON public.genres FOR UPDATE USING (auth.role() = ''authenticated'')';
    END IF;

    -- Verificar se política para DELETE em genres não existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'genres' 
        AND cmd = 'DELETE'
    ) THEN
        EXECUTE 'CREATE POLICY "Authenticated users can delete genres" ON public.genres FOR DELETE USING (auth.role() = ''authenticated'')';
    END IF;
END $$;

-- Recriar funções com search_path seguro
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.handle_new_user();
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_emoji)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Galinha Anônima'),
    '🐔'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.generate_unique_room_code();
CREATE OR REPLACE FUNCTION public.generate_unique_room_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    -- Gerar código de 6 caracteres
    code := upper(substring(md5(random()::text) from 1 for 6));
    
    -- Verificar se já existe
    SELECT COUNT(*) INTO exists_count 
    FROM public.game_rooms 
    WHERE room_code = code AND status != 'finished';
    
    -- Se não existe, retornar o código
    IF exists_count = 0 THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;