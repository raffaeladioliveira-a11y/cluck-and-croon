import { useState, useEffect } from "react";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { Music, Album, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Mp3Album {
    id: string;
    name: string;
    artist_name: string;
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

interface Genre {
    id: string;
    name: string;
    emoji: string;
}

interface HostMp3AlbumSelectorProps {
    roomCode: string;
}

export function HostMp3AlbumSelector({ roomCode }: HostMp3AlbumSelectorProps) {
    const [albums, setAlbums] = useState<Mp3Album[]>([]);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
    const [selectedAlbum, setSelectedAlbum] = useState<Mp3Album | null>(null);
    const [filteredAlbums, setFilteredAlbums] = useState<Mp3Album[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState<"genre" | "album" | "confirm">("genre");

    useEffect(() => {
        async function loadData() {
            try {
                // Carregar álbuns com informações do gênero
                const { data: albumsData, error: albumsError } = await supabase
                    .from("albums")
                    .select(`
            *,
            genres (
              id,
              name,
              emoji
            )
          `)
                    .order("artist_name", { ascending: true })
                    .order("name", { ascending: true });

                if (albumsError) {
                    console.error("Erro ao carregar álbuns:", albumsError);
                    return;
                }

                // Contar músicas por álbum (se você tiver tabela songs)
                const albumsWithCount = await Promise.all(
                    (albumsData || []).map(async (album) => {
                        const { count } = await supabase
                            .from("songs")
                            .select("*", { count: "exact", head: true })
                            .eq("album_id", album.id);

                        return {
                            ...album,
                            song_count: count || 0,
                        };
                    })
                );

                setAlbums(albumsWithCount);

                // Extrair gêneros únicos dos álbuns
                const uniqueGenres = albumsData
                    ?.map((album) => album.genres)
                    .filter(
                        (genre, index, self) =>
                        genre && self.findIndex((g) => g?.id === genre.id) === index
            )
            .sort((a, b) => a.name.localeCompare(b.name)) || [];

                setGenres(uniqueGenres);
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    useEffect(() => {
        if (selectedGenre) {
            const filtered = albums.filter(
                (album) => album.genre_id === selectedGenre.id
            );
            setFilteredAlbums(filtered);
        } else {
            setFilteredAlbums([]);
        }
    }, [selectedGenre, albums]);

    const handleGenreSelect = (genre: Genre) => {
        setSelectedGenre(genre);
        setSelectedAlbum(null);
        setStep("album");
    };

    const handleAlbumSelect = (album: Mp3Album) => {
        setSelectedAlbum(album);
        setStep("confirm");
    };

    const handleConfirmSelection = async () => {
        if (!selectedAlbum) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from("game_rooms")
                .update({
                    selected_mp3_album_id: selectedAlbum.id,
                    status: "lobby",
                })
                .eq("room_code", roomCode);

            if (error) {
                console.error("Erro ao salvar seleção de álbum:", error);
            } else {
                // ADICIONAR: Disparar evento personalizado para round-lobby
                const event = new CustomEvent('albumSelected', {
                    detail: {
                        albumId: selectedAlbum.id,
                        genreId: selectedGenre?.id,
                    roomCode,
                    albumInfo: {
                        name: selectedAlbum.name,
                        artist: selectedAlbum.artist_name,
                        genre: selectedGenre?.name || ''
                }
            }
            });
                window.dispatchEvent(event);
            }
        } catch (error) {
            console.error("Erro ao confirmar seleção:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleBack = () => {
        if (step === "album") {
            setStep("genre");
            setSelectedGenre(null);
            setFilteredAlbums([]);
        } else if (step === "confirm") {
            setStep("album");
            setSelectedAlbum(null);
        }
    };

    if (loading) {
        return (
            <BarnCard variant="nest" className="text-center p-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-barn-brown" />
                <p className="text-barn-brown">Carregando álbuns...</p>
            </BarnCard>
        );
    }

    return (
        <BarnCard variant="coop" className="p-6">
            <div className="flex items-center gap-3 mb-6">
                <Music className="w-6 h-6 text-barn-brown" />
                <h3 className="text-xl font-bold text-barn-brown">
                    {step === "genre" && "Escolha o Gênero Musical"}
                    {step === "album" && `Álbuns de ${selectedGenre?.name}`}
                    {step === "confirm" && "Confirmar Seleção"}
                </h3>
            </div>

            {/* Passo 1: Seleção de Gênero */}
            {step === "genre" && (
                <div className="space-y-4">
                    <p className="text-muted-foreground mb-4">
                        Selecione o gênero musical para o jogo:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {genres.map((genre) => (
                            <ChickenButton
                                key={genre.id}
                                variant="corn"
                                size="sm"
                                onClick={() => handleGenreSelect(genre)}
                                className="justify-start text-left"
                            >
                                {genre.emoji} {genre.name}
                            </ChickenButton>
                        ))}
                    </div>

                    {genres.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                            Nenhum gênero encontrado nos álbuns disponíveis.
                        </p>
                    )}
                </div>
            )}

            {/* Passo 2: Seleção de Álbum */}
            {step === "album" && selectedGenre && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-muted-foreground">
                            Escolha um álbum de <strong>{selectedGenre.name}</strong>:
                        </p>
                        <ChickenButton variant="feather" size="sm" onClick={handleBack}>
                            ← Voltar
                        </ChickenButton>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredAlbums.map((album) => (
                            <div
                                key={album.id}
                                className="p-4 border rounded-lg hover:bg-white/20 cursor-pointer transition-colors"
                                onClick={() => handleAlbumSelect(album)}
                            >
                                <div className="flex items-start gap-3">
                                    {album.cover_image_url ? (
                                        <img
                                            src={album.cover_image_url}
                                            alt={album.name}
                                            className="w-16 h-16 rounded object-cover"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded bg-barn-brown/20 flex items-center justify-center">
                                            <Album className="w-8 h-8 text-barn-brown" />
                                        </div>
                                    )}

                                    <div className="flex-1">
                                        <h4 className="font-semibold text-barn-brown">{album.name}</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {album.artist_name}
                                        </p>
                                        {album.release_year && (
                                            <p className="text-xs text-muted-foreground">
                                                Ano: {album.release_year}
                                            </p>
                                        )}
                                        {album.song_count !== undefined && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {album.song_count} música
                                                {album.song_count !== 1 ? "s" : ""}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredAlbums.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                            Nenhum álbum encontrado para o gênero{" "}
                            <strong>{selectedGenre.name}</strong>.
                        </p>
                    )}
                </div>
            )}

            {/* Passo 3: Confirmação */}
            {step === "confirm" && selectedAlbum && selectedGenre && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-barn-brown">
                            Confirmar Seleção:
                        </h4>
                        <ChickenButton variant="feather" size="sm" onClick={handleBack}>
                            ← Voltar
                        </ChickenButton>
                    </div>

                    <div className="bg-white/30 rounded-lg p-6">
                        <div className="flex items-center gap-4 mb-4">
                            {selectedAlbum.cover_image_url ? (
                                <img
                                    src={selectedAlbum.cover_image_url}
                                    alt={selectedAlbum.name}
                                    className="w-20 h-20 rounded object-cover"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded bg-barn-brown/20 flex items-center justify-center">
                                    <Album className="w-10 h-10 text-barn-brown" />
                                </div>
                            )}

                            <div>
                                <h3 className="text-xl font-bold text-barn-brown">
                                    {selectedAlbum.name}
                                </h3>
                                <p className="text-lg text-muted-foreground">
                                    {selectedAlbum.artist_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Gênero: {selectedGenre.emoji} {selectedGenre.name}
                                </p>
                                {selectedAlbum.release_year && (
                                    <p className="text-sm text-muted-foreground">
                                        Ano: {selectedAlbum.release_year}
                                    </p>
                                )}
                                {selectedAlbum.song_count !== undefined && (
                                    <p className="text-sm text-muted-foreground">
                                        {selectedAlbum.song_count} música
                                        {selectedAlbum.song_count !== 1 ? "s" : ""}
                                    </p>
                                )}
                            </div>
                        </div>

                        {selectedAlbum.description && (
                            <p className="text-sm text-muted-foreground mb-4">
                                {selectedAlbum.description}
                            </p>
                        )}

                        <p className="text-muted-foreground mb-4">
                            O jogo será jogado apenas com as músicas deste álbum. Todos os
                            jogadores precisarão adivinhar as músicas de{" "}
                            <strong>{selectedAlbum.name}</strong>.
                        </p>
                    </div>

                    <div className="flex gap-3 justify-center">
                        <ChickenButton
                            variant="corn"
                            size="lg"
                            onClick={handleConfirmSelection}
                            disabled={saving}
                            className="min-w-[200px]"
                        >
                            {saving ? (
                                <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Confirmando...
                                </>
                            ) : (
                                "✅ Confirmar e Iniciar Jogo"
                            )}
                        </ChickenButton>
                    </div>
                </div>
            )}
        </BarnCard>
    );
}