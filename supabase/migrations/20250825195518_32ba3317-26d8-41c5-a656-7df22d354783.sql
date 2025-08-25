-- Criar bucket para músicas se não existir
insert into storage.buckets (id, name, public) 
values ('songs', 'songs', true)
on conflict (id) do nothing;

-- Política para leitura pública do bucket songs
drop policy if exists "Public read access for songs bucket" on storage.objects;
create policy "Public read access for songs bucket"
  on storage.objects for select
  using (bucket_id = 'songs');

-- Política para upload apenas para usuários autenticados
drop policy if exists "Authenticated users can upload songs" on storage.objects;
create policy "Authenticated users can upload songs"
  on storage.objects for insert
  with check (bucket_id = 'songs' and auth.uid() is not null);

-- Política para deletar arquivos apenas para usuários autenticados  
drop policy if exists "Authenticated users can delete songs" on storage.objects;
create policy "Authenticated users can delete songs"
  on storage.objects for delete
  using (bucket_id = 'songs' and auth.uid() is not null);

-- Criar tabela para configurações do jogo se não existir
create table if not exists public.game_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS para game_settings
alter table public.game_settings enable row level security;

-- Política para leitura pública das configurações
create policy "Anyone can read game settings"
  on public.game_settings for select
  using (true);

-- Política para atualização apenas por usuários autenticados
create policy "Authenticated users can update game settings"
  on public.game_settings for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Inserir configurações padrão se não existirem
insert into public.game_settings (key, value) values
  ('eggs_per_correct', '10'),
  ('speed_bonus', '5'), 
  ('time_per_question', '15'),
  ('max_players', '10'),
  ('song_duration', '15')
on conflict (key) do nothing;

-- Função para atualizar updated_at
create or replace function update_game_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger para atualizar updated_at
drop trigger if exists update_game_settings_updated_at on public.game_settings;
create trigger update_game_settings_updated_at
  before update on public.game_settings
  for each row execute function update_game_settings_updated_at();