import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface SpotifySearchResponse {
  albums: {
    items: Array<{
      id: string
      name: string
      artists: Array<{ name: string }>
      images: Array<{ url: string; height: number; width: number }>
      release_date: string
      total_tracks: number
    }>
  }
}

interface SpotifyAlbumResponse {
  id: string
  name: string
  artists: Array<{ name: string }>
  images: Array<{ url: string; height: number; width: number }>
  release_date: string
  total_tracks: number
  tracks: {
    items: Array<{
      id: string
      name: string
      track_number: number
      duration_ms: number
      preview_url: string | null
    }>
  }
}

// Cache for access tokens
let cachedToken: { token: string; expiresAt: number } | null = null

async function getSpotifyToken(): Promise<string> {
  const now = Date.now()
  
  // Return cached token if still valid (with 5 minute buffer)
  if (cachedToken && cachedToken.expiresAt > now + 300000) {
    return cachedToken.token
  }

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials')
  }

  const credentials = btoa(`${clientId}:${clientSecret}`)
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  })

  if (!response.ok) {
    throw new Error(`Failed to get Spotify token: ${response.status}`)
  }

  const data: SpotifyTokenResponse = await response.json()
  
  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in * 1000)
  }

  return data.access_token
}

async function searchSpotifyAlbums(query: string, token: string): Promise<SpotifySearchResponse> {
  const encodedQuery = encodeURIComponent(query)
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodedQuery}&type=album&limit=20`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Spotify search failed: ${response.status}`)
  }

  return await response.json()
}

async function getSpotifyAlbum(albumId: string, token: string): Promise<SpotifyAlbumResponse> {
  const response = await fetch(
    `https://api.spotify.com/v1/albums/${albumId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to get Spotify album: ${response.status}`)
  }

  return await response.json()
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, query, albumId } = await req.json()
    const token = await getSpotifyToken()

    console.log(`Spotify API action: ${action}`)

    switch (action) {
      case 'search':
        if (!query) {
          throw new Error('Query is required for search')
        }
        
        const searchResults = await searchSpotifyAlbums(query, token)
        
        return new Response(
          JSON.stringify({
            success: true,
            albums: searchResults.albums.items.map(album => ({
              id: album.id,
              name: album.name,
              artist: album.artists[0]?.name || 'Unknown Artist',
              coverUrl: album.images[0]?.url || null,
              releaseDate: album.release_date,
              totalTracks: album.total_tracks
            }))
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )

      case 'getAlbum':
        if (!albumId) {
          throw new Error('Album ID is required')
        }
        
        const albumData = await getSpotifyAlbum(albumId, token)
        
        return new Response(
          JSON.stringify({
            success: true,
            album: {
              id: albumData.id,
              name: albumData.name,
              artist: albumData.artists[0]?.name || 'Unknown Artist',
              coverUrl: albumData.images[0]?.url || null,
              releaseDate: albumData.release_date,
              totalTracks: albumData.total_tracks,
              tracks: albumData.tracks.items.map(track => ({
                id: track.id,
                name: track.name,
                trackNumber: track.track_number,
                durationMs: track.duration_ms,
                embedUrl: `https://open.spotify.com/embed/track/${track.id}`,
                previewUrl: track.preview_url
              }))
            }
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error) {
    console.error('Spotify API error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})