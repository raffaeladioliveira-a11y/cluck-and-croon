-- Verificar se existe alguma tabela sem política RLS
-- Adicionar políticas para game_rounds e player_answers para inserção por hosts

-- Política para hosts poderem inserir rodadas
CREATE POLICY "Room hosts can manage rounds" ON public.game_rounds 
  FOR INSERT WITH CHECK (
    room_id IN (SELECT id FROM public.game_rooms WHERE host_id = auth.uid())
  );

-- Política para hosts poderem atualizar rodadas  
CREATE POLICY "Room hosts can update rounds" ON public.game_rounds 
  FOR UPDATE USING (
    room_id IN (SELECT id FROM public.game_rooms WHERE host_id = auth.uid())
  );

-- Os avisos restantes (Auth OTP e Leaked Password Protection) são configurações 
-- de autenticação que precisam ser ajustadas nas configurações do Supabase,
-- não via SQL. Essas são configurações de produção recomendadas.