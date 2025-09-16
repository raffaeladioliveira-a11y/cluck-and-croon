import { useState, useEffect } from "react";
import { ChickenButton } from "@/components/ChickenButton";
import { BarnCard } from "@/components/BarnCard";
import { Music, Album, Loader2, Shuffle, Sparkles } from "lucide-react";
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
    album_songs?: { song_id: string }[];
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
    const [isRandomSelection, setIsRandomSelection] = useState(false);
    const [randomlySelectedAlbum, setRandomlySelectedAlbum] = useState<Mp3Album | null>(null);
    const [randomSelectionInfo, setRandomSelectionInfo] = useState<{
        totalSongs: number;
        genresCount: number;
        albumsCount: number;
    } | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                // Carregar álbuns com informações do gênero
                const { data: albumsData, error: albumsError } = await supabase
                    .from("albums")
                    .select(`
                    *,
                    genres (id, name, emoji)
                `)
                    .order("artist_name", { ascending: true })
                    .order("name", { ascending: true });

                if (albumsError) {
                    console.error("Erro ao carregar álbuns:", albumsError);
                    return;
                }

                // Contar músicas através da tabela album_songs
                const albumsWithCount = await Promise.all(
                    (albumsData || []).map(async (album) => {
                        const { count } = await supabase
                            .from("album_songs")
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

    const handleRandomSelection = async () => {
        try {
            setSaving(true);

            // Calcular estatísticas da seleção aleatória
            const totalSongs = albums.reduce((sum, album) => sum + (album.song_count || 0), 0);
            const uniqueGenres = new Set(albums.map(album => album.genre_id));

            setRandomSelectionInfo({
                totalSongs,
                genresCount: uniqueGenres.size,
                albumsCount: albums.length
            });

            setIsRandomSelection(true);
            setSelectedGenre(null);
            setSelectedAlbum(null);
            setStep("confirm");

        } catch (error) {
            console.error("Erro ao preparar seleção aleatória:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleGenreSelect = async (genre: Genre) => {
        setSelectedGenre(genre);
        setSelectedAlbum(null);
        setIsRandomSelection(false);
        setStep("album");

        // Salvar gênero na sala
        try {
            await supabase
                .from('game_rooms')
                .update({ next_genre_id: genre.id })
                .eq('room_code', roomCode);
        } catch (error) {
            console.error('Erro ao salvar gênero:', error);
        }
    };

    const handleAlbumSelect = (album: Mp3Album) => {
        setSelectedAlbum(album);
        setIsRandomSelection(false);
        setStep("confirm");
    };

    const handleConfirmSelection = async () => {
        setSaving(true);
        try {
            if (isRandomSelection) {
                // Sortear um álbum específico da biblioteca
                const randomIndex = Math.floor(Math.random() * albums.length);
                const randomlySelectedAlbum = albums[randomIndex];

                const { error } = await supabase
                    .from("game_rooms")
                    .update({
                        selected_mp3_album_id: randomlySelectedAlbum.id, // ← Salvar o álbum sorteado
                        is_random_selection: true,   // ← Manter flag de que foi seleção aleatória
                        next_genre_id: randomlySelectedAlbum.genre_id, // ← Salvar o gênero do álbum sorteado
                        status: "lobby",
                    })
                    .eq("room_code", roomCode);

                if (error) {
                    console.error("Erro ao salvar seleção aleatória:", error);
                } else {
                    setRandomlySelectedAlbum(randomlySelectedAlbum);
                    // Disparar evento para RoomLobby com o álbum específico sorteado
                    const event = new CustomEvent('albumSelected', {
                            detail: {
                                albumId: randomlySelectedAlbum.id, // ← ID real do álbum sorteado
                                genreId: randomlySelectedAlbum.genre_id,
                                roomCode,
                                albumInfo: {
                                    name: randomlySelectedAlbum.name,
                                    artist: randomlySelectedAlbum.artist_name,
                                    genre: randomlySelectedAlbum.genre?.name || 'Gênero Desconhecido',
                                isRandom: true, // ← Flag para indicar que foi seleção aleatória
                                totalSongs: randomSelectionInfo?.totalSongs || 0,
                            genresCount: randomSelectionInfo?.genresCount || 0,
                        albumsCount: randomSelectionInfo?.albumsCount || 0
                }
                }
                });
                    window.dispatchEvent(event);

                    // Atualizar o estado local para mostrar o álbum sorteado
                    setSelectedAlbum(randomlySelectedAlbum);
                    setSelectedGenre(randomlySelectedAlbum.genre || null);
                }
            } else if (selectedAlbum) {
                // Seleção normal de álbum
                const { error } = await supabase
                    .from("game_rooms")
                    .update({
                            selected_mp3_album_id: selectedAlbum.id,
                            is_random_selection: false, // ← Garantir que é false
                            next_genre_id: selectedGenre?.id,
                        status: "lobby",
            })
            .eq("room_code", roomCode);

                if (error) {
                    console.error("Erro ao salvar seleção de álbum:", error);
                } else {
                    // Disparar evento para RoomLobby
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
            if (isRandomSelection) {
                setStep("genre");
                setIsRandomSelection(false);
                setRandomSelectionInfo(null);
            } else {
                setStep("album");
                setSelectedAlbum(null);
            }
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
                <Music className="w-6 h-6 text-white" />
                <h3 className="text-xl font-bold text-white">
                    {step === "genre" && "Escolha o Gênero Musical"}
                    {step === "album" && `Álbuns de ${selectedGenre?.name}`}
                    {step === "confirm" && (isRandomSelection ? "Confirmar Seleção Aleatória" : "Confirmar Seleção")}
                </h3>
            </div>

            {/* Passo 1: Seleção de Gênero OU Aleatório */}
            {step === "genre" && (
                <div className="space-y-6">
                    {/* Card de Escolha Aleatória */}
                    <div className="relative">
                        <div
                            className="p-6 border-2 border-dashed border-yellow-300 rounded-lg bg-gradient-to-r from-yellow-100/20 to-orange-100/20 hover:from-yellow-100/30 hover:to-orange-100/30 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                            onClick={handleRandomSelection}
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-yellow-400/20 rounded-full">
                                    <Shuffle className="w-8 h-8 text-yellow-300" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-yellow-300" />
                                        Escolha Aleatória
                                    </h4>
                                    <p className="text-white/80 text-sm mt-1">
                                        Músicas sortidas de todos os gêneros e álbuns disponíveis
                                    </p>
                                    <div className="flex items-center gap-4 mt-3 text-xs text-white/60">
                                        <span>{albums.length} álbuns</span>
                                        <span>•</span>
                                        <span>{genres.length} gêneros</span>
                                        <span>•</span>
                                        <span>{albums.reduce((sum, album) => sum + (album.song_count || 0), 0)} músicas</span>
                                    </div>
                                </div>
                                <div className="text-3xl">🎲</div>
                            </div>
                        </div>
                    </div>

                    {/* Divisor */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 border-t border-white/20"></div>
                        <span className="text-white/60 text-sm px-3">ou escolha um gênero específico</span>
                        <div className="flex-1 border-t border-white/20"></div>
                    </div>

                    {/* Gêneros Específicos */}
                    <div>
                        <p className="text-white mb-4">
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
                </div>
            )}

            {/* Passo 2: Seleção de Álbum */}
            {step === "album" && selectedGenre && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-white">
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
                                        <h4 className="font-semibold text-white">{album.name}</h4>
                                        <p className="text-sm text-white/80">
                                            {album.artist_name}
                                        </p>
                                        {album.release_year && (
                                            <p className="text-xs text-white/60">
                                                Ano: {album.release_year}
                                            </p>
                                        )}
                                        {album.song_count !== undefined && (
                                            <p className="text-xs text-white/60 mt-1">
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
                        <div className="text-center py-8">
                            <p className="text-white/60 mb-4">
                                Nenhum álbum encontrado para o gênero{" "}
                                <strong>{selectedGenre.name}</strong>.
                            </p>
                            <ChickenButton variant="feather" onClick={handleBack}>
                                ← Escolher Outro Gênero
                            </ChickenButton>
                        </div>
                    )}
                </div>
            )}

            {/* Passo 3: Confirmação */}
            {step === "confirm" && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-white">
                            Confirmar Seleção:
                        </h4>
                        <ChickenButton variant="feather" size="sm" onClick={handleBack}>
                            ← Voltar
                        </ChickenButton>
                    </div>

                    {/* Confirmação de Seleção Aleatória */}
                    {/* Confirmação de Seleção Aleatória */}
                    {isRandomSelection && randomSelectionInfo && (
                        <div className="space-y-4">
                            {/* Informações gerais da seleção aleatória */}
                            <div className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border border-yellow-300/30 rounded-lg p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-yellow-400/30 rounded-full">
                                        <Shuffle className="w-10 h-10 text-yellow-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-yellow-300" />
                                            Seleção Aleatória
                                        </h3>
                                        <p className="text-lg text-white/80">
                                            Álbum Sorteado da Biblioteca
                                        </p>
                                    </div>
                                    <div className="text-4xl">🎲</div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="text-center p-3 bg-white/10 rounded">
                                        <div className="text-2xl font-bold text-yellow-300">
                                            {randomSelectionInfo.totalSongs}
                                        </div>
                                        <div className="text-xs text-white/60">Músicas Disponíveis</div>
                                    </div>
                                    <div className="text-center p-3 bg-white/10 rounded">
                                        <div className="text-2xl font-bold text-yellow-300">
                                            {randomSelectionInfo.albumsCount}
                                        </div>
                                        <div className="text-xs text-white/60">Álbuns na Biblioteca</div>
                                    </div>
                                    <div className="text-center p-3 bg-white/10 rounded">
                                        <div className="text-2xl font-bold text-yellow-300">
                                            {randomSelectionInfo.genresCount}
                                        </div>
                                        <div className="text-xs text-white/60">Gêneros</div>
                                    </div>
                                </div>
                            </div>

                            {/* Álbum específico sorteado */}
                            {selectedAlbum && (
                                <div className="bg-white/30 rounded-lg p-6 border-2 border-yellow-300/50">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Sparkles className="w-5 h-5 text-yellow-300" />
                                        <h4 className="text-lg font-bold text-white">Álbum Sorteado:</h4>
                                    </div>

                                    <div className="flex items-center gap-4">
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
                                            <h3 className="text-xl font-bold text-white">
                                                {selectedAlbum.name}
                                            </h3>
                                            <p className="text-lg text-white/80">
                                                {selectedAlbum.artist_name}
                                            </p>
                                            <p className="text-sm text-white/60">
                                                Gênero: {selectedGenre?.emoji} {selectedGenre?.name}
                                            </p>
                                            {selectedAlbum.song_count !== undefined && (
                                                <p className="text-sm text-white/60">
                                                    {selectedAlbum.song_count} música
                                                    {selectedAlbum.song_count !== 1 ? "s" : ""}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-yellow-400/10 border border-yellow-400/20 rounded p-3 mt-4">
                                        <p className="text-sm text-yellow-200 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            Este álbum foi escolhido aleatoriamente para o jogo!
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Confirmação de Álbum Específico */}
                    {selectedAlbum && selectedGenre && !isRandomSelection && (
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
                                    <h3 className="text-xl font-bold text-white">
                                        {selectedAlbum.name}
                                    </h3>
                                    <p className="text-lg text-white/80">
                                        {selectedAlbum.artist_name}
                                    </p>
                                    <p className="text-sm text-white/60">
                                        Gênero: {selectedGenre.emoji} {selectedGenre.name}
                                    </p>
                                    {selectedAlbum.release_year && (
                                        <p className="text-sm text-white/60">
                                            Ano: {selectedAlbum.release_year}
                                        </p>
                                    )}
                                    {selectedAlbum.song_count !== undefined && (
                                        <p className="text-sm text-white/60">
                                            {selectedAlbum.song_count} música
                                            {selectedAlbum.song_count !== 1 ? "s" : ""}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {selectedAlbum.description && (
                                <p className="text-sm text-white/60 mb-4">
                                    {selectedAlbum.description}
                                </p>
                            )}

                            <p className="text-white/80 mb-4">
                                As próximas 10 rodadas serão tocadas apenas com músicas deste álbum.
                            </p>
                        </div>
                    )}

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
                                isRandomSelection ? "🎲 Confirmar Seleção Aleatória" : "✅ Confirmar Álbum"
                            )}
                        </ChickenButton>
                    </div>
                </div>
            )}
        </BarnCard>
    );
}