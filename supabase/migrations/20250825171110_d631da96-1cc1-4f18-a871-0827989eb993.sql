-- Corrigir problemas de segurança detectados

-- Adicionar políticas para gêneros (permitir inserção/atualização para usuários autenticados por enquanto)
CREATE POLICY "Authenticated users can manage genres" ON public.genres 
  FOR ALL USING (auth.role() = 'authenticated');

-- Adicionar políticas para songs (permitir inserção/atualização para usuários autenticados por enquanto)  
CREATE POLICY "Authenticated users can manage songs" ON public.songs 
  FOR ALL USING (auth.role() = 'authenticated');

-- Corrigir funções para ter search_path seguro
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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