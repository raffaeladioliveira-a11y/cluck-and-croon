-- Enable RLS and fix security issues for the migration
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- Create proper RLS policies for game_sessions
CREATE POLICY "Allow public read access to game_sessions" 
ON public.game_sessions 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert game_sessions" 
ON public.game_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update game_sessions" 
ON public.game_sessions 
FOR UPDATE 
USING (true);