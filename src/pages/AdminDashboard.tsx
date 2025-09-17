import {useState, useEffect, useCallback} from "react";
import {useNavigate} from "react-router-dom";
import {ChickenButton} from "@/components/ChickenButton";
import {BarnCard} from "@/components/BarnCard";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Music, Users, Egg, Settings, Plus, Trash2, Edit, LogOut, VolumeX} from "lucide-react";
import {toast} from "@/hooks/use-toast";
import {supabase} from "@/integrations/supabase/client";
import {ArrowLeft, FolderOpen} from "lucide-react";
import {Switch} from "@/components/ui/switch";
import {Separator} from "@/components/ui/separator";
import {Music2, Disc3} from "lucide-react";
import { BulkUploadComponent } from "@/components/BulkUploadComponent";
import { AudioPlayer } from '@/components/AudioPlayer';
// Adicione estas importações no topo do seu AdminDashboard
import { SongAlbumManager, MoveSongDialog } from '@/components/SongAlbumManager';
import { ArrowRight, Link } from 'lucide-react';
// Adicione estas linhas nos imports
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from 'lucide-react';
import { Eye, EyeOff } from "lucide-react";


interface Song {
    id: string;
    title: string;
    artist: string;
    genre_id?: string;
    album_id?: string | null;
    album_name?: string;
    release_year?: number;
    duration_seconds?: number;
    spotify_url?: string;
    youtube_url?: string;
    preview_url?: string;
    audio_file_url?: string;
    is_active?: boolean;
    difficulty_level?: number;
    play_count?: number;
    created_at?: string;
    updated_at?: string;
    spotify_track_id?: string;
    embed_url?: string;
    // Relations from Supabase joins
    albums?: {
        name: string;
        artist_name: string;
        release_year: number | null;
        cover_image_url: string;
    };
    genres?: {
        name: string;
        emoji: string;
    };
}

interface Genre {
    id: string;
    name: string;
    description?: string;
    chicken_description: string;
    emoji: string;
    created_at?: string;
}

interface Album {
    id: string;
    name: string;
    artist_name: string;
    release_year: number | null;
    description: string;
    cover_image_url: string;
    genre_id: string;
    created_at?: string;
    is_hidden?: boolean;
    genres?: {  // Note que é 'genres' (plural) vindo do Supabase
        id: string;
        name: string;
        emoji: string;
    };
    songs?: { count: number }[];
}

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [newAlbum, setNewAlbum] = useState({
        name: '',
        artist_name: '',
        release_year: '',
        description: '',
        cover_file: null as File | null,
        cover_image_url: '',
        genre_id: '',
    });
    const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
    const [isEditAlbumModalOpen, setIsEditAlbumModalOpen] = useState(false);
    const [isUploadingCover, setIsUploadingCover] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [gameMode, setGameMode] = useState<"mp3" | "spotify">("mp3");
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);
    const [showBulkUpload, setShowBulkUpload] = useState(false);

    // Estados para genrenciar músicas para mais de um álbum
    const [isSongAlbumManagerOpen, setIsSongAlbumManagerOpen] = useState(false);
    const [isMoveSongDialogOpen, setIsMoveSongDialogOpen] = useState(false);
    const [selectedSongForManager, setSelectedSongForManager] = useState<Song | null>(null);
    const [currentAlbumIdForMove, setCurrentAlbumIdForMove] = useState<string>('');
    const [showHiddenAlbums, setShowHiddenAlbums] = useState(false);
    const [battleMode, setBattleMode] = useState<'classic' | 'battle'>('classic');
    const [isLoadingBattleMode, setIsLoadingBattleMode] = useState(true);
    const [isLoadingBattleSettings, setIsLoadingBattleSettings] = useState(false);



    // Função para abrir o gerenciador de álbuns de uma música
    const openSongAlbumManager = (song: Song) => {
        setSelectedSongForManager(song);
        setIsSongAlbumManagerOpen(true);
    };

    // Função para abrir o diálogo de mover música
    const openMoveSongDialog = (song: Song, currentAlbumId: string) => {
        setSelectedSongForManager(song);
        setCurrentAlbumIdForMove(currentAlbumId);
        setIsMoveSongDialogOpen(true);
    };

    // Função atualizada para carregar músicas dos álbuns com relacionamentos N:N
    const loadAlbumSongsWithRelationships = async (albumId: string) => {
        try {
            const { data, error } = await supabase
                .from('album_songs')
                .select(`
        track_order,
        songs (
          *,
          album_songs (
            album_id,
            albums (name)
          )
        )
      `)
                .eq('album_id', albumId)
                .order('track_order', { ascending: true });

            if (error) throw error;

            // Transformar dados para o formato esperado
            const songsWithAlbumInfo = (data || []).map(item => ({
                ...item.songs,
                track_order: item.track_order,
                // Adicionar informação sobre todos os álbuns desta música
                all_albums: item.songs.album_songs?.map((as: any) => ({
                id: as.album_id,
                name: as.albums.name
            })) || []
        }));

            setAlbumSongs(songsWithAlbumInfo);
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível carregar as músicas do álbum",
                variant: "destructive",
            });
        }
    };



    // CONFIGURAÇÕES PARA O MODO CLÁSSICO
    const [classicSettings, setClassicSettings] = useState({
        eggs_per_correct: 10,
        speed_bonus: 5,
        time_per_question: 15,
        song_duration: 10
    });

    // CONFIGURAÇÕES PARA O MODO BATALHA
    const [battleSettings, setBattleSettings] = useState({
        eggsPerRound: 10,
        totalRounds: 10,
        initialEggs: 100,
        time_per_question: 15,
        song_duration: 10
    });

    // CONFIGURAÇÕES GERAIS (aplicam-se a ambos os modos)
    const [generalSettings, setGeneralSettings] = useState({
        max_players: 10,
        room_timeout: 300, // tempo limite da sala em segundos
        auto_next_round: true // avançar rodada automaticamente
    });


    // Estados para filtros
    const [filters, setFilters] = useState({
        artist: '',
        song: '',
        year: ''
    });

    const [searchResults, setSearchResults] = useState<Song[]>([]);
    const [isSearching, setIsSearching] = useState(false);



    // Estado para músicas filtradas
    const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
    const [allSongs, setAllSongs] = useState<Song[]>([]);


    // Função para buscar músicas com informações de múltiplos álbuns
    const searchSongsWithAlbums = useCallback(async () => {
        if (!filters.artist && !filters.song && !filters.year) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            let query = supabase
                .from('songs')
                .select(`
        *,
        album_songs (
          album_id,
          albums (
            name,
            artist_name,
            release_year,
            cover_image_url
          )
        )
      `);

            if (filters.artist) {
                query = query.ilike('artist', `%${filters.artist}%`);
            }

            if (filters.song) {
                query = query.ilike('title', `%${filters.song}%`);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            let filtered = data || [];

            // Filtro por ano (considerando álbuns)
            if (filters.year) {
                filtered = filtered.filter(song =>
                    song.album_songs?.some((as: any) =>
                    as.albums?.release_year?.toString().includes(filters.year)
            )
            );
            }

            // Transformar dados para incluir informação dos álbuns
            const songsWithAlbumInfo = filtered.map(song => ({
                ...song,
                albums_info: song.album_songs?.map((as: any) => ({
                ...as.albums,
                album_id: as.album_id  // <-- Adicione esta linha
            })) || [],

                album_songs: song.album_songs

        }));

            setSearchResults(songsWithAlbumInfo);
        } catch (error) {
            toast({
                title: "Erro",
                description: "Erro ao buscar músicas",
                variant: "destructive",
            });
        } finally {
            setIsSearching(false);
        }
    }, [filters]);

    // 3. Adicione esta função para alternar visibilidade
    const toggleAlbumVisibility = async (albumId: string, currentIsHidden: boolean) => {
        try {
            const { error } = await supabase
                .from('albums')
                .update({ is_hidden: !currentIsHidden })
                .eq('id', albumId);

            if (error) throw error;

            toast({
                title: currentIsHidden ? "Álbum exibido" : "Álbum oculto",
                description: currentIsHidden
                    ? "O álbum agora aparecerá na seleção de jogos"
                    : "O álbum não aparecerá mais na seleção de jogos",
            });

            await loadAlbums();
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível alterar a visibilidade do álbum",
                variant: "destructive",
            });
        }
    };

    // const searchSongs = useCallback(async() => {
    //     // Se não há filtros, limpa os resultados
    //     if (!filters.artist && !filters.song && !filters.year) {
    //         setSearchResults([]);
    //         return;
    //     }
    //
    //     setIsSearching(true);
    //     try {
    //         let query = supabase
    //             .from('songs')
    //             .select(`
    //     *,
    //     albums (
    //       name,
    //       artist_name,
    //       release_year,
    //       cover_image_url
    //     )
    //   `);
    //
    //         // Filtro por artista da música
    //         if (filters.artist) {
    //             query = query.ilike('artist', `%${filters.artist}%`);
    //         }
    //
    //         // Filtro por nome da música
    //         if (filters.song) {
    //             query = query.ilike('title', `%${filters.song}%`);
    //         }
    //
    //         const {data, error} = await query.order('created_at', {ascending: false});
    //
    //         if (error) throw error;
    //
    //         let filtered = data || [];
    //
    //         // Filtro por ano (do álbum) - feito após a query
    //         if (filters.year) {
    //             filtered = filtered.filter(song =>
    //                 song.albums ?.release_year ?.toString().includes(filters.year)
    //         )
    //         }
    //
    //         setSearchResults(filtered as Song[]);
    //     } catch (error) {
    //         toast({
    //             title: "Erro",
    //             description: "Erro ao buscar músicas",
    //             variant: "destructive",
    //         });
    //     } finally {
    //         setIsSearching(false);
    //     }
    // }, [filters]);


    // 1. PRIMEIRO: Adicione esta função no seu componente AdminDashboard, junto com as outras funções:

    const handleUpdateSongModal = async () => {
        if (!editingSong) {
            toast({
                title: "Erro",
                description: "Nenhuma música selecionada para edição",
                variant: "destructive",
            });
            return;
        }

        try {
            console.log('Atualizando música:', editingSong.id, editingSong.title);

            const { error } = await supabase
                .from('songs')
                .update({
                    title: editingSong.title,
                    artist: editingSong.artist,
                    duration_seconds: editingSong.duration_seconds || 10,
                    difficulty_level: editingSong.difficulty_level || 1,
                    // Mantém os campos de URL se existirem
                    spotify_url: editingSong.spotify_url || null,
                    youtube_url: editingSong.youtube_url || null,
                    audio_file_url: editingSong.audio_file_url || null,
                })
                .eq('id', editingSong.id);

            if (error) {
                console.error('Erro no banco:', error);
                throw error;
            }

            console.log('Música atualizada com sucesso');

            toast({
                title: "Música atualizada!",
                description: `${editingSong.title} foi atualizada com sucesso`,
            });

            // Fechar modal
            setIsEditSongModalOpen(false);
            setEditingSong(null);

            // Recarregar dados
            if (selectedAlbum) {
                await loadAlbumSongsWithRelationships(selectedAlbum.id);
            }
            await loadTotalSongsCount();
            await loadAlbumSongsWithRelationships();

        } catch (error) {
            console.error('Erro ao atualizar música:', error);
            toast({
                title: "Erro",
                description: "Não foi possível atualizar a música",
                variant: "destructive",
            });
        }
    };

    const loadAllSongs = async() => {
        try {
            const {data, error} = await supabase
                .from('songs')
                .select(`
        *,
        albums (
          name,
          artist_name,
          release_year,
          cover_image_url
        ),
        genres (
          name,
          emoji
        )
      `)
                .order('created_at', {ascending: false});

            if (error) throw error;
            setAllSongs(data as Song[] || []);
            setFilteredSongs(data as Song[] || []);
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível carregar as músicas",
                variant: "destructive",
            });
        }
    };

    // Função para filtrar álbuns (versão completa com proteção)
    const filterAlbums = useCallback(async() => {
        let filtered = [...albums];

        // Filtrar álbuns ocultos se a opção não estiver ativada
        if (!showHiddenAlbums) {
            filtered = filtered.filter(album => !album.is_hidden);
        }

        // Filtro por artista (com proteção contra null)
        if (filters.artist) {
            filtered = filtered.filter(album =>
                album.artist_name && album.artist_name.toLowerCase().includes(filters.artist.toLowerCase())
            );
        }

        // Filtro por ano
        if (filters.year) {
            filtered = filtered.filter(album =>
                album.release_year ?.toString().includes(filters.year)
        )

        }

        // Filtro por música (busca nas músicas dos álbuns)
        if (filters.song) {
            try {
                const {data: songsWithAlbums, error} = await supabase
                    .from('songs')
                    .select('album_id')
                    .ilike('title', `%${filters.song}%`);

                if (!error && songsWithAlbums) {
                    const albumIdsWithSong = songsWithAlbums.map(song => song.album_id);
                    filtered = filtered.filter(album => albumIdsWithSong.includes(album.id));
                }
            } catch (error) {
            }
        }

        setFilteredAlbums(filtered);
    }, [albums, filters]);

    // useEffect para aplicar filtros (versão assíncrona)
    useEffect(() => {
        filterAlbums();
    }, [albums, filters, showHiddenAlbums]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchSongsWithAlbums();
        }, 500); // Debounce de 500ms

        return () => clearTimeout(timeoutId);
    }, [searchSongsWithAlbums]);

// Estado para álbuns filtrados
    const [filteredAlbums, setFilteredAlbums] = useState<Album[]>([]);

    // Estados para upload de áudio
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
    const [isEditGenreModalOpen, setIsEditGenreModalOpen] = useState(false);

    // Adicione estes estados logo após os outros useState no início do componente
    const [currentView, setCurrentView] = useState<'albums' | 'album-detail'>('albums');
    const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
    const [albumSongs, setAlbumSongs] = useState<Song[]>([]);
    const [isEditSongModalOpen, setIsEditSongModalOpen] = useState(false);


    // States for different sections
    const [songs, setSongs] = useState<Song[]>([]);
    const [genres, setGenres] = useState<Genre[]>([]);

    const [newSong, setNewSong] = useState({
        title: '',
        artist: '',
        genre_id: '',
        album_id: '',
        album_name: '',
        release_year: '',
        duration_seconds: '10',
        spotify_url: '',
        youtube_url: '',
        audio_file_url: '',
        difficulty_level: '1'
    });

    // Editing state
    const [editingSong, setEditingSong] = useState<Song | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [newGenre, setNewGenre] = useState({
        name: '',
        description: '',
        chicken_description: '',
        emoji: ''
    });

    const [stats, setStats] = useState({
        totalPlayers: 1234,
        totalSongs: 0,
        totalEggs: 98765,
        activeRooms: 23
    });

    // NOVA FUNCIONALIDADE: Carregar configurações de modalidade
    const loadGameMode = async() => {
        try {
            const {data, error} = await supabase
                .from("game_settings")
                .select("*")
                .eq("key", "game_mode")
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data?.value) {
                let mode: "mp3" | "spotify" = "mp3"; // valor padrão

                // Tentar diferentes formatos de dados
                if (typeof data.value === 'string') {
                    // Se for string, verificar se é JSON ou valor direto
                    const cleanValue = data.value.replace(/['"]/g, '').toLowerCase().trim();

                    if (cleanValue === 'spotify' || cleanValue === 'mp3') {
                        mode = cleanValue as "mp3" | "spotify";
                    } else {
                        // Tentar como JSON se não for valor direto
                        try {
                            const parsed = JSON.parse(data.value);
                            mode = (parsed === 'spotify') ? 'spotify' : 'mp3';
                        } catch {
                            // Se falhou JSON parse, usar valor padrão
                            console.warn(`Valor game_mode inválido: "${data.value}", usando padrão "mp3"`);
                        mode = "mp3";
                    }
                    }
                } else if (data.value === 'spotify' || data.value === 'mp3') {
                    // Se já for o valor direto (não string)
                    mode = data.value;
                }

                setGameMode(mode);
                console.log(`Game mode carregado: ${mode}`);
            } else {
                // Se não há valor, usar padrão
                setGameMode("mp3");
                console.log("Nenhum game_mode encontrado, usando padrão: mp3");
            }
        } catch (error) {
            console.error("Error loading game mode:", error);
            setGameMode("mp3");
        }
    };

    // Carregar configurações do modo batalha
    const loadBattleSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('game_settings')
                .select('key, value')
                .in('key', [
                    'battle_mode',
                    'battle_eggs_per_round',
                    'battle_total_rounds',
                    'battle_time_per_question',
                    'battle_song_duration'
                ]);

            if (!error && data) {
                const newSettings = { ...battleSettings };

                data.forEach((setting: any) => {
                    switch (setting.key) {
                        case 'battle_mode':
                            setBattleMode(setting.value?.replace(/"/g, '') === 'battle' ? 'battle' : 'classic');
                            break;
                        case 'battle_eggs_per_round':
                            newSettings.eggsPerRound = parseInt(setting.value) || 10;
                            break;
                        case 'battle_total_rounds':
                            newSettings.totalRounds = parseInt(setting.value) || 10;
                            break;
                        case 'battle_time_per_question':
                            newSettings.time_per_question = parseInt(setting.value) || 15;
                            break;
                        case 'battle_song_duration':
                            newSettings.song_duration = parseInt(setting.value) || 10;
                            break;
                    }
                });

                newSettings.initialEggs = newSettings.eggsPerRound * newSettings.totalRounds;
                setBattleSettings(newSettings);
            }
        } catch (error) {
            console.error('Erro ao carregar configurações de batalha:', error);
        }
    };

    // Carregar configurações gerais
    const loadGeneralSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('game_settings')
                .select('key, value')
                .in('key', ['max_players', 'room_timeout', 'auto_next_round']);

            if (error) throw error;

            const settings: any = {};
            data?.forEach(setting => {
                if (setting.key === 'auto_next_round') {
                    settings[setting.key] = setting.value === 'true';
                } else {
                    settings[setting.key] = parseInt(setting.value as string) || 0;
                }
            });

            setGeneralSettings(prev => ({ ...prev, ...settings }));
        } catch (error) {
            console.error('Erro ao carregar configurações gerais:', error);
        }
    };


    // Salvar configurações clássicas
    const saveClassicSettings = async () => {
        try {
            const updates = [
                { key: 'classic_eggs_per_correct', value: classicSettings.eggs_per_correct.toString() },
                { key: 'classic_speed_bonus', value: classicSettings.speed_bonus.toString() },
                { key: 'classic_time_per_question', value: classicSettings.time_per_question.toString() },
                { key: 'classic_song_duration', value: classicSettings.song_duration.toString() }
            ];

            for (const update of updates) {
                const { error } = await supabase
                    .from('game_settings')
                    .upsert(update);

                if (error) throw error;
            }

            toast({
                title: "Configurações Clássicas Salvas!",
                description: "As configurações do modo clássico foram atualizadas",
            });
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível salvar as configurações clássicas",
                variant: "destructive"
            });
        }
    };

// Atualizar modo batalha
    const updateBattleMode = async (mode: 'classic' | 'battle') => {
        setIsLoadingBattleSettings(true);
        try {
            const { error } = await supabase
                .from('game_settings')
                .upsert({
                    key: 'battle_mode',
                    value: JSON.stringify(mode)
                });

            if (error) throw error;

            setBattleMode(mode);
            toast({
                title: mode === 'battle' ? "⚔️ Modo Batalha Ativado!" : "🎵 Modo Clássico Ativado!",
                description: mode === 'battle'
                    ? "Jogadores agora competirão pelos ovos uns dos outros"
                    : "Jogadores acumularão pontos por acertos",
            });
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível alterar o modo de jogo",
                variant: "destructive",
            });
        } finally {
            setIsLoadingBattleSettings(false);
        }
    };

// Salvar configurações de batalha
    // Salvar configurações de batalha (atualizar a existente)
    const saveBattleSettings = async () => {
        try {
            const updates = [
                { key: 'battle_eggs_per_round', value: battleSettings.eggsPerRound.toString() },
                { key: 'battle_total_rounds', value: battleSettings.totalRounds.toString() },
                { key: 'battle_time_per_question', value: battleSettings.time_per_question.toString() },
                { key: 'battle_song_duration', value: battleSettings.song_duration.toString() }
            ];

            for (const update of updates) {
                const { error } = await supabase
                    .from('game_settings')
                    .upsert(update);

                if (error) throw error;
            }

            toast({
                title: "Configurações de Batalha Salvas!",
                description: `${battleSettings.eggsPerRound} ovos por rodada, ${battleSettings.totalRounds} rodadas totais`,
            });
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível salvar as configurações de batalha",
                variant: "destructive"
            });
        }
    };

    // Salvar configurações gerais
    const saveGeneralSettings = async () => {
        try {
            const updates = [
                { key: 'max_players', value: generalSettings.max_players.toString() },
                { key: 'room_timeout', value: generalSettings.room_timeout.toString() },
                { key: 'auto_next_round', value: generalSettings.auto_next_round.toString() }
            ];

            for (const update of updates) {
                const { error } = await supabase
                    .from('game_settings')
                    .upsert(update);

                if (error) throw error;
            }

            toast({
                title: "Configurações Gerais Salvas!",
                description: "As configurações gerais foram atualizadas",
            });
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível salvar as configurações gerais",
                variant: "destructive"
            });
        }
    };

// NOVA FUNCIONALIDADE: Atualizar modalidade do jogo
    const updateGameMode = async (mode: "mp3" | "spotify") => {
        setIsLoadingSettings(true);
        try {
            const { error } = await supabase
                .from("game_settings")
                .upsert({
                    key: "game_mode",
                    value: JSON.stringify(mode)
                });

            if (error) throw error;

            setGameMode(mode);
            toast({
                title: "Modalidade atualizada",
                description: `Modalidade alterada para ${mode.toUpperCase()}`,
            });
        } catch (error) {
            console.error("Error updating game mode:", error);
            toast({
                title: "Erro ao atualizar modalidade",
                description: "Não foi possível alterar a modalidade",
                variant: "destructive",
            });
        } finally {
            setIsLoadingSettings(false);
        }
    };


    // E atualize quando carregar as músicas:
    const loadTotalSongsCount = async() => {
        try {
            const {count, error} = await supabase
                .from('songs')
                .select('*', {count: 'exact', head: true});

            if (error) throw error;

            setStats(prev => ({
                ...prev,
                totalSongs: count || 0
            }));
        } catch (error) {
        }
    };
    // Load data from Supabase
    useEffect(() => {
        const loadInitialData = async () => {
            await loadGenres();
            await loadSongs();
            await loadGameMode();

            // ADICIONAR: Carregar o battleMode atual
            const currentBattleMode = await getBattleMode();
            setBattleMode(currentBattleMode);

            await loadClassicSettings();
            await loadBattleSettings();
            await loadGeneralSettings();
            await loadAlbums();
            await loadTotalSongsCount();
            await loadAllUsers();
        };

        loadInitialData();
    }, []);


    const loadAlbums = async() => {
        try {
            // Buscar álbuns com contagem de músicas usando LEFT JOIN
            const {data: albumsData, error: albumsError} = await supabase
                .from('albums')
                .select(`
                *,
                genres (
                    id,
                    name,
                    emoji
                ),
                album_songs (
                    song_id
                )
            `)
                .order('created_at', {ascending: false});

            if (albumsError) throw albumsError;

            // Processar dados para calcular contagem correta
            const albumsWithCount = (albumsData || []).map(album => ({
                ...album,
                songs_count: album.album_songs ? album.album_songs.length : 0,
                is_hidden: album.is_hidden || false,
                // Remove album_songs do objeto final para não poluir o estado
                album_songs: undefined
            }));

            console.log('📊 Álbuns carregados com contagem:', albumsWithCount.map(a => ({
                name: a.name,
                count: a.songs_count
            })));

            setAlbums(albumsWithCount);
        } catch (error) {
            console.error('❌ Erro ao carregar álbuns:', error);
            toast({
                title: "Erro",
                description: "Não foi possível carregar os álbuns",
                variant: "destructive",
            });
        }
    };


    // const loadAlbumSongs = async(albumId: string) => {
    //     try {
    //         const {data, error} = await supabase
    //             .from('songs')
    //             .select('*')
    //             .eq('album_id', albumId)
    //             .order('created_at', {ascending: false});
    //
    //         if (error) throw error;
    //         setAlbumSongs(data || []);
    //     } catch (error) {
    //         toast({
    //             title: "Erro",
    //             description: "Não foi possível carregar as músicas do álbum",
    //             variant: "destructive",
    //         });
    //     }
    // };

    // Funções de navegação
    const openAlbum = async(album: Album) => {
        setSelectedAlbum(album);
        setCurrentView('album-detail');
        await loadAlbumSongsWithRelationships(album.id);
    };

    const backToAlbums = () => {
        setCurrentView('albums');
        setSelectedAlbum(null);
        setAlbumSongs([]);
    };

    const handleCoverUpload = async(file: File) => {
        setIsUploadingCover(true);
        try {
            const timestamp = Date.now();
            const slug = newAlbum.name.toLowerCase().replace(/[^a-z0-9]/gi, '-');
            const ext = file.name.split('.').pop();
            const fileName = `${slug}-${timestamp}.${ext}`; // <-- aqui
            const {error} = await supabase.storage
                .from('album-covers') // nome do bucket
                .upload(fileName, file, {cacheControl: '3600', upsert: true});
            if (error) throw error;
            const {data: {publicUrl}} = supabase.storage
                .from('album-covers')
                .getPublicUrl(fileName);
            setNewAlbum(prev => ({...prev, cover_image_url: publicUrl}));
            toast({title: "✅ Capa carregada!"});
        } catch (error) {
            toast({
                title: "❌ Erro",
                description: "Falha ao fazer upload da capa",
                variant: "destructive",
            });
        } finally {
            setIsUploadingCover(false);
        }
    };


    const handleAddAlbum = async() => {
        if (!newAlbum.name || !newAlbum.artist_name || !newAlbum.genre_id) {
            toast({
                title: "Campos obrigatórios",
                description: "Preencha nome, artista e gênero do álbum",
                variant: "destructive",
            });
            return;
        }

        try {
            const albumData = {
                name: newAlbum.name,
                artist_name: newAlbum.artist_name, // <- NOVA LINHA
                release_year: newAlbum.release_year ? parseInt(newAlbum.release_year) : null,
                description: newAlbum.description,
                cover_image_url: newAlbum.cover_image_url || null,
                genre_id: newAlbum.genre_id,
            };

            const {error} = await supabase
                .from('albums')
                .insert([albumData]);

            if (error) throw error;

            toast({title: "Álbum criado com sucesso!"});
            setNewAlbum({
                name: '',
                artist_name: '', // <- NOVA LINHA
                release_year: '',
                description: '',
                cover_file: null,
                cover_image_url: '',
                genre_id: ''
            });
            await loadAlbums();
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível salvar o álbum",
                variant: "destructive",
            });
        }
    };

    const [allUsers, setAllUsers] = useState<any[]>([]);

    const openEditAlbumModal = (album: Album) => {
        setEditingAlbum(album);
        setIsEditAlbumModalOpen(true);
    };

    // Adicione estas funções
    const loadAllUsers = async() => {
        try {
            const {data, error} = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', {ascending: false});

            if (error) throw error;
            setAllUsers(data || []);
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível carregar usuários",
                variant: "destructive",
            });
        }
    };

    const toggleAdminPermission = async(userId: string, currentIsAdmin: boolean) => {


        try {
            const {data, error} = await supabase
                .from('profiles')
                .update({is_admin: !currentIsAdmin})
                .eq('user_id', userId)
                .select(); // Importante: adicionar .select() para ver o resultado


            if (error) {

                throw error;
            }

            // Verificar se realmente atualizou
            const {data: checkData, error: checkError} = await supabase
                .from('profiles')
                .select('user_id, is_admin')
                .eq('user_id', userId)
                .single();


            toast({
                title: "Permissões atualizadas",
                description: `Usuário ${!currentIsAdmin ? 'promovido a' : 'removido de'} administrador`,
            });

            await loadAllUsers();
        } catch (error) {

            toast({
                title: "Erro",
                description: `Erro ao atualizar permissões: ${error.message}`,
                variant: "destructive",
            });
        }
    };

    const handleUpdateAlbum = async() => {
        if (!editingAlbum) return;
        console.log('💾 Salvando álbum com capa:', editingAlbum.cover_image_url);

        if (!editingAlbum.name || !editingAlbum.genre_id) {
            toast({
                title: "❌ Campos obrigatórios",
                description: "Preencha nome e gênero do álbum",
                variant: "destructive",
            });
            return;
        }

        try {
            const updateData = {
                name: editingAlbum.name,
                artist_name: editingAlbum.artist_name, // 👈 ADICIONADO
                release_year: editingAlbum.release_year,
                description: editingAlbum.description,
                cover_image_url: editingAlbum.cover_image_url,
                genre_id: editingAlbum.genre_id,
            };

            console.log('💾 Dados para atualizar:', updateData);

            const {error} = await supabase
                .from('albums')
                .update(updateData)
                .eq('id', editingAlbum.id);

            if (error) {
                console.error('❌ Erro no banco:', error);
                throw error;
            }

            console.log('✅ Álbum salvo no banco com sucesso');
            toast({title: "✅ Álbum atualizado!"});
            setIsEditAlbumModalOpen(false);
            setEditingAlbum(null);
            await loadAlbums();
        } catch (error) {
            console.error('💥 Erro completo:', error);
            toast({
                title: "❌ Erro",
                description: "Não foi possível atualizar o álbum",
                variant: "destructive",
            });
        }
    };

    const [isFiltering, setIsFiltering] = useState(false);


    const handleDeleteAlbum = async(albumId: string) => {
        try {
            const {error} = await supabase
                .from('albums')
                .delete()
                .eq('id', albumId);
            if (error) throw error;
            toast({title: "🗑️ Álbum removido"});
            await loadAlbums();
        } catch {
            toast
        ({
            title: "❌ Erro",
            description: "Não foi possível remover o álbum",
            variant: "destructive",
        });
    }
    };

    useEffect(() => {
        loadAlbums();
    }, []);

    const loadGenres = async() => {
        try {

            const {data, error} = await supabase
                .from('genres')
                .select('*')
                .order('name');

            if (error) {

                throw error;
            }


            setGenres(data || []);
        } catch (error) {

            toast({
                title: "❌ Erro",
                description: "Não foi possível carregar os gêneros",
                variant: "destructive",
            });
        }
    };

    const loadSongs = async() => {
        try {

            const {data, error} = await supabase
                .from('songs')
                .select(`
          *,
          genres (
            id,
            name,
            emoji
          )
        `)
                .order('created_at', {ascending: false});

            if (error) {

                throw error;
            }


            // Transformar dados para o formato esperado
            const songsFormatted = (data || []).map(song => ({
                ...song,
                genre: song.genres ?.name || 'Sem gênero',
                source
        :
            'manual' as
            const ,
            url: song.spotify_url || song.youtube_url || song.audio_file_url
        }))
            ;

            setSongs(songsFormatted);
        } catch (error) {

            toast({
                title: "❌ Erro",
                description: "Não foi possível carregar as músicas",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // Substitua o useEffect de autenticação por:
    useEffect(() => {
        const checkAdminAccess = async() => {
            try {
                // Verificar se há usuário logado no Supabase Auth
                const {data: {user}, error} = await supabase.auth.getUser();

                if (error || !user) {
                    navigate('/login'); // ou sua rota de login
                    return;
                }

                // Verificar se o usuário tem permissão de admin
                const {data: profile, error: profileError} = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (profileError || !profile) {
                    toast({
                        title: "Erro",
                        description: "Perfil não encontrado",
                        variant: "destructive",
                    });
                    navigate('/');
                    return;
                }

                if (!profile.is_admin) {
                    toast({
                        title: "Acesso Negado",
                        description: "Você não tem permissões de administrador",
                        variant: "destructive",
                    });
                    navigate('/');
                    return;
                }

                // Se chegou até aqui, é admin
                setCurrentUser(profile);
                setIsAuthenticated(true);

            } catch (error) {
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

        checkAdminAccess();
    }, [navigate]);

    // Carregar modo de batalha atual
    const getBattleMode = async (): Promise<'classic' | 'battle'> => {
        const { data, error } = await supabase
            .from('game_settings')
            .select('value')
            .eq('key', 'battle_mode')
            .maybeSingle();

        if (error) return 'classic';

        const raw = data?.value;
        const normalized = typeof raw === 'string' ? raw.replace(/"/g, '') : 'classic';
        return normalized === 'battle' ? 'battle' : 'classic';
    };

    // Carregar configurações do modo clássico
    const loadClassicSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('game_settings')
                .select('key, value')
                .in('key', [
                    'classic_eggs_per_correct',
                    'classic_speed_bonus',
                    'classic_time_per_question',
                    'classic_song_duration'
                ]);

            if (error) throw error;

            const settings: any = {};
            data?.forEach(setting => {
                const key = setting.key.replace('classic_', '');
                settings[key] = parseInt(setting.value as string) || 0;
            });

            setClassicSettings(prev => ({ ...prev, ...settings }));
        } catch (error) {
            console.error('Erro ao carregar configurações clássicas:', error);
        }
    };


    const handleLogout = async() => {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setIsAuthenticated(false);
        toast({
            title: "Até logo!",
            description: "Você foi desconectado do painel administrativo",
        });
        navigate('/');
    };

    // Upload de áudio para Storage
    const handleAudioUpload = async(file: File) => {
        if (!newSong.title || !selectedAlbum) {
            toast({
                title: "Preenchimento necessário",
                description: "Preencha o título antes de fazer upload do áudio",
                variant: "destructive",
            });
            return null;
        }

        setIsUploading(true);
        try {
            const timestamp = Date.now();
            const slug = newSong.title.toLowerCase().replace(/[^a-z0-9]/gi, '-');
            const fileName = `${selectedAlbum.id}/${slug}-${timestamp}.mp3`;

            const {error} = await supabase.storage
                .from('songs')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const {data: {publicUrl}} = supabase.storage
                .from('songs')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            toast({
                title: "Erro no Upload",
                description: "Não foi possível fazer upload do arquivo de áudio",
                variant: "destructive",
            });
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    // Testar áudio
    const testAudio = (url: string) => {
        const audio = new Audio(url);
        audio.currentTime = 0;
        audio.volume = 0.5;

        audio.play().then(() => {
            setTimeout(() => audio.pause(), 3000); // Tocar 3 segundos
            toast({
                title: "🎵 Testando áudio",
                description: "Reproduzindo 3 segundos do arquivo",
            });
        }).catch(error => {
            toast({
                title: "❌ Erro",
                description: "Não foi possível reproduzir o áudio",
                variant: "destructive",
            });
        });
    };

    // Atualize a função handleAddSong para usar a nova estrutura
    const handleAddSongWithRelationship = async () => {
        if (!newSong.title || !newSong.artist || !selectedAlbum) {
            toast({
                title: "Campos obrigatórios",
                description: "Preencha título e artista da música",
                variant: "destructive",
            });
            return;
        }

        try {
            let audioFileUrl = null;
            if (audioFile) {
                audioFileUrl = await handleAudioUpload(audioFile);
                if (!audioFileUrl) return;
            }

            // Primeiro, criar a música
            const songData = {
                title: newSong.title,
                artist: newSong.artist,
                genre_id: selectedAlbum.genre_id,
                duration_seconds: parseInt(newSong.duration_seconds) || 10,
                spotify_url: newSong.spotify_url || null,
                youtube_url: newSong.youtube_url || null,
                audio_file_url: audioFileUrl || newSong.audio_file_url || null,
                difficulty_level: parseInt(newSong.difficulty_level) || 1,
                is_active: true
            };

            const { data: insertedSong, error: songError } = await supabase
                .from('songs')
                .insert([songData])
                .select()
                .single();

            if (songError) throw songError;

            // Depois, criar o relacionamento com o álbum
            const { error: relationshipError } = await supabase
                .from('album_songs')
                .insert([{
                    album_id: selectedAlbum.id,
                    song_id: insertedSong.id,
                    track_order: albumSongs.length + 1
                }]);

            if (relationshipError) throw relationshipError;

            toast({
                title: "Música adicionada!",
                description: `${newSong.title} foi adicionada ao álbum`,
            });

            // Limpar formulário
            setNewSong({
                title: '',
                artist: '',
                genre_id: '',
                album_id: '',
                album_name: '',
                release_year: '',
                duration_seconds: '10',
                spotify_url: '',
                youtube_url: '',
                audio_file_url: '',
                difficulty_level: '1'
            });

            setAudioFile(null);
            await loadAlbumSongsWithRelationships(selectedAlbum.id);
            await loadTotalSongsCount();
            await loadAlbums();
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível salvar a música",
                variant: "destructive",
            });
        }
    };

    // Handle song editing
    const handleEditSong = (song: Song) => {
        setEditingSong(song);
        setIsEditModalOpen(true);
    };

    const handleUpdateSong = async() => {
        if (!editingSong) return;

        try {

            const {error} = await supabase
                .from('songs')
                .update({
                    title: editingSong.title,
                    artist: editingSong.artist,
                    genre_id: editingSong.genre_id,
                    album_name: editingSong.album_name || null,
                    album_id: editingSong.album_id || null,
                    release_year: editingSong.release_year || null,
                    duration_seconds: editingSong.duration_seconds || 10,
                    spotify_url: editingSong.spotify_url || null,
                    youtube_url: editingSong.youtube_url || null,
                    audio_file_url: editingSong.audio_file_url || null,
                    difficulty_level: editingSong.difficulty_level || 1,
                })
                .eq('id', editingSong.id);

            if (error) {
                throw error;
            }


            // Recarregar lista de músicas
            await loadSongs();

            // Fechar modal
            setIsEditModalOpen(false);
            setEditingSong(null);

            toast({
                title: "✅ Música Atualizada!",
                description: `${editingSong.title} foi atualizada com sucesso`,
            });
        } catch (error) {
            toast({
                title: "❌ Erro",
                description: "Não foi possível atualizar a música",
                variant: "destructive",
            });
        }
    };

    const handleDeleteSong = async(songId: string) => {
        try {
            const {error} = await supabase
                .from('songs')
                .delete()
                .eq('id', songId);

            if (error) throw error;

            toast({title: "Música removida"});
            if (selectedAlbum) {
                await loadAlbumSongsWithRelationships(selectedAlbum.id); // <- RECARREGA MÚSICAS DO ÁLBUM ATUAL
            }
            await loadTotalSongsCount();
            await loadAlbums();
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível remover a música",
                variant: "destructive",
            });
        }
    };

    const handleAddGenre = async() => {
        if (!newGenre.name || !newGenre.chicken_description || !newGenre.emoji) {
            toast({
                title: "❌ Campos obrigatórios",
                description: "Preencha todos os campos do gênero",
                variant: "destructive",
            });
            return;
        }

        try {

            const {data, error} = await supabase
                .from('genres')
                .insert([newGenre])
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Recarregar lista de gêneros
            await loadGenres();

            // Limpar formulário
            setNewGenre({name: '', description: '', chicken_description: '', emoji: ''});

            toast({
                title: "🎼 Gênero Adicionado!",
                description: `${newGenre.name} foi adicionado ao banco de dados`,
            });
        } catch (error) {
            toast({
                title: "❌ Erro",
                description: "Não foi possível salvar o gênero no banco de dados",
                variant: "destructive",
            });
        }
    };

    const openEditGenreModal = (genre: Genre) => {
        setEditingGenre(genre);
        setIsEditGenreModalOpen(true);
    };

    const handleUpdateGenre = async() => {
        if (!editingGenre) return;

        try {
            const {error} = await supabase
                .from("genres")
                .update({
                    name: editingGenre.name,
                    description: editingGenre.description,
                    chicken_description: editingGenre.chicken_description,
                    emoji: editingGenre.emoji,
                })
                .eq("id", editingGenre.id);

            if (error) throw error;

            toast({title: "✅ Gênero atualizado!"});
            setIsEditGenreModalOpen(false);
            setEditingGenre(null);
            await loadGenres();
        } catch {
            toast
        ({
            title: "❌ Erro",
            description: "Não foi possível atualizar o gênero",
            variant: "destructive",
        });
    }
    };

    const handleDeleteGenre = async(genreId: string) => {
        try {
            const {error} = await supabase.from("genres").delete().eq("id", genreId);
            if (error) throw error;

            toast({title: "🗑️ Gênero removido"});
            await loadGenres();
        } catch {
            toast
        ({
            title: "❌ Erro",
            description: "Não foi possível remover o gênero",
            variant: "destructive",
        });
    }
    };


    if (!isAuthenticated || loading) {
        return (
            <div className="min-h-screen bg-gradient-sky flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-chicken-walk">🐔</div>
                    <p className="text-xl text-muted-foreground">Carregando galinheiro...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-sky p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-transparent bg-gradient-sunrise bg-clip-text">
                            🚜 Central do Fazendeiro
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            Painel de controle do Galinheiro Musical
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <ChickenButton variant="egg" onClick={() => navigate('/admin/spotify')}>
                            <Music2 className="w-4 h-4 mr-2"/>
                            Gerenciar Spotify
                        </ChickenButton>
                        <ChickenButton variant="egg" onClick={() => navigate('/')}>
                            🏠 Voltar ao Jogo
                        </ChickenButton>
                        <ChickenButton variant="barn" onClick={handleLogout}>
                            <LogOut className="w-4 h-4 mr-2"/>
                            Sair
                        </ChickenButton>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid md:grid-cols-4 gap-4 mb-8">
                    <BarnCard variant="nest" className="text-center">
                        <div className="flex flex-col items-center">
                            <Users className="w-8 h-8 text-primary mb-2"/>
                            <div className="text-2xl font-bold text-primary">{stats.totalPlayers.toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground">Galinhas Ativas</div>
                        </div>
                    </BarnCard>

                    <BarnCard variant="coop" className="text-center">
                        <div className="flex flex-col items-center">
                            <Music className="w-8 h-8 text-barn-brown mb-2"/>
                            <div
                                className="text-2xl font-bold text-barn-brown">{stats.totalSongs.toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground">Músicas no Repertório</div>
                        </div>
                    </BarnCard>

                    <BarnCard variant="golden" className="text-center">
                        <div className="flex flex-col items-center">
                            <Egg className="w-8 h-8 text-white mb-2"/>
                            <div className="text-2xl font-bold text-white">{stats.totalEggs.toLocaleString()}</div>
                            <div className="text-sm text-white/80">Ovos Distribuídos</div>
                        </div>
                    </BarnCard>

                    <BarnCard variant="default" className="text-center">
                        <div className="flex flex-col items-center">
                            <Settings className="w-8 h-8 text-accent mb-2"/>
                            <div className="text-2xl font-bold text-accent">{stats.activeRooms}</div>
                            <div className="text-sm text-muted-foreground">Galinheiros Ativos</div>
                        </div>
                    </BarnCard>
                </div>

                <BarnCard variant="default" className="mb-8">
                    <div className="p-6">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Disc3 className="w-5 h-5" />
                            Modalidade do Jogo
                        </h3>

                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label className="text-base font-medium">
                                    Modalidade Atual: {gameMode === "mp3" ? "MP3 (Sistema Atual)" : "Spotify (Álbuns)"}
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    {gameMode === "mp3"
                                        ? "Usando catálogo interno de músicas MP3"
                                        : "Usando álbuns do Spotify cadastrados"
                                    }
                                </p>
                            </div>

                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="mode-mp3" className={gameMode === "mp3" ? "font-semibold" : ""}>
                                        MP3
                                    </Label>
                                    <Switch
                                        id="game-mode"
                                        checked={gameMode === "spotify"}
                                        onCheckedChange={(checked) => updateGameMode(checked ? "spotify" : "mp3")}
                                        disabled={isLoadingSettings}
                                    />
                                    <Label htmlFor="mode-spotify" className={gameMode === "spotify" ? "font-semibold" : ""}>
                                        Spotify
                                    </Label>
                                </div>
                            </div>
                        </div>

                        {gameMode === "spotify" && (
                            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    💡 <strong>Modalidade Spotify ativa:</strong> O jogo usará álbuns do Spotify cadastrados.
                    Use o botão "Gerenciar Spotify" acima para adicionar álbuns.
                                </p>
                            </div>
                        )}
                    </div>
                </BarnCard>

                {/* Main Content Tabs */}
                <Tabs defaultValue="albums" className="space-y-10">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="albums" className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4"/>
                            Álbuns & Músicas
                        </TabsTrigger>
                        <TabsTrigger value="genres" className="flex items-center gap-2">
                            🎼 Gêneros Musicais
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="flex items-center gap-2">
                            <Settings className="w-4 h-4"/>
                            Configurações
                        </TabsTrigger>
                        <TabsTrigger value="users" className="flex items-center gap-2">
                            <Users className="w-4 h-4"/>
                            Usuários & Permissões
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="users">
                        <BarnCard variant="default">
                            <h3 className="text-xl font-bold mb-4">Gerenciar Administradores</h3>

                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {(allUsers || []).map((user) => (
                                    <div key={user.user_id}
                                         className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                        <div className="flex items-center gap-4">
                                        <span className="text-1xl"> <img
                                            src={user.avatar_url}
                                            alt="Capa do Álbum"
                                            className="mt-3 w-14 h-14 object-cover rounded-lg border-2 border-white/30"
                                        /></span>
                                            <div>
                                                <h4 className="font-semibold">{user.display_name}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    {user.total_eggs} ovos | {user.games_played} jogos
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {user.is_admin && (
                                                <Badge variant="secondary">Admin</Badge>
                                            )}
                                            <Button
                                                variant={user.is_admin ? "destructive" : "default"}
                                                size="sm"
                                                onClick={() => toggleAdminPermission(user.user_id, user.is_admin)}
                                                disabled={user.user_id === currentUser?.user_id} // Não pode remover próprias permissões
            >
                                                {user.is_admin ? 'Remover Admin' : 'Tornar Admin'}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </BarnCard>
                    </TabsContent>

                    {/* Albums Management */}
                    <TabsContent value="albums">
                        {currentView === 'albums' && (
                            <div className="space-y-6">

                                {/* Formulário de Novo Álbum */}
                                <BarnCard variant="nest" className="p-4">

                                    <h4 className="text-lg font-semibold text-primary mb-4">Filtrar Músicas</h4>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div>
                                            <Label>Buscar por Artista</Label>
                                            <Input
                                                placeholder="Ex: Chitãozinho"
                                                value={filters.artist}
                                                onChange={(e) => setFilters(prev => ({...prev, artist: e.target.value}))}
                                            />
                                        </div>
                                        <div>
                                            <Label>Buscar por Música</Label>
                                            <Input
                                                placeholder="Ex: Evidências"
                                                value={filters.song}
                                                onChange={(e) => setFilters(prev => ({...prev, song: e.target.value}))}
                                            />
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id="show-hidden"
                                                checked={showHiddenAlbums}
                                                onCheckedChange={setShowHiddenAlbums}
                                            />
                                            <Label htmlFor="show-hidden" className="text-sm">
                                                Mostrar álbuns ocultos
                                            </Label>
                                        </div>
                                        {/*<div>*/}
                                        {/*<Label>Buscar por Ano</Label>*/}
                                        {/*<Input*/}
                                        {/*type="number"*/}
                                        {/*placeholder="Ex: 2024"*/}
                                        {/*value={filters.year}*/}
                                        {/*onChange={(e) => setFilters(prev => ({...prev, year: e.target.value}))}*/}
                                        {/*/>*/}
                                        {/*</div>*/}
                                    </div>
                                    {(filters.artist || filters.song || filters.year) && (
                                        <div className="mt-4">
                                            <ChickenButton
                                                variant="feather"
                                                size="sm"
                                                onClick={() => setFilters({artist: '', song: '', year: ''})}
                                            >
                                                Limpar Filtros
                                            </ChickenButton>
                                        </div>
                                    )}
                                </BarnCard>

                                {/* Formulário de Novo Álbum - só mostra quando não há filtros */}
                                {!filters.artist && !filters.song && !filters.year && (
                                    <BarnCard variant="golden" className="p-6">
                                        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                                            <Plus className="w-6 h-6"/>
                                            Adicionar Novo Álbum
                                        </h3>

                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <div>
                                                    <Label className="text-white/90">Nome do Álbum</Label>
                                                    <Input
                                                        placeholder="Ex: Clássicos Sertanejos"
                                                        value={newAlbum.name}
                                                        onChange={(e) => setNewAlbum(prev => ({...prev, name: e.target.value}))}
                                                        className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-white/90">Artista/Intérprete</Label>
                                                    <Input
                                                        placeholder="Ex: Chitãozinho & Xororó"
                                                        value={newAlbum.artist_name}
                                                        onChange={(e) => setNewAlbum(prev => ({...prev, artist_name: e.target.value}))}
                                                        className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-white/90">Gênero Musical</Label>
                                                    <Select value={newAlbum.genre_id}
                                                            onValueChange={(value) => setNewAlbum(prev => ({...prev, genre_id: value}))}>
                                                        <SelectTrigger
                                                            className="bg-white/20 border-white/30 text-white">
                                                            <SelectValue placeholder="Escolher gênero"/>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {genres.map(genre => (
                                                                <SelectItem key={genre.id} value={genre.id}>
                                                                    {genre.emoji} {genre.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div>
                                                    <Label className="text-white/90">Ano de Lançamento</Label>
                                                    <Input
                                                        type="number"
                                                        placeholder="2024"
                                                        value={newAlbum.release_year}
                                                        onChange={(e) => setNewAlbum(prev => ({...prev, release_year: e.target.value}))}
                                                        className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <Label className="text-white/90">Descrição</Label>
                                                    <Textarea
                                                        placeholder="Descrição do álbum..."
                                                        value={newAlbum.description}
                                                        onChange={(e) => setNewAlbum(prev => ({...prev, description: e.target.value}))}
                                                        className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                                                        rows={4}
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-white/90">Capa do Álbum</Label>
                                                    <Input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('🖼️ Arquivo selecionado para edição:', file);

    try {
      setIsUploadingCover(true);

      const timestamp = Date.now();
      const slug = editingAlbum.name
        .toLowerCase()
        .replace(/[^a-z0-9]/gi, "-");
      const ext = file.name.split(".").pop();
      const fileName = `${slug}-${timestamp}.${ext}`;

      const { data, error } = await supabase.storage
        .from("album-covers")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("album-covers")
        .getPublicUrl(fileName);

      console.log('🔗 Nova URL gerada:', publicUrl);

      // Atualizar estado local
      setEditingAlbum(prev => {
        if (!prev) return null;
        const updated = { ...prev, cover_image_url: publicUrl };
        console.log('🔄 Estado local atualizado:', updated.cover_image_url);
        return updated;
      });

      toast({
        title: "Capa carregada",
        description: "Agora clique em 'Salvar Alterações' para confirmar"
      });

    } catch (err) {
      console.error('💥 Erro no upload:', err);
      toast({
        title: "Erro ao carregar capa",
        description: err.message || "Falha no upload",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCover(false);
    }
  }}
                                                        disabled={isUploadingCover}
                                                    />
                                                    {newAlbum.cover_image_url && (
                                                        <img
                                                            src={newAlbum.cover_image_url}
                                                            alt="Capa do Álbum"
                                                            className="mt-3 w-32 h-32 object-cover rounded-lg border-2 border-white/30"
                                                        />
                                                    )}
                                                </div>

                                                <ChickenButton
                                                    variant="feather"
                                                    onClick={handleAddAlbum}
                                                    disabled={isUploadingCover}
                                                    className="w-full mt-6"
                                                >
                                                    {isUploadingCover ? "Carregando..." : "Criar Álbum"}
                                                </ChickenButton>
                                            </div>
                                        </div>
                                    </BarnCard>
                                )}

                                {/* Seção de resultados da busca - VERSÃO ATUALIZADA */}
                                {(filters.artist || filters.song || filters.year) && (
                                    <BarnCard variant="default" className="p-6">
                                        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <Music className="w-5 h-5"/>
                                            Resultados da Busca
                                            {isSearching &&
                                            <span className="text-sm text-muted-foreground">(buscando...)</span>}
                                        </h4>

                                        {searchResults.length === 0 && !isSearching && (
                                            <p className="text-muted-foreground text-center py-8">
                                                Nenhuma música encontrada com os filtros aplicados
                                            </p>
                                        )}

                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                            {searchResults.map((song, index) => (
                                                <div key={song.id}
                                                     className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">

                                                    {/* Capa do primeiro álbum (se houver) */}
                                                    {song.albums_info && song.albums_info[0]?.cover_image_url && (
                                                    <img
                                                        src={song.albums_info[0].cover_image_url}
                                                        alt={song.albums_info[0].name}
                                                        className="w-16 h-16 object-cover rounded-lg"
                                                    />
                                                    )}

                                                    <div className="flex-1">
                                                        <h5 className="font-semibold text-lg">{song.title}</h5>
                                                        <p className="text-muted-foreground">{song.artist}</p>

                                                        {/* Informações dos álbuns */}
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            {/* Mostrar álbuns */}
                                                            {song.albums_info && song.albums_info.length > 0 ? (
                                                                <>
                                                                {song.albums_info.slice(0, 2).map((albumInfo: any, idx: number) => (
                                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                                        📁 {albumInfo.name}
                                                                        {albumInfo.release_year && ` (${albumInfo.release_year})`}
                                                                    </Badge>
                                                                ))}
                                                                {song.albums_info.length > 2 && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        +{song.albums_info.length - 2} álbuns
                                                                    </Badge>
                                                                )}
                                                                </>
                                                            ) : (
                                                                <Badge variant="outline" className="text-xs">
                                                                    Sem álbum
                                                                </Badge>
                                                            )}

                                                            {/* Duração */}
                                                            <Badge variant="secondary" className="text-xs">
                                                                {song.duration_seconds}s
                                                            </Badge>

                                                            {/* Tipo de arquivo */}
                                                            {song.audio_file_url && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    🎵 MP3
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Player e controles */}
                                                    <div className="flex items-center gap-2">
                                                        {/* Player de áudio - apenas MP3 */}
                                                        {song.audio_file_url ? (
                                                            <div className="min-w-48">
                                                                <AudioPlayer
                                                                    audioUrl={song.audio_file_url}
                                                                    songTitle={song.title}
                                                                    size="md"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="min-w-48 flex items-center justify-center">
                                                                <Badge variant="outline" className="text-xs">
                                                                    Sem arquivo MP3
                                                                </Badge>
                                                            </div>
                                                        )}

                                                        {/* Dropdown de ações */}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="outline" size="icon">
                                                                    <MoreHorizontal className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-56">
                                                                <DropdownMenuItem onClick={() => {
                  setEditingSong(song);
                  setIsEditSongModalOpen(true);
                }}>
                                                                    <Edit className="w-4 h-4 mr-2" />
                                                                    Editar Música
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem onClick={() => openSongAlbumManager(song)}>
                                                                    <Link className="w-4 h-4 mr-2" />
                                                                    Gerenciar Álbuns ({song.albums_info?.length || 0})
                                                                </DropdownMenuItem>

                                                                {/* Só mostra "Mover" se a música estiver em pelo menos um álbum */}
                                                                {song.albums_info && song.albums_info.length > 0 && (
                                                                    <DropdownMenuItem onClick={() => {
  console.log('Tentando mover música da busca:', song);
  console.log('Album songs:', song.album_songs);
  console.log('Albums info:', song.albums_info);

  // Pegar o primeiro album_id disponível
  const firstAlbumId = song.album_songs?.[0]?.album_id ||
                      song.albums_info?.[0]?.album_id;

  console.log('Album ID encontrado:', firstAlbumId);

  if (firstAlbumId) {
    openMoveSongDialog(song, firstAlbumId);
  } else {
    toast({
      title: "Erro",
      description: "Esta música não está vinculada a nenhum álbum ou não foi possível identificar o álbum",
      variant: "destructive",
    });
  }
}}>
                                                                        <ArrowRight className="w-4 h-4 mr-2" />
                                                                        Mover para Outro Álbum
                                                                    </DropdownMenuItem>
                                                                )}

                                                                <DropdownMenuSeparator />

                                                                <DropdownMenuItem
                                                                    onClick={() => handleDeleteSong(song.id)}
                                                                    className="text-destructive"
                                                                >
                                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                                    Remover Música
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </BarnCard>
                                )}

                                {/* Grid de Álbuns - só mostra quando NÃO há filtros */}
                                {!filters.artist && !filters.song && !filters.year && (
                                    <div className="grid md:grid-cols-5 gap-6">
                                        {albums.map(album => (
                                            <Card
                                                key={album.id}
                                                className={`cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105 ${
        album.is_hidden ? 'opacity-60 border-red-200 bg-red-50/30' : ''
    }`}
                                                onClick={() => openAlbum(album)}
                                            >
                                                <CardHeader className="p-4">
                                                    {/* Indicador de álbum oculto */}
                                                    {album.is_hidden && (
                                                        <div className="absolute top-2 right-2 z-10">
                                                            <Badge variant="destructive" className="text-xs">
                                                                <EyeOff className="w-3 h-3 mr-1" />
                                                                Oculto
                                                            </Badge>
                                                        </div>
                                                    )}

                                                    {album.cover_image_url ? (
                                                        <img
                                                            src={album.cover_image_url}
                                                            alt={album.name}
                                                            className="w-full h-40 object-cover rounded-lg mb-3"
                                                        />
                                                    ) : (
                                                        <div
                                                            className="w-full h-40 bg-muted rounded-lg flex items-center justify-center mb-3">
                                                            <Music className="w-12 h-12 text-muted-foreground"/>
                                                        </div>
                                                    )}

                                                    <CardTitle
                                                        className="text-base line-clamp-2">{album.name}</CardTitle>
                                                    <CardDescription className="text-sm">
                                                        {album.artist_name}
                                                        {album.release_year && (
                                                            <span
                                                                className="block text-xs mt-1">({album.release_year})</span>
                                                        )}
                                                    </CardDescription>

                                                    <div className="flex items-center justify-between mt-3">
                                                        <div className="flex flex-col gap-3">
                                                            <Badge variant="secondary" className="text-xs">
                                                                {album.genres ?.emoji} {album.genres ?.name}
                                                            </Badge>

                                                            <Badge variant="outline" className="text-xs">
                                                                {album.songs_count || 0} músicas
                                                            </Badge>

                                                        </div>
                                                        <div className="flex gap-1">
                                                            {/* Botão de visibilidade */}
                                                            <Button
                                                                variant={album.is_hidden ? "destructive" : "outline"}
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={(e) => {
            e.stopPropagation();
            toggleAlbumVisibility(album.id, album.is_hidden || false);
        }}
                                                                title={album.is_hidden ? "Álbum oculto - clique para exibir" : "Álbum visível - clique para ocultar"}
                                                            >
                                                                {album.is_hidden ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                                                            </Button>

                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={(e) => {
          e.stopPropagation();
          setEditingAlbum(album);
          setIsEditAlbumModalOpen(true);
        }}
                                                            >
                                                                <Edit className="w-3 h-3"/>
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={(e) => {
          e.stopPropagation();
          handleDeleteAlbum(album.id);
        }}
                                                            >
                                                                <Trash2 className="w-3 h-3"/>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                            </Card>
                                        ))}
                                    </div>


                                )}

                            </div>
                        )}

                        {/*/!* Contador de Resultados *!/*/}
                        {/*{(filters.artist || filters.song || filters.year) && (*/}
                        {/*<div className="flex items-center justify-between mb-4">*/}
                        {/*<p className="text-muted-foregr   Nenhuma música encbums.length} álbuns encontrados*/}
                        {/*</p>*/}
                        {/*<Badge variant="outline">*/}
                        {/*{filteredAlbums.length} resultados*/}
                        {/*</Badge>*/}
                        {/*</div>*/}
                        {/*)}*/}

                        {currentView === 'album-detail' && selectedAlbum && (
                            <div className="space-y-6">
                                {/* Header do Álbum */}
                                <BarnCard variant="nest" className="p-6">
                                    <div className="flex items-start gap-6">
                                        <Button
                                            variant="outline"
                                            onClick={backToAlbums}
                                            className="flex items-center gap-2"
                                        >
                                            <ArrowLeft className="w-4 h-4"/>
                                            Voltar aos Álbuns
                                        </Button>

                                        {selectedAlbum.cover_image_url && (
                                            <img
                                                src={selectedAlbum.cover_image_url}
                                                alt={selectedAlbum.name}
                                                className="w-32 h-32 object-cover rounded-lg border-2 border-primary/20"
                                            />
                                        )}

                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h2 className="text-3xl font-bold text-primary">{selectedAlbum.name}</h2>
                                                <Badge variant="secondary">
                                                    {selectedAlbum.genres?.emoji} {selectedAlbum.genres?.name}
                                                </Badge>
                                            </div>
                                            <p className="text-xl text-muted-foreground mb-2">{selectedAlbum.artist_name}</p>
                                            {selectedAlbum.release_year && (
                                                <p className="text-muted-foreground mb-3">
                                                    Lançamento: {selectedAlbum.release_year}</p>
                                            )}
                                            {selectedAlbum.description && (
                                                <p className="text-muted-foreground">{selectedAlbum.description}</p>
                                            )}
                                            <div className="mt-4">
                                                <Badge variant="outline">{albumSongs.length} músicas</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </BarnCard>

                                {/* Formulário para Adicionar Música */}
                                {/* Escolha entre upload individual ou em lote */}
                                {/* Formulário para Adicionar Música */}
                                <BarnCard variant="coop" className="p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-bold text-barn-brown flex items-center gap-2">
                                            <Plus className="w-5 h-5"/>
                                            Adicionar Músicas ao Álbum
                                        </h3>
                                        <div className="flex gap-2">
                                            <ChickenButton
                                                variant={!showBulkUpload ? "corn" : "feather"}
                                                size="sm"
                                                onClick={() => setShowBulkUpload(false)}
                                            >
                                                Upload Individual
                                            </ChickenButton>
                                            <ChickenButton
                                                variant={showBulkUpload ? "corn" : "feather"}
                                                size="sm"
                                                onClick={() => setShowBulkUpload(true)}
                                            >
                                                Upload em Lote
                                            </ChickenButton>
                                        </div>
                                    </div>

                                    {/* Upload em Lote */}
                                    {showBulkUpload && (
                                        <BulkUploadComponent
                                            selectedAlbum={selectedAlbum}
                                            onComplete={() => {
        loadAlbumSongsWithRelationships(selectedAlbum.id);
        loadTotalSongsCount();
        loadAlbums();
        setShowBulkUpload(false);
      }}
                                        />
                                    )}

                                    {/* Upload Individual - SEU CÓDIGO ORIGINAL */}
                                    {!showBulkUpload && (
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <div>
                                                    <Label>Título da Música</Label>
                                                    <Input
                                                        placeholder="Ex: Evidências"
                                                        value={newSong.title}
                                                        onChange={(e) => setNewSong(prev => ({...prev, title: e.target.value}))}
                                                    />
                                                </div>

                                                <div>
                                                    <Label>Artista</Label>
                                                    <Input
                                                        placeholder="Ex: Chitãozinho & Xororó"
                                                        value={newSong.artist}
                                                        onChange={(e) => setNewSong(prev => ({...prev, artist: e.target.value}))}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <Label>Duração (segundos)</Label>
                                                        <Input
                                                            type="number"
                                                            value={newSong.duration_seconds}
                                                            onChange={(e) => setNewSong(prev => ({...prev, duration_seconds: e.target.value}))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Dificuldade</Label>
                                                        <Select value={newSong.difficulty_level}
                                                                onValueChange={(value) => setNewSong(prev => ({...prev, difficulty_level: value}))}>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="1">🐣 Fácil</SelectItem>
                                                                <SelectItem value="2">🐔 Médio</SelectItem>
                                                                <SelectItem value="3">🐓 Difícil</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <Label>Arquivo de Áudio (.mp3)</Label>
                                                    <Input
                                                        type="file"
                                                        accept=".mp3,audio/mpeg"
                                                        onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setAudioFile(file);
              }
            }}
                                                        className="cursor-pointer"
                                                    />
                                                    {audioFile && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            📎 {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                                                        </p>
                                                    )}
                                                </div>

                                                <ChickenButton
                                                    variant="corn"
                                                    onClick={handleAddSongWithRelationship}
                                                    disabled={isUploading}
                                                    className="w-full"
                                                >
                                                    {isUploading ? "Fazendo Upload..." : "Adicionar Música"}
                                                </ChickenButton>
                                            </div>
                                        </div>
                                    )}
                                </BarnCard>
                                {/* Lista de Músicas do Álbum */}
                                <BarnCard variant="default" className="p-6">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <Music className="w-5 h-5"/>
                                        Músicas do Álbum ({albumSongs.length})
                                    </h3>

                                    {albumSongs.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4"/>
                                            <p className="text-muted-foreground text-lg mb-2">
                                                Nenhuma música cadastrada</p>
                                            <p className="text-sm text-muted-foreground">
                                                Use o formulário acima para adicionar a primeira música deste álbum
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                            {albumSongs.map((song, index) => (
                                                <div key={song.id}
                                                     className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div
                                                            className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                                            {index + 1}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-lg">{song.title}</h4>
                                                            <p className="text-muted-foreground">{song.artist}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Badge variant="outline" className="text-xs">
                                                                    {song.duration_seconds}s
                                                                </Badge>
                                                                <Badge variant="outline" className="text-xs">
                                                                    {song.difficulty_level === 1 ? '🐣 Fácil' :
                                                                        song.difficulty_level === 2 ? '🐔 Médio' : '🐓 Difícil'}
                                                                </Badge>
                                                                {song.audio_file_url && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        🎵 MP3 Disponível
                                                                    </Badge>
                                                                )}
                                                                {!song.audio_file_url && song.spotify_url && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        🎵 Apenas Spotify
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {/* Player de áudio - apenas para arquivos MP3 */}
                                                        {song.audio_file_url ? (
                                                            <AudioPlayer
                                                                audioUrl={song.audio_file_url}
                                                                songTitle={song.title}
                                                                size="sm"
                                                            />
                                                        ) : (
                                                            <Button variant="outline" size="icon" disabled>
                                                                <VolumeX className="w-4 h-4" />
                                                            </Button>
                                                        )}

                                                        {/* Informação sobre múltiplos álbuns */}
                                                        {song.all_albums && song.all_albums.length > 1 && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                {song.all_albums.length} álbuns
                                                            </Badge>
                                                        )}

                                                        {/* Dropdown com opções */}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="outline" size="icon">
                                                                    <MoreHorizontal className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-56">
                                                                <DropdownMenuItem onClick={() => {
        setEditingSong(song);
        setIsEditSongModalOpen(true);
      }}>
                                                                    <Edit className="w-4 h-4 mr-2" />
                                                                    Editar Música
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem onClick={() => openSongAlbumManager(song)}>
                                                                    <Link className="w-4 h-4 mr-2" />
                                                                    Gerenciar Álbuns
                                                                </DropdownMenuItem>

                                                                <DropdownMenuItem onClick={() => {
  console.log('Tentando mover música da busca:', song);
  console.log('Album songs:', song.album_songs);
  console.log('Albums info:', song.albums_info);

  // Pegar o primeiro album_id disponível
  const firstAlbumId = song.album_songs?.[0]?.album_id ||
                      song.albums_info?.[0]?.album_id;

  console.log('Album ID encontrado:', firstAlbumId);

  if (firstAlbumId) {
    openMoveSongDialog(song, firstAlbumId);
  } else {
    toast({
      title: "Erro",
      description: "Esta música não está vinculada a nenhum álbum ou não foi possível identificar o álbum",
      variant: "destructive",
    });
  }
}}>
                                                                    <ArrowRight className="w-4 h-4 mr-2" />
                                                                    Mover para Outro Álbum
                                                                </DropdownMenuItem>

                                                                <DropdownMenuSeparator />

                                                                <DropdownMenuItem
                                                                    onClick={() => handleDeleteSong(song.id)}
                                                                    className="text-destructive"
                                                                >
                                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                                    Remover Música
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    </div>
                                            ))}
                                        </div>
                                    )}
                                </BarnCard>
                            </div>
                        )}


                    </TabsContent>

                    {/* Genres Management */}
                    <TabsContent value="genres">
                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Add Genre */}
                            <BarnCard variant="coop">
                                <h3 className="text-xl font-bold text-barn-brown mb-4">
                                    🎼 Adicionar Gênero Musical
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <Label>Nome do Gênero</Label>
                                        <Input
                                            placeholder="Ex: Sertanejo"
                                            value={newGenre.name}
                                            onChange={(e) => setNewGenre(prev => ({...prev, name: e.target.value}))}
                                        />
                                    </div>

                                    <div>
                                        <Label>Descrição Temática</Label>
                                        <Input
                                            placeholder="Ex: Sertanejo da Galinha Caipira"
                                            value={newGenre.chicken_description}
                                            onChange={(e) => setNewGenre(prev => ({...prev, chicken_description: e.target.value}))}
                                        />
                                    </div>

                                    <div>
                                        <Label>Descrição (opcional)</Label>
                                        <Input
                                            placeholder="Ex: Música country brasileira"
                                            value={newGenre.description}
                                            onChange={(e) => setNewGenre(prev => ({...prev, description: e.target.value}))}
                                        />
                                    </div>

                                    <div>
                                        <Label>Emoji</Label>
                                        <Input
                                            placeholder="🤠"
                                            value={newGenre.emoji}
                                            onChange={(e) => setNewGenre(prev => ({...prev, emoji: e.target.value}))}
                                        />
                                    </div>

                                    <ChickenButton
                                        variant="barn"
                                        className="w-full"
                                        onClick={handleAddGenre}
                                    >
                                        🎼 Adicionar Gênero
                                    </ChickenButton>
                                </div>
                            </BarnCard>

                            {/* Genres List */}
                            <BarnCard variant="default">
                                <h3 className="text-xl font-bold mb-4">Gêneros Musicais</h3>

                                <div className="space-y-3">
                                    {genres.map((genre) => (
                                        <div key={genre.id}
                                             className="p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{genre.emoji}</span>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold">{genre.name}</h4>
                                                    <p className="text-sm text-muted-foreground">{genre.chicken_description}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="icon"
                                                        onClick={() => openEditGenreModal(genre)}>
                                                    <Edit className="w-4 h-4"/>
                                                </Button>
                                                <Button variant="outline" size="icon"
                                                        onClick={() => handleDeleteGenre(genre.id)}>
                                                    <Trash2 className="w-4 h-4"/>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                </div>
                            </BarnCard>

                            <Dialog open={isEditGenreModalOpen} onOpenChange={setIsEditGenreModalOpen}>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>✏️ Editar Gênero</DialogTitle>
                                    </DialogHeader>

                                    {editingGenre && (
                                        <div className="space-y-4">
                                            <Input
                                                placeholder="Nome do gênero"
                                                value={editingGenre.name}
                                                onChange={(e) => setEditingGenre(prev => prev ? { ...prev, name: e.target.value } : null)}
                                            />
                                            <Input
                                                placeholder="Descrição temática"
                                                value={editingGenre.chicken_description}
                                                onChange={(e) => setEditingGenre(prev => prev ? { ...prev, chicken_description: e.target.value } : null)}
                                            />
                                            <Input
                                                placeholder="Descrição (opcional)"
                                                value={editingGenre.description || ""}
                                                onChange={(e) => setEditingGenre(prev => prev ? { ...prev, description: e.target.value } : null)}
                                            />
                                            <Input
                                                placeholder="Emoji"
                                                value={editingGenre.emoji}
                                                onChange={(e) => setEditingGenre(prev => prev ? { ...prev, emoji: e.target.value } : null)}
                                            />

                                            <div className="flex gap-2">
                                                <ChickenButton variant="corn" className="flex-1"
                                                               onClick={handleUpdateGenre}>
                                                    ✅ Salvar Alterações
                                                </ChickenButton>
                                                <ChickenButton variant="feather"
                                                               onClick={() => setIsEditGenreModalOpen(false)}>
                                                    ❌ Cancelar
                                                </ChickenButton>
                                            </div>
                                        </div>
                                    )}
                                </DialogContent>
                            </Dialog>

                        </div>
                    </TabsContent>

                    {/* Settings */}
                    <TabsContent value="settings">
                        <div className="space-y-6">
                            {/* Modo de Jogo - mantém igual */}
                            <BarnCard variant="default" className={`transition-all ${battleMode === 'battle' ? 'border-red-200 bg-red-50/30' : 'border-blue-200 bg-blue-50/30'}`}>
                                <div className="p-6">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        {battleMode === 'battle' ? '⚔️' : '🎵'} Modo de Jogo
                                    </h3>

                                    <div className="flex items-center justify-between mb-4">
                                        <div className="space-y-1">
                                            <Label className="text-base font-medium">
                                                Modo Atual: {battleMode === 'battle' ? 'Batalha' : 'Clássico'}
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                {battleMode === 'battle'
                                                    ? 'Jogadores competem pelos ovos uns dos outros'
                                                    : 'Jogadores acumulam pontos por acertos'
                                                }
                                            </p>
                                        </div>

                                        <div className="flex items-center space-x-4">
                                            <div className="flex items-center space-x-2">
                                                <Label htmlFor="battle-mode" className={battleMode === 'classic' ? "font-semibold" : ""}>
                                                    Clássico
                                                </Label>
                                                <Switch
                                                    id="battle-mode"
                                                    checked={battleMode === 'battle'}
                                                    onCheckedChange={(checked) => updateBattleMode(checked ? 'battle' : 'classic')}
                                                    disabled={isLoadingBattleSettings}
                                                    className="data-[state=checked]:bg-red-600"
                                                />
                                                <Label htmlFor="battle-mode" className={battleMode === 'battle' ? "font-semibold" : ""}>
                                                    Batalha
                                                </Label>
                                            </div>
                                        </div>
                                    </div>

                                    {battleMode === 'battle' && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                            <div className="flex items-start gap-2">
                                                <span className="text-yellow-600 mt-0.5">⚠️</span>
                                                <div className="text-sm">
                                                    <p className="font-medium text-yellow-800">Como funciona o Modo Batalha:</p>
                                                    <ul className="mt-2 space-y-1 text-yellow-700">
                                                        <li>• Cada jogador recebe {battleSettings.initialEggs} ovos no início</li>
                                                        <li>• Quem erra perde {battleSettings.eggsPerRound} ovos</li>
                                                        <li>• Ovos perdidos são redistribuídos entre quem acertou</li>
                                                        <li>• Se ninguém responder, os ovos ficam como estão</li>
                                                        <li>• Se todos acertarem, ninguém ganha nem perde ovos</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </BarnCard>

                            {/* NOVO: Configurações do Modo Clássico */}
                            <BarnCard variant="coop" className="border-blue-200">
                                <div className="p-6">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-700">
                                        🎵 Configurações do Modo Clássico
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-lg">Sistema de Pontuação</h4>

                                            <div>
                                                <Label>Ovos por Acerto</Label>
                                                <Input
                                                    type="number"
                                                    value={classicSettings.eggs_per_correct}
                                                    onChange={(e) => setClassicSettings(prev => ({
                  ...prev,
                  eggs_per_correct: parseInt(e.target.value) || 0
                }))}
                                                    className="text-center font-mono"
                                                />
                                            </div>

                                            <div>
                                                <Label>Bônus de Velocidade</Label>
                                                <Input
                                                    type="number"
                                                    value={classicSettings.speed_bonus}
                                                    onChange={(e) => setClassicSettings(prev => ({
                  ...prev,
                  speed_bonus: parseInt(e.target.value) || 0
                }))}
                                                    className="text-center font-mono"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Ovos extras para respostas rápidas
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-lg">Configurações de Tempo</h4>

                                            <div>
                                                <Label>Tempo por Pergunta (segundos)</Label>
                                                <Input
                                                    type="number"
                                                    value={classicSettings.time_per_question}
                                                    onChange={(e) => setClassicSettings(prev => ({
                  ...prev,
                  time_per_question: parseInt(e.target.value) || 0
                }))}
                                                    className="text-center font-mono"
                                                />
                                            </div>

                                            <div>
                                                <Label>Duração da Música (segundos)</Label>
                                                <Input
                                                    type="number"
                                                    value={classicSettings.song_duration}
                                                    onChange={(e) => setClassicSettings(prev => ({
                  ...prev,
                  song_duration: parseInt(e.target.value) || 0
                }))}
                                                    className="text-center font-mono"
                                                />
                                            </div>

                                            <ChickenButton
                                                variant="corn"
                                                onClick={saveClassicSettings}
                                                className="w-full mt-4"
                                            >
                                                💾 Salvar Configurações Clássicas
                                            </ChickenButton>
                                        </div>
                                    </div>
                                </div>
                            </BarnCard>

                            {/* NOVO: Configurações do Modo Batalha */}
                            <BarnCard variant="default" className="border-red-200">
                                <div className="p-6">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-700">
                                        ⚔️ Configurações do Modo Batalha
                                    </h3>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-lg">Sistema de Ovos</h4>

                                            <div>
                                                <Label>Ovos por Rodada</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="50"
                                                    value={battleSettings.eggsPerRound}
                                                    onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setBattleSettings(prev => ({
                    ...prev,
                    eggsPerRound: value,
                    initialEggs: value * prev.totalRounds
                  }));
                }}
                                                    className="text-center font-mono"
                                                />
                                            </div>

                                            <div>
                                                <Label>Total de Rodadas</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={battleSettings.totalRounds}
                                                    onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setBattleSettings(prev => ({
                    ...prev,
                    totalRounds: value,
                    initialEggs: prev.eggsPerRound * value
                  }));
                }}
                                                    className="text-center font-mono"
                                                />
                                            </div>

                                            <div>
                                                <Label>Tempo por Pergunta (segundos)</Label>
                                                <Input
                                                    type="number"
                                                    value={battleSettings.time_per_question}
                                                    onChange={(e) => setBattleSettings(prev => ({
                  ...prev,
                  time_per_question: parseInt(e.target.value) || 0
                }))}
                                                    className="text-center font-mono"
                                                />
                                            </div>

                                            <div>
                                                <Label>Duração da Música (segundos)</Label>
                                                <Input
                                                    type="number"
                                                    value={battleSettings.song_duration}
                                                    onChange={(e) => setBattleSettings(prev => ({
                  ...prev,
                  song_duration: parseInt(e.target.value) || 0
                }))}
                                                    className="text-center font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Resumo - código existente */}
                                            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
                                                <h4 className="font-medium text-red-800 mb-3">📊 Resumo da Configuração</h4>
                                                <div className="space-y-3 text-sm">
                                                    <div className="flex justify-between items-center p-2 bg-white rounded border">
                                                        <span className="text-gray-600">Ovos Iniciais:</span>
                                                        <span className="font-bold text-red-600">{battleSettings.initialEggs}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center p-2 bg-white rounded border">
                                                        <span className="text-gray-600">Ovos por Rodada:</span>
                                                        <span className="font-bold text-orange-600">{battleSettings.eggsPerRound}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center p-2 bg-white rounded border">
                                                        <span className="text-gray-600">Total de Rodadas:</span>
                                                        <span className="font-bold text-blue-600">{battleSettings.totalRounds}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <ChickenButton
                                                variant="barn"
                                                onClick={saveBattleSettings}
                                                disabled={isLoadingBattleSettings}
                                                className="w-full"
                                            >
                                                {isLoadingBattleSettings ? "Salvando..." : "💾 Salvar Configurações de Batalha"}
                                            </ChickenButton>
                                        </div>
                                    </div>
                                </div>
                            </BarnCard>

                            {/* NOVO: Configurações Gerais */}
                            <BarnCard variant="golden">
                                <h3 className="text-xl font-bold text-white mb-4">
                                    ⚙️ Configurações Gerais
                                </h3>

                                <div className="grid md:grid-cols-3 gap-6 text-white">
                                    <div>
                                        <Label className="text-white/90">Máximo de Jogadores por Sala</Label>
                                        <Input
                                            type="number"
                                            value={generalSettings.max_players}
                                            onChange={(e) => setGeneralSettings(prev => ({
              ...prev,
              max_players: parseInt(e.target.value) || 0
            }))}
                                            className="bg-white/20 border-white/30 text-white text-center font-mono"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-white/90">Timeout da Sala (segundos)</Label>
                                        <Input
                                            type="number"
                                            value={generalSettings.room_timeout}
                                            onChange={(e) => setGeneralSettings(prev => ({
              ...prev,
              room_timeout: parseInt(e.target.value) || 0
            }))}
                                            className="bg-white/20 border-white/30 text-white text-center font-mono"
                                        />
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="auto-next"
                                            checked={generalSettings.auto_next_round}
                                            onCheckedChange={(checked) => setGeneralSettings(prev => ({
              ...prev,
              auto_next_round: checked
            }))}
                                        />
                                        <Label htmlFor="auto-next" className="text-white/90">
                                            Avançar Rodada Automaticamente
                                        </Label>
                                    </div>
                                </div>

                                <ChickenButton
                                    variant="feather"
                                    className="w-full mt-6"
                                    onClick={saveGeneralSettings}
                                >
                                    💾 Salvar Configurações Gerais
                                </ChickenButton>
                            </BarnCard>
                        </div>
                    </TabsContent>
                </Tabs>


                {/* Modal de edição */}
                {/* Modal de edição */}
                <Dialog open={isEditAlbumModalOpen} onOpenChange={setIsEditAlbumModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>✏️ Editar Álbum</DialogTitle>
                        </DialogHeader>

                        {editingAlbum && (
                            <div className="space-y-4">
                                <Input
                                    placeholder="Nome do Álbum"
                                    value={editingAlbum.name}
                                    onChange={e =>
            setEditingAlbum(prev => prev ? { ...prev, name: e.target.value } : null)
          }
                                />
                                <Input
                                    placeholder="Artista/Intérprete"
                                    value={editingAlbum.artist_name}
                                    onChange={e =>
            setEditingAlbum(prev => prev ? { ...prev, artist_name: e.target.value } : null)
          }
                                />
                                <Input
                                    placeholder="Ano de Lançamento"
                                    type="number"
                                    value={editingAlbum.release_year || ""}
                                    onChange={e =>
            setEditingAlbum(prev =>
              prev ? { ...prev, release_year: parseInt(e.target.value) || null } : null
            )
          }
                                />
                                <Textarea
                                    placeholder="Descrição"
                                    value={editingAlbum.description}
                                    onChange={e =>
            setEditingAlbum(prev => prev ? { ...prev, description: e.target.value } : null)
          }
                                />
                                <Select
                                    value={editingAlbum.genre_id}
                                    onValueChange={value =>
            setEditingAlbum(prev => prev ? { ...prev, genre_id: value } : null)
          }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Escolher gênero"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {genres.map(genre => (
                                            <SelectItem key={genre.id} value={genre.id}>
                                                {genre.emoji} {genre.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Upload de capa */}
                                <div className="space-y-2">
                                    <Label>Capa do Álbum</Label>
                                    {editingAlbum.cover_image_url && (
                                        <img
                                            src={editingAlbum.cover_image_url}
                                            alt="Capa do Álbum"
                                            className="w-32 h-32 object-cover rounded-lg border"
                                            onError={(e) => {
        console.error('Erro ao carregar imagem:', e);
        e.currentTarget.src = '/placeholder-album.png'; // Fallback
      }}
                                        />
                                    )}
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      console.log('🖼️ Arquivo selecionado para edição:', file);

      try {
        setIsUploadingCover(true);

        const timestamp = Date.now();
        const slug = editingAlbum.name
          .toLowerCase()
          .replace(/[^a-z0-9]/gi, "-");
        const ext = file.name.split(".").pop();
        const fileName = `${slug}-${timestamp}.${ext}`;

        console.log('📂 Fazendo upload:', fileName);

        const { data, error } = await supabase.storage
          .from("album-covers")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: true
          });

        if (error) {
          console.error('❌ Erro no storage:', error);
          throw error;
        }

        console.log('✅ Upload bem-sucedido:', data);

        const { data: { publicUrl } } = supabase.storage
          .from("album-covers")
          .getPublicUrl(fileName);

        console.log('🔗 Nova URL:', publicUrl);

        // Atualizar estado local
       setEditingAlbum(prev => {
  const updated = prev ? { ...prev, cover_image_url: publicUrl } : null;
  console.log('🔄 Estado atualizado:', updated?.cover_image_url);
  return updated;
});
        toast({
          title: "Nova capa carregada",
          description: "Clique em 'Salvar Alterações' para confirmar"
        });

      } catch (err) {
        console.error('💥 Erro no upload da edição:', err);
        toast({
          title: "Erro ao carregar capa",
          description: err.message || "Falha no upload",
          variant: "destructive",
        });
      } finally {
        setIsUploadingCover(false);
      }
    }}
                                        disabled={isUploadingCover}
                                    />
                                    {isUploadingCover && (
                                        <p className="text-sm text-muted-foreground">
                                            Fazendo upload da imagem...
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <ChickenButton
                                        variant="corn"
                                        className="flex-1"
                                        onClick={handleUpdateAlbum}
                                    >
                                        ✅ Salvar Alterações
                                    </ChickenButton>
                                    <ChickenButton
                                        variant="feather"
                                        onClick={() => setIsEditAlbumModalOpen(false)}
                                    >
                                        ❌ Cancelar
                                    </ChickenButton>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>


                {/* Modal de Edição de Música - VERSÃO CORRIGIDA */}
                <Dialog open={isEditSongModalOpen} onOpenChange={setIsEditSongModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>✏️ Editar Música</DialogTitle>
                        </DialogHeader>

                        {editingSong && (
                            <div className="space-y-4">
                                <div>
                                    <Label>Título da Música</Label>
                                    <Input
                                        value={editingSong.title}
                                        onChange={(e) => setEditingSong(prev => prev ? {...prev, title: e.target.value} : null)}
                                    />
                                </div>

                                <div>
                                    <Label>Artista</Label>
                                    <Input
                                        value={editingSong.artist}
                                        onChange={(e) => setEditingSong(prev => prev ? {...prev, artist: e.target.value} : null)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Duração (segundos)</Label>
                                        <Input
                                            type="number"
                                            value={editingSong.duration_seconds || 10}
                                            onChange={(e) => setEditingSong(prev => prev ? {...prev, duration_seconds: parseInt(e.target.value) || 10} : null)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Dificuldade</Label>
                                        <Select
                                            value={(editingSong.difficulty_level || 1).toString()}
                                            onValueChange={(value) => setEditingSong(prev => prev ? {...prev, difficulty_level: parseInt(value)} : null)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">🐣 Fácil</SelectItem>
                                                <SelectItem value="2">🐔 Médio</SelectItem>
                                                <SelectItem value="3">🐓 Difícil</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Prévia do Áudio - apenas para MP3 */}
                                {editingSong?.audio_file_url && (
                                <div className="border rounded-lg p-4 bg-muted/30">
                                    <Label className="text-sm font-medium mb-3 block">Prévia do Arquivo MP3</Label>
                                    <AudioPlayer
                                        audioUrl={editingSong.audio_file_url}
                                        songTitle={editingSong.title}
                                        size="lg"
                                        className="w-full"
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Você pode reproduzir a música completa para verificar a qualidade
                                    </p>
                                </div>
                                )}

                                {/* Se não há arquivo MP3, mostrar aviso */}
                                {editingSong && !editingSong.audio_file_url && (
                                    <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                                        <div className="flex items-center gap-2">
                                            <VolumeX className="w-5 h-5 text-yellow-600" />
                                            <div>
                                                <p className="text-sm font-medium text-yellow-800">
                                                    Nenhum arquivo MP3 disponível
                                                </p>
                                                <p className="text-xs text-yellow-600">
                                                    Faça upload de um arquivo .mp3 para habilitar a reprodução
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Botões de ação - VERSÃO CORRIGIDA */}
                                <div className="flex gap-2 pt-4">
                                    <ChickenButton
                                        variant="corn"
                                        className="flex-1"
                                        onClick={handleUpdateSongModal}
                                    >
                                        ✅ Salvar Alterações
                                    </ChickenButton>
                                    <ChickenButton
                                        variant="feather"
                                        onClick={() => {
              setIsEditSongModalOpen(false);
              setEditingSong(null);
            }}
                                    >
                                        ❌ Cancelar
                                    </ChickenButton>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Modal de Gerenciamento de Álbuns da Música */}
                <SongAlbumManager
                    isOpen={isSongAlbumManagerOpen}
                    onClose={() => {
    setIsSongAlbumManagerOpen(false);
    setSelectedSongForManager(null);
  }}
                    song={selectedSongForManager}
                    onUpdate={() => {
    if (selectedAlbum) {
      loadAlbumSongsWithRelationships(selectedAlbum.id);
    }
    loadTotalSongsCount();
    loadAlbums();
    if (filters.artist || filters.song || filters.year) {
      searchSongsWithAlbums();
    }
  }}
                />

                {/* Modal de Mover Música */}
                <MoveSongDialog
                    isOpen={isMoveSongDialogOpen}
                    onClose={() => {
    setIsMoveSongDialogOpen(false);
    setSelectedSongForManager(null);
    setCurrentAlbumIdForMove('');
  }}
                    song={selectedSongForManager}
                    currentAlbumId={currentAlbumIdForMove}
                    onMove={() => {
    if (selectedAlbum) {
      loadAlbumSongsWithRelationships(selectedAlbum.id);
    }
    loadAlbums();
  }}
                />
            </div>
        </div>
    );
}