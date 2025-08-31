// src/components/HostAlbumSelector.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Music, Play } from "lucide-react";

type Genre = {
    id: string;
    name: string;
    emoji?: string;
    description?: string;
};

type Album = {
    id: string;
    album_name: string;
    artist_name: string;
    album_cover_url?: string;
    spotify_album_id?: string;
};

export function HostAlbumSelector({ roomCode }: { roomCode: string }) {
    const [genres, setGenres] = useState<Genre[]>([]);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
    const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [step, setStep] = useState<'genre' | 'album'>('genre');
    const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

    // Carrega gêneros
    useEffect(() => {
        let mounted = true;
        (async () => {
            const { data, error } = await supabase
                .from("genres")
                .select("id, name, emoji, description")
                .order("name");
            if (!error && mounted) setGenres((data as Genre[]) ?? []);
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Carrega álbuns por gênero
    useEffect(() => {
        let mounted = true;
        if (!selectedGenre) {
            setAlbums([]);
            return;
        }
        (async () => {
            const { data, error } = await supabase
                .from("spotify_albums")
                .select("id, album_name, artist_name, album_cover_url, spotify_album_id")
                .eq("genre_id", selectedGenre.id)
                .order("album_name");
            if (!error && mounted) setAlbums((data as Album[]) ?? []);
        })();
        return () => {
            mounted = false;
        };
    }, [selectedGenre]);

    const handleGenreSelect = (genre: Genre) => {
        setSelectedGenre(genre);
        setSelectedAlbum(null);
        setStep('album');
    };

    const handleAlbumSelect = (album: Album) => {
        setSelectedAlbum(album);
    };

    const goBackToGenres = () => {
        setStep('genre');
        setSelectedAlbum(null);
    };

    const confirm = async () => {
        if (!roomCode || !selectedGenre || !selectedAlbum) {
            alert("Selecione um gênero e um álbum!");
            return;
        }

        setIsLoading(true);

        try {
            const { data, error } = await supabase
                .from("game_rooms")
                .update({
                    selected_genre_id: selectedGenre.id,
                    selected_spotify_album_id: selectedAlbum.id
                })
                .eq("room_code", roomCode)
                .select();

            if (error) {
                console.error("Erro ao atualizar a sala:", error);
                alert("Erro ao salvar as configurações. Tente novamente.");
                return;
            }

            console.log("Sala atualizada com sucesso:", data);
            // Mostra feedback de sucesso e mantém a interface visível
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);

        } catch (error) {
            console.error("Erro inesperado:", error);
            alert("Erro inesperado. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    {step === 'album' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goBackToGenres}
                            className="text-white hover:bg-white/20 p-2"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    )}
                    <div>
                        <h3 className="text-white font-bold text-xl flex items-center gap-2">
                            <Music className="w-6 h-6" />
                            {step === 'genre' ? 'Escolha o Estilo Musical' : `Álbuns de ${selectedGenre?.name}`}
                        </h3>
                        <p className="text-white/70 text-sm">
                            {step === 'genre'
                                ? 'Selecione o estilo musical para a partida'
                                : 'Escolha um álbum específico ou deixe aleatório'
                            }
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    {saveSuccess && (
                        <div className="mb-2 px-3 py-1 bg-green-500/20 border border-green-400/50 rounded-full">
                            <p className="text-green-300 text-xs font-medium">✓ Salvo com sucesso!</p>
                        </div>
                    )}
                    {selectedGenre && selectedAlbum && (
                        <div>
                            <p className="text-white/80 text-sm">Selecionado:</p>
                            <p className="text-white font-semibold">{selectedGenre.name}</p>
                            <p className="text-white/70 text-xs">{selectedAlbum.artist_name} - {selectedAlbum.album_name}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Conteúdo principal */}
            {step === 'genre' ? (
                // Grade de gêneros
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                    {genres.map((genre) => (
                        <div
                            key={genre.id}
                            onClick={() => handleGenreSelect(genre)}
                            className={`
                                bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg p-4 cursor-pointer
                                transition-all duration-200 hover:scale-105 hover:shadow-lg group
                                ${selectedGenre?.id === genre.id ? 'bg-green-500/30 border-green-400' : ''}
                            `}
                        >
                            <div className="text-center">
                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                                    {genre.emoji || '🎵'}
                                </div>
                                <h4 className="text-white font-semibold text-sm mb-1">
                                    {genre.name}
                                </h4>
                                {genre.description && (
                                    <p className="text-white/60 text-xs line-clamp-2">
                                        {genre.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // Grade de álbuns
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {albums.map((album) => (
                            <div
                                key={album.id}
                                onClick={() => handleAlbumSelect(album)}
                                className={`
                                    bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg p-4 cursor-pointer
                                    transition-all duration-200 hover:scale-105 hover:shadow-lg group
                                    ${selectedAlbum?.id === album.id ? 'bg-green-500/30 border-green-400' : ''}
                                `}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Capa do álbum */}
                                    <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {album.album_cover_url ? (
                                            <img
                                                src={album.album_cover_url}
                                                alt={album.album_name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    // Fallback se a imagem não carregar
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : null}
                                        <div className={`text-2xl ${album.album_cover_url ? 'hidden' : ''}`}>
                                            🎵
                                        </div>
                                    </div>

                                    {/* Info do álbum */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-white font-semibold text-sm mb-1 truncate">
                                            {album.album_name}
                                        </h4>
                                        <p className="text-white/70 text-xs truncate">
                                            {album.artist_name}
                                        </p>
                                    </div>

                                    {/* Indicador de seleção */}
                                    <div className={`
                                        w-6 h-6 rounded-full border-2 flex items-center justify-center
                                        ${selectedAlbum?.id === album.id
                                            ? 'bg-green-500 border-green-400'
                                            : 'border-white/40 group-hover:border-white/60'
                                        }
                                    `}>
                                        {selectedAlbum?.id === album.id && (
                                        <Play className="w-3 h-3 text-white fill-white" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {albums.length === 0 && (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-4">🎵</div>
                            <p className="text-white/70">
                                Nenhum álbum encontrado para este gênero
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Botões de ação */}
            <div className="flex justify-between items-center pt-4 border-t border-white/20">
                <div className="flex items-center gap-2 text-white/60 text-sm">
                    <div className={`w-2 h-2 rounded-full ${step === 'genre' ? 'bg-green-400' : 'bg-white/40'}`} />
                    <span>Gênero</span>
                    <div className={`w-2 h-2 rounded-full ${step === 'album' ? 'bg-green-400' : 'bg-white/40'}`} />
                    <span>Álbum</span>
                </div>

                <div className="flex gap-3">
                    {step === 'album' && (
                        <Button
                            variant="outline"
                            onClick={goBackToGenres}
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                            Voltar
                        </Button>
                    )}

                    <Button
                        onClick={confirm}
                        disabled={!selectedGenre || !selectedAlbum || isLoading}
                        className={`
                            px-6 transition-all duration-200
                            ${selectedGenre && selectedAlbum
                                ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg hover:shadow-green-500/25'
                                : 'bg-white/20 text-white/50 cursor-not-allowed'
                            }
                        `}
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Salvando...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Play className="w-4 h-4" />
                                {saveSuccess ? 'Alterar Seleção' : 'Confirmar Seleção'}
                            </div>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}