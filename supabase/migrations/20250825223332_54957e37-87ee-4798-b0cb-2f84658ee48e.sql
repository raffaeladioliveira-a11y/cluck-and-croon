-- Temporary policies to allow anonymous room creation for demo
-- This allows the multiplayer demo to work without forcing authentication

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Room hosts can update their rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Room hosts can delete their rooms" ON public.game_rooms;

-- Allow anyone to create rooms (for demo purposes)
CREATE POLICY "Anyone can create game rooms" 
ON public.game_rooms 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to update rooms (for demo purposes)
CREATE POLICY "Anyone can update game rooms" 
ON public.game_rooms 
FOR UPDATE 
USING (true);

-- Allow anyone to delete rooms (for demo purposes)  
CREATE POLICY "Anyone can delete game rooms" 
ON public.game_rooms 
FOR DELETE 
USING (true);

-- Also update room_participants policies for demo
DROP POLICY IF EXISTS "Authenticated users can join rooms" ON public.room_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.room_participants;
DROP POLICY IF EXISTS "Users can leave rooms" ON public.room_participants;

-- Allow anyone to join rooms
CREATE POLICY "Anyone can join rooms" 
ON public.room_participants 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to update participation
CREATE POLICY "Anyone can update participation" 
ON public.room_participants 
FOR UPDATE 
USING (true);

-- Allow anyone to leave rooms
CREATE POLICY "Anyone can leave rooms" 
ON public.room_participants 
FOR DELETE 
USING (true);