-- Corrigir funções e triggers de forma segura

-- Primeiro, remover triggers que dependem da função
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_songs_updated_at ON public.songs;
DROP TRIGGER IF EXISTS update_game_rooms_updated_at ON public.game_rooms;

-- Remover e recriar a função update_updated_at_column
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar os triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_rooms_updated_at BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Remover e recriar handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
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

-- Recriar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Recriar função generate_unique_room_code
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

-- Adicionar políticas faltantes para songs e genres apenas se não existirem
CREATE POLICY "Authenticated users can insert songs" ON public.songs 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update songs" ON public.songs 
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete songs" ON public.songs 
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert genres" ON public.genres 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update genres" ON public.genres 
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete genres" ON public.genres 
  FOR DELETE USING (auth.role() = 'authenticated');