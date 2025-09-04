/**
 * Created by rafaela on 02/09/25.
 */
import { useState, useEffect } from "react";
import { BarnCard } from "@/components/BarnCard";
import { Music, Album, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Mp3Album {
    id: string;
    name: string;
    artist_name: string; // Ajustado para corresponder à sua estrutura
    genre_id: string;
    genre?: {
        id: string;
        name: string;
        emoji: string;
    };
    release_year?: number;
    description?: string;
    cover_image_url?: string;
    song_count?: number;
}

interface SpotifyAlbum {
    id: string;
    name: string;
    artist: string;
    image?: string;
    total_tracks?: number;
}

interface SelectedAlbumDisplayProps {
    roomCode: string;
    gameMode: "mp3" | "spotify";
    selectedMp3AlbumId?: string | null;
    selectedSpotifyAlbumId?: string | null;
    isHost?: boolean;
}

export function SelectedAlbumDisplay({
    roomCode,
    gameMode,
    selectedMp3AlbumId,
    selectedSpotifyAlbumId,
    isHost = false
}: SelectedAlbumDisplayProps) {
    const [mp3Album, setMp3Album] = useState<Mp3Album | null>(null);
    const [spotifyAlbum, setSpotifyAlbum] = useState<SpotifyAlbum | null>(null);
    const [loading, setLoading] = useState(false);

    // Carregar dados do álbum MP3 selecionado
    useEffect(() => {
        if (gameMode === "mp3" && selectedMp3AlbumId) {
            setLoading(true);

            const loadMp3Album = async () => {
                try {
                    // Buscar álbum com informações do gênero
                    const { data, error } = await supabase
                        .from('albums')
                        .select(`
              *,
              genres (
                id,
                name,
                emoji
              )
            `)
                        .eq('id', selectedMp3AlbumId)
                        .single();

                    if (error) {
                        console.error('Erro ao carregar álbum MP3:', error);
                        return;
                    }

                    // Contar músicas do álbum
                    const { count } = await supabase
                        .from('songs')
                        .select('*', { count: 'exact', head: true })
                        .eq('album_id', selectedMp3AlbumId);

                    setMp3Album({
                        ...data,
                        song_count: count || 0
                    });
                } catch (error) {
                    console.error('Erro ao carregar álbum MP3:', error);
                } finally {
                    setLoading(false);
                }
            };

            loadMp3Album();
        }
    }, [gameMode, selectedMp3AlbumId]);

    // Carregar dados do álbum Spotify selecionado
    useEffect(() => {
        if (gameMode === "spotify" && selectedSpotifyAlbumId) {
            setLoading(true);

            const loadSpotifyAlbum = async () => {
                try {
                    // Aqui você implementaria a busca do álbum Spotify
                    // Por enquanto, vou simular os dados
                    setSpotifyAlbum({
                        id: selectedSpotifyAlbumId,
                        name: "Álbum Spotify", // Substitua pela busca real
                        artist: "Artista Spotify", // Substitua pela busca real
                        image: null,
                        total_tracks: 12
                    });
                } catch (error) {
                    console.error('Erro ao carregar álbum Spotify:', error);
                } finally {
                    setLoading(false);
                }
            };

            loadSpotifyAlbum();
        }
    }, [gameMode, selectedSpotifyAlbumId]);

    // Função para remover seleção de álbum (apenas para host)
    const handleRemoveSelection = async () => {
        if (!isHost) return;

        try {
            const updateData = gameMode === "mp3"
                ? { selected_mp3_album_id: null }
                : { selected_spotify_album_id: null };

            const { error } = await supabase
                .from('game_rooms')
                .update(updateData)
                .eq('room_code', roomCode);

            if (error) {
                console.error('Erro ao remover seleção de álbum:', error);
            }
        } catch (error) {
            console.error('Erro ao remover seleção:', error);
        }
    };

    // Se não há álbum selecionado, não renderizar nada
    if ((gameMode === "mp3" && !selectedMp3AlbumId) ||
        (gameMode === "spotify" && !selectedSpotifyAlbumId)) {
        return null;
    }

    if (loading) {
        return (
            <BarnCard variant="nest" className="text-center p-4">
                <div className="animate-pulse">
                    <div className="w-16 h-16 bg-neon-purple/20 rounded mx-auto mb-2"></div>
                    <div className="h-4 bg-neon-purple/20 rounded w-3/4 mx-auto mb-2"></div>
                    <div className="h-3 bg-neon-purple/20 rounded w-1/2 mx-auto"></div>
                </div>
            </BarnCard>
        );
    }

    const currentAlbum = gameMode === "mp3" ? mp3Album : spotifyAlbum;
    if (!currentAlbum) return null;

    // Obter nome do artista correto baseado no modo
    const artistName = gameMode === "mp3"
        ? (mp3Album?.artist_name || "")
        : (spotifyAlbum?.artist || "");

    return (
        <BarnCard variant="coop" className="mb-6">
            <div className="flex items-center gap-3 mb-4">
                <Music className="w-5 h-5 text-neon-orange" />
                <h3 className="text-lg font-bold text-foreground">
                    Álbum Selecionado para o Jogo
                </h3>
            </div>

            <div className="bg-surface/50 rounded-lg p-4 border border-neon-purple/20">
                <div className="flex items-center gap-4">
                    {/* Capa do álbum */}
                    <div className="flex-shrink-0">
                        {(gameMode === "mp3" && mp3Album?.cover_image_url) ||
             (gameMode === "spotify" && spotifyAlbum?.image) ? (
                        <img
                            src={gameMode === "mp3" ? mp3Album?.cover_image_url : spotifyAlbum?.image}
                            alt={currentAlbum.name}
                            className="w-16 h-16 rounded object-cover ring-2 ring-neon-purple/30"
                          />
                        ) : (
                        <div className="w-16 h-16 rounded bg-neon-purple/20 flex items-center justify-center ring-2 ring-neon-purple/30">
                            <Album className="w-8 h-8 text-neon-purple" />
                        </div>
                            )}
                    </div>

                    {/* Informações do álbum */}
                    <div className="flex-grow">
                        <h4 className="font-bold text-foreground text-lg">{currentAlbum.name}</h4>
                        <p className="text-muted-foreground">{artistName}</p>

                        {gameMode === "mp3" && mp3Album?.genre && (
                        <p className="text-sm text-neon-green">
                            Gênero: {mp3Album.genre.emoji} {mp3Album.genre.name}
                        </p>
                        )}

                        {gameMode === "mp3" && mp3Album?.release_year && (
                        <p className="text-sm text-muted-foreground">
                            Ano: {mp3Album.release_year}
                        </p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Music className="w-4 h-4" />
                                {gameMode === "mp3" ? mp3Album?.song_count || 0 : spotifyAlbum?.total_tracks || 0} música{((gameMode === "mp3" ? mp3Album?.song_count : spotifyAlbum?.total_tracks) || 0) !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {gameMode === "mp3" ? "MP3 Local" : "Spotify"}
                            </span>
                        </div>
                    </div>

                    {/* Botão para remover seleção (apenas para host) */}
                    {isHost && (
                        <div className="flex-shrink-0">
                            <button
                                onClick={handleRemoveSelection}
                                className="text-sm px-3 py-1 bg-danger/20 hover:bg-danger/30 text-danger border border-danger/30 rounded-md transition-colors"
                                title="Remover seleção e escolher outro álbum"
                            >
                                ✕ Trocar
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-3 p-3 bg-neon-green/10 border border-neon-green/20 rounded-md">
                    <p className="text-sm text-neon-green">
                        🎵 <strong>Todas as músicas do jogo</strong> serão do álbum <strong>"{currentAlbum.name}"</strong> de <strong>{artistName}</strong>
                    </p>
                </div>
            </div>
        </BarnCard>
    );
}