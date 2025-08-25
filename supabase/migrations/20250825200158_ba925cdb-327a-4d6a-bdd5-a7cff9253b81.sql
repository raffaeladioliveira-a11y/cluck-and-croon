-- Ajustar políticas para permitir operações do admin
-- Para songs: permitir inserção pública (admin não usa auth Supabase)
drop policy if exists "Allow authenticated users to insert songs" on public.songs;
drop policy if exists "Allow authenticated users to update songs" on public.songs;
drop policy if exists "Allow authenticated users to delete songs" on public.songs;

create policy "Allow public insert songs"
  on public.songs for insert
  with check (true);

create policy "Allow public update songs"
  on public.songs for update
  using (true);

create policy "Allow public delete songs"
  on public.songs for delete
  using (true);

-- Para genres: permitir inserção pública
drop policy if exists "Allow authenticated users to insert genres" on public.genres;
drop policy if exists "Allow authenticated users to update genres" on public.genres;
drop policy if exists "Allow authenticated users to delete genres" on public.genres;

create policy "Allow public insert genres"
  on public.genres for insert
  with check (true);

create policy "Allow public update genres"
  on public.genres for update
  using (true);

create policy "Allow public delete genres"
  on public.genres for delete
  using (true);

-- Para storage: permitir upload público (admin)
drop policy if exists "Authenticated users can upload songs" on storage.objects;
drop policy if exists "Authenticated users can delete songs" on storage.objects;

create policy "Public can upload songs"
  on storage.objects for insert
  with check (bucket_id = 'songs');

create policy "Public can delete songs"
  on storage.objects for delete
  using (bucket_id = 'songs');

-- Para game_settings: permitir operações públicas
drop policy if exists "Authenticated users can update game settings" on public.game_settings;

create policy "Allow public update game settings"
  on public.game_settings for all
  using (true)
  with check (true);