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
import {Music, Users, Egg, Settings, Plus, Trash2, Edit, LogOut} from "lucide-react";
import {toast} from "@/hooks/use-toast";
import {supabase} from "@/integrations/supabase/client";
import {ArrowLeft, FolderOpen} from "lucide-react";
import {Switch} from "@/components/ui/switch";
import {Separator} from "@/components/ui/separator";
import {Music2, Disc3} from "lucide-react";
import { BulkUploadComponent } from "@/components/BulkUploadComponent";

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


    // Estados para configurações
    const [gameSettings, setGameSettings] = useState({
        eggs_per_correct: 10,
        speed_bonus: 5,
        time_per_question: 10,
        max_players: 10,
        song_duration: 10
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

    const searchSongs = useCallback(async() => {
        // Se não há filtros, limpa os resultados
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
        albums (
          name,
          artist_name,
          release_year,
          cover_image_url
        )
      `);

            // Filtro por artista da música
            if (filters.artist) {
                query = query.ilike('artist', `%${filters.artist}%`);
            }

            // Filtro por nome da música
            if (filters.song) {
                query = query.ilike('title', `%${filters.song}%`);
            }

            const {data, error} = await query.order('created_at', {ascending: false});

            if (error) throw error;

            let filtered = data || [];

            // Filtro por ano (do álbum) - feito após a query
            if (filters.year) {
                filtered = filtered.filter(song =>
                    song.albums ?.release_year ?.toString().includes(filters.year)
            )
            }

            setSearchResults(filtered as Song[]);
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
    }, [albums, filters]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchSongs();
        }, 500); // Debounce de 500ms

        return () => clearTimeout(timeoutId);
    }, [searchSongs]);

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
                const mode = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                setGameMode(mode);
            }
        } catch (error) {
            console.error("Error loading game mode:", error);
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
        loadGenres();
        loadSongs();
        loadGameSettings();
        loadGameMode();
        loadAlbums();
        loadTotalSongsCount();
        loadAllUsers();
    }, []);


    const loadAlbums = async() => {
        try {
            const {data, error} = await supabase
                .from('albums')
                .select(`
      *,
      genres (
        id,
        name,
        emoji
      ),
      songs (count)
    `)
                .order('created_at', {ascending: false});

            if (error) throw error;

            setAlbums(data || []);
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível carregar os álbuns",
                variant: "destructive",
            });
        }
    };

    const loadAlbumSongs = async(albumId: string) => {
        try {
            const {data, error} = await supabase
                .from('songs')
                .select('*')
                .eq('album_id', albumId)
                .order('created_at', {ascending: false});

            if (error) throw error;
            setAlbumSongs(data || []);
        } catch (error) {
            toast({
                title: "Erro",
                description: "Não foi possível carregar as músicas do álbum",
                variant: "destructive",
            });
        }
    };

    // Funções de navegação
    const openAlbum = async(album: Album) => {
        setSelectedAlbum(album);
        setCurrentView('album-detail');
        await loadAlbumSongs(album.id);
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

    // Carregar configurações do banco
    const loadGameSettings = async() => {
        try {
            const {data, error} = await supabase
                .from('game_settings')
                .select('key, value');

            if (error) throw error;

            const settings: any = {};
            data ?.forEach(setting => {
                settings[setting.key] = parseInt(setting.value as string);
            });

            setGameSettings(prev => ({...prev, ...settings}));
        } catch (error) {

        }
    };

    // Função para salvar configurações
    const saveGameSettings = async() => {
        try {
            // Salvar cada configuração no banco
            const promises = Object.entries(gameSettings).map(([key, value]) =>
                supabase
                    .from('game_settings')
                    .upsert({key, value: value.toString()})
            );

            await Promise.all(promises);

            toast({
                title: "✅ Configurações salvas!",
                description: "As configurações do galinheiro foram atualizadas com sucesso.",
            });

        } catch (error) {
            toast({
                title: "❌ Erro",
                description: "Erro ao salvar configurações",
                variant: "destructive"
            });
        }
    };

    const handleSettingChange = (field: string, value: string) => {
        setGameSettings(prev => ({
            ...prev,
            [field]: parseInt(value) || 0
        }));
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

    const handleAddSong = async() => {
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

            const songData = {
                title: newSong.title,
                artist: newSong.artist,
                album_id: selectedAlbum.id, // <- ASSOCIA AO ÁLBUM AUTOMATICAMENTE
                genre_id: selectedAlbum.genre_id, // <- HERDA O GÊNERO DO ÁLBUM
                duration_seconds: parseInt(newSong.duration_seconds) || 10,
                spotify_url: newSong.spotify_url || null,
                youtube_url: newSong.youtube_url || null,
                audio_file_url: audioFileUrl || newSong.audio_file_url || null,
                difficulty_level: parseInt(newSong.difficulty_level) || 1,
                is_active: true
            };

            const {error} = await supabase
                .from('songs')
                .insert([songData]);

            if (error) throw error;

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
            await loadAlbumSongs(selectedAlbum.id); // <- RECARREGA AS MÚSICAS DO ÁLBUM
            await loadTotalSongsCount(); // Adicione esta linha
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
                await loadAlbumSongs(selectedAlbum.id); // <- RECARREGA MÚSICAS DO ÁLBUM ATUAL
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
                                                    {song.albums ?.cover_image_url && (
                                                    <img
                                                        src={song.albums.cover_image_url}
                                                        alt={song.albums.name}
                                                        className="w-16 h-16 object-cover rounded-lg"
                                                    />
                                                    )}

                                                    <div className="flex-1">
                                                        <h5 className="font-semibold text-lg">{song.title}</h5>
                                                        <p className="text-muted-foreground">{song.artist}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge variant="outline" className="text-xs">
                                                                Álbum: {song.albums ?.name}
                                                            </Badge>
                                                            {song.albums ?.release_year && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {song.albums.release_year}
                                                            </Badge>
                                                            )}
                                                            <Badge variant="secondary" className="text-xs">
                                                                {song.duration_seconds}s
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => {
                setEditingSong(song);
                setIsEditSongModalOpen(true);
              }}
                                                        >
                                                            <Edit className="w-4 h-4"/>
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleDeleteSong(song.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4"/>
                                                        </Button>
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
                                                className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105"
                                                onClick={() => openAlbum(album)}
                                            >
                                                <CardHeader className="p-4">
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
                                                                {album.songs ?.[0]?.count || 0} músicas
                                                            </Badge>

                                                        </div>
                                                        <div className="flex gap-1">
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
        loadAlbumSongs(selectedAlbum.id);
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
                                                    onClick={handleAddSong}
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
                                                                    <Badge variant="secondary" className="text-xs">🎵 Áudio</Badge>
                                                                )}
                                                                {song.spotify_url && (
                                                                    <Badge variant="secondary" className="text-xs">🎵 Spotify</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => {
                      setEditingSong(song);
                      setIsEditSongModalOpen(true);
                    }}
                                                        >
                                                            <Edit className="w-4 h-4"/>
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleDeleteSong(song.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4"/>
                                                        </Button>
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
                        <BarnCard variant="golden">
                            <h3 className="text-xl font-bold text-white mb-4">
                                ⚙️ Configurações do Galinheiro
                            </h3>

                            <div className="grid md:grid-cols-2 gap-6 text-white">
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-lg">Configurações de Jogo</h4>

                                    <div>
                                        <Label className="text-white/90">Ovos por acerto</Label>
                                        <Input
                                            value={gameSettings.eggs_per_correct}
                                            onChange={(e) => handleSettingChange('eggs_per_correct', e.target.value)}
                                            className="bg-white/20 border-white/30 text-white"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-white/90">Bônus velocidade</Label>
                                        <Input
                                            value={gameSettings.speed_bonus}
                                            onChange={(e) => handleSettingChange('speed_bonus', e.target.value)}
                                            className="bg-white/20 border-white/30 text-white"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-white/90">Tempo por pergunta (segundos)</Label>
                                        <Input
                                            value={gameSettings.time_per_question}
                                            onChange={(e) => handleSettingChange('time_per_question', e.target.value)}
                                            className="bg-white/20 border-white/30 text-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-semibold text-lg">Configurações Avançadas</h4>

                                    <div>
                                        <Label className="text-white/90">Máximo de jogadores por sala</Label>
                                        <Input
                                            value={gameSettings.max_players}
                                            onChange={(e) => handleSettingChange('max_players', e.target.value)}
                                            className="bg-white/20 border-white/30 text-white"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-white/90">Duração da música (segundos)</Label>
                                        <Input
                                            value={gameSettings.song_duration}
                                            onChange={(e) => handleSettingChange('song_duration', e.target.value)}
                                            className="bg-white/20 border-white/30 text-white"
                                        />
                                    </div>

                                    <ChickenButton
                                        variant="feather"
                                        className="w-full"
                                        onClick={saveGameSettings}
                                    >
                                        💾 Salvar Configurações
                                    </ChickenButton>
                                </div>
                            </div>
                        </BarnCard>
                    </TabsContent>

                    {/* Analytics */}
                    <TabsContent value="analytics">
                        <div className="grid md:grid-cols-2 gap-6">
                            <BarnCard variant="nest">
                                <h3 className="text-xl font-bold text-primary mb-4">📈 Estatísticas</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span>Partidas hoje:</span>
                                        <Badge>142</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Gênero mais jogado:</span>
                                        <Badge variant="secondary">🤠 Sertanejo</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Música mais acertada:</span>
                                        <Badge variant="outline">Evidências</Badge>
                                    </div>
                                </div>
                            </BarnCard>

                            <BarnCard variant="coop" className="text-center">
                                <div className="flex flex-col items-center">
                                    <Music className="w-8 h-8 text-barn-brown mb-2"/>
                                    <div className="text-2xl font-bold text-barn-brown">{albums.length}</div>
                                    <div className="text-sm text-muted-foreground">Álbuns Cadastrados</div>
                                </div>
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


                {/* Modal de Edição de Música */}
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

                                {/*<div>*/}
                                {/*<Label>URL do Spotify (opcional)</Label>*/}
                                {/*<Input*/}
                                {/*value={editingSong.spotify_url || ''}*/}
                                {/*onChange={(e) => setEditingSong(prev => prev ? {...prev, spotify_url: e.target.value} : null)}*/}
                                {/*placeholder="https://open.spotify.com/..."*/}
                                {/*/>*/}
                                {/*</div>*/}

                                {/*<div>*/}
                                {/*<Label>URL do YouTube (opcional)</Label>*/}
                                {/*<Input*/}
                                {/*value={editingSong.youtube_url || ''}*/}
                                {/*onChange={(e) => setEditingSong(prev => prev ? {...prev, youtube_url: e.target.value} : null)}*/}
                                {/*placeholder="https://youtube.com/..."*/}
                                {/*/>*/}
                                {/*</div>*/}

                                {/*<div>*/}
                                {/*<Label>URL do arquivo de áudio (opcional)</Label>*/}
                                {/*<Input*/}
                                {/*value={editingSong.audio_file_url || ''}*/}
                                {/*onChange={(e) => setEditingSong(prev => prev ? {...prev, audio_file_url: e.target.value} : null)}*/}
                                {/*placeholder="URL do arquivo de áudio"*/}
                                {/*/>*/}
                                {/*</div>*/}

                                <div className="flex gap-2 pt-4">
                                    <ChickenButton
                                        variant="corn"
                                        className="flex-1"
                                        onClick={async () => {
              if (!editingSong || !selectedAlbum) return;

              try {
                const { error } = await supabase
                  .from('songs')
                  .update({
                    title: editingSong.title,
                    artist: editingSong.artist,
                    duration_seconds: editingSong.duration_seconds || 10,
                    spotify_url: editingSong.spotify_url || null,
                    youtube_url: editingSong.youtube_url || null,
                    audio_file_url: editingSong.audio_file_url || null,
                    difficulty_level: editingSong.difficulty_level || 1,
                  })
                  .eq('id', editingSong.id);

                if (error) throw error;

                toast({ title: "Música atualizada!" });
                setIsEditSongModalOpen(false);
                setEditingSong(null);
                await loadAlbumSongs(selectedAlbum.id);
              } catch (error) {
                toast({
                  title: "Erro",
                  description: "Não foi possível atualizar a música",
                  variant: "destructive",
                });
              }
            }}
                                    >
                                        ✅ Salvar Alterações
                                    </ChickenButton>
                                    <ChickenButton variant="feather" onClick={() => setIsEditSongModalOpen(false)}>
                                        ❌ Cancelar
                                    </ChickenButton>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}