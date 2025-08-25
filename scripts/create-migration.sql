-- COLE ESTE CONTEÚDO NO ARQUIVO: supabase/migrations/20250101000001_create_quiz_musical_schema.sql

-- Criar tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🐔',
  total_eggs INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Criar tabela de gêneros musicais
CREATE TABLE public.genres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  chicken_description TEXT,
  emoji TEXT DEFAULT '🎵',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de músicas
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  genre_id UUID REFERENCES public.genres(id) ON DELETE SET NULL,
  album_name TEXT,
  release_year INTEGER,
  duration_seconds INTEGER DEFAULT 15,
  spotify_url TEXT,
  youtube_url TEXT,
  preview_url TEXT,
  audio_file_url TEXT,
  is_active BOOLEAN DEFAULT true,
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de salas de jogo
CREATE TABLE public.game_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_players INTEGER DEFAULT 10,
  current_players INTEGER DEFAULT 0,
  rounds_total INTEGER DEFAULT 10,
  time_per_question INTEGER DEFAULT 15,
  eggs_per_correct INTEGER DEFAULT 10,
  speed_bonus INTEGER DEFAULT 5,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
  current_round INTEGER DEFAULT 0,
  current_song_id UUID REFERENCES public.songs(id),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de participantes da sala
CREATE TABLE public.room_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🐔',
  current_eggs INTEGER DEFAULT 0,
  is_ready BOOLEAN DEFAULT false,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Criar tabela de rodadas do jogo
CREATE TABLE public.game_rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id),
  correct_answer TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, round_number)
);

-- Criar tabela de respostas dos jogadores
CREATE TABLE public.player_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  response_time_seconds INTEGER,
  eggs_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(round_id, user_id)
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_answers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas RLS para genres
CREATE POLICY "Anyone can view genres" ON public.genres FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert genres" ON public.genres FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update genres" ON public.genres FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete genres" ON public.genres FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas RLS para songs
CREATE POLICY "Anyone can view active songs" ON public.songs FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can insert songs" ON public.songs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update songs" ON public.songs FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete songs" ON public.songs FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas RLS para game_rooms
CREATE POLICY "Anyone can view game rooms" ON public.game_rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create rooms" ON public.game_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Room hosts can update their rooms" ON public.game_rooms FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Room hosts can delete their rooms" ON public.game_rooms FOR DELETE USING (auth.uid() = host_id);

-- Políticas RLS para room_participants
CREATE POLICY "Room participants can view participants in their rooms" ON public.room_participants 
  FOR SELECT USING (
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );
CREATE POLICY "Authenticated users can join rooms" ON public.room_participants 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own participation" ON public.room_participants 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave rooms" ON public.room_participants 
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para game_rounds
CREATE POLICY "Room participants can view rounds" ON public.game_rounds 
  FOR SELECT USING (
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

-- Políticas RLS para player_answers
CREATE POLICY "Users can view their own answers" ON public.player_answers 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own answers" ON public.player_answers 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_rooms_updated_at BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir dados iniciais para gêneros
INSERT INTO public.genres (name, description, chicken_description, emoji) VALUES 
  ('Sertanejo', 'Música country brasileira', 'Sertanejo da Galinha Caipira', '🤠'),
  ('Rock', 'Rock nacional e internacional', 'Rock do Galo Rebelde', '🎸'),
  ('Forró', 'Música nordestina tradicional', 'Forró do Pintinho Nordestino', '🪗'),
  ('Bossa Nova', 'Jazz brasileiro suave', 'Bossa da Galinha Carioca', '🎷'),
  ('Pop', 'Música pop contemporânea', 'Pop da Galinha Moderna', '🎤'),
  ('MPB', 'Música Popular Brasileira', 'MPB da Galinha Brasileira', '🇧🇷');

-- Inserir algumas músicas de exemplo
INSERT INTO public.songs (title, artist, genre_id, difficulty_level) VALUES 
  ('Evidências', 'Chitãozinho & Xororó', (SELECT id FROM public.genres WHERE name = 'Sertanejo'), 2),
  ('Asa Branca', 'Luiz Gonzaga', (SELECT id FROM public.genres WHERE name = 'Forró'), 1),
  ('Garota de Ipanema', 'Tom Jobim', (SELECT id FROM public.genres WHERE name = 'Bossa Nova'), 3),
  ('Faroeste Caboclo', 'Legião Urbana', (SELECT id FROM public.genres WHERE name = 'Rock'), 4),
  ('Aquarela', 'Toquinho', (SELECT id FROM public.genres WHERE name = 'MPB'), 2),
  ('Ai Se Eu Te Pego', 'Michel Teló', (SELECT id FROM public.genres WHERE name = 'Sertanejo'), 1);

-- Função para criar perfil automaticamente quando usuário se cadastra
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

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para gerar código único de sala
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