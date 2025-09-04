import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
}

interface SpotifyTokenResponse {
    access_token: string
    token_type: string
    expires_in: number
}

// Cache para tokens
let cachedToken: { token: string; expiresAt: number } | null = null

async function getSpotifyClientCredentialsToken(): Promise<string> {
    const now = Date.now()

    // Retornar token em cache se ainda válido (com buffer de 5 minutos)
    if (cachedToken && cachedToken.expiresAt > now + 300000) {
        return cachedToken.token
    }

    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")

    if (!clientId || !clientSecret) {
        throw new Error("Credenciais do Spotify não configuradas")
    }

    const credentials = btoa(`${clientId}:${clientSecret}`)

    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    })

    if (!response.ok) {
        throw new Error(`Falha ao obter token do Spotify: ${response.status}`)
    }

    const data: SpotifyTokenResponse = await response.json()

    // Cache do token
    cachedToken = {
        token: data.access_token,
        expiresAt: now + data.expires_in * 1000,
    }

    return data.access_token
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const token = await getSpotifyClientCredentialsToken()
        const { action, query, albumId, limit = 20, offset = 0 } = await req.json()

        // 🔍 Buscar álbuns
        if (action === "search") {
            const resp = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(
                    query
                )}&type=album&limit=${limit}&offset=${offset}`,
                { headers: { Authorization: `Bearer ${token}` } }
            )
            const data = await resp.json()

            if (!resp.ok) {
                throw new Error(data.error?.message || "Erro na busca Spotify")
            }

            const albums = (data.albums?.items || []).map((a: any) => ({
                id: a.id,
                name: a.name,
                artist: a.artists?.map((ar: any) => ar.name).join(", "),
                coverUrl: a.images?.[0]?.url || null,
                releaseDate: a.release_date,
                totalTracks: a.total_tracks,
        }))

            return new Response(
                JSON.stringify({
                    success: true,
                    albums,
                    nextOffset: offset + limit,
                    hasMore: !!data.albums?.next,
        }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        )
        }

        // 🎵 Pegar detalhes de álbum + faixas
        if (action === "getAlbum") {
            const resp = await fetch(
                `https://api.spotify.com/v1/albums/${albumId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            )
            const album = await resp.json()

            if (!resp.ok) {
                throw new Error(album.error?.message || "Erro ao buscar álbum")
            }

            const albumData = {
                    id: album.id,
                    name: album.name,
                    artist: album.artists?.map((ar: any) => ar.name).join(", "),
                coverUrl: album.images?.[0]?.url || null,
                releaseDate: album.release_date,
                totalTracks: album.total_tracks,
                tracks: (album.tracks?.items || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                trackNumber: t.track_number,
                durationMs: t.duration_ms,
                previewUrl: t.preview_url,
                embedUrl: `https://open.spotify.com/embed/track/${t.id}?utm_source=generator&theme=0`,
            })),
        }

            return new Response(
                JSON.stringify({ success: true, album: albumData }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            )
        }

        // ✅ Token puro (fallback antigo)
        if (action === "token" || !action) {
            return new Response(
                JSON.stringify({
                    success: true,
                    access_token: token,
                    token_type: "Bearer",
                }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            )
        }

        return new Response(
            JSON.stringify({ success: false, error: "Ação não suportada" }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        )
    } catch (error: any) {
        console.error("Spotify API error:", error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        )
    }
})
