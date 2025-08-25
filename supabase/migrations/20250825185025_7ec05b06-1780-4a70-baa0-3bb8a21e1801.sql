-- Corrigir políticas RLS para permitir inserções de usuários autenticados

-- Remover políticas problemáticas dos gêneros
DROP POLICY IF EXISTS "Authenticated users can insert genres" ON public.genres;
DROP POLICY IF EXISTS "Authenticated users can update genres" ON public.genres;
DROP POLICY IF EXISTS "Authenticated users can delete genres" ON public.genres;
DROP POLICY IF EXISTS "Authenticated users can manage genres" ON public.genres;

-- Remover políticas problemáticas das músicas
DROP POLICY IF EXISTS "Authenticated users can insert songs" ON public.songs;
DROP POLICY IF EXISTS "Authenticated users can update songs" ON public.songs;
DROP POLICY IF EXISTS "Authenticated users can delete songs" ON public.songs;
DROP POLICY IF EXISTS "Authenticated users can manage songs" ON public.songs;

-- Criar políticas RLS corretas para gêneros
CREATE POLICY "Allow authenticated users to insert genres" 
ON public.genres 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update genres" 
ON public.genres 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to delete genres" 
ON public.genres 
FOR DELETE 
TO authenticated 
USING (true);

-- Criar políticas RLS corretas para músicas
CREATE POLICY "Allow authenticated users to insert songs" 
ON public.songs 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update songs" 
ON public.songs 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to delete songs" 
ON public.songs 
FOR DELETE 
TO authenticated 
USING (true);

-- Política mais permissiva para visualização de músicas (incluindo inativas para admin)
DROP POLICY IF EXISTS "Anyone can view active songs" ON public.songs;
CREATE POLICY "Allow viewing songs" 
ON public.songs 
FOR SELECT 
USING (true);