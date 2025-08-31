/**
 * Created by rafaela on 31/08/25.
 */
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

// Cache para tokens
let cachedToken: { token: string; expiresAt: number } | null = null

async function getSpotifyClientCredentialsToken(): Promise<string> {
    const now = Date.now()

    // Retornar token em cache se ainda válido (com buffer de 5 minutos)
    if (cachedToken && cachedToken.expiresAt > now + 300000) {
        return cachedToken.token
    }

    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
        throw new Error('Credenciais do Spotify não configuradas')
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
        throw new Error(`Falha ao obter token do Spotify: ${response.status}`)
    }

    const data: SpotifyTokenResponse = await response.json()

    // Cache do token
    cachedToken = {
        token: data.access_token,
        expiresAt: now + (data.expires_in * 1000)
    }

    return data.access_token
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const token = await getSpotifyClientCredentialsToken()

        return new Response(
            JSON.stringify({
                success: true,
                access_token: token,
                token_type: 'Bearer'
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('Spotify token error:', error)

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