-- Create Spotify albums table
CREATE TABLE public.spotify_albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spotify_album_id TEXT NOT NULL UNIQUE,
  album_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  album_cover_url TEXT,
  release_date DATE,
  genre_id UUID REFERENCES public.genres(id),
  total_tracks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Spotify tracks table
CREATE TABLE public.spotify_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spotify_track_id TEXT NOT NULL UNIQUE,
  spotify_album_id UUID NOT NULL REFERENCES public.spotify_albums(id) ON DELETE CASCADE,
  track_name TEXT NOT NULL,
  track_number INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  embed_url TEXT,
  preview_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.spotify_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotify_tracks ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (like existing tables)
CREATE POLICY "Allow public read access to spotify_albums" 
ON public.spotify_albums 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert spotify_albums" 
ON public.spotify_albums 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update spotify_albums" 
ON public.spotify_albums 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete spotify_albums" 
ON public.spotify_albums 
FOR DELETE 
USING (true);

CREATE POLICY "Allow public read access to spotify_tracks" 
ON public.spotify_tracks 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert spotify_tracks" 
ON public.spotify_tracks 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update spotify_tracks" 
ON public.spotify_tracks 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete spotify_tracks" 
ON public.spotify_tracks 
FOR DELETE 
USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_spotify_albums_updated_at
BEFORE UPDATE ON public.spotify_albums
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add game mode setting 
INSERT INTO public.game_settings (key, value) 
VALUES ('game_mode', '"mp3"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add indexes for better performance
CREATE INDEX idx_spotify_albums_genre_id ON public.spotify_albums(genre_id);
CREATE INDEX idx_spotify_albums_spotify_id ON public.spotify_albums(spotify_album_id);
CREATE INDEX idx_spotify_tracks_album_id ON public.spotify_tracks(spotify_album_id);
CREATE INDEX idx_spotify_tracks_spotify_id ON public.spotify_tracks(spotify_track_id);