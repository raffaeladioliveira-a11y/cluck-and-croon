import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, roomCode, genreId, userId, roundNumber } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'selectGenre':
        // Update room with selected genre for next set
        const { error: updateError } = await supabase
          .from('game_rooms')
          .update({ 
            next_genre_id: genreId,
            current_set: 1 // Reset to set 1 for new round
          })
          .eq('room_code', roomCode);

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({ success: true, message: 'Genre selected successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'getSongsForGenre':
        // Get room info to check active genre
        const { data: roomData } = await supabase
          .from('game_rooms')
          .select('next_genre_id, current_set')
          .eq('room_code', roomCode)
          .single();

        const activeGenreId = roomData?.next_genre_id || genreId;
        console.log(`[${roomCode}] Getting songs for genre: ${activeGenreId || 'ALL'} | Round: ${roundNumber || 'N/A'}`);

        // Get songs filtered by active genre
        let query = supabase
          .from('songs')
          .select('*')
          .eq('is_active', true);

        if (activeGenreId) {
          query = query.eq('genre_id', activeGenreId);
        }

        const { data: songs, error: songsError } = await query;
        if (songsError) throw songsError;

        console.log(`[${roomCode}] Found ${songs?.length || 0} songs for genre ${activeGenreId || 'ALL'}`);

        // Fallback if not enough songs
        let finalSongs = songs || [];
        let usedFallback = false;

        if (finalSongs.length < 10 && activeGenreId) {
          console.log(`[${roomCode}] Not enough songs (${finalSongs.length}) for genre ${activeGenreId}, using fallback`);
          
          // Get all songs as fallback
          const { data: fallbackSongs } = await supabase
            .from('songs')
            .select('*')
            .eq('is_active', true);
          
          finalSongs = fallbackSongs || [];
          usedFallback = true;
        }

        // Shuffle songs for variety
        const shuffled = finalSongs.sort(() => Math.random() - 0.5);

        return new Response(
          JSON.stringify({ 
            songs: shuffled.slice(0, 20),
            activeGenreId,
            usedFallback,
            totalAvailable: finalSongs.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'getActiveGenre':
        // Get current active genre for display
        const { data: genreData } = await supabase
          .from('game_rooms')
          .select(`
            next_genre_id,
            genres:next_genre_id (
              id,
              name,
              emoji,
              description
            )
          `)
          .eq('room_code', roomCode)
          .single();

        return new Response(
          JSON.stringify({ 
            activeGenre: genreData?.genres || null,
            activeGenreId: genreData?.next_genre_id || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error in game-manager function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});