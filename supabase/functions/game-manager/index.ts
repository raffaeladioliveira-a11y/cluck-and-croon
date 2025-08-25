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
    const { action, roomCode, genreId, userId } = await req.json();
    
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
        // Get songs filtered by genre (with anti-repetition)
        let query = supabase
          .from('songs')
          .select('*')
          .eq('is_active', true)
          .limit(20);

        if (genreId) {
          query = query.eq('genre_id', genreId);
        }

        const { data: songs, error: songsError } = await query;
        if (songsError) throw songsError;

        return new Response(
          JSON.stringify({ songs }),
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